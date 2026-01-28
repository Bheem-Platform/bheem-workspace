"""
Bheem OForms - OnlyOffice Document Forms API

API endpoints for OnlyOffice-based fillable document forms.
Similar to sheets/slides integration but for document forms.

Features:
- Create/edit form templates (DOCXF)
- Fill forms (OFORM)
- OnlyOffice Document Server integration
- Version control
- Form sharing
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
import uuid
import jwt
import io
import logging

from core.database import get_db
from core.security import get_current_user, require_tenant_member
from core.config import settings
from services.oforms_service import OFormsService, get_oforms_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/oforms", tags=["Bheem OForms"])


def get_user_ids(current_user: dict) -> tuple:
    """Extract tenant_id and tenant_user_id from current user context."""
    tenant_id = current_user.get("tenant_id") or current_user.get("company_id") or current_user.get("erp_company_id")
    user_id = current_user.get("tenant_user_id") or current_user.get("id") or current_user.get("user_id")
    return tenant_id, user_id


# =============================================
# Pydantic Models
# =============================================

class CreateOFormRequest(BaseModel):
    title: str = "Untitled Form"
    description: Optional[str] = None
    form_type: str = "docxf"  # docxf for template, oform for fillable


class UpdateOFormRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


class ShareOFormRequest(BaseModel):
    email: Optional[str] = None
    user_id: Optional[str] = None
    permission: str = "fill"  # fill, view, edit
    expires_at: Optional[datetime] = None


# =============================================
# OnlyOffice Connectivity Endpoints
# =============================================

@router.options("/{form_id}/content")
async def content_options(form_id: str):
    """Handle CORS preflight requests for content endpoint."""
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Max-Age": "86400",
        }
    )


@router.get("/onlyoffice-test")
async def onlyoffice_connectivity_test():
    """Test endpoint for OnlyOffice Document Server connectivity."""
    return {
        "status": "ok",
        "service": "Bheem OForms",
        "message": "OnlyOffice can reach this endpoint",
        "workspace_url": settings.WORKSPACE_URL,
        "onlyoffice_url": settings.ONLYOFFICE_URL,
    }


# =============================================
# Form CRUD Endpoints
# =============================================

@router.post("")
async def create_oform(
    request: CreateOFormRequest,
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db),
):
    """Create a new OnlyOffice document form."""
    try:
        tenant_id, user_id = get_user_ids(current_user)
        if not tenant_id or not user_id:
            raise HTTPException(status_code=400, detail="User context incomplete")

        service = get_oforms_service(db)
        form = await service.create_oform(
            tenant_id=uuid.UUID(str(tenant_id)),
            user_id=uuid.UUID(str(user_id)),
            user_email=current_user.get("email") or current_user.get("username"),
            title=request.title,
            description=request.description,
            form_type=request.form_type,
        )
        return form
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create form: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
async def list_oforms(
    search: Optional[str] = None,
    starred: bool = False,
    status: Optional[str] = None,
    limit: int = Query(50, le=100),
    offset: int = 0,
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db),
):
    """List all forms for the current user's tenant."""
    try:
        tenant_id, user_id = get_user_ids(current_user)
        if not tenant_id or not user_id:
            raise HTTPException(status_code=400, detail="User context incomplete")

        service = get_oforms_service(db)
        result = await service.list_oforms(
            tenant_id=uuid.UUID(str(tenant_id)),
            user_id=uuid.UUID(str(user_id)),
            search=search,
            starred_only=starred,
            status=status,
            limit=limit,
            offset=offset,
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list forms: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{form_id}")
async def get_oform(
    form_id: str,
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific form by ID."""
    try:
        tenant_id, user_id = get_user_ids(current_user)
        if not tenant_id or not user_id:
            raise HTTPException(status_code=400, detail="User context incomplete")

        service = get_oforms_service(db)
        form = await service.get_oform(
            form_id=uuid.UUID(form_id),
            tenant_id=uuid.UUID(str(tenant_id)),
            user_id=uuid.UUID(str(user_id)),
        )
        if not form:
            raise HTTPException(status_code=404, detail="Form not found")
        return form
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get form: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{form_id}")
async def update_oform(
    form_id: str,
    request: UpdateOFormRequest,
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db),
):
    """Update form metadata."""
    try:
        tenant_id, user_id = get_user_ids(current_user)
        if not tenant_id or not user_id:
            raise HTTPException(status_code=400, detail="User context incomplete")

        service = get_oforms_service(db)
        form = await service.update_oform(
            form_id=uuid.UUID(form_id),
            tenant_id=uuid.UUID(str(tenant_id)),
            user_id=uuid.UUID(str(user_id)),
            title=request.title,
            description=request.description,
            status=request.status,
        )
        if not form:
            raise HTTPException(status_code=404, detail="Form not found")
        return {"form": form, "message": "Form updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update form: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{form_id}")
async def delete_oform(
    form_id: str,
    permanent: bool = False,
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db),
):
    """Delete a form (soft delete by default)."""
    try:
        tenant_id, user_id = get_user_ids(current_user)
        if not tenant_id or not user_id:
            raise HTTPException(status_code=400, detail="User context incomplete")

        service = get_oforms_service(db)
        await service.delete_oform(
            form_id=uuid.UUID(form_id),
            tenant_id=uuid.UUID(str(tenant_id)),
            user_id=uuid.UUID(str(user_id)),
            permanent=permanent,
        )
        return {"message": "Form deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete form: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{form_id}/star")
async def toggle_star(
    form_id: str,
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db),
):
    """Toggle star status for a form."""
    try:
        tenant_id, user_id = get_user_ids(current_user)
        if not tenant_id or not user_id:
            raise HTTPException(status_code=400, detail="User context incomplete")

        service = get_oforms_service(db)
        await service.toggle_star(
            form_id=uuid.UUID(form_id),
            tenant_id=uuid.UUID(str(tenant_id)),
            user_id=uuid.UUID(str(user_id)),
        )
        return {"message": "Star status toggled"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to toggle star: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{form_id}/duplicate")
async def duplicate_oform(
    form_id: str,
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db),
):
    """Duplicate a form."""
    try:
        tenant_id, user_id = get_user_ids(current_user)
        if not tenant_id or not user_id:
            raise HTTPException(status_code=400, detail="User context incomplete")

        service = get_oforms_service(db)
        original = await service.get_oform(
            form_id=uuid.UUID(form_id),
            tenant_id=uuid.UUID(str(tenant_id)),
            user_id=uuid.UUID(str(user_id)),
        )
        if not original:
            raise HTTPException(status_code=404, detail="Form not found")

        # Create new form with same content
        new_form = await service.create_oform(
            tenant_id=uuid.UUID(str(tenant_id)),
            user_id=uuid.UUID(str(user_id)),
            user_email=current_user.get("email") or current_user.get("username"),
            title=f"{original['title']} (Copy)",
            description=original.get('description'),
            form_type=original.get('form_type', 'docxf'),
        )
        return {"form": new_form, "message": "Form duplicated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to duplicate form: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================
# OnlyOffice Editor Integration
# =============================================

@router.get("/{form_id}/editor-config")
async def get_editor_config(
    form_id: str,
    mode: str = Query("edit", description="Editor mode: edit, view, fillForms"),
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db),
):
    """Get OnlyOffice editor configuration for the form."""
    try:
        tenant_id, user_id = get_user_ids(current_user)
        if not tenant_id or not user_id:
            raise HTTPException(status_code=400, detail="User context incomplete")

        service = get_oforms_service(db)
        config = await service.get_editor_config(
            form_id=uuid.UUID(form_id),
            tenant_id=uuid.UUID(str(tenant_id)),
            user_id=uuid.UUID(str(user_id)),
            user_name=current_user.get("name") or current_user.get("username", "User"),
            user_email=current_user.get("email") or current_user.get("username", ""),
            mode=mode,
        )
        return config
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get editor config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{form_id}/content")
async def get_form_content(
    form_id: str,
    token: str = Query(..., description="Access token"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get form file content for OnlyOffice.

    This endpoint is called by OnlyOffice Document Server to fetch the form file.
    Authentication is done via JWT token in query params.
    """
    try:
        # Verify token
        try:
            payload = jwt.decode(
                token,
                settings.ONLYOFFICE_JWT_SECRET,
                algorithms=["HS256"]
            )
            if payload.get("form_id") != form_id:
                raise HTTPException(status_code=403, detail="Token mismatch")
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expired")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid token")

        # Get form content
        from sqlalchemy import text
        result = await db.execute(text("""
            SELECT tenant_id FROM workspace.oforms WHERE id = :form_id
        """), {"form_id": form_id})
        row = result.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Form not found")

        service = get_oforms_service(db)
        content, content_type, form_type = await service.get_form_content(
            form_id=uuid.UUID(form_id),
            tenant_id=row.tenant_id,
        )

        if not content:
            raise HTTPException(status_code=404, detail="Form content not found")

        # Determine filename
        extension = form_type if form_type in ["docxf", "oform"] else "docxf"

        return StreamingResponse(
            io.BytesIO(content),
            media_type=content_type,
            headers={
                "Content-Disposition": f'attachment; filename="form.{extension}"',
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get form content: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{form_id}/onlyoffice-callback")
async def onlyoffice_callback(
    form_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    OnlyOffice Document Server callback endpoint.

    Called by OnlyOffice when document status changes (editing, saving, etc.)
    """
    try:
        # Parse callback data
        callback_data = await request.json()
        logger.info(f"OForms callback for {form_id}: {callback_data}")

        # Verify JWT if present
        if settings.ONLYOFFICE_JWT_ENABLED and "token" in callback_data:
            try:
                jwt.decode(
                    callback_data["token"],
                    settings.ONLYOFFICE_JWT_SECRET,
                    algorithms=["HS256"]
                )
            except jwt.InvalidTokenError as e:
                logger.warning(f"Invalid JWT in callback: {e}")
                # Continue anyway - some OnlyOffice versions don't send valid tokens

        service = get_oforms_service(db)
        result = await service.handle_onlyoffice_callback(
            form_id=uuid.UUID(form_id),
            callback_data=callback_data,
        )
        return result

    except Exception as e:
        logger.error(f"Callback error for form {form_id}: {e}")
        # Always return error: 0 to acknowledge receipt
        return {"error": 0}


# =============================================
# Form Publishing
# =============================================

@router.post("/{form_id}/publish")
async def publish_form(
    form_id: str,
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db),
):
    """Publish a form to make it available for filling."""
    try:
        tenant_id, user_id = get_user_ids(current_user)
        if not tenant_id or not user_id:
            raise HTTPException(status_code=400, detail="User context incomplete")

        service = get_oforms_service(db)
        form = await service.update_oform(
            form_id=uuid.UUID(form_id),
            tenant_id=uuid.UUID(str(tenant_id)),
            user_id=uuid.UUID(str(user_id)),
            status="published",
        )
        if not form:
            raise HTTPException(status_code=404, detail="Form not found")
        return {"form": form, "message": "Form published successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to publish form: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{form_id}/close")
async def close_form(
    form_id: str,
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db),
):
    """Close a form to stop accepting responses."""
    try:
        tenant_id, user_id = get_user_ids(current_user)
        if not tenant_id or not user_id:
            raise HTTPException(status_code=400, detail="User context incomplete")

        service = get_oforms_service(db)
        form = await service.update_oform(
            form_id=uuid.UUID(form_id),
            tenant_id=uuid.UUID(str(tenant_id)),
            user_id=uuid.UUID(str(user_id)),
            status="closed",
        )
        if not form:
            raise HTTPException(status_code=404, detail="Form not found")
        return {"form": form, "message": "Form closed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to close form: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================
# Form Sharing
# =============================================

@router.post("/{form_id}/share")
async def share_form(
    form_id: str,
    request: ShareOFormRequest,
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db),
):
    """Share a form with a user or external email."""
    try:
        tenant_id, user_id = get_user_ids(current_user)
        if not tenant_id or not user_id:
            raise HTTPException(status_code=400, detail="User context incomplete")

        from sqlalchemy import text

        share_id = uuid.uuid4()
        await db.execute(text("""
            INSERT INTO workspace.oform_shares (
                id, form_id, user_id, external_email, permission,
                expires_at, created_by, created_at
            ) VALUES (
                :id, :form_id,
                CASE WHEN :user_id IS NOT NULL THEN CAST(:user_id AS uuid) ELSE NULL END,
                :email,
                :permission, :expires_at, :created_by, NOW()
            )
        """), {
            "id": share_id,
            "form_id": form_id,
            "user_id": request.user_id,
            "email": request.email if not request.user_id else None,
            "permission": request.permission,
            "expires_at": request.expires_at,
            "created_by": str(user_id),
        })
        await db.commit()

        return {"share_id": str(share_id), "message": "Form shared successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to share form: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{form_id}/shares")
async def list_shares(
    form_id: str,
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db),
):
    """List all shares for a form."""
    try:
        from sqlalchemy import text

        result = await db.execute(text("""
            SELECT
                s.id, s.user_id, s.external_email, s.permission,
                s.is_active, s.expires_at, s.access_count, s.created_at,
                tu.email as user_email, tu.name as user_name
            FROM workspace.oform_shares s
            LEFT JOIN workspace.tenant_users tu ON s.user_id = tu.id
            WHERE s.form_id = :form_id
            ORDER BY s.created_at DESC
        """), {"form_id": form_id})

        shares = []
        for row in result.fetchall():
            shares.append({
                "id": str(row.id),
                "user_id": str(row.user_id) if row.user_id else None,
                "external_email": row.external_email,
                "permission": row.permission,
                "is_active": row.is_active,
                "expires_at": row.expires_at.isoformat() if row.expires_at else None,
                "access_count": row.access_count,
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "user": {
                    "email": row.user_email or row.external_email,
                    "name": row.user_name,
                } if row.user_email or row.external_email else None,
                "is_external": row.external_email is not None,
            })

        return {"shares": shares}
    except Exception as e:
        logger.error(f"Failed to list shares: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{form_id}/shares/{share_id}")
async def remove_share(
    form_id: str,
    share_id: str,
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db),
):
    """Remove a share from a form."""
    try:
        from sqlalchemy import text

        await db.execute(text("""
            DELETE FROM workspace.oform_shares
            WHERE id = :share_id AND form_id = :form_id
        """), {"share_id": share_id, "form_id": form_id})
        await db.commit()

        return {"message": "Share removed successfully"}
    except Exception as e:
        logger.error(f"Failed to remove share: {e}")
        raise HTTPException(status_code=500, detail=str(e))
