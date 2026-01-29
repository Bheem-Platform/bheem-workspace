"""
Bheem Workspace - Drive API
File storage and management endpoints with Nextcloud integration
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel
from datetime import datetime
import io
import logging

from core.database import get_db
from core.security import get_current_user, get_optional_user, decode_token, validate_token_via_passport
from services.drive_service import DriveService
from services.mailgun_service import mailgun_service

logger = logging.getLogger(__name__)


async def get_user_from_token_string(token: str) -> Optional[Dict[str, Any]]:
    """Get user from token string (for direct download/preview links)"""
    if not token:
        logger.warning("Token param is empty")
        return None

    logger.info(f"Attempting to decode token (first 50 chars): {token[:50]}...")

    # Try local decode first
    payload = decode_token(token)
    if payload:
        logger.info("Token decoded with local secret")
        user_id = payload.get("sub") or payload.get("user_id")
        if user_id:
            return {
                "id": user_id,
                "user_id": user_id,
                "username": payload.get("username"),
                "email": payload.get("email"),
                "role": payload.get("role"),
                "company_id": payload.get("company_id"),
                "company_code": payload.get("company_code"),
            }

    # Try Passport validation for tokens issued by Passport
    logger.info("Trying Passport validation...")
    passport_payload = await validate_token_via_passport(token)
    if passport_payload:
        logger.info("Token validated via Passport")
        user_id = passport_payload.get("user_id") or passport_payload.get("sub")
        if user_id:
            return {
                "id": user_id,
                "user_id": user_id,
                "username": passport_payload.get("username"),
                "email": passport_payload.get("email"),
                "role": passport_payload.get("role"),
                "company_id": passport_payload.get("company_id"),
                "company_code": passport_payload.get("company_code"),
            }

    logger.warning("Token validation failed")
    return None

router = APIRouter(prefix="/drive", tags=["Drive"])

# Main Bheem tenant for internal use (Bheemverse Innovation Company - BHM001)
# All internal ERP users from BHM001 map to this single tenant
MAIN_BHEEM_TENANT_ID = "79f70aef-17eb-48a8-b599-2879721e8796"
INTERNAL_COMPANY_CODES = ["BHM001"]  # Add more subsidiary codes here if needed


def get_user_ids(current_user: Dict[str, Any]) -> tuple:
    """Extract tenant_id and user_id from current user context.

    For internal BHM001 users, always maps to the main Bheem tenant.
    """
    company_code = current_user.get("company_code")
    user_id = current_user.get("id") or current_user.get("user_id")

    # Internal users (BHM001 and subsidiaries) always use the main Bheem tenant
    if company_code and company_code.upper() in INTERNAL_COMPANY_CODES:
        return MAIN_BHEEM_TENANT_ID, user_id

    # External customers use their company_id as tenant_id
    tenant_id = current_user.get("tenant_id") or current_user.get("company_id") or current_user.get("erp_company_id")
    return tenant_id, user_id


async def ensure_tenant_and_user_exist(
    db: AsyncSession,
    tenant_id: str,
    user_id: str,
    company_code: str = None,
    user_email: str = None,
    user_name: str = None
):
    """Ensure user exists in tenant_users table. Tenant must already exist."""
    # Verify tenant exists (NO auto-creation)
    try:
        result = await db.execute(text("""
            SELECT id FROM workspace.tenants WHERE id = CAST(:tenant_id AS uuid)
        """), {"tenant_id": tenant_id})
        if not result.fetchone():
            logger.error(f"Tenant {tenant_id} not found. Tenants must be created manually.")
            raise HTTPException(status_code=403, detail="Tenant not configured. Contact administrator.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying tenant: {e}")
        raise HTTPException(status_code=500, detail="Error verifying tenant")

    # Ensure user exists in tenant_users
    try:
        result = await db.execute(text("""
            SELECT id FROM workspace.tenant_users WHERE id = CAST(:user_id AS uuid)
        """), {"user_id": user_id})
        if not result.fetchone():
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


async def get_user_ids_with_ensure(current_user: Dict[str, Any], db: AsyncSession) -> tuple:
    """Extract user IDs and ensure tenant and user exist"""
    tenant_id, user_id = get_user_ids(current_user)

    if not tenant_id or not user_id:
        raise HTTPException(status_code=403, detail="User context incomplete - missing tenant or user ID")

    company_code = current_user.get("company_code")
    user_email = current_user.get("username") or current_user.get("email")
    user_name = current_user.get("name") or current_user.get("full_name")

    await ensure_tenant_and_user_exist(
        db, str(tenant_id), str(user_id), company_code, user_email, user_name
    )

    return tenant_id, user_id


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
    new_parent_id: Optional[UUID] = None  # Frontend compatibility alias


class CopyFileRequest(BaseModel):
    destination_folder_id: Optional[UUID] = None
    new_name: Optional[str] = None


class ShareFileRequest(BaseModel):
    shared_with_email: Optional[str] = None
    user_email: Optional[str] = None  # Frontend compatibility alias
    permission: str = "view"  # view, comment, edit
    is_link_share: bool = False
    expires_at: Optional[datetime] = None


class CreatePublicLinkRequest(BaseModel):
    permission: str = "view"
    expires_in_days: Optional[int] = None
    password: Optional[str] = None


class FileResponse(BaseModel):
    id: UUID
    name: str
    file_type: str
    mime_type: Optional[str] = None
    size_bytes: Optional[int] = None
    parent_id: Optional[UUID] = None
    path: str
    description: Optional[str] = None
    is_starred: bool = False
    is_trashed: bool = False
    is_deleted: bool = False
    thumbnail_url: Optional[str] = None
    download_url: Optional[str] = None
    created_by: Optional[UUID] = None
    owner_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

    @property
    def size(self) -> Optional[int]:
        return self.size_bytes

    def model_dump(self, **kwargs):
        data = super().model_dump(**kwargs)
        data['size'] = self.size_bytes  # Add size alias
        return data


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
    tenant_id, owner_id = await get_user_ids_with_ensure(current_user, db)
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
    tenant_id, owner_id = await get_user_ids_with_ensure(current_user, db)
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
    tenant_id, owner_id = await get_user_ids_with_ensure(current_user, db)
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
    parent_id: Optional[UUID] = Form(None),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Upload a file to Drive (stored in Nextcloud)"""
    tenant_id, owner_id = await get_user_ids_with_ensure(current_user, db)
    service = DriveService(db)

    # Read file content
    content = await file.read()

    # Create file record and upload to Nextcloud
    drive_file = await service.create_file(
        tenant_id=tenant_id,
        owner_id=owner_id,
        name=file.filename,
        content=content,
        mime_type=file.content_type,
        parent_id=parent_id
    )

    return drive_file


