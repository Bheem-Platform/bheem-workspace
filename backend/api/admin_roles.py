"""
Bheem Workspace - Custom Admin Roles API
Role-based access control with granular permissions
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import uuid

from core.database import get_db
from core.security import get_current_user, require_tenant_admin
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/roles", tags=["Admin - Custom Roles"])


# =============================================
# Available Permissions
# =============================================

AVAILABLE_PERMISSIONS = {
    # User Management
    "users.read": "View user details",
    "users.write": "Create and update users",
    "users.delete": "Delete users",
    "users.reset_password": "Reset user passwords",
    "users.suspend": "Suspend/activate users",
    "users.bulk_import": "Bulk import users",

    # Group Management
    "groups.read": "View groups",
    "groups.write": "Create and update groups",
    "groups.delete": "Delete groups",

    # Org Unit Management
    "org_units.read": "View organizational units",
    "org_units.write": "Create and update org units",
    "org_units.delete": "Delete org units",

    # Domain Management
    "domains.read": "View domains",
    "domains.write": "Add and configure domains",
    "domains.delete": "Remove domains",

    # Security
    "security.view_logs": "View security audit logs",
    "security.manage_policies": "Manage security policies",
    "security.manage_sso": "Configure SSO settings",

    # Billing
    "billing.read": "View billing information",
    "billing.write": "Manage billing settings",

    # Reports
    "reports.view": "View reports",
    "reports.export": "Export reports",
    "reports.billing": "View billing reports",

    # Mail Admin
    "mail.manage_settings": "Manage mail settings",
    "mail.view_logs": "View mail logs",
    "mail.manage_aliases": "Manage email aliases",

    # Meet Admin
    "meet.manage_settings": "Manage meeting settings",
    "meet.view_recordings": "View all recordings",

    # Docs Admin
    "docs.manage_settings": "Manage docs settings",
    "docs.manage_templates": "Manage document templates",

    # Super Admin (wildcard)
    "*": "Full administrative access"
}


# =============================================
# Models
# =============================================

class RoleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    permissions: List[str]

    @validator('name')
    def validate_name(cls, v):
        if not v or len(v.strip()) < 2:
            raise ValueError('Name must be at least 2 characters')
        if len(v) > 100:
            raise ValueError('Name must be less than 100 characters')
        return v.strip()

    @validator('permissions')
    def validate_permissions(cls, v):
        if not v:
            raise ValueError('At least one permission is required')
        invalid = [p for p in v if p not in AVAILABLE_PERMISSIONS]
        if invalid:
            raise ValueError(f'Invalid permissions: {", ".join(invalid)}')
        return v


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[str]] = None


class RoleAssignment(BaseModel):
    user_id: str
    role_id: str
    scope_type: str = "global"  # global, org_unit, group
    scope_id: Optional[str] = None
    expires_at: Optional[str] = None


# =============================================
# Endpoints
# =============================================

@router.get("/permissions")
async def list_available_permissions(
    current_user: dict = Depends(require_tenant_admin())
) -> Dict[str, Any]:
    """Get all available permissions"""
    return {
        "permissions": [
            {"key": k, "description": v}
            for k, v in AVAILABLE_PERMISSIONS.items()
        ]
    }


@router.get("")
async def list_roles(
    include_system: bool = Query(True),
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get all admin roles for the tenant"""
    tenant_id = current_user.get("tenant_id")

    query = """
        SELECT
            r.id, r.name, r.description, r.permissions, r.is_system,
            r.created_at, r.updated_at,
            (SELECT COUNT(*) FROM workspace.user_admin_roles uar WHERE uar.role_id = r.id) as user_count
        FROM workspace.admin_roles r
        WHERE r.tenant_id = CAST(:tenant_id AS uuid)
    """
    if not include_system:
        query += " AND r.is_system = FALSE"
    query += " ORDER BY r.is_system DESC, r.name"

    result = await db.execute(text(query), {"tenant_id": tenant_id})
    roles = result.fetchall()

    return {
        "roles": [
            {
                "id": str(r.id),
                "name": r.name,
                "description": r.description,
                "permissions": r.permissions or [],
                "is_system": r.is_system,
                "user_count": r.user_count,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None
            }
            for r in roles
        ],
        "count": len(roles)
    }


