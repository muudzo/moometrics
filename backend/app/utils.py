"""Shared helpers."""

from contextlib import contextmanager

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session


@contextmanager
def integrity_guard(db: Session, detail: str):
    """Wrap a commit so a DB IntegrityError becomes a clean 409.

    The unique/check constraints in the schema are the source of truth for
    concurrency; application-level pre-checks only provide friendlier errors
    for the common case and can be raced. This guard catches the constraint
    violation, rolls back, and surfaces a 409 instead of a 500.
    """
    try:
        yield
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)
