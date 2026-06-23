"""
Image service: SHA-256 hash computation, duplicate detection, file persistence.
"""

import hashlib
import logging
import os

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.models.db_models import DeathRecord
from app.services.storage import get_storage_backend

logger = logging.getLogger(__name__)

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


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


async def process_death_image(
    file: UploadFile, db: Session, farm_id: int
) -> tuple[str, str]:
    """
    Validate, deduplicate (per-farm), and persist a death report image via the
    configured storage backend.

    Returns:
        (image_url, image_hash) on success.

    Raises:
        HTTPException 400 if file type is unsupported or exceeds size limit.
        HTTPException 409 if the image hash already exists for this farm.
    """
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported image type '{file.content_type}'. "
            f"Allowed: {', '.join(ALLOWED_CONTENT_TYPES)}",
        )

    contents = await file.read()

    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image exceeds maximum allowed size of 10 MB",
        )

    image_hash = hashlib.sha256(contents).hexdigest()
    logger.info("Processing image with hash: %s...", image_hash[:16])

    if image_hash_exists(db, farm_id, image_hash):
        logger.warning("Duplicate image hash detected: %s", image_hash[:16])
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This image has already been used in a previous death report",
        )

    backend = get_storage_backend()
    base = os.path.basename(file.filename or "image")
    key = f"{farm_id}/{image_hash[:8]}_{base}"
    image_url = backend.save(key, contents, file.content_type or "image/jpeg")

    logger.info("Saved death image to: %s", image_url)
    return image_url, image_hash
