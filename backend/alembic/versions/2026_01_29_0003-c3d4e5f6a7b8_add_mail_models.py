"""add_mail_models

Mail tables already exist from previous migrations.
This migration is kept for version tracking purposes.

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-01-29 00:03:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SCHEMA = 'workspace'


def upgrade() -> None:
    # All mail tables already exist from previous migrations
    # Tables: mail_drafts, mail_signatures, mail_filters, mail_contacts,
    # scheduled_emails, mail_labels, mail_label_assignments, mail_templates,
    # mail_vacation_responders, shared_mailboxes, shared_mailbox_members,
    # shared_mailbox_assignments, shared_mailbox_comments, shared_mailbox_activity,
    # mail_2fa_logs, email_categories, email_category_rules, email_importance,
    # mail_read_receipts, confidential_emails, email_nudges, email_nudge_settings
    pass


def downgrade() -> None:
    # No-op since tables were created in previous migrations
    pass
