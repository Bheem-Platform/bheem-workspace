"""
Bheem Workspace - LiveKit Service
Handles video conferencing room management and tokens
Uses official LiveKit Python SDK for proper token generation
"""
import secrets
import string
from datetime import timedelta
from typing import Optional, Dict, Any
from livekit import api
from core.config import settings

class LiveKitService:
    def __init__(self):
        self.api_key = settings.LIVEKIT_API_KEY
        self.api_secret = settings.LIVEKIT_API_SECRET
        self.ws_url = settings.LIVEKIT_URL

    def generate_room_code(self) -> str:
        """Generate a unique room code like bhm-abc-xyz"""
        chars = string.ascii_lowercase
        part1 = ''.join(secrets.choice(chars) for _ in range(3))
        part2 = ''.join(secrets.choice(chars) for _ in range(3))
        return f"bhm-{part1}-{part2}"

    def create_token(
        self,
        room_name: str,
        participant_identity: str,
        participant_name: str,
        is_host: bool = False,
        ttl_seconds: int = 86400  # 24 hours
    ) -> str:
        """
        Create a LiveKit access token for a participant using official SDK
        """
        # Create access token using official LiveKit SDK
        token = api.AccessToken(
            api_key=self.api_key,
            api_secret=self.api_secret
        )

        # Set identity and name
        token.with_identity(participant_identity)
        token.with_name(participant_name)

        # Set TTL
        token.with_ttl(timedelta(seconds=ttl_seconds))

        # Build video grants - all participants can update their own metadata (for raise hand, etc.)
        grants = api.VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=True,
            can_subscribe=True,
            can_publish_data=True,
            can_update_own_metadata=True,  # Allow all participants to update their metadata
        )

        # Host gets additional permissions
        if is_host:
            grants.room_admin = True
            grants.room_record = True

        token.with_grants(grants)

        # Generate and return JWT
        return token.to_jwt()

    def get_join_url(self, room_code: str) -> str:
        """Get the join URL for a room"""
        return f"{settings.WORKSPACE_URL}/meet/room/{room_code}"

    def get_ws_url(self) -> str:
        """Get WebSocket URL for LiveKit"""
        return self.ws_url

    def generate_breakout_code(self, parent_room: str, index: int) -> str:
        """Generate a breakout room code from parent room."""
        suffix = ''.join(secrets.choice(string.ascii_lowercase) for _ in range(3))
        return f"{parent_room}-br{index}-{suffix}"

    async def create_breakout_room(
        self,
        parent_room: str,
        breakout_name: str,
        participants: list,
        index: int = 1
    ) -> Dict[str, Any]:
        """
        Create a breakout room from main meeting.

        Args:
            parent_room: Parent room code
            breakout_name: Display name for breakout room
            participants: List of participant identities to move
            index: Breakout room index

        Returns:
            Dict with room code and participant tokens
        """
        breakout_code = self.generate_breakout_code(parent_room, index)

        # Generate tokens for participants
        tokens = []
        for participant in participants:
            identity = participant.get("identity") or participant
            name = participant.get("name") or identity

            token = self.create_token(
                room_name=breakout_code,
                participant_identity=identity,
                participant_name=name,
                is_host=False,  # No host in breakout by default
                ttl_seconds=7200  # 2 hours for breakout
            )
            tokens.append({
                "participant": identity,
                "name": name,
                "token": token,
                "join_url": f"{settings.WORKSPACE_URL}/meet/room/{breakout_code}"
            })

        return {
            "breakout_code": breakout_code,
            "breakout_name": breakout_name,
            "parent_room": parent_room,
            "tokens": tokens,
            "participant_count": len(tokens)
        }

    async def create_breakout_rooms(
        self,
        parent_room: str,
        groups: list
    ) -> Dict[str, Any]:
        """
        Create multiple breakout rooms.

        Args:
            parent_room: Parent room code
            groups: List of groups, each with name and participants

        Returns:
            Dict with all breakout rooms
        """
        breakout_rooms = []

        for idx, group in enumerate(groups, 1):
            room = await self.create_breakout_room(
                parent_room=parent_room,
                breakout_name=group.get("name", f"Breakout Room {idx}"),
                participants=group.get("participants", []),
                index=idx
            )
            breakout_rooms.append(room)

        return {
            "parent_room": parent_room,
            "breakout_count": len(breakout_rooms),
            "breakout_rooms": breakout_rooms
        }

    def create_return_token(
        self,
        parent_room: str,
        participant_identity: str,
        participant_name: str
    ) -> str:
        """
        Create a token for participant to return from breakout to main room.
        """
        return self.create_token(
            room_name=parent_room,
            participant_identity=participant_identity,
            participant_name=participant_name,
            is_host=False,
            ttl_seconds=7200
        )

    # ==========================================
    # CHAT SYSTEM METHODS
    # ==========================================

    def create_chat_token(
        self,
        conversation_id: str,
        participant_identity: str,
        participant_name: str,
        is_external: bool = False,
        ttl_seconds: int = 86400  # 24 hours
    ) -> str:
        """
        Create a LiveKit access token for chat room (data-only, no audio/video)
        Used for real-time messaging, typing indicators, and presence

        Args:
            conversation_id: Conversation UUID
            participant_identity: User's unique identifier
            participant_name: User's display name
            is_external: True if external user (adds prefix for tracking)
            ttl_seconds: Token validity period

        Returns:
            JWT token string
        """
        token = api.AccessToken(
            api_key=self.api_key,
            api_secret=self.api_secret
        )

        # External users get a different identity prefix for tracking
        identity = f"ext-{participant_identity}" if is_external else participant_identity

        token.with_identity(identity)
        token.with_name(participant_name)
        token.with_ttl(timedelta(seconds=ttl_seconds))

        # Chat room grants - data channel only, no video/audio
        grants = api.VideoGrants(
            room_join=True,
            room=f"chat-{conversation_id}",
            can_publish=False,         # No video/audio publishing
            can_subscribe=False,       # No video/audio subscribing
            can_publish_data=True,     # Allow data channel messages
            can_update_own_metadata=True,  # For online status
        )

        token.with_grants(grants)
        return token.to_jwt()

    def create_call_token(
        self,
        call_room_name: str,
        participant_identity: str,
        participant_name: str,
        is_caller: bool = False,
        is_external: bool = False,
        ttl_seconds: int = 3600  # 1 hour
    ) -> str:
        """
        Create a LiveKit access token for audio/video calls in chat

        Args:
            call_room_name: Unique room name for the call
            participant_identity: User's unique identifier
            participant_name: User's display name
            is_caller: Whether this is the call initiator
            is_external: True if external user
            ttl_seconds: Token validity period

        Returns:
            JWT token string
        """
        token = api.AccessToken(
            api_key=self.api_key,
            api_secret=self.api_secret
        )

        # External users get a different identity prefix
        identity = f"ext-{participant_identity}" if is_external else participant_identity

        token.with_identity(identity)
        token.with_name(participant_name)
        token.with_ttl(timedelta(seconds=ttl_seconds))

        # Call room grants - audio/video enabled
        grants = api.VideoGrants(
            room_join=True,
            room=call_room_name,
            can_publish=True,          # Can publish audio/video
            can_subscribe=True,        # Can subscribe to audio/video
            can_publish_data=True,     # For call signaling
            can_update_own_metadata=True,
        )

        # Caller gets admin permissions
        if is_caller:
            grants.room_admin = True

        token.with_grants(grants)
        return token.to_jwt()

    def generate_call_room_name(self, conversation_id: str) -> str:
        """
        Generate unique room name for an audio/video call

        Args:
            conversation_id: The conversation UUID

        Returns:
            Unique room name like call-abc12345-xyz789
        """
        suffix = secrets.token_hex(4)
        # Use first 8 chars of conversation_id for readability
        conv_prefix = conversation_id.replace('-', '')[:8]
        return f"call-{conv_prefix}-{suffix}"

    def get_chat_ws_url(self) -> str:
        """Get WebSocket URL for chat LiveKit connection"""
        return self.ws_url


# Singleton instance
livekit_service = LiveKitService()
