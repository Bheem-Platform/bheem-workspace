"""
Bheem Workspace - Unified Productivity API
Provides unified access to all document types: Docs, Sheets, Slides, Videos, Forms
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, or_, func, union_all, literal
from typing import Dict, Any, List, Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel
from enum import Enum

from core.database import get_db
from core.security import get_current_user
from models.productivity_models import Spreadsheet, Presentation, Form, Video
from services.docs_document_service import DocsDocumentService, get_docs_document_service

router = APIRouter(prefix="/productivity", tags=["Unified Productivity"])


class DocumentTypeFilter(str, Enum):
    ALL = "all"
    DOCS = "docs"
    SHEETS = "sheets"
    SLIDES = "slides"
    VIDEOS = "videos"
    FORMS = "forms"


class UnifiedDocumentResponse(BaseModel):
    id: str
    title: str
    type: str  # docs, sheets, slides, videos, forms
    icon: str
    color: str
    created_at: datetime
    updated_at: datetime
    owner_id: str
    is_starred: bool
    thumbnail_url: Optional[str] = None
    extra: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class UnifiedListResponse(BaseModel):
    items: List[UnifiedDocumentResponse]
    total: int
    has_more: bool


def get_user_ids(current_user: Dict[str, Any]) -> tuple:
    """Extract company_id and user_id from current user"""
    # Try tenant_id first (workspace users), then company_id/erp_company_id (ERP users)
    company_id = (
        current_user.get("tenant_id") or
        current_user.get("company_id") or
        current_user.get("erp_company_id")
    )
    user_id = current_user.get("user_id") or current_user.get("id")
    if not company_id or not user_id:
        raise HTTPException(status_code=400, detail="User context incomplete")
    if isinstance(company_id, str):
        company_id = UUID(company_id)
    if isinstance(user_id, str):
        user_id = UUID(user_id)
    return company_id, user_id


@router.get("/unified", response_model=UnifiedListResponse)
async def get_unified_documents(
    type_filter: DocumentTypeFilter = Query(DocumentTypeFilter.ALL, description="Filter by document type"),
    search: Optional[str] = Query(None, description="Search in title"),
    starred_only: bool = Query(False, description="Only show starred items"),
    shared_only: bool = Query(False, description="Only show shared items"),
    deleted_only: bool = Query(False, description="Only show deleted/trashed items"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    sort_by: str = Query("updated_at", enum=["updated_at", "created_at", "title"]),
    sort_order: str = Query("desc", enum=["asc", "desc"]),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get unified list of all document types (docs, sheets, slides, videos, forms)
    Similar to Google Docs home view showing all recent documents
    """
    company_id, user_id = get_user_ids(current_user)

    items = []

    # Define type configurations
    type_configs = {
        "docs": {"icon": "FileText", "color": "blue"},
        "sheets": {"icon": "Table", "color": "green"},
        "slides": {"icon": "Presentation", "color": "yellow"},
        "videos": {"icon": "Video", "color": "red"},
        "forms": {"icon": "ClipboardList", "color": "purple"},
    }

    # Fetch documents based on filter
    if type_filter in [DocumentTypeFilter.ALL, DocumentTypeFilter.DOCS]:
        # Fetch docs from DocsDocumentService
        docs_service = get_docs_document_service()
        try:
            result = await docs_service.list_documents(
                company_id=company_id,
                user_id=user_id,
                search=search,
                limit=limit if type_filter == DocumentTypeFilter.DOCS else 20,
            )
            docs = result.get('documents', [])
            for doc in docs:
                if starred_only and not doc.get('is_starred', False):
                    continue
                items.append(UnifiedDocumentResponse(
                    id=str(doc.get('id')),
                    title=doc.get('title') or doc.get('file_name') or "Untitled Document",
                    type="docs",
                    icon=type_configs["docs"]["icon"],
                    color=type_configs["docs"]["color"],
                    created_at=doc.get('created_at') or datetime.now(),
                    updated_at=doc.get('updated_at') or doc.get('created_at') or datetime.now(),
                    owner_id=str(doc.get('created_by', user_id)),
                    is_starred=doc.get('is_starred', False),
                    extra={"document_type": doc.get('document_type', 'GENERAL')}
                ))
        except Exception as e:
            print(f"Error fetching docs: {e}")

    if type_filter in [DocumentTypeFilter.ALL, DocumentTypeFilter.SHEETS]:
        # Fetch spreadsheets
        query = select(Spreadsheet).where(
            Spreadsheet.tenant_id == company_id,
            Spreadsheet.is_deleted == deleted_only  # Show deleted if deleted_only, else not deleted
        )
        if search:
            query = query.where(Spreadsheet.title.ilike(f"%{search}%"))
        if starred_only:
            query = query.where(Spreadsheet.is_starred == True)
        if shared_only:
            query = query.where(Spreadsheet.created_by != user_id)  # Documents not owned by current user
        else:
            # By default, show only documents created by current user
            query = query.where(Spreadsheet.created_by == user_id)
        query = query.order_by(desc(Spreadsheet.updated_at)).limit(
            limit if type_filter == DocumentTypeFilter.SHEETS else 20
        )

        result = await db.execute(query)
        sheets = result.scalars().all()
        for sheet in sheets:
            items.append(UnifiedDocumentResponse(
                id=str(sheet.id),
                title=sheet.title,
                type="sheets",
                icon=type_configs["sheets"]["icon"],
                color=type_configs["sheets"]["color"],
                created_at=sheet.created_at,
                updated_at=sheet.updated_at,
                owner_id=str(sheet.created_by),
                is_starred=sheet.is_starred,
            ))

    if type_filter in [DocumentTypeFilter.ALL, DocumentTypeFilter.SLIDES]:
        # Fetch presentations
        query = select(Presentation).where(
            Presentation.tenant_id == company_id,
            Presentation.is_deleted == deleted_only
        )
        if search:
            query = query.where(Presentation.title.ilike(f"%{search}%"))
        if starred_only:
            query = query.where(Presentation.is_starred == True)
        if shared_only:
            query = query.where(Presentation.created_by != user_id)
        else:
            # By default, show only documents created by current user
            query = query.where(Presentation.created_by == user_id)
        query = query.order_by(desc(Presentation.updated_at)).limit(
            limit if type_filter == DocumentTypeFilter.SLIDES else 20
        )

        result = await db.execute(query)
        presentations = result.scalars().all()
        for pres in presentations:
            items.append(UnifiedDocumentResponse(
                id=str(pres.id),
                title=pres.title,
                type="slides",
                icon=type_configs["slides"]["icon"],
                color=type_configs["slides"]["color"],
                created_at=pres.created_at,
                updated_at=pres.updated_at,
                owner_id=str(pres.created_by),
                is_starred=pres.is_starred,
            ))

    if type_filter in [DocumentTypeFilter.ALL, DocumentTypeFilter.VIDEOS]:
        # Fetch videos
        try:
            query = select(Video).where(
                Video.tenant_id == company_id,
                Video.is_deleted == deleted_only
            )
            if search:
                query = query.where(Video.title.ilike(f"%{search}%"))
            if starred_only:
                query = query.where(Video.is_starred == True)
            if shared_only:
                query = query.where(Video.created_by != user_id)
            else:
                # By default, show only documents created by current user
                query = query.where(Video.created_by == user_id)
            query = query.order_by(desc(Video.updated_at)).limit(
                limit if type_filter == DocumentTypeFilter.VIDEOS else 20
            )

            result = await db.execute(query)
            videos = result.scalars().all()
            for video in videos:
                items.append(UnifiedDocumentResponse(
                    id=str(video.id),
                    title=video.title,
                    type="videos",
                    icon=type_configs["videos"]["icon"],
                    color=type_configs["videos"]["color"],
                    created_at=video.created_at,
                    updated_at=video.updated_at,
                    owner_id=str(video.created_by),
                    is_starred=video.is_starred,
                    thumbnail_url=video.thumbnail_url,
                    extra={"duration": video.duration, "status": video.status}
                ))
        except Exception as e:
            print(f"Error fetching videos: {e}")

    if type_filter in [DocumentTypeFilter.ALL, DocumentTypeFilter.FORMS]:
        # Fetch forms
        query = select(Form).where(
            Form.tenant_id == company_id,
            Form.is_deleted == deleted_only
        )
        if search:
            query = query.where(Form.title.ilike(f"%{search}%"))
        if starred_only:
            query = query.where(Form.is_starred == True)
        if shared_only:
            query = query.where(Form.created_by != user_id)
        else:
            # By default, show only documents created by current user
            query = query.where(Form.created_by == user_id)
        query = query.order_by(desc(Form.updated_at)).limit(
            limit if type_filter == DocumentTypeFilter.FORMS else 20
        )

        result = await db.execute(query)
        forms = result.scalars().all()
        for form in forms:
            items.append(UnifiedDocumentResponse(
                id=str(form.id),
                title=form.title,
                type="forms",
                icon=type_configs["forms"]["icon"],
                color=type_configs["forms"]["color"],
                created_at=form.created_at,
                updated_at=form.updated_at,
                owner_id=str(form.created_by),
                is_starred=form.is_starred,
                extra={"status": form.status, "response_count": form.response_count}
            ))

    # Sort all items (handle None values)
    reverse = sort_order == "desc"
    from datetime import datetime, timezone
    min_date = datetime.min.replace(tzinfo=timezone.utc)
    if sort_by == "updated_at":
        items.sort(key=lambda x: (x.updated_at.replace(tzinfo=timezone.utc) if x.updated_at and x.updated_at.tzinfo is None else x.updated_at) or min_date, reverse=reverse)
    elif sort_by == "created_at":
        items.sort(key=lambda x: (x.created_at.replace(tzinfo=timezone.utc) if x.created_at and x.created_at.tzinfo is None else x.created_at) or min_date, reverse=reverse)
    elif sort_by == "title":
        items.sort(key=lambda x: (x.title or "").lower(), reverse=reverse)

    # Paginate
    total = len(items)
    items = items[offset:offset + limit]

    return UnifiedListResponse(
        items=items,
        total=total,
        has_more=offset + len(items) < total
    )


