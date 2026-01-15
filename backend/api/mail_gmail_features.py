"""
Bheem Workspace - Gmail-like Features API
Categories, Snooze, Starred, Important
"""
from fastapi import APIRouter, HTTPException, Depends, Query, status
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user
from services.mail_category_service import mail_category_service
from services.mail_snooze_service import mail_snooze_service
from services.mail_importance_service import mail_importance_service
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/mail", tags=["Mail Gmail Features"])


# ================================================
# Schemas
# ================================================

class SetCategoryRequest(BaseModel):
    message_id: str
    category: str  # primary, social, updates, promotions, forums


class BulkCategorizeRequest(BaseModel):
    emails: List[Dict]  # List of email objects with id, from, subject, headers


class SnoozeRequest(BaseModel):
    message_id: str
    snooze_until: Optional[datetime] = None
    snooze_option: Optional[str] = None  # later_today, tomorrow, tomorrow_morning, next_week, next_weekend
    original_folder: str = "INBOX"
    subject: Optional[str] = None
    sender: Optional[str] = None
    snippet: Optional[str] = None


class UpdateSnoozeRequest(BaseModel):
    snooze_until: datetime


class StarRequest(BaseModel):
    message_id: str


class ImportantRequest(BaseModel):
    message_id: str
    reason: Optional[str] = None


class BulkFlagsRequest(BaseModel):
    message_ids: List[str]


class CategoryRuleRequest(BaseModel):
    name: str
    category: str
    conditions: Dict
    priority: int = 0


# ================================================
# Category Endpoints
# ================================================

