"""
Bheem Docs - API v2 Endpoints
==============================
Unified document management API supporting both internal (ERP) and external (SaaS) modes.

Endpoints:
- Documents: CRUD, upload, download, versions
- Folders: CRUD, tree, navigation
- Storage: Usage, quotas
- Entity Links: ERP integration
"""

from typing import Optional, List, Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from datetime import datetime
import io

from core.security import get_current_user
from services.docs_document_service import (
    get_docs_document_service,
    DocsDocumentService,
    DocumentType,
    DocumentStatus,
    EntityType
)
from services.docs_folder_service import (
    get_docs_folder_service,
    DocsFolderService
)
from services.docs_storage_service import (
    get_docs_storage_service,
    DocsStorageService
)

router = APIRouter(prefix="/docs/v2", tags=["Bheem Docs v2"])


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class DocumentResponse(BaseModel):
    """Document response model"""
    id: str
    title: str
    description: Optional[str] = None
    document_type: str
    status: Optional[str] = None
    file_name: str
    file_extension: Optional[str] = None
    file_size: int
    mime_type: str
    is_editable: bool = False
    current_version: Optional[int] = None
    tags: Optional[List[str]] = None
    view_count: Optional[int] = None
    download_count: Optional[int] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class DocumentListResponse(BaseModel):
    """Paginated document list"""
    documents: List[DocumentResponse]
    total: int
    limit: int
    offset: int
    has_more: bool


class CreateDocumentRequest(BaseModel):
    """Request to create document (metadata only, file uploaded separately)"""
    title: str
    description: Optional[str] = None
    document_type: Optional[str] = Field(None, description="Document type (auto-detected if not provided)")
    folder_id: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    tags: Optional[List[str]] = None


class UpdateDocumentRequest(BaseModel):
    """Request to update document metadata"""
    title: Optional[str] = None
    description: Optional[str] = None
    document_type: Optional[str] = None
    status: Optional[str] = None
    tags: Optional[List[str]] = None


class FolderResponse(BaseModel):
    """Folder response model"""
    id: str
    name: str
    description: Optional[str] = None
    path: str
    level: int
    parent_id: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    is_system: bool = False
    subfolder_count: Optional[int] = None
    document_count: Optional[int] = None
    created_at: Optional[Any] = None

    class Config:
        from_attributes = True


class CreateFolderRequest(BaseModel):
    """Request to create folder"""
    name: str
    description: Optional[str] = None
    parent_id: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None


class UpdateFolderRequest(BaseModel):
    """Request to update folder"""
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None


class MoveFolderRequest(BaseModel):
    """Request to move folder"""
    new_parent_id: Optional[str] = None


class VersionResponse(BaseModel):
    """Document version response"""
    id: str
    version_number: int
    file_name: str
    file_size: int
    change_notes: Optional[str] = None
    is_current: bool
    created_at: str


class StorageUsageResponse(BaseModel):
    """Storage usage response"""
    used_bytes: int
    used_mb: float
    used_gb: float
    object_count: int
    quota_bytes: Optional[int] = None
    quota_used_percent: Optional[float] = None


class PresignedUrlResponse(BaseModel):
    """Presigned URL response"""
    url: str
    expires_in: int
    storage_path: Optional[str] = None


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_document_service() -> DocsDocumentService:
    """Get document service instance."""
    return get_docs_document_service()


def get_folder_service() -> DocsFolderService:
    """Get folder service instance."""
    return get_docs_folder_service()


def get_storage_service() -> DocsStorageService:
    """Get storage service instance."""
    return get_docs_storage_service()


def get_user_company_id(user: dict) -> UUID:
    """Extract company ID from user context."""
    company_id = user.get('company_id') or user.get('erp_company_id')
    if not company_id:
        raise HTTPException(status_code=400, detail="Company context required")
    return UUID(company_id)


# =============================================================================
# DOCUMENT ENDPOINTS
# =============================================================================

