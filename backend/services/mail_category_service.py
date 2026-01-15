"""
Bheem Workspace - Mail Category Service
Gmail-like email categorization: Primary, Social, Updates, Promotions, Forums
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, delete, update
from sqlalchemy.dialects.postgresql import insert
from typing import List, Dict, Optional, Tuple
from datetime import datetime
import re
import logging

from models.mail_models import EmailCategory, EmailCategoryRule

logger = logging.getLogger(__name__)

# Known domain patterns for categorization
SOCIAL_DOMAINS = {
    'facebook.com', 'facebookmail.com', 'twitter.com', 'x.com', 'linkedin.com',
    'instagram.com', 'pinterest.com', 'tiktok.com', 'snapchat.com', 'reddit.com',
    'tumblr.com', 'whatsapp.com', 'telegram.org', 'discord.com', 'slack.com',
    'messenger.com', 'fb.com', 'meta.com'
}

UPDATES_DOMAINS = {
    'github.com', 'gitlab.com', 'bitbucket.org', 'atlassian.com', 'jira.atlassian.com',
    'trello.com', 'asana.com', 'notion.so', 'figma.com', 'vercel.com', 'netlify.com',
    'aws.amazon.com', 'cloud.google.com', 'azure.microsoft.com', 'heroku.com',
    'digitalocean.com', 'stripe.com', 'paypal.com', 'google.com', 'apple.com',
    'microsoft.com', 'dropbox.com', 'zoom.us', 'calendly.com'
}

PROMOTIONS_KEYWORDS = [
    'sale', 'offer', 'discount', 'promo', 'deal', '% off', 'limited time',
    'exclusive', 'newsletter', 'subscribe', 'unsubscribe', 'marketing',
    'special offer', 'free shipping', 'buy now', 'shop now', 'save'
]


class MailCategoryService:
    """Service for Gmail-like email categorization."""

    async def categorize_email(
        self,
        db: AsyncSession,
        user_id: str,
        message_id: str,
        email_data: Dict
    ) -> str:
        """
        Categorize an email based on sender, headers, and content.
        Returns: 'primary', 'social', 'updates', 'promotions', or 'forums'
        """
        from_addr = email_data.get('from', '').lower()
        subject = email_data.get('subject', '').lower()
        headers = email_data.get('headers', {})

        # Extract domain from sender
        domain = self._extract_domain(from_addr)

        # Determine category
        category, confidence, reason = self._determine_category(
            from_addr, domain, subject, headers
        )

        # Store categorization
        await self.set_category(
            db, user_id, message_id, category,
            auto_categorized=True,
            categorized_by=reason,
            confidence=confidence
        )

        return category

    def _extract_domain(self, email: str) -> str:
        """Extract domain from email address."""
        match = re.search(r'@([\w.-]+)', email)
        return match.group(1).lower() if match else ''

    def _determine_category(
        self,
        from_addr: str,
        domain: str,
        subject: str,
        headers: Dict
    ) -> Tuple[str, int, str]:
        """
        Determine email category based on various signals.
        Returns: (category, confidence, reason)
        """
        # Check for social networks
        for social_domain in SOCIAL_DOMAINS:
            if social_domain in domain:
                return ('social', 95, 'domain_match')

        # Check for updates/notifications
        for update_domain in UPDATES_DOMAINS:
            if update_domain in domain:
                return ('updates', 90, 'domain_match')

        # Check for mailing list headers (forums)
        if headers.get('list-id') or headers.get('list-unsubscribe'):
            # Check if it looks promotional
            if any(kw in subject for kw in PROMOTIONS_KEYWORDS):
                return ('promotions', 85, 'header_and_keyword')
            return ('forums', 80, 'list_header')

        # Check for promotional keywords in subject
        promo_score = sum(1 for kw in PROMOTIONS_KEYWORDS if kw in subject)
        if promo_score >= 2:
            return ('promotions', 70 + promo_score * 5, 'keyword_match')

        # Check for noreply addresses (usually updates)
        if 'noreply' in from_addr or 'no-reply' in from_addr:
            return ('updates', 75, 'noreply_sender')

        # Default to primary
        return ('primary', 100, 'default')

    async def set_category(
        self,
        db: AsyncSession,
        user_id: str,
        message_id: str,
        category: str,
        auto_categorized: bool = False,
        categorized_by: str = 'user',
        confidence: int = 100
    ) -> EmailCategory:
        """Set or update email category."""
        stmt = insert(EmailCategory).values(
            user_id=user_id,
            message_id=message_id,
            category=category,
            auto_categorized=auto_categorized,
            categorized_by=categorized_by,
            confidence=confidence,
            updated_at=datetime.utcnow()
        ).on_conflict_do_update(
            index_elements=['user_id', 'message_id'],
            set_={
                'category': category,
                'auto_categorized': auto_categorized,
                'categorized_by': categorized_by,
                'confidence': confidence,
                'updated_at': datetime.utcnow()
            }
        )
        await db.execute(stmt)
        await db.commit()

        # Fetch and return the record
        result = await db.execute(
            select(EmailCategory).where(
                and_(
                    EmailCategory.user_id == user_id,
                    EmailCategory.message_id == message_id
                )
            )
        )
        return result.scalar_one_or_none()

    async def get_category(
        self,
        db: AsyncSession,
        user_id: str,
        message_id: str
    ) -> Optional[str]:
        """Get category for a specific email."""
        result = await db.execute(
            select(EmailCategory.category).where(
                and_(
                    EmailCategory.user_id == user_id,
                    EmailCategory.message_id == message_id
                )
            )
        )
        row = result.scalar_one_or_none()
        return row if row else 'primary'

    async def get_emails_by_category(
        self,
        db: AsyncSession,
        user_id: str,
        category: str,
        limit: int = 50,
        offset: int = 0
    ) -> List[str]:
        """Get message IDs for a specific category."""
        result = await db.execute(
            select(EmailCategory.message_id).where(
                and_(
                    EmailCategory.user_id == user_id,
                    EmailCategory.category == category
                )
            ).order_by(EmailCategory.created_at.desc())
            .limit(limit).offset(offset)
        )
        return [row[0] for row in result.fetchall()]

    async def get_category_counts(
        self,
        db: AsyncSession,
        user_id: str
    ) -> Dict[str, int]:
        """Get count of emails per category."""
        from sqlalchemy import func

        result = await db.execute(
            select(
                EmailCategory.category,
                func.count(EmailCategory.id)
            ).where(EmailCategory.user_id == user_id)
            .group_by(EmailCategory.category)
        )

        counts = {row[0]: row[1] for row in result.fetchall()}
        # Ensure all categories are present
        for cat in ['primary', 'social', 'updates', 'promotions', 'forums']:
            if cat not in counts:
                counts[cat] = 0
        return counts

    async def bulk_categorize(
        self,
        db: AsyncSession,
        user_id: str,
        emails: List[Dict]
    ) -> Dict[str, List[str]]:
        """
        Categorize multiple emails at once.
        Returns dict of category -> list of message_ids
        """
        categorized = {
            'primary': [],
            'social': [],
            'updates': [],
            'promotions': [],
            'forums': []
        }

        for email in emails:
            message_id = email.get('id') or email.get('message_id')
            if not message_id:
                continue

            category = await self.categorize_email(db, user_id, message_id, email)
            categorized[category].append(message_id)

        return categorized

    # ========================
    # Category Rules Management
    # ========================

    async def get_user_rules(
        self,
        db: AsyncSession,
        user_id: str,
        include_system: bool = True
    ) -> List[EmailCategoryRule]:
        """Get categorization rules for a user."""
        conditions = [EmailCategoryRule.user_id == user_id]
        if include_system:
            conditions = [
                or_(
                    EmailCategoryRule.user_id == user_id,
                    EmailCategoryRule.is_system == True
                )
            ]

        result = await db.execute(
            select(EmailCategoryRule).where(
                and_(*conditions)
            ).order_by(EmailCategoryRule.priority)
        )
        return result.scalars().all()

    async def create_rule(
        self,
        db: AsyncSession,
        user_id: str,
        name: str,
        category: str,
        conditions: Dict,
        priority: int = 0
    ) -> EmailCategoryRule:
        """Create a new categorization rule."""
        rule = EmailCategoryRule(
            user_id=user_id,
            name=name,
            category=category,
            conditions=conditions,
            priority=priority,
            is_system=False
        )
        db.add(rule)
        await db.commit()
        await db.refresh(rule)
        return rule

    async def update_rule(
        self,
        db: AsyncSession,
        rule_id: str,
        user_id: str,
        updates: Dict
    ) -> Optional[EmailCategoryRule]:
        """Update a categorization rule."""
        result = await db.execute(
            select(EmailCategoryRule).where(
                and_(
                    EmailCategoryRule.id == rule_id,
                    EmailCategoryRule.user_id == user_id,
                    EmailCategoryRule.is_system == False
                )
            )
        )
        rule = result.scalar_one_or_none()

        if not rule:
            return None

        for key, value in updates.items():
            if hasattr(rule, key) and key not in ['id', 'user_id', 'is_system']:
                setattr(rule, key, value)

        rule.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(rule)
        return rule

    async def delete_rule(
        self,
        db: AsyncSession,
        rule_id: str,
        user_id: str
    ) -> bool:
        """Delete a categorization rule."""
        result = await db.execute(
            delete(EmailCategoryRule).where(
                and_(
                    EmailCategoryRule.id == rule_id,
                    EmailCategoryRule.user_id == user_id,
                    EmailCategoryRule.is_system == False
                )
            )
        )
        await db.commit()
        return result.rowcount > 0


# Singleton instance
mail_category_service = MailCategoryService()
