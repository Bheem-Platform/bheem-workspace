"""
Bheem Meet - Transcription Service
AI-powered transcription using OpenAI Whisper API
"""
import httpx
import os
import json
import subprocess
from typing import Optional, Dict, Any, List
from datetime import datetime
from core.config import settings


class TranscriptionService:
    """
    Service for transcribing meeting recordings using AI.

    Supports:
    - OpenAI Whisper API (cloud)
    - Local Whisper (self-hosted)
    - Speaker diarization
    - AI-powered summaries
    """

    def __init__(self):
        self.openai_api_key = getattr(settings, 'OPENAI_API_KEY', None)
        self.whisper_api_url = getattr(settings, 'WHISPER_API_URL', None)
        self.temp_dir = "/tmp/transcriptions"

        # Ensure temp directory exists
        os.makedirs(self.temp_dir, exist_ok=True)

    async def transcribe_recording(
        self,
        recording_path: str,
        recording_id: str,
        language: str = "en",
        options: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Transcribe a recording file.

        Args:
            recording_path: Path to the recording file (MP4/WebM)
            recording_id: Our internal recording ID
            language: Language code (en, es, fr, etc.)
            options: Additional options:
                - generate_summary: bool
                - detect_speakers: bool
                - timestamps: bool

        Returns:
            Dict with transcript, segments, and metadata
        """
        options = options or {}

        try:
            # Extract audio from video
            audio_path = await self._extract_audio(recording_path, recording_id)

            if not audio_path:
                return {
                    "success": False,
                    "error": "Failed to extract audio from recording"
                }

            # Transcribe using available method
            if self.openai_api_key:
                result = await self._transcribe_openai(audio_path, language)
            elif self.whisper_api_url:
                result = await self._transcribe_local_whisper(audio_path, language)
            else:
                return {
                    "success": False,
                    "error": "No transcription service configured"
                }

            if not result["success"]:
                return result

            # Generate summary if requested
            summary = None
            action_items = []
            key_topics = []

            if options.get("generate_summary", True) and self.openai_api_key:
                summary_result = await self._generate_summary(result["text"])
                summary = summary_result.get("summary")
                action_items = summary_result.get("action_items", [])
                key_topics = summary_result.get("key_topics", [])

            # Clean up temp audio file
            if os.path.exists(audio_path):
                os.remove(audio_path)

            return {
                "success": True,
                "text": result["text"],
                "segments": result.get("segments", []),
                "language": result.get("language", language),
                "duration": result.get("duration"),
                "word_count": len(result["text"].split()),
                "summary": summary,
                "action_items": action_items,
                "key_topics": key_topics,
                "confidence": result.get("confidence", 0.95)
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    async def _extract_audio(self, video_path: str, recording_id: str) -> Optional[str]:
        """Extract audio from video file using ffmpeg"""
        audio_path = f"{self.temp_dir}/{recording_id}.mp3"

        try:
            # Use ffmpeg to extract audio
            cmd = [
                "ffmpeg", "-y",
                "-i", video_path,
                "-vn",  # No video
                "-acodec", "libmp3lame",
                "-ab", "128k",
                "-ar", "16000",  # 16kHz for Whisper
                audio_path
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300  # 5 minutes max
            )

            if result.returncode == 0 and os.path.exists(audio_path):
                return audio_path
            else:
                print(f"FFmpeg error: {result.stderr}")
                return None

        except subprocess.TimeoutExpired:
            print("Audio extraction timed out")
            return None
        except FileNotFoundError:
            print("FFmpeg not installed")
            return None
        except Exception as e:
            print(f"Audio extraction error: {e}")
            return None

    async def _transcribe_openai(self, audio_path: str, language: str) -> Dict[str, Any]:
        """Transcribe using OpenAI Whisper API"""
        try:
            async with httpx.AsyncClient(timeout=600.0) as client:
                with open(audio_path, "rb") as audio_file:
                    files = {
                        "file": ("audio.mp3", audio_file, "audio/mpeg"),
                        "model": (None, "whisper-1"),
                        "language": (None, language),
                        "response_format": (None, "verbose_json"),
                        "timestamp_granularities[]": (None, "segment")
                    }

                    response = await client.post(
                        "https://api.openai.com/v1/audio/transcriptions",
                        files=files,
                        headers={
                            "Authorization": f"Bearer {self.openai_api_key}"
                        }
                    )

                    if response.status_code == 200:
                        data = response.json()
                        return {
                            "success": True,
                            "text": data.get("text", ""),
                            "segments": self._format_segments(data.get("segments", [])),
                            "language": data.get("language", language),
                            "duration": data.get("duration")
                        }
                    else:
                        return {
                            "success": False,
                            "error": f"OpenAI API error: {response.status_code} - {response.text}"
                        }

        except Exception as e:
            return {
                "success": False,
                "error": f"OpenAI transcription error: {str(e)}"
            }

    async def _transcribe_local_whisper(self, audio_path: str, language: str) -> Dict[str, Any]:
        """Transcribe using local Whisper API"""
        try:
            async with httpx.AsyncClient(timeout=600.0) as client:
                with open(audio_path, "rb") as audio_file:
                    files = {
                        "file": ("audio.mp3", audio_file, "audio/mpeg")
                    }
                    data = {
                        "language": language,
                        "output": "json"
                    }

                    response = await client.post(
                        f"{self.whisper_api_url}/transcribe",
                        files=files,
                        data=data
                    )

                    if response.status_code == 200:
                        result = response.json()
                        return {
                            "success": True,
                            "text": result.get("text", ""),
                            "segments": self._format_segments(result.get("segments", [])),
                            "language": language,
                            "duration": result.get("duration")
                        }
                    else:
                        return {
                            "success": False,
                            "error": f"Local Whisper error: {response.status_code}"
                        }

        except Exception as e:
            return {
                "success": False,
                "error": f"Local Whisper error: {str(e)}"
            }

    def _format_segments(self, segments: List[Dict]) -> List[Dict]:
        """Format transcript segments with timestamps"""
        formatted = []
        for seg in segments:
            formatted.append({
                "start": seg.get("start", 0),
                "end": seg.get("end", 0),
                "text": seg.get("text", "").strip(),
                "speaker": seg.get("speaker"),  # If diarization enabled
                "confidence": seg.get("confidence", seg.get("avg_logprob"))
            })
        return formatted

    async def _generate_summary(self, transcript: str) -> Dict[str, Any]:
        """Generate AI summary, action items, and key topics"""
        if not self.openai_api_key or len(transcript) < 100:
            return {}

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.openai_api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "gpt-4o-mini",
                        "messages": [
                            {
                                "role": "system",
                                "content": """You are a meeting assistant. Analyze the transcript and provide:
1. A concise summary (2-3 paragraphs)
2. Action items with assignees if mentioned
3. Key topics discussed

Respond in JSON format:
{
    "summary": "...",
    "action_items": [{"task": "...", "assignee": "...", "due": "..."}],
    "key_topics": ["topic1", "topic2"]
}"""
                            },
                            {
                                "role": "user",
                                "content": f"Analyze this meeting transcript:\n\n{transcript[:10000]}"
                            }
                        ],
                        "response_format": {"type": "json_object"}
                    }
                )

                if response.status_code == 200:
                    data = response.json()
                    content = data["choices"][0]["message"]["content"]
                    return json.loads(content)
                else:
                    return {}

        except Exception as e:
            print(f"Summary generation error: {e}")
            return {}

    async def get_transcript_for_recording(
        self,
        recording_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get stored transcript from database.
        This would be called after transcription is complete.
        """
        # This would query the database - implemented in the API layer
        pass


# Singleton instance
transcription_service = TranscriptionService()
