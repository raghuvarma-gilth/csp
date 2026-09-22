"""
The database interface: PostgREST over HTTPS, using the service-role key.

Why not an ORM — the schema, its constraints and its row-level security already
live in SQL migrations, and PostgREST speaks that schema directly. A second
model definition in Python would only be a second place for it to drift.

Everything in this module runs with the service role, which bypasses RLS. That
is safe only because no route reaches it before `require_user` has established
*who* is asking, and because every query written against it filters by that
user's id. When a request only needs the caller's own rows and nothing more,
prefer `Database.as_user(token)` — it sends the student's own JWT so RLS still
applies, and a filter bug fails closed instead of leaking.
"""

from __future__ import annotations

from typing import Any, Iterable, Literal, Sequence

import httpx

from .config import settings
from .errors import PublicError

Filter = tuple[str, Any]
Filters = dict[str, Any] | None

_OPERATORS = {"eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in", "cs", "not.is"}


def _encode(column: str, value: Any) -> tuple[str, str]:
    """Turn `{"id": x}` or `{"score": ("gte", 50)}` into a PostgREST query param."""
    if isinstance(value, tuple) and len(value) == 2 and value[0] in _OPERATORS:
        operator, operand = value
    else:
        operator, operand = "eq", value

    if operator == "in":
        items = ",".join(f'"{item}"' for item in operand)
        return column, f"in.({items})"
    if operator == "is":
        rendered = "null" if operand is None else str(operand).lower()
        return column, f"is.{rendered}"
    if operand is None:
        return column, "is.null"
    if isinstance(operand, bool):
        return column, f"{operator}.{str(operand).lower()}"
    return column, f"{operator}.{operand}"


