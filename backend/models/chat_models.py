"""
Bheem Workspace - Chat Module Database Models
Direct Messages, Group Chats, Audio Calls, and File Attachments
Supports both internal (within tenant) and external (cross-tenant/guest) communication

Models:
- ExternalContact: External contacts outside the workspace
- Conversation: Chat conversations (direct or group)
- ConversationParticipant: Participants with read tracking
- ChatInvitation: Email invitations for external users
- CallLog: Audio/video call history
- DirectMessage: Individual chat messages
- MessageAttachment: File attachments for messages
"""

from sqlalchemy import (
    Column, String, Boolean, Integer, Text, DateTime,
    ForeignKey, JSON, Index, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from core.database import Base


class ExternalContact(Base):
    """
    External contacts - users outside the workspace
    Can be email-only guests or linked to other workspace users

    Each workspace manages their own external contacts list.
    Contacts can be linked to actual workspace users when they accept invitations.
    """
    __tablename__ = "chat_external_contacts"
    __table_args__ = (
        Index('idx_external_contacts_email', 'email'),
        Index('idx_external_contacts_tenant', 'owner_tenant_id'),
        Index('idx_external_contacts_linked', 'linked_user_id'),
        UniqueConstraint('owner_tenant_id', 'email', name='uq_external_contact_tenant_email'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Owner tenant (who added this contact)
    owner_tenant_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenants.id", ondelete="CASCADE"), nullable=False)
    created_by = Column(UUID(as_uuid=True), nullable=False)  # User who added the contact

    # Contact info
    email = Column(String(320), nullable=False)
    name = Column(String(255), nullable=False)
    avatar_url = Column(Text)
    phone = Column(String(50))
    company_name = Column(String(255))
    job_title = Column(String(255))

    # Link to workspace user (if they have an account)
    linked_user_id = Column(UUID(as_uuid=True))  # Their workspace TenantUser ID
    linked_tenant_id = Column(UUID(as_uuid=True))  # Their workspace Tenant ID
    linked_at = Column(DateTime)  # When the link was established

    # Invitation status
    invitation_sent_at = Column(DateTime)
    invitation_accepted_at = Column(DateTime)
    invitation_token = Column(String(100))  # For accepting invitation

    # Status
    is_active = Column(Boolean, default=True)
    is_blocked = Column(Boolean, default=False)
    blocked_reason = Column(Text)

    # Notes (internal notes about this contact)
    notes = Column(Text)
    tags = Column(JSON, default=list)  # ["client", "partner", "vendor"]

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_contacted_at = Column(DateTime)

    # Relationships
    participations = relationship("ConversationParticipant", back_populates="external_contact")

    def __repr__(self):
        return f"<ExternalContact(id={self.id}, email={self.email}, name={self.name})>"

    def to_dict(self):
        return {
            "id": str(self.id),
            "email": self.email,
            "name": self.name,
            "avatar_url": self.avatar_url,
            "phone": self.phone,
            "company_name": self.company_name,
            "job_title": self.job_title,
            "is_linked": self.linked_user_id is not None,
            "linked_tenant_id": str(self.linked_tenant_id) if self.linked_tenant_id else None,
            "tags": self.tags or [],
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_contacted_at": self.last_contacted_at.isoformat() if self.last_contacted_at else None,
        }


class Conversation(Base):
    """
    Conversations - both direct (1:1) and group chats
    Supports internal, external, and cross-tenant communication

    Scopes:
    - internal: Within same tenant (Team tab)
    - external: With external guests without workspace account
    - cross_tenant: Between different workspace tenants (Clients tab)
    """
    __tablename__ = "chat_conversations"
    __table_args__ = (
        Index('idx_chat_conversations_type', 'type'),
        Index('idx_chat_conversations_scope', 'scope'),
        Index('idx_chat_conversations_tenant', 'tenant_id'),
        Index('idx_chat_conversations_updated', 'updated_at'),
        Index('idx_chat_conversations_last_message', 'last_message_at'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Owning tenant (for internal chats) - null for pure external chats
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenants.id", ondelete="SET NULL"))

    # Conversation type: direct (1:1) or group
    type = Column(String(20), nullable=False)

    # Scope of conversation
    # internal = within same tenant (Team tab)
    # external = with external guests (Clients tab)
    # cross_tenant = between different workspace tenants (Clients tab)
    scope = Column(String(20), nullable=False, default='internal')

    # Group info (null for direct chats)
    name = Column(String(255))
    description = Column(Text)
    avatar_url = Column(Text)

    # Creator info
    created_by = Column(UUID(as_uuid=True), nullable=False)
    created_by_tenant_id = Column(UUID(as_uuid=True))

    # Last message preview (for conversation list - denormalized for performance)
    last_message_at = Column(DateTime)
    last_message_preview = Column(String(200))
    last_message_sender_id = Column(UUID(as_uuid=True))
    last_message_sender_name = Column(String(255))

    # Settings
    is_archived = Column(Boolean, default=False)

    # External chat settings
    allow_external_files = Column(Boolean, default=True)
    external_link_preview = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    participants = relationship("ConversationParticipant", back_populates="conversation", cascade="all, delete-orphan")
    messages = relationship("DirectMessage", back_populates="conversation", cascade="all, delete-orphan", order_by="DirectMessage.created_at")
    call_logs = relationship("CallLog", back_populates="conversation", cascade="all, delete-orphan")
    invitations = relationship("ChatInvitation", back_populates="conversation", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Conversation(id={self.id}, type={self.type}, scope={self.scope})>"

    def to_dict(self, current_user_id=None):
        """Convert to dictionary with participant info"""
        participants_data = [p.to_dict() for p in self.participants if p.left_at is None]

        # For direct chats, get the other participant's info for display
        other_participant = None
        if self.type == 'direct' and current_user_id:
            for p in self.participants:
                if str(p.user_id) != str(current_user_id) and p.left_at is None:
                    other_participant = p
                    break

        return {
            "id": str(self.id),
            "type": self.type,
            "scope": self.scope,
            "name": self.name if self.type == 'group' else (other_participant.user_name if other_participant else None),
            "description": self.description,
            "avatar_url": self.avatar_url if self.type == 'group' else (other_participant.user_avatar if other_participant else None),
            "is_archived": self.is_archived,
            "last_message_at": self.last_message_at.isoformat() if self.last_message_at else None,
            "last_message_preview": self.last_message_preview,
            "last_message_sender_name": self.last_message_sender_name,
            "participants": participants_data,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class ConversationParticipant(Base):
    """
    Participants in a conversation with read tracking
    Supports internal users, external workspace users, and guest users

    Participant Types:
    - internal: Same tenant workspace user
    - external_user: User from different workspace/tenant
    - guest: External user without workspace account (email only)
    """
    __tablename__ = "chat_participants"
    __table_args__ = (
        Index('idx_chat_participants_user', 'user_id'),
        Index('idx_chat_participants_conversation', 'conversation_id'),
        Index('idx_chat_participants_tenant', 'tenant_id'),
        Index('idx_chat_participants_type', 'participant_type'),
        Index('idx_chat_participants_external', 'external_contact_id'),
        Index('idx_chat_participants_active', 'conversation_id', 'left_at'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("workspace.chat_conversations.id", ondelete="CASCADE"), nullable=False)

    # Participant type
    participant_type = Column(String(20), nullable=False, default='internal')

    # For internal and external_user types
    user_id = Column(UUID(as_uuid=True))  # TenantUser ID
    tenant_id = Column(UUID(as_uuid=True))  # Participant's home tenant

    # For external_user type (cross-tenant)
    external_tenant_id = Column(UUID(as_uuid=True))
    external_tenant_name = Column(String(255))

    # For guest type (external contacts without workspace)
    external_contact_id = Column(UUID(as_uuid=True), ForeignKey("workspace.chat_external_contacts.id", ondelete="SET NULL"))

    # User info (denormalized for performance)
    user_name = Column(String(255), nullable=False)
    user_email = Column(String(320))
    user_avatar = Column(Text)

    # Company/Organization (for external participants)
    company_name = Column(String(255))

    # Role (for groups): owner, admin, member
    role = Column(String(20), default='member')

    # Read tracking
    last_read_at = Column(DateTime)
    last_read_message_id = Column(UUID(as_uuid=True))
    unread_count = Column(Integer, default=0)

    # Settings
    is_muted = Column(Boolean, default=False)
    is_pinned = Column(Boolean, default=False)
    notifications_enabled = Column(Boolean, default=True)

    # Timestamps
    joined_at = Column(DateTime, default=datetime.utcnow)
    left_at = Column(DateTime)  # Null = active participant
    invited_by = Column(UUID(as_uuid=True))

    # Presence tracking
    last_seen_at = Column(DateTime(timezone=True))  # For online/last seen status

    # Relationships
    conversation = relationship("Conversation", back_populates="participants")
    external_contact = relationship("ExternalContact", back_populates="participations")

    def __repr__(self):
        return f"<ConversationParticipant(id={self.id}, type={self.participant_type}, user={self.user_name})>"

    def to_dict(self):
        return {
            "id": str(self.id),
            "user_id": str(self.user_id) if self.user_id else None,
            "participant_type": self.participant_type,
            "user_name": self.user_name,
            "user_email": self.user_email,
            "user_avatar": self.user_avatar,
            "company_name": self.company_name,
            "role": self.role,
            "unread_count": self.unread_count,
            "is_muted": self.is_muted,
            "is_pinned": self.is_pinned,
            "joined_at": self.joined_at.isoformat() if self.joined_at else None,
            "is_external": self.participant_type in ['external_user', 'guest'],
            "last_seen_at": self.last_seen_at.isoformat() if self.last_seen_at else None,
        }


class ChatInvitation(Base):
    """
    Invitations to join chat conversations
    Used for inviting external users to conversations via email
    """
    __tablename__ = "chat_invitations"
    __table_args__ = (
        Index('idx_chat_invitations_email', 'invitee_email'),
        Index('idx_chat_invitations_token', 'token'),
        Index('idx_chat_invitations_conversation', 'conversation_id'),
        Index('idx_chat_invitations_status', 'status'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("workspace.chat_conversations.id", ondelete="CASCADE"), nullable=False)

    # Inviter info
    inviter_id = Column(UUID(as_uuid=True), nullable=False)
    inviter_name = Column(String(255), nullable=False)
    inviter_tenant_id = Column(UUID(as_uuid=True), nullable=False)
    inviter_tenant_name = Column(String(255))

    # Invitee info
    invitee_email = Column(String(320), nullable=False)
    invitee_name = Column(String(255))

    # Invitation details
    token = Column(String(100), nullable=False, unique=True)
    message = Column(Text)  # Optional invitation message

    # Status: pending, accepted, declined, expired
    status = Column(String(20), default='pending')

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)
    responded_at = Column(DateTime)

    # Relationships
    conversation = relationship("Conversation", back_populates="invitations")

    def __repr__(self):
        return f"<ChatInvitation(id={self.id}, email={self.invitee_email}, status={self.status})>"

    def to_dict(self):
        return {
            "id": str(self.id),
            "conversation_id": str(self.conversation_id),
            "inviter_name": self.inviter_name,
            "inviter_tenant_name": self.inviter_tenant_name,
            "invitee_email": self.invitee_email,
            "invitee_name": self.invitee_name,
            "message": self.message,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
        }


class CallLog(Base):
    """
    Audio/Video call history
    Tracks call status, duration, and participants
    """
    __tablename__ = "chat_call_logs"
    __table_args__ = (
        Index('idx_chat_calls_conversation', 'conversation_id'),
        Index('idx_chat_calls_caller', 'caller_id'),
        Index('idx_chat_calls_status', 'status'),
        Index('idx_chat_calls_started', 'started_at'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("workspace.chat_conversations.id", ondelete="CASCADE"), nullable=False)

    # Call type: audio or video
    call_type = Column(String(20), default='audio')

    # LiveKit room name
    room_name = Column(String(100), nullable=False)

    # Caller info
    caller_id = Column(UUID(as_uuid=True), nullable=False)
    caller_name = Column(String(255), nullable=False)
    caller_tenant_id = Column(UUID(as_uuid=True))

    # Call status: ringing, ongoing, ended, missed, declined, no_answer
    status = Column(String(20), default='ringing')

    # Participants who joined: [{user_id, user_name, tenant_id, joined_at, left_at}]
    participants_joined = Column(JSON, default=list)

    # Timing
    started_at = Column(DateTime, default=datetime.utcnow)
    answered_at = Column(DateTime)
    ended_at = Column(DateTime)
    duration_seconds = Column(Integer, default=0)

    # End reason: completed, caller_hangup, callee_hangup, missed, declined, error
    end_reason = Column(String(50))

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    conversation = relationship("Conversation", back_populates="call_logs")
    message = relationship("DirectMessage", back_populates="call_log", uselist=False)

    def __repr__(self):
        return f"<CallLog(id={self.id}, status={self.status}, duration={self.duration_seconds}s)>"

    def to_dict(self):
        return {
            "id": str(self.id),
            "conversation_id": str(self.conversation_id),
            "call_type": self.call_type,
            "room_name": self.room_name,
            "caller_id": str(self.caller_id),
            "caller_name": self.caller_name,
            "status": self.status,
            "participants_joined": self.participants_joined or [],
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "answered_at": self.answered_at.isoformat() if self.answered_at else None,
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
            "duration_seconds": self.duration_seconds,
            "end_reason": self.end_reason,
        }


class DirectMessage(Base):
    """
    Individual chat messages
    Supports text, images, files, system messages, and call references
    """
    __tablename__ = "chat_messages"
    __table_args__ = (
        Index('idx_chat_messages_conversation', 'conversation_id'),
        Index('idx_chat_messages_sender', 'sender_id'),
        Index('idx_chat_messages_created', 'created_at'),
        Index('idx_chat_messages_conversation_created', 'conversation_id', 'created_at'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("workspace.chat_conversations.id", ondelete="CASCADE"), nullable=False)

    # Sender info
    sender_id = Column(UUID(as_uuid=True), nullable=False)
    sender_name = Column(String(255), nullable=False)
    sender_avatar = Column(Text)
    sender_tenant_id = Column(UUID(as_uuid=True))  # Null for guests
    is_external_sender = Column(Boolean, default=False)

    # Content
    content = Column(Text)
    # Message type: text, image, file, system, call
    message_type = Column(String(20), default='text')

    # Reply threading
    reply_to_id = Column(UUID(as_uuid=True), ForeignKey("workspace.chat_messages.id", ondelete="SET NULL"))

    # Reactions: {emoji: [user_id1, user_id2]}
    reactions = Column(JSON, default=dict)

    # Status
    is_edited = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)

    # Delivery tracking
    delivered_to = Column(JSON, default=list)  # [user_id1, user_id2]
    read_by = Column(JSON, default=list)  # [user_id1, user_id2]

    # Call reference (for call messages)
    call_log_id = Column(UUID(as_uuid=True), ForeignKey("workspace.chat_call_logs.id", ondelete="SET NULL"))

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)

    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    attachments = relationship("MessageAttachment", back_populates="message", cascade="all, delete-orphan")
    reply_to = relationship("DirectMessage", remote_side=[id], foreign_keys=[reply_to_id])
    call_log = relationship("CallLog", back_populates="message", foreign_keys=[call_log_id])

    def __repr__(self):
        return f"<DirectMessage(id={self.id}, type={self.message_type}, sender={self.sender_name})>"

    def to_dict(self):
        return {
            "id": str(self.id),
            "conversation_id": str(self.conversation_id),
            "sender_id": str(self.sender_id),
            "sender_name": self.sender_name,
            "sender_avatar": self.sender_avatar,
            "is_external_sender": self.is_external_sender,
            "content": self.content if not self.is_deleted else None,
            "message_type": self.message_type,
            "reply_to_id": str(self.reply_to_id) if self.reply_to_id else None,
            "reactions": self.reactions or {},
            "is_edited": self.is_edited,
            "is_deleted": self.is_deleted,
            "delivered_to": self.delivered_to or [],
            "read_by": self.read_by or [],
            "attachments": [a.to_dict() for a in self.attachments] if self.attachments else [],
            "call_log": self.call_log.to_dict() if self.call_log else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class MessageAttachment(Base):
    """
    File attachments for messages
    Supports images, documents, and other files
    """
    __tablename__ = "chat_attachments"
    __table_args__ = (
        Index('idx_chat_attachments_message', 'message_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id = Column(UUID(as_uuid=True), ForeignKey("workspace.chat_messages.id", ondelete="CASCADE"), nullable=False)

    # File info
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(100))  # MIME type
    file_size = Column(Integer)  # Size in bytes

    # Storage URLs
    file_url = Column(Text, nullable=False)
    thumbnail_url = Column(Text)  # For images

    # Image dimensions (if applicable)
    width = Column(Integer)
    height = Column(Integer)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    message = relationship("DirectMessage", back_populates="attachments")

    def __repr__(self):
        return f"<MessageAttachment(id={self.id}, file={self.file_name})>"

    def to_dict(self):
        return {
            "id": str(self.id),
            "file_name": self.file_name,
            "file_type": self.file_type,
            "file_size": self.file_size,
            "file_url": self.file_url,
            "thumbnail_url": self.thumbnail_url,
            "width": self.width,
            "height": self.height,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
