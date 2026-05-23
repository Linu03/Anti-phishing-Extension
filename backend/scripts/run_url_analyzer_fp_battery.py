"""
URL analyzer battery: legit, suspicious-legit (benign), phishing (malicious).
Run: PYTHONPATH=. python scripts/run_url_analyzer_fp_battery.py
"""
from __future__ import annotations

from dataclasses import dataclass

from app.layers.url_analyzer.service import analyze_url

# category: legit | suspicious_legit | phishing
@dataclass(frozen=True)
class Case:
    id: str
    url: str
    category: str
    note: str


CASES: list[Case] = [
    # --- LEGIT: major real sites (expect score 0) ---
    Case("L01", "https://www.google.com/", "legit", "Google home"),
    Case("L02", "https://www.google.com/search?q=phishing+awareness", "legit", "Google search"),
    Case("L03", "https://mail.google.com/mail/u/0/", "legit", "Gmail"),
    Case("L04", "https://accounts.google.com/signin/v2/identifier", "legit", "Google accounts"),
    Case("L05", "https://www.youtube.com/", "legit", "YouTube"),
    Case("L06", "https://github.com/", "legit", "GitHub"),
    Case("L07", "https://github.com/login", "legit", "GitHub login"),
    Case("L08", "https://docs.github.com/en", "legit", "GitHub docs"),
    Case("L09", "https://www.microsoft.com/en-us", "legit", "Microsoft"),
    Case("L10", "https://login.microsoftonline.com/", "legit", "MS login"),
    Case("L11", "https://www.apple.com/", "legit", "Apple"),
    Case("L12", "https://www.amazon.com/", "legit", "Amazon"),
    Case("L13", "https://www.paypal.com/signin", "legit", "PayPal signin"),
    Case("L14", "https://www.facebook.com/", "legit", "Facebook"),
    Case("L15", "https://www.instagram.com/", "legit", "Instagram"),
    Case("L16", "https://www.linkedin.com/feed/", "legit", "LinkedIn"),
    Case("L17", "https://stackoverflow.com/questions", "legit", "Stack Overflow"),
    Case("L18", "https://en.wikipedia.org/wiki/Phishing", "legit", "Wikipedia"),
    Case("L19", "https://www.cloudflare.com/", "legit", "Cloudflare"),
    Case("L20", "https://www.mozilla.org/en-US/", "legit", "Mozilla"),
    Case("L21", "https://www.python.org/", "legit", "Python.org"),
    Case("L22", "https://fastapi.tiangolo.com/", "legit", "FastAPI docs"),
    Case("L23", "https://www.gov.uk/", "legit", "UK gov"),
    Case("L24", "https://www.nist.gov/", "legit", "NIST"),
    Case("L25", "https://www.ebay.com/", "legit", "eBay"),
    Case("L26", "https://outlook.live.com/mail/", "legit", "Outlook"),
    Case("L27", "https://login.live.com/", "legit", "Live login"),
    Case("L28", "https://www.reddit.com/", "legit", "Reddit"),
    Case("L29", "https://chatgpt.com/", "legit", "ChatGPT"),
    Case("L30", "https://web.whatsapp.com/", "legit", "WhatsApp Web"),
    Case("L31", "https://www.spotify.com/ro-ro/account/login/", "legit", "Spotify login"),
    Case("L32", "https://www.ing.ro/", "legit", "ING Romania"),
    Case("L33", "https://www.bcr.ro/", "legit", "BCR Romania"),
    Case("L34", "https://www.ucv.ro/", "legit", "UCV Romania"),
    Case("L35", "https://www.anaf.ro/", "legit", "ANAF Romania"),
    Case("L36", "https://www.google.com/url?q=https://www.wikipedia.org", "legit", "Google redirect wiki"),
    Case("L37", "https://bit.ly/", "legit", "bit.ly homepage"),
    Case("L38", "http://example.com/", "legit", "IANA example HTTP"),
    Case("L39", "https://example.org/", "legit", "IANA example HTTPS"),
    Case("L40", "https://www.w3.org/", "legit", "W3C"),
    Case("L41", "https://www.netflix.com/", "legit", "Netflix"),
    Case("L42", "https://www.dropbox.com/", "legit", "Dropbox"),
    Case("L43", "https://www.adobe.com/", "legit", "Adobe"),
    Case("L44", "https://www.oracle.com/", "legit", "Oracle"),
    Case("L45", "https://www.samsung.com/", "legit", "Samsung"),
    Case("L46", "https://www.tiktok.com/", "legit", "TikTok"),
    Case("L47", "https://discord.com/channels/@me", "legit", "Discord"),
    Case("L48", "https://www.twitch.tv/", "legit", "Twitch"),
    Case("L49", "https://stripe.com/", "legit", "Stripe"),
    Case("L50", "https://dashboard.stripe.com/login", "legit", "Stripe dashboard login"),
    Case("L51", "https://www.shopify.com/", "legit", "Shopify"),
    Case("L52", "https://www.nike.com/", "legit", "Nike"),
    Case("L53", "https://www.twitter.com/", "legit", "Twitter/X"),
    Case("L54", "https://x.com/home", "legit", "X.com"),
    Case("L55", "https://www.emag.ro/", "legit", "eMAG Romania"),
    Case("L56", "https://www.orange.ro/", "legit", "Orange Romania"),
    Case("L57", "https://www.brd.ro/", "legit", "BRD Romania"),
    Case("L58", "https://www.raiffeisen.ro/", "legit", "Raiffeisen RO"),
    Case("L59", "https://www.zara.com/", "legit", "Zara"),
    Case("L60", "https://www.booking.com/", "legit", "Booking"),
    Case("L61", "https://www.airbnb.com/", "legit", "Airbnb"),
    Case("L62", "https://www.booking.com/hotel/ro/en.html", "legit", "Booking deep path"),
    Case("L63", "https://www.npmjs.com/", "legit", "npm"),
    Case("L64", "https://hub.docker.com/", "legit", "Docker Hub"),
    Case("L65", "https://kubernetes.io/docs/", "legit", "Kubernetes docs"),
    Case("L66", "https://www.bbc.com/news", "legit", "BBC News"),
    Case("L67", "https://www.cnn.com/", "legit", "CNN"),
    Case("L68", "https://www.nytimes.com/", "legit", "NY Times"),
    Case("L69", "https://www.imdb.com/", "legit", "IMDB"),
    Case("L70", "https://www.tripadvisor.com/", "legit", "TripAdvisor"),
    Case("L72", "https://www.office.com/", "legit", "Office"),
    Case("L73", "https://www.onedrive.com/", "legit", "OneDrive"),
    Case("L74", "https://teams.microsoft.com/", "legit", "Teams"),
    Case("L75", "https://www.binance.com/", "legit", "Binance"),
    Case("L76", "https://www.coinbase.com/", "legit", "Coinbase"),
    Case("L77", "https://www.revolut.com/", "legit", "Revolut"),
    Case("L78", "https://www.wise.com/", "legit", "Wise"),
    Case("L79", "https://www.digi.ro/", "legit", "Digi Romania"),
    Case("L80", "https://www.telekom.ro/", "legit", "Telekom RO"),
    # --- SUSPICIOUS-LOOKING BUT LEGIT ---
    Case("S01", "https://myaccount.google.com/security", "suspicious_legit", "Google myaccount"),
    Case("S02", "https://passwords.google.com/", "suspicious_legit", "Google passwords"),
    Case("S03", "https://www.secure-login.net/", "suspicious_legit", "secure-login.net domain"),
    Case("S04", "https://login.wordpress.org/", "suspicious_legit", "WordPress login"),
    Case("S05", "https://account.proton.me/login", "suspicious_legit", "Proton login"),
    Case("S06", "https://signin.aws.amazon.com/signin", "suspicious_legit", "AWS signin"),
    Case("S07", "https://www.verify-email.org/", "suspicious_legit", "verify-email.org"),
    Case("S08", "https://update.microsoft.com/", "suspicious_legit", "MS update"),
    Case("S09", "https://a.b.docs.google.com/", "suspicious_legit", "Deep Google subdomain"),
    Case("S10", "https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css", "suspicious_legit", "CDN long path"),
    Case("S11", "https://www.bankofamerica.com/", "suspicious_legit", "Bank of America"),
    Case("S12", "https://secure.chase.com/", "suspicious_legit", "Chase secure"),
    Case("S13", "https://www-ssl.google.com/", "suspicious_legit", "www-ssl.google.com"),
    Case("S14", "https://support.apple.com/en-us/102654", "suspicious_legit", "Apple support"),
    Case("S15", "https://www.paypal.com/us/webapps/mpp/security", "suspicious_legit", "PayPal security"),
    Case("S16", "https://account.live.com/", "suspicious_legit", "Live account"),
    Case("S17", "https://login.yahoo.com/", "suspicious_legit", "Yahoo login"),
    Case("S18", "https://signin.ebay.com/", "suspicious_legit", "eBay signin"),
    Case("S19", "https://www.netflix.com/login", "suspicious_legit", "Netflix login path"),
    Case("S20", "https://auth0.com/login", "suspicious_legit", "Auth0 login"),
    Case("S21", "https://login.docker.com/", "suspicious_legit", "Docker login"),
    Case("S22", "https://id.atlassian.com/login", "suspicious_legit", "Atlassian login"),
    Case("S23", "https://secure.booking.com/", "suspicious_legit", "Booking secure subdomain"),
    Case("S24", "https://wallet.google.com/", "suspicious_legit", "Google wallet"),
    Case("S25", "https://pay.google.com/", "suspicious_legit", "Google pay"),
    Case("S26", "https://checkout.stripe.com/", "suspicious_legit", "Stripe checkout"),
    Case("S27", "https://www.confirmation.com/", "suspicious_legit", "confirmation.com real domain"),
    Case("S28", "https://login.oracle.com/", "suspicious_legit", "Oracle login"),
    Case("S29", "https://account.apple.com/", "suspicious_legit", "Apple account"),
    Case("S30", "https://iforgot.apple.com/", "suspicious_legit", "Apple password recovery"),
    # --- PHISHING / ATTACK ---
    Case("H01", "https://paypaI.com/login", "phishing", "PayPal capital I"),
    Case("H02", "https://www.paypaI.com/", "phishing", "PayPal I subdomain"),
    Case("H03", "https://www.g00gle.com/", "phishing", "Google zeros"),
    Case("H04", "https://www.googIe.com/", "phishing", "Google capital I"),
    Case("H05", "https://faceb00k.com/login", "phishing", "Facebook zeros"),
    Case("H06", "https://amaz0n-deals.com/", "phishing", "Amazon zero"),
    Case("H07", "https://micr0soft-login.com/", "phishing", "Microsoft zero"),
    Case("H08", "https://192.0.2.66/login", "phishing", "TEST-NET IP"),
    Case("H09", "https://10.0.0.1/admin", "phishing", "Private IP"),
    Case("H10", "https://www.evil.tk/login", "phishing", "TLD .tk"),
    Case("H11", "https://www.evil.ml/verify", "phishing", "TLD .ml"),
    Case("H12", "https://paypal.com.evil.net/login", "phishing", "Brand in subdomain"),
    Case("H13", "https://login.paypal.com.secure-update.ru/", "phishing", "Nested brand + .ru"),
    Case("H14", "https://user:pass@evil.com/fake", "phishing", "@ userinfo"),
    Case("H15", "https://paypal.com/login@evil.com/", "phishing", "@ in path"),
    Case("H16", "https://www.\u0440\u0430ypal.com/login", "phishing", "Cyrillic paypal"),
    Case("H17", "https://www.paypal\u200b.com/login", "phishing", "Zero-width"),
    Case("H18", "https\uFF1A//www.paypal.com/login", "phishing", "Fullwidth colon"),
    Case("H19", "https://sub1.sub2.sub3.sub4.phish.xyz/login/verify", "phishing", "Many subs + xyz"),
    Case("H20", "https://a.b.c.d.evil.com/", "phishing", "Many subdomains"),
    Case("H21", "http://" + "x" * 220 + ".evil.com/", "phishing", "URL too long"),
    Case("H22", "https://www.xn--80ak6aa92e.com/", "phishing", "Punycode homograph"),
    Case("H23", "https://www.verify-account-secure-update-now.com/", "phishing", "Long keyword host"),
    Case("H24", "https://login%2Epaypal%2Ecom.evil.net/", "phishing", "Percent-encoded host"),
    Case("H25", "https://www-paypal.com/signin", "phishing", "www-paypal hyphen"),
    Case("H26", "https://secure-login.net/phish", "phishing", "Keywords on real TLD"),
    Case("H27", "https://evil.com/\u0440\u0430ypal", "phishing", "Cyrillic in path"),
    Case("H28", "https://www.google.com/url?q=https://paypaI.com", "phishing", "Google wrapper typosquat"),
    Case("H29", "https://netfl1x-login.com/", "phishing", "Netflix leet 1"),
    Case("H30", "https://appl3-id-verify.com/", "phishing", "Apple leet"),
    Case("H31", "https://tw1tter-support.com/", "phishing", "Twitter leet"),
    Case("H32", "https://micr0s0ft-365.com/", "phishing", "Microsoft double leet"),
    Case("H33", "https://www.instagr4m.com/", "phishing", "Instagram leet 4"),
    Case("H34", "https://linkedln.com/login", "phishing", "LinkedIn ln typo"),
    Case("H35", "https://www.ebayy.com/", "phishing", "eBay double letter"),
    Case("H36", "https://www.phish.shop/login", "phishing", "TLD .shop"),
    Case("H37", "https://login.evil.top/", "phishing", "TLD .top"),
    Case("H38", "https://secure.evil.online/verify", "phishing", "TLD .online + keywords"),
    Case("H39", "https://www.scam.cfd/", "phishing", "TLD .cfd"),
    Case("H40", "https://bank.evil.ru/login", "phishing", "TLD .ru"),
    Case("H41", "https://203.0.113.55/login", "phishing", "Public TEST-NET IP 2"),
    Case("H42", "https://172.16.0.99/admin", "phishing", "RFC1918 IP"),
    Case("H43", "https://www.\u0430mazon.com/", "phishing", "Cyrillic a in amazon"),
    Case("H44", "https://www.paypal\u200c.com/", "phishing", "Zero-width non-joiner"),
    Case("H45", "https://signin\u200d.evil.com/", "phishing", "Zero-width joiner in host"),
    Case("H46", "https://evil.com/login?user=paypaI.com", "phishing", "Typosquat in query only"),
    Case("H47", "https://www.login-secure-verify-account.com/", "phishing", "4 keyword parts host"),
    Case("H48", "https://oauth-confirm-update-wallet.com/signin", "phishing", "Many keywords path+host"),
    Case("H49", "https://www.apple-id-verify-confirm.net/", "phishing", "Apple-ish keywords"),
    Case("H50", "https://sub.evil.dev/login", "phishing", "TLD .dev low weight"),
    Case("H51", "https://paypa1.com/", "phishing", "PayPal 1 leet"),
    Case("H52", "https://g00g1e.com/", "phishing", "Google 0 and 1 leet"),
    Case("H53", "https://www.faceb00k-login.com/", "phishing", "Facebook hyphen leet"),
    Case("H54", "https://www.amaz0n-security.com/", "phishing", "Amazon security typo host"),
    Case("H55", "https://evil.com/%2e%2e/admin", "phishing", "Encoding in path"),
    Case("H56", "https://www.xn--pple-43d.com/", "phishing", "Punycode apple-like"),
]

