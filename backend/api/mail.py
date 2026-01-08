"""
Bheem Workspace - Mail API (Mailcow + MSG91 Integration)
Webmail functionality via IMAP/SMTP and MSG91 transactional emails

Security:
- Uses session-based authentication with encrypted credential storage in Redis
- Credentials are never passed in URL query parameters
- Rate limiting protects against abuse
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request, UploadFile, File, Form
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict
from datetime import datetime
from core.security import get_current_user
from services.mailcow_service import mailcow_service
from services.mail_session_service import mail_session_service, get_mail_session, MailSessionService
from services.mail_threading_service import mail_threading_service
# Use centralized Bheem Notify service
from integrations.notify import msg91_service
# Rate limiting
try:
    from middleware.rate_limit import limiter, RateLimits
    RATE_LIMITING_ENABLED = True
except ImportError:
    RATE_LIMITING_ENABLED = False

    # Dummy limiter for when rate limiting is disabled
    class DummyLimiter:
        def limit(self, limit_string):
            def decorator(func):
                return func
            return decorator

    limiter = DummyLimiter()

    class RateLimits:
        SESSION_CREATE = "5/minute"
        MAIL_READ = "100/minute"
        MAIL_LIST = "60/minute"
        MAIL_SEND = "10/minute"
        MAIL_MOVE = "30/minute"
        MAIL_DELETE = "30/minute"
        FOLDERS = "30/minute"

router = APIRouter(prefix="/mail", tags=["Bheem Mail"])


# ===========================================
# Schemas
# ===========================================

class MailLoginRequest(BaseModel):
    """Request body for mail login (credentials in body, not URL)."""
    email: EmailStr
    password: str


class AttachmentData(BaseModel):
    filename: str
    content_type: str = "application/octet-stream"
    content: str  # Base64 encoded content


class SendEmailRequest(BaseModel):
    to: List[EmailStr]
    cc: Optional[List[EmailStr]] = []
    bcc: Optional[List[EmailStr]] = []
    subject: str
    body: str
    is_html: bool = True
    in_reply_to: Optional[str] = None  # Message-ID for threading
    attachments: Optional[List[AttachmentData]] = []  # Base64 encoded attachments


class EmailPreview(BaseModel):
    id: str
    subject: str
    from_addr: str
    date: str
    preview: str
    read: bool


class EmailDetail(BaseModel):
    id: str
    subject: str
    from_addr: str
    to: str
    cc: Optional[str]
    date: str
    body_html: str
    body_text: str
    attachments: List[dict]


class MoveEmailRequest(BaseModel):
    from_folder: str
    to_folder: str


class MailSessionResponse(BaseModel):
    """Response for mail session operations."""
    success: bool
    message: str
    email: Optional[str] = None
    session_id: Optional[str] = None
    expires_in_seconds: Optional[int] = None
    folders: Optional[List[str]] = None


# ===========================================
# Helper function to get credentials from session
# ===========================================

def get_mail_credentials(user_id: str) -> dict:
    """Get mail credentials from session or raise 401."""
    credentials = mail_session_service.get_credentials(user_id)
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Mail session expired or not found. Please authenticate via POST /mail/session/create"
        )
    return credentials


# ===========================================
# Session Management Endpoints (Phase 1.1)
# ===========================================

@router.post("/session/create", response_model=MailSessionResponse)
@limiter.limit(RateLimits.SESSION_CREATE)
async def create_mail_session(
    request: Request,
    login_data: MailLoginRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a secure mail session.

    Authenticates with the mail server and stores encrypted credentials
    in Redis. Returns a session that expires after 24 hours.

    **Security:** Credentials are passed in the request body (not URL)
    and stored encrypted server-side. The frontend only receives a session ID.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    # Validate credentials with Mailcow
    try:
        folders = mailcow_service.get_folders(login_data.email, login_data.password)
        if not folders:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid mail credentials"
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Mail authentication failed: {str(e)}"
        )

    # Create encrypted session
    try:
        session_info = mail_session_service.create_session(
            user_id=user_id,
            email=login_data.email,
            password=login_data.password,
            additional_data={"username": current_user.get("username")}
        )

        return MailSessionResponse(
            success=True,
            message="Mail session created successfully",
            email=login_data.email,
            session_id=session_info["session_id"],
            expires_in_seconds=session_info["expires_in_seconds"],
            folders=folders
        )
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Session service unavailable: {str(e)}"
        )


@router.get("/session/status")
async def get_mail_session_status(
    current_user: dict = Depends(get_current_user)
):
    """
    Check current mail session status.

    Returns session info including remaining TTL, or indicates no active session.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    session_info = mail_session_service.get_session_info(user_id)

    if not session_info:
        return {
            "active": False,
            "message": "No active mail session. Please authenticate via POST /mail/session/create"
        }

    return {
        "active": True,
        "email": session_info["email"],
        "expires_in_seconds": session_info["expires_in_seconds"],
        "session_id": session_info["session_id"]
    }


