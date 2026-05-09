import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.blacklist import router as blacklist_router
from app.services.blacklist.openphish import openphish_store

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(60.0, connect=10.0),
        follow_redirects=True,
    )
    try:
        await openphish_store.refresh_if_stale(app.state.http_client)
    except Exception as exc:
        log.warning(
            "OpenPhish initial refresh failed (will retry on first request): %s",
            exc,
        )
    yield
    await app.state.http_client.aclose()


app = FastAPI(
    title="Anti-phishing API",
    description="URL checks (blocklists) for the browser extension.",
    lifespan=lifespan,
)

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
