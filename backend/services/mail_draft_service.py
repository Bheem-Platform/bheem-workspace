"""
Bheem Workspace - Mail Draft Service
Server-side draft management for cross-device sync
"""
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from models.mail_models import MailDraft
from core.logging import get_logger

logger = get_logger("bheem.mail.drafts")


class MailDraftService:
    """
    Service for managing email drafts with server-side persistence.
    Enables cross-device draft sync and auto-save functionality.
    """

    async def create_draft(
        self,
        db: AsyncSession,
        user_id: UUID,
        subject: str = "",
        body: str = "",
        is_html: bool = True,
        to_addresses: List[Dict[str, str]] = None,
        cc_addresses: List[Dict[str, str]] = None,
        bcc_addresses: List[Dict[str, str]] = None,
        attachments: List[Dict] = None,
        reply_to_message_id: str = None,
        forward_message_id: str = None,
        reply_type: str = None
    ) -> MailDraft:
        """
        Create a new draft.

        Args:
            db: Database session
            user_id: Owner's user ID
            subject: Email subject
            body: Email body content
            is_html: Whether body is HTML
            to_addresses: List of {name, email} dicts
            cc_addresses: List of {name, email} dicts
            bcc_addresses: List of {name, email} dicts
            attachments: List of attachment metadata
            reply_to_message_id: Message-ID for threading
            forward_message_id: Message-ID if forwarding
            reply_type: 'reply', 'reply_all', or 'forward'

        Returns:
            Created MailDraft object
        """
        draft = MailDraft(
            user_id=user_id,
            subject=subject,
            body=body,
            is_html=is_html,
            to_addresses=to_addresses or [],
            cc_addresses=cc_addresses or [],
            bcc_addresses=bcc_addresses or [],
            attachments=attachments or [],
            reply_to_message_id=reply_to_message_id,
            forward_message_id=forward_message_id,
            reply_type=reply_type
        )

        db.add(draft)
        await db.commit()
        await db.refresh(draft)

        logger.info(
            f"Created draft {draft.id} for user {user_id}",
            action="draft_created",
            draft_id=str(draft.id),
            user_id=str(user_id)
        )

        return draft

    async def update_draft(
        self,
        db: AsyncSession,
        draft_id: UUID,
        user_id: UUID,
        **kwargs
    ) -> Optional[MailDraft]:
        """
        Update an existing draft.

        Args:
            db: Database session
            draft_id: Draft UUID
            user_id: Owner's user ID (for authorization)
            **kwargs: Fields to update (subject, body, to_addresses, etc.)

        Returns:
            Updated MailDraft or None if not found
        """
        # Filter allowed fields
        allowed_fields = {
            'subject', 'body', 'is_html',
            'to_addresses', 'cc_addresses', 'bcc_addresses',
            'attachments', 'reply_to_message_id',
            'forward_message_id', 'reply_type'
        }

        update_data = {k: v for k, v in kwargs.items() if k in allowed_fields}

        if not update_data:
            return await self.get_draft(db, draft_id, user_id)

        update_data['updated_at'] = datetime.utcnow()

        result = await db.execute(
            update(MailDraft)
            .where(MailDraft.id == draft_id, MailDraft.user_id == user_id)
            .values(**update_data)
            .returning(MailDraft)
        )
        await db.commit()

        draft = result.scalar_one_or_none()

        if draft:
            logger.info(
                f"Updated draft {draft_id}",
                action="draft_updated",
                draft_id=str(draft_id)
            )

        return draft

    async def get_draft(
        self,
        db: AsyncSession,
        draft_id: UUID,
        user_id: UUID
    ) -> Optional[MailDraft]:
        """
        Get a single draft by ID.

        Args:
            db: Database session
            draft_id: Draft UUID
            user_id: Owner's user ID (for authorization)

        Returns:
            MailDraft or None if not found
        """
        result = await db.execute(
            select(MailDraft)
            .where(MailDraft.id == draft_id, MailDraft.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def list_drafts(
        self,
        db: AsyncSession,
        user_id: UUID,
        limit: int = 50,
        offset: int = 0
    ) -> List[MailDraft]:
        """
        List all drafts for a user.

        Args:
            db: Database session
            user_id: Owner's user ID
            limit: Maximum number of results
            offset: Number of results to skip

        Returns:
            List of MailDraft objects, ordered by updated_at desc
        """
        result = await db.execute(
            select(MailDraft)
            .where(MailDraft.user_id == user_id)
            .order_by(MailDraft.updated_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return result.scalars().all()

    async def delete_draft(
        self,
        db: AsyncSession,
        draft_id: UUID,
        user_id: UUID
    ) -> bool:
        """
        Delete a draft.

        Args:
            db: Database session
            draft_id: Draft UUID
            user_id: Owner's user ID (for authorization)

        Returns:
            True if deleted, False if not found
        """
        result = await db.execute(
            delete(MailDraft)
            .where(MailDraft.id == draft_id, MailDraft.user_id == user_id)
        )
        await db.commit()

        deleted = result.rowcount > 0

        if deleted:
            logger.info(
                f"Deleted draft {draft_id}",
                action="draft_deleted",
                draft_id=str(draft_id)
            )

        return deleted

    async def count_drafts(
        self,
        db: AsyncSession,
        user_id: UUID
    ) -> int:
        """Count total drafts for a user."""
        from sqlalchemy import func
        result = await db.execute(
            select(func.count(MailDraft.id))
            .where(MailDraft.user_id == user_id)
        )
        return result.scalar() or 0

    def draft_to_dict(self, draft: MailDraft) -> Dict[str, Any]:
        """Convert draft model to dictionary for API response."""
        return {
            "id": str(draft.id),
            "subject": draft.subject,
            "body": draft.body,
            "is_html": draft.is_html,
            "to_addresses": draft.to_addresses or [],
            "cc_addresses": draft.cc_addresses or [],
            "bcc_addresses": draft.bcc_addresses or [],
            "attachments": draft.attachments or [],
            "reply_to_message_id": draft.reply_to_message_id,
            "forward_message_id": draft.forward_message_id,
            "reply_type": draft.reply_type,
            "created_at": draft.created_at.isoformat() if draft.created_at else None,
            "updated_at": draft.updated_at.isoformat() if draft.updated_at else None,
        }


# Singleton instance
mail_draft_service = MailDraftService()
