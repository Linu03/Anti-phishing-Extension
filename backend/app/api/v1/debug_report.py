from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(tags=["debug"])

BACKEND_ROOT = Path(__file__).resolve().parents[3]
REPORTS_DIR = BACKEND_ROOT / "debug_reports"


class ScanDebugReportRequest(BaseModel):
    report: dict[str, Any] = Field(..., description="Full scan debug payload from the extension.")


def _safe_filename_part(text: str, max_len: int = 48) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "_", text.strip().lower())
    cleaned = cleaned.strip("._-")
    if cleaned == "":
        return "unknown"
    if len(cleaned) > max_len:
        return cleaned[:max_len]
    return cleaned


@router.post("/debug/scan-report")
async def write_scan_debug_report(body: ScanDebugReportRequest) -> dict[str, str]:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    report = body.report
    page_url = report.get("page_url")
    host = "unknown"
    if isinstance(page_url, str) and page_url.strip() != "":
        try:
            from urllib.parse import urlparse

            parsed = urlparse(page_url.strip())
            host = parsed.hostname or "unknown"
        except ValueError:
            host = "unknown"

    timestamp = datetime.now(tz=timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    filename = f"{timestamp}_{_safe_filename_part(host)}.json"
    target = REPORTS_DIR / filename

    payload = {
        "written_at": datetime.now(tz=timezone.utc).isoformat(),
        **report,
    }

    try:
        target.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Could not write debug report: {exc}") from exc

    return {
        "ok": "true",
        "path": str(target),
        "filename": filename,
    }
