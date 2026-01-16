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
        host_email = current_user.get("email")
        meeting_time = request.scheduled_time.strftime("%B %d, %Y at %I:%M %p") if request.scheduled_time else "Starting now"
        scheduled_start_iso = request.scheduled_time.isoformat() if request.scheduled_time else None

        for participant_email in request.participants:
            try:
                result = await notify_client.send_meeting_invite(
                    to=participant_email,
                    meeting_title=request.name,
                    meeting_time=meeting_time,
                    meeting_url=join_url,
                    host_name=host_name,
                    host_email=host_email,
                    attendees=request.participants,
                    scheduled_start=scheduled_start_iso,
                    duration_minutes=request.duration_minutes or 60,
                    room_code=room_code,
                    description=request.description
                )
                if not result.get("error"):
                    invites_sent.append(participant_email)
            except Exception as e:
                print(f"Failed to send meeting invite to {participant_email}: {e}")

    # Create calendar event for scheduled meetings
    if request.scheduled_time:
        try:
            # Create calendar event for host
            await _create_meeting_calendar_event(
                db=db,
                user_id=current_user.get("id"),
                meeting_title=request.name,
                meeting_description=request.description or f"Join at: {join_url}",
                scheduled_start=request.scheduled_time,
                duration_minutes=request.duration_minutes or 60,
                meeting_url=join_url,
                room_code=room_code,
                attendees=request.participants or []
            )
        except Exception as e:
            print(f"Failed to create calendar event: {e}")

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

@router.get("/rooms/{room_code}/info")
async def get_room_info_public(
    room_code: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get public room info for Open Graph meta tags (no auth required).
    Used for link previews when sharing meeting links.
    """
    try:
        result = await db.execute(
            text("""
                SELECT room_name, host_name, scheduled_start, max_participants
                FROM workspace.meet_rooms
                WHERE room_code = :room_code
            """),
            {"room_code": room_code}
        )
        room = result.fetchone()

        if not room:
            return {
                "room_code": room_code,
                "name": "Video Meeting",
                "host_name": None,
                "scheduled_time": None,
            }

        return {
            "room_code": room_code,
            "name": room.room_name or "Video Meeting",
            "host_name": room.host_name,
            "scheduled_time": room.scheduled_start,
            "max_participants": room.max_participants
        }
    except Exception as e:
        print(f"Error getting public room info: {e}")
        return {
            "room_code": room_code,
            "name": "Video Meeting",
            "host_name": None,
            "scheduled_time": None,
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
        "recording_enabled": True,
        "breakout_rooms_enabled": True
    }


# ═══════════════════════════════════════════════════════════════════════════════
# BREAKOUT ROOMS
# ═══════════════════════════════════════════════════════════════════════════════

class BreakoutGroup(BaseModel):
    """A breakout room group with participants."""
    name: str
    participants: List[dict]  # List of {"identity": "...", "name": "..."}


class CreateBreakoutRequest(BaseModel):
    """Request to create breakout rooms."""
    groups: List[BreakoutGroup]


class BreakoutRoomResponse(BaseModel):
    """Breakout room info."""
    breakout_code: str
    breakout_name: str
    parent_room: str
    tokens: List[dict]
    participant_count: int


@router.post("/rooms/{room_code}/breakout")
async def create_breakout_rooms(
    room_code: str,
    request: CreateBreakoutRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create breakout rooms from main meeting.

    Only the host can create breakout rooms.
    Returns tokens for each participant to join their breakout room.
    """
    # Verify user is host
    result = await db.execute(
        text("""
            SELECT host_id FROM workspace.meet_rooms
            WHERE room_code = :room_code
        """),
        {"room_code": room_code}
    )
    room = result.fetchone()

    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )

    if str(room.host_id) != str(current_user.get("id")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the host can create breakout rooms"
        )

    # Create breakout rooms
    groups = [
        {"name": g.name, "participants": g.participants}
        for g in request.groups
    ]

    breakout_result = await livekit_service.create_breakout_rooms(
        parent_room=room_code,
        groups=groups
    )

    # Store breakout rooms in database
    for br in breakout_result.get("breakout_rooms", []):
        try:
            await db.execute(
                text("""
                    INSERT INTO workspace.meet_rooms
                    (id, room_name, room_code, host_id, host_name, status,
                     parent_room_code, is_breakout, created_at, updated_at)
                    VALUES (:id, :room_name, :room_code, :host_id, :host_name,
                            'active', :parent_room, TRUE, NOW(), NOW())
                """),
                {
                    "id": str(uuid.uuid4()),
                    "room_name": br.get("breakout_name"),
                    "room_code": br.get("breakout_code"),
                    "host_id": current_user.get("id"),
                    "host_name": current_user.get("username"),
                    "parent_room": room_code
                }
            )
        except Exception as e:
            print(f"Error storing breakout room: {e}")

    await db.commit()

    return breakout_result


