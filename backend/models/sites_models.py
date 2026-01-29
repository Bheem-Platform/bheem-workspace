"""
Bheem Sites - Database Models

Internal wiki and sites platform similar to Google Sites.
Phase 5: Bheem Sites/Wiki
"""

from sqlalchemy import (
    Column, String, Text, Boolean, Integer, DateTime, ForeignKey,
    JSON, Index, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from core.database import Base

# Schema for all sites tables
SCHEMA = "workspace"


# Site visibility options (stored as string in DB)
class SiteVisibility:
    PRIVATE = "private"  # Only owner and collaborators
    INTERNAL = "internal"  # Anyone in the workspace
    PUBLIC = "public"  # Anyone with the link

    @classmethod
    def values(cls):
        return [cls.PRIVATE, cls.INTERNAL, cls.PUBLIC]


# Page content types (stored as string in DB)
class PageType:
    STANDARD = "standard"  # Rich text page
    WIKI = "wiki"  # Wiki-style with sidebar
    BLOG = "blog"  # Blog post format
    LANDING = "landing"  # Landing page with sections
    EMBED = "embed"  # Embedded content (iframe)

    @classmethod
    def values(cls):
        return [cls.STANDARD, cls.WIKI, cls.BLOG, cls.LANDING, cls.EMBED]


class Site(Base):
    """
    Bheem Site - A collection of pages forming a website/wiki.
    """
    __tablename__ = "sites"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    # Basic info
    name = Column(String(255), nullable=False)
    slug = Column(String(100), nullable=False)  # URL-friendly name
    description = Column(Text)

    # Branding
    logo_url = Column(String(500))
    favicon_url = Column(String(500))
    theme_color = Column(String(20), default="#2563eb")
    custom_css = Column(Text)

    # Settings
    visibility = Column(String(20), default=SiteVisibility.INTERNAL)
    allow_comments = Column(Boolean, default=True)
    allow_search = Column(Boolean, default=True)
    show_navigation = Column(Boolean, default=True)
    show_breadcrumbs = Column(Boolean, default=True)

    # Navigation structure (JSON)
    navigation = Column(JSON, default=list)  # [{title, page_id, children: [...]}]

    # Owner and timestamps
    owner_id = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    published_at = Column(DateTime)
    is_published = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)

    # Analytics
    view_count = Column(Integer, default=0)

    # Relationships
    pages = relationship("SitePage", back_populates="site", cascade="all, delete-orphan")
    collaborators = relationship("SiteCollaborator", back_populates="site", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint('tenant_id', 'slug', name='uq_site_tenant_slug'),
        Index('ix_sites_tenant_owner', 'tenant_id', 'owner_id'),
        Index('ix_sites_visibility', 'visibility'),
        {"schema": SCHEMA}
    )


class SitePage(Base):
    """
    Individual page within a site.
    """
    __tablename__ = "site_pages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    site_id = Column(UUID(as_uuid=True), ForeignKey(f"{SCHEMA}.sites.id", ondelete="CASCADE"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    # Page info
    title = Column(String(255), nullable=False)
    slug = Column(String(100), nullable=False)  # URL path segment
    page_type = Column(String(20), default=PageType.STANDARD)

    # Content
    content = Column(Text)  # HTML or Markdown
    content_format = Column(String(20), default="html")  # html, markdown
    excerpt = Column(String(500))  # Auto-generated or manual

    # Cover/header
    cover_image_url = Column(String(500))
    cover_position = Column(String(20), default="center")  # top, center, bottom

    # Hierarchy
    parent_id = Column(UUID(as_uuid=True), ForeignKey(f"{SCHEMA}.site_pages.id", ondelete="SET NULL"))
    order = Column(Integer, default=0)
    path = Column(String(1000))  # Full path like /parent/child/page
    depth = Column(Integer, default=0)

    # Settings
    is_homepage = Column(Boolean, default=False)
    show_title = Column(Boolean, default=True)
    show_toc = Column(Boolean, default=True)  # Table of contents
    allow_comments = Column(Boolean, default=True)
    is_draft = Column(Boolean, default=True)

    # SEO
    meta_title = Column(String(100))
    meta_description = Column(String(300))
    meta_keywords = Column(ARRAY(String))

    # Timestamps
    author_id = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    published_at = Column(DateTime)

    # Analytics
    view_count = Column(Integer, default=0)

    # Relationships
    site = relationship("Site", back_populates="pages")
    children = relationship("SitePage", backref="parent", remote_side=[id])
    versions = relationship("SitePageVersion", back_populates="page", cascade="all, delete-orphan")
    comments = relationship("SiteComment", back_populates="page", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint('site_id', 'slug', name='uq_page_site_slug'),
        Index('ix_site_pages_site', 'site_id'),
        Index('ix_site_pages_parent', 'parent_id'),
        Index('ix_site_pages_path', 'path'),
        {"schema": SCHEMA}
    )


