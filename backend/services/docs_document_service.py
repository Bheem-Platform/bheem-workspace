"""
Bheem Docs - Document Service
==============================
Handles document CRUD operations using ERP DMS schema.
Supports both internal (ERP) and external (SaaS) document management.

DMS Schema Tables Used:
- dms.documents - Main document records
- dms.document_versions - Version history
- dms.document_access - Permissions
- dms.document_audit_logs - Activity tracking
- dms.entity_document_links - ERP entity relationships
"""

from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from enum import Enum
import mimetypes
import logging
import psycopg2
from psycopg2.extras import RealDictCursor

from core.config import settings
from services.docs_storage_service import get_docs_storage_service, DocsStorageService

logger = logging.getLogger(__name__)


class DocumentType(str, Enum):
    """Document types matching dms.documenttype enum"""
    GENERAL = "GENERAL"
    INVOICE = "INVOICE"
    PURCHASE_ORDER = "PURCHASE_ORDER"
    QUOTATION = "QUOTATION"
    CONTRACT = "CONTRACT"
    AGREEMENT = "AGREEMENT"
    REPORT = "REPORT"
    CERTIFICATE = "CERTIFICATE"
    ID_DOCUMENT = "ID_DOCUMENT"
    RECEIPT = "RECEIPT"
    DELIVERY_NOTE = "DELIVERY_NOTE"
    GRN = "GRN"
    POLICY = "POLICY"
    DRAWING = "DRAWING"
    SPECIFICATION = "SPECIFICATION"
    LETTER = "LETTER"
    MEMO = "MEMO"
    PRESENTATION = "PRESENTATION"
    SPREADSHEET = "SPREADSHEET"
    IMAGE = "IMAGE"
    OTHER = "OTHER"


class DocumentStatus(str, Enum):
    """Document status matching dms.documentstatus enum"""
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    UNDER_REVIEW = "UNDER_REVIEW"
    APPROVED = "APPROVED"
    ARCHIVED = "ARCHIVED"
    DELETED = "DELETED"


class AccessLevel(str, Enum):
    """Access levels matching dms.accesslevel enum"""
    VIEW = "VIEW"
    DOWNLOAD = "DOWNLOAD"
    EDIT = "EDIT"
    DELETE = "DELETE"
    SHARE = "SHARE"
    ADMIN = "ADMIN"


class AuditAction(str, Enum):
    """Audit actions matching dms.auditaction enum"""
    UPLOAD = "UPLOAD"
    VIEW = "VIEW"
    DOWNLOAD = "DOWNLOAD"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    RESTORE = "RESTORE"
    SHARE = "SHARE"
    UNSHARE = "UNSHARE"
    VERSION_CREATE = "VERSION_CREATE"
    VERSION_RESTORE = "VERSION_RESTORE"
    MOVE = "MOVE"
    RENAME = "RENAME"
    TAG_ADD = "TAG_ADD"
    TAG_REMOVE = "TAG_REMOVE"
    APPROVE = "APPROVE"
    REJECT = "REJECT"


class EntityType(str, Enum):
    """Entity types matching dms.entitytype enum"""
    CUSTOMER = "CUSTOMER"
    VENDOR = "VENDOR"
    EMPLOYEE = "EMPLOYEE"
    CANDIDATE = "CANDIDATE"
    SALES_ORDER = "SALES_ORDER"
    SALES_INVOICE = "SALES_INVOICE"
    SALES_QUOTE = "SALES_QUOTE"
    PURCHASE_ORDER = "PURCHASE_ORDER"
    PURCHASE_BILL = "PURCHASE_BILL"
    PURCHASE_REQUEST = "PURCHASE_REQUEST"
    GRN = "GRN"
    PROJECT = "PROJECT"
    TASK = "TASK"
    CRM_CONTACT = "CRM_CONTACT"
    CRM_LEAD = "CRM_LEAD"
    CRM_OPPORTUNITY = "CRM_OPPORTUNITY"
    EXPENSE = "EXPENSE"
    ASSET = "ASSET"
    JOURNAL_ENTRY = "JOURNAL_ENTRY"
    PAYMENT = "PAYMENT"
    COMPANY = "COMPANY"


