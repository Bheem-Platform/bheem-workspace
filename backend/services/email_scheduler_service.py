"""
Bheem Workspace - Email Scheduler Service
Schedule emails for future delivery
"""
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, timedelta
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.date import DateTrigger
from models.mail_models import ScheduledEmail
from core.logging import get_logger

logger = get_logger("bheem.mail.scheduler")


class EmailSchedulerService:
    """
    Service for scheduling emails for future delivery.
    Uses APScheduler for reliable job execution.
    """

    def __init__(self):
        self.scheduler: Optional[AsyncIOScheduler] = None
        self._initialized = False

    def initialize(self):
        """Initialize the scheduler."""
        if self._initialized:
            return

        self.scheduler = AsyncIOScheduler()
        self.scheduler.start()
        self._initialized = True
        logger.info("Email scheduler initialized", action="scheduler_init")

    def shutdown(self):
        """Shutdown the scheduler gracefully."""
        if self.scheduler and self.scheduler.running:
            self.scheduler.shutdown(wait=True)
            logger.info("Email scheduler shutdown", action="scheduler_shutdown")

    async def schedule_email(
        self,
        db: AsyncSession,
        user_id: UUID,
        scheduled_at: datetime,
        email_data: Dict[str, Any]
    ) -> ScheduledEmail:
        """
        Schedule an email for future delivery.

        Args:
            db: Database session
            user_id: Owner's user ID
            scheduled_at: When to send the email (UTC)
            email_data: Email content (to, cc, bcc, subject, body, is_html)

        Returns:
            Created ScheduledEmail object
        """
        # Validate scheduled time is in the future
        if scheduled_at <= datetime.utcnow():
            raise ValueError("Scheduled time must be in the future")

        # Create scheduled email record
        scheduled = ScheduledEmail(
            user_id=user_id,
            scheduled_at=scheduled_at,
            status='pending',
            email_data=email_data
        )

        db.add(scheduled)
        await db.commit()
        await db.refresh(scheduled)

        # Add job to scheduler
        self._add_job(scheduled)

        logger.info(
            f"Scheduled email {scheduled.id} for {scheduled_at}",
            action="email_scheduled",
            scheduled_id=str(scheduled.id),
            user_id=str(user_id),
            scheduled_at=scheduled_at.isoformat()
        )

        return scheduled

    def _add_job(self, scheduled: ScheduledEmail):
        """Add APScheduler job for scheduled email."""
        if not self.scheduler:
            return

        job_id = f"scheduled_email_{scheduled.id}"

        self.scheduler.add_job(
            self._execute_scheduled_send,
            trigger=DateTrigger(run_date=scheduled.scheduled_at),
            args=[str(scheduled.id)],
            id=job_id,
            replace_existing=True
        )

    async def _execute_scheduled_send(self, scheduled_id: str):
        """Execute the scheduled email send."""
        from core.database import async_session_maker
        from services.mail_session_service import mail_session_service
        from services.mailcow_service import mailcow_service

        async with async_session_maker() as db:
            try:
                # Get the scheduled email
                result = await db.execute(
                    select(ScheduledEmail)
                    .where(ScheduledEmail.id == UUID(scheduled_id))
                )
                scheduled = result.scalar_one_or_none()

                if not scheduled or scheduled.status != 'pending':
                    logger.warning(
                        f"Scheduled email {scheduled_id} not found or not pending",
                        action="scheduled_send_skip"
                    )
                    return

                # Get user credentials
                credentials = mail_session_service.get_credentials(str(scheduled.user_id))

                if not credentials:
                    # Session expired - mark as failed
                    scheduled.status = 'failed'
                    scheduled.error_message = "Mail session expired. Please re-authenticate and reschedule."
                    await db.commit()
                    logger.error(
                        f"Session expired for scheduled email {scheduled_id}",
                        action="scheduled_send_failed"
                    )
                    return

                # Send the email
                email_data = scheduled.email_data
                success = mailcow_service.send_email(
                    from_email=credentials['email'],
                    password=credentials['password'],
                    to=email_data.get('to', []),
                    subject=email_data.get('subject', ''),
                    body=email_data.get('body', ''),
                    cc=email_data.get('cc'),
                    is_html=email_data.get('is_html', True)
                )

                if success:
                    scheduled.status = 'sent'
                    scheduled.sent_at = datetime.utcnow()
                    logger.info(
                        f"Scheduled email {scheduled_id} sent successfully",
                        action="scheduled_send_success"
                    )
                else:
                    scheduled.status = 'failed'
                    scheduled.error_message = "Failed to send email via SMTP"
                    logger.error(
                        f"Failed to send scheduled email {scheduled_id}",
                        action="scheduled_send_failed"
                    )

                await db.commit()

            except Exception as e:
                logger.error(
                    f"Error executing scheduled email {scheduled_id}: {e}",
                    action="scheduled_send_error"
                )
                # Try to mark as failed
                try:
                    await db.execute(
                        update(ScheduledEmail)
                        .where(ScheduledEmail.id == UUID(scheduled_id))
                        .values(status='failed', error_message=str(e))
                    )
                    await db.commit()
                except:
                    pass

    async def cancel_scheduled_email(
        self,
        db: AsyncSession,
        scheduled_id: UUID,
        user_id: UUID
    ) -> bool:
        """
        Cancel a scheduled email.

        Args:
            db: Database session
            scheduled_id: Scheduled email UUID
            user_id: Owner's user ID (for authorization)

        Returns:
            True if cancelled, False if not found or already sent
        """
        # Update status to cancelled
        result = await db.execute(
            update(ScheduledEmail)
            .where(
                ScheduledEmail.id == scheduled_id,
                ScheduledEmail.user_id == user_id,
                ScheduledEmail.status == 'pending'
            )
            .values(status='cancelled')
        )
        await db.commit()

        if result.rowcount == 0:
            return False

        # Remove from scheduler
        if self.scheduler:
            job_id = f"scheduled_email_{scheduled_id}"
            try:
                self.scheduler.remove_job(job_id)
            except:
                pass

        logger.info(
            f"Cancelled scheduled email {scheduled_id}",
            action="scheduled_email_cancelled",
            scheduled_id=str(scheduled_id)
        )

        return True

    async def update_scheduled_email(
        self,
        db: AsyncSession,
        scheduled_id: UUID,
        user_id: UUID,
        scheduled_at: Optional[datetime] = None,
        email_data: Optional[Dict[str, Any]] = None
    ) -> Optional[ScheduledEmail]:
        """
        Update a scheduled email.

        Only pending emails can be updated.
        """
        # Get the scheduled email
        result = await db.execute(
            select(ScheduledEmail)
            .where(
                ScheduledEmail.id == scheduled_id,
                ScheduledEmail.user_id == user_id,
                ScheduledEmail.status == 'pending'
            )
        )
        scheduled = result.scalar_one_or_none()

        if not scheduled:
            return None

        # Update fields
        if scheduled_at is not None:
            if scheduled_at <= datetime.utcnow():
                raise ValueError("Scheduled time must be in the future")
            scheduled.scheduled_at = scheduled_at

        if email_data is not None:
            scheduled.email_data = email_data

        await db.commit()
        await db.refresh(scheduled)

        # Update scheduler job
        self._add_job(scheduled)

        return scheduled

    async def get_scheduled_email(
        self,
        db: AsyncSession,
        scheduled_id: UUID,
        user_id: UUID
    ) -> Optional[ScheduledEmail]:
        """Get a single scheduled email."""
        result = await db.execute(
            select(ScheduledEmail)
            .where(
                ScheduledEmail.id == scheduled_id,
                ScheduledEmail.user_id == user_id
            )
        )
        return result.scalar_one_or_none()

    async def list_scheduled_emails(
        self,
        db: AsyncSession,
        user_id: UUID,
        status: Optional[str] = None,
        limit: int = 50
    ) -> List[ScheduledEmail]:
        """
        List scheduled emails for a user.

        Args:
            db: Database session
            user_id: Owner's user ID
            status: Filter by status (pending, sent, cancelled, failed)
            limit: Maximum results

        Returns:
            List of ScheduledEmail objects, ordered by scheduled_at
        """
        query = select(ScheduledEmail).where(ScheduledEmail.user_id == user_id)

        if status:
            query = query.where(ScheduledEmail.status == status)

        query = query.order_by(ScheduledEmail.scheduled_at).limit(limit)

        result = await db.execute(query)
        return result.scalars().all()

    async def load_pending_jobs(self, db: AsyncSession):
        """Load all pending scheduled emails into the scheduler."""
        result = await db.execute(
            select(ScheduledEmail)
            .where(
                ScheduledEmail.status == 'pending',
                ScheduledEmail.scheduled_at > datetime.utcnow()
            )
        )
        pending = result.scalars().all()

        for scheduled in pending:
            self._add_job(scheduled)

        logger.info(
            f"Loaded {len(pending)} pending scheduled emails",
            action="scheduler_load_pending"
        )

    def scheduled_to_dict(self, scheduled: ScheduledEmail) -> Dict[str, Any]:
        """Convert scheduled email model to dictionary."""
        return {
            "id": str(scheduled.id),
            "scheduled_at": scheduled.scheduled_at.isoformat() if scheduled.scheduled_at else None,
            "status": scheduled.status,
            "email_data": scheduled.email_data,
            "sent_at": scheduled.sent_at.isoformat() if scheduled.sent_at else None,
            "error_message": scheduled.error_message,
            "created_at": scheduled.created_at.isoformat() if scheduled.created_at else None,
        }


# Singleton instance
email_scheduler_service = EmailSchedulerService()
