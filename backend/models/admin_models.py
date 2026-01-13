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
        Index('idx_tenants_mode', 'tenant_mode'),
        Index('idx_tenants_erp_company', 'erp_company_code'),
        Index('idx_tenants_subscription', 'erp_subscription_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), nullable=False, unique=True)
    domain = Column(String(255))
    owner_email = Column(String(320), nullable=False)

    # ERP Integration - Mode & Company Linkage
    tenant_mode = Column(String(20), default='external')  # 'internal' = Bheemverse subsidiary, 'external' = commercial customer
    erp_company_code = Column(String(20))  # BHM001-BHM008 for internal mode
    erp_company_id = Column(UUID(as_uuid=True))  # Reference to ERP public.companies.id
    erp_customer_id = Column(UUID(as_uuid=True))  # Reference to ERP crm.contacts.id (for external customers)

    # ERP Integration - Subscription
    erp_subscription_id = Column(UUID(as_uuid=True))  # Reference to ERP public.subscriptions.id
    subscription_status = Column(String(20))  # active, cancelled, suspended, pending
    subscription_plan = Column(String(100))  # Plan name from ERP SKU
    subscription_period_end = Column(DateTime)  # Current billing period end

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

    # Mattermost Integration
    mattermost_team_id = Column(String(255))  # Mattermost team ID for workspace chat

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
        Index('idx_tenant_users_erp_employee', 'erp_employee_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenants.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False)

    # User info (for display)
    email = Column(String(320))  # Workspace email (login email): username@tenant-domain.com
    personal_email = Column(String(320))  # Personal email for notifications (e.g., user's gmail)
    name = Column(String(255))

    # Role within tenant
    role = Column(String(50), nullable=False, default='member')  # admin, manager, member

    # ERP Integration - Employee Linkage (for internal mode)
    erp_employee_id = Column(UUID(as_uuid=True))  # Reference to ERP hr.employees.id
    erp_user_id = Column(UUID(as_uuid=True))  # Reference to ERP auth.users.id
    department = Column(String(100))  # Synced from ERP HR
    job_title = Column(String(100))  # Synced from ERP HR
    provisioned_by = Column(String(20), default='self')  # 'self' = self-registered, 'erp_hr' = synced from HR, 'admin' = manually added

    # Status
    is_active = Column(Boolean, default=True)
    invited_at = Column(DateTime)
    joined_at = Column(DateTime)
    invited_by = Column(UUID(as_uuid=True))

    # Mail SSO - Encrypted mail credentials for automatic mail session
    encrypted_mail_password = Column(Text)  # Fernet-encrypted password for mail SSO

    # Mattermost Integration
    mattermost_user_id = Column(String(255))  # Mattermost user ID for team chat

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


class OnboardingProgress(Base):
    """Tracks onboarding progress for a tenant/workspace."""
    __tablename__ = "onboarding_progress"
    __table_args__ = (
        Index('idx_onboarding_tenant', 'tenant_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenants.id", ondelete="CASCADE"), unique=True)

    # Onboarding steps
    profile_completed = Column(Boolean, default=False)
    domain_setup_completed = Column(Boolean, default=False)
    team_invited = Column(Boolean, default=False)
    first_meeting_created = Column(Boolean, default=False)
    first_document_uploaded = Column(Boolean, default=False)
    chat_setup_completed = Column(Boolean, default=False)

    # Current state
    current_step = Column(String(50), default="welcome")
    skipped_steps = Column(JSON, default=[])

    # Timestamps
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<OnboardingProgress(tenant_id={self.tenant_id}, step={self.current_step})>"


class Resource(Base):
    """Resources for booking (meeting rooms, equipment, etc.)"""
    __tablename__ = "resources"
    __table_args__ = (
        Index('idx_resources_tenant', 'tenant_id'),
        Index('idx_resources_type', 'resource_type'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenants.id", ondelete="CASCADE"), nullable=False)

    name = Column(String(255), nullable=False)
    resource_type = Column(String(50), nullable=False)  # room, equipment, vehicle
    capacity = Column(Integer)  # For rooms
    location = Column(String(255))
    description = Column(Text)

    # Availability settings
    available_from = Column(String(10))  # "09:00"
    available_until = Column(String(10))  # "18:00"
    available_days = Column(JSON, default=[1, 2, 3, 4, 5])  # Mon-Fri

    # Settings
    requires_approval = Column(Boolean, default=False)
    auto_release_minutes = Column(Integer, default=15)
    min_booking_minutes = Column(Integer, default=30)
    max_booking_minutes = Column(Integer, default=480)

    # Status
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(UUID(as_uuid=True))

    # Relationships
    bookings = relationship("ResourceBooking", back_populates="resource", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Resource(id={self.id}, name={self.name}, type={self.resource_type})>"


class ResourceBooking(Base):
    """Bookings for resources"""
    __tablename__ = "resource_bookings"
    __table_args__ = (
        Index('idx_bookings_resource', 'resource_id'),
        Index('idx_bookings_time', 'start_time', 'end_time'),
        Index('idx_bookings_user', 'booked_by'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    resource_id = Column(UUID(as_uuid=True), ForeignKey("workspace.resources.id", ondelete="CASCADE"), nullable=False)

    booked_by = Column(UUID(as_uuid=True), nullable=False)
    booked_by_name = Column(String(255))
    title = Column(String(255))
    description = Column(Text)

    # Time
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)

    # Links
    calendar_event_id = Column(String(255))
    meeting_room_code = Column(String(50))  # If booked with a meeting

    # Status
    status = Column(String(20), default="confirmed")  # confirmed, pending, cancelled, no_show

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    cancelled_at = Column(DateTime)

    # Relationships
    resource = relationship("Resource", back_populates="bookings")

    def __repr__(self):
        return f"<ResourceBooking(resource={self.resource_id}, start={self.start_time})>"


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
