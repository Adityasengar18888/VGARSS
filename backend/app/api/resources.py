"""Resource Coordination & Deadlock REST Endpoints."""
import sqlite3
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from backend.app.database import get_db
from backend.app.api.deps import require_group_access
from backend.app.api.simulations import load_or_reconstruct_engine
from backend.app.schemas.resources import (
    ResourceAcquireRequest,
    ResourceReleaseRequest,
    ResourceStatusResponse,
    DeadlockStatusResponse,
)
from backend.app.simulation.resources.models import (
    ResourceMode,
    ResourceError,
)
from backend.app.network import connection_manager, EventType

router = APIRouter(prefix="/api/v1/groups/{group_id}/simulations/{sim_id}/resources", tags=["Resource Coordination"])


@router.get("", response_model=List[ResourceStatusResponse])
def get_resource_statuses(
    group_id: str,
    sim_id: str,
    group: dict = Depends(require_group_access),
    db: sqlite3.Connection = Depends(get_db),
):
    """Retrieves live allocation state, holders, and wait queues for all resources."""
    engine = load_or_reconstruct_engine(sim_id, db)
    if not engine.resource_manager:
        return []

    statuses = engine.resource_manager.get_all_statuses()
    return [
        ResourceStatusResponse(
            id=s.id,
            name=s.name,
            type=s.type.value,
            total_capacity=s.total_capacity,
            available_units=s.available_units,
            exclusive_holder=s.exclusive_holder,
            shared_holders=s.shared_holders,
            wait_queue=s.wait_queue,
            order_rank=s.order_rank,
        )
        for s in statuses
    ]


@router.post("/acquire")
def acquire_resource(
    group_id: str,
    sim_id: str,
    payload: ResourceAcquireRequest,
    group: dict = Depends(require_group_access),
    db: sqlite3.Connection = Depends(get_db),
):
    """Attempts atomic resource acquisition. Transitions process to WAITING if blocked."""
    engine = load_or_reconstruct_engine(sim_id, db)
    mode = ResourceMode.EXCLUSIVE if payload.mode.upper() == "EXCLUSIVE" else ResourceMode.SHARED

    try:
        granted = engine.request_resource(
            process_id=payload.process_id,
            resource_id=payload.resource_id,
            mode=mode,
            units=payload.units,
        )
        status_str = "ACQUIRED" if granted else "BLOCKED_WAITING"
        event_type = EventType.RESOURCE_ACQUIRED.value if granted else EventType.RESOURCE_BLOCKED.value

        # Persist updated state to SQLite
        with db:
            if granted and engine.resource_manager:
                res_obj = engine.resource_manager.get_resource(payload.resource_id)
                db.execute(
                    "UPDATE simulation_resources SET available_units = ?, exclusive_holder = ? WHERE simulation_id = ? AND id = ?",
                    (res_obj.available_units, res_obj.exclusive_holder, sim_id, payload.resource_id),
                )
            elif not granted:
                db.execute(
                    "UPDATE simulation_processes SET state = 'WAITING' WHERE simulation_id = ? AND id = ?",
                    (sim_id, payload.process_id),
                )

        connection_manager.broadcast(
            group_id=group_id,
            event_type=event_type,
            simulation_id=sim_id,
            payload={
                "granted": granted,
                "process_id": payload.process_id,
                "resource_id": payload.resource_id,
                "mode": payload.mode.upper(),
                "units": payload.units,
                "status": status_str,
            },
        )
        return {
            "granted": granted,
            "process_id": payload.process_id,
            "resource_id": payload.resource_id,
            "status": status_str,
        }
    except ResourceError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/release")
def release_resource(
    group_id: str,
    sim_id: str,
    payload: ResourceReleaseRequest,
    group: dict = Depends(require_group_access),
    db: sqlite3.Connection = Depends(get_db),
):
    """Releases a resource and awakens eligible blocked waiting processes."""
    engine = load_or_reconstruct_engine(sim_id, db)

    try:
        awakened = engine.release_resource(
            process_id=payload.process_id,
            resource_id=payload.resource_id,
            units=payload.units,
        )
        # Persist updated state to SQLite
        with db:
            if engine.resource_manager:
                try:
                    res_obj = engine.resource_manager.get_resource(payload.resource_id)
                    db.execute(
                        "UPDATE simulation_resources SET available_units = ?, exclusive_holder = ? WHERE simulation_id = ? AND id = ?",
                        (res_obj.available_units, res_obj.exclusive_holder, sim_id, payload.resource_id),
                    )
                except Exception:
                    pass
            for pid in awakened:
                db.execute(
                    "UPDATE simulation_processes SET state = 'READY' WHERE simulation_id = ? AND id = ?",
                    (sim_id, pid),
                )

        connection_manager.broadcast(
            group_id=group_id,
            event_type=EventType.RESOURCE_RELEASED.value,
            simulation_id=sim_id,
            payload={
                "released": True,
                "process_id": payload.process_id,
                "resource_id": payload.resource_id,
                "units": payload.units,
                "awakened_processes": awakened,
            },
        )
        return {
            "released": True,
            "process_id": payload.process_id,
            "resource_id": payload.resource_id,
            "awakened_processes": awakened,
        }
    except ResourceError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/deadlock", response_model=DeadlockStatusResponse)
def check_simulation_deadlock(
    group_id: str,
    sim_id: str,
    group: dict = Depends(require_group_access),
    db: sqlite3.Connection = Depends(get_db),
):
    """Scans the simulation Wait-For Graph and returns cycle detection analysis."""
    engine = load_or_reconstruct_engine(sim_id, db)
    if not engine.resource_manager:
        return DeadlockStatusResponse(deadlock_detected=False)

    cycle = engine.resource_manager.check_deadlock()
    if cycle:
        connection_manager.broadcast(
            group_id=group_id,
            event_type=EventType.DEADLOCK_DETECTED.value,
            simulation_id=sim_id,
            payload={
                "deadlock_detected": True,
                "cycle_processes": cycle.processes,
                "involved_resources": cycle.involved_resources,
                "description": cycle.description,
            },
        )
        return DeadlockStatusResponse(
            deadlock_detected=True,
            cycle_processes=cycle.processes,
            involved_resources=cycle.involved_resources,
            description=cycle.description,
        )
    return DeadlockStatusResponse(deadlock_detected=False)
