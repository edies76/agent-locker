from __future__ import annotations

import time
from typing import Any

import httpx


class JwksCache:
    def __init__(self) -> None:
        self._jwks: dict[str, Any] | None = None
        self._fetched_at: float = 0.0

    async def get(self, jwks_url: str, ttl_s: int = 3600) -> dict[str, Any]:
        now = time.time()
        if self._jwks and (now - self._fetched_at) < ttl_s:
            return self._jwks

        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(jwks_url)
            r.raise_for_status()
            self._jwks = r.json()
            self._fetched_at = now
            return self._jwks


jwks_cache = JwksCache()

