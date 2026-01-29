"""
Bheem Sites - API Endpoints

REST API for Sites/Wiki functionality.
Phase 5: Bheem Sites/Wiki
"""

from typing import Optional, List, Literal
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from datetime import datetime

from core.database import get_db
from core.security import get_current_user
from sqlalchemy.ext.asyncio import AsyncSession
from services.sites_service import SitesService

# Type definitions for Pydantic schemas
SiteVisibilityType = Literal["private", "internal", "public"]
PageTypeType = Literal["standard", "wiki", "blog", "landing", "embed"]

router = APIRouter(prefix="/sites", tags=["Sites"])


def get_user_context_from_token(current_user: dict) -> dict:
    """Convert JWT user to user context dict with tenant_id and user_id."""
    company_code = current_user.get("company_code")
    user_id = current_user.get("id") or current_user.get("user_id")

    # For internal users, use a default tenant
    if company_code and company_code.upper() in ["BHM001"]:
        return {
            "tenant_id": UUID("00000000-0000-0000-0000-000000000001"),
            "user_id": UUID(str(user_id)) if user_id else None
        }

    tenant_id = current_user.get("tenant_id") or current_user.get("company_id")
    return {
        "tenant_id": UUID(str(tenant_id)) if tenant_id else None,
        "user_id": UUID(str(user_id)) if user_id else None
    }


# ============================================
# Pydantic Schemas
# ============================================

class SiteCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    visibility: SiteVisibilityType = "internal"
    template_id: Optional[UUID] = None


class SiteUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    theme_color: Optional[str] = None
    custom_css: Optional[str] = None
    visibility: Optional[SiteVisibilityType] = None
    allow_comments: Optional[bool] = None
    allow_search: Optional[bool] = None
    show_navigation: Optional[bool] = None
    show_breadcrumbs: Optional[bool] = None
    navigation: Optional[List[dict]] = None


class SiteResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    slug: str
    description: Optional[str]
    logo_url: Optional[str]
    favicon_url: Optional[str]
    theme_color: str
    visibility: str
    allow_comments: bool
    allow_search: bool
    show_navigation: bool
    show_breadcrumbs: bool
    navigation: Optional[List[dict]]
    owner_id: UUID
    is_published: bool
    published_at: Optional[datetime]
    view_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PageCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: Optional[str] = None
    page_type: PageTypeType = "standard"
    parent_id: Optional[UUID] = None
    is_draft: bool = True


class PageUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    content: Optional[str] = None
    content_format: Optional[str] = None
    excerpt: Optional[str] = None
    cover_image_url: Optional[str] = None
    cover_position: Optional[str] = None
    page_type: Optional[PageTypeType] = None
    show_title: Optional[bool] = None
    show_toc: Optional[bool] = None
    allow_comments: Optional[bool] = None
    is_draft: Optional[bool] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    meta_keywords: Optional[List[str]] = None


class PageResponse(BaseModel):
    id: UUID
    site_id: UUID
    title: str
    slug: str
    page_type: str
    content: Optional[str]
    content_format: str
    excerpt: Optional[str]
    cover_image_url: Optional[str]
    parent_id: Optional[UUID]
    path: Optional[str]
    depth: int
    order: int
    is_homepage: bool
    is_draft: bool
    show_title: bool
    show_toc: bool
    allow_comments: bool
    view_count: int
    author_id: UUID
    created_at: datetime
    updated_at: datetime
    published_at: Optional[datetime]

    class Config:
        from_attributes = True


class PageMoveRequest(BaseModel):
    parent_id: Optional[UUID] = None
    order: int = 0


class CollaboratorAdd(BaseModel):
    user_id: UUID
    role: str = "editor"


class CollaboratorResponse(BaseModel):
    id: UUID
    site_id: UUID
    user_id: UUID
    role: str
    can_publish: bool
    can_manage_collaborators: bool
    added_at: datetime

    class Config:
        from_attributes = True


class CommentCreate(BaseModel):
    content: str = Field(..., min_length=1)
    author_name: str
    parent_id: Optional[UUID] = None


class CommentResponse(BaseModel):
    id: UUID
    page_id: UUID
    content: str
    author_id: UUID
    author_name: str
    parent_id: Optional[UUID]
    is_resolved: bool
    is_pinned: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class VersionResponse(BaseModel):
    id: UUID
    page_id: UUID
    version_number: int
    title: str
    author_id: UUID
    created_at: datetime
    change_summary: Optional[str]

    class Config:
        from_attributes = True


# ============================================
# Dependency for getting user context
# ============================================



# ============================================
# Site Endpoints
# ============================================

