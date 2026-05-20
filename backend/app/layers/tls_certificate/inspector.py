from __future__ import annotations

import asyncio
import os
import socket
import ssl
import tempfile
from datetime import datetime, timezone
from urllib.parse import ParseResult

DEFAULT_TIMEOUT_SECONDS = 5.0
DEFAULT_HTTPS_PORT = 443

_CERT_DATE_FORMAT = "%b %d %H:%M:%S %Y %Z"


def _classify_ssl_error(exc: ssl.SSLError) -> str:
    if isinstance(exc, ssl.SSLCertVerificationError):
        verify_code = getattr(exc, "verify_code", 0)
        if verify_code == 10:
            return "expired"
        if verify_code in (18, 19):
            return "self_signed"
        if verify_code in (20, 21):
            return "untrusted_chain"
        if verify_code in (62, 64):
            return "hostname_mismatch"

    # fallback to string matching incase not populated in the error code
    msg = str(exc).lower()
    if "certificate has expired" in msg:
        return "expired"
    if "self signed" in msg or "self-signed" in msg:
        return "self_signed"
    if "hostname" in msg and "mismatch" in msg:
        return "hostname_mismatch"
    if "unable to get local issuer" in msg or "unable to get issuer" in msg:
        return "untrusted_chain"
    return "ssl_error"  # instead of crashing, return a generic error


def _parse_cert_dates(raw: dict) -> tuple[datetime | None, datetime | None]:
    nb_str = raw.get("notBefore")
    na_str = raw.get("notAfter")

    nb_dt: datetime | None = None
    na_dt: datetime | None = None

    if nb_str:
        try:
            nb_dt = datetime.strptime(nb_str, _CERT_DATE_FORMAT).replace(tzinfo=timezone.utc)
        except ValueError:
            nb_dt = None

    if na_str:
        try:
            na_dt = datetime.strptime(na_str, _CERT_DATE_FORMAT).replace(tzinfo=timezone.utc)
        except ValueError:
            na_dt = None

    return nb_dt, na_dt # return the dates as datetime objects


def _name_to_string(name_seq) -> str:
    parts: list[str] = []
    for rdn in name_seq or []:
        for key, value in rdn:
            parts.append(f"{key}={value}")
    return ", ".join(parts)

def _extract_san(raw: dict) -> list[str]:
    san = raw.get("subjectAltName") or []
    result: list[str] = []
    for kind, value in san:
        if kind == "DNS":
            result.append(value)
    return result


def _build_cert_dict(raw: dict) -> dict:
    nb_dt, na_dt = _parse_cert_dates(raw)
    return {
        "subject": _name_to_string(raw.get("subject", [])), # who is the subject of the certificate
        "issuer": _name_to_string(raw.get("issuer", [])), # who signed the certificate
        "not_before": nb_dt.isoformat() if nb_dt else None, 
        "not_after": na_dt.isoformat() if na_dt else None, 
        "san": _extract_san(raw),
    }


def _strict_inspect(host: str, port: int, timeout: float) -> dict:
    ctx = ssl.create_default_context()
    with socket.create_connection((host, port), timeout=timeout) as sock:
        with ctx.wrap_socket(sock, server_hostname=host) as ssock:
            raw = ssock.getpeercert()
            return _build_cert_dict(raw)


def _decode_der_cert(der: bytes) -> dict | None:
    pem = ssl.DER_cert_to_PEM_cert(der)     # text format of the certificate
    fd, path = tempfile.mkstemp(suffix=".pem") # create a temporary file to store the certificate
    try:
        with os.fdopen(fd, "w") as f:
            f.write(pem)
        try:
            return ssl._ssl._test_decode_cert(path)  # type: ignore[attr-defined]
        except Exception:
            return None
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


def _permissive_inspect(host: str, port: int, timeout: float) -> dict | None:
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    try:
        with socket.create_connection((host, port), timeout=timeout) as sock: 
            with ctx.wrap_socket(sock, server_hostname=host) as ssock:
                der = ssock.getpeercert(binary_form=True)
                if not der:
                    return None
                raw = _decode_der_cert(der)
                if raw is None:
                    return None
                return _build_cert_dict(raw)
    except Exception:
        return None


def _inspect_sync(host: str, port: int, timeout: float) -> dict:
    result: dict = {
        "reachable": False,
        "handshake_ok": False,
        "error": None,
        "cert": None,
    }

    try:
        cert = _strict_inspect(host, port, timeout)
    except socket.gaierror:
        result["error"] = "dns"
        return result
    except (socket.timeout, TimeoutError):
        result["error"] = "timeout"
        return result
    except ConnectionRefusedError:
        result["error"] = "connection_refused"
        return result
    except ssl.SSLError as e:
        result["reachable"] = True
        result["error"] = _classify_ssl_error(e)
        permissive_cert = _permissive_inspect(host, port, timeout)
        if permissive_cert is not None:
            result["cert"] = permissive_cert
        return result
    except OSError:
        result["error"] = "connection_error"
        return result
    except Exception:
        result["error"] = "unknown"     # instead of backend crashing, return a generic error 
        return result

    result["reachable"] = True
    result["handshake_ok"] = True
    result["cert"] = cert
    return result


async def inspect_tls(parsed: ParseResult, timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS) -> dict:
    host = (parsed.hostname or "").lower()
    port = parsed.port or DEFAULT_HTTPS_PORT
    return await asyncio.to_thread(_inspect_sync, host, port, timeout_seconds)
