"""
Bheem Workspace - Team Chat API
Mattermost integration for workspace team chat.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from core.database import get_db
from core.security import get_current_user, require_tenant_admin
from core.config import settings
from services.mattermost_service import mattermost_service
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/team-chat", tags=["Team Chat"])


# Schemas
class ChatConfigResponse(BaseModel):
    """Chat configuration for frontend."""
    enabled: bool
    url: Optional[str] = None
    websocket_url: Optional[str] = None


class ChatTokenResponse(BaseModel):
    """SSO token for chat login."""
    token: Optional[str] = None
    user_id: Optional[str] = None
    team_id: Optional[str] = None


class ChannelCreateRequest(BaseModel):
    """Request to create a chat channel."""
    name: str
    display_name: str
    is_private: bool = False
    purpose: Optional[str] = None


# Endpoints
@router.get("/config", response_model=ChatConfigResponse)
async def get_chat_config(
    current_user: dict = Depends(get_current_user)
):
    """
    Get Mattermost configuration for frontend.
    Returns connection details if chat is enabled.
    """
    enabled = getattr(settings, 'MATTERMOST_ENABLED', False)

    if not enabled:
        return ChatConfigResponse(enabled=False)

    return ChatConfigResponse(
        enabled=True,
        url=getattr(settings, 'MATTERMOST_URL', None),
        websocket_url=getattr(settings, 'MATTERMOST_WS_URL', None)
    )


@router.get("/health")
async def chat_health_check():
    """Check if Mattermost service is available."""
    healthy = await mattermost_service.health_check()
    return {
        "enabled": getattr(settings, 'MATTERMOST_ENABLED', False),
        "healthy": healthy,
        "service": "mattermost"
    }


@router.post("/login-token", response_model=ChatTokenResponse)
async def get_chat_login_token(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get Mattermost login token for SSO.
    Creates a personal access token for the user.
    """
    if not getattr(settings, 'MATTERMOST_ENABLED', False):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Team chat is not enabled"
        )

    user_email = current_user.get("email") or current_user.get("username")
    if not user_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User email not found"
        )

    # Get user's Mattermost ID from tenant_users
    user_id = current_user.get("id") or current_user.get("user_id")
    query = text("""
        SELECT mattermost_user_id, tu.tenant_id, t.mattermost_team_id
        FROM workspace.tenant_users tu
        JOIN workspace.tenants t ON tu.tenant_id = t.id
        WHERE tu.user_id = CAST(:user_id AS uuid)
        LIMIT 1
    """)
    result = await db.execute(query, {"user_id": user_id})
    row = result.fetchone()

    mm_user_id = None
    if row and row.mattermost_user_id:
        mm_user_id = row.mattermost_user_id
    else:
        # User not provisioned in Mattermost yet - try to get/create
        mm_user = await mattermost_service.get_user_by_email(user_email)
        if mm_user:
            mm_user_id = mm_user.get("id")

    if not mm_user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat user not found. Please contact your administrator."
        )

    # Create access token for SSO
    token = await mattermost_service.create_user_access_token(mm_user_id)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create chat login token"
        )

    return ChatTokenResponse(
        token=token,
        user_id=mm_user_id,
        team_id=row.mattermost_team_id if row else None
    )


@router.post("/provision/{tenant_id}")
async def provision_team_chat(
    tenant_id: str,
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
):
    """
    Provision Mattermost team for a workspace.
    Creates team, channels, and adds the admin user.
    """
    if not getattr(settings, 'MATTERMOST_ENABLED', False):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Team chat is not enabled"
        )

    # Get tenant details
    query = text("""
        SELECT t.id, t.slug, t.name, t.owner_email, t.mattermost_team_id,
               tu.name as owner_name
        FROM workspace.tenants t
        LEFT JOIN workspace.tenant_users tu ON t.id = tu.tenant_id AND tu.role = 'admin'
        WHERE t.id = CAST(:tenant_id AS uuid)
        LIMIT 1
    """)
    result = await db.execute(query, {"tenant_id": tenant_id})
    tenant = result.fetchone()

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )

    if tenant.mattermost_team_id:
        return {
            "status": "already_provisioned",
            "team_id": tenant.mattermost_team_id
        }

    # Provision chat (team, user, channels)
    provision_result = await mattermost_service.provision_workspace_chat(
        tenant_slug=tenant.slug,
        tenant_name=tenant.name,
        tenant_id=str(tenant.id),
        owner_email=tenant.owner_email,
        owner_name=tenant.owner_name or "Admin",
        owner_password="TempPassword123!"  # User should reset via Mattermost
    )

    if provision_result.get("status") == "success":
        # Save team ID to tenant
        update_query = text("""
            UPDATE workspace.tenants
            SET mattermost_team_id = :team_id
            WHERE id = CAST(:tenant_id AS uuid)
        """)
        await db.execute(update_query, {
            "team_id": provision_result.get("team_id"),
            "tenant_id": tenant_id
        })

        # Save user ID if created
        if provision_result.get("user_id"):
            user_update = text("""
                UPDATE workspace.tenant_users
                SET mattermost_user_id = :mm_user_id
                WHERE tenant_id = CAST(:tenant_id AS uuid)
                AND email = :email
            """)
            await db.execute(user_update, {
                "mm_user_id": provision_result.get("user_id"),
                "tenant_id": tenant_id,
                "email": tenant.owner_email
            })

        await db.commit()

    return {
        "status": provision_result.get("status"),
        "team_id": provision_result.get("team_id"),
        "channels_created": len(provision_result.get("channels", []))
    }


@router.post("/teams/{team_id}/channels")
async def create_channel(
    team_id: str,
    request: ChannelCreateRequest,
    current_user: dict = Depends(require_tenant_admin())
):
    """Create a new channel in the team."""
    if not getattr(settings, 'MATTERMOST_ENABLED', False):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Team chat is not enabled"
        )

    channel = await mattermost_service.create_channel(
        team_id=team_id,
        name=request.name,
        display_name=request.display_name,
        channel_type="P" if request.is_private else "O",
        purpose=request.purpose
    )

    if not channel:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create channel"
        )

    return {
        "success": True,
        "channel_id": channel.get("id"),
        "name": channel.get("name"),
        "display_name": channel.get("display_name")
    }
