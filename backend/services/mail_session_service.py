"""
Bheem Workspace - Mail Session Service
Secure session-based mail credential storage using Redis + encryption
"""
import json
import uuid
import redis
from datetime import timedelta
from typing import Optional, Dict, Any
from cryptography.fernet import Fernet, InvalidToken
from core.config import settings
from core.logging import get_logger

logger = get_logger("bheem.mail.session")


class MailSessionService:
    """
    Manages encrypted mail sessions stored in Redis.
    Replaces insecure localStorage/URL credential passing.
    """

    def __init__(self):
        self._redis_client: Optional[redis.Redis] = None
        self._cipher: Optional[Fernet] = None
        self._initialized = False

    def _ensure_initialized(self):
        """Lazy initialization of Redis and encryption."""
        if self._initialized:
            return

        try:
            # Initialize Redis connection
            self._redis_client = redis.from_url(
                settings.REDIS_URL,
                decode_responses=False,  # We need bytes for encryption
                socket_connect_timeout=5,
                socket_timeout=5
            )
            # Test connection
            self._redis_client.ping()

            # Initialize encryption
            if settings.MAIL_ENCRYPTION_KEY:
                self._cipher = Fernet(settings.MAIL_ENCRYPTION_KEY.encode())
            else:
                # Generate a key if not configured (for development)
                # In production, MAIL_ENCRYPTION_KEY should be set
                logger.warning(
                    "MAIL_ENCRYPTION_KEY not set - generating temporary key. "
                    "Sessions will be lost on restart.",
                    action="mail_session_init"
                )
                self._cipher = Fernet(Fernet.generate_key())

            self._initialized = True
            logger.info("Mail session service initialized", action="mail_session_init")

        except redis.ConnectionError as e:
            logger.error(f"Redis connection failed: {e}", action="mail_session_init_failed")
            raise RuntimeError(f"Cannot connect to Redis: {e}")

    @property
    def session_ttl(self) -> timedelta:
        """Session time-to-live."""
        return timedelta(hours=settings.MAIL_SESSION_TTL_HOURS)

    def _get_session_key(self, user_id: str) -> str:
        """Generate Redis key for user's mail session."""
        return f"mail_session:{user_id}"

    def create_session(
        self,
        user_id: str,
        email: str,
        password: str,
        additional_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Create an encrypted mail session for the user.

        Args:
            user_id: Unique user identifier
            email: User's mail address
            password: User's mail password
            additional_data: Optional extra session data

        Returns:
            Session info including session_id and expiry
        """
        self._ensure_initialized()

        session_key = self._get_session_key(user_id)
        session_id = str(uuid.uuid4())

        # Prepare session data
        session_data = {
            "session_id": session_id,
            "email": email,
            "password": password,
            "user_id": user_id,
            **(additional_data or {})
        }

        # Encrypt session data
        encrypted_data = self._cipher.encrypt(
            json.dumps(session_data).encode()
        )

        # Store in Redis with TTL
        ttl_seconds = int(self.session_ttl.total_seconds())
        self._redis_client.setex(
            session_key,
            ttl_seconds,
            encrypted_data
        )

        logger.info(
            f"Mail session created for user {user_id}",
            action="mail_session_created",
            user_id=user_id,
            email=email
        )

        return {
            "session_id": session_id,
            "expires_in_seconds": ttl_seconds,
            "email": email
        }

    def get_credentials(self, user_id: str) -> Optional[Dict[str, str]]:
        """
        Retrieve decrypted mail credentials from session.

        Args:
            user_id: User identifier

        Returns:
            Dict with email and password, or None if session doesn't exist
        """
        self._ensure_initialized()

        session_key = self._get_session_key(user_id)
        encrypted_data = self._redis_client.get(session_key)

        if not encrypted_data:
            return None

        try:
            decrypted_data = self._cipher.decrypt(encrypted_data)
            session_data = json.loads(decrypted_data)
            return {
                "email": session_data["email"],
                "password": session_data["password"]
            }
        except (InvalidToken, json.JSONDecodeError, KeyError) as e:
            logger.error(
                f"Failed to decrypt mail session: {e}",
                action="mail_session_decrypt_failed",
                user_id=user_id
            )
            # Invalid/corrupted session - delete it
            self._redis_client.delete(session_key)
            return None

    def get_session_info(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get session metadata (without password).

        Args:
            user_id: User identifier

        Returns:
            Session info or None
        """
        self._ensure_initialized()

        session_key = self._get_session_key(user_id)
        encrypted_data = self._redis_client.get(session_key)

        if not encrypted_data:
            return None

        try:
            decrypted_data = self._cipher.decrypt(encrypted_data)
            session_data = json.loads(decrypted_data)

            # Get TTL
            ttl = self._redis_client.ttl(session_key)

            return {
                "session_id": session_data.get("session_id"),
                "email": session_data.get("email"),
                "user_id": session_data.get("user_id"),
                "expires_in_seconds": ttl if ttl > 0 else 0,
                "active": True
            }
        except (InvalidToken, json.JSONDecodeError) as e:
            logger.error(
                f"Failed to get session info: {e}",
                action="mail_session_info_failed",
                user_id=user_id
            )
            return None

    def refresh_session(self, user_id: str) -> bool:
        """
        Extend session TTL without re-authenticating.

        Args:
            user_id: User identifier

        Returns:
            True if session was refreshed, False if not found
        """
        self._ensure_initialized()

        session_key = self._get_session_key(user_id)

        # Check if session exists
        if not self._redis_client.exists(session_key):
            return False

        # Extend TTL
        ttl_seconds = int(self.session_ttl.total_seconds())
        self._redis_client.expire(session_key, ttl_seconds)

        logger.info(
            f"Mail session refreshed for user {user_id}",
            action="mail_session_refreshed",
            user_id=user_id
        )

        return True

    def destroy_session(self, user_id: str) -> bool:
        """
        Destroy mail session (logout).

        Args:
            user_id: User identifier

        Returns:
            True if session was destroyed, False if not found
        """
        self._ensure_initialized()

        session_key = self._get_session_key(user_id)
        deleted = self._redis_client.delete(session_key)

        if deleted:
            logger.info(
                f"Mail session destroyed for user {user_id}",
                action="mail_session_destroyed",
                user_id=user_id
            )

        return deleted > 0

    def has_active_session(self, user_id: str) -> bool:
        """
        Check if user has an active mail session.

        Args:
            user_id: User identifier

        Returns:
            True if active session exists
        """
        self._ensure_initialized()

        session_key = self._get_session_key(user_id)
        return self._redis_client.exists(session_key) > 0

    def get_session_ttl(self, user_id: str) -> int:
        """
        Get remaining TTL for user's session.

        Args:
            user_id: User identifier

        Returns:
            Remaining seconds, 0 if expired, -1 if not found
        """
        self._ensure_initialized()

        session_key = self._get_session_key(user_id)
        ttl = self._redis_client.ttl(session_key)
        return ttl if ttl is not None else -1


# Singleton instance
mail_session_service = MailSessionService()


# Dependency for FastAPI
async def get_mail_session() -> MailSessionService:
    """FastAPI dependency for mail session service."""
    return mail_session_service


# Dependency that requires active mail session
async def require_mail_session(
    user_id: str,
    mail_session: MailSessionService
) -> Dict[str, str]:
    """
    FastAPI dependency that requires an active mail session.
    Returns credentials or raises 401.
    """
    from fastapi import HTTPException, status

    credentials = mail_session.get_credentials(user_id)
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Mail session expired or not found. Please re-authenticate with /mail/session/create"
        )
    return credentials
