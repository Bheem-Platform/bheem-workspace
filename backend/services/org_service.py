"""
Bheem Workspace - Organization Service
Business logic for Org Units and User Groups
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func, and_, or_
from sqlalchemy.orm import selectinload
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid
import logging

from models.org_models import OrgUnit, UserGroup, UserGroupMember

logger = logging.getLogger(__name__)


class OrgUnitService:
    """Service for managing Organizational Units"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_org_unit(
        self,
        tenant_id: str,
        name: str,
        created_by: str,
        parent_id: Optional[str] = None,
        description: Optional[str] = None,
        manager_id: Optional[str] = None,
        service_settings: Optional[Dict[str, Any]] = None
    ) -> OrgUnit:
        """Create a new organizational unit"""
        # Build path
        if parent_id:
            parent = await self.get_org_unit(parent_id, tenant_id)
            if not parent:
                raise ValueError("Parent org unit not found")
            path = f"{parent.path}/{name}"
        else:
            path = f"/{name}"

        # Check for duplicate path
        existing = await self.db.execute(
            select(OrgUnit).where(
                and_(
                    OrgUnit.tenant_id == uuid.UUID(tenant_id),
                    OrgUnit.path == path
                )
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError(f"Org unit with path '{path}' already exists")

        org_unit = OrgUnit(
            tenant_id=uuid.UUID(tenant_id),
            parent_id=uuid.UUID(parent_id) if parent_id else None,
            name=name,
            description=description,
            path=path,
            manager_id=uuid.UUID(manager_id) if manager_id else None,
            service_settings=service_settings or {},
            created_by=uuid.UUID(created_by)
        )

        self.db.add(org_unit)
        await self.db.commit()
        await self.db.refresh(org_unit)

        logger.info(f"Created org unit {name} ({org_unit.id}) in tenant {tenant_id}")
        return org_unit

    async def get_org_unit(
        self,
        org_unit_id: str,
        tenant_id: str
    ) -> Optional[OrgUnit]:
        """Get org unit by ID"""
        result = await self.db.execute(
            select(OrgUnit).where(
                and_(
                    OrgUnit.id == uuid.UUID(org_unit_id),
                    OrgUnit.tenant_id == uuid.UUID(tenant_id),
                    OrgUnit.is_active == True
                )
            )
        )
        return result.scalar_one_or_none()

    async def list_org_units(
        self,
        tenant_id: str,
        parent_id: Optional[str] = None,
        include_children: bool = True
    ) -> List[OrgUnit]:
        """List org units, optionally filtered by parent"""
        query = select(OrgUnit).where(
            and_(
                OrgUnit.tenant_id == uuid.UUID(tenant_id),
                OrgUnit.is_active == True
            )
        )

        if parent_id is not None:
            if parent_id == "":  # Root level
                query = query.where(OrgUnit.parent_id.is_(None))
            else:
                query = query.where(OrgUnit.parent_id == uuid.UUID(parent_id))

        query = query.order_by(OrgUnit.path)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_org_unit_tree(
        self,
        tenant_id: str,
        parent_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get hierarchical org unit tree"""
        org_units = await self.list_org_units(tenant_id)

        # Build tree structure
        def build_tree(parent_id: Optional[uuid.UUID]) -> List[Dict[str, Any]]:
            children = [
                ou for ou in org_units
                if ou.parent_id == parent_id
            ]
            return [
                {
                    "id": str(ou.id),
                    "name": ou.name,
                    "description": ou.description,
                    "path": ou.path,
                    "manager_id": str(ou.manager_id) if ou.manager_id else None,
                    "service_settings": ou.service_settings,
                    "children": build_tree(ou.id)
                }
                for ou in children
            ]

        root_parent = uuid.UUID(parent_id) if parent_id else None
        return build_tree(root_parent)

    async def update_org_unit(
        self,
        org_unit_id: str,
        tenant_id: str,
        updates: Dict[str, Any]
    ) -> Optional[OrgUnit]:
        """Update org unit"""
        org_unit = await self.get_org_unit(org_unit_id, tenant_id)
        if not org_unit:
            return None

        # Handle name change (update path)
        if "name" in updates and updates["name"] != org_unit.name:
            old_path = org_unit.path
            new_name = updates["name"]

            # Calculate new path
            if org_unit.parent_id:
                parent = await self.get_org_unit(str(org_unit.parent_id), tenant_id)
                new_path = f"{parent.path}/{new_name}"
            else:
                new_path = f"/{new_name}"

            # Update all children's paths
            children = await self.db.execute(
                select(OrgUnit).where(
                    and_(
                        OrgUnit.tenant_id == uuid.UUID(tenant_id),
                        OrgUnit.path.like(f"{old_path}/%")
                    )
                )
            )
            for child in children.scalars().all():
                child.path = child.path.replace(old_path, new_path, 1)

            org_unit.path = new_path
            org_unit.name = new_name

        # Update other fields
        for key, value in updates.items():
            if key in ["description", "service_settings", "inherit_from_parent"]:
                setattr(org_unit, key, value)
            elif key == "manager_id":
                org_unit.manager_id = uuid.UUID(value) if value else None

        org_unit.updated_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(org_unit)
        return org_unit

    async def delete_org_unit(
        self,
        org_unit_id: str,
        tenant_id: str,
        reassign_users_to: Optional[str] = None
    ) -> bool:
        """Delete org unit (soft delete)"""
        org_unit = await self.get_org_unit(org_unit_id, tenant_id)
        if not org_unit:
            return False

        # Check for children
        children = await self.db.execute(
            select(func.count(OrgUnit.id)).where(
                and_(
                    OrgUnit.parent_id == uuid.UUID(org_unit_id),
                    OrgUnit.is_active == True
                )
            )
        )
        child_count = children.scalar()
        if child_count > 0:
            raise ValueError(f"Cannot delete org unit with {child_count} child units")

        # Soft delete
        org_unit.is_active = False
        org_unit.updated_at = datetime.utcnow()

        await self.db.commit()
        logger.info(f"Deleted org unit {org_unit.name} ({org_unit_id})")
        return True

    async def move_org_unit(
        self,
        org_unit_id: str,
        new_parent_id: Optional[str],
        tenant_id: str
    ) -> Optional[OrgUnit]:
        """Move org unit to new parent"""
        org_unit = await self.get_org_unit(org_unit_id, tenant_id)
        if not org_unit:
            return None

        old_path = org_unit.path

        # Calculate new path
        if new_parent_id:
            new_parent = await self.get_org_unit(new_parent_id, tenant_id)
            if not new_parent:
                raise ValueError("New parent not found")
            new_path = f"{new_parent.path}/{org_unit.name}"
        else:
            new_path = f"/{org_unit.name}"

        # Update org unit and all children's paths
        org_unit.parent_id = uuid.UUID(new_parent_id) if new_parent_id else None
        org_unit.path = new_path

        # Update children
        children = await self.db.execute(
            select(OrgUnit).where(
                and_(
                    OrgUnit.tenant_id == uuid.UUID(tenant_id),
                    OrgUnit.path.like(f"{old_path}/%")
                )
            )
        )
        for child in children.scalars().all():
            child.path = child.path.replace(old_path, new_path, 1)

        org_unit.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(org_unit)

        return org_unit


class UserGroupService:
    """Service for managing User Groups"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_group(
        self,
        tenant_id: str,
        name: str,
        created_by: str,
        description: Optional[str] = None,
        email: Optional[str] = None,
        group_type: str = "distribution",
        settings: Optional[Dict[str, Any]] = None
    ) -> UserGroup:
        """Create a new user group"""
        # Check for duplicate email
        if email:
            existing = await self.db.execute(
                select(UserGroup).where(
                    and_(
                        UserGroup.tenant_id == uuid.UUID(tenant_id),
                        UserGroup.email == email
                    )
                )
            )
            if existing.scalar_one_or_none():
                raise ValueError(f"Group with email '{email}' already exists")

        group = UserGroup(
            tenant_id=uuid.UUID(tenant_id),
            name=name,
            description=description,
            email=email,
            group_type=group_type,
            settings=settings or {},
            created_by=uuid.UUID(created_by)
        )

        self.db.add(group)
        await self.db.commit()
        await self.db.refresh(group)

        logger.info(f"Created group {name} ({group.id}) in tenant {tenant_id}")
        return group

    async def get_group(
        self,
        group_id: str,
        tenant_id: str
    ) -> Optional[UserGroup]:
        """Get group by ID"""
        result = await self.db.execute(
            select(UserGroup).where(
                and_(
                    UserGroup.id == uuid.UUID(group_id),
                    UserGroup.tenant_id == uuid.UUID(tenant_id),
                    UserGroup.is_active == True
                )
            ).options(selectinload(UserGroup.members))
        )
        return result.scalar_one_or_none()

    async def list_groups(
        self,
        tenant_id: str,
        group_type: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[UserGroup]:
        """List groups"""
        query = select(UserGroup).where(
            and_(
                UserGroup.tenant_id == uuid.UUID(tenant_id),
                UserGroup.is_active == True
            )
        )

        if group_type:
            query = query.where(UserGroup.group_type == group_type)

        if search:
            query = query.where(
                or_(
                    UserGroup.name.ilike(f"%{search}%"),
                    UserGroup.email.ilike(f"%{search}%")
                )
            )

        query = query.order_by(UserGroup.name).limit(limit).offset(offset)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update_group(
        self,
        group_id: str,
        tenant_id: str,
        updates: Dict[str, Any]
    ) -> Optional[UserGroup]:
        """Update group"""
        group = await self.get_group(group_id, tenant_id)
        if not group:
            return None

        # Update fields
        for key, value in updates.items():
            if key in [
                "name", "description", "email", "group_type",
                "who_can_post", "who_can_view_members",
                "allow_external_senders", "moderation_enabled",
                "dynamic_rules", "settings"
            ]:
                setattr(group, key, value)
            elif key == "moderator_ids":
                group.moderator_ids = [uuid.UUID(mid) for mid in value] if value else []

        group.updated_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(group)
        return group

    async def delete_group(
        self,
        group_id: str,
        tenant_id: str
    ) -> bool:
        """Delete group (soft delete)"""
        group = await self.get_group(group_id, tenant_id)
        if not group:
            return False

        group.is_active = False
        group.updated_at = datetime.utcnow()

        await self.db.commit()
        logger.info(f"Deleted group {group.name} ({group_id})")
        return True

    async def add_member(
        self,
        group_id: str,
        user_id: str,
        tenant_id: str,
        added_by: str,
        role: str = "member"
    ) -> UserGroupMember:
        """Add a member to group"""
        group = await self.get_group(group_id, tenant_id)
        if not group:
            raise ValueError("Group not found")

        # Check if already a member
        existing = await self.db.execute(
            select(UserGroupMember).where(
                and_(
                    UserGroupMember.group_id == uuid.UUID(group_id),
                    UserGroupMember.user_id == uuid.UUID(user_id)
                )
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError("User is already a member of this group")

        member = UserGroupMember(
            group_id=uuid.UUID(group_id),
            user_id=uuid.UUID(user_id),
            role=role,
            added_by=uuid.UUID(added_by)
        )

        self.db.add(member)
        await self.db.commit()
        await self.db.refresh(member)

        logger.info(f"Added user {user_id} to group {group_id}")
        return member

    async def remove_member(
        self,
        group_id: str,
        user_id: str,
        tenant_id: str
    ) -> bool:
        """Remove a member from group"""
        # Verify group exists
        group = await self.get_group(group_id, tenant_id)
        if not group:
            return False

        result = await self.db.execute(
            delete(UserGroupMember).where(
                and_(
                    UserGroupMember.group_id == uuid.UUID(group_id),
                    UserGroupMember.user_id == uuid.UUID(user_id)
                )
            )
        )

        await self.db.commit()

        if result.rowcount > 0:
            logger.info(f"Removed user {user_id} from group {group_id}")
            return True
        return False

    async def list_members(
        self,
        group_id: str,
        tenant_id: str,
        limit: int = 100,
        offset: int = 0
    ) -> List[UserGroupMember]:
        """List group members"""
        # Verify group exists
        group = await self.get_group(group_id, tenant_id)
        if not group:
            raise ValueError("Group not found")

        result = await self.db.execute(
            select(UserGroupMember).where(
                UserGroupMember.group_id == uuid.UUID(group_id)
            ).order_by(UserGroupMember.added_at.desc())
            .limit(limit).offset(offset)
        )
        return list(result.scalars().all())

    async def get_user_groups(
        self,
        user_id: str,
        tenant_id: str
    ) -> List[UserGroup]:
        """Get all groups a user belongs to"""
        result = await self.db.execute(
            select(UserGroup).join(UserGroupMember).where(
                and_(
                    UserGroupMember.user_id == uuid.UUID(user_id),
                    UserGroup.tenant_id == uuid.UUID(tenant_id),
                    UserGroup.is_active == True
                )
            )
        )
        return list(result.scalars().all())

    async def bulk_add_members(
        self,
        group_id: str,
        user_ids: List[str],
        tenant_id: str,
        added_by: str
    ) -> Dict[str, Any]:
        """Bulk add members to group"""
        group = await self.get_group(group_id, tenant_id)
        if not group:
            raise ValueError("Group not found")

        added = 0
        skipped = 0

        for user_id in user_ids:
            try:
                await self.add_member(group_id, user_id, tenant_id, added_by)
                added += 1
            except ValueError:
                skipped += 1  # Already a member

        return {
            "added": added,
            "skipped": skipped,
            "total": len(user_ids)
        }

    async def update_member_role(
        self,
        group_id: str,
        user_id: str,
        tenant_id: str,
        new_role: str
    ) -> Optional[UserGroupMember]:
        """Update member's role in group"""
        group = await self.get_group(group_id, tenant_id)
        if not group:
            return None

        result = await self.db.execute(
            select(UserGroupMember).where(
                and_(
                    UserGroupMember.group_id == uuid.UUID(group_id),
                    UserGroupMember.user_id == uuid.UUID(user_id)
                )
            )
        )
        member = result.scalar_one_or_none()
        if not member:
            return None

        member.role = new_role
        await self.db.commit()
        await self.db.refresh(member)

        return member
