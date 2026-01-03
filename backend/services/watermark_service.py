"""
Bheem Meet - Watermark Service
Adds dynamic watermarks to meeting recordings for security and branding
"""
import subprocess
import os
from typing import Optional, Dict, Any
from datetime import datetime
from core.config import settings


class WatermarkService:
    """
    Service for applying watermarks to meeting recordings.

    Supports:
    - Text watermarks (user email, timestamp, custom text)
    - Image watermarks (company logo)
    - Multiple positions
    - Configurable opacity
    """

    def __init__(self):
        self.enabled = getattr(settings, 'WATERMARK_ENABLED', True)
        self.logo_path = getattr(settings, 'WATERMARK_LOGO_PATH', None)
        self.default_opacity = getattr(settings, 'WATERMARK_OPACITY', 0.3)
        self.temp_dir = "/tmp/watermarked"

        # Ensure temp directory exists
        os.makedirs(self.temp_dir, exist_ok=True)

    async def apply_watermark(
        self,
        input_path: str,
        output_path: str,
        options: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Apply watermark to a video file.

        Args:
            input_path: Path to input video file
            output_path: Path for watermarked output
            options: Watermark options:
                - text: Custom text to display
                - user_email: User's email (for identification)
                - timestamp: Include timestamp
                - position: top-left, top-right, bottom-left, bottom-right, center
                - opacity: 0.0 to 1.0
                - logo: bool (include company logo)

        Returns:
            Dict with success status and output path
        """
        if not self.enabled:
            # Just copy the file if watermarking is disabled
            return await self._copy_file(input_path, output_path)

        options = options or {}

        try:
            # Build watermark text
            watermark_text = self._build_watermark_text(options)
            position = options.get("position", "bottom-right")
            opacity = options.get("opacity", self.default_opacity)
            include_logo = options.get("logo", False) and self.logo_path

            # Build FFmpeg filter
            filter_complex = self._build_filter(
                watermark_text,
                position,
                opacity,
                include_logo
            )

            # Build FFmpeg command
            cmd = [
                "ffmpeg", "-y",
                "-i", input_path
            ]

            # Add logo input if needed
            if include_logo and os.path.exists(self.logo_path):
                cmd.extend(["-i", self.logo_path])

            cmd.extend([
                "-filter_complex", filter_complex,
                "-c:a", "copy",  # Copy audio without re-encoding
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", "23",
                output_path
            ])

            # Run FFmpeg
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=1800  # 30 minutes max
            )

            if result.returncode == 0 and os.path.exists(output_path):
                return {
                    "success": True,
                    "output_path": output_path,
                    "watermark_applied": True,
                    "watermark_text": watermark_text
                }
            else:
                print(f"FFmpeg watermark error: {result.stderr}")
                # Fall back to copying without watermark
                return await self._copy_file(input_path, output_path)

        except subprocess.TimeoutExpired:
            print("Watermarking timed out")
            return await self._copy_file(input_path, output_path)
        except FileNotFoundError:
            print("FFmpeg not installed - skipping watermark")
            return await self._copy_file(input_path, output_path)
        except Exception as e:
            print(f"Watermark error: {e}")
            return await self._copy_file(input_path, output_path)

    def _build_watermark_text(self, options: Dict[str, Any]) -> str:
        """Build the watermark text string"""
        parts = []

        # Custom text
        if options.get("text"):
            parts.append(options["text"])

        # User email for identification
        if options.get("user_email"):
            parts.append(options["user_email"])

        # Timestamp
        if options.get("timestamp", True):
            timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
            parts.append(timestamp)

        # Default if no text provided
        if not parts:
            parts.append("Bheem Meet Recording")

        return " | ".join(parts)

    def _build_filter(
        self,
        text: str,
        position: str,
        opacity: float,
        include_logo: bool
    ) -> str:
        """Build FFmpeg filter_complex for watermark"""

        # Position coordinates
        positions = {
            "top-left": "x=20:y=20",
            "top-right": "x=w-tw-20:y=20",
            "bottom-left": "x=20:y=h-th-20",
            "bottom-right": "x=w-tw-20:y=h-th-20",
            "center": "x=(w-tw)/2:y=(h-th)/2"
        }
        pos = positions.get(position, positions["bottom-right"])

        # Escape special characters in text for FFmpeg
        escaped_text = text.replace("'", "'\\''").replace(":", "\\:")

        # Build filter
        filters = []

        # Text watermark
        alpha = int(opacity * 255)
        text_filter = (
            f"drawtext=text='{escaped_text}':"
            f"fontcolor=white@{opacity}:"
            f"fontsize=18:"
            f"borderw=1:"
            f"bordercolor=black@{opacity}:"
            f"{pos}"
        )
        filters.append(text_filter)

        # Logo overlay (if enabled)
        if include_logo:
            # Scale logo and overlay
            logo_filter = (
                "[1:v]scale=100:-1,format=rgba,"
                f"colorchannelmixer=aa={opacity}[logo];"
                "[0:v][logo]overlay=W-w-20:20"
            )
            # Combine with text
            return f"{logo_filter},{text_filter}"

        return text_filter

    async def _copy_file(self, src: str, dst: str) -> Dict[str, Any]:
        """Copy file without watermarking"""
        try:
            import shutil
            shutil.copy2(src, dst)
            return {
                "success": True,
                "output_path": dst,
                "watermark_applied": False
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    async def apply_text_overlay(
        self,
        input_path: str,
        output_path: str,
        text: str,
        position: str = "bottom-right",
        opacity: float = 0.3
    ) -> Dict[str, Any]:
        """
        Simple text overlay (convenience method).

        Args:
            input_path: Input video path
            output_path: Output video path
            text: Text to overlay
            position: Position on video
            opacity: Text opacity (0.0-1.0)

        Returns:
            Dict with success status
        """
        return await self.apply_watermark(
            input_path,
            output_path,
            {
                "text": text,
                "position": position,
                "opacity": opacity,
                "timestamp": False
            }
        )

    async def apply_logo_overlay(
        self,
        input_path: str,
        output_path: str,
        logo_path: str = None,
        position: str = "top-right",
        opacity: float = 0.5,
        scale: int = 100
    ) -> Dict[str, Any]:
        """
        Apply logo overlay to video.

        Args:
            input_path: Input video path
            output_path: Output video path
            logo_path: Path to logo image (uses default if None)
            position: Position on video
            opacity: Logo opacity
            scale: Logo width in pixels

        Returns:
            Dict with success status
        """
        logo = logo_path or self.logo_path

        if not logo or not os.path.exists(logo):
            return {
                "success": False,
                "error": "Logo file not found"
            }

        try:
            # Position coordinates for overlay
            positions = {
                "top-left": "20:20",
                "top-right": "W-w-20:20",
                "bottom-left": "20:H-h-20",
                "bottom-right": "W-w-20:H-h-20"
            }
            pos = positions.get(position, positions["top-right"])

            filter_complex = (
                f"[1:v]scale={scale}:-1,format=rgba,"
                f"colorchannelmixer=aa={opacity}[logo];"
                f"[0:v][logo]overlay={pos}"
            )

            cmd = [
                "ffmpeg", "-y",
                "-i", input_path,
                "-i", logo,
                "-filter_complex", filter_complex,
                "-c:a", "copy",
                "-c:v", "libx264",
                "-preset", "fast",
                output_path
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=1800
            )

            if result.returncode == 0:
                return {
                    "success": True,
                    "output_path": output_path
                }
            else:
                return {
                    "success": False,
                    "error": result.stderr
                }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }


# Singleton instance
watermark_service = WatermarkService()