@router.post("", response_model=SiteResponse, status_code=status.HTTP_201_CREATED)
async def create_site(
    data: SiteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new site"""
    user = get_user_context_from_token(current_user)
    service = SitesService(db)
    site = await service.create_site(
        tenant_id=user["tenant_id"],
        owner_id=user["user_id"],
        name=data.name,
        description=data.description,
        visibility=data.visibility,
        template_id=data.template_id
    )
    return site


@router.get("", response_model=List[SiteResponse])
async def list_sites(
    visibility: Optional[SiteVisibilityType] = None,
    include_archived: bool = False,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List sites accessible to user"""
    user = get_user_context_from_token(current_user)
    service = SitesService(db)
    sites = await service.list_sites(
        tenant_id=user["tenant_id"],
        user_id=user["user_id"],
        visibility=visibility,
        include_archived=include_archived,
        skip=skip,
        limit=limit
    )
    return sites


@router.get("/{site_id}", response_model=SiteResponse)
async def get_site(
    site_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get a site by ID"""
    user = get_user_context_from_token(current_user)
    service = SitesService(db)
    site = await service.get_site(site_id, user["user_id"])
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    return site


@router.get("/by-slug/{slug}", response_model=SiteResponse)
async def get_site_by_slug(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get a site by slug"""
    user = get_user_context_from_token(current_user)
    service = SitesService(db)
    site = await service.get_site_by_slug(
        user["tenant_id"], slug, user["user_id"]
    )
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    return site


@router.put("/{site_id}", response_model=SiteResponse)
async def update_site(
    site_id: UUID,
    data: SiteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update a site"""
    user = get_user_context_from_token(current_user)
    service = SitesService(db)
    site = await service.update_site(
        site_id, user["user_id"], data.model_dump(exclude_unset=True)
    )
    if not site:
        raise HTTPException(status_code=404, detail="Site not found or no permission")
    return site


@router.post("/{site_id}/publish")
async def publish_site(
    site_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Publish a site"""
    user = get_user_context_from_token(current_user)
    service = SitesService(db)
    success = await service.publish_site(site_id, user["user_id"])
    if not success:
        raise HTTPException(status_code=404, detail="Site not found or no permission")
    return {"status": "published"}


@router.post("/{site_id}/archive")
async def archive_site(
    site_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Archive a site"""
    user = get_user_context_from_token(current_user)
    service = SitesService(db)
    success = await service.archive_site(site_id, user["user_id"])
    if not success:
        raise HTTPException(status_code=404, detail="Site not found or no permission")
    return {"status": "archived"}


@router.delete("/{site_id}")
async def delete_site(
    site_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete a site permanently"""
    user = get_user_context_from_token(current_user)
    service = SitesService(db)
    success = await service.delete_site(site_id, user["user_id"])
    if not success:
        raise HTTPException(status_code=404, detail="Site not found or no permission")
    return {"status": "deleted"}


# ============================================
# Page Endpoints
# ============================================

@router.post("/{site_id}/pages", response_model=PageResponse, status_code=status.HTTP_201_CREATED)
async def create_page(
    site_id: UUID,
    data: PageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new page in a site"""
    user = get_user_context_from_token(current_user)
    service = SitesService(db)
    page = await service.create_page(
        site_id=site_id,
        user_id=user["user_id"],
        title=data.title,
        content=data.content,
        page_type=data.page_type,
        parent_id=data.parent_id,
        is_draft=data.is_draft
    )
    if not page:
        raise HTTPException(status_code=404, detail="Site not found or no permission")
    return page


@router.get("/{site_id}/pages", response_model=List[PageResponse])
async def list_pages(
    site_id: UUID,
    parent_id: Optional[UUID] = None,
    include_drafts: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List pages in a site"""
    user = get_user_context_from_token(current_user)
    service = SitesService(db)
    pages = await service.list_pages(
        site_id, user["user_id"], parent_id, include_drafts
    )
    return pages


@router.get("/{site_id}/pages/tree")
async def get_page_tree(
    site_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get hierarchical page tree"""
    user = get_user_context_from_token(current_user)
    service = SitesService(db)
    tree = await service.get_page_tree(site_id, user["user_id"])
    return tree


@router.get("/{site_id}/pages/{page_id}", response_model=PageResponse)
async def get_page(
    site_id: UUID,
    page_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get a page by ID"""
    user = get_user_context_from_token(current_user)
    service = SitesService(db)
    page = await service.get_page(page_id, user["user_id"])
    if not page or page.site_id != site_id:
        raise HTTPException(status_code=404, detail="Page not found")

    # Increment view count
    await service.increment_view_count(page_id)
    return page


@router.get("/{site_id}/pages/by-path/{path:path}", response_model=PageResponse)
async def get_page_by_path(
    site_id: UUID,
    path: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get a page by path"""
    user = get_user_context_from_token(current_user)
    service = SitesService(db)
    full_path = f"/{path}" if not path.startswith("/") else path
    page = await service.get_page_by_path(site_id, full_path, user["user_id"])
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    return page


@router.put("/{site_id}/pages/{page_id}", response_model=PageResponse)
async def update_page(
    site_id: UUID,
    page_id: UUID,
    data: PageUpdate,
    create_version: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update a page"""
    user = get_user_context_from_token(current_user)
    service = SitesService(db)
    page = await service.update_page(
        page_id, user["user_id"],
        data.model_dump(exclude_unset=True),
        create_version
    )
    if not page or page.site_id != site_id:
        raise HTTPException(status_code=404, detail="Page not found or no permission")
    return page


@router.post("/{site_id}/pages/{page_id}/publish")
async def publish_page(
    site_id: UUID,
    page_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Publish a page"""
    user = get_user_context_from_token(current_user)
    service = SitesService(db)
    success = await service.publish_page(page_id, user["user_id"])
    if not success:
        raise HTTPException(status_code=404, detail="Page not found or no permission")
    return {"status": "published"}


@router.post("/{site_id}/pages/{page_id}/move")
async def move_page(
    site_id: UUID,
    page_id: UUID,
    data: PageMoveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Move a page in the hierarchy"""
    user = get_user_context_from_token(current_user)
    service = SitesService(db)
    success = await service.move_page(
        page_id, user["user_id"], data.parent_id, data.order
    )
    if not success:
        raise HTTPException(status_code=404, detail="Page not found or no permission")
    return {"status": "moved"}


@router.delete("/{site_id}/pages/{page_id}")
async def delete_page(
    site_id: UUID,
    page_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete a page"""
    user = get_user_context_from_token(current_user)
    service = SitesService(db)
    success = await service.delete_page(page_id, user["user_id"])
    if not success:
        raise HTTPException(status_code=400, detail="Cannot delete page (may be homepage)")
    return {"status": "deleted"}


# ============================================
# Version Endpoints
# ============================================

@router.get("/{site_id}/pages/{page_id}/versions", response_model=List[VersionResponse])
async def list_page_versions(
    site_id: UUID,
    page_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List version history for a page"""
    user = get_user_context_from_token(current_user)
    service = SitesService(db)
    versions = await service.get_page_versions(page_id, user["user_id"])
    return versions


@router.post("/{site_id}/pages/{page_id}/versions/{version_id}/restore")
async def restore_version(
    site_id: UUID,
    page_id: UUID,
    version_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Restore a page to a previous version"""
    user = get_user_context_from_token(current_user)
    service = SitesService(db)
    success = await service.restore_version(page_id, version_id, user["user_id"])
    if not success:
        raise HTTPException(status_code=404, detail="Version not found")
    return {"status": "restored"}


# ============================================
# Collaborator Endpoints
# ============================================

@router.get("/{site_id}/collaborators", response_model=List[CollaboratorResponse])
async def list_collaborators(
    site_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List collaborators on a site"""
    user = get_user_context_from_token(current_user)
    service = SitesService(db)
    collaborators = await service.list_collaborators(site_id, user["user_id"])
    return collaborators


@router.post("/{site_id}/collaborators", response_model=CollaboratorResponse, status_code=status.HTTP_201_CREATED)
async def add_collaborator(
    site_id: UUID,
    data: CollaboratorAdd,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Add a collaborator to a site"""
    user = get_user_context_from_token(current_user)
    service = SitesService(db)
    collaborator = await service.add_collaborator(
        site_id, user["user_id"], data.user_id, data.role, user["user_id"]
    )
    if not collaborator:
        raise HTTPException(status_code=400, detail="Cannot add collaborator")
    return collaborator


@router.delete("/{site_id}/collaborators/{collaborator_user_id}")
async def remove_collaborator(
    site_id: UUID,
    collaborator_user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Remove a collaborator from a site"""
    user = get_user_context_from_token(current_user)
    service = SitesService(db)
    success = await service.remove_collaborator(
        site_id, user["user_id"], collaborator_user_id
    )
    if not success:
        raise HTTPException(status_code=400, detail="Cannot remove collaborator")
    return {"status": "removed"}


# ============================================
# Comment Endpoints
# ============================================

@router.get("/{site_id}/pages/{page_id}/comments", response_model=List[CommentResponse])
async def list_comments(
    site_id: UUID,
    page_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List comments on a page"""
    user = get_user_context_from_token(current_user)
    service = SitesService(db)
    comments = await service.list_comments(page_id, user["user_id"])
    return comments


@router.post("/{site_id}/pages/{page_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def add_comment(
    site_id: UUID,
    page_id: UUID,
    data: CommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Add a comment to a page"""
    user = get_user_context_from_token(current_user)
    service = SitesService(db)
    comment = await service.add_comment(
        page_id, user["user_id"], data.content, data.author_name, data.parent_id
    )
    if not comment:
        raise HTTPException(status_code=400, detail="Cannot add comment")
    return comment


# ============================================
# Template Endpoints
# ============================================

@router.get("/templates", response_model=List[dict])
async def list_templates(
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List available site templates"""
    user = get_user_context_from_token(current_user)
    service = SitesService(db)
    templates = await service.list_templates(user["tenant_id"], category)
    return [
        {
            "id": str(t.id),
            "name": t.name,
            "description": t.description,
            "category": t.category,
            "preview_image_url": t.preview_image_url,
            "is_system": t.is_system
        }
        for t in templates
    ]
