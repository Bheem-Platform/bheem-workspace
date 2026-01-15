"""
Bheem Sheets - Spreadsheet API
Google Sheets-like spreadsheet functionality
"""
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import uuid
import json

from core.database import get_db
from core.security import get_current_user, require_tenant_admin
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sheets", tags=["Bheem Sheets"])


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
    starred_only: bool = Query(False),
    search: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """List spreadsheets accessible by the user"""
    user_id = current_user.get("id") or current_user.get("user_id")
    tenant_id = current_user.get("tenant_id")

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

    if starred_only:
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
    user_id = current_user.get("id") or current_user.get("user_id")
    tenant_id = current_user.get("tenant_id")
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


@router.get("/{sheet_id}")
async def get_sheet(
    sheet_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get spreadsheet details with worksheets"""
    user_id = current_user.get("id") or current_user.get("user_id")
    tenant_id = current_user.get("tenant_id")

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
    user_id = current_user.get("id") or current_user.get("user_id")
    tenant_id = current_user.get("tenant_id")

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
    user_id = current_user.get("id") or current_user.get("user_id")
    tenant_id = current_user.get("tenant_id")

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
    user_id = current_user.get("id") or current_user.get("user_id")
    tenant_id = current_user.get("tenant_id")

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
