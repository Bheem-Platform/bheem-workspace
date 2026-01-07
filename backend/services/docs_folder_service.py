"""
Bheem Docs - Folder Service
============================
Handles folder management using ERP DMS schema.
Supports hierarchical folder structure with path-based navigation.

DMS Schema Tables Used:
- dms.folders - Folder structure
"""

from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
import logging
import psycopg2
from psycopg2.extras import RealDictCursor

from core.config import settings

logger = logging.getLogger(__name__)


class DocsFolderService:
    """
    Folder management service integrated with ERP DMS.

    Features:
    - Hierarchical folder structure
    - Path-based navigation
    - Folder tree retrieval
    - Move/rename operations
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

    async def create_folder(
        self,
        name: str,
        company_id: UUID,
        created_by: UUID,
        parent_id: Optional[UUID] = None,
        tenant_id: Optional[UUID] = None,
        description: Optional[str] = None,
        color: Optional[str] = None,
        icon: Optional[str] = None,
        is_system: bool = False
    ) -> Dict[str, Any]:
        """
        Create a new folder.

        Args:
            name: Folder name
            company_id: ERP company ID
            created_by: User creating the folder
            parent_id: Parent folder ID (None for root)
            tenant_id: SaaS tenant ID (for external mode)
            description: Folder description
            color: Folder color for UI
            icon: Folder icon
            is_system: Whether this is a system folder

        Returns:
            Created folder details
        """
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            # Calculate path and level
            if parent_id:
                cur.execute(
                    "SELECT path, level FROM dms.folders WHERE id = %s",
                    (str(parent_id),)
                )
                parent = cur.fetchone()
                if not parent:
                    raise ValueError(f"Parent folder not found: {parent_id}")

                path = f"{parent['path']}/{name}"
                level = (parent['level'] or 0) + 1
            else:
                path = f"/{name}"
                level = 0

            # Check for duplicate path
            cur.execute(
                "SELECT id FROM dms.folders WHERE path = %s AND company_id = %s",
                (path, str(company_id))
            )
            if cur.fetchone():
                raise ValueError(f"Folder already exists at path: {path}")

            # Insert folder
            cur.execute("""
                INSERT INTO dms.folders (
                    name, description, parent_id, company_id,
                    path, level, is_system, color, icon,
                    created_by, created_at, updated_at, is_active
                ) VALUES (
                    %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, NOW(), NOW(), true
                )
                RETURNING id, name, path, level, created_at
            """, (
                name, description, str(parent_id) if parent_id else None,
                str(company_id), path, level, is_system, color, icon,
                str(created_by)
            ))

            row = cur.fetchone()
            conn.commit()

            logger.info(f"Created folder: {row['id']} - {path}")

            return {
                'id': str(row['id']),
                'name': row['name'],
                'path': row['path'],
                'level': row['level'],
                'parent_id': str(parent_id) if parent_id else None,
                'created_at': row['created_at'].isoformat()
            }

        except Exception as e:
            conn.rollback()
            logger.error(f"Failed to create folder: {e}")
            raise
        finally:
            cur.close()
            conn.close()

    async def get_folder(self, folder_id: UUID) -> Optional[Dict[str, Any]]:
        """Get folder by ID."""
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            cur.execute("""
                SELECT
                    f.*,
                    pf.name as parent_name,
                    (SELECT COUNT(*) FROM dms.folders WHERE parent_id = f.id AND is_active = true) as subfolder_count,
                    (SELECT COUNT(*) FROM dms.documents WHERE folder_id = f.id AND is_active = true) as document_count
                FROM dms.folders f
                LEFT JOIN dms.folders pf ON f.parent_id = pf.id
                WHERE f.id = %s AND f.is_active = true
            """, (str(folder_id),))

            row = cur.fetchone()
            return dict(row) if row else None

        finally:
            cur.close()
            conn.close()

    async def list_folders(
        self,
        company_id: UUID,
        parent_id: Optional[UUID] = None,
        tenant_id: Optional[UUID] = None,
        include_document_count: bool = True
    ) -> List[Dict[str, Any]]:
        """
        List folders at a specific level.

        Args:
            company_id: ERP company ID
            parent_id: Parent folder ID (None for root folders)
            tenant_id: SaaS tenant ID
            include_document_count: Include document counts

        Returns:
            List of folders
        """
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            conditions = ["f.is_active = true", "f.company_id = %s"]
            params = [str(company_id)]

            if parent_id:
                conditions.append("f.parent_id = %s")
                params.append(str(parent_id))
            else:
                conditions.append("f.parent_id IS NULL")

            if tenant_id:
                # Note: tenant_id column may need to be added to folders table
                pass

            where_clause = " AND ".join(conditions)

            if include_document_count:
                cur.execute(f"""
                    SELECT
                        f.id, f.name, f.description, f.path, f.level,
                        f.parent_id, f.color, f.icon, f.is_system,
                        f.created_at, f.updated_at,
                        (SELECT COUNT(*) FROM dms.folders WHERE parent_id = f.id AND is_active = true) as subfolder_count,
                        (SELECT COUNT(*) FROM dms.documents WHERE folder_id = f.id AND is_active = true) as document_count
                    FROM dms.folders f
                    WHERE {where_clause}
                    ORDER BY f.is_system DESC, f.name ASC
                """, params)
            else:
                cur.execute(f"""
                    SELECT
                        f.id, f.name, f.description, f.path, f.level,
                        f.parent_id, f.color, f.icon, f.is_system,
                        f.created_at, f.updated_at
                    FROM dms.folders f
                    WHERE {where_clause}
                    ORDER BY f.is_system DESC, f.name ASC
                """, params)

            return [dict(row) for row in cur.fetchall()]

        finally:
            cur.close()
            conn.close()

    async def get_folder_tree(
        self,
        company_id: UUID,
        max_depth: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Get complete folder tree structure.

        Returns nested folder structure for tree view.
        """
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            # Get all folders
            cur.execute("""
                SELECT
                    f.id, f.name, f.description, f.path, f.level,
                    f.parent_id, f.color, f.icon, f.is_system,
                    (SELECT COUNT(*) FROM dms.documents WHERE folder_id = f.id AND is_active = true) as document_count
                FROM dms.folders f
                WHERE f.company_id = %s AND f.is_active = true
                ORDER BY f.path
            """, (str(company_id),))

            all_folders = [dict(row) for row in cur.fetchall()]

            # Build tree structure
            folder_map = {str(f['id']): {**f, 'children': []} for f in all_folders}
            root_folders = []

            for folder in all_folders:
                folder_id = str(folder['id'])
                parent_id = str(folder['parent_id']) if folder['parent_id'] else None

                if parent_id and parent_id in folder_map:
                    folder_map[parent_id]['children'].append(folder_map[folder_id])
                elif not parent_id:
                    root_folders.append(folder_map[folder_id])

            return root_folders

        finally:
            cur.close()
            conn.close()

    async def get_breadcrumb(self, folder_id: UUID) -> List[Dict[str, Any]]:
        """
        Get breadcrumb path for a folder.

        Returns list of ancestors from root to current folder.
        """
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            cur.execute("""
                WITH RECURSIVE folder_path AS (
                    SELECT id, name, parent_id, path, 1 as depth
                    FROM dms.folders
                    WHERE id = %s

                    UNION ALL

                    SELECT f.id, f.name, f.parent_id, f.path, fp.depth + 1
                    FROM dms.folders f
                    JOIN folder_path fp ON f.id = fp.parent_id
                )
                SELECT id, name, path
                FROM folder_path
                ORDER BY depth DESC
            """, (str(folder_id),))

            return [dict(row) for row in cur.fetchall()]

        finally:
            cur.close()
            conn.close()

    async def update_folder(
        self,
        folder_id: UUID,
        updated_by: UUID,
        name: Optional[str] = None,
        description: Optional[str] = None,
        color: Optional[str] = None,
        icon: Optional[str] = None
    ) -> Dict[str, Any]:
        """Update folder metadata."""
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            # Get current folder
            cur.execute(
                "SELECT * FROM dms.folders WHERE id = %s AND is_active = true",
                (str(folder_id),)
            )
            folder = cur.fetchone()
            if not folder:
                raise ValueError(f"Folder not found: {folder_id}")

            # Build update
            updates = ["updated_at = NOW()", "updated_by = %s"]
            params = [str(updated_by)]

            if name is not None and name != folder['name']:
                updates.append("name = %s")
                params.append(name)

                # Update path
                old_path = folder['path']
                if folder['parent_id']:
                    cur.execute(
                        "SELECT path FROM dms.folders WHERE id = %s",
                        (str(folder['parent_id']),)
                    )
                    parent = cur.fetchone()
                    new_path = f"{parent['path']}/{name}"
                else:
                    new_path = f"/{name}"

                updates.append("path = %s")
                params.append(new_path)

                # Update child paths
                cur.execute("""
                    UPDATE dms.folders
                    SET path = %s || substring(path from %s)
                    WHERE path LIKE %s AND id != %s
                """, (new_path, len(old_path) + 1, f"{old_path}/%", str(folder_id)))

            if description is not None:
                updates.append("description = %s")
                params.append(description)
            if color is not None:
                updates.append("color = %s")
                params.append(color)
            if icon is not None:
                updates.append("icon = %s")
                params.append(icon)

            params.append(str(folder_id))

            cur.execute(f"""
                UPDATE dms.folders SET {', '.join(updates)}
                WHERE id = %s
                RETURNING id, name, path, updated_at
            """, params)

            row = cur.fetchone()
            conn.commit()

            return dict(row)

        except Exception as e:
            conn.rollback()
            raise
        finally:
            cur.close()
            conn.close()

    async def move_folder(
        self,
        folder_id: UUID,
        new_parent_id: Optional[UUID],
        moved_by: UUID
    ) -> Dict[str, Any]:
        """
        Move folder to a new parent.

        Args:
            folder_id: Folder to move
            new_parent_id: New parent folder (None for root)
            moved_by: User performing the move
        """
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            # Get current folder
            cur.execute(
                "SELECT * FROM dms.folders WHERE id = %s AND is_active = true",
                (str(folder_id),)
            )
            folder = cur.fetchone()
            if not folder:
                raise ValueError(f"Folder not found: {folder_id}")

            # Prevent moving to self or descendant
            if new_parent_id:
                cur.execute(
                    "SELECT path FROM dms.folders WHERE id = %s",
                    (str(new_parent_id),)
                )
                new_parent = cur.fetchone()
                if not new_parent:
                    raise ValueError(f"Target folder not found: {new_parent_id}")

                if new_parent['path'].startswith(folder['path']):
                    raise ValueError("Cannot move folder into its own descendant")

            old_path = folder['path']

            # Calculate new path
            if new_parent_id:
                cur.execute(
                    "SELECT path, level FROM dms.folders WHERE id = %s",
                    (str(new_parent_id),)
                )
                parent = cur.fetchone()
                new_path = f"{parent['path']}/{folder['name']}"
                new_level = (parent['level'] or 0) + 1
            else:
                new_path = f"/{folder['name']}"
                new_level = 0

            # Check for path conflict
            cur.execute(
                "SELECT id FROM dms.folders WHERE path = %s AND company_id = %s AND id != %s",
                (new_path, str(folder['company_id']), str(folder_id))
            )
            if cur.fetchone():
                raise ValueError(f"A folder already exists at: {new_path}")

            # Update folder
            cur.execute("""
                UPDATE dms.folders SET
                    parent_id = %s,
                    path = %s,
                    level = %s,
                    updated_at = NOW(),
                    updated_by = %s
                WHERE id = %s
            """, (
                str(new_parent_id) if new_parent_id else None,
                new_path, new_level, str(moved_by), str(folder_id)
            ))

            # Update all child paths and levels
            level_diff = new_level - (folder['level'] or 0)
            cur.execute("""
                UPDATE dms.folders SET
                    path = %s || substring(path from %s),
                    level = level + %s
                WHERE path LIKE %s AND id != %s
            """, (new_path, len(old_path) + 1, level_diff, f"{old_path}/%", str(folder_id)))

            conn.commit()

            return {
                'id': str(folder_id),
                'old_path': old_path,
                'new_path': new_path,
                'new_parent_id': str(new_parent_id) if new_parent_id else None
            }

        except Exception as e:
            conn.rollback()
            raise
        finally:
            cur.close()
            conn.close()

    async def delete_folder(
        self,
        folder_id: UUID,
        deleted_by: UUID,
        recursive: bool = False
    ) -> bool:
        """
        Delete a folder.

        Args:
            folder_id: Folder to delete
            deleted_by: User performing deletion
            recursive: If True, delete contents; otherwise fail if not empty
        """
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            # Check if folder exists
            cur.execute(
                "SELECT * FROM dms.folders WHERE id = %s AND is_active = true",
                (str(folder_id),)
            )
            folder = cur.fetchone()
            if not folder:
                raise ValueError(f"Folder not found: {folder_id}")

            # Check if system folder
            if folder['is_system']:
                raise ValueError("Cannot delete system folder")

            # Check for contents
            cur.execute(
                "SELECT COUNT(*) as count FROM dms.folders WHERE parent_id = %s AND is_active = true",
                (str(folder_id),)
            )
            subfolder_count = cur.fetchone()['count']

            cur.execute(
                "SELECT COUNT(*) as count FROM dms.documents WHERE folder_id = %s AND is_active = true",
                (str(folder_id),)
            )
            document_count = cur.fetchone()['count']

            if (subfolder_count > 0 or document_count > 0) and not recursive:
                raise ValueError(
                    f"Folder is not empty ({subfolder_count} subfolders, {document_count} documents). "
                    "Use recursive=true to delete contents."
                )

            if recursive:
                # Soft delete all documents in folder and subfolders
                cur.execute("""
                    UPDATE dms.documents SET
                        deleted_at = NOW(),
                        deleted_by = %s,
                        is_active = false
                    WHERE folder_id IN (
                        SELECT id FROM dms.folders
                        WHERE path LIKE %s OR id = %s
                    )
                """, (str(deleted_by), f"{folder['path']}/%", str(folder_id)))

                # Soft delete all subfolders
                cur.execute("""
                    UPDATE dms.folders SET
                        deleted_at = NOW(),
                        deleted_by = %s,
                        is_active = false
                    WHERE path LIKE %s
                """, (str(deleted_by), f"{folder['path']}/%"))

            # Soft delete the folder
            cur.execute("""
                UPDATE dms.folders SET
                    deleted_at = NOW(),
                    deleted_by = %s,
                    is_active = false,
                    is_deleted = true
                WHERE id = %s
            """, (str(deleted_by), str(folder_id)))

            conn.commit()
            return True

        except Exception as e:
            conn.rollback()
            raise
        finally:
            cur.close()
            conn.close()

    async def get_folder_by_path(
        self,
        path: str,
        company_id: UUID
    ) -> Optional[Dict[str, Any]]:
        """Get folder by path."""
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            cur.execute("""
                SELECT * FROM dms.folders
                WHERE path = %s AND company_id = %s AND is_active = true
            """, (path, str(company_id)))

            row = cur.fetchone()
            return dict(row) if row else None

        finally:
            cur.close()
            conn.close()


# Singleton instance
_folder_service: Optional[DocsFolderService] = None


def get_docs_folder_service() -> DocsFolderService:
    """Get or create folder service instance."""
    global _folder_service
    if _folder_service is None:
        _folder_service = DocsFolderService()
    return _folder_service
