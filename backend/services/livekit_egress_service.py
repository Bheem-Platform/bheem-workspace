"""
Bheem Meet - LiveKit Egress Service
Handles room recording capture using LiveKit's Egress API
Now uses S3 for storage instead of local files
"""
import httpx
import jwt
import time
import os
from typing import Optional, Dict, Any, List
from datetime import datetime
from core.config import settings


class LiveKitEgressService:
    """
    Service for managing LiveKit Egress (recording) operations.

    LiveKit Egress allows recording of:
    - Room composite (all participants in a layout)
    - Track composite (specific tracks)
    - Individual tracks

    Storage: S3 bucket (bheemcloud)
    """

    def __init__(self):
        self.api_key = settings.LIVEKIT_API_KEY
        self.api_secret = settings.LIVEKIT_API_SECRET
        self.livekit_url = settings.LIVEKIT_URL.replace("wss://", "https://").replace("ws://", "http://")
        self.temp_dir = "/tmp/recordings"

        # S3 configuration
        self.s3_bucket = getattr(settings, 'S3_BUCKET', 'bheem')
        self.s3_region = getattr(settings, 'S3_REGION', 'hel1')
        self.s3_endpoint = getattr(settings, 'S3_ENDPOINT', 'https://hel1.your-objectstorage.com')
        self.s3_access_key = getattr(settings, 'S3_ACCESS_KEY', 'E8OBSHD5J85G0DQXAACX')
        self.s3_secret_key = getattr(settings, 'S3_SECRET_KEY', 'O171vuUctulQfPRoz1W4ulfHOan3bXKuztnSgJDV')

        # Ensure temp directory exists (for fallback)
        os.makedirs(self.temp_dir, exist_ok=True)

    def _create_egress_token(self) -> str:
        """Create a signed JWT token for Egress API access"""
        now = int(time.time())

        claims = {
            "iss": self.api_key,
            "sub": self.api_key,
            "nbf": now,
            "exp": now + 3600,  # 1 hour
            "video": {
                "roomRecord": True
            }
        }

        return jwt.encode(claims, self.api_secret, algorithm="HS256")

    async def start_room_composite_egress(
        self,
        room_name: str,
        recording_id: str,
        options: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Start recording a room with composite layout (all participants).
        Recordings are saved directly to S3 bucket.

        Args:
            room_name: The LiveKit room name (room code)
            recording_id: Our internal recording ID for file naming
            options: Recording options:
                - layout: grid, speaker, single-speaker
                - audio_only: bool
                - video_only: bool
                - resolution: 720p, 1080p, 1440p

        Returns:
            Dict with egress_id, status, s3_path, or error
        """
        options = options or {}

        # Build egress request
        layout = options.get("layout", "grid")
        resolution = options.get("resolution", "1080p")

        # Resolution presets
        resolutions = {
            "720p": {"width": 1280, "height": 720},
            "1080p": {"width": 1920, "height": 1080},
            "1440p": {"width": 2560, "height": 1440}
        }
        res = resolutions.get(resolution, resolutions["1080p"])

        # S3 output path: recordings/{room_code}/{recording_id}.mp4
        s3_path = f"recordings/{room_name}/{recording_id}.mp4"

        # LiveKit Egress API - use 'file' with nested 's3' for S3 output
        request_body = {
            "room_name": room_name,
            "layout": layout,
            "audio_only": options.get("audio_only", False),
            "video_only": options.get("video_only", False),
            "file": {
                "filepath": s3_path,
                "disable_manifest": True,
                "s3": {
                    "access_key": self.s3_access_key,
                    "secret": self.s3_secret_key,
                    "region": self.s3_region,
                    "endpoint": self.s3_endpoint,
                    "bucket": self.s3_bucket,
                    "force_path_style": True
                }
            },
            "options": {
                "width": res["width"],
                "height": res["height"],
                "depth": 24,
                "framerate": 30,
                "audio_bitrate": 128,
                "video_bitrate": 4500,
                "key_frame_interval": 4.0
            }
        }

        try:
            token = self._create_egress_token()

            async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
                response = await client.post(
                    f"{self.livekit_url}/twirp/livekit.Egress/StartRoomCompositeEgress",
                    json=request_body,
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json"
                    }
                )

                if response.status_code == 200:
                    data = response.json()
                    return {
                        "success": True,
                        "egress_id": data.get("egress_id"),
                        "status": data.get("status", "active"),
                        "room_name": room_name,
                        "s3_path": s3_path,
                        "s3_bucket": self.s3_bucket,
                        "storage_type": "s3"
                    }
                else:
                    return {
                        "success": False,
                        "error": f"Egress API error: {response.status_code} - {response.text}"
                    }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    async def stop_egress(self, egress_id: str) -> Dict[str, Any]:
        """
        Stop an active egress/recording.

        Args:
            egress_id: The LiveKit egress ID

        Returns:
            Dict with status or error
        """
        try:
            token = self._create_egress_token()

            async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
                response = await client.post(
                    f"{self.livekit_url}/twirp/livekit.Egress/StopEgress",
                    json={"egress_id": egress_id},
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json"
                    }
                )

                if response.status_code == 200:
                    data = response.json()
                    return {
                        "success": True,
                        "egress_id": egress_id,
                        "status": data.get("status", "ended"),
                        "ended_at": datetime.utcnow().isoformat()
                    }
                else:
                    return {
                        "success": False,
                        "error": f"Stop egress error: {response.status_code} - {response.text}"
                    }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    async def get_egress_info(self, egress_id: str) -> Dict[str, Any]:
        """
        Get status information for an egress.

        Args:
            egress_id: The LiveKit egress ID

        Returns:
            Dict with egress info or error
        """
        try:
            token = self._create_egress_token()

            async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
                response = await client.post(
                    f"{self.livekit_url}/twirp/livekit.Egress/ListEgress",
                    json={"egress_id": egress_id},
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json"
                    }
                )

                if response.status_code == 200:
                    data = response.json()
                    items = data.get("items", [])

                    if items:
                        info = items[0]
                        return {
                            "success": True,
                            "egress_id": info.get("egress_id"),
                            "room_name": info.get("room_name"),
                            "status": info.get("status"),
                            "started_at": info.get("started_at"),
                            "ended_at": info.get("ended_at"),
                            "error": info.get("error")
                        }
                    else:
                        return {
                            "success": False,
                            "error": "Egress not found"
                        }
                else:
                    return {
                        "success": False,
                        "error": f"List egress error: {response.status_code}"
                    }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    async def list_active_egress(self, room_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        List all active egress operations, optionally filtered by room.

        Args:
            room_name: Optional room name to filter by

        Returns:
            List of egress info dicts
        """
        try:
            token = self._create_egress_token()

            request_body = {}
            if room_name:
                request_body["room_name"] = room_name

            async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
                response = await client.post(
                    f"{self.livekit_url}/twirp/livekit.Egress/ListEgress",
                    json=request_body,
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json"
                    }
                )

                if response.status_code == 200:
                    data = response.json()
                    return data.get("items", [])
                else:
                    return []

        except Exception:
            return []

    def get_recording_file_path(self, recording_id: str) -> str:
        """Get the local file path for a recording (legacy, for fallback)"""
        return f"{self.temp_dir}/{recording_id}.mp4"

    def get_s3_path(self, room_name: str, recording_id: str) -> str:
        """Get the S3 path for a recording"""
        return f"recordings/{room_name}/{recording_id}.mp4"

    def get_s3_url(self, s3_path: str) -> str:
        """Get the full S3 URL for a recording"""
        # Format: https://endpoint/bucket/path
        endpoint = self.s3_endpoint.rstrip('/')
        return f"{endpoint}/{self.s3_bucket}/{s3_path}"

    def recording_file_exists(self, recording_id: str) -> bool:
        """Check if recording file exists locally (legacy)"""
        path = self.get_recording_file_path(recording_id)
        return os.path.exists(path)

    def get_recording_file_size(self, recording_id: str) -> Optional[int]:
        """Get file size of recording in bytes (local files only)"""
        path = self.get_recording_file_path(recording_id)
        if os.path.exists(path):
            return os.path.getsize(path)
        return None

    def delete_local_recording(self, recording_id: str) -> bool:
        """Delete local recording file after upload (legacy cleanup)"""
        path = self.get_recording_file_path(recording_id)
        if os.path.exists(path):
            os.remove(path)
            return True
        return False


# Singleton instance
livekit_egress_service = LiveKitEgressService()
