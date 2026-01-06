"""
Bheem Workspace - Attachment Preview Service
Generate previews and thumbnails for email attachments
"""
import os
import io
import base64
import mimetypes
import hashlib
from typing import Optional, Dict, Any, Tuple
from pathlib import Path
from core.logging import get_logger

logger = get_logger("bheem.mail.attachment.preview")

# Preview cache directory
PREVIEW_CACHE_DIR = os.getenv("PREVIEW_CACHE_DIR", "/tmp/bheem_previews")


class AttachmentPreviewService:
    """
    Service for generating and serving attachment previews.

    Supported preview types:
    - Images: Direct display (jpg, png, gif, webp, svg)
    - PDFs: First page thumbnail + viewer support
    - Text/Code: Syntax highlighted preview
    - Documents: Convert to PDF preview (optional)
    - Videos: Thumbnail from first frame
    - Audio: Waveform visualization
    """

    # MIME types that can be previewed directly in browser
    DIRECT_PREVIEW_TYPES = {
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
        'application/pdf',
        'text/plain', 'text/html', 'text/css', 'text/javascript',
        'application/json', 'application/xml',
        'video/mp4', 'video/webm',
        'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm',
    }

    # Text file extensions for syntax highlighting
    CODE_EXTENSIONS = {
        '.py': 'python',
        '.js': 'javascript',
        '.ts': 'typescript',
        '.jsx': 'jsx',
        '.tsx': 'tsx',
        '.html': 'html',
        '.css': 'css',
        '.json': 'json',
        '.xml': 'xml',
        '.yaml': 'yaml',
        '.yml': 'yaml',
        '.md': 'markdown',
        '.sql': 'sql',
        '.sh': 'bash',
        '.bash': 'bash',
        '.go': 'go',
        '.rs': 'rust',
        '.java': 'java',
        '.c': 'c',
        '.cpp': 'cpp',
        '.h': 'c',
        '.hpp': 'cpp',
        '.rb': 'ruby',
        '.php': 'php',
        '.swift': 'swift',
        '.kt': 'kotlin',
        '.scala': 'scala',
        '.r': 'r',
        '.lua': 'lua',
        '.dockerfile': 'dockerfile',
        '.toml': 'toml',
        '.ini': 'ini',
        '.env': 'bash',
    }

    # Maximum file sizes for preview generation (in bytes)
    MAX_PREVIEW_SIZES = {
        'image': 50 * 1024 * 1024,      # 50MB
        'text': 1 * 1024 * 1024,         # 1MB
        'pdf': 100 * 1024 * 1024,        # 100MB
        'video': 500 * 1024 * 1024,      # 500MB
        'audio': 100 * 1024 * 1024,      # 100MB
    }

    def __init__(self):
        # Ensure cache directory exists
        os.makedirs(PREVIEW_CACHE_DIR, exist_ok=True)

    def get_preview_info(
        self,
        filename: str,
        content_type: Optional[str] = None,
        file_size: int = 0
    ) -> Dict[str, Any]:
        """
        Get preview capabilities for an attachment.

        Returns info about what kind of preview is available.
        """
        if not content_type:
            content_type, _ = mimetypes.guess_type(filename)
            content_type = content_type or 'application/octet-stream'

        ext = Path(filename).suffix.lower()

        preview_info = {
            'filename': filename,
            'content_type': content_type,
            'file_size': file_size,
            'can_preview': False,
            'preview_type': None,
            'language': None,
            'requires_conversion': False,
            'too_large': False,
        }

        # Check if file is too large
        category = self._get_category(content_type)
        max_size = self.MAX_PREVIEW_SIZES.get(category, 10 * 1024 * 1024)
        if file_size > max_size:
            preview_info['too_large'] = True
            preview_info['max_size'] = max_size
            return preview_info

        # Determine preview type
        if content_type.startswith('image/'):
            preview_info['can_preview'] = True
            preview_info['preview_type'] = 'image'

        elif content_type == 'application/pdf':
            preview_info['can_preview'] = True
            preview_info['preview_type'] = 'pdf'

        elif content_type.startswith('text/') or ext in self.CODE_EXTENSIONS:
            preview_info['can_preview'] = True
            preview_info['preview_type'] = 'text'
            preview_info['language'] = self.CODE_EXTENSIONS.get(ext, 'text')

        elif content_type == 'application/json':
            preview_info['can_preview'] = True
            preview_info['preview_type'] = 'text'
            preview_info['language'] = 'json'

        elif content_type.startswith('video/'):
            preview_info['can_preview'] = True
            preview_info['preview_type'] = 'video'

        elif content_type.startswith('audio/'):
            preview_info['can_preview'] = True
            preview_info['preview_type'] = 'audio'

        # Office documents (would need conversion)
        elif content_type in [
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ]:
            preview_info['can_preview'] = True
            preview_info['preview_type'] = 'document'
            preview_info['requires_conversion'] = True

        return preview_info

    def _get_category(self, content_type: str) -> str:
        """Get file category from content type."""
        if content_type.startswith('image/'):
            return 'image'
        elif content_type.startswith('text/') or content_type == 'application/json':
            return 'text'
        elif content_type == 'application/pdf':
            return 'pdf'
        elif content_type.startswith('video/'):
            return 'video'
        elif content_type.startswith('audio/'):
            return 'audio'
        return 'other'

    async def generate_thumbnail(
        self,
        content: bytes,
        filename: str,
        content_type: Optional[str] = None,
        size: Tuple[int, int] = (200, 200)
    ) -> Optional[Dict[str, Any]]:
        """
        Generate a thumbnail for the attachment.

        Returns thumbnail as base64 data URL.
        """
        if not content_type:
            content_type, _ = mimetypes.guess_type(filename)
            content_type = content_type or 'application/octet-stream'

        # Check cache first
        cache_key = self._get_cache_key(content, size)
        cached = self._get_cached_thumbnail(cache_key)
        if cached:
            return cached

        thumbnail = None

        try:
            if content_type.startswith('image/'):
                thumbnail = await self._generate_image_thumbnail(content, size)

            elif content_type == 'application/pdf':
                thumbnail = await self._generate_pdf_thumbnail(content, size)

            elif content_type.startswith('video/'):
                thumbnail = await self._generate_video_thumbnail(content, size)

        except Exception as e:
            logger.warning(f"Failed to generate thumbnail for {filename}: {e}")
            return None

        if thumbnail:
            self._cache_thumbnail(cache_key, thumbnail)
            return thumbnail

        return None

    async def _generate_image_thumbnail(
        self,
        content: bytes,
        size: Tuple[int, int]
    ) -> Optional[Dict[str, Any]]:
        """Generate thumbnail for image."""
        try:
            from PIL import Image

            img = Image.open(io.BytesIO(content))

            # Handle RGBA images
            if img.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = background

            # Generate thumbnail
            img.thumbnail(size, Image.Resampling.LANCZOS)

            # Save to bytes
            output = io.BytesIO()
            img.save(output, format='JPEG', quality=85)
            output.seek(0)

            return {
                'data_url': f"data:image/jpeg;base64,{base64.b64encode(output.read()).decode()}",
                'width': img.width,
                'height': img.height,
                'format': 'jpeg'
            }

        except ImportError:
            logger.warning("PIL not installed, cannot generate image thumbnails")
            return None
        except Exception as e:
            logger.error(f"Image thumbnail generation failed: {e}")
            return None

    async def _generate_pdf_thumbnail(
        self,
        content: bytes,
        size: Tuple[int, int]
    ) -> Optional[Dict[str, Any]]:
        """Generate thumbnail for PDF (first page)."""
        try:
            import fitz  # PyMuPDF

            doc = fitz.open(stream=content, filetype="pdf")
            if doc.page_count == 0:
                return None

            page = doc[0]

            # Calculate zoom to fit size
            zoom = min(size[0] / page.rect.width, size[1] / page.rect.height)
            mat = fitz.Matrix(zoom, zoom)

            pix = page.get_pixmap(matrix=mat)
            img_bytes = pix.tobytes("jpeg")

            return {
                'data_url': f"data:image/jpeg;base64,{base64.b64encode(img_bytes).decode()}",
                'width': pix.width,
                'height': pix.height,
                'format': 'jpeg',
                'page_count': doc.page_count
            }

        except ImportError:
            logger.warning("PyMuPDF not installed, cannot generate PDF thumbnails")
            return None
        except Exception as e:
            logger.error(f"PDF thumbnail generation failed: {e}")
            return None

    async def _generate_video_thumbnail(
        self,
        content: bytes,
        size: Tuple[int, int]
    ) -> Optional[Dict[str, Any]]:
        """Generate thumbnail for video (first frame)."""
        try:
            import tempfile
            import subprocess

            # Write video to temp file
            with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as f:
                f.write(content)
                temp_path = f.name

            try:
                # Use ffmpeg to extract first frame
                output_path = temp_path + '.jpg'
                cmd = [
                    'ffmpeg', '-i', temp_path,
                    '-vframes', '1',
                    '-s', f'{size[0]}x{size[1]}',
                    '-y', output_path
                ]

                subprocess.run(cmd, capture_output=True, timeout=30)

                if os.path.exists(output_path):
                    with open(output_path, 'rb') as f:
                        img_bytes = f.read()
                    os.unlink(output_path)

                    return {
                        'data_url': f"data:image/jpeg;base64,{base64.b64encode(img_bytes).decode()}",
                        'width': size[0],
                        'height': size[1],
                        'format': 'jpeg'
                    }

            finally:
                if os.path.exists(temp_path):
                    os.unlink(temp_path)

        except Exception as e:
            logger.error(f"Video thumbnail generation failed: {e}")
            return None

        return None

    async def get_text_preview(
        self,
        content: bytes,
        filename: str,
        max_lines: int = 100,
        max_chars: int = 10000
    ) -> Dict[str, Any]:
        """
        Get text preview with syntax highlighting info.
        """
        ext = Path(filename).suffix.lower()
        language = self.CODE_EXTENSIONS.get(ext, 'text')

        try:
            # Try to decode as UTF-8
            text = content.decode('utf-8')
        except UnicodeDecodeError:
            try:
                text = content.decode('latin-1')
            except:
                return {
                    'error': 'Could not decode file content',
                    'language': language
                }

        # Truncate if too long
        lines = text.split('\n')
        truncated = False

        if len(lines) > max_lines:
            lines = lines[:max_lines]
            truncated = True

        preview_text = '\n'.join(lines)
        if len(preview_text) > max_chars:
            preview_text = preview_text[:max_chars]
            truncated = True

        return {
            'content': preview_text,
            'language': language,
            'line_count': len(lines),
            'truncated': truncated,
            'total_lines': text.count('\n') + 1 if not truncated else None
        }

    def _get_cache_key(self, content: bytes, size: Tuple[int, int]) -> str:
        """Generate cache key for content."""
        content_hash = hashlib.md5(content).hexdigest()
        return f"{content_hash}_{size[0]}x{size[1]}"

    def _get_cached_thumbnail(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Get cached thumbnail if exists."""
        cache_path = os.path.join(PREVIEW_CACHE_DIR, f"{cache_key}.json")
        if os.path.exists(cache_path):
            try:
                import json
                with open(cache_path, 'r') as f:
                    return json.load(f)
            except:
                pass
        return None

    def _cache_thumbnail(self, cache_key: str, thumbnail: Dict[str, Any]):
        """Cache thumbnail data."""
        try:
            import json
            cache_path = os.path.join(PREVIEW_CACHE_DIR, f"{cache_key}.json")
            with open(cache_path, 'w') as f:
                json.dump(thumbnail, f)
        except Exception as e:
            logger.warning(f"Failed to cache thumbnail: {e}")

    def get_viewer_config(self, content_type: str, filename: str) -> Dict[str, Any]:
        """
        Get configuration for in-browser viewer.

        Returns viewer type and any special options.
        """
        ext = Path(filename).suffix.lower()

        if content_type.startswith('image/'):
            return {
                'viewer': 'image',
                'supports_zoom': True,
                'supports_fullscreen': True
            }

        elif content_type == 'application/pdf':
            return {
                'viewer': 'pdf',
                'supports_zoom': True,
                'supports_fullscreen': True,
                'supports_search': True,
                'supports_pages': True
            }

        elif content_type.startswith('text/') or ext in self.CODE_EXTENSIONS:
            return {
                'viewer': 'code',
                'language': self.CODE_EXTENSIONS.get(ext, 'text'),
                'supports_line_numbers': True,
                'supports_copy': True,
                'supports_wrap': True
            }

        elif content_type.startswith('video/'):
            return {
                'viewer': 'video',
                'supports_fullscreen': True,
                'supports_playback_speed': True,
                'supports_volume': True
            }

        elif content_type.startswith('audio/'):
            return {
                'viewer': 'audio',
                'supports_volume': True,
                'supports_playback_speed': True
            }

        return {
            'viewer': 'download',
            'message': 'Preview not available. Click to download.'
        }


# Singleton instance
attachment_preview_service = AttachmentPreviewService()
