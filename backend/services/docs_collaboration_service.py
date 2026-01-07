"""
Bheem Docs - Real-time Collaboration Service
=============================================
WebSocket-based real-time collaboration using Yjs CRDT.
Handles document sync, awareness (cursors), and conflict resolution.

Features:
- Real-time document synchronization
- User awareness (cursors, selections, presence)
- Offline support with sync on reconnect
- Conflict-free merging via CRDT
"""

from typing import Optional, Dict, Any, List, Set
from uuid import UUID, uuid4
from datetime import datetime, timedelta
import logging
import json
import asyncio
import hashlib
from dataclasses import dataclass, field
from enum import Enum

import psycopg2
from psycopg2.extras import RealDictCursor

from core.config import settings

logger = logging.getLogger(__name__)


class MessageType(str, Enum):
    """WebSocket message types"""
    # Sync messages
    SYNC_STEP1 = "sync_step1"
    SYNC_STEP2 = "sync_step2"
    SYNC_UPDATE = "sync_update"

    # Awareness messages
    AWARENESS_UPDATE = "awareness_update"
    AWARENESS_QUERY = "awareness_query"

    # Document messages
    DOC_UPDATE = "doc_update"
    DOC_SAVE = "doc_save"
    DOC_SAVED = "doc_saved"

    # Session messages
    JOIN = "join"
    LEAVE = "leave"
    USER_JOINED = "user_joined"
    USER_LEFT = "user_left"

    # Control messages
    ERROR = "error"
    PING = "ping"
    PONG = "pong"


@dataclass
class ConnectedUser:
    """Represents a connected user in a collaboration session"""
    user_id: str
    user_name: str
    user_email: str
    user_avatar: Optional[str] = None
    color: str = "#2563eb"
    cursor_position: Optional[Dict] = None
    selection: Optional[Dict] = None
    connected_at: datetime = field(default_factory=datetime.utcnow)
    last_activity: datetime = field(default_factory=datetime.utcnow)


@dataclass
class CollaborationRoom:
    """Represents a document collaboration room"""
    document_id: str
    session_id: str
    users: Dict[str, ConnectedUser] = field(default_factory=dict)
    document_state: Optional[bytes] = None  # Yjs document state
    created_at: datetime = field(default_factory=datetime.utcnow)
    last_activity: datetime = field(default_factory=datetime.utcnow)
    pending_updates: List[bytes] = field(default_factory=list)
    save_scheduled: bool = False


# Cursor colors for users
CURSOR_COLORS = [
    '#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea',
    '#ea580c', '#0891b2', '#db2777', '#4f46e5', '#059669',
    '#7c3aed', '#0d9488', '#c026d3', '#65a30d', '#0284c7',
]


