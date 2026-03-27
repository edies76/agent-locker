from __future__ import annotations

import secrets
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse, JSONResponse

from config import get_settings
from auth.sessions import new_session, get_session, delete_session


router = APIRouter(prefix="/auth")
settings = get_settings()


@router.get("/login")
async def login(connection: str | None = None) -> RedirectResponse:
    """
    Redirects the user to Auth0 Universal Login (Authorization Code Flow).
    """
    state = secrets.token_urlsafe(24)
    params = {
        "response_type": "code",
        "client_id": settings.auth0_client_id,
        "redirect_uri": settings.auth0_callback_url,
        "scope": settings.auth0_scope,
        "audience": settings.auth0_audience,
        "state": state,
    }
    if connection:
        params["connection"] = connection
    url = f"https://{settings.auth0_domain}/authorize?{urlencode(params)}"
    resp = RedirectResponse(url=url, status_code=302)
    resp.set_cookie("agent_lock_state", state, httponly=True, samesite="lax")
    return resp


@router.get("/callback")
async def callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
):
    """
    Handles Auth0 redirect and exchanges the authorization code for tokens.
    Stores session server-side and issues a session cookie.
    """
    if error:
        return JSONResponse(
            {
                "error": error,
                "error_description": error_description,
            },
            status_code=400,
        )

    cookie_state = request.cookies.get("agent_lock_state")
    if not cookie_state or not state or cookie_state != state:
        return JSONResponse({"error": "invalid_state"}, status_code=400)

    if not code:
        return JSONResponse({"error": "missing_code"}, status_code=400)

    token_url = f"https://{settings.auth0_domain}/oauth/token"
    payload = {
        "grant_type": "authorization_code",
        "client_id": settings.auth0_client_id,
        "client_secret": settings.auth0_client_secret,
        "code": code,
        "redirect_uri": settings.auth0_callback_url,
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(token_url, json=payload)
        r.raise_for_status()
        tokens = r.json()

    access_token = tokens.get("access_token")
    if not access_token:
        return JSONResponse({"error": "missing_access_token"}, status_code=400)

    sess = new_session(
        access_token=access_token,
        id_token=tokens.get("id_token"),
        refresh_token=tokens.get("refresh_token"),
    )

    resp = RedirectResponse(url="/auth/me", status_code=302)
    resp.set_cookie(
        settings.session_cookie_name,
        sess.session_id,
        httponly=True,
        samesite="lax",
    )
    return resp


@router.get("/me")
async def me(request: Request):
    """
    Returns decoded ID/access token claims for the logged-in user (best-effort).
    """
    sid = request.cookies.get(settings.session_cookie_name)
    if not sid:
        return JSONResponse({"authenticated": False}, status_code=200)
    sess = get_session(sid)
    if not sess:
        return JSONResponse({"authenticated": False}, status_code=200)

    claims = None
    try:
        claims = jwt.decode(sess.access_token, options={"verify_signature": False})
    except Exception:
        claims = None

    return {"authenticated": True, "sub": (claims or {}).get("sub"), "claims": claims}


@router.get("/subject-token")
async def subject_token(request: Request):
    """
    Returns the current user's access token for agent delegation (MVP helper).
    """
    sid = request.cookies.get(settings.session_cookie_name)
    if not sid:
        return JSONResponse({"error": "not_authenticated"}, status_code=401)
    sess = get_session(sid)
    if not sess:
        return JSONResponse({"error": "not_authenticated"}, status_code=401)
    return {"access_token": sess.access_token}


@router.post("/logout")
async def logout(request: Request):
    sid = request.cookies.get(settings.session_cookie_name)
    if sid:
        delete_session(sid)
    resp = JSONResponse({"ok": True})
    resp.delete_cookie(settings.session_cookie_name)
    return resp

