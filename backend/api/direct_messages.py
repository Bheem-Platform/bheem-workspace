"""
Bheem Workspace - Direct Messages API
REST endpoints for chat functionality with internal and external communication support

Endpoints:
- Conversations: Create, list, get conversations
- Messages: Send, edit, delete, react to messages
- External Contacts: Manage contacts outside workspace
- Invitations: Invite external users
- Calls: Audio/video call management
- Read Receipts: Mark as read, get unread counts
- Team Search: Search internal team members
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query, Request
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime

from core.security import get_current_user
from core.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from services.chat_service import chat_service
from services.chat_file_service import chat_file_service

# ===========================================
# HELPER FUNCTIONS
# ===========================================

def get_user_context(current_user: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract user context (user_id, tenant_id, name, email) from current_user.
    Handles different token payload structures.
    """
    user_id = current_user.get("id") or current_user.get("user_id")
    tenant_id = (
        current_user.get("tenant_id") or
        current_user.get("company_id") or
        current_user.get("erp_company_id")
    )
    name = (
        current_user.get("name") or
        current_user.get("full_name") or
        current_user.get("username", "").split("@")[0]
    )
    email = current_user.get("email") or current_user.get("username")
    avatar = current_user.get("avatar") or current_user.get("profile_picture_url")

    return {
        "user_id": user_id,
        "tenant_id": tenant_id,
        "name": name,
        "email": email,
        "avatar": avatar,
    }


async def get_user_avatar_from_db(db: AsyncSession, user_id: str) -> Optional[str]:
    """Fetch the latest avatar URL from UserSettings for a user."""
    from models.settings_models import UserSettings
    import uuid

    try:
        query = select(UserSettings.avatar_url).where(UserSettings.user_id == uuid.UUID(user_id))
        result = await db.execute(query)
        row = result.scalar_one_or_none()
        return row
    except Exception:
        return None


# Rate limiting
try:
    from middleware.rate_limit import limiter
except ImportError:
    class DummyLimiter:
        def limit(self, limit_string):
            def decorator(func):
                return func
            return decorator
    limiter = DummyLimiter()


router = APIRouter(prefix="/messages", tags=["Direct Messages"])


# ===========================================
# SCHEMAS - Conversations
# ===========================================

