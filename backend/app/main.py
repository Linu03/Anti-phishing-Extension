import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.behavioral import router as behavioral_router
from app.api.v1.debug_report import router as debug_report_router
from app.api.v1.blacklist import router as blacklist_router
from app.api.v1.page_template import router as page_template_router
from app.api.v1.tls import router as tls_router
from app.api.v1.url_analyzer import router as url_analyzer_router
from app.layers.blacklist.openphish import openphish_store
from app.layers.blacklist.phishunt import phishunt_store

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):

    app.state.http_client = httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=10.0), follow_redirects=True,)

    try:
        await openphish_store.refresh_if_stale(app.state.http_client)
    except Exception as exc:
        log.warning("openphish first load failed: %s", exc)
    try:
        await phishunt_store.refresh_if_stale(app.state.http_client)
    except Exception as exc:
        log.warning("phishunt first load failed: %s", exc)
    yield
    await app.state.http_client.aclose()


app = FastAPI(title="Anti-phishing API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(blacklist_router, prefix="/v1")
app.include_router(url_analyzer_router, prefix="/v1")
app.include_router(tls_router, prefix="/v1")
app.include_router(page_template_router, prefix="/v1")
app.include_router(behavioral_router, prefix="/v1")
app.include_router(debug_report_router, prefix="/v1")


@app.get("/health")
async def health():
    return {"status": "ok"}
