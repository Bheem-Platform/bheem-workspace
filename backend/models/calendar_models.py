"""
Bheem Workspace - Calendar Models
Database models for calendar reminders
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Text, Index, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from core.database import Base


class CalendarReminder(Base):
    """Calendar event reminders scheduled for notification"""
    __tablename__ = "calendar_reminders"
    __table_args__ = (
        Index('idx_calendar_reminders_user', 'user_id'),
        Index('idx_calendar_reminders_status', 'status'),
        Index('idx_calendar_reminders_trigger', 'trigger_time'),
        Index('idx_calendar_reminders_event', 'event_uid'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)

    # Event reference
    event_uid = Column(String(255), nullable=False)
    calendar_id = Column(String(255), nullable=False, default='personal')
    event_title = Column(String(500), nullable=False)
    event_start = Column(DateTime(timezone=True), nullable=False)
    event_location = Column(String(500))

    # Reminder settings
    reminder_type = Column(String(50), nullable=False)  # email, browser, sms, whatsapp
    minutes_before = Column(Integer, nullable=False)  # Minutes before event
    trigger_time = Column(DateTime(timezone=True), nullable=False)  # When to send

    # Status tracking
    status = Column(String(50), default='pending')  # pending, sent, cancelled, failed
    sent_at = Column(DateTime(timezone=True))
    error_message = Column(Text)

    # User contact info for notifications
    user_email = Column(String(255))
    user_phone = Column(String(50))

    # Metadata
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<CalendarReminder {self.id}: {self.event_title} - {self.reminder_type}>"


class UserCalendarSettings(Base):
    """User calendar preferences and default reminder settings"""
    __tablename__ = "user_calendar_settings"
    __table_args__ = (
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, unique=True)

    # Default reminders for new events
    default_reminders = Column(JSONB, default=list)  # [{"type": "browser", "minutes": 10}]

    # Notification preferences
    email_notifications = Column(Boolean, default=True)
    browser_notifications = Column(Boolean, default=True)
    sms_notifications = Column(Boolean, default=False)

    # Timezone
    timezone = Column(String(100), default='UTC')

    # Working hours
    working_hours_start = Column(String(5), default='09:00')
    working_hours_end = Column(String(5), default='17:00')
    working_days = Column(JSONB, default=['MO', 'TU', 'WE', 'TH', 'FR'])

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
