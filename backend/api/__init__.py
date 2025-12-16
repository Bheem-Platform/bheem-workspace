"""
Bheem Workspace API Routers
"""
from .meet import router as meet_router
from .docs import router as docs_router
from .mail import router as mail_router
from .recordings import router as recordings_router
from .tenants import router as tenants_router
from .workspace import router as workspace_router

__all__ = [
    "meet_router",
    "docs_router",
    "mail_router",
    "recordings_router",
    "tenants_router",
    "workspace_router"
]