# score > 0 => predicted positive (phishing/suspicious)
THRESHOLD = 0


@dataclass
class Row:
    id: str
    category: str
    score: int
    rules: list[tuple[str, int]]
    note: str
    host: str
    error: str | None = None

    @property
    def predicted_positive(self) -> bool:
        return self.score > THRESHOLD

    @property
    def actual_positive(self) -> bool:
        return self.category == "phishing"


def run_battery() -> list[Row]:
    rows: list[Row] = []
    for case in CASES:
        try:
            r = analyze_url(case.url)
            rows.append(
                Row(
                    id=case.id,
                    category=case.category,
                    score=r["score"],
                    rules=[(f["rule"], f["points"]) for f in r["findings"]],
                    note=case.note,
                    host=r.get("host", ""),
                )
            )
        except Exception as exc:
            rows.append(
                Row(
                    id=case.id,
                    category=case.category,
                    score=-1,
                    rules=[],
                    note=case.note,
                    host="",
                    error=str(exc),
                )
            )
    return rows


def confusion(rows: list[Row]) -> dict[str, int]:
    """Benign = legit | suspicious_legit. Positive = phishing. Flag if score > 0."""
    tp = tn = fp = fn = 0
    for row in rows:
        if row.error:
            continue
        actual = row.category == "phishing"
        pred = row.predicted_positive
        if actual and pred:
            tp += 1
        elif not actual and not pred:
            tn += 1
        elif not actual and pred:
            fp += 1
        else:
            fn += 1
    return {"TP": tp, "TN": tn, "FP": fp, "FN": fn}


