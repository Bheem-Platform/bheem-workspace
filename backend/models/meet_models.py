"""
Bheem Workspace - Meet Module Database Models
Recording, Transcription, Chat, Waiting Room, and Meeting Management
"""
from sqlalchemy import Column, String, Boolean, Integer, Text, DateTime, ForeignKey, Numeric, JSON, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from core.database import Base


class MeetingRoom(Base):
    """Meeting room configuration and metadata"""
    __tablename__ = "meet_rooms"
    __table_args__ = (
        Index('idx_meet_rooms_code', 'room_code'),
        Index('idx_meet_rooms_host', 'host_id'),
        Index('idx_meet_rooms_status', 'status'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_code = Column(String(20), nullable=False, unique=True)
    room_name = Column(String(255), nullable=False)
    description = Column(Text)

    # Host info
    host_id = Column(UUID(as_uuid=True), nullable=False)
    host_name = Column(String(255))

    # Status
    status = Column(String(20), default='active')  # scheduled, active, ended, cancelled

    # Settings
    waiting_room_enabled = Column(Boolean, default=True)
    mute_on_entry = Column(Boolean, default=False)
    video_off_on_entry = Column(Boolean, default=False)
    allow_screen_share = Column(Boolean, default=True)
    allow_chat = Column(Boolean, default=True)
    allow_recording = Column(Boolean, default=True)
    max_participants = Column(Integer, default=100)

    # Scheduling
    scheduled_start = Column(DateTime)
    scheduled_end = Column(DateTime)
    actual_start = Column(DateTime)
    actual_end = Column(DateTime)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    recordings = relationship("MeetingRecording", back_populates="room", cascade="all, delete-orphan")
    chat_messages = relationship("MeetingChatMessage", back_populates="room", cascade="all, delete-orphan")
    participants = relationship("MeetingParticipant", back_populates="room", cascade="all, delete-orphan")
    waiting_room = relationship("WaitingRoom", back_populates="room", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<MeetingRoom(code={self.room_code}, name={self.room_name})>"


class MeetingRecording(Base):
    """Meeting recordings with storage and processing info"""
    __tablename__ = "meet_recordings"
    __table_args__ = (
        Index('idx_meet_recordings_room', 'room_code'),
        Index('idx_meet_recordings_user', 'user_id'),
        Index('idx_meet_recordings_status', 'status'),
        Index('idx_meet_recordings_created', 'created_at'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id = Column(UUID(as_uuid=True), ForeignKey("workspace.meet_rooms.id", ondelete="SET NULL"))
    room_code = Column(String(20), nullable=False)
    room_name = Column(String(255))

    # Recording by
    user_id = Column(UUID(as_uuid=True), nullable=False)
    user_name = Column(String(255))

    # LiveKit Egress
    egress_id = Column(String(100))

    # Status
    status = Column(String(20), default='recording')  # recording, processing, uploading, transcribing, completed, failed

    # Duration and size
    started_at = Column(DateTime)
    ended_at = Column(DateTime)
    duration_seconds = Column(Integer)
    file_size_bytes = Column(Integer)

    # Storage
    storage_type = Column(String(20))  # nextcloud, local, s3
    storage_path = Column(Text)
    local_path = Column(Text)

    # Access URLs
    download_url = Column(Text)
    share_url = Column(Text)
    share_expires_at = Column(DateTime)

    # Recording settings used
    layout = Column(String(20), default='grid')  # grid, speaker, single-speaker
    resolution = Column(String(10), default='1080p')  # 720p, 1080p, 1440p
    audio_only = Column(Boolean, default=False)

    # Watermark
    watermark_applied = Column(Boolean, default=False)
    watermark_text = Column(String(255))

    # Transcription status
    has_transcript = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    room = relationship("MeetingRoom", back_populates="recordings")
    transcript = relationship("MeetingTranscript", back_populates="recording", uselist=False, cascade="all, delete-orphan")

    def __repr__(self):
        return f"<MeetingRecording(id={self.id}, room={self.room_code}, status={self.status})>"


class MeetingTranscript(Base):
    """AI-generated transcripts for recordings"""
    __tablename__ = "meet_transcripts"
    __table_args__ = (
        Index('idx_meet_transcripts_recording', 'recording_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recording_id = Column(UUID(as_uuid=True), ForeignKey("workspace.meet_recordings.id", ondelete="CASCADE"), nullable=False)

    # Full text
    text = Column(Text, nullable=False)
    word_count = Column(Integer)

    # Segments with timestamps
    segments = Column(JSON)  # [{start, end, text, speaker, confidence}]

    # Language
    language = Column(String(10), default='en')

    # AI-generated content
    summary = Column(Text)
    action_items = Column(JSON)  # [{task, assignee, due}]
    key_topics = Column(JSON)  # [topic1, topic2, ...]

    # Processing info
    model_used = Column(String(50))  # whisper-1, local-whisper
    confidence = Column(Numeric(5, 4))
    processing_time_seconds = Column(Integer)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    recording = relationship("MeetingRecording", back_populates="transcript")

    def __repr__(self):
        return f"<MeetingTranscript(recording_id={self.recording_id}, words={self.word_count})>"


class MeetingChatMessage(Base):
    """Persistent chat messages during meetings"""
    __tablename__ = "meet_chat_messages"
    __table_args__ = (
        Index('idx_meet_chat_room', 'room_code'),
        Index('idx_meet_chat_sender', 'sender_id'),
        Index('idx_meet_chat_created', 'created_at'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id = Column(UUID(as_uuid=True), ForeignKey("workspace.meet_rooms.id", ondelete="SET NULL"))
    room_code = Column(String(20), nullable=False)

    # Sender
    sender_id = Column(UUID(as_uuid=True), nullable=False)
    sender_name = Column(String(255), nullable=False)
    sender_avatar = Column(Text)

    # Message content
    content = Column(Text, nullable=False)
    message_type = Column(String(20), default='text')  # text, file, system
    reply_to_id = Column(UUID(as_uuid=True))

    # Reactions
    reactions = Column(JSON, default={})  # {emoji: [user_id1, user_id2]}

    # Status
    is_edited = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)

    # Extra data
    extra_data = Column(JSON)  # For file attachments, etc.

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)

    # Relationships
    room = relationship("MeetingRoom", back_populates="chat_messages")

    def __repr__(self):
        return f"<MeetingChatMessage(id={self.id}, sender={self.sender_name})>"


class MeetingParticipant(Base):
    """Track meeting participants for analytics"""
    __tablename__ = "meet_participants"
    __table_args__ = (
        Index('idx_meet_participants_room', 'room_code'),
        Index('idx_meet_participants_user', 'user_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id = Column(UUID(as_uuid=True), ForeignKey("workspace.meet_rooms.id", ondelete="SET NULL"))
    room_code = Column(String(20), nullable=False)

    # Participant info
    user_id = Column(UUID(as_uuid=True))
    display_name = Column(String(255), nullable=False)
    email = Column(String(320))

    # Role
    role = Column(String(20), default='participant')  # host, moderator, participant, guest

    # Participation times
    joined_at = Column(DateTime, default=datetime.utcnow)
    left_at = Column(DateTime)
    duration_seconds = Column(Integer)

    # Connection info
    ip_address = Column(String(45))
    user_agent = Column(String(500))
    connection_quality = Column(String(20))  # excellent, good, poor

    # Participation stats
    audio_enabled_duration = Column(Integer, default=0)
    video_enabled_duration = Column(Integer, default=0)
    screen_share_duration = Column(Integer, default=0)
    chat_messages_count = Column(Integer, default=0)

    # Relationships
    room = relationship("MeetingRoom", back_populates="participants")

    def __repr__(self):
        return f"<MeetingParticipant(room={self.room_code}, name={self.display_name})>"


class WaitingRoom(Base):
    """Waiting room for participant admission control"""
    __tablename__ = "meet_waiting_room"
    __table_args__ = (
        Index('idx_meet_waiting_room', 'room_code'),
        Index('idx_meet_waiting_status', 'status'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id = Column(UUID(as_uuid=True), ForeignKey("workspace.meet_rooms.id", ondelete="SET NULL"))
    room_code = Column(String(20), nullable=False)

    # Participant info
    user_id = Column(UUID(as_uuid=True))
    display_name = Column(String(255), nullable=False)
    email = Column(String(320))

    # Status
    status = Column(String(20), default='waiting')  # waiting, admitted, rejected

    # Device info
    device_info = Column(Text)

    # Timestamps
    requested_at = Column(DateTime, default=datetime.utcnow)
    admitted_at = Column(DateTime)
    rejected_at = Column(DateTime)

    # Admission info
    admitted_by = Column(UUID(as_uuid=True))
    rejected_by = Column(UUID(as_uuid=True))

    # Relationships
    room = relationship("MeetingRoom", back_populates="waiting_room")

    def __repr__(self):
        return f"<WaitingRoom(room={self.room_code}, name={self.display_name}, status={self.status})>"


class MeetingSettings(Base):
    """Default meeting settings per user/tenant"""
    __tablename__ = "meet_settings"
    __table_args__ = (
        Index('idx_meet_settings_user', 'user_id'),
        Index('idx_meet_settings_tenant', 'tenant_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True))
    tenant_id = Column(UUID(as_uuid=True))

    # Default meeting settings
    default_waiting_room = Column(Boolean, default=True)
    default_mute_on_entry = Column(Boolean, default=False)
    default_video_off_on_entry = Column(Boolean, default=False)
    default_allow_screen_share = Column(Boolean, default=True)
    default_allow_chat = Column(Boolean, default=True)
    default_allow_recording = Column(Boolean, default=True)

    # Recording settings
    auto_record = Column(Boolean, default=False)
    default_recording_layout = Column(String(20), default='grid')
    default_recording_resolution = Column(String(10), default='1080p')
    watermark_enabled = Column(Boolean, default=True)

    # Transcription settings
    auto_transcribe = Column(Boolean, default=False)
    transcription_language = Column(String(10), default='en')
    generate_summary = Column(Boolean, default=True)

    # Notification settings
    notify_on_join = Column(Boolean, default=True)
    notify_on_recording = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<MeetingSettings(user_id={self.user_id})>"
