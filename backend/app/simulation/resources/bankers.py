"""Banker's Algorithm for Deadlock Avoidance with Known Maximum Demands."""
from typing import Dict, List, Tuple, Optional


class BankersAlgorithm:
    """Implements Dijkstra's Banker's Algorithm for deadlock avoidance.
    
    Guarantees that resource allocation only occurs if the system remains in a provably
    safe state where a complete execution sequence exists for all processes.
    """

    def __init__(
        self,
        total_resources: Dict[str, int],
        max_claims: Optional[Dict[str, Dict[str, int]]] = None,
    ):
        self.total_resources = dict(total_resources)
        self.available: Dict[str, int] = dict(total_resources)
        self.max_claims: Dict[str, Dict[str, int]] = {}
        self.allocation: Dict[str, Dict[str, int]] = {}
        self.need: Dict[str, Dict[str, int]] = {}

        if max_claims:
            for pid, claims in max_claims.items():
                self.register_process(pid, claims)

    def register_process(self, process_id: str, max_claim: Dict[str, int]) -> None:
        """Registers a process with its declared maximum resource demand."""
        # Validate that max claim does not exceed total system resources
        for r, amount in max_claim.items():
            if r not in self.total_resources:
                raise ValueError(f"Unknown resource '{r}' in max claim for process '{process_id}'.")
            if amount > self.total_resources[r]:
                raise ValueError(
                    f"Process '{process_id}' claims {amount} of '{r}', exceeding total capacity {self.total_resources[r]}."
                )

        self.max_claims[process_id] = {r: max_claim.get(r, 0) for r in self.total_resources}
        self.allocation[process_id] = {r: 0 for r in self.total_resources}
        self.need[process_id] = dict(self.max_claims[process_id])

    def unregister_process(self, process_id: str) -> None:
        """Removes a process (e.g. upon termination/disconnect), restoring all its allocated units."""
        if process_id in self.allocation:
            for r, amt in self.allocation[process_id].items():
                self.available[r] += amt
            del self.allocation[process_id]
        if process_id in self.max_claims:
            del self.max_claims[process_id]
        if process_id in self.need:
            del self.need[process_id]

    def is_safe_state(self) -> Tuple[bool, List[str]]:
        """Executes the Banker's Safety Algorithm.
        
        Returns (True, safe_sequence) if a safe execution sequence exists,
        or (False, []) if the state is unsafe.
        """
        work = dict(self.available)
        finish = {pid: False for pid in self.max_claims}
        safe_sequence: List[str] = []

        while True:
            found = False
            for pid, is_finished in finish.items():
                if not is_finished:
                    # Check if Need[pid] <= Work for all resources
                    needs = self.need[pid]
                    if all(needs[r] <= work[r] for r in self.total_resources):
                        # Process can finish: release its allocations to work pool
                        for r in self.total_resources:
                            work[r] += self.allocation[pid][r]
                        finish[pid] = True
                        safe_sequence.append(pid)
                        found = True
                        break

            if not found:
                break

        is_safe = all(finish.values())
        return is_safe, safe_sequence if is_safe else []

    def request_resources(
        self,
        process_id: str,
        request: Dict[str, int],
    ) -> Tuple[bool, str]:
        """Evaluates a resource request.
        
        1. Checks Request <= Need
        2. Checks Request <= Available
        3. Simulates allocation and tests safety
        4. If safe, commits allocation; if unsafe, rolls back and returns False.
        """
        if process_id not in self.max_claims:
            raise ValueError(f"Process '{process_id}' has not registered maximum claims with Banker's algorithm.")

        # Normalize request vector
        req = {r: request.get(r, 0) for r in self.total_resources}

        # 1. Check Request <= Need
        for r, amt in req.items():
            if amt < 0:
                raise ValueError(f"Negative request value for resource '{r}': {amt}")
            if amt > self.need[process_id][r]:
                raise ValueError(
                    f"Process '{process_id}' requested {amt} of '{r}', exceeding its remaining need {self.need[process_id][r]}."
                )

        # 2. Check Request <= Available
        for r, amt in req.items():
            if amt > self.available[r]:
                return False, f"Resource '{r}' has only {self.available[r]} available, but {amt} requested. Process must wait."

        # 3. Tentative (pretend) allocation
        for r, amt in req.items():
            self.available[r] -= amt
            self.allocation[process_id][r] += amt
            self.need[process_id][r] -= amt

        # 4. Check Safety
        is_safe, safe_seq = self.is_safe_state()

        if is_safe:
            # Commit allocation
            return True, f"Request granted. System remains in safe state. Safe sequence: {safe_seq}"
        else:
            # Rollback pretend allocation
            for r, amt in req.items():
                self.available[r] += amt
                self.allocation[process_id][r] -= amt
                self.need[process_id][r] += amt
            return False, "Request denied: Allocation would place system in an unsafe state susceptible to deadlock."

    def release_resources(self, process_id: str, release: Dict[str, int]) -> None:
        """Releases allocated resources from a process."""
        if process_id not in self.allocation:
            raise ValueError(f"Process '{process_id}' has no registered allocations.")

        for r, amt in release.items():
            if amt < 0:
                raise ValueError(f"Negative release amount for resource '{r}': {amt}")
            if amt > self.allocation[process_id][r]:
                raise ValueError(
                    f"Process '{process_id}' cannot release {amt} of '{r}' (only holds {self.allocation[process_id][r]})."
                )

            self.allocation[process_id][r] -= amt
            self.available[r] += amt
            self.need[process_id][r] += amt
