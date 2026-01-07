"""
Bheem Docs - Entity Document Links Service
============================================
Links documents to ERP entities (Invoice, PO, Employee, Project, etc.)
Provides quick access to documents from ERP modules.

DMS Schema Tables Used:
- dms.entity_document_links - Document-entity relationships
- dms.documents - Document metadata
"""

from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
import logging
import psycopg2
from psycopg2.extras import RealDictCursor

from core.config import settings
from services.docs_document_service import EntityType

logger = logging.getLogger(__name__)


# Entity table mappings for info retrieval
ENTITY_TABLE_MAPPINGS = {
    'CUSTOMER': {
        'schema': 'crm',
        'table': 'customers',
        'name_field': 'name',
        'code_field': 'customer_code'
    },
    'VENDOR': {
        'schema': 'purchase',
        'table': 'vendors',
        'name_field': 'name',
        'code_field': 'vendor_code'
    },
    'EMPLOYEE': {
        'schema': 'hr',
        'table': 'employees',
        'name_field': "first_name || ' ' || last_name",
        'code_field': 'employee_code'
    },
    'CANDIDATE': {
        'schema': 'hr',
        'table': 'candidates',
        'name_field': "first_name || ' ' || last_name",
        'code_field': 'candidate_code'
    },
    'SALES_ORDER': {
        'schema': 'sales',
        'table': 'sales_orders',
        'name_field': 'so_number',
        'code_field': 'so_number'
    },
    'SALES_INVOICE': {
        'schema': 'sales',
        'table': 'invoices',
        'name_field': 'invoice_number',
        'code_field': 'invoice_number'
    },
    'SALES_QUOTE': {
        'schema': 'sales',
        'table': 'quotations',
        'name_field': 'quote_number',
        'code_field': 'quote_number'
    },
    'PURCHASE_ORDER': {
        'schema': 'purchase',
        'table': 'purchase_orders',
        'name_field': 'po_number',
        'code_field': 'po_number'
    },
    'PURCHASE_BILL': {
        'schema': 'purchase',
        'table': 'bills',
        'name_field': 'bill_number',
        'code_field': 'bill_number'
    },
    'PURCHASE_REQUEST': {
        'schema': 'purchase',
        'table': 'purchase_requests',
        'name_field': 'pr_number',
        'code_field': 'pr_number'
    },
    'GRN': {
        'schema': 'purchase',
        'table': 'goods_received_notes',
        'name_field': 'grn_number',
        'code_field': 'grn_number'
    },
    'PROJECT': {
        'schema': 'project_management',
        'table': 'projects',
        'name_field': 'name',
        'code_field': 'project_code'
    },
    'TASK': {
        'schema': 'project_management',
        'table': 'tasks',
        'name_field': 'title',
        'code_field': 'task_number'
    },
    'CRM_CONTACT': {
        'schema': 'crm',
        'table': 'contacts',
        'name_field': "first_name || ' ' || last_name",
        'code_field': 'id'
    },
    'CRM_LEAD': {
        'schema': 'leads',
        'table': 'leads',
        'name_field': 'name',
        'code_field': 'lead_number'
    },
    'CRM_OPPORTUNITY': {
        'schema': 'crm',
        'table': 'opportunities',
        'name_field': 'name',
        'code_field': 'opportunity_number'
    },
    'EXPENSE': {
        'schema': 'accounting',
        'table': 'expenses',
        'name_field': 'description',
        'code_field': 'expense_number'
    },
    'ASSET': {
        'schema': 'accounting',
        'table': 'fixed_assets',
        'name_field': 'name',
        'code_field': 'asset_code'
    },
    'JOURNAL_ENTRY': {
        'schema': 'accounting',
        'table': 'journal_entries',
        'name_field': 'reference',
        'code_field': 'entry_number'
    },
    'PAYMENT': {
        'schema': 'accounting',
        'table': 'payments',
        'name_field': 'reference',
        'code_field': 'payment_number'
    },
    'COMPANY': {
        'schema': 'public',
        'table': 'companies',
        'name_field': 'name',
        'code_field': 'company_code'
    }
}


