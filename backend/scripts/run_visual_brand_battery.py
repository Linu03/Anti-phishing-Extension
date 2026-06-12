from __future__ import annotations

import json
from pathlib import Path

from app.layers.page_template.logo_phash import BrandMatch
from app.layers.page_template.rules.visual_brand import evaluate_visual_brand

BACKEND_ROOT = Path(__file__).resolve().parents[1]
FIXTURES_DIR = BACKEND_ROOT / "scripts" / "fixtures" / "visual_brand"


def _load_fixture(path: Path) -> dict:
    with path.open(encoding="utf-8") as file:
        return json.load(file)


def _match_from_fixture(data: dict) -> BrandMatch | None:
    brand = (data.get("matched_brand") or "").strip().lower()
    if brand == "":
        return None

    similarity = float(data.get("similarity", 0.95))
    distance = data.get("distance")
    if distance is None:
        distance = int(round((1.0 - similarity) * 64))

    return BrandMatch(
        brand=brand,
        distance=int(distance),
        similarity=similarity,
        matched_path=data.get("matched_path", "fixture.png"),
    )


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

        match = _match_from_fixture(data)
        if match is None:
            findings = []
        else:
            page_host = data.get("page_host", "")
            page_url = data.get("page_url", f"https://{page_host}/")
            findings = evaluate_visual_brand(
                match,
                page_host,
                page_url,
                bool(data.get("whitelist_trusted", False)),
                bool(data.get("dubious_url", False)),
            )

        score = sum(item.points for item in findings)
        rule_names = [item.rule for item in findings]

        expected = data.get("expected", {})
        expected_score = expected.get("score", 0)
        expected_rules = expected.get("rules", [])
        expected_tier = expected.get("tier")

        score_ok = score == expected_score
        rules_ok = rule_names == expected_rules
        tier_ok = True
        if expected_tier is not None and findings:
            tier_ok = findings[0].tier == expected_tier

        status = "PASS" if score_ok and rules_ok and tier_ok else "FAIL"
        if status == "PASS":
            passed += 1
        else:
            failed += 1

        print(f"[{status}] {fixture_id} score={score} rules={rule_names}")
        if note:
            print(f"       note: {note}")
        if status == "FAIL":
            print(f"       expected score={expected_score} rules={expected_rules} tier={expected_tier}")
            if findings:
                print(f"       got tier={findings[0].tier}")

    print(f"\nDone: {passed} passed, {failed} failed, {passed + failed} total")


if __name__ == "__main__":
    main()
