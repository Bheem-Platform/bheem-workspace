"""
Bheem Workspace Tenants API
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid
import secrets

router = APIRouter()

# In-memory storage
tenants = {}

PLANS = {
    "starter": {"max_users": 10, "max_storage_gb": 10, "price_monthly": 0, "features": ["meet", "docs"]},
    "professional": {"max_users": 50, "max_storage_gb": 100, "price_monthly": 49, "features": ["meet", "docs", "mail", "recording"]},
    "enterprise": {"max_users": 500, "max_storage_gb": 1000, "price_monthly": 199, "features": ["meet", "docs", "mail", "recording", "custom_domain", "sso", "api"]}
}

class TenantCreate(BaseModel):
    name: str
    slug: str
    owner_email: str
    owner_name: str
    plan: str = "starter"

class TenantResponse(BaseModel):
    id: str
    name: str
    slug: str
    owner_email: str
    plan: str
    max_users: int
    is_active: bool
    created_at: datetime
    workspace_url: str
    meet_url: str
    docs_url: str

@router.post("/", response_model=TenantResponse)
async def create_tenant(request: TenantCreate):
    """Create a new tenant"""
    if request.plan not in PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan")
    
    tenant_id = str(uuid.uuid4())
    plan_config = PLANS[request.plan]
    
    tenant = {
        "id": tenant_id,
        "name": request.name,
        "slug": request.slug,
        "owner_email": request.owner_email,
        "plan": request.plan,
        "max_users": plan_config["max_users"],
        "is_active": True,
        "created_at": datetime.utcnow(),
        "api_key": f"bw_{secrets.token_urlsafe(32)}"
    }
    tenants[tenant_id] = tenant
    
    return TenantResponse(
        id=tenant_id,
        name=request.name,
        slug=request.slug,
        owner_email=request.owner_email,
        plan=request.plan,
        max_users=plan_config["max_users"],
        is_active=True,
        created_at=tenant["created_at"],
        workspace_url=f"https://{request.slug}.workspace.bheem.cloud",
        meet_url=f"https://meet.bheem.cloud/{request.slug}",
        docs_url=f"https://docs.bheem.cloud/{request.slug}"
    )

@router.get("/")
async def list_tenants():
    """List all tenants"""
    return list(tenants.values())

@router.get("/{tenant_id}")
async def get_tenant(tenant_id: str):
    """Get tenant details"""
    if tenant_id not in tenants:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenants[tenant_id]

@router.get("/plans")
async def list_plans():
    """List available plans"""
    return PLANS
