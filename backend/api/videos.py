"""
Bheem Workspace - Videos API
Manages video uploads, processing, and playback
"""
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from typing import Dict, Any, List, Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel

from core.database import get_db
from core.security import get_current_user
from models.productivity_models import Video, VideoShare

router = APIRouter(prefix="/videos", tags=["Bheem Videos"])


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
    tenant_id = current_user.get("company_id")
    owner_id = current_user.get("user_id") or current_user.get("id")
    if not tenant_id or not owner_id:
        raise HTTPException(status_code=400, detail="User context incomplete")
    if isinstance(tenant_id, str):
        tenant_id = UUID(tenant_id)
    if isinstance(owner_id, str):
        owner_id = UUID(owner_id)
    return tenant_id, owner_id


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
    tenant_id, owner_id = get_user_ids(current_user)

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
