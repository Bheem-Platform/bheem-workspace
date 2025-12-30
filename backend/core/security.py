"""
Bheem Workspace - Security & JWT Authentication
Supports Bheem Passport token validation with local fallback
"""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from .config import settings
from .database import get_db
import httpx

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Bearer token scheme
security = HTTPBearer()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token (for local auth fallback)"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Decode JWT token - tries multiple secrets for SSO support
    Order: 1) Bheem JWT Secret (Passport SSO), 2) Local workspace secret
    """
    # First try with Bheem Passport JWT secret (SSO - shared across all Bheem services)
    if settings.BHEEM_JWT_SECRET:
        try:
            payload = jwt.decode(token, settings.BHEEM_JWT_SECRET, algorithms=[settings.ALGORITHM])
            return payload
        except JWTError:
            pass

    # Fallback to workspace local secret
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        pass

    # If local decode fails and Passport is enabled, the token might need API validation
    # We'll validate it in get_current_user via Passport API
    return None


async def validate_token_via_passport(token: str) -> Optional[Dict[str, Any]]:
    """
    Validate token via Bheem Passport service
    """
    if not settings.USE_PASSPORT_AUTH:
        return None

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{settings.BHEEM_PASSPORT_URL}/api/v1/auth/validate",
                json={"token": token}
            )

            if response.status_code == 200:
                result = response.json()
                if result.get("valid"):
                    return result.get("payload")

            return None

    except Exception as e:
        print(f"[Security] Passport validation error: {e}")
        return None


async def get_user_from_passport(token: str) -> Optional[Dict[str, Any]]:
    """
    Get user info from Bheem Passport /me endpoint
    """
    if not settings.USE_PASSPORT_AUTH:
        return None

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{settings.BHEEM_PASSPORT_URL}/api/v1/auth/me",
                headers={"Authorization": f"Bearer {token}"}
            )

            if response.status_code == 200:
                return response.json()

            return None

    except Exception as e:
        print(f"[Security] Passport get user error: {e}")
        return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get current authenticated user from token
    Validates via Bheem Passport first, then falls back to local validation
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = credentials.credentials

    # Step 1: Try local decode first (faster)
    payload = decode_token(token)

    if payload is not None:
        user_id = payload.get("sub") or payload.get("user_id")
        if user_id:
            # Token decoded successfully with local secret
            return {
                "id": user_id,
                "user_id": user_id,
                "username": payload.get("username"),
                "email": payload.get("email"),
                "role": payload.get("role"),
                "company_id": payload.get("company_id"),
                "company_code": payload.get("company_code"),
                "person_id": payload.get("person_id")
            }

    # Step 2: Try Bheem Passport validation (for tokens issued by Passport)
    if settings.USE_PASSPORT_AUTH:
        passport_payload = await validate_token_via_passport(token)

        if passport_payload is not None:
            user_id = passport_payload.get("user_id") or passport_payload.get("sub")
            return {
                "id": user_id,
                "user_id": user_id,
                "username": passport_payload.get("username"),
                "email": passport_payload.get("email"),
                "role": passport_payload.get("role"),
                "company_id": passport_payload.get("company_id"),
                "company_code": passport_payload.get("company_code"),
                "companies": passport_payload.get("companies", []),
                "person_id": passport_payload.get("person_id")
            }

        # Step 3: Try /me endpoint as fallback
        user_info = await get_user_from_passport(token)

        if user_info is not None:
            user_id = user_info.get("user_id") or user_info.get("sub")
            return {
                "id": user_id,
                "user_id": user_id,
                "username": user_info.get("username"),
                "email": user_info.get("email"),
                "role": user_info.get("role"),
                "company_id": user_info.get("company_id"),
                "company_code": user_info.get("company_code"),
                "companies": user_info.get("companies", []),
                "person_id": user_info.get("person_id")
            }

    # All validation methods failed
    raise credentials_exception


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db: AsyncSession = Depends(get_db)
) -> Optional[Dict[str, Any]]:
    """Get current user if authenticated, else None"""
    if credentials is None:
        return None

    try:
        return await get_current_user(credentials, db)
    except HTTPException:
        return None


def require_role(allowed_roles: list):
    """
    Dependency to require specific roles
    Usage: current_user: dict = Depends(require_role(["Admin", "SuperAdmin"]))
    """
    async def role_checker(
        current_user: Dict[str, Any] = Depends(get_current_user)
    ) -> Dict[str, Any]:
        user_role = current_user.get("role")
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {allowed_roles}"
            )
        return current_user

    return role_checker


def require_admin():
    """Dependency to require Admin or SuperAdmin role"""
    return require_role(["Admin", "SuperAdmin"])


def require_superadmin():
    """Dependency to require SuperAdmin role"""
    return require_role(["SuperAdmin"])


def require_tenant_access(tenant_id_param: str = "tenant_id"):
    """
    Dependency to check user has access to the specified tenant.
    SuperAdmin can access all tenants.
    Other users can only access their own company's tenant.

    Usage: current_user: dict = Depends(require_tenant_access("tenant_id"))
    """
    async def tenant_checker(
        request,
        current_user: Dict[str, Any] = Depends(get_current_user)
    ) -> Dict[str, Any]:
        # SuperAdmin can access everything
        if current_user.get("role") == "SuperAdmin":
            return current_user

        # Get tenant_id from path parameters
        tenant_id = request.path_params.get(tenant_id_param)
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tenant ID required"
            )

        # Check if user's company matches the tenant
        user_company = current_user.get("company_code") or current_user.get("company_id")

        if not user_company:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User not associated with any company"
            )

        # Allow access if tenant_id matches user's company (case-insensitive)
        if str(tenant_id).lower() == str(user_company).lower():
            return current_user

        # Check if user has Admin role for their company
        if current_user.get("role") in ["Admin", "Manager"]:
            return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this tenant"
        )

    return tenant_checker


class Permission:
    """Permission constants for RBAC"""
    # Tenant permissions
    TENANT_READ = "tenant:read"
    TENANT_WRITE = "tenant:write"
    TENANT_DELETE = "tenant:delete"

    # User permissions
    USER_READ = "user:read"
    USER_INVITE = "user:invite"
    USER_MANAGE = "user:manage"

    # Domain permissions
    DOMAIN_READ = "domain:read"
    DOMAIN_ADD = "domain:add"
    DOMAIN_VERIFY = "domain:verify"
    DOMAIN_DELETE = "domain:delete"

    # Mail permissions
    MAIL_READ = "mail:read"
    MAIL_MANAGE = "mail:manage"

    # Meet permissions
    MEET_READ = "meet:read"
    MEET_MANAGE = "meet:manage"

    # Docs permissions
    DOCS_READ = "docs:read"
    DOCS_MANAGE = "docs:manage"

    # Developer permissions (SuperAdmin only)
    DEVELOPER_READ = "developer:read"
    DEVELOPER_MANAGE = "developer:manage"


# Role-based permissions mapping
ROLE_PERMISSIONS = {
    "SuperAdmin": ["*"],  # All permissions
    "Admin": [
        Permission.TENANT_READ,
        Permission.TENANT_WRITE,
        Permission.USER_READ,
        Permission.USER_INVITE,
        Permission.USER_MANAGE,
        Permission.DOMAIN_READ,
        Permission.DOMAIN_ADD,
        Permission.DOMAIN_VERIFY,
        Permission.DOMAIN_DELETE,
        Permission.MAIL_READ,
        Permission.MAIL_MANAGE,
        Permission.MEET_READ,
        Permission.MEET_MANAGE,
        Permission.DOCS_READ,
        Permission.DOCS_MANAGE,
    ],
    "Manager": [
        Permission.TENANT_READ,
        Permission.USER_READ,
        Permission.USER_INVITE,
        Permission.DOMAIN_READ,
        Permission.MAIL_READ,
        Permission.MEET_READ,
        Permission.DOCS_READ,
    ],
    "Member": [
        Permission.TENANT_READ,
        Permission.MAIL_READ,
        Permission.MEET_READ,
        Permission.DOCS_READ,
    ],
}


def has_permission(user: Dict[str, Any], permission: str) -> bool:
    """Check if user has a specific permission"""
    role = user.get("role", "Member")
    role_perms = ROLE_PERMISSIONS.get(role, ROLE_PERMISSIONS["Member"])

    # SuperAdmin has all permissions
    if "*" in role_perms:
        return True

    return permission in role_perms


def require_permission(permission: str):
    """
    Dependency to require a specific permission.
    Usage: current_user: dict = Depends(require_permission(Permission.USER_MANAGE))
    """
    async def permission_checker(
        current_user: Dict[str, Any] = Depends(get_current_user)
    ) -> Dict[str, Any]:
        if not has_permission(current_user, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {permission} required"
            )
        return current_user

    return permission_checker
