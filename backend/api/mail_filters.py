"""
Bheem Workspace - Email Filters API
Create and manage email filter rules
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from uuid import UUID
from core.security import get_current_user
from core.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from services.mail_filters_service import (
    mail_filters_service,
    CONDITION_FIELDS,
    CONDITION_OPERATORS,
    FILTER_ACTIONS
)

# Rate limiting
try:
    from middleware.rate_limit import limiter
except ImportError:
    class DummyLimiter:
        def limit(self, limit_string):
            def decorator(func):
                return func
            return decorator
    limiter = DummyLimiter()

router = APIRouter(prefix="/mail/filters", tags=["Mail Filters"])


# ===========================================
# Schemas
# ===========================================

class FilterCondition(BaseModel):
    field: str  # from, to, cc, subject, body, has_attachment
    operator: str  # contains, not_contains, equals, not_equals, starts_with, ends_with, matches_regex
    value: str


class FilterAction(BaseModel):
    action: str  # move_to, mark_as_read, mark_as_starred, apply_label, delete, forward_to, skip_inbox, never_spam
    value: Optional[str] = None


class CreateFilterRequest(BaseModel):
    name: str
    conditions: List[FilterCondition]
    actions: List[FilterAction]
    is_enabled: Optional[bool] = True
    priority: Optional[int] = 0
    stop_processing: Optional[bool] = False


class UpdateFilterRequest(BaseModel):
    name: Optional[str] = None
    conditions: Optional[List[FilterCondition]] = None
    actions: Optional[List[FilterAction]] = None
    is_enabled: Optional[bool] = None
    priority: Optional[int] = None
    stop_processing: Optional[bool] = None


class FilterResponse(BaseModel):
    id: str
    name: str
    is_enabled: bool
    priority: int
    stop_processing: bool
    conditions: List[Dict[str, Any]]
    actions: List[Dict[str, Any]]
    created_at: Optional[str]
    updated_at: Optional[str]


class FilterListResponse(BaseModel):
    filters: List[FilterResponse]
    count: int


class FilterOptionsResponse(BaseModel):
    condition_fields: List[str]
    condition_operators: List[str]
    filter_actions: List[str]


class ReorderFiltersRequest(BaseModel):
    filter_order: List[str]  # List of filter IDs in desired order


class TestFilterRequest(BaseModel):
    conditions: List[FilterCondition]
    email: Dict[str, Any]  # Email to test against


# ===========================================
# Filter Endpoints
# ===========================================

@router.get("/options", response_model=FilterOptionsResponse)
async def get_filter_options(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Get available filter options.

    Returns lists of valid condition fields, operators, and actions.
    """
    return FilterOptionsResponse(
        condition_fields=CONDITION_FIELDS,
        condition_operators=CONDITION_OPERATORS,
        filter_actions=FILTER_ACTIONS
    )


