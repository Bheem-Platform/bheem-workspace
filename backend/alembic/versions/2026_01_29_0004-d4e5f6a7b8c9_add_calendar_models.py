"""add_calendar_models

Create missing Calendar enhancement tables in workspace schema.
Note: Most calendar tables already exist from previous migrations.

Tables created:
- workspace.user_calendar_settings
- workspace.focus_time_blocks
- workspace.calendar_time_insights

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-01-29 00:04:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SCHEMA = 'workspace'


def upgrade() -> None:
    # ===== User Calendar Settings =====
    op.create_table(
        'user_calendar_settings',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column('default_reminders', postgresql.JSONB, default=[]),
        sa.Column('email_notifications', sa.Boolean, default=True),
        sa.Column('browser_notifications', sa.Boolean, default=True),
        sa.Column('sms_notifications', sa.Boolean, default=False),
        sa.Column('timezone', sa.String(100), default='UTC'),
        sa.Column('secondary_timezone', sa.String(100)),
        sa.Column('show_secondary_timezone', sa.Boolean, default=False),
        sa.Column('world_clock_timezones', postgresql.JSONB, default=[]),
        sa.Column('working_hours_start', sa.String(5), default='09:00'),
        sa.Column('working_hours_end', sa.String(5), default='17:00'),
        sa.Column('working_days', postgresql.JSONB, default=['MO', 'TU', 'WE', 'TH', 'FR']),
        sa.Column('focus_time_enabled', sa.Boolean, default=False),
        sa.Column('focus_time_duration', sa.Integer, default=120),
        sa.Column('focus_time_days', postgresql.JSONB, default=['MO', 'TU', 'WE', 'TH', 'FR']),
        sa.Column('focus_time_start', sa.String(5), default='09:00'),
        sa.Column('focus_time_end', sa.String(5), default='11:00'),
        sa.Column('focus_time_auto_decline', sa.Boolean, default=False),
        sa.Column('show_time_insights', sa.Boolean, default=True),
        sa.Column('insights_goal_meeting_hours', sa.Integer, default=20),
        sa.Column('insights_goal_focus_hours', sa.Integer, default=10),
        sa.Column('created_at', sa.DateTime(timezone=True), default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), default=sa.func.now(), onupdate=sa.func.now()),
        schema=SCHEMA
    )

    # ===== Focus Time Blocks =====
    op.create_table(
        'focus_time_blocks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(255), default='Focus Time'),
        sa.Column('start_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('status', sa.String(20), default='scheduled'),
        sa.Column('auto_decline_meetings', sa.Boolean, default=False),
        sa.Column('show_as_busy', sa.Boolean, default=True),
        sa.Column('calendar_event_id', sa.String(255)),
        sa.Column('is_recurring', sa.Boolean, default=False),
        sa.Column('recurrence_rule', sa.String(500)),
        sa.Column('was_interrupted', sa.Boolean, default=False),
        sa.Column('actual_focus_minutes', sa.Integer),
        sa.Column('created_at', sa.DateTime(timezone=True), default=sa.func.now()),
        sa.Column('completed_at', sa.DateTime(timezone=True)),
        schema=SCHEMA
    )
    op.create_index('idx_focus_time_user', 'focus_time_blocks', ['user_id'], schema=SCHEMA)
    op.create_index('idx_focus_time_start', 'focus_time_blocks', ['start_time'], schema=SCHEMA)
    op.create_index('idx_focus_time_status', 'focus_time_blocks', ['status'], schema=SCHEMA)

    # ===== Calendar Time Insights =====
    op.create_table(
        'calendar_time_insights',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('week_start', sa.DateTime(timezone=True), nullable=False),
        sa.Column('week_end', sa.DateTime(timezone=True), nullable=False),
        sa.Column('total_meeting_hours', sa.Integer, default=0),
        sa.Column('meeting_count', sa.Integer, default=0),
        sa.Column('avg_meeting_duration', sa.Integer, default=0),
        sa.Column('longest_meeting', sa.Integer, default=0),
        sa.Column('one_on_one_hours', sa.Integer, default=0),
        sa.Column('team_meeting_hours', sa.Integer, default=0),
        sa.Column('external_meeting_hours', sa.Integer, default=0),
        sa.Column('recurring_meeting_hours', sa.Integer, default=0),
        sa.Column('total_focus_hours', sa.Integer, default=0),
        sa.Column('focus_blocks_count', sa.Integer, default=0),
        sa.Column('focus_blocks_completed', sa.Integer, default=0),
        sa.Column('focus_time_interrupted', sa.Integer, default=0),
        sa.Column('fragmented_time_hours', sa.Integer, default=0),
        sa.Column('largest_free_block', sa.Integer, default=0),
        sa.Column('meetings_outside_hours', sa.Integer, default=0),
        sa.Column('busiest_day', sa.String(10)),
        sa.Column('meeting_hours_by_day', postgresql.JSONB, default={}),
        sa.Column('meeting_hours_change', sa.Integer, default=0),
        sa.Column('focus_hours_change', sa.Integer, default=0),
        sa.Column('created_at', sa.DateTime(timezone=True), default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), default=sa.func.now(), onupdate=sa.func.now()),
        schema=SCHEMA
    )
    op.create_index('idx_time_insights_user', 'calendar_time_insights', ['user_id'], schema=SCHEMA)
    op.create_index('idx_time_insights_week', 'calendar_time_insights', ['week_start'], schema=SCHEMA)


def downgrade() -> None:
    op.drop_table('calendar_time_insights', schema=SCHEMA)
    op.drop_table('focus_time_blocks', schema=SCHEMA)
    op.drop_table('user_calendar_settings', schema=SCHEMA)
