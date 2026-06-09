from __future__ import annotations

import json
from pathlib import Path

from app.layers.page_template.schemas import (
    PageSnapshotModel,
    PriorLayersContextModel,
)
from app.layers.page_template.service import analyze_page_template

BACKEND_ROOT = Path(__file__).resolve().parents[1]
FIXTURES_DIR = BACKEND_ROOT / "scripts" / "fixtures" / "page_template"


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

        snapshot = PageSnapshotModel.model_validate(data["snapshot"])
        context = PriorLayersContextModel.model_validate(data.get("context", {}))

        result = analyze_page_template(snapshot, context)
        expected = data.get("expected", {})

        expected_gate = expected.get("gate", "SAFE")
        expected_score = expected.get("score", 0)
        expected_rules = expected.get("rules", [])
        expected_credential = expected.get("credential_context")

        rule_names = [item["rule"] for item in result["findings"]]
        gate_ok = result["gate"] == expected_gate
        score_ok = result["score"] == expected_score
        rules_ok = all(rule in rule_names for rule in expected_rules)
        credential_ok = True
        if expected_credential is not None:
            credential_ok = result.get("credential_context") == expected_credential

        status = "PASS" if gate_ok and score_ok and rules_ok and credential_ok else "FAIL"
        if status == "PASS":
            passed += 1
        else:
            failed += 1

        cred = result.get("credential_context")
        print(
            f"[{status}] {fixture_id} gate={result['gate']} score={result['score']} "
            f"credential={cred} rules={rule_names}"
        )
        if note:
            print(f"       note: {note}")
        if status == "FAIL":
            print(
                f"       expected gate={expected_gate} score={expected_score} "
                f"credential={expected_credential} rules={expected_rules}"
            )

    print(f"\nDone: {passed} passed, {failed} failed, {passed + failed} total")


if __name__ == "__main__":
    main()
