from __future__ import annotations

import re

# Short plain-English labels for rule ids (non-technical audience).
# If a rule is missing here, we fall back to the detail text from the scan.
RULE_LABELS: dict[str, str] = {
    # URL analyzer
    "hosting_brand_matrix": (
        "The page is on a free website builder but uses a well-known brand name"
        " - like a copycat of the real company's site"
    ),
    "typosquatting": "The domain name is very similar to a well-known brand",
    "nested_url_in_query": "The link hides another suspicious address inside it",
    "suspicious_tld": "The domain uses a top-level domain often seen in scams",
    "url_too_long": "The link is unusually long",
    "many_subdomains": "The link has many subdomains, which can hide the real site",
    "at_in_url": "The link uses a trick with the @ symbol to mislead you",
    "ip_host": "The link uses a raw IP address instead of a normal website name",
    "suspicious_encoding": "The link uses odd encoding that can hide its true destination",
    "phishing_keywords": "The link contains words often used in fake login pages",
    "high_entropy_hostname": "The domain name looks random or machine-generated",
    "idn_homograph": "The link uses special characters that can look like a trusted site",
    "unicode_normalization": "The link contains hidden or look-alike characters",
    # Page template
    "brand_page_host_mismatch": "The page mentions a known brand but is not on that brand's official website",
    "visual_brand_mismatch": "The page logo looks like a known brand but the website address does not match",
    "credential_form_on_free_hosting": "There is a login form on a free website builder platform",
    "credential_form_on_http": "The login form is on an unencrypted HTTP page",
    "invalid_form_action": "The login form sends data to an invalid or suspicious destination",
    "http_form_action_on_https_page": "The page is HTTPS but the form submits over insecure HTTP",
    "suspicious_submit_destination": "The login form sends data to a suspicious address",
    "meta_refresh_cross_domain": "The page tries to redirect you to a different website",
    "base_href_cross_domain": "The page is configured to load resources from another domain",
    "canonical_host_mismatch": "The page claims to be one site but is hosted elsewhere",
    "hidden_cross_origin_iframe": "A hidden frame loads content from another website",
    "cross_origin_iframe": "A frame loads content from an external website",
    "sensitive_field_collection": "The login page also asks for sensitive payment or identity details",
    "excessive_hidden_inputs": "The login form has an unusually high number of hidden fields",
    "hidden_password_field": "The password field is hidden from view",
    "file_upload_with_login": "The login page also asks you to upload a file",
    "external_resource_ratio": (
        "Much of what you see on the page may not actually come from the site"
        " shown in the address bar"
    ),
    "login_page_is_framed": "The login page is shown inside another site's frame",
    "collection_failed": "We could not fully read the page structure",
    # TLS
    "no_https": "The site does not use HTTPS encryption",
    "cert_expired": "The security certificate has expired",
    "hostname_mismatch": "The certificate does not match this website name",
    "self_signed": "The site uses a self-signed certificate",
    "untrusted_chain": "The certificate is not from a trusted authority",
    "cert_very_new": "The security certificate was issued very recently",
    # Behavioral
    "rapid_cross_domain_redirect": "The page redirected quickly to a different website",
    "delayed_credential_form": "A login form appeared after the page loaded",
    "dynamic_submit_destination": "The form's submit address changed after the page loaded",
    "delayed_brand_injection": "Brand-related text appeared after the page loaded",
}

# Concise technical phrases for analyst summaries (no scores or matrix fields).
TECHNICAL_RULE_LABELS: dict[str, str] = {
    "hosting_brand_matrix": (
        "Hosted on a free or suspicious site-builder domain without a matching brand in the hostname"
    ),
    "typosquatting": "Hostname closely resembles a well-known brand (typosquatting)",
    "nested_url_in_query": "Nested URL embedded in query parameters",
    "suspicious_tld": "Top-level domain commonly associated with abuse",
    "url_too_long": "Unusually long URL structure",
    "many_subdomains": "Excessive subdomain depth",
    "at_in_url": "Userinfo (@) trick in the URL",
    "ip_host": "Raw IP address used as host",
    "suspicious_encoding": "Suspicious URL encoding",
    "phishing_keywords": "Phishing-related keywords in the URL",
    "high_entropy_hostname": "High-entropy or machine-generated hostname",
    "idn_homograph": "IDN homograph characters in the hostname",
    "unicode_normalization": "Unicode normalization anomaly in the URL",
    "brand_page_host_mismatch": "Page content references a brand not present in the hostname",
    "visual_brand_mismatch": "Page logo matches a known brand but the hostname does not reference it",
    "credential_form_on_free_hosting": "Credential form on a free hosting or site-builder domain",
    "credential_form_on_http": "Credential form submitted over unencrypted HTTP",
    "invalid_form_action": "Form action points to an invalid or suspicious destination",
    "http_form_action_on_https_page": "HTTPS page submits credentials over HTTP",
    "suspicious_submit_destination": "Form submits to a suspicious external destination",
    "meta_refresh_cross_domain": "Cross-domain meta refresh redirect",
    "base_href_cross_domain": "Base href points to a different domain",
    "canonical_host_mismatch": "Canonical URL host differs from the page host",
    "hidden_cross_origin_iframe": "Hidden cross-origin iframe",
    "cross_origin_iframe": "Cross-origin iframe embedding external content",
    "sensitive_field_collection": "Login form collects unusually sensitive fields",
    "excessive_hidden_inputs": "Unusually high number of hidden form inputs",
    "hidden_password_field": "Password field hidden from view",
    "file_upload_with_login": "File upload combined with login fields",
    "external_resource_ratio": "Most page resources load from external domains",
    "login_page_is_framed": "Login UI embedded inside a third-party frame",
    "collection_failed": "Page structure could not be fully collected",
    "no_https": "Site not served over HTTPS",
    "cert_expired": "TLS certificate expired",
    "hostname_mismatch": "TLS certificate hostname mismatch",
    "self_signed": "Self-signed TLS certificate",
    "untrusted_chain": "TLS certificate chain not trusted",
    "cert_very_new": "Recently issued TLS certificate",
    "rapid_cross_domain_redirect": "Rapid cross-domain redirect observed",
    "delayed_credential_form": "Credential form injected after initial load",
    "dynamic_submit_destination": "Form submit destination changed after load",
    "delayed_brand_injection": "Brand-related content injected after load",
}


def label_for_rule(rule: str) -> str | None:
    key = rule.strip().lower()
    if key == "":
        return None

    text = RULE_LABELS.get(key)
    if text is None:
        return None

    return text


def technical_label_for_rule(rule: str) -> str | None:
    key = rule.strip().lower()
    if key == "":
        return None

    text = TECHNICAL_RULE_LABELS.get(key)
    if text is None:
        return None

    return text
