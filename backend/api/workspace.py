"""
Bheem Workspace Dashboard API
"""
from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

router = APIRouter()

class DashboardStats(BaseModel):
    tenant_id: str
    tenant_name: str
    plan: str
    meetings_today: int
    meetings_this_week: int
    total_meetings: int
    active_meetings: int
    total_documents: int
    storage_used_mb: float
    storage_limit_mb: float
    mailboxes_count: int
    total_users: int

@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard(tenant_id: str = Query(...)):
    """Get dashboard stats"""
    return DashboardStats(
        tenant_id=tenant_id,
        tenant_name="Demo Workspace",
        plan="professional",
        meetings_today=3,
        meetings_this_week=12,
        total_meetings=156,
        active_meetings=1,
        total_documents=234,
        storage_used_mb=2560,
        storage_limit_mb=10240,
        mailboxes_count=8,
        total_users=12
    )

@router.get("/activity")
async def get_activity(tenant_id: str = Query(...), limit: int = Query(20)):
    """Get recent activity"""
    return [
        {"id": "1", "type": "meeting", "action": "created", "title": "Team Standup", "user_name": "Admin", "timestamp": datetime.utcnow().isoformat()},
        {"id": "2", "type": "document", "action": "edited", "title": "Proposal.docx", "user_name": "Admin", "timestamp": datetime.utcnow().isoformat()}
    ]

@router.get("/quick-actions")
async def get_quick_actions(tenant_id: str = Query(...)):
    """Get quick actions"""
    return [
        {"id": "new_meeting", "label": "Start Meeting", "icon": "video", "action": "/meet/new"},
        {"id": "upload", "label": "Upload Document", "icon": "upload", "action": "/docs/upload"},
        {"id": "schedule", "label": "Schedule Meeting", "icon": "calendar", "action": "/meet/schedule"}
    ]

@router.get("/search")
async def search(tenant_id: str = Query(...), query: str = Query(...)):
    """Search workspace"""
    return {"query": query, "results": {"meetings": [], "documents": [], "recordings": []}, "total": 0}
