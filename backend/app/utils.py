"""Shared helpers."""

import csv
import io
from contextlib import contextmanager
from typing import Iterable, Sequence

from fastapi import HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

# Leading characters a spreadsheet may interpret as a formula. Values starting
# with one of these are prefixed with a single quote to neutralize CSV injection
# (a.k.a. formula injection) when the export is opened in Excel / Google Sheets.
_CSV_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def _csv_safe(value: object) -> str:
    """Escape values that a spreadsheet would otherwise evaluate as a formula."""
    text = "" if value is None else str(value)
    if text and text[0] in _CSV_FORMULA_PREFIXES:
        return "'" + text
    return text


def csv_response(
    filename: str, header: Sequence[str], rows: Iterable[Sequence[object]]
) -> StreamingResponse:
    """Build a downloadable CSV streaming response."""

    def generate():
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(header)
        yield buffer.getvalue()
        for row in rows:
            buffer.seek(0)
            buffer.truncate(0)
            writer.writerow([_csv_safe(cell) for cell in row])
            yield buffer.getvalue()

    return StreamingResponse(
        generate(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


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
