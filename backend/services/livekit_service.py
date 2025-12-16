"""
Bheem Workspace - LiveKit Service
Handles video conferencing room management and tokens
"""
import time
import jwt
import secrets
import string
from typing import Optional, Dict, Any
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
        Create a LiveKit access token for a participant
        """
        now = int(time.time())
        exp = now + ttl_seconds
        
        # Video grant permissions
        video_grant = {
            "room": room_name,
            "roomJoin": True,
            "canPublish": True,
            "canSubscribe": True,
            "canPublishData": True,
        }
        
        # Host gets additional permissions
        if is_host:
            video_grant.update({
                "roomAdmin": True,
                "roomRecord": True,
                "canUpdateOwnMetadata": True,
            })
        
        # Build JWT payload
        payload = {
            "iss": self.api_key,
            "sub": participant_identity,
            "name": participant_name,
            "nbf": now,
            "exp": exp,
            "video": video_grant,
            "metadata": "",
        }
        
        # Sign with API secret
        token = jwt.encode(payload, self.api_secret, algorithm="HS256")
        return token
    
    def get_join_url(self, room_code: str) -> str:
        """Get the join URL for a room"""
        return f"{settings.WORKSPACE_URL}/meet/room/{room_code}"
    
    def get_ws_url(self) -> str:
        """Get WebSocket URL for LiveKit"""
        return self.ws_url

# Singleton instance
livekit_service = LiveKitService()
