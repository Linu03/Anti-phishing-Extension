"""One-off battery for URL analyzer — run: python scripts/run_url_analyzer_tests.py"""
from __future__ import annotations

from app.layers.url_analyzer.service import analyze_url

# (id, url, expected_rules or None=info only, note)
CASES: list[tuple[str, str, list[str] | None, str]] = [
    # Unicode
    ("U01", "https://www.google.com/", [], "clean baseline"),
    ("U02", "https\uFF1A//www.paypal.com/login", ["unicode_normalization"], "fullwidth colon"),
    ("U03", "https://www.paypal\u200b.com/login", ["unicode_normalization"], "zero-width in host"),
    ("U04", "https://www.\u0440\u0430ypal.com/login", ["idn_homograph"], "cyrillic host"),
    ("U05", "https://evil.com/login?x=\u037Ey", ["unicode_normalization"], "greek in query"),
    ("U06", "https://evil.com/\u0440\u0430ypal", ["idn_homograph"], "cyrillic in path"),
    ("U07", "https://www.xn--paypal-abc.com/", ["idn_homograph"], "punycode host"),
    # Conversation samples
    ("P01", "https://paypaI.com/login", ["typosquatting"], "capital I typosquat"),
    ("P02", "https://secure-login.net/account", ["high_entropy_hostname"], "hyphenated generic"),
    ("P03", "https://www-paypal.com/signin", ["phishing_keywords"], "www-paypal keyword"),
    ("P04", "https://paypal.com/login@evil.com/", [], "@ in path only"),
    ("P05", "https://user:pass@evil.com/paypal", ["at_in_url"], "@ in userinfo"),
    ("P06", "https://bit.ly/abc123", [], "shortener bit.ly"),
    ("P07", "https://sub1.sub2.sub3.sub4.evil-shop.xyz/login/verify/secure", None, "multi-rule heavy"),
    ("P08", "https://www.google.com/url?q=https://evil.com", [], "google redirect"),
    ("P09", "https://192.168.0.1/login", ["ip_host"], "IP host"),
    ("P10", "https://login%2Epaypal%2Ecom.evil.net/", None, "percent encoding"),
    ("P11", "https://paypal.com.evil.net/login", [], "brand in subdomain gap"),
    # Pattern rules
    ("R01", "http://" + "a" * 210 + ".com/", ["url_too_long"], "very long URL"),
    ("R02", "https://a.b.c.d.evil.com/", ["many_subdomains"], "many subdomains"),
    ("R03", "https://login.paypal.com.secure-update.ru/", None, "nested brand + .ru"),
    ("R04", "https://www.evil.tk/login", ["suspicious_tld"], "TLD .tk"),
    ("R05", "https://www.verify-account-secure-update-now.com/", None, "entropy + keywords"),
    ("R06", "https://amaz0n-deals.com/", ["typosquatting"], "amazon typo"),
    ("R07", "https://faceb00k.com/", ["typosquatting"], "facebook typo"),
    ("R08", "https://www.paypal.com/", [], "legit paypal"),
    ("R09", "https://github.com/", [], "legit github"),
    ("R10", "http://example.com/", [], "http legit example"),
    # Edge combos
    ("E01", "https://www.\u0440\u0430ypal\u200b.com/", None, "cyrillic + zero-width"),
    ("E02", "https://paypa\u0131.com/", None, "dotless i"),
    ("E03", "https://www.googIe.com/", ["typosquatting"], "google capital I"),
    ("E04", "https://evil.com/login?redirect=http://phish.com", [], "nested URL in query gap"),
]


def main() -> None:
    rows: list[dict] = []
    hit = 0
    miss = 0
    ok_clean = 0
    fp = 0

    for cid, url, expected, note in CASES:
        r = analyze_url(url)
        rules_pts = [(f["rule"], f["points"]) for f in r["findings"]]
        rule_names = [x[0] for x in rules_pts]
        score = r["score"]

        if expected is None:
            status = "INFO"
        elif not expected:
            if score > 0:
                status = "UNEXPECTED"
                fp += 1
            else:
                status = "OK"
                ok_clean += 1
        else:
            if all(e in rule_names for e in expected):
                status = "HIT"
                hit += 1
            else:
                status = "MISS"
                miss += 1

        rows.append(
            {
                "id": cid,
                "status": status,
                "score": score,
                "rules": rules_pts,
                "expected": expected,
                "note": note,
                "host": r["host"],
            }
        )

    print(f"{'ID':<5} {'ST':<10} {'SC':>3}  RULES (points)                    EXPECTED              NOTE")
    print("-" * 95)
    for row in rows:
        rules_s = ", ".join(f"{a}({b})" for a, b in row["rules"]) or "-"
        if row["expected"] is None:
            exp_s = "(info)"
        elif not row["expected"]:
            exp_s = "(clean)"
        else:
            exp_s = ", ".join(row["expected"])
        print(
            f"{row['id']:<5} {row['status']:<10} {row['score']:>3}  "
            f"{rules_s:<34} {exp_s:<20} {row['note']}"
        )

    flagged = sum(1 for r in rows if r["score"] > 0)
    print("-" * 95)
    print(f"Total: {len(rows)}  |  Flagged (score>0): {flagged}  |  Clean (0): {len(rows) - flagged}")
    print(f"Expected rule HIT: {hit}  |  MISS: {miss}  |  Expected clean OK: {ok_clean}  |  Unexpected score: {fp}")
    print(f"INFO (no expectation): {sum(1 for r in rows if r['status'] == 'INFO')}")


if __name__ == "__main__":
    main()
