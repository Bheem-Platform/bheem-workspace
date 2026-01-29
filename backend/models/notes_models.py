"""
Bheem Notes Database Models

This module contains SQLAlchemy models for the Notes feature.
"""

from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from sqlalchemy import (
    Column,
    String,
    Text,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    Index,
    Enum as SQLEnum,
)
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship, Mapped
from sqlalchemy.sql import func

from core.database import Base


# Schema for all notes tables
SCHEMA = "workspace"


class NoteColor:
    """Note color constants matching Google Keep colors."""
    DEFAULT = "default"
    RED = "red"
    ORANGE = "orange"
    YELLOW = "yellow"
    GREEN = "green"
    TEAL = "teal"
    BLUE = "blue"
    PURPLE = "purple"
    PINK = "pink"
    BROWN = "brown"
    GRAY = "gray"


class Note(Base):
    """
    Main Note model.

    Represents a single note with optional checklist, labels, and reminders.
    """
    __tablename__ = "notes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    owner_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    # Content
    title = Column(String(500), nullable=True)
    content = Column(Text, nullable=True)
    content_html = Column(Text, nullable=True)  # Rich text content

    # Display
    color = Column(String(20), default=NoteColor.DEFAULT)
    background_image = Column(String(500), nullable=True)

    # State
    is_pinned = Column(Boolean, default=False, index=True)
    is_archived = Column(Boolean, default=False, index=True)
    is_trashed = Column(Boolean, default=False, index=True)

    # Checklist
    is_checklist = Column(Boolean, default=False)
    checklist_items = Column(JSON, nullable=True)  # [{id, text, is_checked, order}]

    # Metadata
    position = Column(Integer, default=0)  # For drag-and-drop ordering
    word_count = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    trashed_at = Column(DateTime(timezone=True), nullable=True)
    archived_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    labels = relationship("NoteLabel", secondary=f"{SCHEMA}.note_label_associations", back_populates="notes")
    collaborators = relationship("NoteCollaborator", back_populates="note", cascade="all, delete-orphan")
    reminders = relationship("NoteReminder", back_populates="note", cascade="all, delete-orphan")
    attachments = relationship("NoteAttachment", back_populates="note", cascade="all, delete-orphan")
    activity_logs = relationship("NoteActivityLog", back_populates="note", cascade="all, delete-orphan")

    # Indexes
    __table_args__ = (
        Index("ix_notes_tenant_owner", "tenant_id", "owner_id"),
        Index("ix_notes_tenant_pinned", "tenant_id", "is_pinned"),
        Index("ix_notes_tenant_archived", "tenant_id", "is_archived"),
        Index("ix_notes_tenant_trashed", "tenant_id", "is_trashed"),
        Index("ix_notes_updated_at", "updated_at"),
        {"schema": SCHEMA}
    )

    def to_dict(self) -> dict:
        """Convert note to dictionary."""
        from sqlalchemy.orm import object_session
        from sqlalchemy.inspection import inspect

        # Check if labels are already loaded to avoid lazy loading
        state = inspect(self)
        labels_loaded = 'labels' in state.dict
        labels_data = []
        if labels_loaded:
            labels_data = [label.to_dict() for label in self.labels]

        return {
            "id": str(self.id),
            "tenant_id": str(self.tenant_id),
            "owner_id": str(self.owner_id),
            "title": self.title,
            "content": self.content,
            "content_html": self.content_html,
            "color": self.color,
            "background_image": self.background_image,
            "is_pinned": self.is_pinned,
            "is_archived": self.is_archived,
            "is_trashed": self.is_trashed,
            "is_checklist": self.is_checklist,
            "checklist_items": self.checklist_items,
            "position": self.position,
            "word_count": self.word_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "labels": labels_data,
        }


