"""
Bheem Workspace - Mail Signature Service
Manage email signatures for users
"""
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from models.mail_models import MailSignature
from core.logging import get_logger

logger = get_logger("bheem.mail.signatures")


class MailSignatureService:
    """
    Service for managing email signatures.
    Users can have multiple signatures with one default.
    """

    async def create_signature(
        self,
        db: AsyncSession,
        user_id: UUID,
        name: str,
        content: str,
        is_html: bool = True,
        is_default: bool = False
    ) -> MailSignature:
        """
        Create a new signature.

        Args:
            db: Database session
            user_id: Owner's user ID
            name: Signature name (e.g., "Work", "Personal")
            content: Signature content (HTML or plain text)
            is_html: Whether content is HTML
            is_default: Whether this is the default signature

        Returns:
            Created MailSignature object
        """
        # If setting as default, unset any existing default
        if is_default:
            await self._unset_default(db, user_id)

        # If this is the first signature, make it default
        existing_count = await self.count_signatures(db, user_id)
        if existing_count == 0:
            is_default = True

        signature = MailSignature(
            user_id=user_id,
            name=name,
            content=content,
            is_html=is_html,
            is_default=is_default
        )

        db.add(signature)
        await db.commit()
        await db.refresh(signature)

        logger.info(
            f"Created signature '{name}' for user {user_id}",
            action="signature_created",
            signature_id=str(signature.id),
            user_id=str(user_id)
        )

        return signature

    async def update_signature(
        self,
        db: AsyncSession,
        signature_id: UUID,
        user_id: UUID,
        **kwargs
    ) -> Optional[MailSignature]:
        """
        Update an existing signature.

        Args:
            db: Database session
            signature_id: Signature UUID
            user_id: Owner's user ID (for authorization)
            **kwargs: Fields to update (name, content, is_html, is_default)

        Returns:
            Updated MailSignature or None if not found
        """
        # Filter allowed fields
        allowed_fields = {'name', 'content', 'is_html', 'is_default'}
        update_data = {k: v for k, v in kwargs.items() if k in allowed_fields}

        if not update_data:
            return await self.get_signature(db, signature_id, user_id)

        # Handle default flag
        if update_data.get('is_default'):
            await self._unset_default(db, user_id)

        update_data['updated_at'] = datetime.utcnow()

        result = await db.execute(
            update(MailSignature)
            .where(MailSignature.id == signature_id, MailSignature.user_id == user_id)
            .values(**update_data)
            .returning(MailSignature)
        )
        await db.commit()

        signature = result.scalar_one_or_none()

        if signature:
            logger.info(
                f"Updated signature {signature_id}",
                action="signature_updated",
                signature_id=str(signature_id)
            )

        return signature

    async def get_signature(
        self,
        db: AsyncSession,
        signature_id: UUID,
        user_id: UUID
    ) -> Optional[MailSignature]:
        """
        Get a single signature by ID.
        """
        result = await db.execute(
            select(MailSignature)
            .where(MailSignature.id == signature_id, MailSignature.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_default_signature(
        self,
        db: AsyncSession,
        user_id: UUID
    ) -> Optional[MailSignature]:
        """
        Get the user's default signature.
        """
        result = await db.execute(
            select(MailSignature)
            .where(MailSignature.user_id == user_id, MailSignature.is_default == True)
        )
        return result.scalar_one_or_none()

    async def list_signatures(
        self,
        db: AsyncSession,
        user_id: UUID
    ) -> List[MailSignature]:
        """
        List all signatures for a user.

        Returns signatures ordered by is_default (default first), then name.
        """
        result = await db.execute(
            select(MailSignature)
            .where(MailSignature.user_id == user_id)
            .order_by(MailSignature.is_default.desc(), MailSignature.name)
        )
        return result.scalars().all()

    async def delete_signature(
        self,
        db: AsyncSession,
        signature_id: UUID,
        user_id: UUID
    ) -> bool:
        """
        Delete a signature.

        If deleting the default, another signature becomes default.
        """
        # Check if this is the default
        signature = await self.get_signature(db, signature_id, user_id)
        was_default = signature.is_default if signature else False

        result = await db.execute(
            delete(MailSignature)
            .where(MailSignature.id == signature_id, MailSignature.user_id == user_id)
        )
        await db.commit()

        deleted = result.rowcount > 0

        # If we deleted the default, set a new default
        if deleted and was_default:
            await self._set_first_as_default(db, user_id)

        if deleted:
            logger.info(
                f"Deleted signature {signature_id}",
                action="signature_deleted",
                signature_id=str(signature_id)
            )

        return deleted

    async def set_default(
        self,
        db: AsyncSession,
        signature_id: UUID,
        user_id: UUID
    ) -> bool:
        """
        Set a signature as the default.
        """
        # Unset current default
        await self._unset_default(db, user_id)

        # Set new default
        result = await db.execute(
            update(MailSignature)
            .where(MailSignature.id == signature_id, MailSignature.user_id == user_id)
            .values(is_default=True, updated_at=datetime.utcnow())
        )
        await db.commit()

        return result.rowcount > 0

    async def count_signatures(
        self,
        db: AsyncSession,
        user_id: UUID
    ) -> int:
        """Count total signatures for a user."""
        from sqlalchemy import func
        result = await db.execute(
            select(func.count(MailSignature.id))
            .where(MailSignature.user_id == user_id)
        )
        return result.scalar() or 0

    async def _unset_default(
        self,
        db: AsyncSession,
        user_id: UUID
    ):
        """Unset any existing default signature."""
        await db.execute(
            update(MailSignature)
            .where(MailSignature.user_id == user_id, MailSignature.is_default == True)
            .values(is_default=False)
        )

    async def _set_first_as_default(
        self,
        db: AsyncSession,
        user_id: UUID
    ):
        """Set the first signature as default."""
        result = await db.execute(
            select(MailSignature.id)
            .where(MailSignature.user_id == user_id)
            .order_by(MailSignature.created_at)
            .limit(1)
        )
        first_id = result.scalar_one_or_none()

        if first_id:
            await db.execute(
                update(MailSignature)
                .where(MailSignature.id == first_id)
                .values(is_default=True)
            )
            await db.commit()

    def signature_to_dict(self, signature: MailSignature) -> Dict[str, Any]:
        """Convert signature model to dictionary for API response."""
        return {
            "id": str(signature.id),
            "name": signature.name,
            "content": signature.content,
            "is_html": signature.is_html,
            "is_default": signature.is_default,
            "created_at": signature.created_at.isoformat() if signature.created_at else None,
            "updated_at": signature.updated_at.isoformat() if signature.updated_at else None,
        }


# Singleton instance
mail_signature_service = MailSignatureService()
