"""
Bheem Workspace - Enterprise Search API
API endpoints for unified search across workspace apps
"""
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from datetime import datetime

from core.database import get_db
from core.security import get_current_user
from services.search_service import SearchService

router = APIRouter(prefix="/search", tags=["Search"])


# =============================================
# Pydantic Schemas
# =============================================

class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    apps: Optional[List[str]] = None
    file_types: Optional[List[str]] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    owner_id: Optional[UUID] = None
    shared_with_me: bool = False


class SearchResultItem(BaseModel):
    id: str
    type: str
    title: str
    snippet: Optional[str] = None
    score: float = 0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    # Additional fields depending on type
    mime_type: Optional[str] = None
    size: Optional[int] = None
    slide_count: Optional[int] = None
    response_count: Optional[int] = None
    meeting_code: Optional[str] = None
    scheduled_start: Optional[str] = None
    email: Optional[str] = None


class SearchResponse(BaseModel):
    query: str
    total: int
    results: List[SearchResultItem]


class SuggestionItem(BaseModel):
    type: str
    text: str
    result_count: Optional[int] = None
    search_count: Optional[int] = None


class RecentItem(BaseModel):
    id: str
    type: str
    title: str
    updated_at: Optional[str] = None


# =============================================
# Search Endpoints
# =============================================

