"""
Bheem Workspace - Organizational Units API
Hierarchical organization structure management
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import uuid
import re

from core.database import get_db
from core.security import get_current_user, require_tenant_admin
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/org-units", tags=["Admin - Organizational Units"])


# =============================================
# Models
# =============================================

class OrgUnitCreate(BaseModel):
    name: str
    parent_id: Optional[str] = None
    description: Optional[str] = None
    manager_id: Optional[str] = None
    cost_center: Optional[str] = None
    department_code: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None

    @validator('name')
    def validate_name(cls, v):
        if not v or len(v.strip()) < 2:
            raise ValueError('Name must be at least 2 characters')
        if len(v) > 255:
            raise ValueError('Name must be less than 255 characters')
        # Allow alphanumeric, spaces, hyphens, underscores
        if not re.match(r'^[\w\s\-]+$', v):
            raise ValueError('Name contains invalid characters')
        return v.strip()


class OrgUnitUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[str] = None
    description: Optional[str] = None
    manager_id: Optional[str] = None
    cost_center: Optional[str] = None
    department_code: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class OrgUnitResponse(BaseModel):
    id: str
    name: str
    path: str
    parent_id: Optional[str]
    description: Optional[str]
    manager_id: Optional[str]
    manager_name: Optional[str] = None
    cost_center: Optional[str]
    department_code: Optional[str]
    settings: Dict[str, Any]
    is_active: bool
    user_count: int = 0
    children_count: int = 0
    created_at: str
    updated_at: str


class MoveUsersRequest(BaseModel):
    user_ids: List[str]
    target_org_unit_id: str


# =============================================
# Endpoints
# =============================================

@router.get("")
async def list_org_units(
    include_inactive: bool = Query(False),
    flat: bool = Query(False, description="Return flat list instead of tree"),
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get all organizational units for the tenant.
    Returns as a hierarchical tree by default.
    """
    tenant_id = current_user.get("tenant_id")

    query = """
        SELECT
            ou.id, ou.name, ou.path, ou.parent_id, ou.description,
            ou.manager_id, ou.cost_center, ou.department_code,
            ou.settings, ou.is_active, ou.created_at, ou.updated_at,
            m.name as manager_name,
            (SELECT COUNT(*) FROM workspace.tenant_users tu WHERE tu.org_unit_id = ou.id) as user_count,
            (SELECT COUNT(*) FROM workspace.org_units c WHERE c.parent_id = ou.id) as children_count
        FROM workspace.org_units ou
        LEFT JOIN workspace.tenant_users m ON ou.manager_id = m.id
        WHERE ou.tenant_id = CAST(:tenant_id AS uuid)
    """
    if not include_inactive:
        query += " AND ou.is_active = TRUE"
    query += " ORDER BY ou.path"

    result = await db.execute(text(query), {"tenant_id": tenant_id})
    units = result.fetchall()

    org_list = []
    for u in units:
        org_list.append({
            "id": str(u.id),
            "name": u.name,
            "path": u.path,
            "parent_id": str(u.parent_id) if u.parent_id else None,
            "description": u.description,
            "manager_id": str(u.manager_id) if u.manager_id else None,
            "manager_name": u.manager_name,
            "cost_center": u.cost_center,
            "department_code": u.department_code,
            "settings": u.settings or {},
            "is_active": u.is_active,
            "user_count": u.user_count,
            "children_count": u.children_count,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "updated_at": u.updated_at.isoformat() if u.updated_at else None
        })

    if flat:
        return {"org_units": org_list, "total": len(org_list)}

    # Build tree structure
    tree = _build_tree(org_list)
    return {"org_units": tree, "total": len(org_list)}


def _build_tree(flat_list: List[Dict]) -> List[Dict]:
    """Convert flat list to hierarchical tree"""
    nodes = {item["id"]: {**item, "children": []} for item in flat_list}
    tree = []

    for item in flat_list:
        if item["parent_id"] and item["parent_id"] in nodes:
            nodes[item["parent_id"]]["children"].append(nodes[item["id"]])
        else:
            tree.append(nodes[item["id"]])

    return tree


