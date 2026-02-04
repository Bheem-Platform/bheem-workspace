"""
Bheem Workspace - Alembic Migration Environment Configuration

This module configures Alembic for async SQLAlchemy migrations with
automatic model detection for 'autogenerate' support.
"""
import asyncio
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context

# Add the backend directory to the path so we can import our modules
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Import our database configuration and models
from core.config import settings
from core.database import Base

# Import all models to ensure they are registered with Base.metadata
# This is critical for autogenerate to detect all tables
from models import (
    # Admin models
    Tenant,
    TenantUser,
    Domain,
    DomainDNSRecord,
    Developer,
    DeveloperProject,
    ActivityLog,
    # Meet models
    MeetingRoom,
    MeetingRecording,
    MeetingTranscript,
    MeetingChatMessage,
    MeetingParticipant,
    WaitingRoom,
    MeetingSettings,
    # Mail models
    MailDraft,
    MailSignature,
    MailFilter,
    MailContact,
    ScheduledEmail,
    Mail2FALog,
    # Productivity models
    Spreadsheet,
    Worksheet,
    SpreadsheetShare,
    Presentation,
    Slide,
    PresentationShare,
    Form,
    FormQuestion,
    FormResponse,
    FormShare,
    ContentFolder,
    ProductivityTemplate,
    # Organization models
    OrgUnit,
    UserGroup,
    UserGroupMember,
    AdminRole,
    UserAdminRole,
    SSOConfiguration,
    DomainAlias,
    SecurityPolicy,
    UserImportJob,
    # Drive models
    DriveFile,
    DriveShare,
    DriveActivity,
    # Meet enhancements
    BreakoutRoom,
    BreakoutParticipant,
    MeetingPoll,
    MeetingPollVote,
    MeetingQA,
    MeetingQAUpvote,
    MeetingWhiteboard,
    # Workflow models
    Workflow,
    WorkflowRun,
    WorkflowTemplate,
    # Calendar models
    CalendarReminder,
    UserCalendarSettings,
    AppointmentType,
    ScheduledAppointment,
    SnoozedEmail,
    EmailTemplate,
    SearchIndexLog,
    # Enterprise models
    DLPRule,
    DLPIncident,
    Device,
    DevicePolicy,
    AIConversation,
    AIUsageLog,
    # Migration models
    MigrationConnection,
    MigrationJob,
    Contact,
    # Nextcloud models
    NextcloudCredentials,
    # OForms models
    OForm,
    OFormVersion,
    OFormResponse,
    OFormShare,
    OFormEditSession,
    # Chat models
    ExternalContact,
    Conversation,
    ConversationParticipant,
    ChatInvitation,
    CallLog,
    DirectMessage,
    MessageAttachment,
)

# Import settings model if it exists
try:
    from models.settings_models import UserSettings
except ImportError:
    pass

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Get the SQLAlchemy URL from our settings
# Note: We don't use set_main_option here because the URL may contain
# special characters (like %) that ConfigParser would interpret as interpolation
DATABASE_URL = settings.DATABASE_URL

# Set target metadata for autogenerate support
target_metadata = Base.metadata


def include_object(object, name, type_, reflected, compare_to):
    """
    Filter function to determine which objects to include in migrations.

    We only want to manage tables in the 'workspace' schema that are
    defined in our models.
    """
    if type_ == "table":
        # Include tables in workspace schema
        if hasattr(object, 'schema') and object.schema == 'workspace':
            return True
        # Also include tables without explicit schema (default public)
        if object.schema is None:
            return True
    return True


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well. By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.
    """
    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
        include_schemas=True,
        version_table_schema="workspace",
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """Run migrations with the given connection."""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_object=include_object,
        include_schemas=True,
        version_table_schema="workspace",
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations in 'online' mode with async engine.

    In this scenario we need to create an Engine
    and associate a connection with the context.
    """
    connectable = create_async_engine(
        DATABASE_URL,
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
