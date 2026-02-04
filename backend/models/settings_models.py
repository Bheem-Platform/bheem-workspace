"""
Bheem Workspace - User Settings Database Models
"""
from sqlalchemy import Column, String, Boolean, Integer, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from core.database import Base


class UserSettings(Base):
    """Per-user settings and preferences"""
    __tablename__ = "user_settings"
    __table_args__ = (
        Index('idx_user_settings_user', 'user_id'),
        Index('idx_user_settings_tenant', 'tenant_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenants.id", ondelete="CASCADE"))

    # Appearance Settings
    theme = Column(String(20), default='light')  # light, dark, system
    accent_color = Column(String(20), default='#977DFF')
    show_app_names = Column(Boolean, default=True)
    compact_mode = Column(Boolean, default=False)
    sidebar_position = Column(String(10), default='left')  # left, right

    # Apps Settings
    enabled_apps = Column(JSONB, default={
        "mail": True,
        "docs": True,
        "sheets": True,
        "slides": True,
        "calendar": True,
        "meet": True,
        "drive": True,
        "chat": True,
        "forms": True
    })

    # Notification Settings
    email_notifications = Column(Boolean, default=True)
    push_notifications = Column(Boolean, default=True)
    desktop_notifications = Column(Boolean, default=True)
    sound_enabled = Column(Boolean, default=True)
    email_digest = Column(String(20), default='daily')  # none, daily, weekly
    notify_on_mention = Column(Boolean, default=True)
    notify_on_comment = Column(Boolean, default=True)
    notify_on_share = Column(Boolean, default=True)

    # Security Settings
    two_factor_enabled = Column(Boolean, default=False)
    session_timeout = Column(Integer, default=30)  # minutes, 0 = never

    # Chat Privacy Settings
    read_receipts_enabled = Column(Boolean, default=True)  # Show when user reads messages
    show_last_seen = Column(Boolean, default=True)  # Show last seen status to others

    # Language & Region
    language = Column(String(10), default='en')
    timezone = Column(String(50), default='UTC')
    date_format = Column(String(20), default='MM/DD/YYYY')
    time_format = Column(String(5), default='12h')  # 12h, 24h
    week_start = Column(String(10), default='sunday')  # sunday, monday

    # Profile
    avatar_url = Column(String(500), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<UserSettings(user_id={self.user_id}, theme={self.theme})>"

    def to_dict(self):
        """Convert settings to dictionary format for API response"""
        return {
            "general": {
                "workspaceName": "",  # Will be filled from tenant
                "description": "",
                "industry": "",
                "size": ""
            },
            "appearance": {
                "theme": self.theme,
                "accentColor": self.accent_color,
                "logo": None,
                "showAppNames": self.show_app_names,
                "compactMode": self.compact_mode,
                "sidebarPosition": self.sidebar_position
            },
            "apps": self.enabled_apps or {},
            "notifications": {
                "emailNotifications": self.email_notifications,
                "pushNotifications": self.push_notifications,
                "desktopNotifications": self.desktop_notifications,
                "soundEnabled": self.sound_enabled,
                "emailDigest": self.email_digest,
                "notifyOnMention": self.notify_on_mention,
                "notifyOnComment": self.notify_on_comment,
                "notifyOnShare": self.notify_on_share
            },
            "security": {
                "twoFactorEnabled": self.two_factor_enabled,
                "sessionTimeout": self.session_timeout,
                "passwordLastChanged": self.updated_at.isoformat() if self.updated_at else None
            },
            "chat": {
                "readReceiptsEnabled": self.read_receipts_enabled if self.read_receipts_enabled is not None else True,
                "showLastSeen": self.show_last_seen if self.show_last_seen is not None else True
            },
            "language": {
                "language": self.language,
                "timezone": self.timezone,
                "dateFormat": self.date_format,
                "timeFormat": self.time_format,
                "weekStart": self.week_start
            }
        }
