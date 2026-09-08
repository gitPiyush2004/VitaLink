"""Liveness. Touches nothing, because the brain depends on nothing.

There is deliberately no `/ready` here. Readiness means "can this instance serve
traffic", and for a stateless service with no dependencies the answer is the same
as liveness. Adding a second endpoint that returns the same thing would be
theatre.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.config import settings
from app.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Reports that the process is alive."""
    return HealthResponse(status="ok", service="brain", version=settings.version)
