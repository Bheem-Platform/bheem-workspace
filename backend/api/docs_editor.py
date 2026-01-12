"""
Bheem Docs - Editor & Templates API
====================================
Endpoints for Tiptap editor operations, templates, and document export.

Features:
- Rich text document creation and editing
- Document templates
- Export to PDF, DOCX, HTML, Markdown
- Collaboration session management
- User presence tracking
"""

from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import io
import json

from core.security import get_current_user
from services.docs_template_service import (
    get_docs_template_service,
    DocsTemplateService
)
from services.docs_export_service import (
    get_docs_export_service,
    DocsExportService
)
from services.docs_editor_service import (
    get_docs_editor_service,
    DocsEditorService
)

router = APIRouter(prefix="/docs/editor", tags=["Bheem Docs Editor"])


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class TiptapContent(BaseModel):
    """Tiptap JSON content structure"""
    type: str = "doc"
    content: List[dict] = []


class CreateEditableDocumentRequest(BaseModel):
    """Request to create a new editable document"""
    title: str = Field(..., min_length=1, max_length=255)
    content: Optional[TiptapContent] = None
    template_id: Optional[str] = None
    folder_id: Optional[str] = None
    document_type: str = "OTHER"
    description: Optional[str] = None


class SaveContentRequest(BaseModel):
    """Request to save document content"""
    content: TiptapContent
    create_version: bool = False


class CreateTemplateRequest(BaseModel):
    """Request to create a template"""
    name: str = Field(..., min_length=1, max_length=255)
    content: TiptapContent
    description: Optional[str] = None
    category: Optional[str] = None
    is_public: bool = False
    thumbnail_url: Optional[str] = None


class UpdateTemplateRequest(BaseModel):
    """Request to update a template"""
    name: Optional[str] = None
    content: Optional[TiptapContent] = None
    description: Optional[str] = None
    category: Optional[str] = None
    is_public: Optional[bool] = None
    thumbnail_url: Optional[str] = None


class UpdatePresenceRequest(BaseModel):
    """Request to update user presence"""
    cursor_position: Optional[dict] = None
    selection: Optional[dict] = None


class ExportRequest(BaseModel):
    """Request to export document"""
    format: str = Field(..., pattern="^(pdf|docx|html|md)$")
    include_header: bool = True


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_template_service() -> DocsTemplateService:
    return get_docs_template_service()


def get_export_service() -> DocsExportService:
    return get_docs_export_service()


def get_editor_service() -> DocsEditorService:
    return get_docs_editor_service()


def get_user_company_id(user: dict) -> Optional[UUID]:
    company_id = user.get('company_id') or user.get('erp_company_id')
    return UUID(company_id) if company_id else None


def get_user_tenant_id(user: dict) -> Optional[UUID]:
    tenant_id = user.get('tenant_id')
    return UUID(tenant_id) if tenant_id else None


# =============================================================================
# TEMPLATE ENDPOINTS
# =============================================================================

