"""add_meet_models

Create AI enhancement tables for Bheem Meet feature.
Note: Core meet tables already exist from previous migrations.

Tables created:
- workspace.meeting_whiteboards
- workspace.meeting_summaries
- workspace.meeting_action_items
- workspace.meeting_highlights

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-01-29 00:02:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ===== AI Enhancement Tables (only missing tables) =====

    # Create meeting_whiteboards table
    op.create_table(
        'meeting_whiteboards',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('meeting_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), default='Whiteboard'),
        sa.Column('pages', postgresql.JSONB, default=[{}]),
        sa.Column('background_color', sa.String(20), default='#ffffff'),
        sa.Column('grid_enabled', sa.Boolean, default=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime, default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, default=sa.func.now(), onupdate=sa.func.now()),
        schema='workspace'
    )
    op.create_index('idx_meeting_whiteboards_meeting', 'meeting_whiteboards', ['meeting_id'], schema='workspace')

    # Create meeting_summaries table
    op.create_table(
        'meeting_summaries',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('meeting_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(500)),
        sa.Column('summary', sa.Text),
        sa.Column('key_points', postgresql.JSONB, default=[]),
        sa.Column('decisions', postgresql.JSONB, default=[]),
        sa.Column('topics', postgresql.JSONB, default=[]),
        sa.Column('overall_sentiment', sa.String(20)),
        sa.Column('engagement_score', sa.Integer),
        sa.Column('source_type', sa.String(20), default='transcript'),
        sa.Column('transcript_id', postgresql.UUID(as_uuid=True)),
        sa.Column('recording_id', postgresql.UUID(as_uuid=True)),
        sa.Column('status', sa.String(20), default='pending'),
        sa.Column('error_message', sa.Text),
        sa.Column('ai_model', sa.String(50)),
        sa.Column('is_shared', sa.Boolean, default=False),
        sa.Column('shared_with', postgresql.JSONB, default=[]),
        sa.Column('meeting_date', sa.DateTime),
        sa.Column('created_at', sa.DateTime, default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, default=sa.func.now(), onupdate=sa.func.now()),
        schema='workspace'
    )
    op.create_index('idx_meeting_summaries_meeting', 'meeting_summaries', ['meeting_id'], schema='workspace')
    op.create_index('idx_meeting_summaries_created', 'meeting_summaries', ['created_at'], schema='workspace')

    # Create meeting_action_items table
    op.create_table(
        'meeting_action_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('summary_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('workspace.meeting_summaries.id', ondelete='CASCADE'), nullable=False),
        sa.Column('meeting_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('priority', sa.String(20), default='medium'),
        sa.Column('assignee_id', postgresql.UUID(as_uuid=True)),
        sa.Column('assignee_name', sa.String(255)),
        sa.Column('assignee_email', sa.String(320)),
        sa.Column('due_date', sa.DateTime),
        sa.Column('is_due_date_ai_suggested', sa.Boolean, default=False),
        sa.Column('status', sa.String(20), default='open'),
        sa.Column('completed_at', sa.DateTime),
        sa.Column('context', sa.Text),
        sa.Column('timestamp_start', sa.Integer),
        sa.Column('timestamp_end', sa.Integer),
        sa.Column('linked_task_id', postgresql.UUID(as_uuid=True)),
        sa.Column('linked_calendar_event_id', sa.String(255)),
        sa.Column('confidence_score', sa.Integer),
        sa.Column('created_at', sa.DateTime, default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, default=sa.func.now(), onupdate=sa.func.now()),
        schema='workspace'
    )
    op.create_index('idx_meeting_action_items_summary', 'meeting_action_items', ['summary_id'], schema='workspace')
    op.create_index('idx_meeting_action_items_assignee', 'meeting_action_items', ['assignee_id'], schema='workspace')
    op.create_index('idx_meeting_action_items_status', 'meeting_action_items', ['status'], schema='workspace')
    op.create_index('idx_meeting_action_items_due', 'meeting_action_items', ['due_date'], schema='workspace')

    # Create meeting_highlights table
    op.create_table(
        'meeting_highlights',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('meeting_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('summary_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('workspace.meeting_summaries.id', ondelete='CASCADE')),
        sa.Column('highlight_type', sa.String(30), nullable=False),
        sa.Column('title', sa.String(500)),
        sa.Column('content', sa.Text, nullable=False),
        sa.Column('timestamp_seconds', sa.Integer),
        sa.Column('participants', postgresql.JSONB, default=[]),
        sa.Column('is_ai_generated', sa.Boolean, default=True),
        sa.Column('confidence_score', sa.Integer),
        sa.Column('is_bookmarked', sa.Boolean, default=False),
        sa.Column('bookmarked_by', postgresql.JSONB, default=[]),
        sa.Column('created_at', sa.DateTime, default=sa.func.now()),
        schema='workspace'
    )
    op.create_index('idx_meeting_highlights_meeting', 'meeting_highlights', ['meeting_id'], schema='workspace')
    op.create_index('idx_meeting_highlights_type', 'meeting_highlights', ['highlight_type'], schema='workspace')


def downgrade() -> None:
    op.drop_table('meeting_highlights', schema='workspace')
    op.drop_table('meeting_action_items', schema='workspace')
    op.drop_table('meeting_summaries', schema='workspace')
    op.drop_table('meeting_whiteboards', schema='workspace')
