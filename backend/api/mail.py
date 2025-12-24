"""
Bheem Workspace - Mail API (Mailcow + MSG91 Integration)
Webmail functionality via IMAP/SMTP and MSG91 transactional emails
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from core.security import get_current_user
from services.mailcow_service import mailcow_service
# Use centralized Bheem Notify service instead of direct MSG91
from services.notify_client import msg91_service  # Backward compatible alias

router = APIRouter(prefix="/mail", tags=["Bheem Mail"])

# Schemas
class SendEmailRequest(BaseModel):
    to: List[EmailStr]
    cc: Optional[List[EmailStr]] = []
    subject: str
    body: str
    is_html: bool = True

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

# Note: For now, we store mail credentials in session/token
# In production, use secure credential storage

@router.get("/inbox")
async def get_inbox(
    folder: str = "INBOX",
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """
    Get emails from inbox
    Note: Requires mail credentials stored in user session
    For demo, using placeholder credentials
    """
    # In production, get credentials from secure storage
    email = current_user.get("email") or f"{current_user['username']}@bheem.cloud"
    
    # For demo purposes - in production, use stored/encrypted credentials
    # This would typically come from a secure vault or user-provided credentials
    return {
        "message": "Mail API ready",
        "user_email": email,
        "folder": folder,
        "note": "Use /mail/login to authenticate with mail credentials"
    }

@router.post("/login")
async def mail_login(
    email: EmailStr,
    password: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Authenticate with mail server
    Returns session for subsequent mail operations
    """
    # Test IMAP connection
    try:
        folders = mailcow_service.get_folders(email, password)
        if folders:
            return {
                "success": True,
                "email": email,
                "folders": folders,
                "message": "Mail authentication successful"
            }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Mail authentication failed: {str(e)}"
        )

@router.get("/messages")
async def get_messages(
    email: EmailStr,
    password: str,
    folder: str = "INBOX",
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get messages from a folder"""
    messages = mailcow_service.get_inbox(email, password, folder, limit)
    return {
        "folder": folder,
        "count": len(messages),
        "messages": messages
    }

@router.get("/messages/{message_id}")
async def get_message(
    message_id: str,
    email: EmailStr,
    password: str,
    folder: str = "INBOX",
    current_user: dict = Depends(get_current_user)
):
    """Get a single message by ID"""
    message = mailcow_service.get_email(email, password, message_id, folder)
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )
    return message

@router.post("/send")
async def send_email(
    request: SendEmailRequest,
    email: EmailStr,
    password: str,
    current_user: dict = Depends(get_current_user)
):
    """Send an email"""
    success = mailcow_service.send_email(
        from_email=email,
        password=password,
        to=request.to,
        subject=request.subject,
        body=request.body,
        cc=request.cc,
        is_html=request.is_html
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send email"
        )
    
    return {"success": True, "message": "Email sent successfully"}

@router.get("/folders")
async def get_folders(
    email: EmailStr,
    password: str,
    current_user: dict = Depends(get_current_user)
):
    """Get list of mail folders"""
    folders = mailcow_service.get_folders(email, password)
    return {"folders": folders}

@router.post("/messages/{message_id}/move")
async def move_message(
    message_id: str,
    request: MoveEmailRequest,
    email: EmailStr,
    password: str,
    current_user: dict = Depends(get_current_user)
):
    """Move a message to another folder"""
    success = mailcow_service.move_email(
        email, password, message_id, 
        request.from_folder, request.to_folder
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to move message"
        )
    
    return {"success": True, "message": "Message moved"}

@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: str,
    email: EmailStr,
    password: str,
    folder: str = "INBOX",
    current_user: dict = Depends(get_current_user)
):
    """Delete a message (move to Trash)"""
    success = mailcow_service.move_email(
        email, password, message_id, folder, "Trash"
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete message"
        )
    
    return {"success": True, "message": "Message deleted"}


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
