"""
Bheem OForms - OnlyOffice Document Forms Models

SQLAlchemy models for OnlyOffice-based fillable document forms.
"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID
import uuid

from sqlalchemy import (
    Column, String, Boolean, DateTime, Text, Integer, BigInteger,
    ForeignKey, CheckConstraint, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID, INET
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class OForm(Base):
    """
    OnlyOffice Document Form model.

    Represents a fillable document form created with OnlyOffice.
    Supports DOCXF (form template) and OFORM (fillable form) formats.
    """
    __tablename__ = 'oforms'
    __table_args__ = {'schema': 'workspace'}

    # Primary key
    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(PGUUID(as_uuid=True), nullable=False, index=True)

    # Form metadata
    title = Column(String(500), nullable=False, default='Untitled Form')
    description = Column(Text, nullable=True)
    form_type = Column(String(20), default='docxf')  # docxf, oform
    status = Column(String(20), default='draft')  # draft, published, closed

    # Storage info (S3/MinIO)
    storage_path = Column(Text, nullable=True)
    storage_bucket = Column(String(255), nullable=True)
    file_size = Column(BigInteger, default=0)
    checksum = Column(String(64), nullable=True)

    # OnlyOffice document key
    document_key = Column(String(255), nullable=True)

    # Version control
    version = Column(Integer, default=1)

    # Organization
    folder_id = Column(PGUUID(as_uuid=True), nullable=True)

    # Metadata
    is_starred = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False, index=True)
    response_count = Column(Integer, default=0)

    # Audit fields
    created_by = Column(PGUUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    last_edited_by = Column(PGUUID(as_uuid=True), nullable=True)
    last_edited_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    versions = relationship("OFormVersion", back_populates="form", cascade="all, delete-orphan")
    responses = relationship("OFormResponse", back_populates="form", cascade="all, delete-orphan")
    shares = relationship("OFormShare", back_populates="form", cascade="all, delete-orphan")
    edit_sessions = relationship("OFormEditSession", back_populates="form", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<OForm(id={self.id}, title='{self.title}', type={self.form_type})>"

    def to_dict(self):
        return {
            'id': str(self.id),
            'tenant_id': str(self.tenant_id),
            'title': self.title,
            'description': self.description,
            'form_type': self.form_type,
            'status': self.status,
            'storage_path': self.storage_path,
            'storage_bucket': self.storage_bucket,
            'file_size': self.file_size,
            'document_key': self.document_key,
            'version': self.version,
            'folder_id': str(self.folder_id) if self.folder_id else None,
            'is_starred': self.is_starred,
            'is_deleted': self.is_deleted,
            'response_count': self.response_count,
            'created_by': str(self.created_by) if self.created_by else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'last_edited_by': str(self.last_edited_by) if self.last_edited_by else None,
            'last_edited_at': self.last_edited_at.isoformat() if self.last_edited_at else None,
        }


class OFormVersion(Base):
    """
    Version history for OForms.

    Tracks each saved version of a form for version control and rollback.
    """
    __tablename__ = 'oform_versions'
    __table_args__ = (
        UniqueConstraint('form_id', 'version', name='oform_versions_unique'),
        {'schema': 'workspace'}
    )

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    form_id = Column(PGUUID(as_uuid=True), ForeignKey('workspace.oforms.id', ondelete='CASCADE'), nullable=False, index=True)
    version = Column(Integer, nullable=False)
    storage_path = Column(Text, nullable=True)
    file_size = Column(BigInteger, nullable=True)
    checksum = Column(String(64), nullable=True)
    comment = Column(Text, nullable=True)
    created_by = Column(PGUUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationship
    form = relationship("OForm", back_populates="versions")

    def __repr__(self):
        return f"<OFormVersion(form_id={self.form_id}, version={self.version})>"

    def to_dict(self):
        return {
            'id': str(self.id),
            'form_id': str(self.form_id),
            'version': self.version,
            'storage_path': self.storage_path,
            'file_size': self.file_size,
            'comment': self.comment,
            'created_by': str(self.created_by) if self.created_by else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class OFormResponse(Base):
    """
    Form response/submission.

    Stores filled form submissions from users.
    """
    __tablename__ = 'oform_responses'
    __table_args__ = {'schema': 'workspace'}

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    form_id = Column(PGUUID(as_uuid=True), ForeignKey('workspace.oforms.id', ondelete='CASCADE'), nullable=False, index=True)
    tenant_id = Column(PGUUID(as_uuid=True), nullable=False, index=True)

    # Response storage
    storage_path = Column(Text, nullable=True)
    storage_bucket = Column(String(255), nullable=True)
    file_size = Column(BigInteger, default=0)

    # Respondent info (optional)
    respondent_email = Column(String(255), nullable=True)
    respondent_name = Column(String(255), nullable=True)
    respondent_user_id = Column(PGUUID(as_uuid=True), nullable=True)

    # Metadata
    submitted_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    ip_address = Column(INET, nullable=True)
    user_agent = Column(Text, nullable=True)

    # Status
    status = Column(String(20), default='submitted')  # submitted, reviewed, archived
    reviewed_by = Column(PGUUID(as_uuid=True), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationship
    form = relationship("OForm", back_populates="responses")

    def __repr__(self):
        return f"<OFormResponse(id={self.id}, form_id={self.form_id})>"

    def to_dict(self):
        return {
            'id': str(self.id),
            'form_id': str(self.form_id),
            'tenant_id': str(self.tenant_id),
            'storage_path': self.storage_path,
            'file_size': self.file_size,
            'respondent_email': self.respondent_email,
            'respondent_name': self.respondent_name,
            'respondent_user_id': str(self.respondent_user_id) if self.respondent_user_id else None,
            'submitted_at': self.submitted_at.isoformat() if self.submitted_at else None,
            'status': self.status,
            'reviewed_by': str(self.reviewed_by) if self.reviewed_by else None,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
        }


class OFormShare(Base):
    """
    Form sharing settings.

    Allows sharing forms with internal users or external emails.
    """
    __tablename__ = 'oform_shares'
    __table_args__ = (
        CheckConstraint(
            '(user_id IS NOT NULL AND external_email IS NULL) OR (user_id IS NULL AND external_email IS NOT NULL)',
            name='oform_shares_target'
        ),
        {'schema': 'workspace'}
    )

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    form_id = Column(PGUUID(as_uuid=True), ForeignKey('workspace.oforms.id', ondelete='CASCADE'), nullable=False, index=True)

    # Share target (internal user or external email)
    user_id = Column(PGUUID(as_uuid=True), nullable=True, index=True)
    external_email = Column(String(255), nullable=True, index=True)

    # Permissions
    permission = Column(String(20), default='fill')  # fill, view, edit

    # Share settings
    is_active = Column(Boolean, default=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    access_count = Column(Integer, default=0)
    last_accessed_at = Column(DateTime(timezone=True), nullable=True)

    # Audit
    created_by = Column(PGUUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationship
    form = relationship("OForm", back_populates="shares")

    def __repr__(self):
        target = self.user_id or self.external_email
        return f"<OFormShare(form_id={self.form_id}, target={target})>"

    def to_dict(self):
        return {
            'id': str(self.id),
            'form_id': str(self.form_id),
            'user_id': str(self.user_id) if self.user_id else None,
            'external_email': self.external_email,
            'permission': self.permission,
            'is_active': self.is_active,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'access_count': self.access_count,
            'last_accessed_at': self.last_accessed_at.isoformat() if self.last_accessed_at else None,
            'created_by': str(self.created_by) if self.created_by else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class OFormEditSession(Base):
    """
    Active editing session for real-time collaboration tracking.
    """
    __tablename__ = 'oform_edit_sessions'
    __table_args__ = {'schema': 'workspace'}

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    form_id = Column(PGUUID(as_uuid=True), ForeignKey('workspace.oforms.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = Column(PGUUID(as_uuid=True), nullable=False, index=True)
    document_key = Column(String(255), nullable=True)
    started_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    last_activity_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True, index=True)

    # Relationship
    form = relationship("OForm", back_populates="edit_sessions")

    def __repr__(self):
        return f"<OFormEditSession(form_id={self.form_id}, user_id={self.user_id})>"

    def to_dict(self):
        return {
            'id': str(self.id),
            'form_id': str(self.form_id),
            'user_id': str(self.user_id),
            'document_key': self.document_key,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'last_activity_at': self.last_activity_at.isoformat() if self.last_activity_at else None,
            'ended_at': self.ended_at.isoformat() if self.ended_at else None,
            'is_active': self.is_active,
        }
