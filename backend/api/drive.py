"""
Bheem Workspace - Drive API
File storage and management endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel
from datetime import datetime

from core.database import get_db
from services.drive_service import DriveService

router = APIRouter(prefix="/drive", tags=["Drive"])


# =============================================
# Request/Response Models
# =============================================

class CreateFolderRequest(BaseModel):
    name: str
    parent_id: Optional[UUID] = None
    description: Optional[str] = None


class UpdateFileRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_starred: Optional[bool] = None


class MoveFileRequest(BaseModel):
    destination_folder_id: Optional[UUID] = None


class CopyFileRequest(BaseModel):
    destination_folder_id: Optional[UUID] = None
    new_name: Optional[str] = None


class ShareFileRequest(BaseModel):
    shared_with_email: str
    permission: str = "view"  # view, comment, edit


class CreatePublicLinkRequest(BaseModel):
    permission: str = "view"
    expires_in_days: Optional[int] = None
    password: Optional[str] = None


class FileResponse(BaseModel):
    id: UUID
    name: str
    file_type: str
    mime_type: Optional[str]
    size_bytes: Optional[int]
    parent_id: Optional[UUID]
    path: str
    description: Optional[str]
    is_starred: bool
    is_trashed: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ShareResponse(BaseModel):
    id: UUID
    file_id: UUID
    shared_with_email: str
    permission: str
    created_at: datetime

    class Config:
        from_attributes = True


class PublicLinkResponse(BaseModel):
    share_token: str
    public_url: str
    permission: str
    expires_at: Optional[datetime]


# =============================================
# Folder Operations
# =============================================

@router.post("/folders", response_model=FileResponse)
async def create_folder(
    request: CreateFolderRequest,
    tenant_id: UUID = Query(...),
    owner_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Create a new folder"""
    service = DriveService(db)
    folder = await service.create_folder(
        tenant_id=tenant_id,
        owner_id=owner_id,
        name=request.name,
        parent_id=request.parent_id,
        description=request.description
    )
    return folder


@router.get("/folders/{folder_id}/contents")
async def list_folder_contents(
    folder_id: UUID,
    tenant_id: UUID = Query(...),
    owner_id: UUID = Query(...),
    include_trashed: bool = False,
    db: AsyncSession = Depends(get_db)
):
    """List contents of a folder"""
    service = DriveService(db)
    files = await service.list_files(
        tenant_id=tenant_id,
        owner_id=owner_id,
        parent_id=folder_id,
        include_trashed=include_trashed
    )
    return {"files": files}


@router.get("/root")
async def list_root_contents(
    tenant_id: UUID = Query(...),
    owner_id: UUID = Query(...),
    include_trashed: bool = False,
    db: AsyncSession = Depends(get_db)
):
    """List contents of root folder (My Drive)"""
    service = DriveService(db)
    files = await service.list_files(
        tenant_id=tenant_id,
        owner_id=owner_id,
        parent_id=None,
        include_trashed=include_trashed
    )
    return {"files": files}


# =============================================
# File Operations
# =============================================

