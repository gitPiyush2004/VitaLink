"""HTTP surface for QUANTIFY. Routing and validation only, no logic.

Same layering rule as the Node API (PART 3A.8): a router parses, calls a service,
and returns. Anything that decides belongs in `services/`, and anything that
computes belongs in `domain/`.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.config import settings
from app.schemas import RateFitRequest, ReliabilityResponse
from app.services.reliability_service import ReliabilityService

router = APIRouter(prefix="/reliability", tags=["reliability"])


def verify_shared_secret(x_vitalink_secret: str | None = Header(default=None)) -> None:
    """Rejects a caller that is not the API.

    The brain holds no user data and makes no outbound calls, so this is not a
    substitute for the API's auth — it is a boundary so the compute service is not
    an open CPU-burning endpoint on the internal network.
    """
    if not settings.require_shared_secret:
        return
    if x_vitalink_secret != settings.shared_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="missing or invalid X-Vitalink-Secret header",
        )


def get_service() -> ReliabilityService:
    """FastAPI dependency, so a test can override it with a stub."""
    return ReliabilityService()


@router.post(
    "/fit",
    response_model=ReliabilityResponse,
    response_model_exclude_unset=True,
    dependencies=[Depends(verify_shared_secret)],
)
def fit_and_compute(
    request: RateFitRequest,
    fetched_at: str = Header(alias="X-Vitalink-Fetched-At"),
    service: ReliabilityService = Depends(get_service),
) -> ReliabilityResponse:
    """Fits lambda and mu from observed history, then runs the model.

    `X-Vitalink-Fetched-At` is required rather than defaulted to now(), because a
    reliability record must be reproducible from its stored inputs — and a
    timestamp read from this service's clock would not be one of them.
    """
    return service.fit_and_compute(request, fetched_at)
