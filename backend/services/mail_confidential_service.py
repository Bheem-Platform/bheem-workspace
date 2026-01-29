"""
Bheem Workspace - Confidential Email Service
Service for managing confidential/expiring emails
Phase 9: Email Enhancements
"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, or_
from sqlalchemy.orm import selectinload

from models.mail_models import ConfidentialEmail


class ConfidentialEmailService:
    """Service for managing confidential emails"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_confidential_email(
        self,
        user_id: UUID,
        message_id: str,
        expires_in_hours: Optional[int] = None,
        passcode: Optional[str] = None,
        passcode_type: str = 'none',
        no_forward: bool = True,
        no_copy: bool = True,
        no_print: bool = True,
        no_download: bool = True
    ) -> ConfidentialEmail:
        """Create confidential email settings for a sent email"""
        expires_at = None
        if expires_in_hours:
            expires_at = datetime.utcnow() + timedelta(hours=expires_in_hours)

        confidential = ConfidentialEmail(
            user_id=user_id,
            message_id=message_id,
            expires_at=expires_at,
            passcode=passcode,
            passcode_type=passcode_type,
            no_forward=no_forward,
            no_copy=no_copy,
            no_print=no_print,
            no_download=no_download
        )

        self.db.add(confidential)
        await self.db.commit()
        await self.db.refresh(confidential)
        return confidential

    async def get_by_message_id(self, message_id: str) -> Optional[ConfidentialEmail]:
        """Get confidential settings for a message"""
        result = await self.db.execute(
            select(ConfidentialEmail).where(
                ConfidentialEmail.message_id == message_id
            )
        )
        return result.scalar_one_or_none()

    async def get_user_confidential_emails(
        self,
        user_id: UUID,
        include_expired: bool = False,
        skip: int = 0,
        limit: int = 50
    ) -> List[ConfidentialEmail]:
        """Get all confidential emails for a user"""
        query = select(ConfidentialEmail).where(
            ConfidentialEmail.user_id == user_id
        )

        if not include_expired:
            query = query.where(
                or_(
                    ConfidentialEmail.expires_at.is_(None),
                    ConfidentialEmail.expires_at > datetime.utcnow()
                )
            )

        query = query.order_by(ConfidentialEmail.created_at.desc())
        query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def check_access(
        self,
        message_id: str,
        recipient_email: str,
        passcode: Optional[str] = None
    ) -> dict:
        """Check if recipient can access confidential email"""
        confidential = await self.get_by_message_id(message_id)

        if not confidential:
            return {"allowed": True, "reason": "not_confidential"}

        # Check if revoked
        if confidential.is_revoked:
            return {"allowed": False, "reason": "revoked"}

        # Check expiration
        if confidential.expires_at and confidential.expires_at < datetime.utcnow():
            return {"allowed": False, "reason": "expired"}

        # Check passcode if required
        if confidential.passcode_type != 'none' and confidential.passcode:
            if not passcode or passcode != confidential.passcode:
                return {"allowed": False, "reason": "passcode_required"}

        return {
            "allowed": True,
            "restrictions": {
                "no_forward": confidential.no_forward,
                "no_copy": confidential.no_copy,
                "no_print": confidential.no_print,
                "no_download": confidential.no_download
            },
            "expires_at": confidential.expires_at.isoformat() if confidential.expires_at else None
        }

    async def record_access(
        self,
        message_id: str,
        recipient_email: str,
        ip_address: Optional[str] = None
    ) -> None:
        """Record that recipient accessed the confidential email"""
        confidential = await self.get_by_message_id(message_id)
        if not confidential:
            return

        access_record = {
            "email": recipient_email,
            "accessed_at": datetime.utcnow().isoformat(),
            "ip": ip_address
        }

        accesses = confidential.recipient_accesses or []
        accesses.append(access_record)

        await self.db.execute(
            update(ConfidentialEmail)
            .where(ConfidentialEmail.id == confidential.id)
            .values(recipient_accesses=accesses)
        )
        await self.db.commit()

    async def revoke(self, user_id: UUID, message_id: str) -> bool:
        """Revoke access to a confidential email"""
        result = await self.db.execute(
            update(ConfidentialEmail)
            .where(
                and_(
                    ConfidentialEmail.user_id == user_id,
                    ConfidentialEmail.message_id == message_id
                )
            )
            .values(
                is_revoked=True,
                revoked_at=datetime.utcnow()
            )
        )
        await self.db.commit()
        return result.rowcount > 0

    async def update_expiration(
        self,
        user_id: UUID,
        message_id: str,
        new_expires_at: Optional[datetime]
    ) -> bool:
        """Update expiration time for a confidential email"""
        result = await self.db.execute(
            update(ConfidentialEmail)
            .where(
                and_(
                    ConfidentialEmail.user_id == user_id,
                    ConfidentialEmail.message_id == message_id
                )
            )
            .values(expires_at=new_expires_at)
        )
        await self.db.commit()
        return result.rowcount > 0

    async def delete(self, user_id: UUID, message_id: str) -> bool:
        """Delete confidential email settings"""
        result = await self.db.execute(
            delete(ConfidentialEmail).where(
                and_(
                    ConfidentialEmail.user_id == user_id,
                    ConfidentialEmail.message_id == message_id
                )
            )
        )
        await self.db.commit()
        return result.rowcount > 0

    async def cleanup_expired(self, older_than_days: int = 30) -> int:
        """Clean up expired confidential email records"""
        cutoff = datetime.utcnow() - timedelta(days=older_than_days)

        result = await self.db.execute(
            delete(ConfidentialEmail).where(
                and_(
                    ConfidentialEmail.expires_at.isnot(None),
                    ConfidentialEmail.expires_at < cutoff
                )
            )
        )
        await self.db.commit()
        return result.rowcount
