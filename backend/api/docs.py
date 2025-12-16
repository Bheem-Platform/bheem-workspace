"""
Bheem Workspace - Docs API (Nextcloud Integration)
Document management via WebDAV
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
import io

from core.security import get_current_user
from services.nextcloud_service import nextcloud_service

router = APIRouter(prefix="/docs", tags=["Bheem Docs"])

# Schemas
class FileInfo(BaseModel):
    name: str
    path: str
    type: str
    size: int
    modified: Optional[str]
    content_type: Optional[str]
    id: Optional[str]

class CreateFolderRequest(BaseModel):
    path: str
    name: str

class MoveFileRequest(BaseModel):
    source: str
    destination: str

class ShareLinkRequest(BaseModel):
    path: str
    expires_days: int = 7

class NextcloudCredentials(BaseModel):
    username: str
    password: str

# Endpoints
@router.get("/files")
async def list_files(
    path: str = "/",
    nc_user: str = None,
    nc_pass: str = None,
    current_user: dict = Depends(get_current_user)
):
    """List files and folders in a path"""
    # Use provided credentials or fallback to user-based
    username = nc_user or current_user["username"]
    password = nc_pass or ""  # In production, fetch from secure storage
    
    if not password:
        return {
            "message": "Nextcloud credentials required",
            "note": "Provide nc_user and nc_pass query parameters"
        }
    
    files = await nextcloud_service.list_files(username, password, path)
    return {
        "path": path,
        "count": len(files),
        "files": files
    }

@router.post("/folders")
async def create_folder(
    request: CreateFolderRequest,
    nc_user: str = None,
    nc_pass: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Create a new folder"""
    username = nc_user or current_user["username"]
    password = nc_pass or ""
    
    if not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nextcloud credentials required"
        )
    
    full_path = f"{request.path.rstrip('/')}/{request.name}"
    success = await nextcloud_service.create_folder(username, password, full_path)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create folder"
        )
    
    return {"success": True, "path": full_path}

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    path: str = Form("/"),
    nc_user: str = Form(None),
    nc_pass: str = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """Upload a file"""
    username = nc_user or current_user["username"]
    password = nc_pass or ""
    
    if not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nextcloud credentials required"
        )
    
    content = await file.read()
    full_path = f"{path.rstrip('/')}/{file.filename}"
    
    success = await nextcloud_service.upload_file(username, password, full_path, content)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload file"
        )
    
    return {
        "success": True,
        "filename": file.filename,
        "path": full_path,
        "size": len(content)
    }

@router.get("/download")
async def download_file(
    path: str,
    nc_user: str = None,
    nc_pass: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Download a file"""
    username = nc_user or current_user["username"]
    password = nc_pass or ""
    
    if not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nextcloud credentials required"
        )
    
    content = await nextcloud_service.download_file(username, password, path)
    
    if content is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    filename = path.split("/")[-1]
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.delete("/files")
async def delete_file(
    path: str,
    nc_user: str = None,
    nc_pass: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Delete a file or folder"""
    username = nc_user or current_user["username"]
    password = nc_pass or ""
    
    if not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nextcloud credentials required"
        )
    
    success = await nextcloud_service.delete_file(username, password, path)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete file"
        )
    
    return {"success": True, "deleted": path}

@router.post("/move")
async def move_file(
    request: MoveFileRequest,
    nc_user: str = None,
    nc_pass: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Move or rename a file"""
    username = nc_user or current_user["username"]
    password = nc_pass or ""
    
    if not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nextcloud credentials required"
        )
    
    success = await nextcloud_service.move_file(username, password, request.source, request.destination)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to move file"
        )
    
    return {"success": True, "source": request.source, "destination": request.destination}

@router.post("/copy")
async def copy_file(
    request: MoveFileRequest,
    nc_user: str = None,
    nc_pass: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Copy a file"""
    username = nc_user or current_user["username"]
    password = nc_pass or ""
    
    if not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nextcloud credentials required"
        )
    
    success = await nextcloud_service.copy_file(username, password, request.source, request.destination)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to copy file"
        )
    
    return {"success": True, "source": request.source, "destination": request.destination}

@router.post("/share")
async def create_share_link(
    request: ShareLinkRequest,
    nc_user: str = None,
    nc_pass: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Create a public share link for a file"""
    username = nc_user or current_user["username"]
    password = nc_pass or ""
    
    if not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nextcloud credentials required"
        )
    
    share_url = await nextcloud_service.create_share_link(username, password, request.path, request.expires_days)
    
    if not share_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create share link"
        )
    
    return {"success": True, "share_url": share_url}
