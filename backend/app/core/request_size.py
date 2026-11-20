"""Reject oversized request bodies before FastAPI parses JSON or multipart data."""

import re

from fastapi import HTTPException
from starlette.responses import JSONResponse

MIB = 1024 * 1024
MAX_REQUEST_BYTES = 12 * MIB
MAX_PDF_BYTES = 50 * MIB
MAX_PDF_REQUEST_BYTES = MAX_PDF_BYTES + 2 * MIB
PDF_UPLOAD_PATH = re.compile(
    r"/api/v1/(?:admin/materials|faculty/materials(?:/[^/]+/versions)?"
    r"|instructor/documents/(?:upload|[^/]+/versions))/?"
)


class _TooLarge(HTTPException):
    def __init__(self, limit: int):
        super().__init__(status_code=413, detail={
            "code": "request_too_large",
            "message": f"Request bodies must be {limit // MIB} MiB or smaller.",
        })


class RequestSizeLimitMiddleware:
    def __init__(self, app, max_bytes: int = MAX_REQUEST_BYTES):
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope.get("method") not in {"POST", "PUT", "PATCH"}:
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers", []))
        content_type = headers.get(b"content-type", b"").split(b";", 1)[0].strip().lower()
        pdf_upload = (
            scope["method"] == "POST"
            and content_type == b"multipart/form-data"
            and PDF_UPLOAD_PATH.fullmatch(scope.get("path", ""))
        )
        limit = MAX_PDF_REQUEST_BYTES if pdf_upload else self.max_bytes
        try:
            declared = int(headers.get(b"content-length", b"0"))
        except ValueError:
            declared = 0
        if declared > limit:
            error = _TooLarge(limit)
            await JSONResponse({"detail": error.detail}, status_code=413)(scope, receive, send)
            return

        received = 0
        started = False

        async def limited_receive():
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    raise _TooLarge(limit)
            return message

        async def tracked_send(message):
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, tracked_send)
        except _TooLarge as error:
            if started:
                raise
            await JSONResponse({"detail": error.detail}, status_code=413)(scope, receive, send)
