"""add_sites_models

Create tables for Bheem Sites/Wiki feature in workspace schema.

Tables:
- workspace.sites
- workspace.site_pages
- workspace.site_page_versions
- workspace.site_collaborators
- workspace.site_comments
- workspace.site_templates
- workspace.site_media

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-01-29 00:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SCHEMA = 'workspace'


def upgrade() -> None:
    # ===== Sites =====
    op.create_table(
        'sites',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('slug', sa.String(100), nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('logo_url', sa.String(500)),
        sa.Column('favicon_url', sa.String(500)),
        sa.Column('theme_color', sa.String(20), default='#2563eb'),
        sa.Column('custom_css', sa.Text),
        sa.Column('visibility', sa.String(20), default='internal'),
        sa.Column('allow_comments', sa.Boolean, default=True),
        sa.Column('allow_search', sa.Boolean, default=True),
        sa.Column('show_navigation', sa.Boolean, default=True),
        sa.Column('show_breadcrumbs', sa.Boolean, default=True),
        sa.Column('navigation', postgresql.JSON, default=[]),
        sa.Column('owner_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime, default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('published_at', sa.DateTime),
        sa.Column('is_published', sa.Boolean, default=False),
        sa.Column('is_archived', sa.Boolean, default=False),
        sa.Column('view_count', sa.Integer, default=0),
        schema=SCHEMA
    )
    op.create_index('ix_sites_tenant_id', 'sites', ['tenant_id'], schema=SCHEMA)
    op.create_index('ix_sites_tenant_owner', 'sites', ['tenant_id', 'owner_id'], schema=SCHEMA)
    op.create_index('ix_sites_visibility', 'sites', ['visibility'], schema=SCHEMA)
    op.create_unique_constraint('uq_site_tenant_slug', 'sites', ['tenant_id', 'slug'], schema=SCHEMA)

    # ===== Site Pages =====
    op.create_table(
        'site_pages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('site_id', postgresql.UUID(as_uuid=True), sa.ForeignKey(f'{SCHEMA}.sites.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('slug', sa.String(100), nullable=False),
        sa.Column('page_type', sa.String(20), default='standard'),
        sa.Column('content', sa.Text),
        sa.Column('content_format', sa.String(20), default='html'),
        sa.Column('excerpt', sa.String(500)),
        sa.Column('cover_image_url', sa.String(500)),
        sa.Column('cover_position', sa.String(20), default='center'),
        sa.Column('parent_id', postgresql.UUID(as_uuid=True), sa.ForeignKey(f'{SCHEMA}.site_pages.id', ondelete='SET NULL')),
        sa.Column('order', sa.Integer, default=0),
        sa.Column('path', sa.String(1000)),
        sa.Column('depth', sa.Integer, default=0),
        sa.Column('is_homepage', sa.Boolean, default=False),
        sa.Column('show_title', sa.Boolean, default=True),
        sa.Column('show_toc', sa.Boolean, default=True),
        sa.Column('allow_comments', sa.Boolean, default=True),
        sa.Column('is_draft', sa.Boolean, default=True),
        sa.Column('meta_title', sa.String(100)),
        sa.Column('meta_description', sa.String(300)),
        sa.Column('meta_keywords', postgresql.ARRAY(sa.String)),
        sa.Column('author_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime, default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('published_at', sa.DateTime),
        sa.Column('view_count', sa.Integer, default=0),
        schema=SCHEMA
    )
    op.create_index('ix_site_pages_site', 'site_pages', ['site_id'], schema=SCHEMA)
    op.create_index('ix_site_pages_tenant', 'site_pages', ['tenant_id'], schema=SCHEMA)
    op.create_index('ix_site_pages_parent', 'site_pages', ['parent_id'], schema=SCHEMA)
    op.create_index('ix_site_pages_path', 'site_pages', ['path'], schema=SCHEMA)
    op.create_unique_constraint('uq_page_site_slug', 'site_pages', ['site_id', 'slug'], schema=SCHEMA)

    # ===== Site Page Versions =====
    op.create_table(
        'site_page_versions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('page_id', postgresql.UUID(as_uuid=True), sa.ForeignKey(f'{SCHEMA}.site_pages.id', ondelete='CASCADE'), nullable=False),
        sa.Column('version_number', sa.Integer, nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('content', sa.Text),
        sa.Column('author_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime, default=sa.func.now()),
        sa.Column('change_summary', sa.String(500)),
        schema=SCHEMA
    )
    op.create_index('ix_page_versions_page', 'site_page_versions', ['page_id'], schema=SCHEMA)
    op.create_unique_constraint('uq_page_version', 'site_page_versions', ['page_id', 'version_number'], schema=SCHEMA)

    # ===== Site Collaborators =====
    op.create_table(
        'site_collaborators',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('site_id', postgresql.UUID(as_uuid=True), sa.ForeignKey(f'{SCHEMA}.sites.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('role', sa.String(20), default='viewer'),
        sa.Column('can_publish', sa.Boolean, default=False),
        sa.Column('can_manage_collaborators', sa.Boolean, default=False),
        sa.Column('added_at', sa.DateTime, default=sa.func.now()),
        sa.Column('added_by', postgresql.UUID(as_uuid=True)),
        schema=SCHEMA
    )
    op.create_index('ix_site_collaborators_user', 'site_collaborators', ['user_id'], schema=SCHEMA)
    op.create_unique_constraint('uq_site_collaborator', 'site_collaborators', ['site_id', 'user_id'], schema=SCHEMA)

    # ===== Site Comments =====
    op.create_table(
        'site_comments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('page_id', postgresql.UUID(as_uuid=True), sa.ForeignKey(f'{SCHEMA}.site_pages.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('content', sa.Text, nullable=False),
        sa.Column('author_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('author_name', sa.String(255)),
        sa.Column('parent_id', postgresql.UUID(as_uuid=True), sa.ForeignKey(f'{SCHEMA}.site_comments.id', ondelete='CASCADE')),
        sa.Column('is_resolved', sa.Boolean, default=False),
        sa.Column('is_pinned', sa.Boolean, default=False),
        sa.Column('created_at', sa.DateTime, default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, default=sa.func.now(), onupdate=sa.func.now()),
        schema=SCHEMA
    )
    op.create_index('ix_site_comments_page', 'site_comments', ['page_id'], schema=SCHEMA)
    op.create_index('ix_site_comments_author', 'site_comments', ['author_id'], schema=SCHEMA)

    # ===== Site Templates =====
    op.create_table(
        'site_templates',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True)),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('category', sa.String(50)),
        sa.Column('preview_image_url', sa.String(500)),
        sa.Column('structure', postgresql.JSON),
        sa.Column('default_content', postgresql.JSON),
        sa.Column('theme_settings', postgresql.JSON),
        sa.Column('is_system', sa.Boolean, default=False),
        sa.Column('is_public', sa.Boolean, default=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True)),
        sa.Column('created_at', sa.DateTime, default=sa.func.now()),
        schema=SCHEMA
    )
    op.create_index('ix_site_templates_tenant', 'site_templates', ['tenant_id'], schema=SCHEMA)
    op.create_index('ix_site_templates_category', 'site_templates', ['category'], schema=SCHEMA)

    # ===== Site Media =====
    op.create_table(
        'site_media',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('site_id', postgresql.UUID(as_uuid=True), sa.ForeignKey(f'{SCHEMA}.sites.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('filename', sa.String(255), nullable=False),
        sa.Column('original_filename', sa.String(255)),
        sa.Column('mime_type', sa.String(100)),
        sa.Column('size', sa.Integer),
        sa.Column('storage_path', sa.String(500), nullable=False),
        sa.Column('url', sa.String(500)),
        sa.Column('thumbnail_url', sa.String(500)),
        sa.Column('alt_text', sa.String(255)),
        sa.Column('caption', sa.Text),
        sa.Column('uploaded_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('uploaded_at', sa.DateTime, default=sa.func.now()),
        schema=SCHEMA
    )
    op.create_index('ix_site_media_site', 'site_media', ['site_id'], schema=SCHEMA)


def downgrade() -> None:
    op.drop_table('site_media', schema=SCHEMA)
    op.drop_table('site_templates', schema=SCHEMA)
    op.drop_table('site_comments', schema=SCHEMA)
    op.drop_table('site_collaborators', schema=SCHEMA)
    op.drop_table('site_page_versions', schema=SCHEMA)
    op.drop_table('site_pages', schema=SCHEMA)
    op.drop_table('sites', schema=SCHEMA)