def benign_fp_stats(rows: list[Row], category: str) -> dict[str, int]:
    """Only one benign category: TN/FP (no TP/FN)."""
    tn = fp = 0
    for row in rows:
        if row.error or row.category != category:
            continue
        if row.predicted_positive:
            fp += 1
        else:
            tn += 1
    return {"TP": 0, "TN": tn, "FP": fp, "FN": 0}


def phishing_detection_stats(rows: list[Row]) -> dict[str, int]:
    """Only phishing: TP/FN."""
    tp = fn = 0
    for row in rows:
        if row.error or row.category != "phishing":
            continue
        if row.predicted_positive:
            tp += 1
        else:
            fn += 1
    return {"TP": tp, "TN": 0, "FP": 0, "FN": fn}


def metrics(cm: dict[str, int]) -> dict[str, float]:
    tp, tn, fp, fn = cm["TP"], cm["TN"], cm["FP"], cm["FN"]
    total = tp + tn + fp + fn
    accuracy = (tp + tn) / total if total else 0.0
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
    fpr = fp / (fp + tn) if (fp + tn) else 0.0
    return {
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "fpr": fpr,
        "total": total,
    }


def main() -> None:
    rows = run_battery()
    benign = [r for r in rows if r.category in ("legit", "suspicious_legit")]
    phish = [r for r in rows if r.category == "phishing"]

    cm_all = confusion(rows)
    cm_legit_benign = benign_fp_stats(rows, "legit")
    cm_susp_benign = benign_fp_stats(rows, "suspicious_legit")
    cm_phish_only = phishing_detection_stats(rows)

    m = metrics(cm_all)

    errors = [r for r in rows if r.error]
    print("URL ANALYZER — CONFUSION MATRIX BATTERY")
    print(f"Total cases: {len(CASES)}  |  Errors: {len(errors)}")
    print(f"Threshold: score > {THRESHOLD} => predicted PHISHING/SUSPICIOUS")
    print(f"Actual PHISHING: category=phishing | Actual BENIGN: legit + suspicious_legit")
    print("=" * 72)

    def print_cm(title: str, cm: dict[str, int], n_benign: int, n_phish: int) -> None:
        print(f"\n{title}")
        print(f"  (Benign n={n_benign}, Phishing n={n_phish})")
        print()
        print("                      Predicted")
        print("                      BENIGN(0)   PHISHING(>0)")
        print(f"  Actual BENIGN       {cm['TN']:>8}    {cm['FP']:>8}     <- FP")
        print(f"  Actual PHISHING     {cm['FN']:>8}    {cm['TP']:>8}     <- FN")
        if cm["TP"] + cm["FP"] + cm["FN"] + cm["TN"] > 0:
            sub_m = metrics(cm)
            print(
                f"  Acc={sub_m['accuracy']:.1%}  Prec={sub_m['precision']:.1%}  "
                f"Rec={sub_m['recall']:.1%}  F1={sub_m['f1']:.2f}  FPR={sub_m['fpr']:.1%}"
            )

    n_legit = sum(1 for r in rows if r.category == "legit")
    n_susp = sum(1 for r in rows if r.category == "suspicious_legit")
    n_phish = sum(1 for r in rows if r.category == "phishing")

    print_cm("CONFUSION MATRIX (ALL CASES)", cm_all, len(benign), len(phish))
    print_cm(f"FP CHECK: legit only (n={n_legit})", cm_legit_benign, n_legit, 0)
    print_cm(f"FP CHECK: suspicious_legit only (n={n_susp})", cm_susp_benign, n_susp, 0)
    print_cm(f"DETECTION: phishing only (n={n_phish})", cm_phish_only, 0, n_phish)

    print("\n" + "=" * 72)
    print("GLOBAL METRICS (all cases)")
    print(f"  Accuracy:  {m['accuracy']:.1%}")
    print(f"  Precision: {m['precision']:.1%}  (of flagged, how many true phishing)")
    print(f"  Recall:    {m['recall']:.1%}  (of phishing, how many caught)")
    print(f"  F1:        {m['f1']:.2f}")
    print(f"  FPR:       {m['fpr']:.1%}  (benign wrongly flagged)")

    print("\n--- FALSE POSITIVES (benign but score>0) ---")
    for row in benign:
        if row.predicted_positive and not row.error:
            rules_s = ", ".join(f"{a}({b})" for a, b in row.rules)
            print(f"  {row.id} sc={row.score} [{rules_s}] — {row.note}")

    print("\n--- FALSE NEGATIVES (phishing but score=0) ---")
    for row in phish:
        if not row.predicted_positive and not row.error:
            print(f"  {row.id} — {row.note}")

    print("\n--- RULES IN FALSE POSITIVES (count) ---")
    rule_counts: dict[str, int] = {}
    for row in benign:
        if row.predicted_positive:
            for rule, _ in row.rules:
                rule_counts[rule] = rule_counts.get(rule, 0) + 1
    for rule, cnt in sorted(rule_counts.items(), key=lambda x: -x[1]):
        print(f"  {rule}: {cnt}")


if __name__ == "__main__":
    main()
