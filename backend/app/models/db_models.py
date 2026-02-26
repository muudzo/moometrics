"""
SQLAlchemy ORM models for MooMetrics core entities.
"""

from datetime import datetime, date
from typing import Optional, List
from sqlalchemy import (
    Integer,
    String,
    DateTime,
    Date,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)  # "manager" | "employee"
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    animals: Mapped[List["Animal"]] = relationship("Animal", back_populates="added_by")
    death_reports: Mapped[List["DeathRecord"]] = relationship(
        "DeathRecord", back_populates="reported_by"
    )


class Animal(Base):
    __tablename__ = "animals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    animal_type: Mapped[str] = mapped_column(String, nullable=False)
    # cattle | sheep | goat | pig | horse | chicken | other
    tag_number: Mapped[Optional[str]] = mapped_column(String, unique=True, nullable=True)
    breed: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String, default="alive", nullable=False)
    # "alive" | "dead"
    notes: Mapped[Optional[str]] = mapped_column(String, nullable=True)
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
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    animal_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("animals.id"), unique=True, nullable=False
    )
    reported_by_user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    cause_of_death: Mapped[str] = mapped_column(String, nullable=False)
    date_of_death: Mapped[date] = mapped_column(Date, nullable=False)
    image_path: Mapped[str] = mapped_column(String, nullable=False)
    image_hash: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    animal: Mapped["Animal"] = relationship("Animal", back_populates="death_record")
    reported_by: Mapped["User"] = relationship("User", back_populates="death_reports")
