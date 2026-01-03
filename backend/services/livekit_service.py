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

        # Build video grants
        grants = api.VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=True,
            can_subscribe=True,
            can_publish_data=True,
        )

        # Host gets additional permissions
        if is_host:
            grants.room_admin = True
            grants.room_record = True
            grants.can_update_own_metadata = True

        token.with_grants(grants)

        # Generate and return JWT
        return token.to_jwt()

    def get_join_url(self, room_code: str) -> str:
        """Get the join URL for a room"""
        return f"{settings.WORKSPACE_URL}/meet/room/{room_code}"

    def get_ws_url(self) -> str:
        """Get WebSocket URL for LiveKit"""
        return self.ws_url

# Singleton instance
livekit_service = LiveKitService()
