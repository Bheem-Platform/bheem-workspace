"""
Bheem Workspace - Mail Labels Service
Manage custom email labels/tags
"""
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from sqlalchemy import select, update, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from models.mail_models import MailLabel, MailLabelAssignment
from core.logging import get_logger

logger = get_logger("bheem.mail.labels")

# Default label colors
DEFAULT_COLORS = [
    '#4A90D9',  # Blue
    '#7B68EE',  # Purple
    '#2ECC71',  # Green
    '#E74C3C',  # Red
    '#F39C12',  # Orange
    '#1ABC9C',  # Teal
    '#9B59B6',  # Violet
    '#34495E',  # Dark Gray
]


class MailLabelsService:
    """
    Service for managing email labels.

    Features:
    - Create custom labels with colors
    - Assign/remove labels from emails
    - Get emails by label
    """

    async def create_label(
        self,
        db: AsyncSession,
        user_id: UUID,
        name: str,
        color: Optional[str] = None,
        description: Optional[str] = None
    ) -> MailLabel:
        """
        Create a new label.

        Args:
            db: Database session
            user_id: Owner's user ID
            name: Label name
            color: Hex color (e.g., #4A90D9)
            description: Optional description

        Returns:
            Created MailLabel
        """
        # Check for duplicate name
        result = await db.execute(
            select(MailLabel)
            .where(MailLabel.user_id == user_id, MailLabel.name == name)
        )
        if result.scalar_one_or_none():
            raise ValueError(f"Label '{name}' already exists")

        # Auto-assign color if not provided
        if not color:
            count = await self.get_labels_count(db, user_id)
            color = DEFAULT_COLORS[count % len(DEFAULT_COLORS)]

        label = MailLabel(
            user_id=user_id,
            name=name,
            color=color,
            description=description
        )

        db.add(label)
        await db.commit()
        await db.refresh(label)

        logger.info(
            f"Created label {label.id}",
            action="label_created",
            label_id=str(label.id),
            user_id=str(user_id)
        )

        return label

    async def get_label(
        self,
        db: AsyncSession,
        label_id: UUID,
        user_id: UUID
    ) -> Optional[MailLabel]:
        """Get a single label by ID."""
        result = await db.execute(
            select(MailLabel)
            .where(MailLabel.id == label_id, MailLabel.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def list_labels(
        self,
        db: AsyncSession,
        user_id: UUID,
        visible_only: bool = False
    ) -> List[MailLabel]:
        """List all labels for a user."""
        query = select(MailLabel).where(MailLabel.user_id == user_id)

        if visible_only:
            query = query.where(MailLabel.is_visible == True)

        query = query.order_by(MailLabel.name)

        result = await db.execute(query)
        return result.scalars().all()

    async def get_labels_count(
        self,
        db: AsyncSession,
        user_id: UUID
    ) -> int:
        """Get total label count for a user."""
        result = await db.execute(
            select(func.count(MailLabel.id))
            .where(MailLabel.user_id == user_id)
        )
        return result.scalar() or 0

    async def update_label(
        self,
        db: AsyncSession,
        label_id: UUID,
        user_id: UUID,
        updates: Dict[str, Any]
    ) -> Optional[MailLabel]:
        """Update a label."""
        label = await self.get_label(db, label_id, user_id)
        if not label:
            return None

        # Check for duplicate name if updating name
        if 'name' in updates and updates['name'] != label.name:
            result = await db.execute(
                select(MailLabel)
                .where(
                    MailLabel.user_id == user_id,
                    MailLabel.name == updates['name']
                )
            )
            if result.scalar_one_or_none():
                raise ValueError(f"Label '{updates['name']}' already exists")

        allowed_fields = ['name', 'color', 'description', 'is_visible', 'show_in_list']
        for field, value in updates.items():
            if field in allowed_fields and value is not None:
                setattr(label, field, value)

        label.updated_at = datetime.utcnow()

        await db.commit()
        await db.refresh(label)

        return label

    async def delete_label(
        self,
        db: AsyncSession,
        label_id: UUID,
        user_id: UUID
    ) -> bool:
        """Delete a label and all its assignments."""
        # Delete assignments first (or let cascade handle it)
        await db.execute(
            delete(MailLabelAssignment)
            .where(MailLabelAssignment.label_id == label_id)
        )

        result = await db.execute(
            delete(MailLabel)
            .where(MailLabel.id == label_id, MailLabel.user_id == user_id)
        )
        await db.commit()
        return result.rowcount > 0

    # ===========================================
    # Label Assignments
    # ===========================================

    async def assign_label(
        self,
        db: AsyncSession,
        user_id: UUID,
        label_id: UUID,
        message_id: str
    ) -> MailLabelAssignment:
        """
        Assign a label to an email.

        Args:
            db: Database session
            user_id: Owner's user ID
            label_id: Label UUID
            message_id: IMAP message ID

        Returns:
            Created assignment
        """
        # Verify label belongs to user
        label = await self.get_label(db, label_id, user_id)
        if not label:
            raise ValueError("Label not found")

        # Check if already assigned
        result = await db.execute(
            select(MailLabelAssignment)
            .where(
                MailLabelAssignment.label_id == label_id,
                MailLabelAssignment.message_id == message_id
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            return existing

        assignment = MailLabelAssignment(
            user_id=user_id,
            label_id=label_id,
            message_id=message_id
        )

        db.add(assignment)
        await db.commit()
        await db.refresh(assignment)

        return assignment

    async def remove_label(
        self,
        db: AsyncSession,
        user_id: UUID,
        label_id: UUID,
        message_id: str
    ) -> bool:
        """Remove a label from an email."""
        result = await db.execute(
            delete(MailLabelAssignment)
            .where(
                MailLabelAssignment.user_id == user_id,
                MailLabelAssignment.label_id == label_id,
                MailLabelAssignment.message_id == message_id
            )
        )
        await db.commit()
        return result.rowcount > 0

    async def get_message_labels(
        self,
        db: AsyncSession,
        user_id: UUID,
        message_id: str
    ) -> List[MailLabel]:
        """Get all labels for a specific email."""
        result = await db.execute(
            select(MailLabel)
            .join(MailLabelAssignment, MailLabel.id == MailLabelAssignment.label_id)
            .where(
                MailLabelAssignment.user_id == user_id,
                MailLabelAssignment.message_id == message_id
            )
        )
        return result.scalars().all()

    async def get_messages_by_label(
        self,
        db: AsyncSession,
        user_id: UUID,
        label_id: UUID,
        limit: int = 100,
        offset: int = 0
    ) -> List[str]:
        """Get message IDs that have a specific label."""
        result = await db.execute(
            select(MailLabelAssignment.message_id)
            .where(
                MailLabelAssignment.user_id == user_id,
                MailLabelAssignment.label_id == label_id
            )
            .order_by(MailLabelAssignment.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return [r[0] for r in result.all()]

    async def get_label_message_count(
        self,
        db: AsyncSession,
        user_id: UUID,
        label_id: UUID
    ) -> int:
        """Get count of messages with a label."""
        result = await db.execute(
            select(func.count(MailLabelAssignment.id))
            .where(
                MailLabelAssignment.user_id == user_id,
                MailLabelAssignment.label_id == label_id
            )
        )
        return result.scalar() or 0

    async def bulk_assign_label(
        self,
        db: AsyncSession,
        user_id: UUID,
        label_id: UUID,
        message_ids: List[str]
    ) -> int:
        """Assign a label to multiple emails."""
        count = 0
        for message_id in message_ids:
            try:
                await self.assign_label(db, user_id, label_id, message_id)
                count += 1
            except Exception:
                pass
        return count

    async def bulk_remove_label(
        self,
        db: AsyncSession,
        user_id: UUID,
        label_id: UUID,
        message_ids: List[str]
    ) -> int:
        """Remove a label from multiple emails."""
        result = await db.execute(
            delete(MailLabelAssignment)
            .where(
                MailLabelAssignment.user_id == user_id,
                MailLabelAssignment.label_id == label_id,
                MailLabelAssignment.message_id.in_(message_ids)
            )
        )
        await db.commit()
        return result.rowcount

    def label_to_dict(self, label: MailLabel, message_count: int = 0) -> Dict[str, Any]:
        """Convert label model to dictionary."""
        return {
            "id": str(label.id),
            "name": label.name,
            "color": label.color,
            "description": label.description,
            "is_visible": label.is_visible,
            "show_in_list": label.show_in_list,
            "message_count": message_count,
            "created_at": label.created_at.isoformat() if label.created_at else None,
            "updated_at": label.updated_at.isoformat() if label.updated_at else None,
        }


# Singleton instance
mail_labels_service = MailLabelsService()
