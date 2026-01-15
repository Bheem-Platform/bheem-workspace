"""
Bheem Workspace - Drive Service
Business logic for Bheem Drive - file management
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func, and_, or_
from sqlalchemy.orm import selectinload
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from uuid import UUID
import secrets
import hashlib
import logging

from models.drive_models import DriveFile, DriveShare, DriveActivity

logger = logging.getLogger(__name__)


class DriveService:
    """Service for managing Drive files and folders"""

    def __init__(self, db: AsyncSession):
        self.db = db

    # =============================================
    # Folder Operations
    # =============================================

    async def create_folder(
        self,
        tenant_id: UUID,
        owner_id: UUID,
        name: str,
        parent_id: Optional[UUID] = None,
        description: Optional[str] = None
    ) -> DriveFile:
        """Create a new folder"""
        # Build path
        path = f"/{name}"
        if parent_id:
            parent = await self.get_file(parent_id, tenant_id)
            if parent and parent.file_type == 'folder':
                path = f"{parent.path}/{name}"

        folder = DriveFile(
            tenant_id=tenant_id,
            owner_id=owner_id,
            parent_id=parent_id,
            name=name,
            file_type='folder',
            path=path,
            description=description
        )

        self.db.add(folder)
        await self.db.commit()
        await self.db.refresh(folder)

        # Log activity
        await self._log_activity(folder.id, owner_id, 'created')

        return folder

    async def create_file(
        self,
        tenant_id: UUID,
        owner_id: UUID,
        name: str,
        mime_type: Optional[str] = None,
        size_bytes: int = 0,
        parent_id: Optional[UUID] = None,
        storage_path: Optional[str] = None,
        description: Optional[str] = None
    ) -> DriveFile:
        """Create a file record after upload"""
        # Build path
        path = f"/{name}"
        if parent_id:
            parent = await self.get_file(parent_id, tenant_id)
            if parent and parent.file_type == 'folder':
                path = f"{parent.path}/{name}"

        file = DriveFile(
            tenant_id=tenant_id,
            owner_id=owner_id,
            parent_id=parent_id,
            name=name,
            file_type='file',
            mime_type=mime_type,
            size_bytes=size_bytes,
            path=path,
            storage_path=storage_path,
            description=description
        )

        self.db.add(file)
        await self.db.commit()
        await self.db.refresh(file)

        # Log activity
        await self._log_activity(file.id, owner_id, 'created')

        return file

    async def get_file(
        self,
        file_id: UUID,
        tenant_id: UUID
    ) -> Optional[DriveFile]:
        """Get a file by ID"""
        result = await self.db.execute(
            select(DriveFile).where(
                DriveFile.id == file_id,
                DriveFile.tenant_id == tenant_id
            )
        )
        return result.scalar_one_or_none()

    async def list_files(
        self,
        tenant_id: UUID,
        owner_id: UUID,
        parent_id: Optional[UUID] = None,
        include_trashed: bool = False,
        starred_only: bool = False,
        trashed_only: bool = False,
        skip: int = 0,
        limit: int = 50
    ) -> List[DriveFile]:
        """List files in a folder"""
        query = select(DriveFile).where(
            DriveFile.tenant_id == tenant_id,
            DriveFile.owner_id == owner_id
        )

        if parent_id is not None:
            query = query.where(DriveFile.parent_id == parent_id)
        else:
            query = query.where(DriveFile.parent_id.is_(None))

        if trashed_only:
            query = query.where(DriveFile.is_trashed == True)
        elif not include_trashed:
            query = query.where(DriveFile.is_trashed == False)

        if starred_only:
            query = query.where(DriveFile.is_starred == True)

        # Order: folders first, then by name
        query = query.order_by(
            DriveFile.file_type.desc(),
            DriveFile.name
        ).offset(skip).limit(limit)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update_file(
        self,
        file_id: UUID,
        tenant_id: UUID,
        name: Optional[str] = None,
        description: Optional[str] = None,
        is_starred: Optional[bool] = None
    ) -> Optional[DriveFile]:
        """Update file metadata"""
        file = await self.get_file(file_id, tenant_id)
        if not file:
            return None

        if name is not None:
            file.name = name
        if description is not None:
            file.description = description
        if is_starred is not None:
            file.is_starred = is_starred

        file.updated_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(file)
        return file

    async def move_file(
        self,
        file_id: UUID,
        tenant_id: UUID,
        new_parent_id: Optional[UUID] = None
    ) -> Optional[DriveFile]:
        """Move file to another folder"""
        file = await self.get_file(file_id, tenant_id)
        if not file:
            return None

        # Update parent
        file.parent_id = new_parent_id

        # Update path
        if new_parent_id:
            parent = await self.get_file(new_parent_id, tenant_id)
            if parent:
                file.path = f"{parent.path}/{file.name}"
        else:
            file.path = f"/{file.name}"

        file.updated_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(file)

        await self._log_activity(file_id, file.owner_id, 'moved')
        return file

    async def copy_file(
        self,
        file_id: UUID,
        tenant_id: UUID,
        owner_id: UUID,
        new_parent_id: Optional[UUID] = None,
        new_name: Optional[str] = None
    ) -> Optional[DriveFile]:
        """Copy a file"""
        file = await self.get_file(file_id, tenant_id)
        if not file or file.file_type == 'folder':
            return None

        name = new_name or f"Copy of {file.name}"
        path = f"/{name}"

        if new_parent_id:
            parent = await self.get_file(new_parent_id, tenant_id)
            if parent:
                path = f"{parent.path}/{name}"

        new_file = DriveFile(
            tenant_id=tenant_id,
            owner_id=owner_id,
            parent_id=new_parent_id or file.parent_id,
            name=name,
            file_type=file.file_type,
            mime_type=file.mime_type,
            size_bytes=file.size_bytes,
            path=path,
            storage_path=file.storage_path,
            description=file.description
        )

        self.db.add(new_file)
        await self.db.commit()
        await self.db.refresh(new_file)

        return new_file

    async def trash_file(
        self,
        file_id: UUID,
        tenant_id: UUID
    ) -> bool:
        """Move file to trash"""
        file = await self.get_file(file_id, tenant_id)
        if not file:
            return False

        file.is_trashed = True
        file.trashed_at = datetime.utcnow()

        await self.db.commit()
        await self._log_activity(file_id, file.owner_id, 'trashed')

        return True

    async def restore_file(
        self,
        file_id: UUID,
        tenant_id: UUID
    ) -> bool:
        """Restore file from trash"""
        result = await self.db.execute(
            select(DriveFile).where(
                DriveFile.id == file_id,
                DriveFile.tenant_id == tenant_id,
                DriveFile.is_trashed == True
            )
        )
        file = result.scalar_one_or_none()
        if not file:
            return False

        file.is_trashed = False
        file.trashed_at = None

        await self.db.commit()
        await self._log_activity(file_id, file.owner_id, 'restored')

        return True

    async def delete_file(
        self,
        file_id: UUID,
        tenant_id: UUID
    ) -> bool:
        """Permanently delete file"""
        result = await self.db.execute(
            delete(DriveFile).where(
                DriveFile.id == file_id,
                DriveFile.tenant_id == tenant_id
            )
        )
        await self.db.commit()
        return result.rowcount > 0

    async def empty_trash(
        self,
        tenant_id: UUID,
        owner_id: UUID
    ) -> int:
        """Empty trash - delete all trashed files"""
        result = await self.db.execute(
            delete(DriveFile).where(
                DriveFile.tenant_id == tenant_id,
                DriveFile.owner_id == owner_id,
                DriveFile.is_trashed == True
            )
        )
        await self.db.commit()
        return result.rowcount

    # =============================================
    # Sharing
    # =============================================

    async def share_file(
        self,
        file_id: UUID,
        tenant_id: UUID,
        shared_by: UUID,
        shared_with_email: str,
        permission: str = 'view'
    ) -> Optional[DriveShare]:
        """Share file with a user"""
        file = await self.get_file(file_id, tenant_id)
        if not file:
            return None

        share = DriveShare(
            file_id=file_id,
            shared_with_email=shared_with_email,
            permission=permission,
            shared_by=shared_by
        )

        self.db.add(share)
        await self.db.commit()
        await self.db.refresh(share)

        await self._log_activity(
            file_id, shared_by, 'shared',
            {'email': shared_with_email, 'permission': permission}
        )

        return share

    async def get_file_shares(
        self,
        file_id: UUID,
        tenant_id: UUID
    ) -> List[DriveShare]:
        """List all shares for a file"""
        # Verify file exists
        file = await self.get_file(file_id, tenant_id)
        if not file:
            return []

        result = await self.db.execute(
            select(DriveShare).where(DriveShare.file_id == file_id)
        )
        return list(result.scalars().all())

    async def remove_share(
        self,
        share_id: UUID,
        tenant_id: UUID
    ) -> bool:
        """Remove a share"""
        # Get the share to verify tenant
        result = await self.db.execute(
            select(DriveShare)
            .join(DriveFile)
            .where(
                DriveShare.id == share_id,
                DriveFile.tenant_id == tenant_id
            )
        )
        share = result.scalar_one_or_none()
        if not share:
            return False

        await self.db.delete(share)
        await self.db.commit()
        return True

    async def list_shared_with_user(
        self,
        user_email: str,
        tenant_id: UUID
    ) -> List[DriveFile]:
        """List files shared with a user"""
        result = await self.db.execute(
            select(DriveFile)
            .join(DriveShare)
            .where(
                DriveShare.shared_with_email == user_email,
                DriveFile.tenant_id == tenant_id,
                DriveFile.is_trashed == False
            )
        )
        return list(result.scalars().all())

    async def create_public_link(
        self,
        file_id: UUID,
        tenant_id: UUID,
        shared_by: UUID,
        permission: str = 'view',
        expires_in_days: Optional[int] = None,
        password: Optional[str] = None
    ) -> Optional[DriveShare]:
        """Create a public share link"""
        file = await self.get_file(file_id, tenant_id)
        if not file:
            return None

        # Generate token
        token = secrets.token_urlsafe(32)

        # Hash password if provided
        hashed_password = None
        if password:
            hashed_password = hashlib.sha256(password.encode()).hexdigest()

        # Calculate expiry
        expires_at = None
        if expires_in_days:
            expires_at = datetime.utcnow() + timedelta(days=expires_in_days)

        share = DriveShare(
            file_id=file_id,
            permission=permission,
            share_token=token,
            link_password=hashed_password,
            expires_at=expires_at,
            shared_by=shared_by,
            is_public=True
        )

        self.db.add(share)
        await self.db.commit()
        await self.db.refresh(share)

        return share

    async def access_public_link(
        self,
        share_token: str,
        password: Optional[str] = None
    ) -> Optional[DriveFile]:
        """Access a file via public link"""
        result = await self.db.execute(
            select(DriveShare).where(
                DriveShare.share_token == share_token,
                DriveShare.is_public == True,
                or_(
                    DriveShare.expires_at.is_(None),
                    DriveShare.expires_at > datetime.utcnow()
                )
            )
        )
        share = result.scalar_one_or_none()
        if not share:
            return None

        # Check password
        if share.link_password:
            if not password:
                return None
            if hashlib.sha256(password.encode()).hexdigest() != share.link_password:
                return None

        # Get file
        file_result = await self.db.execute(
            select(DriveFile).where(
                DriveFile.id == share.file_id,
                DriveFile.is_trashed == False
            )
        )
        return file_result.scalar_one_or_none()

    # =============================================
    # Search
    # =============================================

    async def search_files(
        self,
        tenant_id: UUID,
        owner_id: UUID,
        query: str,
        file_type: Optional[str] = None,
        skip: int = 0,
        limit: int = 50
    ) -> List[DriveFile]:
        """Search for files by name"""
        search_query = select(DriveFile).where(
            DriveFile.tenant_id == tenant_id,
            DriveFile.owner_id == owner_id,
            DriveFile.is_trashed == False,
            DriveFile.name.ilike(f"%{query}%")
        )

        if file_type:
            search_query = search_query.where(DriveFile.file_type == file_type)

        search_query = search_query.order_by(
            DriveFile.updated_at.desc()
        ).offset(skip).limit(limit)

        result = await self.db.execute(search_query)
        return list(result.scalars().all())

    # =============================================
    # Storage Stats
    # =============================================

    async def get_storage_usage(
        self,
        tenant_id: UUID,
        owner_id: UUID
    ) -> Dict[str, Any]:
        """Get storage usage statistics"""
        result = await self.db.execute(
            select(
                func.sum(DriveFile.size_bytes).label('total_size'),
                func.count(DriveFile.id).label('file_count')
            ).where(
                DriveFile.tenant_id == tenant_id,
                DriveFile.owner_id == owner_id,
                DriveFile.file_type == 'file',
                DriveFile.is_trashed == False
            )
        )
        row = result.one()

        # Get folder count
        folder_result = await self.db.execute(
            select(func.count(DriveFile.id)).where(
                DriveFile.tenant_id == tenant_id,
                DriveFile.owner_id == owner_id,
                DriveFile.file_type == 'folder',
                DriveFile.is_trashed == False
            )
        )
        folder_count = folder_result.scalar() or 0

        return {
            "used_bytes": row.total_size or 0,
            "file_count": row.file_count or 0,
            "folder_count": folder_count,
            "quota_bytes": 15 * 1024 * 1024 * 1024,  # 15 GB default quota
        }

    # =============================================
    # Helper Methods
    # =============================================

    async def _log_activity(
        self,
        file_id: UUID,
        user_id: UUID,
        action: str,
        details: Optional[Dict] = None
    ):
        """Log file activity"""
        activity = DriveActivity(
            file_id=file_id,
            user_id=user_id,
            action=action,
            details=details or {}
        )
        self.db.add(activity)
