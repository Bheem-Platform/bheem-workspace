"""
Bheem Workspace - Productivity Suite Database Models
Sheets, Slides, Forms, and related entities
"""
from sqlalchemy import Column, String, Boolean, Integer, Text, DateTime, ForeignKey, Index, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from core.database import Base


# =============================================
# Enums
# =============================================

class FormStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    CLOSED = "closed"


class SharePermission(str, enum.Enum):
    VIEW = "view"
    COMMENT = "comment"
    EDIT = "edit"


class QuestionType(str, enum.Enum):
    SHORT_TEXT = "short_text"
    LONG_TEXT = "long_text"
    MULTIPLE_CHOICE = "multiple_choice"
    CHECKBOX = "checkbox"
    DROPDOWN = "dropdown"
    FILE = "file"
    DATE = "date"
    TIME = "time"
    SCALE = "scale"
    GRID = "grid"


# =============================================
# Bheem Sheets Models
# =============================================

class Spreadsheet(Base):
    """Spreadsheet - similar to Google Sheets workbook"""
    __tablename__ = "spreadsheets"
    __table_args__ = (
        Index('idx_spreadsheets_tenant', 'tenant_id'),
        Index('idx_spreadsheets_owner', 'created_by'),
        Index('idx_spreadsheets_folder', 'folder_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenants.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    folder_id = Column(UUID(as_uuid=True))  # Optional folder organization

    # Status
    is_starred = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime)

    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("workspace.tenant_users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    worksheets = relationship("Worksheet", back_populates="spreadsheet", cascade="all, delete-orphan")
    shares = relationship("SpreadsheetShare", back_populates="spreadsheet", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Spreadsheet(id={self.id}, title={self.title})>"


class Worksheet(Base):
    """Individual sheet/tab within a spreadsheet"""
    __tablename__ = "worksheets"
    __table_args__ = (
        Index('idx_worksheets_spreadsheet', 'spreadsheet_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    spreadsheet_id = Column(UUID(as_uuid=True), ForeignKey("workspace.spreadsheets.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False, default='Sheet1')
    sheet_index = Column(Integer, nullable=False, default=0)

    # Cell data stored as JSONB for flexibility
    # Format: {"A1": {"value": "Hello", "formula": null, "format": {...}}, ...}
    data = Column(JSONB, default={})

    # Sheet dimensions
    row_count = Column(Integer, default=1000)
    column_count = Column(Integer, default=26)

    # Appearance
    color = Column(String(20))  # Tab color
    is_hidden = Column(Boolean, default=False)

    # Frozen rows/columns
    frozen_rows = Column(Integer, default=0)
    frozen_columns = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    spreadsheet = relationship("Spreadsheet", back_populates="worksheets")

    def __repr__(self):
        return f"<Worksheet(id={self.id}, name={self.name})>"


class SpreadsheetShare(Base):
    """Sharing permissions for spreadsheets"""
    __tablename__ = "spreadsheet_shares"
    __table_args__ = (
        Index('idx_spreadsheet_shares_user', 'user_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    spreadsheet_id = Column(UUID(as_uuid=True), ForeignKey("workspace.spreadsheets.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenant_users.id", ondelete="CASCADE"), nullable=False)
    permission = Column(String(20), nullable=False, default='view')  # view, comment, edit

    created_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    spreadsheet = relationship("Spreadsheet", back_populates="shares")


# =============================================
# Bheem Slides Models
# =============================================

class Presentation(Base):
    """Presentation - similar to Google Slides"""
    __tablename__ = "presentations"
    __table_args__ = (
        Index('idx_presentations_tenant', 'tenant_id'),
        Index('idx_presentations_owner', 'created_by'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenants.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)  
    description = Column(Text)
    folder_id = Column(UUID(as_uuid=True))

    # Theme settings
    theme = Column(JSONB, default={
        "font_heading": "Arial",
        "font_body": "Arial",  
        "color_primary": "#1a73e8",
        "color_secondary": "#34a853",
        "color_background": "#ffffff"
    })

    # Status
    is_starred = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime)

    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("workspace.tenant_users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    slides = relationship("Slide", back_populates="presentation", cascade="all, delete-orphan", order_by="Slide.slide_index")
    shares = relationship("PresentationShare", back_populates="presentation", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Presentation(id={self.id}, title={self.title})>"


class Slide(Base):
    """Individual slide within a presentation"""
    __tablename__ = "slides"
    __table_args__ = (
        Index('idx_slides_presentation', 'presentation_id'),
        Index('idx_slides_index', 'presentation_id', 'slide_index'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    presentation_id = Column(UUID(as_uuid=True), ForeignKey("workspace.presentations.id", ondelete="CASCADE"), nullable=False)
    slide_index = Column(Integer, nullable=False, default=0)

    # Layout: title, title_content, two_column, section, blank, etc.
    layout = Column(String(50), default='blank')

    # Slide content: elements like text boxes, images, shapes
    # Format: {"elements": [...], "title": "...", "subtitle": "...", "body": "..."}
    content = Column(JSONB, default={})

    # Speaker notes
    speaker_notes = Column(Text)

    # Transition and background settings
    transition = Column(JSONB)
    background = Column(JSONB)

    # Status
    is_hidden = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    presentation = relationship("Presentation", back_populates="slides")

    def __repr__(self):
        return f"<Slide(id={self.id}, index={self.slide_index})>"


class PresentationShare(Base):
    """Sharing permissions for presentations"""
    __tablename__ = "presentation_shares"
    __table_args__ = (
        Index('idx_presentation_shares_user', 'user_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    presentation_id = Column(UUID(as_uuid=True), ForeignKey("workspace.presentations.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenant_users.id", ondelete="CASCADE"), nullable=False)
    permission = Column(String(20), nullable=False, default='view')

    created_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    presentation = relationship("Presentation", back_populates="shares")


# =============================================
# Bheem Forms Models
# =============================================

class Form(Base):
    """Form - similar to Google Forms"""
    __tablename__ = "forms"
    __table_args__ = (
        Index('idx_forms_tenant', 'tenant_id'),
        Index('idx_forms_owner', 'created_by'),
        Index('idx_forms_status', 'status'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenants.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    folder_id = Column(UUID(as_uuid=True))

    # Form settings
    settings = Column(JSONB, default={
        "collect_email": False,
        "limit_responses": False,
        "response_limit": None,
        "allow_edit_response": True,
        "show_progress_bar": True,
        "shuffle_questions": False,
        "confirmation_message": "Your response has been recorded.",
        "require_login": False,
        "one_response_per_user": False
    })

    # Theme settings
    theme = Column(JSONB, default={
        "color_primary": "#1a73e8",
        "color_background": "#f8f9fa",
        "font_family": "Roboto",
        "header_image": None
    })

    # Status
    status = Column(String(20), default='draft')  # draft, published, closed
    is_starred = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime)

    # Publishing
    published_at = Column(DateTime)
    closes_at = Column(DateTime)

    # Stats
    response_count = Column(Integer, default=0)

    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("workspace.tenant_users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    questions = relationship("FormQuestion", back_populates="form", cascade="all, delete-orphan", order_by="FormQuestion.question_index")
    responses = relationship("FormResponse", back_populates="form", cascade="all, delete-orphan")
    shares = relationship("FormShare", back_populates="form", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Form(id={self.id}, title={self.title}, status={self.status})>"


class FormQuestion(Base):
    """Question within a form"""
    __tablename__ = "form_questions"
    __table_args__ = (
        Index('idx_form_questions_form', 'form_id'),
        Index('idx_form_questions_index', 'form_id', 'question_index'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    form_id = Column(UUID(as_uuid=True), ForeignKey("workspace.forms.id", ondelete="CASCADE"), nullable=False)
    question_index = Column(Integer, nullable=False, default=0)

    # Question type
    question_type = Column(String(50), nullable=False)  # short_text, long_text, multiple_choice, etc.

    # Content
    title = Column(Text, nullable=False)
    description = Column(Text)

    # Settings
    is_required = Column(Boolean, default=False)

    # Options for choice-based questions
    # Format: [{"id": "...", "text": "Option 1", "is_other": false}, ...]
    options = Column(JSONB)

    # Validation rules
    # Format: {"min_length": 10, "max_length": 500, "pattern": "...", "error_message": "..."}
    validation = Column(JSONB)

    # Question-specific settings
    settings = Column(JSONB, default={})

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    form = relationship("Form", back_populates="questions")

    def __repr__(self):
        return f"<FormQuestion(id={self.id}, title={self.title[:30]}...)>"


class FormResponse(Base):
    """Response/submission to a form"""
    __tablename__ = "form_responses"
    __table_args__ = (
        Index('idx_form_responses_form', 'form_id'),
        Index('idx_form_responses_email', 'respondent_email'),
        Index('idx_form_responses_submitted', 'submitted_at'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    form_id = Column(UUID(as_uuid=True), ForeignKey("workspace.forms.id", ondelete="CASCADE"), nullable=False)

    # Respondent info
    respondent_email = Column(String(255))
    respondent_user_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenant_users.id"))

    # Answers: {"question_id": answer_value, ...}
    answers = Column(JSONB, nullable=False, default={})

    # Metadata
    ip_address = Column(INET)
    user_agent = Column(Text)

    # Timestamps
    submitted_at = Column(DateTime, default=datetime.utcnow)
    edited_at = Column(DateTime)

    # Relationships
    form = relationship("Form", back_populates="responses")

    def __repr__(self):
        return f"<FormResponse(id={self.id}, form_id={self.form_id})>"


class FormShare(Base):
    """Sharing/collaboration permissions for forms"""
    __tablename__ = "form_shares"
    __table_args__ = (
        Index('idx_form_shares_user', 'user_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    form_id = Column(UUID(as_uuid=True), ForeignKey("workspace.forms.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenant_users.id", ondelete="CASCADE"), nullable=False)
    permission = Column(String(20), nullable=False, default='view')  # view, edit, view_responses

    created_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    form = relationship("Form", back_populates="shares")


# =============================================
# Bheem Videos Models
# =============================================

class VideoStatus(str, enum.Enum):
    UPLOADING = "uploading"
    PROCESSING = "processing"
    READY = "ready"
    ERROR = "error"


class Video(Base):
    """Video - for storing and managing video content"""
    __tablename__ = "videos"
    __table_args__ = (
        Index('idx_videos_tenant', 'tenant_id'),
        Index('idx_videos_owner', 'created_by'),
        Index('idx_videos_status', 'status'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenants.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    folder_id = Column(UUID(as_uuid=True))

    # Video file info
    file_path = Column(Text)  # Storage path
    file_size = Column(Integer)  # Size in bytes
    duration = Column(Integer)  # Duration in seconds
    format = Column(String(50))  # mp4, webm, etc.
    resolution = Column(String(20))  # 1920x1080, etc.

    # Thumbnails
    thumbnail_url = Column(Text)

    # Processing status
    status = Column(String(20), default='uploading')  # uploading, processing, ready, error
    processing_progress = Column(Integer, default=0)  # 0-100
    error_message = Column(Text)

    # Playback settings
    settings = Column(JSONB, default={
        "autoplay": False,
        "loop": False,
        "muted": False,
        "allow_download": True,
        "privacy": "private"  # private, unlisted, public
    })

    # Status
    is_starred = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime)

    # Stats
    view_count = Column(Integer, default=0)

    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("workspace.tenant_users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    shares = relationship("VideoShare", back_populates="video", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Video(id={self.id}, title={self.title}, status={self.status})>"


class VideoShare(Base):
    """Sharing permissions for videos"""
    __tablename__ = "video_shares"
    __table_args__ = (
        Index('idx_video_shares_user', 'user_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    video_id = Column(UUID(as_uuid=True), ForeignKey("workspace.videos.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenant_users.id", ondelete="CASCADE"), nullable=False)
    permission = Column(String(20), nullable=False, default='view')  # view, edit

    created_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    video = relationship("Video", back_populates="shares")


# =============================================
# Content Folders (shared across apps)
# =============================================

class ContentFolder(Base):
    """Folders for organizing productivity content"""
    __tablename__ = "content_folders"
    __table_args__ = (
        Index('idx_content_folders_tenant', 'tenant_id'),
        Index('idx_content_folders_parent', 'parent_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenants.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("workspace.content_folders.id", ondelete="CASCADE"))
    color = Column(String(20))
    content_type = Column(String(50), nullable=False)  # spreadsheets, presentations, forms, mixed

    created_by = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Self-referential relationship for parent/children
    children = relationship("ContentFolder", backref="parent", remote_side=[id])


# =============================================
# Templates
# =============================================

class ProductivityTemplate(Base):
    """Templates for spreadsheets, presentations, forms"""
    __tablename__ = "productivity_templates"
    __table_args__ = (
        Index('idx_productivity_templates_type', 'template_type'),
        Index('idx_productivity_templates_tenant', 'tenant_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenants.id", ondelete="CASCADE"))  # NULL = system template
    template_type = Column(String(50), nullable=False)  # spreadsheet, presentation, form
    name = Column(String(255), nullable=False)
    description = Column(Text)
    thumbnail_url = Column(Text)

    # Template content
    content = Column(JSONB, nullable=False)

    # Categorization
    category = Column(String(100))
    is_public = Column(Boolean, default=False)  # Available to all tenants

    # Stats
    use_count = Column(Integer, default=0)

    # Metadata
    created_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
