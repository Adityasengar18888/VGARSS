"""API Package Export."""
from backend.app.api.auth import router as auth_router
from backend.app.api.groups import router as groups_router
from backend.app.api.simulations import router as simulations_router
from backend.app.api.resources import router as resources_router

__all__ = [
    "auth_router",
    "groups_router",
    "simulations_router",
    "resources_router",
]
