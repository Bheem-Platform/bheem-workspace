"""
Bheem Notes API

REST API endpoints for managing notes, labels, and reminders.
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user
from services.notes_service import NotesService
from models.notes_models import NoteColor

router = APIRouter(prefix="/notes", tags=["Notes"])


# ===========================================
# Request/Response Models
# ===========================================

class ChecklistItem(BaseModel):
    """Checklist item model."""
    id: str
    text: str
    is_checked: bool = False
    order: int = 0


class CreateNoteRequest(BaseModel):
    """Request to create a new note."""
    title: Optional[str] = None
    content: Optional[str] = None
    content_html: Optional[str] = None
    color: str = NoteColor.DEFAULT
    is_pinned: bool = False
    is_checklist: bool = False
    checklist_items: Optional[List[ChecklistItem]] = None
    label_ids: Optional[List[UUID]] = None


class UpdateNoteRequest(BaseModel):
    """Request to update a note."""
    title: Optional[str] = None
    content: Optional[str] = None
    content_html: Optional[str] = None
    color: Optional[str] = None
    is_pinned: Optional[bool] = None
    is_checklist: Optional[bool] = None
    checklist_items: Optional[List[ChecklistItem]] = None
    label_ids: Optional[List[UUID]] = None
    position: Optional[int] = None


class NoteResponse(BaseModel):
    """Note response model."""
    id: str
    title: Optional[str]
    content: Optional[str]
    content_html: Optional[str]
    color: str
    is_pinned: bool
    is_archived: bool
    is_trashed: bool
    is_checklist: bool
    checklist_items: Optional[List[dict]]
    word_count: int
    created_at: str
    updated_at: str
    labels: List[dict] = []

    class Config:
        from_attributes = True


class CreateLabelRequest(BaseModel):
    """Request to create a label."""
    name: str = Field(..., min_length=1, max_length=100)
    color: Optional[str] = None


class UpdateLabelRequest(BaseModel):
    """Request to update a label."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    color: Optional[str] = None


class LabelResponse(BaseModel):
    """Label response model."""
    id: str
    name: str
    color: Optional[str]

    class Config:
        from_attributes = True


class SetReminderRequest(BaseModel):
    """Request to set a reminder."""
    reminder_time: datetime
    is_recurring: bool = False
    recurrence_pattern: Optional[str] = None  # daily, weekly, monthly


class ShareNoteRequest(BaseModel):
    """Request to share a note."""
    user_id: UUID
    user_email: str
    user_name: Optional[str] = None
    permission: str = "view"  # view, edit


class NoteCountResponse(BaseModel):
    """Note count response model."""
    active: int
    pinned: int
    archived: int
    trashed: int


# ===========================================
# Helper Functions
# ===========================================

def get_user_ids(current_user: dict) -> tuple:
    """Extract tenant_id and user_id from current user."""
    company_code = current_user.get("company_code")
    user_id = current_user.get("id") or current_user.get("user_id")

    # For internal users, use a default tenant
    if company_code and company_code.upper() in ["BHM001"]:
        from uuid import UUID as UUIDType
        return UUIDType("00000000-0000-0000-0000-000000000001"), UUIDType(str(user_id))

    tenant_id = current_user.get("tenant_id") or current_user.get("company_id")
    return UUID(str(tenant_id)) if tenant_id else None, UUID(str(user_id)) if user_id else None


# ===========================================
# Note Endpoints
# ===========================================

