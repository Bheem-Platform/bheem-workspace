"""
Bheem Workspace - Admin Service
Business logic for Admin Roles, SSO, Security Policies, and User Import
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func, and_, or_
from sqlalchemy.orm import selectinload
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid
import csv
import io
import logging

from models.org_models import (
    AdminRole, UserAdminRole, SSOConfiguration,
    SecurityPolicy, UserImportJob
)

logger = logging.getLogger(__name__)


# =============================================
# Available Permissions Definition
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


class AdminRoleService:
    """Service for managing Admin Roles"""

    def __init__(self, db: AsyncSession):
        self.db = db

    def get_available_permissions(self) -> Dict[str, str]:
        """Get all available permissions"""
        return AVAILABLE_PERMISSIONS

    def validate_permissions(self, permissions: List[str]) -> List[str]:
        """Validate permissions and return invalid ones"""
        return [p for p in permissions if p not in AVAILABLE_PERMISSIONS]

    async def create_role(
        self,
        tenant_id: str,
        name: str,
        permissions: List[str],
        created_by: str,
        description: Optional[str] = None,
        is_system: bool = False
    ) -> AdminRole:
        """Create a new admin role"""
        # Validate permissions
        invalid = self.validate_permissions(permissions)
        if invalid:
            raise ValueError(f"Invalid permissions: {', '.join(invalid)}")

        # Check for duplicate name
        existing = await self.db.execute(
            select(AdminRole).where(
                and_(
                    AdminRole.tenant_id == uuid.UUID(tenant_id),
                    AdminRole.name == name
                )
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError(f"Role '{name}' already exists")

        role = AdminRole(
            tenant_id=uuid.UUID(tenant_id),
            name=name,
            description=description,
            permissions=permissions,
            is_system=is_system,
            created_by=uuid.UUID(created_by)
        )

        self.db.add(role)
        await self.db.commit()
        await self.db.refresh(role)

        logger.info(f"Created admin role {name} ({role.id}) in tenant {tenant_id}")
        return role

    async def get_role(
        self,
        role_id: str,
        tenant_id: str
    ) -> Optional[AdminRole]:
        """Get role by ID"""
        result = await self.db.execute(
            select(AdminRole).where(
                and_(
                    AdminRole.id == uuid.UUID(role_id),
                    AdminRole.tenant_id == uuid.UUID(tenant_id)
                )
            )
        )
        return result.scalar_one_or_none()

    async def list_roles(
        self,
        tenant_id: str,
        include_system: bool = True
    ) -> List[AdminRole]:
        """List all admin roles"""
        query = select(AdminRole).where(
            AdminRole.tenant_id == uuid.UUID(tenant_id)
        )

        if not include_system:
            query = query.where(AdminRole.is_system == False)

        query = query.order_by(AdminRole.is_system.desc(), AdminRole.name)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update_role(
        self,
        role_id: str,
        tenant_id: str,
        updates: Dict[str, Any]
    ) -> Optional[AdminRole]:
        """Update admin role"""
        role = await self.get_role(role_id, tenant_id)
        if not role:
            return None

        # Cannot modify system role name/permissions
        if role.is_system and ("name" in updates or "permissions" in updates):
            raise ValueError("Cannot modify system role name or permissions")

        # Validate permissions if updating
        if "permissions" in updates:
            invalid = self.validate_permissions(updates["permissions"])
            if invalid:
                raise ValueError(f"Invalid permissions: {', '.join(invalid)}")

        for key, value in updates.items():
            if key in ["name", "description", "permissions"]:
                setattr(role, key, value)

        role.updated_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(role)
        return role

    async def delete_role(
        self,
        role_id: str,
        tenant_id: str
    ) -> bool:
        """Delete admin role"""
        role = await self.get_role(role_id, tenant_id)
        if not role:
            return False

        if role.is_system:
            raise ValueError("Cannot delete system roles")

        # Check for assigned users
        count_result = await self.db.execute(
            select(func.count(UserAdminRole.id)).where(
                UserAdminRole.role_id == uuid.UUID(role_id)
            )
        )
        user_count = count_result.scalar()
        if user_count > 0:
            raise ValueError(f"Cannot delete role with {user_count} assigned users")

        await self.db.delete(role)
        await self.db.commit()

        logger.info(f"Deleted admin role {role.name} ({role_id})")
        return True

    async def assign_role(
        self,
        role_id: str,
        user_id: str,
        tenant_id: str,
        assigned_by: str,
        scope_type: str = "global",
        scope_id: Optional[str] = None,
        expires_at: Optional[datetime] = None
    ) -> UserAdminRole:
        """Assign role to user"""
        # Verify role exists
        role = await self.get_role(role_id, tenant_id)
        if not role:
            raise ValueError("Role not found")

        # Check for existing assignment
        existing = await self.db.execute(
            select(UserAdminRole).where(
                and_(
                    UserAdminRole.user_id == uuid.UUID(user_id),
                    UserAdminRole.role_id == uuid.UUID(role_id),
                    UserAdminRole.scope_type == scope_type,
                    UserAdminRole.scope_id == (uuid.UUID(scope_id) if scope_id else None)
                )
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError("Role already assigned to user")

        assignment = UserAdminRole(
            user_id=uuid.UUID(user_id),
            role_id=uuid.UUID(role_id),
            scope_type=scope_type,
            scope_id=uuid.UUID(scope_id) if scope_id else None,
            assigned_by=uuid.UUID(assigned_by),
            expires_at=expires_at
        )

        self.db.add(assignment)
        await self.db.commit()
        await self.db.refresh(assignment)

        logger.info(f"Assigned role {role_id} to user {user_id}")
        return assignment

    async def remove_assignment(
        self,
        assignment_id: str
    ) -> bool:
        """Remove role assignment"""
        result = await self.db.execute(
            delete(UserAdminRole).where(
                UserAdminRole.id == uuid.UUID(assignment_id)
            )
        )
        await self.db.commit()

        if result.rowcount > 0:
            logger.info(f"Removed role assignment {assignment_id}")
            return True
        return False

    async def get_user_permissions(
        self,
        user_id: str,
        tenant_id: str
    ) -> List[str]:
        """Get effective permissions for a user"""
        result = await self.db.execute(
            select(AdminRole).join(UserAdminRole).where(
                and_(
                    UserAdminRole.user_id == uuid.UUID(user_id),
                    AdminRole.tenant_id == uuid.UUID(tenant_id),
                    or_(
                        UserAdminRole.expires_at.is_(None),
                        UserAdminRole.expires_at > datetime.utcnow()
                    )
                )
            )
        )

        permissions = set()
        for role in result.scalars().all():
            if role.permissions:
                permissions.update(role.permissions)

        return list(permissions)

    async def check_permission(
        self,
        user_id: str,
        tenant_id: str,
        required_permission: str
    ) -> bool:
        """Check if user has a specific permission"""
        permissions = await self.get_user_permissions(user_id, tenant_id)

        # Wildcard grants all permissions
        if "*" in permissions:
            return True

        # Check specific permission
        if required_permission in permissions:
            return True

        # Check wildcard for category (e.g., "users.*" matches "users.read")
        category = required_permission.split(".")[0]
        if f"{category}.*" in permissions:
            return True

        return False

    async def create_default_roles(
        self,
        tenant_id: str,
        created_by: str
    ) -> List[AdminRole]:
        """Create default system roles for a tenant"""
        default_roles = [
            {
                "name": "Super Admin",
                "description": "Full administrative access to all features",
                "permissions": ["*"]
            },
            {
                "name": "User Admin",
                "description": "Manage users and groups",
                "permissions": [
                    "users.read", "users.write", "users.delete",
                    "users.reset_password", "users.suspend", "users.bulk_import",
                    "groups.read", "groups.write", "groups.delete"
                ]
            },
            {
                "name": "Help Desk",
                "description": "View-only access with password reset capability",
                "permissions": ["users.read", "users.reset_password", "groups.read"]
            },
            {
                "name": "Billing Admin",
                "description": "Manage billing and view billing reports",
                "permissions": ["billing.read", "billing.write", "reports.billing"]
            },
            {
                "name": "Security Admin",
                "description": "Manage security settings and view audit logs",
                "permissions": [
                    "security.view_logs", "security.manage_policies",
                    "security.manage_sso"
                ]
            }
        ]

        created_roles = []
        for role_data in default_roles:
            role = await self.create_role(
                tenant_id=tenant_id,
                name=role_data["name"],
                description=role_data["description"],
                permissions=role_data["permissions"],
                created_by=created_by,
                is_system=True
            )
            created_roles.append(role)

        return created_roles


class SSOService:
    """Service for SSO Configuration"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_config(
        self,
        tenant_id: str,
        provider_type: Optional[str] = None
    ) -> Optional[SSOConfiguration]:
        """Get SSO configuration"""
        query = select(SSOConfiguration).where(
            SSOConfiguration.tenant_id == uuid.UUID(tenant_id)
        )

        if provider_type:
            query = query.where(SSOConfiguration.provider_type == provider_type)

        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def list_configs(
        self,
        tenant_id: str
    ) -> List[SSOConfiguration]:
        """List all SSO configurations for tenant"""
        result = await self.db.execute(
            select(SSOConfiguration).where(
                SSOConfiguration.tenant_id == uuid.UUID(tenant_id)
            ).order_by(SSOConfiguration.is_primary.desc())
        )
        return list(result.scalars().all())

    async def create_or_update_config(
        self,
        tenant_id: str,
        provider_type: str,
        config_data: Dict[str, Any],
        created_by: str
    ) -> SSOConfiguration:
        """Create or update SSO configuration"""
        existing = await self.get_config(tenant_id, provider_type)

        if existing:
            # Update existing
            for key, value in config_data.items():
                if hasattr(existing, key):
                    setattr(existing, key, value)
            existing.updated_at = datetime.utcnow()
            await self.db.commit()
            await self.db.refresh(existing)
            return existing

        # Create new
        config = SSOConfiguration(
            tenant_id=uuid.UUID(tenant_id),
            provider_type=provider_type,
            created_by=uuid.UUID(created_by),
            **config_data
        )

        self.db.add(config)
        await self.db.commit()
        await self.db.refresh(config)

        logger.info(f"Created SSO config for tenant {tenant_id}, provider {provider_type}")
        return config

    async def enable_sso(
        self,
        tenant_id: str,
        provider_type: str,
        is_primary: bool = False
    ) -> bool:
        """Enable SSO configuration"""
        config = await self.get_config(tenant_id, provider_type)
        if not config:
            return False

        # If setting as primary, unset others
        if is_primary:
            await self.db.execute(
                update(SSOConfiguration).where(
                    SSOConfiguration.tenant_id == uuid.UUID(tenant_id)
                ).values(is_primary=False)
            )

        config.is_enabled = True
        config.is_primary = is_primary
        config.updated_at = datetime.utcnow()

        await self.db.commit()
        return True

    async def disable_sso(
        self,
        tenant_id: str,
        provider_type: str
    ) -> bool:
        """Disable SSO configuration"""
        config = await self.get_config(tenant_id, provider_type)
        if not config:
            return False

        config.is_enabled = False
        config.is_primary = False
        config.updated_at = datetime.utcnow()

        await self.db.commit()
        return True

    async def delete_config(
        self,
        tenant_id: str,
        provider_type: str
    ) -> bool:
        """Delete SSO configuration"""
        result = await self.db.execute(
            delete(SSOConfiguration).where(
                and_(
                    SSOConfiguration.tenant_id == uuid.UUID(tenant_id),
                    SSOConfiguration.provider_type == provider_type
                )
            )
        )
        await self.db.commit()
        return result.rowcount > 0


