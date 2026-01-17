"""
Bheem Workspace - Videos API
Manages video uploads, processing, and playback
"""
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, text
from typing import Dict, Any, List, Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel
import logging

from core.database import get_db
from core.security import get_current_user
from core.config import settings
from models.productivity_models import Video, VideoShare
from services.nextcloud_service import nextcloud_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/videos", tags=["Bheem Videos"])


async def ensure_tenant_and_user_exist(
    db: AsyncSession,
    tenant_id: str,
    user_id: str,
    company_code: str = None,
    user_email: str = None,
    user_name: str = None
):
    """Ensure tenant and user records exist for ERP users.

    ERP users have company_id/user_id but no workspace.tenants or tenant_users records.
    This function creates them if needed.
    """
    # Ensure tenant exists
    try:
        result = await db.execute(text("""
            SELECT id FROM workspace.tenants WHERE id = CAST(:tenant_id AS uuid)
        """), {"tenant_id": tenant_id})
        if not result.fetchone():
            # Create tenant for ERP company
            org_name = f"Organization {company_code or 'ERP'}"
            await db.execute(text("""
                INSERT INTO workspace.tenants (id, name, domain, settings, created_at, updated_at)
                VALUES (
                    CAST(:tenant_id AS uuid),
                    :name,
                    :domain,
                    '{}'::jsonb,
                    NOW(),
                    NOW()
                )
                ON CONFLICT (id) DO NOTHING
            """), {
                "tenant_id": tenant_id,
                "name": org_name,
                "domain": f"{(company_code or 'erp').lower()}.bheem.workspace"
            })
            await db.commit()
            logger.info(f"Created tenant {tenant_id} for ERP company {company_code}")
    except Exception as e:
        logger.error(f"Error ensuring tenant exists: {e}")
        # Rollback on error
        await db.rollback()

    # Ensure user exists in tenant_users
    try:
        result = await db.execute(text("""
            SELECT id FROM workspace.tenant_users WHERE id = CAST(:user_id AS uuid)
        """), {"user_id": user_id})
        if not result.fetchone():
            # Create tenant_user record
            await db.execute(text("""
                INSERT INTO workspace.tenant_users (id, tenant_id, email, name, role, created_at, updated_at)
                VALUES (
                    CAST(:user_id AS uuid),
                    CAST(:tenant_id AS uuid),
                    :email,
                    :name,
                    'user',
                    NOW(),
                    NOW()
                )
                ON CONFLICT (id) DO NOTHING
            """), {
                "user_id": user_id,
                "tenant_id": tenant_id,
                "email": user_email or f"user_{user_id[:8]}@bheem.workspace",
                "name": user_name or f"User {user_id[:8]}"
            })
            await db.commit()
            logger.info(f"Created tenant_user {user_id} for tenant {tenant_id}")
    except Exception as e:
        logger.error(f"Error ensuring user exists: {e}")
        await db.rollback()


class VideoCreate(BaseModel):
    title: str
    description: Optional[str] = None
    folder_id: Optional[UUID] = None


class VideoUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    folder_id: Optional[UUID] = None
    settings: Optional[Dict[str, Any]] = None


class VideoResponse(BaseModel):
    id: UUID
    title: str
    description: Optional[str]
    folder_id: Optional[UUID]
    file_path: Optional[str]
    file_size: Optional[int]
    duration: Optional[int]
    format: Optional[str]
    resolution: Optional[str]
    thumbnail_url: Optional[str]
    status: str
    processing_progress: int
    settings: Dict[str, Any]
    is_starred: bool
    view_count: int
    created_by: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class VideoShareCreate(BaseModel):
    user_id: UUID
    permission: str = "view"


def get_user_ids(current_user: Dict[str, Any]) -> tuple:
    """Extract tenant_id and owner_id from current user"""
    tenant_id = current_user.get("tenant_id") or current_user.get("company_id") or current_user.get("erp_company_id")
    owner_id = current_user.get("id") or current_user.get("user_id")
    if not tenant_id or not owner_id:
        raise HTTPException(status_code=400, detail="User context incomplete")
    if isinstance(tenant_id, str):
        tenant_id = UUID(tenant_id)
    if isinstance(owner_id, str):
        owner_id = UUID(owner_id)
    return tenant_id, owner_id


