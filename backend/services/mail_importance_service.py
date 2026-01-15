"""
Bheem Workspace - Mail Importance Service
Starred and Important email management.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, delete
from sqlalchemy.dialects.postgresql import insert
from typing import List, Dict, Optional, Tuple
from datetime import datetime
import re
import logging

from models.mail_models import EmailImportance

logger = logging.getLogger(__name__)

# VIP sender patterns - emails from these are auto-important
VIP_PATTERNS = [
    r'ceo@', r'cto@', r'cfo@', r'founder@', r'president@',
    r'director@', r'manager@', r'hr@', r'payroll@'
]

# Important keyword patterns in subject
IMPORTANT_KEYWORDS = [
    'urgent', 'important', 'action required', 'immediate',
    'deadline', 'asap', 'critical', 'priority', 'reminder'
]


class MailImportanceService:
    """Service for managing starred and important emails."""

    # ========================
    # Starred Emails
    # ========================

    async def star_email(
        self,
        db: AsyncSession,
        user_id: str,
        message_id: str
    ) -> EmailImportance:
        """Star an email."""
        stmt = insert(EmailImportance).values(
            user_id=user_id,
            message_id=message_id,
            is_starred=True,
            updated_at=datetime.utcnow()
        ).on_conflict_do_update(
            index_elements=['user_id', 'message_id'],
            set_={
                'is_starred': True,
                'updated_at': datetime.utcnow()
            }
        )
        await db.execute(stmt)
        await db.commit()

        result = await db.execute(
            select(EmailImportance).where(
                and_(
                    EmailImportance.user_id == user_id,
                    EmailImportance.message_id == message_id
                )
            )
        )
        return result.scalar_one_or_none()

    async def unstar_email(
        self,
        db: AsyncSession,
        user_id: str,
        message_id: str
    ) -> bool:
        """Unstar an email."""
        result = await db.execute(
            select(EmailImportance).where(
                and_(
                    EmailImportance.user_id == user_id,
                    EmailImportance.message_id == message_id
                )
            )
        )
        importance = result.scalar_one_or_none()

        if not importance:
            return False

        importance.is_starred = False
        importance.updated_at = datetime.utcnow()

        # If neither starred nor important, delete the record
        if not importance.is_important:
            await db.delete(importance)

        await db.commit()
        return True

    async def toggle_star(
        self,
        db: AsyncSession,
        user_id: str,
        message_id: str
    ) -> Tuple[bool, bool]:
        """Toggle star status. Returns (success, new_starred_state)."""
        result = await db.execute(
            select(EmailImportance).where(
                and_(
                    EmailImportance.user_id == user_id,
                    EmailImportance.message_id == message_id
                )
            )
        )
        importance = result.scalar_one_or_none()

        if importance:
            new_state = not importance.is_starred
            importance.is_starred = new_state
            importance.updated_at = datetime.utcnow()
            await db.commit()
            return (True, new_state)
        else:
            # Create new record with starred=True
            await self.star_email(db, user_id, message_id)
            return (True, True)

    async def get_starred_emails(
        self,
        db: AsyncSession,
        user_id: str,
        limit: int = 50,
        offset: int = 0
    ) -> List[str]:
        """Get all starred email message IDs."""
        result = await db.execute(
            select(EmailImportance.message_id).where(
                and_(
                    EmailImportance.user_id == user_id,
                    EmailImportance.is_starred == True
                )
            ).order_by(EmailImportance.updated_at.desc())
            .limit(limit).offset(offset)
        )
        return [row[0] for row in result.fetchall()]

    async def is_starred(
        self,
        db: AsyncSession,
        user_id: str,
        message_id: str
    ) -> bool:
        """Check if an email is starred."""
        result = await db.execute(
            select(EmailImportance.is_starred).where(
                and_(
                    EmailImportance.user_id == user_id,
                    EmailImportance.message_id == message_id
                )
            )
        )
        row = result.scalar_one_or_none()
        return row if row else False

    # ========================
    # Important Emails
    # ========================

    async def mark_important(
        self,
        db: AsyncSession,
        user_id: str,
        message_id: str,
        auto: bool = False,
        reason: Optional[str] = None
    ) -> EmailImportance:
        """Mark an email as important."""
        stmt = insert(EmailImportance).values(
            user_id=user_id,
            message_id=message_id,
            is_important=True,
            auto_important=auto,
            importance_reason=reason,
            updated_at=datetime.utcnow()
        ).on_conflict_do_update(
            index_elements=['user_id', 'message_id'],
            set_={
                'is_important': True,
                'auto_important': auto,
                'importance_reason': reason,
                'updated_at': datetime.utcnow()
            }
        )
        await db.execute(stmt)
        await db.commit()

        result = await db.execute(
            select(EmailImportance).where(
                and_(
                    EmailImportance.user_id == user_id,
                    EmailImportance.message_id == message_id
                )
            )
        )
        return result.scalar_one_or_none()

    async def unmark_important(
        self,
        db: AsyncSession,
        user_id: str,
        message_id: str
    ) -> bool:
        """Remove important flag from email."""
        result = await db.execute(
            select(EmailImportance).where(
                and_(
                    EmailImportance.user_id == user_id,
                    EmailImportance.message_id == message_id
                )
            )
        )
        importance = result.scalar_one_or_none()

        if not importance:
            return False

        importance.is_important = False
        importance.auto_important = False
        importance.importance_reason = None
        importance.updated_at = datetime.utcnow()

        # If neither starred nor important, delete the record
        if not importance.is_starred:
            await db.delete(importance)

        await db.commit()
        return True

    async def get_important_emails(
        self,
        db: AsyncSession,
        user_id: str,
        limit: int = 50,
        offset: int = 0
    ) -> List[str]:
        """Get all important email message IDs."""
        result = await db.execute(
            select(EmailImportance.message_id).where(
                and_(
                    EmailImportance.user_id == user_id,
                    EmailImportance.is_important == True
                )
            ).order_by(EmailImportance.updated_at.desc())
            .limit(limit).offset(offset)
        )
        return [row[0] for row in result.fetchall()]

    async def is_important(
        self,
        db: AsyncSession,
        user_id: str,
        message_id: str
    ) -> bool:
        """Check if an email is marked as important."""
        result = await db.execute(
            select(EmailImportance.is_important).where(
                and_(
                    EmailImportance.user_id == user_id,
                    EmailImportance.message_id == message_id
                )
            )
        )
        row = result.scalar_one_or_none()
        return row if row else False

    # ========================
    # Auto-Importance Detection
    # ========================

    async def auto_detect_importance(
        self,
        db: AsyncSession,
        user_id: str,
        message_id: str,
        email_data: Dict
    ) -> Optional[str]:
        """
        Auto-detect if an email should be marked as important.
        Returns the reason if important, None otherwise.
        """
        from_addr = email_data.get('from', '').lower()
        subject = email_data.get('subject', '').lower()

        # Check VIP sender patterns
        for pattern in VIP_PATTERNS:
            if re.search(pattern, from_addr):
                await self.mark_important(db, user_id, message_id, auto=True, reason='vip_sender')
                return 'vip_sender'

        # Check important keywords in subject
        for keyword in IMPORTANT_KEYWORDS:
            if keyword in subject:
                await self.mark_important(db, user_id, message_id, auto=True, reason='keyword_match')
                return 'keyword_match'

        # Check for direct addressing (user's email in To, not CC/BCC)
        to_addrs = email_data.get('to', '').lower()
        if email_data.get('user_email', '').lower() in to_addrs:
            # Direct email, slightly more important
            # But don't auto-mark, let user decide
            pass

        return None

    # ========================
    # Combined Operations
    # ========================

    async def get_email_flags(
        self,
        db: AsyncSession,
        user_id: str,
        message_id: str
    ) -> Dict:
        """Get all importance flags for an email."""
        result = await db.execute(
            select(EmailImportance).where(
                and_(
                    EmailImportance.user_id == user_id,
                    EmailImportance.message_id == message_id
                )
            )
        )
        importance = result.scalar_one_or_none()

        if not importance:
            return {
                'is_starred': False,
                'is_important': False,
                'auto_important': False,
                'importance_reason': None
            }

        return {
            'is_starred': importance.is_starred,
            'is_important': importance.is_important,
            'auto_important': importance.auto_important,
            'importance_reason': importance.importance_reason
        }

    async def bulk_get_flags(
        self,
        db: AsyncSession,
        user_id: str,
        message_ids: List[str]
    ) -> Dict[str, Dict]:
        """Get importance flags for multiple emails."""
        result = await db.execute(
            select(EmailImportance).where(
                and_(
                    EmailImportance.user_id == user_id,
                    EmailImportance.message_id.in_(message_ids)
                )
            )
        )

        flags = {}
        for imp in result.scalars().all():
            flags[imp.message_id] = {
                'is_starred': imp.is_starred,
                'is_important': imp.is_important,
                'auto_important': imp.auto_important,
                'importance_reason': imp.importance_reason
            }

        # Fill in missing entries
        for msg_id in message_ids:
            if msg_id not in flags:
                flags[msg_id] = {
                    'is_starred': False,
                    'is_important': False,
                    'auto_important': False,
                    'importance_reason': None
                }

        return flags

    async def get_counts(
        self,
        db: AsyncSession,
        user_id: str
    ) -> Dict[str, int]:
        """Get counts of starred and important emails."""
        starred_result = await db.execute(
            select(func.count(EmailImportance.id)).where(
                and_(
                    EmailImportance.user_id == user_id,
                    EmailImportance.is_starred == True
                )
            )
        )

        important_result = await db.execute(
            select(func.count(EmailImportance.id)).where(
                and_(
                    EmailImportance.user_id == user_id,
                    EmailImportance.is_important == True
                )
            )
        )

        return {
            'starred': starred_result.scalar() or 0,
            'important': important_result.scalar() or 0
        }


# Singleton instance
mail_importance_service = MailImportanceService()
