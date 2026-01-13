"""
Bheem Workspace - Authentication API
Uses Bheem Passport for centralized authentication with fallback to local auth
"""
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import timedelta

from core.database import get_db
from core.security import (
    verify_password, get_password_hash, create_access_token,
    get_current_user, decode_token
)
from core.config import settings
from services.passport_client import get_passport_client, BheemPassportClient
from services.mailcow_service import mailcow_service
from services.nextcloud_service import nextcloud_service
from integrations.notify import notify_client
import asyncio
import secrets

router = APIRouter(prefix="/auth", tags=["Authentication"])


# Schemas
class LoginRequest(BaseModel):
    username: str  # Can be username or email
    password: str
    company_code: Optional[str] = "BHM001"


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: int
    user: dict
    mail_session_active: bool = False  # True if auto mail session was created


class UserResponse(BaseModel):
    id: str
    username: str
    email: Optional[str]
    role: str
    company_id: Optional[str]
    company_code: Optional[str]
    person_id: Optional[str]


class RegisterRequest(BaseModel):
    username: str
    email: Optional[EmailStr] = None
    password: str
    role: str = "Customer"
    company_code: str = "BHM001"
    full_name: Optional[str] = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class PasswordChangeRequest(BaseModel):
    old_password: str
    new_password: str


class PasswordResetRequest(BaseModel):
    email: EmailStr
    company_code: Optional[str] = "BHM001"


# Helper to get passport client
def get_passport() -> BheemPassportClient:
    return get_passport_client()


# Endpoints
@router.post("/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Login with credentials via Bheem Passport (centralized auth)
    Falls back to local auth if Passport is unavailable
    """
    passport = get_passport()

    if settings.USE_PASSPORT_AUTH:
        try:
            # Try Bheem Passport authentication
            result = await passport.login(
                username=request.username,
                password=request.password,
                company_code=request.company_code
            )

            # Sync password to Mailcow & Nextcloud (SSO - single password for all services)
            mail_session_active = False
            email = result.get("user", {}).get("email") or request.username
            user_id = result.get("user", {}).get("id")

            try:
                if "@" in email:
                    asyncio.create_task(
                        mailcow_service.sync_password_to_mailcow(email, request.password)
                    )
                    asyncio.create_task(
                        nextcloud_service.sync_password(email, request.password)
                    )
            except Exception as e:
                print(f"Password sync skipped: {e}")

            # Auto-create mail session for SSO (1.3.2)
            if user_id and "@" in email:
                try:
                    from services.mail_session_service import mail_session_service
                    mail_session_service.create_session(
                        user_id=user_id,
                        email=email,
                        password=request.password
                    )
                    mail_session_active = True
                    print(f"[Auth] Auto mail session created for {email}")
                except Exception as e:
                    print(f"[Auth] Auto mail session failed: {e}")

            return LoginResponse(
                access_token=result["access_token"],
                refresh_token=result.get("refresh_token"),
                token_type="bearer",
                expires_in=result.get("expires_in", settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60),
                user=result.get("user", {}),
                mail_session_active=mail_session_active
            )

        except HTTPException as e:
            # Re-raise HTTP exceptions (401, 403, etc.)
            raise e
        except Exception as e:
            print(f"[Workspace Auth] Passport login failed, trying local auth: {e}")
            # Fall through to local auth

    # Fallback to local database authentication
    return await _local_login(request, db)


async def _local_login(request: LoginRequest, db: AsyncSession) -> LoginResponse:
    """
    Local database authentication (fallback when Passport is unavailable)
    """
    # Query by username (handles both username and email-style usernames)
    query = text("""
        SELECT u.id, u.username, u.hashed_password, u.role,
               u.company_id, u.person_id, u.is_active,
               c.company_code
        FROM auth.users u
        LEFT JOIN public.companies c ON u.company_id = c.id
        WHERE u.username = :identifier
        AND (u.is_deleted = false OR u.is_deleted IS NULL)
    """)

    result = await db.execute(query, {"identifier": request.username})
    user = result.fetchone()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled"
        )

    if not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    # Create access token
    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "user_id": str(user.id),
            "username": user.username,
            "role": user.role,
            "company_id": str(user.company_id) if user.company_id else None,
            "company_code": user.company_code
        }
    )

    # Sync password to Mailcow & Nextcloud
    mail_session_active = False
    try:
        if "@" in request.username:
            asyncio.create_task(
                mailcow_service.sync_password_to_mailcow(request.username, request.password)
            )
            asyncio.create_task(
                nextcloud_service.sync_password(request.username, request.password)
            )
    except Exception as e:
        print(f"Password sync skipped: {e}")

    # Auto-create mail session for SSO (1.3.2)
    if "@" in request.username:
        try:
            from services.mail_session_service import mail_session_service
            mail_session_service.create_session(
                user_id=str(user.id),
                email=request.username,
                password=request.password
            )
            mail_session_active = True
            print(f"[Auth] Auto mail session created for {request.username}")
        except Exception as e:
            print(f"[Auth] Auto mail session failed: {e}")

    return LoginResponse(
        access_token=access_token,
        refresh_token=None,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user={
            "id": str(user.id),
            "username": user.username,
            "role": user.role,
            "company_id": str(user.company_id) if user.company_id else None,
            "company_code": user.company_code,
            "person_id": str(user.person_id) if user.person_id else None
        },
        mail_session_active=mail_session_active
    )


@router.post("/register", response_model=UserResponse)
async def register(
    request: RegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Register a new user via Bheem Passport
    """
    passport = get_passport()

    if settings.USE_PASSPORT_AUTH:
        try:
            result = await passport.register(
                username=request.username,
                password=request.password,
                role=request.role,
                company_code=request.company_code
            )

            return UserResponse(
                id=result["id"],
                username=result["username"],
                email=request.email or request.username,
                role=result["role"],
                company_id=result.get("company_id"),
                company_code=result.get("company_code"),
                person_id=None
            )

        except HTTPException as e:
            raise e
        except Exception as e:
            print(f"[Workspace Auth] Passport registration failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Registration service unavailable"
            )

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Registration requires Bheem Passport service"
    )


