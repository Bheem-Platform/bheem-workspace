"""
Bheem Workspace - Mail Snooze Service
Temporarily hide emails and bring them back at a scheduled time.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, update, delete
from sqlalchemy.dialects.postgresql import insert
from typing import List, Dict, Optional
from datetime import datetime, timedelta
import logging

from models.calendar_models import SnoozedEmail

logger = logging.getLogger(__name__)


class MailSnoozeService:
    """Service for email snooze functionality."""

    # Predefined snooze durations
    SNOOZE_OPTIONS = {
        'later_today': lambda: datetime.utcnow().replace(hour=18, minute=0, second=0),
        'tomorrow': lambda: datetime.utcnow() + timedelta(days=1),
        'tomorrow_morning': lambda: (datetime.utcnow() + timedelta(days=1)).replace(hour=9, minute=0, second=0),
        'next_week': lambda: datetime.utcnow() + timedelta(weeks=1),
        'next_weekend': lambda: datetime.utcnow() + timedelta(days=(5 - datetime.utcnow().weekday()) % 7 + 7),
    }

    async def snooze_email(
        self,
        db: AsyncSession,
        user_id: str,
        message_id: str,
        snooze_until: datetime,
        original_folder: str = 'INBOX',
        email_metadata: Optional[Dict] = None,
        tenant_id: Optional[str] = None,
        mailbox: Optional[str] = None
    ) -> SnoozedEmail:
        """
        Snooze an email until a specified time.

        Args:
            user_id: User ID
            message_id: IMAP message ID
            snooze_until: When to unsnooze the email
            original_folder: Folder where email was snoozed from
            email_metadata: Optional dict with subject, sender, snippet for display
            tenant_id: Tenant ID (required for multi-tenancy)
            mailbox: Mailbox email address
        """
        # Use message_id as mail_uid if no specific uid
        mail_uid = email_metadata.get('uid', message_id) if email_metadata else message_id

        # Check if already snoozed
        existing = await db.execute(
            select(SnoozedEmail).where(
                and_(
                    SnoozedEmail.user_id == user_id,
                    SnoozedEmail.message_id == message_id
                )
            )
        )
        snoozed = existing.scalar_one_or_none()

        if snoozed:
            # Update existing snooze
            snoozed.snooze_until = snooze_until
            snoozed.is_unsnoozed = False
            snoozed.unsnoozed_at = None
        else:
            # Create new snooze
            snoozed = SnoozedEmail(
                tenant_id=tenant_id or user_id,  # Fallback to user_id if no tenant
                user_id=user_id,
                mail_uid=mail_uid,
                mailbox=mailbox or 'default',
                message_id=message_id,
                snooze_until=snooze_until,
                original_folder=original_folder,
                is_unsnoozed=False
            )
            db.add(snoozed)

        await db.commit()
        await db.refresh(snoozed)
        return snoozed

    async def snooze_with_option(
        self,
        db: AsyncSession,
        user_id: str,
        message_id: str,
        option: str,
        original_folder: str = 'INBOX',
        email_metadata: Optional[Dict] = None,
        tenant_id: Optional[str] = None,
        mailbox: Optional[str] = None
    ) -> SnoozedEmail:
        """
        Snooze an email using a predefined option.

        Options: 'later_today', 'tomorrow', 'tomorrow_morning', 'next_week', 'next_weekend'
        """
        if option not in self.SNOOZE_OPTIONS:
            raise ValueError(f"Invalid snooze option: {option}")

        snooze_until = self.SNOOZE_OPTIONS[option]()
        return await self.snooze_email(
            db, user_id, message_id, snooze_until, original_folder,
            email_metadata, tenant_id, mailbox
        )

    async def unsnooze_email(
        self,
        db: AsyncSession,
        user_id: str,
        message_id: str
    ) -> Optional[SnoozedEmail]:
        """Manually unsnooze an email."""
        result = await db.execute(
            select(SnoozedEmail).where(
                and_(
                    SnoozedEmail.user_id == user_id,
                    SnoozedEmail.message_id == message_id,
                    SnoozedEmail.is_unsnoozed == False
                )
            )
        )
        snoozed = result.scalar_one_or_none()

        if not snoozed:
            return None

        snoozed.is_unsnoozed = True
        snoozed.unsnoozed_at = datetime.utcnow()
        await db.commit()
        await db.refresh(snoozed)
        return snoozed

    async def cancel_snooze(
        self,
        db: AsyncSession,
        user_id: str,
        message_id: str
    ) -> bool:
        """Cancel/remove a snooze without marking as unsnoozed."""
        result = await db.execute(
            delete(SnoozedEmail).where(
                and_(
                    SnoozedEmail.user_id == user_id,
                    SnoozedEmail.message_id == message_id
                )
            )
        )
        await db.commit()
        return result.rowcount > 0

    async def get_snoozed_emails(
        self,
        db: AsyncSession,
        user_id: str,
        limit: int = 50,
        offset: int = 0
    ) -> List[SnoozedEmail]:
        """Get all currently snoozed emails for a user."""
        result = await db.execute(
            select(SnoozedEmail).where(
                and_(
                    SnoozedEmail.user_id == user_id,
                    SnoozedEmail.is_unsnoozed == False
                )
            ).order_by(SnoozedEmail.snooze_until.asc())
            .limit(limit).offset(offset)
        )
        return result.scalars().all()

    async def get_due_snoozes(
        self,
        db: AsyncSession,
        user_id: Optional[str] = None
    ) -> List[SnoozedEmail]:
        """
        Get all snoozed emails that are due to be unsnoozed.
        If user_id is provided, filter by user.
        """
        conditions = [
            SnoozedEmail.is_unsnoozed == False,
            SnoozedEmail.snooze_until <= datetime.utcnow()
        ]

        if user_id:
            conditions.append(SnoozedEmail.user_id == user_id)

        result = await db.execute(
            select(SnoozedEmail).where(and_(*conditions))
        )
        return result.scalars().all()

    async def process_due_snoozes(
        self,
        db: AsyncSession,
        user_id: Optional[str] = None
    ) -> List[Dict]:
        """
        Process all due snoozes and mark them as unsnoozed.
        Returns list of unsnoozed email info for notification.
        """
        due_snoozes = await self.get_due_snoozes(db, user_id)
        unsnoozed = []

        for snooze in due_snoozes:
            snooze.is_unsnoozed = True
            snooze.unsnoozed_at = datetime.utcnow()
            unsnoozed.append({
                'user_id': str(snooze.user_id),
                'message_id': snooze.message_id,
                'mail_uid': snooze.mail_uid,
                'mailbox': snooze.mailbox,
                'original_folder': snooze.original_folder
            })

        if unsnoozed:
            await db.commit()
            logger.info(f"Processed {len(unsnoozed)} due snoozes")

        return unsnoozed

    async def is_snoozed(
        self,
        db: AsyncSession,
        user_id: str,
        message_id: str
    ) -> bool:
        """Check if an email is currently snoozed."""
        result = await db.execute(
            select(SnoozedEmail.id).where(
                and_(
                    SnoozedEmail.user_id == user_id,
                    SnoozedEmail.message_id == message_id,
                    SnoozedEmail.is_unsnoozed == False
                )
            )
        )
        return result.scalar_one_or_none() is not None

    async def get_snooze_info(
        self,
        db: AsyncSession,
        user_id: str,
        message_id: str
    ) -> Optional[Dict]:
        """Get snooze details for an email."""
        result = await db.execute(
            select(SnoozedEmail).where(
                and_(
                    SnoozedEmail.user_id == user_id,
                    SnoozedEmail.message_id == message_id
                )
            )
        )
        snooze = result.scalar_one_or_none()

        if not snooze:
            return None

        return {
            'id': str(snooze.id),
            'message_id': snooze.message_id,
            'mail_uid': snooze.mail_uid,
            'mailbox': snooze.mailbox,
            'snooze_until': snooze.snooze_until.isoformat() if snooze.snooze_until else None,
            'is_snoozed': not snooze.is_unsnoozed,
            'original_folder': snooze.original_folder
        }

    async def get_snooze_count(
        self,
        db: AsyncSession,
        user_id: str
    ) -> int:
        """Get count of snoozed emails for a user."""
        from sqlalchemy import func

        result = await db.execute(
            select(func.count(SnoozedEmail.id)).where(
                and_(
                    SnoozedEmail.user_id == user_id,
                    SnoozedEmail.is_unsnoozed == False
                )
            )
        )
        return result.scalar() or 0

    async def update_snooze_time(
        self,
        db: AsyncSession,
        user_id: str,
        message_id: str,
        new_snooze_until: datetime
    ) -> Optional[SnoozedEmail]:
        """Update the snooze time for an email."""
        result = await db.execute(
            select(SnoozedEmail).where(
                and_(
                    SnoozedEmail.user_id == user_id,
                    SnoozedEmail.message_id == message_id,
                    SnoozedEmail.is_unsnoozed == False
                )
            )
        )
        snooze = result.scalar_one_or_none()

        if not snooze:
            return None

        snooze.snooze_until = new_snooze_until
        await db.commit()
        await db.refresh(snooze)
        return snooze


# Singleton instance
mail_snooze_service = MailSnoozeService()
