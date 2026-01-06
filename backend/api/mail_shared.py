"""
Bheem Workspace - Shared Mailbox API
Enterprise feature for team inboxes
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

from core.security import get_current_user
from core.database import get_db
from services.shared_mailbox_service import shared_mailbox_service
from services.mail_session_service import mail_session_service
from services.mailcow_service import mailcow_service
from core.logging import get_logger

logger = get_logger("bheem.mail.shared.api")

router = APIRouter(prefix="/mail/shared", tags=["Shared Mailboxes"])


# ===========================================
# Request/Response Models
# ===========================================

class SharedMailboxCreate(BaseModel):
    email: EmailStr
    name: str
    description: Optional[str] = None


class SharedMailboxUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class MemberAdd(BaseModel):
    user_id: str
    role: str = "member"  # admin, member, viewer
    can_send: bool = True
    can_delete: bool = False
    can_manage_members: bool = False


class MemberUpdate(BaseModel):
    role: Optional[str] = None
    can_send: Optional[bool] = None
    can_delete: Optional[bool] = None
    can_manage_members: Optional[bool] = None


class EmailAssignment(BaseModel):
    message_id: str
    assigned_to: str
    priority: str = "normal"  # low, normal, high, urgent
    due_date: Optional[datetime] = None
    notes: Optional[str] = None


class StatusUpdate(BaseModel):
    status: str  # open, in_progress, resolved, closed


class CommentCreate(BaseModel):
    message_id: str
    comment: str
    is_internal: bool = True


# ===========================================
# User Assignments (must be before /{mailbox_id} routes!)
# ===========================================

@router.get("/my-assignments")
async def get_my_assignments(
    status: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Get all assignments for the current user."""
    try:
        assignments = await shared_mailbox_service.get_user_assignments(
            db, current_user["id"], status
        )

        return {
            "count": len(assignments),
            "assignments": assignments
        }
    except Exception as e:
        logger.error(f"Failed to get user assignments: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===========================================
# Shared Mailbox CRUD
# ===========================================

@router.post("")
async def create_shared_mailbox(
    mailbox: SharedMailboxCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """
    Create a new shared mailbox.

    Requires admin permissions.
    """
    # Get tenant from current user
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Tenant ID required")

    try:
        result = await shared_mailbox_service.create_mailbox(
            db=db,
            tenant_id=tenant_id,
            email=mailbox.email,
            name=mailbox.name,
            description=mailbox.description,
            created_by=current_user["id"]
        )

        return {
            "success": True,
            "mailbox": result
        }

    except Exception as e:
        logger.error(f"Failed to create shared mailbox: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
async def list_shared_mailboxes(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """
    List all shared mailboxes the user has access to.
    """
    try:
        mailboxes = await shared_mailbox_service.get_user_mailboxes(
            db=db,
            user_id=current_user["id"]
        )

        return {
            "count": len(mailboxes),
            "mailboxes": mailboxes
        }

    except Exception as e:
        logger.error(f"Failed to list shared mailboxes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tenant")
async def list_tenant_mailboxes(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """
    List all shared mailboxes for the tenant.

    Requires admin permissions.
    """
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Tenant ID required")

    try:
        mailboxes = await shared_mailbox_service.get_tenant_mailboxes(
            db=db,
            tenant_id=tenant_id
        )

        return {
            "count": len(mailboxes),
            "mailboxes": mailboxes
        }

    except Exception as e:
        logger.error(f"Failed to list tenant mailboxes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{mailbox_id}")
async def get_shared_mailbox(
    mailbox_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Get shared mailbox details."""
    # Check permission
    has_access = await shared_mailbox_service.check_permission(
        db, mailbox_id, current_user["id"], "view"
    )
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")

    mailbox = await shared_mailbox_service.get_mailbox(db, mailbox_id)
    if not mailbox:
        raise HTTPException(status_code=404, detail="Mailbox not found")

    # Get members
    members = await shared_mailbox_service.get_members(db, mailbox_id)

    return {
        **mailbox,
        "members": members
    }


@router.put("/{mailbox_id}")
async def update_shared_mailbox(
    mailbox_id: str,
    update: SharedMailboxUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Update shared mailbox details."""
    # Check permission
    has_access = await shared_mailbox_service.check_permission(
        db, mailbox_id, current_user["id"], "admin"
    )
    if not has_access:
        raise HTTPException(status_code=403, detail="Admin permission required")

    await shared_mailbox_service.update_mailbox(
        db=db,
        mailbox_id=mailbox_id,
        name=update.name,
        description=update.description,
        is_active=update.is_active
    )

    return {"success": True}


@router.delete("/{mailbox_id}")
async def delete_shared_mailbox(
    mailbox_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Delete (deactivate) a shared mailbox."""
    # Check permission
    has_access = await shared_mailbox_service.check_permission(
        db, mailbox_id, current_user["id"], "admin"
    )
    if not has_access:
        raise HTTPException(status_code=403, detail="Admin permission required")

    await shared_mailbox_service.delete_mailbox(db, mailbox_id)

    return {"success": True}


# ===========================================
# Member Management
# ===========================================

@router.post("/{mailbox_id}/members")
async def add_member(
    mailbox_id: str,
    member: MemberAdd,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Add a member to the shared mailbox."""
    # Check permission
    has_access = await shared_mailbox_service.check_permission(
        db, mailbox_id, current_user["id"], "manage_members"
    )
    if not has_access:
        raise HTTPException(status_code=403, detail="Permission required to manage members")

    result = await shared_mailbox_service.add_member(
        db=db,
        mailbox_id=mailbox_id,
        user_id=member.user_id,
        role=member.role,
        can_send=member.can_send,
        can_delete=member.can_delete,
        can_manage_members=member.can_manage_members,
        added_by=current_user["id"]
    )

    return {"success": True, "member": result}


@router.get("/{mailbox_id}/members")
async def list_members(
    mailbox_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """List all members of a shared mailbox."""
    # Check permission
    has_access = await shared_mailbox_service.check_permission(
        db, mailbox_id, current_user["id"], "view"
    )
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")

    members = await shared_mailbox_service.get_members(db, mailbox_id)

    return {
        "count": len(members),
        "members": members
    }


@router.delete("/{mailbox_id}/members/{user_id}")
async def remove_member(
    mailbox_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Remove a member from the shared mailbox."""
    # Check permission
    has_access = await shared_mailbox_service.check_permission(
        db, mailbox_id, current_user["id"], "manage_members"
    )
    if not has_access:
        raise HTTPException(status_code=403, detail="Permission required to manage members")

    await shared_mailbox_service.remove_member(db, mailbox_id, user_id)

    return {"success": True}


# ===========================================
# Email Operations
# ===========================================

@router.get("/{mailbox_id}/messages")
async def get_mailbox_messages(
    mailbox_id: str,
    folder: str = Query("INBOX"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """
    Get messages from shared mailbox.

    Uses the shared mailbox credentials to fetch emails.
    """
    # Check permission
    has_access = await shared_mailbox_service.check_permission(
        db, mailbox_id, current_user["id"], "view"
    )
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")

    # Get mailbox details
    mailbox = await shared_mailbox_service.get_mailbox(db, mailbox_id)
    if not mailbox:
        raise HTTPException(status_code=404, detail="Mailbox not found")

    # Get credentials for shared mailbox
    credentials = mail_session_service.get_credentials(f"shared:{mailbox_id}")
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Shared mailbox not authenticated. Admin must configure credentials."
        )

    try:
        # Fetch messages
        messages = await mailcow_service.get_inbox(
            credentials["email"],
            credentials["password"],
            folder,
            limit,
            (page - 1) * limit
        )

        # Log view activity
        await shared_mailbox_service.log_activity(
            db, mailbox_id, "viewed_inbox", current_user["id"],
            details={"folder": folder, "page": page}
        )

        return {
            "mailbox_id": mailbox_id,
            "folder": folder,
            "page": page,
            "count": len(messages),
            "messages": messages
        }

    except Exception as e:
        logger.error(f"Failed to fetch shared mailbox messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===========================================
# Email Assignment
# ===========================================

@router.post("/{mailbox_id}/assign")
async def assign_email(
    mailbox_id: str,
    assignment: EmailAssignment,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Assign an email to a team member."""
    # Check permission
    has_access = await shared_mailbox_service.check_permission(
        db, mailbox_id, current_user["id"], "view"
    )
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")

    result = await shared_mailbox_service.assign_email(
        db=db,
        mailbox_id=mailbox_id,
        message_id=assignment.message_id,
        assigned_to=assignment.assigned_to,
        assigned_by=current_user["id"],
        priority=assignment.priority,
        due_date=assignment.due_date,
        notes=assignment.notes
    )

    return {"success": True, "assignment": result}


@router.get("/{mailbox_id}/assignments/{message_id}")
async def get_assignment(
    mailbox_id: str,
    message_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Get assignment for a specific email."""
    # Check permission
    has_access = await shared_mailbox_service.check_permission(
        db, mailbox_id, current_user["id"], "view"
    )
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")

    assignment = await shared_mailbox_service.get_assignment(db, mailbox_id, message_id)

    return {"assignment": assignment}


@router.put("/{mailbox_id}/assignments/{message_id}/status")
async def update_assignment_status(
    mailbox_id: str,
    message_id: str,
    status_update: StatusUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Update assignment status."""
    # Check permission
    has_access = await shared_mailbox_service.check_permission(
        db, mailbox_id, current_user["id"], "view"
    )
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")

    await shared_mailbox_service.update_assignment_status(
        db, mailbox_id, message_id, status_update.status, current_user["id"]
    )

    return {"success": True}


# ===========================================
# Comments
# ===========================================

@router.post("/{mailbox_id}/comments")
async def add_comment(
    mailbox_id: str,
    comment: CommentCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Add an internal comment to an email."""
    # Check permission
    has_access = await shared_mailbox_service.check_permission(
        db, mailbox_id, current_user["id"], "view"
    )
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")

    result = await shared_mailbox_service.add_comment(
        db=db,
        mailbox_id=mailbox_id,
        message_id=comment.message_id,
        user_id=current_user["id"],
        comment=comment.comment,
        is_internal=comment.is_internal
    )

    return {"success": True, "comment": result}


@router.get("/{mailbox_id}/comments/{message_id}")
async def get_comments(
    mailbox_id: str,
    message_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Get all comments for an email."""
    # Check permission
    has_access = await shared_mailbox_service.check_permission(
        db, mailbox_id, current_user["id"], "view"
    )
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")

    comments = await shared_mailbox_service.get_comments(db, mailbox_id, message_id)

    return {
        "count": len(comments),
        "comments": comments
    }


@router.delete("/{mailbox_id}/comments/{comment_id}")
async def delete_comment(
    mailbox_id: str,
    comment_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Delete a comment (only by author)."""
    # Check permission
    has_access = await shared_mailbox_service.check_permission(
        db, mailbox_id, current_user["id"], "view"
    )
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")

    await shared_mailbox_service.delete_comment(db, comment_id, current_user["id"])

    return {"success": True}


# ===========================================
# Activity
# ===========================================

@router.get("/{mailbox_id}/activity")
async def get_activity(
    mailbox_id: str,
    message_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Get activity log for mailbox or specific message."""
    # Check permission
    has_access = await shared_mailbox_service.check_permission(
        db, mailbox_id, current_user["id"], "view"
    )
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")

    activity = await shared_mailbox_service.get_activity(
        db, mailbox_id, message_id, limit
    )

    return {
        "count": len(activity),
        "activity": activity
    }
