"""Pydantic models for API request/response validation."""

import re
from datetime import datetime, date
from typing import Optional, Literal
from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Shared validators
# ---------------------------------------------------------------------------

USERNAME_PATTERN = re.compile(r"^[a-zA-Z0-9_]+$")


def _validate_username(v: str) -> str:
    if not USERNAME_PATTERN.match(v):
        raise ValueError("Username may only contain letters, digits, and underscores")
    return v


def _validate_password(v: str) -> str:
    if not any(c.isupper() for c in v):
        raise ValueError("Password must contain at least one uppercase letter")
    if not any(c.islower() for c in v):
        raise ValueError("Password must contain at least one lowercase letter")
    if not any(c.isdigit() for c in v):
        raise ValueError("Password must contain at least one digit")
    return v


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=1)


class SignupRequest(BaseModel):
    """Public self-registration — always creates an employee account."""
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("username")
    @classmethod
    def check_username(cls, v: str) -> str:
        return _validate_username(v)

    @field_validator("password")
    @classmethod
    def check_password(cls, v: str) -> str:
        return _validate_password(v)


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=8, max_length=128)
    role: Literal["manager", "employee"]

    @field_validator("username")
    @classmethod
    def check_username(cls, v: str) -> str:
        return _validate_username(v)

    @field_validator("password")
    @classmethod
    def check_password(cls, v: str) -> str:
        return _validate_password(v)


class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    username: str


# ---------------------------------------------------------------------------
# Animals
# ---------------------------------------------------------------------------

class AnimalCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    animal_type: Literal["cattle", "sheep", "goat", "pig", "horse", "chicken", "other"]
    tag_number: Optional[str] = Field(default=None, max_length=50)
    breed: Optional[str] = Field(default=None, max_length=100)
    date_of_birth: Optional[date] = None
    notes: Optional[str] = Field(default=None, max_length=1000)


class AnimalUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    animal_type: Optional[Literal["cattle", "sheep", "goat", "pig", "horse", "chicken", "other"]] = None
    tag_number: Optional[str] = Field(default=None, max_length=50)
    breed: Optional[str] = Field(default=None, max_length=100)
    date_of_birth: Optional[date] = None
    status: Optional[Literal["alive", "dead"]] = None
    notes: Optional[str] = Field(default=None, max_length=1000)


class AnimalResponse(BaseModel):
    id: int
    name: str
    animal_type: str
    tag_number: Optional[str]
    breed: Optional[str]
    date_of_birth: Optional[date]
    status: str
    notes: Optional[str]
    added_by_user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Death Records
# ---------------------------------------------------------------------------

class DeathRecordResponse(BaseModel):
    id: int
    animal_id: int
    reported_by_user_id: int
    cause_of_death: str
    date_of_death: date
    image_path: str
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

class RecentActivity(BaseModel):
    type: Literal["animal_added", "death_reported"]
    description: str
    timestamp: datetime


class DashboardStats(BaseModel):
    total_animals: int
    alive_count: int
    dead_count: int
    death_rate: float
    type_breakdown: dict[str, int]
    recent_activity: list[RecentActivity]
