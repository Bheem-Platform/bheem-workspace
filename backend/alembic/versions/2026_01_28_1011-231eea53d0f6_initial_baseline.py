"""initial_baseline

This is the baseline migration for Bheem Workspace.
It represents the existing database state as of January 2026.

All previous migrations (001-028) from the SQL migrations folder
have been applied manually. This baseline marks the starting point
for Alembic-managed migrations going forward.

Revision ID: 231eea53d0f6
Revises:
Create Date: 2026-01-28 10:11:34.933585

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '231eea53d0f6'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Baseline migration - no operations needed.

    The database schema was created through manual SQL migrations
    (migrations/001_*.sql through migrations/028_*.sql).

    This migration serves as the baseline for Alembic to track
    future schema changes.
    """
    # Ensure the workspace schema exists (it should already exist)
    op.execute("CREATE SCHEMA IF NOT EXISTS workspace")


def downgrade() -> None:
    """
    Downgrade is not supported for baseline migration.

    Warning: Running downgrade on a baseline will NOT remove the
    existing tables. You would need to manually drop the schema.
    """
    pass
