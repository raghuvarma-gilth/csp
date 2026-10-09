"""
Who is calling, and what are they allowed to do.

Two rules, both non-negotiable:

1. The identity comes from the Supabase access token, verified against GoTrue.
   A request body cannot claim a user id.
2. The role comes from `public.user_roles`, read server-side. A student cannot
   make themselves faculty, a research expert or an admin by editing anything
   the browser can reach — the frontend's idea of a role is a display detail
   and is never an authorisation input.

Verified identities are cached for a few seconds so a burst of calls from one
screen does not become a burst of calls to GoTrue. The cache is keyed by the
token itself and expires well inside the token's own lifetime.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Annotated, Literal

from fastapi import Depends, Header

from .config import settings
from .db import Database, admin_db, http_client
from .errors import PublicError

Role = Literal["student", "faculty", "research_expert", "industry_expert", "admin"]

_TOKEN_TTL_SECONDS = 20.0
_token_cache: dict[str, tuple[float, str, str | None]] = {}


@dataclass(slots=True)
class CurrentUser:
    id: str
    email: str | None
    token: str

    def db(self) -> Database:
        """A database handle that RLS still applies to, acting as this user."""
        return Database(http_client(), token=self.token)


async def _verify_token(token: str) -> tuple[str, str | None]:
    now = time.monotonic()
    cached = _token_cache.get(token)
    if cached and cached[0] > now:
        return cached[1], cached[2]

    if not settings.supabase_configured:
        raise PublicError(
            "The server is not connected to Supabase yet. Set SUPABASE_URL, "
            "SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in backend/.env.",
            status=503,
            code="supabase_not_configured",
        )

    response = await http_client().get(
        f"{settings.auth_url}/user",
        headers={"apikey": settings.supabase_anon_key, "Authorization": f"Bearer {token}"},
    )
    if response.status_code != 200:
        _token_cache.pop(token, None)
        raise PublicError("Your session has expired. Please sign in again.", status=401, code="unauthorized")

    payload = response.json()
    user_id = payload.get("id")
    if not user_id:
        raise PublicError("Your session could not be verified.", status=401, code="unauthorized")

    # Opportunistic sweep so the cache cannot grow without bound.
    if len(_token_cache) > 512:
        for key, (expires, _, _) in list(_token_cache.items()):
            if expires <= now:
                _token_cache.pop(key, None)

    email = payload.get("email")
    _token_cache[token] = (now + _TOKEN_TTL_SECONDS, user_id, email)
    return user_id, email


async def require_user(
    authorization: Annotated[str | None, Header()] = None,
) -> CurrentUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise PublicError("You need to be signed in to do that.", status=401, code="unauthorized")

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise PublicError("You need to be signed in to do that.", status=401, code="unauthorized")

    user_id, email = await _verify_token(token)
    return CurrentUser(id=user_id, email=email, token=token)


CurrentUserDep = Annotated[CurrentUser, Depends(require_user)]


async def roles_of(user_id: str) -> set[Role]:
    rows = await admin_db().select("user_roles", "role", filters={"user_id": user_id})
    return {row["role"] for row in rows}  # type: ignore[misc]


async def require_role(user: CurrentUser, *allowed: Role) -> set[Role]:
    held = await roles_of(user.id)
    if held & set(allowed) or "admin" in held:
        return held
    readable = " or ".join(role.replace("_", " ") for role in allowed)
    raise PublicError(
        f"This action is limited to {readable} accounts. "
        "These roles are granted by an administrator and cannot be self-assigned.",
        status=403,
        code="forbidden",
    )


async def require_faculty(user: CurrentUserDep) -> CurrentUser:
    await require_role(user, "faculty")
    return user


async def require_research_expert(user: CurrentUserDep) -> CurrentUser:
    await require_role(user, "research_expert")
    return user


async def require_admin(user: CurrentUserDep) -> CurrentUser:
    await require_role(user, "admin")
    return user


FacultyDep = Annotated[CurrentUser, Depends(require_faculty)]
ResearchDep = Annotated[CurrentUser, Depends(require_research_expert)]
AdminDep = Annotated[CurrentUser, Depends(require_admin)]
