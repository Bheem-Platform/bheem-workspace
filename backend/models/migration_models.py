"""
Bheem Workspace - Migration Module Database Models
One-click migration from Google Workspace / Microsoft 365
"""
from sqlalchemy import Column, String, Boolean, Integer, Text, DateTime, ForeignKey, BigInteger, Index, ARRAY
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from core.database import Base


class MigrationConnection(Base):
    """
    Store OAuth connections for migration.
    Links external accounts (Google, Microsoft, IMAP) to workspace users.
    """
    __tablename__ = "migration_connections"
    __table_args__ = (
        Index('idx_migration_connections_tenant', 'tenant_id'),
        Index('idx_migration_connections_user', 'user_id'),
        Index('idx_migration_connections_provider', 'provider'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey('workspace.tenants.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False)

    # Provider info
    provider = Column(String(50), nullable=False)  # 'google', 'microsoft', 'imap'
    provider_email = Column(String(255))  # user@gmail.com
    provider_name = Column(String(255))  # "John Doe"

    # OAuth tokens (encrypted with Fernet)
    access_token = Column(Text)  # Encrypted
    refresh_token = Column(Text)  # Encrypted
    token_expiry = Column(DateTime(timezone=True))
    scopes = Column(ARRAY(Text))

    # IMAP credentials (for non-OAuth)
    imap_host = Column(String(255))
    imap_port = Column(Integer)
    imap_username = Column(String(255))
    imap_password = Column(Text)  # Encrypted
    imap_use_ssl = Column(Boolean, default=True)

    # Status
    is_active = Column(Boolean, default=True)
    last_used_at = Column(DateTime(timezone=True))

    # Timestamps
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    jobs = relationship("MigrationJob", back_populates="connection")

    def __repr__(self):
        return f"<MigrationConnection(id={self.id}, provider={self.provider}, email={self.provider_email})>"


class MigrationJob(Base):
    """
    Track migration jobs and their progress.
    Each job can migrate email, contacts, and/or drive files.
    """
    __tablename__ = "migration_jobs"
    __table_args__ = (
        Index('idx_migration_jobs_tenant', 'tenant_id'),
        Index('idx_migration_jobs_user', 'user_id'),
        Index('idx_migration_jobs_connection', 'connection_id'),
        Index('idx_migration_jobs_status', 'status'),
        Index('idx_migration_jobs_created', 'created_at'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey('workspace.tenants.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    connection_id = Column(UUID(as_uuid=True), ForeignKey('workspace.migration_connections.id', ondelete='SET NULL'))

    # Job configuration
    job_type = Column(String(50), nullable=False)  # 'full', 'email', 'contacts', 'drive'
    config = Column(JSONB, default={})  # Selected folders, date range, etc.

    # Status: pending, running, completed, failed, cancelled
    status = Column(String(50), default='pending')

    # Progress tracking
    progress_percent = Column(Integer, default=0)
    current_task = Column(String(255))

    # Item counts
    items_total = Column(Integer, default=0)
    items_processed = Column(Integer, default=0)
    items_failed = Column(Integer, default=0)

    # Sub-task progress: Email
    email_status = Column(String(50), default='pending')
    email_progress = Column(Integer, default=0)
    email_total = Column(Integer, default=0)
    email_processed = Column(Integer, default=0)

    # Sub-task progress: Contacts
    contacts_status = Column(String(50), default='pending')
    contacts_progress = Column(Integer, default=0)
    contacts_total = Column(Integer, default=0)
    contacts_processed = Column(Integer, default=0)

    # Sub-task progress: Drive
    drive_status = Column(String(50), default='pending')
    drive_progress = Column(Integer, default=0)
    drive_total = Column(Integer, default=0)
    drive_processed = Column(Integer, default=0)
    bytes_transferred = Column(BigInteger, default=0)

    # Error tracking
    errors = Column(JSONB, default=[])

    # Timestamps
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    connection = relationship("MigrationConnection", back_populates="jobs")

    def __repr__(self):
        return f"<MigrationJob(id={self.id}, status={self.status}, progress={self.progress_percent}%)>"


class Contact(Base):
    """
    Store imported contacts from migration.
    Contacts are stored per user and can be synced to other services.
    """
    __tablename__ = "contacts"
    __table_args__ = (
        Index('idx_contacts_tenant_user', 'tenant_id', 'user_id'),
        Index('idx_contacts_email', 'email'),
        Index('idx_contacts_source', 'source'),
        Index('idx_contacts_name', 'first_name', 'last_name'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey('workspace.tenants.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False)

    # Contact info
    email = Column(String(255))
    first_name = Column(String(255))
    last_name = Column(String(255))
    display_name = Column(String(255))
    phone = Column(String(50))
    mobile = Column(String(50))
    company = Column(String(255))
    job_title = Column(String(255))

    # Additional data
    photo_url = Column(Text)
    notes = Column(Text)
    contact_metadata = Column('metadata', JSONB, default={})  # 'metadata' is reserved by SQLAlchemy

    # Source tracking
    source = Column(String(50))  # 'google', 'microsoft', 'csv', 'manual'
    source_id = Column(String(255))  # External ID for deduplication

    # Timestamps
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Contact(id={self.id}, email={self.email}, name={self.display_name})>"
