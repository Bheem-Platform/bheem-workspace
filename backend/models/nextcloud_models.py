"""
Nextcloud Integration Models

Models for storing Nextcloud credentials and related data.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID
import uuid

from sqlalchemy import Column, String, Boolean, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class NextcloudCredentials(Base):
    """
    Stores Nextcloud credentials for per-user document storage.

    Each user gets their own Nextcloud account with app password
    so their documents are stored in their own folder.
    """
    __tablename__ = 'nextcloud_credentials'
    __table_args__ = {'schema': 'workspace'}

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(PGUUID(as_uuid=True), nullable=False, unique=True)
    nextcloud_username = Column(String(255), nullable=False)
    app_password = Column(Text, nullable=False)
    app_password_id = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)

    def __repr__(self):
        return f"<NextcloudCredentials(user_id={self.user_id}, username={self.nextcloud_username})>"

    def to_dict(self):
        return {
            'id': str(self.id),
            'user_id': str(self.user_id),
            'nextcloud_username': self.nextcloud_username,
            'app_password_id': self.app_password_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'last_used_at': self.last_used_at.isoformat() if self.last_used_at else None,
            'is_active': self.is_active
        }
