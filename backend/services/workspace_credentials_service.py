"""
Bheem Workspace - Workspace Credentials Service
Handles secure storage and retrieval of user credentials for Mail SSO
"""
from typing import Optional
from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from uuid import UUID

from core.config import settings
from core.logging import get_logger
from models.admin_models import TenantUser
from services.mail_session_service import mail_session_service

logger = get_logger("bheem.workspace.credentials")


class WorkspaceCredentialsService:
    """
    Manages encrypted workspace credentials for Mail SSO.
    Stores encrypted mail passwords in the database and auto-creates mail sessions.
    """

    def __init__(self):
        self._cipher: Optional[Fernet] = None
        self._initialized = False

    def _ensure_initialized(self):
        """Lazy initialization of encryption."""
        if self._initialized:
            return

        # Use same encryption key as mail session service
        if settings.MAIL_ENCRYPTION_KEY:
            self._cipher = Fernet(settings.MAIL_ENCRYPTION_KEY.encode())
        else:
            logger.warning(
                "MAIL_ENCRYPTION_KEY not set - generating temporary key. "
                "Stored credentials will be invalid on restart.",
                action="credentials_init"
            )
            self._cipher = Fernet(Fernet.generate_key())

        self._initialized = True

    def encrypt_password(self, password: str) -> str:
        """Encrypt a password for storage."""
        self._ensure_initialized()
        encrypted = self._cipher.encrypt(password.encode())
        return encrypted.decode('utf-8')

    def decrypt_password(self, encrypted_password: str) -> Optional[str]:
        """Decrypt a stored password."""
        self._ensure_initialized()
        try:
            decrypted = self._cipher.decrypt(encrypted_password.encode())
            return decrypted.decode('utf-8')
        except (InvalidToken, Exception) as e:
            logger.error(f"Failed to decrypt password: {e}", action="decrypt_failed")
            return None

    async def store_mail_credentials(
        self,
        db: AsyncSession,
        user_id: str,
        tenant_id: str,
        password: str
    ) -> bool:
        """
        Store encrypted mail credentials for a user.
        Called during user provisioning.
        """
        try:
            encrypted_password = self.encrypt_password(password)

            await db.execute(
                update(TenantUser)
                .where(
                    TenantUser.user_id == UUID(user_id),
                    TenantUser.tenant_id == UUID(tenant_id)
                )
                .values(encrypted_mail_password=encrypted_password)
            )
            await db.commit()

            logger.info(
                f"Stored mail credentials for user {user_id}",
                action="credentials_stored",
                user_id=user_id
            )
            return True

        except Exception as e:
            logger.error(f"Failed to store mail credentials: {e}", action="credentials_store_failed")
            return False

    async def get_user_mail_credentials(
        self,
        db: AsyncSession,
        user_id: str
    ) -> Optional[dict]:
        """
        Get mail credentials for a user.
        Returns email and decrypted password.
        """
        try:
            result = await db.execute(
                select(TenantUser).where(TenantUser.user_id == UUID(user_id))
            )
            tenant_user = result.scalar_one_or_none()

            if not tenant_user:
                logger.warning(f"User {user_id} not found in tenant_users", action="credentials_not_found")
                return None

            if not tenant_user.encrypted_mail_password:
                logger.debug(f"No stored mail credentials for user {user_id}", action="no_credentials")
                return None

            password = self.decrypt_password(tenant_user.encrypted_mail_password)
            if not password:
                return None

            return {
                "email": tenant_user.email,
                "password": password
            }

        except Exception as e:
            logger.error(f"Failed to get mail credentials: {e}", action="credentials_get_failed")
            return None

    async def auto_create_mail_session(
        self,
        db: AsyncSession,
        user_id: str
    ) -> Optional[dict]:
        """
        Automatically create a mail session using stored credentials.
        Called after workspace login for Mail SSO.
        """
        # Get stored credentials
        credentials = await self.get_user_mail_credentials(db, user_id)
        if not credentials:
            logger.debug(f"No credentials for auto mail session for user {user_id}", action="auto_session_skip")
            return None

        # Create mail session
        try:
            session_info = mail_session_service.create_session(
                user_id=user_id,
                email=credentials["email"],
                password=credentials["password"]
            )

            logger.info(
                f"Auto-created mail session for user {user_id}",
                action="auto_mail_session_created",
                user_id=user_id,
                email=credentials["email"]
            )

            return session_info

        except Exception as e:
            logger.error(f"Failed to auto-create mail session: {e}", action="auto_session_failed")
            return None

    async def clear_mail_credentials(
        self,
        db: AsyncSession,
        user_id: str,
        tenant_id: str
    ) -> bool:
        """
        Clear stored mail credentials for a user.
        Called during user deprovisioning or password change.
        """
        try:
            await db.execute(
                update(TenantUser)
                .where(
                    TenantUser.user_id == UUID(user_id),
                    TenantUser.tenant_id == UUID(tenant_id)
                )
                .values(encrypted_mail_password=None)
            )
            await db.commit()

            logger.info(
                f"Cleared mail credentials for user {user_id}",
                action="credentials_cleared",
                user_id=user_id
            )
            return True

        except Exception as e:
            logger.error(f"Failed to clear mail credentials: {e}", action="credentials_clear_failed")
            return False


# Singleton instance
workspace_credentials_service = WorkspaceCredentialsService()


# FastAPI dependency
async def get_workspace_credentials() -> WorkspaceCredentialsService:
    """FastAPI dependency for workspace credentials service."""
    return workspace_credentials_service
