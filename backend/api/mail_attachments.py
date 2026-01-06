"""
Bheem Workspace - Mail Attachments API
Preview and download email attachments
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
from typing import Optional
import base64
import io

from core.security import get_current_user
from services.mail_session_service import mail_session_service
from services.mailcow_service import mailcow_service
from services.attachment_preview_service import attachment_preview_service
from core.logging import get_logger

logger = get_logger("bheem.mail.attachments")

router = APIRouter(prefix="/mail/attachments", tags=["Mail Attachments"])


@router.get("/preview-info")
async def get_preview_info(
    filename: str,
    content_type: Optional[str] = None,
    file_size: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """
    Get preview capabilities for an attachment.

    Returns information about what kind of preview is available.
    """
    info = attachment_preview_service.get_preview_info(
        filename=filename,
        content_type=content_type,
        file_size=file_size
    )

    return info


@router.get("/viewer-config")
async def get_viewer_config(
    filename: str,
    content_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get viewer configuration for in-browser display.
    """
    import mimetypes

    if not content_type:
        content_type, _ = mimetypes.guess_type(filename)
        content_type = content_type or 'application/octet-stream'

    config = attachment_preview_service.get_viewer_config(content_type, filename)

    return {
        'filename': filename,
        'content_type': content_type,
        **config
    }


