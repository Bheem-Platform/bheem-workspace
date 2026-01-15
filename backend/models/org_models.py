"""
Bheem Workspace - Organization & Access Control Models
Models for org units, groups, admin roles, and SSO
"""
from sqlalchemy import Column, String, Boolean, Integer, Text, DateTime, ForeignKey, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from core.database import Base


# =============================================
# Organizational Units
# =============================================

class OrgUnit(Base):
    """Organizational Unit (Department/Team hierarchy)"""
    __tablename__ = "org_units"
    __table_args__ = (
        Index('idx_org_units_tenant', 'tenant_id'),
        Index('idx_org_units_parent', 'parent_id'),
        Index('idx_org_units_path', 'path'),
        UniqueConstraint('tenant_id', 'path', name='uq_org_units_path'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenants.id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("workspace.org_units.id", ondelete="SET NULL"))

    # Basic info
    name = Column(String(255), nullable=False)
    description = Column(Text)
    path = Column(String(1000), nullable=False)  # /Engineering/Backend - for easy hierarchy queries

    # Managers
    manager_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenant_users.id", ondelete="SET NULL"))

    # Service access control (override tenant settings)
    service_settings = Column(JSONB, default={})  # { "mail": true, "meet": false, "docs": true }
    inherit_from_parent = Column(Boolean, default=True)  # Inherit service settings from parent

    # Settings
    settings = Column(JSONB, default={})

    # Status
    is_active = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(UUID(as_uuid=True))

    # Relationships
    parent = relationship("OrgUnit", remote_side=[id], backref="children")

    def __repr__(self):
        return f"<OrgUnit(id={self.id}, name={self.name}, path={self.path})>"


# =============================================
# User Groups
# =============================================

class UserGroup(Base):
    """User Groups for distribution lists and access control"""
    __tablename__ = "user_groups"
    __table_args__ = (
        Index('idx_user_groups_tenant', 'tenant_id'),
        Index('idx_user_groups_type', 'group_type'),
        Index('idx_user_groups_email', 'email'),
        UniqueConstraint('tenant_id', 'email', name='uq_user_groups_email'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenants.id", ondelete="CASCADE"), nullable=False)

    # Basic info
    name = Column(String(255), nullable=False)
    description = Column(Text)
    email = Column(String(320))  # Group email address for distribution lists

    # Group type: distribution, security, dynamic
    group_type = Column(String(20), nullable=False, default='distribution')

    # Dynamic group rules (for auto-population based on criteria)
    # e.g., { "department": "Engineering", "role": "member" }
    dynamic_rules = Column(JSONB, default={})

    # Access control settings
    who_can_post = Column(String(20), default='members')  # members, managers, anyone
    who_can_view_members = Column(String(20), default='members')  # members, managers, anyone

    # Mail settings for distribution lists
    allow_external_senders = Column(Boolean, default=False)
    moderation_enabled = Column(Boolean, default=False)
    moderator_ids = Column(ARRAY(UUID(as_uuid=True)), default=[])

    # Settings
    settings = Column(JSONB, default={})

    # Status
    is_active = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(UUID(as_uuid=True))

    # Relationships
    members = relationship("UserGroupMember", back_populates="group", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<UserGroup(id={self.id}, name={self.name}, type={self.group_type})>"


class UserGroupMember(Base):
    """Group membership"""
    __tablename__ = "user_group_members"
    __table_args__ = (
        Index('idx_group_members_group', 'group_id'),
        Index('idx_group_members_user', 'user_id'),
        UniqueConstraint('group_id', 'user_id', name='uq_group_members'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id = Column(UUID(as_uuid=True), ForeignKey("workspace.user_groups.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenant_users.id", ondelete="CASCADE"), nullable=False)

    # Role within group: member, manager, owner
    role = Column(String(20), default='member')

    # Delivery settings for distribution lists
    delivery_enabled = Column(Boolean, default=True)  # Receive emails to group

    # How they joined
    membership_source = Column(String(20), default='manual')  # manual, dynamic, import

    # Timestamps
    added_at = Column(DateTime, default=datetime.utcnow)
    added_by = Column(UUID(as_uuid=True))

    # Relationships
    group = relationship("UserGroup", back_populates="members")

    def __repr__(self):
        return f"<UserGroupMember(group_id={self.group_id}, user_id={self.user_id})>"


# =============================================
# Admin Roles
# =============================================

class AdminRole(Base):
    """Custom admin roles with granular permissions"""
    __tablename__ = "admin_roles"
    __table_args__ = (
        Index('idx_admin_roles_tenant', 'tenant_id'),
        UniqueConstraint('tenant_id', 'name', name='uq_admin_roles_name'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenants.id", ondelete="CASCADE"), nullable=False)

    # Basic info
    name = Column(String(100), nullable=False)
    description = Column(Text)

    # Permissions array: ["users.read", "users.write", "groups.*", "*"]
    permissions = Column(ARRAY(Text), default=[])

    # System role flag (cannot be deleted/modified)
    is_system = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(UUID(as_uuid=True))

    # Relationships
    assignments = relationship("UserAdminRole", back_populates="role", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<AdminRole(id={self.id}, name={self.name}, is_system={self.is_system})>"


class UserAdminRole(Base):
    """Role assignments to users with optional scope"""
    __tablename__ = "user_admin_roles"
    __table_args__ = (
        Index('idx_user_admin_roles_user', 'user_id'),
        Index('idx_user_admin_roles_role', 'role_id'),
        Index('idx_user_admin_roles_scope', 'scope_type', 'scope_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenant_users.id", ondelete="CASCADE"), nullable=False)
    role_id = Column(UUID(as_uuid=True), ForeignKey("workspace.admin_roles.id", ondelete="CASCADE"), nullable=False)

    # Scope: global, org_unit, group
    scope_type = Column(String(20), default='global')
    scope_id = Column(UUID(as_uuid=True))  # If scoped to specific org unit or group

    # Assignment tracking
    assigned_by = Column(UUID(as_uuid=True))
    assigned_at = Column(DateTime, default=datetime.utcnow)

    # Expiration (for temporary assignments)
    expires_at = Column(DateTime)

    # Relationships
    role = relationship("AdminRole", back_populates="assignments")

    def __repr__(self):
        return f"<UserAdminRole(user_id={self.user_id}, role_id={self.role_id}, scope={self.scope_type})>"


# =============================================
# SSO Configuration
# =============================================

class SSOConfiguration(Base):
    """SSO/SAML/OIDC configuration per tenant"""
    __tablename__ = "sso_configurations"
    __table_args__ = (
        Index('idx_sso_config_tenant', 'tenant_id'),
        UniqueConstraint('tenant_id', 'provider_type', name='uq_sso_config_provider'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenants.id", ondelete="CASCADE"), nullable=False)

    # Provider info
    provider_type = Column(String(20), nullable=False)  # saml, oidc
    provider_name = Column(String(100))  # Okta, Azure AD, Google, Custom

    # Status
    is_enabled = Column(Boolean, default=False)
    is_primary = Column(Boolean, default=False)  # Primary SSO method

    # SAML configuration
    saml_entity_id = Column(String(500))
    saml_sso_url = Column(String(1000))  # IdP Single Sign-On URL
    saml_slo_url = Column(String(1000))  # IdP Single Logout URL
    saml_certificate = Column(Text)  # IdP X.509 certificate
    saml_name_id_format = Column(String(200), default='urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress')

    # OIDC configuration
    oidc_client_id = Column(String(255))
    oidc_client_secret = Column(Text)  # Encrypted
    oidc_issuer_url = Column(String(1000))
    oidc_authorization_endpoint = Column(String(1000))
    oidc_token_endpoint = Column(String(1000))
    oidc_userinfo_endpoint = Column(String(1000))
    oidc_scopes = Column(ARRAY(Text), default=['openid', 'email', 'profile'])

    # User attribute mapping
    attribute_mapping = Column(JSONB, default={
        "email": "email",
        "first_name": "given_name",
        "last_name": "family_name",
        "display_name": "name"
    })

    # Auto-provisioning settings
    auto_provision_users = Column(Boolean, default=True)  # Create users on first login
    auto_update_profile = Column(Boolean, default=True)  # Update profile from IdP
    default_role = Column(String(50), default='member')  # Role for new users
    default_org_unit_id = Column(UUID(as_uuid=True))  # Default org unit for new users

    # Settings
    settings = Column(JSONB, default={})

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(UUID(as_uuid=True))

    def __repr__(self):
        return f"<SSOConfiguration(tenant_id={self.tenant_id}, provider={self.provider_name}, type={self.provider_type})>"


# =============================================
# Domain Aliases
# =============================================

class DomainAlias(Base):
    """Domain aliases for multi-domain email support"""
    __tablename__ = "domain_aliases"
    __table_args__ = (
        Index('idx_domain_aliases_domain', 'domain_id'),
        Index('idx_domain_aliases_alias', 'alias_domain'),
        UniqueConstraint('alias_domain', name='uq_domain_aliases_alias'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    domain_id = Column(UUID(as_uuid=True), ForeignKey("workspace.domains.id", ondelete="CASCADE"), nullable=False)

    # Alias domain
    alias_domain = Column(String(255), nullable=False)

    # Verification status
    is_verified = Column(Boolean, default=False)
    verification_token = Column(String(100))

    # Status
    is_active = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    verified_at = Column(DateTime)
    created_by = Column(UUID(as_uuid=True))

    def __repr__(self):
        return f"<DomainAlias(domain_id={self.domain_id}, alias={self.alias_domain})>"


# =============================================
# Security Policies
# =============================================

class SecurityPolicy(Base):
    """Security policies for tenant"""
    __tablename__ = "security_policies"
    __table_args__ = (
        Index('idx_security_policies_tenant', 'tenant_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenants.id", ondelete="CASCADE"), nullable=False, unique=True)

    # Password policies
    password_min_length = Column(Integer, default=8)
    password_require_uppercase = Column(Boolean, default=True)
    password_require_lowercase = Column(Boolean, default=True)
    password_require_numbers = Column(Boolean, default=True)
    password_require_symbols = Column(Boolean, default=False)
    password_expiry_days = Column(Integer, default=0)  # 0 = never expires
    password_history_count = Column(Integer, default=5)  # Prevent reuse of last N passwords

    # Session policies
    session_timeout_minutes = Column(Integer, default=480)  # 8 hours
    session_max_concurrent = Column(Integer, default=0)  # 0 = unlimited
    require_2fa = Column(Boolean, default=False)
    require_2fa_for_admins = Column(Boolean, default=True)

    # Login policies
    max_login_attempts = Column(Integer, default=5)
    lockout_duration_minutes = Column(Integer, default=30)
    allowed_ip_ranges = Column(ARRAY(Text), default=[])  # Empty = all allowed

    # Data policies
    enforce_data_retention = Column(Boolean, default=False)
    data_retention_days = Column(Integer, default=365)
    allow_external_sharing = Column(Boolean, default=True)
    allow_public_links = Column(Boolean, default=True)

    # Mobile/Desktop policies
    allow_mobile_apps = Column(Boolean, default=True)
    allow_desktop_apps = Column(Boolean, default=True)
    require_device_encryption = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by = Column(UUID(as_uuid=True))

    def __repr__(self):
        return f"<SecurityPolicy(tenant_id={self.tenant_id})>"


# =============================================
# User Import Jobs
# =============================================

class UserImportJob(Base):
    """Bulk user import job tracking"""
    __tablename__ = "user_import_jobs"
    __table_args__ = (
        Index('idx_user_import_jobs_tenant', 'tenant_id'),
        Index('idx_user_import_jobs_status', 'status'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenants.id", ondelete="CASCADE"), nullable=False)

    # Job info
    filename = Column(String(255))
    file_size = Column(Integer)
    total_rows = Column(Integer, default=0)

    # Progress
    status = Column(String(20), default='pending')  # pending, processing, completed, failed
    processed_rows = Column(Integer, default=0)
    successful_imports = Column(Integer, default=0)
    failed_imports = Column(Integer, default=0)
    skipped_rows = Column(Integer, default=0)

    # Error tracking
    errors = Column(JSONB, default=[])  # [{ "row": 5, "email": "test@example.com", "error": "Invalid email" }]

    # Options
    import_options = Column(JSONB, default={})  # { "send_invite": true, "duplicate_action": "skip" }

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    created_by = Column(UUID(as_uuid=True))

    def __repr__(self):
        return f"<UserImportJob(id={self.id}, status={self.status}, progress={self.processed_rows}/{self.total_rows})>"
