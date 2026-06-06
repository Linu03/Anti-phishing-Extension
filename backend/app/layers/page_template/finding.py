from dataclasses import dataclass


@dataclass
class PageFinding:
    rule: str
    points: int
    detail: str
    tier: str = "C"