@router.get("/{message_id}/thumbnail/{attachment_index}")
async def get_attachment_thumbnail(
    message_id: str,
    attachment_index: int,
    folder: str = Query("INBOX"),
    width: int = Query(200, ge=50, le=800),
    height: int = Query(200, ge=50, le=800),
    current_user: dict = Depends(get_current_user)
):
    """
    Generate and return a thumbnail for an attachment.

    Supports: images, PDFs (first page), videos (first frame)
    """
    # Get mail credentials
    credentials = mail_session_service.get_credentials(current_user["id"])
    if not credentials:
        raise HTTPException(status_code=401, detail="Mail session expired")

    try:
        # Fetch the email to get attachment
        email = await mailcow_service.get_message(
            credentials["email"],
            credentials["password"],
            folder,
            message_id
        )

        if not email:
            raise HTTPException(status_code=404, detail="Email not found")

        attachments = email.get('attachments', [])
        if attachment_index >= len(attachments):
            raise HTTPException(status_code=404, detail="Attachment not found")

        attachment = attachments[attachment_index]

        # Get attachment content
        content = attachment.get('content')
        if not content:
            # Fetch attachment content if not included
            content = await mailcow_service.get_attachment(
                credentials["email"],
                credentials["password"],
                folder,
                message_id,
                attachment_index
            )

        if not content:
            raise HTTPException(status_code=404, detail="Attachment content not found")

        # Decode if base64 encoded
        if isinstance(content, str):
            content = base64.b64decode(content)

        # Generate thumbnail
        thumbnail = await attachment_preview_service.generate_thumbnail(
            content=content,
            filename=attachment.get('filename', 'unknown'),
            content_type=attachment.get('content_type'),
            size=(width, height)
        )

        if not thumbnail:
            raise HTTPException(
                status_code=415,
                detail="Cannot generate thumbnail for this file type"
            )

        return thumbnail

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate thumbnail: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{message_id}/preview/{attachment_index}")
async def get_attachment_preview(
    message_id: str,
    attachment_index: int,
    folder: str = Query("INBOX"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get preview data for an attachment.

    For text files, returns syntax-highlighted content.
    For images/PDFs, returns metadata for viewer.
    """
    # Get mail credentials
    credentials = mail_session_service.get_credentials(current_user["id"])
    if not credentials:
        raise HTTPException(status_code=401, detail="Mail session expired")

    try:
        # Fetch the email
        email = await mailcow_service.get_message(
            credentials["email"],
            credentials["password"],
            folder,
            message_id
        )

        if not email:
            raise HTTPException(status_code=404, detail="Email not found")

        attachments = email.get('attachments', [])
        if attachment_index >= len(attachments):
            raise HTTPException(status_code=404, detail="Attachment not found")

        attachment = attachments[attachment_index]
        filename = attachment.get('filename', 'unknown')
        content_type = attachment.get('content_type', 'application/octet-stream')

        # Get preview info
        preview_info = attachment_preview_service.get_preview_info(
            filename=filename,
            content_type=content_type,
            file_size=attachment.get('size', 0)
        )

        if not preview_info['can_preview']:
            return {
                'preview_available': False,
                'reason': 'too_large' if preview_info['too_large'] else 'unsupported_type',
                'filename': filename,
                'content_type': content_type
            }

        # For text files, return content preview
        if preview_info['preview_type'] == 'text':
            content = attachment.get('content')
            if not content:
                content = await mailcow_service.get_attachment(
                    credentials["email"],
                    credentials["password"],
                    folder,
                    message_id,
                    attachment_index
                )

            if isinstance(content, str):
                content = base64.b64decode(content)

            text_preview = await attachment_preview_service.get_text_preview(
                content=content,
                filename=filename
            )

            return {
                'preview_available': True,
                'preview_type': 'text',
                'filename': filename,
                **text_preview
            }

        # For other types, return viewer config
        viewer_config = attachment_preview_service.get_viewer_config(content_type, filename)

        return {
            'preview_available': True,
            'preview_type': preview_info['preview_type'],
            'filename': filename,
            'content_type': content_type,
            'viewer': viewer_config
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get attachment preview: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{message_id}/download/{attachment_index}")
def download_attachment(
    message_id: str,
    attachment_index: int,
    folder: str = Query("INBOX"),
    inline: bool = Query(False, description="Display inline instead of download"),
    current_user: dict = Depends(get_current_user)
):
    """
    Download an attachment or view inline.
    """
    # Get mail credentials
    credentials = mail_session_service.get_credentials(current_user["id"])
    if not credentials:
        raise HTTPException(status_code=401, detail="Mail session expired")

    try:
        # Fetch the email with full attachment content
        email_content = mailcow_service.get_email_with_attachments(
            credentials["email"],
            credentials["password"],
            message_id,
            folder
        )

        if not email_content:
            raise HTTPException(status_code=404, detail="Email not found")

        attachments = email_content.get('attachments', [])
        if attachment_index >= len(attachments):
            raise HTTPException(status_code=404, detail="Attachment not found")

        attachment = attachments[attachment_index]
        filename = attachment.get('filename', 'attachment')
        content_type = attachment.get('contentType', attachment.get('content_type', 'application/octet-stream'))

        # Get attachment content (already decoded binary)
        content = attachment.get('content')
        if not content:
            raise HTTPException(status_code=404, detail="Attachment content not found")

        # Set disposition header
        disposition = 'inline' if inline else 'attachment'

        return StreamingResponse(
            io.BytesIO(content),
            media_type=content_type,
            headers={
                'Content-Disposition': f'{disposition}; filename="{filename}"',
                'Content-Length': str(len(content))
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to download attachment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{message_id}/attachments")
async def list_attachments(
    message_id: str,
    folder: str = Query("INBOX"),
    current_user: dict = Depends(get_current_user)
):
    """
    List all attachments for an email with preview capabilities.
    """
    # Get mail credentials
    credentials = mail_session_service.get_credentials(current_user["id"])
    if not credentials:
        raise HTTPException(status_code=401, detail="Mail session expired")

    try:
        # Fetch the email
        email = await mailcow_service.get_message(
            credentials["email"],
            credentials["password"],
            folder,
            message_id
        )

        if not email:
            raise HTTPException(status_code=404, detail="Email not found")

        attachments = email.get('attachments', [])

        # Add preview info for each attachment
        attachment_list = []
        for idx, attachment in enumerate(attachments):
            filename = attachment.get('filename', f'attachment_{idx}')
            content_type = attachment.get('content_type', 'application/octet-stream')
            file_size = attachment.get('size', 0)

            preview_info = attachment_preview_service.get_preview_info(
                filename=filename,
                content_type=content_type,
                file_size=file_size
            )

            attachment_list.append({
                'index': idx,
                'filename': filename,
                'content_type': content_type,
                'size': file_size,
                'can_preview': preview_info['can_preview'],
                'preview_type': preview_info['preview_type'],
                'too_large': preview_info.get('too_large', False)
            })

        return {
            'message_id': message_id,
            'count': len(attachment_list),
            'attachments': attachment_list
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list attachments: {e}")
        raise HTTPException(status_code=500, detail=str(e))
