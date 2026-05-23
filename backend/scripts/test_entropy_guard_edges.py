"""Edge cases for entropy guard on Tranco legitimate domains."""
from __future__ import annotations

from app.core.url_normalize import lookup_key_from_parsed, parse_http_url
from app.layers.url_analyzer.brand_registry import get_brand_registry, reload_brand_registry
from app.layers.url_analyzer.rules.typosquatting import _is_legitimate_host, _registered_domain
from app.layers.url_analyzer.service import analyze_url

CASES: list[tuple[str, str, str, str]] = [
    # Should STILL flag (guard must not block detection)
    ("T01", "https://stackoverflow-sth.com/questions", "flag", "lookalike, not in Tranco"),
    ("T02", "https://coinbase-secure-wallet.com/login", "flag", "coinbase in name, not exact PLD"),
    ("T03", "https://paypal.com.evil.net/login", "flag", "brand in subdomain"),
    ("T04", "https://google.secure-login.xyz/", "flag", "brand sub + risky TLD"),
    ("T05", "https://paypaI.com/login", "flag", "typosquat"),
    ("T06", "https://www.g00gle.com/", "flag", "leet typosquat"),
    ("T07", "https://evil.github.io/", "flag", "SLD evil on github.io"),
    ("T08", "https://phish.amazonaws.com/", "flag", "evil label on amazonaws PLD"),
    ("T09", "https://login.microsoft.com.evil.ru/", "flag", "brand.tld label + .ru"),
    ("T10", "https://secure-login.net/phish", "flag", "not in Tranco"),
    ("T19", "https://amaz0n-deals.com/", "flag", "leet, not amazon.com PLD"),
    ("T20", "https://amazon-security-update.com/", "flag", "not exact amazon.com"),
    ("T17", "https://totally-legit-looking.evil.com/", "flag", "not Tranco"),
    # Should stay clean (real legit)
    ("T11", "https://stackoverflow.com/", "clean", "Tranco PLD"),
    ("T12", "https://www.coinbase.com/", "clean", "Tranco PLD"),
    ("T13", "https://mail.google.com/", "clean", "google.com Tranco"),
    ("T14", "https://github.com/login", "clean", "github.com Tranco"),
    ("T16", "https://accounts.google.com/signin", "clean", "legit Google"),
    ("T18", "https://www.amazon.com/", "clean", "amazon.com Tranco"),
    # Known gaps (not entropy guard fault)
    ("T15", "https://www.google.com/url?q=https://paypaI.com", "partial", "wrapper; q= not analyzed"),
    # Risk: legit PLD but suspicious path only
    ("T21", "https://www.google.com/phishing-login-verify", "clean", "path only on google.com"),
]


def main() -> None:
    reload_brand_registry()
    registry = get_brand_registry()

    print(f"{'ID':<5} {'TR':<5} {'REGISTERED':<26} {'SC':>3} {'RISK':<6} RULES")
    print("-" * 90)

    missed: list[tuple[str, str, str]] = []
    unexpected: list[tuple[str, str, str, str]] = []

    for case_id, url, expect, note in CASES:
        parsed = parse_http_url(url)
        _, host = lookup_key_from_parsed(parsed)
        registered = _registered_domain(host) or ""
        in_tranco = _is_legitimate_host(host, registry)

        result = analyze_url(url)
        rules = ",".join(f["rule"] for f in result["findings"]) or "-"
        flagged = result["score"] > 0

        if expect == "flag" and not flagged:
            missed.append((case_id, note, url))
        elif expect == "clean" and flagged:
            unexpected.append((case_id, note, url, rules))

        ok = (
            (expect == "flag" and flagged)
            or (expect == "clean" and not flagged)
            or expect == "partial"
        )
        mark = "OK" if ok else "!!"

        print(
            f"{case_id:<5} {str(in_tranco):<5} {registered:<26} "
            f"{result['score']:>3} {result['risk']:<6} {rules[:32]:<32} {mark}"
        )

    print("\n=== RISC FN din cauza gardului (așteptat flag, scor 0) ===")
    if not missed:
        print("  (niciunul)")
    for item in missed:
        print(f"  {item[0]}: {item[1]}")
        print(f"       {item[2]}")

    print("\n=== FP pe legit (așteptat clean, scor > 0) ===")
    if not unexpected:
        print("  (niciunul)")
    for item in unexpected:
        print(f"  {item[0]}: {item[1]} -> {item[3]}")
        print(f"       {item[2]}")

    print("\n=== Notă T21 ===")
    print("  google.com/phishing-login-verify: gard oprește doar ENTROPIA.")
    print("  Alte reguli (keywords pe path) pot tot da scor; altfel 0 = limitare URL layer.")


if __name__ == "__main__":
    main()
