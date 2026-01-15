"""
Bheem Workspace - User Groups API
Group management with dynamic membership rules
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
router = APIRouter(prefix="/admin/groups", tags=["Admin - User Groups"])


# =============================================
# Models
# =============================================

class GroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    group_email: Optional[str] = None
    group_type: str = "static"  # static, dynamic
    dynamic_rules: Optional[Dict[str, Any]] = None
    allow_external_members: bool = False
    is_public: bool = False
    settings: Optional[Dict[str, Any]] = None

    @validator('name')
    def validate_name(cls, v):
        if not v or len(v.strip()) < 2:
            raise ValueError('Name must be at least 2 characters')
        if len(v) > 255:
            raise ValueError('Name must be less than 255 characters')
        return v.strip()

    @validator('group_type')
    def validate_group_type(cls, v):
        if v not in ['static', 'dynamic']:
            raise ValueError('Group type must be static or dynamic')
        return v

    @validator('group_email')
    def validate_email(cls, v):
        if v:
            email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if not re.match(email_regex, v):
                raise ValueError('Invalid email format')
            return v.lower().strip()
        return v


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    group_email: Optional[str] = None
    group_type: Optional[str] = None
    dynamic_rules: Optional[Dict[str, Any]] = None
    allow_external_members: Optional[bool] = None
    is_public: Optional[bool] = None
    settings: Optional[Dict[str, Any]] = None


class GroupMemberAdd(BaseModel):
    user_ids: List[str]
    member_role: str = "member"  # owner, manager, member
    can_post: bool = True
    can_invite: bool = False


class GroupMemberUpdate(BaseModel):
    member_role: Optional[str] = None
    can_post: Optional[bool] = None
    can_invite: Optional[bool] = None


# =============================================
# Endpoints
# =============================================

@router.get("")
async def list_groups(
    search: Optional[str] = Query(None),
    group_type: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get all user groups for the tenant"""
    tenant_id = current_user.get("tenant_id")

    query = """
        SELECT
            g.id, g.name, g.description, g.group_email, g.group_type,
            g.dynamic_rules, g.allow_external_members, g.is_public,
            g.settings, g.created_at, g.updated_at,
            (SELECT COUNT(*) FROM workspace.group_members gm WHERE gm.group_id = g.id) as member_count
        FROM workspace.user_groups g
        WHERE g.tenant_id = CAST(:tenant_id AS uuid)
    """
    params = {"tenant_id": tenant_id, "limit": limit, "offset": offset}

    if search:
        query += " AND (g.name ILIKE :search OR g.description ILIKE :search OR g.group_email ILIKE :search)"
        params["search"] = f"%{search}%"

    if group_type:
        query += " AND g.group_type = :group_type"
        params["group_type"] = group_type

    query += " ORDER BY g.name LIMIT :limit OFFSET :offset"

    result = await db.execute(text(query), params)
    groups = result.fetchall()

    return {
        "groups": [
            {
                "id": str(g.id),
                "name": g.name,
                "description": g.description,
                "group_email": g.group_email,
                "group_type": g.group_type,
                "dynamic_rules": g.dynamic_rules,
                "allow_external_members": g.allow_external_members,
                "is_public": g.is_public,
                "settings": g.settings or {},
                "member_count": g.member_count,
                "created_at": g.created_at.isoformat() if g.created_at else None,
                "updated_at": g.updated_at.isoformat() if g.updated_at else None
            }
            for g in groups
        ],
        "count": len(groups)
    }


