"""
Image service: SHA-256 hash computation, duplicate detection, file persistence.
"""

import hashlib
import logging
import os

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.db_models import DeathRecord

settings = get_settings()
logger = logging.getLogger(__name__)

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


async def process_death_image(file: UploadFile, db: Session) -> tuple[str, str]:
    """
    Validate, deduplicate, and persist a death report image.

    Returns:
        (image_path, image_hash) on success.

    Raises:
        HTTPException 400 if file type is unsupported or exceeds size limit.
        HTTPException 409 if the image hash already exists in the database.
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
    logger.info(f"Processing image with hash: {image_hash[:16]}...")

    existing = (
        db.query(DeathRecord).filter(DeathRecord.image_hash == image_hash).first()
    )
    if existing:
        logger.warning(f"Duplicate image hash detected: {image_hash[:16]}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This image has already been used in a previous death report",
        )

    os.makedirs(settings.upload_dir, exist_ok=True)
    safe_filename = f"{image_hash[:8]}_{os.path.basename(file.filename or 'image')}"
    image_path = os.path.join(settings.upload_dir, safe_filename)

    with open(image_path, "wb") as f:
        f.write(contents)

    logger.info(f"Saved death image to: {image_path}")
    return image_path, image_hash
