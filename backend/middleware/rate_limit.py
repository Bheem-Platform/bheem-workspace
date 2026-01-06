"""
Bheem Workspace - Rate Limiting Middleware
Protects API endpoints from abuse using per-user rate limits
"""
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Callable, Optional
import redis
from core.config import settings
from core.logging import get_logger

logger = get_logger("bheem.middleware.rate_limit")


def get_user_identifier(request: Request) -> str:
    """
    Get unique identifier for rate limiting.
    Uses user_id from JWT if authenticated, otherwise IP address.
    """
    # Try to get user from request state (set by auth middleware)
    user = getattr(request.state, 'user', None)
    if user and isinstance(user, dict):
        user_id = user.get('id') or user.get('user_id')
        if user_id:
            return f"user:{user_id}"

    # Try to get from Authorization header (decode JWT)
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        token = auth_header[7:]
        try:
            import jwt
            # Just decode without verification to get user_id for rate limiting
            payload = jwt.decode(token, options={"verify_signature": False})
            user_id = payload.get('sub') or payload.get('user_id')
            if user_id:
                return f"user:{user_id}"
        except:
            pass

    # Fallback to IP address
    return f"ip:{get_remote_address(request)}"


# Initialize rate limiter with Redis backend
try:
    limiter = Limiter(
        key_func=get_user_identifier,
        storage_uri=settings.REDIS_URL,
        storage_options={"socket_connect_timeout": 5},
        strategy="fixed-window",  # or "moving-window" for smoother limiting
    )
    logger.info("Rate limiter initialized with Redis backend", action="rate_limit_init")
except Exception as e:
    # Fallback to in-memory if Redis unavailable
    logger.warning(f"Redis unavailable for rate limiting, using in-memory: {e}", action="rate_limit_init")
    limiter = Limiter(
        key_func=get_user_identifier,
        storage_uri="memory://",
    )


# ===========================================
# Rate Limit Configurations
# ===========================================

class RateLimits:
    """Rate limit configurations for different endpoint types."""

    # Authentication endpoints (stricter)
    LOGIN = "5/minute"
    SESSION_CREATE = "5/minute"

    # Read operations (more permissive)
    MAIL_READ = "100/minute"
    MAIL_LIST = "60/minute"
    FOLDERS = "30/minute"

    # Write operations (moderate)
    MAIL_SEND = "10/minute"
    MAIL_MOVE = "30/minute"
    MAIL_DELETE = "30/minute"

    # Search (moderate - can be expensive)
    MAIL_SEARCH = "30/minute"

    # AI features (limited - expensive)
    MAIL_AI = "20/minute"
    MAIL_AI_COMPOSE = "10/minute"

    # Admin operations (stricter)
    ADMIN = "30/minute"

    # General API
    DEFAULT = "60/minute"


# ===========================================
# Rate Limit Error Handler
# ===========================================

async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> Response:
    """Handle rate limit exceeded errors."""
    from fastapi.responses import JSONResponse

    # Log the rate limit hit
    identifier = get_user_identifier(request)
    logger.warning(
        f"Rate limit exceeded for {identifier} on {request.url.path}",
        action="rate_limit_exceeded",
        path=request.url.path,
        identifier=identifier,
        limit=str(exc.detail)
    )

    # Get retry-after from exception if available
    retry_after = getattr(exc, 'retry_after', 60)

    return JSONResponse(
        status_code=429,
        content={
            "error": "rate_limit_exceeded",
            "message": f"Too many requests. Please try again in {retry_after} seconds.",
            "retry_after": retry_after,
            "detail": str(exc.detail)
        },
        headers={
            "Retry-After": str(retry_after),
            "X-RateLimit-Limit": str(exc.detail),
        }
    )


# ===========================================
# Decorators for easy use in routes
# ===========================================

def rate_limit(limit: str):
    """
    Decorator to apply rate limit to a route.

    Usage:
        @router.get("/messages")
        @rate_limit(RateLimits.MAIL_LIST)
        async def get_messages(...):
            pass
    """
    return limiter.limit(limit)


# ===========================================
# Rate Limit Headers Middleware
# ===========================================

class RateLimitHeadersMiddleware(BaseHTTPMiddleware):
    """Add rate limit headers to responses."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        # Add rate limit info headers if available
        # These are typically set by slowapi
        rate_limit_info = getattr(request.state, '_rate_limit', None)
        if rate_limit_info:
            response.headers["X-RateLimit-Limit"] = str(rate_limit_info.get('limit', ''))
            response.headers["X-RateLimit-Remaining"] = str(rate_limit_info.get('remaining', ''))
            response.headers["X-RateLimit-Reset"] = str(rate_limit_info.get('reset', ''))

        return response


# ===========================================
# Utility Functions
# ===========================================

def get_rate_limit_status(request: Request) -> dict:
    """Get current rate limit status for the request."""
    identifier = get_user_identifier(request)

    try:
        # Check Redis for current limits
        redis_client = redis.from_url(settings.REDIS_URL)
        # Get all keys for this identifier
        pattern = f"LIMITER/{identifier}/*"
        keys = redis_client.keys(pattern)

        status = {}
        for key in keys:
            ttl = redis_client.ttl(key)
            value = redis_client.get(key)
            status[key.decode()] = {
                "count": int(value) if value else 0,
                "expires_in": ttl
            }

        return {
            "identifier": identifier,
            "limits": status
        }
    except Exception as e:
        return {
            "identifier": identifier,
            "error": str(e)
        }
