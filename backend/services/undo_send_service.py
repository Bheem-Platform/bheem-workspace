"""
Bheem Workspace - Undo Send Service
Implements delayed email sending with undo capability
"""
from typing import Dict, Any, Optional
from uuid import UUID, uuid4
from datetime import datetime, timedelta
import json
import asyncio
from core.logging import get_logger

logger = get_logger("bheem.mail.undo_send")

# Default delay in seconds
DEFAULT_UNDO_DELAY = 30


class UndoSendService:
    """
    Service for implementing "Undo Send" functionality.

    Emails are queued with a delay before actually sending.
    Users can cancel within the delay window.
    Uses in-memory storage with Redis fallback for production.
    """

    def __init__(self):
        self._pending_emails: Dict[str, Dict[str, Any]] = {}
        self._tasks: Dict[str, asyncio.Task] = {}
        self._redis_client = None
        self._initialized = False

    async def initialize(self):
        """Initialize the service with Redis if available."""
        if self._initialized:
            return

        try:
            import redis.asyncio as redis
            import os

            redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
            self._redis_client = redis.from_url(redis_url, decode_responses=True)
            await self._redis_client.ping()
            logger.info("Undo send service connected to Redis", action="undo_send_redis_connected")
        except Exception as e:
            logger.warning(f"Redis not available, using in-memory storage: {e}", action="undo_send_memory_mode")
            self._redis_client = None

        self._initialized = True

    async def queue_email(
        self,
        user_id: str,
        email_data: Dict[str, Any],
        delay_seconds: int = DEFAULT_UNDO_DELAY
    ) -> Dict[str, Any]:
        """
        Queue an email for delayed sending.

        Args:
            user_id: The user ID sending the email
            email_data: Email content (to, cc, bcc, subject, body, is_html)
            delay_seconds: Seconds to wait before sending

        Returns:
            Dict with queue_id and send_at time
        """
        await self.initialize()

        queue_id = str(uuid4())
        send_at = datetime.utcnow() + timedelta(seconds=delay_seconds)

        queued_email = {
            "queue_id": queue_id,
            "user_id": user_id,
            "email_data": email_data,
            "queued_at": datetime.utcnow().isoformat(),
            "send_at": send_at.isoformat(),
            "delay_seconds": delay_seconds,
            "status": "pending",
            "cancelled": False
        }

        if self._redis_client:
            # Store in Redis with TTL
            await self._redis_client.setex(
                f"undo_send:{queue_id}",
                delay_seconds + 60,  # Keep a bit longer for safety
                json.dumps(queued_email)
            )
            # Schedule the send
            asyncio.create_task(self._delayed_send_redis(queue_id, delay_seconds))
        else:
            # Store in memory
            self._pending_emails[queue_id] = queued_email
            # Schedule the send
            task = asyncio.create_task(self._delayed_send_memory(queue_id, delay_seconds))
            self._tasks[queue_id] = task

        logger.info(
            f"Queued email {queue_id} for delayed send",
            action="email_queued",
            queue_id=queue_id,
            user_id=user_id,
            delay_seconds=delay_seconds
        )

        return {
            "queue_id": queue_id,
            "send_at": send_at.isoformat(),
            "delay_seconds": delay_seconds,
            "can_undo": True
        }

    async def cancel_send(self, queue_id: str, user_id: str) -> Dict[str, Any]:
        """
        Cancel a queued email before it's sent.

        Args:
            queue_id: The queue ID to cancel
            user_id: The user ID (for authorization)

        Returns:
            Dict with success status and email data
        """
        await self.initialize()

        if self._redis_client:
            # Get from Redis
            data = await self._redis_client.get(f"undo_send:{queue_id}")
            if not data:
                return {"success": False, "error": "Email not found or already sent"}

            queued_email = json.loads(data)

            # Verify ownership
            if queued_email.get("user_id") != user_id:
                return {"success": False, "error": "Unauthorized"}

            # Check if already sent or cancelled
            if queued_email.get("status") != "pending":
                return {"success": False, "error": f"Email already {queued_email.get('status')}"}

            # Mark as cancelled
            queued_email["status"] = "cancelled"
            queued_email["cancelled"] = True
            queued_email["cancelled_at"] = datetime.utcnow().isoformat()

            await self._redis_client.setex(
                f"undo_send:{queue_id}",
                60,  # Keep for 1 minute for reference
                json.dumps(queued_email)
            )
        else:
            # Get from memory
            queued_email = self._pending_emails.get(queue_id)
            if not queued_email:
                return {"success": False, "error": "Email not found or already sent"}

            # Verify ownership
            if queued_email.get("user_id") != user_id:
                return {"success": False, "error": "Unauthorized"}

            # Check if already sent or cancelled
            if queued_email.get("status") != "pending":
                return {"success": False, "error": f"Email already {queued_email.get('status')}"}

            # Cancel the task
            if queue_id in self._tasks:
                self._tasks[queue_id].cancel()
                del self._tasks[queue_id]

            # Mark as cancelled
            queued_email["status"] = "cancelled"
            queued_email["cancelled"] = True
            queued_email["cancelled_at"] = datetime.utcnow().isoformat()

        logger.info(
            f"Cancelled queued email {queue_id}",
            action="email_cancelled",
            queue_id=queue_id,
            user_id=user_id
        )

        return {
            "success": True,
            "message": "Email send cancelled",
            "email_data": queued_email.get("email_data")
        }

    async def get_queued_email(self, queue_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a queued email."""
        await self.initialize()

        if self._redis_client:
            data = await self._redis_client.get(f"undo_send:{queue_id}")
            if not data:
                return None
            queued_email = json.loads(data)
        else:
            queued_email = self._pending_emails.get(queue_id)
            if not queued_email:
                return None

        # Verify ownership
        if queued_email.get("user_id") != user_id:
            return None

        # Calculate remaining time
        send_at = datetime.fromisoformat(queued_email["send_at"])
        remaining = (send_at - datetime.utcnow()).total_seconds()

        return {
            "queue_id": queue_id,
            "status": queued_email.get("status"),
            "email_data": queued_email.get("email_data"),
            "send_at": queued_email.get("send_at"),
            "remaining_seconds": max(0, int(remaining)),
            "can_undo": queued_email.get("status") == "pending" and remaining > 0
        }

    async def _delayed_send_redis(self, queue_id: str, delay_seconds: int):
        """Handle delayed send with Redis storage."""
        try:
            await asyncio.sleep(delay_seconds)

            # Check if still pending
            data = await self._redis_client.get(f"undo_send:{queue_id}")
            if not data:
                return

            queued_email = json.loads(data)

            if queued_email.get("cancelled") or queued_email.get("status") != "pending":
                return

            # Send the email
            await self._send_email(queued_email)

            # Update status
            queued_email["status"] = "sent"
            queued_email["sent_at"] = datetime.utcnow().isoformat()

            await self._redis_client.setex(
                f"undo_send:{queue_id}",
                300,  # Keep for 5 minutes after sending
                json.dumps(queued_email)
            )

        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error in delayed send: {e}", action="delayed_send_error")

    async def _delayed_send_memory(self, queue_id: str, delay_seconds: int):
        """Handle delayed send with in-memory storage."""
        try:
            await asyncio.sleep(delay_seconds)

            queued_email = self._pending_emails.get(queue_id)
            if not queued_email:
                return

            if queued_email.get("cancelled") or queued_email.get("status") != "pending":
                return

            # Send the email
            await self._send_email(queued_email)

            # Update status
            queued_email["status"] = "sent"
            queued_email["sent_at"] = datetime.utcnow().isoformat()

            # Clean up task
            if queue_id in self._tasks:
                del self._tasks[queue_id]

        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error in delayed send: {e}", action="delayed_send_error")
            if queue_id in self._pending_emails:
                self._pending_emails[queue_id]["status"] = "failed"
                self._pending_emails[queue_id]["error"] = str(e)

    async def _send_email(self, queued_email: Dict[str, Any]):
        """Actually send the email."""
        from services.mail_session_service import mail_session_service
        from services.mailcow_service import mailcow_service

        user_id = queued_email["user_id"]
        email_data = queued_email["email_data"]

        # Get credentials
        credentials = mail_session_service.get_credentials(user_id)
        if not credentials:
            raise Exception("Mail session expired")

        # Send via mailcow
        success = mailcow_service.send_email(
            from_email=credentials['email'],
            password=credentials['password'],
            to=email_data.get('to', []),
            subject=email_data.get('subject', ''),
            body=email_data.get('body', ''),
            cc=email_data.get('cc'),
            bcc=email_data.get('bcc'),
            is_html=email_data.get('is_html', True)
        )

        if not success:
            raise Exception("Failed to send email via SMTP")

        logger.info(
            f"Sent queued email {queued_email['queue_id']}",
            action="queued_email_sent",
            queue_id=queued_email['queue_id'],
            user_id=user_id
        )


# Singleton instance
undo_send_service = UndoSendService()
