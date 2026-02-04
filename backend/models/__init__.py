"""
Bheem Workspace - Database Models
"""
from .admin_models import (
    Tenant,
    TenantUser,
    Domain,
    DomainDNSRecord,
    Developer,
    DeveloperProject,
    ActivityLog
)

from .meet_models import (
    MeetingRoom,
    MeetingRecording,
    MeetingTranscript,
    MeetingChatMessage,
    MeetingParticipant,
    WaitingRoom,
    MeetingSettings
)

from .mail_models import (
    MailDraft,
    MailSignature,
    MailFilter,
    MailContact,
    ScheduledEmail,
    Mail2FALog
)

from .productivity_models import (
    # Sheets
    Spreadsheet,
    Worksheet,
    SpreadsheetShare,
    # Slides
    Presentation,
    Slide,
    PresentationShare,
    # Forms
    Form,
    FormQuestion,
    FormResponse,
    FormShare,
    # Shared
    ContentFolder,
    ProductivityTemplate
)

from .org_models import (
    # Organizational Units
    OrgUnit,
    # User Groups
    UserGroup,
    UserGroupMember,
    # Admin Roles
    AdminRole,
    UserAdminRole,
    # SSO
    SSOConfiguration,
    # Domain Aliases
    DomainAlias,
    # Security
    SecurityPolicy,
    # Import Jobs
    UserImportJob
)

from .drive_models import (
    DriveFile,
    DriveShare,
    DriveActivity
)

from .meet_enhancements import (
    BreakoutRoom,
    BreakoutParticipant,
    MeetingPoll,
    MeetingPollVote,
    MeetingQA,
    MeetingQAUpvote,
    MeetingWhiteboard
)

from .workflow_models import (
    Workflow,
    WorkflowRun,
    WorkflowTemplate
)

from .calendar_models import (
    CalendarReminder,
    UserCalendarSettings,
    AppointmentType,
    ScheduledAppointment,
    SnoozedEmail,
    EmailTemplate,
    SearchIndexLog
)

from .enterprise_models import (
    DLPRule,
    DLPIncident,
    Device,
    DevicePolicy,
    AIConversation,
    AIUsageLog,
    DLP_PREDEFINED_PATTERNS
)

from .migration_models import (
    MigrationConnection,
    MigrationJob,
    Contact
)

from .nextcloud_models import (
    NextcloudCredentials
)

from .oforms_models import (
    OForm,
    OFormVersion,
    OFormResponse,
    OFormShare,
    OFormEditSession
)

from .chat_models import (
    ExternalContact,
    Conversation,
    ConversationParticipant,
    ChatInvitation,
    CallLog,
    DirectMessage,
    MessageAttachment
)

__all__ = [
    # Admin models
    "Tenant",
    "TenantUser",
    "Domain",
    "DomainDNSRecord",
    "Developer",
    "DeveloperProject",
    "ActivityLog",
    # Meet models
    "MeetingRoom",
    "MeetingRecording",
    "MeetingTranscript",
    "MeetingChatMessage",
    "MeetingParticipant",
    "WaitingRoom",
    "MeetingSettings",
    # Mail models
    "MailDraft",
    "MailSignature",
    "MailFilter",
    "MailContact",
    "ScheduledEmail",
    "Mail2FALog",
    # Productivity models - Sheets
    "Spreadsheet",
    "Worksheet",
    "SpreadsheetShare",
    # Productivity models - Slides
    "Presentation",
    "Slide",
    "PresentationShare",
    # Productivity models - Forms
    "Form",
    "FormQuestion",
    "FormResponse",
    "FormShare",
    # Productivity models - Shared
    "ContentFolder",
    "ProductivityTemplate",
    # Organization models
    "OrgUnit",
    "UserGroup",
    "UserGroupMember",
    "AdminRole",
    "UserAdminRole",
    "SSOConfiguration",
    "DomainAlias",
    "SecurityPolicy",
    "UserImportJob",
    # Drive models
    "DriveFile",
    "DriveShare",
    "DriveActivity",
    # Meet enhancements
    "BreakoutRoom",
    "BreakoutParticipant",
    "MeetingPoll",
    "MeetingPollVote",
    "MeetingQA",
    "MeetingQAUpvote",
    "MeetingWhiteboard",
    # Workflow models
    "Workflow",
    "WorkflowRun",
    "WorkflowTemplate",
    # Calendar enhancements
    "CalendarReminder",
    "UserCalendarSettings",
    "AppointmentType",
    "ScheduledAppointment",
    "SnoozedEmail",
    "EmailTemplate",
    "SearchIndexLog",
    # Enterprise models (Phase 4)
    "DLPRule",
    "DLPIncident",
    "Device",
    "DevicePolicy",
    "AIConversation",
    "AIUsageLog",
    "DLP_PREDEFINED_PATTERNS",
    # Migration models
    "MigrationConnection",
    "MigrationJob",
    "Contact",
    # Nextcloud models
    "NextcloudCredentials",
    # OForms models (OnlyOffice document forms)
    "OForm",
    "OFormVersion",
    "OFormResponse",
    "OFormShare",
    "OFormEditSession",
    # Chat models (Direct Messages & Calls)
    "ExternalContact",
    "Conversation",
    "ConversationParticipant",
    "ChatInvitation",
    "CallLog",
    "DirectMessage",
    "MessageAttachment"
]
