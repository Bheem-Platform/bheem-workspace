"""
Bheem Workspace - Mail Contacts API
Manage email contacts and autocomplete
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from uuid import UUID
from core.security import get_current_user
from core.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from services.mail_contacts_service import mail_contacts_service

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

router = APIRouter(prefix="/mail/contacts", tags=["Mail Contacts"])


# ===========================================
# Schemas
# ===========================================

class CreateContactRequest(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    is_favorite: Optional[bool] = False


class UpdateContactRequest(BaseModel):
    name: Optional[str] = None
    is_favorite: Optional[bool] = None


class ContactResponse(BaseModel):
    id: str
    email: str
    name: Optional[str]
    frequency: int
    is_favorite: bool
    source: str
    last_contacted: Optional[str]
    created_at: Optional[str]


class ContactListResponse(BaseModel):
    contacts: List[ContactResponse]
    total: int
    page: int
    limit: int


class AutocompleteResponse(BaseModel):
    suggestions: List[ContactResponse]
    query: str


class ImportContactsRequest(BaseModel):
    contacts: List[dict]  # List of {email, name}


class ImportContactsResponse(BaseModel):
    imported: int
    skipped: int


# ===========================================
# Autocomplete Endpoint (Most Used)
# ===========================================

@router.get("/autocomplete", response_model=AutocompleteResponse)
@limiter.limit("60/minute")
async def autocomplete_contacts(
    request: Request,
    q: str = Query("", description="Search query"),
    limit: int = Query(10, ge=1, le=20),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Search contacts for autocomplete in compose.

    Returns contacts matching email or name, ordered by:
    1. Favorites first
    2. Most frequently contacted

    Fast endpoint optimized for typing-ahead.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    contacts = await mail_contacts_service.search_contacts(
        db=db,
        user_id=UUID(user_id),
        query=q,
        limit=limit
    )

    return AutocompleteResponse(
        suggestions=[ContactResponse(**mail_contacts_service.contact_to_dict(c)) for c in contacts],
        query=q
    )


# ===========================================
# Contact CRUD Endpoints
# ===========================================

@router.post("", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def create_contact(
    request_obj: Request,
    request: CreateContactRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new contact manually."""
    user_id = current_user.get("id") or current_user.get("user_id")

    try:
        contact = await mail_contacts_service.create_contact(
            db=db,
            user_id=UUID(user_id),
            email=request.email,
            name=request.name,
            is_favorite=request.is_favorite
        )

        return ContactResponse(**mail_contacts_service.contact_to_dict(contact))

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("", response_model=ContactListResponse)
@limiter.limit("30/minute")
async def list_contacts(
    request: Request,
    favorites_only: bool = False,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all contacts with pagination."""
    user_id = current_user.get("id") or current_user.get("user_id")
    offset = (page - 1) * limit

    contacts = await mail_contacts_service.list_contacts(
        db=db,
        user_id=UUID(user_id),
        favorites_only=favorites_only,
        limit=limit,
        offset=offset
    )

    total = await mail_contacts_service.get_contacts_count(
        db=db,
        user_id=UUID(user_id)
    )

    return ContactListResponse(
        contacts=[ContactResponse(**mail_contacts_service.contact_to_dict(c)) for c in contacts],
        total=total,
        page=page,
        limit=limit
    )


@router.get("/{contact_id}", response_model=ContactResponse)
@limiter.limit("30/minute")
async def get_contact(
    request: Request,
    contact_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a single contact by ID."""
    user_id = current_user.get("id") or current_user.get("user_id")

    contact = await mail_contacts_service.get_contact(
        db=db,
        contact_id=contact_id,
        user_id=UUID(user_id)
    )

    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found"
        )

    return ContactResponse(**mail_contacts_service.contact_to_dict(contact))


@router.put("/{contact_id}", response_model=ContactResponse)
@limiter.limit("30/minute")
async def update_contact(
    request_obj: Request,
    contact_id: UUID,
    request: UpdateContactRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a contact."""
    user_id = current_user.get("id") or current_user.get("user_id")

    updates = {}
    if request.name is not None:
        updates['name'] = request.name
    if request.is_favorite is not None:
        updates['is_favorite'] = request.is_favorite

    contact = await mail_contacts_service.update_contact(
        db=db,
        contact_id=contact_id,
        user_id=UUID(user_id),
        updates=updates
    )

    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found"
        )

    return ContactResponse(**mail_contacts_service.contact_to_dict(contact))


@router.delete("/{contact_id}")
@limiter.limit("30/minute")
async def delete_contact(
    request: Request,
    contact_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a contact."""
    user_id = current_user.get("id") or current_user.get("user_id")

    success = await mail_contacts_service.delete_contact(
        db=db,
        contact_id=contact_id,
        user_id=UUID(user_id)
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found"
        )

    return {"success": True, "message": "Contact deleted"}


@router.post("/{contact_id}/favorite")
@limiter.limit("30/minute")
async def toggle_favorite(
    request: Request,
    contact_id: UUID,
    is_favorite: bool,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Toggle favorite status of a contact."""
    user_id = current_user.get("id") or current_user.get("user_id")

    contact = await mail_contacts_service.toggle_favorite(
        db=db,
        contact_id=contact_id,
        user_id=UUID(user_id),
        is_favorite=is_favorite
    )

    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found"
        )

    return {"success": True, "is_favorite": contact.is_favorite}


# ===========================================
# Bulk Operations
# ===========================================

@router.post("/import", response_model=ImportContactsResponse)
@limiter.limit("5/minute")
async def import_contacts(
    request_obj: Request,
    request: ImportContactsRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Bulk import contacts.

    Accepts a list of {email, name} objects.
    Existing contacts will have their frequency incremented.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    result = await mail_contacts_service.import_contacts(
        db=db,
        user_id=UUID(user_id),
        contacts=request.contacts
    )

    return ImportContactsResponse(**result)


@router.delete("")
@limiter.limit("5/minute")
async def delete_all_contacts(
    request: Request,
    source: Optional[str] = Query(None, description="Filter by source: auto, manual, import"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete all contacts.

    Optionally filter by source to only delete auto-collected contacts.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    if source and source not in ['auto', 'manual', 'import']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid source. Must be: auto, manual, or import"
        )

    count = await mail_contacts_service.delete_all_contacts(
        db=db,
        user_id=UUID(user_id),
        source=source
    )

    return {"success": True, "deleted_count": count}
