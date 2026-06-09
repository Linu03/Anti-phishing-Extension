from dataclasses import dataclass


@dataclass
class BehavioralFinding:
    rule: str
    points: int
    detail: str
    tier: str = "C"