class SitePageVersion(Base):
    """
    Version history for pages.
    """
    __tablename__ = "site_page_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    page_id = Column(UUID(as_uuid=True), ForeignKey(f"{SCHEMA}.site_pages.id", ondelete="CASCADE"), nullable=False)

    # Version info
    version_number = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(Text)

    # Metadata
    author_id = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    change_summary = Column(String(500))

    # Relationships
    page = relationship("SitePage", back_populates="versions")

    __table_args__ = (
        UniqueConstraint('page_id', 'version_number', name='uq_page_version'),
        Index('ix_page_versions_page', 'page_id'),
        {"schema": SCHEMA}
    )


class SiteCollaborator(Base):
    """
    Site collaborators with permissions.
    """
    __tablename__ = "site_collaborators"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    site_id = Column(UUID(as_uuid=True), ForeignKey(f"{SCHEMA}.sites.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False)

    # Permission level
    role = Column(String(20), default="viewer")  # owner, editor, viewer
    can_publish = Column(Boolean, default=False)
    can_manage_collaborators = Column(Boolean, default=False)

    # Timestamps
    added_at = Column(DateTime, default=datetime.utcnow)
    added_by = Column(UUID(as_uuid=True))

    # Relationships
    site = relationship("Site", back_populates="collaborators")

    __table_args__ = (
        UniqueConstraint('site_id', 'user_id', name='uq_site_collaborator'),
        Index('ix_site_collaborators_user', 'user_id'),
        {"schema": SCHEMA}
    )


class SiteComment(Base):
    """
    Comments on site pages.
    """
    __tablename__ = "site_comments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    page_id = Column(UUID(as_uuid=True), ForeignKey(f"{SCHEMA}.site_pages.id", ondelete="CASCADE"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)

    # Comment content
    content = Column(Text, nullable=False)
    author_id = Column(UUID(as_uuid=True), nullable=False)
    author_name = Column(String(255))  # Cached for display

    # Threading
    parent_id = Column(UUID(as_uuid=True), ForeignKey(f"{SCHEMA}.site_comments.id", ondelete="CASCADE"))

    # Status
    is_resolved = Column(Boolean, default=False)
    is_pinned = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    page = relationship("SitePage", back_populates="comments")
    replies = relationship("SiteComment", backref="parent", remote_side=[id])

    __table_args__ = (
        Index('ix_site_comments_page', 'page_id'),
        Index('ix_site_comments_author', 'author_id'),
        {"schema": SCHEMA}
    )


class SiteTemplate(Base):
    """
    Reusable site templates.
    """
    __tablename__ = "site_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), index=True)  # NULL for system templates

    # Template info
    name = Column(String(255), nullable=False)
    description = Column(Text)
    category = Column(String(50))  # wiki, documentation, team, project, etc.
    preview_image_url = Column(String(500))

    # Template data
    structure = Column(JSON)  # Page structure template
    default_content = Column(JSON)  # Default page contents
    theme_settings = Column(JSON)  # Default theme/branding

    # Flags
    is_system = Column(Boolean, default=False)  # Built-in template
    is_public = Column(Boolean, default=False)  # Available to all tenants

    # Timestamps
    created_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index('ix_site_templates_category', 'category'),
        {"schema": SCHEMA}
    )


class SiteMedia(Base):
    """
    Media files uploaded to sites.
    """
    __tablename__ = "site_media"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    site_id = Column(UUID(as_uuid=True), ForeignKey(f"{SCHEMA}.sites.id", ondelete="CASCADE"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)

    # File info
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255))
    mime_type = Column(String(100))
    size = Column(Integer)  # bytes

    # Storage
    storage_path = Column(String(500), nullable=False)
    url = Column(String(500))
    thumbnail_url = Column(String(500))

    # Metadata
    alt_text = Column(String(255))
    caption = Column(Text)

    # Upload info
    uploaded_by = Column(UUID(as_uuid=True), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index('ix_site_media_site', 'site_id'),
        {"schema": SCHEMA}
    )
