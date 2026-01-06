"""
Bheem Workspace - Mail Vacation Responder Service
Manage out-of-office auto-reply settings
"""
from typing import Optional, Dict, Any, List
from uuid import UUID
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models.mail_models import MailVacationResponder
from core.logging import get_logger

logger = get_logger("bheem.mail.vacation")


class MailVacationService:
    """
    Service for managing vacation/out-of-office auto-responders.

    Features:
    - Enable/disable auto-reply
    - Set date range
    - Custom subject and message
    - Reply only once per sender
    - Reply only to known contacts
    """

    async def get_settings(
        self,
        db: AsyncSession,
        user_id: UUID
    ) -> Optional[MailVacationResponder]:
        """Get vacation responder settings for a user."""
        result = await db.execute(
            select(MailVacationResponder)
            .where(MailVacationResponder.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def create_or_update_settings(
        self,
        db: AsyncSession,
        user_id: UUID,
        is_enabled: bool = False,
        subject: str = "Out of Office",
        message: str = "",
        is_html: bool = False,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        only_contacts: bool = False,
        only_once: bool = True
    ) -> MailVacationResponder:
        """
        Create or update vacation responder settings.

        Args:
            db: Database session
            user_id: Owner's user ID
            is_enabled: Whether auto-reply is active
            subject: Reply email subject
            message: Reply email body
            is_html: Whether message is HTML
            start_date: When to start auto-replying
            end_date: When to stop auto-replying
            only_contacts: Only reply to known contacts
            only_once: Only reply once per sender

        Returns:
            Updated MailVacationResponder
        """
        settings = await self.get_settings(db, user_id)

        if settings:
            # Update existing
            settings.is_enabled = is_enabled
            settings.subject = subject
            settings.message = message
            settings.is_html = is_html
            settings.start_date = start_date
            settings.end_date = end_date
            settings.only_contacts = only_contacts
            settings.only_once = only_once
            settings.updated_at = datetime.utcnow()

            # Reset replied_to list if enabling
            if is_enabled and not settings.replied_to:
                settings.replied_to = []
        else:
            # Create new
            settings = MailVacationResponder(
                user_id=user_id,
                is_enabled=is_enabled,
                subject=subject,
                message=message,
                is_html=is_html,
                start_date=start_date,
                end_date=end_date,
                only_contacts=only_contacts,
                only_once=only_once,
                replied_to=[]
            )
            db.add(settings)

        await db.commit()
        await db.refresh(settings)

        logger.info(
            f"Updated vacation settings for user {user_id}",
            action="vacation_updated",
            user_id=str(user_id),
            is_enabled=is_enabled
        )

        return settings

    async def enable(
        self,
        db: AsyncSession,
        user_id: UUID
    ) -> Optional[MailVacationResponder]:
        """Enable vacation responder."""
        settings = await self.get_settings(db, user_id)
        if not settings:
            return None

        settings.is_enabled = True
        settings.replied_to = []  # Reset when enabling
        settings.updated_at = datetime.utcnow()

        await db.commit()
        await db.refresh(settings)

        logger.info(
            f"Enabled vacation responder for user {user_id}",
            action="vacation_enabled",
            user_id=str(user_id)
        )

        return settings

    async def disable(
        self,
        db: AsyncSession,
        user_id: UUID
    ) -> Optional[MailVacationResponder]:
        """Disable vacation responder."""
        settings = await self.get_settings(db, user_id)
        if not settings:
            return None

        settings.is_enabled = False
        settings.updated_at = datetime.utcnow()

        await db.commit()
        await db.refresh(settings)

        logger.info(
            f"Disabled vacation responder for user {user_id}",
            action="vacation_disabled",
            user_id=str(user_id)
        )

        return settings

    async def should_reply(
        self,
        db: AsyncSession,
        user_id: UUID,
        sender_email: str,
        is_known_contact: bool = False
    ) -> bool:
        """
        Check if we should send an auto-reply.

        Args:
            db: Database session
            user_id: User receiving the email
            sender_email: Email address of sender
            is_known_contact: Whether sender is a known contact

        Returns:
            True if we should send an auto-reply
        """
        settings = await self.get_settings(db, user_id)

        if not settings or not settings.is_enabled:
            return False

        # Check date range
        now = datetime.utcnow()
        if settings.start_date and now < settings.start_date:
            return False
        if settings.end_date and now > settings.end_date:
            return False

        # Check only_contacts setting
        if settings.only_contacts and not is_known_contact:
            return False

        # Check only_once setting
        if settings.only_once:
            sender_lower = sender_email.lower()
            if sender_lower in (settings.replied_to or []):
                return False

        return True

    async def record_reply(
        self,
        db: AsyncSession,
        user_id: UUID,
        sender_email: str
    ):
        """
        Record that we sent a reply to this sender.

        Used to enforce only_once setting.
        """
        settings = await self.get_settings(db, user_id)
        if not settings:
            return

        sender_lower = sender_email.lower()
        replied_to = settings.replied_to or []

        if sender_lower not in replied_to:
            replied_to.append(sender_lower)
            settings.replied_to = replied_to
            await db.commit()

    async def clear_replied_list(
        self,
        db: AsyncSession,
        user_id: UUID
    ):
        """Clear the list of senders we've replied to."""
        settings = await self.get_settings(db, user_id)
        if settings:
            settings.replied_to = []
            await db.commit()

    async def delete_settings(
        self,
        db: AsyncSession,
        user_id: UUID
    ) -> bool:
        """Delete vacation responder settings entirely."""
        settings = await self.get_settings(db, user_id)
        if not settings:
            return False

        await db.delete(settings)
        await db.commit()

        logger.info(
            f"Deleted vacation settings for user {user_id}",
            action="vacation_deleted",
            user_id=str(user_id)
        )

        return True

    def is_active(self, settings: MailVacationResponder) -> bool:
        """Check if vacation responder is currently active (enabled + in date range)."""
        if not settings.is_enabled:
            return False

        now = datetime.utcnow()

        if settings.start_date and now < settings.start_date:
            return False

        if settings.end_date and now > settings.end_date:
            return False

        return True

    def settings_to_dict(self, settings: MailVacationResponder) -> Dict[str, Any]:
        """Convert settings model to dictionary."""
        return {
            "id": str(settings.id),
            "is_enabled": settings.is_enabled,
            "is_active": self.is_active(settings),
            "subject": settings.subject,
            "message": settings.message,
            "is_html": settings.is_html,
            "start_date": settings.start_date.isoformat() if settings.start_date else None,
            "end_date": settings.end_date.isoformat() if settings.end_date else None,
            "only_contacts": settings.only_contacts,
            "only_once": settings.only_once,
            "replied_count": len(settings.replied_to or []),
            "created_at": settings.created_at.isoformat() if settings.created_at else None,
            "updated_at": settings.updated_at.isoformat() if settings.updated_at else None,
        }


# Singleton instance
mail_vacation_service = MailVacationService()