class NoteLabel(Base):
    """
    Note labels for organization.

    Labels are workspace-scoped and can be applied to multiple notes.
    """
    __tablename__ = "note_labels"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    owner_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    name = Column(String(100), nullable=False)
    color = Column(String(20), nullable=True)  # Optional color for label

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    notes = relationship("Note", secondary=f"{SCHEMA}.note_label_associations", back_populates="labels")

    # Unique constraint on name per tenant+owner
    __table_args__ = (
        Index("ix_note_labels_tenant_owner", "tenant_id", "owner_id"),
        Index("ix_note_labels_name", "tenant_id", "owner_id", "name", unique=True),
        {"schema": SCHEMA}
    )

    def to_dict(self) -> dict:
        """Convert label to dictionary."""
        return {
            "id": str(self.id),
            "name": self.name,
            "color": self.color,
        }


class NoteLabelAssociation(Base):
    """
    Association table for Note-Label many-to-many relationship.
    """
    __tablename__ = "note_label_associations"
    __table_args__ = {"schema": SCHEMA}

    note_id = Column(UUID(as_uuid=True), ForeignKey(f"{SCHEMA}.notes.id", ondelete="CASCADE"), primary_key=True)
    label_id = Column(UUID(as_uuid=True), ForeignKey(f"{SCHEMA}.note_labels.id", ondelete="CASCADE"), primary_key=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class NoteCollaborator(Base):
    """
    Note collaborators for sharing notes with other users.
    """
    __tablename__ = "note_collaborators"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    note_id = Column(UUID(as_uuid=True), ForeignKey(f"{SCHEMA}.notes.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    user_email = Column(String(255), nullable=True)
    user_name = Column(String(255), nullable=True)

    # Permission levels: view, edit
    permission = Column(String(20), default="view")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(UUID(as_uuid=True), nullable=False)

    # Relationships
    note = relationship("Note", back_populates="collaborators")

    __table_args__ = (
        Index("ix_note_collaborators_note", "note_id"),
        Index("ix_note_collaborators_user", "user_id"),
        Index("ix_note_collaborators_unique", "note_id", "user_id", unique=True),
        {"schema": SCHEMA}
    )


class NoteReminder(Base):
    """
    Note reminders for time-based notifications.
    """
    __tablename__ = "note_reminders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    note_id = Column(UUID(as_uuid=True), ForeignKey(f"{SCHEMA}.notes.id", ondelete="CASCADE"), nullable=False)

    reminder_time = Column(DateTime(timezone=True), nullable=False)
    is_sent = Column(Boolean, default=False)
    sent_at = Column(DateTime(timezone=True), nullable=True)

    # Recurrence (optional)
    is_recurring = Column(Boolean, default=False)
    recurrence_pattern = Column(String(50), nullable=True)  # daily, weekly, monthly
    recurrence_end = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    note = relationship("Note", back_populates="reminders")

    __table_args__ = (
        Index("ix_note_reminders_note", "note_id"),
        Index("ix_note_reminders_time", "reminder_time"),
        Index("ix_note_reminders_pending", "is_sent", "reminder_time"),
        {"schema": SCHEMA}
    )


class NoteAttachment(Base):
    """
    Note attachments for images and files.
    """
    __tablename__ = "note_attachments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    note_id = Column(UUID(as_uuid=True), ForeignKey(f"{SCHEMA}.notes.id", ondelete="CASCADE"), nullable=False)

    file_name = Column(String(255), nullable=False)
    file_type = Column(String(100), nullable=True)
    file_size = Column(Integer, nullable=True)
    file_path = Column(String(500), nullable=False)
    thumbnail_path = Column(String(500), nullable=True)

    # For images
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(UUID(as_uuid=True), nullable=False)

    # Relationships
    note = relationship("Note", back_populates="attachments")

    __table_args__ = (
        Index("ix_note_attachments_note", "note_id"),
        {"schema": SCHEMA}
    )


class NoteActivityLog(Base):
    """
    Activity log for tracking note changes.
    """
    __tablename__ = "note_activity_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    note_id = Column(UUID(as_uuid=True), ForeignKey(f"{SCHEMA}.notes.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    user_name = Column(String(255), nullable=True)

    action = Column(String(50), nullable=False)  # created, updated, archived, trashed, etc.
    details = Column(JSON, nullable=True)  # Additional details about the action

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    note = relationship("Note", back_populates="activity_logs")

    __table_args__ = (
        Index("ix_note_activity_logs_note", "note_id"),
        Index("ix_note_activity_logs_created", "created_at"),
        {"schema": SCHEMA}
    )