@router.post("/files/upload", response_model=FileResponse)
async def upload_file(
    file: UploadFile = File(...),
    parent_id: Optional[UUID] = None,
    tenant_id: UUID = Query(...),
    owner_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Upload a file"""
    service = DriveService(db)

    # Read file content
    content = await file.read()
    size_bytes = len(content)

    # Create file record
    drive_file = await service.create_file(
        tenant_id=tenant_id,
        owner_id=owner_id,
        name=file.filename,
        mime_type=file.content_type,
        size_bytes=size_bytes,
        parent_id=parent_id
    )

    # TODO: Store actual file content to storage backend (S3, etc.)

    return drive_file


@router.get("/files/{file_id}", response_model=FileResponse)
async def get_file(
    file_id: UUID,
    tenant_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Get file metadata"""
    service = DriveService(db)
    file = await service.get_file(file_id, tenant_id)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    return file


@router.patch("/files/{file_id}", response_model=FileResponse)
async def update_file(
    file_id: UUID,
    request: UpdateFileRequest,
    tenant_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Update file metadata"""
    service = DriveService(db)
    file = await service.update_file(
        file_id=file_id,
        tenant_id=tenant_id,
        **request.model_dump(exclude_unset=True)
    )
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    return file


@router.post("/files/{file_id}/move", response_model=FileResponse)
async def move_file(
    file_id: UUID,
    request: MoveFileRequest,
    tenant_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Move a file to a different folder"""
    service = DriveService(db)
    file = await service.move_file(
        file_id=file_id,
        tenant_id=tenant_id,
        new_parent_id=request.destination_folder_id
    )
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    return file


@router.post("/files/{file_id}/copy", response_model=FileResponse)
async def copy_file(
    file_id: UUID,
    request: CopyFileRequest,
    tenant_id: UUID = Query(...),
    owner_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Copy a file"""
    service = DriveService(db)
    file = await service.copy_file(
        file_id=file_id,
        tenant_id=tenant_id,
        owner_id=owner_id,
        new_parent_id=request.destination_folder_id,
        new_name=request.new_name
    )
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    return file


@router.post("/files/{file_id}/trash")
async def trash_file(
    file_id: UUID,
    tenant_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Move a file to trash"""
    service = DriveService(db)
    success = await service.trash_file(file_id, tenant_id)
    if not success:
        raise HTTPException(status_code=404, detail="File not found")
    return {"status": "trashed"}


@router.post("/files/{file_id}/restore")
async def restore_file(
    file_id: UUID,
    tenant_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Restore a file from trash"""
    service = DriveService(db)
    success = await service.restore_file(file_id, tenant_id)
    if not success:
        raise HTTPException(status_code=404, detail="File not found")
    return {"status": "restored"}


@router.delete("/files/{file_id}")
async def delete_file(
    file_id: UUID,
    tenant_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Permanently delete a file"""
    service = DriveService(db)
    success = await service.delete_file(file_id, tenant_id)
    if not success:
        raise HTTPException(status_code=404, detail="File not found")
    return {"status": "deleted"}


# =============================================
# Starred Files
# =============================================

@router.get("/starred")
async def list_starred_files(
    tenant_id: UUID = Query(...),
    owner_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """List all starred files"""
    service = DriveService(db)
    files = await service.list_files(
        tenant_id=tenant_id,
        owner_id=owner_id,
        starred_only=True
    )
    return {"files": files}


@router.post("/files/{file_id}/star")
async def star_file(
    file_id: UUID,
    tenant_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Star a file"""
    service = DriveService(db)
    file = await service.update_file(
        file_id=file_id,
        tenant_id=tenant_id,
        is_starred=True
    )
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    return {"status": "starred"}


@router.post("/files/{file_id}/unstar")
async def unstar_file(
    file_id: UUID,
    tenant_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Remove star from a file"""
    service = DriveService(db)
    file = await service.update_file(
        file_id=file_id,
        tenant_id=tenant_id,
        is_starred=False
    )
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    return {"status": "unstarred"}


# =============================================
# Trash
# =============================================

@router.get("/trash")
async def list_trash(
    tenant_id: UUID = Query(...),
    owner_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """List all files in trash"""
    service = DriveService(db)
    files = await service.list_files(
        tenant_id=tenant_id,
        owner_id=owner_id,
        trashed_only=True
    )
    return {"files": files}


@router.delete("/trash/empty")
async def empty_trash(
    tenant_id: UUID = Query(...),
    owner_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Empty trash - permanently delete all trashed files"""
    service = DriveService(db)
    count = await service.empty_trash(tenant_id, owner_id)
    return {"deleted_count": count}


# =============================================
# Sharing
# =============================================

@router.post("/files/{file_id}/share", response_model=ShareResponse)
async def share_file(
    file_id: UUID,
    request: ShareFileRequest,
    tenant_id: UUID = Query(...),
    shared_by: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Share a file with another user"""
    service = DriveService(db)
    share = await service.share_file(
        file_id=file_id,
        tenant_id=tenant_id,
        shared_by=shared_by,
        shared_with_email=request.shared_with_email,
        permission=request.permission
    )
    if not share:
        raise HTTPException(status_code=404, detail="File not found")
    return share


@router.get("/files/{file_id}/shares")
async def list_file_shares(
    file_id: UUID,
    tenant_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """List all shares for a file"""
    service = DriveService(db)
    shares = await service.get_file_shares(file_id, tenant_id)
    return {"shares": shares}


@router.delete("/files/{file_id}/shares/{share_id}")
async def remove_share(
    file_id: UUID,
    share_id: UUID,
    tenant_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Remove a share from a file"""
    service = DriveService(db)
    success = await service.remove_share(share_id, tenant_id)
    if not success:
        raise HTTPException(status_code=404, detail="Share not found")
    return {"status": "removed"}


@router.get("/shared-with-me")
async def list_shared_with_me(
    user_email: str = Query(...),
    tenant_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """List files shared with the current user"""
    service = DriveService(db)
    files = await service.list_shared_with_user(user_email, tenant_id)
    return {"files": files}


# =============================================
# Public Links
# =============================================

@router.post("/files/{file_id}/public-link", response_model=PublicLinkResponse)
async def create_public_link(
    file_id: UUID,
    request: CreatePublicLinkRequest,
    tenant_id: UUID = Query(...),
    shared_by: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Create a public shareable link for a file"""
    service = DriveService(db)
    share = await service.create_public_link(
        file_id=file_id,
        tenant_id=tenant_id,
        shared_by=shared_by,
        permission=request.permission,
        expires_in_days=request.expires_in_days,
        password=request.password
    )
    if not share:
        raise HTTPException(status_code=404, detail="File not found")

    return {
        "share_token": share.share_token,
        "public_url": f"/api/drive/public/{share.share_token}",
        "permission": share.permission,
        "expires_at": share.expires_at
    }


@router.get("/public/{share_token}")
async def access_public_file(
    share_token: str,
    password: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Access a file via public link"""
    service = DriveService(db)
    file = await service.access_public_link(share_token, password)
    if not file:
        raise HTTPException(
            status_code=404,
            detail="Invalid or expired link"
        )
    return file


# =============================================
# Search
# =============================================

@router.get("/search")
async def search_files(
    q: str = Query(..., min_length=1),
    tenant_id: UUID = Query(...),
    owner_id: UUID = Query(...),
    file_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Search for files by name"""
    service = DriveService(db)
    files = await service.search_files(
        tenant_id=tenant_id,
        owner_id=owner_id,
        query=q,
        file_type=file_type,
        skip=skip,
        limit=limit
    )
    return {"files": files, "query": q}


# =============================================
# Recent Files
# =============================================

@router.get("/recent")
async def list_recent_files(
    tenant_id: UUID = Query(...),
    owner_id: UUID = Query(...),
    limit: int = 20,
    db: AsyncSession = Depends(get_db)
):
    """List recently accessed/modified files"""
    service = DriveService(db)
    files = await service.list_files(
        tenant_id=tenant_id,
        owner_id=owner_id,
        limit=limit
    )
    return {"files": files}


# =============================================
# Storage Info
# =============================================

@router.get("/storage")
async def get_storage_info(
    tenant_id: UUID = Query(...),
    owner_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Get storage usage information"""
    service = DriveService(db)
    usage = await service.get_storage_usage(tenant_id, owner_id)
    return usage