class ParticipantInfo(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    type: str = "internal"  # internal, external_user, guest
    tenant_id: Optional[str] = None
    tenant_name: Optional[str] = None
    company: Optional[str] = None
    external_contact_id: Optional[str] = None


class CreateDirectConversationRequest(BaseModel):
    participant: ParticipantInfo


class CreateGroupConversationRequest(BaseModel):
    name: str
    description: Optional[str] = None
    participants: List[ParticipantInfo]


class ParticipantResponse(BaseModel):
    id: str
    user_id: Optional[str]
    participant_type: str
    user_name: str
    user_email: Optional[str]
    user_avatar: Optional[str]
    company_name: Optional[str]
    role: str
    unread_count: int
    is_muted: bool
    joined_at: Optional[str]
    is_external: bool

    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    id: str
    type: str
    scope: str
    name: Optional[str]
    description: Optional[str]
    avatar_url: Optional[str]
    is_archived: bool
    last_message_at: Optional[str]
    last_message_preview: Optional[str]
    last_message_sender_name: Optional[str]
    participants: List[ParticipantResponse]
    created_at: str

    class Config:
        from_attributes = True


class ConversationListResponse(BaseModel):
    conversations: List[ConversationResponse]
    total: int


# ===========================================
# SCHEMAS - Messages
# ===========================================

class SendMessageRequest(BaseModel):
    content: str
    message_type: str = "text"
    reply_to_id: Optional[str] = None


class EditMessageRequest(BaseModel):
    content: str


class ReactionRequest(BaseModel):
    emoji: str


class AttachmentResponse(BaseModel):
    id: str
    file_name: str
    file_type: Optional[str]
    file_size: Optional[int]
    file_url: str
    thumbnail_url: Optional[str]
    width: Optional[int]
    height: Optional[int]

    class Config:
        from_attributes = True


class CallLogResponse(BaseModel):
    id: str
    call_type: str
    status: str
    duration_seconds: int
    started_at: Optional[str]
    ended_at: Optional[str]

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    sender_name: str
    sender_avatar: Optional[str]
    is_external_sender: bool
    content: Optional[str]
    message_type: str
    reply_to_id: Optional[str]
    reactions: Dict[str, List[str]]
    is_edited: bool
    is_deleted: bool
    delivered_to: List[str]
    read_by: List[str]
    attachments: List[AttachmentResponse]
    call_log: Optional[CallLogResponse]
    created_at: str
    updated_at: Optional[str]

    class Config:
        from_attributes = True


# ===========================================
# SCHEMAS - External Contacts
# ===========================================

class CreateExternalContactRequest(BaseModel):
    email: EmailStr
    name: str
    company_name: Optional[str] = None
    phone: Optional[str] = None
    job_title: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None


class UpdateExternalContactRequest(BaseModel):
    name: Optional[str] = None
    company_name: Optional[str] = None
    phone: Optional[str] = None
    job_title: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None


class ExternalContactResponse(BaseModel):
    id: str
    email: str
    name: str
    avatar_url: Optional[str]
    phone: Optional[str]
    company_name: Optional[str]
    job_title: Optional[str]
    is_linked: bool
    linked_tenant_id: Optional[str]
    tags: List[str]
    is_active: bool
    created_at: Optional[str]
    last_contacted_at: Optional[str]

    class Config:
        from_attributes = True


# ===========================================
# SCHEMAS - Invitations
# ===========================================

class CreateInvitationRequest(BaseModel):
    conversation_id: str
    email: EmailStr
    name: Optional[str] = None
    message: Optional[str] = None


class InvitationResponse(BaseModel):
    id: str
    conversation_id: str
    inviter_name: str
    inviter_tenant_name: Optional[str]
    invitee_email: str
    invitee_name: Optional[str]
    message: Optional[str]
    status: str
    token: str
    created_at: Optional[str]
    expires_at: Optional[str]

    class Config:
        from_attributes = True


class AcceptInvitationRequest(BaseModel):
    token: str


# ===========================================
# SCHEMAS - Calls
# ===========================================

class InitiateCallRequest(BaseModel):
    conversation_id: str
    call_type: str = "audio"  # audio or video


class CallResponse(BaseModel):
    id: str
    conversation_id: str
    call_type: str
    room_name: str
    caller_id: str
    caller_name: str
    status: str
    participants_joined: List[Dict]
    started_at: Optional[str]
    answered_at: Optional[str]
    ended_at: Optional[str]
    duration_seconds: int

    class Config:
        from_attributes = True


class CallTokenResponse(BaseModel):
    token: str
    ws_url: str
    room_name: str


# ===========================================
# SCHEMAS - Chat Token
# ===========================================

class ChatTokenResponse(BaseModel):
    token: str
    ws_url: str
    room_name: str


# ===========================================
# SCHEMAS - Team Members
# ===========================================

class TeamMemberResponse(BaseModel):
    id: str
    name: str
    email: str
    avatar: Optional[str]
    username: str
    job_title: Optional[str] = None
    is_online: bool = False


# ===========================================
# CONVERSATIONS ENDPOINTS
# ===========================================

@router.get("/conversations", response_model=ConversationListResponse)
@limiter.limit("60/minute")
async def list_conversations(
    request: Request,
    scope: Optional[str] = Query(None, description="Filter: 'internal' for Team, 'external' for Clients"),
    unread_only: bool = Query(False, description="Only return conversations with unread messages"),
    conv_type: Optional[str] = Query(None, description="Filter by type: 'direct' or 'group'"),
    archived_only: bool = Query(False, description="Only return archived conversations"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    include_archived: bool = Query(False),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all conversations for the current user.

    - **scope**: Filter by 'internal' (Team tab) or 'external' (Clients tab)
    - **unread_only**: Only return conversations with unread messages (for Unread tab)
    - **conv_type**: Filter by 'direct' or 'group' (for Teams tab - use 'group')
    - **archived_only**: Only return archived conversations
    - Returns conversations sorted by last message time
    """
    ctx = get_user_context(current_user)

    conversations = await chat_service.get_user_conversations(
        db=db,
        user_id=ctx["user_id"],
        tenant_id=ctx["tenant_id"],
        scope=scope,
        unread_only=unread_only,
        conv_type=conv_type,
        archived_only=archived_only,
        limit=limit,
        offset=offset,
        include_archived=include_archived,
    )

    return {
        "conversations": [
            c.to_dict(current_user_id=ctx["user_id"])
            for c in conversations
        ],
        "total": len(conversations),
    }


@router.post("/conversations/direct", response_model=ConversationResponse)
@limiter.limit("30/minute")
async def create_direct_conversation(
    request: Request,
    data: CreateDirectConversationRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create or get a direct (1:1) conversation.

    Participant types:
    - **internal**: Same workspace team member
    - **external_user**: User from different workspace
    - **guest**: External contact (email only)
    """
    ctx = get_user_context(current_user)
    participant = data.participant

    conversation = await chat_service.get_or_create_direct_conversation(
        db=db,
        user1_id=ctx["user_id"],
        user1_name=ctx["name"],
        user1_email=ctx["email"],
        user1_tenant_id=ctx["tenant_id"],
        user2_id=UUID(participant.id) if participant.id and participant.type != 'guest' else None,
        user2_name=participant.name,
        user2_email=participant.email,
        user2_tenant_id=UUID(participant.tenant_id) if participant.tenant_id else None,
        user2_participant_type=participant.type,
        external_contact_id=UUID(participant.external_contact_id) if participant.external_contact_id else None,
    )

    return conversation.to_dict(current_user_id=ctx["user_id"])


@router.post("/conversations/group", response_model=ConversationResponse)
@limiter.limit("20/minute")
async def create_group_conversation(
    request: Request,
    data: CreateGroupConversationRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new group conversation.

    Participants can be a mix of internal, external_user, and guest types.
    """
    ctx = get_user_context(current_user)

    if not data.name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Group name is required"
        )

    if len(data.participants) < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one participant is required"
        )

    participants = [
        {
            'id': p.id,
            'name': p.name,
            'email': p.email,
            'type': p.type,
            'tenant_id': p.tenant_id,
            'tenant_name': p.tenant_name,
            'company': p.company,
            'external_contact_id': p.external_contact_id,
        }
        for p in data.participants
    ]

    conversation = await chat_service.create_group_conversation(
        db=db,
        creator_id=ctx["user_id"],
        creator_name=ctx["name"],
        creator_email=ctx["email"],
        creator_tenant_id=ctx["tenant_id"],
        name=data.name,
        participants=participants,
        description=data.description,
    )

    return conversation.to_dict(current_user_id=ctx["user_id"])


@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific conversation."""
    ctx = get_user_context(current_user)
    conversation = await chat_service.get_conversation(
        db=db,
        conversation_id=conversation_id,
        user_id=ctx["user_id"],
    )

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    return conversation.to_dict(current_user_id=ctx["user_id"])


@router.put("/conversations/{conversation_id}/avatar")
async def update_conversation_avatar(
    conversation_id: UUID,
    avatar: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update group conversation avatar. Only admins/owners can update."""
    ctx = get_user_context(current_user)

    # Get conversation and verify access
    conversation = await chat_service.get_conversation(
        db=db,
        conversation_id=conversation_id,
        user_id=ctx["user_id"],
    )

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    if conversation.type != 'group':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only update avatar for group conversations"
        )

    # Check if user is admin/owner
    user_id_str = str(ctx["user_id"])
    participant = next(
        (p for p in conversation.participants if str(p.user_id) == user_id_str),
        None
    )
    if not participant or participant.role not in ['admin', 'owner']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can update group avatar"
        )

    # Validate file type
    if not avatar.content_type or not avatar.content_type.startswith('image/'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image"
        )

    # Upload avatar
    file_content = await avatar.read()
    try:
        result = await chat_file_service.upload_chat_attachment(
            file_content=file_content,
            file_name=avatar.filename or f"group_avatar_{conversation_id}.jpg",
            content_type=avatar.content_type,
            conversation_id=str(conversation_id),
            user_id=str(ctx["user_id"]),
        )

        # Update conversation avatar_url
        avatar_url = result['file_url']
        await chat_service.update_conversation_avatar(
            db=db,
            conversation_id=conversation_id,
            avatar_url=avatar_url,
        )

        return {"success": True, "avatar_url": avatar_url}

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/conversations/{conversation_id}/archive")
async def archive_conversation(
    conversation_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Archive a conversation."""
    ctx = get_user_context(current_user)
    success = await chat_service.archive_conversation(
        db=db,
        conversation_id=conversation_id,
        user_id=ctx["user_id"],
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    return {"success": True}


@router.post("/conversations/{conversation_id}/leave")
async def leave_conversation(
    conversation_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Leave a group conversation."""
    ctx = get_user_context(current_user)
    success = await chat_service.leave_conversation(
        db=db,
        conversation_id=conversation_id,
        user_id=ctx["user_id"],
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or not a member"
        )

    return {"success": True}


@router.post("/conversations/{conversation_id}/unarchive")
async def unarchive_conversation(
    conversation_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Unarchive a conversation."""
    ctx = get_user_context(current_user)
    success = await chat_service.unarchive_conversation(
        db=db,
        conversation_id=conversation_id,
        user_id=ctx["user_id"],
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    return {"success": True}


@router.get("/conversations/{conversation_id}/files")
async def get_conversation_files(
    conversation_id: UUID,
    file_type: Optional[str] = Query(None, description="Filter: 'images', 'documents', or 'links'"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get shared files in a conversation.

    - **file_type**: Filter by 'images', 'documents', or 'links'
    - Returns files grouped by type if no filter specified
    """
    ctx = get_user_context(current_user)

    # Verify access
    conversation = await chat_service.get_conversation(
        db=db,
        conversation_id=conversation_id,
        user_id=ctx["user_id"],
    )

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    files = await chat_service.get_shared_files(
        db=db,
        conversation_id=conversation_id,
        file_type=file_type,
        limit=limit,
        offset=offset,
    )

    return files


@router.get("/conversations/{conversation_id}/stats")
async def get_conversation_stats(
    conversation_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get conversation statistics.

    Returns message count, media count, link count, and conversation start date.
    """
    ctx = get_user_context(current_user)

    # Verify access
    conversation = await chat_service.get_conversation(
        db=db,
        conversation_id=conversation_id,
        user_id=ctx["user_id"],
    )

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    stats = await chat_service.get_conversation_stats(
        db=db,
        conversation_id=conversation_id,
    )

    return stats


@router.post("/conversations/{conversation_id}/mute")
async def mute_conversation(
    conversation_id: UUID,
    muted: bool = Query(True, description="Set to true to mute, false to unmute"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mute or unmute notifications for a conversation."""
    ctx = get_user_context(current_user)
    success = await chat_service.set_conversation_muted(
        db=db,
        conversation_id=conversation_id,
        user_id=ctx["user_id"],
        muted=muted,
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    return {"success": True, "muted": muted}


@router.post("/conversations/{conversation_id}/pin")
async def pin_conversation(
    conversation_id: UUID,
    pinned: bool = Query(True, description="Set to true to pin, false to unpin"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Pin or unpin a conversation."""
    ctx = get_user_context(current_user)
    success = await chat_service.set_conversation_pinned(
        db=db,
        conversation_id=conversation_id,
        user_id=ctx["user_id"],
        pinned=pinned,
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    return {"success": True, "pinned": pinned}


@router.delete("/conversations/{conversation_id}/members/{member_id}")
async def remove_group_member(
    conversation_id: UUID,
    member_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a member from a group conversation. Only admins/owners can remove members."""
    ctx = get_user_context(current_user)
    result = await chat_service.remove_group_member(
        db=db,
        conversation_id=conversation_id,
        admin_user_id=ctx["user_id"],
        member_user_id=member_id,
    )

    if result == "not_found":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation or member not found"
        )
    elif result == "not_authorized":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to remove members"
        )
    elif result == "cannot_remove_self":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove yourself. Use leave conversation instead."
        )

    return {"success": True}


class AddGroupMembersRequest(BaseModel):
    participants: List[ParticipantInfo]


@router.post("/conversations/{conversation_id}/members")
async def add_group_members(
    conversation_id: UUID,
    data: AddGroupMembersRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add members to a group conversation. Only admins/owners can add members."""
    ctx = get_user_context(current_user)

    # Get conversation and verify access
    conversation = await chat_service.get_conversation(
        db=db,
        conversation_id=conversation_id,
        user_id=ctx["user_id"],
    )

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    if conversation.type != 'group':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only add members to group conversations"
        )

    # Check if user is admin/owner
    user_id_str = str(ctx["user_id"])
    participant = next(
        (p for p in conversation.participants if str(p.user_id) == user_id_str),
        None
    )
    if not participant or participant.role not in ['admin', 'owner']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can add members"
        )

    # Add members
    participants = [
        {
            'id': p.id,
            'name': p.name,
            'email': p.email,
            'type': p.type,
            'tenant_id': p.tenant_id,
            'tenant_name': p.tenant_name,
            'company': p.company,
            'external_contact_id': p.external_contact_id,
        }
        for p in data.participants
    ]

    added_count = await chat_service.add_group_members(
        db=db,
        conversation_id=conversation_id,
        participants=participants,
        added_by_id=ctx["user_id"],
        added_by_name=ctx["name"],
    )

    return {"success": True, "added_count": added_count}


class UpdateGroupRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


@router.put("/conversations/{conversation_id}")
async def update_conversation(
    conversation_id: UUID,
    data: UpdateGroupRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update group conversation details (name, description). Only admins/owners can update."""
    ctx = get_user_context(current_user)

    # Get conversation and verify access
    conversation = await chat_service.get_conversation(
        db=db,
        conversation_id=conversation_id,
        user_id=ctx["user_id"],
    )

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    if conversation.type != 'group':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only update group conversations"
        )

    # Check if user is admin/owner
    user_id_str = str(ctx["user_id"])
    participant = next(
        (p for p in conversation.participants if str(p.user_id) == user_id_str),
        None
    )
    if not participant or participant.role not in ['admin', 'owner']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can update group details"
        )

    # Update conversation
    updated = await chat_service.update_conversation(
        db=db,
        conversation_id=conversation_id,
        name=data.name,
        description=data.description,
    )

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update conversation"
        )

    return updated.to_dict(current_user_id=ctx["user_id"])


class ForwardMessageRequest(BaseModel):
    target_conversation_ids: List[str]


@router.post("/messages/{message_id}/forward")
async def forward_message(
    message_id: UUID,
    data: ForwardMessageRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Forward a message to one or more conversations.
    Creates a copy of the message (including attachments) in each target conversation.
    """
    ctx = get_user_context(current_user)

    # Get latest avatar from database (in case user updated their profile)
    forwarder_avatar = await get_user_avatar_from_db(db, str(ctx["user_id"])) or ctx.get("avatar")

    results = await chat_service.forward_message(
        db=db,
        message_id=message_id,
        target_conversation_ids=data.target_conversation_ids,
        forwarder_id=ctx["user_id"],
        forwarder_name=ctx["name"],
        forwarder_avatar=forwarder_avatar,
        forwarder_tenant_id=ctx["tenant_id"],
    )

    if results.get("error"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=results["error"]
        )

    return {
        "success": True,
        "forwarded_to": results.get("forwarded_to", []),
        "failed": results.get("failed", []),
    }


@router.post("/conversations/{conversation_id}/token", response_model=ChatTokenResponse)
async def get_chat_token(
    conversation_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get LiveKit token for real-time chat.

    Use this token to connect to LiveKit for:
    - Real-time message delivery
    - Typing indicators
    - Online presence
    """
    ctx = get_user_context(current_user)
    # Verify user is participant
    conversation = await chat_service.get_conversation(
        db=db,
        conversation_id=conversation_id,
        user_id=ctx["user_id"],
    )

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    # Determine if user is external
    is_external = conversation.scope in ['external', 'cross_tenant']

    token = chat_service.get_chat_token(
        conversation_id=str(conversation_id),
        user_id=str(ctx["user_id"]),
        user_name=ctx["name"],
        is_external=is_external,
    )

    return {
        "token": token,
        "ws_url": chat_service.get_ws_url(),
        "room_name": f"chat-{conversation_id}",
    }


# ===========================================
# MESSAGES ENDPOINTS
# ===========================================

@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_messages(
    conversation_id: UUID,
    limit: int = Query(50, ge=1, le=100),
    before: Optional[UUID] = Query(None, description="Get messages before this ID"),
    after: Optional[UUID] = Query(None, description="Get messages after this ID"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get messages in a conversation with cursor-based pagination.

    - **before**: Get older messages (scroll up)
    - **after**: Get newer messages (new messages)

    Messages are automatically marked as delivered when fetched.
    """
    ctx = get_user_context(current_user)

    # Verify access
    conversation = await chat_service.get_conversation(
        db=db,
        conversation_id=conversation_id,
        user_id=ctx["user_id"],
    )

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    messages = await chat_service.get_messages(
        db=db,
        conversation_id=conversation_id,
        limit=limit,
        before_id=before,
        after_id=after,
    )

    # Auto-mark messages as delivered when fetched
    messages = await chat_service.auto_mark_delivered_on_fetch(
        db=db,
        conversation_id=conversation_id,
        user_id=ctx["user_id"],
        messages=messages,
    )

    return [m.to_dict() for m in messages]


@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse)
@limiter.limit("120/minute")
async def send_message(
    request: Request,
    conversation_id: UUID,
    data: SendMessageRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a text message in a conversation."""
    ctx = get_user_context(current_user)

    # Verify access
    conversation = await chat_service.get_conversation(
        db=db,
        conversation_id=conversation_id,
        user_id=ctx["user_id"],
    )

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    # Determine if sender is external
    is_external = conversation.scope in ['external', 'cross_tenant']

    # Get latest avatar from database (in case user updated their profile)
    sender_avatar = await get_user_avatar_from_db(db, str(ctx["user_id"])) or ctx["avatar"]

    message = await chat_service.send_message(
        db=db,
        conversation_id=conversation_id,
        sender_id=ctx["user_id"],
        sender_name=ctx["name"],
        sender_avatar=sender_avatar,
        sender_tenant_id=ctx["tenant_id"],
        is_external_sender=is_external,
        content=data.content,
        message_type=data.message_type,
        reply_to_id=UUID(data.reply_to_id) if data.reply_to_id else None,
    )

    return message.to_dict()


@router.post("/conversations/{conversation_id}/messages/with-files", response_model=MessageResponse)
@limiter.limit("30/minute")
async def send_message_with_files(
    request: Request,
    conversation_id: UUID,
    content: Optional[str] = Form(None),
    message_type: str = Form("text"),
    reply_to_id: Optional[str] = Form(None),
    files: List[UploadFile] = File(default=[]),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a message with file attachments."""
    ctx = get_user_context(current_user)

    print(f"[send_message_with_files] Received request for conversation {conversation_id}")
    print(f"[send_message_with_files] Content: {content}, message_type: {message_type}")
    print(f"[send_message_with_files] Files received: {len(files) if files else 0}")
    if files:
        for f in files:
            print(f"[send_message_with_files] File: {f.filename}, content_type: {f.content_type}, size: {f.size}")

    # Verify access
    conversation = await chat_service.get_conversation(
        db=db,
        conversation_id=conversation_id,
        user_id=ctx["user_id"],
    )

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    # Upload files
    attachments = []
    if files:
        for file in files:
            if file.filename:
                print(f"[send_message_with_files] Processing file: {file.filename}")
                file_content = await file.read()
                print(f"[send_message_with_files] File content size: {len(file_content)} bytes")

                try:
                    attachment = await chat_file_service.upload_chat_attachment(
                        file_content=file_content,
                        file_name=file.filename,
                        content_type=file.content_type or "application/octet-stream",
                        conversation_id=str(conversation_id),
                        user_id=str(ctx["user_id"]),
                    )
                    print(f"[send_message_with_files] Attachment uploaded: {attachment}")
                    attachments.append(attachment)
                except ValueError as e:
                    print(f"[send_message_with_files] Upload error: {e}")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=str(e)
                    )

    print(f"[send_message_with_files] Total attachments: {len(attachments)}")
    print(f"[send_message_with_files] Attachments list: {attachments}")

    # Determine message type based on attachments
    msg_type = message_type
    if attachments and not content:
        if attachments[0]["file_type"] and attachments[0]["file_type"].startswith("image/"):
            msg_type = "image"
        else:
            msg_type = "file"

    is_external = conversation.scope in ['external', 'cross_tenant']

    print(f"[send_message_with_files] Calling chat_service.send_message with {len(attachments)} attachments")

    # Get latest avatar from database (in case user updated their profile)
    sender_avatar = await get_user_avatar_from_db(db, str(ctx["user_id"])) or ctx["avatar"]

    message = await chat_service.send_message(
        db=db,
        conversation_id=conversation_id,
        sender_id=ctx["user_id"],
        sender_name=ctx["name"],
        sender_avatar=sender_avatar,
        sender_tenant_id=ctx["tenant_id"],
        is_external_sender=is_external,
        content=content or "",
        message_type=msg_type,
        reply_to_id=UUID(reply_to_id) if reply_to_id else None,
        attachments=attachments,
    )

    print(f"[send_message_with_files] Message created: {message.id}, attachments count: {len(message.attachments) if message.attachments else 0}")

    return message.to_dict()


@router.put("/conversations/{conversation_id}/messages/{message_id}", response_model=MessageResponse)
async def edit_message(
    conversation_id: UUID,
    message_id: UUID,
    data: EditMessageRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Edit a message (only by sender)."""
    ctx = get_user_context(current_user)

    message = await chat_service.edit_message(
        db=db,
        message_id=message_id,
        user_id=ctx["user_id"],
        new_content=data.content,
    )

    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found or not authorized"
        )

    return message.to_dict()


@router.delete("/conversations/{conversation_id}/messages/{message_id}")
async def delete_message(
    conversation_id: UUID,
    message_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a message (only by sender)."""
    ctx = get_user_context(current_user)

    success = await chat_service.delete_message(
        db=db,
        message_id=message_id,
        user_id=ctx["user_id"],
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found or not authorized"
        )

    return {"success": True}


@router.post("/conversations/{conversation_id}/messages/{message_id}/react")
async def add_reaction(
    conversation_id: UUID,
    message_id: UUID,
    data: ReactionRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add or toggle a reaction on a message."""
    ctx = get_user_context(current_user)

    reactions = await chat_service.add_reaction(
        db=db,
        message_id=message_id,
        user_id=ctx["user_id"],
        emoji=data.emoji,
    )

    return {"reactions": reactions}


# ===========================================
# PRESENCE ENDPOINTS
# ===========================================

@router.post("/presence/heartbeat")
async def presence_heartbeat(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update user's last seen timestamp.
    Call this periodically (e.g., every 30 seconds) to maintain online status.
    """
    ctx = get_user_context(current_user)

    await chat_service.update_last_seen(
        db=db,
        user_id=ctx["user_id"],
        tenant_id=ctx["tenant_id"],
    )

    return {"success": True}


@router.get("/conversations/{conversation_id}/presence")
async def get_conversation_presence(
    conversation_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get presence (last seen, online status) for all participants in a conversation.
    A user is considered online if last_seen_at is within 2 minutes.
    """
    ctx = get_user_context(current_user)

    # Verify user is participant
    conversation = await chat_service.get_conversation(
        db=db,
        conversation_id=conversation_id,
        user_id=ctx["user_id"],
    )

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    presence = await chat_service.get_conversation_presence(
        db=db,
        conversation_id=conversation_id,
        user_id=ctx["user_id"],
    )

    return {"participants": presence}


# ===========================================
# DELIVERY TRACKING ENDPOINTS
# ===========================================

class MarkDeliveredRequest(BaseModel):
    message_ids: Optional[List[str]] = None


@router.post("/conversations/{conversation_id}/delivered")
async def mark_messages_delivered(
    conversation_id: UUID,
    data: MarkDeliveredRequest = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Mark messages as delivered to the current user.
    If message_ids not provided, marks all undelivered messages.
    """
    ctx = get_user_context(current_user)

    message_ids = None
    if data and data.message_ids:
        message_ids = [UUID(mid) for mid in data.message_ids]

    count = await chat_service.mark_as_delivered(
        db=db,
        conversation_id=conversation_id,
        user_id=ctx["user_id"],
        message_ids=message_ids,
    )

    return {"success": True, "updated_count": count}


# ===========================================
# READ RECEIPTS ENDPOINTS
# ===========================================

@router.post("/conversations/{conversation_id}/read")
async def mark_as_read(
    conversation_id: UUID,
    message_id: Optional[UUID] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Mark conversation as read up to a specific message.
    Also updates message-level read_by arrays (respects privacy settings).
    """
    ctx = get_user_context(current_user)

    # Check user's privacy setting for read receipts
    from models.settings_models import UserSettings
    from sqlalchemy import select

    read_receipts_enabled = True
    settings_query = select(UserSettings).where(UserSettings.user_id == ctx["user_id"])
    settings_result = await db.execute(settings_query)
    settings = settings_result.scalar_one_or_none()
    if settings and settings.read_receipts_enabled is not None:
        read_receipts_enabled = settings.read_receipts_enabled

    marked_ids = await chat_service.mark_messages_as_read(
        db=db,
        conversation_id=conversation_id,
        user_id=ctx["user_id"],
        message_id=message_id,
        read_receipts_enabled=read_receipts_enabled,
    )

    return {"success": True, "marked_message_ids": marked_ids}


class ReadReceiptUser(BaseModel):
    user_id: str
    user_name: str
    user_avatar: Optional[str] = None
    last_read_at: Optional[str] = None


class MessageReadReceiptsResponse(BaseModel):
    message_id: str
    sender_id: str
    delivered_to: List[ReadReceiptUser]
    read_by: List[ReadReceiptUser]
    total_delivered: int
    total_read: int
    total_participants: int


@router.get("/messages/{message_id}/read-receipts", response_model=MessageReadReceiptsResponse)
async def get_message_read_receipts(
    message_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get detailed read receipts for a specific message.
    Shows who has received and who has read the message.
    """
    ctx = get_user_context(current_user)

    # Get the message to find conversation_id
    from models.chat_models import DirectMessage
    message = await db.get(DirectMessage, message_id)
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )

    # Verify user is participant in conversation
    conversation = await chat_service.get_conversation(
        db=db,
        conversation_id=message.conversation_id,
        user_id=ctx["user_id"],
    )

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this message"
        )

    receipts = await chat_service.get_message_read_receipts(
        db=db,
        message_id=message_id,
        conversation_id=message.conversation_id,
    )

    if not receipts:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Read receipts not found"
        )

    return receipts


@router.get("/unread")
async def get_unread_counts(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get unread message counts for all conversations."""
    ctx = get_user_context(current_user)

    total, counts = await chat_service.get_unread_counts(
        db=db,
        user_id=ctx["user_id"],
    )

    return {
        "total": total,
        "conversations": counts,
    }


# ===========================================
# EXTERNAL CONTACTS ENDPOINTS
# ===========================================

@router.get("/contacts", response_model=List[ExternalContactResponse])
async def list_external_contacts(
    search: Optional[str] = Query(None),
    tags: Optional[List[str]] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List external contacts for the current workspace.

    Only returns contacts owned by your workspace.
    Use this for the Clients tab when starting new external chats.
    """
    ctx = get_user_context(current_user)

    contacts = await chat_service.get_external_contacts(
        db=db,
        tenant_id=ctx["tenant_id"],
        search=search,
        tags=tags,
        limit=limit,
        offset=offset,
    )

    return [c.to_dict() for c in contacts]


@router.post("/contacts", response_model=ExternalContactResponse)
@limiter.limit("30/minute")
async def create_external_contact(
    request: Request,
    data: CreateExternalContactRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new external contact.

    External contacts are people outside your workspace that you want to chat with.
    """
    ctx = get_user_context(current_user)

    try:
        contact = await chat_service.create_external_contact(
            db=db,
            owner_tenant_id=ctx["tenant_id"],
            created_by=ctx["user_id"],
            email=data.email,
            name=data.name,
            company_name=data.company_name,
            phone=data.phone,
            job_title=data.job_title,
            notes=data.notes,
            tags=data.tags,
        )
        return contact.to_dict()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/contacts/{contact_id}", response_model=ExternalContactResponse)
async def get_external_contact(
    contact_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific external contact."""
    ctx = get_user_context(current_user)

    contact = await chat_service.get_external_contact(
        db=db,
        contact_id=contact_id,
        tenant_id=ctx["tenant_id"],
    )

    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found"
        )

    return contact.to_dict()


@router.put("/contacts/{contact_id}", response_model=ExternalContactResponse)
async def update_external_contact(
    contact_id: UUID,
    data: UpdateExternalContactRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an external contact."""
    ctx = get_user_context(current_user)

    contact = await chat_service.update_external_contact(
        db=db,
        contact_id=contact_id,
        tenant_id=ctx["tenant_id"],
        name=data.name,
        company_name=data.company_name,
        phone=data.phone,
        job_title=data.job_title,
        notes=data.notes,
        tags=data.tags,
    )

    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found"
        )

    return contact.to_dict()


# ===========================================
# INVITATIONS ENDPOINTS
# ===========================================

@router.post("/invitations", response_model=InvitationResponse)
@limiter.limit("20/minute")
async def create_invitation(
    request: Request,
    data: CreateInvitationRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create an invitation for an external user to join a conversation.

    The invitation will be sent via email with a unique token.
    """
    ctx = get_user_context(current_user)

    # Verify user has access to conversation
    conversation = await chat_service.get_conversation(
        db=db,
        conversation_id=UUID(data.conversation_id),
        user_id=ctx["user_id"],
    )

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    invitation = await chat_service.create_invitation(
        db=db,
        conversation_id=UUID(data.conversation_id),
        inviter_id=ctx["user_id"],
        inviter_name=ctx["name"],
        inviter_tenant_id=ctx["tenant_id"],
        inviter_tenant_name=current_user.get("tenant_name", ""),
        invitee_email=data.email,
        invitee_name=data.name,
        message=data.message,
    )

    return invitation.to_dict()


@router.post("/invitations/accept", response_model=ConversationResponse)
async def accept_invitation(
    data: AcceptInvitationRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Accept a chat invitation.

    The user's account will be linked and they'll be added to the conversation.
    """
    ctx = get_user_context(current_user)

    conversation = await chat_service.accept_invitation(
        db=db,
        token=data.token,
        user_id=ctx["user_id"],
        user_name=ctx["name"],
        user_email=ctx["email"],
        tenant_id=ctx["tenant_id"],
    )

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired invitation"
        )

    return conversation.to_dict(current_user_id=ctx["user_id"])


@router.post("/invitations/decline")
async def decline_invitation(
    data: AcceptInvitationRequest,
    db: AsyncSession = Depends(get_db),
):
    """Decline a chat invitation."""
    success = await chat_service.decline_invitation(
        db=db,
        token=data.token,
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired invitation"
        )

    return {"success": True}


# ===========================================
# CALLS ENDPOINTS
# ===========================================

@router.post("/calls/initiate", response_model=CallResponse)
@limiter.limit("20/minute")
async def initiate_call(
    request: Request,
    data: InitiateCallRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Initiate an audio or video call.

    Returns call details including LiveKit room name.
    """
    ctx = get_user_context(current_user)

    # Verify access to conversation
    conversation = await chat_service.get_conversation(
        db=db,
        conversation_id=UUID(data.conversation_id),
        user_id=ctx["user_id"],
    )

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    # Check for existing active call
    active_call = await chat_service.get_active_call(
        db=db,
        conversation_id=UUID(data.conversation_id),
    )

    if active_call:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="There is already an active call in this conversation"
        )

    call = await chat_service.initiate_call(
        db=db,
        conversation_id=UUID(data.conversation_id),
        caller_id=ctx["user_id"],
        caller_name=ctx["name"],
        caller_tenant_id=ctx["tenant_id"],
        call_type=data.call_type,
    )

    return call.to_dict()


@router.post("/calls/{call_id}/answer", response_model=CallResponse)
async def answer_call(
    call_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Answer an incoming call."""
    ctx = get_user_context(current_user)

    call = await chat_service.answer_call(
        db=db,
        call_id=call_id,
        user_id=ctx["user_id"],
        user_name=ctx["name"],
        tenant_id=ctx["tenant_id"],
    )

    if not call:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Call not found or already answered"
        )

    return call.to_dict()


@router.post("/calls/{call_id}/end", response_model=CallResponse)
async def end_call(
    call_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """End an ongoing call."""
    ctx = get_user_context(current_user)

    call = await chat_service.end_call(
        db=db,
        call_id=call_id,
        user_id=ctx["user_id"],
    )

    if not call:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Call not found"
        )

    return call.to_dict()


@router.post("/calls/{call_id}/decline", response_model=CallResponse)
async def decline_call(
    call_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Decline an incoming call."""
    ctx = get_user_context(current_user)

    call = await chat_service.decline_call(
        db=db,
        call_id=call_id,
        user_id=ctx["user_id"],
    )

    if not call:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Call not found or not ringing"
        )

    return call.to_dict()


@router.get("/calls/{call_id}", response_model=CallResponse)
async def get_call(
    call_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get call details."""
    call = await chat_service.get_call(db=db, call_id=call_id)

    if not call:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Call not found"
        )

    return call.to_dict()


@router.post("/calls/{call_id}/token", response_model=CallTokenResponse)
async def get_call_token(
    call_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get LiveKit token for joining a call."""
    ctx = get_user_context(current_user)

    call = await chat_service.get_call(db=db, call_id=call_id)

    if not call:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Call not found"
        )

    # Verify user is participant in the conversation
    conversation = await chat_service.get_conversation(
        db=db,
        conversation_id=call.conversation_id,
        user_id=ctx["user_id"],
    )

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to join this call"
        )

    is_caller = str(call.caller_id) == str(ctx["user_id"])
    is_external = conversation.scope in ['external', 'cross_tenant']

    token = chat_service.get_call_token(
        call_room_name=call.room_name,
        user_id=str(ctx["user_id"]),
        user_name=ctx["name"],
        is_caller=is_caller,
        is_external=is_external,
    )

    return {
        "token": token,
        "ws_url": chat_service.get_ws_url(),
        "room_name": call.room_name,
    }


@router.get("/conversations/{conversation_id}/calls/active", response_model=Optional[CallResponse])
async def get_active_call(
    conversation_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get active call for a conversation if any."""
    call = await chat_service.get_active_call(
        db=db,
        conversation_id=conversation_id,
    )

    if not call:
        return None

    return call.to_dict()


@router.get("/conversations/{conversation_id}/calls/history", response_model=List[CallResponse])
async def get_call_history(
    conversation_id: UUID,
    limit: int = Query(20, ge=1, le=50),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get call history for a conversation."""
    calls = await chat_service.get_call_history(
        db=db,
        conversation_id=conversation_id,
        limit=limit,
    )

    return [c.to_dict() for c in calls]


# ===========================================
# TEAM MEMBERS ENDPOINTS (Internal Search)
# ===========================================

@router.get("/team/search", response_model=List[TeamMemberResponse])
async def search_team_members(
    q: str = Query("", description="Search query (empty returns all)"),
    exclude: Optional[List[str]] = Query(None, description="User IDs to exclude"),
    limit: int = Query(20, ge=1, le=50),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Search team members within your workspace.

    This only returns users from YOUR workspace (Team tab).
    Cannot see users from other workspaces.
    Pass empty query to get all team members.
    """
    ctx = get_user_context(current_user)

    exclude_ids = [UUID(uid) for uid in exclude] if exclude else None

    # Use None for empty search to get all members
    search_query = q.strip() if q and q.strip() else None

    members = await chat_service.search_team_members(
        db=db,
        tenant_id=ctx["tenant_id"],
        search=search_query,
        exclude_user_ids=exclude_ids,
        limit=limit,
    )

    return members


# ===========================================
# FILE UPLOAD ENDPOINTS
# ===========================================

@router.post("/conversations/{conversation_id}/upload")
@limiter.limit("30/minute")
async def upload_file(
    request: Request,
    conversation_id: UUID,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a file for a conversation.

    Returns file details for use in send_message_with_files.
    """
    ctx = get_user_context(current_user)

    # Verify access
    conversation = await chat_service.get_conversation(
        db=db,
        conversation_id=conversation_id,
        user_id=ctx["user_id"],
    )

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    file_content = await file.read()

    try:
        result = await chat_file_service.upload_chat_attachment(
            file_content=file_content,
            file_name=file.filename or "unnamed",
            content_type=file.content_type or "application/octet-stream",
            conversation_id=str(conversation_id),
            user_id=str(ctx["user_id"]),
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
