"""add_notes_models

Create tables for Bheem Notes feature in workspace schema.

Tables:
- workspace.notes
- workspace.note_labels
- workspace.note_label_associations
- workspace.note_collaborators
- workspace.note_reminders
- workspace.note_attachments
- workspace.note_activity_logs

Revision ID: a1b2c3d4e5f6
Revises: 231eea53d0f6
Create Date: 2026-01-29 00:01:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '231eea53d0f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SCHEMA = 'workspace'


def upgrade() -> None:
    # Create notes table
    op.create_table(
        'notes',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('owner_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(500), nullable=True),
        sa.Column('content', sa.Text, nullable=True),
        sa.Column('content_html', sa.Text, nullable=True),
        sa.Column('color', sa.String(20), default='default'),
        sa.Column('background_image', sa.String(500), nullable=True),
        sa.Column('is_pinned', sa.Boolean, default=False),
        sa.Column('is_archived', sa.Boolean, default=False),
        sa.Column('is_trashed', sa.Boolean, default=False),
        sa.Column('is_checklist', sa.Boolean, default=False),
        sa.Column('checklist_items', postgresql.JSON, nullable=True),
        sa.Column('position', sa.Integer, default=0),
        sa.Column('word_count', sa.Integer, default=0),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('trashed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True),
        schema=SCHEMA
    )
    op.create_index('ix_notes_tenant_id', 'notes', ['tenant_id'], schema=SCHEMA)
    op.create_index('ix_notes_owner_id', 'notes', ['owner_id'], schema=SCHEMA)
    op.create_index('ix_notes_tenant_owner', 'notes', ['tenant_id', 'owner_id'], schema=SCHEMA)
    op.create_index('ix_notes_tenant_pinned', 'notes', ['tenant_id', 'is_pinned'], schema=SCHEMA)
    op.create_index('ix_notes_tenant_archived', 'notes', ['tenant_id', 'is_archived'], schema=SCHEMA)
    op.create_index('ix_notes_tenant_trashed', 'notes', ['tenant_id', 'is_trashed'], schema=SCHEMA)
    op.create_index('ix_notes_updated_at', 'notes', ['updated_at'], schema=SCHEMA)

    # Create note_labels table
    op.create_table(
        'note_labels',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('owner_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('color', sa.String(20), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        schema=SCHEMA
    )
    op.create_index('ix_note_labels_tenant_owner', 'note_labels', ['tenant_id', 'owner_id'], schema=SCHEMA)
    op.create_index('ix_note_labels_name', 'note_labels', ['tenant_id', 'owner_id', 'name'], unique=True, schema=SCHEMA)

    # Create note_label_associations table
    op.create_table(
        'note_label_associations',
        sa.Column('note_id', postgresql.UUID(as_uuid=True), sa.ForeignKey(f'{SCHEMA}.notes.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('label_id', postgresql.UUID(as_uuid=True), sa.ForeignKey(f'{SCHEMA}.note_labels.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        schema=SCHEMA
    )

    # Create note_collaborators table
    op.create_table(
        'note_collaborators',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('note_id', postgresql.UUID(as_uuid=True), sa.ForeignKey(f'{SCHEMA}.notes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_email', sa.String(255), nullable=True),
        sa.Column('user_name', sa.String(255), nullable=True),
        sa.Column('permission', sa.String(20), default='view'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        schema=SCHEMA
    )
    op.create_index('ix_note_collaborators_note', 'note_collaborators', ['note_id'], schema=SCHEMA)
    op.create_index('ix_note_collaborators_user', 'note_collaborators', ['user_id'], schema=SCHEMA)
    op.create_index('ix_note_collaborators_unique', 'note_collaborators', ['note_id', 'user_id'], unique=True, schema=SCHEMA)

    # Create note_reminders table
    op.create_table(
        'note_reminders',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('note_id', postgresql.UUID(as_uuid=True), sa.ForeignKey(f'{SCHEMA}.notes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('reminder_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_sent', sa.Boolean, default=False),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_recurring', sa.Boolean, default=False),
        sa.Column('recurrence_pattern', sa.String(50), nullable=True),
        sa.Column('recurrence_end', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        schema=SCHEMA
    )
    op.create_index('ix_note_reminders_note', 'note_reminders', ['note_id'], schema=SCHEMA)
    op.create_index('ix_note_reminders_time', 'note_reminders', ['reminder_time'], schema=SCHEMA)
    op.create_index('ix_note_reminders_pending', 'note_reminders', ['is_sent', 'reminder_time'], schema=SCHEMA)

    # Create note_attachments table
    op.create_table(
        'note_attachments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('note_id', postgresql.UUID(as_uuid=True), sa.ForeignKey(f'{SCHEMA}.notes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('file_name', sa.String(255), nullable=False),
        sa.Column('file_type', sa.String(100), nullable=True),
        sa.Column('file_size', sa.Integer, nullable=True),
        sa.Column('file_path', sa.String(500), nullable=False),
        sa.Column('thumbnail_path', sa.String(500), nullable=True),
        sa.Column('width', sa.Integer, nullable=True),
        sa.Column('height', sa.Integer, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        schema=SCHEMA
    )
    op.create_index('ix_note_attachments_note', 'note_attachments', ['note_id'], schema=SCHEMA)

    # Create note_activity_logs table
    op.create_table(
        'note_activity_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('note_id', postgresql.UUID(as_uuid=True), sa.ForeignKey(f'{SCHEMA}.notes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_name', sa.String(255), nullable=True),
        sa.Column('action', sa.String(50), nullable=False),
        sa.Column('details', postgresql.JSON, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        schema=SCHEMA
    )
    op.create_index('ix_note_activity_logs_note', 'note_activity_logs', ['note_id'], schema=SCHEMA)
    op.create_index('ix_note_activity_logs_created', 'note_activity_logs', ['created_at'], schema=SCHEMA)


def downgrade() -> None:
    op.drop_table('note_activity_logs', schema=SCHEMA)
    op.drop_table('note_attachments', schema=SCHEMA)
    op.drop_table('note_reminders', schema=SCHEMA)
    op.drop_table('note_collaborators', schema=SCHEMA)
    op.drop_table('note_label_associations', schema=SCHEMA)
    op.drop_table('note_labels', schema=SCHEMA)
    op.drop_table('notes', schema=SCHEMA)
