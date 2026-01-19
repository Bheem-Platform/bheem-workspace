"""
Bheem Sheets - Spreadsheet API
Google Sheets-like spreadsheet functionality with OnlyOffice integration

Features:
- XLSX file-based storage (S3)
- OnlyOffice Document Server for real-time editing
- Version control
- ERP entity linking (internal mode)
- Sharing and collaboration
"""
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, Request
from pydantic import BaseModel, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import uuid
import json

from core.database import get_db
from core.security import get_current_user, require_tenant_admin
from core.config import settings
from services.spreadsheet_service import SpreadsheetService, SpreadsheetMode, get_spreadsheet_service
import logging
from uuid import UUID

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sheets", tags=["Bheem Sheets"])


# =============================================
# OnlyOffice Connectivity Endpoints
# =============================================

@router.options("/{sheet_id}/content")
async def content_options(sheet_id: str):
    """Handle CORS preflight requests for content endpoint."""
    from fastapi.responses import Response
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
    """
    Test endpoint for OnlyOffice Document Server connectivity.

    OnlyOffice server should be able to reach this endpoint.
    Use this to verify network connectivity between OnlyOffice and our backend.
    """
    return {
        "status": "ok",
        "service": "Bheem Sheets",
        "message": "OnlyOffice can reach this endpoint",
        "workspace_url": settings.WORKSPACE_URL,
        "onlyoffice_url": settings.ONLYOFFICE_URL,
    }


async def ensure_tenant_and_user_exist(db: AsyncSession, tenant_id: str, user_id: str, company_code: str = None, user_email: str = None, user_name: str = None) -> None:
    """Ensure tenant and user records exist for ERP users.

    ERP users have company_id/user_id but no workspace.tenants or tenant_users records.
    This function creates them if needed.
    """
    # Ensure tenant exists
    try:
        result = await db.execute(text("""
            SELECT id FROM workspace.tenants WHERE id = CAST(:tenant_id AS uuid)
        """), {"tenant_id": tenant_id})
        if not result.fetchone():
            # Create tenant for ERP company
            org_name = f"Organization {company_code or 'ERP'}"
            base_slug = (company_code or "erp").lower().replace(" ", "-")
            slug = f"{base_slug}-{tenant_id[:8]}"
            owner_email = user_email or f"admin@{base_slug}.local"
            await db.execute(text("""
                INSERT INTO workspace.tenants (id, name, slug, owner_email, created_at, updated_at)
                VALUES (CAST(:id AS uuid), :name, :slug, :owner_email, NOW(), NOW())
                ON CONFLICT (id) DO NOTHING
            """), {"id": tenant_id, "name": org_name, "slug": slug, "owner_email": owner_email})
            await db.commit()
            logger.info(f"Created tenant {tenant_id} for ERP company {company_code}")
    except Exception as e:
        logger.warning(f"Could not create/check tenant: {e}")
        try:
            await db.rollback()
        except:
            pass

    # Ensure user exists in tenant_users
    try:
        result = await db.execute(text("""
            SELECT id FROM workspace.tenant_users WHERE id = CAST(:user_id AS uuid)
        """), {"user_id": user_id})
        if not result.fetchone():
            # Create user record - tenant_users has both id and user_id columns
            display_name = user_name or user_email or "ERP User"
            await db.execute(text("""
                INSERT INTO workspace.tenant_users (id, user_id, tenant_id, email, name, role, created_at, updated_at)
                VALUES (CAST(:user_id AS uuid), CAST(:user_id AS uuid), CAST(:tenant_id AS uuid), :email, :name, 'admin', NOW(), NOW())
                ON CONFLICT (id) DO NOTHING
            """), {"user_id": user_id, "tenant_id": tenant_id, "email": user_email, "name": display_name})
            await db.commit()
            logger.info(f"Created tenant_user {user_id} for tenant {tenant_id}")
    except Exception as e:
        logger.warning(f"Could not create/check user: {e}")
        try:
            await db.rollback()
        except:
            pass


def get_user_ids(current_user: dict) -> tuple:
    """Extract tenant_id and user_id from current user context.

    tenant_id can come from:
    - company_id (ERP users)
    - erp_company_id (external users)
    - tenant_id (workspace users)
    """
    tenant_id = current_user.get("tenant_id") or current_user.get("company_id") or current_user.get("erp_company_id")
    user_id = current_user.get("id") or current_user.get("user_id")

    if not tenant_id or not user_id:
        raise HTTPException(
            status_code=400,
            detail="User context incomplete - missing tenant_id or user_id"
        )

    # Convert to string for SQL queries
    if isinstance(tenant_id, UUID):
        tenant_id = str(tenant_id)
    if isinstance(user_id, UUID):
        user_id = str(user_id)

    return tenant_id, user_id


async def get_user_ids_with_tenant(current_user: dict, db: AsyncSession) -> tuple:
    """Extract user IDs and ensure tenant and user exist for ERP users."""
    tenant_id, user_id = get_user_ids(current_user)
    company_code = current_user.get("company_code")
    user_email = current_user.get("username") or current_user.get("email")
    user_name = current_user.get("name") or current_user.get("full_name")

    # Ensure tenant and user exist (creates for ERP users if needed)
    await ensure_tenant_and_user_exist(db, tenant_id, user_id, company_code, user_email, user_name)

    return tenant_id, user_id