@router.get("/templates")
async def list_templates(
    category: Optional[str] = Query(None, description="Filter by category"),
    include_public: bool = Query(True, description="Include public templates"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    service: DocsTemplateService = Depends(get_template_service),
    current_user: dict = Depends(get_current_user)
):
    """
    List available document templates.

    Returns templates based on user's access:
    - Global public templates
    - Company templates (for internal users)
    - Tenant templates (for external users)
    """
    company_id = get_user_company_id(current_user)
    tenant_id = get_user_tenant_id(current_user)

    templates = await service.list_templates(
        category=category,
        company_id=company_id,
        tenant_id=tenant_id,
        include_public=include_public,
        limit=limit,
        offset=offset
    )

    return {
        "templates": templates,
        "total": len(templates),
        "limit": limit,
        "offset": offset
    }


@router.get("/templates/categories")
async def list_template_categories(
    service: DocsTemplateService = Depends(get_template_service),
    current_user: dict = Depends(get_current_user)
):
    """Get list of available template categories."""
    company_id = get_user_company_id(current_user)
    tenant_id = get_user_tenant_id(current_user)

    categories = await service.list_categories(
        company_id=company_id,
        tenant_id=tenant_id
    )

    return {"categories": categories}


@router.get("/templates/{template_id}")
async def get_template(
    template_id: str,
    service: DocsTemplateService = Depends(get_template_service),
    current_user: dict = Depends(get_current_user)
):
    """Get a template by ID."""
    company_id = get_user_company_id(current_user)
    tenant_id = get_user_tenant_id(current_user)

    template = await service.get_template(
        template_id,
        company_id=company_id,
        tenant_id=tenant_id
    )

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    return template


@router.post("/templates")
async def create_template(
    request: CreateTemplateRequest,
    service: DocsTemplateService = Depends(get_template_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new document template.

    Templates can be:
    - Public (accessible to everyone)
    - Company-specific (internal users)
    - Tenant-specific (external users)
    """
    user_id = UUID(current_user['id'])
    company_id = get_user_company_id(current_user)
    tenant_id = get_user_tenant_id(current_user)

    # Only admins can create public templates
    if request.is_public and current_user.get('role') not in ['ADMIN', 'SUPER_ADMIN']:
        raise HTTPException(
            status_code=403,
            detail="Only admins can create public templates"
        )

    try:
        template = await service.create_template(
            name=request.name,
            content=request.content.model_dump(),
            created_by=user_id,
            description=request.description,
            category=request.category,
            is_public=request.is_public,
            company_id=company_id if not request.is_public else None,
            tenant_id=tenant_id if not request.is_public else None,
            thumbnail_url=request.thumbnail_url
        )

        return template

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/templates/{template_id}")
async def update_template(
    template_id: str,
    request: UpdateTemplateRequest,
    service: DocsTemplateService = Depends(get_template_service),
    current_user: dict = Depends(get_current_user)
):
    """Update an existing template."""
    user_id = UUID(current_user['id'])

    # Check if it's a default template (can't be edited)
    if template_id.startswith('default_'):
        raise HTTPException(
            status_code=400,
            detail="Default templates cannot be modified"
        )

    try:
        template = await service.update_template(
            template_id=UUID(template_id),
            updated_by=user_id,
            name=request.name,
            content=request.content.model_dump() if request.content else None,
            description=request.description,
            category=request.category,
            is_public=request.is_public,
            thumbnail_url=request.thumbnail_url
        )

        if not template:
            raise HTTPException(status_code=404, detail="Template not found")

        return template

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: str,
    service: DocsTemplateService = Depends(get_template_service),
    current_user: dict = Depends(get_current_user)
):
    """Delete a template."""
    user_id = UUID(current_user['id'])

    if template_id.startswith('default_'):
        raise HTTPException(
            status_code=400,
            detail="Default templates cannot be deleted"
        )

    success = await service.delete_template(
        template_id=UUID(template_id),
        deleted_by=user_id
    )

    if not success:
        raise HTTPException(status_code=404, detail="Template not found")

    return {"deleted": True}


# =============================================================================
# EDITABLE DOCUMENT ENDPOINTS
# =============================================================================

@router.post("/documents")
async def create_editable_document(
    request: CreateEditableDocumentRequest,
    template_service: DocsTemplateService = Depends(get_template_service),
    editor_service: DocsEditorService = Depends(get_editor_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new editable document.

    Can be created from:
    - Scratch (blank or with provided content)
    - A template (use template_id)
    """
    user_id = UUID(current_user['id'])
    company_id = get_user_company_id(current_user)
    tenant_id = get_user_tenant_id(current_user)

    # Determine content
    if request.template_id:
        # Create from template
        template_data = await template_service.create_document_from_template(
            template_id=request.template_id,
            title=request.title,
            company_id=company_id,
            tenant_id=tenant_id
        )
        content = template_data['content']
    elif request.content:
        content = request.content.model_dump()
    else:
        # Blank document
        content = {"type": "doc", "content": [{"type": "paragraph"}]}

    try:
        document = await editor_service.create_editable_document(
            title=request.title,
            content=content,
            created_by=user_id,
            company_id=company_id,
            tenant_id=tenant_id,
            folder_id=UUID(request.folder_id) if request.folder_id else None,
            document_type=request.document_type,
            description=request.description
        )

        return document

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/documents/{document_id}")
async def get_editor_content(
    document_id: str,
    service: DocsEditorService = Depends(get_editor_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Get document content for editing.

    Returns:
    - Document metadata
    - Tiptap JSON content
    - Collaboration session info
    - Active collaborators
    """
    user_id = UUID(current_user['id'])

    document = await service.get_editor_content(
        document_id=UUID(document_id),
        user_id=user_id
    )

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    return document


@router.put("/documents/{document_id}/content")
async def save_editor_content(
    document_id: str,
    request: SaveContentRequest,
    service: DocsEditorService = Depends(get_editor_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Save document content.

    Automatically:
    - Converts Tiptap JSON to HTML for search indexing
    - Updates last_edited_by and last_edited_at
    - Optionally creates a new version
    """
    user_id = UUID(current_user['id'])

    try:
        result = await service.save_editor_content(
            document_id=UUID(document_id),
            content=request.content.model_dump(),
            user_id=user_id,
            create_version=request.create_version
        )

        return result

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/documents/{document_id}/download-url")
async def get_download_url(
    document_id: str,
    service: DocsEditorService = Depends(get_editor_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Get a presigned download URL for an uploaded file.
    """
    from services.docs_document_service import DocsDocumentService

    doc_service = DocsDocumentService()
    url = await doc_service.get_presigned_url(document_id)

    if not url:
        raise HTTPException(status_code=404, detail="File not found or no storage path")

    return {"url": url}


@router.get("/documents/{document_id}/file-content")
async def get_file_content(
    document_id: str,
    service: DocsEditorService = Depends(get_editor_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Get the text content of an uploaded file (for text/csv/json files).
    """
    from services.docs_document_service import DocsDocumentService
    import boto3
    from core.config import settings

    doc_service = DocsDocumentService()
    doc = await doc_service.get_document(document_id)

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Check if it's a text file
    mime_type = doc.get('mime_type', '')
    if not (mime_type.startswith('text/') or mime_type in ['application/json', 'application/xml']):
        raise HTTPException(status_code=400, detail="File is not a text file")

    storage_path = doc.get('storage_path')
    if not storage_path:
        raise HTTPException(status_code=404, detail="No file stored")

    try:
        # Fetch from S3
        s3 = boto3.client(
            's3',
            endpoint_url=settings.S3_ENDPOINT,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            region_name=settings.S3_REGION
        )

        response = s3.get_object(
            Bucket=doc.get('storage_bucket', settings.S3_BUCKET),
            Key=storage_path
        )

        content = response['Body'].read().decode('utf-8')
        return {"content": content}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {str(e)}")


# =============================================================================
# COLLABORATION ENDPOINTS
# =============================================================================

@router.post("/documents/{document_id}/session/join")
async def join_session(
    document_id: str,
    service: DocsEditorService = Depends(get_editor_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Join a collaboration session for a document.

    Returns session info and websocket details for real-time sync.
    """
    user_id = UUID(current_user['id'])

    session = await service.get_or_create_session(
        document_id=UUID(document_id),
        user_id=user_id
    )

    # Get current collaborators
    collaborators = await service.get_presence(UUID(document_id))

    return {
        "session": session,
        "collaborators": collaborators,
        "websocket_url": f"wss://workspace.bheem.cloud/docs/collab/{document_id}"
    }


@router.post("/documents/{document_id}/session/leave")
async def leave_session(
    document_id: str,
    service: DocsEditorService = Depends(get_editor_service),
    current_user: dict = Depends(get_current_user)
):
    """Leave a collaboration session."""
    user_id = UUID(current_user['id'])

    await service.leave_session(
        document_id=UUID(document_id),
        user_id=user_id
    )

    return {"left": True}


@router.put("/documents/{document_id}/presence")
async def update_presence(
    document_id: str,
    request: UpdatePresenceRequest,
    service: DocsEditorService = Depends(get_editor_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Update user presence (cursor position, selection).

    Called periodically by the editor to show other users' cursors.
    """
    user_id = UUID(current_user['id'])
    user_name = current_user.get('name', current_user.get('email', 'Anonymous'))
    user_avatar = current_user.get('avatar')

    presence = await service.update_presence(
        document_id=UUID(document_id),
        user_id=user_id,
        user_name=user_name,
        cursor_position=request.cursor_position,
        selection=request.selection,
        user_avatar=user_avatar
    )

    return presence


@router.get("/documents/{document_id}/presence")
async def get_presence(
    document_id: str,
    service: DocsEditorService = Depends(get_editor_service),
    current_user: dict = Depends(get_current_user)
):
    """Get all active users in a document."""
    users = await service.get_presence(UUID(document_id))
    return {"users": users}


# =============================================================================
# VERSION HISTORY ENDPOINTS
# =============================================================================

@router.get("/documents/{document_id}/versions/{version_number}/content")
async def get_version_content(
    document_id: str,
    version_number: int,
    service: DocsEditorService = Depends(get_editor_service),
    current_user: dict = Depends(get_current_user)
):
    """Get editor content for a specific version."""
    version = await service.get_version_content(
        document_id=UUID(document_id),
        version_number=version_number
    )

    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    return version


@router.post("/documents/{document_id}/versions/{version_number}/restore")
async def restore_version(
    document_id: str,
    version_number: int,
    service: DocsEditorService = Depends(get_editor_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Restore document to a previous version.

    Saves current state as a new version before restoring.
    """
    user_id = UUID(current_user['id'])

    try:
        result = await service.restore_version(
            document_id=UUID(document_id),
            version_number=version_number,
            user_id=user_id
        )

        return result

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# =============================================================================
# EXPORT ENDPOINTS
# =============================================================================

@router.post("/documents/{document_id}/export")
async def export_document(
    document_id: str,
    request: ExportRequest,
    editor_service: DocsEditorService = Depends(get_editor_service),
    export_service: DocsExportService = Depends(get_export_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Export document to specified format.

    Supported formats:
    - pdf: Adobe PDF
    - docx: Microsoft Word
    - html: Standalone HTML
    - md: Markdown
    """
    user_id = UUID(current_user['id'])

    # Get document content
    document = await editor_service.get_editor_content(
        document_id=UUID(document_id),
        user_id=user_id
    )

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    content = document.get('editor_content')
    title = document.get('title', 'Untitled')

    if not content:
        raise HTTPException(
            status_code=400,
            detail="Document has no editable content"
        )

    # Parse content if it's a string
    if isinstance(content, str):
        content = json.loads(content)

    try:
        if request.format == 'pdf':
            data = await export_service.export_to_pdf(
                content=content,
                title=title,
                include_header=request.include_header
            )
            media_type = 'application/pdf'
            filename = f"{title}.pdf"

        elif request.format == 'docx':
            data = await export_service.export_to_docx(
                content=content,
                title=title
            )
            media_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            filename = f"{title}.docx"

        elif request.format == 'html':
            data = await export_service.export_to_html(
                content=content,
                title=title,
                include_styles=True
            )
            data = data.encode('utf-8')
            media_type = 'text/html'
            filename = f"{title}.html"

        elif request.format == 'md':
            data = await export_service.export_to_markdown(
                content=content,
                title=title,
                include_frontmatter=True
            )
            data = data.encode('utf-8')
            media_type = 'text/markdown'
            filename = f"{title}.md"

        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported format: {request.format}"
            )

        # Log export
        await export_service.log_export(
            document_id=UUID(document_id),
            format=request.format,
            exported_by=user_id,
            file_size=len(data)
        )

        return StreamingResponse(
            io.BytesIO(data),
            media_type=media_type,
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"'
            }
        )

    except ImportError as e:
        raise HTTPException(
            status_code=501,
            detail=f"Export format not supported: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/documents/{document_id}/export/preview")
async def preview_export(
    document_id: str,
    format: str = Query(..., pattern="^(html|md)$"),
    editor_service: DocsEditorService = Depends(get_editor_service),
    export_service: DocsExportService = Depends(get_export_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Preview export in HTML or Markdown format.

    Returns the converted content without downloading.
    """
    user_id = UUID(current_user['id'])

    document = await editor_service.get_editor_content(
        document_id=UUID(document_id),
        user_id=user_id
    )

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    content = document.get('editor_content')
    title = document.get('title', 'Untitled')

    if not content:
        raise HTTPException(status_code=400, detail="No editable content")

    if isinstance(content, str):
        content = json.loads(content)

    if format == 'html':
        result = await export_service.export_to_html(
            content=content,
            title=title,
            include_styles=True
        )
    else:
        result = await export_service.export_to_markdown(
            content=content,
            title=title
        )

    return {
        "format": format,
        "content": result
    }


@router.get("/documents/{document_id}/export/history")
async def get_export_history(
    document_id: str,
    limit: int = Query(20, ge=1, le=100),
    export_service: DocsExportService = Depends(get_export_service),
    current_user: dict = Depends(get_current_user)
):
    """Get export history for a document."""
    history = await export_service.get_export_history(
        document_id=UUID(document_id),
        limit=limit
    )

    return {"exports": history}


# =============================================================================
# CONVERSION ENDPOINTS
# =============================================================================

@router.post("/convert/html-to-tiptap")
async def convert_html_to_tiptap(
    html: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Convert HTML to Tiptap JSON.

    Useful for importing content from other sources.
    """
    # Note: Full HTML to Tiptap conversion is complex and would need
    # a proper parser. This is a placeholder for the endpoint.
    raise HTTPException(
        status_code=501,
        detail="HTML to Tiptap conversion not yet implemented"
    )


@router.post("/convert/markdown-to-tiptap")
async def convert_markdown_to_tiptap(
    markdown: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Convert Markdown to Tiptap JSON.

    Useful for importing .md files.
    """
    # Note: Full Markdown to Tiptap conversion would need
    # a proper parser. This is a placeholder for the endpoint.
    raise HTTPException(
        status_code=501,
        detail="Markdown to Tiptap conversion not yet implemented"
    )