@router.get("/{org_unit_id}")
async def get_org_unit(
    org_unit_id: str,
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> OrgUnitResponse:
    """Get a specific organizational unit"""
    tenant_id = current_user.get("tenant_id")

    result = await db.execute(text("""
        SELECT
            ou.id, ou.name, ou.path, ou.parent_id, ou.description,
            ou.manager_id, ou.cost_center, ou.department_code,
            ou.settings, ou.is_active, ou.created_at, ou.updated_at,
            m.name as manager_name,
            (SELECT COUNT(*) FROM workspace.tenant_users tu WHERE tu.org_unit_id = ou.id) as user_count,
            (SELECT COUNT(*) FROM workspace.org_units c WHERE c.parent_id = ou.id) as children_count
        FROM workspace.org_units ou
        LEFT JOIN workspace.tenant_users m ON ou.manager_id = m.id
        WHERE ou.id = CAST(:id AS uuid) AND ou.tenant_id = CAST(:tenant_id AS uuid)
    """), {"id": org_unit_id, "tenant_id": tenant_id})

    unit = result.fetchone()
    if not unit:
        raise HTTPException(status_code=404, detail="Organizational unit not found")

    return OrgUnitResponse(
        id=str(unit.id),
        name=unit.name,
        path=unit.path,
        parent_id=str(unit.parent_id) if unit.parent_id else None,
        description=unit.description,
        manager_id=str(unit.manager_id) if unit.manager_id else None,
        manager_name=unit.manager_name,
        cost_center=unit.cost_center,
        department_code=unit.department_code,
        settings=unit.settings or {},
        is_active=unit.is_active,
        user_count=unit.user_count,
        children_count=unit.children_count,
        created_at=unit.created_at.isoformat() if unit.created_at else "",
        updated_at=unit.updated_at.isoformat() if unit.updated_at else ""
    )


@router.post("")
async def create_org_unit(
    data: OrgUnitCreate,
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Create a new organizational unit"""
    tenant_id = current_user.get("tenant_id")
    unit_id = str(uuid.uuid4())

    # Determine path
    if data.parent_id:
        # Get parent path
        parent_result = await db.execute(text("""
            SELECT path FROM workspace.org_units
            WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
        """), {"id": data.parent_id, "tenant_id": tenant_id})
        parent = parent_result.fetchone()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent organizational unit not found")
        path = f"{parent.path}/{data.name}"
    else:
        path = f"/{data.name}"

    # Check for duplicate path
    existing = await db.execute(text("""
        SELECT id FROM workspace.org_units
        WHERE tenant_id = CAST(:tenant_id AS uuid) AND path = :path
    """), {"tenant_id": tenant_id, "path": path})
    if existing.fetchone():
        raise HTTPException(status_code=409, detail=f"Organizational unit with path '{path}' already exists")

    # Create org unit
    await db.execute(text("""
        INSERT INTO workspace.org_units
        (id, tenant_id, name, path, parent_id, description, manager_id, cost_center, department_code, settings, is_active, created_at, updated_at)
        VALUES (
            CAST(:id AS uuid),
            CAST(:tenant_id AS uuid),
            :name,
            :path,
            CAST(:parent_id AS uuid),
            :description,
            CAST(:manager_id AS uuid),
            :cost_center,
            :department_code,
            :settings,
            TRUE,
            NOW(),
            NOW()
        )
    """), {
        "id": unit_id,
        "tenant_id": tenant_id,
        "name": data.name,
        "path": path,
        "parent_id": data.parent_id,
        "description": data.description,
        "manager_id": data.manager_id,
        "cost_center": data.cost_center,
        "department_code": data.department_code,
        "settings": data.settings or {}
    })
    await db.commit()

    logger.info(f"Created org unit {data.name} ({unit_id}) in tenant {tenant_id}")

    return {
        "id": unit_id,
        "name": data.name,
        "path": path,
        "message": "Organizational unit created successfully"
    }


@router.put("/{org_unit_id}")
async def update_org_unit(
    org_unit_id: str,
    data: OrgUnitUpdate,
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Update an organizational unit"""
    tenant_id = current_user.get("tenant_id")

    # Verify exists
    existing = await db.execute(text("""
        SELECT id, name, path, parent_id FROM workspace.org_units
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
    """), {"id": org_unit_id, "tenant_id": tenant_id})
    unit = existing.fetchone()
    if not unit:
        raise HTTPException(status_code=404, detail="Organizational unit not found")

    # Build update query dynamically
    updates = []
    params = {"id": org_unit_id, "tenant_id": tenant_id}

    if data.name is not None:
        updates.append("name = :name")
        params["name"] = data.name
        # Update path
        old_path = unit.path
        if unit.parent_id:
            parent_result = await db.execute(text("""
                SELECT path FROM workspace.org_units WHERE id = CAST(:parent_id AS uuid)
            """), {"parent_id": str(unit.parent_id)})
            parent = parent_result.fetchone()
            new_path = f"{parent.path}/{data.name}" if parent else f"/{data.name}"
        else:
            new_path = f"/{data.name}"
        updates.append("path = :path")
        params["path"] = new_path

    if data.description is not None:
        updates.append("description = :description")
        params["description"] = data.description

    if data.manager_id is not None:
        updates.append("manager_id = CAST(:manager_id AS uuid)")
        params["manager_id"] = data.manager_id if data.manager_id else None

    if data.cost_center is not None:
        updates.append("cost_center = :cost_center")
        params["cost_center"] = data.cost_center

    if data.department_code is not None:
        updates.append("department_code = :department_code")
        params["department_code"] = data.department_code

    if data.settings is not None:
        updates.append("settings = :settings")
        params["settings"] = data.settings

    if data.is_active is not None:
        updates.append("is_active = :is_active")
        params["is_active"] = data.is_active

    if not updates:
        return {"message": "No changes provided"}

    updates.append("updated_at = NOW()")

    query = f"""
        UPDATE workspace.org_units
        SET {', '.join(updates)}
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
    """
    await db.execute(text(query), params)
    await db.commit()

    return {"id": org_unit_id, "message": "Organizational unit updated successfully"}


@router.delete("/{org_unit_id}")
async def delete_org_unit(
    org_unit_id: str,
    move_users_to: Optional[str] = Query(None, description="Move users to this org unit before deleting"),
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Delete an organizational unit.
    Optionally move users to another org unit first.
    """
    tenant_id = current_user.get("tenant_id")

    # Verify exists
    existing = await db.execute(text("""
        SELECT id,
            (SELECT COUNT(*) FROM workspace.tenant_users WHERE org_unit_id = CAST(:id AS uuid)) as user_count,
            (SELECT COUNT(*) FROM workspace.org_units WHERE parent_id = CAST(:id AS uuid)) as child_count
        FROM workspace.org_units
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
    """), {"id": org_unit_id, "tenant_id": tenant_id})
    unit = existing.fetchone()
    if not unit:
        raise HTTPException(status_code=404, detail="Organizational unit not found")

    if unit.child_count > 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete org unit with child units. Delete or move children first."
        )

    if unit.user_count > 0:
        if move_users_to:
            # Move users to target org unit
            await db.execute(text("""
                UPDATE workspace.tenant_users
                SET org_unit_id = CAST(:target AS uuid), updated_at = NOW()
                WHERE org_unit_id = CAST(:id AS uuid)
            """), {"id": org_unit_id, "target": move_users_to})
        else:
            # Clear org unit from users
            await db.execute(text("""
                UPDATE workspace.tenant_users
                SET org_unit_id = NULL, updated_at = NOW()
                WHERE org_unit_id = CAST(:id AS uuid)
            """), {"id": org_unit_id})

    # Delete org unit
    await db.execute(text("""
        DELETE FROM workspace.org_units
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
    """), {"id": org_unit_id, "tenant_id": tenant_id})
    await db.commit()

    logger.info(f"Deleted org unit {org_unit_id} from tenant {tenant_id}")

    return {"message": "Organizational unit deleted successfully", "users_affected": unit.user_count}


@router.get("/{org_unit_id}/users")
async def get_org_unit_users(
    org_unit_id: str,
    include_children: bool = Query(False, description="Include users from child org units"),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get users in an organizational unit"""
    tenant_id = current_user.get("tenant_id")

    # Verify org unit exists
    existing = await db.execute(text("""
        SELECT id FROM workspace.org_units
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
    """), {"id": org_unit_id, "tenant_id": tenant_id})
    if not existing.fetchone():
        raise HTTPException(status_code=404, detail="Organizational unit not found")

    if include_children:
        query = """
            WITH RECURSIVE child_units AS (
                SELECT id FROM workspace.org_units WHERE id = CAST(:org_unit_id AS uuid)
                UNION ALL
                SELECT o.id FROM workspace.org_units o
                JOIN child_units c ON o.parent_id = c.id
            )
            SELECT tu.id, tu.email, tu.name, tu.role, tu.department, tu.job_title,
                   tu.is_active, tu.org_unit_id, ou.name as org_unit_name, ou.path as org_unit_path
            FROM workspace.tenant_users tu
            LEFT JOIN workspace.org_units ou ON tu.org_unit_id = ou.id
            WHERE tu.org_unit_id IN (SELECT id FROM child_units)
            ORDER BY tu.name
            LIMIT :limit OFFSET :offset
        """
    else:
        query = """
            SELECT tu.id, tu.email, tu.name, tu.role, tu.department, tu.job_title,
                   tu.is_active, tu.org_unit_id, ou.name as org_unit_name, ou.path as org_unit_path
            FROM workspace.tenant_users tu
            LEFT JOIN workspace.org_units ou ON tu.org_unit_id = ou.id
            WHERE tu.org_unit_id = CAST(:org_unit_id AS uuid)
            ORDER BY tu.name
            LIMIT :limit OFFSET :offset
        """

    result = await db.execute(text(query), {"org_unit_id": org_unit_id, "limit": limit, "offset": offset})
    users = result.fetchall()

    return {
        "users": [
            {
                "id": str(u.id),
                "email": u.email,
                "name": u.name,
                "role": u.role,
                "department": u.department,
                "job_title": u.job_title,
                "is_active": u.is_active,
                "org_unit": {
                    "id": str(u.org_unit_id) if u.org_unit_id else None,
                    "name": u.org_unit_name,
                    "path": u.org_unit_path
                } if u.org_unit_id else None
            }
            for u in users
        ],
        "count": len(users)
    }


@router.post("/move-users")
async def move_users_to_org_unit(
    data: MoveUsersRequest,
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Move multiple users to an organizational unit"""
    tenant_id = current_user.get("tenant_id")

    # Verify target org unit exists
    target = await db.execute(text("""
        SELECT id, name FROM workspace.org_units
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
    """), {"id": data.target_org_unit_id, "tenant_id": tenant_id})
    target_unit = target.fetchone()
    if not target_unit:
        raise HTTPException(status_code=404, detail="Target organizational unit not found")

    # Move users
    moved_count = 0
    for user_id in data.user_ids:
        result = await db.execute(text("""
            UPDATE workspace.tenant_users
            SET org_unit_id = CAST(:org_unit_id AS uuid), updated_at = NOW()
            WHERE id = CAST(:user_id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
        """), {"org_unit_id": data.target_org_unit_id, "user_id": user_id, "tenant_id": tenant_id})
        if result.rowcount > 0:
            moved_count += 1

    await db.commit()

    return {
        "message": f"Moved {moved_count} users to {target_unit.name}",
        "moved_count": moved_count,
        "target_org_unit": {
            "id": str(target_unit.id),
            "name": target_unit.name
        }
    }
