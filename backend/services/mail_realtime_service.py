"""
Bheem Workspace - Mail Real-Time Sync Service
WebSocket-based real-time email notifications using IMAP IDLE
"""
from typing import Dict, Set, Optional, Any
from datetime import datetime
import asyncio
import json
import imaplib
from core.logging import get_logger

logger = get_logger("bheem.mail.realtime")


class MailConnectionManager:
    """
    Manages WebSocket connections for real-time mail updates.

    Tracks active connections per user and handles broadcasting
    new email notifications.
    """

    def __init__(self):
        # user_id -> set of WebSocket connections
        self.active_connections: Dict[str, Set[Any]] = {}
        # user_id -> IMAP monitoring task
        self.imap_tasks: Dict[str, asyncio.Task] = {}
        # user_id -> credentials (for IMAP IDLE)
        self.user_credentials: Dict[str, dict] = {}

    async def connect(self, websocket, user_id: str, credentials: Optional[dict] = None):
        """
        Register a new WebSocket connection (accepts websocket internally).

        Args:
            websocket: FastAPI WebSocket connection
            user_id: User ID
            credentials: Mail credentials for IMAP monitoring
        """
        await websocket.accept()
        await self.register(websocket, user_id, credentials)

    async def register(self, websocket, user_id: str, credentials: Optional[dict] = None):
        """
        Register an already-accepted WebSocket connection.

        Args:
            websocket: FastAPI WebSocket connection (already accepted)
            user_id: User ID
            credentials: Mail credentials for IMAP monitoring
        """
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()

        self.active_connections[user_id].add(websocket)

        # Store credentials for IMAP monitoring
        if credentials:
            self.user_credentials[user_id] = credentials
            # Start IMAP monitoring if not already running
            if user_id not in self.imap_tasks or self.imap_tasks[user_id].done():
                self.imap_tasks[user_id] = asyncio.create_task(
                    self._monitor_imap_idle(user_id)
                )

        logger.info(
            f"WebSocket connected for user {user_id}",
            action="ws_connected",
            user_id=user_id,
            connection_count=len(self.active_connections[user_id])
        )

    def disconnect(self, websocket, user_id: str):
        """Remove a WebSocket connection."""
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)

            # Clean up if no more connections
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

                # Stop IMAP monitoring
                if user_id in self.imap_tasks:
                    self.imap_tasks[user_id].cancel()
                    del self.imap_tasks[user_id]

                if user_id in self.user_credentials:
                    del self.user_credentials[user_id]

        logger.info(
            f"WebSocket disconnected for user {user_id}",
            action="ws_disconnected",
            user_id=user_id
        )

    async def send_to_user(self, user_id: str, message: dict):
        """
        Send a message to all connections for a user.

        Args:
            user_id: Target user ID
            message: Message dict to send (will be JSON serialized)
        """
        if user_id not in self.active_connections:
            return

        disconnected = set()

        for connection in self.active_connections[user_id]:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.warning(f"Failed to send to WebSocket: {e}")
                disconnected.add(connection)

        # Clean up disconnected sockets
        self.active_connections[user_id] -= disconnected

    async def broadcast_new_email(
        self,
        user_id: str,
        folder: str = "INBOX",
        email_preview: Optional[dict] = None
    ):
        """
        Notify user of new email arrival.

        Args:
            user_id: User ID
            folder: Folder where email arrived
            email_preview: Optional preview data (subject, from, etc.)
        """
        message = {
            "type": "new_email",
            "folder": folder,
            "timestamp": datetime.utcnow().isoformat(),
        }

        if email_preview:
            message["preview"] = email_preview

        await self.send_to_user(user_id, message)

        logger.debug(
            f"Sent new_email notification to {user_id}",
            action="new_email_notification",
            folder=folder
        )

    async def broadcast_email_update(
        self,
        user_id: str,
        message_id: str,
        update_type: str,
        data: Optional[dict] = None
    ):
        """
        Notify user of email update (read, starred, moved, etc.).

        Args:
            user_id: User ID
            message_id: Email message ID
            update_type: Type of update (read, starred, moved, deleted)
            data: Additional update data
        """
        message = {
            "type": "email_updated",
            "message_id": message_id,
            "update_type": update_type,
            "timestamp": datetime.utcnow().isoformat(),
        }

        if data:
            message["data"] = data

        await self.send_to_user(user_id, message)

    async def broadcast_folder_update(
        self,
        user_id: str,
        folder: str,
        unread_count: Optional[int] = None
    ):
        """
        Notify user of folder update (unread count change).
        """
        message = {
            "type": "folder_updated",
            "folder": folder,
            "timestamp": datetime.utcnow().isoformat(),
        }

        if unread_count is not None:
            message["unread_count"] = unread_count

        await self.send_to_user(user_id, message)

    async def _monitor_imap_idle(self, user_id: str):
        """
        Monitor IMAP IDLE for new emails.

        Uses IMAP IDLE command to efficiently wait for new emails
        instead of polling.
        """
        import os

        imap_host = os.getenv("MAILCOW_IMAP_HOST", "mail.bheem.me")
        imap_port = int(os.getenv("MAILCOW_IMAP_PORT", "993"))

        while user_id in self.active_connections and self.active_connections[user_id]:
            try:
                credentials = self.user_credentials.get(user_id)
                if not credentials:
                    await asyncio.sleep(5)
                    continue

                # Connect to IMAP
                imap = imaplib.IMAP4_SSL(imap_host, imap_port)
                imap.login(credentials["email"], credentials["password"])
                imap.select("INBOX")

                # Get initial message count
                _, data = imap.search(None, "ALL")
                initial_count = len(data[0].split()) if data[0] else 0

                logger.debug(
                    f"Started IMAP IDLE for {user_id}",
                    action="imap_idle_start",
                    initial_count=initial_count
                )

                # Note: Standard imaplib doesn't support IDLE directly
                # We'll use polling as fallback (check every 30 seconds)
                while user_id in self.active_connections:
                    await asyncio.sleep(30)

                    if user_id not in self.active_connections:
                        break

                    try:
                        # Check for new messages
                        imap.noop()  # Keep connection alive
                        _, data = imap.search(None, "ALL")
                        current_count = len(data[0].split()) if data[0] else 0

                        if current_count > initial_count:
                            # New email(s) arrived
                            await self.broadcast_new_email(user_id, "INBOX")
                            initial_count = current_count

                    except Exception as e:
                        logger.warning(f"IMAP check error: {e}")
                        break

                imap.logout()

            except Exception as e:
                logger.error(
                    f"IMAP monitoring error for {user_id}: {e}",
                    action="imap_error"
                )
                await asyncio.sleep(10)  # Wait before retry

    def get_connection_count(self, user_id: str) -> int:
        """Get number of active connections for a user."""
        return len(self.active_connections.get(user_id, set()))

    def get_all_connected_users(self) -> list:
        """Get list of all connected user IDs."""
        return list(self.active_connections.keys())


# Singleton instance
mail_connection_manager = MailConnectionManager()
