"""add_is_pinned_column

Add is_pinned column to chat_participants table.
Allows users to pin conversations to the top of their list.

Revision ID: g7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-02-03 00:01:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'g7b8c9d0e1f2'
down_revision: Union[str, None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SCHEMA = 'workspace'


def upgrade() -> None:
    # Add is_pinned column to chat_participants
    op.add_column(
        'chat_participants',
        sa.Column('is_pinned', sa.Boolean, server_default='false', nullable=False),
        schema=SCHEMA
    )

    # Create index for faster queries on pinned conversations
    op.create_index(
        'ix_chat_participants_pinned',
        'chat_participants',
        ['user_id', 'is_pinned'],
        schema=SCHEMA
    )


def downgrade() -> None:
    # Remove the index
    op.drop_index('ix_chat_participants_pinned', table_name='chat_participants', schema=SCHEMA)

    # Remove the column
    op.drop_column('chat_participants', 'is_pinned', schema=SCHEMA)
