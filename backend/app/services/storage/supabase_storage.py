"""Small async adapter for private Supabase Storage objects."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator
from urllib.parse import quote, urlsplit

import httpx

from app.core.config import get_settings

BUCKET_NAME = "bytequest-instructional-pdfs"
_TIMEOUT = httpx.Timeout(20.0, connect=5.0)


class StorageError(RuntimeError):
    """Storage operation failed without exposing credentials or provider details."""


class SupabasePDFStorage:
    def __init__(self) -> None:
        settings = get_settings()
        self._base_url = settings.SUPABASE_URL.rstrip("/")
        self._api_key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_SECRET_KEY
        self._http_client: httpx.AsyncClient | None = None

    def set_http_client(self, client: httpx.AsyncClient | None) -> None:
        """Use the app's pooled client for storage calls during normal API service."""
        self._http_client = client

    @asynccontextmanager
    async def _client(self) -> AsyncIterator[httpx.AsyncClient]:
        client = self._http_client
        if client is not None and not client.is_closed:
            yield client
            return
        async with httpx.AsyncClient(timeout=_TIMEOUT) as temporary_client:
            yield temporary_client

    def _headers(self) -> dict[str, str]:
        if not self._base_url or not self._api_key:
            raise StorageError("Private PDF storage is not configured.")
        return {"apikey": self._api_key, "Authorization": f"Bearer {self._api_key}"}

    @staticmethod
    def _resolve_signed_url(signed_path: str, base_url: str) -> str:
        """Resolve Supabase's signed path without allowing an off-origin redirect."""
        try:
            signed = urlsplit(signed_path)
            base = urlsplit(base_url)
        except ValueError as exc:
            raise StorageError("Storage returned an invalid download link.") from exc

        if signed.fragment:
            raise StorageError("Storage returned an invalid download link.")

        if signed.scheme or signed.netloc:
            if (
                signed.scheme.lower() != base.scheme.lower()
                or signed.netloc.lower() != base.netloc.lower()
                or signed.username is not None
                or signed.password is not None
            ):
                raise StorageError("Storage returned an off-origin download link.")
            return signed_path

        if not signed.path:
            raise StorageError("Storage returned an invalid download link.")
        suffix = signed_path if signed.path.startswith("/") else f"/{signed_path}"
        return f"{base_url.rstrip('/')}/storage/v1{suffix}"

    async def upload(self, path: str, content: bytes) -> None:
        encoded = quote(path, safe="/")
        try:
            async with self._client() as client:
                response = await client.post(
                    f"{self._base_url}/storage/v1/object/{BUCKET_NAME}/{encoded}",
                    headers={**self._headers(), "Content-Type": "application/pdf", "x-upsert": "false"},
                    content=content,
                    timeout=_TIMEOUT,
                )
                response.raise_for_status()
        except (httpx.HTTPError, StorageError) as exc:
            raise StorageError("The PDF could not be saved to private storage.") from exc

    async def delete(self, path: str) -> None:
        encoded = quote(path, safe="/")
        try:
            async with self._client() as client:
                response = await client.request(
                    "DELETE",
                    f"{self._base_url}/storage/v1/object/{BUCKET_NAME}/{encoded}",
                    headers=self._headers(),
                    timeout=_TIMEOUT,
                )
                response.raise_for_status()
        except (httpx.HTTPError, StorageError) as exc:
            raise StorageError("The temporary PDF could not be removed from private storage.") from exc

    async def download(self, path: str) -> bytes:
        encoded = quote(path, safe="/")
        try:
            async with self._client() as client:
                response = await client.get(
                    f"{self._base_url}/storage/v1/object/{BUCKET_NAME}/{encoded}",
                    headers=self._headers(),
                    timeout=_TIMEOUT,
                )
                response.raise_for_status()
                return response.content
        except (httpx.HTTPError, StorageError) as exc:
            raise StorageError("The stored PDF could not be retrieved.") from exc

    async def create_download_url(self, path: str, expires_in: int = 60) -> str:
        encoded = quote(path, safe="/")
        try:
            async with self._client() as client:
                response = await client.post(
                    f"{self._base_url}/storage/v1/object/sign/{BUCKET_NAME}/{encoded}",
                    headers={**self._headers(), "Content-Type": "application/json"},
                    json={"expiresIn": expires_in},
                    timeout=_TIMEOUT,
                )
                response.raise_for_status()
                payload = response.json()
                if not isinstance(payload, dict):
                    raise StorageError("Storage did not return a download link.")
                signed_path = payload.get("signedURL") or payload.get("signedUrl")
                if not isinstance(signed_path, str) or not signed_path:
                    raise StorageError("Storage did not return a download link.")
                return self._resolve_signed_url(signed_path, self._base_url)
        except (httpx.HTTPError, ValueError, StorageError) as exc:
            raise StorageError("A temporary download link could not be created.") from exc


pdf_storage = SupabasePDFStorage()
