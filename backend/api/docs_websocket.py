"""
Bheem Docs - WebSocket API for Real-time Collaboration
=======================================================
WebSocket endpoints for document collaboration.
Handles user connections, document sync, and awareness updates.
"""

from typing import Optional
from uuid import UUID
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, HTTPException
from fastapi.responses import JSONResponse
import json
import logging

from core.security import get_current_user, decode_token
from services.docs_collaboration_service import (
    get_docs_collaboration_service,
    DocsCollaborationService,
    MessageType
)

router = APIRouter(prefix="/docs/collab", tags=["Bheem Docs Collaboration"])
logger = logging.getLogger(__name__)


def get_collab_service() -> DocsCollaborationService:
    return get_docs_collaboration_service()


async def authenticate_websocket(
    websocket: WebSocket,
    token: Optional[str] = None
) -> Optional[dict]:
    """
    Authenticate WebSocket connection.

    Args:
        websocket: WebSocket connection
        token: JWT token from query params or first message

    Returns:
        User dict if authenticated, None otherwise
    """
    if not token:
        # Try to get token from query params
        token = websocket.query_params.get("token")

    if not token:
        return None

    try:
        user = decode_token(token)
        return user
    except Exception as e:
        logger.warning(f"WebSocket auth failed: {e}")
        return None


# =============================================================================
# WEBSOCKET ENDPOINT
# =============================================================================

@router.websocket("/{document_id}")
async def collaboration_websocket(
    websocket: WebSocket,
    document_id: str,
    token: Optional[str] = Query(None),
    service: DocsCollaborationService = Depends(get_collab_service)
):
    """
    WebSocket endpoint for document collaboration.

    Connection flow:
    1. Client connects with JWT token in query params
    2. Server authenticates and sends join response
    3. Client/Server exchange sync messages
    4. Real-time updates flow both directions

    Message types:
    - join: Initial connection (automatic)
    - leave: Disconnect (automatic)
    - sync_step1: Client sends state vector
    - sync_step2: Server sends missing updates
    - sync_update: Document changes
    - awareness_update: Cursor/selection changes
    - doc_save: Manual save request
    - ping/pong: Keepalive
    """
    # Authenticate
    user = await authenticate_websocket(websocket, token)

    if not user:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    # Accept connection
    await websocket.accept()

    user_id = user.get('id', user.get('sub'))
    user_name = user.get('name', user.get('email', 'Anonymous'))
    user_email = user.get('email', '')
    user_avatar = user.get('avatar')

    try:
        # Join room
        join_response = await service.user_join(
            document_id=document_id,
            user_id=user_id,
            user_name=user_name,
            user_email=user_email,
            websocket=websocket,
            user_avatar=user_avatar
        )

        # Send join response
        await websocket.send_json(join_response)

        # Message loop
        while True:
            try:
                # Receive message
                data = await websocket.receive_text()
                message = json.loads(data)

                # Handle message
                response = await service.handle_message(
                    document_id=document_id,
                    user_id=user_id,
                    message=message
                )

                # Send response if any
                if response:
                    await websocket.send_json(response)

            except json.JSONDecodeError:
                await websocket.send_json({
                    "type": MessageType.ERROR,
                    "message": "Invalid JSON"
                })

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {user_name} from {document_id}")

    except Exception as e:
        logger.error(f"WebSocket error: {e}")

    finally:
        # Leave room
        await service.user_leave(document_id, user_id)


# =============================================================================
# REST ENDPOINTS FOR COLLABORATION
# =============================================================================

@router.get("/rooms")
async def list_active_rooms(
    service: DocsCollaborationService = Depends(get_collab_service),
    current_user: dict = Depends(get_current_user)
):
    """
    List active collaboration rooms (admin only).

    Returns statistics about active collaboration sessions.
    """
    if current_user.get('role') not in ['ADMIN', 'SUPER_ADMIN']:
        raise HTTPException(status_code=403, detail="Admin access required")

    stats = await service.get_room_stats()
    return stats


@router.get("/rooms/{document_id}")
async def get_room_info(
    document_id: str,
    service: DocsCollaborationService = Depends(get_collab_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Get information about a specific collaboration room.

    Returns current users and room status.
    """
    room = service.rooms.get(document_id)

    if not room:
        return {
            "active": False,
            "document_id": document_id,
            "users": []
        }

    return {
        "active": True,
        "document_id": document_id,
        "session_id": room.session_id,
        "user_count": len(room.users),
        "users": [
            {
                "id": u.user_id,
                "name": u.user_name,
                "avatar": u.user_avatar,
                "color": u.color,
                "connected_at": u.connected_at.isoformat(),
                "last_activity": u.last_activity.isoformat()
            }
            for u in room.users.values()
        ],
        "created_at": room.created_at.isoformat(),
        "last_activity": room.last_activity.isoformat()
    }


@router.get("/rooms/{document_id}/users")
async def get_room_users(
    document_id: str,
    service: DocsCollaborationService = Depends(get_collab_service),
    current_user: dict = Depends(get_current_user)
):
    """Get list of users currently in a document."""
    awareness = await service.get_awareness(document_id)
    return {"users": awareness}


@router.post("/rooms/{document_id}/broadcast")
async def broadcast_to_room(
    document_id: str,
    message: dict,
    service: DocsCollaborationService = Depends(get_collab_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Broadcast a message to all users in a room (admin only).

    Useful for system notifications.
    """
    if current_user.get('role') not in ['ADMIN', 'SUPER_ADMIN']:
        raise HTTPException(status_code=403, detail="Admin access required")

    await service._broadcast(document_id, message)
    return {"broadcast": True}


@router.post("/cleanup")
async def cleanup_stale_rooms(
    service: DocsCollaborationService = Depends(get_collab_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Clean up stale collaboration rooms (admin only).

    Removes rooms with no activity.
    """
    if current_user.get('role') not in ['ADMIN', 'SUPER_ADMIN']:
        raise HTTPException(status_code=403, detail="Admin access required")

    count = await service.cleanup_stale_rooms()
    return {"cleaned_up": count}
