"""
Bheem Workspace - Admin Module Database Models
"""
from sqlalchemy import Column, String, Boolean, Integer, Text, DateTime, ForeignKey, Numeric, JSON, Index
from sqlalchemy.dialects.postgresql import UUID, INET
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from core.database import Base


class Tenant(Base):
    """Tenant/Organization for multi-tenant workspace"""
    __tablename__ = "tenants"
    __table_args__ = (
        Index('idx_tenants_slug', 'slug'),
        Index('idx_tenants_owner', 'owner_email'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), nullable=False, unique=True)
    domain = Column(String(255))
    owner_email = Column(String(320), nullable=False)

    # Plan & Billing
    plan = Column(String(50), nullable=False, default='free')
    billing_email = Column(String(320))
    stripe_customer_id = Column(String(100))

    # Status
    is_active = Column(Boolean, default=True)
    is_suspended = Column(Boolean, default=False)
    suspended_reason = Column(Text)

    # Quotas (based on plan)
    max_users = Column(Integer, default=5)
    meet_quota_hours = Column(Integer, default=10)
    docs_quota_mb = Column(Integer, default=1024)
    mail_quota_mb = Column(Integer, default=512)
    recordings_quota_mb = Column(Integer, default=1024)

    # Current Usage
    meet_used_hours = Column(Numeric(10, 2), default=0)
    docs_used_mb = Column(Numeric(10, 2), default=0)
    mail_used_mb = Column(Numeric(10, 2), default=0)
    recordings_used_mb = Column(Numeric(10, 2), default=0)

    # Settings
    settings = Column(JSON, default={})

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    trial_ends_at = Column(DateTime)

    # Audit
    created_by = Column(UUID(as_uuid=True))

    # Relationships
    users = relationship("TenantUser", back_populates="tenant", cascade="all, delete-orphan")
    domains = relationship("Domain", back_populates="tenant", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Tenant(id={self.id}, name={self.name}, slug={self.slug})>"


class TenantUser(Base):
    """Link users to tenants with roles"""
    __tablename__ = "tenant_users"
    __table_args__ = (
        Index('idx_tenant_users_tenant', 'tenant_id'),
        Index('idx_tenant_users_user', 'user_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenants.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False)

    # Role within tenant
    role = Column(String(50), nullable=False, default='member')  # admin, manager, member

    # Status
    is_active = Column(Boolean, default=True)
    invited_at = Column(DateTime)
    joined_at = Column(DateTime)
    invited_by = Column(UUID(as_uuid=True))

    # Permissions (JSON for granular permissions)
    permissions = Column(JSON, default={})

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    tenant = relationship("Tenant", back_populates="users")

    def __repr__(self):
        return f"<TenantUser(tenant_id={self.tenant_id}, user_id={self.user_id}, role={self.role})>"


class Domain(Base):
    """Custom domains for tenants"""
    __tablename__ = "domains"
    __table_args__ = (
        Index('idx_domains_tenant', 'tenant_id'),
        Index('idx_domains_domain', 'domain'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenants.id", ondelete="CASCADE"), nullable=False)
    domain = Column(String(255), nullable=False, unique=True)

    # Domain type
    domain_type = Column(String(20), nullable=False, default='email')  # email, workspace, custom

    # Provider references
    mailgun_domain_id = Column(String(100))
    cloudflare_zone_id = Column(String(50))

    # Verification status
    spf_verified = Column(Boolean, default=False)
    dkim_verified = Column(Boolean, default=False)
    mx_verified = Column(Boolean, default=False)
    ownership_verified = Column(Boolean, default=False)
    verification_token = Column(String(100))

    # Status
    is_primary = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    verified_at = Column(DateTime)
    created_by = Column(UUID(as_uuid=True))

    # Relationships
    tenant = relationship("Tenant", back_populates="domains")
    dns_records = relationship("DomainDNSRecord", back_populates="domain", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Domain(id={self.id}, domain={self.domain})>"


class DomainDNSRecord(Base):
    """DNS records for domain verification"""
    __tablename__ = "domain_dns_records"
    __table_args__ = (
        Index('idx_dns_records_domain', 'domain_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    domain_id = Column(UUID(as_uuid=True), ForeignKey("workspace.domains.id", ondelete="CASCADE"), nullable=False)

    record_type = Column(String(10), nullable=False)  # TXT, CNAME, MX
    name = Column(String(255), nullable=False)
    value = Column(Text, nullable=False)
    priority = Column(Integer)  # For MX records
    ttl = Column(Integer, default=3600)

    # Verification
    is_verified = Column(Boolean, default=False)
    last_checked_at = Column(DateTime)
    verified_at = Column(DateTime)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    domain = relationship("Domain", back_populates="dns_records")

    def __repr__(self):
        return f"<DomainDNSRecord(type={self.record_type}, name={self.name})>"


class Developer(Base):
    """Developer access management"""
    __tablename__ = "developers"
    __table_args__ = (
        Index('idx_developers_user', 'user_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)

    # Role
    role = Column(String(30), nullable=False)  # lead_developer, developer, junior_developer

    # Access credentials
    ssh_public_key = Column(Text)
    github_username = Column(String(100))

    # Status
    is_active = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(UUID(as_uuid=True))

    # Relationships
    projects = relationship("DeveloperProject", back_populates="developer", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Developer(id={self.id}, role={self.role})>"


class DeveloperProject(Base):
    """Developer project access"""
    __tablename__ = "developer_projects"
    __table_args__ = (
        Index('idx_dev_projects_developer', 'developer_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    developer_id = Column(UUID(as_uuid=True), ForeignKey("workspace.developers.id", ondelete="CASCADE"), nullable=False)

    project_name = Column(String(100), nullable=False)  # bheem-workspace, bheem-core
    access_level = Column(String(20), nullable=False)   # read, write, admin

    # Git access control
    git_branch_pattern = Column(String(100))
    can_push_to_main = Column(Boolean, default=False)
    can_deploy_staging = Column(Boolean, default=False)
    can_deploy_production = Column(Boolean, default=False)

    granted_at = Column(DateTime, default=datetime.utcnow)
    granted_by = Column(UUID(as_uuid=True))

    # Relationships
    developer = relationship("Developer", back_populates="projects")

    def __repr__(self):
        return f"<DeveloperProject(project={self.project_name}, access={self.access_level})>"


class ActivityLog(Base):
    """Activity audit log"""
    __tablename__ = "activity_log"
    __table_args__ = (
        Index('idx_activity_tenant', 'tenant_id'),
        Index('idx_activity_user', 'user_id'),
        Index('idx_activity_created', 'created_at'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True))
    user_id = Column(UUID(as_uuid=True))

    # Action info
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50))
    entity_id = Column(UUID(as_uuid=True))
    description = Column(Text)

    # Request info
    ip_address = Column(INET)
    user_agent = Column(String(500))

    # Additional data
    extra_data = Column(JSON)

    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<ActivityLog(action={self.action}, user_id={self.user_id})>"
