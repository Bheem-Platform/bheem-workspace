"""
Bheem Workspace - Security Alerts Service
Monitors and alerts on suspicious activity.
"""
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from core.logging import get_logger
from core.config import settings
from integrations.notify.notify_client import notify_client

logger = get_logger("bheem.security.alerts")


class SecurityAlertsService:
    """
    Security Alerts Service.
    Monitors login patterns and sends alerts for suspicious activity.
    """

    def __init__(self):
        self.failed_login_threshold = 5  # Max failed attempts before alert
        self.failed_login_window_minutes = 15
        self.new_device_alert_enabled = True
        self.unusual_location_alert_enabled = True

    async def check_login(
        self,
        db: AsyncSession,
        user_id: str,
        email: str,
        ip_address: str,
        user_agent: str,
        success: bool = True,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Check login for suspicious patterns and log activity.

        Args:
            db: Database session
            user_id: User ID
            email: User email
            ip_address: Request IP address
            user_agent: Request user agent
            success: Whether login was successful
            tenant_id: Tenant ID if known

        Returns:
            Dict with alerts and actions taken
        """
        alerts = []
        action = "login" if success else "login_failed"

        # Log the login attempt
        extra_data = {
            "user_agent": user_agent,
            "success": success
        }

        try:
            await db.execute(
                text("""
                    INSERT INTO workspace.activity_log
                    (id, tenant_id, user_id, action, ip_address, extra_data, created_at)
                    VALUES (gen_random_uuid(),
                            CAST(:tenant_id AS uuid),
                            CAST(:user_id AS uuid),
                            :action, :ip_address::inet,
                            :extra_data::jsonb, NOW())
                """),
                {
                    "tenant_id": tenant_id,
                    "user_id": user_id,
                    "action": action,
                    "ip_address": ip_address,
                    "extra_data": str(extra_data).replace("'", '"')
                }
            )
            await db.commit()
        except Exception as e:
            logger.warning(f"Failed to log login activity: {e}")

        # Check for failed login threshold
        if not success:
            failed_count = await self._count_recent_failed_logins(
                db, user_id, self.failed_login_window_minutes
            )

            if failed_count >= self.failed_login_threshold:
                alert = {
                    "type": "multiple_failed_logins",
                    "severity": "high",
                    "message": f"Multiple failed login attempts ({failed_count}) for user {email}",
                    "user_id": user_id,
                    "count": failed_count
                }
                alerts.append(alert)

                # Send alert email
                await self._send_security_alert(
                    email=email,
                    alert_type="Failed Login Attempts",
                    details={
                        "failed_attempts": failed_count,
                        "ip_address": ip_address,
                        "time": datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
                    }
                )

        # Check for new device (if successful login)
        if success and self.new_device_alert_enabled:
            is_new = await self._is_new_device(db, user_id, user_agent)
            if is_new:
                alert = {
                    "type": "new_device",
                    "severity": "medium",
                    "message": f"New device login detected for {email}",
                    "user_id": user_id,
                    "device": user_agent[:100]
                }
                alerts.append(alert)

                # Send new device alert
                await self._send_security_alert(
                    email=email,
                    alert_type="New Device Login",
                    details={
                        "device": user_agent[:100],
                        "ip_address": ip_address,
                        "time": datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
                    }
                )

        return {
            "logged": True,
            "alerts": alerts,
            "alert_count": len(alerts)
        }

    async def _count_recent_failed_logins(
        self,
        db: AsyncSession,
        user_id: str,
        window_minutes: int
    ) -> int:
        """Count failed login attempts in the last N minutes."""
        since = datetime.utcnow() - timedelta(minutes=window_minutes)

        try:
            result = await db.execute(
                text("""
                    SELECT COUNT(*) as count
                    FROM workspace.activity_log
                    WHERE user_id = CAST(:user_id AS uuid)
                    AND action = 'login_failed'
                    AND created_at > :since
                """),
                {"user_id": user_id, "since": since}
            )
            return result.scalar() or 0
        except Exception as e:
            logger.warning(f"Failed to count failed logins: {e}")
            return 0

    async def _is_new_device(
        self,
        db: AsyncSession,
        user_id: str,
        user_agent: str
    ) -> bool:
        """Check if this is a new device for the user."""
        try:
            # Check if we've seen this user agent before
            result = await db.execute(
                text("""
                    SELECT COUNT(*) as count
                    FROM workspace.activity_log
                    WHERE user_id = CAST(:user_id AS uuid)
                    AND action = 'login'
                    AND extra_data->>'user_agent' = :user_agent
                    AND created_at > NOW() - INTERVAL '90 days'
                """),
                {"user_id": user_id, "user_agent": user_agent}
            )
            count = result.scalar() or 0
            return count == 0  # New device if we haven't seen it
        except Exception as e:
            logger.warning(f"Failed to check new device: {e}")
            return False

    async def _send_security_alert(
        self,
        email: str,
        alert_type: str,
        details: Dict[str, Any]
    ) -> bool:
        """Send security alert email to user."""
        try:
            # Build alert message
            detail_lines = [f"- {k}: {v}" for k, v in details.items()]
            message = f"""
Security Alert: {alert_type}

We detected the following activity on your Bheem Workspace account:

{chr(10).join(detail_lines)}

If this was you, no action is needed.
If you don't recognize this activity, please:
1. Change your password immediately
2. Enable two-factor authentication
3. Contact support at support@bheem.cloud

Stay secure,
Bheem Workspace Security Team
            """.strip()

            await notify_client.send_email(
                to=email,
                subject=f"[Security Alert] {alert_type}",
                body=message
            )
            logger.info(f"Sent security alert to {email}: {alert_type}")
            return True

        except Exception as e:
            logger.error(f"Failed to send security alert: {e}")
            return False

    async def log_suspicious_activity(
        self,
        db: AsyncSession,
        user_id: str,
        tenant_id: str,
        activity_type: str,
        description: str,
        ip_address: Optional[str] = None
    ) -> bool:
        """Log a suspicious activity."""
        try:
            await db.execute(
                text("""
                    INSERT INTO workspace.activity_log
                    (id, tenant_id, user_id, action, description, ip_address, created_at)
                    VALUES (gen_random_uuid(),
                            CAST(:tenant_id AS uuid),
                            CAST(:user_id AS uuid),
                            :action, :description,
                            :ip_address::inet, NOW())
                """),
                {
                    "tenant_id": tenant_id,
                    "user_id": user_id,
                    "action": activity_type,
                    "description": description,
                    "ip_address": ip_address
                }
            )
            await db.commit()
            return True
        except Exception as e:
            logger.error(f"Failed to log suspicious activity: {e}")
            return False


# Singleton instance
security_alerts_service = SecurityAlertsService()


# FastAPI dependency
async def get_security_alerts() -> SecurityAlertsService:
    """FastAPI dependency for security alerts service."""
    return security_alerts_service
