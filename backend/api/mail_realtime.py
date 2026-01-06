"""
Bheem Workspace - Mail Real-Time API
WebSocket endpoint for real-time mail notifications
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, HTTPException
from typing import Optional
import json
import asyncio
from datetime import datetime
from services.mail_realtime_service import mail_connection_manager
from services.mail_session_service import mail_session_service
from core.logging import get_logger

logger = get_logger("bheem.mail.realtime.api")

router = APIRouter(prefix="/mail/ws", tags=["Mail Real-Time"])


async def validate_ws_token(token: str) -> Optional[dict]:
    """
    Validate WebSocket authentication token.

    Returns user dict if valid, None otherwise.
    Uses same validation as main auth: local decode first, then Passport API.
    """
    from core.security import decode_token, validate_token_via_passport, get_user_from_passport
    from core.config import settings

    try:
        # Step 1: Try local decode first (faster)
        payload = decode_token(token)
        if payload:
            user_id = payload.get("sub") or payload.get("user_id")
            if user_id:
                return {
                    "id": user_id,
                    "email": payload.get("email") or payload.get("username")
                }

        # Step 2: Try Passport validation if local decode failed
        if settings.USE_PASSPORT_AUTH:
            passport_payload = await validate_token_via_passport(token)
            if passport_payload:
                user_id = passport_payload.get("user_id") or passport_payload.get("sub")
                return {
                    "id": user_id,
                    "email": passport_payload.get("email") or passport_payload.get("username")
                }

            # Step 3: Try /me endpoint as fallback
            user_info = await get_user_from_passport(token)
            if user_info:
                user_id = user_info.get("user_id") or user_info.get("sub")
                return {
                    "id": user_id,
                    "email": user_info.get("email") or user_info.get("username")
                }

    except Exception as e:
        logger.warning(f"WebSocket token validation failed: {e}")

    return None


@router.websocket("")
async def mail_websocket(
    websocket: WebSocket,
    token: str = Query(..., description="JWT auth token")
):
    """
    WebSocket endpoint for real-time mail updates.

    Connect with: ws://host/api/v1/mail/ws?token=<jwt_token>

    Messages received:
    - {"type": "new_email", "folder": "INBOX", "preview": {...}}
    - {"type": "email_updated", "message_id": "...", "update_type": "read|starred|deleted"}
    - {"type": "folder_updated", "folder": "INBOX", "unread_count": 5}
    - {"type": "pong"} - response to ping

    Messages you can send:
    - {"type": "ping"} - keep-alive ping
    - {"type": "subscribe_folder", "folder": "INBOX"} - subscribe to folder updates
    """
    # Accept connection first to avoid 1006 errors
    await websocket.accept()

    # Validate token
    user = await validate_ws_token(token)
    if not user:
        await websocket.close(code=4001, reason="Invalid or expired token")
        return

    user_id = user["id"]

    # Get mail credentials for IMAP monitoring (optional, don't fail if unavailable)
    credentials = None
    try:
        credentials = mail_session_service.get_credentials(user_id)
    except Exception as e:
        logger.warning(f"Could not get mail credentials for WebSocket: {e}")

    try:
        # Register connection (websocket already accepted)
        await mail_connection_manager.register(websocket, user_id, credentials)

        # Send connection confirmation
        await websocket.send_json({
            "type": "connected",
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat(),
            "features": {
                "new_email_notifications": bool(credentials),
                "email_updates": True,
                "folder_updates": True
            }
        })

        # Keep connection alive and handle messages
        while True:
            try:
                # Wait for messages with timeout
                data = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=60.0  # 60 second timeout
                )

                message = json.loads(data)
                await handle_client_message(websocket, user_id, message)

            except asyncio.TimeoutError:
                # Send ping to keep connection alive
                try:
                    await websocket.send_json({"type": "ping"})
                except:
                    break

            except WebSocketDisconnect:
                break

            except json.JSONDecodeError:
                await websocket.send_json({
                    "type": "error",
                    "message": "Invalid JSON"
                })

    except Exception as e:
        logger.error(f"WebSocket error: {e}", action="ws_error")

    finally:
        mail_connection_manager.disconnect(websocket, user_id)


async def handle_client_message(websocket: WebSocket, user_id: str, message: dict):
    """Handle incoming WebSocket messages from client."""
    msg_type = message.get("type")

    if msg_type == "ping":
        await websocket.send_json({"type": "pong"})

    elif msg_type == "subscribe_folder":
        folder = message.get("folder", "INBOX")
        # Could track folder subscriptions here for targeted updates
        await websocket.send_json({
            "type": "subscribed",
            "folder": folder
        })

    elif msg_type == "unsubscribe_folder":
        folder = message.get("folder")
        await websocket.send_json({
            "type": "unsubscribed",
            "folder": folder
        })

    elif msg_type == "get_status":
        # Return connection status
        await websocket.send_json({
            "type": "status",
            "connected": True,
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat()
        })

    else:
        await websocket.send_json({
            "type": "error",
            "message": f"Unknown message type: {msg_type}"
        })


# ===========================================
# HTTP endpoints for triggering notifications
# (Used internally by other services)
# ===========================================

@router.post("/notify/new-email")
async def notify_new_email(
    user_id: str,
    folder: str = "INBOX",
    subject: Optional[str] = None,
    from_email: Optional[str] = None
):
    """
    Internal endpoint to trigger new email notification.

    Called by mail services when new email is detected.
    """
    preview = None
    if subject or from_email:
        preview = {
            "subject": subject,
            "from": from_email
        }

    await mail_connection_manager.broadcast_new_email(
        user_id=user_id,
        folder=folder,
        email_preview=preview
    )

    return {"success": True, "notified": mail_connection_manager.get_connection_count(user_id) > 0}


@router.post("/notify/email-update")
async def notify_email_update(
    user_id: str,
    message_id: str,
    update_type: str,  # read, starred, moved, deleted
    data: Optional[dict] = None
):
    """
    Internal endpoint to trigger email update notification.
    """
    await mail_connection_manager.broadcast_email_update(
        user_id=user_id,
        message_id=message_id,
        update_type=update_type,
        data=data
    )

    return {"success": True}


@router.get("/status")
async def get_realtime_status():
    """Get real-time service status."""
    connected_users = mail_connection_manager.get_all_connected_users()

    return {
        "status": "active",
        "connected_users": len(connected_users),
        "total_connections": sum(
            mail_connection_manager.get_connection_count(u)
            for u in connected_users
        )
    }