@router.post("", response_model=SearchResponse)
async def search(
    data: SearchRequest,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Perform unified search across workspace apps

    Searchable apps:
    - mail: Email drafts
    - drive: Drive files
    - docs: Documents
    - sheets: Spreadsheets
    - slides: Presentations
    - forms: Forms
    - meet: Meetings
    - contacts: Contacts
    """
    service = SearchService(db)

    results = await service.search(
        tenant_id=current_user["tenant_id"],
        user_id=current_user["user_id"],
        query=data.query,
        apps=data.apps,
        file_types=data.file_types,
        date_from=data.date_from,
        date_to=data.date_to,
        owner_id=data.owner_id,
        shared_with_me=data.shared_with_me,
        skip=skip,
        limit=limit
    )

    return results


@router.get("", response_model=SearchResponse)
async def search_get(
    q: str = Query(..., min_length=1, max_length=500, description="Search query"),
    apps: Optional[str] = Query(None, description="Comma-separated list of apps to search"),
    file_types: Optional[str] = Query(None, description="Comma-separated list of file types"),
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    owner_id: Optional[UUID] = None,
    shared_with_me: bool = False,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Perform unified search (GET method for easy integration)

    Query Parameters:
    - q: Search query (required)
    - apps: Comma-separated apps (mail,drive,docs,sheets,slides,forms,meet,contacts)
    - file_types: Comma-separated MIME types
    - date_from/date_to: Date range filter
    - owner_id: Filter by owner
    - shared_with_me: Only show shared items
    """
    service = SearchService(db)

    # Parse comma-separated strings
    apps_list = apps.split(",") if apps else None
    file_types_list = file_types.split(",") if file_types else None

    results = await service.search(
        tenant_id=current_user["tenant_id"],
        user_id=current_user["user_id"],
        query=q,
        apps=apps_list,
        file_types=file_types_list,
        date_from=date_from,
        date_to=date_to,
        owner_id=owner_id,
        shared_with_me=shared_with_me,
        skip=skip,
        limit=limit
    )

    return results


@router.get("/suggestions", response_model=List[SuggestionItem])
async def get_suggestions(
    prefix: str = Query(..., min_length=1, max_length=100, description="Search prefix"),
    limit: int = Query(5, ge=1, le=10),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get search suggestions based on prefix"""
    service = SearchService(db)

    suggestions = await service.get_suggestions(
        tenant_id=current_user["tenant_id"],
        user_id=current_user["user_id"],
        prefix=prefix,
        limit=limit
    )

    return suggestions


@router.get("/recent", response_model=List[RecentItem])
async def get_recent_items(
    apps: Optional[str] = Query(None, description="Comma-separated list of apps"),
    limit: int = Query(20, ge=1, le=50),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get recently accessed items"""
    service = SearchService(db)

    # Parse comma-separated apps
    apps_list = apps.split(",") if apps else None

    items = await service.get_recent_items(
        tenant_id=current_user["tenant_id"],
        user_id=current_user["user_id"],
        apps=apps_list,
        limit=limit
    )

    return items


# =============================================
# Quick Search Endpoints (by app)
# =============================================

@router.get("/mail", response_model=SearchResponse)
async def search_mail(
    q: str = Query(..., min_length=1, max_length=500),
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Search mail only"""
    service = SearchService(db)

    results = await service.search(
        tenant_id=current_user["tenant_id"],
        user_id=current_user["user_id"],
        query=q,
        apps=["mail"],
        date_from=date_from,
        date_to=date_to,
        skip=skip,
        limit=limit
    )

    return results


@router.get("/drive", response_model=SearchResponse)
async def search_drive(
    q: str = Query(..., min_length=1, max_length=500),
    file_types: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    owner_id: Optional[UUID] = None,
    shared_with_me: bool = False,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Search drive files only"""
    service = SearchService(db)

    file_types_list = file_types.split(",") if file_types else None

    results = await service.search(
        tenant_id=current_user["tenant_id"],
        user_id=current_user["user_id"],
        query=q,
        apps=["drive"],
        file_types=file_types_list,
        date_from=date_from,
        date_to=date_to,
        owner_id=owner_id,
        shared_with_me=shared_with_me,
        skip=skip,
        limit=limit
    )

    return results


@router.get("/docs", response_model=SearchResponse)
async def search_docs(
    q: str = Query(..., min_length=1, max_length=500),
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    owner_id: Optional[UUID] = None,
    shared_with_me: bool = False,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Search documents only"""
    service = SearchService(db)

    results = await service.search(
        tenant_id=current_user["tenant_id"],
        user_id=current_user["user_id"],
        query=q,
        apps=["docs"],
        date_from=date_from,
        date_to=date_to,
        owner_id=owner_id,
        shared_with_me=shared_with_me,
        skip=skip,
        limit=limit
    )

    return results


@router.get("/sheets", response_model=SearchResponse)
async def search_sheets(
    q: str = Query(..., min_length=1, max_length=500),
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    owner_id: Optional[UUID] = None,
    shared_with_me: bool = False,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Search spreadsheets only"""
    service = SearchService(db)

    results = await service.search(
        tenant_id=current_user["tenant_id"],
        user_id=current_user["user_id"],
        query=q,
        apps=["sheets"],
        date_from=date_from,
        date_to=date_to,
        owner_id=owner_id,
        shared_with_me=shared_with_me,
        skip=skip,
        limit=limit
    )

    return results


@router.get("/slides", response_model=SearchResponse)
async def search_slides(
    q: str = Query(..., min_length=1, max_length=500),
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    owner_id: Optional[UUID] = None,
    shared_with_me: bool = False,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Search presentations only"""
    service = SearchService(db)

    results = await service.search(
        tenant_id=current_user["tenant_id"],
        user_id=current_user["user_id"],
        query=q,
        apps=["slides"],
        date_from=date_from,
        date_to=date_to,
        owner_id=owner_id,
        shared_with_me=shared_with_me,
        skip=skip,
        limit=limit
    )

    return results


@router.get("/forms", response_model=SearchResponse)
async def search_forms(
    q: str = Query(..., min_length=1, max_length=500),
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    owner_id: Optional[UUID] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Search forms only"""
    service = SearchService(db)

    results = await service.search(
        tenant_id=current_user["tenant_id"],
        user_id=current_user["user_id"],
        query=q,
        apps=["forms"],
        date_from=date_from,
        date_to=date_to,
        owner_id=owner_id,
        skip=skip,
        limit=limit
    )

    return results


@router.get("/meet", response_model=SearchResponse)
async def search_meetings(
    q: str = Query(..., min_length=1, max_length=500),
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Search meetings only"""
    service = SearchService(db)

    results = await service.search(
        tenant_id=current_user["tenant_id"],
        user_id=current_user["user_id"],
        query=q,
        apps=["meet"],
        date_from=date_from,
        date_to=date_to,
        skip=skip,
        limit=limit
    )

    return results


@router.get("/contacts", response_model=SearchResponse)
async def search_contacts(
    q: str = Query(..., min_length=1, max_length=500),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Search contacts only"""
    service = SearchService(db)

    results = await service.search(
        tenant_id=current_user["tenant_id"],
        user_id=current_user["user_id"],
        query=q,
        apps=["contacts"],
        skip=skip,
        limit=limit
    )

    return results
