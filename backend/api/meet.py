"""
Bheem Workspace - Meet API (LiveKit Integration)
Video conferencing rooms, tokens, and recording management
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid

from core.database import get_db
from core.security import get_current_user, get_optional_user
from core.config import settings
from services.livekit_service import livekit_service
from integrations.notify import notify_client

router = APIRouter(prefix="/meet", tags=["Bheem Meet"])

# Schemas
class CreateRoomRequest(BaseModel):
    name: str
    scheduled_time: Optional[datetime] = None
    duration_minutes: Optional[int] = 60
    description: Optional[str] = None
    max_participants: Optional[int] = 100
    participants: Optional[List[str]] = None  # Email addresses to invite
    send_invites: bool = True  # Whether to send email invites

class CreateRoomResponse(BaseModel):
    room_id: str
    room_code: str
    name: str
    join_url: str
    host_token: str
    ws_url: str
    created_at: datetime

class JoinRoomRequest(BaseModel):
    room_code: str
    participant_name: str

class JoinRoomResponse(BaseModel):
    token: str
    ws_url: str
    room_code: str
    room_name: str

class RoomInfo(BaseModel):
    id: str
    room_code: str
    name: str
    status: str
    join_url: str
    created_by: Optional[str]
    created_at: datetime
    scheduled_time: Optional[datetime]
    participant_count: int = 0

# Endpoints
@router.post("/rooms", response_model=CreateRoomResponse)
async def create_room(
    request: CreateRoomRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new meeting room"""
    room_id = str(uuid.uuid4())
    room_code = livekit_service.generate_room_code()
    
    # Generate host token
    host_token = livekit_service.create_token(
        room_name=room_code,
        participant_identity=current_user["id"],
        participant_name=current_user["username"],
        is_host=True
    )
    
    # Store room in database
    try:
        await db.execute(
            text("""
                INSERT INTO workspace.meet_rooms
                (id, room_name, room_code, host_id, host_name, status,
                 scheduled_start, max_participants, created_at, updated_at)
                VALUES (:id, :room_name, :room_code, :host_id, :host_name,
                        'scheduled', :scheduled_start, :max_participants, NOW(), NOW())
            """),
            {
                "id": room_id,
                "room_name": request.name,
                "room_code": room_code,
                "host_id": current_user["id"],
                "host_name": current_user.get("username"),
                "scheduled_start": request.scheduled_time,
                "max_participants": request.max_participants or 100
            }
        )
        await db.commit()
    except Exception as e:
        print(f"Warning: Could not save room to DB: {e}")
        # Continue even if DB save fails
    
    join_url = livekit_service.get_join_url(room_code)

    # Send meeting invites to participants
    invites_sent = []
    if request.send_invites and request.participants:
        host_name = current_user.get("username", "Host")
        meeting_time = request.scheduled_time.strftime("%B %d, %Y at %I:%M %p") if request.scheduled_time else "Now"

        for participant_email in request.participants:
            try:
                result = await notify_client.send_meeting_invite(
                    to=participant_email,
                    meeting_title=request.name,
                    meeting_time=meeting_time,
                    meeting_url=join_url,
                    host_name=host_name,
                    attendees=request.participants
                )
                if not result.get("error"):
                    invites_sent.append(participant_email)
            except Exception as e:
                print(f"Failed to send meeting invite to {participant_email}: {e}")

    response = CreateRoomResponse(
        room_id=room_id,
        room_code=room_code,
        name=request.name,
        join_url=join_url,
        host_token=host_token,
        ws_url=livekit_service.get_ws_url(),
        created_at=datetime.utcnow()
    )

    # Log invites sent
    if invites_sent:
        print(f"Meeting invites sent to: {invites_sent}")

    return response