@router.get("/categories")
async def get_category_counts(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get email counts per category."""
    user_id = current_user.get("id") or current_user.get("user_id")
    counts = await mail_category_service.get_category_counts(db, user_id)
    return {
        "counts": counts,
        "categories": ["primary", "social", "updates", "promotions", "forums"]
    }


@router.get("/categories/{category}")
async def get_emails_by_category(
    category: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get message IDs for a specific category."""
    if category not in ["primary", "social", "updates", "promotions", "forums"]:
        raise HTTPException(status_code=400, detail="Invalid category")

    user_id = current_user.get("id") or current_user.get("user_id")
    message_ids = await mail_category_service.get_emails_by_category(
        db, user_id, category, limit, offset
    )
    return {
        "category": category,
        "count": len(message_ids),
        "message_ids": message_ids
    }


@router.post("/categories/set")
async def set_email_category(
    request: SetCategoryRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Manually set category for an email."""
    if request.category not in ["primary", "social", "updates", "promotions", "forums"]:
        raise HTTPException(status_code=400, detail="Invalid category")

    user_id = current_user.get("id") or current_user.get("user_id")
    result = await mail_category_service.set_category(
        db, user_id, request.message_id, request.category,
        auto_categorized=False,
        categorized_by="user"
    )
    return {
        "success": True,
        "message_id": request.message_id,
        "category": request.category
    }


@router.post("/categories/bulk-categorize")
async def bulk_categorize_emails(
    request: BulkCategorizeRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Auto-categorize multiple emails."""
    user_id = current_user.get("id") or current_user.get("user_id")
    categorized = await mail_category_service.bulk_categorize(db, user_id, request.emails)
    return {
        "success": True,
        "categorized": categorized,
        "total": sum(len(ids) for ids in categorized.values())
    }


@router.get("/categories/message/{message_id}")
async def get_message_category(
    message_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get category for a specific message."""
    user_id = current_user.get("id") or current_user.get("user_id")
    category = await mail_category_service.get_category(db, user_id, message_id)
    return {"message_id": message_id, "category": category}


# ================================================
# Category Rules Endpoints
# ================================================

@router.get("/categories/rules")
async def get_category_rules(
    include_system: bool = Query(True),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get categorization rules."""
    user_id = current_user.get("id") or current_user.get("user_id")
    rules = await mail_category_service.get_user_rules(db, user_id, include_system)
    return {
        "rules": [
            {
                "id": str(r.id),
                "name": r.name,
                "category": r.category,
                "conditions": r.conditions,
                "priority": r.priority,
                "is_system": r.is_system,
                "is_enabled": r.is_enabled
            }
            for r in rules
        ]
    }


@router.post("/categories/rules")
async def create_category_rule(
    request: CategoryRuleRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new categorization rule."""
    user_id = current_user.get("id") or current_user.get("user_id")
    rule = await mail_category_service.create_rule(
        db, user_id, request.name, request.category, request.conditions, request.priority
    )
    return {
        "success": True,
        "rule": {
            "id": str(rule.id),
            "name": rule.name,
            "category": rule.category
        }
    }


@router.delete("/categories/rules/{rule_id}")
async def delete_category_rule(
    rule_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a categorization rule."""
    user_id = current_user.get("id") or current_user.get("user_id")
    success = await mail_category_service.delete_rule(db, rule_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Rule not found or cannot be deleted")
    return {"success": True}


# ================================================
# Snooze Endpoints
# ================================================

@router.get("/snoozed")
async def get_snoozed_emails(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all snoozed emails."""
    user_id = current_user.get("id") or current_user.get("user_id")
    snoozed = await mail_snooze_service.get_snoozed_emails(db, user_id, limit, offset)
    count = await mail_snooze_service.get_snooze_count(db, user_id)

    return {
        "count": count,
        "snoozed": [
            {
                "id": str(s.id),
                "message_id": s.message_id,
                "mail_uid": s.mail_uid,
                "mailbox": s.mailbox,
                "snooze_until": s.snooze_until.isoformat() if s.snooze_until else None,
                "original_folder": s.original_folder,
                "is_snoozed": not s.is_unsnoozed
            }
            for s in snoozed
        ]
    }


@router.post("/snooze")
async def snooze_email(
    request: SnoozeRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Snooze an email."""
    user_id = current_user.get("id") or current_user.get("user_id")

    email_metadata = {
        "subject": request.subject,
        "sender": request.sender,
        "snippet": request.snippet
    }

    if request.snooze_option:
        # Use predefined option
        snoozed = await mail_snooze_service.snooze_with_option(
            db, user_id, request.message_id, request.snooze_option,
            request.original_folder, email_metadata
        )
    elif request.snooze_until:
        # Use custom time
        snoozed = await mail_snooze_service.snooze_email(
            db, user_id, request.message_id, request.snooze_until,
            request.original_folder, email_metadata
        )
    else:
        raise HTTPException(
            status_code=400,
            detail="Either snooze_until or snooze_option is required"
        )

    return {
        "success": True,
        "message_id": request.message_id,
        "snooze_until": snoozed.snooze_until.isoformat() if snoozed else None
    }


@router.get("/snooze/options")
async def get_snooze_options():
    """Get available snooze options with calculated times."""
    options = {}
    for key, func in mail_snooze_service.SNOOZE_OPTIONS.items():
        options[key] = func().isoformat()

    return {
        "options": options,
        "labels": {
            "later_today": "Later Today (6 PM)",
            "tomorrow": "Tomorrow",
            "tomorrow_morning": "Tomorrow Morning (9 AM)",
            "next_week": "Next Week",
            "next_weekend": "Next Weekend"
        }
    }


@router.delete("/snooze/{message_id}")
async def unsnooze_email(
    message_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Unsnooze an email."""
    user_id = current_user.get("id") or current_user.get("user_id")
    snoozed = await mail_snooze_service.unsnooze_email(db, user_id, message_id)

    if not snoozed:
        raise HTTPException(status_code=404, detail="Snoozed email not found")

    return {
        "success": True,
        "message_id": message_id,
        "original_folder": snoozed.original_folder
    }


@router.put("/snooze/{message_id}")
async def update_snooze_time(
    message_id: str,
    request: UpdateSnoozeRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update snooze time for an email."""
    user_id = current_user.get("id") or current_user.get("user_id")
    snoozed = await mail_snooze_service.update_snooze_time(
        db, user_id, message_id, request.snooze_until
    )

    if not snoozed:
        raise HTTPException(status_code=404, detail="Snoozed email not found")

    return {
        "success": True,
        "message_id": message_id,
        "snooze_until": snoozed.snooze_until.isoformat()
    }


@router.get("/snooze/{message_id}")
async def get_snooze_info(
    message_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get snooze info for a specific email."""
    user_id = current_user.get("id") or current_user.get("user_id")
    info = await mail_snooze_service.get_snooze_info(db, user_id, message_id)

    if not info:
        return {"is_snoozed": False, "message_id": message_id}

    return {"is_snoozed": True, **info}


# ================================================
# Starred Endpoints
# ================================================

@router.get("/starred")
async def get_starred_emails(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all starred email message IDs."""
    user_id = current_user.get("id") or current_user.get("user_id")
    message_ids = await mail_importance_service.get_starred_emails(db, user_id, limit, offset)
    counts = await mail_importance_service.get_counts(db, user_id)

    return {
        "count": counts["starred"],
        "message_ids": message_ids
    }


@router.post("/star")
async def star_email(
    request: StarRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Star an email."""
    user_id = current_user.get("id") or current_user.get("user_id")
    await mail_importance_service.star_email(db, user_id, request.message_id)
    return {"success": True, "message_id": request.message_id, "is_starred": True}


@router.delete("/star/{message_id}")
async def unstar_email(
    message_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Unstar an email."""
    user_id = current_user.get("id") or current_user.get("user_id")
    await mail_importance_service.unstar_email(db, user_id, message_id)
    return {"success": True, "message_id": message_id, "is_starred": False}


@router.post("/star/{message_id}/toggle")
async def toggle_star(
    message_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Toggle star status."""
    user_id = current_user.get("id") or current_user.get("user_id")
    success, new_state = await mail_importance_service.toggle_star(db, user_id, message_id)
    return {"success": success, "message_id": message_id, "is_starred": new_state}


# ================================================
# Important Endpoints
# ================================================

@router.get("/important")
async def get_important_emails(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all important email message IDs."""
    user_id = current_user.get("id") or current_user.get("user_id")
    message_ids = await mail_importance_service.get_important_emails(db, user_id, limit, offset)
    counts = await mail_importance_service.get_counts(db, user_id)

    return {
        "count": counts["important"],
        "message_ids": message_ids
    }


@router.post("/important")
async def mark_important(
    request: ImportantRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark an email as important."""
    user_id = current_user.get("id") or current_user.get("user_id")
    await mail_importance_service.mark_important(
        db, user_id, request.message_id, auto=False, reason=request.reason
    )
    return {"success": True, "message_id": request.message_id, "is_important": True}


@router.delete("/important/{message_id}")
async def unmark_important(
    message_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove important flag from email."""
    user_id = current_user.get("id") or current_user.get("user_id")
    await mail_importance_service.unmark_important(db, user_id, message_id)
    return {"success": True, "message_id": message_id, "is_important": False}


# ================================================
# Combined Flags Endpoints
# ================================================

@router.get("/flags/{message_id}")
async def get_email_flags(
    message_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all flags (starred, important, snoozed, category) for an email."""
    user_id = current_user.get("id") or current_user.get("user_id")

    importance_flags = await mail_importance_service.get_email_flags(db, user_id, message_id)
    snooze_info = await mail_snooze_service.get_snooze_info(db, user_id, message_id)
    category = await mail_category_service.get_category(db, user_id, message_id)

    return {
        "message_id": message_id,
        **importance_flags,
        "is_snoozed": snooze_info is not None,
        "snooze_until": snooze_info.get("snooze_until") if snooze_info else None,
        "category": category
    }


@router.post("/flags/bulk")
async def get_bulk_flags(
    request: BulkFlagsRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get flags for multiple emails at once."""
    user_id = current_user.get("id") or current_user.get("user_id")
    flags = await mail_importance_service.bulk_get_flags(db, user_id, request.message_ids)
    return {"flags": flags}


@router.get("/counts")
async def get_all_counts(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get counts for all special views (starred, important, snoozed, categories)."""
    user_id = current_user.get("id") or current_user.get("user_id")

    importance_counts = await mail_importance_service.get_counts(db, user_id)
    snooze_count = await mail_snooze_service.get_snooze_count(db, user_id)
    category_counts = await mail_category_service.get_category_counts(db, user_id)

    return {
        "starred": importance_counts["starred"],
        "important": importance_counts["important"],
        "snoozed": snooze_count,
        "categories": category_counts
    }
