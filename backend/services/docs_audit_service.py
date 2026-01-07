"""
Bheem Docs - Audit & Activity Logging Service
==============================================
Comprehensive audit logging for document activities.
Tracks all document operations for compliance and security.
"""

from typing import Optional, List, Dict, Any
from uuid import UUID, uuid4
from datetime import datetime, timedelta
from enum import Enum
import logging
import json
import psycopg2
from psycopg2.extras import RealDictCursor

from core.config import settings

logger = logging.getLogger(__name__)


class AuditAction(str, Enum):
    """Document audit action types"""
    # Document lifecycle
    CREATED = "CREATED"
    UPDATED = "UPDATED"
    DELETED = "DELETED"
    RESTORED = "RESTORED"
    ARCHIVED = "ARCHIVED"
    PERMANENTLY_DELETED = "PERMANENTLY_DELETED"

    # Content operations
    CONTENT_UPDATED = "CONTENT_UPDATED"
    TITLE_CHANGED = "TITLE_CHANGED"
    METADATA_UPDATED = "METADATA_UPDATED"

    # Access operations
    VIEWED = "VIEWED"
    DOWNLOADED = "DOWNLOADED"
    EXPORTED = "EXPORTED"
    PRINTED = "PRINTED"

    # Sharing operations
    SHARED = "SHARED"
    SHARE_REVOKED = "SHARE_REVOKED"
    PERMISSION_CHANGED = "PERMISSION_CHANGED"
    PUBLIC_LINK_CREATED = "PUBLIC_LINK_CREATED"
    PUBLIC_LINK_REVOKED = "PUBLIC_LINK_REVOKED"

    # Version operations
    VERSION_CREATED = "VERSION_CREATED"
    VERSION_RESTORED = "VERSION_RESTORED"
    VERSION_DELETED = "VERSION_DELETED"

    # Workflow operations
    SUBMITTED_FOR_APPROVAL = "SUBMITTED_FOR_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    WORKFLOW_TRANSITIONED = "WORKFLOW_TRANSITIONED"

    # Collaboration operations
    COMMENT_ADDED = "COMMENT_ADDED"
    COMMENT_DELETED = "COMMENT_DELETED"
    MENTION_CREATED = "MENTION_CREATED"

    # Signature operations
    SIGNATURE_REQUESTED = "SIGNATURE_REQUESTED"
    SIGNED = "SIGNED"
    SIGNATURE_DECLINED = "SIGNATURE_DECLINED"

    # Organization operations
    MOVED = "MOVED"
    COPIED = "COPIED"
    RENAMED = "RENAMED"
    TAGGED = "TAGGED"
    UNTAGGED = "UNTAGGED"


