"""
Bheem Notes Service

Business logic for managing notes, labels, and related operations.
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import UUID

from sqlalchemy import select, and_, or_, func, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.notes_models import (
    Note,
    NoteLabel,
    NoteLabelAssociation,
    NoteCollaborator,
    NoteReminder,
    NoteAttachment,
    NoteActivityLog,
    NoteColor,
)


class NotesService:
    """Service for managing notes."""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ===========================================
    # Note CRUD Operations
    # ===========================================

    async def create_note(
        self,
        tenant_id: UUID,
        owner_id: UUID,
        title: Optional[str] = None,
        content: Optional[str] = None,
        content_html: Optional[str] = None,
        color: str = NoteColor.DEFAULT,
        is_pinned: bool = False,
        is_checklist: bool = False,
        checklist_items: Optional[List[Dict]] = None,
        label_ids: Optional[List[UUID]] = None,
    ) -> Note:
        """Create a new note."""
        # Calculate word count
        word_count = len(content.split()) if content else 0

        # Create the note
        note = Note(
            tenant_id=tenant_id,
            owner_id=owner_id,
            title=title,
            content=content,
            content_html=content_html,
            color=color,
            is_pinned=is_pinned,
            is_checklist=is_checklist,
            checklist_items=checklist_items,
            word_count=word_count,
        )

        self.db.add(note)
        await self.db.flush()

        # Add labels if provided
        if label_ids:
            await self._add_labels_to_note(note.id, label_ids)

        # Log activity
        await self._log_activity(note.id, owner_id, "created")

        await self.db.commit()

        # Just return the note ID - client can fetch full details if needed
        note_id = note.id
        return note_id

    async def get_note(
        self,
        note_id: UUID,
        tenant_id: UUID,
        user_id: UUID,
    ) -> Optional[Note]:
        """Get a note by ID with access check."""
        stmt = (
            select(Note)
            .options(
                selectinload(Note.labels),
                selectinload(Note.collaborators),
                selectinload(Note.reminders),
            )
            .where(
                and_(
                    Note.id == note_id,
                    Note.tenant_id == tenant_id,
                    or_(
                        Note.owner_id == user_id,
                        Note.collaborators.any(NoteCollaborator.user_id == user_id),
                    ),
                )
            )
        )

        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_notes(
        self,
        tenant_id: UUID,
        user_id: UUID,
        is_pinned: Optional[bool] = None,
        is_archived: bool = False,
        is_trashed: bool = False,
        label_id: Optional[UUID] = None,
        search: Optional[str] = None,
        color: Optional[str] = None,
        sort_by: str = "updated_at",
        sort_order: str = "desc",
        skip: int = 0,
        limit: int = 50,
    ) -> List[Note]:
        """List notes with filters."""
        stmt = (
            select(Note)
            .options(selectinload(Note.labels))
            .where(
                and_(
                    Note.tenant_id == tenant_id,
                    or_(
                        Note.owner_id == user_id,
                        Note.collaborators.any(NoteCollaborator.user_id == user_id),
                    ),
                    Note.is_archived == is_archived,
                    Note.is_trashed == is_trashed,
                )
            )
        )

        # Apply optional filters
        if is_pinned is not None:
            stmt = stmt.where(Note.is_pinned == is_pinned)

        if label_id:
            stmt = stmt.where(Note.labels.any(NoteLabel.id == label_id))

        if color:
            stmt = stmt.where(Note.color == color)

        if search:
            search_filter = or_(
                Note.title.ilike(f"%{search}%"),
                Note.content.ilike(f"%{search}%"),
            )
            stmt = stmt.where(search_filter)

        # Sort - pinned notes always first
        if sort_order == "desc":
            stmt = stmt.order_by(desc(Note.is_pinned), desc(getattr(Note, sort_by)))
        else:
            stmt = stmt.order_by(desc(Note.is_pinned), asc(getattr(Note, sort_by)))

        # Pagination
        stmt = stmt.offset(skip).limit(limit)

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def update_note(
        self,
        note_id: UUID,
        tenant_id: UUID,
        user_id: UUID,
        updates: Dict[str, Any],
    ) -> Optional[Note]:
        """Update a note."""
        note = await self.get_note(note_id, tenant_id, user_id)
        if not note:
            return None

        # Check edit permission if collaborator
        if note.owner_id != user_id:
            has_edit = any(
                c.user_id == user_id and c.permission == "edit"
                for c in note.collaborators
            )
            if not has_edit:
                return None

        # Update fields
        allowed_fields = [
            "title", "content", "content_html", "color", "background_image",
            "is_pinned", "is_checklist", "checklist_items", "position",
        ]

        for field, value in updates.items():
            if field in allowed_fields:
                setattr(note, field, value)

        # Recalculate word count if content changed
        if "content" in updates:
            note.word_count = len(updates["content"].split()) if updates["content"] else 0

        # Handle labels
        if "label_ids" in updates:
            await self._update_note_labels(note_id, updates["label_ids"])

        # Log activity
        await self._log_activity(note_id, user_id, "updated", {"fields": list(updates.keys())})

        await self.db.commit()
        await self.db.refresh(note)

        return note

    async def delete_note(
        self,
        note_id: UUID,
        tenant_id: UUID,
        user_id: UUID,
        permanent: bool = False,
    ) -> bool:
        """Delete a note (move to trash or permanent delete)."""
        note = await self.get_note(note_id, tenant_id, user_id)
        if not note or note.owner_id != user_id:
            return False

        if permanent:
            await self.db.delete(note)
        else:
            note.is_trashed = True
            note.trashed_at = datetime.utcnow()
            await self._log_activity(note_id, user_id, "trashed")

        await self.db.commit()
        return True

    async def restore_note(
        self,
        note_id: UUID,
        tenant_id: UUID,
        user_id: UUID,
    ) -> Optional[Note]:
        """Restore a trashed note."""
        stmt = select(Note).where(
            and_(
                Note.id == note_id,
                Note.tenant_id == tenant_id,
                Note.owner_id == user_id,
                Note.is_trashed == True,
            )
        )

        result = await self.db.execute(stmt)
        note = result.scalar_one_or_none()

        if not note:
            return None

        note.is_trashed = False
        note.trashed_at = None

        await self._log_activity(note_id, user_id, "restored")
        await self.db.commit()
        await self.db.refresh(note)

        return note

    # ===========================================
    # Note Actions
    # ===========================================

    async def toggle_pin(
        self,
        note_id: UUID,
        tenant_id: UUID,
        user_id: UUID,
    ) -> Optional[Note]:
        """Toggle note pin status."""
        note = await self.get_note(note_id, tenant_id, user_id)
        if not note:
            return None

        note.is_pinned = not note.is_pinned
        action = "pinned" if note.is_pinned else "unpinned"
        await self._log_activity(note_id, user_id, action)

        await self.db.commit()
        await self.db.refresh(note)

        return note

    async def archive_note(
        self,
        note_id: UUID,
        tenant_id: UUID,
        user_id: UUID,
    ) -> Optional[Note]:
        """Archive a note."""
        note = await self.get_note(note_id, tenant_id, user_id)
        if not note:
            return None

        note.is_archived = True
        note.is_pinned = False  # Unpin when archiving
        note.archived_at = datetime.utcnow()

        await self._log_activity(note_id, user_id, "archived")
        await self.db.commit()
        await self.db.refresh(note)

        return note

    async def unarchive_note(
        self,
        note_id: UUID,
        tenant_id: UUID,
        user_id: UUID,
    ) -> Optional[Note]:
        """Unarchive a note."""
        note = await self.get_note(note_id, tenant_id, user_id)
        if not note:
            return None

        note.is_archived = False
        note.archived_at = None

        await self._log_activity(note_id, user_id, "unarchived")
        await self.db.commit()
        await self.db.refresh(note)

        return note

    async def change_color(
        self,
        note_id: UUID,
        tenant_id: UUID,
        user_id: UUID,
        color: str,
    ) -> Optional[Note]:
        """Change note color."""
        note = await self.get_note(note_id, tenant_id, user_id)
        if not note:
            return None

        note.color = color
        await self._log_activity(note_id, user_id, "color_changed", {"color": color})

        await self.db.commit()
        await self.db.refresh(note)

        return note

    async def copy_note(
        self,
        note_id: UUID,
        tenant_id: UUID,
        user_id: UUID,
    ) -> Optional[Note]:
        """Create a copy of a note."""
        original = await self.get_note(note_id, tenant_id, user_id)
        if not original:
            return None

        # Create copy
        copy = Note(
            tenant_id=tenant_id,
            owner_id=user_id,
            title=f"{original.title} (Copy)" if original.title else None,
            content=original.content,
            content_html=original.content_html,
            color=original.color,
            is_checklist=original.is_checklist,
            checklist_items=original.checklist_items,
            word_count=original.word_count,
        )

        self.db.add(copy)
        await self.db.commit()
        await self.db.refresh(copy)

        return copy

    # ===========================================
    # Label Operations
    # ===========================================

    async def create_label(
        self,
        tenant_id: UUID,
        owner_id: UUID,
        name: str,
        color: Optional[str] = None,
    ) -> NoteLabel:
        """Create a new label."""
        label = NoteLabel(
            tenant_id=tenant_id,
            owner_id=owner_id,
            name=name,
            color=color,
        )

        self.db.add(label)
        await self.db.commit()
        await self.db.refresh(label)

        return label

    async def list_labels(
        self,
        tenant_id: UUID,
        owner_id: UUID,
    ) -> List[NoteLabel]:
        """List all labels for a user."""
        stmt = (
            select(NoteLabel)
            .where(
                and_(
                    NoteLabel.tenant_id == tenant_id,
                    NoteLabel.owner_id == owner_id,
                )
            )
            .order_by(NoteLabel.name)
        )

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def update_label(
        self,
        label_id: UUID,
        tenant_id: UUID,
        owner_id: UUID,
        name: Optional[str] = None,
        color: Optional[str] = None,
    ) -> Optional[NoteLabel]:
        """Update a label."""
        stmt = select(NoteLabel).where(
            and_(
                NoteLabel.id == label_id,
                NoteLabel.tenant_id == tenant_id,
                NoteLabel.owner_id == owner_id,
            )
        )

        result = await self.db.execute(stmt)
        label = result.scalar_one_or_none()

        if not label:
            return None

        if name:
            label.name = name
        if color is not None:
            label.color = color

        await self.db.commit()
        await self.db.refresh(label)

        return label

    async def delete_label(
        self,
        label_id: UUID,
        tenant_id: UUID,
        owner_id: UUID,
    ) -> bool:
        """Delete a label."""
        stmt = select(NoteLabel).where(
            and_(
                NoteLabel.id == label_id,
                NoteLabel.tenant_id == tenant_id,
                NoteLabel.owner_id == owner_id,
            )
        )

        result = await self.db.execute(stmt)
        label = result.scalar_one_or_none()

        if not label:
            return False

        await self.db.delete(label)
        await self.db.commit()

        return True

    # ===========================================
    # Reminder Operations
    # ===========================================

    async def set_reminder(
        self,
        note_id: UUID,
        tenant_id: UUID,
        user_id: UUID,
        reminder_time: datetime,
        is_recurring: bool = False,
        recurrence_pattern: Optional[str] = None,
    ) -> Optional[NoteReminder]:
        """Set a reminder for a note."""
        note = await self.get_note(note_id, tenant_id, user_id)
        if not note:
            return None

        # Remove existing reminders
        for reminder in note.reminders:
            await self.db.delete(reminder)

        # Create new reminder
        reminder = NoteReminder(
            note_id=note_id,
            reminder_time=reminder_time,
            is_recurring=is_recurring,
            recurrence_pattern=recurrence_pattern,
        )

        self.db.add(reminder)
        await self._log_activity(note_id, user_id, "reminder_set", {"time": reminder_time.isoformat()})

        await self.db.commit()
        await self.db.refresh(reminder)

        return reminder

    async def remove_reminder(
        self,
        note_id: UUID,
        tenant_id: UUID,
        user_id: UUID,
    ) -> bool:
        """Remove all reminders from a note."""
        note = await self.get_note(note_id, tenant_id, user_id)
        if not note:
            return False

        for reminder in note.reminders:
            await self.db.delete(reminder)

        await self._log_activity(note_id, user_id, "reminder_removed")
        await self.db.commit()

        return True

    async def get_pending_reminders(self) -> List[NoteReminder]:
        """Get all pending reminders that need to be sent."""
        stmt = (
            select(NoteReminder)
            .options(selectinload(NoteReminder.note))
            .where(
                and_(
                    NoteReminder.is_sent == False,
                    NoteReminder.reminder_time <= datetime.utcnow(),
                )
            )
        )

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    # ===========================================
    # Sharing Operations
    # ===========================================

    async def share_note(
        self,
        note_id: UUID,
        tenant_id: UUID,
        owner_id: UUID,
        user_id: UUID,
        user_email: str,
        user_name: Optional[str] = None,
        permission: str = "view",
    ) -> Optional[NoteCollaborator]:
        """Share a note with another user."""
        # Check ownership
        stmt = select(Note).where(
            and_(
                Note.id == note_id,
                Note.tenant_id == tenant_id,
                Note.owner_id == owner_id,
            )
        )

        result = await self.db.execute(stmt)
        note = result.scalar_one_or_none()

        if not note:
            return None

        # Check if already shared
        existing = await self.db.execute(
            select(NoteCollaborator).where(
                and_(
                    NoteCollaborator.note_id == note_id,
                    NoteCollaborator.user_id == user_id,
                )
            )
        )

        if existing.scalar_one_or_none():
            return None

        # Create collaborator
        collaborator = NoteCollaborator(
            note_id=note_id,
            user_id=user_id,
            user_email=user_email,
            user_name=user_name,
            permission=permission,
            created_by=owner_id,
        )

        self.db.add(collaborator)
        await self._log_activity(note_id, owner_id, "shared", {"with": user_email})

        await self.db.commit()
        await self.db.refresh(collaborator)

        return collaborator

    async def remove_collaborator(
        self,
        note_id: UUID,
        tenant_id: UUID,
        owner_id: UUID,
        user_id: UUID,
    ) -> bool:
        """Remove a collaborator from a note."""
        # Check ownership
        stmt = select(Note).where(
            and_(
                Note.id == note_id,
                Note.tenant_id == tenant_id,
                Note.owner_id == owner_id,
            )
        )

        result = await self.db.execute(stmt)
        note = result.scalar_one_or_none()

        if not note:
            return False

        # Find and remove collaborator
        collab_stmt = select(NoteCollaborator).where(
            and_(
                NoteCollaborator.note_id == note_id,
                NoteCollaborator.user_id == user_id,
            )
        )

        result = await self.db.execute(collab_stmt)
        collaborator = result.scalar_one_or_none()

        if not collaborator:
            return False

        await self.db.delete(collaborator)
        await self._log_activity(note_id, owner_id, "unshared", {"user_id": str(user_id)})
        await self.db.commit()

        return True

    # ===========================================
    # Search Operations
    # ===========================================

    async def search_notes(
        self,
        tenant_id: UUID,
        user_id: UUID,
        query: str,
        include_archived: bool = False,
        include_trashed: bool = False,
        limit: int = 50,
    ) -> List[Note]:
        """Full-text search across notes."""
        conditions = [
            Note.tenant_id == tenant_id,
            or_(
                Note.owner_id == user_id,
                Note.collaborators.any(NoteCollaborator.user_id == user_id),
            ),
            or_(
                Note.title.ilike(f"%{query}%"),
                Note.content.ilike(f"%{query}%"),
            ),
        ]

        if not include_archived:
            conditions.append(Note.is_archived == False)
        if not include_trashed:
            conditions.append(Note.is_trashed == False)

        stmt = (
            select(Note)
            .options(selectinload(Note.labels))
            .where(and_(*conditions))
            .order_by(desc(Note.updated_at))
            .limit(limit)
        )

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    # ===========================================
    # Helper Methods
    # ===========================================

    async def _add_labels_to_note(self, note_id: UUID, label_ids: List[UUID]) -> None:
        """Add labels to a note."""
        for label_id in label_ids:
            assoc = NoteLabelAssociation(note_id=note_id, label_id=label_id)
            self.db.add(assoc)

    async def _update_note_labels(self, note_id: UUID, label_ids: List[UUID]) -> None:
        """Update labels on a note (replace all)."""
        # Remove existing associations
        stmt = select(NoteLabelAssociation).where(NoteLabelAssociation.note_id == note_id)
        result = await self.db.execute(stmt)
        for assoc in result.scalars().all():
            await self.db.delete(assoc)

        # Add new associations
        await self._add_labels_to_note(note_id, label_ids)

    async def _log_activity(
        self,
        note_id: UUID,
        user_id: UUID,
        action: str,
        details: Optional[Dict] = None,
    ) -> None:
        """Log note activity."""
        log = NoteActivityLog(
            note_id=note_id,
            user_id=user_id,
            action=action,
            details=details,
        )
        self.db.add(log)

    async def get_note_count(
        self,
        tenant_id: UUID,
        user_id: UUID,
    ) -> Dict[str, int]:
        """Get note counts by status."""
        base_conditions = [
            Note.tenant_id == tenant_id,
            or_(
                Note.owner_id == user_id,
                Note.collaborators.any(NoteCollaborator.user_id == user_id),
            ),
        ]

        # Total active notes
        active_stmt = select(func.count(Note.id)).where(
            and_(*base_conditions, Note.is_archived == False, Note.is_trashed == False)
        )
        active_result = await self.db.execute(active_stmt)
        active_count = active_result.scalar() or 0

        # Pinned notes
        pinned_stmt = select(func.count(Note.id)).where(
            and_(*base_conditions, Note.is_pinned == True, Note.is_archived == False, Note.is_trashed == False)
        )
        pinned_result = await self.db.execute(pinned_stmt)
        pinned_count = pinned_result.scalar() or 0

        # Archived notes
        archived_stmt = select(func.count(Note.id)).where(
            and_(*base_conditions, Note.is_archived == True, Note.is_trashed == False)
        )
        archived_result = await self.db.execute(archived_stmt)
        archived_count = archived_result.scalar() or 0

        # Trashed notes
        trashed_stmt = select(func.count(Note.id)).where(
            and_(*base_conditions, Note.is_trashed == True)
        )
        trashed_result = await self.db.execute(trashed_stmt)
        trashed_count = trashed_result.scalar() or 0

        return {
            "active": active_count,
            "pinned": pinned_count,
            "archived": archived_count,
            "trashed": trashed_count,
        }
