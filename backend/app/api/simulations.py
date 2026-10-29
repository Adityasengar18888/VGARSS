"""Simulation Management & Stepping REST Router."""
import json
import uuid
import sqlite3
from typing import List, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from backend.app.database import get_db
from backend.app.api.deps import require_group_access
from backend.app.schemas.simulation import (
    SimulationCreate,
    SimulationResponse,
    SimulationStepResponse,
    PolicyUpdateRequest,
    ProcessInput,
)
from backend.app.simulation.models import ProcessDefinition
from backend.app.simulation.schedulers import (
    FCFSScheduler,
    SJFScheduler,
    RoundRobinScheduler,
    PriorityScheduler,
)
from backend.app.simulation.resources import (
    ResourceManager,
    ResourceDefinition,
    ResourceType,
)
from backend.app.simulation.engine import SimulationEngine
from backend.app.network import connection_manager, EventType

router = APIRouter(prefix="/api/v1/groups/{group_id}/simulations", tags=["Simulations"])

# In-memory runtime cache for active engines
active_simulations: Dict[str, SimulationEngine] = {}


def load_or_reconstruct_engine(sim_id: str, db: sqlite3.Connection) -> SimulationEngine:
    """Retrieves engine from in-memory cache or reconstructs it from SQLite persistence."""
    if sim_id in active_simulations:
        return active_simulations[sim_id]

    cursor = db.execute("SELECT * FROM simulations WHERE id = ?", (sim_id,))
    sim_row = cursor.fetchone()
    if not sim_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Simulation '{sim_id}' does not exist.",
        )

    # Reconstruct processes
    proc_cursor = db.execute(
        "SELECT * FROM simulation_processes WHERE simulation_id = ? ORDER BY arrival_time, id",
        (sim_id,),
    )
    p_defs = [
        ProcessDefinition(
            id=r["id"],
            arrival_time=r["arrival_time"],
            burst_time=r["burst_time"],
            priority=r["priority"],
        )
        for r in proc_cursor.fetchall()
    ]

    # Instantiate scheduler
    algo = sim_row["algorithm"].upper()
    if algo == "FCFS":
        sched = FCFSScheduler()
    elif algo == "SJF":
        sched = SJFScheduler(is_preemptive=False)
    elif algo == "SRTF":
        sched = SJFScheduler(is_preemptive=True)
    elif algo == "ROUND_ROBIN":
        sched = RoundRobinScheduler(time_quantum=sim_row["time_quantum"])
    elif "PRIORITY" in algo:
        sched = PriorityScheduler(
            is_preemptive=bool(sim_row["is_preemptive"]),
            aging_interval=sim_row["aging_interval"],
        )
    else:
        sched = FCFSScheduler()

    # Reconstruct resources
    res_mgr = ResourceManager()
    res_cursor = db.execute("SELECT * FROM simulation_resources WHERE simulation_id = ?", (sim_id,))
    for rr in res_cursor.fetchall():
        res_mgr.register_resource(
            ResourceDefinition(
                id=rr["id"],
                name=rr["name"],
                total_capacity=rr["total_capacity"],
                resource_type=ResourceType(rr["resource_type"]),
                order_rank=rr["order_rank"],
            )
        )

    engine = SimulationEngine(scheduler=sched, processes=p_defs, resource_manager=res_mgr)
    active_simulations[sim_id] = engine
    return engine


