from __future__ import annotations

import re

from app.layers.behavioral.finding import BehavioralFinding
from app.layers.behavioral.schemas import (
    BehaviorDiffModel,
    BehavioralContextModel,
    ClipboardShellWriteModel,
)
from app.layers.page_template.rules.clickfix import (
    RULE_CLICKFIX_LURE_SURFACE,
    RULE_FAKE_CAPTCHA_SURFACE,
)

RULE_CLICKFIX_CLIPBOARD_SHELL = "clickfix_clipboard_shell"
RULE_CLICKFIX_FULL_CHAIN = "clickfix_full_chain"

POINTS_CLICKFIX_CLIPBOARD_SHELL = 22
POINTS_CLICKFIX_FULL_CHAIN = 65

_SHELL_PAYLOAD_RE = re.compile(
    r"(?i)(powershell|cmd\.exe|\bcmd\b|mshta|curl\s|wget\s|bash|/bin/|chmod\s|"
    r"reg\s+add|certutil|bitsadmin|\becho\s|iex\(|invoke-expression|start-process)"
)


def _looks_shell_payload(text: str) -> bool:
    snippet = text.strip()
    if snippet == "":
        return False
    return _SHELL_PAYLOAD_RE.search(snippet) is not None


def _shell_writes(diff: BehaviorDiffModel) -> list[ClipboardShellWriteModel]:
    writes: list[ClipboardShellWriteModel] = []
    for item in diff.clipboard_shell_writes or []:
        if item.looks_shell and _looks_shell_payload(item.snippet):
            writes.append(item)
            continue
        if _looks_shell_payload(item.snippet):
            writes.append(item)
    return writes


def _page_rules(context: BehavioralContextModel) -> set[str]:
    return {rule.strip() for rule in context.page_template_rules if rule.strip()}


def check_clickfix_full_chain(
    diff: BehaviorDiffModel,
    context: BehavioralContextModel,
) -> list[BehavioralFinding]:
    if context.whitelist_trusted:
        return []

    writes = _shell_writes(diff)
    if not writes:
        return []

    rules = _page_rules(context)
    if RULE_CLICKFIX_LURE_SURFACE not in rules:
        return []

    page_host = (context.page_host or diff.end_host or diff.start_host).strip()
    if page_host == "":
        page_host = "unknown host"

    snippet = writes[0].snippet.strip()
    if len(snippet) > 120:
        snippet = f"{snippet[:117]}..."

    return [
        BehavioralFinding(
            rule=RULE_CLICKFIX_FULL_CHAIN,
            points=POINTS_CLICKFIX_FULL_CHAIN,
            detail=(
                f"ClickFix chain on '{page_host}': fake CAPTCHA lure plus clipboard "
                f"write of shell-like content ('{snippet}') after user interaction."
            ),
            tier="A",
        )
    ]


def check_clickfix_clipboard_shell(
    diff: BehaviorDiffModel,
    context: BehavioralContextModel,
) -> list[BehavioralFinding]:
    if context.whitelist_trusted:
        return []

    rules = _page_rules(context)
    if RULE_CLICKFIX_LURE_SURFACE in rules:
        return []

    if RULE_FAKE_CAPTCHA_SURFACE not in rules:
        return []

    writes = _shell_writes(diff)
    if not writes:
        return []

    page_host = (context.page_host or diff.end_host or diff.start_host).strip()
    if page_host == "":
        page_host = "unknown host"

    snippet = writes[0].snippet.strip()
    if len(snippet) > 120:
        snippet = f"{snippet[:117]}..."

    return [
        BehavioralFinding(
            rule=RULE_CLICKFIX_CLIPBOARD_SHELL,
            points=POINTS_CLICKFIX_CLIPBOARD_SHELL,
            detail=(
                f"Page on '{page_host}' with fake CAPTCHA surface copied "
                f"shell-like text to the clipboard after user interaction "
                f"('{snippet}')."
            ),
            tier="A",
        )
    ]