class DocsDocumentService:
    """
    Document management service integrated with ERP DMS.

    Features:
    - CRUD operations for documents
    - Version control
    - Access control
    - Audit logging
    - Entity linking for ERP integration
    """

    def __init__(self):
        """Initialize with ERP database connection."""
        self.storage: DocsStorageService = get_docs_storage_service()
        self.db_config = {
            'host': settings.ERP_DB_HOST,
            'port': settings.ERP_DB_PORT,
            'database': settings.ERP_DB_NAME,
            'user': settings.ERP_DB_USER,
            'password': settings.ERP_DB_PASSWORD,
        }

    def _get_connection(self):
        """Get database connection."""
        return psycopg2.connect(**self.db_config)

    def _detect_document_type(self, filename: str, mime_type: str) -> str:
        """Auto-detect document type from filename/mime."""
        filename_lower = filename.lower()

        if 'invoice' in filename_lower:
            return DocumentType.INVOICE.value
        elif 'po' in filename_lower or 'purchase' in filename_lower:
            return DocumentType.PURCHASE_ORDER.value
        elif 'quote' in filename_lower or 'quotation' in filename_lower:
            return DocumentType.QUOTATION.value
        elif 'contract' in filename_lower:
            return DocumentType.CONTRACT.value
        elif 'report' in filename_lower:
            return DocumentType.REPORT.value
        elif 'certificate' in filename_lower or 'cert' in filename_lower:
            return DocumentType.CERTIFICATE.value
        elif mime_type.startswith('image/'):
            return DocumentType.IMAGE.value
        elif 'presentation' in mime_type or filename_lower.endswith(('.ppt', '.pptx')):
            return DocumentType.PRESENTATION.value
        elif 'spreadsheet' in mime_type or filename_lower.endswith(('.xls', '.xlsx', '.csv')):
            return DocumentType.SPREADSHEET.value

        return DocumentType.GENERAL.value

    async def create_document(
        self,
        title: str,
        file,
        filename: str,
        company_id: UUID,
        created_by: UUID,
        folder_id: Optional[UUID] = None,
        tenant_id: Optional[UUID] = None,
        document_type: Optional[str] = None,
        description: Optional[str] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[UUID] = None,
        tags: Optional[List[str]] = None,
        custom_metadata: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Create a new document with file upload.

        Args:
            title: Document title
            file: File object to upload
            filename: Original filename
            company_id: ERP company ID
            created_by: User ID creating the document
            folder_id: Optional folder to place document in
            tenant_id: SaaS tenant ID (for external mode)
            document_type: Type of document (auto-detected if not provided)
            description: Document description
            entity_type: ERP entity type to link
            entity_id: ERP entity ID to link
            tags: List of tags
            custom_metadata: Additional metadata

        Returns:
            Created document details
        """
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            # Get mime type and extension
            mime_type, _ = mimetypes.guess_type(filename)
            mime_type = mime_type or "application/octet-stream"
            extension = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''

            # Auto-detect document type if not provided
            if not document_type:
                document_type = self._detect_document_type(filename, mime_type)

            # Get folder path if folder_id provided
            folder_path = ""
            if folder_id:
                cur.execute(
                    "SELECT path FROM dms.folders WHERE id = %s",
                    (str(folder_id),)
                )
                folder_row = cur.fetchone()
                if folder_row:
                    folder_path = folder_row['path']

            # Upload file to storage
            storage_result = await self.storage.upload_file(
                file=file,
                filename=filename,
                company_id=company_id,
                tenant_id=tenant_id,
                folder_path=folder_path
            )

            # Determine if editable in Bheem Docs editor
            editable_mimes = ['text/plain', 'text/markdown', 'text/html', 'application/json']
            editable_exts = ['md', 'txt', 'html', 'json']
            is_editable = mime_type in editable_mimes or extension in editable_exts

            # Insert document record
            cur.execute("""
                INSERT INTO dms.documents (
                    title, description, document_type, status,
                    file_name, file_extension, file_size, mime_type,
                    storage_path, storage_bucket, folder_id,
                    company_id, tenant_id, entity_type, entity_id,
                    tags, custom_metadata, is_editable, checksum,
                    current_version, version_count,
                    created_by, created_at, updated_at, is_active
                ) VALUES (
                    %s, %s, %s::dms.documenttype, 'ACTIVE'::dms.documentstatus,
                    %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s::dms.entitytype, %s,
                    %s, %s, %s, %s,
                    1, 1,
                    %s, NOW(), NOW(), true
                )
                RETURNING id, title, file_name, storage_path, created_at
            """, (
                title, description, document_type,
                filename, extension, storage_result['file_size'], mime_type,
                storage_result['storage_path'], storage_result['storage_bucket'],
                str(folder_id) if folder_id else None,
                str(company_id), str(tenant_id) if tenant_id else None,
                entity_type, str(entity_id) if entity_id else None,
                tags or [], custom_metadata or {},
                is_editable, storage_result['checksum'],
                str(created_by)
            ))

            doc_row = cur.fetchone()
            document_id = doc_row['id']

            # Create initial version
            cur.execute("""
                INSERT INTO dms.document_versions (
                    document_id, version_number, file_name, file_size,
                    mime_type, storage_path, checksum, is_current,
                    uploaded_by, created_at
                ) VALUES (
                    %s, 1, %s, %s, %s, %s, %s, true, %s, NOW()
                )
            """, (
                str(document_id), filename, storage_result['file_size'],
                mime_type, storage_result['storage_path'],
                storage_result['checksum'], str(created_by)
            ))

            # Create entity link if entity provided
            if entity_type and entity_id:
                cur.execute("""
                    INSERT INTO dms.entity_document_links (
                        document_id, entity_type, entity_id, link_type,
                        created_by, created_at
                    ) VALUES (
                        %s, %s::dms.entitytype, %s, 'ATTACHMENT', %s, NOW()
                    )
                """, (str(document_id), entity_type, str(entity_id), str(created_by)))

            # Log audit
            await self._log_audit(
                conn, document_id, AuditAction.UPLOAD, created_by,
                details={'filename': filename, 'size': storage_result['file_size']}
            )

            conn.commit()

            logger.info(f"Created document: {document_id} - {title}")

            return {
                'id': str(document_id),
                'title': doc_row['title'],
                'file_name': doc_row['file_name'],
                'storage_path': doc_row['storage_path'],
                'file_size': storage_result['file_size'],
                'mime_type': mime_type,
                'document_type': document_type,
                'is_editable': is_editable,
                'created_at': doc_row['created_at'].isoformat()
            }

        except Exception as e:
            conn.rollback()
            logger.error(f"Failed to create document: {e}")
            raise
        finally:
            cur.close()
            conn.close()

    async def get_document(
        self,
        document_id: UUID,
        user_id: Optional[UUID] = None
    ) -> Optional[Dict[str, Any]]:
        """Get document by ID with full details."""
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            cur.execute("""
                SELECT
                    d.*,
                    f.name as folder_name,
                    f.path as folder_path
                FROM dms.documents d
                LEFT JOIN dms.folders f ON d.folder_id = f.id
                WHERE d.id = %s AND d.is_active = true AND d.deleted_at IS NULL
            """, (str(document_id),))

            row = cur.fetchone()
            if not row:
                return None

            # Log view if user provided
            if user_id:
                # Update view count
                cur.execute("""
                    UPDATE dms.documents SET
                        view_count = COALESCE(view_count, 0) + 1,
                        last_accessed_at = NOW(),
                        last_accessed_by = %s
                    WHERE id = %s
                """, (str(user_id), str(document_id)))

                await self._log_audit(conn, document_id, AuditAction.VIEW, user_id)
                conn.commit()

            return dict(row)

        finally:
            cur.close()
            conn.close()

    async def list_documents(
        self,
        company_id: UUID,
        folder_id: Optional[UUID] = None,
        tenant_id: Optional[UUID] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[UUID] = None,
        document_type: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        tags: Optional[List[str]] = None,
        limit: int = 50,
        offset: int = 0,
        order_by: str = "updated_at",
        order_dir: str = "DESC"
    ) -> Dict[str, Any]:
        """
        List documents with filtering and pagination.

        Returns:
            Dict with documents list and total count
        """
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            conditions = ["d.is_active = true", "d.deleted_at IS NULL"]
            params = []

            # Company filter
            conditions.append("d.company_id = %s")
            params.append(str(company_id))

            # Folder filter
            if folder_id:
                conditions.append("d.folder_id = %s")
                params.append(str(folder_id))
            else:
                conditions.append("d.folder_id IS NULL")

            # Tenant filter
            if tenant_id:
                conditions.append("d.tenant_id = %s")
                params.append(str(tenant_id))

            # Entity filter
            if entity_type and entity_id:
                conditions.append("""
                    EXISTS (
                        SELECT 1 FROM dms.entity_document_links edl
                        WHERE edl.document_id = d.id
                        AND edl.entity_type = %s::dms.entitytype
                        AND edl.entity_id = %s
                    )
                """)
                params.extend([entity_type, str(entity_id)])

            # Document type filter
            if document_type:
                conditions.append("d.document_type = %s::dms.documenttype")
                params.append(document_type)

            # Status filter
            if status:
                conditions.append("d.status = %s::dms.documentstatus")
                params.append(status)

            # Search filter (full-text)
            if search:
                conditions.append("""
                    (d.search_vector @@ plainto_tsquery('english', %s)
                     OR d.title ILIKE %s
                     OR d.file_name ILIKE %s)
                """)
                search_pattern = f"%{search}%"
                params.extend([search, search_pattern, search_pattern])

            # Tags filter
            if tags:
                conditions.append("d.tags && %s")
                params.append(tags)

            where_clause = " AND ".join(conditions)

            # Validate order_by to prevent SQL injection
            allowed_order = ['title', 'file_name', 'file_size', 'created_at', 'updated_at', 'document_type']
            if order_by not in allowed_order:
                order_by = 'updated_at'
            order_dir = 'DESC' if order_dir.upper() == 'DESC' else 'ASC'

            # Get total count
            cur.execute(f"""
                SELECT COUNT(*) as total
                FROM dms.documents d
                WHERE {where_clause}
            """, params)
            total = cur.fetchone()['total']

            # Get documents
            cur.execute(f"""
                SELECT
                    d.id, d.title, d.description, d.document_type, d.status,
                    d.file_name, d.file_extension, d.file_size, d.mime_type,
                    d.storage_path, d.current_version, d.is_editable,
                    d.tags, d.view_count, d.download_count,
                    d.created_at, d.updated_at, d.created_by,
                    d.has_thumbnail, d.thumbnail_path
                FROM dms.documents d
                WHERE {where_clause}
                ORDER BY d.{order_by} {order_dir}
                LIMIT %s OFFSET %s
            """, params + [limit, offset])

            documents = [dict(row) for row in cur.fetchall()]

            return {
                'documents': documents,
                'total': total,
                'limit': limit,
                'offset': offset,
                'has_more': (offset + len(documents)) < total
            }

        finally:
            cur.close()
            conn.close()

    async def update_document(
        self,
        document_id: UUID,
        updated_by: UUID,
        title: Optional[str] = None,
        description: Optional[str] = None,
        document_type: Optional[str] = None,
        status: Optional[str] = None,
        tags: Optional[List[str]] = None,
        custom_metadata: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Update document metadata."""
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            # Build update query dynamically
            updates = ["updated_at = NOW()", "updated_by = %s"]
            params = [str(updated_by)]

            if title is not None:
                updates.append("title = %s")
                params.append(title)
            if description is not None:
                updates.append("description = %s")
                params.append(description)
            if document_type is not None:
                updates.append("document_type = %s::dms.documenttype")
                params.append(document_type)
            if status is not None:
                updates.append("status = %s::dms.documentstatus")
                params.append(status)
            if tags is not None:
                updates.append("tags = %s")
                params.append(tags)
            if custom_metadata is not None:
                updates.append("custom_metadata = %s")
                params.append(custom_metadata)

            params.append(str(document_id))

            cur.execute(f"""
                UPDATE dms.documents SET {', '.join(updates)}
                WHERE id = %s AND is_active = true
                RETURNING id, title, updated_at
            """, params)

            row = cur.fetchone()
            if not row:
                raise ValueError(f"Document not found: {document_id}")

            await self._log_audit(conn, document_id, AuditAction.UPDATE, updated_by)
            conn.commit()

            return dict(row)

        except Exception as e:
            conn.rollback()
            raise
        finally:
            cur.close()
            conn.close()

    async def delete_document(
        self,
        document_id: UUID,
        deleted_by: UUID,
        hard_delete: bool = False
    ) -> bool:
        """
        Delete document (soft or hard delete).

        Args:
            document_id: Document to delete
            deleted_by: User performing deletion
            hard_delete: If True, permanently delete; otherwise soft delete
        """
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            if hard_delete:
                # Get storage path before deletion
                cur.execute(
                    "SELECT storage_path FROM dms.documents WHERE id = %s",
                    (str(document_id),)
                )
                row = cur.fetchone()
                if row:
                    # Delete from storage
                    await self.storage.delete_file(row['storage_path'])

                    # Delete versions from storage
                    cur.execute(
                        "SELECT storage_path FROM dms.document_versions WHERE document_id = %s",
                        (str(document_id),)
                    )
                    for version in cur.fetchall():
                        if version['storage_path'] != row['storage_path']:
                            await self.storage.delete_file(version['storage_path'])

                    # Delete from database
                    cur.execute("DELETE FROM dms.document_versions WHERE document_id = %s", (str(document_id),))
                    cur.execute("DELETE FROM dms.document_comments WHERE document_id = %s", (str(document_id),))
                    cur.execute("DELETE FROM dms.document_access WHERE document_id = %s", (str(document_id),))
                    cur.execute("DELETE FROM dms.entity_document_links WHERE document_id = %s", (str(document_id),))
                    cur.execute("DELETE FROM dms.document_audit_logs WHERE document_id = %s", (str(document_id),))
                    cur.execute("DELETE FROM dms.documents WHERE id = %s", (str(document_id),))
            else:
                # Soft delete
                cur.execute("""
                    UPDATE dms.documents SET
                        deleted_at = NOW(),
                        deleted_by = %s,
                        status = 'DELETED'::dms.documentstatus,
                        is_active = false
                    WHERE id = %s
                """, (str(deleted_by), str(document_id)))

                await self._log_audit(conn, document_id, AuditAction.DELETE, deleted_by)

            conn.commit()
            return True

        except Exception as e:
            conn.rollback()
            logger.error(f"Failed to delete document {document_id}: {e}")
            raise
        finally:
            cur.close()
            conn.close()

    async def create_version(
        self,
        document_id: UUID,
        file,
        filename: str,
        uploaded_by: UUID,
        change_notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a new version of a document.

        Args:
            document_id: Document to version
            file: New file content
            filename: Filename
            uploaded_by: User creating version
            change_notes: Description of changes

        Returns:
            New version details
        """
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            # Get current document info
            cur.execute("""
                SELECT company_id, tenant_id, folder_id, current_version,
                       (SELECT path FROM dms.folders WHERE id = folder_id) as folder_path
                FROM dms.documents
                WHERE id = %s AND is_active = true
            """, (str(document_id),))

            doc = cur.fetchone()
            if not doc:
                raise ValueError(f"Document not found: {document_id}")

            new_version = (doc['current_version'] or 0) + 1

            # Get mime type
            mime_type, _ = mimetypes.guess_type(filename)
            mime_type = mime_type or "application/octet-stream"

            # Upload new version to storage
            storage_result = await self.storage.upload_file(
                file=file,
                filename=f"v{new_version}_{filename}",
                company_id=UUID(doc['company_id']) if doc['company_id'] else None,
                tenant_id=UUID(doc['tenant_id']) if doc['tenant_id'] else None,
                folder_path=doc['folder_path'] or ""
            )

            # Mark previous versions as not current
            cur.execute("""
                UPDATE dms.document_versions
                SET is_current = false
                WHERE document_id = %s
            """, (str(document_id),))

            # Insert new version
            cur.execute("""
                INSERT INTO dms.document_versions (
                    document_id, version_number, file_name, file_size,
                    mime_type, storage_path, checksum, change_notes,
                    is_current, uploaded_by, created_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, true, %s, NOW()
                )
                RETURNING id, version_number, created_at
            """, (
                str(document_id), new_version, filename,
                storage_result['file_size'], mime_type,
                storage_result['storage_path'], storage_result['checksum'],
                change_notes, str(uploaded_by)
            ))

            version_row = cur.fetchone()

            # Update document
            cur.execute("""
                UPDATE dms.documents SET
                    current_version = %s,
                    version_count = version_count + 1,
                    file_name = %s,
                    file_size = %s,
                    storage_path = %s,
                    checksum = %s,
                    updated_at = NOW(),
                    updated_by = %s
                WHERE id = %s
            """, (
                new_version, filename, storage_result['file_size'],
                storage_result['storage_path'], storage_result['checksum'],
                str(uploaded_by), str(document_id)
            ))

            await self._log_audit(
                conn, document_id, AuditAction.VERSION_CREATE, uploaded_by,
                details={'version': new_version, 'change_notes': change_notes}
            )

            conn.commit()

            return {
                'id': str(version_row['id']),
                'document_id': str(document_id),
                'version_number': version_row['version_number'],
                'file_size': storage_result['file_size'],
                'created_at': version_row['created_at'].isoformat()
            }

        except Exception as e:
            conn.rollback()
            raise
        finally:
            cur.close()
            conn.close()

    async def list_versions(self, document_id: UUID) -> List[Dict[str, Any]]:
        """Get version history for a document."""
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            cur.execute("""
                SELECT
                    v.id, v.version_number, v.file_name, v.file_size,
                    v.mime_type, v.checksum, v.change_notes,
                    v.is_current, v.uploaded_by, v.created_at
                FROM dms.document_versions v
                WHERE v.document_id = %s
                ORDER BY v.version_number DESC
            """, (str(document_id),))

            return [dict(row) for row in cur.fetchall()]

        finally:
            cur.close()
            conn.close()

    async def download_document(
        self,
        document_id: UUID,
        user_id: Optional[UUID] = None,
        version: Optional[int] = None
    ) -> tuple:
        """
        Get document for download.

        Returns:
            Tuple of (file_stream, filename, content_type)
        """
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            if version:
                # Get specific version
                cur.execute("""
                    SELECT v.storage_path, v.file_name, v.mime_type
                    FROM dms.document_versions v
                    WHERE v.document_id = %s AND v.version_number = %s
                """, (str(document_id), version))
            else:
                # Get current version
                cur.execute("""
                    SELECT storage_path, file_name, mime_type
                    FROM dms.documents
                    WHERE id = %s AND is_active = true
                """, (str(document_id),))

            row = cur.fetchone()
            if not row:
                raise ValueError(f"Document not found: {document_id}")

            # Update download count and log
            if user_id:
                cur.execute("""
                    UPDATE dms.documents SET
                        download_count = COALESCE(download_count, 0) + 1
                    WHERE id = %s
                """, (str(document_id),))

                await self._log_audit(conn, document_id, AuditAction.DOWNLOAD, user_id)
                conn.commit()

            # Get file from storage
            file_stream, _ = await self.storage.download_file(row['storage_path'])

            return file_stream, row['file_name'], row['mime_type']

        finally:
            cur.close()
            conn.close()

    async def _log_audit(
        self,
        conn,
        document_id: UUID,
        action: AuditAction,
        user_id: UUID,
        details: Optional[Dict] = None
    ):
        """Log document action to audit trail."""
        cur = conn.cursor()
        try:
            cur.execute("""
                INSERT INTO dms.document_audit_logs (
                    document_id, action, action_details, user_id, timestamp
                ) VALUES (
                    %s, %s::dms.auditaction, %s, %s, NOW()
                )
            """, (str(document_id), action.value, details or {}, str(user_id)))
        finally:
            cur.close()

    async def get_audit_logs(
        self,
        document_id: UUID,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get audit trail for a document."""
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            cur.execute("""
                SELECT
                    al.id, al.action, al.action_details,
                    al.user_id, al.user_name, al.timestamp,
                    al.version_number
                FROM dms.document_audit_logs al
                WHERE al.document_id = %s
                ORDER BY al.timestamp DESC
                LIMIT %s
            """, (str(document_id), limit))

            return [dict(row) for row in cur.fetchall()]

        finally:
            cur.close()
            conn.close()


# Singleton instance
_document_service: Optional[DocsDocumentService] = None


def get_docs_document_service() -> DocsDocumentService:
    """Get or create document service instance."""
    global _document_service
    if _document_service is None:
        _document_service = DocsDocumentService()
    return _document_service