class Database:
    """A thin, explicit PostgREST client. One instance per process."""

    def __init__(self, client: httpx.AsyncClient, token: str | None = None) -> None:
        self._client = client
        self._token = token

    def as_user(self, access_token: str) -> "Database":
        """A view of the database that RLS still applies to."""
        return Database(self._client, token=access_token)

    @property
    def _headers(self) -> dict[str, str]:
        if not settings.supabase_configured:
            raise PublicError(
                "The server is not connected to Supabase yet. Set SUPABASE_URL, "
                "SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in backend/.env.",
                status=503,
                code="supabase_not_configured",
            )
        bearer = self._token or settings.supabase_service_role_key
        return {
            "apikey": settings.supabase_anon_key,
            "Authorization": f"Bearer {bearer}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def _request(self, method: str, path: str, **kwargs: Any) -> httpx.Response:
        headers = {**self._headers, **kwargs.pop("headers", {})}
        response = await self._client.request(
            method, f"{settings.rest_url}{path}", headers=headers, **kwargs
        )
        if response.status_code >= 400:
            try:
                payload = response.json()
                detail = payload.get("message") or payload.get("hint") or response.text
                pg_code = payload.get("code", "")
            except ValueError:
                detail, pg_code = response.text, ""

            # 23505 unique_violation / 23514 check_violation are the two the
            # application actually expects; they are surfaced with their codes so
            # callers can turn them into specific, friendly messages.
            raise PublicError(
                f"Database request failed: {detail}",
                status=409 if pg_code in {"23505", "23514"} else 500,
                code=f"pg_{pg_code}" if pg_code else "database_error",
            )
        return response

    # -- reads ---------------------------------------------------------------

    async def select(
        self,
        table: str,
        columns: str = "*",
        *,
        filters: Filters = None,
        order: str | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> list[dict[str, Any]]:
        params: list[tuple[str, str]] = [("select", columns)]
        for column, value in (filters or {}).items():
            params.append(_encode(column, value))
        if order:
            params.append(("order", order))
        if limit is not None:
            params.append(("limit", str(limit)))
        if offset is not None:
            params.append(("offset", str(offset)))

        response = await self._request("GET", f"/{table}", params=params)
        return response.json()

    async def maybe_single(
        self, table: str, columns: str = "*", *, filters: Filters = None, order: str | None = None
    ) -> dict[str, Any] | None:
        rows = await self.select(table, columns, filters=filters, order=order, limit=1)
        return rows[0] if rows else None

    async def count(self, table: str, *, filters: Filters = None) -> int:
        params: list[tuple[str, str]] = [("select", "id")]
        for column, value in (filters or {}).items():
            params.append(_encode(column, value))
        response = await self._request(
            "GET",
            f"/{table}",
            params=params,
            headers={"Prefer": "count=exact", "Range": "0-0"},
        )
        content_range = response.headers.get("content-range", "*/0")
        total = content_range.split("/")[-1]
        return int(total) if total.isdigit() else 0

    # -- writes --------------------------------------------------------------

    async def insert(
        self,
        table: str,
        rows: dict[str, Any] | Sequence[dict[str, Any]],
        *,
        returning: Literal["representation", "minimal"] = "representation",
    ) -> list[dict[str, Any]]:
        prefer = f"return={returning}"
        response = await self._request(
            "POST", f"/{table}", json=rows, headers={"Prefer": prefer}
        )
        if returning == "minimal" or not response.content:
            return []
        payload = response.json()
        return payload if isinstance(payload, list) else [payload]

    async def insert_one(self, table: str, row: dict[str, Any]) -> dict[str, Any]:
        rows = await self.insert(table, row)
        if not rows:
            raise PublicError("The database accepted the write but returned nothing.", status=500)
        return rows[0]

    async def upsert(
        self,
        table: str,
        rows: dict[str, Any] | Sequence[dict[str, Any]],
        *,
        on_conflict: str,
        returning: Literal["representation", "minimal"] = "representation",
    ) -> list[dict[str, Any]]:
        response = await self._request(
            "POST",
            f"/{table}",
            json=rows,
            params=[("on_conflict", on_conflict)],
            headers={"Prefer": f"resolution=merge-duplicates,return={returning}"},
        )
        if returning == "minimal" or not response.content:
            return []
        payload = response.json()
        return payload if isinstance(payload, list) else [payload]

    async def update(
        self,
        table: str,
        values: dict[str, Any],
        *,
        filters: dict[str, Any],
        returning: Literal["representation", "minimal"] = "minimal",
    ) -> list[dict[str, Any]]:
        if not filters:
            raise ValueError("Refusing to update every row: pass at least one filter.")
        params = [_encode(column, value) for column, value in filters.items()]
        response = await self._request(
            "PATCH",
            f"/{table}",
            json=values,
            params=params,
            headers={"Prefer": f"return={returning}"},
        )
        if returning == "minimal" or not response.content:
            return []
        payload = response.json()
        return payload if isinstance(payload, list) else [payload]

    async def delete(self, table: str, *, filters: dict[str, Any]) -> None:
        if not filters:
            raise ValueError("Refusing to delete every row: pass at least one filter.")
        params = [_encode(column, value) for column, value in filters.items()]
        await self._request("DELETE", f"/{table}", params=params, headers={"Prefer": "return=minimal"})

    # -- functions -----------------------------------------------------------

    async def rpc(self, function: str, params: dict[str, Any] | None = None) -> Any:
        response = await self._request("POST", f"/rpc/{function}", json=params or {})
        if not response.content:
            return None
        return response.json()


_client: httpx.AsyncClient | None = None


def open_http_client() -> httpx.AsyncClient:
    global _client
    _client = httpx.AsyncClient(timeout=settings.request_timeout_seconds)
    return _client


async def close_http_client() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


def http_client() -> httpx.AsyncClient:
    if _client is None:
        raise RuntimeError("HTTP client used before application startup.")
    return _client


def admin_db() -> Database:
    return Database(http_client())


def ids(rows: Iterable[dict[str, Any]], key: str = "id") -> list[str]:
    return [row[key] for row in rows if row.get(key)]
