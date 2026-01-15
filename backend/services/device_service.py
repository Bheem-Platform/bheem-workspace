"""
Bheem Workspace - Device Management Service
Business logic for managing user devices
"""
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, func
from sqlalchemy.orm import selectinload

from models.enterprise_models import Device, DevicePolicy


class DeviceService:
    """Service for device management"""

    def __init__(self, db: AsyncSession):
        self.db = db

    # =============================================
    # Device Registration & Management
    # =============================================

    async def register_device(
        self,
        tenant_id: UUID,
        user_id: UUID,
        device_id: str,
        device_name: Optional[str] = None,
        device_type: Optional[str] = None,
        platform: Optional[str] = None,
        os_version: Optional[str] = None,
        app_version: Optional[str] = None,
        browser: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> Device:
        """Register a new device or update existing"""
        # Check if device already exists
        existing = await self.get_device_by_device_id(
            tenant_id, user_id, device_id
        )

        if existing:
            # Update last seen
            existing.last_seen_at = datetime.utcnow()
            existing.last_ip_address = ip_address
            if app_version:
                existing.app_version = app_version
            if os_version:
                existing.os_version = os_version

            await self.db.commit()
            await self.db.refresh(existing)
            return existing

        # Create new device
        device = Device(
            tenant_id=tenant_id,
            user_id=user_id,
            device_id=device_id,
            device_name=device_name or f"{platform or 'Unknown'} Device",
            device_type=device_type or self._detect_device_type(platform),
            platform=platform,
            os_version=os_version,
            app_version=app_version,
            browser=browser,
            last_ip_address=ip_address,
            status='active'
        )

        self.db.add(device)
        await self.db.commit()
        await self.db.refresh(device)

        # Check device against policies
        await self._check_device_policy(device)

        return device

    def _detect_device_type(self, platform: Optional[str]) -> str:
        """Detect device type from platform"""
        if not platform:
            return 'unknown'

        platform_lower = platform.lower()
        if platform_lower in ['ios', 'android']:
            return 'mobile'
        elif platform_lower in ['windows', 'macos', 'linux']:
            return 'desktop'
        elif 'tablet' in platform_lower or 'ipad' in platform_lower:
            return 'tablet'
        elif platform_lower == 'web':
            return 'web'
        return 'unknown'

    async def get_device_by_device_id(
        self,
        tenant_id: UUID,
        user_id: UUID,
        device_id: str
    ) -> Optional[Device]:
        """Get device by device identifier"""
        result = await self.db.execute(
            select(Device).where(
                Device.tenant_id == tenant_id,
                Device.user_id == user_id,
                Device.device_id == device_id
            )
        )
        return result.scalar_one_or_none()

    async def get_device(
        self,
        device_uuid: UUID,
        tenant_id: UUID
    ) -> Optional[Device]:
        """Get device by UUID"""
        result = await self.db.execute(
            select(Device).where(
                Device.id == device_uuid,
                Device.tenant_id == tenant_id
            )
        )
        return result.scalar_one_or_none()

    async def list_devices(
        self,
        tenant_id: UUID,
        user_id: Optional[UUID] = None,
        status: Optional[str] = None,
        device_type: Optional[str] = None,
        platform: Optional[str] = None,
        skip: int = 0,
        limit: int = 50
    ) -> List[Device]:
        """List devices with filters"""
        query = select(Device).where(Device.tenant_id == tenant_id)

        if user_id:
            query = query.where(Device.user_id == user_id)
        if status:
            query = query.where(Device.status == status)
        if device_type:
            query = query.where(Device.device_type == device_type)
        if platform:
            query = query.where(Device.platform == platform)

        query = query.order_by(Device.last_seen_at.desc())
        query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update_device(
        self,
        device_uuid: UUID,
        tenant_id: UUID,
        **updates
    ) -> Optional[Device]:
        """Update device details"""
        device = await self.get_device(device_uuid, tenant_id)
        if not device:
            return None

        allowed_fields = [
            'device_name', 'is_managed', 'is_encrypted',
            'has_screen_lock', 'push_token', 'push_enabled'
        ]

        for field, value in updates.items():
            if field in allowed_fields and value is not None:
                setattr(device, field, value)

        device.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(device)
        return device

    async def block_device(
        self,
        device_uuid: UUID,
        tenant_id: UUID,
        reason: Optional[str] = None
    ) -> Optional[Device]:
        """Block a device"""
        device = await self.get_device(device_uuid, tenant_id)
        if not device:
            return None

        device.status = 'blocked'
        device.blocked_at = datetime.utcnow()
        device.blocked_reason = reason

        await self.db.commit()
        await self.db.refresh(device)
        return device

    async def unblock_device(
        self,
        device_uuid: UUID,
        tenant_id: UUID
    ) -> Optional[Device]:
        """Unblock a device"""
        device = await self.get_device(device_uuid, tenant_id)
        if not device or device.status != 'blocked':
            return None

        device.status = 'active'
        device.blocked_at = None
        device.blocked_reason = None

        await self.db.commit()
        await self.db.refresh(device)
        return device

    async def wipe_device(
        self,
        device_uuid: UUID,
        tenant_id: UUID
    ) -> Optional[Device]:
        """Initiate remote wipe for a device"""
        device = await self.get_device(device_uuid, tenant_id)
        if not device:
            return None

        device.status = 'wiped'
        device.wiped_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(device)

        # TODO: Send wipe command to device via push notification

        return device

    async def delete_device(
        self,
        device_uuid: UUID,
        tenant_id: UUID
    ) -> bool:
        """Delete a device record"""
        result = await self.db.execute(
            delete(Device).where(
                Device.id == device_uuid,
                Device.tenant_id == tenant_id
            )
        )
        await self.db.commit()
        return result.rowcount > 0

    async def update_device_activity(
        self,
        device_uuid: UUID,
        tenant_id: UUID,
        ip_address: Optional[str] = None,
        location: Optional[str] = None
    ):
        """Update device last activity"""
        await self.db.execute(
            update(Device)
            .where(
                Device.id == device_uuid,
                Device.tenant_id == tenant_id
            )
            .values(
                last_seen_at=datetime.utcnow(),
                last_ip_address=ip_address,
                last_location=location
            )
        )
        await self.db.commit()

    # =============================================
    # Device Policies
    # =============================================

    async def create_policy(
        self,
        tenant_id: UUID,
        created_by: UUID,
        name: str,
        description: Optional[str] = None,
        require_encryption: bool = False,
        require_screen_lock: bool = False,
        min_os_version: Optional[Dict] = None,
        block_rooted: bool = True,
        allowed_platforms: Optional[List[str]] = None,
        max_inactive_days: int = 90,
        block_on_violation: bool = False,
        wipe_on_violation: bool = False
    ) -> DevicePolicy:
        """Create a device policy"""
        policy = DevicePolicy(
            tenant_id=tenant_id,
            created_by=created_by,
            name=name,
            description=description,
            require_encryption=require_encryption,
            require_screen_lock=require_screen_lock,
            min_os_version=min_os_version or {},
            block_rooted=block_rooted,
            allowed_platforms=allowed_platforms or [],
            max_inactive_days=max_inactive_days,
            block_on_violation=block_on_violation,
            wipe_on_violation=wipe_on_violation,
            is_enabled=True
        )

        self.db.add(policy)
        await self.db.commit()
        await self.db.refresh(policy)
        return policy

    async def get_policy(
        self,
        policy_id: UUID,
        tenant_id: UUID
    ) -> Optional[DevicePolicy]:
        """Get a device policy"""
        result = await self.db.execute(
            select(DevicePolicy).where(
                DevicePolicy.id == policy_id,
                DevicePolicy.tenant_id == tenant_id
            )
        )
        return result.scalar_one_or_none()

    async def list_policies(
        self,
        tenant_id: UUID,
        is_enabled: Optional[bool] = None
    ) -> List[DevicePolicy]:
        """List device policies"""
        query = select(DevicePolicy).where(
            DevicePolicy.tenant_id == tenant_id
        )

        if is_enabled is not None:
            query = query.where(DevicePolicy.is_enabled == is_enabled)

        query = query.order_by(DevicePolicy.created_at.desc())

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update_policy(
        self,
        policy_id: UUID,
        tenant_id: UUID,
        **updates
    ) -> Optional[DevicePolicy]:
        """Update a device policy"""
        policy = await self.get_policy(policy_id, tenant_id)
        if not policy:
            return None

        allowed_fields = [
            'name', 'description', 'require_encryption', 'require_screen_lock',
            'min_os_version', 'block_rooted', 'allowed_platforms',
            'max_inactive_days', 'block_on_violation', 'wipe_on_violation',
            'is_enabled', 'apply_to_groups', 'apply_to_org_units'
        ]

        for field, value in updates.items():
            if field in allowed_fields and value is not None:
                setattr(policy, field, value)

        policy.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(policy)
        return policy

    async def delete_policy(
        self,
        policy_id: UUID,
        tenant_id: UUID
    ) -> bool:
        """Delete a device policy"""
        result = await self.db.execute(
            delete(DevicePolicy).where(
                DevicePolicy.id == policy_id,
                DevicePolicy.tenant_id == tenant_id
            )
        )
        await self.db.commit()
        return result.rowcount > 0

    async def _check_device_policy(self, device: Device):
        """Check device against policies and take action"""
        policies = await self.list_policies(device.tenant_id, is_enabled=True)

        for policy in policies:
            violations = self._check_policy_violations(device, policy)
            if violations:
                if policy.block_on_violation:
                    device.status = 'blocked'
                    device.blocked_at = datetime.utcnow()
                    device.blocked_reason = f"Policy violation: {', '.join(violations)}"
                    await self.db.commit()
                    break

    def _check_policy_violations(
        self,
        device: Device,
        policy: DevicePolicy
    ) -> List[str]:
        """Check device against a policy and return violations"""
        violations = []

        # Check platform
        if policy.allowed_platforms and device.platform:
            if device.platform.lower() not in [p.lower() for p in policy.allowed_platforms]:
                violations.append(f"Platform '{device.platform}' not allowed")

        # Check rooted/jailbroken
        if policy.block_rooted and device.is_rooted:
            violations.append("Device is rooted/jailbroken")

        # Check encryption
        if policy.require_encryption and not device.is_encrypted:
            violations.append("Device encryption required")

        # Check screen lock
        if policy.require_screen_lock and not device.has_screen_lock:
            violations.append("Screen lock required")

        # Check OS version
        if policy.min_os_version and device.platform and device.os_version:
            min_version = policy.min_os_version.get(device.platform.lower())
            if min_version and self._compare_versions(device.os_version, min_version) < 0:
                violations.append(f"OS version {device.os_version} below minimum {min_version}")

        return violations

    def _compare_versions(self, v1: str, v2: str) -> int:
        """Compare two version strings"""
        try:
            parts1 = [int(x) for x in v1.split('.')[:3]]
            parts2 = [int(x) for x in v2.split('.')[:3]]

            for i in range(max(len(parts1), len(parts2))):
                p1 = parts1[i] if i < len(parts1) else 0
                p2 = parts2[i] if i < len(parts2) else 0
                if p1 < p2:
                    return -1
                elif p1 > p2:
                    return 1
            return 0
        except (ValueError, AttributeError):
            return 0

    # =============================================
    # Statistics & Analytics
    # =============================================

    async def get_device_stats(
        self,
        tenant_id: UUID
    ) -> Dict[str, Any]:
        """Get device statistics"""
        # Count by status
        status_query = select(
            Device.status,
            func.count(Device.id)
        ).where(
            Device.tenant_id == tenant_id
        ).group_by(Device.status)

        status_result = await self.db.execute(status_query)
        status_counts = dict(status_result.all())

        # Count by platform
        platform_query = select(
            Device.platform,
            func.count(Device.id)
        ).where(
            Device.tenant_id == tenant_id
        ).group_by(Device.platform)

        platform_result = await self.db.execute(platform_query)
        platform_counts = dict(platform_result.all())

        # Count by device type
        type_query = select(
            Device.device_type,
            func.count(Device.id)
        ).where(
            Device.tenant_id == tenant_id
        ).group_by(Device.device_type)

        type_result = await self.db.execute(type_query)
        type_counts = dict(type_result.all())

        # Total count
        total = sum(status_counts.values())

        # Active in last 24 hours
        active_query = select(func.count(Device.id)).where(
            Device.tenant_id == tenant_id,
            Device.last_seen_at >= datetime.utcnow() - timedelta(hours=24)
        )
        active_result = await self.db.execute(active_query)
        active_24h = active_result.scalar() or 0

        return {
            'total_devices': total,
            'active_24h': active_24h,
            'by_status': status_counts,
            'by_platform': platform_counts,
            'by_type': type_counts
        }

    async def get_inactive_devices(
        self,
        tenant_id: UUID,
        inactive_days: int = 30
    ) -> List[Device]:
        """Get devices inactive for specified days"""
        cutoff = datetime.utcnow() - timedelta(days=inactive_days)

        result = await self.db.execute(
            select(Device).where(
                Device.tenant_id == tenant_id,
                Device.status == 'active',
                Device.last_seen_at < cutoff
            ).order_by(Device.last_seen_at.asc())
        )
        return list(result.scalars().all())
