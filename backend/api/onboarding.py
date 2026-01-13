"""
Bheem Workspace - Onboarding API
Guides new workspace admins through setup.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from core.security import get_current_user, require_tenant_member
from models.admin_models import OnboardingProgress, Tenant, TenantUser, Domain
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/onboarding", tags=["Onboarding"])


# Onboarding step definitions
ONBOARDING_STEPS = [
    {
        "id": "welcome",
        "title": "Welcome",
        "description": "Welcome to Bheem Workspace",
        "required": True,
        "order": 1
    },
    {
        "id": "profile",
        "title": "Complete Your Profile",
        "description": "Add your name, photo, and company details",
        "required": True,
        "order": 2
    },
    {
        "id": "domain",
        "title": "Add Custom Domain",
        "description": "Set up your custom email domain",
        "required": False,
        "order": 3
    },
    {
        "id": "invite",
        "title": "Invite Team Members",
        "description": "Add your team to the workspace",
        "required": False,
        "order": 4
    },
    {
        "id": "tour",
        "title": "Quick Tour",
        "description": "Learn about workspace features",
        "required": False,
        "order": 5
    }
]


# Schemas
class OnboardingProgressResponse(BaseModel):
    """Onboarding progress response."""
    current_step: str
    steps: List[dict]
    completed: dict
    is_complete: bool
    percent_complete: int


class StepCompleteRequest(BaseModel):
    """Request to mark a step complete."""
    data: Optional[dict] = None


# Endpoints
@router.get("/progress", response_model=OnboardingProgressResponse)
async def get_onboarding_progress(
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
):
    """
    Get onboarding progress for current tenant.
    Returns current step, completion status, and available steps.
    """
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not associated with a workspace"
        )

    # Get or create onboarding progress
    result = await db.execute(
        select(OnboardingProgress).where(OnboardingProgress.tenant_id == tenant_id)
    )
    progress = result.scalar_one_or_none()

    if not progress:
        # Create new onboarding progress
        progress = OnboardingProgress(tenant_id=tenant_id)
        db.add(progress)
        await db.commit()
        await db.refresh(progress)

    # Calculate completion
    completed = {
        "welcome": True,  # Auto-complete welcome
        "profile": progress.profile_completed,
        "domain": progress.domain_setup_completed,
        "invite": progress.team_invited,
        "tour": progress.completed_at is not None
    }

    # Calculate percent
    total_steps = len(ONBOARDING_STEPS)
    completed_count = sum(1 for v in completed.values() if v)
    percent = int((completed_count / total_steps) * 100)

    return OnboardingProgressResponse(
        current_step=progress.current_step,
        steps=ONBOARDING_STEPS,
        completed=completed,
        is_complete=progress.completed_at is not None,
        percent_complete=percent
    )


@router.post("/complete-step/{step_id}")
async def complete_step(
    step_id: str,
    request: Optional[StepCompleteRequest] = None,
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
):
    """
    Mark an onboarding step as complete.
    Optionally saves step-specific data.
    """
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not associated with a workspace"
        )

    # Valid steps
    valid_steps = [s["id"] for s in ONBOARDING_STEPS]
    if step_id not in valid_steps:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid step: {step_id}"
        )

    # Get progress
    result = await db.execute(
        select(OnboardingProgress).where(OnboardingProgress.tenant_id == tenant_id)
    )
    progress = result.scalar_one_or_none()

    if not progress:
        progress = OnboardingProgress(tenant_id=tenant_id)
        db.add(progress)

    # Update based on step
    if step_id == "profile":
        progress.profile_completed = True
        progress.current_step = "domain"
    elif step_id == "domain":
        progress.domain_setup_completed = True
        progress.current_step = "invite"
    elif step_id == "invite":
        progress.team_invited = True
        progress.current_step = "tour"
    elif step_id == "tour":
        progress.current_step = "complete"
        progress.completed_at = datetime.utcnow()

    progress.updated_at = datetime.utcnow()
    await db.commit()

    # Determine next step
    next_step = None
    current_order = next((s["order"] for s in ONBOARDING_STEPS if s["id"] == step_id), 0)
    for step in ONBOARDING_STEPS:
        if step["order"] > current_order:
            next_step = step["id"]
            break

    return {
        "success": True,
        "step_completed": step_id,
        "next_step": next_step,
        "is_complete": progress.completed_at is not None
    }


@router.post("/skip/{step_id}")
async def skip_step(
    step_id: str,
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
):
    """
    Skip an onboarding step.
    Only non-required steps can be skipped.
    """
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not associated with a workspace"
        )

    # Check if step can be skipped
    step_info = next((s for s in ONBOARDING_STEPS if s["id"] == step_id), None)
    if not step_info:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid step: {step_id}"
        )

    if step_info.get("required"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Step {step_id} is required and cannot be skipped"
        )

    # Get progress
    result = await db.execute(
        select(OnboardingProgress).where(OnboardingProgress.tenant_id == tenant_id)
    )
    progress = result.scalar_one_or_none()

    if not progress:
        progress = OnboardingProgress(tenant_id=tenant_id)
        db.add(progress)

    # Add to skipped steps
    skipped = progress.skipped_steps or []
    if step_id not in skipped:
        skipped.append(step_id)
        progress.skipped_steps = skipped

    # Move to next step
    current_order = step_info["order"]
    for step in ONBOARDING_STEPS:
        if step["order"] > current_order:
            progress.current_step = step["id"]
            break
    else:
        progress.current_step = "complete"
        progress.completed_at = datetime.utcnow()

    progress.updated_at = datetime.utcnow()
    await db.commit()

    return {
        "success": True,
        "step_skipped": step_id,
        "current_step": progress.current_step,
        "is_complete": progress.completed_at is not None
    }


@router.post("/skip-all")
async def skip_all_onboarding(
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
):
    """
    Skip all remaining onboarding steps.
    Marks onboarding as complete.
    """
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not associated with a workspace"
        )

    # Get progress
    result = await db.execute(
        select(OnboardingProgress).where(OnboardingProgress.tenant_id == tenant_id)
    )
    progress = result.scalar_one_or_none()

    if not progress:
        progress = OnboardingProgress(tenant_id=tenant_id)
        db.add(progress)

    # Skip all non-required steps
    skipped = progress.skipped_steps or []
    for step in ONBOARDING_STEPS:
        if not step.get("required") and step["id"] not in skipped:
            skipped.append(step["id"])

    progress.skipped_steps = skipped
    progress.current_step = "complete"
    progress.completed_at = datetime.utcnow()
    progress.updated_at = datetime.utcnow()

    await db.commit()

    return {
        "success": True,
        "message": "Onboarding completed (remaining steps skipped)",
        "skipped_steps": skipped
    }


@router.get("/checklist")
async def get_setup_checklist(
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a detailed setup checklist with actual completion status.
    Checks database for real progress.
    """
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not associated with a workspace"
        )

    # Check actual completion status
    checklist = []

    # 1. Profile completed (check tenant has name, logo, etc.)
    tenant_result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = tenant_result.scalar_one_or_none()

    checklist.append({
        "id": "workspace_created",
        "title": "Create Workspace",
        "completed": tenant is not None,
        "required": True
    })

    # 2. Check if domain is set up
    domain_result = await db.execute(
        select(Domain).where(Domain.tenant_id == tenant_id, Domain.is_active == True)
    )
    domains = domain_result.scalars().all()

    checklist.append({
        "id": "domain_setup",
        "title": "Set Up Email Domain",
        "completed": len(domains) > 0,
        "required": False,
        "count": len(domains)
    })

    # 3. Check if team members invited
    users_result = await db.execute(
        select(TenantUser).where(TenantUser.tenant_id == tenant_id)
    )
    users = users_result.scalars().all()

    checklist.append({
        "id": "team_invited",
        "title": "Invite Team Members",
        "completed": len(users) > 1,  # More than just the owner
        "required": False,
        "count": len(users)
    })

    # 4. Check subscription (for paid features)
    checklist.append({
        "id": "subscription_active",
        "title": "Activate Subscription",
        "completed": tenant and tenant.subscription_status == "active",
        "required": False,
        "plan": tenant.plan if tenant else None
    })

    # Calculate overall progress
    total = len(checklist)
    completed = sum(1 for item in checklist if item["completed"])

    return {
        "checklist": checklist,
        "total_items": total,
        "completed_items": completed,
        "percent_complete": int((completed / total) * 100) if total > 0 else 0
    }
