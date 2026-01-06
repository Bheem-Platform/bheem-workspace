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
    "Mail2FALog"
]
