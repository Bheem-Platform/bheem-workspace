"""add_chat_system

Create tables for Bheem Chat System in workspace schema.
Supports internal team chat and external client communication.

Tables:
- workspace.chat_external_contacts
- workspace.chat_conversations
- workspace.chat_participants
- workspace.chat_invitations
- workspace.chat_call_logs
- workspace.chat_messages
- workspace.chat_attachments

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-02-02 00:01:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SCHEMA = 'workspace'


def upgrade() -> None:
    # =============================================
    # 1. EXTERNAL CONTACTS TABLE
    # Users outside the workspace (clients, partners)
    # =============================================
    op.create_table(
        'chat_external_contacts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('owner_tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('email', sa.String(320), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('avatar_url', sa.Text),
        sa.Column('phone', sa.String(50)),
        sa.Column('company_name', sa.String(255)),
        sa.Column('job_title', sa.String(255)),
        sa.Column('linked_user_id', postgresql.UUID(as_uuid=True)),
        sa.Column('linked_tenant_id', postgresql.UUID(as_uuid=True)),
        sa.Column('linked_at', sa.DateTime(timezone=True)),
        sa.Column('invitation_sent_at', sa.DateTime(timezone=True)),
        sa.Column('invitation_accepted_at', sa.DateTime(timezone=True)),
        sa.Column('invitation_token', sa.String(100)),
        sa.Column('is_active', sa.Boolean, server_default='true'),
        sa.Column('is_blocked', sa.Boolean, server_default='false'),
        sa.Column('blocked_reason', sa.Text),
        sa.Column('notes', sa.Text),
        sa.Column('tags', postgresql.JSONB, server_default='[]'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('last_contacted_at', sa.DateTime(timezone=True)),
        sa.UniqueConstraint('owner_tenant_id', 'email', name='uq_external_contact_tenant_email'),
        schema=SCHEMA
    )
    op.create_index('ix_chat_external_contacts_email', 'chat_external_contacts', ['email'], schema=SCHEMA)
    op.create_index('ix_chat_external_contacts_tenant', 'chat_external_contacts', ['owner_tenant_id'], schema=SCHEMA)
    op.create_index('ix_chat_external_contacts_linked', 'chat_external_contacts', ['linked_user_id'], schema=SCHEMA)
    op.create_index('ix_chat_external_contacts_active', 'chat_external_contacts', ['owner_tenant_id', 'is_active'], schema=SCHEMA)

    # =============================================
    # 2. CONVERSATIONS TABLE
    # Both direct (1:1) and group chats
    # =============================================
    op.create_table(
        'chat_conversations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True)),
        sa.Column('type', sa.String(20), nullable=False),  # direct, group
        sa.Column('scope', sa.String(20), server_default='internal', nullable=False),  # internal, external, cross_tenant
        sa.Column('name', sa.String(255)),
        sa.Column('description', sa.Text),
        sa.Column('avatar_url', sa.Text),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_by_tenant_id', postgresql.UUID(as_uuid=True)),
        sa.Column('last_message_at', sa.DateTime(timezone=True)),
        sa.Column('last_message_preview', sa.String(200)),
        sa.Column('last_message_sender_id', postgresql.UUID(as_uuid=True)),
        sa.Column('last_message_sender_name', sa.String(255)),
        sa.Column('is_archived', sa.Boolean, server_default='false'),
        sa.Column('allow_external_files', sa.Boolean, server_default='true'),
        sa.Column('external_link_preview', sa.Boolean, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("type IN ('direct', 'group')", name='ck_chat_conversations_type'),
        sa.CheckConstraint("scope IN ('internal', 'external', 'cross_tenant')", name='ck_chat_conversations_scope'),
        schema=SCHEMA
    )
    op.create_index('ix_chat_conversations_type', 'chat_conversations', ['type'], schema=SCHEMA)
    op.create_index('ix_chat_conversations_scope', 'chat_conversations', ['scope'], schema=SCHEMA)
    op.create_index('ix_chat_conversations_tenant', 'chat_conversations', ['tenant_id'], schema=SCHEMA)
    op.create_index('ix_chat_conversations_updated', 'chat_conversations', [sa.text('updated_at DESC')], schema=SCHEMA)
    op.create_index('ix_chat_conversations_last_message', 'chat_conversations', [sa.text('last_message_at DESC NULLS LAST')], schema=SCHEMA)

    # =============================================
    # 3. PARTICIPANTS TABLE
    # Conversation participants with read tracking
    # =============================================
    op.create_table(
        'chat_participants',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('conversation_id', postgresql.UUID(as_uuid=True), sa.ForeignKey(f'{SCHEMA}.chat_conversations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('participant_type', sa.String(20), server_default='internal', nullable=False),  # internal, external_user, guest
        sa.Column('user_id', postgresql.UUID(as_uuid=True)),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True)),
        sa.Column('external_tenant_id', postgresql.UUID(as_uuid=True)),
        sa.Column('external_tenant_name', sa.String(255)),
        sa.Column('external_contact_id', postgresql.UUID(as_uuid=True), sa.ForeignKey(f'{SCHEMA}.chat_external_contacts.id', ondelete='SET NULL')),
        sa.Column('user_name', sa.String(255), nullable=False),
        sa.Column('user_email', sa.String(320)),
        sa.Column('user_avatar', sa.Text),
        sa.Column('company_name', sa.String(255)),
        sa.Column('role', sa.String(20), server_default='member'),  # owner, admin, member
        sa.Column('last_read_at', sa.DateTime(timezone=True)),
        sa.Column('last_read_message_id', postgresql.UUID(as_uuid=True)),
        sa.Column('unread_count', sa.Integer, server_default='0'),
        sa.Column('is_muted', sa.Boolean, server_default='false'),
        sa.Column('notifications_enabled', sa.Boolean, server_default='true'),
        sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('left_at', sa.DateTime(timezone=True)),
        sa.Column('invited_by', postgresql.UUID(as_uuid=True)),
        sa.CheckConstraint("participant_type IN ('internal', 'external_user', 'guest')", name='ck_chat_participants_type'),
        sa.CheckConstraint("role IN ('owner', 'admin', 'member')", name='ck_chat_participants_role'),
        schema=SCHEMA
    )
    op.create_index('ix_chat_participants_user', 'chat_participants', ['user_id'], schema=SCHEMA)
    op.create_index('ix_chat_participants_conversation', 'chat_participants', ['conversation_id'], schema=SCHEMA)
    op.create_index('ix_chat_participants_tenant', 'chat_participants', ['tenant_id'], schema=SCHEMA)
    op.create_index('ix_chat_participants_type', 'chat_participants', ['participant_type'], schema=SCHEMA)
    op.create_index('ix_chat_participants_external', 'chat_participants', ['external_contact_id'], schema=SCHEMA)
    op.create_index('ix_chat_participants_active', 'chat_participants', ['conversation_id', 'left_at'], schema=SCHEMA)
    op.create_index('ix_chat_participants_user_active', 'chat_participants', ['user_id', 'left_at'], schema=SCHEMA)

    # =============================================
    # 4. INVITATIONS TABLE
    # Email invitations for external users
    # =============================================
    op.create_table(
        'chat_invitations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('conversation_id', postgresql.UUID(as_uuid=True), sa.ForeignKey(f'{SCHEMA}.chat_conversations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('inviter_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('inviter_name', sa.String(255), nullable=False),
        sa.Column('inviter_tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('inviter_tenant_name', sa.String(255)),
        sa.Column('invitee_email', sa.String(320), nullable=False),
        sa.Column('invitee_name', sa.String(255)),
        sa.Column('token', sa.String(100), nullable=False, unique=True),
        sa.Column('message', sa.Text),
        sa.Column('status', sa.String(20), server_default='pending'),  # pending, accepted, declined, expired
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('expires_at', sa.DateTime(timezone=True)),
        sa.Column('responded_at', sa.DateTime(timezone=True)),
        sa.CheckConstraint("status IN ('pending', 'accepted', 'declined', 'expired')", name='ck_chat_invitations_status'),
        schema=SCHEMA
    )
    op.create_index('ix_chat_invitations_email', 'chat_invitations', ['invitee_email'], schema=SCHEMA)
    op.create_index('ix_chat_invitations_token', 'chat_invitations', ['token'], schema=SCHEMA)
    op.create_index('ix_chat_invitations_conversation', 'chat_invitations', ['conversation_id'], schema=SCHEMA)
    op.create_index('ix_chat_invitations_status', 'chat_invitations', ['status'], schema=SCHEMA)
    op.create_index('ix_chat_invitations_pending', 'chat_invitations', ['status', 'expires_at'], schema=SCHEMA)

    # =============================================
    # 5. CALL LOGS TABLE
    # Audio/video call history
    # =============================================
    op.create_table(
        'chat_call_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('conversation_id', postgresql.UUID(as_uuid=True), sa.ForeignKey(f'{SCHEMA}.chat_conversations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('call_type', sa.String(20), server_default='audio'),  # audio, video
        sa.Column('room_name', sa.String(100), nullable=False),
        sa.Column('caller_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('caller_name', sa.String(255), nullable=False),
        sa.Column('caller_tenant_id', postgresql.UUID(as_uuid=True)),
        sa.Column('status', sa.String(20), server_default='ringing'),  # ringing, ongoing, ended, missed, declined, no_answer
        sa.Column('participants_joined', postgresql.JSONB, server_default='[]'),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('answered_at', sa.DateTime(timezone=True)),
        sa.Column('ended_at', sa.DateTime(timezone=True)),
        sa.Column('duration_seconds', sa.Integer, server_default='0'),
        sa.Column('end_reason', sa.String(50)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("call_type IN ('audio', 'video')", name='ck_chat_call_logs_type'),
        sa.CheckConstraint("status IN ('ringing', 'ongoing', 'ended', 'missed', 'declined', 'no_answer')", name='ck_chat_call_logs_status'),
        schema=SCHEMA
    )
    op.create_index('ix_chat_calls_conversation', 'chat_call_logs', ['conversation_id'], schema=SCHEMA)
    op.create_index('ix_chat_calls_caller', 'chat_call_logs', ['caller_id'], schema=SCHEMA)
    op.create_index('ix_chat_calls_status', 'chat_call_logs', ['status'], schema=SCHEMA)
    op.create_index('ix_chat_calls_started', 'chat_call_logs', [sa.text('started_at DESC')], schema=SCHEMA)
    op.create_index('ix_chat_calls_active', 'chat_call_logs', ['conversation_id', 'status'], schema=SCHEMA)

    # =============================================
    # 6. MESSAGES TABLE
    # Individual chat messages
    # =============================================
    op.create_table(
        'chat_messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('conversation_id', postgresql.UUID(as_uuid=True), sa.ForeignKey(f'{SCHEMA}.chat_conversations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('sender_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('sender_name', sa.String(255), nullable=False),
        sa.Column('sender_avatar', sa.Text),
        sa.Column('sender_tenant_id', postgresql.UUID(as_uuid=True)),
        sa.Column('is_external_sender', sa.Boolean, server_default='false'),
        sa.Column('content', sa.Text),
        sa.Column('message_type', sa.String(20), server_default='text'),  # text, image, file, system, call
        sa.Column('reply_to_id', postgresql.UUID(as_uuid=True)),  # Self-referential FK added below
        sa.Column('reactions', postgresql.JSONB, server_default='{}'),
        sa.Column('is_edited', sa.Boolean, server_default='false'),
        sa.Column('is_deleted', sa.Boolean, server_default='false'),
        sa.Column('delivered_to', postgresql.JSONB, server_default='[]'),
        sa.Column('read_by', postgresql.JSONB, server_default='[]'),
        sa.Column('call_log_id', postgresql.UUID(as_uuid=True), sa.ForeignKey(f'{SCHEMA}.chat_call_logs.id', ondelete='SET NULL')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True)),
        sa.CheckConstraint("message_type IN ('text', 'image', 'file', 'system', 'call')", name='ck_chat_messages_type'),
        schema=SCHEMA
    )
    # Add self-referential foreign key for reply_to_id
    op.create_foreign_key(
        'fk_chat_messages_reply_to',
        'chat_messages', 'chat_messages',
        ['reply_to_id'], ['id'],
        source_schema=SCHEMA, referent_schema=SCHEMA,
        ondelete='SET NULL'
    )
    op.create_index('ix_chat_messages_conversation', 'chat_messages', ['conversation_id'], schema=SCHEMA)
    op.create_index('ix_chat_messages_sender', 'chat_messages', ['sender_id'], schema=SCHEMA)
    op.create_index('ix_chat_messages_created', 'chat_messages', [sa.text('created_at DESC')], schema=SCHEMA)
    op.create_index('ix_chat_messages_conversation_created', 'chat_messages', ['conversation_id', sa.text('created_at DESC')], schema=SCHEMA)
    op.create_index('ix_chat_messages_reply', 'chat_messages', ['reply_to_id'], schema=SCHEMA)

    # =============================================
    # 7. ATTACHMENTS TABLE
    # File attachments for messages
    # =============================================
    op.create_table(
        'chat_attachments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('message_id', postgresql.UUID(as_uuid=True), sa.ForeignKey(f'{SCHEMA}.chat_messages.id', ondelete='CASCADE'), nullable=False),
        sa.Column('file_name', sa.String(255), nullable=False),
        sa.Column('file_type', sa.String(100)),
        sa.Column('file_size', sa.Integer),
        sa.Column('file_url', sa.Text, nullable=False),
        sa.Column('thumbnail_url', sa.Text),
        sa.Column('width', sa.Integer),
        sa.Column('height', sa.Integer),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        schema=SCHEMA
    )
    op.create_index('ix_chat_attachments_message', 'chat_attachments', ['message_id'], schema=SCHEMA)

    # =============================================
    # 8. TRIGGERS - Update conversation last message
    # =============================================
    # Create function to update conversation last message
    op.execute(f"""
        CREATE OR REPLACE FUNCTION {SCHEMA}.update_conversation_last_message()
        RETURNS TRIGGER AS $$
        BEGIN
            UPDATE {SCHEMA}.chat_conversations
            SET
                last_message_at = NEW.created_at,
                last_message_preview = CASE
                    WHEN NEW.message_type = 'call' THEN 'Audio call'
                    WHEN NEW.message_type = 'image' THEN 'Sent an image'
                    WHEN NEW.message_type = 'file' THEN 'Sent a file'
                    WHEN NEW.message_type = 'system' THEN NEW.content
                    ELSE LEFT(NEW.content, 200)
                END,
                last_message_sender_id = NEW.sender_id,
                last_message_sender_name = NEW.sender_name,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.conversation_id;

            -- Increment unread count for other participants
            UPDATE {SCHEMA}.chat_participants
            SET unread_count = unread_count + 1
            WHERE conversation_id = NEW.conversation_id
            AND (user_id IS NULL OR user_id != NEW.sender_id)
            AND left_at IS NULL;

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # Create trigger for last message update
    op.execute(f"""
        CREATE TRIGGER trigger_update_last_message
            AFTER INSERT ON {SCHEMA}.chat_messages
            FOR EACH ROW
            EXECUTE FUNCTION {SCHEMA}.update_conversation_last_message();
    """)

    # =============================================
    # 9. TRIGGERS - Update external contact last_contacted_at
    # =============================================
    op.execute(f"""
        CREATE OR REPLACE FUNCTION {SCHEMA}.update_external_contact_last_contacted()
        RETURNS TRIGGER AS $$
        BEGIN
            -- Update last_contacted_at for external contact participants in this conversation
            UPDATE {SCHEMA}.chat_external_contacts ec
            SET last_contacted_at = NEW.created_at
            FROM {SCHEMA}.chat_participants cp
            WHERE cp.conversation_id = NEW.conversation_id
            AND cp.participant_type = 'guest'
            AND cp.external_contact_id = ec.id;

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute(f"""
        CREATE TRIGGER trigger_update_external_contact
            AFTER INSERT ON {SCHEMA}.chat_messages
            FOR EACH ROW
            EXECUTE FUNCTION {SCHEMA}.update_external_contact_last_contacted();
    """)

    # =============================================
    # 10. TRIGGERS - Update updated_at timestamp
    # =============================================
    op.execute(f"""
        CREATE OR REPLACE FUNCTION {SCHEMA}.update_chat_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute(f"""
        CREATE TRIGGER trigger_external_contacts_updated
            BEFORE UPDATE ON {SCHEMA}.chat_external_contacts
            FOR EACH ROW
            EXECUTE FUNCTION {SCHEMA}.update_chat_updated_at();
    """)


def downgrade() -> None:
    # Drop triggers
    op.execute(f"DROP TRIGGER IF EXISTS trigger_external_contacts_updated ON {SCHEMA}.chat_external_contacts;")
    op.execute(f"DROP TRIGGER IF EXISTS trigger_update_external_contact ON {SCHEMA}.chat_messages;")
    op.execute(f"DROP TRIGGER IF EXISTS trigger_update_last_message ON {SCHEMA}.chat_messages;")

    # Drop functions
    op.execute(f"DROP FUNCTION IF EXISTS {SCHEMA}.update_chat_updated_at();")
    op.execute(f"DROP FUNCTION IF EXISTS {SCHEMA}.update_external_contact_last_contacted();")
    op.execute(f"DROP FUNCTION IF EXISTS {SCHEMA}.update_conversation_last_message();")

    # Drop tables in reverse order (respecting foreign keys)
    op.drop_table('chat_attachments', schema=SCHEMA)
    op.drop_table('chat_messages', schema=SCHEMA)
    op.drop_table('chat_call_logs', schema=SCHEMA)
    op.drop_table('chat_invitations', schema=SCHEMA)
    op.drop_table('chat_participants', schema=SCHEMA)
    op.drop_table('chat_conversations', schema=SCHEMA)
    op.drop_table('chat_external_contacts', schema=SCHEMA)
