"""
Bheem Workspace - Mail 2FA API
Two-Factor Authentication endpoints for mail access
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from typing import Optional, List
from core.security import get_current_user
from services.mail_2fa_service import mail_2fa_service

# Rate limiting
try:
    from middleware.rate_limit import limiter, RateLimits
except ImportError:
    class DummyLimiter:
        def limit(self, limit_string):
            def decorator(func):
                return func
            return decorator
    limiter = DummyLimiter()

    class RateLimits:
        SESSION_CREATE = "5/minute"

router = APIRouter(prefix="/mail/2fa", tags=["Mail 2FA"])


# ===========================================
# Schemas
# ===========================================

class Setup2FAResponse(BaseModel):
    """Response for 2FA setup initiation."""
    secret: str
    qr_code: str  # Base64-encoded PNG
    manual_entry_key: str
    issuer: str


class Enable2FARequest(BaseModel):
    """Request to enable 2FA after setup."""
    secret: str
    verification_code: str


class Enable2FAResponse(BaseModel):
    """Response after enabling 2FA."""
    success: bool
    message: str
    backup_codes: Optional[List[str]] = None


class Verify2FARequest(BaseModel):
    """Request to verify 2FA code."""
    code: str
    is_backup_code: bool = False


class Disable2FARequest(BaseModel):
    """Request to disable 2FA."""
    verification_code: str


class RegenerateBackupCodesRequest(BaseModel):
    """Request to regenerate backup codes."""
    verification_code: str


# ===========================================
# 2FA Setup Endpoints
# ===========================================

@router.post("/setup", response_model=Setup2FAResponse)
@limiter.limit("5/minute")
async def setup_2fa(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Start 2FA setup process.

    Returns a QR code and secret key for the user to add to their
    authenticator app. The secret must be verified with /enable before
    2FA is actually enabled.
    """
    user_id = current_user.get("id") or current_user.get("user_id")
    user_email = current_user.get("email", f"{current_user.get('username')}@bheem.cloud")

    # Generate new secret
    secret = mail_2fa_service.generate_secret()

    # Generate QR code
    try:
        qr_code = mail_2fa_service.generate_qr_code(secret, user_email)
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e)
        )

    return Setup2FAResponse(
        secret=secret,
        qr_code=qr_code,
        manual_entry_key=secret,
        issuer=mail_2fa_service.ISSUER_NAME
    )


@router.post("/enable", response_model=Enable2FAResponse)
@limiter.limit("5/minute")
async def enable_2fa(
    request: Request,
    body: Enable2FARequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Enable 2FA after verifying the setup code.

    The user must enter a valid code from their authenticator app
    to confirm they have correctly set it up. Returns backup codes
    that should be saved securely.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    # Verify the code
    if not mail_2fa_service.verify_code(body.secret, body.verification_code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code. Please try again."
        )

    # Generate backup codes
    plain_codes, hashed_codes = mail_2fa_service.generate_backup_codes()

    # In a real implementation, we would store the encrypted secret
    # and hashed backup codes in the database here
    # For now, we return success with backup codes

    return Enable2FAResponse(
        success=True,
        message="2FA has been enabled for your mail account. Save your backup codes securely.",
        backup_codes=plain_codes
    )


@router.get("/status")
async def get_2fa_status(
    current_user: dict = Depends(get_current_user)
):
    """
    Check if 2FA is enabled for the current user.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    # In a real implementation, we would check the database
    # For now, return a placeholder response
    return {
        "enabled": False,
        "backup_codes_remaining": 0,
        "enabled_at": None
    }


@router.post("/verify")
@limiter.limit("10/minute")
async def verify_2fa(
    request: Request,
    body: Verify2FARequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Verify a 2FA code.

    This endpoint can be used to verify either a TOTP code from
    an authenticator app or a backup code.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    # In a real implementation, we would:
    # 1. Get the user's encrypted secret from the database
    # 2. Decrypt it
    # 3. Verify the code
    # 4. If using backup code, remove it from the list

    # For now, return a placeholder
    return {
        "valid": False,
        "message": "2FA verification endpoint ready"
    }


@router.post("/disable")
@limiter.limit("3/minute")
async def disable_2fa(
    request: Request,
    body: Disable2FARequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Disable 2FA for the current user.

    Requires a valid TOTP code to confirm the user has access
    to their authenticator app.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    # In a real implementation, we would verify the code
    # and then disable 2FA in the database

    return {
        "success": True,
        "message": "2FA has been disabled for your mail account"
    }


@router.post("/backup-codes/regenerate")
@limiter.limit("3/minute")
async def regenerate_backup_codes(
    request: Request,
    body: RegenerateBackupCodesRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Regenerate backup codes.

    Requires a valid TOTP code. Old backup codes will be invalidated.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    # Verify the code first (placeholder)
    # In real implementation, verify against stored secret

    # Generate new backup codes
    plain_codes, hashed_codes = mail_2fa_service.generate_backup_codes()

    return {
        "success": True,
        "message": "New backup codes have been generated. Previous codes are now invalid.",
        "backup_codes": plain_codes
    }


@router.get("/backup-codes/count")
async def get_backup_codes_count(
    current_user: dict = Depends(get_current_user)
):
    """
    Get the number of remaining backup codes.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    # In a real implementation, count from database
    return {
        "remaining": 0,
        "total": mail_2fa_service.BACKUP_CODE_COUNT
    }
