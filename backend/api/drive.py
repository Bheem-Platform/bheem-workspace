"""
Bheem Workspace - Drive API
File storage and management endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel
from datetime import datetime

from core.database import get_db
from core.security import get_current_user
from services.drive_service import DriveService

router = APIRouter(prefix="/drive", tags=["Drive"])


def get_user_ids(current_user: Dict[str, Any]) -> tuple:
    """Extract tenant_id and owner_id from current user"""
    # company_id is the tenant_id, user_id is the owner_id
    tenant_id = current_user.get("company_id")
    owner_id = current_user.get("user_id") or current_user.get("id")

    if not tenant_id or not owner_id:
        raise HTTPException(
            status_code=400,
            detail="User context incomplete - missing company_id or user_id"
        )

    # Convert to UUID if string
    if isinstance(tenant_id, str):
        tenant_id = UUID(tenant_id)
    if isinstance(owner_id, str):
        owner_id = UUID(owner_id)

    return tenant_id, owner_id


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
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new folder"""
    tenant_id, owner_id = get_user_ids(current_user)
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
    include_trashed: bool = False,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List contents of a folder"""
    tenant_id, owner_id = get_user_ids(current_user)
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
    include_trashed: bool = False,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List contents of root folder (My Drive)"""
    tenant_id, owner_id = get_user_ids(current_user)
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
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Upload a file"""
    tenant_id, owner_id = get_user_ids(current_user)
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
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get file metadata"""
    tenant_id, _ = get_user_ids(current_user)
    service = DriveService(db)
    file = await service.get_file(file_id, tenant_id)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    return file