@router.get("/recent", response_model=List[UnifiedDocumentResponse])
async def get_recent_documents(
    limit: int = Query(10, ge=1, le=50),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get most recently accessed documents across all types"""
    result = await get_unified_documents(
        type_filter=DocumentTypeFilter.ALL,
        limit=limit,
        sort_by="updated_at",
        sort_order="desc",
        current_user=current_user,
        db=db,
    )
    return result.items


@router.get("/starred", response_model=List[UnifiedDocumentResponse])
async def get_starred_documents(
    limit: int = Query(50, ge=1, le=200),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all starred documents across all types"""
    result = await get_unified_documents(
        type_filter=DocumentTypeFilter.ALL,
        starred_only=True,
        limit=limit,
        current_user=current_user,
        db=db,
    )
    return result.items


@router.post("/{doc_type}/{doc_id}/star")
async def toggle_star(
    doc_type: str,
    doc_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Toggle star status for any document type"""
    company_id, user_id = get_user_ids(current_user)

    model_map = {
        "docs": None,  # Handled separately
        "sheets": Spreadsheet,
        "slides": Presentation,
        "videos": Video,
        "forms": Form,
    }

    if doc_type == "docs":
        docs_service = get_docs_document_service()
        doc = await docs_service.get_document(doc_id, company_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        doc.is_starred = not doc.is_starred
        await db.commit()
        return {"starred": doc.is_starred}

    model = model_map.get(doc_type)
    if not model:
        raise HTTPException(status_code=400, detail=f"Invalid document type: {doc_type}")

    query = select(model).where(
        model.id == doc_id,
        model.tenant_id == company_id,
    )
    result = await db.execute(query)
    doc = result.scalar_one_or_none()

    if not doc:
        raise HTTPException(status_code=404, detail=f"{doc_type.title()} not found")

    doc.is_starred = not doc.is_starred
    await db.commit()

    return {"starred": doc.is_starred}


@router.get("/stats")
async def get_productivity_stats(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get document counts by type"""
    company_id, user_id = get_user_ids(current_user)

    stats = {}

    # Count spreadsheets
    result = await db.execute(
        select(func.count(Spreadsheet.id)).where(
            Spreadsheet.tenant_id == company_id,
            Spreadsheet.is_deleted == False
        )
    )
    stats["sheets"] = result.scalar() or 0

    # Count presentations
    result = await db.execute(
        select(func.count(Presentation.id)).where(
            Presentation.tenant_id == company_id,
            Presentation.is_deleted == False
        )
    )
    stats["slides"] = result.scalar() or 0

    # Count forms
    result = await db.execute(
        select(func.count(Form.id)).where(
            Form.tenant_id == company_id,
            Form.is_deleted == False
        )
    )
    stats["forms"] = result.scalar() or 0

    # Count videos
    try:
        result = await db.execute(
            select(func.count(Video.id)).where(
                Video.tenant_id == company_id,
                Video.is_deleted == False
            )
        )
        stats["videos"] = result.scalar() or 0
    except:
        stats["videos"] = 0

    # Count docs (from docs service)
    try:
        docs_service = get_docs_document_service()
        result = await docs_service.list_documents(company_id=company_id, user_id=user_id, limit=1000)
        stats["docs"] = result.get('total', 0)
    except:
        stats["docs"] = 0

    stats["total"] = sum(stats.values())

    return stats
