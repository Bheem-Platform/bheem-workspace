"""
Bheem Workspace - Meet Enhancement Models
Models for breakout rooms, polls, Q&A, and whiteboard
"""
from sqlalchemy import Column, String, Boolean, Integer, Text, DateTime, ForeignKey, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from core.database import Base


# =============================================
# Breakout Rooms
# =============================================

class BreakoutRoom(Base):
    """Breakout rooms within a meeting"""
    __tablename__ = "breakout_rooms"
    __table_args__ = (
        Index('idx_breakout_rooms_meeting', 'meeting_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meeting_id = Column(UUID(as_uuid=True), nullable=False)  # References meeting_rooms

    name = Column(String(255), nullable=False)
    room_index = Column(Integer, default=0)
    status = Column(String(20), default='waiting')  # waiting, active, closed

    # Timing
    duration_minutes = Column(Integer)
    started_at = Column(DateTime)
    ended_at = Column(DateTime)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    participants = relationship("BreakoutParticipant", back_populates="breakout_room", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<BreakoutRoom(id={self.id}, name={self.name}, status={self.status})>"


class BreakoutParticipant(Base):
    """Participants assigned to breakout rooms"""
    __tablename__ = "breakout_participants"
    __table_args__ = (
        Index('idx_breakout_participants_room', 'breakout_room_id'),
        UniqueConstraint('breakout_room_id', 'participant_id', name='uq_breakout_participant'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    breakout_room_id = Column(UUID(as_uuid=True), ForeignKey("workspace.breakout_rooms.id", ondelete="CASCADE"), nullable=False)
    participant_id = Column(UUID(as_uuid=True), nullable=False)  # References meeting_participants

    assignment_type = Column(String(20), default='auto')  # auto, manual
    joined_at = Column(DateTime)
    left_at = Column(DateTime)

    # Relationships
    breakout_room = relationship("BreakoutRoom", back_populates="participants")

    def __repr__(self):
        return f"<BreakoutParticipant(room={self.breakout_room_id}, participant={self.participant_id})>"


# =============================================
# Polls
# =============================================

class MeetingPoll(Base):
    """Polls during meetings"""
    __tablename__ = "meeting_polls"
    __table_args__ = (
        Index('idx_meeting_polls_meeting', 'meeting_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meeting_id = Column(UUID(as_uuid=True), nullable=False)  # References meeting_rooms

    question = Column(Text, nullable=False)
    poll_type = Column(String(20), default='single')  # single, multiple
    options = Column(JSONB, default=[])  # [{"text": "Option 1"}, {"text": "Option 2"}]
    is_anonymous = Column(Boolean, default=False)

    status = Column(String(20), default='draft')  # draft, active, closed
    results = Column(JSONB, default={})  # Aggregated results

    # Tracking
    created_by = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime)
    ended_at = Column(DateTime)

    # Relationships
    votes = relationship("MeetingPollVote", back_populates="poll", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<MeetingPoll(id={self.id}, question={self.question[:50]}, status={self.status})>"


class MeetingPollVote(Base):
    """Individual poll votes"""
    __tablename__ = "meeting_poll_votes"
    __table_args__ = (
        Index('idx_poll_votes_poll', 'poll_id'),
        UniqueConstraint('poll_id', 'participant_id', name='uq_poll_vote'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    poll_id = Column(UUID(as_uuid=True), ForeignKey("workspace.meeting_polls.id", ondelete="CASCADE"), nullable=False)
    participant_id = Column(UUID(as_uuid=True), nullable=False)

    selected_options = Column(ARRAY(Integer), nullable=False)  # Indices of selected options
    voted_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    poll = relationship("MeetingPoll", back_populates="votes")

    def __repr__(self):
        return f"<MeetingPollVote(poll={self.poll_id}, options={self.selected_options})>"


# =============================================
# Q&A
# =============================================

class MeetingQA(Base):
    """Q&A questions during meetings"""
    __tablename__ = "meeting_qa"
    __table_args__ = (
        Index('idx_meeting_qa_meeting', 'meeting_id'),
        Index('idx_meeting_qa_upvotes', 'upvote_count'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meeting_id = Column(UUID(as_uuid=True), nullable=False)  # References meeting_rooms

    question = Column(Text, nullable=False)
    asked_by = Column(UUID(as_uuid=True))
    asked_by_name = Column(String(255))
    is_anonymous = Column(Boolean, default=False)

    # Voting
    upvote_count = Column(Integer, default=0)

    # Answer
    is_answered = Column(Boolean, default=False)
    answer = Column(Text)
    answered_by = Column(UUID(as_uuid=True))
    answered_at = Column(DateTime)

    # Timestamp
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    upvotes = relationship("MeetingQAUpvote", back_populates="qa", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<MeetingQA(id={self.id}, question={self.question[:50]}, upvotes={self.upvote_count})>"


class MeetingQAUpvote(Base):
    """Upvotes on Q&A questions"""
    __tablename__ = "meeting_qa_upvotes"
    __table_args__ = (
        UniqueConstraint('qa_id', 'participant_id', name='uq_qa_upvote'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    qa_id = Column(UUID(as_uuid=True), ForeignKey("workspace.meeting_qa.id", ondelete="CASCADE"), nullable=False)
    participant_id = Column(UUID(as_uuid=True), nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    qa = relationship("MeetingQA", back_populates="upvotes")

    def __repr__(self):
        return f"<MeetingQAUpvote(qa={self.qa_id}, participant={self.participant_id})>"


# =============================================
# Whiteboard
# =============================================

class MeetingWhiteboard(Base):
    """Whiteboards in meetings"""
    __tablename__ = "meeting_whiteboards"
    __table_args__ = (
        Index('idx_meeting_whiteboards_meeting', 'meeting_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meeting_id = Column(UUID(as_uuid=True), nullable=False)  # References meeting_rooms

    name = Column(String(255), default='Whiteboard')
    pages = Column(JSONB, default=[{}])  # Array of page data with canvas elements

    # Settings
    background_color = Column(String(20), default='#ffffff')
    grid_enabled = Column(Boolean, default=False)

    # Tracking
    created_by = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<MeetingWhiteboard(id={self.id}, name={self.name})>"