class DocsEntityService:
    """
    Entity document linking service for ERP integration.

    Features:
    - Link documents to ERP entities
    - Quick document access from any ERP module
    - Bulk operations
    - Entity info retrieval
    """

    def __init__(self):
        """Initialize with ERP database connection."""
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

    async def link_document(
        self,
        document_id: UUID,
        entity_type: str,
        entity_id: UUID,
        created_by: UUID,
        link_type: str = "ATTACHMENT",
        is_primary: bool = False
    ) -> Dict[str, Any]:
        """
        Link a document to an ERP entity.

        Args:
            document_id: Document to link
            entity_type: Type of ERP entity
            entity_id: ID of the entity
            created_by: User creating the link
            link_type: Type of link (ATTACHMENT, REFERENCE, etc.)
            is_primary: Whether this is the primary document

        Returns:
            Link details
        """
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            # Insert or update link
            cur.execute("""
                INSERT INTO dms.entity_document_links (
                    document_id, entity_type, entity_id,
                    link_type, is_primary, created_by, created_at
                ) VALUES (
                    %s, %s::dms.entitytype, %s, %s, %s, %s, NOW()
                )
                ON CONFLICT (document_id, entity_type, entity_id) DO UPDATE SET
                    link_type = EXCLUDED.link_type,
                    is_primary = EXCLUDED.is_primary
                RETURNING id, created_at
            """, (
                str(document_id), entity_type, str(entity_id),
                link_type, is_primary, str(created_by)
            ))

            row = cur.fetchone()

            # Also update document's entity reference if not set
            cur.execute("""
                UPDATE dms.documents SET
                    entity_type = %s::dms.entitytype,
                    entity_id = %s
                WHERE id = %s AND entity_type IS NULL
            """, (entity_type, str(entity_id), str(document_id)))

            conn.commit()

            logger.info(f"Linked document {document_id} to {entity_type}/{entity_id}")

            return {
                'id': str(row['id']),
                'document_id': str(document_id),
                'entity_type': entity_type,
                'entity_id': str(entity_id),
                'link_type': link_type,
                'is_primary': is_primary,
                'created_at': row['created_at'].isoformat()
            }

        except Exception as e:
            conn.rollback()
            logger.error(f"Failed to link document: {e}")
            raise
        finally:
            cur.close()
            conn.close()

    async def unlink_document(
        self,
        document_id: UUID,
        entity_type: str,
        entity_id: UUID
    ) -> bool:
        """Remove document-entity link."""
        conn = self._get_connection()
        cur = conn.cursor()

        try:
            cur.execute("""
                DELETE FROM dms.entity_document_links
                WHERE document_id = %s
                AND entity_type = %s::dms.entitytype
                AND entity_id = %s
            """, (str(document_id), entity_type, str(entity_id)))

            conn.commit()
            return True

        except Exception as e:
            conn.rollback()
            raise
        finally:
            cur.close()
            conn.close()

    async def get_entity_documents(
        self,
        entity_type: str,
        entity_id: UUID,
        document_type: Optional[str] = None,
        include_deleted: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Get all documents linked to an ERP entity.

        Args:
            entity_type: Type of ERP entity
            entity_id: Entity ID
            document_type: Optional filter by document type
            include_deleted: Include soft-deleted documents

        Returns:
            List of documents with link info
        """
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            conditions = [
                "edl.entity_type = %s::dms.entitytype",
                "edl.entity_id = %s"
            ]
            params = [entity_type, str(entity_id)]

            if not include_deleted:
                conditions.append("d.is_active = true")
                conditions.append("d.deleted_at IS NULL")

            if document_type:
                conditions.append("d.document_type = %s::dms.documenttype")
                params.append(document_type)

            where_clause = " AND ".join(conditions)

            cur.execute(f"""
                SELECT
                    d.id, d.title, d.description, d.document_type, d.status,
                    d.file_name, d.file_extension, d.file_size, d.mime_type,
                    d.storage_path, d.current_version, d.is_editable,
                    d.tags, d.view_count, d.download_count,
                    d.created_at, d.updated_at,
                    edl.id as link_id, edl.link_type, edl.is_primary
                FROM dms.entity_document_links edl
                JOIN dms.documents d ON edl.document_id = d.id
                WHERE {where_clause}
                ORDER BY edl.is_primary DESC, d.created_at DESC
            """, params)

            return [dict(row) for row in cur.fetchall()]

        finally:
            cur.close()
            conn.close()

    async def get_document_entities(
        self,
        document_id: UUID
    ) -> List[Dict[str, Any]]:
        """
        Get all entities linked to a document.

        Returns list with entity details.
        """
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            cur.execute("""
                SELECT
                    edl.id as link_id,
                    edl.entity_type,
                    edl.entity_id,
                    edl.link_type,
                    edl.is_primary,
                    edl.created_at
                FROM dms.entity_document_links edl
                WHERE edl.document_id = %s
                ORDER BY edl.is_primary DESC, edl.created_at DESC
            """, (str(document_id),))

            links = cur.fetchall()

            # Enrich with entity details
            result = []
            for link in links:
                entity_info = await self._get_entity_info(
                    link['entity_type'],
                    UUID(link['entity_id'])
                )
                result.append({
                    **dict(link),
                    'entity_info': entity_info
                })

            return result

        finally:
            cur.close()
            conn.close()

    async def _get_entity_info(
        self,
        entity_type: str,
        entity_id: UUID
    ) -> Dict[str, Any]:
        """Get basic info about an entity."""
        mapping = ENTITY_TABLE_MAPPINGS.get(entity_type)
        if not mapping:
            return {'name': 'Unknown', 'code': str(entity_id), 'type': entity_type}

        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            table = f"{mapping['schema']}.{mapping['table']}"
            name_field = mapping['name_field']
            code_field = mapping['code_field']

            cur.execute(f"""
                SELECT {name_field} as name, {code_field} as code
                FROM {table}
                WHERE id = %s
            """, (str(entity_id),))

            row = cur.fetchone()
            if row:
                return {
                    'name': row['name'],
                    'code': str(row['code']),
                    'type': entity_type
                }

            return {'name': 'Unknown', 'code': str(entity_id), 'type': entity_type}

        except Exception as e:
            logger.warning(f"Could not get entity info for {entity_type}/{entity_id}: {e}")
            return {'name': 'Unknown', 'code': str(entity_id), 'type': entity_type}
        finally:
            cur.close()
            conn.close()

    async def bulk_link_documents(
        self,
        document_ids: List[UUID],
        entity_type: str,
        entity_id: UUID,
        created_by: UUID,
        link_type: str = "ATTACHMENT"
    ) -> Dict[str, Any]:
        """
        Link multiple documents to an entity at once.

        Returns:
            Summary of operation
        """
        conn = self._get_connection()
        cur = conn.cursor()

        try:
            linked = 0
            errors = []

            for doc_id in document_ids:
                try:
                    cur.execute("""
                        INSERT INTO dms.entity_document_links (
                            document_id, entity_type, entity_id,
                            link_type, created_by, created_at
                        ) VALUES (
                            %s, %s::dms.entitytype, %s, %s, %s, NOW()
                        )
                        ON CONFLICT (document_id, entity_type, entity_id) DO NOTHING
                    """, (
                        str(doc_id), entity_type, str(entity_id),
                        link_type, str(created_by)
                    ))
                    linked += 1
                except Exception as e:
                    errors.append({'document_id': str(doc_id), 'error': str(e)})

            conn.commit()

            return {
                'linked': linked,
                'total': len(document_ids),
                'errors': errors
            }

        except Exception as e:
            conn.rollback()
            raise
        finally:
            cur.close()
            conn.close()

    async def get_entity_document_summary(
        self,
        entity_type: str,
        entity_id: UUID
    ) -> Dict[str, Any]:
        """
        Get summary of documents for an entity.

        Returns counts by document type.
        """
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            cur.execute("""
                SELECT
                    d.document_type,
                    COUNT(*) as count,
                    SUM(d.file_size) as total_size
                FROM dms.entity_document_links edl
                JOIN dms.documents d ON edl.document_id = d.id
                WHERE edl.entity_type = %s::dms.entitytype
                AND edl.entity_id = %s
                AND d.is_active = true
                GROUP BY d.document_type
                ORDER BY count DESC
            """, (entity_type, str(entity_id)))

            by_type = [dict(row) for row in cur.fetchall()]

            total_count = sum(t['count'] for t in by_type)
            total_size = sum(t['total_size'] or 0 for t in by_type)

            return {
                'entity_type': entity_type,
                'entity_id': str(entity_id),
                'total_documents': total_count,
                'total_size_bytes': total_size,
                'by_type': by_type
            }

        finally:
            cur.close()
            conn.close()


# Singleton instance
_entity_service: Optional[DocsEntityService] = None


def get_docs_entity_service() -> DocsEntityService:
    """Get or create entity service instance."""
    global _entity_service
    if _entity_service is None:
        _entity_service = DocsEntityService()
    return _entity_service