async def get_user_ids_with_tenant(current_user: Dict[str, Any], db: AsyncSession) -> tuple:
    """Extract user IDs and ensure tenant and user exist for ERP users."""
    tenant_id, user_id = get_user_ids(current_user)
    company_code = current_user.get("company_code")
    user_email = current_user.get("username") or current_user.get("email")
    user_name = current_user.get("name") or current_user.get("full_name")

    # Ensure tenant and user exist (creates for ERP users if needed)
    await ensure_tenant_and_user_exist(
        db, str(tenant_id), str(user_id), company_code, user_email, user_name
    )

    return tenant_id, user_id


@router.get("", response_model=List[VideoResponse])
async def list_videos(
    search: Optional[str] = None,
    starred: Optional[bool] = None,
    status: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all videos for the current user"""
    tenant_id, owner_id = get_user_ids(current_user)

    query = select(Video).where(
        Video.tenant_id == tenant_id,
        Video.is_deleted == False
    )

    if search:
        query = query.where(Video.title.ilike(f"%{search}%"))
    if starred is not None:
        query = query.where(Video.is_starred == starred)
    if status:
        query = query.where(Video.status == status)

    query = query.order_by(desc(Video.updated_at)).limit(limit).offset(offset)

    result = await db.execute(query)
    videos = result.scalars().all()

    return videos


@router.post("", response_model=VideoResponse)
async def create_video(
    video_data: VideoCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new video entry (placeholder for upload)"""
    # Use get_user_ids_with_tenant to ensure tenant and user records exist
    tenant_id, owner_id = await get_user_ids_with_tenant(current_user, db)

    video = Video(
        tenant_id=tenant_id,
        title=video_data.title,
        description=video_data.description,
        folder_id=video_data.folder_id,
        created_by=owner_id,
        status="uploading",
    )

    db.add(video)
    await db.commit()
    await db.refresh(video)

    return video


@router.post("/upload", response_model=VideoResponse)
async def upload_video(
    file: UploadFile = File(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a video file to Nextcloud and create video record"""
    # Use get_user_ids_with_tenant to ensure tenant and user records exist
    tenant_id, owner_id = await get_user_ids_with_tenant(current_user, db)

    # Validate file type
    allowed_types = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo", "video/avi"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed types: MP4, WebM, MOV, AVI"
        )

    # Read file content
    content = await file.read()
    file_size = len(content)

    # Get file extension
    original_name = file.filename or "video.mp4"
    ext = original_name.rsplit(".", 1)[-1] if "." in original_name else "mp4"

    # Create video record first to get ID
    video = Video(
        tenant_id=tenant_id,
        title=title,
        description=description,
        created_by=owner_id,
        status="uploading",
        file_size=file_size,
        format=ext.upper(),
    )

    db.add(video)
    await db.commit()
    await db.refresh(video)

    try:
        # Get user's Nextcloud credentials from session/user data
        # For now, use admin credentials with user folder
        email = current_user.get("email") or current_user.get("user_email") or ""
        logger.info(f"Video upload - current_user: {current_user}")
        logger.info(f"Video upload - email: {email}")

        username = email.split("@")[0] if email and "@" in email else None
        if not username:
            # Fallback to user name or ID
            username = current_user.get("name", "").replace(" ", "_").lower() or str(owner_id)[:8]

        logger.info(f"Video upload - derived username: {username}")

        # Create videos folder if it doesn't exist - use simple path in admin's space
        videos_folder = "/Videos"
        folder_path = f"{videos_folder}"  # Store in admin's Videos folder
        logger.info(f"Creating folder: {folder_path}")

        folder_created = await nextcloud_service.create_folder(
            settings.NEXTCLOUD_ADMIN_USER,
            settings.NEXTCLOUD_ADMIN_PASSWORD,
            folder_path
        )
        logger.info(f"Folder creation result: {folder_created}")

        # Upload file to Nextcloud - store with video ID in admin's Videos folder
        file_path = f"{videos_folder}/{video.id}.{ext}"
        logger.info(f"Uploading to path: {file_path}, size: {len(content)} bytes")

        upload_success = await nextcloud_service.upload_file(
            settings.NEXTCLOUD_ADMIN_USER,
            settings.NEXTCLOUD_ADMIN_PASSWORD,
            file_path,
            content
        )
        logger.info(f"Upload result: {upload_success}")

        if not upload_success:
            # If upload failed, mark video as error
            video.status = "error"
            video.error_message = "Failed to upload to storage"
            await db.commit()
            raise HTTPException(status_code=500, detail="Failed to upload video to storage")

        # Create share link for playback
        logger.info(f"Creating share link for: {file_path}")
        share_url = await nextcloud_service.create_share_link(
            settings.NEXTCLOUD_ADMIN_USER,
            settings.NEXTCLOUD_ADMIN_PASSWORD,
            file_path,
            expires_days=365  # Long-lived share for playback
        )
        logger.info(f"Share URL result: {share_url}")

        # Update video record with file info
        video.file_path = file_path
        video.status = "ready"
        video.processing_progress = 100

        # Use share URL for direct playback if available
        if share_url:
            # Convert share URL to direct download URL
            video.thumbnail_url = f"{share_url}/download"
            logger.info(f"Set thumbnail_url to: {video.thumbnail_url}")
        else:
            logger.warning(f"No share URL created for video {video.id}")

        await db.commit()
        await db.refresh(video)

        logger.info(f"Video uploaded successfully: {video.id}, path: {file_path}")

        return video

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        logger.error(f"Failed to upload video: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        video.status = "error"
        video.error_message = str(e)
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.get("/{video_id}", response_model=VideoResponse)
async def get_video(
    video_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific video"""
    tenant_id, owner_id = get_user_ids(current_user)

    query = select(Video).where(
        Video.id == video_id,
        Video.tenant_id == tenant_id,
        Video.is_deleted == False
    )
    result = await db.execute(query)
    video = result.scalar_one_or_none()

    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # Increment view count
    video.view_count += 1
    await db.commit()

    return video


@router.get("/{video_id}/stream")
async def stream_video(
    video_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream video content from Nextcloud storage"""
    from fastapi.responses import StreamingResponse
    import httpx

    tenant_id, owner_id = get_user_ids(current_user)

    query = select(Video).where(
        Video.id == video_id,
        Video.tenant_id == tenant_id,
        Video.is_deleted == False
    )
    result = await db.execute(query)
    video = result.scalar_one_or_none()

    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if not video.file_path:
        raise HTTPException(status_code=404, detail="Video file not found")

    # Download from Nextcloud and stream
    try:
        content = await nextcloud_service.download_file(
            settings.NEXTCLOUD_ADMIN_USER,
            settings.NEXTCLOUD_ADMIN_PASSWORD,
            video.file_path
        )

        if not content:
            raise HTTPException(status_code=404, detail="Video file not available")

        # Determine content type
        format_to_mime = {
            "MP4": "video/mp4",
            "WEBM": "video/webm",
            "MOV": "video/quicktime",
            "AVI": "video/x-msvideo",
        }
        content_type = format_to_mime.get(video.format or "MP4", "video/mp4")

        return StreamingResponse(
            iter([content]),
            media_type=content_type,
            headers={
                "Content-Disposition": f'inline; filename="{video.title}.{(video.format or "mp4").lower()}"',
                "Content-Length": str(len(content)),
            }
        )
    except Exception as e:
        logger.error(f"Failed to stream video {video_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to stream video")


@router.patch("/{video_id}", response_model=VideoResponse)
async def update_video(
    video_id: UUID,
    update_data: VideoUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update video metadata"""
    tenant_id, owner_id = get_user_ids(current_user)

    query = select(Video).where(
        Video.id == video_id,
        Video.tenant_id == tenant_id,
        Video.is_deleted == False
    )
    result = await db.execute(query)
    video = result.scalar_one_or_none()

    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    update_dict = update_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(video, key, value)

    video.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(video)

    return video


@router.delete("/{video_id}")
async def delete_video(
    video_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft delete a video"""
    tenant_id, owner_id = get_user_ids(current_user)

    query = select(Video).where(
        Video.id == video_id,
        Video.tenant_id == tenant_id,
    )
    result = await db.execute(query)
    video = result.scalar_one_or_none()

    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    video.is_deleted = True
    video.deleted_at = datetime.utcnow()
    await db.commit()

    return {"message": "Video deleted"}


@router.post("/{video_id}/refresh-share")
async def refresh_share_url(
    video_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Refresh/create share URL for video playback"""
    tenant_id, owner_id = get_user_ids(current_user)

    query = select(Video).where(
        Video.id == video_id,
        Video.tenant_id == tenant_id,
        Video.is_deleted == False
    )
    result = await db.execute(query)
    video = result.scalar_one_or_none()

    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if not video.file_path:
        raise HTTPException(status_code=400, detail="Video has no file path")

    # Create new share link
    share_url = await nextcloud_service.create_share_link(
        settings.NEXTCLOUD_ADMIN_USER,
        settings.NEXTCLOUD_ADMIN_PASSWORD,
        video.file_path,
        expires_days=365
    )

    if share_url:
        video.thumbnail_url = f"{share_url}/download"
        await db.commit()
        return {"success": True, "share_url": video.thumbnail_url}
    else:
        raise HTTPException(status_code=500, detail="Failed to create share link")


@router.post("/{video_id}/star")
async def toggle_star(
    video_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Toggle star status for a video"""
    tenant_id, owner_id = get_user_ids(current_user)

    query = select(Video).where(
        Video.id == video_id,
        Video.tenant_id == tenant_id,
        Video.is_deleted == False
    )
    result = await db.execute(query)
    video = result.scalar_one_or_none()

    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    video.is_starred = not video.is_starred
    await db.commit()

    return {"starred": video.is_starred}


@router.post("/{video_id}/share")
async def share_video(
    video_id: UUID,
    share_data: VideoShareCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Share a video with another user"""
    tenant_id, owner_id = get_user_ids(current_user)

    # Verify video exists
    query = select(Video).where(
        Video.id == video_id,
        Video.tenant_id == tenant_id,
    )
    result = await db.execute(query)
    video = result.scalar_one_or_none()

    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # Check if share already exists
    existing = await db.execute(
        select(VideoShare).where(
            VideoShare.video_id == video_id,
            VideoShare.user_id == share_data.user_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Video already shared with this user")

    share = VideoShare(
        video_id=video_id,
        user_id=share_data.user_id,
        permission=share_data.permission,
        created_by=owner_id,
    )

    db.add(share)
    await db.commit()

    return {"message": "Video shared successfully"}


@router.get("/{video_id}/shares")
async def get_video_shares(
    video_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all shares for a video"""
    tenant_id, owner_id = get_user_ids(current_user)

    # Verify video exists
    query = select(Video).where(
        Video.id == video_id,
        Video.tenant_id == tenant_id,
    )
    result = await db.execute(query)
    video = result.scalar_one_or_none()

    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    shares_result = await db.execute(
        select(VideoShare).where(VideoShare.video_id == video_id)
    )
    shares = shares_result.scalars().all()

    return [
        {
            "id": str(share.id),
            "user_id": str(share.user_id),
            "permission": share.permission,
            "created_at": share.created_at
        }
        for share in shares
    ]


@router.delete("/{video_id}/shares/{share_id}")
async def remove_video_share(
    video_id: UUID,
    share_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a share from a video"""
    tenant_id, owner_id = get_user_ids(current_user)

    # Verify video exists and user owns it
    query = select(Video).where(
        Video.id == video_id,
        Video.tenant_id == tenant_id,
    )
    result = await db.execute(query)
    video = result.scalar_one_or_none()

    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    share_result = await db.execute(
        select(VideoShare).where(
            VideoShare.id == share_id,
            VideoShare.video_id == video_id
        )
    )
    share = share_result.scalar_one_or_none()

    if not share:
        raise HTTPException(status_code=404, detail="Share not found")

    await db.delete(share)
    await db.commit()

    return {"message": "Share removed"}
