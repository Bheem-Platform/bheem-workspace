"""
Bheem Workspace - Mail Templates API
Manage reusable email templates
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from core.security import get_current_user
from core.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from services.mail_templates_service import mail_templates_service

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

router = APIRouter(prefix="/mail/templates", tags=["Mail Templates"])


# ===========================================
# Schemas
# ===========================================

class AddressSchema(BaseModel):
    email: str
    name: Optional[str] = None


class CreateTemplateRequest(BaseModel):
    name: str
    subject: Optional[str] = ""
    body: Optional[str] = ""
    is_html: Optional[bool] = True
    description: Optional[str] = None
    to_addresses: Optional[List[AddressSchema]] = []
    cc_addresses: Optional[List[AddressSchema]] = []
    category: Optional[str] = "general"


class UpdateTemplateRequest(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    is_html: Optional[bool] = None
    description: Optional[str] = None
    to_addresses: Optional[List[AddressSchema]] = None
    cc_addresses: Optional[List[AddressSchema]] = None
    category: Optional[str] = None


class TemplateResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    subject: str
    body: str
    is_html: bool
    to_addresses: List[dict]
    cc_addresses: List[dict]
    category: str
    created_at: Optional[str]
    updated_at: Optional[str]


class TemplateListResponse(BaseModel):
    templates: List[TemplateResponse]
    total: int
    page: int
    limit: int


class DuplicateTemplateRequest(BaseModel):
    new_name: Optional[str] = None


# ===========================================
# Template CRUD Endpoints
# ===========================================

@router.post("", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
async def create_template(
    request_obj: Request,
    request: CreateTemplateRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new email template."""
    user_id = current_user.get("id") or current_user.get("user_id")

    try:
        template = await mail_templates_service.create_template(
            db=db,
            user_id=UUID(user_id),
            name=request.name,
            subject=request.subject or "",
            body=request.body or "",
            is_html=request.is_html if request.is_html is not None else True,
            description=request.description,
            to_addresses=[a.model_dump() for a in request.to_addresses] if request.to_addresses else [],
            cc_addresses=[a.model_dump() for a in request.cc_addresses] if request.cc_addresses else [],
            category=request.category or "general"
        )

        return TemplateResponse(**mail_templates_service.template_to_dict(template))

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("", response_model=TemplateListResponse)
@limiter.limit("30/minute")
async def list_templates(
    request: Request,
    category: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all templates with optional filtering."""
    user_id = current_user.get("id") or current_user.get("user_id")
    offset = (page - 1) * limit

    templates = await mail_templates_service.list_templates(
        db=db,
        user_id=UUID(user_id),
        category=category,
        search=search,
        limit=limit,
        offset=offset
    )

    total = await mail_templates_service.get_templates_count(
        db=db,
        user_id=UUID(user_id)
    )

    return TemplateListResponse(
        templates=[TemplateResponse(**mail_templates_service.template_to_dict(t)) for t in templates],
        total=total,
        page=page,
        limit=limit
    )


@router.get("/categories")
@limiter.limit("30/minute")
async def list_categories(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get list of template categories."""
    user_id = current_user.get("id") or current_user.get("user_id")

    categories = await mail_templates_service.get_categories(
        db=db,
        user_id=UUID(user_id)
    )

    return {"categories": categories}


@router.get("/{template_id}", response_model=TemplateResponse)
@limiter.limit("30/minute")
async def get_template(
    request: Request,
    template_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a single template."""
    user_id = current_user.get("id") or current_user.get("user_id")

    template = await mail_templates_service.get_template(
        db=db,
        template_id=template_id,
        user_id=UUID(user_id)
    )

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )

    return TemplateResponse(**mail_templates_service.template_to_dict(template))


@router.put("/{template_id}", response_model=TemplateResponse)
@limiter.limit("20/minute")
async def update_template(
    request_obj: Request,
    template_id: UUID,
    request: UpdateTemplateRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a template."""
    user_id = current_user.get("id") or current_user.get("user_id")

    updates = {}
    if request.name is not None:
        updates['name'] = request.name
    if request.subject is not None:
        updates['subject'] = request.subject
    if request.body is not None:
        updates['body'] = request.body
    if request.is_html is not None:
        updates['is_html'] = request.is_html
    if request.description is not None:
        updates['description'] = request.description
    if request.to_addresses is not None:
        updates['to_addresses'] = [a.model_dump() for a in request.to_addresses]
    if request.cc_addresses is not None:
        updates['cc_addresses'] = [a.model_dump() for a in request.cc_addresses]
    if request.category is not None:
        updates['category'] = request.category

    try:
        template = await mail_templates_service.update_template(
            db=db,
            template_id=template_id,
            user_id=UUID(user_id),
            updates=updates
        )

        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found"
            )

        return TemplateResponse(**mail_templates_service.template_to_dict(template))

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{template_id}")
@limiter.limit("20/minute")
async def delete_template(
    request: Request,
    template_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a template."""
    user_id = current_user.get("id") or current_user.get("user_id")

    success = await mail_templates_service.delete_template(
        db=db,
        template_id=template_id,
        user_id=UUID(user_id)
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )

    return {"success": True, "message": "Template deleted"}


@router.post("/{template_id}/duplicate", response_model=TemplateResponse)
@limiter.limit("20/minute")
async def duplicate_template(
    request_obj: Request,
    template_id: UUID,
    request: DuplicateTemplateRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Duplicate an existing template."""
    user_id = current_user.get("id") or current_user.get("user_id")

    template = await mail_templates_service.duplicate_template(
        db=db,
        template_id=template_id,
        user_id=UUID(user_id),
        new_name=request.new_name
    )

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )

    return TemplateResponse(**mail_templates_service.template_to_dict(template))
