from __future__ import annotations

from typing import Optional, Any

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.types import ASGIApp
import jwt
from jwt import PyJWKClient

from config import get_settings


class AuthContextMiddleware(BaseHTTPMiddleware):
    """
    Verifies Auth0 JWTs (when present) and exposes claims on request.state.

    Exposes:
      - request.state.subject_token: Optional[str]
      - request.state.jwt_claims: Optional[dict]
      - request.state.sub: Optional[str]
      - request.state.act: Optional[Any]
      - request.state.is_agent: bool

    If a token is present but invalid, the request continues unauthenticated (MVP).
    Endpoints can enforce auth if needed.
    """

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)
        self.settings = get_settings()
        self._jwks_client: Optional[PyJWKClient] = None

    def _jwks(self) -> Optional[PyJWKClient]:
        if not self.settings.auth0_domain:
            return None
        if self._jwks_client:
            return self._jwks_client
        jwks_url = f"https://{self.settings.auth0_domain}/.well-known/jwks.json"
        self._jwks_client = PyJWKClient(jwks_url)
        return self._jwks_client

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint):
        request.state.subject_token = None
        request.state.jwt_claims = None
        request.state.sub = None
        request.state.act = None
        request.state.is_agent = False

        auth_header: Optional[str] = request.headers.get("Authorization")
        if auth_header and auth_header.lower().startswith("bearer "):
            token = auth_header.split(" ", 1)[1].strip()
            if token:
                request.state.subject_token = token
                try:
                    jwks = self._jwks()
                    if jwks:
                        signing_key = jwks.get_signing_key_from_jwt(token).key
                        claims = jwt.decode(
                            token,
                            signing_key,
                            algorithms=["RS256"],
                            audience=self.settings.auth0_audience,
                            issuer=f"https://{self.settings.auth0_domain}/",
                        )
                    else:
                        claims = jwt.decode(token, options={"verify_signature": False})

                    if isinstance(claims, dict):
                        request.state.jwt_claims = claims
                        request.state.sub = claims.get("sub")
                        request.state.act = claims.get("act")
                        request.state.is_agent = bool(claims.get("act"))
                except jwt.PyJWTError:
                    request.state.jwt_claims = None
                    request.state.sub = None
                    request.state.act = None
                    request.state.is_agent = False

        return await call_next(request)