@router.post("/rooms/{room_code}/breakout/close")
async def close_breakout_rooms(
    room_code: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Close all breakout rooms and send participants back to main room.

    Returns tokens for all participants to rejoin the main room.
    """
    # Verify user is host
    result = await db.execute(
        text("""
            SELECT host_id FROM workspace.meet_rooms
            WHERE room_code = :room_code
        """),
        {"room_code": room_code}
    )
    room = result.fetchone()

    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )

    if str(room.host_id) != str(current_user.get("id")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the host can close breakout rooms"
        )

    # Get all breakout rooms
    breakout_result = await db.execute(
        text("""
            SELECT room_code, room_name FROM workspace.meet_rooms
            WHERE parent_room_code = :parent_code AND is_breakout = TRUE
        """),
        {"parent_code": room_code}
    )
    breakout_rooms = breakout_result.fetchall()

    # Close breakout rooms in database
    await db.execute(
        text("""
            UPDATE workspace.meet_rooms
            SET status = 'ended', ended_at = NOW()
            WHERE parent_room_code = :parent_code AND is_breakout = TRUE
        """),
        {"parent_code": room_code}
    )
    await db.commit()

    return {
        "success": True,
        "message": "Breakout rooms closed",
        "parent_room": room_code,
        "closed_rooms": [r.room_code for r in breakout_rooms],
        "return_url": f"{settings.WORKSPACE_URL}/meet/room/{room_code}"
    }


@router.get("/rooms/{room_code}/breakout")
async def list_breakout_rooms(
    room_code: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List active breakout rooms for a meeting.
    """
    result = await db.execute(
        text("""
            SELECT id, room_code, room_name, status, created_at
            FROM workspace.meet_rooms
            WHERE parent_room_code = :parent_code
            AND is_breakout = TRUE
            AND status != 'ended'
        """),
        {"parent_code": room_code}
    )
    breakout_rooms = result.fetchall()

    return {
        "parent_room": room_code,
        "breakout_rooms": [
            {
                "id": str(r.id),
                "room_code": r.room_code,
                "name": r.room_name,
                "status": r.status,
                "join_url": f"{settings.WORKSPACE_URL}/meet/room/{r.room_code}",
                "created_at": r.created_at.isoformat() if r.created_at else None
            }
            for r in breakout_rooms
        ],
        "count": len(breakout_rooms)
    }


@router.post("/rooms/{room_code}/return-token")
async def get_return_token(
    room_code: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get a token to return from breakout room to main room.
    """
    token = livekit_service.create_return_token(
        parent_room=room_code,
        participant_identity=str(current_user.get("id")),
        participant_name=current_user.get("username", "Participant")
    )

    return {
        "token": token,
        "room_code": room_code,
        "ws_url": livekit_service.get_ws_url(),
        "join_url": f"{settings.WORKSPACE_URL}/meet/room/{room_code}"
    }


# =============================================================================
# Meeting Attendance Tracking
# =============================================================================

class AttendanceRecord(BaseModel):
    participant_id: str
    participant_name: str
    participant_email: Optional[str] = None
    join_time: datetime
    leave_time: Optional[datetime] = None
    duration_minutes: Optional[float] = None
    is_host: bool = False


class AttendanceReport(BaseModel):
    room_code: str
    room_name: str
    meeting_start: Optional[datetime] = None
    meeting_end: Optional[datetime] = None
    total_duration_minutes: Optional[float] = None
    total_participants: int
    max_concurrent: int
    attendees: List[AttendanceRecord]


@router.post("/rooms/{room_code}/attendance/join")
async def record_participant_join(
    room_code: str,
    participant_name: Optional[str] = None,
    current_user: dict = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Record when a participant joins a meeting.
    Called automatically when someone enters the room.
    """
    user_id = current_user.get("id") if current_user else str(uuid.uuid4())
    user_name = participant_name or (current_user.get("username") if current_user else "Guest")
    user_email = current_user.get("email") if current_user else None

    # Check if room exists
    result = await db.execute(
        text("SELECT id, host_id FROM workspace.meet_rooms WHERE room_code = :room_code"),
        {"room_code": room_code}
    )
    room = result.fetchone()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    is_host = str(room.host_id) == str(user_id) if room.host_id else False

    # Record attendance
    attendance_id = str(uuid.uuid4())
    try:
        await db.execute(
            text("""
                INSERT INTO workspace.meeting_attendance
                (id, room_code, participant_id, participant_name, participant_email,
                 join_time, is_host, created_at)
                VALUES (:id, :room_code, :participant_id, :participant_name,
                        :participant_email, NOW(), :is_host, NOW())
            """),
            {
                "id": attendance_id,
                "room_code": room_code,
                "participant_id": user_id,
                "participant_name": user_name,
                "participant_email": user_email,
                "is_host": is_host
            }
        )
        await db.commit()
    except Exception as e:
        # Might fail if table doesn't exist yet
        pass

    return {
        "status": "joined",
        "attendance_id": attendance_id,
        "room_code": room_code,
        "participant_name": user_name,
        "join_time": datetime.utcnow().isoformat()
    }


@router.post("/rooms/{room_code}/attendance/leave")
async def record_participant_leave(
    room_code: str,
    attendance_id: Optional[str] = None,
    current_user: dict = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Record when a participant leaves a meeting.
    Called automatically when someone exits the room.
    """
    user_id = current_user.get("id") if current_user else None

    try:
        if attendance_id:
            # Update specific attendance record
            await db.execute(
                text("""
                    UPDATE workspace.meeting_attendance
                    SET leave_time = NOW(),
                        duration_minutes = EXTRACT(EPOCH FROM (NOW() - join_time)) / 60
                    WHERE id = :attendance_id AND leave_time IS NULL
                """),
                {"attendance_id": attendance_id}
            )
        elif user_id:
            # Update by user_id (most recent join without leave)
            await db.execute(
                text("""
                    UPDATE workspace.meeting_attendance
                    SET leave_time = NOW(),
                        duration_minutes = EXTRACT(EPOCH FROM (NOW() - join_time)) / 60
                    WHERE room_code = :room_code
                    AND participant_id = :user_id
                    AND leave_time IS NULL
                    ORDER BY join_time DESC
                    LIMIT 1
                """),
                {"room_code": room_code, "user_id": user_id}
            )
        await db.commit()
    except Exception:
        pass

    return {
        "status": "left",
        "room_code": room_code,
        "leave_time": datetime.utcnow().isoformat()
    }


@router.get("/rooms/{room_code}/attendance", response_model=AttendanceReport)
async def get_attendance_report(
    room_code: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get attendance report for a meeting.
    Only the host or room creator can access this.
    """
    # Get room info
    result = await db.execute(
        text("""
            SELECT id, room_name, host_id, created_at
            FROM workspace.meet_rooms
            WHERE room_code = :room_code
        """),
        {"room_code": room_code}
    )
    room = result.fetchone()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    # Check if user is host
    user_id = current_user.get("id")
    if str(room.host_id) != str(user_id):
        raise HTTPException(
            status_code=403,
            detail="Only the host can view attendance report"
        )

    # Get attendance records
    try:
        attendance_result = await db.execute(
            text("""
                SELECT id, participant_id, participant_name, participant_email,
                       join_time, leave_time, duration_minutes, is_host
                FROM workspace.meeting_attendance
                WHERE room_code = :room_code
                ORDER BY join_time ASC
            """),
            {"room_code": room_code}
        )
        records = attendance_result.fetchall()
    except Exception:
        records = []

    # Build attendance report
    attendees = []
    for record in records:
        duration = record.duration_minutes
        if duration is None and record.leave_time and record.join_time:
            duration = (record.leave_time - record.join_time).total_seconds() / 60

        attendees.append(AttendanceRecord(
            participant_id=str(record.participant_id),
            participant_name=record.participant_name or "Unknown",
            participant_email=record.participant_email,
            join_time=record.join_time,
            leave_time=record.leave_time,
            duration_minutes=round(duration, 2) if duration else None,
            is_host=record.is_host
        ))

    # Calculate meeting stats
    meeting_start = min((a.join_time for a in attendees), default=None)
    meeting_end = max((a.leave_time for a in attendees if a.leave_time), default=None)
    total_duration = None
    if meeting_start and meeting_end:
        total_duration = (meeting_end - meeting_start).total_seconds() / 60

    # Calculate max concurrent participants
    max_concurrent = 0
    if attendees:
        # Simple approximation: count all participants
        max_concurrent = len(set(a.participant_id for a in attendees))

    return AttendanceReport(
        room_code=room_code,
        room_name=room.room_name or room_code,
        meeting_start=meeting_start,
        meeting_end=meeting_end,
        total_duration_minutes=round(total_duration, 2) if total_duration else None,
        total_participants=len(set(a.participant_id for a in attendees)),
        max_concurrent=max_concurrent,
        attendees=attendees
    )


@router.get("/rooms/{room_code}/attendance/export")
async def export_attendance(
    room_code: str,
    format: str = "csv",
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Export attendance report as CSV or JSON.
    """
    from fastapi.responses import StreamingResponse
    import io

    # Get attendance report (reuse the report function)
    report = await get_attendance_report(room_code, current_user, db)

    if format == "csv":
        # Generate CSV
        output = io.StringIO()
        output.write("Participant Name,Email,Join Time,Leave Time,Duration (minutes),Is Host\n")

        for attendee in report.attendees:
            output.write(
                f'"{attendee.participant_name}",'
                f'"{attendee.participant_email or ""}",'
                f'{attendee.join_time.isoformat() if attendee.join_time else ""},'
                f'{attendee.leave_time.isoformat() if attendee.leave_time else ""},'
                f'{attendee.duration_minutes or ""},'
                f'{attendee.is_host}\n'
            )

        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=attendance_{room_code}.csv"
            }
        )
    else:
        # Return JSON
        return {
            "room_code": report.room_code,
            "room_name": report.room_name,
            "meeting_start": report.meeting_start.isoformat() if report.meeting_start else None,
            "meeting_end": report.meeting_end.isoformat() if report.meeting_end else None,
            "total_duration_minutes": report.total_duration_minutes,
            "total_participants": report.total_participants,
            "attendees": [
                {
                    "name": a.participant_name,
                    "email": a.participant_email,
                    "join_time": a.join_time.isoformat() if a.join_time else None,
                    "leave_time": a.leave_time.isoformat() if a.leave_time else None,
                    "duration_minutes": a.duration_minutes,
                    "is_host": a.is_host
                }
                for a in report.attendees
            ]
        }


# =============================================================================
# Calendar Integration Helper
# =============================================================================

async def _create_meeting_calendar_event(
    db: AsyncSession,
    user_id: str,
    meeting_title: str,
    meeting_description: str,
    scheduled_start: datetime,
    duration_minutes: int,
    meeting_url: str,
    room_code: str,
    attendees: List[str]
) -> Optional[str]:
    """
    Create a calendar event for a scheduled meeting.

    This adds the meeting to the user's Bheem Calendar automatically,
    similar to how Google Calendar creates events for Google Meet.

    Args:
        db: Database session
        user_id: ID of the meeting host
        meeting_title: Title of the meeting
        meeting_description: Description/notes
        scheduled_start: When the meeting starts
        duration_minutes: Duration in minutes
        meeting_url: URL to join the meeting
        room_code: Meeting room code
        attendees: List of attendee email addresses

    Returns:
        Event ID if created, None otherwise
    """
    from datetime import timedelta

    event_id = str(uuid.uuid4())
    event_uid = f"meet-{room_code}@bheem.cloud"
    scheduled_end = scheduled_start + timedelta(minutes=duration_minutes)

    # Format attendees as JSON array
    attendees_json = ",".join([f'"{email}"' for email in attendees]) if attendees else ""

    try:
        # First, check if user has a primary calendar - create one if not
        result = await db.execute(
            text("""
                SELECT id FROM workspace.calendars
                WHERE user_id = CAST(:user_id AS uuid) AND is_primary = TRUE
                LIMIT 1
            """),
            {"user_id": user_id}
        )
        calendar = result.fetchone()

        if not calendar:
            # Create a primary calendar for the user
            calendar_id = str(uuid.uuid4())
            await db.execute(
                text("""
                    INSERT INTO workspace.calendars (id, user_id, name, is_primary, color, timezone, created_at, updated_at)
                    VALUES (:calendar_id, CAST(:user_id AS uuid), 'Primary', TRUE, '#4F46E5', 'UTC', NOW(), NOW())
                    ON CONFLICT (user_id, name) DO UPDATE SET is_primary = TRUE
                    RETURNING id
                """),
                {"calendar_id": calendar_id, "user_id": user_id}
            )
            await db.commit()
            print(f"Created primary calendar for user {user_id}: {calendar_id}")
        else:
            calendar_id = str(calendar.id)

        # Insert event into calendar_events table
        await db.execute(
            text("""
                INSERT INTO workspace.calendar_events
                (id, uid, calendar_id, user_id, summary, description, location,
                 start_time, end_time, all_day, status, visibility,
                 conference_type, conference_url, conference_data,
                 created_at, updated_at)
                VALUES (
                    :event_id,
                    :event_uid,
                    CAST(:calendar_id AS uuid),
                    CAST(:user_id AS uuid),
                    :summary,
                    :description,
                    :location,
                    :start_time,
                    :end_time,
                    FALSE,
                    'confirmed',
                    'default',
                    'bheem_meet',
                    :conference_url,
                    :conference_data,
                    NOW(),
                    NOW()
                )
            """),
            {
                "event_id": event_id,
                "event_uid": event_uid,
                "calendar_id": calendar_id,
                "user_id": user_id,
                "summary": meeting_title,
                "description": f"{meeting_description}\n\nMeeting Code: {room_code}",
                "location": meeting_url,
                "start_time": scheduled_start,
                "end_time": scheduled_end,
                "conference_url": meeting_url,
                "conference_data": f'{{"type": "bheem_meet", "room_code": "{room_code}", "join_url": "{meeting_url}"}}'
            }
        )
        await db.commit()
        print(f"Calendar event created for meeting {room_code}: {event_id}")
        return event_id

    except Exception as e:
        print(f"Failed to create calendar event: {e}")
        # Don't fail the meeting creation if calendar fails
        return None