@router.get("/{group_id}")
async def get_group(
    group_id: str,
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get a specific user group"""
    tenant_id = current_user.get("tenant_id")

    result = await db.execute(text("""
        SELECT
            g.id, g.name, g.description, g.group_email, g.group_type,
            g.dynamic_rules, g.allow_external_members, g.is_public,
            g.settings, g.created_at, g.updated_at, g.created_by,
            (SELECT COUNT(*) FROM workspace.group_members gm WHERE gm.group_id = g.id) as member_count,
            u.name as created_by_name
        FROM workspace.user_groups g
        LEFT JOIN workspace.tenant_users u ON g.created_by = u.id
        WHERE g.id = CAST(:id AS uuid) AND g.tenant_id = CAST(:tenant_id AS uuid)
    """), {"id": group_id, "tenant_id": tenant_id})

    group = result.fetchone()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    return {
        "id": str(group.id),
        "name": group.name,
        "description": group.description,
        "group_email": group.group_email,
        "group_type": group.group_type,
        "dynamic_rules": group.dynamic_rules,
        "allow_external_members": group.allow_external_members,
        "is_public": group.is_public,
        "settings": group.settings or {},
        "member_count": group.member_count,
        "created_by": {
            "id": str(group.created_by) if group.created_by else None,
            "name": group.created_by_name
        } if group.created_by else None,
        "created_at": group.created_at.isoformat() if group.created_at else None,
        "updated_at": group.updated_at.isoformat() if group.updated_at else None
    }


@router.post("")
async def create_group(
    data: GroupCreate,
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Create a new user group"""
    tenant_id = current_user.get("tenant_id")
    user_id = current_user.get("id") or current_user.get("user_id")
    group_id = str(uuid.uuid4())

    # Check for duplicate name
    existing = await db.execute(text("""
        SELECT id FROM workspace.user_groups
        WHERE tenant_id = CAST(:tenant_id AS uuid) AND name = :name
    """), {"tenant_id": tenant_id, "name": data.name})
    if existing.fetchone():
        raise HTTPException(status_code=409, detail=f"Group '{data.name}' already exists")

    # Check for duplicate email
    if data.group_email:
        existing_email = await db.execute(text("""
            SELECT id FROM workspace.user_groups
            WHERE tenant_id = CAST(:tenant_id AS uuid) AND group_email = :email
        """), {"tenant_id": tenant_id, "email": data.group_email})
        if existing_email.fetchone():
            raise HTTPException(status_code=409, detail=f"Group email '{data.group_email}' already in use")

    # Create group
    await db.execute(text("""
        INSERT INTO workspace.user_groups
        (id, tenant_id, name, description, group_email, group_type, dynamic_rules,
         allow_external_members, is_public, settings, created_by, created_at, updated_at)
        VALUES (
            CAST(:id AS uuid),
            CAST(:tenant_id AS uuid),
            :name,
            :description,
            :group_email,
            :group_type,
            :dynamic_rules,
            :allow_external_members,
            :is_public,
            :settings,
            CAST(:created_by AS uuid),
            NOW(),
            NOW()
        )
    """), {
        "id": group_id,
        "tenant_id": tenant_id,
        "name": data.name,
        "description": data.description,
        "group_email": data.group_email,
        "group_type": data.group_type,
        "dynamic_rules": data.dynamic_rules,
        "allow_external_members": data.allow_external_members,
        "is_public": data.is_public,
        "settings": data.settings or {},
        "created_by": user_id
    })
    await db.commit()

    logger.info(f"Created group {data.name} ({group_id}) in tenant {tenant_id}")

    return {
        "id": group_id,
        "name": data.name,
        "message": "Group created successfully"
    }


@router.put("/{group_id}")
async def update_group(
    group_id: str,
    data: GroupUpdate,
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Update a user group"""
    tenant_id = current_user.get("tenant_id")

    # Verify exists
    existing = await db.execute(text("""
        SELECT id FROM workspace.user_groups
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
    """), {"id": group_id, "tenant_id": tenant_id})
    if not existing.fetchone():
        raise HTTPException(status_code=404, detail="Group not found")

    # Build update query
    updates = []
    params = {"id": group_id, "tenant_id": tenant_id}

    if data.name is not None:
        updates.append("name = :name")
        params["name"] = data.name

    if data.description is not None:
        updates.append("description = :description")
        params["description"] = data.description

    if data.group_email is not None:
        updates.append("group_email = :group_email")
        params["group_email"] = data.group_email

    if data.group_type is not None:
        updates.append("group_type = :group_type")
        params["group_type"] = data.group_type

    if data.dynamic_rules is not None:
        updates.append("dynamic_rules = :dynamic_rules")
        params["dynamic_rules"] = data.dynamic_rules

    if data.allow_external_members is not None:
        updates.append("allow_external_members = :allow_external_members")
        params["allow_external_members"] = data.allow_external_members

    if data.is_public is not None:
        updates.append("is_public = :is_public")
        params["is_public"] = data.is_public

    if data.settings is not None:
        updates.append("settings = :settings")
        params["settings"] = data.settings

    if not updates:
        return {"message": "No changes provided"}

    updates.append("updated_at = NOW()")

    query = f"""
        UPDATE workspace.user_groups
        SET {', '.join(updates)}
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
    """
    await db.execute(text(query), params)
    await db.commit()

    return {"id": group_id, "message": "Group updated successfully"}


@router.delete("/{group_id}")
async def delete_group(
    group_id: str,
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Delete a user group"""
    tenant_id = current_user.get("tenant_id")

    # Verify exists
    existing = await db.execute(text("""
        SELECT id, name,
            (SELECT COUNT(*) FROM workspace.group_members WHERE group_id = CAST(:id AS uuid)) as member_count
        FROM workspace.user_groups
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
    """), {"id": group_id, "tenant_id": tenant_id})
    group = existing.fetchone()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Delete members first
    await db.execute(text("""
        DELETE FROM workspace.group_members WHERE group_id = CAST(:id AS uuid)
    """), {"id": group_id})

    # Delete group
    await db.execute(text("""
        DELETE FROM workspace.user_groups
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
    """), {"id": group_id, "tenant_id": tenant_id})
    await db.commit()

    logger.info(f"Deleted group {group.name} ({group_id}) from tenant {tenant_id}")

    return {"message": "Group deleted successfully", "members_removed": group.member_count}


# =============================================
# Group Members Endpoints
# =============================================

@router.get("/{group_id}/members")
async def get_group_members(
    group_id: str,
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get members of a group"""
    tenant_id = current_user.get("tenant_id")

    # Verify group exists
    existing = await db.execute(text("""
        SELECT id, group_type, dynamic_rules FROM workspace.user_groups
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
    """), {"id": group_id, "tenant_id": tenant_id})
    group = existing.fetchone()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Get members
    result = await db.execute(text("""
        SELECT
            gm.id as membership_id, gm.member_role, gm.can_post, gm.can_invite, gm.joined_at,
            tu.id as user_id, tu.email, tu.name, tu.role as user_role, tu.department, tu.is_active
        FROM workspace.group_members gm
        JOIN workspace.tenant_users tu ON gm.user_id = tu.id
        WHERE gm.group_id = CAST(:group_id AS uuid)
        ORDER BY gm.member_role DESC, tu.name
        LIMIT :limit OFFSET :offset
    """), {"group_id": group_id, "limit": limit, "offset": offset})

    members = result.fetchall()

    return {
        "members": [
            {
                "membership_id": str(m.membership_id),
                "member_role": m.member_role,
                "can_post": m.can_post,
                "can_invite": m.can_invite,
                "joined_at": m.joined_at.isoformat() if m.joined_at else None,
                "user": {
                    "id": str(m.user_id),
                    "email": m.email,
                    "name": m.name,
                    "role": m.user_role,
                    "department": m.department,
                    "is_active": m.is_active
                }
            }
            for m in members
        ],
        "count": len(members)
    }


@router.post("/{group_id}/members")
async def add_group_members(
    group_id: str,
    data: GroupMemberAdd,
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Add members to a group"""
    tenant_id = current_user.get("tenant_id")
    user_id = current_user.get("id") or current_user.get("user_id")

    # Verify group exists
    existing = await db.execute(text("""
        SELECT id, name, group_type FROM workspace.user_groups
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
    """), {"id": group_id, "tenant_id": tenant_id})
    group = existing.fetchone()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if group.group_type == 'dynamic':
        raise HTTPException(status_code=400, detail="Cannot manually add members to dynamic groups")

    added_count = 0
    skipped_count = 0

    for uid in data.user_ids:
        # Check if already a member
        existing_member = await db.execute(text("""
            SELECT id FROM workspace.group_members
            WHERE group_id = CAST(:group_id AS uuid) AND user_id = CAST(:user_id AS uuid)
        """), {"group_id": group_id, "user_id": uid})

        if existing_member.fetchone():
            skipped_count += 1
            continue

        # Add member
        try:
            await db.execute(text("""
                INSERT INTO workspace.group_members
                (id, group_id, user_id, member_role, can_post, can_invite, joined_at, added_by)
                VALUES (
                    CAST(:id AS uuid),
                    CAST(:group_id AS uuid),
                    CAST(:user_id AS uuid),
                    :member_role,
                    :can_post,
                    :can_invite,
                    NOW(),
                    CAST(:added_by AS uuid)
                )
            """), {
                "id": str(uuid.uuid4()),
                "group_id": group_id,
                "user_id": uid,
                "member_role": data.member_role,
                "can_post": data.can_post,
                "can_invite": data.can_invite,
                "added_by": user_id
            })
            added_count += 1
        except Exception as e:
            logger.warning(f"Failed to add user {uid} to group {group_id}: {e}")
            skipped_count += 1

    await db.commit()

    return {
        "message": f"Added {added_count} members to {group.name}",
        "added_count": added_count,
        "skipped_count": skipped_count
    }


@router.delete("/{group_id}/members/{user_id}")
async def remove_group_member(
    group_id: str,
    user_id: str,
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Remove a member from a group"""
    tenant_id = current_user.get("tenant_id")

    # Verify group exists
    existing = await db.execute(text("""
        SELECT id, name, group_type FROM workspace.user_groups
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
    """), {"id": group_id, "tenant_id": tenant_id})
    group = existing.fetchone()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if group.group_type == 'dynamic':
        raise HTTPException(status_code=400, detail="Cannot manually remove members from dynamic groups")

    # Remove member
    result = await db.execute(text("""
        DELETE FROM workspace.group_members
        WHERE group_id = CAST(:group_id AS uuid) AND user_id = CAST(:user_id AS uuid)
    """), {"group_id": group_id, "user_id": user_id})

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Member not found in group")

    await db.commit()

    return {"message": "Member removed from group"}


@router.put("/{group_id}/members/{user_id}")
async def update_group_member(
    group_id: str,
    user_id: str,
    data: GroupMemberUpdate,
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Update a member's role/permissions in a group"""
    tenant_id = current_user.get("tenant_id")

    # Verify group exists
    existing = await db.execute(text("""
        SELECT id FROM workspace.user_groups
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
    """), {"id": group_id, "tenant_id": tenant_id})
    if not existing.fetchone():
        raise HTTPException(status_code=404, detail="Group not found")

    # Build update query
    updates = []
    params = {"group_id": group_id, "user_id": user_id}

    if data.member_role is not None:
        updates.append("member_role = :member_role")
        params["member_role"] = data.member_role

    if data.can_post is not None:
        updates.append("can_post = :can_post")
        params["can_post"] = data.can_post

    if data.can_invite is not None:
        updates.append("can_invite = :can_invite")
        params["can_invite"] = data.can_invite

    if not updates:
        return {"message": "No changes provided"}

    query = f"""
        UPDATE workspace.group_members
        SET {', '.join(updates)}
        WHERE group_id = CAST(:group_id AS uuid) AND user_id = CAST(:user_id AS uuid)
    """
    result = await db.execute(text(query), params)

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Member not found in group")

    await db.commit()

    return {"message": "Member updated successfully"}


@router.post("/{group_id}/sync")
async def sync_dynamic_group(
    group_id: str,
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Sync dynamic group membership based on rules.
    Only works for dynamic groups.
    """
    tenant_id = current_user.get("tenant_id")

    # Get group with rules
    result = await db.execute(text("""
        SELECT id, name, group_type, dynamic_rules FROM workspace.user_groups
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
    """), {"id": group_id, "tenant_id": tenant_id})
    group = result.fetchone()

    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if group.group_type != 'dynamic':
        raise HTTPException(status_code=400, detail="Only dynamic groups can be synced")

    if not group.dynamic_rules:
        return {"message": "No dynamic rules configured", "added": 0, "removed": 0}

    rules = group.dynamic_rules
    added = 0
    removed = 0

    # Build query based on rules
    # Rules can include: department, role, org_unit, etc.
    conditions = []
    params = {"tenant_id": tenant_id}

    if 'department' in rules:
        conditions.append("department = :department")
        params["department"] = rules["department"]

    if 'role' in rules:
        conditions.append("role = :role")
        params["role"] = rules["role"]

    if 'org_unit_id' in rules:
        conditions.append("org_unit_id = CAST(:org_unit_id AS uuid)")
        params["org_unit_id"] = rules["org_unit_id"]

    if not conditions:
        return {"message": "No valid rules to process", "added": 0, "removed": 0}

    # Get matching users
    query = f"""
        SELECT id FROM workspace.tenant_users
        WHERE tenant_id = CAST(:tenant_id AS uuid) AND is_active = TRUE
        AND {' AND '.join(conditions)}
    """
    matching_users = await db.execute(text(query), params)
    matching_ids = {str(row.id) for row in matching_users.fetchall()}

    # Get current members
    current_members = await db.execute(text("""
        SELECT user_id FROM workspace.group_members
        WHERE group_id = CAST(:group_id AS uuid)
    """), {"group_id": group_id})
    current_ids = {str(row.user_id) for row in current_members.fetchall()}

    # Add new members
    to_add = matching_ids - current_ids
    for uid in to_add:
        await db.execute(text("""
            INSERT INTO workspace.group_members
            (id, group_id, user_id, member_role, can_post, can_invite, joined_at)
            VALUES (CAST(:id AS uuid), CAST(:group_id AS uuid), CAST(:user_id AS uuid), 'member', TRUE, FALSE, NOW())
        """), {"id": str(uuid.uuid4()), "group_id": group_id, "user_id": uid})
        added += 1

    # Remove users who no longer match
    to_remove = current_ids - matching_ids
    for uid in to_remove:
        await db.execute(text("""
            DELETE FROM workspace.group_members
            WHERE group_id = CAST(:group_id AS uuid) AND user_id = CAST(:user_id AS uuid)
        """), {"group_id": group_id, "user_id": uid})
        removed += 1

    await db.commit()

    logger.info(f"Synced dynamic group {group.name}: added {added}, removed {removed}")

    return {
        "message": f"Group synced successfully",
        "added": added,
        "removed": removed,
        "total_members": len(matching_ids)
    }