@router.post("/session/refresh")
async def refresh_mail_session(
    current_user: dict = Depends(get_current_user)
):
    """
    Refresh/extend the mail session TTL.

    Extends the session without requiring re-authentication.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    success = mail_session_service.refresh_session(user_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active mail session to refresh"
        )

    session_info = mail_session_service.get_session_info(user_id)

    return {
        "success": True,
        "message": "Session refreshed",
        "expires_in_seconds": session_info["expires_in_seconds"] if session_info else 0
    }


@router.delete("/session")
async def destroy_mail_session(
    current_user: dict = Depends(get_current_user)
):
    """
    Destroy mail session (logout from mail).

    Removes encrypted credentials from server storage.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    success = mail_session_service.destroy_session(user_id)

    return {
        "success": True,
        "message": "Mail session destroyed" if success else "No active session"
    }


# ===========================================
# Legacy login endpoint (deprecated, redirects to session)
# ===========================================

@router.post("/login")
async def mail_login(
    request: Request,
    login_data: MailLoginRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    [DEPRECATED] Use POST /mail/session/create instead.

    This endpoint is kept for backwards compatibility but internally
    uses the new session-based authentication.
    """
    return await create_mail_session(request, login_data, current_user)


# ===========================================
# Inbox / Message Endpoints (Using Session Auth)
# ===========================================

@router.get("/inbox")
@limiter.limit(RateLimits.MAIL_LIST)
async def get_inbox(
    request: Request,
    folder: str = Query("INBOX", description="Mail folder to fetch"),
    limit: int = Query(50, ge=1, le=200, description="Number of messages to fetch"),
    page: int = Query(1, ge=1, description="Page number"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get emails from inbox using session authentication.

    Requires an active mail session (created via POST /mail/session/create).
    """
    user_id = current_user.get("id") or current_user.get("user_id")
    credentials = get_mail_credentials(user_id)

    # Calculate offset for pagination
    offset = (page - 1) * limit

    messages = mailcow_service.get_inbox(
        credentials["email"],
        credentials["password"],
        folder,
        limit
    )

    return {
        "folder": folder,
        "count": len(messages),
        "page": page,
        "limit": limit,
        "messages": messages,
        "email": credentials["email"]
    }


@router.get("/messages")
@limiter.limit(RateLimits.MAIL_LIST)
async def get_messages(
    request: Request,
    folder: str = Query("INBOX", description="Mail folder"),
    limit: int = Query(50, ge=1, le=200, description="Number of messages"),
    page: int = Query(1, ge=1, description="Page number"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get messages from a folder using session authentication.

    Requires an active mail session.
    """
    user_id = current_user.get("id") or current_user.get("user_id")
    credentials = get_mail_credentials(user_id)

    messages = mailcow_service.get_inbox(
        credentials["email"],
        credentials["password"],
        folder,
        limit
    )

    return {
        "folder": folder,
        "count": len(messages),
        "page": page,
        "limit": limit,
        "messages": messages
    }


@router.get("/messages/{message_id}")
@limiter.limit(RateLimits.MAIL_READ)
async def get_message(
    request: Request,
    message_id: str,
    folder: str = Query("INBOX", description="Mail folder"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get a single message by ID using session authentication.

    Requires an active mail session.
    """
    user_id = current_user.get("id") or current_user.get("user_id")
    credentials = get_mail_credentials(user_id)

    message = mailcow_service.get_email(
        credentials["email"],
        credentials["password"],
        message_id,
        folder
    )

    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )

    return message


@router.post("/send")
@limiter.limit(RateLimits.MAIL_SEND)
async def send_email(
    request: Request,
    email_request: SendEmailRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Send an email using session authentication.

    Requires an active mail session.
    """
    user_id = current_user.get("id") or current_user.get("user_id")
    credentials = get_mail_credentials(user_id)

    # Convert attachments to dict format for mailcow_service
    attachments_data = None
    if email_request.attachments:
        attachments_data = [
            {
                "filename": att.filename,
                "content_type": att.content_type,
                "content": att.content  # Already base64 encoded
            }
            for att in email_request.attachments
        ]

    success = mailcow_service.send_email(
        from_email=credentials["email"],
        password=credentials["password"],
        to=email_request.to,
        subject=email_request.subject,
        body=email_request.body,
        cc=email_request.cc,
        bcc=email_request.bcc,
        is_html=email_request.is_html,
        attachments=attachments_data
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send email"
        )

    attachment_count = len(email_request.attachments) if email_request.attachments else 0
    return {
        "success": True,
        "message": f"Email sent successfully{f' with {attachment_count} attachment(s)' if attachment_count > 0 else ''}",
        "from": credentials["email"],
        "to": email_request.to,
        "attachments_count": attachment_count
    }


# ===========================================
# Send with Undo (Delayed Send) Endpoints
# ===========================================

class SendWithUndoRequest(BaseModel):
    to: List[str]
    cc: Optional[List[str]] = []
    bcc: Optional[List[str]] = []
    subject: str
    body: str
    is_html: bool = True
    delay_seconds: int = 5


# In-memory store for queued emails (use Redis in production)
import asyncio
_queued_emails: Dict[str, dict] = {}
_send_tasks: Dict[str, asyncio.Task] = {}


@router.post("/send-with-undo")
@limiter.limit(RateLimits.MAIL_SEND)
async def queue_email_with_undo(
    request: Request,
    email_data: SendWithUndoRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Queue an email for delayed sending with undo capability.

    The email will be sent after `delay_seconds`. Before that,
    it can be cancelled via DELETE /mail/send-with-undo/{queue_id}
    """
    import uuid

    user_id = current_user.get("id") or current_user.get("user_id")
    credentials = get_mail_credentials(user_id)

    queue_id = str(uuid.uuid4())

    # Store email data
    _queued_emails[queue_id] = {
        "id": queue_id,
        "user_id": user_id,
        "from_email": credentials["email"],
        "password": credentials["password"],
        "to": email_data.to,
        "cc": email_data.cc,
        "bcc": email_data.bcc,
        "subject": email_data.subject,
        "body": email_data.body,
        "is_html": email_data.is_html,
        "delay_seconds": email_data.delay_seconds,
        "status": "queued",
        "created_at": datetime.utcnow().isoformat()
    }

    # Schedule the send
    async def send_after_delay():
        await asyncio.sleep(email_data.delay_seconds)
        if queue_id in _queued_emails and _queued_emails[queue_id]["status"] == "queued":
            try:
                email_info = _queued_emails[queue_id]
                success = mailcow_service.send_email(
                    from_email=email_info["from_email"],
                    password=email_info["password"],
                    to=email_info["to"],
                    subject=email_info["subject"],
                    body=email_info["body"],
                    cc=email_info["cc"],
                    is_html=email_info["is_html"]
                )
                _queued_emails[queue_id]["status"] = "sent" if success else "failed"
            except Exception as e:
                _queued_emails[queue_id]["status"] = "failed"
                _queued_emails[queue_id]["error"] = str(e)

    task = asyncio.create_task(send_after_delay())
    _send_tasks[queue_id] = task

    return {
        "success": True,
        "queue_id": queue_id,
        "status": "queued",
        "delay_seconds": email_data.delay_seconds,
        "message": f"Email queued. Will be sent in {email_data.delay_seconds} seconds unless cancelled."
    }


@router.post("/send-with-undo/attachments")
async def queue_email_with_attachments(
    to: str = Form(...),
    subject: str = Form(...),
    body: str = Form(...),
    cc: str = Form(""),
    bcc: str = Form(""),
    is_html: bool = Form(True),
    delay_seconds: int = Form(5),
    attachments: List[UploadFile] = File(default=[]),
    current_user: dict = Depends(get_current_user)
):
    """
    Queue an email with attachments for delayed sending.
    """
    import uuid

    user_id = current_user.get("id") or current_user.get("user_id")
    credentials = get_mail_credentials(user_id)

    # Parse recipients
    to_list = [e.strip() for e in to.split(",") if e.strip()]
    cc_list = [e.strip() for e in cc.split(",") if e.strip()] if cc else []
    bcc_list = [e.strip() for e in bcc.split(",") if e.strip()] if bcc else []

    # Read attachment data
    attachment_data = []
    for file in attachments:
        content = await file.read()
        attachment_data.append({
            "filename": file.filename,
            "content": content,
            "content_type": file.content_type
        })

    queue_id = str(uuid.uuid4())

    # Store email data
    _queued_emails[queue_id] = {
        "id": queue_id,
        "user_id": user_id,
        "from_email": credentials["email"],
        "password": credentials["password"],
        "to": to_list,
        "cc": cc_list,
        "bcc": bcc_list,
        "subject": subject,
        "body": body,
        "is_html": is_html,
        "attachments": attachment_data,
        "delay_seconds": delay_seconds,
        "status": "queued",
        "created_at": datetime.utcnow().isoformat()
    }

    # Schedule the send
    async def send_after_delay():
        await asyncio.sleep(delay_seconds)
        if queue_id in _queued_emails and _queued_emails[queue_id]["status"] == "queued":
            try:
                email_info = _queued_emails[queue_id]
                success = mailcow_service.send_email(
                    from_email=email_info["from_email"],
                    password=email_info["password"],
                    to=email_info["to"],
                    subject=email_info["subject"],
                    body=email_info["body"],
                    cc=email_info["cc"],
                    is_html=email_info["is_html"],
                    attachments=email_info.get("attachments")
                )
                _queued_emails[queue_id]["status"] = "sent" if success else "failed"
            except Exception as e:
                _queued_emails[queue_id]["status"] = "failed"
                _queued_emails[queue_id]["error"] = str(e)

    task = asyncio.create_task(send_after_delay())
    _send_tasks[queue_id] = task

    return {
        "success": True,
        "queue_id": queue_id,
        "status": "queued",
        "delay_seconds": delay_seconds,
        "attachments_count": len(attachment_data),
        "message": f"Email with {len(attachment_data)} attachment(s) queued."
    }


@router.get("/send-with-undo/{queue_id}")
async def get_queued_email_status(
    queue_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get the status of a queued email."""
    if queue_id not in _queued_emails:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Queued email not found"
        )

    email_info = _queued_emails[queue_id]
    user_id = current_user.get("id") or current_user.get("user_id")

    if email_info["user_id"] != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this queued email"
        )

    return {
        "queue_id": queue_id,
        "status": email_info["status"],
        "to": email_info["to"],
        "subject": email_info["subject"],
        "delay_seconds": email_info["delay_seconds"],
        "created_at": email_info["created_at"]
    }


@router.delete("/send-with-undo/{queue_id}")
async def cancel_queued_email(
    queue_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Cancel (undo) a queued email before it's sent."""
    if queue_id not in _queued_emails:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Queued email not found"
        )

    email_info = _queued_emails[queue_id]
    user_id = current_user.get("id") or current_user.get("user_id")

    if email_info["user_id"] != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to cancel this email"
        )

    if email_info["status"] != "queued":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel email with status: {email_info['status']}"
        )

    # Cancel the scheduled task
    if queue_id in _send_tasks:
        _send_tasks[queue_id].cancel()
        del _send_tasks[queue_id]

    # Update status
    _queued_emails[queue_id]["status"] = "cancelled"

    # Return email data so user can edit and resend
    return {
        "success": True,
        "message": "Email cancelled successfully",
        "email_data": {
            "to": email_info["to"],
            "cc": email_info.get("cc", []),
            "bcc": email_info.get("bcc", []),
            "subject": email_info["subject"],
            "body": email_info["body"],
            "is_html": email_info["is_html"]
        }
    }


@router.get("/folders")
@limiter.limit(RateLimits.FOLDERS)
async def get_folders(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Get list of mail folders using session authentication.

    Requires an active mail session.
    """
    user_id = current_user.get("id") or current_user.get("user_id")
    credentials = get_mail_credentials(user_id)

    folders = mailcow_service.get_folders(
        credentials["email"],
        credentials["password"]
    )

    return {"folders": folders}


@router.post("/messages/{message_id}/move")
@limiter.limit(RateLimits.MAIL_MOVE)
async def move_message(
    request: Request,
    message_id: str,
    move_data: MoveEmailRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Move a message to another folder using session authentication.

    Requires an active mail session.
    """
    user_id = current_user.get("id") or current_user.get("user_id")
    credentials = get_mail_credentials(user_id)

    success = mailcow_service.move_email(
        credentials["email"],
        credentials["password"],
        message_id,
        move_data.from_folder,
        move_data.to_folder
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to move message"
        )

    return {"success": True, "message": "Message moved"}


@router.delete("/messages/{message_id}")
@limiter.limit(RateLimits.MAIL_DELETE)
async def delete_message(
    request: Request,
    message_id: str,
    folder: str = Query("INBOX", description="Source folder"),
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a message (move to Trash) using session authentication.

    Requires an active mail session.
    """
    user_id = current_user.get("id") or current_user.get("user_id")
    credentials = get_mail_credentials(user_id)

    success = mailcow_service.move_email(
        credentials["email"],
        credentials["password"],
        message_id,
        folder,
        "Trash"
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete message"
        )

    return {"success": True, "message": "Message deleted"}


# ===========================================
# Conversation Threading Endpoints (Phase 2.1)
# ===========================================

@router.get("/conversations")
@limiter.limit(RateLimits.MAIL_LIST)
async def get_conversations(
    request: Request,
    folder: str = Query("INBOX", description="Mail folder"),
    limit: int = Query(50, ge=1, le=200, description="Number of messages to fetch for threading"),
    page: int = Query(1, ge=1, description="Page number"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get emails grouped into threaded conversations.

    Returns a list of conversation threads, each containing related messages
    grouped by Message-ID/In-Reply-To/References headers.

    Requires an active mail session.
    """
    user_id = current_user.get("id") or current_user.get("user_id")
    credentials = get_mail_credentials(user_id)

    # Fetch messages with threading headers
    messages = mailcow_service.get_inbox(
        credentials["email"],
        credentials["password"],
        folder,
        limit * 2  # Fetch more to ensure we get complete threads
    )

    # Group into threads
    conversations = mail_threading_service.group_into_threads(messages)

    # Apply pagination to conversations
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    paginated_conversations = conversations[start_idx:end_idx]

    return {
        "folder": folder,
        "total_conversations": len(conversations),
        "page": page,
        "limit": limit,
        "conversations": paginated_conversations
    }


@router.get("/conversations/{thread_id}")
@limiter.limit(RateLimits.MAIL_READ)
async def get_conversation(
    request: Request,
    thread_id: str,
    folder: str = Query("INBOX", description="Mail folder"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get a single conversation thread by ID.

    Returns all messages in the thread with full content.

    Requires an active mail session.
    """
    user_id = current_user.get("id") or current_user.get("user_id")
    credentials = get_mail_credentials(user_id)

    # Fetch messages
    messages = mailcow_service.get_inbox(
        credentials["email"],
        credentials["password"],
        folder,
        200  # Fetch enough to find the thread
    )

    # Group into threads
    conversations = mail_threading_service.group_into_threads(messages)

    # Find the requested thread
    for conversation in conversations:
        if conversation.get("thread_id") == thread_id:
            # Fetch full content for each message in the thread
            full_messages = []
            for msg in conversation.get("messages", []):
                full_msg = mailcow_service.get_email(
                    credentials["email"],
                    credentials["password"],
                    msg.get("id"),
                    folder
                )
                if full_msg:
                    full_messages.append(full_msg)
                else:
                    full_messages.append(msg)

            conversation["messages"] = full_messages
            return conversation

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Conversation thread not found"
    )


@router.get("/messages/{message_id}/thread")
@limiter.limit(RateLimits.MAIL_READ)
async def get_message_thread(
    request: Request,
    message_id: str,
    folder: str = Query("INBOX", description="Mail folder"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get all messages in the same thread as the specified message.

    Useful for expanding a single message into its full conversation.

    Requires an active mail session.
    """
    user_id = current_user.get("id") or current_user.get("user_id")
    credentials = get_mail_credentials(user_id)

    # Get the target message first
    target_message = mailcow_service.get_email(
        credentials["email"],
        credentials["password"],
        message_id,
        folder
    )

    if not target_message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )

    # Fetch all messages in folder
    all_messages = mailcow_service.get_inbox(
        credentials["email"],
        credentials["password"],
        folder,
        200
    )

    # Get thread for this message
    thread_messages = mail_threading_service.get_thread_for_message(
        target_message,
        all_messages
    )

    # Fetch full content for each message
    full_messages = []
    for msg in thread_messages:
        full_msg = mailcow_service.get_email(
            credentials["email"],
            credentials["password"],
            msg.get("id"),
            folder
        )
        if full_msg:
            full_messages.append(full_msg)
        else:
            full_messages.append(msg)

    return {
        "thread_id": target_message.get("message_id", message_id),
        "message_count": len(full_messages),
        "messages": full_messages
    }


# ===========================================
# Search Endpoints (Phase 2.2)
# ===========================================

class SearchRequest(BaseModel):
    query: str
    folder: Optional[str] = None  # None = search all folders
    search_in: Optional[List[str]] = None  # ['subject', 'from', 'to', 'body', 'all']
    limit: Optional[int] = 50


@router.get("/search")
@limiter.limit(RateLimits.MAIL_LIST)
async def search_emails(
    request: Request,
    query: str = Query(..., min_length=1, description="Search query"),
    folder: Optional[str] = Query(None, description="Folder to search (null for all)"),
    search_in: Optional[str] = Query("all", description="Fields to search: subject,from,to,body,all"),
    limit: int = Query(50, ge=1, le=100, description="Max results"),
    current_user: dict = Depends(get_current_user)
):
    """
    Search emails using IMAP SEARCH.

    Searches in specified folder or all folders if folder is not provided.
    Can filter by fields: subject, from, to, body, or all.

    Requires an active mail session.
    """
    user_id = current_user.get("id") or current_user.get("user_id")
    credentials = get_mail_credentials(user_id)

    # Parse search_in fields
    search_fields = search_in.split(",") if search_in else ["all"]

    if folder:
        # Search single folder
        results = mailcow_service.search_emails(
            credentials["email"],
            credentials["password"],
            query,
            folder,
            search_fields,
            limit
        )
        return {
            "query": query,
            "folder": folder,
            "count": len(results),
            "results": results
        }
    else:
        # Search all folders
        results = mailcow_service.search_all_folders(
            credentials["email"],
            credentials["password"],
            query,
            search_fields,
            limit
        )

        # Flatten results with folder info
        all_results = []
        for folder_name, messages in results.items():
            all_results.extend(messages)

        # Sort by date (newest first)
        all_results.sort(key=lambda x: x.get("date", ""), reverse=True)

        return {
            "query": query,
            "folder": "all",
            "count": len(all_results),
            "results": all_results[:limit],
            "by_folder": {k: len(v) for k, v in results.items()}
        }


@router.post("/search")
@limiter.limit(RateLimits.MAIL_LIST)
async def search_emails_post(
    request: Request,
    search_data: SearchRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Search emails (POST version for complex queries).

    Same as GET /search but accepts JSON body for more complex search parameters.
    """
    user_id = current_user.get("id") or current_user.get("user_id")
    credentials = get_mail_credentials(user_id)

    search_fields = search_data.search_in or ["all"]

    if search_data.folder:
        results = mailcow_service.search_emails(
            credentials["email"],
            credentials["password"],
            search_data.query,
            search_data.folder,
            search_fields,
            search_data.limit or 50
        )
        return {
            "query": search_data.query,
            "folder": search_data.folder,
            "count": len(results),
            "results": results
        }
    else:
        results = mailcow_service.search_all_folders(
            credentials["email"],
            credentials["password"],
            search_data.query,
            search_fields,
            search_data.limit or 50
        )

        all_results = []
        for folder_name, messages in results.items():
            all_results.extend(messages)

        all_results.sort(key=lambda x: x.get("date", ""), reverse=True)

        return {
            "query": search_data.query,
            "folder": "all",
            "count": len(all_results),
            "results": all_results[:search_data.limit or 50],
            "by_folder": {k: len(v) for k, v in results.items()}
        }


@router.get("/search/conversations")
@limiter.limit(RateLimits.MAIL_LIST)
async def search_conversations(
    request: Request,
    query: str = Query(..., min_length=1, description="Search query"),
    folder: Optional[str] = Query(None, description="Folder to search"),
    limit: int = Query(50, ge=1, le=100, description="Max results"),
    current_user: dict = Depends(get_current_user)
):
    """
    Search emails and return results grouped into conversations.

    Combines search with threading for conversation-based search results.
    """
    user_id = current_user.get("id") or current_user.get("user_id")
    credentials = get_mail_credentials(user_id)

    if folder:
        results = mailcow_service.search_emails(
            credentials["email"],
            credentials["password"],
            query,
            folder,
            ["all"],
            limit * 2  # Fetch more for complete threads
        )
    else:
        all_folder_results = mailcow_service.search_all_folders(
            credentials["email"],
            credentials["password"],
            query,
            ["all"],
            limit * 2
        )
        results = []
        for messages in all_folder_results.values():
            results.extend(messages)

    # Group into threads
    conversations = mail_threading_service.group_into_threads(results)

    return {
        "query": query,
        "folder": folder or "all",
        "conversation_count": len(conversations),
        "conversations": conversations[:limit]
    }


# ===========================================
# MSG91 Transactional Email Endpoints
# ===========================================

class MSG91EmailRequest(BaseModel):
    to: List[EmailStr]
    subject: str
    body: str
    cc: Optional[List[EmailStr]] = None
    bcc: Optional[List[EmailStr]] = None
    reply_to: Optional[EmailStr] = None
    is_html: bool = True

class MSG91TemplateRequest(BaseModel):
    to: List[EmailStr]
    template_id: str
    variables: dict = {}

class MSG91OTPRequest(BaseModel):
    to: EmailStr
    otp: str
    purpose: str = "verification"  # verification, password_reset, login

class MSG91MeetingInviteRequest(BaseModel):
    to: List[EmailStr]
    meeting_name: str
    host_name: str
    meeting_url: str
    scheduled_time: Optional[str] = None


@router.post("/bheem-tele/send")
async def send_msg91_email(
    request: MSG91EmailRequest,
    current_user: dict = Depends(get_current_user)
):
    """Send email via Bheem-Tele API (transactional emails)"""
    result = await msg91_service.send_email(
        to=request.to,
        subject=request.subject,
        body=request.body,
        cc=request.cc,
        bcc=request.bcc,
        reply_to=request.reply_to,
        is_html=request.is_html
    )

    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result["message"]
        )

    return result


@router.post("/bheem-tele/template")
async def send_msg91_template(
    request: MSG91TemplateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Send email using Bheem-Tele template"""
    result = await msg91_service.send_template_email(
        to=request.to,
        template_id=request.template_id,
        variables=request.variables
    )

    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result["message"]
        )

    return result


@router.post("/bheem-tele/otp")
async def send_msg91_otp(
    request: MSG91OTPRequest,
    current_user: dict = Depends(get_current_user)
):
    """Send OTP verification email via Bheem-Tele"""
    result = await msg91_service.send_otp_email(
        to=request.to,
        otp=request.otp,
        purpose=request.purpose
    )

    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result["message"]
        )

    return result


@router.post("/bheem-tele/welcome")
async def send_msg91_welcome(
    to: EmailStr,
    username: str,
    current_user: dict = Depends(get_current_user)
):
    """Send welcome email to new user via Bheem-Tele"""
    result = await msg91_service.send_welcome_email(
        to=to,
        username=username
    )

    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result["message"]
        )

    return result


@router.post("/bheem-tele/meeting-invite")
async def send_msg91_meeting_invite(
    request: MSG91MeetingInviteRequest,
    current_user: dict = Depends(get_current_user)
):
    """Send meeting invitation email via Bheem-Tele"""
    result = await msg91_service.send_meeting_invite(
        to=request.to,
        meeting_name=request.meeting_name,
        host_name=request.host_name,
        meeting_url=request.meeting_url,
        scheduled_time=request.scheduled_time
    )

    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result["message"]
        )

    return result


# ===========================================
# MSG91 SMS Endpoints
# ===========================================

class MSG91SMSRequest(BaseModel):
    mobile: str
    message: str
    template_id: Optional[str] = None

class MSG91OTPSMSRequest(BaseModel):
    mobile: str
    otp: Optional[str] = None
    template_id: Optional[str] = None

class MSG91VerifyOTPRequest(BaseModel):
    mobile: str
    otp: str


@router.post("/bheem-tele/sms/send")
async def send_msg91_sms(
    request: MSG91SMSRequest,
    current_user: dict = Depends(get_current_user)
):
    """Send SMS via Bheem-Tele"""
    result = await msg91_service.send_sms(
        mobile=request.mobile,
        message=request.message,
        template_id=request.template_id
    )

    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result["message"]
        )

    return result


