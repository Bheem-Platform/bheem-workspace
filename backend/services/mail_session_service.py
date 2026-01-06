"""
Bheem Workspace - Mail Session Service
Secure session-based mail credential storage using Redis + encryption
With in-memory fallback when Redis is unavailable
"""
import json
import uuid
import time
from datetime import timedelta
from typing import Optional, Dict, Any
from cryptography.fernet import Fernet, InvalidToken
from core.config import settings
from core.logging import get_logger

logger = get_logger("bheem.mail.session")


class MailSessionService:
    """
    Manages encrypted mail sessions.
    Uses Redis if available, falls back to in-memory storage.
    """

    def __init__(self):
        self._redis_client = None
        self._cipher: Optional[Fernet] = None
        self._initialized = False
        self._use_redis = False
        # In-memory fallback storage: {session_key: (encrypted_data, expiry_timestamp)}
        self._memory_store: Dict[str, tuple] = {}

    def _ensure_initialized(self):
        """Lazy initialization of storage and encryption."""
        if self._initialized:
            return

        # Initialize encryption
        if settings.MAIL_ENCRYPTION_KEY:
            self._cipher = Fernet(settings.MAIL_ENCRYPTION_KEY.encode())
        else:
            logger.warning(
                "MAIL_ENCRYPTION_KEY not set - generating temporary key. "
                "Sessions will be lost on restart.",
                action="mail_session_init"
            )
            self._cipher = Fernet(Fernet.generate_key())

        # Try to connect to Redis
        try:
            import redis
            self._redis_client = redis.from_url(
                settings.REDIS_URL,
                decode_responses=False,
                socket_connect_timeout=3,
                socket_timeout=3
            )
            self._redis_client.ping()
            self._use_redis = True
            logger.info("Mail session service initialized with Redis", action="mail_session_init")
        except Exception as e:
            logger.warning(
                f"Redis not available, using in-memory storage: {e}",
                action="mail_session_init_fallback"
            )
            self._use_redis = False
            self._redis_client = None

        self._initialized = True

    def _cleanup_expired_memory(self):
        """Remove expired sessions from memory store."""
        now = time.time()
        expired = [k for k, (_, exp) in self._memory_store.items() if exp < now]
        for k in expired:
            del self._memory_store[k]

    @property
    def session_ttl(self) -> timedelta:
        """Session time-to-live."""
        return timedelta(hours=settings.MAIL_SESSION_TTL_HOURS)

    def _get_session_key(self, user_id: str) -> str:
        """Generate key for user's mail session."""
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
        """
        self._ensure_initialized()

        session_key = self._get_session_key(user_id)
        session_id = str(uuid.uuid4())
        ttl_seconds = int(self.session_ttl.total_seconds())

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

        if self._use_redis:
            self._redis_client.setex(session_key, ttl_seconds, encrypted_data)
        else:
            # In-memory storage with expiry timestamp
            expiry = time.time() + ttl_seconds
            self._memory_store[session_key] = (encrypted_data, expiry)
            self._cleanup_expired_memory()

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
        """
        self._ensure_initialized()

        session_key = self._get_session_key(user_id)

        if self._use_redis:
            encrypted_data = self._redis_client.get(session_key)
        else:
            self._cleanup_expired_memory()
            stored = self._memory_store.get(session_key)
            if stored and stored[1] > time.time():
                encrypted_data = stored[0]
            else:
                encrypted_data = None

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
            if self._use_redis:
                self._redis_client.delete(session_key)
            else:
                self._memory_store.pop(session_key, None)
            return None

    def get_session_info(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get session metadata (without password).
        """
        self._ensure_initialized()

        session_key = self._get_session_key(user_id)

        if self._use_redis:
            encrypted_data = self._redis_client.get(session_key)
            ttl = self._redis_client.ttl(session_key) if encrypted_data else -1
        else:
            self._cleanup_expired_memory()
            stored = self._memory_store.get(session_key)
            if stored and stored[1] > time.time():
                encrypted_data = stored[0]
                ttl = int(stored[1] - time.time())
            else:
                encrypted_data = None
                ttl = -1

        if not encrypted_data:
            return None

        try:
            decrypted_data = self._cipher.decrypt(encrypted_data)
            session_data = json.loads(decrypted_data)

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
        """
        self._ensure_initialized()

        session_key = self._get_session_key(user_id)
        ttl_seconds = int(self.session_ttl.total_seconds())

        if self._use_redis:
            if not self._redis_client.exists(session_key):
                return False
            self._redis_client.expire(session_key, ttl_seconds)
        else:
            stored = self._memory_store.get(session_key)
            if not stored or stored[1] < time.time():
                return False
            self._memory_store[session_key] = (stored[0], time.time() + ttl_seconds)

        logger.info(
            f"Mail session refreshed for user {user_id}",
            action="mail_session_refreshed",
            user_id=user_id
        )

        return True

    def destroy_session(self, user_id: str) -> bool:
        """
        Destroy mail session (logout).
        """
        self._ensure_initialized()

        session_key = self._get_session_key(user_id)

        if self._use_redis:
            deleted = self._redis_client.delete(session_key)
        else:
            deleted = 1 if self._memory_store.pop(session_key, None) else 0

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
        """
        self._ensure_initialized()

        session_key = self._get_session_key(user_id)

        if self._use_redis:
            return self._redis_client.exists(session_key) > 0
        else:
            stored = self._memory_store.get(session_key)
            return stored is not None and stored[1] > time.time()

    def get_session_ttl(self, user_id: str) -> int:
        """
        Get remaining TTL for user's session.
        """
        self._ensure_initialized()

        session_key = self._get_session_key(user_id)

        if self._use_redis:
            ttl = self._redis_client.ttl(session_key)
            return ttl if ttl is not None else -1
        else:
            stored = self._memory_store.get(session_key)
            if stored and stored[1] > time.time():
                return int(stored[1] - time.time())
            return -1


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
