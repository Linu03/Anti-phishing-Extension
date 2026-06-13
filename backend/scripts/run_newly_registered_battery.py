from __future__ import annotations

import json
from pathlib import Path

from app.layers.url_analyzer.finding import UrlFinding
from app.layers.url_analyzer.rules.newly_registered import (
    evaluate_newly_registered_domain,
    should_skip_rdap_lookup,
)

BACKEND_ROOT = Path(__file__).resolve().parents[1]
FIXTURES_DIR = BACKEND_ROOT / "scripts" / "fixtures" / "newly_registered"


def _load_fixture(path: Path) -> dict:
    with path.open(encoding="utf-8") as file:
        return json.load(file)


def _sync_findings_from_fixture(data: dict) -> list[UrlFinding]:
    findings: list[UrlFinding] = []
    for item in data.get("sync_findings", []):
        findings.append(
            UrlFinding(
                rule=str(item.get("rule", "")),
                points=int(item.get("points", 0)),
                detail=str(item.get("detail", "")),
                tier=str(item.get("tier", "")),
            )
        )
    return findings


def main() -> None:
    fixture_paths = sorted(FIXTURES_DIR.glob("*.json"))
    if not fixture_paths:
        print("No fixtures found in", FIXTURES_DIR)
        return

    passed = 0
    failed = 0

    for path in fixture_paths:
        data = _load_fixture(path)
        fixture_id = data.get("id", path.stem)
        note = data.get("note", "")

        registered = data.get("registered_domain", "")
        age_days = data.get("age_days")
        if age_days is not None:
            age_days = int(age_days)

        skip_expected = bool(data.get("skip_lookup", False))
        skip_actual = should_skip_rdap_lookup(
            registered,
            whitelist_trusted=bool(data.get("whitelist_trusted", False)),
        )

        if skip_expected:
            findings = []
            skip_ok = skip_actual
        else:
            skip_ok = not skip_actual
            sync_findings = _sync_findings_from_fixture(data)
            findings = evaluate_newly_registered_domain(
                registered,
                age_days,
                sync_findings,
            )

        score = sum(item.points for item in findings)
        rule_names = [item.rule for item in findings]

        expected = data.get("expected", {})
        expected_score = int(expected.get("score", 0))
        expected_rules = expected.get("rules", [])
        expected_tier = expected.get("tier")

        score_ok = score == expected_score
        rules_ok = rule_names == expected_rules
        tier_ok = True
        if expected_tier is not None and findings:
            tier_ok = findings[0].tier == expected_tier

        status = "PASS" if skip_ok and score_ok and rules_ok and tier_ok else "FAIL"
        if status == "PASS":
            passed += 1
        else:
            failed += 1

        print(f"[{status}] {fixture_id} score={score} rules={rule_names}")
        if note:
            print(f"       note: {note}")
        if status == "FAIL":
            print(
                f"       expected skip={skip_expected} score={expected_score} "
                f"rules={expected_rules} tier={expected_tier}"
            )
            print(f"       got skip={skip_actual} tier={findings[0].tier if findings else None}")

    print(f"\nDone: {passed} passed, {failed} failed, {passed + failed} total")
    if failed > 0:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
