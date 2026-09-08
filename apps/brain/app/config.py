"""Settings for the compute service.

Deliberately tiny. The brain is stateless (ADR-0006), so it has no database URL,
no cache URL and no credentials for anything. The one secret it holds is the
shared secret the API authenticates with, and note what is absent: `MONGO_URI`.
That absence is the design.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

#: Shortest shared secret that is worth calling a secret.
MIN_SHARED_SECRET_LENGTH = 16


@dataclass(frozen=True)
class Settings:
    """Immutable, read once at import. Same fail-fast intent as the API's env.ts."""

    version: str
    shared_secret: str
    #: Off in development so the probe scripts and docs UI work without a header.
    require_shared_secret: bool


def _load() -> Settings:
    secret = os.environ.get("BRAIN_SHARED_SECRET", "")
    environment = os.environ.get("NODE_ENV", "development")

    # In production a missing shared secret would leave the compute service open
    # to anything that can reach it, so it refuses to start rather than warn.
    if environment == "production" and len(secret) < MIN_SHARED_SECRET_LENGTH:
        raise RuntimeError(
            "BRAIN_SHARED_SECRET must be at least "
            f"{MIN_SHARED_SECRET_LENGTH} characters when NODE_ENV=production"
        )

    return Settings(
        version="0.1.0",
        shared_secret=secret,
        require_shared_secret=environment == "production",
    )


settings = _load()