@router.post("/token", response_model=JoinRoomResponse)
async def get_join_token(
    request: JoinRoomRequest,
    current_user: Optional[dict] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a token to join a meeting room (works for guests too)"""
    room_code = request.room_code
    
    # Try to find room in database
    room_name = request.room_code  # Default to room code
    try:
        result = await db.execute(
            text("SELECT room_name FROM workspace.meet_rooms WHERE room_code = :room_code"),
            {"room_code": room_code}
        )
        room = result.fetchone()
        if room:
            room_name = room.room_name
    except:
        pass
    
    # Generate participant identity
    if current_user:
        participant_identity = current_user["id"]
        participant_name = current_user["username"]
        is_host = False  # Check if user is the room creator for host privileges
    else:
        participant_identity = f"guest-{uuid.uuid4().hex[:8]}"
        participant_name = request.participant_name
        is_host = False
    
    # Generate token
    token = livekit_service.create_token(
        room_name=room_code,
        participant_identity=participant_identity,
        participant_name=participant_name,
        is_host=is_host
    )
    
    return JoinRoomResponse(
        token=token,
        ws_url=livekit_service.get_ws_url(),
        room_code=room_code,
        room_name=room_name
    )

@router.get("/rooms", response_model=List[RoomInfo])
async def list_rooms(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List meeting rooms for current user"""
    try:
        query = """
            SELECT id, room_code, room_name, status, host_id, created_at, scheduled_start
            FROM workspace.meet_rooms
            WHERE host_id = :user_id
        """
        params = {
            "user_id": current_user["id"]
        }

        if status:
            query += " AND status = :status"
            params["status"] = status

        query += " ORDER BY created_at DESC LIMIT 50"

        result = await db.execute(text(query), params)
        rooms = result.fetchall()

        return [
            RoomInfo(
                id=str(room.id),
                room_code=room.room_code,
                name=room.room_name,
                status=room.status,
                join_url=livekit_service.get_join_url(room.room_code),
                created_by=str(room.host_id) if room.host_id else None,
                created_at=room.created_at,
                scheduled_time=room.scheduled_start,
                participant_count=0
            )
            for room in rooms
        ]
    except Exception as e:
        print(f"Error listing rooms: {e}")
        return []

@router.get("/rooms/{room_code}")
async def get_room(
    room_code: str,
    current_user: Optional[dict] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    """Get room info by code"""
    try:
        result = await db.execute(
            text("""
                SELECT id, room_code, room_name, status, host_id, created_at, scheduled_start, max_participants
                FROM workspace.meet_rooms
                WHERE room_code = :room_code
            """),
            {"room_code": room_code}
        )
        room = result.fetchone()

        if not room:
            # Room not in DB, but might exist in LiveKit
            return {
                "room_code": room_code,
                "name": room_code,
                "status": "active",
                "join_url": livekit_service.get_join_url(room_code),
                "ws_url": livekit_service.get_ws_url()
            }

        return {
            "id": str(room.id),
            "room_code": room.room_code,
            "name": room.room_name,
            "status": room.status,
            "join_url": livekit_service.get_join_url(room.room_code),
            "ws_url": livekit_service.get_ws_url(),
            "created_at": room.created_at,
            "scheduled_time": room.scheduled_start,
            "max_participants": room.max_participants
        }
    except Exception as e:
        print(f"Error getting room: {e}")
        return {
            "room_code": room_code,
            "name": room_code,
            "status": "active",
            "join_url": livekit_service.get_join_url(room_code),
            "ws_url": livekit_service.get_ws_url()
        }

@router.post("/rooms/{room_code}/end")
async def end_room(
    room_code: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """End a meeting room"""
    try:
        await db.execute(
            text("""
                UPDATE workspace.meet_rooms
                SET status = 'ended', actual_end = NOW(), updated_at = NOW()
                WHERE room_code = :room_code AND host_id = :user_id
            """),
            {"room_code": room_code, "user_id": current_user["id"]}
        )
        await db.commit()
    except Exception as e:
        print(f"Error ending room: {e}")

    return {"message": "Room ended", "room_code": room_code}

@router.get("/config")
async def get_meet_config():
    """Get Meet configuration for frontend"""
    return {
        "ws_url": livekit_service.get_ws_url(),
        "workspace_url": settings.WORKSPACE_URL,
        "max_participants": 100,
        "recording_enabled": True
    }