@router.get("/{role_id}")
async def get_role(
    role_id: str,
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get a specific admin role"""
    tenant_id = current_user.get("tenant_id")

    result = await db.execute(text("""
        SELECT
            r.id, r.name, r.description, r.permissions, r.is_system,
            r.created_at, r.updated_at,
            (SELECT COUNT(*) FROM workspace.user_admin_roles uar WHERE uar.role_id = r.id) as user_count
        FROM workspace.admin_roles r
        WHERE r.id = CAST(:id AS uuid) AND r.tenant_id = CAST(:tenant_id AS uuid)
    """), {"id": role_id, "tenant_id": tenant_id})

    role = result.fetchone()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    # Get permission details
    permission_details = [
        {"key": p, "description": AVAILABLE_PERMISSIONS.get(p, "Unknown permission")}
        for p in (role.permissions or [])
    ]

    return {
        "id": str(role.id),
        "name": role.name,
        "description": role.description,
        "permissions": role.permissions or [],
        "permission_details": permission_details,
        "is_system": role.is_system,
        "user_count": role.user_count,
        "created_at": role.created_at.isoformat() if role.created_at else None,
        "updated_at": role.updated_at.isoformat() if role.updated_at else None
    }


@router.post("")
async def create_role(
    data: RoleCreate,
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Create a new admin role"""
    tenant_id = current_user.get("tenant_id")
    role_id = str(uuid.uuid4())

    # Check for duplicate name
    existing = await db.execute(text("""
        SELECT id FROM workspace.admin_roles
        WHERE tenant_id = CAST(:tenant_id AS uuid) AND name = :name
    """), {"tenant_id": tenant_id, "name": data.name})
    if existing.fetchone():
        raise HTTPException(status_code=409, detail=f"Role '{data.name}' already exists")

    # Create role
    await db.execute(text("""
        INSERT INTO workspace.admin_roles
        (id, tenant_id, name, description, permissions, is_system, created_at, updated_at)
        VALUES (
            CAST(:id AS uuid),
            CAST(:tenant_id AS uuid),
            :name,
            :description,
            :permissions,
            FALSE,
            NOW(),
            NOW()
        )
    """), {
        "id": role_id,
        "tenant_id": tenant_id,
        "name": data.name,
        "description": data.description,
        "permissions": data.permissions
    })
    await db.commit()

    logger.info(f"Created admin role {data.name} ({role_id}) in tenant {tenant_id}")

    return {
        "id": role_id,
        "name": data.name,
        "message": "Role created successfully"
    }


@router.put("/{role_id}")
async def update_role(
    role_id: str,
    data: RoleUpdate,
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Update an admin role"""
    tenant_id = current_user.get("tenant_id")

    # Verify exists and not system role
    existing = await db.execute(text("""
        SELECT id, is_system FROM workspace.admin_roles
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
    """), {"id": role_id, "tenant_id": tenant_id})
    role = existing.fetchone()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    if role.is_system and (data.name is not None or data.permissions is not None):
        raise HTTPException(status_code=403, detail="Cannot modify system role name or permissions")

    # Build update
    updates = []
    params = {"id": role_id, "tenant_id": tenant_id}

    if data.name is not None:
        updates.append("name = :name")
        params["name"] = data.name

    if data.description is not None:
        updates.append("description = :description")
        params["description"] = data.description

    if data.permissions is not None:
        # Validate permissions
        invalid = [p for p in data.permissions if p not in AVAILABLE_PERMISSIONS]
        if invalid:
            raise HTTPException(status_code=400, detail=f"Invalid permissions: {', '.join(invalid)}")
        updates.append("permissions = :permissions")
        params["permissions"] = data.permissions

    if not updates:
        return {"message": "No changes provided"}

    updates.append("updated_at = NOW()")

    query = f"""
        UPDATE workspace.admin_roles
        SET {', '.join(updates)}
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
    """
    await db.execute(text(query), params)
    await db.commit()

    return {"id": role_id, "message": "Role updated successfully"}


@router.delete("/{role_id}")
async def delete_role(
    role_id: str,
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Delete an admin role"""
    tenant_id = current_user.get("tenant_id")

    # Verify exists
    existing = await db.execute(text("""
        SELECT id, name, is_system,
            (SELECT COUNT(*) FROM workspace.user_admin_roles WHERE role_id = CAST(:id AS uuid)) as user_count
        FROM workspace.admin_roles
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
    """), {"id": role_id, "tenant_id": tenant_id})
    role = existing.fetchone()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    if role.is_system:
        raise HTTPException(status_code=403, detail="Cannot delete system roles")

    if role.user_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete role with {role.user_count} assigned users. Remove assignments first."
        )

    # Delete role
    await db.execute(text("""
        DELETE FROM workspace.admin_roles
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
    """), {"id": role_id, "tenant_id": tenant_id})
    await db.commit()

    logger.info(f"Deleted admin role {role.name} ({role_id}) from tenant {tenant_id}")

    return {"message": "Role deleted successfully"}


# =============================================
# Role Assignments
# =============================================

@router.get("/{role_id}/users")
async def get_role_users(
    role_id: str,
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get users assigned to a role"""
    tenant_id = current_user.get("tenant_id")

    # Verify role exists
    existing = await db.execute(text("""
        SELECT id FROM workspace.admin_roles
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
    """), {"id": role_id, "tenant_id": tenant_id})
    if not existing.fetchone():
        raise HTTPException(status_code=404, detail="Role not found")

    result = await db.execute(text("""
        SELECT
            uar.id as assignment_id, uar.scope_type, uar.scope_id,
            uar.assigned_at, uar.expires_at,
            tu.id as user_id, tu.email, tu.name, tu.role as user_role
        FROM workspace.user_admin_roles uar
        JOIN workspace.tenant_users tu ON uar.user_id = tu.id
        WHERE uar.role_id = CAST(:role_id AS uuid)
        ORDER BY tu.name
        LIMIT :limit OFFSET :offset
    """), {"role_id": role_id, "limit": limit, "offset": offset})

    assignments = result.fetchall()

    return {
        "users": [
            {
                "assignment_id": str(a.assignment_id),
                "scope_type": a.scope_type,
                "scope_id": str(a.scope_id) if a.scope_id else None,
                "assigned_at": a.assigned_at.isoformat() if a.assigned_at else None,
                "expires_at": a.expires_at.isoformat() if a.expires_at else None,
                "user": {
                    "id": str(a.user_id),
                    "email": a.email,
                    "name": a.name,
                    "role": a.user_role
                }
            }
            for a in assignments
        ],
        "count": len(assignments)
    }


@router.post("/assign")
async def assign_role(
    data: RoleAssignment,
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Assign a role to a user"""
    tenant_id = current_user.get("tenant_id")
    assigner_id = current_user.get("id") or current_user.get("user_id")

    # Verify role exists
    role_result = await db.execute(text("""
        SELECT id, name FROM workspace.admin_roles
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
    """), {"id": data.role_id, "tenant_id": tenant_id})
    role = role_result.fetchone()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    # Verify user exists
    user_result = await db.execute(text("""
        SELECT id, name FROM workspace.tenant_users
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
    """), {"id": data.user_id, "tenant_id": tenant_id})
    user = user_result.fetchone()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check for existing assignment
    existing = await db.execute(text("""
        SELECT id FROM workspace.user_admin_roles
        WHERE user_id = CAST(:user_id AS uuid)
          AND role_id = CAST(:role_id AS uuid)
          AND scope_type = :scope_type
          AND (scope_id = CAST(:scope_id AS uuid) OR (scope_id IS NULL AND :scope_id IS NULL))
    """), {
        "user_id": data.user_id,
        "role_id": data.role_id,
        "scope_type": data.scope_type,
        "scope_id": data.scope_id
    })
    if existing.fetchone():
        raise HTTPException(status_code=409, detail="Role already assigned to user")

    # Parse expires_at
    expires_at = None
    if data.expires_at:
        try:
            expires_at = datetime.fromisoformat(data.expires_at.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid expires_at format")

    # Create assignment
    assignment_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO workspace.user_admin_roles
        (id, user_id, role_id, scope_type, scope_id, assigned_by, assigned_at, expires_at)
        VALUES (
            CAST(:id AS uuid),
            CAST(:user_id AS uuid),
            CAST(:role_id AS uuid),
            :scope_type,
            CAST(:scope_id AS uuid),
            CAST(:assigned_by AS uuid),
            NOW(),
            :expires_at
        )
    """), {
        "id": assignment_id,
        "user_id": data.user_id,
        "role_id": data.role_id,
        "scope_type": data.scope_type,
        "scope_id": data.scope_id,
        "assigned_by": assigner_id,
        "expires_at": expires_at
    })
    await db.commit()

    logger.info(f"Assigned role {role.name} to user {user.name} in tenant {tenant_id}")

    return {
        "assignment_id": assignment_id,
        "message": f"Role '{role.name}' assigned to '{user.name}' successfully"
    }


@router.delete("/assignments/{assignment_id}")
async def remove_role_assignment(
    assignment_id: str,
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Remove a role assignment from a user"""
    tenant_id = current_user.get("tenant_id")

    # Verify assignment exists and belongs to tenant
    result = await db.execute(text("""
        SELECT uar.id, tu.name as user_name, r.name as role_name
        FROM workspace.user_admin_roles uar
        JOIN workspace.tenant_users tu ON uar.user_id = tu.id
        JOIN workspace.admin_roles r ON uar.role_id = r.id
        WHERE uar.id = CAST(:id AS uuid) AND tu.tenant_id = CAST(:tenant_id AS uuid)
    """), {"id": assignment_id, "tenant_id": tenant_id})

    assignment = result.fetchone()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    # Delete assignment
    await db.execute(text("""
        DELETE FROM workspace.user_admin_roles WHERE id = CAST(:id AS uuid)
    """), {"id": assignment_id})
    await db.commit()

    return {
        "message": f"Role '{assignment.role_name}' removed from '{assignment.user_name}'"
    }


@router.get("/user/{user_id}")
async def get_user_roles(
    user_id: str,
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get all admin roles assigned to a user"""
    tenant_id = current_user.get("tenant_id")

    # Verify user exists
    user_result = await db.execute(text("""
        SELECT id, name, email FROM workspace.tenant_users
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
    """), {"id": user_id, "tenant_id": tenant_id})
    user = user_result.fetchone()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get role assignments
    result = await db.execute(text("""
        SELECT
            uar.id as assignment_id, uar.scope_type, uar.scope_id,
            uar.assigned_at, uar.expires_at,
            r.id as role_id, r.name as role_name, r.description, r.permissions, r.is_system
        FROM workspace.user_admin_roles uar
        JOIN workspace.admin_roles r ON uar.role_id = r.id
        WHERE uar.user_id = CAST(:user_id AS uuid)
        ORDER BY r.name
    """), {"user_id": user_id})

    roles = result.fetchall()

    # Aggregate all permissions
    all_permissions = set()
    for role in roles:
        if role.permissions:
            all_permissions.update(role.permissions)

    return {
        "user": {
            "id": str(user.id),
            "name": user.name,
            "email": user.email
        },
        "roles": [
            {
                "assignment_id": str(r.assignment_id),
                "role_id": str(r.role_id),
                "role_name": r.role_name,
                "description": r.description,
                "permissions": r.permissions or [],
                "is_system": r.is_system,
                "scope_type": r.scope_type,
                "scope_id": str(r.scope_id) if r.scope_id else None,
                "assigned_at": r.assigned_at.isoformat() if r.assigned_at else None,
                "expires_at": r.expires_at.isoformat() if r.expires_at else None
            }
            for r in roles
        ],
        "effective_permissions": list(all_permissions)
    }
