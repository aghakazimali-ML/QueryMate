"""Vercel entrypoint: exposes the FastAPI app as a single Python function."""

from api.main import app

__all__ = ["app"]
