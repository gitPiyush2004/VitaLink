"""The compute service.

CPU-bound numerical work with a completely different dependency tree from the
Node API: numpy, scipy, networkx, and later OR-Tools and scikit-learn. Split out
for that reason, not because "microservices are good architecture" (ADR-0006).

Stateless by design. There is no database driver in `requirements.txt`, which is
what makes "the API is the single owner of state" structural rather than a
promise.
"""

from __future__ import annotations

from fastapi import FastAPI

from app.config import settings
from app.routers import health, reliability

app = FastAPI(
    title="Vitalink brain",
    version=settings.version,
    description=(
        "Reliability, optimisation and ML for Vitalink. Implements the "
        "series-parallel model of Tucker & Daskin (arXiv:2107.09167)."
    ),
)

app.include_router(health.router)
app.include_router(reliability.router)