# =============================================
# Models
# =============================================

class SheetCreate(BaseModel):
    title: str
    description: Optional[str] = None
    folder_id: Optional[str] = None
    template_id: Optional[str] = None

    @validator('title')
    def validate_title(cls, v):
        if not v or len(v.strip()) < 1:
            raise ValueError('Title is required')
        if len(v) > 255:
            raise ValueError('Title too long')
        return v.strip()


class SheetUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    is_starred: Optional[bool] = None


class SheetData(BaseModel):
    """Cell and row data for a sheet"""
    cells: Dict[str, Dict[str, Any]]  # { "A1": { "value": "Hello", "format": {} }, ... }
    merged_cells: Optional[List[Dict]] = None
    row_heights: Optional[Dict[str, int]] = None
    column_widths: Optional[Dict[str, int]] = None


class WorksheetCreate(BaseModel):
    name: str
    index: Optional[int] = None


class CellUpdate(BaseModel):
    cell_ref: str  # e.g., "A1", "B2:D5"
    value: Any
    formula: Optional[str] = None
    format: Optional[Dict[str, Any]] = None


class BulkCellUpdate(BaseModel):
    worksheet_id: str
    updates: List[CellUpdate]


class ShareRequest(BaseModel):
    email: str
    permission: str = "view"  # view, edit, comment
    notify: bool = True


# =============================================
# Spreadsheet Endpoints
# =============================================

@router.get("")
async def list_sheets(
    folder_id: Optional[str] = Query(None),
    starred: bool = Query(False, alias="starred"),
    starred_only: bool = Query(False),
    search: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """List spreadsheets accessible by the user"""
    tenant_id, user_id = get_user_ids(current_user)
    # Support both 'starred' and 'starred_only' parameters
    filter_starred = starred or starred_only

    query = """
        SELECT
            s.id, s.title, s.description, s.is_starred, s.folder_id,
            s.created_at, s.updated_at, s.created_by,
            u.name as owner_name,
            (SELECT COUNT(*) FROM workspace.worksheets ws WHERE ws.spreadsheet_id = s.id) as worksheet_count
        FROM workspace.spreadsheets s
        LEFT JOIN workspace.tenant_users u ON s.created_by = u.id
        LEFT JOIN workspace.spreadsheet_shares ss ON s.id = ss.spreadsheet_id AND ss.user_id = CAST(:user_id AS uuid)
        WHERE (s.created_by = CAST(:user_id AS uuid) OR ss.user_id IS NOT NULL)
        AND s.tenant_id = CAST(:tenant_id AS uuid)
        AND s.is_deleted = FALSE
    """
    params = {"user_id": user_id, "tenant_id": tenant_id, "limit": limit, "offset": offset}

    if folder_id:
        query += " AND s.folder_id = CAST(:folder_id AS uuid)"
        params["folder_id"] = folder_id

    if filter_starred:
        query += " AND s.is_starred = TRUE"

    if search:
        query += " AND s.title ILIKE :search"
        params["search"] = f"%{search}%"

    query += " ORDER BY s.updated_at DESC LIMIT :limit OFFSET :offset"

    result = await db.execute(text(query), params)
    sheets = result.fetchall()

    return {
        "spreadsheets": [
            {
                "id": str(s.id),
                "title": s.title,
                "description": s.description,
                "is_starred": s.is_starred,
                "folder_id": str(s.folder_id) if s.folder_id else None,
                "worksheet_count": s.worksheet_count,
                "owner": {
                    "id": str(s.created_by),
                    "name": s.owner_name
                },
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "updated_at": s.updated_at.isoformat() if s.updated_at else None
            }
            for s in sheets
        ],
        "count": len(sheets)
    }


@router.post("")
async def create_sheet(
    data: SheetCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Create a new spreadsheet"""
    tenant_id, user_id = await get_user_ids_with_tenant(current_user, db)
    sheet_id = str(uuid.uuid4())

    # Create spreadsheet
    await db.execute(text("""
        INSERT INTO workspace.spreadsheets
        (id, tenant_id, title, description, folder_id, created_by, created_at, updated_at)
        VALUES (
            CAST(:id AS uuid),
            CAST(:tenant_id AS uuid),
            :title,
            :description,
            CAST(:folder_id AS uuid),
            CAST(:created_by AS uuid),
            NOW(),
            NOW()
        )
    """), {
        "id": sheet_id,
        "tenant_id": tenant_id,
        "title": data.title,
        "description": data.description,
        "folder_id": data.folder_id,
        "created_by": user_id
    })

    # Create default worksheet (Sheet1)
    worksheet_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO workspace.worksheets
        (id, spreadsheet_id, name, sheet_index, data, created_at, updated_at)
        VALUES (
            CAST(:id AS uuid),
            CAST(:spreadsheet_id AS uuid),
            'Sheet1',
            0,
            :data,
            NOW(),
            NOW()
        )
    """), {
        "id": worksheet_id,
        "spreadsheet_id": sheet_id,
        "data": json.dumps({
            "cells": {},
            "row_heights": {},
            "column_widths": {},
            "merged_cells": []
        })
    })

    await db.commit()

    logger.info(f"Created spreadsheet {data.title} ({sheet_id}) by user {user_id}")

    return {
        "id": sheet_id,
        "title": data.title,
        "default_worksheet_id": worksheet_id,
        "message": "Spreadsheet created successfully"
    }


