"""
SQLAlchemy ORM models for MooMetrics core entities.

All records are scoped to a ``Farm`` (tenant). Uniqueness that used to be
global (animal tag numbers, death-report image hashes) is now per-farm so one
tenant's data never collides with or leaks into another's.
"""

from datetime import date, datetime, timezone
from typing import List, Optional

from sqlalchemy import (
    JSON,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    """Timezone-aware UTC now (replaces the deprecated ``datetime.utcnow``)."""
    return datetime.now(timezone.utc)


class Farm(Base):
    __tablename__ = "farms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    users: Mapped[List["User"]] = relationship("User", back_populates="farm")
    animals: Mapped[List["Animal"]] = relationship("Animal", back_populates="farm")


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('manager', 'employee')", name="ck_user_role"),
        Index("ix_user_farm", "farm_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(
        String(32), unique=True, index=True, nullable=False
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    farm_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("farms.id"), nullable=False
    )
    # Account-lockout state (brute-force protection).
    failed_login_attempts: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False
    )
    locked_until: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    farm: Mapped["Farm"] = relationship("Farm", back_populates="users")
    animals: Mapped[List["Animal"]] = relationship("Animal", back_populates="added_by")
    death_reports: Mapped[List["DeathRecord"]] = relationship(
        "DeathRecord", back_populates="reported_by"
    )


class Animal(Base):
    __tablename__ = "animals"
    __table_args__ = (
        CheckConstraint(
            "animal_type IN ('cattle','sheep','goat','pig','horse','chicken','other')",
            name="ck_animal_type",
        ),
        CheckConstraint("status IN ('alive','dead')", name="ck_animal_status"),
        # Tag numbers are unique within a farm, not globally.
        UniqueConstraint("farm_id", "tag_number", name="uq_animal_farm_tag"),
        Index("ix_animal_status", "status"),
        Index("ix_animal_farm", "farm_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    farm_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("farms.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    animal_type: Mapped[str] = mapped_column(String(20), nullable=False)
    tag_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    breed: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(10), default="alive", nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    added_by_user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow
    )

    farm: Mapped["Farm"] = relationship("Farm", back_populates="animals")
    added_by: Mapped["User"] = relationship("User", back_populates="animals")
    death_record: Mapped[Optional["DeathRecord"]] = relationship(
        "DeathRecord", back_populates="animal", uselist=False
    )


class DeathRecord(Base):
    __tablename__ = "death_records"
    __table_args__ = (
        # Image-hash dedup is per-farm so one tenant cannot block another.
        UniqueConstraint("farm_id", "image_hash", name="uq_death_farm_image_hash"),
        Index("ix_death_reported_by", "reported_by_user_id"),
        Index("ix_death_farm", "farm_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    farm_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("farms.id"), nullable=False
    )
    animal_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("animals.id"), unique=True, nullable=False
    )
    reported_by_user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    cause_of_death: Mapped[str] = mapped_column(String(200), nullable=False)
    date_of_death: Mapped[date] = mapped_column(Date, nullable=False)
    image_path: Mapped[str] = mapped_column(String(500), nullable=False)
    image_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    animal: Mapped["Animal"] = relationship("Animal", back_populates="death_record")
    reported_by: Mapped["User"] = relationship("User", back_populates="death_reports")


class AuditLog(Base):
    """Immutable record of who changed what, for dispute resolution.

    ``actor_user_id`` is intentionally *not* a hard FK and ``actor_username``
    is denormalized so the trail survives deletion of the acting user.
    """

    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_farm_created", "farm_id", "created_at"),
        Index("ix_audit_entity", "entity_type", "entity_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    farm_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("farms.id"), nullable=False
    )
    actor_user_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    actor_username: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    action: Mapped[str] = mapped_column(String(40), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(40), nullable=False)
    entity_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    details: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    ip: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class RefreshToken(Base):
    """Server-side, revocable refresh token (only its hash is stored)."""

    __tablename__ = "refresh_tokens"
    __table_args__ = (Index("ix_refresh_user", "user_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    revoked: Mapped[bool] = mapped_column(default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
