"""
Bheem Workspace - Mail 2FA Service
Two-Factor Authentication for mail access using TOTP
"""
import pyotp
import secrets
import hashlib
import base64
from io import BytesIO
from typing import Optional, List, Tuple
from datetime import datetime
from cryptography.fernet import Fernet
from core.config import settings
from core.logging import get_logger

logger = get_logger("bheem.mail.2fa")


class Mail2FAService:
    """
    Manages Two-Factor Authentication for mail access.
    Uses TOTP (Time-based One-Time Password) compatible with
    Google Authenticator, Authy, etc.
    """

    BACKUP_CODE_COUNT = 10
    BACKUP_CODE_LENGTH = 8
    ISSUER_NAME = "Bheem Mail"

    def __init__(self):
        self._cipher: Optional[Fernet] = None
        self._initialized = False

    def _ensure_initialized(self):
        """Lazy initialization of encryption."""
        if self._initialized:
            return

        if settings.MAIL_ENCRYPTION_KEY:
            self._cipher = Fernet(settings.MAIL_ENCRYPTION_KEY.encode())
        else:
            # Generate temporary key (sessions won't persist across restarts)
            logger.warning(
                "MAIL_ENCRYPTION_KEY not set - 2FA secrets won't persist",
                action="2fa_init_warning"
            )
            self._cipher = Fernet(Fernet.generate_key())

        self._initialized = True

    def generate_secret(self) -> str:
        """
        Generate a new TOTP secret for a user.

        Returns:
            Base32-encoded secret key
        """
        return pyotp.random_base32()

    def encrypt_secret(self, secret: str) -> str:
        """Encrypt the TOTP secret for database storage."""
        self._ensure_initialized()
        return self._cipher.encrypt(secret.encode()).decode()

    def decrypt_secret(self, encrypted_secret: str) -> str:
        """Decrypt the TOTP secret from database."""
        self._ensure_initialized()
        return self._cipher.decrypt(encrypted_secret.encode()).decode()

    def get_provisioning_uri(self, secret: str, user_email: str) -> str:
        """
        Generate the provisioning URI for authenticator apps.

        Args:
            secret: The TOTP secret
            user_email: User's email address

        Returns:
            otpauth:// URI for QR code
        """
        totp = pyotp.TOTP(secret)
        return totp.provisioning_uri(
            name=user_email,
            issuer_name=self.ISSUER_NAME
        )

    def generate_qr_code(self, secret: str, user_email: str) -> str:
        """
        Generate a QR code image for the TOTP secret.

        Args:
            secret: The TOTP secret
            user_email: User's email address

        Returns:
            Base64-encoded PNG image data
        """
        try:
            import qrcode
            from qrcode.image.pure import PyPNGImage
        except ImportError:
            logger.error("qrcode package not installed", action="2fa_qr_error")
            raise RuntimeError("QR code generation not available")

        uri = self.get_provisioning_uri(secret, user_email)

        # Generate QR code
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(uri)
        qr.make(fit=True)

        # Create image
        img = qr.make_image(fill_color="black", back_color="white")

        # Convert to base64
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)

        return base64.b64encode(buffer.getvalue()).decode()

    def verify_code(self, secret: str, code: str, valid_window: int = 1) -> bool:
        """
        Verify a TOTP code.

        Args:
            secret: The TOTP secret
            code: The 6-digit code to verify
            valid_window: Number of 30-second windows to check (default 1 = ±30s)

        Returns:
            True if code is valid
        """
        if not code or len(code) != 6:
            return False

        try:
            totp = pyotp.TOTP(secret)
            return totp.verify(code, valid_window=valid_window)
        except Exception as e:
            logger.error(f"TOTP verification error: {e}", action="2fa_verify_error")
            return False

    def generate_backup_codes(self) -> Tuple[List[str], List[str]]:
        """
        Generate backup codes for account recovery.

        Returns:
            Tuple of (plain_codes, hashed_codes)
            - plain_codes: To show to user once
            - hashed_codes: To store in database
        """
        plain_codes = []
        hashed_codes = []

        for _ in range(self.BACKUP_CODE_COUNT):
            # Generate random code
            code = secrets.token_hex(self.BACKUP_CODE_LENGTH // 2).upper()
            # Format as XXXX-XXXX
            formatted_code = f"{code[:4]}-{code[4:]}"
            plain_codes.append(formatted_code)

            # Hash for storage
            hashed = hashlib.sha256(formatted_code.encode()).hexdigest()
            hashed_codes.append(hashed)

        return plain_codes, hashed_codes

    def verify_backup_code(self, code: str, stored_hashes: List[str]) -> Tuple[bool, int]:
        """
        Verify a backup code.

        Args:
            code: The backup code entered by user
            stored_hashes: List of hashed backup codes from database

        Returns:
            Tuple of (is_valid, index)
            - is_valid: Whether the code matched
            - index: Index of the matched code (-1 if not found)
        """
        # Normalize code (remove dashes, uppercase)
        normalized = code.replace("-", "").upper()
        if len(normalized) == 8:
            normalized = f"{normalized[:4]}-{normalized[4:]}"

        code_hash = hashlib.sha256(normalized.encode()).hexdigest()

        for i, stored_hash in enumerate(stored_hashes):
            if secrets.compare_digest(code_hash, stored_hash):
                return True, i

        return False, -1

    def get_current_code(self, secret: str) -> str:
        """
        Get the current TOTP code (for testing/debugging).

        Args:
            secret: The TOTP secret

        Returns:
            Current 6-digit code
        """
        totp = pyotp.TOTP(secret)
        return totp.now()

    def get_time_remaining(self) -> int:
        """
        Get seconds remaining until current code expires.

        Returns:
            Seconds remaining (0-30)
        """
        import time
        return 30 - (int(time.time()) % 30)


# Singleton instance
mail_2fa_service = Mail2FAService()


# Database operations (to be used with SQLAlchemy session)
class Mail2FADatabaseOps:
    """Database operations for 2FA management."""

    @staticmethod
    async def setup_2fa(db, user_id: str, email: str) -> dict:
        """
        Start 2FA setup for a user.

        Returns setup data including secret and QR code.
        """
        # Generate new secret
        secret = mail_2fa_service.generate_secret()

        # Generate QR code
        qr_code = mail_2fa_service.generate_qr_code(secret, email)

        # Get provisioning URI (for manual entry)
        uri = mail_2fa_service.get_provisioning_uri(secret, email)

        # Log setup started
        await Mail2FADatabaseOps._log_action(
            db, user_id, "setup_started", True
        )

        return {
            "secret": secret,  # Will be stored encrypted after verification
            "qr_code": qr_code,
            "manual_entry_key": secret,
            "provisioning_uri": uri,
            "issuer": mail_2fa_service.ISSUER_NAME
        }

    @staticmethod
    async def enable_2fa(
        db,
        user_id: str,
        secret: str,
        verification_code: str
    ) -> Tuple[bool, Optional[List[str]]]:
        """
        Verify code and enable 2FA for user.

        Returns:
            Tuple of (success, backup_codes)
        """
        # Verify the code first
        if not mail_2fa_service.verify_code(secret, verification_code):
            await Mail2FADatabaseOps._log_action(
                db, user_id, "enable_failed", False, "Invalid verification code"
            )
            return False, None

        # Generate backup codes
        plain_codes, hashed_codes = mail_2fa_service.generate_backup_codes()

        # Encrypt secret for storage
        encrypted_secret = mail_2fa_service.encrypt_secret(secret)

        # Update user in database
        try:
            await db.execute(
                """
                UPDATE workspace.tenant_users
                SET mail_2fa_enabled = TRUE,
                    mail_2fa_secret = :secret,
                    mail_2fa_backup_codes = :backup_codes,
                    mail_2fa_enabled_at = NOW()
                WHERE id = :user_id
                """,
                {
                    "user_id": user_id,
                    "secret": encrypted_secret,
                    "backup_codes": hashed_codes
                }
            )
            await db.commit()

            await Mail2FADatabaseOps._log_action(
                db, user_id, "enabled", True
            )

            return True, plain_codes

        except Exception as e:
            logger.error(f"Failed to enable 2FA: {e}", action="2fa_enable_error")
            return False, None

    @staticmethod
    async def disable_2fa(
        db,
        user_id: str,
        verification_code: str
    ) -> bool:
        """
        Disable 2FA for user (requires valid code).
        """
        # Get current secret
        result = await db.execute(
            """
            SELECT mail_2fa_secret
            FROM workspace.tenant_users
            WHERE id = :user_id AND mail_2fa_enabled = TRUE
            """,
            {"user_id": user_id}
        )
        row = result.fetchone()

        if not row or not row.mail_2fa_secret:
            return False

        # Decrypt and verify
        secret = mail_2fa_service.decrypt_secret(row.mail_2fa_secret)
        if not mail_2fa_service.verify_code(secret, verification_code):
            await Mail2FADatabaseOps._log_action(
                db, user_id, "disable_failed", False, "Invalid code"
            )
            return False

        # Disable 2FA
        try:
            await db.execute(
                """
                UPDATE workspace.tenant_users
                SET mail_2fa_enabled = FALSE,
                    mail_2fa_secret = NULL,
                    mail_2fa_backup_codes = NULL,
                    mail_2fa_enabled_at = NULL
                WHERE id = :user_id
                """,
                {"user_id": user_id}
            )
            await db.commit()

            await Mail2FADatabaseOps._log_action(
                db, user_id, "disabled", True
            )

            return True

        except Exception as e:
            logger.error(f"Failed to disable 2FA: {e}", action="2fa_disable_error")
            return False

    @staticmethod
    async def verify_2fa(
        db,
        user_id: str,
        code: str,
        is_backup_code: bool = False
    ) -> bool:
        """
        Verify 2FA code during login.
        """
        result = await db.execute(
            """
            SELECT mail_2fa_secret, mail_2fa_backup_codes
            FROM workspace.tenant_users
            WHERE id = :user_id AND mail_2fa_enabled = TRUE
            """,
            {"user_id": user_id}
        )
        row = result.fetchone()

        if not row:
            return False

        if is_backup_code:
            # Verify backup code
            valid, index = mail_2fa_service.verify_backup_code(
                code, row.mail_2fa_backup_codes or []
            )

            if valid:
                # Remove used backup code
                backup_codes = list(row.mail_2fa_backup_codes)
                backup_codes.pop(index)

                await db.execute(
                    """
                    UPDATE workspace.tenant_users
                    SET mail_2fa_backup_codes = :backup_codes
                    WHERE id = :user_id
                    """,
                    {"user_id": user_id, "backup_codes": backup_codes}
                )
                await db.commit()

                await Mail2FADatabaseOps._log_action(
                    db, user_id, "backup_used", True
                )

            return valid

        else:
            # Verify TOTP code
            secret = mail_2fa_service.decrypt_secret(row.mail_2fa_secret)
            valid = mail_2fa_service.verify_code(secret, code)

            await Mail2FADatabaseOps._log_action(
                db, user_id,
                "verified" if valid else "failed_attempt",
                valid
            )

            return valid

    @staticmethod
    async def is_2fa_enabled(db, user_id: str) -> bool:
        """Check if 2FA is enabled for user."""
        result = await db.execute(
            """
            SELECT mail_2fa_enabled
            FROM workspace.tenant_users
            WHERE id = :user_id
            """,
            {"user_id": user_id}
        )
        row = result.fetchone()
        return row.mail_2fa_enabled if row else False

    @staticmethod
    async def regenerate_backup_codes(
        db,
        user_id: str,
        verification_code: str
    ) -> Optional[List[str]]:
        """
        Regenerate backup codes (requires valid TOTP code).
        """
        result = await db.execute(
            """
            SELECT mail_2fa_secret
            FROM workspace.tenant_users
            WHERE id = :user_id AND mail_2fa_enabled = TRUE
            """,
            {"user_id": user_id}
        )
        row = result.fetchone()

        if not row:
            return None

        # Verify current code
        secret = mail_2fa_service.decrypt_secret(row.mail_2fa_secret)
        if not mail_2fa_service.verify_code(secret, verification_code):
            return None

        # Generate new backup codes
        plain_codes, hashed_codes = mail_2fa_service.generate_backup_codes()

        await db.execute(
            """
            UPDATE workspace.tenant_users
            SET mail_2fa_backup_codes = :backup_codes
            WHERE id = :user_id
            """,
            {"user_id": user_id, "backup_codes": hashed_codes}
        )
        await db.commit()

        await Mail2FADatabaseOps._log_action(
            db, user_id, "backup_regenerated", True
        )

        return plain_codes

    @staticmethod
    async def _log_action(
        db,
        user_id: str,
        action: str,
        success: bool,
        failure_reason: str = None,
        ip_address: str = None,
        user_agent: str = None
    ):
        """Log 2FA action to audit table."""
        try:
            await db.execute(
                """
                INSERT INTO workspace.mail_2fa_logs
                (user_id, action, success, failure_reason, ip_address, user_agent)
                VALUES (:user_id, :action, :success, :failure_reason, :ip_address, :user_agent)
                """,
                {
                    "user_id": user_id,
                    "action": action,
                    "success": success,
                    "failure_reason": failure_reason,
                    "ip_address": ip_address,
                    "user_agent": user_agent
                }
            )
            await db.commit()
        except Exception as e:
            logger.warning(f"Failed to log 2FA action: {e}", action="2fa_log_error")
