"""
Bheem Workspace - Device Management API
API endpoints for device registration and management
"""
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from pydantic import BaseModel, Field
from datetime import datetime

from core.database import get_db
from core.security import get_current_user, require_admin
from services.device_service import DeviceService

router = APIRouter(prefix="/devices", tags=["Devices"])


# =============================================
# Pydantic Schemas
# =============================================

class DeviceRegister(BaseModel):
    device_id: str = Field(..., min_length=1, max_length=255)
    device_name: Optional[str] = Field(None, max_length=255)
    device_type: Optional[str] = None
    platform: Optional[str] = None
    os_version: Optional[str] = None
    app_version: Optional[str] = None
    browser: Optional[str] = None


class DeviceUpdate(BaseModel):
    device_name: Optional[str] = Field(None, max_length=255)
    is_managed: Optional[bool] = None
    is_encrypted: Optional[bool] = None
    has_screen_lock: Optional[bool] = None
    push_token: Optional[str] = None
    push_enabled: Optional[bool] = None


class DeviceResponse(BaseModel):
    id: UUID
    user_id: UUID
    device_id: str
    device_name: Optional[str]
    device_type: Optional[str]
    platform: Optional[str]
    os_version: Optional[str]
    app_version: Optional[str]
    browser: Optional[str]
    is_managed: bool
    is_encrypted: bool
    has_screen_lock: bool
    is_rooted: bool
    status: str
    blocked_at: Optional[datetime]
    blocked_reason: Optional[str]
    wiped_at: Optional[datetime]
    first_seen_at: datetime
    last_seen_at: datetime
    last_ip_address: Optional[str]
    last_location: Optional[str]
    push_enabled: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DevicePolicyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    require_encryption: bool = False
    require_screen_lock: bool = False
    min_os_version: Optional[dict] = None
    block_rooted: bool = True
    allowed_platforms: Optional[List[str]] = None
    max_inactive_days: int = Field(default=90, ge=1)
    block_on_violation: bool = False
    wipe_on_violation: bool = False


class DevicePolicyUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    require_encryption: Optional[bool] = None
    require_screen_lock: Optional[bool] = None
    min_os_version: Optional[dict] = None
    block_rooted: Optional[bool] = None
    allowed_platforms: Optional[List[str]] = None
    max_inactive_days: Optional[int] = Field(None, ge=1)
    block_on_violation: Optional[bool] = None
    wipe_on_violation: Optional[bool] = None
    is_enabled: Optional[bool] = None
    apply_to_groups: Optional[List[UUID]] = None
    apply_to_org_units: Optional[List[UUID]] = None


class DevicePolicyResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    require_encryption: bool
    require_screen_lock: bool
    min_os_version: dict
    block_rooted: bool
    allowed_platforms: List[str]
    max_inactive_days: int
    block_on_violation: bool
    wipe_on_violation: bool
    is_enabled: bool
    is_default: bool
    apply_to_groups: List[UUID]
    apply_to_org_units: List[UUID]
    created_by: Optional[UUID]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BlockDeviceRequest(BaseModel):
    reason: Optional[str] = None


# =============================================
# Device Registration & Management
# =============================================