@router.post("/documents", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    title: Optional[str] = Query(None, description="Document title (defaults to filename)"),
    description: Optional[str] = Query(None),
    document_type: Optional[str] = Query(None, description="Document type"),
    folder_id: Optional[str] = Query(None, description="Target folder ID"),
    entity_type: Optional[str] = Query(None, description="ERP entity type"),
    entity_id: Optional[str] = Query(None, description="ERP entity ID"),
    tags: Optional[str] = Query(None, description="Comma-separated tags"),
    service: DocsDocumentService = Depends(get_document_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload a new document.

    Supports all common file types. Document type is auto-detected from filename
    if not provided.
    """
    company_id = get_user_company_id(current_user)
    user_id = UUID(current_user['id'])

    # Parse tags
    tag_list = [t.strip() for t in tags.split(',')] if tags else None

    try:
        result = await service.create_document(
            title=title or file.filename,
            file=file.file,
            filename=file.filename,
            company_id=company_id,
            created_by=user_id,
            folder_id=UUID(folder_id) if folder_id else None,
            document_type=document_type,
            description=description,
            entity_type=entity_type,
            entity_id=UUID(entity_id) if entity_id else None,
            tags=tag_list
        )

        return DocumentResponse(
            id=result['id'],
            title=result['title'],
            file_name=result['file_name'],
            file_size=result['file_size'],
            mime_type=result['mime_type'],
            document_type=result['document_type'],
            is_editable=result['is_editable'],
            created_at=result['created_at']
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.get("/documents", response_model=DocumentListResponse)
async def list_documents(
    folder_id: Optional[str] = Query(None, description="Filter by folder"),
    document_type: Optional[str] = Query(None, description="Filter by document type"),
    status: Optional[str] = Query(None, description="Filter by status"),
    search: Optional[str] = Query(None, description="Search in title and content"),
    tags: Optional[str] = Query(None, description="Comma-separated tags to filter"),
    entity_type: Optional[str] = Query(None, description="Filter by ERP entity type"),
    entity_id: Optional[str] = Query(None, description="Filter by ERP entity ID"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    order_by: str = Query("updated_at", description="Sort field"),
    order_dir: str = Query("DESC", description="Sort direction"),
    service: DocsDocumentService = Depends(get_document_service),
    current_user: dict = Depends(get_current_user)
):
    """
    List documents with filtering and pagination.

    Supports filtering by folder, type, status, tags, and ERP entity.
    Full-text search available via the search parameter.
    """
    company_id = get_user_company_id(current_user)

    # Parse tags
    tag_list = [t.strip() for t in tags.split(',')] if tags else None

    result = await service.list_documents(
        company_id=company_id,
        folder_id=UUID(folder_id) if folder_id else None,
        document_type=document_type,
        status=status,
        search=search,
        tags=tag_list,
        entity_type=entity_type,
        entity_id=UUID(entity_id) if entity_id else None,
        limit=limit,
        offset=offset,
        order_by=order_by,
        order_dir=order_dir
    )

    return DocumentListResponse(
        documents=[DocumentResponse(**doc) for doc in result['documents']],
        total=result['total'],
        limit=result['limit'],
        offset=result['offset'],
        has_more=result['has_more']
    )


@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    service: DocsDocumentService = Depends(get_document_service),
    current_user: dict = Depends(get_current_user)
):
    """Get document details by ID."""
    user_id = UUID(current_user['id'])

    doc = await service.get_document(
        document_id=UUID(document_id),
        user_id=user_id
    )

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    return DocumentResponse(**doc)


@router.put("/documents/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: str,
    request: UpdateDocumentRequest,
    service: DocsDocumentService = Depends(get_document_service),
    current_user: dict = Depends(get_current_user)
):
    """Update document metadata."""
    user_id = UUID(current_user['id'])

    try:
        result = await service.update_document(
            document_id=UUID(document_id),
            updated_by=user_id,
            title=request.title,
            description=request.description,
            document_type=request.document_type,
            status=request.status,
            tags=request.tags
        )

        # Get full document details
        doc = await service.get_document(UUID(document_id))
        return DocumentResponse(**doc)

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    permanent: bool = Query(False, description="Permanently delete (cannot be undone)"),
    service: DocsDocumentService = Depends(get_document_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a document.

    By default, performs soft delete (can be restored).
    Set permanent=true for hard delete.
    """
    user_id = UUID(current_user['id'])

    try:
        await service.delete_document(
            document_id=UUID(document_id),
            deleted_by=user_id,
            hard_delete=permanent
        )
        return {"deleted": True, "document_id": document_id}

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/documents/{document_id}/download")
async def download_document(
    document_id: str,
    version: Optional[int] = Query(None, description="Specific version number"),
    service: DocsDocumentService = Depends(get_document_service),
    current_user: dict = Depends(get_current_user)
):
    """Download document file."""
    user_id = UUID(current_user['id'])

    try:
        file_stream, filename, content_type = await service.download_document(
            document_id=UUID(document_id),
            user_id=user_id,
            version=version
        )

        return StreamingResponse(
            file_stream,
            media_type=content_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/documents/{document_id}/presigned-url", response_model=PresignedUrlResponse)
async def get_document_presigned_url(
    document_id: str,
    expires_in: int = Query(3600, description="URL expiration in seconds"),
    service: DocsDocumentService = Depends(get_document_service),
    storage: DocsStorageService = Depends(get_storage_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Get presigned URL for direct download.

    Useful for large files or when you need to share a temporary download link.
    """
    user_id = UUID(current_user['id'])

    doc = await service.get_document(UUID(document_id), user_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    url = await storage.generate_presigned_url(
        storage_path=doc['storage_path'],
        expires_in=expires_in
    )

    return PresignedUrlResponse(
        url=url,
        expires_in=expires_in,
        storage_path=doc['storage_path']
    )


# =============================================================================
# VERSION ENDPOINTS
# =============================================================================

@router.post("/documents/{document_id}/versions", response_model=VersionResponse)
async def create_version(
    document_id: str,
    file: UploadFile = File(...),
    change_notes: Optional[str] = Query(None, description="Description of changes"),
    service: DocsDocumentService = Depends(get_document_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload a new version of a document.

    Creates a new version while preserving the version history.
    """
    user_id = UUID(current_user['id'])

    try:
        result = await service.create_version(
            document_id=UUID(document_id),
            file=file.file,
            filename=file.filename,
            uploaded_by=user_id,
            change_notes=change_notes
        )

        return VersionResponse(
            id=result['id'],
            version_number=result['version_number'],
            file_name=file.filename,
            file_size=result['file_size'],
            change_notes=change_notes,
            is_current=True,
            created_at=result['created_at']
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/documents/{document_id}/versions", response_model=List[VersionResponse])
async def list_versions(
    document_id: str,
    service: DocsDocumentService = Depends(get_document_service),
    current_user: dict = Depends(get_current_user)
):
    """Get version history for a document."""
    versions = await service.list_versions(UUID(document_id))

    return [
        VersionResponse(
            id=str(v['id']),
            version_number=v['version_number'],
            file_name=v['file_name'],
            file_size=v['file_size'],
            change_notes=v.get('change_notes'),
            is_current=v['is_current'],
            created_at=v['created_at'].isoformat() if v['created_at'] else None
        )
        for v in versions
    ]


@router.get("/documents/{document_id}/audit")
async def get_audit_log(
    document_id: str,
    limit: int = Query(50, ge=1, le=200),
    service: DocsDocumentService = Depends(get_document_service),
    current_user: dict = Depends(get_current_user)
):
    """Get audit trail for a document."""
    logs = await service.get_audit_logs(UUID(document_id), limit=limit)
    return {"logs": logs}


# =============================================================================
# FOLDER ENDPOINTS
# =============================================================================

@router.post("/folders", response_model=FolderResponse)
async def create_folder(
    request: CreateFolderRequest,
    service: DocsFolderService = Depends(get_folder_service),
    current_user: dict = Depends(get_current_user)
):
    """Create a new folder."""
    company_id = get_user_company_id(current_user)
    user_id = UUID(current_user['id'])

    try:
        result = await service.create_folder(
            name=request.name,
            company_id=company_id,
            created_by=user_id,
            parent_id=UUID(request.parent_id) if request.parent_id else None,
            description=request.description,
            color=request.color,
            icon=request.icon
        )

        return FolderResponse(**result)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/folders", response_model=List[FolderResponse])
async def list_folders(
    parent_id: Optional[str] = Query(None, description="Parent folder ID (omit for root)"),
    service: DocsFolderService = Depends(get_folder_service),
    current_user: dict = Depends(get_current_user)
):
    """List folders at a specific level."""
    company_id = get_user_company_id(current_user)

    folders = await service.list_folders(
        company_id=company_id,
        parent_id=UUID(parent_id) if parent_id else None
    )

    return [FolderResponse(**f) for f in folders]


@router.get("/folders/tree")
async def get_folder_tree(
    service: DocsFolderService = Depends(get_folder_service),
    current_user: dict = Depends(get_current_user)
):
    """Get complete folder tree structure."""
    company_id = get_user_company_id(current_user)

    tree = await service.get_folder_tree(company_id)
    return {"tree": tree}


@router.get("/folders/{folder_id}", response_model=FolderResponse)
async def get_folder(
    folder_id: str,
    service: DocsFolderService = Depends(get_folder_service),
    current_user: dict = Depends(get_current_user)
):
    """Get folder details."""
    folder = await service.get_folder(UUID(folder_id))

    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    return FolderResponse(**folder)


@router.get("/folders/{folder_id}/breadcrumb")
async def get_folder_breadcrumb(
    folder_id: str,
    service: DocsFolderService = Depends(get_folder_service),
    current_user: dict = Depends(get_current_user)
):
    """Get breadcrumb path for folder navigation."""
    breadcrumb = await service.get_breadcrumb(UUID(folder_id))
    return {"breadcrumb": breadcrumb}


@router.put("/folders/{folder_id}", response_model=FolderResponse)
async def update_folder(
    folder_id: str,
    request: UpdateFolderRequest,
    service: DocsFolderService = Depends(get_folder_service),
    current_user: dict = Depends(get_current_user)
):
    """Update folder metadata."""
    user_id = UUID(current_user['id'])

    try:
        result = await service.update_folder(
            folder_id=UUID(folder_id),
            updated_by=user_id,
            name=request.name,
            description=request.description,
            color=request.color,
            icon=request.icon
        )

        folder = await service.get_folder(UUID(folder_id))
        return FolderResponse(**folder)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/folders/{folder_id}/move")
async def move_folder(
    folder_id: str,
    request: MoveFolderRequest,
    service: DocsFolderService = Depends(get_folder_service),
    current_user: dict = Depends(get_current_user)
):
    """Move folder to a new location."""
    user_id = UUID(current_user['id'])

    try:
        result = await service.move_folder(
            folder_id=UUID(folder_id),
            new_parent_id=UUID(request.new_parent_id) if request.new_parent_id else None,
            moved_by=user_id
        )
        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/folders/{folder_id}")
async def delete_folder(
    folder_id: str,
    recursive: bool = Query(False, description="Delete contents if not empty"),
    service: DocsFolderService = Depends(get_folder_service),
    current_user: dict = Depends(get_current_user)
):
    """Delete a folder."""
    user_id = UUID(current_user['id'])

    try:
        await service.delete_folder(
            folder_id=UUID(folder_id),
            deleted_by=user_id,
            recursive=recursive
        )
        return {"deleted": True, "folder_id": folder_id}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================================================
# STORAGE ENDPOINTS
# =============================================================================

@router.get("/storage/usage", response_model=StorageUsageResponse)
async def get_storage_usage(
    storage: DocsStorageService = Depends(get_storage_service),
    current_user: dict = Depends(get_current_user)
):
    """Get storage usage for current company."""
    company_id = get_user_company_id(current_user)

    usage = await storage.get_storage_usage(company_id=company_id)

    # Get quota from config
    from core.config import settings
    quota_bytes = settings.DOCS_DEFAULT_QUOTA_BYTES

    return StorageUsageResponse(
        used_bytes=usage['used_bytes'],
        used_mb=usage['used_mb'],
        used_gb=usage['used_gb'],
        object_count=usage['object_count'],
        quota_bytes=quota_bytes,
        quota_used_percent=round((usage['used_bytes'] / quota_bytes) * 100, 2) if quota_bytes else None
    )


@router.post("/storage/presigned-upload", response_model=PresignedUrlResponse)
async def get_presigned_upload_url(
    filename: str = Query(..., description="Filename for upload"),
    folder_path: str = Query("", description="Folder path"),
    content_type: Optional[str] = Query(None, description="MIME type"),
    expires_in: int = Query(3600, description="URL expiration in seconds"),
    storage: DocsStorageService = Depends(get_storage_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Get presigned URL for direct browser upload.

    Use this for large file uploads to avoid timeout issues.
    """
    company_id = get_user_company_id(current_user)

    result = await storage.generate_upload_url(
        filename=filename,
        company_id=company_id,
        folder_path=folder_path,
        content_type=content_type,
        expires_in=expires_in
    )

    return PresignedUrlResponse(
        url=result['upload_url'],
        expires_in=expires_in,
        storage_path=result['storage_path']
    )


# =============================================================================
# DOCUMENT TYPE REFERENCE
# =============================================================================

@router.get("/reference/document-types")
async def list_document_types():
    """List available document types."""
    return {
        "types": [
            {"value": t.value, "label": t.value.replace("_", " ").title()}
            for t in DocumentType
        ]
    }


@router.get("/reference/entity-types")
async def list_entity_types():
    """List available ERP entity types for document linking."""
    return {
        "types": [
            {"value": t.value, "label": t.value.replace("_", " ").title()}
            for t in EntityType
        ]
    }
