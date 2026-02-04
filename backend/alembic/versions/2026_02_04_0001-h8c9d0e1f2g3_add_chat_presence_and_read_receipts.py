"""Add chat presence tracking and read receipts settings

Revision ID: h8c9d0e1f2g3
Revises: g7b8c9d0e1f2
Create Date: 2026-02-04

Adds:
- last_seen_at column to chat_participants for tracking user presence
- read_receipts_enabled column to user_settings for privacy control
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'h8c9d0e1f2g3'
down_revision = 'g7b8c9d0e1f2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add last_seen_at to chat_participants for presence tracking
    op.add_column(
        'chat_participants',
        sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=True),
        schema='workspace'
    )

    # Add index for efficient presence queries
    op.create_index(
        'idx_chat_participants_last_seen',
        'chat_participants',
        ['user_id', 'last_seen_at'],
        schema='workspace'
    )

    # Add read_receipts_enabled to user_settings for privacy control
    op.add_column(
        'user_settings',
        sa.Column('read_receipts_enabled', sa.Boolean(), server_default='true', nullable=False),
        schema='workspace'
    )

    # Add show_last_seen to user_settings (privacy for last seen)
    op.add_column(
        'user_settings',
        sa.Column('show_last_seen', sa.Boolean(), server_default='true', nullable=False),
        schema='workspace'
    )


def downgrade() -> None:
    # Remove show_last_seen from user_settings
    op.drop_column('user_settings', 'show_last_seen', schema='workspace')

    # Remove read_receipts_enabled from user_settings
    op.drop_column('user_settings', 'read_receipts_enabled', schema='workspace')

    # Remove index
    op.drop_index('idx_chat_participants_last_seen', table_name='chat_participants', schema='workspace')

    # Remove last_seen_at from chat_participants
    op.drop_column('chat_participants', 'last_seen_at', schema='workspace')
