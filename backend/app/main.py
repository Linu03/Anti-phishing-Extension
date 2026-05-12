import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.blacklist import router as blacklist_router
from app.services.blacklist.openphish import openphish_store
from app.services.blacklist.phishunt import phishunt_store

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


@app.get("/health")
async def health():
    return {"status": "ok"}
