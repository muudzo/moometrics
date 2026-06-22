"""
Pluggable image storage backends.

``local``  — writes under ``UPLOAD_DIR`` and serves via the ``/uploads`` mount
             (development / single-node).
``s3``     — S3-compatible object storage (AWS S3 or Cloudflare R2 via
             ``S3_ENDPOINT_URL``) for durable, multi-instance production.

The value returned by :meth:`save` is the *reference* stored in
``DeathRecord.image_path``; pass it back to :meth:`delete` to remove the object
and to :meth:`public_url` to build a browser-loadable URL.
"""

import logging
import os
from functools import lru_cache
from typing import Protocol

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)


class StorageBackend(Protocol):
    def save(self, key: str, data: bytes, content_type: str) -> str: ...

    def delete(self, ref: str) -> None: ...

    def public_url(self, ref: str) -> str: ...


class LocalStorage:
    """Stores files on local disk under ``UPLOAD_DIR``."""

    def __init__(self, upload_dir: str) -> None:
        self._upload_dir = upload_dir

    def save(self, key: str, data: bytes, content_type: str) -> str:
        path = os.path.join(self._upload_dir, key)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(data)
        return path  # relative path, also the value stored in image_path

    def delete(self, ref: str) -> None:
        try:
            os.remove(ref)
        except OSError:
            pass

    def public_url(self, ref: str) -> str:
        # Served by the /uploads static mount; the SPA prepends the API origin.
        return "/" + ref if not ref.startswith("/") else ref


class S3Storage:
    """S3-compatible object storage (AWS S3 / Cloudflare R2)."""

    def __init__(self, settings: Settings) -> None:
        import boto3  # lazy: only required when the s3 backend is selected

        self._bucket = settings.s3_bucket
        self._public_base = settings.s3_public_base_url.rstrip("/")
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url or None,
            region_name=settings.s3_region or None,
            aws_access_key_id=settings.s3_access_key_id or None,
            aws_secret_access_key=settings.s3_secret_access_key or None,
        )

    def save(self, key: str, data: bytes, content_type: str) -> str:
        self._client.put_object(
            Bucket=self._bucket, Key=key, Body=data, ContentType=content_type
        )
        return key

    def delete(self, ref: str) -> None:
        try:
            self._client.delete_object(Bucket=self._bucket, Key=ref)
        except Exception:  # pragma: no cover - best effort cleanup
            logger.exception("Failed to delete object %s", ref)

    def public_url(self, ref: str) -> str:
        if self._public_base:
            return f"{self._public_base}/{ref}"
        # Fall back to a time-limited presigned URL.
        return self._client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self._bucket, "Key": ref},
            ExpiresIn=3600,
        )


@lru_cache
def get_storage_backend() -> StorageBackend:
    settings = get_settings()
    if settings.storage_backend == "s3":
        logger.info("Using S3 storage backend (bucket=%s)", settings.s3_bucket)
        return S3Storage(settings)
    return LocalStorage(settings.upload_dir)