@router.patch("/files/{file_id}", response_model=FileResponse)
async def update_file(
    file_id: UUID,
    request: UpdateFileRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update file metadata"""
    tenant_id, _ = get_user_ids(current_user)
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
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Move a file to a different folder"""
    tenant_id, _ = get_user_ids(current_user)
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
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Copy a file"""
    tenant_id, owner_id = get_user_ids(current_user)
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
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Move a file to trash"""
    tenant_id, _ = get_user_ids(current_user)
    service = DriveService(db)
    success = await service.trash_file(file_id, tenant_id)
    if not success:
        raise HTTPException(status_code=404, detail="File not found")
    return {"status": "trashed"}


@router.post("/files/{file_id}/restore")
async def restore_file(
    file_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Restore a file from trash"""
    tenant_id, _ = get_user_ids(current_user)
    service = DriveService(db)
    success = await service.restore_file(file_id, tenant_id)
    if not success:
        raise HTTPException(status_code=404, detail="File not found")
    return {"status": "restored"}


@router.delete("/files/{file_id}")
async def delete_file(
    file_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Permanently delete a file"""
    tenant_id, _ = get_user_ids(current_user)
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
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all starred files"""
    tenant_id, owner_id = get_user_ids(current_user)
    service = DriveService(db)
    files = await service.list_files(
        tenant_id=tenant_id,
        owner_id=owner_id,
        starred_only=True
    )
    return files  # Return array directly for frontend


@router.post("/files/{file_id}/star")
async def star_file(
    file_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Star a file"""
    tenant_id, _ = get_user_ids(current_user)
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
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove star from a file"""
    tenant_id, _ = get_user_ids(current_user)
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
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all files in trash"""
    tenant_id, owner_id = get_user_ids(current_user)
    service = DriveService(db)
    files = await service.list_files(
        tenant_id=tenant_id,
        owner_id=owner_id,
        trashed_only=True
    )
    return files  # Return array directly for frontend


@router.delete("/trash/empty")
@router.post("/trash/empty")
async def empty_trash(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Empty trash - permanently delete all trashed files"""
    tenant_id, owner_id = get_user_ids(current_user)
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
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Share a file with another user"""
    tenant_id, owner_id = get_user_ids(current_user)
    service = DriveService(db)
    share = await service.share_file(
        file_id=file_id,
        tenant_id=tenant_id,
        shared_by=owner_id,
        shared_with_email=request.shared_with_email,
        permission=request.permission
    )
    if not share:
        raise HTTPException(status_code=404, detail="File not found")
    return share


@router.get("/files/{file_id}/shares")
async def list_file_shares(
    file_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all shares for a file"""
    tenant_id, _ = get_user_ids(current_user)
    service = DriveService(db)
    shares = await service.get_file_shares(file_id, tenant_id)
    return {"shares": shares}


@router.delete("/files/{file_id}/shares/{share_id}")
async def remove_share(
    file_id: UUID,
    share_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove a share from a file"""
    tenant_id, _ = get_user_ids(current_user)
    service = DriveService(db)
    success = await service.remove_share(share_id, tenant_id)
    if not success:
        raise HTTPException(status_code=404, detail="Share not found")
    return {"status": "removed"}


@router.get("/shared-with-me")
async def list_shared_with_me(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List files shared with the current user"""
    tenant_id, owner_id = get_user_ids(current_user)
    user_email = current_user.get("email", "")
    service = DriveService(db)
    files = await service.list_shared_with_user(user_email, tenant_id)
    return files  # Return array directly


# =============================================
# Public Links
# =============================================

@router.post("/files/{file_id}/public-link", response_model=PublicLinkResponse)
async def create_public_link(
    file_id: UUID,
    request: CreatePublicLinkRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a public shareable link for a file"""
    tenant_id, owner_id = get_user_ids(current_user)
    service = DriveService(db)
    share = await service.create_public_link(
        file_id=file_id,
        tenant_id=tenant_id,
        shared_by=owner_id,
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
    file_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Search for files by name"""
    tenant_id, owner_id = get_user_ids(current_user)
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
    limit: int = 20,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List recently accessed/modified files"""
    tenant_id, owner_id = get_user_ids(current_user)
    service = DriveService(db)
    files = await service.list_files(
        tenant_id=tenant_id,
        owner_id=owner_id,
        limit=limit
    )
    return files  # Return array directly


# =============================================
# Storage Info
# =============================================

@router.get("/storage")
async def get_storage_info(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get storage usage information"""
    tenant_id, owner_id = get_user_ids(current_user)
    service = DriveService(db)
    usage = await service.get_storage_usage(tenant_id, owner_id)
    # Map to frontend expected format
    return {
        "used": usage.get("used_bytes", 0),
        "total": usage.get("quota_bytes", 15 * 1024 * 1024 * 1024),
        "percentage": round(usage.get("used_bytes", 0) / usage.get("quota_bytes", 1) * 100, 2)
    }


# =============================================
# Activity
# =============================================

@router.get("/activity")
async def list_activity(
    file_id: Optional[UUID] = None,
    limit: int = 50,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List activity log for user or specific file"""
    tenant_id, owner_id = get_user_ids(current_user)
    service = DriveService(db)
    activity = await service.get_activity(
        tenant_id=tenant_id,
        owner_id=owner_id,
        file_id=file_id,
        limit=limit
    )
    return activity  # Return array directly


# =============================================
# Shared Drives (Team Drives)
# =============================================

class CreateSharedDriveRequest(BaseModel):
    name: str
    description: Optional[str] = None


@router.get("/shared-drives")
async def list_shared_drives(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all shared drives for the tenant"""
    tenant_id, _ = get_user_ids(current_user)
    service = DriveService(db)
    drives = await service.list_shared_drives(tenant_id)
    return drives  # Return array directly


@router.post("/shared-drives")
async def create_shared_drive(
    request: CreateSharedDriveRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new shared drive"""
    tenant_id, owner_id = get_user_ids(current_user)
    service = DriveService(db)
    drive = await service.create_shared_drive(
        tenant_id=tenant_id,
        owner_id=owner_id,
        name=request.name,
        description=request.description
    )
    return drive


@router.get("/shared-drives/{drive_id}/contents")
async def list_shared_drive_contents(
    drive_id: UUID,
    folder_id: Optional[UUID] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List contents of a shared drive"""
    tenant_id, _ = get_user_ids(current_user)
    service = DriveService(db)
    files = await service.list_shared_drive_contents(
        tenant_id=tenant_id,
        drive_id=drive_id,
        folder_id=folder_id
    )
    return files  # Return array directly


# =============================================
# Advanced Filters
# =============================================

@router.get("/files")
async def list_files_with_filters(
    # Basic filters
    parent_id: Optional[UUID] = None,
    # Type filter
    file_type: Optional[str] = None,  # folder, document, spreadsheet, presentation, pdf, image, video, audio, archive
    mime_types: Optional[str] = None,  # Comma-separated MIME types
    # People filter
    created_by: Optional[UUID] = None,
    shared_with: Optional[str] = None,  # Email of person file is shared with
    owned_by_me: Optional[bool] = None,
    # Date filters
    modified_after: Optional[datetime] = None,
    modified_before: Optional[datetime] = None,
    created_after: Optional[datetime] = None,
    created_before: Optional[datetime] = None,
    # Location filter
    location: Optional[str] = None,  # my-drive, shared-with-me, starred, trash, shared-drive
    shared_drive_id: Optional[UUID] = None,
    # Sorting
    sort_by: str = "updated_at",  # name, created_at, updated_at, size
    sort_order: str = "desc",  # asc, desc
    # Pagination
    skip: int = 0,
    limit: int = 50,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List files with advanced filtering options"""
    tenant_id, owner_id = get_user_ids(current_user)
    service = DriveService(db)

    # Parse MIME types if provided
    mime_type_list = mime_types.split(",") if mime_types else None

    files = await service.list_files_advanced(
        tenant_id=tenant_id,
        owner_id=owner_id,
        parent_id=parent_id,
        file_type=file_type,
        mime_types=mime_type_list,
        created_by=created_by,
        shared_with=shared_with,
        owned_by_me=owned_by_me,
        modified_after=modified_after,
        modified_before=modified_before,
        created_after=created_after,
        created_before=created_before,
        location=location,
        shared_drive_id=shared_drive_id,
        sort_by=sort_by,
        sort_order=sort_order,
        skip=skip,
        limit=limit
    )
    return files  # Return array directly


# =============================================
# Home (Suggested/Quick Access)
# =============================================

@router.get("/home")
async def get_home_data(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get home page data with suggested files and quick access"""
    tenant_id, owner_id = get_user_ids(current_user)
    service = DriveService(db)

    # Get recent files
    recent = await service.list_files(
        tenant_id=tenant_id,
        owner_id=owner_id,
        limit=10
    )

    # Get starred files
    starred = await service.list_files(
        tenant_id=tenant_id,
        owner_id=owner_id,
        starred_only=True,
        limit=5
    )

    # Get storage usage
    storage = await service.get_storage_usage(tenant_id, owner_id)

    return recent  # Return recent files as array for frontend


# =============================================
# Workspace Files (Organization-wide)
# =============================================

@router.get("/workspace")
async def list_workspace_files(
    skip: int = 0,
    limit: int = 50,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all workspace/organization files (for admins)"""
    tenant_id, _ = get_user_ids(current_user)
    service = DriveService(db)
    files = await service.list_workspace_files(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit
    )
    return files  # Return array directly


# =============================================
# Spam Files
# =============================================

@router.get("/spam")
async def list_spam_files(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List files marked as spam"""
    tenant_id, owner_id = get_user_ids(current_user)
    service = DriveService(db)
    files = await service.list_spam_files(
        tenant_id=tenant_id,
        owner_id=owner_id
    )
    return files  # Return array directly


@router.post("/files/{file_id}/mark-spam")
async def mark_as_spam(
    file_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark a file as spam"""
    tenant_id, _ = get_user_ids(current_user)
    service = DriveService(db)
    success = await service.mark_as_spam(file_id, tenant_id)
    if not success:
        raise HTTPException(status_code=404, detail="File not found")
    return {"status": "marked_as_spam"}


@router.post("/files/{file_id}/unmark-spam")
async def unmark_spam(
    file_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove spam mark from a file"""
    tenant_id, _ = get_user_ids(current_user)
    service = DriveService(db)
    success = await service.unmark_spam(file_id, tenant_id)
    if not success:
        raise HTTPException(status_code=404, detail="File not found")
    return {"status": "unmarked_spam"}


# =============================================
# Advanced Search Endpoint (Frontend-compatible)
# =============================================

@router.get("/files/search")
async def search_files_advanced(
    # Filter parameters
    type: Optional[str] = None,  # folder, document, spreadsheet, presentation, pdf, image, video, audio, archive
    people: Optional[str] = None,  # me, not-me
    modified: Optional[str] = None,  # today, yesterday, week, month, year
    location: Optional[str] = None,  # my-drive, shared-with-me, starred, trash
    search: Optional[str] = None,
    # Sorting
    sort_by: str = "updated_at",
    sort_order: str = "desc",
    # Pagination
    skip: int = 0,
    limit: int = 50,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Search files with advanced filters (frontend-compatible endpoint)"""
    from datetime import timedelta

    tenant_id, owner_id = get_user_ids(current_user)
    service = DriveService(db)

    # Convert 'modified' filter to date range
    modified_after = None
    if modified:
        now = datetime.utcnow()
        if modified == "today":
            modified_after = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif modified == "yesterday":
            modified_after = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        elif modified == "week":
            modified_after = now - timedelta(days=7)
        elif modified == "month":
            modified_after = now - timedelta(days=30)
        elif modified == "year":
            modified_after = now - timedelta(days=365)

    # Convert 'people' filter
    owned_by_me = None
    if people == "me":
        owned_by_me = True
    elif people == "not-me":
        owned_by_me = False

    files = await service.list_files_advanced(
        tenant_id=tenant_id,
        owner_id=owner_id,
        file_type=type,
        owned_by_me=owned_by_me,
        modified_after=modified_after,
        location=location,
        sort_by=sort_by,
        sort_order=sort_order,
        skip=skip,
        limit=limit
    )
    return files  # Return array directly for frontend compatibility


# =============================================
# File Type Categories
# =============================================

@router.get("/categories")
async def get_file_categories():
    """Get available file type categories for filtering"""
    return {
        "categories": [
            {"id": "folder", "name": "Folders", "mime_types": []},
            {"id": "document", "name": "Documents", "mime_types": [
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/vnd.google-apps.document",
                "text/plain"
            ]},
            {"id": "spreadsheet", "name": "Spreadsheets", "mime_types": [
                "application/vnd.ms-excel",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "application/vnd.google-apps.spreadsheet",
                "text/csv"
            ]},
            {"id": "presentation", "name": "Presentations", "mime_types": [
                "application/vnd.ms-powerpoint",
                "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                "application/vnd.google-apps.presentation"
            ]},
            {"id": "pdf", "name": "PDFs", "mime_types": ["application/pdf"]},
            {"id": "image", "name": "Images", "mime_types": [
                "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"
            ]},
            {"id": "video", "name": "Videos", "mime_types": [
                "video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"
            ]},
            {"id": "audio", "name": "Audio", "mime_types": [
                "audio/mpeg", "audio/wav", "audio/ogg", "audio/webm"
            ]},
            {"id": "archive", "name": "Archives", "mime_types": [
                "application/zip", "application/x-rar-compressed", "application/x-7z-compressed"
            ]}
        ]
    }
