"""
Dashboard router: aggregated farm statistics.
"""

from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.db_models import Animal, DeathRecord, User
from app.models.schemas import DashboardStats, RecentActivity
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
def get_stats(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Return aggregated animal statistics for the dashboard."""
    animals = db.query(Animal).all()

    total = len(animals)
    alive = sum(1 for a in animals if a.status == "alive")
    dead = total - alive
    death_rate = round((dead / total * 100), 1) if total > 0 else 0.0

    type_breakdown: dict[str, int] = {}
    for animal in animals:
        type_breakdown[animal.animal_type] = type_breakdown.get(animal.animal_type, 0) + 1

    # Build recent activity from last 5 animals added + last 5 death records
    activity: list[RecentActivity] = []

    recent_animals = (
        db.query(Animal).order_by(Animal.created_at.desc()).limit(5).all()
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
        db.query(DeathRecord).order_by(DeathRecord.created_at.desc()).limit(5).all()
    )
    for d in recent_deaths:
        animal = db.query(Animal).filter(Animal.id == d.animal_id).first()
        name = animal.name if animal else f"Animal #{d.animal_id}"
        activity.append(
            RecentActivity(
                type="death_reported",
                description=f"Death reported for {name}: {d.cause_of_death}",
                timestamp=d.created_at,
            )
        )

    # Sort combined activity by timestamp descending, take top 5
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
