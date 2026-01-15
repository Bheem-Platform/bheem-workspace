"""
Bheem Workspace - Enterprise Models
Models for DLP, Device Management, and AI features
"""
from sqlalchemy import Column, String, Boolean, Integer, Text, DateTime, ForeignKey, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET, ARRAY
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from core.database import Base


# =============================================
# Data Loss Prevention (DLP)
# =============================================

class DLPRule(Base):
    """DLP rules for detecting sensitive data"""
    __tablename__ = "dlp_rules"
    __table_args__ = (
        Index('idx_dlp_rules_tenant', 'tenant_id'),
        Index('idx_dlp_rules_enabled', 'is_enabled'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenants.id", ondelete="CASCADE"), nullable=False)

    # Rule info
    name = Column(String(255), nullable=False)
    description = Column(Text)

    # Pattern matching
    pattern_type = Column(String(50), nullable=False)  # regex, keyword, predefined
    pattern = Column(Text, nullable=False)
    predefined_type = Column(String(100))  # credit_card, ssn, phone, email, etc.

    # Scope
    scope = Column(JSONB, default={})  # apps, file_types, users, groups

    # Action when detected
    action = Column(String(50), nullable=False)  # warn, block, notify, log
    notify_admins = Column(Boolean, default=True)
    notify_user = Column(Boolean, default=True)
    custom_message = Column(Text)

    # Status
    is_enabled = Column(Boolean, default=True)
    severity = Column(String(20), default='medium')  # low, medium, high, critical

    # Stats
    trigger_count = Column(Integer, default=0)
    last_triggered_at = Column(DateTime)

    # Tracking
    created_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    incidents = relationship("DLPIncident", back_populates="rule", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<DLPRule(id={self.id}, name={self.name}, type={self.pattern_type})>"


class DLPIncident(Base):
    """DLP incidents when sensitive data is detected"""
    __tablename__ = "dlp_incidents"
    __table_args__ = (
        Index('idx_dlp_incidents_tenant', 'tenant_id'),
        Index('idx_dlp_incidents_rule', 'rule_id'),
        Index('idx_dlp_incidents_user', 'user_id'),
        Index('idx_dlp_incidents_status', 'status'),
        Index('idx_dlp_incidents_created', 'created_at'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenants.id", ondelete="CASCADE"), nullable=False)
    rule_id = Column(UUID(as_uuid=True), ForeignKey("workspace.dlp_rules.id", ondelete="SET NULL"))
    user_id = Column(UUID(as_uuid=True), nullable=False)

    # Content info
    content_type = Column(String(100), nullable=False)  # email, document, file, chat
    content_id = Column(UUID(as_uuid=True))
    content_title = Column(String(500))

    # Match details
    matched_pattern = Column(Text)
    matched_content = Column(Text)  # Redacted snippet
    match_count = Column(Integer, default=1)

    # Action taken
    action_taken = Column(String(50), nullable=False)
    was_blocked = Column(Boolean, default=False)

    # Status
    status = Column(String(20), default='open')  # open, reviewed, resolved, false_positive
    reviewed_by = Column(UUID(as_uuid=True))
    reviewed_at = Column(DateTime)
    resolution_notes = Column(Text)

    # Context
    ip_address = Column(INET)
    user_agent = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    rule = relationship("DLPRule", back_populates="incidents")

    def __repr__(self):
        return f"<DLPIncident(id={self.id}, type={self.content_type}, status={self.status})>"


# =============================================
# Device Management
# =============================================

class Device(Base):
    """Devices accessing the workspace"""
    __tablename__ = "devices"
    __table_args__ = (
        Index('idx_devices_tenant', 'tenant_id'),
        Index('idx_devices_user', 'user_id'),
        Index('idx_devices_status', 'status'),
        Index('idx_devices_last_seen', 'last_seen_at'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenants.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenant_users.id", ondelete="CASCADE"), nullable=False)

    # Device info
    device_id = Column(String(255), nullable=False)  # Unique device identifier
    device_name = Column(String(255))
    device_type = Column(String(50))  # desktop, mobile, tablet
    platform = Column(String(100))  # windows, macos, ios, android, linux, web
    os_version = Column(String(100))
    app_version = Column(String(50))
    browser = Column(String(100))

    # Security
    is_managed = Column(Boolean, default=False)
    is_encrypted = Column(Boolean, default=False)
    has_screen_lock = Column(Boolean, default=False)
    is_rooted = Column(Boolean, default=False)  # Jailbroken/rooted

    # Status
    status = Column(String(20), default='active')  # active, blocked, wiped
    blocked_at = Column(DateTime)
    blocked_reason = Column(Text)
    wiped_at = Column(DateTime)

    # Activity
    first_seen_at = Column(DateTime, default=datetime.utcnow)
    last_seen_at = Column(DateTime, default=datetime.utcnow)
    last_ip_address = Column(INET)
    last_location = Column(String(255))

    # Push notifications
    push_token = Column(Text)
    push_enabled = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Device(id={self.id}, type={self.device_type}, status={self.status})>"


class DevicePolicy(Base):
    """Device security policies"""
    __tablename__ = "device_policies"
    __table_args__ = (
        Index('idx_device_policies_tenant', 'tenant_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenants.id", ondelete="CASCADE"), nullable=False)

    name = Column(String(255), nullable=False)
    description = Column(Text)

    # Policy rules
    require_encryption = Column(Boolean, default=False)
    require_screen_lock = Column(Boolean, default=False)
    min_os_version = Column(JSONB, default={})  # {"ios": "15.0", "android": "12"}
    block_rooted = Column(Boolean, default=True)
    allowed_platforms = Column(ARRAY(Text), default=[])  # Empty = all allowed
    max_inactive_days = Column(Integer, default=90)  # Auto-block after inactivity

    # Actions
    block_on_violation = Column(Boolean, default=False)
    wipe_on_violation = Column(Boolean, default=False)

    # Status
    is_enabled = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)

    # Scope
    apply_to_groups = Column(ARRAY(UUID(as_uuid=True)), default=[])
    apply_to_org_units = Column(ARRAY(UUID(as_uuid=True)), default=[])

    created_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<DevicePolicy(id={self.id}, name={self.name})>"


# =============================================
# AI Features
# =============================================

class AIConversation(Base):
    """AI assistant conversation history"""
    __tablename__ = "ai_conversations"
    __table_args__ = (
        Index('idx_ai_conversations_user', 'user_id'),
        Index('idx_ai_conversations_created', 'created_at'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenants.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenant_users.id", ondelete="CASCADE"), nullable=False)

    # Conversation context
    title = Column(String(500))
    context_type = Column(String(50))  # general, email, document, spreadsheet, etc.
    context_id = Column(UUID(as_uuid=True))

    # Messages stored as JSONB array
    messages = Column(JSONB, default=[])
    # [{"role": "user", "content": "...", "timestamp": "..."}, {"role": "assistant", ...}]

    # Stats
    message_count = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)

    # Status
    is_archived = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<AIConversation(id={self.id}, title={self.title})>"


class AIUsageLog(Base):
    """Track AI feature usage for billing/analytics"""
    __tablename__ = "ai_usage_log"
    __table_args__ = (
        Index('idx_ai_usage_tenant', 'tenant_id'),
        Index('idx_ai_usage_user', 'user_id'),
        Index('idx_ai_usage_feature', 'feature'),
        Index('idx_ai_usage_created', 'created_at'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenants.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True))

    # Feature used
    feature = Column(String(100), nullable=False)  # chat, summarize, translate, compose, analyze
    context_type = Column(String(50))
    context_id = Column(UUID(as_uuid=True))

    # Usage metrics
    input_tokens = Column(Integer, default=0)
    output_tokens = Column(Integer, default=0)
    model_used = Column(String(100))
    latency_ms = Column(Integer)

    # Status
    success = Column(Boolean, default=True)
    error_message = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<AIUsageLog(id={self.id}, feature={self.feature})>"


# =============================================
# Predefined DLP Pattern Types
# =============================================

DLP_PREDEFINED_PATTERNS = {
    "credit_card": {
        "name": "Credit Card Number",
        "description": "Detects credit card numbers (Visa, Mastercard, Amex, etc.)",
        "regex": r"\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b"
    },
    "ssn": {
        "name": "Social Security Number (US)",
        "description": "Detects US Social Security Numbers",
        "regex": r"\b\d{3}-\d{2}-\d{4}\b"
    },
    "pan": {
        "name": "PAN Card (India)",
        "description": "Detects Indian PAN card numbers",
        "regex": r"\b[A-Z]{5}[0-9]{4}[A-Z]\b"
    },
    "aadhaar": {
        "name": "Aadhaar Number (India)",
        "description": "Detects Indian Aadhaar numbers",
        "regex": r"\b\d{4}\s?\d{4}\s?\d{4}\b"
    },
    "phone_us": {
        "name": "Phone Number (US)",
        "description": "Detects US phone numbers",
        "regex": r"\b(?:\+1)?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b"
    },
    "phone_uk": {
        "name": "Phone Number (UK)",
        "description": "Detects UK phone numbers",
        "regex": r"\b(?:\+44)?[\s.-]?\(?0?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b"
    },
    "email": {
        "name": "Email Address",
        "description": "Detects email addresses",
        "regex": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
    },
    "ip_address": {
        "name": "IP Address",
        "description": "Detects IPv4 addresses",
        "regex": r"\b(?:\d{1,3}\.){3}\d{1,3}\b"
    },
    "passport": {
        "name": "Passport Number",
        "description": "Detects passport numbers (generic)",
        "regex": r"\b[A-Z]{1,2}[0-9]{6,9}\b"
    },
    "bank_account": {
        "name": "Bank Account Number",
        "description": "Detects bank account numbers (generic)",
        "regex": r"\b\d{9,18}\b"
    },
    "api_key": {
        "name": "API Key",
        "description": "Detects potential API keys",
        "regex": r"\b(?:api[_-]?key|apikey|secret[_-]?key)[\"']?\s*[:=]\s*[\"']?[A-Za-z0-9_-]{20,}[\"']?"
    },
    "password": {
        "name": "Password in Text",
        "description": "Detects passwords in plain text",
        "regex": r"\b(?:password|passwd|pwd)[\"']?\s*[:=]\s*[\"']?[^\s\"']{6,}[\"']?"
    }
}
