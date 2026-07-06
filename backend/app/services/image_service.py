"""
Image service: real image validation, SHA-256 hashing, per-farm duplicate
detection, and persistence via the configured storage backend.

Security notes
--------------
* The uploaded file is validated by decoding its *bytes* with Pillow, not by
  trusting the client-supplied ``Content-Type`` (which is spoofable).
* The stored object key is derived from the content hash plus the real,
  Pillow-detected format — the client's filename/extension is never used, so a
  disguised ``evil.html`` can never be persisted or served as active content.
"""

import hashlib
import io
import logging

from fastapi import HTTPException, UploadFile, status
from PIL import Image, UnidentifiedImageError
from sqlalchemy.orm import Session

from app.models.db_models import DeathRecord
from app.services.storage import get_storage_backend

logger = logging.getLogger(__name__)

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

# Pillow format name -> (file extension, canonical MIME type). This is the
# authoritative allowlist: a file is accepted only if Pillow decodes it to one
# of these formats.
_FORMAT_MAP = {
    "JPEG": ("jpg", "image/jpeg"),
    "PNG": ("png", "image/png"),
    "WEBP": ("webp", "image/webp"),
    "GIF": ("gif", "image/gif"),
}


def image_hash_exists(db: Session, farm_id: int, image_hash: str) -> bool:
    """Return True if this farm already has a death record with this image."""
    return (
        db.query(DeathRecord)
        .filter(
            DeathRecord.farm_id == farm_id,
            DeathRecord.image_hash == image_hash,
        )
        .first()
        is not None
    )


def _validate_image(contents: bytes) -> tuple[str, str]:
    """Decode the bytes to confirm they are a real, supported image.

    Returns ``(extension, content_type)`` derived from the actual format.
    Raises HTTP 400 if the bytes are not a valid image in the allowlist.
    """
    try:
        with Image.open(io.BytesIO(contents)) as img:
            image_format = (img.format or "").upper()
            img.verify()  # integrity-check the payload (raises on corruption)
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is not a valid image",
        )

    if image_format not in _FORMAT_MAP:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Unsupported image format '{image_format or 'unknown'}'. "
                "Allowed: JPEG, PNG, WEBP, GIF"
            ),
        )
    return _FORMAT_MAP[image_format]


async def process_death_image(
    file: UploadFile, db: Session, farm_id: int
) -> tuple[str, str]:
    """
    Validate, deduplicate (per-farm), and persist a death report image via the
    configured storage backend.

    Returns:
        (image_ref, image_hash) on success.

    Raises:
        HTTPException 400 if the file is not a valid supported image or is too
        large. HTTPException 409 if the image hash already exists for this farm.
    """
    # Fast reject on the declared type before reading the body; the real gate is
    # the Pillow decode below.
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported image type '{file.content_type}'. "
            f"Allowed: {', '.join(sorted(ALLOWED_CONTENT_TYPES))}",
        )

    contents = await file.read()

    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image exceeds maximum allowed size of 10 MB",
        )

    ext, content_type = _validate_image(contents)

    image_hash = hashlib.sha256(contents).hexdigest()
    logger.info("Processing image with hash: %s...", image_hash[:16])

    if image_hash_exists(db, farm_id, image_hash):
        logger.warning("Duplicate image hash detected: %s", image_hash[:16])
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This image has already been used in a previous death report",
        )

    backend = get_storage_backend()
    # Key is fully server-derived (farm scope + content hash + real format).
    # The client filename is deliberately discarded.
    key = f"{farm_id}/{image_hash}.{ext}"
    image_ref = backend.save(key, contents, content_type)

    logger.info("Saved death image to: %s", image_ref)
    return image_ref, image_hash
