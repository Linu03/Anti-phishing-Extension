from dataclasses import dataclass


@dataclass
class TlsFinding:
    rule: str
    points: int
    detail: str


