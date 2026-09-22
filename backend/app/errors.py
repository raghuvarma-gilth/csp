"""
The error contract.

The browser's `callFunction` helper reads `{ "error": "...", "code": "..." }`
and shows that message to the student, so every message written here is written
for a human to read. Codes ending in `_not_configured` are rendered by the UI as
a settings notice rather than a failure, which is how a missing API key ends up
saying "this feature is not configured yet" instead of "something went wrong".

Unexpected exceptions never leak: they are logged with a stack trace server-side
and answered with a generic 500.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger("eduverse")


class PublicError(Exception):
    """An error whose message is safe, and intended, to show to the caller."""

    def __init__(self, message: str, status: int = 400, code: str = "bad_request") -> None:
        super().__init__(message)
        self.message = message
        self.status = status
        self.code = code


class NotConfigured(PublicError):
    def __init__(self, message: str, code: str) -> None:
        super().__init__(message, status=503, code=code)


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(PublicError)
    async def _public(_: Request, exc: PublicError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status, content={"error": exc.message, "code": exc.code}
        )

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        first = exc.errors()[0] if exc.errors() else {}
        field = ".".join(str(part) for part in first.get("loc", ()) if part != "body")
        detail = first.get("msg", "The request body was not valid.")
        return JSONResponse(
            status_code=400,
            content={
                "error": f"{field}: {detail}" if field else detail,
                "code": "invalid_request",
            },
        )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error on %s %s", request.method, request.url.path, exc_info=exc)
        return JSONResponse(
            status_code=500,
            content={
                "error": "Something went wrong on the server. Please try again.",
                "code": "internal_error",
            },
        )
