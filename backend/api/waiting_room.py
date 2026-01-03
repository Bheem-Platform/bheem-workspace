"""
Bheem Meet - Waiting Room API
Handles participant admission control for meetings
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
import uuid

from core.database import get_db_connection
from api.auth import get_current_user


router = APIRouter(prefix="/meet/waiting-room", tags=["meet-waiting-room"])


# Pydantic models
class JoinWaitingRoomRequest(BaseModel):
    display_name: str
    email: Optional[str] = None
    device_info: Optional[dict] = None


class AdmitRequest(BaseModel):
    waiting_id: str


class AdmitAllRequest(BaseModel):
    room_code: str


class WaitingParticipant(BaseModel):
    id: str
    room_code: str
    user_id: Optional[str]
    display_name: str
    email: Optional[str]
    status: str  # waiting, admitted, rejected
    requested_at: str


@router.post("/{room_code}/join")
async def join_waiting_room(
    room_code: str,
    request: JoinWaitingRoomRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Request to join a meeting.

    Adds the participant to the waiting room if enabled.
    Returns immediately admitted if waiting room is disabled.
    """
    try:
        waiting_id = str(uuid.uuid4())
        now = datetime.utcnow()
        user_id = str(current_user.get("id")) if current_user.get("id") else None

        conn = get_db_connection()
        cursor = conn.cursor()

        # Check room settings for waiting room status
        cursor.execute("""
            SELECT waiting_room_enabled, host_id
            FROM workspace.meet_rooms
            WHERE room_code = %s
        """, (room_code,))

        room = cursor.fetchone()

        # If room doesn't exist in our DB, default to waiting room enabled
        waiting_room_enabled = True
        host_id = None

        if room:
            waiting_room_enabled = room[0] if room[0] is not None else True
            host_id = room[1]

        # If user is host, auto-admit
        if user_id and user_id == host_id:
            cursor.close()
            conn.close()
            return {
                "success": True,
                "waiting_id": waiting_id,
                "status": "admitted",
                "message": "You are the host - automatically admitted"
            }

        # If waiting room disabled, auto-admit
        if not waiting_room_enabled:
            cursor.close()
            conn.close()
            return {
                "success": True,
                "waiting_id": waiting_id,
                "status": "admitted",
                "message": "Waiting room disabled - automatically admitted"
            }

        # Check if already in waiting room
        cursor.execute("""
            SELECT id, status FROM workspace.meet_waiting_room
            WHERE room_code = %s AND user_id = %s AND status = 'waiting'
        """, (room_code, user_id))

        existing = cursor.fetchone()
        if existing:
            cursor.close()
            conn.close()
            return {
                "success": True,
                "waiting_id": existing[0],
                "status": "waiting",
                "message": "Already in waiting room"
            }

        # Add to waiting room
        cursor.execute("""
            INSERT INTO workspace.meet_waiting_room
            (id, room_code, user_id, display_name, email, status, device_info, requested_at)
            VALUES (%s, %s, %s, %s, %s, 'waiting', %s, %s)
            RETURNING id
        """, (
            waiting_id,
            room_code,
            user_id,
            request.display_name,
            request.email or current_user.get("email"),
            str(request.device_info) if request.device_info else None,
            now
        ))

        conn.commit()
        cursor.close()
        conn.close()

        return {
            "success": True,
            "waiting_id": waiting_id,
            "status": "waiting",
            "message": "Added to waiting room. Please wait for host to admit you."
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{room_code}/participants")
async def get_waiting_participants(
    room_code: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get all participants waiting in the waiting room.

    Only the room host can view this list.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Verify user is host
        cursor.execute("""
            SELECT host_id FROM workspace.meet_rooms
            WHERE room_code = %s
        """, (room_code,))

        room = cursor.fetchone()
        user_id = str(current_user.get("id"))

        # Allow if room doesn't exist yet (will be created) or user is host
        if room and room[0] != user_id:
            raise HTTPException(status_code=403, detail="Only the host can view waiting room")

        # Get waiting participants
        cursor.execute("""
            SELECT id, room_code, user_id, display_name, email,
                   status, requested_at
            FROM workspace.meet_waiting_room
            WHERE room_code = %s AND status = 'waiting'
            ORDER BY requested_at ASC
        """, (room_code,))

        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        participants = []
        for row in rows:
            participants.append({
                "id": row[0],
                "room_code": row[1],
                "user_id": row[2],
                "display_name": row[3],
                "email": row[4],
                "status": row[5],
                "requested_at": row[6].isoformat() if row[6] else None,
                "wait_time_seconds": int((datetime.utcnow() - row[6]).total_seconds()) if row[6] else 0
            })

        return {
            "success": True,
            "room_code": room_code,
            "count": len(participants),
            "participants": participants
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{room_code}/admit/{waiting_id}")
async def admit_participant(
    room_code: str,
    waiting_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Admit a participant from the waiting room.

    Only the room host can admit participants.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Verify user is host
        cursor.execute("""
            SELECT host_id FROM workspace.meet_rooms
            WHERE room_code = %s
        """, (room_code,))

        room = cursor.fetchone()
        user_id = str(current_user.get("id"))

        if room and room[0] != user_id:
            raise HTTPException(status_code=403, detail="Only the host can admit participants")

        # Update waiting room entry
        cursor.execute("""
            UPDATE workspace.meet_waiting_room
            SET status = 'admitted', admitted_at = %s, admitted_by = %s
            WHERE id = %s AND room_code = %s AND status = 'waiting'
            RETURNING display_name, user_id
        """, (datetime.utcnow(), user_id, waiting_id, room_code))

        result = cursor.fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="Waiting participant not found")

        conn.commit()
        cursor.close()
        conn.close()

        return {
            "success": True,
            "waiting_id": waiting_id,
            "display_name": result[0],
            "user_id": result[1],
            "status": "admitted",
            "message": f"{result[0]} has been admitted to the meeting"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{room_code}/reject/{waiting_id}")
async def reject_participant(
    room_code: str,
    waiting_id: str,
    reason: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Reject a participant from the waiting room.

    Only the room host can reject participants.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Verify user is host
        cursor.execute("""
            SELECT host_id FROM workspace.meet_rooms
            WHERE room_code = %s
        """, (room_code,))

        room = cursor.fetchone()
        user_id = str(current_user.get("id"))

        if room and room[0] != user_id:
            raise HTTPException(status_code=403, detail="Only the host can reject participants")

        # Update waiting room entry
        cursor.execute("""
            UPDATE workspace.meet_waiting_room
            SET status = 'rejected', rejected_at = %s, rejected_by = %s
            WHERE id = %s AND room_code = %s AND status = 'waiting'
            RETURNING display_name
        """, (datetime.utcnow(), user_id, waiting_id, room_code))

        result = cursor.fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="Waiting participant not found")

        conn.commit()
        cursor.close()
        conn.close()

        return {
            "success": True,
            "waiting_id": waiting_id,
            "display_name": result[0],
            "status": "rejected",
            "message": f"{result[0]} has been rejected"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{room_code}/admit-all")
async def admit_all_participants(
    room_code: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Admit all waiting participants at once.

    Only the room host can admit all participants.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Verify user is host
        cursor.execute("""
            SELECT host_id FROM workspace.meet_rooms
            WHERE room_code = %s
        """, (room_code,))

        room = cursor.fetchone()
        user_id = str(current_user.get("id"))

        if room and room[0] != user_id:
            raise HTTPException(status_code=403, detail="Only the host can admit participants")

        # Admit all waiting
        now = datetime.utcnow()
        cursor.execute("""
            UPDATE workspace.meet_waiting_room
            SET status = 'admitted', admitted_at = %s, admitted_by = %s
            WHERE room_code = %s AND status = 'waiting'
        """, (now, user_id, room_code))

        admitted_count = cursor.rowcount
        conn.commit()
        cursor.close()
        conn.close()

        return {
            "success": True,
            "room_code": room_code,
            "admitted_count": admitted_count,
            "message": f"Admitted {admitted_count} participant(s)"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{room_code}/status/{waiting_id}")
async def check_admission_status(
    room_code: str,
    waiting_id: str
):
    """
    Check admission status (for polling by waiting participants).

    No authentication required - uses waiting_id as token.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT status, admitted_at, rejected_at
            FROM workspace.meet_waiting_room
            WHERE id = %s AND room_code = %s
        """, (waiting_id, room_code))

        row = cursor.fetchone()
        cursor.close()
        conn.close()

        if not row:
            raise HTTPException(status_code=404, detail="Waiting entry not found")

        return {
            "success": True,
            "waiting_id": waiting_id,
            "status": row[0],
            "admitted_at": row[1].isoformat() if row[1] else None,
            "rejected_at": row[2].isoformat() if row[2] else None
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{room_code}/settings")
async def update_waiting_room_settings(
    room_code: str,
    enabled: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """
    Enable or disable waiting room for a meeting.

    Only the room host can change this setting.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        user_id = str(current_user.get("id"))

        # Check if room exists
        cursor.execute("""
            SELECT host_id FROM workspace.meet_rooms
            WHERE room_code = %s
        """, (room_code,))

        room = cursor.fetchone()

        if room:
            # Verify host
            if room[0] != user_id:
                raise HTTPException(status_code=403, detail="Only the host can change settings")

            # Update setting
            cursor.execute("""
                UPDATE workspace.meet_rooms
                SET waiting_room_enabled = %s
                WHERE room_code = %s
            """, (enabled, room_code))
        else:
            # Create room entry with setting
            cursor.execute("""
                INSERT INTO workspace.meet_rooms
                (id, room_code, room_name, host_id, waiting_room_enabled, created_at)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                str(uuid.uuid4()),
                room_code,
                f"Meeting {room_code}",
                user_id,
                enabled,
                datetime.utcnow()
            ))

        conn.commit()
        cursor.close()
        conn.close()

        return {
            "success": True,
            "room_code": room_code,
            "waiting_room_enabled": enabled,
            "message": f"Waiting room {'enabled' if enabled else 'disabled'}"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{room_code}/leave/{waiting_id}")
async def leave_waiting_room(
    room_code: str,
    waiting_id: str
):
    """
    Leave the waiting room (cancel join request).

    Used when a participant decides to leave while waiting.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            DELETE FROM workspace.meet_waiting_room
            WHERE id = %s AND room_code = %s AND status = 'waiting'
        """, (waiting_id, room_code))

        deleted = cursor.rowcount > 0
        conn.commit()
        cursor.close()
        conn.close()

        if not deleted:
            raise HTTPException(status_code=404, detail="Waiting entry not found or already processed")

        return {
            "success": True,
            "waiting_id": waiting_id,
            "message": "Left waiting room"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