class DocsAuditService:
    """
    Audit logging service for document activities.

    Stores audit logs in the database with:
    - Document ID and type
    - User performing the action
    - Action type
    - Before/after values for changes
    - IP address and user agent
    - Timestamp
    """

    def __init__(self, db_connection=None):
        """
        Initialize audit service.

        Args:
            db_connection: Optional database connection
        """
        self.db_connection = db_connection
        self._conn = None

    def _get_connection(self):
        """Get database connection."""
        if self.db_connection:
            return self.db_connection

        if self._conn is None or self._conn.closed:
            self._conn = psycopg2.connect(
                host=settings.DATABASE_HOST,
                port=settings.DATABASE_PORT,
                database=settings.DATABASE_NAME,
                user=settings.DATABASE_USER,
                password=settings.DATABASE_PASSWORD
            )
        return self._conn

    async def log(
        self,
        document_id: UUID,
        action: AuditAction,
        user_id: UUID,
        tenant_id: Optional[UUID] = None,
        details: Optional[Dict[str, Any]] = None,
        old_value: Optional[Any] = None,
        new_value: Optional[Any] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Log an audit event.

        Args:
            document_id: Document UUID
            action: Action type
            user_id: User performing the action
            tenant_id: Tenant UUID
            details: Additional details
            old_value: Value before change
            new_value: Value after change
            ip_address: Client IP
            user_agent: Client user agent
            session_id: Session ID

        Returns:
            Created audit log entry
        """
        try:
            conn = self._get_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                audit_id = uuid4()

                cur.execute("""
                    INSERT INTO workspace.document_audit_logs (
                        id, document_id, action, user_id, tenant_id,
                        details, old_value, new_value,
                        ip_address, user_agent, session_id,
                        created_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW()
                    )
                    RETURNING *
                """, (
                    str(audit_id),
                    str(document_id),
                    action.value,
                    str(user_id),
                    str(tenant_id) if tenant_id else None,
                    json.dumps(details) if details else None,
                    json.dumps(old_value) if old_value else None,
                    json.dumps(new_value) if new_value else None,
                    ip_address,
                    user_agent,
                    session_id
                ))

                result = cur.fetchone()
                conn.commit()

                logger.info(
                    f"Audit log: {action.value} on document {document_id} by user {user_id}"
                )

                return dict(result)

        except Exception as e:
            logger.error(f"Failed to create audit log: {e}")
            # Don't raise - audit logging should not break operations
            return {
                "id": str(uuid4()),
                "document_id": str(document_id),
                "action": action.value,
                "error": str(e)
            }

    async def get_document_history(
        self,
        document_id: UUID,
        actions: Optional[List[AuditAction]] = None,
        user_id: Optional[UUID] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Get audit history for a document.

        Args:
            document_id: Document UUID
            actions: Filter by action types
            user_id: Filter by user
            start_date: Filter from date
            end_date: Filter to date
            limit: Max results
            offset: Pagination offset

        Returns:
            List of audit log entries
        """
        try:
            conn = self._get_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                query = """
                    SELECT dal.*, u.name as user_name, u.email as user_email
                    FROM workspace.document_audit_logs dal
                    LEFT JOIN auth.users u ON dal.user_id = CAST(u.id AS text)
                    WHERE dal.document_id = %s
                """
                params = [str(document_id)]

                if actions:
                    action_values = [a.value for a in actions]
                    query += " AND dal.action = ANY(%s)"
                    params.append(action_values)

                if user_id:
                    query += " AND dal.user_id = %s"
                    params.append(str(user_id))

                if start_date:
                    query += " AND dal.created_at >= %s"
                    params.append(start_date)

                if end_date:
                    query += " AND dal.created_at <= %s"
                    params.append(end_date)

                query += " ORDER BY dal.created_at DESC LIMIT %s OFFSET %s"
                params.extend([limit, offset])

                cur.execute(query, params)
                results = cur.fetchall()

                return [dict(r) for r in results]

        except Exception as e:
            logger.error(f"Failed to get document history: {e}")
            return []

    async def get_user_activity(
        self,
        user_id: UUID,
        tenant_id: Optional[UUID] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Get all document activity by a user.

        Args:
            user_id: User UUID
            tenant_id: Filter by tenant
            start_date: Filter from date
            end_date: Filter to date
            limit: Max results
            offset: Pagination offset

        Returns:
            List of audit log entries
        """
        try:
            conn = self._get_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                query = """
                    SELECT dal.*, d.title as document_title
                    FROM workspace.document_audit_logs dal
                    LEFT JOIN workspace.documents d ON dal.document_id = CAST(d.id AS text)
                    WHERE dal.user_id = %s
                """
                params = [str(user_id)]

                if tenant_id:
                    query += " AND dal.tenant_id = %s"
                    params.append(str(tenant_id))

                if start_date:
                    query += " AND dal.created_at >= %s"
                    params.append(start_date)

                if end_date:
                    query += " AND dal.created_at <= %s"
                    params.append(end_date)

                query += " ORDER BY dal.created_at DESC LIMIT %s OFFSET %s"
                params.extend([limit, offset])

                cur.execute(query, params)
                results = cur.fetchall()

                return [dict(r) for r in results]

        except Exception as e:
            logger.error(f"Failed to get user activity: {e}")
            return []

    async def get_tenant_activity(
        self,
        tenant_id: UUID,
        actions: Optional[List[AuditAction]] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Get all document activity for a tenant.

        Args:
            tenant_id: Tenant UUID
            actions: Filter by action types
            start_date: Filter from date
            end_date: Filter to date
            limit: Max results
            offset: Pagination offset

        Returns:
            List of audit log entries
        """
        try:
            conn = self._get_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                query = """
                    SELECT dal.*,
                           d.title as document_title,
                           u.name as user_name
                    FROM workspace.document_audit_logs dal
                    LEFT JOIN workspace.documents d ON dal.document_id = CAST(d.id AS text)
                    LEFT JOIN auth.users u ON dal.user_id = CAST(u.id AS text)
                    WHERE dal.tenant_id = %s
                """
                params = [str(tenant_id)]

                if actions:
                    action_values = [a.value for a in actions]
                    query += " AND dal.action = ANY(%s)"
                    params.append(action_values)

                if start_date:
                    query += " AND dal.created_at >= %s"
                    params.append(start_date)

                if end_date:
                    query += " AND dal.created_at <= %s"
                    params.append(end_date)

                query += " ORDER BY dal.created_at DESC LIMIT %s OFFSET %s"
                params.extend([limit, offset])

                cur.execute(query, params)
                results = cur.fetchall()

                return [dict(r) for r in results]

        except Exception as e:
            logger.error(f"Failed to get tenant activity: {e}")
            return []

    async def get_activity_stats(
        self,
        tenant_id: Optional[UUID] = None,
        document_id: Optional[UUID] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Get activity statistics.

        Args:
            tenant_id: Filter by tenant
            document_id: Filter by document
            start_date: Filter from date
            end_date: Filter to date

        Returns:
            Activity statistics
        """
        try:
            conn = self._get_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Build base query
                where_clauses = []
                params = []

                if tenant_id:
                    where_clauses.append("tenant_id = %s")
                    params.append(str(tenant_id))

                if document_id:
                    where_clauses.append("document_id = %s")
                    params.append(str(document_id))

                if start_date:
                    where_clauses.append("created_at >= %s")
                    params.append(start_date)

                if end_date:
                    where_clauses.append("created_at <= %s")
                    params.append(end_date)

                where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"

                # Get action counts
                cur.execute(f"""
                    SELECT action, COUNT(*) as count
                    FROM workspace.document_audit_logs
                    WHERE {where_sql}
                    GROUP BY action
                    ORDER BY count DESC
                """, params)

                action_counts = {r['action']: r['count'] for r in cur.fetchall()}

                # Get total count
                cur.execute(f"""
                    SELECT COUNT(*) as total
                    FROM workspace.document_audit_logs
                    WHERE {where_sql}
                """, params)

                total = cur.fetchone()['total']

                # Get unique users
                cur.execute(f"""
                    SELECT COUNT(DISTINCT user_id) as unique_users
                    FROM workspace.document_audit_logs
                    WHERE {where_sql}
                """, params)

                unique_users = cur.fetchone()['unique_users']

                # Get unique documents
                cur.execute(f"""
                    SELECT COUNT(DISTINCT document_id) as unique_documents
                    FROM workspace.document_audit_logs
                    WHERE {where_sql}
                """, params)

                unique_documents = cur.fetchone()['unique_documents']

                return {
                    "total_events": total,
                    "unique_users": unique_users,
                    "unique_documents": unique_documents,
                    "action_counts": action_counts
                }

        except Exception as e:
            logger.error(f"Failed to get activity stats: {e}")
            return {
                "total_events": 0,
                "unique_users": 0,
                "unique_documents": 0,
                "action_counts": {}
            }

    async def search_audit_logs(
        self,
        tenant_id: UUID,
        search_term: Optional[str] = None,
        actions: Optional[List[AuditAction]] = None,
        user_ids: Optional[List[UUID]] = None,
        document_ids: Optional[List[UUID]] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        ip_address: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Search audit logs with multiple filters.

        Args:
            tenant_id: Tenant UUID
            search_term: Search in details
            actions: Filter by actions
            user_ids: Filter by users
            document_ids: Filter by documents
            start_date: Filter from date
            end_date: Filter to date
            ip_address: Filter by IP
            limit: Max results
            offset: Pagination offset

        Returns:
            Search results with total count
        """
        try:
            conn = self._get_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                where_clauses = ["tenant_id = %s"]
                params = [str(tenant_id)]

                if search_term:
                    where_clauses.append("details::text ILIKE %s")
                    params.append(f"%{search_term}%")

                if actions:
                    action_values = [a.value for a in actions]
                    where_clauses.append("action = ANY(%s)")
                    params.append(action_values)

                if user_ids:
                    user_id_strs = [str(u) for u in user_ids]
                    where_clauses.append("user_id = ANY(%s)")
                    params.append(user_id_strs)

                if document_ids:
                    doc_id_strs = [str(d) for d in document_ids]
                    where_clauses.append("document_id = ANY(%s)")
                    params.append(doc_id_strs)

                if start_date:
                    where_clauses.append("created_at >= %s")
                    params.append(start_date)

                if end_date:
                    where_clauses.append("created_at <= %s")
                    params.append(end_date)

                if ip_address:
                    where_clauses.append("ip_address = %s")
                    params.append(ip_address)

                where_sql = " AND ".join(where_clauses)

                # Get total count
                cur.execute(f"""
                    SELECT COUNT(*) as total
                    FROM workspace.document_audit_logs
                    WHERE {where_sql}
                """, params)

                total = cur.fetchone()['total']

                # Get results
                params.extend([limit, offset])
                cur.execute(f"""
                    SELECT dal.*,
                           d.title as document_title,
                           u.name as user_name,
                           u.email as user_email
                    FROM workspace.document_audit_logs dal
                    LEFT JOIN workspace.documents d ON dal.document_id = CAST(d.id AS text)
                    LEFT JOIN auth.users u ON dal.user_id = CAST(u.id AS text)
                    WHERE {where_sql}
                    ORDER BY dal.created_at DESC
                    LIMIT %s OFFSET %s
                """, params)

                results = [dict(r) for r in cur.fetchall()]

                return {
                    "total": total,
                    "results": results,
                    "limit": limit,
                    "offset": offset
                }

        except Exception as e:
            logger.error(f"Failed to search audit logs: {e}")
            return {
                "total": 0,
                "results": [],
                "limit": limit,
                "offset": offset
            }

    async def export_audit_logs(
        self,
        tenant_id: UUID,
        start_date: datetime,
        end_date: datetime,
        format: str = "json"
    ) -> Dict[str, Any]:
        """
        Export audit logs for compliance/reporting.

        Args:
            tenant_id: Tenant UUID
            start_date: Export from date
            end_date: Export to date
            format: Export format (json, csv)

        Returns:
            Export data
        """
        try:
            conn = self._get_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT dal.*,
                           d.title as document_title,
                           u.name as user_name,
                           u.email as user_email
                    FROM workspace.document_audit_logs dal
                    LEFT JOIN workspace.documents d ON dal.document_id = CAST(d.id AS text)
                    LEFT JOIN auth.users u ON dal.user_id = CAST(u.id AS text)
                    WHERE dal.tenant_id = %s
                    AND dal.created_at >= %s
                    AND dal.created_at <= %s
                    ORDER BY dal.created_at
                """, (str(tenant_id), start_date, end_date))

                results = [dict(r) for r in cur.fetchall()]

                if format == "csv":
                    # Convert to CSV format
                    if not results:
                        return {"format": "csv", "data": "", "count": 0}

                    headers = list(results[0].keys())
                    csv_lines = [",".join(headers)]

                    for row in results:
                        values = []
                        for h in headers:
                            val = row.get(h)
                            if val is None:
                                values.append("")
                            elif isinstance(val, (dict, list)):
                                values.append(f'"{json.dumps(val)}"')
                            elif isinstance(val, datetime):
                                values.append(val.isoformat())
                            else:
                                values.append(f'"{str(val)}"')
                        csv_lines.append(",".join(values))

                    return {
                        "format": "csv",
                        "data": "\n".join(csv_lines),
                        "count": len(results)
                    }

                return {
                    "format": "json",
                    "data": results,
                    "count": len(results)
                }

        except Exception as e:
            logger.error(f"Failed to export audit logs: {e}")
            return {
                "format": format,
                "data": [] if format == "json" else "",
                "count": 0,
                "error": str(e)
            }


# Singleton instance
_audit_service: Optional[DocsAuditService] = None


def get_docs_audit_service() -> DocsAuditService:
    """Get or create audit service singleton."""
    global _audit_service
    if _audit_service is None:
        _audit_service = DocsAuditService()
    return _audit_service
