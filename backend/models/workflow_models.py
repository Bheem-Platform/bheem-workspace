"""
Bheem Workspace - Workflow Automation Models
Models for Bheem Flows - workflow automation engine
"""
from sqlalchemy import Column, String, Boolean, Integer, Text, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from core.database import Base


class Workflow(Base):
    """Automated workflows"""
    __tablename__ = "workflows"
    __table_args__ = (
        Index('idx_workflows_tenant', 'tenant_id'),
        Index('idx_workflows_trigger', 'trigger_type'),
        Index('idx_workflows_enabled', 'is_enabled'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenants.id", ondelete="CASCADE"), nullable=False)

    # Basic info
    name = Column(String(255), nullable=False)
    description = Column(Text)

    # Trigger configuration
    trigger_type = Column(String(100), nullable=False)  # mail.received, form.submitted, schedule.daily, etc.
    trigger_config = Column(JSONB, default={})  # Trigger-specific configuration

    # Actions
    actions = Column(JSONB, default=[])  # Array of action definitions

    # Conditions
    conditions = Column(JSONB, default={})  # Filtering conditions

    # Status
    is_enabled = Column(Boolean, default=False)

    # Statistics
    run_count = Column(Integer, default=0)
    last_run_at = Column(DateTime)
    last_error = Column(Text)

    # Ownership
    created_by = Column(UUID(as_uuid=True), ForeignKey("workspace.tenant_users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    runs = relationship("WorkflowRun", back_populates="workflow", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Workflow(id={self.id}, name={self.name}, trigger={self.trigger_type})>"


class WorkflowRun(Base):
    """Workflow execution history"""
    __tablename__ = "workflow_runs"
    __table_args__ = (
        Index('idx_workflow_runs_workflow', 'workflow_id'),
        Index('idx_workflow_runs_status', 'status'),
        Index('idx_workflow_runs_started', 'started_at'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_id = Column(UUID(as_uuid=True), ForeignKey("workspace.workflows.id", ondelete="CASCADE"), nullable=False)

    # Status
    status = Column(String(20), default='running')  # running, completed, failed

    # Data
    trigger_data = Column(JSONB)  # Data that triggered the workflow
    execution_log = Column(JSONB, default=[])  # Step-by-step execution log

    # Timing
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    duration_ms = Column(Integer)

    # Error handling
    error = Column(Text)

    # Relationships
    workflow = relationship("Workflow", back_populates="runs")

    def __repr__(self):
        return f"<WorkflowRun(id={self.id}, workflow={self.workflow_id}, status={self.status})>"


class WorkflowTemplate(Base):
    """Pre-built workflow templates"""
    __tablename__ = "workflow_templates"
    __table_args__ = (
        Index('idx_workflow_templates_category', 'category'),
        {"schema": "workspace"}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenants.id", ondelete="CASCADE"))  # NULL = system template

    # Template info
    name = Column(String(255), nullable=False)
    description = Column(Text)
    category = Column(String(100))  # mail, calendar, forms, productivity, notifications
    icon = Column(String(50))

    # Template definition
    trigger_type = Column(String(100), nullable=False)
    trigger_config = Column(JSONB, default={})
    actions = Column(JSONB, default=[])
    conditions = Column(JSONB, default={})

    # Settings
    is_public = Column(Boolean, default=False)  # Available to all tenants
    use_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<WorkflowTemplate(id={self.id}, name={self.name}, category={self.category})>"


# =============================================
# Workflow Trigger Types
# =============================================

WORKFLOW_TRIGGERS = {
    # Email triggers
    "mail.received": {
        "name": "Email Received",
        "description": "Triggers when a new email is received",
        "config_schema": {
            "from": {"type": "string", "description": "Filter by sender"},
            "to": {"type": "string", "description": "Filter by recipient"},
            "subject_contains": {"type": "string", "description": "Filter by subject"},
            "has_attachment": {"type": "boolean", "description": "Only emails with attachments"}
        }
    },
    "mail.sent": {
        "name": "Email Sent",
        "description": "Triggers when an email is sent",
        "config_schema": {}
    },

    # Calendar triggers
    "calendar.event_created": {
        "name": "Event Created",
        "description": "Triggers when a new calendar event is created",
        "config_schema": {}
    },
    "calendar.event_starting": {
        "name": "Event Starting",
        "description": "Triggers before an event starts",
        "config_schema": {
            "minutes_before": {"type": "integer", "default": 15}
        }
    },

    # Forms triggers
    "form.submitted": {
        "name": "Form Submitted",
        "description": "Triggers when a form response is submitted",
        "config_schema": {
            "form_id": {"type": "string", "description": "Specific form to watch"}
        }
    },

    # Document triggers
    "docs.created": {
        "name": "Document Created",
        "description": "Triggers when a new document is created",
        "config_schema": {}
    },
    "docs.shared": {
        "name": "Document Shared",
        "description": "Triggers when a document is shared",
        "config_schema": {}
    },

    # User triggers
    "user.joined": {
        "name": "User Joined",
        "description": "Triggers when a new user joins the workspace",
        "config_schema": {}
    },

    # Schedule triggers
    "schedule.daily": {
        "name": "Daily Schedule",
        "description": "Triggers daily at a specific time",
        "config_schema": {
            "time": {"type": "string", "format": "time", "description": "Time to trigger (HH:MM)"},
            "timezone": {"type": "string", "default": "UTC"}
        }
    },
    "schedule.weekly": {
        "name": "Weekly Schedule",
        "description": "Triggers weekly on specific days",
        "config_schema": {
            "days": {"type": "array", "items": {"type": "integer"}, "description": "Days (0=Mon, 6=Sun)"},
            "time": {"type": "string", "format": "time"},
            "timezone": {"type": "string", "default": "UTC"}
        }
    },

    # Webhook trigger
    "webhook.received": {
        "name": "Webhook Received",
        "description": "Triggers when an external webhook is received",
        "config_schema": {
            "secret": {"type": "string", "description": "Webhook secret for validation"}
        }
    }
}

# =============================================
# Workflow Action Types
# =============================================

WORKFLOW_ACTIONS = {
    # Email actions
    "mail.send": {
        "name": "Send Email",
        "description": "Send an email",
        "config_schema": {
            "to": {"type": "string", "required": True},
            "subject": {"type": "string", "required": True},
            "body": {"type": "string", "required": True},
            "cc": {"type": "string"},
            "bcc": {"type": "string"}
        }
    },
    "mail.forward": {
        "name": "Forward Email",
        "description": "Forward the triggering email",
        "config_schema": {
            "to": {"type": "string", "required": True},
            "add_note": {"type": "string"}
        }
    },
    "mail.add_label": {
        "name": "Add Email Label",
        "description": "Add a label to the email",
        "config_schema": {
            "label": {"type": "string", "required": True}
        }
    },

    # Calendar actions
    "calendar.create_event": {
        "name": "Create Event",
        "description": "Create a calendar event",
        "config_schema": {
            "title": {"type": "string", "required": True},
            "start_time": {"type": "string", "format": "datetime", "required": True},
            "end_time": {"type": "string", "format": "datetime", "required": True},
            "attendees": {"type": "array", "items": {"type": "string"}},
            "description": {"type": "string"}
        }
    },

    # Chat actions
    "chat.send_message": {
        "name": "Send Chat Message",
        "description": "Send a message to a chat channel",
        "config_schema": {
            "channel": {"type": "string", "required": True},
            "message": {"type": "string", "required": True}
        }
    },

    # Document actions
    "docs.create": {
        "name": "Create Document",
        "description": "Create a new document",
        "config_schema": {
            "title": {"type": "string", "required": True},
            "template_id": {"type": "string"},
            "folder_id": {"type": "string"}
        }
    },

    # Spreadsheet actions
    "sheets.add_row": {
        "name": "Add Spreadsheet Row",
        "description": "Add a row to a spreadsheet",
        "config_schema": {
            "spreadsheet_id": {"type": "string", "required": True},
            "worksheet_name": {"type": "string"},
            "values": {"type": "array", "items": {"type": "string"}, "required": True}
        }
    },

    # Drive actions
    "drive.move_file": {
        "name": "Move File",
        "description": "Move a file to a different folder",
        "config_schema": {
            "file_id": {"type": "string", "required": True},
            "destination_folder_id": {"type": "string", "required": True}
        }
    },

    # Notification actions
    "notification.send": {
        "name": "Send Notification",
        "description": "Send a notification to users",
        "config_schema": {
            "to": {"type": "string", "required": True},
            "title": {"type": "string", "required": True},
            "message": {"type": "string", "required": True},
            "link": {"type": "string"}
        }
    },

    # Webhook actions
    "webhook.call": {
        "name": "Call Webhook",
        "description": "Make an HTTP request to an external URL",
        "config_schema": {
            "url": {"type": "string", "format": "url", "required": True},
            "method": {"type": "string", "enum": ["GET", "POST", "PUT", "DELETE"], "default": "POST"},
            "headers": {"type": "object"},
            "body": {"type": "string"}
        }
    },

    # AI actions
    "ai.summarize": {
        "name": "AI Summarize",
        "description": "Use AI to summarize content",
        "config_schema": {
            "content": {"type": "string", "required": True},
            "max_length": {"type": "integer", "default": 200}
        }
    },
    "ai.translate": {
        "name": "AI Translate",
        "description": "Translate content to another language",
        "config_schema": {
            "content": {"type": "string", "required": True},
            "target_language": {"type": "string", "required": True}
        }
    },

    # Control flow
    "condition": {
        "name": "Condition",
        "description": "If/else branching logic",
        "config_schema": {
            "condition": {"type": "string", "required": True},
            "then_actions": {"type": "array"},
            "else_actions": {"type": "array"}
        }
    },
    "delay": {
        "name": "Delay",
        "description": "Wait for a specified duration",
        "config_schema": {
            "duration_seconds": {"type": "integer", "required": True}
        }
    },
    "loop": {
        "name": "Loop",
        "description": "Loop over a collection of items",
        "config_schema": {
            "items": {"type": "string", "required": True, "description": "Variable containing items"},
            "actions": {"type": "array", "required": True}
        }
    }
}
