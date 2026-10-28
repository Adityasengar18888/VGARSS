"""Wait-For Graph (WFG) & Resource Allocation Graph (RAG) Deadlock Detector."""
from typing import List, Dict, Set, Optional
from pydantic import BaseModel, Field
from backend.app.simulation.resources.resource import Resource


class DeadlockCycle(BaseModel):
    """Details of an identified deadlock cycle in the Wait-For Graph."""
    processes: List[str] = Field(..., description="Ordered list of process IDs forming the circular wait cycle")
    involved_resources: List[str] = Field(default_factory=list)
    description: str = ""


class WaitForGraph:
    """Constructs and analyzes the directed Wait-For Graph (WFG) across active resources.
    
    A directed edge P_A -> P_B exists if Process P_A is waiting for a resource currently held by P_B.
    A directed cycle in this graph indicates a circular wait deadlock condition.
    """

    def __init__(self):
        self.adjacency_list: Dict[str, Set[str]] = {}
        self.edge_resource_map: Dict[tuple, str] = {}

    def build_from_resources(self, resources: List[Resource]) -> None:
        """Constructs the WFG from the current state of all resources."""
        self.adjacency_list.clear()
        self.edge_resource_map.clear()

        for res in resources:
            with res._lock:
                # Find all current holders of this resource
                holders: Set[str] = set()
                if res.exclusive_holder:
                    holders.add(res.exclusive_holder)
                holders.update(res.shared_holders.keys())

                # For every waiting request, add edges from waiter -> all holders
                for waiter in res.wait_queue:
                    waiter_pid = waiter.process_id
                    if waiter_pid not in self.adjacency_list:
                        self.adjacency_list[waiter_pid] = set()

                    for holder_pid in holders:
                        if waiter_pid != holder_pid:
                            self.adjacency_list[waiter_pid].add(holder_pid)
                            self.edge_resource_map[(waiter_pid, holder_pid)] = res.id

    def detect_cycle(self) -> Optional[DeadlockCycle]:
        """Detects if a directed cycle exists in the Wait-For Graph using Depth-First Search.
        
        Returns DeadlockCycle if circular wait exists, otherwise None.
        """
        # Node states: 0 = unvisited, 1 = visiting (in recursion stack), 2 = visited
        visited: Dict[str, int] = {}
        parent_map: Dict[str, str] = {}

        for node in list(self.adjacency_list.keys()):
            visited[node] = 0

        for start_node in list(self.adjacency_list.keys()):
            if visited.get(start_node, 0) == 0:
                cycle = self._dfs_cycle_find(start_node, visited, parent_map, [start_node])
                if cycle:
                    # Identify resources involved in this cycle
                    cycle_resources = set()
                    for i in range(len(cycle) - 1):
                        u, v = cycle[i], cycle[i + 1]
                        if (u, v) in self.edge_resource_map:
                            cycle_resources.add(self.edge_resource_map[(u, v)])

                    cycle_str = " -> ".join(cycle)
                    return DeadlockCycle(
                        processes=cycle,
                        involved_resources=sorted(list(cycle_resources)),
                        description=f"Circular wait deadlock detected: {cycle_str}",
                    )
        return None

    def _dfs_cycle_find(
        self,
        current: str,
        visited: Dict[str, int],
        parent_map: Dict[str, str],
        path: List[str],
    ) -> Optional[List[str]]:
        visited[current] = 1  # In stack

        for neighbor in sorted(list(self.adjacency_list.get(current, set()))):
            if visited.get(neighbor, 0) == 1:
                # Cycle detected! Reconstruct cycle path
                cycle_start_idx = path.index(neighbor)
                cycle_path = path[cycle_start_idx:] + [neighbor]
                return cycle_path

            if visited.get(neighbor, 0) == 0:
                parent_map[neighbor] = current
                res = self._dfs_cycle_find(neighbor, visited, parent_map, path + [neighbor])
                if res:
                    return res

        visited[current] = 2  # Visited
        return None
