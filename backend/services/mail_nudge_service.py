"""
Bheem Workspace - Email Nudge Service
Service for managing follow-up reminders for emails
Phase 9: Email Enhancements
"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, or_, func
from sqlalchemy.orm import selectinload

from models.mail_models import EmailNudge, EmailNudgeSettings


class EmailNudgeService:
    """Service for managing email nudges/follow-up reminders"""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ═══════════════════════════════════════════════════════════════════
    # Nudge Settings
    # ═══════════════════════════════════════════════════════════════════

    async def get_settings(self, user_id: UUID) -> EmailNudgeSettings:
        """Get nudge settings for a user, creating defaults if needed"""
        result = await self.db.execute(
            select(EmailNudgeSettings).where(
                EmailNudgeSettings.user_id == user_id
            )
        )
        settings = result.scalar_one_or_none()

        if not settings:
            settings = EmailNudgeSettings(user_id=user_id)
            self.db.add(settings)
            await self.db.commit()
            await self.db.refresh(settings)

        return settings

    async def update_settings(
        self,
        user_id: UUID,
        **kwargs
    ) -> EmailNudgeSettings:
        """Update nudge settings for a user"""
        settings = await self.get_settings(user_id)

        for key, value in kwargs.items():
            if hasattr(settings, key):
                setattr(settings, key, value)

        await self.db.commit()
        await self.db.refresh(settings)
        return settings

    # ═══════════════════════════════════════════════════════════════════
    # Nudge Management
    # ═══════════════════════════════════════════════════════════════════

    async def create_nudge(
        self,
        user_id: UUID,
        message_id: str,
        nudge_type: str,
        remind_at: datetime,
        subject: Optional[str] = None,
        recipient_email: Optional[str] = None,
        sent_at: Optional[datetime] = None,
        note: Optional[str] = None
    ) -> EmailNudge:
        """Create a new nudge for an email"""
        nudge = EmailNudge(
            user_id=user_id,
            message_id=message_id,
            nudge_type=nudge_type,
            remind_at=remind_at,
            subject=subject,
            recipient_email=recipient_email,
            sent_at=sent_at,
            note=note,
            status='pending'
        )

        self.db.add(nudge)
        await self.db.commit()
        await self.db.refresh(nudge)
        return nudge

    async def create_sent_email_nudge(
        self,
        user_id: UUID,
        message_id: str,
        subject: str,
        recipient_email: str,
        sent_at: datetime
    ) -> Optional[EmailNudge]:
        """Create nudge for sent email awaiting reply"""
        settings = await self.get_settings(user_id)

        if not settings.nudges_enabled or not settings.nudge_sent_emails:
            return None

        # Check if domain is excluded
        domain = recipient_email.split('@')[-1] if '@' in recipient_email else ''
        if domain in (settings.excluded_domains or []):
            return None

        # Check if sender is excluded
        if recipient_email in (settings.excluded_senders or []):
            return None

        remind_at = sent_at + timedelta(days=settings.sent_no_reply_days)

        return await self.create_nudge(
            user_id=user_id,
            message_id=message_id,
            nudge_type='sent_no_reply',
            remind_at=remind_at,
            subject=subject,
            recipient_email=recipient_email,
            sent_at=sent_at
        )

    async def create_received_email_nudge(
        self,
        user_id: UUID,
        message_id: str,
        subject: str,
        sender_email: str,
        received_at: datetime
    ) -> Optional[EmailNudge]:
        """Create nudge for received email needing reply"""
        settings = await self.get_settings(user_id)

        if not settings.nudges_enabled or not settings.nudge_received_emails:
            return None

        remind_at = received_at + timedelta(days=settings.received_no_reply_days)

        return await self.create_nudge(
            user_id=user_id,
            message_id=message_id,
            nudge_type='received_no_reply',
            remind_at=remind_at,
            subject=subject,
            recipient_email=sender_email,
            sent_at=received_at
        )

    async def get_pending_nudges(
        self,
        user_id: UUID,
        include_future: bool = False
    ) -> List[EmailNudge]:
        """Get pending nudges for a user"""
        query = select(EmailNudge).where(
            and_(
                EmailNudge.user_id == user_id,
                EmailNudge.status == 'pending'
            )
        )

        if not include_future:
            query = query.where(
                or_(
                    EmailNudge.remind_at <= datetime.utcnow(),
                    EmailNudge.snooze_until.is_(None),
                    EmailNudge.snooze_until <= datetime.utcnow()
                )
            )

        query = query.order_by(EmailNudge.remind_at.asc())
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_due_nudges(self, user_id: UUID) -> List[EmailNudge]:
        """Get nudges that are due to be shown"""
        query = select(EmailNudge).where(
            and_(
                EmailNudge.user_id == user_id,
                EmailNudge.status == 'pending',
                EmailNudge.remind_at <= datetime.utcnow(),
                or_(
                    EmailNudge.snooze_until.is_(None),
                    EmailNudge.snooze_until <= datetime.utcnow()
                )
            )
        )
        query = query.order_by(EmailNudge.remind_at.asc())

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_nudge(self, nudge_id: UUID, user_id: UUID) -> Optional[EmailNudge]:
        """Get a specific nudge"""
        result = await self.db.execute(
            select(EmailNudge).where(
                and_(
                    EmailNudge.id == nudge_id,
                    EmailNudge.user_id == user_id
                )
            )
        )
        return result.scalar_one_or_none()

    async def mark_shown(self, nudge_id: UUID, user_id: UUID) -> bool:
        """Mark a nudge as shown"""
        result = await self.db.execute(
            update(EmailNudge)
            .where(
                and_(
                    EmailNudge.id == nudge_id,
                    EmailNudge.user_id == user_id
                )
            )
            .values(
                status='shown',
                shown_at=datetime.utcnow()
            )
        )
        await self.db.commit()
        return result.rowcount > 0

    async def dismiss(self, nudge_id: UUID, user_id: UUID) -> bool:
        """Dismiss a nudge"""
        result = await self.db.execute(
            update(EmailNudge)
            .where(
                and_(
                    EmailNudge.id == nudge_id,
                    EmailNudge.user_id == user_id
                )
            )
            .values(
                status='dismissed',
                dismissed_at=datetime.utcnow()
            )
        )
        await self.db.commit()
        return result.rowcount > 0

    async def snooze(
        self,
        nudge_id: UUID,
        user_id: UUID,
        snooze_hours: int = 24
    ) -> bool:
        """Snooze a nudge"""
        snooze_until = datetime.utcnow() + timedelta(hours=snooze_hours)

        result = await self.db.execute(
            update(EmailNudge)
            .where(
                and_(
                    EmailNudge.id == nudge_id,
                    EmailNudge.user_id == user_id
                )
            )
            .values(
                status='snoozed',
                snooze_until=snooze_until
            )
        )
        await self.db.commit()
        return result.rowcount > 0

    async def mark_replied(self, user_id: UUID, message_id: str) -> int:
        """Mark nudges for a message as replied (conversation resolved)"""
        result = await self.db.execute(
            update(EmailNudge)
            .where(
                and_(
                    EmailNudge.user_id == user_id,
                    EmailNudge.message_id == message_id,
                    EmailNudge.status.in_(['pending', 'shown', 'snoozed'])
                )
            )
            .values(status='replied')
        )
        await self.db.commit()
        return result.rowcount

    async def delete_nudge(self, nudge_id: UUID, user_id: UUID) -> bool:
        """Delete a nudge"""
        result = await self.db.execute(
            delete(EmailNudge).where(
                and_(
                    EmailNudge.id == nudge_id,
                    EmailNudge.user_id == user_id
                )
            )
        )
        await self.db.commit()
        return result.rowcount > 0

    async def get_nudge_count(self, user_id: UUID) -> int:
        """Get count of pending nudges"""
        result = await self.db.execute(
            select(func.count(EmailNudge.id)).where(
                and_(
                    EmailNudge.user_id == user_id,
                    EmailNudge.status == 'pending',
                    EmailNudge.remind_at <= datetime.utcnow()
                )
            )
        )
        return result.scalar() or 0

    async def cleanup_old_nudges(self, older_than_days: int = 90) -> int:
        """Clean up old dismissed/replied nudges"""
        cutoff = datetime.utcnow() - timedelta(days=older_than_days)

        result = await self.db.execute(
            delete(EmailNudge).where(
                and_(
                    EmailNudge.status.in_(['dismissed', 'replied']),
                    EmailNudge.updated_at < cutoff
                )
            )
        )
        await self.db.commit()
        return result.rowcount

    async def reactivate_snoozed(self) -> int:
        """Reactivate snoozed nudges that are due"""
        result = await self.db.execute(
            update(EmailNudge)
            .where(
                and_(
                    EmailNudge.status == 'snoozed',
                    EmailNudge.snooze_until <= datetime.utcnow()
                )
            )
            .values(
                status='pending',
                snooze_until=None
            )
        )
        await self.db.commit()
        return result.rowcount
