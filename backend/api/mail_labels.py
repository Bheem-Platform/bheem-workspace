"""
Bheem Workspace - Mail Labels API
Manage custom email labels/tags
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from core.security import get_current_user
from core.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from services.mail_labels_service import mail_labels_service

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

router = APIRouter(prefix="/mail/labels", tags=["Mail Labels"])


# ===========================================
# Schemas
# ===========================================

class CreateLabelRequest(BaseModel):
    name: str
    color: Optional[str] = None  # Hex color, e.g. #4A90D9
    description: Optional[str] = None


class UpdateLabelRequest(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    description: Optional[str] = None
    is_visible: Optional[bool] = None
    show_in_list: Optional[bool] = None


class LabelResponse(BaseModel):
    id: str
    name: str
    color: str
    description: Optional[str]
    is_visible: bool
    show_in_list: bool
    message_count: int
    created_at: Optional[str]
    updated_at: Optional[str]


class LabelListResponse(BaseModel):
    labels: List[LabelResponse]
    count: int


class AssignLabelRequest(BaseModel):
    message_ids: List[str]


class BulkAssignResponse(BaseModel):
    success: bool
    assigned_count: int


# ===========================================
# Label CRUD Endpoints
# ===========================================

@router.post("", response_model=LabelResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
async def create_label(
    request_obj: Request,
    request: CreateLabelRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new label."""
    user_id = current_user.get("id") or current_user.get("user_id")

    try:
        label = await mail_labels_service.create_label(
            db=db,
            user_id=UUID(user_id),
            name=request.name,
            color=request.color,
            description=request.description
        )

        return LabelResponse(**mail_labels_service.label_to_dict(label))

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("", response_model=LabelListResponse)
@limiter.limit("30/minute")
async def list_labels(
    request: Request,
    visible_only: bool = False,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all labels."""
    user_id = current_user.get("id") or current_user.get("user_id")

    labels = await mail_labels_service.list_labels(
        db=db,
        user_id=UUID(user_id),
        visible_only=visible_only
    )

    # Get message counts for each label
    label_responses = []
    for label in labels:
        count = await mail_labels_service.get_label_message_count(
            db=db,
            user_id=UUID(user_id),
            label_id=label.id
        )
        label_responses.append(
            LabelResponse(**mail_labels_service.label_to_dict(label, count))
        )

    return LabelListResponse(
        labels=label_responses,
        count=len(labels)
    )


@router.get("/{label_id}", response_model=LabelResponse)
@limiter.limit("30/minute")
async def get_label(
    request: Request,
    label_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a single label."""
    user_id = current_user.get("id") or current_user.get("user_id")

    label = await mail_labels_service.get_label(
        db=db,
        label_id=label_id,
        user_id=UUID(user_id)
    )

    if not label:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Label not found"
        )

    count = await mail_labels_service.get_label_message_count(
        db=db,
        user_id=UUID(user_id),
        label_id=label_id
    )

    return LabelResponse(**mail_labels_service.label_to_dict(label, count))


@router.put("/{label_id}", response_model=LabelResponse)
@limiter.limit("20/minute")
async def update_label(
    request_obj: Request,
    label_id: UUID,
    request: UpdateLabelRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a label."""
    user_id = current_user.get("id") or current_user.get("user_id")

    updates = {}
    if request.name is not None:
        updates['name'] = request.name
    if request.color is not None:
        updates['color'] = request.color
    if request.description is not None:
        updates['description'] = request.description
    if request.is_visible is not None:
        updates['is_visible'] = request.is_visible
    if request.show_in_list is not None:
        updates['show_in_list'] = request.show_in_list

    try:
        label = await mail_labels_service.update_label(
            db=db,
            label_id=label_id,
            user_id=UUID(user_id),
            updates=updates
        )

        if not label:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Label not found"
            )

        count = await mail_labels_service.get_label_message_count(
            db=db,
            user_id=UUID(user_id),
            label_id=label_id
        )

        return LabelResponse(**mail_labels_service.label_to_dict(label, count))

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{label_id}")
@limiter.limit("20/minute")
async def delete_label(
    request: Request,
    label_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a label."""
    user_id = current_user.get("id") or current_user.get("user_id")

    success = await mail_labels_service.delete_label(
        db=db,
        label_id=label_id,
        user_id=UUID(user_id)
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Label not found"
        )

    return {"success": True, "message": "Label deleted"}


# ===========================================
# Label Assignment Endpoints
# ===========================================

@router.post("/{label_id}/assign", response_model=BulkAssignResponse)
@limiter.limit("30/minute")
async def assign_label_to_messages(
    request_obj: Request,
    label_id: UUID,
    request: AssignLabelRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Assign a label to one or more emails."""
    user_id = current_user.get("id") or current_user.get("user_id")

    try:
        count = await mail_labels_service.bulk_assign_label(
            db=db,
            user_id=UUID(user_id),
            label_id=label_id,
            message_ids=request.message_ids
        )

        return BulkAssignResponse(success=True, assigned_count=count)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{label_id}/remove", response_model=BulkAssignResponse)
@limiter.limit("30/minute")
async def remove_label_from_messages(
    request_obj: Request,
    label_id: UUID,
    request: AssignLabelRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove a label from one or more emails."""
    user_id = current_user.get("id") or current_user.get("user_id")

    count = await mail_labels_service.bulk_remove_label(
        db=db,
        user_id=UUID(user_id),
        label_id=label_id,
        message_ids=request.message_ids
    )

    return BulkAssignResponse(success=True, assigned_count=count)


@router.get("/{label_id}/messages")
@limiter.limit("30/minute")
async def get_label_messages(
    request: Request,
    label_id: UUID,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get message IDs that have a specific label."""
    user_id = current_user.get("id") or current_user.get("user_id")
    offset = (page - 1) * limit

    message_ids = await mail_labels_service.get_messages_by_label(
        db=db,
        user_id=UUID(user_id),
        label_id=label_id,
        limit=limit,
        offset=offset
    )

    total = await mail_labels_service.get_label_message_count(
        db=db,
        user_id=UUID(user_id),
        label_id=label_id
    )

    return {
        "message_ids": message_ids,
        "total": total,
        "page": page,
        "limit": limit
    }


@router.get("/message/{message_id}")
@limiter.limit("30/minute")
async def get_message_labels(
    request: Request,
    message_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all labels for a specific email."""
    user_id = current_user.get("id") or current_user.get("user_id")

    labels = await mail_labels_service.get_message_labels(
        db=db,
        user_id=UUID(user_id),
        message_id=message_id
    )

    return {
        "message_id": message_id,
        "labels": [mail_labels_service.label_to_dict(l) for l in labels]
    }
