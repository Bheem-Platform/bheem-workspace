"""
Bheem Workspace - Settings API
Endpoints for managing user and workspace settings
"""
from fastapi import APIRouter, HTTPException, Depends, status, File, UploadFile
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
import logging

from core.database import get_db
from core.security import get_current_user, require_tenant_member
from models.settings_models import UserSettings
from models.admin_models import Tenant
from services.chat_file_service import ChatFileService

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Settings"])


# ============== Pydantic Models ==============

class AppearanceSettings(BaseModel):
    theme: Optional[str] = 'light'
    accentColor: Optional[str] = '#977DFF'
    logo: Optional[str] = None
    showAppNames: Optional[bool] = True
    compactMode: Optional[bool] = False
    sidebarPosition: Optional[str] = 'left'


class NotificationSettings(BaseModel):
    emailNotifications: Optional[bool] = True
    pushNotifications: Optional[bool] = True
    desktopNotifications: Optional[bool] = True
    soundEnabled: Optional[bool] = True
    emailDigest: Optional[str] = 'daily'
    notifyOnMention: Optional[bool] = True
    notifyOnComment: Optional[bool] = True
    notifyOnShare: Optional[bool] = True


class SecuritySettings(BaseModel):
    twoFactorEnabled: Optional[bool] = False
    sessionTimeout: Optional[int] = 30


class LanguageSettings(BaseModel):
    language: Optional[str] = 'en'
    timezone: Optional[str] = 'UTC'
    dateFormat: Optional[str] = 'MM/DD/YYYY'
    timeFormat: Optional[str] = '12h'
    weekStart: Optional[str] = 'sunday'


class GeneralSettings(BaseModel):
    workspaceName: Optional[str] = None
    description: Optional[str] = None
    industry: Optional[str] = None
    size: Optional[str] = None


class AppsSettings(BaseModel):
    mail: Optional[bool] = True
    docs: Optional[bool] = True
    sheets: Optional[bool] = True
    slides: Optional[bool] = True
    calendar: Optional[bool] = True
    meet: Optional[bool] = True
    drive: Optional[bool] = True
    chat: Optional[bool] = True
    forms: Optional[bool] = True


class ChatSettings(BaseModel):
    readReceiptsEnabled: Optional[bool] = True  # Show when user reads messages
    showLastSeen: Optional[bool] = True  # Show last seen status to others


class FullSettingsUpdate(BaseModel):
    general: Optional[GeneralSettings] = None
    appearance: Optional[AppearanceSettings] = None
    apps: Optional[Dict[str, bool]] = None
    notifications: Optional[NotificationSettings] = None
    security: Optional[SecuritySettings] = None
    language: Optional[LanguageSettings] = None
    chat: Optional[ChatSettings] = None


class SettingsResponse(BaseModel):
    general: Dict[str, Any]
    appearance: Dict[str, Any]
    apps: Dict[str, bool]
    notifications: Dict[str, Any]
    security: Dict[str, Any]
    language: Dict[str, Any]
    chat: Dict[str, Any]


# ============== Helper Functions ==============

async def get_or_create_user_settings(
    db: AsyncSession,
    user_id: str,
    tenant_id: Optional[str] = None
) -> UserSettings:
    """Get existing user settings or create default ones"""
    import uuid

    # Try to find existing settings
    query = select(UserSettings).where(UserSettings.user_id == uuid.UUID(user_id))
    if tenant_id:
        query = query.where(UserSettings.tenant_id == uuid.UUID(tenant_id))

    result = await db.execute(query)
    settings = result.scalar_one_or_none()

    if not settings:
        # Create new settings with defaults
        settings = UserSettings(
            user_id=uuid.UUID(user_id),
            tenant_id=uuid.UUID(tenant_id) if tenant_id else None
        )
        db.add(settings)
        await db.commit()
        await db.refresh(settings)

    return settings


# ============== API Endpoints ==============

