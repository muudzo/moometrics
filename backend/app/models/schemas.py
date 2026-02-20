"""Pydantic models for API request/response validation."""

from datetime import datetime, date
from typing import Optional, Literal
from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    username: str
    password: str


class SignupRequest(BaseModel):
    """Public self-registration — always creates an employee account."""
    username: str
    password: str


class UserCreate(BaseModel):
    username: str
    password: str
    role: Literal["manager", "employee"]


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
    name: str
    animal_type: Literal["cattle", "sheep", "goat", "pig", "horse", "chicken", "other"]
    tag_number: Optional[str] = None
    breed: Optional[str] = None
    date_of_birth: Optional[date] = None
    notes: Optional[str] = None


class AnimalUpdate(BaseModel):
    name: Optional[str] = None
    animal_type: Optional[Literal["cattle", "sheep", "goat", "pig", "horse", "chicken", "other"]] = None
    tag_number: Optional[str] = None
    breed: Optional[str] = None
    date_of_birth: Optional[date] = None
    status: Optional[Literal["alive", "dead"]] = None
    notes: Optional[str] = None


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
