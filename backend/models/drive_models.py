"""
Bheem Workspace - Drive/File Management Models
Models for Bheem Drive - cloud file storage and sharing
"""
from sqlalchemy import Column, String, Boolean, Integer, BigInteger, Text, DateTime, ForeignKey, Index, UniqueConstraint
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
        Index('idx_drive_files_owner', 'owner_id'),
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
    storage_path = Column(Text)  # Path in storage backend
    thumbnail_path = Column(Text)

    # Metadata
    description = Column(Text)
    tags = Column(ARRAY(Text), default=[])
    file_metadata = Column(JSONB, default={})

    # Status
    is_starred = Column(Boolean, default=False)
    is_trashed = Column(Boolean, default=False)
    trashed_at = Column(DateTime)

    # Versioning
    version = Column(Integer, default=1)
    version_history = Column(JSONB, default=[])

    # Ownership
    owner_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenant_users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    parent = relationship("DriveFile", remote_side=[id], backref="children")
    shares = relationship("DriveShare", back_populates="file", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<DriveFile(id={self.id}, name={self.name}, type={self.file_type})>"


class DriveShare(Base):
    """File/folder shares and public links"""
    __tablename__ = "drive_shares"
    __table_args__ = (
        Index('idx_drive_shares_file', 'file_id'),
        Index('idx_drive_shares_email', 'shared_with_email'),
        Index('idx_drive_shares_token', 'share_token'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    file_id = Column(UUID(as_uuid=True), ForeignKey("workspace.drive_files.id", ondelete="CASCADE"), nullable=False)
    shared_with_email = Column(String(255))  # Email of person shared with

    # Permission
    permission = Column(String(20), default='view')  # view, comment, edit

    # Public link
    is_public = Column(Boolean, default=False)
    share_token = Column(String(100))  # For public links
    link_password = Column(String(255))  # Hashed password
    expires_at = Column(DateTime)

    # Tracking
    shared_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    file = relationship("DriveFile", back_populates="shares")

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
