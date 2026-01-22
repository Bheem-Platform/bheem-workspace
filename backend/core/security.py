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
            # Use email if available, otherwise fallback to username (which is often the email)
            email = payload.get("email") or payload.get("username")
            return {
                "id": user_id,
                "user_id": user_id,
                "username": payload.get("username"),
                "email": email,
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
            # Use email if available, otherwise fallback to username (which is often the email)
            email = passport_payload.get("email") or passport_payload.get("username")
            return {
                "id": user_id,
                "user_id": user_id,
                "username": passport_payload.get("username"),
                "email": email,
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
            # Use email if available, otherwise fallback to username (which is often the email)
            email = user_info.get("email") or user_info.get("username")
            return {
                "id": user_id,
                "user_id": user_id,
                "username": user_info.get("username"),
                "email": email,
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


# ═══════════════════════════════════════════════════════════════════
# INTERNAL ADMIN ACCESS CONTROL
# Bheemverse internal employees (BHM001-BHM008) can view all tenants
# ═══════════════════════════════════════════════════════════════════

# Bheemverse internal company codes
BHEEMVERSE_COMPANY_CODES = {
    "BHM001": "Bheemverse Innovation Company",
    "BHM002": "Bheem Technologies",
    "BHM003": "Bheem Digital Services",
    "BHM004": "Bheem Cloud Solutions",
    "BHM005": "Bheem AI Labs",
    "BHM006": "Bheem Security",
    "BHM007": "Bheem Analytics",
    "BHM008": "Bheem Consulting"
}


def is_internal_user(user: Dict[str, Any]) -> bool:
    """
    Check if user belongs to a Bheemverse company.

    All users with company_code BHM001-BHM008 can access Bheem platforms.
    This includes both employees AND customers who use Bheem SSO.

    Bheem Passport provides single sign-on across all Bheem products:
    - ERP, Workspace, BheemFlow, etc.
    - Access to specific features is controlled by licenses/subscriptions

    Args:
        user: User context from JWT

    Returns:
        True if user is part of Bheem ecosystem (employee or customer)
    """
    company_code = user.get("company_code") or user.get("company_id", "")
    if not company_code:
        return False
    return str(company_code).upper() in BHEEMVERSE_COMPANY_CODES


async def is_internal_admin(user: Dict[str, Any], db: AsyncSession) -> bool:
    """
    Check if user is an admin from a Bheemverse internal tenant.

    Internal admins can:
    - View ALL tenants (internal + external)
    - Manage internal tenants they belong to
    - View (read-only) external customer tenants

    Args:
        user: User context from JWT
        db: Database session

    Returns:
        True if user is an internal admin
    """
    # Must be from internal company
    if not is_internal_user(user):
        return False

    # Check JWT role first
    jwt_role = user.get("role", "")
    if jwt_role in ["SuperAdmin", "Admin"]:
        return True

    # Check tenant_users role
    user_id = user.get("id") or user.get("user_id")
    user_email = user.get("email")
    if not user_id:
        return False

    tenant_info = await get_user_tenant_role(user_id, db, email=user_email)
    if tenant_info:
        tenant_role = tenant_info.get("tenant_role", "").lower()
        tenant_mode = tenant_info.get("tenant_mode", "")
        # Must be admin in an internal tenant
        if tenant_role == "admin" and tenant_mode == "internal":
            return True

    return False


def require_internal_admin_or_superadmin():
    """
    Dependency to require internal admin or SuperAdmin role.

    This allows:
    - SuperAdmin: Full access to all tenants
    - Internal Admin: View all tenants, manage internal tenants

    Usage: current_user: dict = Depends(require_internal_admin_or_superadmin())
    """
    async def internal_admin_checker(
        current_user: Dict[str, Any] = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
    ) -> Dict[str, Any]:
        # SuperAdmin always passes
        if current_user.get("role") == "SuperAdmin":
            current_user["is_superadmin"] = True
            current_user["is_internal_admin"] = True
            return current_user

        # Check if internal admin
        if await is_internal_admin(current_user, db):
            current_user["is_superadmin"] = False
            current_user["is_internal_admin"] = True
            return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Internal admin or SuperAdmin access required"
        )

    return internal_admin_checker


async def get_user_tenant_role(user_id: str, db: AsyncSession, email: str = None) -> Optional[Dict[str, Any]]:
    """
    Get user's tenant role and tenant_id from tenant_users table.
    This is separate from JWT role - it's the workspace-specific role.

    Args:
        user_id: User ID from JWT
        db: Database session
        email: Optional email to match (fallback if user_id doesn't match)

    Returns:
        Dict with tenant_id and role, or None if not found
    """
    # First try to find by user_id
    query = text("""
        SELECT
            tu.id as tenant_user_id,
            tu.tenant_id,
            tu.user_id,
            tu.role,
            tu.email,
            t.name as tenant_name,
            t.tenant_mode
        FROM workspace.tenant_users tu
        JOIN workspace.tenants t ON tu.tenant_id = t.id
        WHERE tu.user_id = CAST(:user_id AS uuid)
        AND t.is_suspended = false
        AND tu.is_active = true
        LIMIT 1
    """)
    result = await db.execute(query, {"user_id": user_id})
    row = result.fetchone()

    # If not found by user_id and email is provided, try matching by email
    if not row and email:
        email_query = text("""
            SELECT
                tu.id as tenant_user_id,
                tu.tenant_id,
                tu.user_id,
                tu.role,
                tu.email,
                t.name as tenant_name,
                t.tenant_mode
            FROM workspace.tenant_users tu
            JOIN workspace.tenants t ON tu.tenant_id = t.id
            WHERE LOWER(tu.email) = LOWER(:email)
            AND t.is_suspended = false
            AND tu.is_active = true
            LIMIT 1
        """)
        result = await db.execute(email_query, {"email": email})
        row = result.fetchone()

        # If found by email, update the user_id to match the JWT
        if row and str(row.user_id) != user_id:
            update_query = text("""
                UPDATE workspace.tenant_users
                SET user_id = CAST(:new_user_id AS uuid), updated_at = NOW()
                WHERE id = CAST(:tenant_user_id AS uuid)
            """)
            await db.execute(update_query, {
                "new_user_id": user_id,
                "tenant_user_id": str(row.tenant_user_id)
            })
            await db.commit()

    if row:
        return {
            "tenant_user_id": str(row.tenant_user_id),
            "tenant_id": str(row.tenant_id),
            "tenant_role": row.role,
            "email": row.email,
            "tenant_name": row.tenant_name,
            "tenant_mode": row.tenant_mode
        }
    return None


def require_tenant_admin():
    """
    Dependency to require tenant admin role.
    Checks the tenant_users table for 'admin' role instead of JWT role.

    This is for external customers who have role='Customer' in JWT
    but role='admin' in their workspace tenant.

    Usage: current_user: dict = Depends(require_tenant_admin())
    """
    async def tenant_admin_checker(
        current_user: Dict[str, Any] = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
    ) -> Dict[str, Any]:
        # SuperAdmin/Admin in JWT can always access
        jwt_role = current_user.get("role")
        if jwt_role in ["SuperAdmin", "Admin"]:
            return current_user

        # For other users (e.g., Customer), check tenant_users table
        user_id = current_user.get("id") or current_user.get("user_id")
        user_email = current_user.get("email")

        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found in token"
            )

        # Get tenant role from database (with email fallback for user_id matching)
        tenant_info = await get_user_tenant_role(user_id, db, email=user_email)

        if not tenant_info:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not associated with any workspace"
            )

        tenant_role = tenant_info.get("tenant_role", "").lower()
        if tenant_role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Workspace admin role required for this action"
            )

        # Add tenant info to user context
        current_user["tenant_id"] = tenant_info.get("tenant_id")
        current_user["tenant_role"] = tenant_role
        current_user["tenant_name"] = tenant_info.get("tenant_name")
        current_user["tenant_mode"] = tenant_info.get("tenant_mode")

        return current_user

    return tenant_admin_checker


def require_tenant_member():
    """
    Dependency to require user is a member of a tenant.
    Any role in tenant_users table qualifies.

    Usage: current_user: dict = Depends(require_tenant_member())
    """
    async def tenant_member_checker(
        current_user: Dict[str, Any] = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
    ) -> Dict[str, Any]:
        user_id = current_user.get("id") or current_user.get("user_id")
        user_email = current_user.get("email")

        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found in token"
            )

        # Get tenant role from database (with email fallback for user_id matching)
        tenant_info = await get_user_tenant_role(user_id, db, email=user_email)

        if not tenant_info:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not associated with any workspace"
            )

        # Add tenant info to user context
        current_user["tenant_user_id"] = tenant_info.get("tenant_user_id")
        current_user["tenant_id"] = tenant_info.get("tenant_id")
        current_user["tenant_role"] = tenant_info.get("tenant_role")
        current_user["tenant_name"] = tenant_info.get("tenant_name")
        current_user["tenant_mode"] = tenant_info.get("tenant_mode")

        return current_user

    return tenant_member_checker
