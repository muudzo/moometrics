"""
Dashboard router: aggregated statistics for the caller's farm.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.db_models import Animal, DeathRecord, User
from app.models.schemas import DashboardStats, RecentActivity
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return aggregated animal statistics for the caller's farm."""
    farm_id = current_user.farm_id

    # Aggregate counts by type/status in the database (no per-row Python loop).
    rows = (
        db.query(Animal.animal_type, Animal.status, func.count(Animal.id))
        .filter(Animal.farm_id == farm_id)
        .group_by(Animal.animal_type, Animal.status)
        .all()
    )
    type_breakdown: dict[str, int] = {}
    total = alive = 0
    for animal_type, status_value, count in rows:
        type_breakdown[animal_type] = type_breakdown.get(animal_type, 0) + count
        total += count
        if status_value == "alive":
            alive += count
    dead = total - alive
    death_rate = round((dead / total * 100), 1) if total > 0 else 0.0

    activity: list[RecentActivity] = []

    recent_animals = (
        db.query(Animal)
        .filter(Animal.farm_id == farm_id)
        .order_by(Animal.created_at.desc())
        .limit(5)
        .all()
    )
    for a in recent_animals:
        activity.append(
            RecentActivity(
                type="animal_added",
                description=f"{a.name} ({a.animal_type}) added",
                timestamp=a.created_at,
            )
        )

    recent_deaths = (
        db.query(DeathRecord)
        .filter(DeathRecord.farm_id == farm_id)
        .options(joinedload(DeathRecord.animal))
        .order_by(DeathRecord.created_at.desc())
        .limit(5)
        .all()
    )
    for d in recent_deaths:
        name = d.animal.name if d.animal else f"Animal #{d.animal_id}"
        activity.append(
            RecentActivity(
                type="death_reported",
                description=f"Death reported for {name}: {d.cause_of_death}",
                timestamp=d.created_at,
            )
        )

    activity.sort(key=lambda x: x.timestamp, reverse=True)
    activity = activity[:5]

    return DashboardStats(
        total_animals=total,
        alive_count=alive,
        dead_count=dead,
        death_rate=death_rate,
        type_breakdown=type_breakdown,
        recent_activity=activity,
    )