# =============================================
# Advanced Search Endpoint (Must be before /files/{file_id})
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

    tenant_id, owner_id = await get_user_ids_with_ensure(current_user, db)
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


@router.get("/files/{file_id}", response_model=FileResponse)
async def get_file(
    file_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get file metadata"""
    tenant_id, _ = await get_user_ids_with_ensure(current_user, db)
    service = DriveService(db)
    file = await service.get_file(file_id, tenant_id)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    return file


@router.get("/files/{file_id}/download")
async def download_file(
    file_id: UUID,
    token: Optional[str] = Query(None, description="Auth token for direct download links"),
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    """Download file content from Nextcloud. Supports both Bearer token and query param token."""
    # Try to get user from token param if header auth fails
    user = current_user
    if not user and token:
        user = await get_user_from_token_string(token)
        logger.info(f"Download auth via token param: user={user.get('id') if user else None}")

    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    tenant_id, _ = await get_user_ids_with_ensure(user, db)
    service = DriveService(db)

    # Get file metadata first
    file = await service.get_file(file_id, tenant_id)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    if file.file_type == 'folder':
        raise HTTPException(status_code=400, detail="Cannot download a folder")

    # Download from Nextcloud
    content = await service.download_file(file_id, tenant_id)
    if content is None:
        raise HTTPException(status_code=404, detail="File content not found")

    return StreamingResponse(
        io.BytesIO(content),
        media_type=file.mime_type or "application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{file.name}"'
        }
    )


@router.get("/files/{file_id}/preview")
async def preview_file(
    file_id: UUID,
    token: Optional[str] = Query(None, description="Auth token for direct preview links"),
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    """Preview/view file content inline. Supports both Bearer token and query param token."""
    # Try to get user from token param if header auth fails
    user = current_user
    if not user and token:
        user = await get_user_from_token_string(token)
        logger.info(f"Preview auth via token param: user={user.get('id') if user else None}")

    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    tenant_id, _ = await get_user_ids_with_ensure(user, db)
    service = DriveService(db)

    # Get file metadata first
    file = await service.get_file(file_id, tenant_id)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    if file.file_type == 'folder':
        raise HTTPException(status_code=400, detail="Cannot preview a folder")

    # Download from Nextcloud
    content = await service.download_file(file_id, tenant_id)
    if content is None:
        raise HTTPException(status_code=404, detail="File content not found")

    # Return inline for viewing (not as attachment)
    return StreamingResponse(
        io.BytesIO(content),
        media_type=file.mime_type or "application/octet-stream",
        headers={
            "Content-Disposition": f'inline; filename="{file.name}"'
        }
    )


@router.patch("/files/{file_id}", response_model=FileResponse)
async def update_file(
    file_id: UUID,
    request: UpdateFileRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update file metadata"""
    tenant_id, _ = await get_user_ids_with_ensure(current_user, db)
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
    tenant_id, _ = await get_user_ids_with_ensure(current_user, db)
    service = DriveService(db)
    # Use new_parent_id if destination_folder_id not provided (frontend compatibility)
    target_folder = request.destination_folder_id or request.new_parent_id
    file = await service.move_file(
        file_id=file_id,
        tenant_id=tenant_id,
        new_parent_id=target_folder
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
    tenant_id, owner_id = await get_user_ids_with_ensure(current_user, db)
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
    tenant_id, _ = await get_user_ids_with_ensure(current_user, db)
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
    tenant_id, _ = await get_user_ids_with_ensure(current_user, db)
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
    tenant_id, _ = await get_user_ids_with_ensure(current_user, db)
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
    tenant_id, owner_id = await get_user_ids_with_ensure(current_user, db)
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
    tenant_id, _ = await get_user_ids_with_ensure(current_user, db)
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
    tenant_id, _ = await get_user_ids_with_ensure(current_user, db)
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
    tenant_id, owner_id = await get_user_ids_with_ensure(current_user, db)
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
    tenant_id, owner_id = await get_user_ids_with_ensure(current_user, db)
    service = DriveService(db)
    count = await service.empty_trash(tenant_id, owner_id)
    return {"deleted_count": count}


# =============================================
# Sharing
# =============================================

@router.post("/files/{file_id}/share")
async def share_file(
    file_id: UUID,
    request: ShareFileRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Share a file with another user or create a public link"""
    tenant_id, owner_id = await get_user_ids_with_ensure(current_user, db)
    service = DriveService(db)

    # Get file info for email notification
    file_info = await service.get_file(file_id, tenant_id)
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    # Handle link share (public link)
    if request.is_link_share:
        # Convert expires_at to expires_in_days if provided
        expires_in_days = None
        if request.expires_at:
            days_diff = (request.expires_at - datetime.utcnow()).days
            expires_in_days = max(1, days_diff) if days_diff > 0 else 7

        share = await service.create_public_link(
            file_id=file_id,
            tenant_id=tenant_id,
            shared_by=owner_id,
            permission=request.permission,
            expires_in_days=expires_in_days
        )
        if not share:
            raise HTTPException(status_code=404, detail="File not found")
        return {
            "id": share.id if hasattr(share, 'id') else str(file_id),
            "file_id": str(file_id),
            "user_email": None,
            "permission": request.permission,
            "is_link_share": True,
            "share_token": share.share_token if hasattr(share, 'share_token') else None,
            "expires_at": request.expires_at,
            "created_at": datetime.utcnow()
        }

    # Handle user share
    email = request.shared_with_email or request.user_email
    if not email:
        raise HTTPException(status_code=400, detail="Email is required for user share")

    share = await service.share_file(
        file_id=file_id,
        tenant_id=tenant_id,
        shared_by=owner_id,
        shared_with_email=email,
        permission=request.permission
    )
    if not share:
        raise HTTPException(status_code=404, detail="File not found")

    # Send email notification to the shared user
    try:
        sharer_name = current_user.get("name") or current_user.get("full_name") or current_user.get("username") or current_user.get("email", "Someone")
        sharer_email = current_user.get("email") or current_user.get("username", "")
        file_name = file_info.name if hasattr(file_info, 'name') else file_info.get('name', 'a file')
        permission_text = "view" if request.permission == "view" else "edit" if request.permission == "edit" else request.permission

        # Build share URL
        share_url = f"https://workspace.bheem.cloud/drive?shared=true"

        # Email HTML template
        email_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <div style="background: linear-gradient(135deg, #FFCCF2 0%, #977DFF 50%, #0033FF 100%); padding: 3px; border-radius: 16px;">
                    <div style="background-color: #ffffff; border-radius: 14px; padding: 40px;">
                        <!-- Logo -->
                        <div style="text-align: center; margin-bottom: 30px;">
                            <h1 style="margin: 0; font-size: 28px; background: linear-gradient(135deg, #FFCCF2 0%, #977DFF 50%, #0033FF 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">Bheem Drive</h1>
                        </div>

                        <!-- Content -->
                        <div style="text-align: center;">
                            <h2 style="color: #333; font-size: 22px; margin-bottom: 20px;">
                                {sharer_name} shared a file with you
                            </h2>

                            <div style="background-color: #f8f9fa; border-radius: 12px; padding: 20px; margin: 20px 0;">
                                <p style="color: #666; margin: 0 0 10px 0; font-size: 14px;">File Name</p>
                                <p style="color: #333; font-size: 18px; font-weight: 600; margin: 0; word-break: break-word;">
                                    {file_name}
                                </p>
                            </div>

                            <p style="color: #666; font-size: 14px; margin: 20px 0;">
                                Permission: <strong style="color: #333;">{permission_text.capitalize()}</strong>
                            </p>

                            <a href="{share_url}" style="display: inline-block; background: linear-gradient(135deg, #977DFF 0%, #0033FF 100%); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; margin-top: 20px;">
                                Open in Bheem Drive
                            </a>
                        </div>

                        <!-- Footer -->
                        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
                            <p style="color: #999; font-size: 12px; margin: 0;">
                                This email was sent by Bheem Workspace on behalf of {sharer_email}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """

        # Send email notification
        await mailgun_service.send_email(
            to=[email],
            subject=f"{sharer_name} shared \"{file_name}\" with you",
            html=email_html,
            tags=["drive-share", "notification"]
        )
        logger.info(f"Share notification email sent to {email} for file {file_name}")
    except Exception as e:
        # Log error but don't fail the share operation
        logger.error(f"Failed to send share notification email to {email}: {e}")

    return {
        "id": str(share.id),
        "file_id": str(file_id),
        "user_email": email,
        "permission": request.permission,
        "is_link_share": False,
        "created_at": share.created_at if hasattr(share, 'created_at') else datetime.utcnow()
    }


@router.get("/files/{file_id}/shares")
async def list_file_shares(
    file_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all shares for a file"""
    tenant_id, _ = await get_user_ids_with_ensure(current_user, db)
    service = DriveService(db)
    shares = await service.get_file_shares(file_id, tenant_id)

    # Transform to frontend-expected format
    result = []
    for share in (shares if isinstance(shares, list) else []):
        share_dict = share if isinstance(share, dict) else share.__dict__
        result.append({
            "id": str(share_dict.get("id", "")),
            "file_id": str(share_dict.get("file_id", "")),
            "user_id": str(share_dict.get("user_id")) if share_dict.get("user_id") else None,
            "user_email": share_dict.get("email"),  # Map email -> user_email
            "permission": share_dict.get("permission", "view"),
            "is_link_share": share_dict.get("is_public", False),  # Map is_public -> is_link_share
            "link_token": share_dict.get("link_token"),
            "expires_at": str(share_dict.get("expires_at")) if share_dict.get("expires_at") else None,
            "created_at": str(share_dict.get("created_at", "")),
        })
    return result


@router.delete("/files/{file_id}/shares/{share_id}")
async def remove_share(
    file_id: UUID,
    share_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove a share from a file"""
    tenant_id, _ = await get_user_ids_with_ensure(current_user, db)
    service = DriveService(db)
    success = await service.remove_share(share_id, tenant_id)
    if not success:
        raise HTTPException(status_code=404, detail="Share not found")
    return {"status": "removed"}


@router.get("/files/{file_id}/activity")
async def get_file_activity(
    file_id: UUID,
    limit: int = 20,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get activity log for a specific file"""
    tenant_id, owner_id = await get_user_ids_with_ensure(current_user, db)
    service = DriveService(db)
    activity = await service.get_activity(
        tenant_id=tenant_id,
        owner_id=owner_id,
        file_id=file_id,
        limit=limit
    )
    return activity  # Return array directly


@router.get("/shared-with-me")
async def list_shared_with_me(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List files shared with the current user"""
    tenant_id, owner_id = await get_user_ids_with_ensure(current_user, db)
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
    tenant_id, owner_id = await get_user_ids_with_ensure(current_user, db)
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


@router.get("/public/{share_token}/download")
async def download_public_file(
    share_token: str,
    password: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Download a file via public link"""
    service = DriveService(db)
    file = await service.access_public_link(share_token, password)
    if not file:
        raise HTTPException(
            status_code=404,
            detail="Invalid or expired link"
        )

    if file.file_type == 'folder':
        raise HTTPException(status_code=400, detail="Cannot download a folder")

    # Download from Nextcloud
    content = await service.download_file(file.id, file.tenant_id)
    if content is None:
        raise HTTPException(status_code=404, detail="File content not found")

    return StreamingResponse(
        io.BytesIO(content),
        media_type=file.mime_type or "application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{file.name}"'
        }
    )


@router.get("/public/{share_token}/preview")
async def preview_public_file(
    share_token: str,
    password: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Preview a file via public link (inline view)"""
    service = DriveService(db)
    file = await service.access_public_link(share_token, password)
    if not file:
        raise HTTPException(
            status_code=404,
            detail="Invalid or expired link"
        )

    if file.file_type == 'folder':
        raise HTTPException(status_code=400, detail="Cannot preview a folder")

    # Download from Nextcloud
    content = await service.download_file(file.id, file.tenant_id)
    if content is None:
        raise HTTPException(status_code=404, detail="File content not found")

    return StreamingResponse(
        io.BytesIO(content),
        media_type=file.mime_type or "application/octet-stream",
        headers={
            "Content-Disposition": f'inline; filename="{file.name}"'
        }
    )


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
    tenant_id, owner_id = await get_user_ids_with_ensure(current_user, db)
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
    tenant_id, owner_id = await get_user_ids_with_ensure(current_user, db)
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
    tenant_id, owner_id = await get_user_ids_with_ensure(current_user, db)
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
    tenant_id, owner_id = await get_user_ids_with_ensure(current_user, db)
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
    tenant_id, _ = await get_user_ids_with_ensure(current_user, db)
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
    tenant_id, owner_id = await get_user_ids_with_ensure(current_user, db)
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
    tenant_id, _ = await get_user_ids_with_ensure(current_user, db)
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
    tenant_id, owner_id = await get_user_ids_with_ensure(current_user, db)
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
    tenant_id, owner_id = await get_user_ids_with_ensure(current_user, db)
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
    tenant_id, _ = await get_user_ids_with_ensure(current_user, db)
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
    tenant_id, owner_id = await get_user_ids_with_ensure(current_user, db)
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
    tenant_id, _ = await get_user_ids_with_ensure(current_user, db)
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
    tenant_id, _ = await get_user_ids_with_ensure(current_user, db)
    service = DriveService(db)
    success = await service.unmark_spam(file_id, tenant_id)
    if not success:
        raise HTTPException(status_code=404, detail="File not found")
    return {"status": "unmarked_spam"}


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