@router.post("/bheem-tele/sms/otp")
async def send_msg91_sms_otp(
    request: MSG91OTPSMSRequest,
    current_user: dict = Depends(get_current_user)
):
    """Send OTP SMS via Bheem-Tele"""
    result = await msg91_service.send_otp_sms(
        mobile=request.mobile,
        otp=request.otp,
        template_id=request.template_id
    )

    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result["message"]
        )

    return result


@router.post("/bheem-tele/sms/verify")
async def verify_msg91_otp(
    request: MSG91VerifyOTPRequest,
    current_user: dict = Depends(get_current_user)
):
    """Verify OTP sent via Bheem-Tele"""
    result = await msg91_service.verify_otp(
        mobile=request.mobile,
        otp=request.otp
    )

    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["message"]
        )

    return result


@router.post("/bheem-tele/sms/quick")
async def send_quick_sms(
    mobile: str,
    message: str,
    current_user: dict = Depends(get_current_user)
):
    """Send quick SMS (for testing)"""
    result = await msg91_service.send_quick_sms(
        mobile=mobile,
        message=message
    )

    return result


# ===========================================
# Domain Setup Helper Endpoints
# ===========================================

@router.get("/bheem-tele/domain/setup/{domain}")
async def get_domain_setup_info(
    domain: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get DNS records required for domain setup.
    Returns all required DNS records and manual verification steps.
    """
    return msg91_service.get_domain_dns_records(domain)


@router.get("/bheem-tele/domain/check/{domain}")
async def check_domain_dns_status(
    domain: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Check if DNS records are properly configured for a domain.
    Verifies CNAME records are resolving correctly.
    """
    return await msg91_service.check_domain_dns(domain)


@router.get("/bheem-tele/status")
async def get_bheem_tele_status(
    current_user: dict = Depends(get_current_user)
):
    """
    Get Bheem-Tele service status and configuration.
    """
    return {
        "service": "Bheem-Tele",
        "status": "active",
        "sender_email": msg91_service.sender_email,
        "sender_name": msg91_service.sender_name,
        "sms_sender_id": msg91_service.sms_sender_id,
        "features": {
            "email": True,
            "sms": True,
            "otp": True,
            "templates": True
        }
    }