@router.post("", response_model=SimulationResponse, status_code=status.HTTP_201_CREATED)
def create_simulation(
    group_id: str,
    payload: SimulationCreate,
    group: dict = Depends(require_group_access),
    db: sqlite3.Connection = Depends(get_db),
):
    """Creates and persists a new simulation run in the Virtual Group."""
    sim_id = str(uuid.uuid4())

    with db:
        db.execute(
            """
            INSERT INTO simulations (
                id, group_id, name, algorithm, time_quantum, aging_interval, is_preemptive, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'INITIALIZED')
            """,
            (
                sim_id,
                group_id,
                payload.name,
                payload.algorithm.upper(),
                payload.time_quantum,
                payload.aging_interval,
                1 if payload.is_preemptive else 0,
            ),
        )

        for p in payload.processes:
            db.execute(
                """
                INSERT INTO simulation_processes (
                    id, simulation_id, arrival_time, burst_time, remaining_time, priority, state
                ) VALUES (?, ?, ?, ?, ?, ?, 'NEW')
                """,
                (p.id, sim_id, p.arrival_time, p.burst_time, p.burst_time, p.priority),
            )

        for r in payload.resources:
            db.execute(
                """
                INSERT INTO simulation_resources (
                    id, simulation_id, name, resource_type, total_capacity, available_units, order_rank
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (r.id, sim_id, r.name, r.resource_type.upper(), r.total_capacity, r.total_capacity, r.order_rank),
            )

    engine = load_or_reconstruct_engine(sim_id, db)

    connection_manager.broadcast(
        group_id=group_id,
        event_type=EventType.SIMULATION_CREATED.value,
        simulation_id=sim_id,
        payload={
            "simulation_id": sim_id,
            "name": payload.name,
            "algorithm": payload.algorithm.upper(),
            "time_quantum": payload.time_quantum,
            "total_processes": len(payload.processes),
            "total_resources": len(payload.resources),
        },
    )

    return SimulationResponse(
        id=sim_id,
        group_id=group_id,
        name=payload.name,
        algorithm=payload.algorithm.upper(),
        time_quantum=payload.time_quantum,
        status="INITIALIZED",
        current_tick=0,
        cpu_utilization=0.0,
        avg_waiting_time=0.0,
        avg_turnaround_time=0.0,
        avg_response_time=0.0,
        throughput=0.0,
        processes=[{"id": p.id, "arrival": p.arrival_time, "burst": p.burst_time} for p in payload.processes],
        created_at="now",
    )


@router.get("", response_model=List[SimulationResponse])
def list_simulations(
    group_id: str,
    group: dict = Depends(require_group_access),
    db: sqlite3.Connection = Depends(get_db),
):
    """Lists all simulation runs within the Virtual Group."""
    cursor = db.execute("SELECT * FROM simulations WHERE group_id = ? ORDER BY created_at DESC", (group_id,))
    rows = cursor.fetchall()
    return [
        SimulationResponse(
            id=r["id"],
            group_id=r["group_id"],
            name=r["name"],
            algorithm=r["algorithm"],
            time_quantum=r["time_quantum"],
            status=r["status"],
            current_tick=r["current_tick"],
            cpu_utilization=r["cpu_utilization"],
            avg_waiting_time=r["avg_waiting_time"],
            avg_turnaround_time=r["avg_turnaround_time"],
            avg_response_time=r["avg_response_time"],
            throughput=r["throughput"],
            created_at=str(r["created_at"]),
        )
        for r in rows
    ]


@router.get("/{sim_id}", response_model=SimulationResponse)
def get_simulation(
    group_id: str,
    sim_id: str,
    group: dict = Depends(require_group_access),
    db: sqlite3.Connection = Depends(get_db),
):
    """Retrieves full simulation state and live PCB metrics."""
    cursor = db.execute("SELECT * FROM simulations WHERE id = ? AND group_id = ?", (sim_id, group_id))
    sim_row = cursor.fetchone()
    if not sim_row:
        raise HTTPException(status_code=404, detail="Simulation not found.")

    proc_cursor = db.execute("SELECT * FROM simulation_processes WHERE simulation_id = ?", (sim_id,))
    processes = [dict(p) for p in proc_cursor.fetchall()]

    return SimulationResponse(
        id=sim_row["id"],
        group_id=sim_row["group_id"],
        name=sim_row["name"],
        algorithm=sim_row["algorithm"],
        time_quantum=sim_row["time_quantum"],
        status=sim_row["status"],
        current_tick=sim_row["current_tick"],
        cpu_utilization=sim_row["cpu_utilization"],
        avg_waiting_time=sim_row["avg_waiting_time"],
        avg_turnaround_time=sim_row["avg_turnaround_time"],
        avg_response_time=sim_row["avg_response_time"],
        throughput=sim_row["throughput"],
        processes=processes,
        created_at=str(sim_row["created_at"]),
    )


@router.post("/{sim_id}/step", response_model=SimulationStepResponse)
def step_simulation(
    group_id: str,
    sim_id: str,
    group: dict = Depends(require_group_access),
    db: sqlite3.Connection = Depends(get_db),
):
    """Advances simulation clock by exactly 1 tick, persisting state and timeline."""
    engine = load_or_reconstruct_engine(sim_id, db)

    # Validate task transition
    cursor = db.execute("SELECT status FROM simulations WHERE id = ?", (sim_id,))
    sim = cursor.fetchone()
    if sim and sim["status"] == "COMPLETED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot step a simulation that is already COMPLETED.",
        )

    snapshot = engine.step()
    metrics = engine.get_metrics()
    sim_status = "COMPLETED" if engine.is_completed() else "RUNNING"

    # Persist updated metrics and timeline in SQLite
    with db:
        db.execute(
            """
            UPDATE simulations SET
                current_tick = ?,
                busy_ticks = ?,
                idle_ticks = ?,
                cpu_utilization = ?,
                avg_waiting_time = ?,
                avg_turnaround_time = ?,
                avg_response_time = ?,
                throughput = ?,
                status = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (
                engine.current_tick,
                engine.busy_ticks,
                engine.idle_ticks,
                metrics.cpu_utilization,
                metrics.avg_waiting_time,
                metrics.avg_turnaround_time,
                metrics.avg_response_time,
                metrics.throughput,
                sim_status,
                sim_id,
            ),
        )

        # Update process states in SQLite
        for pid in snapshot.ready_queue:
            db.execute("UPDATE simulation_processes SET state = 'READY' WHERE simulation_id = ? AND id = ?", (sim_id, pid))
        for pid in snapshot.waiting_queue:
            db.execute("UPDATE simulation_processes SET state = 'WAITING' WHERE simulation_id = ? AND id = ?", (sim_id, pid))
        if snapshot.running_process_id:
            pcb = engine.get_pcb(snapshot.running_process_id)
            if pcb:
                db.execute(
                    "UPDATE simulation_processes SET state = 'RUNNING', remaining_time = ? WHERE simulation_id = ? AND id = ?",
                    (pcb.remaining_time, sim_id, pcb.id),
                )
        for pid in snapshot.terminated_processes:
            pcb = engine.get_pcb(pid)
            if pcb:
                db.execute(
                    """
                    UPDATE simulation_processes SET
                        state = 'TERMINATED',
                        remaining_time = 0,
                        start_time = ?,
                        completion_time = ?,
                        waiting_time = ?,
                        turnaround_time = ?,
                        response_time = ?
                    WHERE simulation_id = ? AND id = ?
                    """,
                    (pcb.start_time, pcb.completion_time, pcb.waiting_time, pcb.turnaround_time, pcb.response_time, sim_id, pid),
                )

        # Record timeline log
        db.execute(
            """
            INSERT INTO simulation_history (
                simulation_id, tick, running_process_id, ready_queue_json, waiting_queue_json, terminated_json, gantt_state
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                sim_id,
                snapshot.gantt_entry.tick,
                snapshot.gantt_entry.process_id,
                json.dumps(snapshot.ready_queue),
                json.dumps(snapshot.waiting_queue),
                json.dumps(snapshot.terminated_processes),
                snapshot.gantt_entry.state,
            ),
        )

    step_payload = {
        "simulation_id": sim_id,
        "tick": snapshot.tick,
        "status": sim_status,
        "running_process_id": snapshot.running_process_id,
        "ready_queue": snapshot.ready_queue,
        "waiting_queue": snapshot.waiting_queue,
        "terminated_processes": snapshot.terminated_processes,
        "metrics": metrics.model_dump(),
        "gantt_entry": snapshot.gantt_entry.model_dump(),
    }
    connection_manager.broadcast(
        group_id=group_id,
        event_type=EventType.SIMULATION_STEP.value,
        simulation_id=sim_id,
        payload=step_payload,
    )
    if sim_status == "COMPLETED":
        connection_manager.broadcast(
            group_id=group_id,
            event_type=EventType.SIMULATION_COMPLETED.value,
            simulation_id=sim_id,
            payload={
                "simulation_id": sim_id,
                "final_tick": snapshot.tick,
                "metrics": metrics.model_dump(),
            },
        )

    return SimulationStepResponse(
        simulation_id=sim_id,
        tick=snapshot.tick,
        status=sim_status,
        running_process_id=snapshot.running_process_id,
        ready_queue=snapshot.ready_queue,
        waiting_queue=snapshot.waiting_queue,
        terminated_processes=snapshot.terminated_processes,
        metrics=metrics.model_dump(),
        gantt_entry=snapshot.gantt_entry.model_dump(),
    )


@router.post("/{sim_id}/play", response_model=SimulationResponse)
def play_simulation_to_completion(
    group_id: str,
    sim_id: str,
    group: dict = Depends(require_group_access),
    db: sqlite3.Connection = Depends(get_db),
):
    """Executes the simulation to completion and saves all final metrics."""
    engine = load_or_reconstruct_engine(sim_id, db)
    engine.run_until_completion()

    # Step method logic for final persistence
    metrics = engine.get_metrics()
    with db:
        db.execute(
            """
            UPDATE simulations SET
                current_tick = ?,
                busy_ticks = ?,
                idle_ticks = ?,
                cpu_utilization = ?,
                avg_waiting_time = ?,
                avg_turnaround_time = ?,
                avg_response_time = ?,
                throughput = ?,
                status = 'COMPLETED',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (
                engine.current_tick,
                engine.busy_ticks,
                engine.idle_ticks,
                metrics.cpu_utilization,
                metrics.avg_waiting_time,
                metrics.avg_turnaround_time,
                metrics.avg_response_time,
                metrics.throughput,
                sim_id,
            ),
        )
        for p in engine.terminated_processes:
            db.execute(
                """
                UPDATE simulation_processes SET
                    state = 'TERMINATED',
                    remaining_time = 0,
                    start_time = ?,
                    completion_time = ?,
                    waiting_time = ?,
                    turnaround_time = ?,
                    response_time = ?
                WHERE simulation_id = ? AND id = ?
                """,
                (p.start_time, p.completion_time, p.waiting_time, p.turnaround_time, p.response_time, sim_id, p.id),
            )

    connection_manager.broadcast(
        group_id=group_id,
        event_type=EventType.SIMULATION_COMPLETED.value,
        simulation_id=sim_id,
        payload={
            "simulation_id": sim_id,
            "final_tick": engine.current_tick,
            "metrics": metrics.model_dump(),
        },
    )

    return get_simulation(group_id, sim_id, group, db)


