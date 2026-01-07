"""
Bheem Docs - Comments & Annotations Service
============================================
Manages document comments, replies, and annotations.
Supports threaded discussions and @mentions.

Database Tables:
- dms.document_comments - Comments on documents
"""

from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
import logging
import json
import re
import psycopg2
from psycopg2.extras import RealDictCursor

from core.config import settings

logger = logging.getLogger(__name__)


class DocsCommentsService:
    """
    Document comments and annotations service.

    Features:
    - Inline comments at specific positions
    - Threaded replies
    - @mentions with notifications
    - Comment resolution
    - Annotation highlights
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

    def _get_connection(self):
        """Get database connection."""
        return psycopg2.connect(**self.db_config)

    # =========================================================================
    # COMMENT CRUD
    # =========================================================================

    async def create_comment(
        self,
        document_id: UUID,
        user_id: UUID,
        content: str,
        position: Optional[Dict] = None,
        selection_text: Optional[str] = None,
        parent_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Create a new comment on a document.

        Args:
            document_id: Document ID
            user_id: User creating the comment
            content: Comment text (supports markdown)
            position: Position in document {from, to} for inline comments
            selection_text: Selected text being commented on
            parent_id: Parent comment ID for replies

        Returns:
            Created comment
        """
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            # Extract mentions
            mentions = self._extract_mentions(content)

            cur.execute("""
                INSERT INTO dms.document_comments (
                    document_id, content, position, selection_text,
                    parent_id, created_by, created_at, updated_at,
                    mentions, is_resolved
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, NOW(), NOW(), %s, false
                )
                RETURNING *
            """, (
                str(document_id),
                content,
                json.dumps(position) if position else None,
                selection_text,
                str(parent_id) if parent_id else None,
                str(user_id),
                json.dumps(mentions) if mentions else None
            ))

            row = cur.fetchone()
            conn.commit()

            # Get user info
            comment = dict(row)
            comment['user'] = await self._get_user_info(user_id)

            # Create notifications for mentions
            if mentions:
                await self._create_mention_notifications(
                    document_id, UUID(row['id']), user_id, mentions
                )

            logger.info(f"Created comment on document {document_id}")

            return comment

        except Exception as e:
            conn.rollback()
            logger.error(f"Failed to create comment: {e}")
            raise
        finally:
            cur.close()
            conn.close()

    async def get_comment(
        self,
        comment_id: UUID
    ) -> Optional[Dict[str, Any]]:
        """Get a comment by ID."""
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            cur.execute("""
                SELECT c.*, u.username as user_name, u.email as user_email, NULL as user_avatar
                FROM dms.document_comments c
                LEFT JOIN auth.users u ON c.created_by = u.id
                WHERE c.id = %s AND c.deleted_at IS NULL
            """, (str(comment_id),))

            row = cur.fetchone()
            return dict(row) if row else None

        finally:
            cur.close()
            conn.close()

    async def list_document_comments(
        self,
        document_id: UUID,
        include_resolved: bool = False,
        parent_id: Optional[UUID] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        List comments for a document.

        Args:
            document_id: Document ID
            include_resolved: Include resolved comments
            parent_id: Filter by parent (None = top-level only)
            limit: Max results
            offset: Pagination offset

        Returns:
            List of comments with user info and reply counts
        """
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            conditions = ["c.document_id = %s", "c.deleted_at IS NULL"]
            params = [str(document_id)]

            if not include_resolved:
                conditions.append("c.is_resolved = false")

            if parent_id:
                conditions.append("c.parent_id = %s")
                params.append(str(parent_id))
            else:
                conditions.append("c.parent_id IS NULL")

            where_clause = " AND ".join(conditions)
            params.extend([limit, offset])

            cur.execute(f"""
                SELECT
                    c.*,
                    u.username as user_name,
                    u.email as user_email,
                    NULL as user_avatar,
                    (SELECT COUNT(*) FROM dms.document_comments r
                     WHERE r.parent_id = c.id AND r.deleted_at IS NULL) as reply_count
                FROM dms.document_comments c
                LEFT JOIN auth.users u ON c.created_by = u.id
                WHERE {where_clause}
                ORDER BY c.created_at DESC
                LIMIT %s OFFSET %s
            """, params)

            comments = []
            for row in cur.fetchall():
                comment = dict(row)
                comment['user'] = {
                    'name': row['user_name'],
                    'email': row['user_email'],
                    'avatar': row['user_avatar']
                }
                comments.append(comment)

            return comments

        finally:
            cur.close()
            conn.close()

    async def get_comment_thread(
        self,
        comment_id: UUID
    ) -> Dict[str, Any]:
        """
        Get a comment with all its replies.

        Args:
            comment_id: Parent comment ID

        Returns:
            Comment with nested replies
        """
        comment = await self.get_comment(comment_id)
        if not comment:
            return None

        # Get replies
        replies = await self.list_document_comments(
            document_id=UUID(comment['document_id']),
            parent_id=comment_id,
            include_resolved=True
        )

        comment['replies'] = replies
        return comment

    async def update_comment(
        self,
        comment_id: UUID,
        user_id: UUID,
        content: str
    ) -> Optional[Dict[str, Any]]:
        """
        Update a comment.

        Only the comment author can edit.
        """
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            # Verify ownership
            cur.execute("""
                SELECT created_by FROM dms.document_comments
                WHERE id = %s AND deleted_at IS NULL
            """, (str(comment_id),))

            row = cur.fetchone()
            if not row or row['created_by'] != str(user_id):
                return None

            # Extract new mentions
            mentions = self._extract_mentions(content)

            cur.execute("""
                UPDATE dms.document_comments
                SET content = %s, mentions = %s, updated_at = NOW(), is_edited = true
                WHERE id = %s
                RETURNING *
            """, (content, json.dumps(mentions) if mentions else None, str(comment_id)))

            row = cur.fetchone()
            conn.commit()

            return dict(row) if row else None

        except Exception as e:
            conn.rollback()
            raise
        finally:
            cur.close()
            conn.close()

    async def delete_comment(
        self,
        comment_id: UUID,
        user_id: UUID,
        is_admin: bool = False
    ) -> bool:
        """
        Soft delete a comment.

        Only the author or an admin can delete.
        """
        conn = self._get_connection()
        cur = conn.cursor()

        try:
            if is_admin:
                cur.execute("""
                    UPDATE dms.document_comments
                    SET deleted_at = NOW(), deleted_by = %s
                    WHERE id = %s
                """, (str(user_id), str(comment_id)))
            else:
                cur.execute("""
                    UPDATE dms.document_comments
                    SET deleted_at = NOW(), deleted_by = %s
                    WHERE id = %s AND created_by = %s
                """, (str(user_id), str(comment_id), str(user_id)))

            conn.commit()
            return cur.rowcount > 0

        except Exception as e:
            conn.rollback()
            raise
        finally:
            cur.close()
            conn.close()

    # =========================================================================
    # COMMENT RESOLUTION
    # =========================================================================

    async def resolve_comment(
        self,
        comment_id: UUID,
        user_id: UUID
    ) -> Optional[Dict[str, Any]]:
        """Mark a comment thread as resolved."""
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            cur.execute("""
                UPDATE dms.document_comments
                SET is_resolved = true, resolved_at = NOW(), resolved_by = %s
                WHERE id = %s AND parent_id IS NULL
                RETURNING *
            """, (str(user_id), str(comment_id)))

            row = cur.fetchone()
            conn.commit()

            return dict(row) if row else None

        except Exception as e:
            conn.rollback()
            raise
        finally:
            cur.close()
            conn.close()

    async def unresolve_comment(
        self,
        comment_id: UUID
    ) -> Optional[Dict[str, Any]]:
        """Mark a comment thread as unresolved."""
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            cur.execute("""
                UPDATE dms.document_comments
                SET is_resolved = false, resolved_at = NULL, resolved_by = NULL
                WHERE id = %s AND parent_id IS NULL
                RETURNING *
            """, (str(comment_id),))

            row = cur.fetchone()
            conn.commit()

            return dict(row) if row else None

        except Exception as e:
            conn.rollback()
            raise
        finally:
            cur.close()
            conn.close()

    # =========================================================================
    # REACTIONS
    # =========================================================================

    async def add_reaction(
        self,
        comment_id: UUID,
        user_id: UUID,
        emoji: str
    ) -> Dict[str, Any]:
        """Add a reaction to a comment."""
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            cur.execute("""
                INSERT INTO dms.comment_reactions (
                    comment_id, user_id, emoji, created_at
                ) VALUES (%s, %s, %s, NOW())
                ON CONFLICT (comment_id, user_id, emoji) DO NOTHING
                RETURNING *
            """, (str(comment_id), str(user_id), emoji))

            row = cur.fetchone()
            conn.commit()

            # Get reaction counts
            return await self.get_reaction_counts(comment_id)

        except Exception as e:
            conn.rollback()
            raise
        finally:
            cur.close()
            conn.close()

    async def remove_reaction(
        self,
        comment_id: UUID,
        user_id: UUID,
        emoji: str
    ) -> Dict[str, Any]:
        """Remove a reaction from a comment."""
        conn = self._get_connection()
        cur = conn.cursor()

        try:
            cur.execute("""
                DELETE FROM dms.comment_reactions
                WHERE comment_id = %s AND user_id = %s AND emoji = %s
            """, (str(comment_id), str(user_id), emoji))

            conn.commit()

            return await self.get_reaction_counts(comment_id)

        except Exception as e:
            conn.rollback()
            raise
        finally:
            cur.close()
            conn.close()

    async def get_reaction_counts(
        self,
        comment_id: UUID
    ) -> Dict[str, Any]:
        """Get reaction counts for a comment."""
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            cur.execute("""
                SELECT emoji, COUNT(*) as count,
                       array_agg(user_id) as users
                FROM dms.comment_reactions
                WHERE comment_id = %s
                GROUP BY emoji
            """, (str(comment_id),))

            reactions = {}
            for row in cur.fetchall():
                reactions[row['emoji']] = {
                    'count': row['count'],
                    'users': row['users']
                }

            return {"comment_id": str(comment_id), "reactions": reactions}

        finally:
            cur.close()
            conn.close()

    # =========================================================================
    # ANNOTATIONS
    # =========================================================================

    async def create_annotation(
        self,
        document_id: UUID,
        user_id: UUID,
        annotation_type: str,
        position: Dict,
        color: str = "#ffeb3b",
        note: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create an annotation (highlight, underline, etc.).

        Args:
            document_id: Document ID
            user_id: User creating annotation
            annotation_type: Type (highlight, underline, strikethrough)
            position: Position {from, to}
            color: Annotation color
            note: Optional note

        Returns:
            Created annotation
        """
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            cur.execute("""
                INSERT INTO dms.document_annotations (
                    document_id, annotation_type, position, color,
                    note, created_by, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, NOW())
                RETURNING *
            """, (
                str(document_id),
                annotation_type,
                json.dumps(position),
                color,
                note,
                str(user_id)
            ))

            row = cur.fetchone()
            conn.commit()

            return dict(row)

        except Exception as e:
            conn.rollback()
            raise
        finally:
            cur.close()
            conn.close()

    async def list_annotations(
        self,
        document_id: UUID,
        user_id: Optional[UUID] = None
    ) -> List[Dict[str, Any]]:
        """List annotations for a document."""
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            if user_id:
                cur.execute("""
                    SELECT * FROM dms.document_annotations
                    WHERE document_id = %s AND created_by = %s
                    ORDER BY position->>'from' ASC
                """, (str(document_id), str(user_id)))
            else:
                cur.execute("""
                    SELECT * FROM dms.document_annotations
                    WHERE document_id = %s
                    ORDER BY position->>'from' ASC
                """, (str(document_id),))

            return [dict(row) for row in cur.fetchall()]

        finally:
            cur.close()
            conn.close()

    async def delete_annotation(
        self,
        annotation_id: UUID,
        user_id: UUID
    ) -> bool:
        """Delete an annotation."""
        conn = self._get_connection()
        cur = conn.cursor()

        try:
            cur.execute("""
                DELETE FROM dms.document_annotations
                WHERE id = %s AND created_by = %s
            """, (str(annotation_id), str(user_id)))

            conn.commit()
            return cur.rowcount > 0

        except Exception as e:
            conn.rollback()
            raise
        finally:
            cur.close()
            conn.close()

    # =========================================================================
    # HELPER METHODS
    # =========================================================================

    def _extract_mentions(self, content: str) -> List[str]:
        """Extract @mentions from comment content."""
        # Match @username or @[Full Name]
        pattern = r'@(\w+)|@\[([^\]]+)\]'
        matches = re.findall(pattern, content)
        return [m[0] or m[1] for m in matches if m[0] or m[1]]

    async def _get_user_info(self, user_id: UUID) -> Dict[str, Any]:
        """Get user info for display."""
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            cur.execute("""
                SELECT username as name, email, NULL as avatar
                FROM auth.users
                WHERE id = %s
                LIMIT 1
            """, (str(user_id),))

            row = cur.fetchone()
            return dict(row) if row else {'name': 'Unknown', 'email': '', 'avatar': None}

        finally:
            cur.close()
            conn.close()

    async def _create_mention_notifications(
        self,
        document_id: UUID,
        comment_id: UUID,
        from_user_id: UUID,
        mentions: List[str]
    ) -> None:
        """Create notifications for mentioned users."""
        # Implementation would create notifications
        # For now, just log
        logger.info(f"Would notify users {mentions} about mention in comment {comment_id}")

    # =========================================================================
    # STATISTICS
    # =========================================================================

    async def get_document_comment_stats(
        self,
        document_id: UUID
    ) -> Dict[str, Any]:
        """Get comment statistics for a document."""
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            cur.execute("""
                SELECT
                    COUNT(*) FILTER (WHERE parent_id IS NULL) as total_threads,
                    COUNT(*) as total_comments,
                    COUNT(*) FILTER (WHERE is_resolved = true AND parent_id IS NULL) as resolved_threads,
                    COUNT(*) FILTER (WHERE is_resolved = false AND parent_id IS NULL) as open_threads,
                    COUNT(DISTINCT created_by) as unique_commenters
                FROM dms.document_comments
                WHERE document_id = %s AND deleted_at IS NULL
            """, (str(document_id),))

            row = cur.fetchone()
            return dict(row) if row else {}

        finally:
            cur.close()
            conn.close()


# Singleton instance
_comments_service: Optional[DocsCommentsService] = None


def get_docs_comments_service() -> DocsCommentsService:
    """Get or create comments service instance."""
    global _comments_service
    if _comments_service is None:
        _comments_service = DocsCommentsService()
    return _comments_service
