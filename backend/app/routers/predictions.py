"""
AI Predictions API router.
"""

from fastapi import APIRouter, HTTPException
from app.services.ai_service import get_planting_prediction
from app.models.schemas import PredictionRequest, PredictionResponse

router = APIRouter(prefix="/api/predictions", tags=["predictions"])


@router.post("/planting", response_model=PredictionResponse)
async def predict_planting(request: PredictionRequest):
    """
    Get AI-powered planting and harvest predictions.

    Args:
        request: Prediction request with crop type, location, and soil information

    Returns:
        Planting and harvest recommendations with confidence score
    """
    try:
        prediction = await get_planting_prediction(request)
        return prediction
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate prediction: {str(e)}"
        )