@router.post("", status_code=201)
async def create_note(
    request: CreateNoteRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new note."""
    tenant_id, user_id = get_user_ids(current_user)
    if not tenant_id or not user_id:
        raise HTTPException(status_code=401, detail="Invalid user context")

    service = NotesService(db)
    note_id = await service.create_note(
        tenant_id=tenant_id,
        owner_id=user_id,
        title=request.title,
        content=request.content,
        content_html=request.content_html,
        color=request.color,
        is_pinned=request.is_pinned,
        is_checklist=request.is_checklist,
        checklist_items=[item.dict() for item in request.checklist_items] if request.checklist_items else None,
        label_ids=request.label_ids,
    )

    # Fetch the created note using the existing get method
    note = await service.get_note(note_id, tenant_id, user_id)
    if note:
        return note.to_dict()
    return {"id": str(note_id), "message": "Note created successfully"}


@router.get("", response_model=List[NoteResponse])
async def list_notes(
    is_pinned: Optional[bool] = None,
    is_archived: bool = False,
    is_trashed: bool = False,
    label_id: Optional[UUID] = None,
    search: Optional[str] = None,
    color: Optional[str] = None,
    sort_by: str = Query("updated_at", regex="^(created_at|updated_at|title)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List notes with optional filters."""
    tenant_id, user_id = get_user_ids(current_user)
    if not tenant_id or not user_id:
        raise HTTPException(status_code=401, detail="Invalid user context")

    service = NotesService(db)
    notes = await service.list_notes(
        tenant_id=tenant_id,
        user_id=user_id,
        is_pinned=is_pinned,
        is_archived=is_archived,
        is_trashed=is_trashed,
        label_id=label_id,
        search=search,
        color=color,
        sort_by=sort_by,
        sort_order=sort_order,
        skip=skip,
        limit=limit,
    )

    return [note.to_dict() for note in notes]


@router.get("/count", response_model=NoteCountResponse)
async def get_note_count(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get note counts by status."""
    tenant_id, user_id = get_user_ids(current_user)
    if not tenant_id or not user_id:
        raise HTTPException(status_code=401, detail="Invalid user context")

    service = NotesService(db)
    counts = await service.get_note_count(tenant_id, user_id)

    return counts


@router.get("/search")
async def search_notes(
    q: str = Query(..., min_length=1),
    include_archived: bool = False,
    include_trashed: bool = False,
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search notes by title and content."""
    tenant_id, user_id = get_user_ids(current_user)
    if not tenant_id or not user_id:
        raise HTTPException(status_code=401, detail="Invalid user context")

    service = NotesService(db)
    notes = await service.search_notes(
        tenant_id=tenant_id,
        user_id=user_id,
        query=q,
        include_archived=include_archived,
        include_trashed=include_trashed,
        limit=limit,
    )

    return {
        "query": q,
        "count": len(notes),
        "results": [note.to_dict() for note in notes],
    }


# ===========================================
# Label Endpoints (must be before /{note_id} route)
# ===========================================

@router.get("/labels", response_model=List[LabelResponse])
async def list_labels(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all labels."""
    tenant_id, user_id = get_user_ids(current_user)
    if not tenant_id or not user_id:
        raise HTTPException(status_code=401, detail="Invalid user context")

    service = NotesService(db)
    labels = await service.list_labels(tenant_id, user_id)

    return [label.to_dict() for label in labels]


@router.post("/labels", response_model=LabelResponse)
async def create_label(
    request: CreateLabelRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new label."""
    tenant_id, user_id = get_user_ids(current_user)
    if not tenant_id or not user_id:
        raise HTTPException(status_code=401, detail="Invalid user context")

    service = NotesService(db)
    label = await service.create_label(
        tenant_id=tenant_id,
        owner_id=user_id,
        name=request.name,
        color=request.color,
    )

    return label.to_dict()


@router.put("/labels/{label_id}", response_model=LabelResponse)
async def update_label(
    label_id: UUID,
    request: UpdateLabelRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a label."""
    tenant_id, user_id = get_user_ids(current_user)
    if not tenant_id or not user_id:
        raise HTTPException(status_code=401, detail="Invalid user context")

    service = NotesService(db)
    label = await service.update_label(
        label_id=label_id,
        tenant_id=tenant_id,
        owner_id=user_id,
        name=request.name,
        color=request.color,
    )

    if not label:
        raise HTTPException(status_code=404, detail="Label not found")

    return label.to_dict()


@router.delete("/labels/{label_id}")
async def delete_label(
    label_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a label."""
    tenant_id, user_id = get_user_ids(current_user)
    if not tenant_id or not user_id:
        raise HTTPException(status_code=401, detail="Invalid user context")

    service = NotesService(db)
    success = await service.delete_label(label_id, tenant_id, user_id)

    if not success:
        raise HTTPException(status_code=404, detail="Label not found")

    return {"success": True}


@router.get("/{note_id}", response_model=NoteResponse)
async def get_note(
    note_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single note by ID."""
    tenant_id, user_id = get_user_ids(current_user)
    if not tenant_id or not user_id:
        raise HTTPException(status_code=401, detail="Invalid user context")

    service = NotesService(db)
    note = await service.get_note(note_id, tenant_id, user_id)

    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    return note.to_dict()


@router.put("/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: UUID,
    request: UpdateNoteRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a note."""
    tenant_id, user_id = get_user_ids(current_user)
    if not tenant_id or not user_id:
        raise HTTPException(status_code=401, detail="Invalid user context")

    # Build updates dict, excluding None values
    updates = {}
    for field, value in request.dict().items():
        if value is not None:
            if field == "checklist_items" and value:
                updates[field] = [item.dict() if hasattr(item, 'dict') else item for item in value]
            else:
                updates[field] = value

    service = NotesService(db)
    note = await service.update_note(note_id, tenant_id, user_id, updates)

    if not note:
        raise HTTPException(status_code=404, detail="Note not found or access denied")

    return note.to_dict()


@router.delete("/{note_id}")
async def delete_note(
    note_id: UUID,
    permanent: bool = False,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a note (move to trash or permanent delete)."""
    tenant_id, user_id = get_user_ids(current_user)
    if not tenant_id or not user_id:
        raise HTTPException(status_code=401, detail="Invalid user context")

    service = NotesService(db)
    success = await service.delete_note(note_id, tenant_id, user_id, permanent)

    if not success:
        raise HTTPException(status_code=404, detail="Note not found or access denied")

    return {"success": True, "permanent": permanent}


# ===========================================
# Note Action Endpoints
# ===========================================

@router.post("/{note_id}/pin", response_model=NoteResponse)
async def toggle_pin(
    note_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Toggle note pin status."""
    tenant_id, user_id = get_user_ids(current_user)
    if not tenant_id or not user_id:
        raise HTTPException(status_code=401, detail="Invalid user context")

    service = NotesService(db)
    note = await service.toggle_pin(note_id, tenant_id, user_id)

    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    return note.to_dict()


@router.post("/{note_id}/archive", response_model=NoteResponse)
async def archive_note(
    note_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Archive a note."""
    tenant_id, user_id = get_user_ids(current_user)
    if not tenant_id or not user_id:
        raise HTTPException(status_code=401, detail="Invalid user context")

    service = NotesService(db)
    note = await service.archive_note(note_id, tenant_id, user_id)

    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    return note.to_dict()


@router.post("/{note_id}/unarchive", response_model=NoteResponse)
async def unarchive_note(
    note_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Unarchive a note."""
    tenant_id, user_id = get_user_ids(current_user)
    if not tenant_id or not user_id:
        raise HTTPException(status_code=401, detail="Invalid user context")

    service = NotesService(db)
    note = await service.unarchive_note(note_id, tenant_id, user_id)

    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    return note.to_dict()


@router.post("/{note_id}/restore", response_model=NoteResponse)
async def restore_note(
    note_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Restore a trashed note."""
    tenant_id, user_id = get_user_ids(current_user)
    if not tenant_id or not user_id:
        raise HTTPException(status_code=401, detail="Invalid user context")

    service = NotesService(db)
    note = await service.restore_note(note_id, tenant_id, user_id)

    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    return note.to_dict()


@router.post("/{note_id}/color", response_model=NoteResponse)
async def change_color(
    note_id: UUID,
    color: str = Query(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change note color."""
    tenant_id, user_id = get_user_ids(current_user)
    if not tenant_id or not user_id:
        raise HTTPException(status_code=401, detail="Invalid user context")

    service = NotesService(db)
    note = await service.change_color(note_id, tenant_id, user_id, color)

    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    return note.to_dict()


@router.post("/{note_id}/copy", response_model=NoteResponse)
async def copy_note(
    note_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a copy of a note."""
    tenant_id, user_id = get_user_ids(current_user)
    if not tenant_id or not user_id:
        raise HTTPException(status_code=401, detail="Invalid user context")

    service = NotesService(db)
    note = await service.copy_note(note_id, tenant_id, user_id)

    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    return note.to_dict()


# ===========================================
# Reminder Endpoints
# ===========================================

@router.post("/{note_id}/reminder")
async def set_reminder(
    note_id: UUID,
    request: SetReminderRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Set a reminder for a note."""
    tenant_id, user_id = get_user_ids(current_user)
    if not tenant_id or not user_id:
        raise HTTPException(status_code=401, detail="Invalid user context")

    service = NotesService(db)
    reminder = await service.set_reminder(
        note_id=note_id,
        tenant_id=tenant_id,
        user_id=user_id,
        reminder_time=request.reminder_time,
        is_recurring=request.is_recurring,
        recurrence_pattern=request.recurrence_pattern,
    )

    if not reminder:
        raise HTTPException(status_code=404, detail="Note not found")

    return {
        "success": True,
        "reminder_time": reminder.reminder_time.isoformat(),
        "is_recurring": reminder.is_recurring,
    }


@router.delete("/{note_id}/reminder")
async def remove_reminder(
    note_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove reminder from a note."""
    tenant_id, user_id = get_user_ids(current_user)
    if not tenant_id or not user_id:
        raise HTTPException(status_code=401, detail="Invalid user context")

    service = NotesService(db)
    success = await service.remove_reminder(note_id, tenant_id, user_id)

    if not success:
        raise HTTPException(status_code=404, detail="Note not found")

    return {"success": True}


# ===========================================
# Sharing Endpoints
# ===========================================

@router.post("/{note_id}/share")
async def share_note(
    note_id: UUID,
    request: ShareNoteRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Share a note with another user."""
    tenant_id, user_id = get_user_ids(current_user)
    if not tenant_id or not user_id:
        raise HTTPException(status_code=401, detail="Invalid user context")

    service = NotesService(db)
    collaborator = await service.share_note(
        note_id=note_id,
        tenant_id=tenant_id,
        owner_id=user_id,
        user_id=request.user_id,
        user_email=request.user_email,
        user_name=request.user_name,
        permission=request.permission,
    )

    if not collaborator:
        raise HTTPException(status_code=400, detail="Could not share note")

    return {
        "success": True,
        "user_email": collaborator.user_email,
        "permission": collaborator.permission,
    }


@router.delete("/{note_id}/share/{user_id}")
async def remove_share(
    note_id: UUID,
    user_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a collaborator from a note."""
    tenant_id, owner_id = get_user_ids(current_user)
    if not tenant_id or not owner_id:
        raise HTTPException(status_code=401, detail="Invalid user context")

    service = NotesService(db)
    success = await service.remove_collaborator(note_id, tenant_id, owner_id, user_id)

    if not success:
        raise HTTPException(status_code=404, detail="Note or collaborator not found")

    return {"success": True}