@router.post("/register", response_model=DeviceResponse, status_code=status.HTTP_201_CREATED)
async def register_device(
    data: DeviceRegister,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Register a new device or update existing"""
    service = DeviceService(db)

    # Get IP address from request
    ip_address = request.client.host if request.client else None

    device = await service.register_device(
        tenant_id=current_user["tenant_id"],
        user_id=current_user["user_id"],
        device_id=data.device_id,
        device_name=data.device_name,
        device_type=data.device_type,
        platform=data.platform,
        os_version=data.os_version,
        app_version=data.app_version,
        browser=data.browser,
        ip_address=ip_address
    )

    return device


@router.get("/my-devices", response_model=List[DeviceResponse])
async def list_my_devices(
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """List current user's devices"""
    service = DeviceService(db)

    devices = await service.list_devices(
        tenant_id=current_user["tenant_id"],
        user_id=current_user["user_id"],
        status=status,
        skip=skip,
        limit=limit
    )

    return devices


@router.get("", response_model=List[DeviceResponse])
async def list_all_devices(
    user_id: Optional[UUID] = None,
    status: Optional[str] = None,
    device_type: Optional[str] = None,
    platform: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(require_admin),
    db = Depends(get_db)
):
    """List all devices in tenant (admin only)"""
    service = DeviceService(db)

    devices = await service.list_devices(
        tenant_id=current_user["tenant_id"],
        user_id=user_id,
        status=status,
        device_type=device_type,
        platform=platform,
        skip=skip,
        limit=limit
    )

    return devices


@router.get("/{device_id}", response_model=DeviceResponse)
async def get_device(
    device_id: UUID,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get device by ID"""
    service = DeviceService(db)

    device = await service.get_device(device_id, current_user["tenant_id"])
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )

    # Check if user owns device or is admin
    if device.user_id != current_user["user_id"] and not current_user.get("is_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this device"
        )

    return device


@router.patch("/{device_id}", response_model=DeviceResponse)
async def update_device(
    device_id: UUID,
    data: DeviceUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Update device details"""
    service = DeviceService(db)

    # Get device first to check ownership
    device = await service.get_device(device_id, current_user["tenant_id"])
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )

    # Check if user owns device or is admin
    if device.user_id != current_user["user_id"] and not current_user.get("is_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this device"
        )

    updated_device = await service.update_device(
        device_uuid=device_id,
        tenant_id=current_user["tenant_id"],
        **data.model_dump(exclude_unset=True)
    )

    return updated_device


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_device(
    device_id: UUID,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Delete a device"""
    service = DeviceService(db)

    # Get device first to check ownership
    device = await service.get_device(device_id, current_user["tenant_id"])
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )

    # Check if user owns device or is admin
    if device.user_id != current_user["user_id"] and not current_user.get("is_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this device"
        )

    deleted = await service.delete_device(device_id, current_user["tenant_id"])
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )


@router.post("/{device_id}/block", response_model=DeviceResponse)
async def block_device(
    device_id: UUID,
    data: BlockDeviceRequest,
    current_user: dict = Depends(require_admin),
    db = Depends(get_db)
):
    """Block a device (admin only)"""
    service = DeviceService(db)

    device = await service.block_device(
        device_uuid=device_id,
        tenant_id=current_user["tenant_id"],
        reason=data.reason
    )

    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )

    return device


@router.post("/{device_id}/unblock", response_model=DeviceResponse)
async def unblock_device(
    device_id: UUID,
    current_user: dict = Depends(require_admin),
    db = Depends(get_db)
):
    """Unblock a device (admin only)"""
    service = DeviceService(db)

    device = await service.unblock_device(
        device_uuid=device_id,
        tenant_id=current_user["tenant_id"]
    )

    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found or not blocked"
        )

    return device


@router.post("/{device_id}/wipe", response_model=DeviceResponse)
async def wipe_device(
    device_id: UUID,
    current_user: dict = Depends(require_admin),
    db = Depends(get_db)
):
    """Initiate remote wipe for a device (admin only)"""
    service = DeviceService(db)

    device = await service.wipe_device(
        device_uuid=device_id,
        tenant_id=current_user["tenant_id"]
    )

    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )

    return device


@router.post("/{device_id}/activity")
async def update_device_activity(
    device_id: UUID,
    request: Request,
    location: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Update device activity (heartbeat)"""
    service = DeviceService(db)

    # Get IP address from request
    ip_address = request.client.host if request.client else None

    await service.update_device_activity(
        device_uuid=device_id,
        tenant_id=current_user["tenant_id"],
        ip_address=ip_address,
        location=location
    )

    return {"status": "ok"}


# =============================================
# Device Statistics
# =============================================

@router.get("/stats/overview")
async def get_device_stats(
    current_user: dict = Depends(require_admin),
    db = Depends(get_db)
):
    """Get device statistics (admin only)"""
    service = DeviceService(db)

    stats = await service.get_device_stats(current_user["tenant_id"])
    return stats


@router.get("/stats/inactive")
async def get_inactive_devices(
    inactive_days: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(require_admin),
    db = Depends(get_db)
):
    """Get inactive devices (admin only)"""
    service = DeviceService(db)

    devices = await service.get_inactive_devices(
        tenant_id=current_user["tenant_id"],
        inactive_days=inactive_days
    )

    return [
        {
            "id": str(d.id),
            "device_name": d.device_name,
            "device_type": d.device_type,
            "platform": d.platform,
            "user_id": str(d.user_id),
            "last_seen_at": d.last_seen_at.isoformat() if d.last_seen_at else None
        }
        for d in devices
    ]


# =============================================
# Device Policies
# =============================================

@router.post("/policies", response_model=DevicePolicyResponse, status_code=status.HTTP_201_CREATED)
async def create_device_policy(
    data: DevicePolicyCreate,
    current_user: dict = Depends(require_admin),
    db = Depends(get_db)
):
    """Create a device policy (admin only)"""
    service = DeviceService(db)

    policy = await service.create_policy(
        tenant_id=current_user["tenant_id"],
        created_by=current_user["user_id"],
        name=data.name,
        description=data.description,
        require_encryption=data.require_encryption,
        require_screen_lock=data.require_screen_lock,
        min_os_version=data.min_os_version,
        block_rooted=data.block_rooted,
        allowed_platforms=data.allowed_platforms,
        max_inactive_days=data.max_inactive_days,
        block_on_violation=data.block_on_violation,
        wipe_on_violation=data.wipe_on_violation
    )

    return policy


@router.get("/policies", response_model=List[DevicePolicyResponse])
async def list_device_policies(
    is_enabled: Optional[bool] = None,
    current_user: dict = Depends(require_admin),
    db = Depends(get_db)
):
    """List device policies (admin only)"""
    service = DeviceService(db)

    policies = await service.list_policies(
        tenant_id=current_user["tenant_id"],
        is_enabled=is_enabled
    )

    return policies


@router.get("/policies/{policy_id}", response_model=DevicePolicyResponse)
async def get_device_policy(
    policy_id: UUID,
    current_user: dict = Depends(require_admin),
    db = Depends(get_db)
):
    """Get a device policy by ID (admin only)"""
    service = DeviceService(db)

    policy = await service.get_policy(policy_id, current_user["tenant_id"])
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device policy not found"
        )

    return policy


@router.patch("/policies/{policy_id}", response_model=DevicePolicyResponse)
async def update_device_policy(
    policy_id: UUID,
    data: DevicePolicyUpdate,
    current_user: dict = Depends(require_admin),
    db = Depends(get_db)
):
    """Update a device policy (admin only)"""
    service = DeviceService(db)

    policy = await service.update_policy(
        policy_id=policy_id,
        tenant_id=current_user["tenant_id"],
        **data.model_dump(exclude_unset=True)
    )

    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device policy not found"
        )

    return policy


@router.delete("/policies/{policy_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_device_policy(
    policy_id: UUID,
    current_user: dict = Depends(require_admin),
    db = Depends(get_db)
):
    """Delete a device policy (admin only)"""
    service = DeviceService(db)

    deleted = await service.delete_policy(policy_id, current_user["tenant_id"])
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device policy not found"
        )