class SecurityPolicyService:
    """Service for Security Policies"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_policy(
        self,
        tenant_id: str
    ) -> Optional[SecurityPolicy]:
        """Get security policy for tenant"""
        result = await self.db.execute(
            select(SecurityPolicy).where(
                SecurityPolicy.tenant_id == uuid.UUID(tenant_id)
            )
        )
        return result.scalar_one_or_none()

    async def create_or_update_policy(
        self,
        tenant_id: str,
        policy_data: Dict[str, Any],
        updated_by: str
    ) -> SecurityPolicy:
        """Create or update security policy"""
        existing = await self.get_policy(tenant_id)

        if existing:
            for key, value in policy_data.items():
                if hasattr(existing, key):
                    setattr(existing, key, value)
            existing.updated_at = datetime.utcnow()
            existing.updated_by = uuid.UUID(updated_by)
            await self.db.commit()
            await self.db.refresh(existing)
            return existing

        # Create with defaults
        policy = SecurityPolicy(
            tenant_id=uuid.UUID(tenant_id),
            updated_by=uuid.UUID(updated_by),
            **policy_data
        )

        self.db.add(policy)
        await self.db.commit()
        await self.db.refresh(policy)

        logger.info(f"Created security policy for tenant {tenant_id}")
        return policy

    def validate_password(
        self,
        password: str,
        policy: SecurityPolicy
    ) -> Dict[str, Any]:
        """Validate password against policy"""
        errors = []

        if len(password) < policy.password_min_length:
            errors.append(f"Password must be at least {policy.password_min_length} characters")

        if policy.password_require_uppercase and not any(c.isupper() for c in password):
            errors.append("Password must contain at least one uppercase letter")

        if policy.password_require_lowercase and not any(c.islower() for c in password):
            errors.append("Password must contain at least one lowercase letter")

        if policy.password_require_numbers and not any(c.isdigit() for c in password):
            errors.append("Password must contain at least one number")

        if policy.password_require_symbols and not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password):
            errors.append("Password must contain at least one special character")

        return {
            "valid": len(errors) == 0,
            "errors": errors
        }


class UserImportService:
    """Service for bulk user import"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_import_job(
        self,
        tenant_id: str,
        filename: str,
        file_size: int,
        created_by: str,
        import_options: Optional[Dict[str, Any]] = None
    ) -> UserImportJob:
        """Create a new import job"""
        job = UserImportJob(
            tenant_id=uuid.UUID(tenant_id),
            filename=filename,
            file_size=file_size,
            import_options=import_options or {
                "send_invite": True,
                "duplicate_action": "skip"
            },
            created_by=uuid.UUID(created_by)
        )

        self.db.add(job)
        await self.db.commit()
        await self.db.refresh(job)

        logger.info(f"Created import job {job.id} for tenant {tenant_id}")
        return job

    async def get_job(
        self,
        job_id: str,
        tenant_id: str
    ) -> Optional[UserImportJob]:
        """Get import job by ID"""
        result = await self.db.execute(
            select(UserImportJob).where(
                and_(
                    UserImportJob.id == uuid.UUID(job_id),
                    UserImportJob.tenant_id == uuid.UUID(tenant_id)
                )
            )
        )
        return result.scalar_one_or_none()

    async def list_jobs(
        self,
        tenant_id: str,
        limit: int = 20,
        offset: int = 0
    ) -> List[UserImportJob]:
        """List import jobs"""
        result = await self.db.execute(
            select(UserImportJob).where(
                UserImportJob.tenant_id == uuid.UUID(tenant_id)
            ).order_by(UserImportJob.created_at.desc())
            .limit(limit).offset(offset)
        )
        return list(result.scalars().all())

    async def update_job_progress(
        self,
        job_id: str,
        processed: int,
        successful: int,
        failed: int,
        skipped: int = 0,
        errors: Optional[List[Dict]] = None
    ) -> Optional[UserImportJob]:
        """Update job progress"""
        result = await self.db.execute(
            select(UserImportJob).where(
                UserImportJob.id == uuid.UUID(job_id)
            )
        )
        job = result.scalar_one_or_none()
        if not job:
            return None

        job.processed_rows = processed
        job.successful_imports = successful
        job.failed_imports = failed
        job.skipped_rows = skipped

        if errors:
            job.errors = (job.errors or []) + errors

        await self.db.commit()
        await self.db.refresh(job)
        return job

    async def start_job(
        self,
        job_id: str
    ) -> Optional[UserImportJob]:
        """Mark job as started"""
        result = await self.db.execute(
            select(UserImportJob).where(
                UserImportJob.id == uuid.UUID(job_id)
            )
        )
        job = result.scalar_one_or_none()
        if not job:
            return None

        job.status = "processing"
        job.started_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(job)
        return job

    async def complete_job(
        self,
        job_id: str,
        success: bool = True
    ) -> Optional[UserImportJob]:
        """Mark job as completed"""
        result = await self.db.execute(
            select(UserImportJob).where(
                UserImportJob.id == uuid.UUID(job_id)
            )
        )
        job = result.scalar_one_or_none()
        if not job:
            return None

        job.status = "completed" if success else "failed"
        job.completed_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(job)
        return job

    def parse_csv(
        self,
        csv_content: str
    ) -> Dict[str, Any]:
        """Parse CSV content and return preview data"""
        reader = csv.DictReader(io.StringIO(csv_content))

        rows = []
        errors = []

        required_fields = ["email"]
        optional_fields = ["first_name", "last_name", "name", "department", "job_title", "role", "org_unit"]

        # Validate headers
        if not reader.fieldnames:
            return {"valid": False, "errors": ["Empty CSV or missing headers"]}

        missing_required = [f for f in required_fields if f not in reader.fieldnames]
        if missing_required:
            return {"valid": False, "errors": [f"Missing required fields: {', '.join(missing_required)}"]}

        for i, row in enumerate(reader, start=2):  # Start at 2 (after header)
            row_errors = []

            # Validate email
            email = row.get("email", "").strip()
            if not email or "@" not in email:
                row_errors.append("Invalid email format")

            if row_errors:
                errors.append({
                    "row": i,
                    "email": email,
                    "errors": row_errors
                })

            rows.append({
                "row": i,
                "data": row,
                "valid": len(row_errors) == 0,
                "errors": row_errors
            })

        return {
            "valid": len(errors) == 0,
            "total_rows": len(rows),
            "valid_rows": len([r for r in rows if r["valid"]]),
            "invalid_rows": len(errors),
            "preview": rows[:10],  # First 10 rows
            "errors": errors[:20]  # First 20 errors
        }

    def generate_csv_template(self) -> str:
        """Generate CSV template"""
        return "email,first_name,last_name,department,job_title,role,org_unit\njohn@example.com,John,Doe,Engineering,Developer,member,/Engineering"
