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
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Response, Request
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
    Each user only sees their own documents (created_by filter).
    """
    company_id = get_user_company_id(current_user)
    user_id = UUID(current_user['id'])

    # Parse tags
    tag_list = [t.strip() for t in tags.split(',')] if tags else None

    result = await service.list_documents(
        company_id=company_id,
        user_id=user_id,  # Filter by current user - each user sees only their docs
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
    """List folders at a specific level. Each user only sees their own folders."""
    company_id = get_user_company_id(current_user)
    user_id = UUID(current_user['id'])

    folders = await service.list_folders(
        company_id=company_id,
        user_id=user_id,  # Filter by current user - each user sees only their folders
        parent_id=UUID(parent_id) if parent_id else None
    )

    return [FolderResponse(**f) for f in folders]


@router.get("/folders/tree")
async def get_folder_tree(
    service: DocsFolderService = Depends(get_folder_service),
    current_user: dict = Depends(get_current_user)
):
    """Get complete folder tree structure. Each user only sees their own folders."""
    company_id = get_user_company_id(current_user)
    user_id = UUID(current_user['id'])

    tree = await service.get_folder_tree(company_id, user_id=user_id)
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


# =============================================================================
# NEXTCLOUD USER INITIALIZATION
# =============================================================================

@router.post("/user/initialize-storage")
async def initialize_user_storage(
    current_user: dict = Depends(get_current_user)
):
    """
    Initialize Nextcloud storage for the current user.

    Creates a Nextcloud user account (if needed) and generates credentials
    so documents are stored in the user's own Nextcloud folder.

    This endpoint is called automatically when a user first accesses Bheem Docs,
    but can also be called manually to reinitialize storage.
    """
    from services.nextcloud_credentials_service import get_nextcloud_credentials_service

    user_id = current_user.get('id')
    user_email = current_user.get('email', current_user.get('username', ''))
    user_name = current_user.get('name', current_user.get('full_name', user_email.split('@')[0]))

    if not user_id or not user_email:
        raise HTTPException(status_code=400, detail="User ID and email required")

    try:
        cred_service = get_nextcloud_credentials_service()
        credentials = await cred_service.ensure_user_credentials(
            UUID(user_id),
            user_email,
            user_name
        )

        if credentials:
            return {
                "status": "success",
                "message": "Nextcloud storage initialized",
                "nextcloud_username": credentials['nextcloud_username']
            }
        else:
            raise HTTPException(
                status_code=500,
                detail="Failed to initialize Nextcloud storage"
            )

    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Failed to initialize user storage: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/storage-status")
async def get_user_storage_status(
    current_user: dict = Depends(get_current_user)
):
    """
    Check if the current user has Nextcloud storage initialized.
    """
    from services.nextcloud_credentials_service import get_nextcloud_credentials_service

    user_id = current_user.get('id')

    if not user_id:
        raise HTTPException(status_code=400, detail="User ID required")

    try:
        cred_service = get_nextcloud_credentials_service()
        credentials = await cred_service.get_user_credentials(UUID(user_id))

        if credentials:
            return {
                "initialized": True,
                "nextcloud_username": credentials['nextcloud_username']
            }
        else:
            return {
                "initialized": False,
                "nextcloud_username": None
            }

    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Failed to check storage status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# CREATE WORD DOCUMENT FOR ONLYOFFICE
# =============================================================================

@router.post("/documents/create-word")
async def create_word_document(
    title: str = Query("Untitled Document", description="Document title"),
    folder_id: Optional[str] = Query(None, description="Target folder ID"),
    service: DocsDocumentService = Depends(get_document_service),
    storage: DocsStorageService = Depends(get_storage_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new blank Word document (.docx) for OnlyOffice editing.

    This creates an actual DOCX file that OnlyOffice can edit,
    rather than a Bheem document format.
    """
    import zipfile
    import uuid

    user_id = current_user.get('id')
    company_id = get_user_company_id(current_user)

    # Create a minimal valid DOCX file programmatically
    # DOCX is a ZIP file with XML content
    docx_buffer = io.BytesIO()

    with zipfile.ZipFile(docx_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        # [Content_Types].xml
        content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>'''
        zf.writestr('[Content_Types].xml', content_types)

        # _rels/.rels
        rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>'''
        zf.writestr('_rels/.rels', rels)

        # word/_rels/document.xml.rels
        doc_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>'''
        zf.writestr('word/_rels/document.xml.rels', doc_rels)

        # word/document.xml - main document content
        document = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t></w:t>
      </w:r>
    </w:p>
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>'''
        zf.writestr('word/document.xml', document)

        # word/styles.xml - basic styles
        styles = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
        <w:sz w:val="22"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
</w:styles>'''
        zf.writestr('word/styles.xml', styles)

    # Get the content
    file_content = docx_buffer.getvalue()

    # Generate document ID
    doc_id = str(uuid.uuid4())
    file_name = f"{title}.docx"

    # Get user's email for Nextcloud folder
    user_email = current_user.get('email', current_user.get('username', ''))

    # Upload to storage (user's Nextcloud folder with their credentials)
    try:
        storage_result = await storage.upload_file(
            file=io.BytesIO(file_content),
            filename=file_name,
            company_id=company_id,
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            nextcloud_user=user_email,
            user_id=UUID(user_id) if user_id else None
        )
        storage_path = storage_result['storage_path']
        nextcloud_user = storage_result.get('nextcloud_user', user_email)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload document: {str(e)}")

    # Create document record directly in database
    import psycopg2
    from psycopg2.extras import RealDictCursor
    from core.config import settings

    try:
        # Use ERP DB config like other services
        db_config = {
            'host': settings.ERP_DB_HOST,
            'port': settings.ERP_DB_PORT,
            'database': settings.ERP_DB_NAME,
            'user': settings.ERP_DB_USER,
            'password': settings.ERP_DB_PASSWORD,
        }
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor(cursor_factory=RealDictCursor)

        mime_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

        cur.execute("""
            INSERT INTO dms.documents (
                id, title, description, document_type, status,
                file_name, file_extension, file_size, mime_type,
                storage_path, storage_bucket, folder_id,
                company_id, is_editable,
                current_version, version_count,
                created_by, created_at, updated_at, is_active
            ) VALUES (
                %s, %s, %s, 'GENERAL'::dms.documenttype, 'ACTIVE'::dms.documentstatus,
                %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s,
                1, 1,
                %s, NOW(), NOW(), true
            )
            RETURNING id, title, file_name, mime_type, storage_path, created_at
        """, (
            doc_id,
            title,
            None,  # description
            file_name,
            'docx',
            len(file_content),
            mime_type,
            storage_path,
            settings.DOCS_S3_BUCKET,
            folder_id if folder_id else None,
            str(company_id),
            True,  # is_editable
            user_id
        ))

        row = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        return {
            "id": str(row['id']),
            "title": row['title'],
            "file_name": row['file_name'],
            "mime_type": row['mime_type'],
            "storage_path": row['storage_path'],
            "redirect_url": f"/docs/editor/{row['id']}"
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create document: {str(e)}")


# =============================================================================
# ONLYOFFICE INTEGRATION ENDPOINTS
# =============================================================================

@router.get("/documents/{document_id}/editor-config")
async def get_onlyoffice_editor_config(
    document_id: str,
    mode: str = Query("edit", description="Editor mode: edit, view, or review"),
    service: DocsDocumentService = Depends(get_document_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Get OnlyOffice Document Editor configuration for Word documents.

    Returns the configuration object needed to initialize the
    OnlyOffice editor in the frontend for DOCX files.
    """
    import jwt
    import time
    from datetime import timedelta
    from urllib.parse import quote
    from core.config import settings
    import logging

    logger = logging.getLogger(__name__)

    user_id = current_user.get('id')
    user_name = current_user.get('name') or current_user.get('email') or 'User'
    user_email = current_user.get('email', '')

    # Get document metadata
    doc = await service.get_document(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    storage_path = doc.get('storage_path')
    if not storage_path:
        raise HTTPException(status_code=400, detail="Document has no file stored")

    # Check if it's an editable document type
    mime_type = doc.get('mime_type', '')
    file_extension = doc.get('file_extension', '').lower().lstrip('.')

    # Supported document types for OnlyOffice
    supported_types = {
        'docx': 'word',
        'doc': 'word',
        'odt': 'word',
        'rtf': 'word',
        'txt': 'word',
    }

    if file_extension not in supported_types:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{file_extension}' is not supported for OnlyOffice editing"
        )

    document_type = supported_types.get(file_extension, 'word')

    # Generate document key (unique per version)
    version = doc.get('current_version', 1) or 1
    document_key = f"doc-{document_id}-v{version}-{int(time.time())}"

    # Generate access token for document proxy endpoint
    access_token = jwt.encode(
        {
            "document_id": document_id,
            "exp": datetime.utcnow() + timedelta(hours=24),
        },
        settings.ONLYOFFICE_JWT_SECRET,
        algorithm="HS256"
    )

    # Ensure token is a string
    if isinstance(access_token, bytes):
        access_token = access_token.decode('utf-8')

    # URL-encode the token
    encoded_token = quote(access_token, safe='')

    # Use proxy URL for document content
    download_url = f"{settings.WORKSPACE_URL}/api/v1/docs/v2/documents/{document_id}/content?token={encoded_token}"

    logger.info(f"Generated OnlyOffice download URL for document {document_id}")

    # Callback URL for OnlyOffice saves
    callback_url = f"{settings.WORKSPACE_URL}/api/v1/docs/v2/documents/{document_id}/onlyoffice-callback"

    # Build editor config
    config = {
        "document": {
            "fileType": file_extension if file_extension in ['docx', 'doc', 'odt', 'rtf', 'txt'] else 'docx',
            "key": document_key,
            "title": doc.get('title', 'Untitled') + '.' + file_extension,
            "url": download_url,
            "permissions": {
                "chat": True,
                "comment": True,
                "copy": True,
                "download": True,
                "edit": mode == "edit",
                "print": True,
                "review": mode in ["edit", "review"],
            },
        },
        "documentType": document_type,
        "editorConfig": {
            "callbackUrl": callback_url,
            "lang": "en",
            "mode": mode,
            "user": {
                "id": str(user_id),
                "name": user_name,
            },
            "customization": {
                "autosave": True,
                "comments": True,
                "compactHeader": False,
                "compactToolbar": False,
                "feedback": False,
                "forcesave": True,
                "help": False,
                "hideRightMenu": False,
                "toolbarNoTabs": False,
                "toolbarHideFileName": False,
                "statusBar": True,
                "leftMenu": True,
                "rightMenu": True,
                "toolbar": True,
                "zoom": 100,
                "logo": {
                    "image": f"{settings.WORKSPACE_URL}/static/bheem-logo.svg",
                    "imageDark": f"{settings.WORKSPACE_URL}/static/bheem-logo-dark.svg",
                    "imageLight": f"{settings.WORKSPACE_URL}/static/bheem-logo-light.svg",
                    "imageEmbedded": f"{settings.WORKSPACE_URL}/static/bheem-loader-logo.svg",
                    "url": f"{settings.WORKSPACE_URL}/docs",
                    "visible": True
                },
                "customer": {
                    "address": "Bheem Cloud Services",
                    "info": "Bheem Workspace - Your productivity suite",
                    "logo": f"{settings.WORKSPACE_URL}/static/bheem-logo.svg",
                    "logoDark": f"{settings.WORKSPACE_URL}/static/bheem-logo-dark.svg",
                    "mail": "support@bheem.cloud",
                    "name": "Bheem Docs",
                    "www": "https://bheem.cloud"
                },
                "goback": {
                    "blank": False,
                    "text": "Back to Bheem",
                    "url": f"{settings.WORKSPACE_URL}/docs"
                },
                "loaderLogo": f"{settings.WORKSPACE_URL}/static/bheem-loader-logo.svg",
                "loaderName": "Bheem Docs",
            },
        },
        "height": "100%",
        "width": "100%",
        "type": "desktop",
    }

    # Add JWT token if enabled
    if settings.ONLYOFFICE_JWT_ENABLED and settings.ONLYOFFICE_JWT_SECRET:
        payload_to_sign = config.copy()
        token = jwt.encode(payload_to_sign, settings.ONLYOFFICE_JWT_SECRET, algorithm="HS256")
        if isinstance(token, bytes):
            token = token.decode('utf-8')
        config["token"] = token

    return {
        "config": config,
        "documentServerUrl": settings.ONLYOFFICE_URL,
        "document": {
            "id": document_id,
            "title": doc.get('title'),
            "file_extension": file_extension,
            "mime_type": mime_type,
        },
    }


@router.get("/documents/{document_id}/content")
async def get_document_content_for_onlyoffice(
    document_id: str,
    token: str = Query(..., description="Access token for document"),
    service: DocsDocumentService = Depends(get_document_service)
):
    """
    Get document file content for OnlyOffice.

    This endpoint is used by OnlyOffice Document Server to fetch the document.
    It uses a signed token to verify access without requiring user authentication.
    """
    import jwt
    from urllib.parse import unquote
    from core.config import settings
    import logging

    logger = logging.getLogger(__name__)

    logger.info(f"OnlyOffice content request for document {document_id}")

    # URL-decode the token if it was encoded
    token = unquote(token)

    # Verify token
    try:
        payload = jwt.decode(token, settings.ONLYOFFICE_JWT_SECRET, algorithms=["HS256"])
        token_doc_id = payload.get("document_id")
        if token_doc_id != document_id:
            logger.warning(f"Document ID mismatch: token has {token_doc_id}, URL has {document_id}")
            raise HTTPException(status_code=403, detail="Invalid token - document ID mismatch")
    except jwt.ExpiredSignatureError:
        logger.warning(f"Token expired for document {document_id}")
        raise HTTPException(status_code=403, detail="Token expired")
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid token for document {document_id}: {e}")
        raise HTTPException(status_code=403, detail="Invalid token")

    # Get document
    doc = await service.get_document(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    storage_path = doc.get('storage_path')
    if not storage_path:
        raise HTTPException(status_code=404, detail="Document file not found")

    # Download from storage
    try:
        file_stream, filename, mime_type = await service.download_document(document_id)
        content = file_stream.read()
        logger.info(f"Downloaded document {document_id}, size: {len(content)} bytes")
    except Exception as e:
        logger.error(f"Failed to download document {document_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to download document")

    return StreamingResponse(
        io.BytesIO(content),
        media_type=mime_type or "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(content)),
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Access-Control-Allow-Origin": "*",
        }
    )


@router.post("/documents/{document_id}/onlyoffice-callback")
async def onlyoffice_document_callback(
    document_id: str,
    request: Request,
    service: DocsDocumentService = Depends(get_document_service)
):
    """
    Handle OnlyOffice Document Server callback.

    OnlyOffice calls this endpoint when document state changes:
    - Status 0: No document with this key
    - Status 1: Document being edited
    - Status 2: Document ready for saving
    - Status 3: Document saving error
    - Status 4: Document closed with no changes
    - Status 6: Force save requested
    - Status 7: Error force saving
    """
    import aiohttp
    import logging
    import httpx
    from core.config import settings
    import psycopg2
    from psycopg2.extras import RealDictCursor

    logger = logging.getLogger(__name__)

    # Get callback data from request body
    try:
        callback_data = await request.json()
        logger.info(f"OnlyOffice callback data received: {callback_data}")
    except Exception as e:
        logger.error(f"Failed to parse OnlyOffice callback data: {e}")
        return {"error": 1}

    status = callback_data.get("status")
    document_url = callback_data.get("url")
    key = callback_data.get("key", "")
    users = callback_data.get("users", [])

    logger.info(f"OnlyOffice callback for document {document_id}: status={status}, key={key}, users={users}")

    # Status 2 or 6 means document needs saving
    if status in [2, 6] and document_url:
        try:
            # Download the edited document from OnlyOffice
            logger.info(f"Downloading document from OnlyOffice: {document_url}")

            content = None
            download_auth = None

            # Check if URL is from Nextcloud (requires authentication)
            if settings.NEXTCLOUD_URL in document_url:
                # Extract username from URL and get their credentials
                import re
                match = re.search(r'/files/([^/]+)/', document_url)
                if match:
                    nc_username = match.group(1)
                    from services.nextcloud_credentials_service import get_nextcloud_credentials_service
                    cred_service = get_nextcloud_credentials_service()

                    # Get credentials by username
                    try:
                        db_config = {
                            'host': settings.ERP_DB_HOST,
                            'port': settings.ERP_DB_PORT,
                            'database': settings.ERP_DB_NAME,
                            'user': settings.ERP_DB_USER,
                            'password': settings.ERP_DB_PASSWORD,
                        }
                        conn = psycopg2.connect(**db_config)
                        cur = conn.cursor()
                        cur.execute("""
                            SELECT app_password FROM workspace.nextcloud_credentials
                            WHERE nextcloud_username = %s AND is_active = true
                        """, (nc_username,))
                        row = cur.fetchone()
                        cur.close()
                        conn.close()
                        if row:
                            download_auth = aiohttp.BasicAuth(nc_username, row[0])
                            logger.info(f"Using credentials for Nextcloud download: {nc_username}")
                    except Exception as e:
                        logger.warning(f"Could not get credentials for download: {e}")

            async with aiohttp.ClientSession() as session:
                async with session.get(document_url, ssl=False, auth=download_auth) as response:
                    if response.status == 200:
                        content = await response.read()
                        logger.info(f"Downloaded {len(content)} bytes from OnlyOffice")

                        # Get current document info
                        doc = await service.get_document(document_id)
                        if not doc:
                            logger.error(f"Document {document_id} not found")
                            return {"error": 1}

                        storage_path = doc.get('storage_path')
                        if not storage_path:
                            logger.error(f"Document {document_id} has no storage_path")
                            return {"error": 1}

                        # Upload to Nextcloud via WebDAV using user's own credentials
                        try:
                            import httpx
                            from services.nextcloud_credentials_service import get_nextcloud_credentials_service

                            # Nextcloud settings
                            nextcloud_url = settings.NEXTCLOUD_URL
                            admin_user = settings.NEXTCLOUD_ADMIN_USER
                            admin_pass = settings.NEXTCLOUD_ADMIN_PASSWORD

                            # Get the document owner's credentials
                            created_by = doc.get('created_by')
                            storage_user = admin_user
                            auth_user = admin_user
                            auth_pass = admin_pass

                            if created_by:
                                # Try to get user's Nextcloud credentials
                                cred_service = get_nextcloud_credentials_service()
                                user_creds = await cred_service.get_user_credentials(UUID(str(created_by)))

                                if user_creds:
                                    storage_user = user_creds['nextcloud_username']
                                    auth_user = user_creds['nextcloud_username']
                                    auth_pass = user_creds['app_password']
                                    logger.info(f"Using user credentials for save: {storage_user}")
                                else:
                                    # Try to get user's email and create credentials
                                    try:
                                        db_config = {
                                            'host': settings.ERP_DB_HOST,
                                            'port': settings.ERP_DB_PORT,
                                            'database': settings.ERP_DB_NAME,
                                            'user': settings.ERP_DB_USER,
                                            'password': settings.ERP_DB_PASSWORD,
                                        }
                                        conn = psycopg2.connect(**db_config)
                                        cur = conn.cursor()
                                        cur.execute("SELECT email FROM auth.users WHERE id = %s", (str(created_by),))
                                        row = cur.fetchone()
                                        if row and row[0]:
                                            user_email = row[0].lower()
                                            # Create credentials on-the-fly
                                            user_creds = await cred_service.ensure_user_credentials(
                                                UUID(str(created_by)), user_email, None
                                            )
                                            if user_creds:
                                                storage_user = user_creds['nextcloud_username']
                                                auth_user = user_creds['nextcloud_username']
                                                auth_pass = user_creds['app_password']
                                                logger.info(f"Created and using user credentials: {storage_user}")
                                        cur.close()
                                        conn.close()
                                    except Exception as e:
                                        logger.warning(f"Could not create user credentials: {e}")

                            # Build WebDAV URL for user's folder
                            webdav_url = f"{nextcloud_url}/remote.php/dav/files/{storage_user}{storage_path}"

                            # First, ensure the parent folder exists
                            parent_path = '/'.join(storage_path.split('/')[:-1])
                            if parent_path:
                                async with httpx.AsyncClient(verify=False, timeout=30.0) as client:
                                    # Create folder hierarchy in user's folder
                                    parts = parent_path.strip('/').split('/')
                                    current_path = ""
                                    for part in parts:
                                        if not part:
                                            continue
                                        current_path = f"{current_path}/{part}"
                                        folder_url = f"{nextcloud_url}/remote.php/dav/files/{storage_user}{current_path}"
                                        try:
                                            response = await client.request(
                                                method="MKCOL",
                                                url=folder_url,
                                                auth=(auth_user, auth_pass)
                                            )
                                            if response.status_code in [201, 204]:
                                                logger.info(f"Created folder during save: {current_path}")
                                        except Exception as e:
                                            logger.debug(f"Folder creation during save: {e}")

                            # Upload to user's Nextcloud folder with their credentials
                            async with httpx.AsyncClient(verify=False, timeout=120.0) as client:
                                response = await client.put(
                                    url=webdav_url,
                                    content=content,
                                    auth=(auth_user, auth_pass),
                                    headers={
                                        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                    }
                                )

                                if response.status_code not in [201, 204]:
                                    logger.error(f"Failed to save to Nextcloud: {response.status_code} {response.text}")
                                    return {"error": 1}

                            logger.info(f"Saved document {document_id} to Nextcloud ({storage_user}): {storage_path}")

                            # Update document metadata in database
                            try:
                                db_config = {
                                    'host': settings.ERP_DB_HOST,
                                    'port': settings.ERP_DB_PORT,
                                    'database': settings.ERP_DB_NAME,
                                    'user': settings.ERP_DB_USER,
                                    'password': settings.ERP_DB_PASSWORD,
                                }
                                conn = psycopg2.connect(**db_config)
                                cur = conn.cursor()

                                # Update file size and timestamp
                                cur.execute("""
                                    UPDATE dms.documents
                                    SET file_size = %s, updated_at = NOW()
                                    WHERE id = %s
                                """, (len(content), document_id))

                                conn.commit()
                                cur.close()
                                conn.close()
                                logger.info(f"Updated document metadata for {document_id}")
                            except Exception as db_error:
                                logger.warning(f"Failed to update document metadata: {db_error}")

                            return {"error": 0}

                        except Exception as nc_error:
                            logger.error(f"Failed to save to Nextcloud: {nc_error}")
                            return {"error": 1}
                    else:
                        logger.error(f"Failed to download from OnlyOffice: status {response.status}")
                        return {"error": 1}

        except Exception as e:
            logger.error(f"Failed to save OnlyOffice document {document_id}: {e}")
            import traceback
            traceback.print_exc()
            return {"error": 1}

    # Status 1 means document is being edited - just acknowledge
    if status == 1:
        logger.info(f"Document {document_id} is being edited by {users}")
        return {"error": 0}

    # Status 4 means document was closed without changes
    if status == 4:
        logger.info(f"Document {document_id} was closed without changes")
        return {"error": 0}

    return {"error": 0}


# =============================================================================
# DOCUMENT SHARING ENDPOINTS
# =============================================================================

class DocShareSettings(BaseModel):
    """Share settings for document"""
    access_level: str = "view"  # view, comment, edit
    link_permission: str = "restricted"  # restricted, anyone_with_link
    invites: Optional[List[dict]] = None  # List of {email, permission, send_notification}


@router.post("/documents/{document_id}/share")
async def share_document(
    document_id: str,
    data: DocShareSettings,
    service: DocsDocumentService = Depends(get_document_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Share a document with other users.
    Sends email notifications to invited users.
    """
    import psycopg2
    from psycopg2.extras import RealDictCursor
    from core.config import settings
    import uuid
    import logging

    # Import NotifyClient for sending emails
    notify_client = None
    try:
        from integrations.notify.notify_client import NotifyClient
        notify_client = NotifyClient()
    except ImportError as e:
        logging.warning(f"NotifyClient not available: {e}")

    logger = logging.getLogger(__name__)

    user_id = current_user.get('id')
    user_name = current_user.get('name') or current_user.get('email') or 'A user'

    # Get document
    doc = await service.get_document(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    doc_title = doc.get('title', 'Untitled Document')

    # Process invites
    shares_created = []
    emails_sent = []
    email_errors = []

    if data.invites:
        db_config = {
            'host': settings.ERP_DB_HOST,
            'port': settings.ERP_DB_PORT,
            'database': settings.ERP_DB_NAME,
            'user': settings.ERP_DB_USER,
            'password': settings.ERP_DB_PASSWORD,
        }

        conn = psycopg2.connect(**db_config)
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            for invite in data.invites:
                email = invite.get('email')
                permission = invite.get('permission', 'view')
                send_notification = invite.get('send_notification', True)

                if not email:
                    continue

                share_id = str(uuid.uuid4())

                # Create share record
                cur.execute("""
                    INSERT INTO dms.document_shares (
                        id, document_id, shared_with_email, permission,
                        shared_by, created_at
                    ) VALUES (%s, %s, %s, %s, %s, NOW())
                    ON CONFLICT (document_id, shared_with_email)
                    DO UPDATE SET permission = EXCLUDED.permission, updated_at = NOW()
                    RETURNING id
                """, (share_id, document_id, email, permission, user_id))

                shares_created.append({"email": email, "permission": permission})

                # Send email notification using NotifyClient
                if send_notification and notify_client:
                    try:
                        doc_url = f"{settings.WORKSPACE_URL}/docs/editor/{document_id}"
                        html_body = f"""
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <style>
                                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }}
                                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                                .header {{ background: linear-gradient(135deg, #4285f4, #34a853); padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }}
                                .header h1 {{ color: white; margin: 0; font-size: 24px; }}
                                .content {{ background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }}
                                .doc-card {{ background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin: 20px 0; }}
                                .doc-title {{ font-size: 18px; font-weight: 600; color: #202124; margin-bottom: 8px; }}
                                .permission {{ display: inline-block; background: #e8f0fe; color: #1967d2; padding: 4px 12px; border-radius: 16px; font-size: 14px; }}
                                .button {{ display: inline-block; background: #4285f4; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 500; margin-top: 20px; }}
                                .button:hover {{ background: #3367d6; }}
                                .footer {{ text-align: center; padding: 20px; color: #666; font-size: 12px; }}
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <div class="header">
                                    <h1>Bheem Docs</h1>
                                </div>
                                <div class="content">
                                    <h2>{user_name} shared a document with you</h2>
                                    <div class="doc-card">
                                        <div class="doc-title">{doc_title}</div>
                                        <span class="permission">{permission.capitalize()} access</span>
                                    </div>
                                    <p>You can now access this document and collaborate with the team.</p>
                                    <a href="{doc_url}" class="button">Open Document</a>
                                </div>
                                <div class="footer">
                                    <p>This email was sent by Bheem Workspace</p>
                                </div>
                            </div>
                        </body>
                        </html>
                        """

                        text_body = f"""
{user_name} shared a document with you

Document: {doc_title}
Permission: {permission.capitalize()} access

Open the document: {doc_url}

This email was sent by Bheem Workspace
                        """

                        await notify_client.send_email(
                            to=email,
                            subject=f"{user_name} shared \"{doc_title}\" with you",
                            html_body=html_body,
                            text_body=text_body,
                            from_name="Bheem Docs"
                        )
                        emails_sent.append(email)
                        logger.info(f"Share notification sent to {email} for document {document_id}")
                    except Exception as e:
                        logger.error(f"Failed to send share notification to {email}: {e}")
                        email_errors.append({"email": email, "error": str(e)})

            conn.commit()

        except Exception as e:
            conn.rollback()
            logger.error(f"Failed to create shares for document {document_id}: {e}")
            raise HTTPException(status_code=500, detail=str(e))
        finally:
            cur.close()
            conn.close()

    return {
        "success": True,
        "shares_created": shares_created,
        "emails_sent": emails_sent,
        "email_errors": email_errors,
        "document_id": document_id
    }


@router.get("/documents/{document_id}/shares")
async def get_document_shares(
    document_id: str,
    service: DocsDocumentService = Depends(get_document_service),
    current_user: dict = Depends(get_current_user)
):
    """Get list of users a document is shared with."""
    import psycopg2
    from psycopg2.extras import RealDictCursor
    from core.config import settings

    db_config = {
        'host': settings.ERP_DB_HOST,
        'port': settings.ERP_DB_PORT,
        'database': settings.ERP_DB_NAME,
        'user': settings.ERP_DB_USER,
        'password': settings.ERP_DB_PASSWORD,
    }

    conn = psycopg2.connect(**db_config)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        cur.execute("""
            SELECT id, shared_with_email as email, permission, created_at
            FROM dms.document_shares
            WHERE document_id = %s
            ORDER BY created_at DESC
        """, (document_id,))

        shares = cur.fetchall()
        return {"shares": [dict(s) for s in shares]}

    except Exception as e:
        return {"shares": [], "error": str(e)}
    finally:
        cur.close()
        conn.close()


# =============================================================================
# DOCUMENT VERSION HISTORY
# =============================================================================

@router.get("/documents/{document_id}/versions")
async def get_document_versions(
    document_id: str,
    service: DocsDocumentService = Depends(get_document_service),
    current_user: dict = Depends(get_current_user)
):
    """Get version history for a document."""
    import psycopg2
    from psycopg2.extras import RealDictCursor
    from core.config import settings

    db_config = {
        'host': settings.ERP_DB_HOST,
        'port': settings.ERP_DB_PORT,
        'database': settings.ERP_DB_NAME,
        'user': settings.ERP_DB_USER,
        'password': settings.ERP_DB_PASSWORD,
    }

    conn = psycopg2.connect(**db_config)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # Get document info with creator details
        cur.execute("""
            SELECT d.id, d.title, d.current_version, d.created_at, d.updated_at, d.created_by,
                   d.file_size,
                   u.id as user_id, u.username as user_name, u.email as user_email
            FROM dms.documents d
            LEFT JOIN public.users u ON d.created_by::text = u.id::text
            WHERE d.id = %s AND d.is_active = true
        """, (document_id,))

        doc = cur.fetchone()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        # Get versions from versions table if it exists
        cur.execute("""
            SELECT
                v.id, v.version_number, v.title, v.created_at,
                v.file_size as size_bytes, v.created_by,
                v.version_number = d.current_version as is_current,
                u.id as user_id, u.username as user_name, u.email as user_email
            FROM dms.document_versions v
            JOIN dms.documents d ON d.id = v.document_id
            LEFT JOIN public.users u ON v.created_by::text = u.id::text
            WHERE v.document_id = %s
            ORDER BY v.version_number DESC
        """, (document_id,))

        versions = cur.fetchall()

        # If no versions, create a virtual "current" version using document info
        if not versions:
            user_name = doc.get('user_name') or current_user.get('name') or current_user.get('email') or 'User'
            versions = [{
                "id": str(doc['id']),
                "version_number": doc['current_version'] or 1,
                "title": "Current version",
                "created_at": str(doc['updated_at'] or doc['created_at']),
                "size_bytes": doc.get('file_size') or 0,
                "is_current": True,
                "is_auto_save": False,
                "user": {
                    "id": str(doc.get('user_id') or current_user.get('id') or 'unknown'),
                    "name": user_name,
                    "avatar": None
                }
            }]
        else:
            # Add user info to each version
            formatted_versions = []
            for v in versions:
                v_dict = dict(v)
                v_dict['user'] = {
                    "id": str(v_dict.pop('user_id', '') or 'unknown'),
                    "name": v_dict.pop('user_name', None) or v_dict.pop('user_email', None) or 'User',
                    "avatar": None
                }
                v_dict['is_auto_save'] = False
                # Convert datetime to string if needed
                if v_dict.get('created_at'):
                    v_dict['created_at'] = str(v_dict['created_at'])
                formatted_versions.append(v_dict)
            versions = formatted_versions

        return {"versions": versions}

    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.error(f"Error fetching versions for document {document_id}: {e}")
        # Return a basic version on error
        return {"versions": [{
            "id": document_id,
            "version_number": 1,
            "title": "Current version",
            "created_at": str(datetime.now()),
            "size_bytes": 0,
            "is_current": True,
            "is_auto_save": False,
            "user": {
                "id": current_user.get('id', 'unknown'),
                "name": current_user.get('name') or current_user.get('email') or 'User',
                "avatar": None
            }
        }]}
    finally:
        cur.close()
        conn.close()


# =============================================================================
# DOCUMENT TITLE UPDATE
# =============================================================================

@router.patch("/documents/{document_id}")
async def update_document_metadata(
    document_id: str,
    updates: dict,
    service: DocsDocumentService = Depends(get_document_service),
    current_user: dict = Depends(get_current_user)
):
    """Update document metadata (title, description, etc.)."""
    import psycopg2
    from psycopg2.extras import RealDictCursor
    from core.config import settings

    db_config = {
        'host': settings.ERP_DB_HOST,
        'port': settings.ERP_DB_PORT,
        'database': settings.ERP_DB_NAME,
        'user': settings.ERP_DB_USER,
        'password': settings.ERP_DB_PASSWORD,
    }

    conn = psycopg2.connect(**db_config)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # Build update query
        set_clauses = []
        params = []

        if 'title' in updates:
            set_clauses.append("title = %s")
            params.append(updates['title'])
            # Also update file_name if it's a Word doc
            set_clauses.append("file_name = %s")
            params.append(f"{updates['title']}.docx")

        if 'description' in updates:
            set_clauses.append("description = %s")
            params.append(updates['description'])

        if 'is_favorite' in updates:
            set_clauses.append("is_starred = %s")
            params.append(updates['is_favorite'])

        if not set_clauses:
            return {"success": True, "message": "No updates provided"}

        set_clauses.append("updated_at = NOW()")
        params.append(document_id)

        query = f"""
            UPDATE dms.documents
            SET {', '.join(set_clauses)}
            WHERE id = %s
            RETURNING id, title, description, updated_at
        """

        cur.execute(query, params)
        row = cur.fetchone()
        conn.commit()

        if not row:
            raise HTTPException(status_code=404, detail="Document not found")

        return {
            "success": True,
            "document": dict(row)
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()
