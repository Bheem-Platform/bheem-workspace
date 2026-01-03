"""
Bheem Meet - Chat API
Handles in-meeting chat with persistence, reactions, and export
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
import uuid
import json

from core.database import get_db_connection
from api.auth import get_current_user


router = APIRouter(prefix="/meet/chat", tags=["meet-chat"])


# Pydantic models
class SendMessageRequest(BaseModel):
    content: str
    message_type: str = "text"  # text, file, system
    reply_to_id: Optional[str] = None
    metadata: Optional[dict] = None


class EditMessageRequest(BaseModel):
    content: str


class ReactionRequest(BaseModel):
    emoji: str  # 👍, ❤️, 😂, 😮, 😢, 🎉


class ChatMessage(BaseModel):
    id: str
    room_code: str
    sender_id: str
    sender_name: str
    sender_avatar: Optional[str]
    content: str
    message_type: str
    reply_to_id: Optional[str]
    reactions: dict
    is_edited: bool
    is_deleted: bool
    created_at: str
    updated_at: Optional[str]


@router.get("/{room_code}/messages")
async def get_chat_messages(
    room_code: str,
    limit: int = Query(100, ge=1, le=500),
    before: Optional[str] = None,
    after: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get chat messages for a room.

    Supports pagination with before/after cursors.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Build query with optional pagination
        query = """
            SELECT
                id, room_code, sender_id, sender_name, sender_avatar,
                content, message_type, reply_to_id, reactions,
                is_edited, is_deleted, created_at, updated_at
            FROM workspace.meet_chat_messages
            WHERE room_code = %s AND is_deleted = FALSE
        """
        params = [room_code]

        if before:
            query += " AND created_at < %s"
            params.append(before)

        if after:
            query += " AND created_at > %s"
            params.append(after)

        query += " ORDER BY created_at DESC LIMIT %s"
        params.append(limit)

        cursor.execute(query, params)
        rows = cursor.fetchall()

        messages = []
        for row in rows:
            messages.append({
                "id": row[0],
                "room_code": row[1],
                "sender_id": row[2],
                "sender_name": row[3],
                "sender_avatar": row[4],
                "content": row[5],
                "message_type": row[6],
                "reply_to_id": row[7],
                "reactions": row[8] if row[8] else {},
                "is_edited": row[9],
                "is_deleted": row[10],
                "created_at": row[11].isoformat() if row[11] else None,
                "updated_at": row[12].isoformat() if row[12] else None
            })

        cursor.close()
        conn.close()

        # Reverse to get chronological order
        messages.reverse()

        return {
            "success": True,
            "messages": messages,
            "count": len(messages),
            "has_more": len(messages) == limit
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{room_code}/messages")
async def send_message(
    room_code: str,
    request: SendMessageRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Send a chat message in a room.

    Message is persisted to database and can be retrieved later.
    """
    try:
        message_id = str(uuid.uuid4())
        now = datetime.utcnow()

        conn = get_db_connection()
        cursor = conn.cursor()

        # Verify room exists
        cursor.execute("""
            SELECT id FROM workspace.meet_rooms
            WHERE room_code = %s
        """, (room_code,))

        room = cursor.fetchone()
        if not room:
            # Room might not be in our DB yet (created via LiveKit directly)
            # Allow message anyway - room will be created on first recording
            pass

        # Insert message
        cursor.execute("""
            INSERT INTO workspace.meet_chat_messages
            (id, room_code, sender_id, sender_name, sender_avatar, content,
             message_type, reply_to_id, reactions, extra_data, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            message_id,
            room_code,
            str(current_user.get("id")),
            current_user.get("full_name") or current_user.get("username") or (current_user.get("email") or "").split("@")[0] or "Anonymous",
            current_user.get("avatar_url"),
            request.content,
            request.message_type,
            request.reply_to_id,
            json.dumps({}),
            json.dumps(request.metadata) if request.metadata else None,
            now
        ))

        conn.commit()
        cursor.close()
        conn.close()

        return {
            "success": True,
            "message": {
                "id": message_id,
                "room_code": room_code,
                "sender_id": str(current_user.get("id")),
                "sender_name": current_user.get("full_name") or current_user.get("username") or (current_user.get("email") or "").split("@")[0] or "Anonymous",
                "sender_avatar": current_user.get("avatar_url"),
                "content": request.content,
                "message_type": request.message_type,
                "reply_to_id": request.reply_to_id,
                "reactions": {},
                "is_edited": False,
                "is_deleted": False,
                "created_at": now.isoformat()
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{room_code}/messages/{message_id}")
async def edit_message(
    room_code: str,
    message_id: str,
    request: EditMessageRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Edit a chat message.

    Only the message sender can edit their own messages.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Verify ownership
        cursor.execute("""
            SELECT sender_id FROM workspace.meet_chat_messages
            WHERE id = %s AND room_code = %s
        """, (message_id, room_code))

        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Message not found")

        if row[0] != str(current_user.get("id")):
            raise HTTPException(status_code=403, detail="Cannot edit another user's message")

        # Update message
        now = datetime.utcnow()
        cursor.execute("""
            UPDATE workspace.meet_chat_messages
            SET content = %s, is_edited = TRUE, updated_at = %s
            WHERE id = %s AND room_code = %s
        """, (request.content, now, message_id, room_code))

        conn.commit()
        cursor.close()
        conn.close()

        return {
            "success": True,
            "message_id": message_id,
            "content": request.content,
            "is_edited": True,
            "updated_at": now.isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{room_code}/messages/{message_id}")
async def delete_message(
    room_code: str,
    message_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a chat message.

    Messages are soft-deleted (marked as deleted, not removed).
    Only the message sender or room host can delete messages.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Verify ownership or host status
        cursor.execute("""
            SELECT sender_id FROM workspace.meet_chat_messages
            WHERE id = %s AND room_code = %s
        """, (message_id, room_code))

        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Message not found")

        # Check if user is sender or room host
        is_sender = row[0] == str(current_user.get("id"))

        # Check if user is room host
        cursor.execute("""
            SELECT host_id FROM workspace.meet_rooms
            WHERE room_code = %s
        """, (room_code,))
        room_row = cursor.fetchone()
        is_host = room_row and room_row[0] == str(current_user.get("id"))

        if not is_sender and not is_host:
            raise HTTPException(status_code=403, detail="Cannot delete this message")

        # Soft delete
        cursor.execute("""
            UPDATE workspace.meet_chat_messages
            SET is_deleted = TRUE, content = '[Message deleted]', updated_at = %s
            WHERE id = %s AND room_code = %s
        """, (datetime.utcnow(), message_id, room_code))

        conn.commit()
        cursor.close()
        conn.close()

        return {
            "success": True,
            "message_id": message_id,
            "deleted": True
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{room_code}/messages/{message_id}/react")
async def add_reaction(
    room_code: str,
    message_id: str,
    request: ReactionRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Add or toggle a reaction on a message.

    If user already has this reaction, it's removed (toggle behavior).
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Get current reactions
        cursor.execute("""
            SELECT reactions FROM workspace.meet_chat_messages
            WHERE id = %s AND room_code = %s
        """, (message_id, room_code))

        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Message not found")

        reactions = row[0] if row[0] else {}
        user_id = str(current_user.get("id"))
        emoji = request.emoji

        # Initialize emoji list if not exists
        if emoji not in reactions:
            reactions[emoji] = []

        # Toggle reaction
        if user_id in reactions[emoji]:
            reactions[emoji].remove(user_id)
            action = "removed"
            # Clean up empty emoji lists
            if not reactions[emoji]:
                del reactions[emoji]
        else:
            reactions[emoji].append(user_id)
            action = "added"

        # Update reactions
        cursor.execute("""
            UPDATE workspace.meet_chat_messages
            SET reactions = %s
            WHERE id = %s AND room_code = %s
        """, (json.dumps(reactions), message_id, room_code))

        conn.commit()
        cursor.close()
        conn.close()

        return {
            "success": True,
            "message_id": message_id,
            "emoji": emoji,
            "action": action,
            "reactions": reactions
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{room_code}/export")
async def export_chat(
    room_code: str,
    format: str = Query("json", regex="^(json|txt|csv)$"),
    current_user: dict = Depends(get_current_user)
):
    """
    Export chat history for a room.

    Formats:
    - json: Full message data
    - txt: Human-readable text format
    - csv: Spreadsheet compatible
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                sender_name, content, message_type,
                is_edited, created_at
            FROM workspace.meet_chat_messages
            WHERE room_code = %s AND is_deleted = FALSE
            ORDER BY created_at ASC
        """, (room_code,))

        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        if format == "json":
            messages = []
            for row in rows:
                messages.append({
                    "sender": row[0],
                    "content": row[1],
                    "type": row[2],
                    "edited": row[3],
                    "timestamp": row[4].isoformat() if row[4] else None
                })
            return {
                "success": True,
                "room_code": room_code,
                "exported_at": datetime.utcnow().isoformat(),
                "message_count": len(messages),
                "messages": messages
            }

        elif format == "txt":
            lines = [f"Chat Export - Room: {room_code}",
                     f"Exported: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
                     "-" * 50, ""]

            for row in rows:
                timestamp = row[4].strftime("%H:%M") if row[4] else ""
                edited = " (edited)" if row[3] else ""
                lines.append(f"[{timestamp}] {row[0]}: {row[1]}{edited}")

            return {
                "success": True,
                "format": "txt",
                "content": "\n".join(lines)
            }

        elif format == "csv":
            lines = ["timestamp,sender,content,type,edited"]
            for row in rows:
                timestamp = row[4].isoformat() if row[4] else ""
                # Escape content for CSV
                content = row[1].replace('"', '""')
                lines.append(f'"{timestamp}","{row[0]}","{content}","{row[2]}","{row[3]}"')

            return {
                "success": True,
                "format": "csv",
                "content": "\n".join(lines)
            }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{room_code}/stats")
async def get_chat_stats(
    room_code: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get chat statistics for a room.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Total messages
        cursor.execute("""
            SELECT COUNT(*) FROM workspace.meet_chat_messages
            WHERE room_code = %s AND is_deleted = FALSE
        """, (room_code,))
        total_messages = cursor.fetchone()[0]

        # Messages by sender
        cursor.execute("""
            SELECT sender_name, COUNT(*) as msg_count
            FROM workspace.meet_chat_messages
            WHERE room_code = %s AND is_deleted = FALSE
            GROUP BY sender_name
            ORDER BY msg_count DESC
        """, (room_code,))
        by_sender = [{"sender": row[0], "count": row[1]} for row in cursor.fetchall()]

        # First and last message
        cursor.execute("""
            SELECT MIN(created_at), MAX(created_at)
            FROM workspace.meet_chat_messages
            WHERE room_code = %s AND is_deleted = FALSE
        """, (room_code,))
        time_row = cursor.fetchone()

        cursor.close()
        conn.close()

        return {
            "success": True,
            "room_code": room_code,
            "total_messages": total_messages,
            "by_sender": by_sender,
            "first_message_at": time_row[0].isoformat() if time_row[0] else None,
            "last_message_at": time_row[1].isoformat() if time_row[1] else None
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