@router.post("/{sim_id}/reset", response_model=SimulationResponse)
def reset_simulation(
    group_id: str,
    sim_id: str,
    group: dict = Depends(require_group_access),
    db: sqlite3.Connection = Depends(get_db),
):
    """Resets a simulation run to initial tick 0, clears history and restores processes."""
    engine = load_or_reconstruct_engine(sim_id, db)
    engine.reset()

    with db:
        db.execute(
            """
            UPDATE simulations SET
                current_tick = 0,
                busy_ticks = 0,
                idle_ticks = 0,
                cpu_utilization = 0.0,
                avg_waiting_time = 0.0,
                avg_turnaround_time = 0.0,
                avg_response_time = 0.0,
                throughput = 0.0,
                status = 'INITIALIZED',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (sim_id,),
        )
        db.execute(
            """
            UPDATE simulation_processes SET
                state = CASE WHEN arrival_time <= 0 THEN 'READY' ELSE 'NEW' END,
                remaining_time = burst_time,
                start_time = NULL,
                completion_time = NULL,
                waiting_time = 0,
                turnaround_time = 0,
                response_time = 0
            WHERE simulation_id = ?
            """,
            (sim_id,),
        )
        db.execute(
            """
            UPDATE simulation_resources SET
                available_units = total_capacity,
                exclusive_holder = NULL
            WHERE simulation_id = ?
            """,
            (sim_id,),
        )
        db.execute("DELETE FROM simulation_history WHERE simulation_id = ?", (sim_id,))

    connection_manager.broadcast(
        group_id=group_id,
        event_type=EventType.SIMULATION_RESET.value,
        simulation_id=sim_id,
        payload={"simulation_id": sim_id, "status": "INITIALIZED", "tick": 0},
    )

    return get_simulation(group_id, sim_id, group, db)


@router.put("/{sim_id}/policy", response_model=SimulationResponse)
def update_simulation_policy(
    group_id: str,
    sim_id: str,
    payload: PolicyUpdateRequest,
    group: dict = Depends(require_group_access),
    db: sqlite3.Connection = Depends(get_db),
):
    """Updates the scheduling policy algorithm, time quantum, and preemption settings."""
    engine = load_or_reconstruct_engine(sim_id, db)

    algo = payload.algorithm.upper()
    if algo == "FCFS":
        sched = FCFSScheduler()
    elif algo == "SJF":
        sched = SJFScheduler(is_preemptive=False)
    elif algo == "SRTF":
        sched = SJFScheduler(is_preemptive=True)
    elif algo == "ROUND_ROBIN":
        sched = RoundRobinScheduler(time_quantum=payload.time_quantum)
    elif "PRIORITY" in algo:
        sched = PriorityScheduler(
            is_preemptive=payload.is_preemptive,
            aging_interval=payload.aging_interval,
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported algorithm '{payload.algorithm}'",
        )

    engine.scheduler = sched

    with db:
        db.execute(
            """
            UPDATE simulations SET
                algorithm = ?,
                time_quantum = ?,
                is_preemptive = ?,
                aging_interval = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (algo, payload.time_quantum, 1 if payload.is_preemptive else 0, payload.aging_interval, sim_id),
        )

    connection_manager.broadcast(
        group_id=group_id,
        event_type=EventType.SIMULATION_POLICY_CHANGED.value,
        simulation_id=sim_id,
        payload={
            "simulation_id": sim_id,
            "algorithm": algo,
            "time_quantum": payload.time_quantum,
            "is_preemptive": payload.is_preemptive,
        },
    )

    return get_simulation(group_id, sim_id, group, db)


