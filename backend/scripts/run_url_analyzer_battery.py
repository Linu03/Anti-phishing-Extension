from __future__ import annotations

import json
import sys
from pathlib import Path

from app.layers.url_analyzer.service import analyze_url

BACKEND_ROOT = Path(__file__).resolve().parents[1]
FIXTURES_DIR = BACKEND_ROOT / "scripts" / "fixtures" / "url_analyzer"


def _load_fixture(path: Path) -> dict:
    with path.open(encoding="utf-8") as file:
        return json.load(file)


def _finding_tier(findings: list[dict]) -> str | None:
    for item in findings:
        tier = item.get("tier", "")
        if isinstance(tier, str) and tier != "":
            return tier
    return None


def main() -> None:
    fixture_paths = sorted(FIXTURES_DIR.glob("*.json"))
    if not fixture_paths:
        print("No fixtures found in", FIXTURES_DIR)
        sys.exit(1)

    passed = 0
    failed = 0

    for path in fixture_paths:
        data = _load_fixture(path)
        fixture_id = data.get("id", path.stem)
        url = data.get("url", "")
        note = data.get("note", "")

        result = analyze_url(url)
        score = int(result.get("score", 0))
        findings = result.get("findings", [])
        rule_names = [item.get("rule", "") for item in findings]
        tier = _finding_tier(findings)

        expected = data.get("expected", {})
        expected_score = int(expected.get("score", 0))
        expected_rules = expected.get("rules", [])
        expected_tier = expected.get("tier")

        score_ok = score == expected_score
        rules_ok = rule_names == expected_rules
        tier_ok = True
        if expected_tier is not None:
            tier_ok = tier == expected_tier

        status = "PASS" if score_ok and rules_ok and tier_ok else "FAIL"
        if status == "PASS":
            passed += 1
        else:
            failed += 1

        print(
            f"[{status}] {fixture_id} | {url} | "
            f"expected={expected_score} got={score}"
        )
        if note:
            print(f"       note: {note}")
        if status == "FAIL":
            print(
                f"       expected rules={expected_rules} tier={expected_tier}"
            )
            print(f"       got rules={rule_names} tier={tier}")

    print(f"\nDone: {passed} passed, {failed} failed, {passed + failed} total")
    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
