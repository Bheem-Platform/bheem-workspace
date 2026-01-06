"""
Bheem Workspace - Mail Templates Service
Manage reusable email templates
"""
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from models.mail_models import MailTemplate
from core.logging import get_logger

logger = get_logger("bheem.mail.templates")


class MailTemplatesService:
    """
    Service for managing email templates.

    Features:
    - Create reusable email templates
    - Organize templates by category
    - Use templates in compose
    """

    async def create_template(
        self,
        db: AsyncSession,
        user_id: UUID,
        name: str,
        subject: str = "",
        body: str = "",
        is_html: bool = True,
        description: Optional[str] = None,
        to_addresses: Optional[List[Dict[str, str]]] = None,
        cc_addresses: Optional[List[Dict[str, str]]] = None,
        category: str = "general"
    ) -> MailTemplate:
        """
        Create a new email template.

        Args:
            db: Database session
            user_id: Owner's user ID
            name: Template name
            subject: Email subject
            body: Email body
            is_html: Whether body is HTML
            description: Template description
            to_addresses: Default recipients
            cc_addresses: Default CC recipients
            category: Template category

        Returns:
            Created MailTemplate
        """
        # Check for duplicate name
        result = await db.execute(
            select(MailTemplate)
            .where(MailTemplate.user_id == user_id, MailTemplate.name == name)
        )
        if result.scalar_one_or_none():
            raise ValueError(f"Template '{name}' already exists")

        template = MailTemplate(
            user_id=user_id,
            name=name,
            description=description,
            subject=subject,
            body=body,
            is_html=is_html,
            to_addresses=to_addresses or [],
            cc_addresses=cc_addresses or [],
            category=category
        )

        db.add(template)
        await db.commit()
        await db.refresh(template)

        logger.info(
            f"Created template {template.id}",
            action="template_created",
            template_id=str(template.id),
            user_id=str(user_id)
        )

        return template

    async def get_template(
        self,
        db: AsyncSession,
        template_id: UUID,
        user_id: UUID
    ) -> Optional[MailTemplate]:
        """Get a single template by ID."""
        result = await db.execute(
            select(MailTemplate)
            .where(MailTemplate.id == template_id, MailTemplate.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def list_templates(
        self,
        db: AsyncSession,
        user_id: UUID,
        category: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[MailTemplate]:
        """
        List templates for a user.

        Args:
            db: Database session
            user_id: Owner's user ID
            category: Filter by category
            search: Search in name/description
            limit: Maximum results
            offset: Pagination offset

        Returns:
            List of templates
        """
        query = select(MailTemplate).where(MailTemplate.user_id == user_id)

        if category:
            query = query.where(MailTemplate.category == category)

        if search:
            search_term = f"%{search}%"
            query = query.where(
                (MailTemplate.name.ilike(search_term)) |
                (MailTemplate.description.ilike(search_term))
            )

        query = query.order_by(MailTemplate.name).offset(offset).limit(limit)

        result = await db.execute(query)
        return result.scalars().all()

    async def get_templates_count(
        self,
        db: AsyncSession,
        user_id: UUID
    ) -> int:
        """Get total template count for a user."""
        result = await db.execute(
            select(func.count(MailTemplate.id))
            .where(MailTemplate.user_id == user_id)
        )
        return result.scalar() or 0

    async def get_categories(
        self,
        db: AsyncSession,
        user_id: UUID
    ) -> List[str]:
        """Get list of unique categories used by user."""
        result = await db.execute(
            select(MailTemplate.category)
            .where(MailTemplate.user_id == user_id)
            .distinct()
        )
        return [r[0] for r in result.all() if r[0]]

    async def update_template(
        self,
        db: AsyncSession,
        template_id: UUID,
        user_id: UUID,
        updates: Dict[str, Any]
    ) -> Optional[MailTemplate]:
        """Update a template."""
        template = await self.get_template(db, template_id, user_id)
        if not template:
            return None

        # Check for duplicate name if updating name
        if 'name' in updates and updates['name'] != template.name:
            result = await db.execute(
                select(MailTemplate)
                .where(
                    MailTemplate.user_id == user_id,
                    MailTemplate.name == updates['name']
                )
            )
            if result.scalar_one_or_none():
                raise ValueError(f"Template '{updates['name']}' already exists")

        allowed_fields = [
            'name', 'description', 'subject', 'body', 'is_html',
            'to_addresses', 'cc_addresses', 'category'
        ]
        for field, value in updates.items():
            if field in allowed_fields and value is not None:
                setattr(template, field, value)

        template.updated_at = datetime.utcnow()

        await db.commit()
        await db.refresh(template)

        return template

    async def delete_template(
        self,
        db: AsyncSession,
        template_id: UUID,
        user_id: UUID
    ) -> bool:
        """Delete a template."""
        result = await db.execute(
            delete(MailTemplate)
            .where(MailTemplate.id == template_id, MailTemplate.user_id == user_id)
        )
        await db.commit()
        return result.rowcount > 0

    async def duplicate_template(
        self,
        db: AsyncSession,
        template_id: UUID,
        user_id: UUID,
        new_name: Optional[str] = None
    ) -> Optional[MailTemplate]:
        """
        Duplicate an existing template.

        Args:
            db: Database session
            template_id: Template to duplicate
            user_id: Owner's user ID
            new_name: Name for the copy (default: "Copy of {original}")

        Returns:
            New template or None if original not found
        """
        original = await self.get_template(db, template_id, user_id)
        if not original:
            return None

        if not new_name:
            new_name = f"Copy of {original.name}"

        # Ensure unique name
        base_name = new_name
        counter = 1
        while True:
            result = await db.execute(
                select(MailTemplate)
                .where(MailTemplate.user_id == user_id, MailTemplate.name == new_name)
            )
            if not result.scalar_one_or_none():
                break
            counter += 1
            new_name = f"{base_name} ({counter})"

        return await self.create_template(
            db=db,
            user_id=user_id,
            name=new_name,
            subject=original.subject,
            body=original.body,
            is_html=original.is_html,
            description=original.description,
            to_addresses=original.to_addresses,
            cc_addresses=original.cc_addresses,
            category=original.category
        )

    def template_to_dict(self, template: MailTemplate) -> Dict[str, Any]:
        """Convert template model to dictionary."""
        return {
            "id": str(template.id),
            "name": template.name,
            "description": template.description,
            "subject": template.subject,
            "body": template.body,
            "is_html": template.is_html,
            "to_addresses": template.to_addresses,
            "cc_addresses": template.cc_addresses,
            "category": template.category,
            "created_at": template.created_at.isoformat() if template.created_at else None,
            "updated_at": template.updated_at.isoformat() if template.updated_at else None,
        }


# Singleton instance
mail_templates_service = MailTemplatesService()
