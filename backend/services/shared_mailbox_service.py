"""
Bheem Workspace - Shared Mailbox Service
Enterprise feature for team inboxes and shared email management
"""
from typing import List, Dict, Optional, Any
from datetime import datetime
from uuid import UUID, uuid4
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from core.logging import get_logger

logger = get_logger("bheem.mail.shared")


class SharedMailboxService:
    """
    Service for managing shared mailboxes / team inboxes.

    Features:
    - Create and manage shared mailboxes
    - Manage mailbox members and permissions
    - Assign emails to team members
    - Internal comments on emails
    - Activity tracking
    """

    # ===========================================
    # Shared Mailbox CRUD
    # ===========================================

    async def create_mailbox(
        self,
        db: AsyncSession,
        tenant_id: str,
        email: str,
        name: str,
        description: Optional[str] = None,
        created_by: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a new shared mailbox."""
        mailbox_id = uuid4()

        query = text("""
            INSERT INTO workspace.shared_mailboxes
            (id, tenant_id, email, name, description, created_by)
            VALUES (:id, :tenant_id, :email, :name, :description, :created_by)
            RETURNING id, email, name, description, is_active, created_at
        """)

        result = await db.execute(query, {
            "id": str(mailbox_id),
            "tenant_id": tenant_id,
            "email": email,
            "name": name,
            "description": description,
            "created_by": created_by
        })
        row = result.fetchone()
        await db.commit()

        logger.info(
            f"Created shared mailbox: {email}",
            action="shared_mailbox_created",
            mailbox_id=str(mailbox_id)
        )

        # Add creator as admin
        if created_by:
            await self.add_member(
                db, str(mailbox_id), created_by,
                role="admin",
                can_send=True,
                can_delete=True,
                can_manage_members=True,
                added_by=created_by
            )

        return {
            "id": str(mailbox_id),
            "email": email,
            "name": name,
            "description": description,
            "is_active": True
        }

    async def get_mailbox(
        self,
        db: AsyncSession,
        mailbox_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get shared mailbox by ID."""
        query = text("""
            SELECT id, tenant_id, email, name, description, is_active, created_at
            FROM workspace.shared_mailboxes
            WHERE id = :mailbox_id
        """)

        result = await db.execute(query, {"mailbox_id": mailbox_id})
        row = result.fetchone()

        if not row:
            return None

        return {
            "id": str(row[0]),
            "tenant_id": str(row[1]),
            "email": row[2],
            "name": row[3],
            "description": row[4],
            "is_active": row[5],
            "created_at": row[6].isoformat() if row[6] else None
        }

    async def get_user_mailboxes(
        self,
        db: AsyncSession,
        user_id: str
    ) -> List[Dict[str, Any]]:
        """Get all shared mailboxes a user has access to."""
        query = text("""
            SELECT m.id, m.email, m.name, m.description, m.is_active,
                   sm.role, sm.can_send, sm.can_delete, sm.can_manage_members
            FROM workspace.shared_mailboxes m
            JOIN workspace.shared_mailbox_members sm ON m.id = sm.mailbox_id
            WHERE sm.user_id = :user_id AND m.is_active = TRUE
            ORDER BY m.name
        """)

        result = await db.execute(query, {"user_id": user_id})
        rows = result.fetchall()

        return [
            {
                "id": str(row[0]),
                "email": row[1],
                "name": row[2],
                "description": row[3],
                "is_active": row[4],
                "role": row[5],
                "can_send": row[6],
                "can_delete": row[7],
                "can_manage_members": row[8]
            }
            for row in rows
        ]

    async def get_tenant_mailboxes(
        self,
        db: AsyncSession,
        tenant_id: str
    ) -> List[Dict[str, Any]]:
        """Get all shared mailboxes for a tenant."""
        query = text("""
            SELECT id, email, name, description, is_active, created_at
            FROM workspace.shared_mailboxes
            WHERE tenant_id = :tenant_id
            ORDER BY name
        """)

        result = await db.execute(query, {"tenant_id": tenant_id})
        rows = result.fetchall()

        return [
            {
                "id": str(row[0]),
                "email": row[1],
                "name": row[2],
                "description": row[3],
                "is_active": row[4],
                "created_at": row[5].isoformat() if row[5] else None
            }
            for row in rows
        ]

    async def update_mailbox(
        self,
        db: AsyncSession,
        mailbox_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> bool:
        """Update shared mailbox details."""
        updates = []
        params = {"mailbox_id": mailbox_id}

        if name is not None:
            updates.append("name = :name")
            params["name"] = name

        if description is not None:
            updates.append("description = :description")
            params["description"] = description

        if is_active is not None:
            updates.append("is_active = :is_active")
            params["is_active"] = is_active

        if not updates:
            return False

        updates.append("updated_at = NOW()")

        query = text(f"""
            UPDATE workspace.shared_mailboxes
            SET {', '.join(updates)}
            WHERE id = :mailbox_id
        """)

        await db.execute(query, params)
        await db.commit()
        return True

    async def delete_mailbox(
        self,
        db: AsyncSession,
        mailbox_id: str
    ) -> bool:
        """Delete a shared mailbox (soft delete by deactivating)."""
        query = text("""
            UPDATE workspace.shared_mailboxes
            SET is_active = FALSE, updated_at = NOW()
            WHERE id = :mailbox_id
        """)

        await db.execute(query, {"mailbox_id": mailbox_id})
        await db.commit()
        return True

    # ===========================================
    # Member Management
    # ===========================================

    async def add_member(
        self,
        db: AsyncSession,
        mailbox_id: str,
        user_id: str,
        role: str = "member",
        can_send: bool = True,
        can_delete: bool = False,
        can_manage_members: bool = False,
        added_by: Optional[str] = None
    ) -> Dict[str, Any]:
        """Add a member to a shared mailbox."""
        member_id = uuid4()

        query = text("""
            INSERT INTO workspace.shared_mailbox_members
            (id, mailbox_id, user_id, role, can_send, can_delete, can_manage_members, added_by)
            VALUES (:id, :mailbox_id, :user_id, :role, :can_send, :can_delete, :can_manage_members, :added_by)
            ON CONFLICT (mailbox_id, user_id) DO UPDATE
            SET role = :role, can_send = :can_send, can_delete = :can_delete, can_manage_members = :can_manage_members
            RETURNING id
        """)

        await db.execute(query, {
            "id": str(member_id),
            "mailbox_id": mailbox_id,
            "user_id": user_id,
            "role": role,
            "can_send": can_send,
            "can_delete": can_delete,
            "can_manage_members": can_manage_members,
            "added_by": added_by
        })
        await db.commit()

        logger.info(
            f"Added member to shared mailbox",
            action="shared_mailbox_member_added",
            mailbox_id=mailbox_id,
            user_id=user_id,
            role=role
        )

        return {
            "id": str(member_id),
            "mailbox_id": mailbox_id,
            "user_id": user_id,
            "role": role,
            "can_send": can_send,
            "can_delete": can_delete,
            "can_manage_members": can_manage_members
        }

    async def remove_member(
        self,
        db: AsyncSession,
        mailbox_id: str,
        user_id: str
    ) -> bool:
        """Remove a member from a shared mailbox."""
        query = text("""
            DELETE FROM workspace.shared_mailbox_members
            WHERE mailbox_id = :mailbox_id AND user_id = :user_id
        """)

        await db.execute(query, {"mailbox_id": mailbox_id, "user_id": user_id})
        await db.commit()
        return True

    async def get_members(
        self,
        db: AsyncSession,
        mailbox_id: str
    ) -> List[Dict[str, Any]]:
        """Get all members of a shared mailbox."""
        query = text("""
            SELECT id, user_id, role, can_send, can_delete, can_manage_members, created_at
            FROM workspace.shared_mailbox_members
            WHERE mailbox_id = :mailbox_id
        """)

        result = await db.execute(query, {"mailbox_id": mailbox_id})
        rows = result.fetchall()

        return [
            {
                "id": str(row[0]),
                "user_id": str(row[1]),
                "role": row[2],
                "can_send": row[3],
                "can_delete": row[4],
                "can_manage_members": row[5],
                "created_at": row[6].isoformat() if row[6] else None
            }
            for row in rows
        ]

    async def check_permission(
        self,
        db: AsyncSession,
        mailbox_id: str,
        user_id: str,
        permission: str = "view"
    ) -> bool:
        """Check if user has specific permission on mailbox."""
        query = text("""
            SELECT role, can_send, can_delete, can_manage_members
            FROM workspace.shared_mailbox_members
            WHERE mailbox_id = :mailbox_id AND user_id = :user_id
        """)

        result = await db.execute(query, {"mailbox_id": mailbox_id, "user_id": user_id})
        row = result.fetchone()

        if not row:
            return False

        role, can_send, can_delete, can_manage_members = row

        if permission == "view":
            return True
        elif permission == "send":
            return can_send
        elif permission == "delete":
            return can_delete
        elif permission == "manage_members":
            return can_manage_members or role == "admin"
        elif permission == "admin":
            return role == "admin"

        return False

    # ===========================================
    # Email Assignment
    # ===========================================

    async def assign_email(
        self,
        db: AsyncSession,
        mailbox_id: str,
        message_id: str,
        assigned_to: str,
        assigned_by: str,
        priority: str = "normal",
        due_date: Optional[datetime] = None,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """Assign an email to a team member."""
        assignment_id = uuid4()

        query = text("""
            INSERT INTO workspace.shared_mailbox_assignments
            (id, mailbox_id, message_id, assigned_to, assigned_by, priority, due_date, notes)
            VALUES (:id, :mailbox_id, :message_id, :assigned_to, :assigned_by, :priority, :due_date, :notes)
            ON CONFLICT (mailbox_id, message_id) DO UPDATE
            SET assigned_to = :assigned_to, assigned_by = :assigned_by, priority = :priority, due_date = :due_date, notes = :notes, updated_at = NOW()
            RETURNING id, status, created_at
        """)

        result = await db.execute(query, {
            "id": str(assignment_id),
            "mailbox_id": mailbox_id,
            "message_id": message_id,
            "assigned_to": assigned_to,
            "assigned_by": assigned_by,
            "priority": priority,
            "due_date": due_date,
            "notes": notes
        })
        row = result.fetchone()
        await db.commit()

        # Log activity
        await self.log_activity(
            db, mailbox_id, "assigned", assigned_by,
            message_id=message_id,
            details={"assigned_to": assigned_to, "priority": priority}
        )

        return {
            "id": str(row[0]),
            "mailbox_id": mailbox_id,
            "message_id": message_id,
            "assigned_to": assigned_to,
            "status": row[1],
            "priority": priority,
            "due_date": due_date.isoformat() if due_date else None,
            "notes": notes
        }

    async def update_assignment_status(
        self,
        db: AsyncSession,
        mailbox_id: str,
        message_id: str,
        status: str,
        user_id: str
    ) -> bool:
        """Update assignment status."""
        query = text("""
            UPDATE workspace.shared_mailbox_assignments
            SET status = :status, updated_at = NOW()
            WHERE mailbox_id = :mailbox_id AND message_id = :message_id
        """)

        await db.execute(query, {"mailbox_id": mailbox_id, "message_id": message_id, "status": status})
        await db.commit()

        # Log activity
        await self.log_activity(
            db, mailbox_id, "status_changed", user_id,
            message_id=message_id,
            details={"new_status": status}
        )

        return True

    async def get_assignment(
        self,
        db: AsyncSession,
        mailbox_id: str,
        message_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get assignment for an email."""
        query = text("""
            SELECT id, assigned_to, assigned_by, status, priority, due_date, notes, created_at, updated_at
            FROM workspace.shared_mailbox_assignments
            WHERE mailbox_id = :mailbox_id AND message_id = :message_id
        """)

        result = await db.execute(query, {"mailbox_id": mailbox_id, "message_id": message_id})
        row = result.fetchone()

        if not row:
            return None

        return {
            "id": str(row[0]),
            "assigned_to": str(row[1]) if row[1] else None,
            "assigned_by": str(row[2]) if row[2] else None,
            "status": row[3],
            "priority": row[4],
            "due_date": row[5].isoformat() if row[5] else None,
            "notes": row[6],
            "created_at": row[7].isoformat() if row[7] else None,
            "updated_at": row[8].isoformat() if row[8] else None
        }

    async def get_user_assignments(
        self,
        db: AsyncSession,
        user_id: str,
        status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get all assignments for a user."""
        if status:
            query = text("""
                SELECT a.id, a.mailbox_id, a.message_id, a.status, a.priority,
                       a.due_date, a.notes, m.name as mailbox_name, m.email as mailbox_email
                FROM workspace.shared_mailbox_assignments a
                JOIN workspace.shared_mailboxes m ON a.mailbox_id = m.id
                WHERE a.assigned_to = :user_id AND a.status = :status
                ORDER BY a.due_date NULLS LAST, a.created_at DESC
            """)
            params = {"user_id": user_id, "status": status}
        else:
            query = text("""
                SELECT a.id, a.mailbox_id, a.message_id, a.status, a.priority,
                       a.due_date, a.notes, m.name as mailbox_name, m.email as mailbox_email
                FROM workspace.shared_mailbox_assignments a
                JOIN workspace.shared_mailboxes m ON a.mailbox_id = m.id
                WHERE a.assigned_to = :user_id
                ORDER BY a.due_date NULLS LAST, a.created_at DESC
            """)
            params = {"user_id": user_id}

        result = await db.execute(query, params)
        rows = result.fetchall()

        return [
            {
                "id": str(row[0]),
                "mailbox_id": str(row[1]),
                "message_id": row[2],
                "status": row[3],
                "priority": row[4],
                "due_date": row[5].isoformat() if row[5] else None,
                "notes": row[6],
                "mailbox_name": row[7],
                "mailbox_email": row[8]
            }
            for row in rows
        ]

    # ===========================================
    # Internal Comments
    # ===========================================

    async def add_comment(
        self,
        db: AsyncSession,
        mailbox_id: str,
        message_id: str,
        user_id: str,
        comment: str,
        is_internal: bool = True
    ) -> Dict[str, Any]:
        """Add an internal comment to an email."""
        comment_id = uuid4()

        query = text("""
            INSERT INTO workspace.shared_mailbox_comments
            (id, mailbox_id, message_id, user_id, comment, is_internal)
            VALUES (:id, :mailbox_id, :message_id, :user_id, :comment, :is_internal)
            RETURNING id, created_at
        """)

        result = await db.execute(query, {
            "id": str(comment_id),
            "mailbox_id": mailbox_id,
            "message_id": message_id,
            "user_id": user_id,
            "comment": comment,
            "is_internal": is_internal
        })
        row = result.fetchone()
        await db.commit()

        # Log activity
        await self.log_activity(
            db, mailbox_id, "commented", user_id,
            message_id=message_id,
            details={"is_internal": is_internal}
        )

        return {
            "id": str(row[0]),
            "mailbox_id": mailbox_id,
            "message_id": message_id,
            "user_id": user_id,
            "comment": comment,
            "is_internal": is_internal,
            "created_at": row[1].isoformat() if row[1] else None
        }

    async def get_comments(
        self,
        db: AsyncSession,
        mailbox_id: str,
        message_id: str
    ) -> List[Dict[str, Any]]:
        """Get all comments for an email."""
        query = text("""
            SELECT id, user_id, comment, is_internal, created_at
            FROM workspace.shared_mailbox_comments
            WHERE mailbox_id = :mailbox_id AND message_id = :message_id
            ORDER BY created_at ASC
        """)

        result = await db.execute(query, {"mailbox_id": mailbox_id, "message_id": message_id})
        rows = result.fetchall()

        return [
            {
                "id": str(row[0]),
                "user_id": str(row[1]),
                "comment": row[2],
                "is_internal": row[3],
                "created_at": row[4].isoformat() if row[4] else None
            }
            for row in rows
        ]

    async def delete_comment(
        self,
        db: AsyncSession,
        comment_id: str,
        user_id: str
    ) -> bool:
        """Delete a comment (only by author)."""
        query = text("""
            DELETE FROM workspace.shared_mailbox_comments
            WHERE id = :comment_id AND user_id = :user_id
        """)

        await db.execute(query, {"comment_id": comment_id, "user_id": user_id})
        await db.commit()
        return True

    # ===========================================
    # Activity Logging
    # ===========================================

    async def log_activity(
        self,
        db: AsyncSession,
        mailbox_id: str,
        action: str,
        user_id: str,
        message_id: Optional[str] = None,
        details: Optional[Dict] = None
    ):
        """Log activity on shared mailbox."""
        import json

        query = text("""
            INSERT INTO workspace.shared_mailbox_activity
            (id, mailbox_id, message_id, user_id, action, details)
            VALUES (:id, :mailbox_id, :message_id, :user_id, :action, :details)
        """)

        await db.execute(query, {
            "id": str(uuid4()),
            "mailbox_id": mailbox_id,
            "message_id": message_id,
            "user_id": user_id,
            "action": action,
            "details": json.dumps(details) if details else None
        })

    async def get_activity(
        self,
        db: AsyncSession,
        mailbox_id: str,
        message_id: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get activity log for mailbox or specific message."""
        import json

        if message_id:
            query = text("""
                SELECT id, message_id, user_id, action, details, created_at
                FROM workspace.shared_mailbox_activity
                WHERE mailbox_id = :mailbox_id AND message_id = :message_id
                ORDER BY created_at DESC
                LIMIT :limit
            """)
            params = {"mailbox_id": mailbox_id, "message_id": message_id, "limit": limit}
        else:
            query = text("""
                SELECT id, message_id, user_id, action, details, created_at
                FROM workspace.shared_mailbox_activity
                WHERE mailbox_id = :mailbox_id
                ORDER BY created_at DESC
                LIMIT :limit
            """)
            params = {"mailbox_id": mailbox_id, "limit": limit}

        result = await db.execute(query, params)
        rows = result.fetchall()

        return [
            {
                "id": str(row[0]),
                "message_id": row[1],
                "user_id": str(row[2]),
                "action": row[3],
                "details": json.loads(row[4]) if row[4] else None,
                "created_at": row[5].isoformat() if row[5] else None
            }
            for row in rows
        ]


# Singleton instance
shared_mailbox_service = SharedMailboxService()
