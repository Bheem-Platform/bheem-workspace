"""
Bheem Docs - Editor Content Service
====================================
Manages Tiptap editor content, collaboration sessions, and user presence.
Integrates with ERP DMS schema for document storage.

Database Tables:
- dms.documents (editor_content, editor_content_html, is_editable)
- workspace.docs_sessions (collaboration state)
- workspace.docs_presence (user cursors)
"""

from typing import Optional, List, Dict, Any
from uuid import UUID, uuid4
from datetime import datetime, timedelta
import logging
import json
import hashlib
import psycopg2
from psycopg2.extras import RealDictCursor

from core.config import settings
from services.docs_export_service import DocsExportService

logger = logging.getLogger(__name__)


# User cursor colors for collaboration
CURSOR_COLORS = [
    '#2563eb',  # Blue
    '#dc2626',  # Red
    '#16a34a',  # Green
    '#ca8a04',  # Yellow
    '#9333ea',  # Purple
    '#ea580c',  # Orange
    '#0891b2',  # Cyan
    '#db2777',  # Pink
    '#4f46e5',  # Indigo
    '#059669',  # Emerald
]


class DocsEditorService:
    """
    Editor content management service.

    Handles:
    - Saving/loading Tiptap JSON content
    - Collaboration session management
    - User presence tracking
    - Auto-save functionality
    - Content versioning
    """

    def __init__(self):
        """Initialize with ERP database connection for DMS schema."""
        self.db_config = {
            'host': settings.ERP_DB_HOST,
            'port': settings.ERP_DB_PORT,
            'database': settings.ERP_DB_NAME,
            'user': settings.ERP_DB_USER,
            'password': settings.ERP_DB_PASSWORD,
        }
        self.export_service = DocsExportService()

    def _get_connection(self):
        """Get database connection."""
        return psycopg2.connect(**self.db_config)

    # =========================================================================
    # EDITOR CONTENT OPERATIONS
    # =========================================================================

    async def get_editor_content(
        self,
        document_id: UUID,
        user_id: UUID
    ) -> Optional[Dict[str, Any]]:
        """
        Get document content for editing.

        Args:
            document_id: Document ID
            user_id: User requesting access

        Returns:
            Document with editor content
        """
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            cur.execute("""
                SELECT
                    id, title, description, document_type, status,
                    editor_content, editor_content_html, is_editable,
                    current_version, last_edited_by, last_edited_at,
                    created_at, updated_at
                FROM dms.documents
                WHERE id = %s AND is_active = true AND deleted_at IS NULL
            """, (str(document_id),))

            row = cur.fetchone()
            if not row:
                return None

            result = dict(row)

            # Check for active collaboration session
            session = await self.get_or_create_session(document_id, user_id)
            result['session_id'] = session['id']
            result['session_token'] = session['session_token']

            # Get active collaborators
            collaborators = await self.get_presence(document_id)
            result['collaborators'] = collaborators

            return result

        finally:
            cur.close()
            conn.close()

    async def save_editor_content(
        self,
        document_id: UUID,
        content: Dict[str, Any],
        user_id: UUID,
        create_version: bool = False
    ) -> Dict[str, Any]:
        """
        Save Tiptap content to document.

        Args:
            document_id: Document ID
            content: Tiptap JSON content
            user_id: User saving the document
            create_version: Whether to create a new version

        Returns:
            Updated document info
        """
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            # Generate HTML for search indexing
            html_content = self.export_service.tiptap_to_html(content)

            # Update document
            cur.execute("""
                UPDATE dms.documents SET
                    editor_content = %s,
                    editor_content_html = %s,
                    is_editable = true,
                    last_edited_by = %s,
                    last_edited_at = NOW(),
                    updated_at = NOW()
                WHERE id = %s
                RETURNING id, title, current_version, updated_at
            """, (
                json.dumps(content),
                html_content,
                str(user_id),
                str(document_id)
            ))

            row = cur.fetchone()
            if not row:
                raise ValueError(f"Document not found: {document_id}")

            result = dict(row)

            # Create version if requested
            if create_version:
                new_version = (row['current_version'] or 0) + 1

                cur.execute("""
                    INSERT INTO dms.document_versions (
                        document_id, version_number, file_path,
                        file_size, change_summary, created_by, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, NOW())
                    RETURNING id, version_number
                """, (
                    str(document_id),
                    new_version,
                    f"editor_content_v{new_version}",
                    len(json.dumps(content)),
                    "Auto-saved version",
                    str(user_id)
                ))

                version_row = cur.fetchone()

                # Store version content
                cur.execute("""
                    INSERT INTO dms.version_content (
                        version_id, editor_content
                    ) VALUES (%s, %s)
                    ON CONFLICT (version_id) DO UPDATE SET
                        editor_content = EXCLUDED.editor_content
                """, (str(version_row['id']), json.dumps(content)))

                # Update document version
                cur.execute("""
                    UPDATE dms.documents SET
                        current_version = %s
                    WHERE id = %s
                """, (new_version, str(document_id)))

                result['version'] = new_version

            conn.commit()

            # Log audit
            await self._log_edit_action(
                document_id, user_id, 'EDITED', cur, conn
            )

            logger.info(f"Saved editor content for document {document_id}")

            return result

        except Exception as e:
            conn.rollback()
            logger.error(f"Failed to save editor content: {e}")
            raise
        finally:
            cur.close()
            conn.close()

    async def create_editable_document(
        self,
        title: str,
        content: Dict[str, Any],
        created_by: UUID,
        company_id: Optional[UUID] = None,
        tenant_id: Optional[UUID] = None,
        folder_id: Optional[UUID] = None,
        document_type: str = 'OTHER',
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a new editable document with Tiptap content.

        Args:
            title: Document title
            content: Tiptap JSON content
            created_by: Creating user
            company_id: For internal users
            tenant_id: For external users
            folder_id: Parent folder
            document_type: Type of document
            description: Optional description

        Returns:
            Created document
        """
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            # Generate HTML for search
            html_content = self.export_service.tiptap_to_html(content)

            content_json = json.dumps(content)
            file_size = len(content_json.encode('utf-8'))
            doc_id = str(uuid4())
            storage_bucket = 'bheem-dms'
            storage_path = f"bheem-docs/{str(company_id) if company_id else 'shared'}/{doc_id}.bdoc"

            cur.execute("""
                INSERT INTO dms.documents (
                    id, title, description, document_type, status,
                    file_name, file_extension, file_size, mime_type,
                    storage_bucket, storage_path, company_id, folder_id,
                    editor_content, editor_content_html, is_editable,
                    created_by, last_edited_by, last_edited_at,
                    created_at, updated_at, is_active
                ) VALUES (
                    %s, %s, %s, %s::dms.documenttype, 'ACTIVE'::dms.documentstatus,
                    %s, 'bdoc', %s, 'application/json',
                    %s, %s, %s, %s,
                    %s, %s, true,
                    %s, %s, NOW(),
                    NOW(), NOW(), true
                )
                RETURNING *
            """, (
                doc_id, title, description, document_type,
                f"{title}.bdoc", file_size,
                storage_bucket, storage_path,
                str(company_id) if company_id else None,
                str(folder_id) if folder_id else None,
                content_json, html_content,
                str(created_by), str(created_by)
            ))

            row = cur.fetchone()
            conn.commit()

            # Log audit
            await self._log_edit_action(
                UUID(row['id']), created_by, 'CREATED', cur, conn
            )

            logger.info(f"Created editable document: {title} (ID: {row['id']})")

            return dict(row)

        except Exception as e:
            conn.rollback()
            logger.error(f"Failed to create editable document: {e}")
            raise
        finally:
            cur.close()
            conn.close()

    # =========================================================================
    # COLLABORATION SESSIONS
    # =========================================================================

    async def get_or_create_session(
        self,
        document_id: UUID,
        user_id: UUID,
        session_duration_hours: int = 24
    ) -> Dict[str, Any]:
        """
        Get or create a collaboration session for a document.

        Args:
            document_id: Document ID
            user_id: User joining the session
            session_duration_hours: Session expiry time

        Returns:
            Session info
        """
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            # Check for existing valid session
            cur.execute("""
                SELECT *
                FROM workspace.docs_sessions
                WHERE document_id = %s AND expires_at > NOW()
                ORDER BY created_at DESC
                LIMIT 1
            """, (str(document_id),))

            row = cur.fetchone()

            if row:
                # Update session if user not in active_users
                active_users = row['active_users'] or []
                user_id_str = str(user_id)

                if user_id_str not in [u.get('id') for u in active_users]:
                    # Add user to session
                    active_users.append({
                        'id': user_id_str,
                        'joined_at': datetime.utcnow().isoformat()
                    })

                    cur.execute("""
                        UPDATE workspace.docs_sessions
                        SET active_users = %s, updated_at = NOW()
                        WHERE id = %s
                    """, (json.dumps(active_users), str(row['id'])))
                    conn.commit()

                return dict(row)

            # Create new session
            session_token = hashlib.sha256(
                f"{document_id}:{user_id}:{datetime.utcnow().isoformat()}".encode()
            ).hexdigest()[:32]

            expires_at = datetime.utcnow() + timedelta(hours=session_duration_hours)

            cur.execute("""
                INSERT INTO workspace.docs_sessions (
                    document_id, session_token, active_users,
                    created_at, updated_at, expires_at
                ) VALUES (%s, %s, %s, NOW(), NOW(), %s)
                RETURNING *
            """, (
                str(document_id),
                session_token,
                json.dumps([{'id': str(user_id), 'joined_at': datetime.utcnow().isoformat()}]),
                expires_at
            ))

            row = cur.fetchone()
            conn.commit()

            logger.info(f"Created collaboration session for document {document_id}")

            return dict(row)

        except Exception as e:
            conn.rollback()
            logger.error(f"Failed to get/create session: {e}")
            raise
        finally:
            cur.close()
            conn.close()

    async def leave_session(
        self,
        document_id: UUID,
        user_id: UUID
    ) -> bool:
        """Remove user from a collaboration session."""
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            cur.execute("""
                SELECT id, active_users
                FROM workspace.docs_sessions
                WHERE document_id = %s AND expires_at > NOW()
                ORDER BY created_at DESC
                LIMIT 1
            """, (str(document_id),))

            row = cur.fetchone()
            if not row:
                return False

            active_users = row['active_users'] or []
            active_users = [u for u in active_users if u.get('id') != str(user_id)]

            cur.execute("""
                UPDATE workspace.docs_sessions
                SET active_users = %s, updated_at = NOW()
                WHERE id = %s
            """, (json.dumps(active_users), str(row['id'])))

            conn.commit()

            # Remove presence
            await self.remove_presence(document_id, user_id)

            return True

        except Exception as e:
            conn.rollback()
            raise
        finally:
            cur.close()
            conn.close()

    async def save_session_state(
        self,
        document_id: UUID,
        yjs_state: bytes
    ) -> bool:
        """Save Yjs document state to session."""
        conn = self._get_connection()
        cur = conn.cursor()

        try:
            cur.execute("""
                UPDATE workspace.docs_sessions
                SET yjs_state = %s, updated_at = NOW()
                WHERE document_id = %s AND expires_at > NOW()
            """, (yjs_state, str(document_id)))

            conn.commit()
            return cur.rowcount > 0

        except Exception as e:
            conn.rollback()
            raise
        finally:
            cur.close()
            conn.close()

    # =========================================================================
    # USER PRESENCE
    # =========================================================================

    async def update_presence(
        self,
        document_id: UUID,
        user_id: UUID,
        user_name: str,
        cursor_position: Optional[Dict] = None,
        selection: Optional[Dict] = None,
        user_avatar: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Update user presence in a document.

        Args:
            document_id: Document ID
            user_id: User ID
            user_name: Display name
            cursor_position: Cursor position {from, to}
            selection: Selection range
            user_avatar: Avatar URL

        Returns:
            Presence info
        """
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            # Assign a consistent color based on user_id
            color_index = int(hashlib.md5(str(user_id).encode()).hexdigest()[:8], 16) % len(CURSOR_COLORS)
            color = CURSOR_COLORS[color_index]

            cur.execute("""
                INSERT INTO workspace.docs_presence (
                    document_id, user_id, user_name, user_avatar,
                    cursor_position, selection, color, last_seen_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
                ON CONFLICT (document_id, user_id) DO UPDATE SET
                    user_name = EXCLUDED.user_name,
                    user_avatar = EXCLUDED.user_avatar,
                    cursor_position = EXCLUDED.cursor_position,
                    selection = EXCLUDED.selection,
                    last_seen_at = NOW()
                RETURNING *
            """, (
                str(document_id), str(user_id), user_name, user_avatar,
                json.dumps(cursor_position) if cursor_position else None,
                json.dumps(selection) if selection else None,
                color
            ))

            row = cur.fetchone()
            conn.commit()

            return dict(row)

        except Exception as e:
            conn.rollback()
            logger.error(f"Failed to update presence: {e}")
            raise
        finally:
            cur.close()
            conn.close()

    async def remove_presence(
        self,
        document_id: UUID,
        user_id: UUID
    ) -> bool:
        """Remove user presence from a document."""
        conn = self._get_connection()
        cur = conn.cursor()

        try:
            cur.execute("""
                DELETE FROM workspace.docs_presence
                WHERE document_id = %s AND user_id = %s
            """, (str(document_id), str(user_id)))

            conn.commit()
            return cur.rowcount > 0

        except Exception as e:
            conn.rollback()
            raise
        finally:
            cur.close()
            conn.close()

    async def get_presence(
        self,
        document_id: UUID,
        stale_threshold_seconds: int = 30
    ) -> List[Dict[str, Any]]:
        """
        Get active users in a document.

        Args:
            document_id: Document ID
            stale_threshold_seconds: Consider users stale after this time

        Returns:
            List of active users with their cursors
        """
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            threshold = datetime.utcnow() - timedelta(seconds=stale_threshold_seconds)

            cur.execute("""
                SELECT
                    user_id, user_name, user_avatar,
                    cursor_position, selection, color, last_seen_at
                FROM workspace.docs_presence
                WHERE document_id = %s AND last_seen_at > %s
                ORDER BY last_seen_at DESC
            """, (str(document_id), threshold))

            return [dict(row) for row in cur.fetchall()]

        finally:
            cur.close()
            conn.close()

    async def cleanup_stale_presence(
        self,
        stale_threshold_minutes: int = 5
    ) -> int:
        """Remove stale presence records."""
        conn = self._get_connection()
        cur = conn.cursor()

        try:
            threshold = datetime.utcnow() - timedelta(minutes=stale_threshold_minutes)

            cur.execute("""
                DELETE FROM workspace.docs_presence
                WHERE last_seen_at < %s
            """, (threshold,))

            count = cur.rowcount
            conn.commit()

            if count > 0:
                logger.info(f"Cleaned up {count} stale presence records")

            return count

        except Exception as e:
            conn.rollback()
            raise
        finally:
            cur.close()
            conn.close()

    # =========================================================================
    # VERSION HISTORY
    # =========================================================================

    async def get_version_content(
        self,
        document_id: UUID,
        version_number: int
    ) -> Optional[Dict[str, Any]]:
        """Get editor content for a specific version."""
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            cur.execute("""
                SELECT
                    dv.id, dv.version_number, dv.change_summary,
                    dv.created_by, dv.created_at,
                    vc.editor_content
                FROM dms.document_versions dv
                LEFT JOIN dms.version_content vc ON dv.id = vc.version_id
                WHERE dv.document_id = %s AND dv.version_number = %s
            """, (str(document_id), version_number))

            row = cur.fetchone()
            return dict(row) if row else None

        finally:
            cur.close()
            conn.close()

    async def restore_version(
        self,
        document_id: UUID,
        version_number: int,
        user_id: UUID
    ) -> Dict[str, Any]:
        """Restore document to a previous version."""
        version = await self.get_version_content(document_id, version_number)
        if not version or not version.get('editor_content'):
            raise ValueError(f"Version {version_number} not found or has no content")

        # Save current state as new version first
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            # Get current content
            cur.execute("""
                SELECT editor_content, current_version
                FROM dms.documents
                WHERE id = %s
            """, (str(document_id),))

            current = cur.fetchone()
            if current and current['editor_content']:
                # Save current as new version
                new_version = (current['current_version'] or 0) + 1

                cur.execute("""
                    INSERT INTO dms.document_versions (
                        document_id, version_number, file_path,
                        change_summary, created_by, created_at
                    ) VALUES (%s, %s, %s, %s, %s, NOW())
                    RETURNING id
                """, (
                    str(document_id),
                    new_version,
                    f"editor_content_v{new_version}",
                    f"Before restoring to version {version_number}",
                    str(user_id)
                ))

                backup_version = cur.fetchone()

                cur.execute("""
                    INSERT INTO dms.version_content (version_id, editor_content)
                    VALUES (%s, %s)
                """, (str(backup_version['id']), current['editor_content']))

            conn.commit()

            # Restore the old version
            return await self.save_editor_content(
                document_id,
                version['editor_content'],
                user_id,
                create_version=True
            )

        except Exception as e:
            conn.rollback()
            raise
        finally:
            cur.close()
            conn.close()

    # =========================================================================
    # HELPER METHODS
    # =========================================================================

    async def _log_edit_action(
        self,
        document_id: UUID,
        user_id: UUID,
        action: str,
        cur,
        conn
    ):
        """Log document edit action."""
        try:
            cur.execute("""
                INSERT INTO dms.document_audit_logs (
                    document_id, action, performed_by, performed_at
                ) VALUES (%s, %s::dms.auditaction, %s, NOW())
            """, (str(document_id), action, str(user_id)))
            conn.commit()
        except Exception as e:
            logger.warning(f"Failed to log audit: {e}")


# Singleton instance
_editor_service: Optional[DocsEditorService] = None


def get_docs_editor_service() -> DocsEditorService:
    """Get or create editor service instance."""
    global _editor_service
    if _editor_service is None:
        _editor_service = DocsEditorService()
    return _editor_service