@router.get("")
async def get_settings(
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get current user's settings"""
    user_id = str(current_user.get("user_id") or current_user.get("id"))
    tenant_id = current_user.get("tenant_id")

    # Get user settings
    settings = await get_or_create_user_settings(db, user_id, str(tenant_id) if tenant_id else None)

    # Get tenant info for general settings
    tenant_data = {
        "workspaceName": "My Workspace",
        "description": "",
        "industry": "technology",
        "size": "1-10"
    }

    if tenant_id:
        import uuid
        result = await db.execute(
            select(Tenant).where(Tenant.id == uuid.UUID(str(tenant_id)))
        )
        tenant = result.scalar_one_or_none()
        if tenant:
            workspace_settings = tenant.settings or {}
            tenant_data = {
                "workspaceName": tenant.name,
                "description": workspace_settings.get("description", ""),
                "industry": workspace_settings.get("industry", "technology"),
                "size": workspace_settings.get("size", "1-10")
            }

    response = settings.to_dict()
    response["general"] = tenant_data

    return response


@router.put("")
async def update_settings(
    settings_update: FullSettingsUpdate,
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Update user settings"""
    user_id = str(current_user.get("user_id") or current_user.get("id"))
    tenant_id = current_user.get("tenant_id")
    tenant_role = current_user.get("tenant_role")

    import uuid

    # Get or create user settings
    settings = await get_or_create_user_settings(db, user_id, str(tenant_id) if tenant_id else None)

    # Update appearance settings
    if settings_update.appearance:
        app = settings_update.appearance
        if app.theme is not None:
            settings.theme = app.theme
        if app.accentColor is not None:
            settings.accent_color = app.accentColor
        if app.showAppNames is not None:
            settings.show_app_names = app.showAppNames
        if app.compactMode is not None:
            settings.compact_mode = app.compactMode
        if app.sidebarPosition is not None:
            settings.sidebar_position = app.sidebarPosition

    # Update apps settings
    if settings_update.apps:
        settings.enabled_apps = settings_update.apps

    # Update notification settings
    if settings_update.notifications:
        notif = settings_update.notifications
        if notif.emailNotifications is not None:
            settings.email_notifications = notif.emailNotifications
        if notif.pushNotifications is not None:
            settings.push_notifications = notif.pushNotifications
        if notif.desktopNotifications is not None:
            settings.desktop_notifications = notif.desktopNotifications
        if notif.soundEnabled is not None:
            settings.sound_enabled = notif.soundEnabled
        if notif.emailDigest is not None:
            settings.email_digest = notif.emailDigest
        if notif.notifyOnMention is not None:
            settings.notify_on_mention = notif.notifyOnMention
        if notif.notifyOnComment is not None:
            settings.notify_on_comment = notif.notifyOnComment
        if notif.notifyOnShare is not None:
            settings.notify_on_share = notif.notifyOnShare

    # Update security settings
    if settings_update.security:
        sec = settings_update.security
        if sec.twoFactorEnabled is not None:
            settings.two_factor_enabled = sec.twoFactorEnabled
        if sec.sessionTimeout is not None:
            settings.session_timeout = sec.sessionTimeout

    # Update language settings
    if settings_update.language:
        lang = settings_update.language
        if lang.language is not None:
            settings.language = lang.language
        if lang.timezone is not None:
            settings.timezone = lang.timezone
        if lang.dateFormat is not None:
            settings.date_format = lang.dateFormat
        if lang.timeFormat is not None:
            settings.time_format = lang.timeFormat
        if lang.weekStart is not None:
            settings.week_start = lang.weekStart

    # Update chat privacy settings
    if settings_update.chat:
        chat = settings_update.chat
        if chat.readReceiptsEnabled is not None:
            settings.read_receipts_enabled = chat.readReceiptsEnabled
        if chat.showLastSeen is not None:
            settings.show_last_seen = chat.showLastSeen

    # Update general settings (workspace settings - admin only)
    if settings_update.general and tenant_id:
        if tenant_role in ["admin", "owner"]:
            result = await db.execute(
                select(Tenant).where(Tenant.id == uuid.UUID(str(tenant_id)))
            )
            tenant = result.scalar_one_or_none()
            if tenant:
                gen = settings_update.general
                workspace_settings = tenant.settings or {}

                if gen.workspaceName:
                    tenant.name = gen.workspaceName
                if gen.description is not None:
                    workspace_settings["description"] = gen.description
                if gen.industry is not None:
                    workspace_settings["industry"] = gen.industry
                if gen.size is not None:
                    workspace_settings["size"] = gen.size

                tenant.settings = workspace_settings

    settings.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(settings)

    logger.info(f"Settings updated for user {user_id}")

    # Return updated settings
    return await get_settings(current_user, db)


@router.get("/appearance")
async def get_appearance_settings(
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get appearance settings only"""
    user_id = str(current_user.get("user_id") or current_user.get("id"))
    tenant_id = current_user.get("tenant_id")

    settings = await get_or_create_user_settings(db, user_id, str(tenant_id) if tenant_id else None)

    return {
        "theme": settings.theme,
        "accentColor": settings.accent_color,
        "showAppNames": settings.show_app_names,
        "compactMode": settings.compact_mode,
        "sidebarPosition": settings.sidebar_position
    }


@router.put("/appearance")
async def update_appearance_settings(
    appearance: AppearanceSettings,
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Update appearance settings only"""
    return await update_settings(
        FullSettingsUpdate(appearance=appearance),
        current_user,
        db
    )


@router.get("/notifications")
async def get_notification_settings(
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get notification settings only"""
    user_id = str(current_user.get("user_id") or current_user.get("id"))
    tenant_id = current_user.get("tenant_id")

    settings = await get_or_create_user_settings(db, user_id, str(tenant_id) if tenant_id else None)

    return {
        "emailNotifications": settings.email_notifications,
        "pushNotifications": settings.push_notifications,
        "desktopNotifications": settings.desktop_notifications,
        "soundEnabled": settings.sound_enabled,
        "emailDigest": settings.email_digest,
        "notifyOnMention": settings.notify_on_mention,
        "notifyOnComment": settings.notify_on_comment,
        "notifyOnShare": settings.notify_on_share
    }


@router.put("/notifications")
async def update_notification_settings(
    notifications: NotificationSettings,
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Update notification settings only"""
    return await update_settings(
        FullSettingsUpdate(notifications=notifications),
        current_user,
        db
    )


@router.get("/apps")
async def get_apps_settings(
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, bool]:
    """Get enabled apps settings"""
    user_id = str(current_user.get("user_id") or current_user.get("id"))
    tenant_id = current_user.get("tenant_id")

    settings = await get_or_create_user_settings(db, user_id, str(tenant_id) if tenant_id else None)

    return settings.enabled_apps or {}


@router.put("/apps")
async def update_apps_settings(
    apps: Dict[str, bool],
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Update enabled apps settings"""
    return await update_settings(
        FullSettingsUpdate(apps=apps),
        current_user,
        db
    )


@router.get("/chat")
async def get_chat_settings(
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get chat privacy settings"""
    user_id = str(current_user.get("user_id") or current_user.get("id"))
    tenant_id = current_user.get("tenant_id")

    settings = await get_or_create_user_settings(db, user_id, str(tenant_id) if tenant_id else None)

    return {
        "readReceiptsEnabled": settings.read_receipts_enabled if settings.read_receipts_enabled is not None else True,
        "showLastSeen": settings.show_last_seen if settings.show_last_seen is not None else True
    }


@router.put("/chat")
async def update_chat_settings(
    chat: ChatSettings,
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Update chat privacy settings"""
    return await update_settings(
        FullSettingsUpdate(chat=chat),
        current_user,
        db
    )


@router.post("/reset")
async def reset_settings(
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Reset all user settings to defaults"""
    user_id = str(current_user.get("user_id") or current_user.get("id"))
    tenant_id = current_user.get("tenant_id")

    import uuid

    # Delete existing settings
    query = select(UserSettings).where(UserSettings.user_id == uuid.UUID(user_id))
    if tenant_id:
        query = query.where(UserSettings.tenant_id == uuid.UUID(str(tenant_id)))

    result = await db.execute(query)
    existing = result.scalar_one_or_none()

    if existing:
        await db.delete(existing)
        await db.commit()

    # Create new default settings
    settings = await get_or_create_user_settings(db, user_id, str(tenant_id) if tenant_id else None)

    logger.info(f"Settings reset to defaults for user {user_id}")

    return settings.to_dict()


@router.post("/profile-photo")
async def upload_profile_photo(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Upload a profile photo for the current user"""
    user_id = str(current_user.get("user_id") or current_user.get("id"))
    tenant_id = current_user.get("tenant_id")

    # Validate file type
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only image files are allowed"
        )

    # Validate file size (max 5MB)
    file_content = await file.read()
    if len(file_content) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size must be less than 5MB"
        )

    try:
        # Upload to S3/MinIO using chat file service
        file_service = ChatFileService()
        result = await file_service.upload_chat_attachment(
            file_content=file_content,
            file_name=file.filename or "profile.jpg",
            content_type=file.content_type,
            conversation_id="profile-photos",  # Use special folder
            user_id=user_id,
        )

        avatar_url = result["file_url"]

        # Update user settings with avatar URL
        settings = await get_or_create_user_settings(db, user_id, str(tenant_id) if tenant_id else None)
        settings.avatar_url = avatar_url
        settings.updated_at = datetime.utcnow()

        # Also update all chat participant records for this user so others see the new avatar
        import uuid
        from models.chat_models import ConversationParticipant
        await db.execute(
            update(ConversationParticipant)
            .where(ConversationParticipant.user_id == uuid.UUID(user_id))
            .values(user_avatar=avatar_url)
        )

        await db.commit()

        logger.info(f"Profile photo updated for user {user_id}")

        return {
            "success": True,
            "avatar_url": avatar_url,
        }
    except Exception as e:
        logger.error(f"Failed to upload profile photo: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload profile photo: {str(e)}"
        )


@router.get("/profile")
async def get_profile(
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get current user's profile information including avatar"""
    user_id = str(current_user.get("user_id") or current_user.get("id"))
    tenant_id = current_user.get("tenant_id")

    settings = await get_or_create_user_settings(db, user_id, str(tenant_id) if tenant_id else None)

    return {
        "user_id": user_id,
        "username": current_user.get("username") or current_user.get("name"),
        "email": current_user.get("email"),
        "avatar_url": settings.avatar_url,
        "tenant_role": current_user.get("tenant_role"),
    }
