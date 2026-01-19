"""
Bheem Workspace - Drive/File Management Models
Models for Bheem Drive - cloud file storage and sharing with Nextcloud integration
"""
from sqlalchemy import Column, String, Boolean, Integer, BigInteger, Text, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from core.database import Base


class DriveFile(Base):
    """Files and folders in Bheem Drive"""
    __tablename__ = "drive_files"
    __table_args__ = (
        Index('idx_drive_files_tenant', 'tenant_id'),
        Index('idx_drive_files_parent', 'parent_id'),
        Index('idx_drive_files_owner', 'created_by'),
        Index('idx_drive_files_type', 'file_type'),
        Index('idx_drive_files_trashed', 'is_trashed'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenants.id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("workspace.drive_files.id", ondelete="CASCADE"))

    # File info
    name = Column(String(500), nullable=False)
    file_type = Column(String(50), nullable=False)  # folder, file
    mime_type = Column(String(255))
    size_bytes = Column(BigInteger, default=0)
    path = Column(Text, default='/')  # Full path for navigation
    storage_path = Column(Text)  # Path in Nextcloud
    thumbnail_path = Column(Text)

    # Nextcloud integration
    nextcloud_file_id = Column(String(255))  # Nextcloud file ID
    nextcloud_share_url = Column(Text)  # Public share URL from Nextcloud

    # Metadata
    description = Column(Text)
    tags = Column(ARRAY(Text), default=[])
    file_metadata = Column('metadata', JSONB, default={})  # Maps to 'metadata' column in DB

    # Status
    is_starred = Column(Boolean, default=False)
    is_trashed = Column(Boolean, default=False)
    is_spam = Column(Boolean, default=False)
    trashed_at = Column(DateTime)

    # Versioning
    version = Column(Integer, default=1)
    version_history = Column(JSONB, default=[])

    # Ownership - using created_by to match existing DB schema
    created_by = Column(UUID(as_uuid=True), ForeignKey("workspace.tenant_users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    parent = relationship("DriveFile", remote_side=[id], backref="children")
    shares = relationship("DriveShare", back_populates="file", cascade="all, delete-orphan")

    # Alias for compatibility
    @property
    def owner_id(self):
        return self.created_by

    def __repr__(self):
        return f"<DriveFile(id={self.id}, name={self.name}, type={self.file_type})>"


class DriveShare(Base):
    """File/folder shares and public links"""
    __tablename__ = "drive_shares"
    __table_args__ = (
        Index('idx_drive_shares_file', 'file_id'),
        Index('idx_drive_shares_email', 'email'),
        Index('idx_drive_shares_token', 'link_token'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    file_id = Column(UUID(as_uuid=True), ForeignKey("workspace.drive_files.id", ondelete="CASCADE"), nullable=False)

    # Using email/user_id to match existing DB
    email = Column(String(255))  # Email of person shared with
    user_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenant_users.id", ondelete="SET NULL"))

    # Permission
    permission = Column(String(20), default='view')  # view, comment, edit

    # Public link - using link_token to match existing DB
    is_public = Column(Boolean, default=False)
    link_token = Column(String(100))  # For public links
    link_password = Column(String(255))  # Hashed password
    expires_at = Column(DateTime)

    # Nextcloud integration
    nextcloud_share_id = Column(String(255))

    # Tracking - using created_by to match existing DB
    created_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    file = relationship("DriveFile", back_populates="shares")

    # Aliases for compatibility
    @property
    def shared_with_email(self):
        return self.email

    @property
    def share_token(self):
        return self.link_token

    @property
    def shared_by(self):
        return self.created_by

    def __repr__(self):
        return f"<DriveShare(file_id={self.file_id}, permission={self.permission})>"


class DriveActivity(Base):
    """Activity log for drive files"""
    __tablename__ = "drive_activity"
    __table_args__ = (
        Index('idx_drive_activity_file', 'file_id'),
        Index('idx_drive_activity_user', 'user_id'),
        Index('idx_drive_activity_created', 'created_at'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    file_id = Column(UUID(as_uuid=True), ForeignKey("workspace.drive_files.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True))

    # Activity info
    action = Column(String(50), nullable=False)  # created, renamed, moved, shared, downloaded, deleted, restored
    details = Column(JSONB, default={})

    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<DriveActivity(file_id={self.file_id}, action={self.action})>"