# =============================================
# OnlyOffice V2 Endpoints (must be before /{sheet_id} routes)
# =============================================

class CreateSpreadsheetV2(BaseModel):
    """Enhanced spreadsheet creation with OnlyOffice support"""
    title: str
    description: Optional[str] = None
    folder_id: Optional[str] = None
    template_id: Optional[str] = None
    linked_entity_type: Optional[str] = None  # For ERP linking (internal mode)
    linked_entity_id: Optional[str] = None

    @validator('title')
    def validate_title_v2(cls, v):
        if not v or len(v.strip()) < 1:
            raise ValueError('Title is required')
        if len(v) > 255:
            raise ValueError('Title too long')
        return v.strip()


@router.post("/v2", response_model=Dict[str, Any])
async def create_spreadsheet_v2(
    data: CreateSpreadsheetV2,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Create a new spreadsheet with OnlyOffice support.

    This endpoint creates an XLSX file in S3 storage and returns
    the configuration needed for OnlyOffice editing.

    For internal mode (ERP users), you can optionally link the
    spreadsheet to an ERP entity like an invoice or purchase order.
    """
    tenant_id, user_id = await get_user_ids_with_tenant(current_user, db)

    # Determine mode from user context
    tenant_mode = current_user.get("tenant_mode", "external")
    mode = SpreadsheetMode.INTERNAL if tenant_mode == "internal" else SpreadsheetMode.EXTERNAL

    # Get company_id for internal mode
    company_id = current_user.get("company_id") if mode == SpreadsheetMode.INTERNAL else None

    service = get_spreadsheet_service(db)

    try:
        result = await service.create_spreadsheet(
            title=data.title,
            mode=mode,
            tenant_id=UUID(tenant_id),
            user_id=UUID(user_id),
            company_id=UUID(company_id) if company_id else None,
            description=data.description,
            folder_id=UUID(data.folder_id) if data.folder_id else None,
            template_id=data.template_id,
            linked_entity_type=data.linked_entity_type,
            linked_entity_id=UUID(data.linked_entity_id) if data.linked_entity_id else None,
        )

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to create spreadsheet: {e}")
        raise HTTPException(status_code=500, detail="Failed to create spreadsheet")


@router.get("/{sheet_id}")
async def get_sheet(
    sheet_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get spreadsheet details with worksheets"""
    tenant_id, user_id = get_user_ids(current_user)

    # Get spreadsheet
    result = await db.execute(text("""
        SELECT
            s.id, s.title, s.description, s.is_starred, s.folder_id,
            s.created_at, s.updated_at, s.created_by,
            u.name as owner_name, u.email as owner_email,
            COALESCE(ss.permission, CASE WHEN s.created_by = CAST(:user_id AS uuid) THEN 'owner' ELSE NULL END) as permission
        FROM workspace.spreadsheets s
        LEFT JOIN workspace.tenant_users u ON s.created_by = u.id
        LEFT JOIN workspace.spreadsheet_shares ss ON s.id = ss.spreadsheet_id AND ss.user_id = CAST(:user_id AS uuid)
        WHERE s.id = CAST(:sheet_id AS uuid)
        AND s.tenant_id = CAST(:tenant_id AS uuid)
        AND s.is_deleted = FALSE
        AND (s.created_by = CAST(:user_id AS uuid) OR ss.user_id IS NOT NULL)
    """), {"sheet_id": sheet_id, "user_id": user_id, "tenant_id": tenant_id})

    sheet = result.fetchone()
    if not sheet:
        raise HTTPException(status_code=404, detail="Spreadsheet not found")

    # Get worksheets
    worksheets_result = await db.execute(text("""
        SELECT id, name, sheet_index, row_count, column_count, color
        FROM workspace.worksheets
        WHERE spreadsheet_id = CAST(:sheet_id AS uuid)
        ORDER BY sheet_index
    """), {"sheet_id": sheet_id})

    worksheets = worksheets_result.fetchall()

    return {
        "id": str(sheet.id),
        "title": sheet.title,
        "description": sheet.description,
        "is_starred": sheet.is_starred,
        "folder_id": str(sheet.folder_id) if sheet.folder_id else None,
        "permission": sheet.permission,
        "owner": {
            "id": str(sheet.created_by),
            "name": sheet.owner_name,
            "email": sheet.owner_email
        },
        "worksheets": [
            {
                "id": str(ws.id),
                "name": ws.name,
                "index": ws.sheet_index,
                "row_count": ws.row_count or 1000,
                "column_count": ws.column_count or 26,
                "color": ws.color
            }
            for ws in worksheets
        ],
        "created_at": sheet.created_at.isoformat() if sheet.created_at else None,
        "updated_at": sheet.updated_at.isoformat() if sheet.updated_at else None
    }


@router.put("/{sheet_id}")
async def update_sheet(
    sheet_id: str,
    data: SheetUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Update spreadsheet metadata"""
    tenant_id, user_id = get_user_ids(current_user)

    # Verify access
    existing = await db.execute(text("""
        SELECT id FROM workspace.spreadsheets
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
        AND is_deleted = FALSE
        AND (created_by = CAST(:user_id AS uuid) OR id IN (
            SELECT spreadsheet_id FROM workspace.spreadsheet_shares
            WHERE user_id = CAST(:user_id AS uuid) AND permission = 'edit'
        ))
    """), {"id": sheet_id, "user_id": user_id, "tenant_id": tenant_id})

    if not existing.fetchone():
        raise HTTPException(status_code=404, detail="Spreadsheet not found or no edit permission")

    updates = ["updated_at = NOW()"]
    params = {"id": sheet_id}

    if data.title is not None:
        updates.append("title = :title")
        params["title"] = data.title

    if data.description is not None:
        updates.append("description = :description")
        params["description"] = data.description

    if data.is_starred is not None:
        updates.append("is_starred = :is_starred")
        params["is_starred"] = data.is_starred

    query = f"UPDATE workspace.spreadsheets SET {', '.join(updates)} WHERE id = CAST(:id AS uuid)"
    await db.execute(text(query), params)
    await db.commit()

    return {"id": sheet_id, "message": "Spreadsheet updated successfully"}


@router.delete("/{sheet_id}")
async def delete_sheet(
    sheet_id: str,
    permanent: bool = Query(False),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Delete a spreadsheet (soft delete by default)"""
    tenant_id, user_id = get_user_ids(current_user)

    # Verify ownership
    existing = await db.execute(text("""
        SELECT id, title FROM workspace.spreadsheets
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
        AND created_by = CAST(:user_id AS uuid)
    """), {"id": sheet_id, "user_id": user_id, "tenant_id": tenant_id})

    sheet = existing.fetchone()
    if not sheet:
        raise HTTPException(status_code=404, detail="Spreadsheet not found or not owner")

    if permanent:
        # Delete worksheets first
        await db.execute(text("""
            DELETE FROM workspace.worksheets WHERE spreadsheet_id = CAST(:id AS uuid)
        """), {"id": sheet_id})
        # Delete shares
        await db.execute(text("""
            DELETE FROM workspace.spreadsheet_shares WHERE spreadsheet_id = CAST(:id AS uuid)
        """), {"id": sheet_id})
        # Delete spreadsheet
        await db.execute(text("""
            DELETE FROM workspace.spreadsheets WHERE id = CAST(:id AS uuid)
        """), {"id": sheet_id})
    else:
        # Soft delete
        await db.execute(text("""
            UPDATE workspace.spreadsheets
            SET is_deleted = TRUE, deleted_at = NOW()
            WHERE id = CAST(:id AS uuid)
        """), {"id": sheet_id})

    await db.commit()

    return {"message": f"Spreadsheet '{sheet.title}' deleted successfully"}


@router.post("/{sheet_id}/star")
async def toggle_star(
    sheet_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Toggle star status of a spreadsheet"""
    tenant_id, user_id = get_user_ids(current_user)

    # Get current star status
    result = await db.execute(text("""
        SELECT id, is_starred FROM workspace.spreadsheets
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
        AND (created_by = CAST(:user_id AS uuid) OR EXISTS (
            SELECT 1 FROM workspace.spreadsheet_shares
            WHERE spreadsheet_id = CAST(:id AS uuid) AND user_id = CAST(:user_id AS uuid)
        ))
    """), {"id": sheet_id, "user_id": user_id, "tenant_id": tenant_id})

    sheet = result.fetchone()
    if not sheet:
        raise HTTPException(status_code=404, detail="Spreadsheet not found")

    new_status = not sheet.is_starred

    await db.execute(text("""
        UPDATE workspace.spreadsheets
        SET is_starred = :starred, updated_at = NOW()
        WHERE id = CAST(:id AS uuid)
    """), {"id": sheet_id, "starred": new_status})

    await db.commit()

    return {"id": sheet_id, "is_starred": new_status}


@router.post("/{sheet_id}/duplicate")
async def duplicate_spreadsheet(
    sheet_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Duplicate a spreadsheet"""
    tenant_id, user_id = get_user_ids(current_user)

    # Get original spreadsheet
    result = await db.execute(text("""
        SELECT id, title, description FROM workspace.spreadsheets
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
        AND (created_by = CAST(:user_id AS uuid) OR EXISTS (
            SELECT 1 FROM workspace.spreadsheet_shares
            WHERE spreadsheet_id = CAST(:id AS uuid) AND user_id = CAST(:user_id AS uuid)
        ))
    """), {"id": sheet_id, "user_id": user_id, "tenant_id": tenant_id})

    original = result.fetchone()
    if not original:
        raise HTTPException(status_code=404, detail="Spreadsheet not found")

    import uuid as uuid_module
    new_id = str(uuid_module.uuid4())
    new_title = f"Copy of {original.title}"

    # Create copy
    await db.execute(text("""
        INSERT INTO workspace.spreadsheets
        (id, tenant_id, title, description, created_by, created_at, updated_at)
        VALUES (
            CAST(:id AS uuid), CAST(:tenant_id AS uuid), :title, :description,
            CAST(:user_id AS uuid), NOW(), NOW()
        )
    """), {
        "id": new_id,
        "tenant_id": tenant_id,
        "title": new_title,
        "description": original.description,
        "user_id": user_id
    })

    # Copy worksheets
    worksheets = await db.execute(text("""
        SELECT id, name, sheet_index, data FROM workspace.worksheets
        WHERE spreadsheet_id = CAST(:id AS uuid)
    """), {"id": sheet_id})

    for ws in worksheets.fetchall():
        ws_new_id = str(uuid_module.uuid4())
        await db.execute(text("""
            INSERT INTO workspace.worksheets
            (id, spreadsheet_id, name, sheet_index, data, created_at, updated_at)
            VALUES (
                CAST(:id AS uuid), CAST(:spreadsheet_id AS uuid), :name, :index, :data, NOW(), NOW()
            )
        """), {
            "id": ws_new_id,
            "spreadsheet_id": new_id,
            "name": ws.name,
            "index": ws.sheet_index,
            "data": ws.data
        })

    await db.commit()

    return {
        "spreadsheet": {
            "id": new_id,
            "title": new_title,
            "description": original.description
        },
        "message": "Spreadsheet duplicated successfully"
    }


# =============================================
# Worksheet Endpoints
# =============================================

@router.post("/{sheet_id}/worksheets")
async def create_worksheet(
    sheet_id: str,
    data: WorksheetCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Add a new worksheet to a spreadsheet"""
    user_id = current_user.get("id") or current_user.get("user_id")

    # Verify access
    sheet = await _verify_sheet_access(db, sheet_id, user_id, "edit")
    if not sheet:
        raise HTTPException(status_code=404, detail="Spreadsheet not found")

    # Get next index
    if data.index is None:
        count_result = await db.execute(text("""
            SELECT COALESCE(MAX(sheet_index), -1) + 1 as next_index
            FROM workspace.worksheets
            WHERE spreadsheet_id = CAST(:sheet_id AS uuid)
        """), {"sheet_id": sheet_id})
        next_index = count_result.fetchone().next_index
    else:
        next_index = data.index

    worksheet_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO workspace.worksheets
        (id, spreadsheet_id, name, sheet_index, data, created_at, updated_at)
        VALUES (
            CAST(:id AS uuid),
            CAST(:sheet_id AS uuid),
            :name,
            :index,
            :data,
            NOW(),
            NOW()
        )
    """), {
        "id": worksheet_id,
        "sheet_id": sheet_id,
        "name": data.name,
        "index": next_index,
        "data": json.dumps({"cells": {}, "row_heights": {}, "column_widths": {}, "merged_cells": []})
    })

    await db.commit()

    return {
        "id": worksheet_id,
        "name": data.name,
        "index": next_index,
        "message": "Worksheet created successfully"
    }


@router.get("/{sheet_id}/worksheets/{worksheet_id}")
async def get_worksheet_data(
    sheet_id: str,
    worksheet_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get worksheet data including cells"""
    user_id = current_user.get("id") or current_user.get("user_id")

    # Verify access
    sheet = await _verify_sheet_access(db, sheet_id, user_id, "view")
    if not sheet:
        raise HTTPException(status_code=404, detail="Spreadsheet not found")

    result = await db.execute(text("""
        SELECT id, name, sheet_index, data, row_count, column_count, color
        FROM workspace.worksheets
        WHERE id = CAST(:worksheet_id AS uuid)
        AND spreadsheet_id = CAST(:sheet_id AS uuid)
    """), {"worksheet_id": worksheet_id, "sheet_id": sheet_id})

    worksheet = result.fetchone()
    if not worksheet:
        raise HTTPException(status_code=404, detail="Worksheet not found")

    data = worksheet.data or {}

    return {
        "id": str(worksheet.id),
        "name": worksheet.name,
        "index": worksheet.sheet_index,
        "row_count": worksheet.row_count or 1000,
        "column_count": worksheet.column_count or 26,
        "color": worksheet.color,
        "cells": data.get("cells", {}),
        "row_heights": data.get("row_heights", {}),
        "column_widths": data.get("column_widths", {}),
        "merged_cells": data.get("merged_cells", [])
    }


@router.put("/{sheet_id}/worksheets/{worksheet_id}/cells")
async def update_cells(
    sheet_id: str,
    worksheet_id: str,
    data: BulkCellUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Update multiple cells in a worksheet"""
    user_id = current_user.get("id") or current_user.get("user_id")

    # Verify access
    sheet = await _verify_sheet_access(db, sheet_id, user_id, "edit")
    if not sheet:
        raise HTTPException(status_code=404, detail="Spreadsheet not found or no edit permission")

    # Get current worksheet data
    result = await db.execute(text("""
        SELECT data FROM workspace.worksheets
        WHERE id = CAST(:worksheet_id AS uuid)
        AND spreadsheet_id = CAST(:sheet_id AS uuid)
    """), {"worksheet_id": worksheet_id, "sheet_id": sheet_id})

    worksheet = result.fetchone()
    if not worksheet:
        raise HTTPException(status_code=404, detail="Worksheet not found")

    current_data = worksheet.data or {"cells": {}, "row_heights": {}, "column_widths": {}, "merged_cells": []}

    # Apply updates
    for update in data.updates:
        cell_data = {
            "value": update.value,
            "formula": update.formula,
            "format": update.format or {}
        }
        current_data["cells"][update.cell_ref] = cell_data

    # Save updated data
    await db.execute(text("""
        UPDATE workspace.worksheets
        SET data = :data, updated_at = NOW()
        WHERE id = CAST(:worksheet_id AS uuid)
    """), {"worksheet_id": worksheet_id, "data": json.dumps(current_data)})

    # Update spreadsheet timestamp
    await db.execute(text("""
        UPDATE workspace.spreadsheets SET updated_at = NOW() WHERE id = CAST(:id AS uuid)
    """), {"id": sheet_id})

    await db.commit()

    return {
        "worksheet_id": worksheet_id,
        "cells_updated": len(data.updates),
        "message": "Cells updated successfully"
    }


@router.delete("/{sheet_id}/worksheets/{worksheet_id}")
async def delete_worksheet(
    sheet_id: str,
    worksheet_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Delete a worksheet"""
    user_id = current_user.get("id") or current_user.get("user_id")

    # Verify access
    sheet = await _verify_sheet_access(db, sheet_id, user_id, "edit")
    if not sheet:
        raise HTTPException(status_code=404, detail="Spreadsheet not found")

    # Check worksheet count
    count_result = await db.execute(text("""
        SELECT COUNT(*) as count FROM workspace.worksheets
        WHERE spreadsheet_id = CAST(:sheet_id AS uuid)
    """), {"sheet_id": sheet_id})
    count = count_result.fetchone().count

    if count <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the only worksheet")

    # Delete worksheet
    await db.execute(text("""
        DELETE FROM workspace.worksheets
        WHERE id = CAST(:worksheet_id AS uuid)
        AND spreadsheet_id = CAST(:sheet_id AS uuid)
    """), {"worksheet_id": worksheet_id, "sheet_id": sheet_id})

    await db.commit()

    return {"message": "Worksheet deleted successfully"}


# =============================================
# Sharing Endpoints
# =============================================

@router.get("/{sheet_id}/shares")
async def get_sheet_shares(
    sheet_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get sharing settings for a spreadsheet"""
    user_id = current_user.get("id") or current_user.get("user_id")

    sheet = await _verify_sheet_access(db, sheet_id, user_id, "view")
    if not sheet:
        raise HTTPException(status_code=404, detail="Spreadsheet not found")

    result = await db.execute(text("""
        SELECT ss.id, ss.permission, ss.created_at,
               u.id as user_id, u.email, u.name
        FROM workspace.spreadsheet_shares ss
        JOIN workspace.tenant_users u ON ss.user_id = u.id
        WHERE ss.spreadsheet_id = CAST(:sheet_id AS uuid)
        ORDER BY ss.created_at DESC
    """), {"sheet_id": sheet_id})

    shares = result.fetchall()

    return {
        "shares": [
            {
                "id": str(s.id),
                "user": {
                    "id": str(s.user_id),
                    "email": s.email,
                    "name": s.name
                },
                "permission": s.permission,
                "created_at": s.created_at.isoformat() if s.created_at else None
            }
            for s in shares
        ]
    }


@router.post("/{sheet_id}/shares")
async def share_sheet(
    sheet_id: str,
    data: ShareRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Share a spreadsheet with another user"""
    tenant_id, user_id = get_user_ids(current_user)

    # Verify ownership
    sheet = await db.execute(text("""
        SELECT id, title FROM workspace.spreadsheets
        WHERE id = CAST(:id AS uuid) AND created_by = CAST(:user_id AS uuid)
    """), {"id": sheet_id, "user_id": user_id})

    if not sheet.fetchone():
        raise HTTPException(status_code=403, detail="Only the owner can share this spreadsheet")

    # Find target user
    target_user = await db.execute(text("""
        SELECT id, name FROM workspace.tenant_users
        WHERE email = :email AND tenant_id = CAST(:tenant_id AS uuid)
    """), {"email": data.email, "tenant_id": tenant_id})

    target = target_user.fetchone()
    if not target:
        raise HTTPException(status_code=404, detail="User not found in workspace")

    # Create or update share
    share_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO workspace.spreadsheet_shares
        (id, spreadsheet_id, user_id, permission, created_by, created_at)
        VALUES (
            CAST(:id AS uuid),
            CAST(:sheet_id AS uuid),
            CAST(:target_id AS uuid),
            :permission,
            CAST(:created_by AS uuid),
            NOW()
        )
        ON CONFLICT (spreadsheet_id, user_id)
        DO UPDATE SET permission = :permission
    """), {
        "id": share_id,
        "sheet_id": sheet_id,
        "target_id": str(target.id),
        "permission": data.permission,
        "created_by": user_id
    })

    await db.commit()

    return {
        "message": f"Spreadsheet shared with {target.name}",
        "permission": data.permission
    }


# =============================================
# Helper Functions
# =============================================

async def _verify_sheet_access(
    db: AsyncSession,
    sheet_id: str,
    user_id: str,
    required_permission: str
) -> Optional[Any]:
    """Verify user has required access to spreadsheet"""
    result = await db.execute(text("""
        SELECT s.id, s.created_by,
            COALESCE(ss.permission, CASE WHEN s.created_by = CAST(:user_id AS uuid) THEN 'owner' ELSE NULL END) as permission
        FROM workspace.spreadsheets s
        LEFT JOIN workspace.spreadsheet_shares ss ON s.id = ss.spreadsheet_id AND ss.user_id = CAST(:user_id AS uuid)
        WHERE s.id = CAST(:sheet_id AS uuid)
        AND s.is_deleted = FALSE
        AND (s.created_by = CAST(:user_id AS uuid) OR ss.user_id IS NOT NULL)
    """), {"sheet_id": sheet_id, "user_id": user_id})

    sheet = result.fetchone()
    if not sheet:
        return None

    permission = sheet.permission
    if required_permission == "view":
        return sheet  # Any permission allows view
    elif required_permission == "edit":
        if permission in ['owner', 'edit']:
            return sheet
    elif required_permission == "owner":
        if permission == 'owner':
            return sheet

    return None


# =============================================
# OnlyOffice Integration Endpoints (additional)
# =============================================

class EntityLinkRequest(BaseModel):
    """Request to link spreadsheet to ERP entity"""
    entity_type: str  # SALES_INVOICE, PURCHASE_ORDER, etc.
    entity_id: str


class RestoreVersionRequest(BaseModel):
    """Request to restore a version"""
    version_number: int


@router.get("/{sheet_id}/editor-config")
async def get_editor_config(
    sheet_id: str,
    mode: str = Query("edit", description="Editor mode: edit, view, or review"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get OnlyOffice Document Editor configuration.

    Returns the configuration object needed to initialize the
    OnlyOffice editor in the frontend.

    The config includes:
    - document: File info (URL, key, permissions)
    - editorConfig: Editor settings (callback URL, user info, customization)
    - token: JWT for OnlyOffice authentication (if enabled)

    Example usage in frontend:
    ```javascript
    const docEditor = new DocsAPI.DocEditor("editor-container", config);
    ```
    """
    tenant_id, user_id = get_user_ids(current_user)

    # Get user info for collaboration
    user_name = current_user.get("name") or current_user.get("username") or "User"
    user_email = current_user.get("email", "")

    service = get_spreadsheet_service(db)

    try:
        result = await service.get_editor_config(
            spreadsheet_id=UUID(sheet_id),
            tenant_id=UUID(tenant_id),
            user_id=UUID(user_id),
            user_name=user_name,
            user_email=user_email,
            mode=mode,
        )

        return result

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to get editor config: {e}")
        raise HTTPException(status_code=500, detail="Failed to get editor configuration")


@router.post("/{sheet_id}/onlyoffice-callback")
async def onlyoffice_callback(
    sheet_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> Dict[str, int]:
    """
    Handle OnlyOffice Document Server callback.

    This endpoint is called by OnlyOffice when:
    - Users are editing (status=1)
    - Document is ready for saving (status=2)
    - Document saving error (status=3)
    - Document closed without changes (status=4)
    - Force save requested (status=6)

    The endpoint downloads the edited document from OnlyOffice,
    uploads the new version to S3, and updates the database.

    Note: This endpoint should be accessible by the OnlyOffice server.
    JWT validation is handled if ONLYOFFICE_JWT_ENABLED is true.
    """
    try:
        callback_data = await request.json()
        logger.info(f"OnlyOffice callback for {sheet_id}: {callback_data.get('status')}")

        service = get_spreadsheet_service(db)
        result = await service.handle_onlyoffice_callback(
            spreadsheet_id=UUID(sheet_id),
            callback_data=callback_data,
        )

        return result

    except Exception as e:
        logger.error(f"OnlyOffice callback error: {e}")
        return {"error": 1}


@router.get("/{sheet_id}/versions")
async def get_versions(
    sheet_id: str,
    limit: int = Query(20, le=100),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get version history for a spreadsheet.

    Returns a list of all versions with metadata including:
    - version_number
    - file_size
    - checksum
    - creator info
    - timestamp
    - comment (auto-generated or from restore)
    """
    tenant_id, user_id = get_user_ids(current_user)

    service = get_spreadsheet_service(db)

    try:
        versions = await service.get_versions(
            spreadsheet_id=UUID(sheet_id),
            tenant_id=UUID(tenant_id),
            limit=limit,
        )

        return {
            "spreadsheet_id": sheet_id,
            "versions": versions,
            "count": len(versions),
        }

    except Exception as e:
        logger.error(f"Failed to get versions: {e}")
        raise HTTPException(status_code=500, detail="Failed to get version history")


@router.post("/{sheet_id}/restore-version")
async def restore_version(
    sheet_id: str,
    data: RestoreVersionRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Restore a previous version of the spreadsheet.

    This creates a new version that points to the restored
    content, preserving the full version history.
    """
    tenant_id, user_id = get_user_ids(current_user)

    service = get_spreadsheet_service(db)

    try:
        result = await service.restore_version(
            spreadsheet_id=UUID(sheet_id),
            version_number=data.version_number,
            tenant_id=UUID(tenant_id),
            user_id=UUID(user_id),
        )

        return result

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to restore version: {e}")
        raise HTTPException(status_code=500, detail="Failed to restore version")


@router.post("/{sheet_id}/link-entity")
async def link_to_entity(
    sheet_id: str,
    data: EntityLinkRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Link spreadsheet to an ERP entity (internal mode only).

    Supported entity types:
    - SALES_INVOICE, SALES_ORDER, SALES_QUOTE
    - PURCHASE_ORDER, PURCHASE_BILL, PURCHASE_REQUEST
    - CUSTOMER, VENDOR
    - PROJECT, TASK
    - EMPLOYEE
    - EXPENSE, ASSET

    This allows spreadsheets to be associated with business
    documents in the ERP system, similar to document attachments.
    """
    tenant_id, user_id = get_user_ids(current_user)

    # Check if user is in internal mode
    tenant_mode = current_user.get("tenant_mode", "external")
    if tenant_mode != "internal":
        raise HTTPException(
            status_code=400,
            detail="Entity linking is only available for internal (ERP) users"
        )

    service = get_spreadsheet_service(db)

    try:
        result = await service.link_to_entity(
            spreadsheet_id=UUID(sheet_id),
            entity_type=data.entity_type,
            entity_id=UUID(data.entity_id),
            tenant_id=UUID(tenant_id),
            user_id=UUID(user_id),
        )

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to link entity: {e}")
        raise HTTPException(status_code=500, detail="Failed to link entity")


@router.get("/{sheet_id}/download")
async def download_spreadsheet(
    sheet_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a presigned URL to download the spreadsheet as XLSX.

    The URL is valid for 1 hour and can be used directly
    by the browser or any HTTP client.
    """
    from fastapi.responses import RedirectResponse
    from services.docs_storage_service import get_docs_storage_service

    tenant_id, user_id = get_user_ids(current_user)

    # Verify access
    sheet = await _verify_sheet_access(db, sheet_id, user_id, "view")
    if not sheet:
        raise HTTPException(status_code=404, detail="Spreadsheet not found")

    # Get storage path
    result = await db.execute(
        text("SELECT storage_path, title FROM workspace.spreadsheets WHERE id = CAST(:id AS uuid)"),
        {"id": sheet_id}
    )
    row = result.fetchone()

    if not row or not row.storage_path:
        raise HTTPException(status_code=404, detail="Spreadsheet file not found")

    # Generate presigned URL
    storage = get_docs_storage_service()
    download_url = await storage.generate_presigned_url(
        storage_path=row.storage_path,
        expires_in=3600,
        operation="get_object"
    )

    return {
        "download_url": download_url,
        "filename": f"{row.title}.xlsx",
        "expires_in": 3600,
    }


@router.get("/{sheet_id}/content")
async def get_spreadsheet_content(
    sheet_id: str,
    token: str = Query(..., description="Access token for document"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get spreadsheet file content for OnlyOffice.

    This endpoint is used by OnlyOffice Document Server to fetch the document.
    It uses a signed token to verify access without requiring user authentication.
    """
    from fastapi.responses import StreamingResponse
    from services.docs_storage_service import get_docs_storage_service
    import jwt
    import io
    from urllib.parse import unquote

    logger.info(f"OnlyOffice content request for sheet {sheet_id}")

    # URL-decode the token if it was encoded
    token = unquote(token)

    # Verify token
    try:
        payload = jwt.decode(token, settings.ONLYOFFICE_JWT_SECRET, algorithms=["HS256"])
        token_sheet_id = payload.get("sheet_id")
        if token_sheet_id != sheet_id:
            logger.warning(f"Sheet ID mismatch: token has {token_sheet_id}, URL has {sheet_id}")
            raise HTTPException(status_code=403, detail="Invalid token - sheet ID mismatch")
    except jwt.ExpiredSignatureError:
        logger.warning(f"Token expired for sheet {sheet_id}")
        raise HTTPException(status_code=403, detail="Token expired")
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid token for sheet {sheet_id}: {e}")
        raise HTTPException(status_code=403, detail="Invalid token")
    except Exception as e:
        logger.error(f"Token verification error for sheet {sheet_id}: {e}")
        raise HTTPException(status_code=403, detail="Token verification failed")

    # Get storage path
    result = await db.execute(
        text("SELECT storage_path, title FROM workspace.spreadsheets WHERE id = CAST(:id AS uuid)"),
        {"id": sheet_id}
    )
    row = result.fetchone()

    if not row:
        logger.warning(f"Spreadsheet not found: {sheet_id}")
        raise HTTPException(status_code=404, detail="Spreadsheet not found")

    if not row.storage_path:
        logger.warning(f"Spreadsheet {sheet_id} has no storage_path")
        raise HTTPException(status_code=404, detail="Spreadsheet file not found - no storage path")

    # Get file from S3
    storage = get_docs_storage_service()
    try:
        logger.info(f"Downloading spreadsheet from S3: {row.storage_path}")
        file_content, metadata = await storage.download_file(row.storage_path)
        content = file_content.read()
        logger.info(f"Downloaded spreadsheet {sheet_id}, size: {len(content)} bytes")
    except FileNotFoundError:
        logger.error(f"Spreadsheet file not found in S3: {row.storage_path}")
        raise HTTPException(status_code=404, detail="Spreadsheet file not found in storage")
    except Exception as e:
        logger.error(f"Failed to download spreadsheet {sheet_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to download file from storage")

    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{row.title}.xlsx"',
            "Content-Length": str(len(content)),
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        }
    )
