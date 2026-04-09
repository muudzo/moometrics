"""
SQLAlchemy ORM models for MooMetrics core entities.
"""

from datetime import datetime, date
from typing import Optional, List
from sqlalchemy import (
    CheckConstraint,
    Integer,
    String,
    DateTime,
    Date,
    ForeignKey,
    Index,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('manager', 'employee')", name="ck_user_role"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(
        String(32), unique=True, index=True, nullable=False
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

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
        Index("ix_animal_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    animal_type: Mapped[str] = mapped_column(String(20), nullable=False)
    tag_number: Mapped[Optional[str]] = mapped_column(
        String(50), unique=True, nullable=True
    )
    breed: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(10), default="alive", nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    added_by_user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    added_by: Mapped["User"] = relationship("User", back_populates="animals")
    death_record: Mapped[Optional["DeathRecord"]] = relationship(
        "DeathRecord", back_populates="animal", uselist=False
    )


class DeathRecord(Base):
    __tablename__ = "death_records"
    __table_args__ = (
        UniqueConstraint("image_hash", name="uq_death_image_hash"),
        Index("ix_death_reported_by", "reported_by_user_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    animal_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("animals.id"), unique=True, nullable=False
    )
    reported_by_user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    cause_of_death: Mapped[str] = mapped_column(String(200), nullable=False)
    date_of_death: Mapped[date] = mapped_column(Date, nullable=False)
    image_path: Mapped[str] = mapped_column(String(500), nullable=False)
    image_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    animal: Mapped["Animal"] = relationship("Animal", back_populates="death_record")
    reported_by: Mapped["User"] = relationship("User", back_populates="death_reports")