@router.post("", response_model=FilterResponse)
@limiter.limit("20/minute")
async def create_filter(
    request_obj: Request,
    request: CreateFilterRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new email filter.

    Filters are evaluated in priority order (lower number = higher priority).
    If 'stop_processing' is true, no further filters are evaluated after a match.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    try:
        mail_filter = await mail_filters_service.create_filter(
            db=db,
            user_id=UUID(user_id),
            name=request.name,
            conditions=[c.model_dump() for c in request.conditions],
            actions=[a.model_dump() for a in request.actions],
            is_enabled=request.is_enabled,
            priority=request.priority,
            stop_processing=request.stop_processing
        )

        return FilterResponse(**mail_filters_service.filter_to_dict(mail_filter))

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("", response_model=FilterListResponse)
@limiter.limit("30/minute")
async def list_filters(
    request: Request,
    enabled_only: bool = False,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all email filters for the current user.

    Filters are returned in priority order.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    filters = await mail_filters_service.list_filters(
        db=db,
        user_id=UUID(user_id),
        enabled_only=enabled_only
    )

    return FilterListResponse(
        filters=[FilterResponse(**mail_filters_service.filter_to_dict(f)) for f in filters],
        count=len(filters)
    )


@router.get("/{filter_id}", response_model=FilterResponse)
@limiter.limit("30/minute")
async def get_filter(
    request: Request,
    filter_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a single filter by ID."""
    user_id = current_user.get("id") or current_user.get("user_id")

    mail_filter = await mail_filters_service.get_filter(
        db=db,
        filter_id=filter_id,
        user_id=UUID(user_id)
    )

    if not mail_filter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Filter not found"
        )

    return FilterResponse(**mail_filters_service.filter_to_dict(mail_filter))


@router.put("/{filter_id}", response_model=FilterResponse)
@limiter.limit("20/minute")
async def update_filter(
    request_obj: Request,
    filter_id: UUID,
    request: UpdateFilterRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update an existing filter."""
    user_id = current_user.get("id") or current_user.get("user_id")

    # Build updates dict
    updates = {}
    if request.name is not None:
        updates['name'] = request.name
    if request.conditions is not None:
        updates['conditions'] = [c.model_dump() for c in request.conditions]
    if request.actions is not None:
        updates['actions'] = [a.model_dump() for a in request.actions]
    if request.is_enabled is not None:
        updates['is_enabled'] = request.is_enabled
    if request.priority is not None:
        updates['priority'] = request.priority
    if request.stop_processing is not None:
        updates['stop_processing'] = request.stop_processing

    try:
        mail_filter = await mail_filters_service.update_filter(
            db=db,
            filter_id=filter_id,
            user_id=UUID(user_id),
            updates=updates
        )

        if not mail_filter:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Filter not found"
            )

        return FilterResponse(**mail_filters_service.filter_to_dict(mail_filter))

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{filter_id}")
@limiter.limit("20/minute")
async def delete_filter(
    request: Request,
    filter_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a filter."""
    user_id = current_user.get("id") or current_user.get("user_id")

    success = await mail_filters_service.delete_filter(
        db=db,
        filter_id=filter_id,
        user_id=UUID(user_id)
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Filter not found"
        )

    return {"success": True, "message": "Filter deleted"}


@router.post("/{filter_id}/toggle")
@limiter.limit("30/minute")
async def toggle_filter(
    request: Request,
    filter_id: UUID,
    enabled: bool,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Enable or disable a filter."""
    user_id = current_user.get("id") or current_user.get("user_id")

    mail_filter = await mail_filters_service.toggle_filter(
        db=db,
        filter_id=filter_id,
        user_id=UUID(user_id),
        enabled=enabled
    )

    if not mail_filter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Filter not found"
        )

    return {
        "success": True,
        "is_enabled": mail_filter.is_enabled
    }


@router.post("/reorder", response_model=FilterListResponse)
@limiter.limit("10/minute")
async def reorder_filters(
    request_obj: Request,
    request: ReorderFiltersRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Reorder filters by specifying the new order.

    Pass a list of filter IDs in the desired order.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    filters = await mail_filters_service.reorder_filters(
        db=db,
        user_id=UUID(user_id),
        filter_order=request.filter_order
    )

    return FilterListResponse(
        filters=[FilterResponse(**mail_filters_service.filter_to_dict(f)) for f in filters],
        count=len(filters)
    )


@router.post("/test")
@limiter.limit("20/minute")
async def test_filter(
    request_obj: Request,
    request: TestFilterRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Test filter conditions against a sample email.

    Returns whether the conditions match the email.
    """
    # Build a dummy filter to test
    conditions = [c.model_dump() for c in request.conditions]

    try:
        mail_filters_service._validate_conditions(conditions)

        # Test the conditions
        matches = mail_filters_service._check_conditions(request.email, conditions)

        return {
            "matches": matches,
            "conditions_tested": len(conditions),
            "email_fields_checked": list(request.email.keys())
        }

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
