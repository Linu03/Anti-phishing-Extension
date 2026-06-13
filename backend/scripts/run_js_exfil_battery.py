from __future__ import annotations

import json
from pathlib import Path

from app.layers.behavioral.schemas import BehaviorDiffModel, BehavioralContextModel
from app.layers.behavioral.service import analyze_behavior

BACKEND_ROOT = Path(__file__).resolve().parents[1]
FIXTURES_DIR = BACKEND_ROOT / "scripts" / "fixtures" / "js_exfil"


def _load_fixture(path: Path) -> dict:
    with path.open(encoding="utf-8") as file:
        return json.load(file)


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

        diff = BehaviorDiffModel.model_validate(data.get("diff", {}))
        context = BehavioralContextModel.model_validate(data.get("context", {}))
        result = analyze_behavior(diff, context)

        score = int(result.get("score", 0))
        findings = result.get("findings", [])
        rule_names = [item.get("rule", "") for item in findings]
        tier = findings[0].get("tier") if findings else None

        expected = data.get("expected", {})
        expected_score = int(expected.get("score", 0))
        expected_rules = expected.get("rules", [])
        expected_tier = expected.get("tier")

        score_ok = score == expected_score
        rules_ok = rule_names == expected_rules
        tier_ok = True
        if expected_tier is not None and findings:
            tier_ok = findings[0].get("tier") == expected_tier

        status = "PASS" if score_ok and rules_ok and tier_ok else "FAIL"
        if status == "PASS":
            passed += 1
        else:
            failed += 1

        print(f"[{status}] {fixture_id} score={score} rules={rule_names}")
        if note:
            print(f"       note: {note}")
        if status == "FAIL":
            print(
                f"       expected score={expected_score} rules={expected_rules} tier={expected_tier}"
            )
            print(f"       got tier={tier}")

    print(f"\nDone: {passed} passed, {failed} failed, {passed + failed} total")
    if failed > 0:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
