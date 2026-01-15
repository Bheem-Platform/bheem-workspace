"""
Bheem Workspace - Mail Module Database Models
Models for mail drafts, signatures, filters, contacts, and 2FA
"""
from sqlalchemy import Column, String, Boolean, Integer, Text, DateTime, ForeignKey, Index, ARRAY
from sqlalchemy.dialects.postgresql import UUID, INET, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from core.database import Base


class MailDraft(Base):
    """Email drafts saved server-side"""
    __tablename__ = "mail_drafts"
    __table_args__ = (
        Index('idx_mail_drafts_user', 'user_id'),
        Index('idx_mail_drafts_updated', 'updated_at'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)

    # Email content
    subject = Column(Text, default="")
    body = Column(Text, default="")
    is_html = Column(Boolean, default=True)

    # Recipients (stored as JSONB arrays of {name, email})
    to_addresses = Column(JSONB, default=[])
    cc_addresses = Column(JSONB, default=[])
    bcc_addresses = Column(JSONB, default=[])

    # Attachments metadata (actual files stored elsewhere)
    attachments = Column(JSONB, default=[])

    # Reply/Forward info
    reply_to_message_id = Column(String(500))  # Message-ID header for threading
    forward_message_id = Column(String(500))
    reply_type = Column(String(20))  # 'reply', 'reply_all', 'forward'

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<MailDraft(id={self.id}, subject={self.subject[:30] if self.subject else 'No subject'})>"


class MailSignature(Base):
    """Email signatures per user"""
    __tablename__ = "mail_signatures"
    __table_args__ = (
        Index('idx_mail_signatures_user', 'user_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)

    # Signature details
    name = Column(String(100), nullable=False)
    content = Column(Text, nullable=False)
    is_html = Column(Boolean, default=True)

    # Default flag (only one can be default per user)
    is_default = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<MailSignature(id={self.id}, name={self.name})>"


class MailFilter(Base):
    """Email filters/rules for auto-organizing"""
    __tablename__ = "mail_filters"
    __table_args__ = (
        Index('idx_mail_filters_user', 'user_id'),
        Index('idx_mail_filters_priority', 'priority'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)

    # Filter info
    name = Column(String(255), nullable=False)
    is_enabled = Column(Boolean, default=True)
    priority = Column(Integer, default=0)  # Lower = higher priority
    stop_processing = Column(Boolean, default=False)  # Stop if this filter matches

    # Conditions (JSONB array of condition objects)
    # Example: [{"field": "from", "operator": "contains", "value": "@company.com"}]
    conditions = Column(JSONB, nullable=False, default=[])

    # Actions (JSONB array of action objects)
    # Example: [{"action": "move_to", "value": "Important"}]
    actions = Column(JSONB, nullable=False, default=[])

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<MailFilter(id={self.id}, name={self.name})>"


class MailContact(Base):
    """Auto-collected mail contacts for autocomplete"""
    __tablename__ = "mail_contacts"
    __table_args__ = (
        Index('idx_mail_contacts_user', 'user_id'),
        Index('idx_mail_contacts_email', 'email'),
        Index('idx_mail_contacts_frequency', 'user_id', 'frequency'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)

    # Contact info
    email = Column(String(320), nullable=False)
    name = Column(String(255))

    # Usage stats
    frequency = Column(Integer, default=1)  # How often emailed
    last_contacted = Column(DateTime)

    # Status
    is_favorite = Column(Boolean, default=False)
    source = Column(String(50), default='auto')  # 'auto', 'manual', 'import'

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<MailContact(email={self.email}, frequency={self.frequency})>"


class ScheduledEmail(Base):
    """Emails scheduled for future delivery"""
    __tablename__ = "scheduled_emails"
    __table_args__ = (
        Index('idx_scheduled_emails_user', 'user_id'),
        Index('idx_scheduled_emails_status', 'status'),
        Index('idx_scheduled_emails_time', 'scheduled_at'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)

    # Schedule info
    scheduled_at = Column(DateTime, nullable=False)
    status = Column(String(20), default='pending')  # pending, sent, cancelled, failed

    # Email data (full email content as JSONB)
    email_data = Column(JSONB, nullable=False)

    # Results
    sent_at = Column(DateTime)
    error_message = Column(Text)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<ScheduledEmail(id={self.id}, scheduled_at={self.scheduled_at}, status={self.status})>"


class MailLabel(Base):
    """Custom email labels/tags"""
    __tablename__ = "mail_labels"
    __table_args__ = (
        Index('idx_mail_labels_user', 'user_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)

    # Label info
    name = Column(String(100), nullable=False)
    color = Column(String(7), default='#4A90D9')  # Hex color
    description = Column(String(255))

    # Settings
    is_visible = Column(Boolean, default=True)
    show_in_list = Column(Boolean, default=True)  # Show in sidebar

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<MailLabel(id={self.id}, name={self.name})>"


class MailLabelAssignment(Base):
    """Assignment of labels to emails (message IDs)"""
    __tablename__ = "mail_label_assignments"
    __table_args__ = (
        Index('idx_mail_label_assign_user', 'user_id'),
        Index('idx_mail_label_assign_label', 'label_id'),
        Index('idx_mail_label_assign_message', 'message_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    label_id = Column(UUID(as_uuid=True), ForeignKey('workspace.mail_labels.id', ondelete='CASCADE'), nullable=False)
    message_id = Column(String(500), nullable=False)  # IMAP message ID

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<MailLabelAssignment(label_id={self.label_id}, message_id={self.message_id})>"


class MailTemplate(Base):
    """Reusable email templates"""
    __tablename__ = "mail_templates"
    __table_args__ = (
        Index('idx_mail_templates_user', 'user_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)

    # Template info
    name = Column(String(255), nullable=False)
    description = Column(Text)

    # Email content
    subject = Column(Text, default="")
    body = Column(Text, default="")
    is_html = Column(Boolean, default=True)

    # Optional default recipients
    to_addresses = Column(JSONB, default=[])
    cc_addresses = Column(JSONB, default=[])

    # Category/folder
    category = Column(String(100), default='general')

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<MailTemplate(id={self.id}, name={self.name})>"


class MailVacationResponder(Base):
    """Vacation/Out of Office auto-responder settings"""
    __tablename__ = "mail_vacation_responders"
    __table_args__ = (
        Index('idx_mail_vacation_user', 'user_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, unique=True)

    # Status
    is_enabled = Column(Boolean, default=False)

    # Date range (optional)
    start_date = Column(DateTime)
    end_date = Column(DateTime)

    # Response message
    subject = Column(String(500), default="Out of Office")
    message = Column(Text, nullable=False)
    is_html = Column(Boolean, default=False)

    # Settings
    only_contacts = Column(Boolean, default=False)  # Only reply to known contacts
    only_once = Column(Boolean, default=True)  # Only reply once per sender

    # Track who was replied to (to enforce only_once)
    replied_to = Column(JSONB, default=[])

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<MailVacationResponder(user_id={self.user_id}, enabled={self.is_enabled})>"


class SharedMailbox(Base):
    """Shared mailboxes for team inboxes"""
    __tablename__ = "shared_mailboxes"
    __table_args__ = (
        Index('idx_shared_mailboxes_tenant', 'tenant_id'),
        Index('idx_shared_mailboxes_email', 'email'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    email = Column(String(255), nullable=False, unique=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_by = Column(UUID(as_uuid=True))

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    members = relationship("SharedMailboxMember", back_populates="mailbox", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<SharedMailbox(id={self.id}, email={self.email})>"


class SharedMailboxMember(Base):
    """Members of shared mailboxes with permissions"""
    __tablename__ = "shared_mailbox_members"
    __table_args__ = (
        Index('idx_shared_mailbox_members_mailbox', 'mailbox_id'),
        Index('idx_shared_mailbox_members_user', 'user_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mailbox_id = Column(UUID(as_uuid=True), ForeignKey('workspace.shared_mailboxes.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    role = Column(String(20), default='member')  # admin, member, viewer
    can_send = Column(Boolean, default=True)
    can_delete = Column(Boolean, default=False)
    can_manage_members = Column(Boolean, default=False)
    added_by = Column(UUID(as_uuid=True))

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    mailbox = relationship("SharedMailbox", back_populates="members")

    def __repr__(self):
        return f"<SharedMailboxMember(mailbox_id={self.mailbox_id}, user_id={self.user_id}, role={self.role})>"


class SharedMailboxAssignment(Base):
    """Email assignments in shared mailboxes"""
    __tablename__ = "shared_mailbox_assignments"
    __table_args__ = (
        Index('idx_shared_assignments_mailbox', 'mailbox_id'),
        Index('idx_shared_assignments_assigned', 'assigned_to'),
        Index('idx_shared_assignments_status', 'status'),
        Index('idx_shared_assignments_message', 'message_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mailbox_id = Column(UUID(as_uuid=True), ForeignKey('workspace.shared_mailboxes.id', ondelete='CASCADE'), nullable=False)
    message_id = Column(String(500), nullable=False)
    assigned_to = Column(UUID(as_uuid=True))
    assigned_by = Column(UUID(as_uuid=True))
    status = Column(String(20), default='open')  # open, in_progress, resolved, closed
    priority = Column(String(10), default='normal')  # low, normal, high, urgent
    due_date = Column(DateTime)
    notes = Column(Text)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<SharedMailboxAssignment(mailbox_id={self.mailbox_id}, message_id={self.message_id}, status={self.status})>"


class SharedMailboxComment(Base):
    """Internal comments on shared mailbox emails"""
    __tablename__ = "shared_mailbox_comments"
    __table_args__ = (
        Index('idx_shared_comments_mailbox', 'mailbox_id'),
        Index('idx_shared_comments_message', 'message_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mailbox_id = Column(UUID(as_uuid=True), ForeignKey('workspace.shared_mailboxes.id', ondelete='CASCADE'), nullable=False)
    message_id = Column(String(500), nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    comment = Column(Text, nullable=False)
    is_internal = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<SharedMailboxComment(mailbox_id={self.mailbox_id}, message_id={self.message_id})>"


class SharedMailboxActivity(Base):
    """Activity log for shared mailboxes"""
    __tablename__ = "shared_mailbox_activity"
    __table_args__ = (
        Index('idx_shared_activity_mailbox', 'mailbox_id'),
        Index('idx_shared_activity_message', 'message_id'),
        Index('idx_shared_activity_created', 'created_at'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mailbox_id = Column(UUID(as_uuid=True), ForeignKey('workspace.shared_mailboxes.id', ondelete='CASCADE'), nullable=False)
    message_id = Column(String(500))
    user_id = Column(UUID(as_uuid=True), nullable=False)
    action = Column(String(50), nullable=False)  # viewed, replied, forwarded, assigned, commented, status_changed
    details = Column(JSONB)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<SharedMailboxActivity(mailbox_id={self.mailbox_id}, action={self.action})>"


class Mail2FALog(Base):
    """Audit log for 2FA actions"""
    __tablename__ = "mail_2fa_logs"
    __table_args__ = (
        Index('idx_mail_2fa_logs_user', 'user_id'),
        Index('idx_mail_2fa_logs_created', 'created_at'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)

    # Action details
    action = Column(String(50), nullable=False)  # setup_started, enabled, disabled, verified, backup_used, failed_attempt
    success = Column(Boolean, default=True)
    failure_reason = Column(Text)

    # Request info
    ip_address = Column(INET)
    user_agent = Column(Text)

    # Timestamp
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<Mail2FALog(user_id={self.user_id}, action={self.action})>"


# ═══════════════════════════════════════════════════════════════════
# Gmail-like Categories, Snooze & System Labels
# ═══════════════════════════════════════════════════════════════════

class EmailCategory(Base):
    """Gmail-like email categorization (Primary, Social, Updates, Promotions)"""
    __tablename__ = "email_categories"
    __table_args__ = (
        Index('idx_email_categories_user', 'user_id'),
        Index('idx_email_categories_message', 'message_id'),
        Index('idx_email_categories_category', 'category'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    message_id = Column(String(500), nullable=False)  # IMAP message ID

    # Category: primary, social, updates, promotions, forums
    category = Column(String(20), nullable=False, default='primary')

    # Auto-categorization info
    auto_categorized = Column(Boolean, default=True)
    categorized_by = Column(String(50), default='rule')  # rule, ai, user
    confidence = Column(Integer, default=100)  # 0-100 confidence score

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<EmailCategory(message_id={self.message_id}, category={self.category})>"


class EmailCategoryRule(Base):
    """Rules for auto-categorizing emails"""
    __tablename__ = "email_category_rules"
    __table_args__ = (
        Index('idx_email_category_rules_user', 'user_id'),
        Index('idx_email_category_rules_category', 'category'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)

    # Rule info
    name = Column(String(255), nullable=False)
    is_enabled = Column(Boolean, default=True)
    is_system = Column(Boolean, default=False)  # Built-in rules
    priority = Column(Integer, default=0)

    # Target category
    category = Column(String(20), nullable=False)  # primary, social, updates, promotions

    # Conditions (JSONB - similar to mail filters)
    # Example: {"from_domain": ["facebook.com", "twitter.com"], "list_unsubscribe": true}
    conditions = Column(JSONB, nullable=False, default={})

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<EmailCategoryRule(name={self.name}, category={self.category})>"


# SnoozedEmail model is defined in calendar_models.py to avoid duplication
# Import it from there: from models.calendar_models import SnoozedEmail


class EmailImportance(Base):
    """Important/starred emails tracking"""
    __tablename__ = "email_importance"
    __table_args__ = (
        Index('idx_email_importance_user', 'user_id'),
        Index('idx_email_importance_message', 'message_id'),
        Index('idx_email_importance_starred', 'is_starred'),
        Index('idx_email_importance_important', 'is_important'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    message_id = Column(String(500), nullable=False)  # IMAP message ID

    # Flags
    is_starred = Column(Boolean, default=False)
    is_important = Column(Boolean, default=False)

    # Auto-importance tracking
    auto_important = Column(Boolean, default=False)  # Set by AI/rules
    importance_reason = Column(String(100))  # vip_sender, keyword, etc.

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<EmailImportance(message_id={self.message_id}, starred={self.is_starred}, important={self.is_important})>"


class MailReadReceipt(Base):
    """Track read receipts and email opens"""
    __tablename__ = "mail_read_receipts"
    __table_args__ = (
        Index('idx_mail_read_receipts_user', 'user_id'),
        Index('idx_mail_read_receipts_message', 'message_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    message_id = Column(String(500), nullable=False)

    # Tracking
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime)
    read_count = Column(Integer, default=0)

    # Receipt request/response
    receipt_requested = Column(Boolean, default=False)
    receipt_sent = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<MailReadReceipt(message_id={self.message_id}, is_read={self.is_read})>"