@router.post("/refresh", response_model=LoginResponse)
async def refresh_token(
    request: RefreshTokenRequest
):
    """
    Refresh access token using refresh token via Bheem Passport
    """
    passport = get_passport()

    if settings.USE_PASSPORT_AUTH:
        try:
            result = await passport.refresh_token(request.refresh_token)

            return LoginResponse(
                access_token=result["access_token"],
                refresh_token=result.get("refresh_token"),
                token_type="bearer",
                expires_in=result.get("expires_in", settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60),
                user=result.get("user", {})
            )

        except HTTPException as e:
            raise e
        except Exception as e:
            print(f"[Workspace Auth] Token refresh failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token refresh failed"
            )

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Token refresh requires Bheem Passport service"
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current authenticated user info"""
    return UserResponse(
        id=current_user.get("id") or current_user.get("user_id") or current_user.get("sub"),
        username=current_user.get("username"),
        email=current_user.get("email"),
        role=current_user.get("role"),
        company_id=current_user.get("company_id"),
        company_code=current_user.get("company_code"),
        person_id=current_user.get("person_id")
    )


@router.post("/change-password")
async def change_password(
    request: PasswordChangeRequest,
    authorization: str = Header(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Change user password via Bheem Passport
    """
    passport = get_passport()

    # Extract token from Bearer header
    token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization

    if settings.USE_PASSPORT_AUTH:
        try:
            result = await passport.change_password(
                token=token,
                old_password=request.old_password,
                new_password=request.new_password
            )
            return result

        except HTTPException as e:
            raise e
        except Exception as e:
            print(f"[Workspace Auth] Password change failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Password change failed"
            )

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Password change requires Bheem Passport service"
    )


@router.post("/password/reset/request")
async def request_password_reset(request: PasswordResetRequest):
    """
    Request password reset - sends email via Bheem Notify
    """
    passport = get_passport()
    reset_url = None
    user_name = request.email.split("@")[0]  # Default name from email

    if settings.USE_PASSPORT_AUTH:
        try:
            result = await passport.request_password_reset(
                email=request.email,
                company_code=request.company_code
            )
            # Extract reset URL if Passport returns it
            reset_url = result.get("reset_url") or result.get("reset_link")
            user_name = result.get("user_name") or user_name

        except Exception as e:
            print(f"[Workspace Auth] Passport password reset failed: {e}")
            # Continue to send email anyway

    # Generate reset URL if Passport didn't provide one
    if not reset_url:
        # Generate a simple token-based URL (in production, use secure token generation)
        reset_token = secrets.token_urlsafe(32)
        frontend_url = settings.WORKSPACE_FRONTEND_URL or "https://workspace.bheem.cloud"
        reset_url = f"{frontend_url}/reset-password?token={reset_token}&email={request.email}"

    # Send password reset email via Bheem Notify
    try:
        await notify_client.send_password_reset_email(
            to=request.email,
            name=user_name,
            reset_url=reset_url,
            expires_in="24 hours"
        )
        print(f"Password reset email sent to: {request.email}")
    except Exception as e:
        print(f"Failed to send password reset email: {e}")
        # Don't expose email sending errors to prevent enumeration

    # Always return success to prevent email enumeration
    return {
        "message": "If the email exists in our system, you will receive a password reset link shortly.",
        "success": True
    }


@router.get("/companies")
async def list_companies():
    """
    Get list of available companies from Bheem Passport
    """
    passport = get_passport()

    if settings.USE_PASSPORT_AUTH:
        try:
            result = await passport.get_companies()
            return result

        except Exception as e:
            print(f"[Workspace Auth] Get companies failed: {e}")
            return {"companies": []}

    return {"companies": []}


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """Logout (client should discard tokens)"""
    # In a stateless JWT system, logout is handled client-side
    return {"message": "Successfully logged out"}


@router.get("/verify")
async def verify_token_endpoint(current_user: dict = Depends(get_current_user)):
    """Verify if token is valid"""
    return {
        "valid": True,
        "user_id": current_user.get("id") or current_user.get("user_id") or current_user.get("sub"),
        "username": current_user.get("username")
    }


@router.get("/health")
async def auth_health():
    """Check authentication service health"""
    passport = get_passport()

    passport_healthy = await passport.health_check()

    return {
        "workspace_auth": "healthy",
        "passport_service": "healthy" if passport_healthy else "unavailable",
        "use_passport_auth": settings.USE_PASSPORT_AUTH
    }