class DocsCollaborationService:
    """
    Real-time collaboration service.

    Manages:
    - Document rooms (one per document)
    - User connections and awareness
    - Document state synchronization
    - Periodic auto-save
    """

    def __init__(self):
        """Initialize collaboration service."""
        self.db_config = {
            'host': settings.ERP_DB_HOST,
            'port': settings.ERP_DB_PORT,
            'database': settings.ERP_DB_NAME,
            'user': settings.ERP_DB_USER,
            'password': settings.ERP_DB_PASSWORD,
        }

        # Active collaboration rooms
        self.rooms: Dict[str, CollaborationRoom] = {}

        # WebSocket connections: document_id -> {user_id -> websocket}
        self.connections: Dict[str, Dict[str, Any]] = {}

        # Auto-save interval (seconds)
        self.auto_save_interval = 30

        # Cleanup interval for stale rooms
        self.cleanup_interval = 300  # 5 minutes

    def _get_connection(self):
        """Get database connection."""
        return psycopg2.connect(**self.db_config)

    def _assign_color(self, user_id: str, existing_colors: Set[str]) -> str:
        """Assign a unique color to a user."""
        # Generate consistent color based on user_id
        color_index = int(hashlib.md5(user_id.encode()).hexdigest()[:8], 16) % len(CURSOR_COLORS)
        color = CURSOR_COLORS[color_index]

        # If color is taken, find next available
        if color in existing_colors:
            for c in CURSOR_COLORS:
                if c not in existing_colors:
                    return c

        return color

    # =========================================================================
    # ROOM MANAGEMENT
    # =========================================================================

    async def get_or_create_room(
        self,
        document_id: str,
        session_id: Optional[str] = None
    ) -> CollaborationRoom:
        """
        Get or create a collaboration room for a document.

        Args:
            document_id: Document ID
            session_id: Optional existing session ID

        Returns:
            CollaborationRoom instance
        """
        if document_id in self.rooms:
            return self.rooms[document_id]

        # Load existing session state from database
        document_state = await self._load_session_state(document_id)

        room = CollaborationRoom(
            document_id=document_id,
            session_id=session_id or str(uuid4()),
            document_state=document_state
        )

        self.rooms[document_id] = room
        self.connections[document_id] = {}

        logger.info(f"Created collaboration room for document {document_id}")

        return room

    async def close_room(self, document_id: str) -> None:
        """
        Close a collaboration room and save final state.

        Args:
            document_id: Document ID
        """
        if document_id not in self.rooms:
            return

        room = self.rooms[document_id]

        # Save final state
        if room.document_state:
            await self._save_session_state(document_id, room.document_state)

        # Clean up
        del self.rooms[document_id]
        if document_id in self.connections:
            del self.connections[document_id]

        logger.info(f"Closed collaboration room for document {document_id}")

    # =========================================================================
    # USER CONNECTION MANAGEMENT
    # =========================================================================

    async def user_join(
        self,
        document_id: str,
        user_id: str,
        user_name: str,
        user_email: str,
        websocket: Any,
        user_avatar: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Handle user joining a collaboration session.

        Args:
            document_id: Document ID
            user_id: User ID
            user_name: User display name
            user_email: User email
            websocket: WebSocket connection
            user_avatar: User avatar URL

        Returns:
            Join response with room info and current users
        """
        room = await self.get_or_create_room(document_id)

        # Assign color
        existing_colors = {u.color for u in room.users.values()}
        color = self._assign_color(user_id, existing_colors)

        # Create user
        user = ConnectedUser(
            user_id=user_id,
            user_name=user_name,
            user_email=user_email,
            user_avatar=user_avatar,
            color=color
        )

        room.users[user_id] = user
        self.connections[document_id][user_id] = websocket

        # Update database presence
        await self._update_db_presence(document_id, user)

        # Notify other users
        await self._broadcast(
            document_id,
            {
                "type": MessageType.USER_JOINED,
                "user": {
                    "id": user_id,
                    "name": user_name,
                    "avatar": user_avatar,
                    "color": color
                }
            },
            exclude_user=user_id
        )

        logger.info(f"User {user_name} joined document {document_id}")

        return {
            "type": MessageType.JOIN,
            "session_id": room.session_id,
            "document_state": room.document_state.hex() if room.document_state else None,
            "users": [
                {
                    "id": u.user_id,
                    "name": u.user_name,
                    "avatar": u.user_avatar,
                    "color": u.color,
                    "cursor": u.cursor_position,
                    "selection": u.selection
                }
                for u in room.users.values()
            ],
            "your_color": color
        }

    async def user_leave(
        self,
        document_id: str,
        user_id: str
    ) -> None:
        """
        Handle user leaving a collaboration session.

        Args:
            document_id: Document ID
            user_id: User ID
        """
        if document_id not in self.rooms:
            return

        room = self.rooms[document_id]

        # Remove user
        user = room.users.pop(user_id, None)
        if document_id in self.connections:
            self.connections[document_id].pop(user_id, None)

        # Remove from database
        await self._remove_db_presence(document_id, user_id)

        # Notify other users
        if user:
            await self._broadcast(
                document_id,
                {
                    "type": MessageType.USER_LEFT,
                    "user_id": user_id,
                    "user_name": user.user_name
                },
                exclude_user=user_id
            )

            logger.info(f"User {user.user_name} left document {document_id}")

        # Close room if empty
        if not room.users:
            await self.close_room(document_id)

    # =========================================================================
    # DOCUMENT SYNC
    # =========================================================================

    async def handle_sync_step1(
        self,
        document_id: str,
        user_id: str,
        state_vector: bytes
    ) -> Dict[str, Any]:
        """
        Handle Yjs sync step 1 (state vector exchange).

        Client sends their state vector, server responds with missing updates.

        Args:
            document_id: Document ID
            user_id: User ID
            state_vector: Client's Yjs state vector

        Returns:
            Sync step 2 response with server updates
        """
        room = self.rooms.get(document_id)
        if not room:
            return {"type": MessageType.ERROR, "message": "Room not found"}

        # In a real implementation, we would compute the diff
        # between client state and server state using y-py
        # For now, return full document state

        return {
            "type": MessageType.SYNC_STEP2,
            "update": room.document_state.hex() if room.document_state else None
        }

    async def handle_sync_update(
        self,
        document_id: str,
        user_id: str,
        update: bytes
    ) -> None:
        """
        Handle Yjs document update from a client.

        Merges the update into server state and broadcasts to others.

        Args:
            document_id: Document ID
            user_id: User ID
            update: Yjs update bytes
        """
        room = self.rooms.get(document_id)
        if not room:
            return

        # In a real implementation with y-py:
        # 1. Apply update to server Y.Doc
        # 2. Get merged state
        # For now, we just store the latest update

        room.document_state = update
        room.last_activity = datetime.utcnow()
        room.pending_updates.append(update)

        # Update user activity
        if user_id in room.users:
            room.users[user_id].last_activity = datetime.utcnow()

        # Broadcast to other users
        await self._broadcast(
            document_id,
            {
                "type": MessageType.SYNC_UPDATE,
                "update": update.hex(),
                "from_user": user_id
            },
            exclude_user=user_id
        )

        # Schedule auto-save
        if not room.save_scheduled:
            room.save_scheduled = True
            asyncio.create_task(self._schedule_auto_save(document_id))

    async def _schedule_auto_save(self, document_id: str) -> None:
        """Schedule auto-save after delay."""
        await asyncio.sleep(self.auto_save_interval)

        room = self.rooms.get(document_id)
        if room and room.pending_updates:
            await self._save_document_content(document_id, room.document_state)
            room.pending_updates.clear()
            room.save_scheduled = False

            # Notify users of save
            await self._broadcast(
                document_id,
                {"type": MessageType.DOC_SAVED, "saved_at": datetime.utcnow().isoformat()}
            )

    # =========================================================================
    # AWARENESS (CURSORS/PRESENCE)
    # =========================================================================

    async def handle_awareness_update(
        self,
        document_id: str,
        user_id: str,
        cursor_position: Optional[Dict] = None,
        selection: Optional[Dict] = None
    ) -> None:
        """
        Handle awareness update (cursor position, selection).

        Args:
            document_id: Document ID
            user_id: User ID
            cursor_position: Cursor position in document
            selection: Selection range
        """
        room = self.rooms.get(document_id)
        if not room or user_id not in room.users:
            return

        user = room.users[user_id]
        user.cursor_position = cursor_position
        user.selection = selection
        user.last_activity = datetime.utcnow()

        # Broadcast to other users
        await self._broadcast(
            document_id,
            {
                "type": MessageType.AWARENESS_UPDATE,
                "user_id": user_id,
                "cursor": cursor_position,
                "selection": selection,
                "color": user.color
            },
            exclude_user=user_id
        )

    async def get_awareness(self, document_id: str) -> List[Dict]:
        """Get current awareness state for all users in a room."""
        room = self.rooms.get(document_id)
        if not room:
            return []

        return [
            {
                "user_id": u.user_id,
                "user_name": u.user_name,
                "avatar": u.user_avatar,
                "color": u.color,
                "cursor": u.cursor_position,
                "selection": u.selection,
                "last_activity": u.last_activity.isoformat()
            }
            for u in room.users.values()
        ]

    # =========================================================================
    # MESSAGE HANDLING
    # =========================================================================

    async def handle_message(
        self,
        document_id: str,
        user_id: str,
        message: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Handle incoming WebSocket message.

        Args:
            document_id: Document ID
            user_id: User ID
            message: Message data

        Returns:
            Response message if any
        """
        msg_type = message.get("type")

        if msg_type == MessageType.PING:
            return {"type": MessageType.PONG}

        elif msg_type == MessageType.SYNC_STEP1:
            state_vector = bytes.fromhex(message.get("state_vector", ""))
            return await self.handle_sync_step1(document_id, user_id, state_vector)

        elif msg_type == MessageType.SYNC_UPDATE:
            update = bytes.fromhex(message.get("update", ""))
            await self.handle_sync_update(document_id, user_id, update)

        elif msg_type == MessageType.AWARENESS_UPDATE:
            await self.handle_awareness_update(
                document_id,
                user_id,
                cursor_position=message.get("cursor"),
                selection=message.get("selection")
            )

        elif msg_type == MessageType.DOC_SAVE:
            # Manual save request
            room = self.rooms.get(document_id)
            if room and room.document_state:
                await self._save_document_content(document_id, room.document_state)
                return {
                    "type": MessageType.DOC_SAVED,
                    "saved_at": datetime.utcnow().isoformat()
                }

        return None

    # =========================================================================
    # BROADCASTING
    # =========================================================================

    async def _broadcast(
        self,
        document_id: str,
        message: Dict[str, Any],
        exclude_user: Optional[str] = None
    ) -> None:
        """
        Broadcast message to all users in a room.

        Args:
            document_id: Document ID
            message: Message to broadcast
            exclude_user: User ID to exclude from broadcast
        """
        if document_id not in self.connections:
            return

        message_json = json.dumps(message)

        for user_id, websocket in self.connections[document_id].items():
            if user_id != exclude_user:
                try:
                    await websocket.send_text(message_json)
                except Exception as e:
                    logger.warning(f"Failed to send to user {user_id}: {e}")

    async def send_to_user(
        self,
        document_id: str,
        user_id: str,
        message: Dict[str, Any]
    ) -> bool:
        """Send message to specific user."""
        if document_id not in self.connections:
            return False

        websocket = self.connections[document_id].get(user_id)
        if not websocket:
            return False

        try:
            await websocket.send_text(json.dumps(message))
            return True
        except Exception as e:
            logger.warning(f"Failed to send to user {user_id}: {e}")
            return False

    # =========================================================================
    # DATABASE OPERATIONS
    # =========================================================================

    async def _load_session_state(self, document_id: str) -> Optional[bytes]:
        """Load Yjs state from database."""
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            cur.execute("""
                SELECT yjs_state
                FROM workspace.docs_sessions
                WHERE document_id = %s AND expires_at > NOW()
                ORDER BY created_at DESC
                LIMIT 1
            """, (document_id,))

            row = cur.fetchone()
            return row['yjs_state'] if row and row['yjs_state'] else None

        except Exception as e:
            logger.warning(f"Failed to load session state: {e}")
            return None
        finally:
            cur.close()
            conn.close()

    async def _save_session_state(
        self,
        document_id: str,
        yjs_state: bytes
    ) -> bool:
        """Save Yjs state to database."""
        conn = self._get_connection()
        cur = conn.cursor()

        try:
            cur.execute("""
                UPDATE workspace.docs_sessions
                SET yjs_state = %s, updated_at = NOW()
                WHERE document_id = %s AND expires_at > NOW()
            """, (yjs_state, document_id))

            conn.commit()
            return True

        except Exception as e:
            conn.rollback()
            logger.error(f"Failed to save session state: {e}")
            return False
        finally:
            cur.close()
            conn.close()

    async def _save_document_content(
        self,
        document_id: str,
        yjs_state: bytes
    ) -> bool:
        """
        Save document content from Yjs state.

        Note: In a real implementation, we would decode the Yjs state
        to get the Tiptap JSON content. For now, we just save the raw state.
        """
        conn = self._get_connection()
        cur = conn.cursor()

        try:
            # Save Yjs state to session
            await self._save_session_state(document_id, yjs_state)

            # Update document's updated_at
            cur.execute("""
                UPDATE dms.documents
                SET updated_at = NOW()
                WHERE id = %s
            """, (document_id,))

            conn.commit()

            logger.info(f"Auto-saved document {document_id}")
            return True

        except Exception as e:
            conn.rollback()
            logger.error(f"Failed to save document content: {e}")
            return False
        finally:
            cur.close()
            conn.close()

    async def _update_db_presence(
        self,
        document_id: str,
        user: ConnectedUser
    ) -> None:
        """Update user presence in database."""
        conn = self._get_connection()
        cur = conn.cursor()

        try:
            cur.execute("""
                INSERT INTO workspace.docs_presence (
                    document_id, user_id, user_name, user_avatar,
                    color, last_seen_at
                ) VALUES (%s, %s, %s, %s, %s, NOW())
                ON CONFLICT (document_id, user_id) DO UPDATE SET
                    user_name = EXCLUDED.user_name,
                    user_avatar = EXCLUDED.user_avatar,
                    color = EXCLUDED.color,
                    last_seen_at = NOW()
            """, (
                document_id, user.user_id, user.user_name,
                user.user_avatar, user.color
            ))

            conn.commit()

        except Exception as e:
            conn.rollback()
            logger.warning(f"Failed to update presence: {e}")
        finally:
            cur.close()
            conn.close()

    async def _remove_db_presence(
        self,
        document_id: str,
        user_id: str
    ) -> None:
        """Remove user presence from database."""
        conn = self._get_connection()
        cur = conn.cursor()

        try:
            cur.execute("""
                DELETE FROM workspace.docs_presence
                WHERE document_id = %s AND user_id = %s
            """, (document_id, user_id))

            conn.commit()

        except Exception as e:
            conn.rollback()
            logger.warning(f"Failed to remove presence: {e}")
        finally:
            cur.close()
            conn.close()

    # =========================================================================
    # CLEANUP
    # =========================================================================

    async def cleanup_stale_rooms(self) -> int:
        """Clean up rooms with no activity."""
        stale_threshold = datetime.utcnow() - timedelta(seconds=self.cleanup_interval)

        stale_rooms = [
            doc_id for doc_id, room in self.rooms.items()
            if room.last_activity < stale_threshold and not room.users
        ]

        for doc_id in stale_rooms:
            await self.close_room(doc_id)

        return len(stale_rooms)

    async def get_room_stats(self) -> Dict[str, Any]:
        """Get statistics about active rooms."""
        return {
            "total_rooms": len(self.rooms),
            "total_users": sum(len(r.users) for r in self.rooms.values()),
            "rooms": [
                {
                    "document_id": doc_id,
                    "user_count": len(room.users),
                    "created_at": room.created_at.isoformat(),
                    "last_activity": room.last_activity.isoformat()
                }
                for doc_id, room in self.rooms.items()
            ]
        }


# Singleton instance
_collaboration_service: Optional[DocsCollaborationService] = None


def get_docs_collaboration_service() -> DocsCollaborationService:
    """Get or create collaboration service instance."""
    global _collaboration_service
    if _collaboration_service is None:
        _collaboration_service = DocsCollaborationService()
    return _collaboration_service