@router.post("/{sim_id}/processes", status_code=status.HTTP_201_CREATED)
def add_simulation_process(
    group_id: str,
    sim_id: str,
    payload: ProcessInput,
    group: dict = Depends(require_group_access),
    db: sqlite3.Connection = Depends(get_db),
):
    """Dynamically submits a new task / process to an active simulation."""
    engine = load_or_reconstruct_engine(sim_id, db)

    p_def = ProcessDefinition(
        id=payload.id,
        arrival_time=payload.arrival_time,
        burst_time=payload.burst_time,
        priority=payload.priority,
    )

    try:
        pcb = engine.add_process(p_def)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    with db:
        db.execute(
            """
            INSERT INTO simulation_processes (
                id, simulation_id, arrival_time, burst_time, remaining_time, priority, state
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (pcb.id, sim_id, pcb.arrival_time, pcb.burst_time, pcb.remaining_time, pcb.priority, pcb.state.value),
        )

    connection_manager.broadcast(
        group_id=group_id,
        event_type=EventType.PROCESS_ADMITTED.value,
        simulation_id=sim_id,
        payload={
            "simulation_id": sim_id,
            "process_id": pcb.id,
            "arrival_time": pcb.arrival_time,
            "burst_time": pcb.burst_time,
            "priority": pcb.priority,
            "state": pcb.state.value,
        },
    )

    return {
        "id": pcb.id,
        "simulation_id": sim_id,
        "arrival_time": pcb.arrival_time,
        "burst_time": pcb.burst_time,
        "priority": pcb.priority,
        "state": pcb.state.value,
    }
