"""
Bheem Workspace - Calendar Reminder Service
Schedules and sends calendar event reminders via multiple channels
"""
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from uuid import UUID
import asyncio

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.date import DateTrigger
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from models.calendar_models import CalendarReminder
from integrations.notify import notify_client

logger = logging.getLogger("bheem.calendar.reminders")


class CalendarReminderService:
    """Service for scheduling and executing calendar reminders"""

    def __init__(self):
        self.scheduler: Optional[AsyncIOScheduler] = None
        self._initialized = False
        # Store WebSocket connections for browser notifications
        self.active_connections: Dict[str, Any] = {}

    def initialize(self):
        """Initialize the reminder scheduler"""
        if self._initialized:
            return

        self.scheduler = AsyncIOScheduler()
        self.scheduler.start()
        self._initialized = True
        logger.info("Calendar reminder scheduler started")

    def shutdown(self):
        """Shutdown the scheduler gracefully"""
        if self._initialized and self.scheduler:
            self.scheduler.shutdown(wait=False)
            self._initialized = False
            logger.info("Calendar reminder scheduler stopped")

    async def schedule_reminder(
        self,
        db: AsyncSession,
        user_id: UUID,
        event_uid: str,
        calendar_id: str,
        event_title: str,
        event_start: datetime,
        event_location: Optional[str],
        reminder_type: str,
        minutes_before: int,
        user_email: Optional[str] = None,
        user_phone: Optional[str] = None
    ) -> Optional[str]:
        """Schedule a reminder for a calendar event"""
        if not self._initialized:
            self.initialize()

        # Calculate trigger time
        trigger_time = event_start - timedelta(minutes=minutes_before)

        # Don't schedule past reminders
        if trigger_time <= datetime.utcnow():
            logger.debug(f"Skipping past reminder for {event_title}")
            return None

        # Create database record
        reminder = CalendarReminder(
            user_id=user_id,
            event_uid=event_uid,
            calendar_id=calendar_id,
            event_title=event_title,
            event_start=event_start,
            event_location=event_location,
            reminder_type=reminder_type,
            minutes_before=minutes_before,
            trigger_time=trigger_time,
            status="pending",
            user_email=user_email,
            user_phone=user_phone
        )
        db.add(reminder)
        await db.commit()
        await db.refresh(reminder)

        # Schedule the job
        job_id = f"calendar_reminder_{reminder.id}"
        self.scheduler.add_job(
            self._execute_reminder,
            trigger=DateTrigger(run_date=trigger_time),
            id=job_id,
            args=[str(reminder.id)],
            replace_existing=True
        )

        logger.info(f"Scheduled {reminder_type} reminder for '{event_title}' at {trigger_time}")
        return str(reminder.id)

    async def schedule_event_reminders(
        self,
        db: AsyncSession,
        user_id: UUID,
        event_uid: str,
        calendar_id: str,
        event_title: str,
        event_start: datetime,
        event_location: Optional[str],
        reminders: List[Dict[str, Any]],
        user_email: Optional[str] = None,
        user_phone: Optional[str] = None
    ) -> List[str]:
        """Schedule multiple reminders for an event"""
        reminder_ids = []

        for reminder_config in reminders:
            reminder_type = reminder_config.get("type", "browser")
            minutes_before = reminder_config.get("minutes", 10)

            reminder_id = await self.schedule_reminder(
                db=db,
                user_id=user_id,
                event_uid=event_uid,
                calendar_id=calendar_id,
                event_title=event_title,
                event_start=event_start,
                event_location=event_location,
                reminder_type=reminder_type,
                minutes_before=minutes_before,
                user_email=user_email,
                user_phone=user_phone
            )

            if reminder_id:
                reminder_ids.append(reminder_id)

        return reminder_ids

    async def cancel_event_reminders(
        self,
        db: AsyncSession,
        event_uid: str,
        user_id: Optional[UUID] = None
    ) -> int:
        """Cancel all reminders for an event"""
        # Get pending reminders
        query = select(CalendarReminder).where(
            CalendarReminder.event_uid == event_uid,
            CalendarReminder.status == "pending"
        )
        if user_id:
            query = query.where(CalendarReminder.user_id == user_id)

        result = await db.execute(query)
        reminders = result.scalars().all()

        # Cancel scheduler jobs and update status
        cancelled = 0
        for reminder in reminders:
            job_id = f"calendar_reminder_{reminder.id}"
            try:
                self.scheduler.remove_job(job_id)
            except Exception:
                pass  # Job may not exist

            reminder.status = "cancelled"
            cancelled += 1

        await db.commit()
        logger.info(f"Cancelled {cancelled} reminders for event {event_uid}")
        return cancelled

    async def cancel_reminder(
        self,
        db: AsyncSession,
        reminder_id: UUID
    ) -> bool:
        """Cancel a specific reminder"""
        result = await db.execute(
            select(CalendarReminder).where(CalendarReminder.id == reminder_id)
        )
        reminder = result.scalar_one_or_none()

        if not reminder:
            return False

        # Remove scheduler job
        job_id = f"calendar_reminder_{reminder.id}"
        try:
            self.scheduler.remove_job(job_id)
        except Exception:
            pass

        # Update status
        reminder.status = "cancelled"
        await db.commit()

        return True

    async def get_user_reminders(
        self,
        db: AsyncSession,
        user_id: UUID,
        status: Optional[str] = None,
        limit: int = 50
    ) -> List[CalendarReminder]:
        """Get reminders for a user"""
        query = select(CalendarReminder).where(
            CalendarReminder.user_id == user_id
        ).order_by(CalendarReminder.trigger_time.desc()).limit(limit)

        if status:
            query = query.where(CalendarReminder.status == status)

        result = await db.execute(query)
        return result.scalars().all()

    async def get_event_reminders(
        self,
        db: AsyncSession,
        event_uid: str,
        user_id: Optional[UUID] = None
    ) -> List[CalendarReminder]:
        """Get reminders for an event"""
        query = select(CalendarReminder).where(
            CalendarReminder.event_uid == event_uid
        )
        if user_id:
            query = query.where(CalendarReminder.user_id == user_id)

        result = await db.execute(query)
        return result.scalars().all()

    async def _execute_reminder(self, reminder_id: str):
        """Execute a scheduled reminder"""
        from core.database import async_session_maker

        async with async_session_maker() as db:
            result = await db.execute(
                select(CalendarReminder).where(CalendarReminder.id == reminder_id)
            )
            reminder = result.scalar_one_or_none()

            if not reminder or reminder.status != "pending":
                return

            try:
                success = False

                if reminder.reminder_type == "email":
                    success = await self._send_email_reminder(reminder)
                elif reminder.reminder_type == "browser":
                    success = await self._send_browser_notification(reminder)
                elif reminder.reminder_type == "sms":
                    success = await self._send_sms_reminder(reminder)
                elif reminder.reminder_type == "whatsapp":
                    success = await self._send_whatsapp_reminder(reminder)

                if success:
                    reminder.status = "sent"
                    reminder.sent_at = datetime.utcnow()
                    logger.info(f"Sent {reminder.reminder_type} reminder for '{reminder.event_title}'")
                else:
                    reminder.status = "failed"
                    reminder.error_message = "Failed to send notification"

            except Exception as e:
                logger.error(f"Error executing reminder {reminder_id}: {e}")
                reminder.status = "failed"
                reminder.error_message = str(e)

            await db.commit()

    async def _send_email_reminder(self, reminder: CalendarReminder) -> bool:
        """Send email reminder"""
        if not reminder.user_email:
            logger.warning(f"No email for reminder {reminder.id}")
            return False

        try:
            # Format time
            event_time = reminder.event_start.strftime("%B %d, %Y at %I:%M %p")

            result = await notify_client.send_template_email(
                to=reminder.user_email,
                template_name="calendar_reminder",
                template_data={
                    "event_title": reminder.event_title,
                    "event_time": event_time,
                    "event_location": reminder.event_location or "Not specified",
                    "minutes_before": reminder.minutes_before
                },
                subject=f"Reminder: {reminder.event_title}"
            )

            return not result.get("error")
        except Exception as e:
            logger.error(f"Email reminder error: {e}")
            return False

    async def _send_browser_notification(self, reminder: CalendarReminder) -> bool:
        """Send browser notification via WebSocket"""
        user_id = str(reminder.user_id)

        if user_id in self.active_connections:
            try:
                websocket = self.active_connections[user_id]
                await websocket.send_json({
                    "type": "calendar_reminder",
                    "data": {
                        "id": str(reminder.id),
                        "event_uid": reminder.event_uid,
                        "event_title": reminder.event_title,
                        "event_start": reminder.event_start.isoformat(),
                        "event_location": reminder.event_location,
                        "minutes_before": reminder.minutes_before
                    }
                })
                return True
            except Exception as e:
                logger.error(f"Browser notification error: {e}")
                return False

        logger.debug(f"No active connection for user {user_id}")
        return True  # Consider it sent - client will fetch on reconnect

    async def _send_sms_reminder(self, reminder: CalendarReminder) -> bool:
        """Send SMS reminder"""
        if not reminder.user_phone:
            logger.warning(f"No phone for reminder {reminder.id}")
            return False

        try:
            event_time = reminder.event_start.strftime("%I:%M %p")
            message = f"Reminder: {reminder.event_title} at {event_time}"

            if reminder.event_location:
                message += f" - {reminder.event_location}"

            result = await notify_client.send_sms(
                phone=reminder.user_phone,
                message=message
            )

            return not result.get("error")
        except Exception as e:
            logger.error(f"SMS reminder error: {e}")
            return False

    async def _send_whatsapp_reminder(self, reminder: CalendarReminder) -> bool:
        """Send WhatsApp reminder"""
        if not reminder.user_phone:
            logger.warning(f"No phone for reminder {reminder.id}")
            return False

        try:
            event_time = reminder.event_start.strftime("%B %d at %I:%M %p")

            result = await notify_client.send_whatsapp_template(
                phone=reminder.user_phone,
                template_name="calendar_reminder",
                parameters=[
                    reminder.event_title,
                    event_time,
                    reminder.event_location or "Not specified"
                ]
            )

            return not result.get("error")
        except Exception as e:
            logger.error(f"WhatsApp reminder error: {e}")
            return False

    def register_connection(self, user_id: str, websocket: Any):
        """Register WebSocket connection for browser notifications"""
        self.active_connections[user_id] = websocket
        logger.debug(f"Registered calendar WebSocket for user {user_id}")

    def unregister_connection(self, user_id: str):
        """Unregister WebSocket connection"""
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            logger.debug(f"Unregistered calendar WebSocket for user {user_id}")

    async def load_pending_reminders(self, db: AsyncSession):
        """Load pending reminders on startup and schedule them"""
        if not self._initialized:
            self.initialize()

        now = datetime.utcnow()
        result = await db.execute(
            select(CalendarReminder).where(
                CalendarReminder.status == "pending",
                CalendarReminder.trigger_time > now
            )
        )
        reminders = result.scalars().all()

        scheduled = 0
        for reminder in reminders:
            job_id = f"calendar_reminder_{reminder.id}"
            self.scheduler.add_job(
                self._execute_reminder,
                trigger=DateTrigger(run_date=reminder.trigger_time),
                id=job_id,
                args=[str(reminder.id)],
                replace_existing=True
            )
            scheduled += 1

        logger.info(f"Loaded {scheduled} pending calendar reminders")


# Singleton instance
calendar_reminder_service = CalendarReminderService()
