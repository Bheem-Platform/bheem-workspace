"""
Bheem Workspace - Calendar Models
Database models for calendar reminders, appointments, and scheduling
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Text, Index, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
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
    secondary_timezone = Column(String(100))  # Dual timezone view
    show_secondary_timezone = Column(Boolean, default=False)

    # World clock - favorite timezones to display
    world_clock_timezones = Column(JSONB, default=[])  # ["America/New_York", "Europe/London"]

    # Working hours
    working_hours_start = Column(String(5), default='09:00')
    working_hours_end = Column(String(5), default='17:00')
    working_days = Column(JSONB, default=['MO', 'TU', 'WE', 'TH', 'FR'])

    # Focus time preferences
    focus_time_enabled = Column(Boolean, default=False)
    focus_time_duration = Column(Integer, default=120)  # minutes
    focus_time_days = Column(JSONB, default=['MO', 'TU', 'WE', 'TH', 'FR'])
    focus_time_start = Column(String(5), default='09:00')
    focus_time_end = Column(String(5), default='11:00')
    focus_time_auto_decline = Column(Boolean, default=False)

    # Time insights preferences
    show_time_insights = Column(Boolean, default=True)
    insights_goal_meeting_hours = Column(Integer, default=20)  # per week
    insights_goal_focus_hours = Column(Integer, default=10)  # per week

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


# =============================================
# Focus Time Blocks
# =============================================

class FocusTimeBlock(Base):
    """Scheduled focus time blocks for uninterrupted work"""
    __tablename__ = "focus_time_blocks"
    __table_args__ = (
        Index('idx_focus_time_user', 'user_id'),
        Index('idx_focus_time_start', 'start_time'),
        Index('idx_focus_time_status', 'status'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)

    # Time block details
    title = Column(String(255), default='Focus Time')
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)

    # Status: scheduled, active, completed, cancelled
    status = Column(String(20), default='scheduled')

    # Settings
    auto_decline_meetings = Column(Boolean, default=False)
    show_as_busy = Column(Boolean, default=True)
    calendar_event_id = Column(String(255))  # Linked calendar event

    # Recurrence (optional)
    is_recurring = Column(Boolean, default=False)
    recurrence_rule = Column(String(500))  # iCal RRULE format

    # Analytics
    was_interrupted = Column(Boolean, default=False)
    actual_focus_minutes = Column(Integer)

    # Timestamps
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    completed_at = Column(DateTime(timezone=True))


# =============================================
# Time Insights / Analytics
# =============================================

class CalendarTimeInsight(Base):
    """Weekly time insights and analytics"""
    __tablename__ = "calendar_time_insights"
    __table_args__ = (
        Index('idx_time_insights_user', 'user_id'),
        Index('idx_time_insights_week', 'week_start'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)

    # Week period
    week_start = Column(DateTime(timezone=True), nullable=False)  # Monday of the week
    week_end = Column(DateTime(timezone=True), nullable=False)  # Sunday of the week

    # Meeting metrics
    total_meeting_hours = Column(Integer, default=0)  # minutes
    meeting_count = Column(Integer, default=0)
    avg_meeting_duration = Column(Integer, default=0)  # minutes
    longest_meeting = Column(Integer, default=0)  # minutes

    # Meeting breakdown by type
    one_on_one_hours = Column(Integer, default=0)  # minutes
    team_meeting_hours = Column(Integer, default=0)  # minutes
    external_meeting_hours = Column(Integer, default=0)  # minutes
    recurring_meeting_hours = Column(Integer, default=0)  # minutes

    # Focus time metrics
    total_focus_hours = Column(Integer, default=0)  # minutes
    focus_blocks_count = Column(Integer, default=0)
    focus_blocks_completed = Column(Integer, default=0)
    focus_time_interrupted = Column(Integer, default=0)  # count

    # Availability metrics
    fragmented_time_hours = Column(Integer, default=0)  # minutes - time between meetings
    largest_free_block = Column(Integer, default=0)  # minutes
    meetings_outside_hours = Column(Integer, default=0)  # count

    # Day distribution
    busiest_day = Column(String(10))  # MO, TU, etc.
    meeting_hours_by_day = Column(JSONB, default={})  # {"MO": 120, "TU": 90, ...}

    # Trends
    meeting_hours_change = Column(Integer, default=0)  # vs last week (minutes)
    focus_hours_change = Column(Integer, default=0)  # vs last week (minutes)

    # Timestamps
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


# =============================================
# Appointment Scheduling (Calendly-like)
# =============================================

class AppointmentType(Base):
    """Types of appointments users can offer for booking"""
    __tablename__ = "appointment_types"
    __table_args__ = (
        Index('idx_appointment_types_user', 'user_id'),
        Index('idx_appointment_types_slug', 'slug'),
        UniqueConstraint('user_id', 'slug', name='uq_appointment_type_slug'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenants.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenant_users.id", ondelete="CASCADE"), nullable=False)

    # Basic info
    name = Column(String(255), nullable=False)
    slug = Column(String(100), nullable=False)
    description = Column(Text)

    # Duration and timing
    duration_minutes = Column(Integer, default=30)
    color = Column(String(20))
    buffer_before_minutes = Column(Integer, default=0)
    buffer_after_minutes = Column(Integer, default=0)

    # Location
    location_type = Column(String(50), default='meet')
    custom_location = Column(Text)

    # Availability
    availability = Column(JSONB, default={})

    # Booking questions
    questions = Column(JSONB, default=[])

    # Settings
    min_notice_hours = Column(Integer, default=24)
    max_days_ahead = Column(Integer, default=60)
    confirmation_email_template = Column(Text)
    reminder_email_template = Column(Text)

    # Status
    is_active = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    appointments = relationship("ScheduledAppointment", back_populates="appointment_type", cascade="all, delete-orphan")


class ScheduledAppointment(Base):
    """Booked appointments"""
    __tablename__ = "scheduled_appointments"
    __table_args__ = (
        
        Index('idx_appointments_type', 'appointment_type_id'),
        Index('idx_appointments_host', 'host_id'),
        Index('idx_appointments_time', 'start_time'),
        Index('idx_appointments_status', 'status'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    appointment_type_id = Column(UUID(as_uuid=True), ForeignKey("workspace.appointment_types.id", ondelete="CASCADE"), nullable=False)
    host_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenant_users.id"), nullable=False)

    # Guest info
    guest_email = Column(String(255), nullable=False)
    guest_name = Column(String(255))
    guest_timezone = Column(String(50))

    # Timing
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)

    # Status
    status = Column(String(20), default='confirmed')

    # Related items
    calendar_event_id = Column(UUID(as_uuid=True))
    meeting_room_id = Column(UUID(as_uuid=True))

    # Booking data
    answers = Column(JSONB, default={})
    notes = Column(Text)

    # Cancellation
    cancelled_at = Column(DateTime)
    cancellation_reason = Column(Text)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    appointment_type = relationship("AppointmentType", back_populates="appointments")


# =============================================
# Email Snooze
# =============================================

class SnoozedEmail(Base):
    """Snoozed emails to resurface later"""
    __tablename__ = "snoozed_emails"
    __table_args__ = (
        Index('idx_snoozed_emails_user', 'user_id'),
        Index('idx_snoozed_emails_until', 'snooze_until'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenant_users.id", ondelete="CASCADE"), nullable=False)

    # Email reference
    mail_uid = Column(String(255), nullable=False)
    mailbox = Column(String(255), nullable=False)
    message_id = Column(String(500))

    # Snooze settings
    snooze_until = Column(DateTime, nullable=False)
    original_folder = Column(String(255))

    # Status
    is_unsnoozed = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    unsnoozed_at = Column(DateTime)


# =============================================
# Email Templates
# =============================================

class EmailTemplate(Base):
    """Reusable email templates"""
    __tablename__ = "email_templates"
    __table_args__ = (
        Index('idx_email_templates_tenant', 'tenant_id'),
        Index('idx_email_templates_user', 'user_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenants.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenant_users.id", ondelete="CASCADE"))

    # Template content
    name = Column(String(255), nullable=False)
    subject = Column(String(500))
    body = Column(Text, nullable=False)

    # Variables
    variables = Column(JSONB, default=[])

    # Organization
    category = Column(String(100))
    is_shared = Column(Boolean, default=False)

    # Usage
    use_count = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# =============================================
# Task Lists (Google Tasks-like)
# =============================================

class TaskList(Base):
    """User task lists (My Tasks, custom lists)"""
    __tablename__ = "task_lists"
    __table_args__ = (
        Index('idx_task_lists_user', 'user_id'),
        Index('idx_task_lists_tenant', 'tenant_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenants.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False)

    # List info
    name = Column(String(255), nullable=False)
    color = Column(String(20), default='#4285f4')
    icon = Column(String(50), default='list')
    is_default = Column(Boolean, default=False)  # "My Tasks" list
    sort_order = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    tasks = relationship("Task", back_populates="task_list", cascade="all, delete-orphan")


class Task(Base):
    """Individual tasks"""
    __tablename__ = "tasks"
    __table_args__ = (
        Index('idx_tasks_user', 'user_id'),
        Index('idx_tasks_list', 'task_list_id'),
        Index('idx_tasks_status', 'status'),
        Index('idx_tasks_due', 'due_date'),
        Index('idx_tasks_starred', 'is_starred'),
        Index('idx_tasks_erp', 'erp_task_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenants.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    task_list_id = Column(UUID(as_uuid=True), ForeignKey("workspace.task_lists.id", ondelete="CASCADE"))

    # Task info
    title = Column(String(500), nullable=False)
    notes = Column(Text)
    due_date = Column(DateTime)
    due_time = Column(String(5))  # HH:MM

    # Status
    status = Column(String(20), default='needsAction')  # needsAction, completed
    completed_at = Column(DateTime)

    # Organization
    is_starred = Column(Boolean, default=False)
    priority = Column(String(20), default='normal')  # low, normal, high
    sort_order = Column(Integer, default=0)

    # Parent task (for subtasks)
    parent_task_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tasks.id", ondelete="CASCADE"))

    # ERP Integration (for project tasks)
    erp_task_id = Column(String(100))  # Link to ERP project task
    erp_project_id = Column(String(100))
    source = Column(String(20), default='personal')  # personal, erp

    # Related calendar event
    calendar_event_id = Column(String(255))

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    task_list = relationship("TaskList", back_populates="tasks")


# =============================================
# Search Index
# =============================================

class SearchIndexLog(Base):
    """Log of search index operations"""
    __tablename__ = "search_index_log"
    __table_args__ = (
        Index('idx_search_index_log_tenant', 'tenant_id'),
        Index('idx_search_index_log_status', 'status'),
        Index('idx_search_index_log_entity', 'entity_type', 'entity_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)

    # Entity reference
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(UUID(as_uuid=True), nullable=False)

    # Operation
    action = Column(String(20), nullable=False)
    status = Column(String(20), default='pending')
    error_message = Column(Text)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime)
