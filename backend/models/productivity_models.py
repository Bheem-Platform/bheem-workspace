"""
Bheem Workspace - Productivity Suite Database Models
Sheets, Slides, Forms, and related entities
"""
from sqlalchemy import Column, String, Boolean, Integer, BigInteger, Text, DateTime, ForeignKey, Index, Enum as SQLEnum
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
        Index('idx_spreadsheets_storage_path', 'storage_path'),
        Index('idx_spreadsheets_storage_mode', 'storage_mode'),
        Index('idx_spreadsheets_linked_entity', 'linked_entity_type', 'linked_entity_id'),
        Index('idx_spreadsheets_document_key', 'document_key'),
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

    # Storage fields (OnlyOffice integration)
    storage_path = Column(String(500))  # S3 path to XLSX file
    storage_bucket = Column(String(100))
    file_size = Column(BigInteger, default=0)
    checksum = Column(String(64))
    nextcloud_path = Column(String(500))
    version = Column(Integer, default=1)
    document_key = Column(String(100))  # OnlyOffice document key for collaboration

    # Mode: 'internal' (ERP) or 'external' (SaaS)
    storage_mode = Column(String(20), default='external')

    # ERP entity linking for internal mode
    linked_entity_type = Column(String(50))  # SALES_INVOICE, PURCHASE_ORDER, etc.
    linked_entity_id = Column(UUID(as_uuid=True))

    # Edit tracking
    last_edited_by = Column(UUID(as_uuid=True), ForeignKey("workspace.tenant_users.id"))
    last_edited_at = Column(DateTime)

    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("workspace.tenant_users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    worksheets = relationship("Worksheet", back_populates="spreadsheet", cascade="all, delete-orphan")
    shares = relationship("SpreadsheetShare", back_populates="spreadsheet", cascade="all, delete-orphan")
    versions = relationship("SpreadsheetVersion", back_populates="spreadsheet", cascade="all, delete-orphan")
    edit_sessions = relationship("SpreadsheetEditSession", back_populates="spreadsheet", cascade="all, delete-orphan")

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


class SpreadsheetVersion(Base):
    """Version history for spreadsheets"""
    __tablename__ = "spreadsheet_versions"
    __table_args__ = (
        Index('idx_spreadsheet_versions_spreadsheet', 'spreadsheet_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    spreadsheet_id = Column(UUID(as_uuid=True), ForeignKey("workspace.spreadsheets.id", ondelete="CASCADE"), nullable=False)
    version_number = Column(Integer, nullable=False)
    storage_path = Column(String(500), nullable=False)
    file_size = Column(BigInteger, default=0)
    checksum = Column(String(64))
    created_by = Column(UUID(as_uuid=True), ForeignKey("workspace.tenant_users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    comment = Column(Text)
    is_current = Column(Boolean, default=False)

    # Relationships
    spreadsheet = relationship("Spreadsheet", back_populates="versions")

    def __repr__(self):
        return f"<SpreadsheetVersion(spreadsheet_id={self.spreadsheet_id}, version={self.version_number})>"


class SpreadsheetEditSession(Base):
    """OnlyOffice edit session tracking"""
    __tablename__ = "spreadsheet_edit_sessions"
    __table_args__ = (
        Index('idx_spreadsheet_sessions_spreadsheet', 'spreadsheet_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    spreadsheet_id = Column(UUID(as_uuid=True), ForeignKey("workspace.spreadsheets.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenant_users.id"), nullable=False)
    document_key = Column(String(100), nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow)
    last_activity_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime)
    status = Column(String(20), default='active')  # active, closed, error

    # Relationships
    spreadsheet = relationship("Spreadsheet", back_populates="edit_sessions")

    def __repr__(self):
        return f"<SpreadsheetEditSession(spreadsheet_id={self.spreadsheet_id}, status={self.status})>"


# =============================================
# Bheem Slides Models
# =============================================

class Presentation(Base):
    """Presentation - similar to Google Slides"""
    __tablename__ = "presentations"
    __table_args__ = (
        Index('idx_presentations_tenant', 'tenant_id'),
        Index('idx_presentations_owner', 'created_by'),
        Index('idx_presentations_storage_mode', 'storage_mode'),
        Index('idx_presentations_entity', 'linked_entity_type', 'linked_entity_id'),
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

    # Storage fields (OnlyOffice integration)
    storage_path = Column(Text)  # S3/Nextcloud path to PPTX file
    storage_bucket = Column(String(255))
    file_size = Column(BigInteger)
    checksum = Column(String(64))
    nextcloud_path = Column(Text)
    version = Column(Integer, default=1)
    document_key = Column(String(255))  # OnlyOffice document key for collaboration

    # Mode: 'internal' (ERP) or 'external' (SaaS)
    storage_mode = Column(String(20), default='external')

    # ERP entity linking for internal mode
    linked_entity_type = Column(String(50))
    linked_entity_id = Column(UUID(as_uuid=True))

    # Edit tracking
    last_edited_by = Column(UUID(as_uuid=True))
    last_edited_at = Column(DateTime)

    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("workspace.tenant_users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    slides = relationship("Slide", back_populates="presentation", cascade="all, delete-orphan", order_by="Slide.slide_index")
    shares = relationship("PresentationShare", back_populates="presentation", cascade="all, delete-orphan")
    versions = relationship("PresentationVersion", back_populates="presentation", cascade="all, delete-orphan")
    edit_sessions = relationship("PresentationEditSession", back_populates="presentation", cascade="all, delete-orphan")

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


class PresentationVersion(Base):
    """Version history for presentations"""
    __tablename__ = "presentation_versions"
    __table_args__ = (
        Index('idx_presentation_versions_presentation', 'presentation_id'),
        Index('idx_presentation_versions_number', 'presentation_id', 'version_number'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    presentation_id = Column(UUID(as_uuid=True), ForeignKey("workspace.presentations.id", ondelete="CASCADE"), nullable=False)
    version_number = Column(Integer, nullable=False)
    storage_path = Column(Text, nullable=False)
    file_size = Column(BigInteger)
    checksum = Column(String(64))
    created_by = Column(UUID(as_uuid=True), ForeignKey("workspace.tenant_users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    comment = Column(Text)

    # Relationships
    presentation = relationship("Presentation", back_populates="versions")

    def __repr__(self):
        return f"<PresentationVersion(presentation_id={self.presentation_id}, version={self.version_number})>"


class PresentationEditSession(Base):
    """OnlyOffice edit session tracking for presentations"""
    __tablename__ = "presentation_edit_sessions"
    __table_args__ = (
        Index('idx_presentation_edit_sessions_presentation', 'presentation_id'),
        Index('idx_presentation_edit_sessions_user', 'user_id'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    presentation_id = Column(UUID(as_uuid=True), ForeignKey("workspace.presentations.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenant_users.id", ondelete="CASCADE"), nullable=False)
    session_key = Column(String(255), nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow)
    last_activity = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime)
    is_active = Column(Boolean, default=True)

    # Relationships
    presentation = relationship("Presentation", back_populates="edit_sessions")

    def __repr__(self):
        return f"<PresentationEditSession(presentation_id={self.presentation_id}, active={self.is_active})>"


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


# =============================================
# Drive Items (unified Drive view)
# =============================================

class DriveItem(Base):
    """Drive item - links forms, sheets, slides, etc. to Drive view"""
    __tablename__ = "drive_items"
    __table_args__ = (
        Index('idx_drive_items_tenant', 'tenant_id'),
        Index('idx_drive_items_type', 'item_type'),
        Index('idx_drive_items_linked', 'linked_item_id'),
        Index('idx_drive_items_parent', 'parent_folder_id'),
        Index('idx_drive_items_owner', 'created_by'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenants.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    item_type = Column(String(50), nullable=False)  # form, sheet, slide, video, doc, folder
    linked_item_id = Column(UUID(as_uuid=True))  # Reference to the actual item
    parent_folder_id = Column(UUID(as_uuid=True))  # For folder hierarchy

    # Status
    is_starred = Column(Boolean, default=False)
    is_trashed = Column(Boolean, default=False)
    trashed_at = Column(DateTime)

    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("workspace.tenant_users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<DriveItem(id={self.id}, name={self.name}, type={self.item_type})>"
