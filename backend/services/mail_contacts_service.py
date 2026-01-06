"""
Bheem Workspace - Mail Contacts Service
Auto-collect and manage email contacts for autocomplete
"""
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from sqlalchemy import select, update, delete, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert
from models.mail_models import MailContact
from core.logging import get_logger

logger = get_logger("bheem.mail.contacts")


class MailContactsService:
    """
    Service for managing email contacts.

    Features:
    - Auto-collect contacts from sent emails
    - Contact autocomplete with frequency-based ranking
    - Favorite contacts
    - Manual contact management
    """

    async def add_or_update_contact(
        self,
        db: AsyncSession,
        user_id: UUID,
        email: str,
        name: Optional[str] = None,
        source: str = 'auto'
    ) -> MailContact:
        """
        Add a new contact or update existing one.

        If contact exists, increments frequency and updates last_contacted.

        Args:
            db: Database session
            user_id: Owner's user ID
            email: Contact email address
            name: Contact display name
            source: 'auto', 'manual', or 'import'

        Returns:
            Created or updated MailContact
        """
        email = email.lower().strip()

        # Check if contact exists
        result = await db.execute(
            select(MailContact)
            .where(MailContact.user_id == user_id, MailContact.email == email)
        )
        contact = result.scalar_one_or_none()

        if contact:
            # Update existing contact
            contact.frequency += 1
            contact.last_contacted = datetime.utcnow()
            if name and not contact.name:
                contact.name = name
            contact.updated_at = datetime.utcnow()
        else:
            # Create new contact
            contact = MailContact(
                user_id=user_id,
                email=email,
                name=name,
                source=source,
                frequency=1,
                last_contacted=datetime.utcnow()
            )
            db.add(contact)

        await db.commit()
        await db.refresh(contact)

        logger.debug(
            f"Added/updated contact {email}",
            action="contact_updated",
            user_id=str(user_id),
            email=email
        )

        return contact

    async def add_contacts_from_email(
        self,
        db: AsyncSession,
        user_id: UUID,
        to_addresses: List[Dict[str, str]],
        cc_addresses: Optional[List[Dict[str, str]]] = None
    ):
        """
        Auto-collect contacts from a sent email.

        Args:
            db: Database session
            user_id: Sender's user ID
            to_addresses: List of {email, name} dicts
            cc_addresses: Optional list of {email, name} dicts
        """
        all_addresses = to_addresses or []
        if cc_addresses:
            all_addresses.extend(cc_addresses)

        for addr in all_addresses:
            email = addr.get('email', '')
            name = addr.get('name', '')
            if email:
                await self.add_or_update_contact(
                    db=db,
                    user_id=user_id,
                    email=email,
                    name=name,
                    source='auto'
                )

    async def search_contacts(
        self,
        db: AsyncSession,
        user_id: UUID,
        query: str,
        limit: int = 10
    ) -> List[MailContact]:
        """
        Search contacts for autocomplete.

        Searches email and name fields, returns results ordered by:
        1. Favorites first
        2. Then by frequency (most contacted first)

        Args:
            db: Database session
            user_id: Owner's user ID
            query: Search query
            limit: Maximum results

        Returns:
            List of matching contacts
        """
        query = query.lower().strip()

        if not query:
            # Return top contacts by frequency
            result = await db.execute(
                select(MailContact)
                .where(MailContact.user_id == user_id)
                .order_by(
                    MailContact.is_favorite.desc(),
                    MailContact.frequency.desc()
                )
                .limit(limit)
            )
            return result.scalars().all()

        # Search by email or name
        result = await db.execute(
            select(MailContact)
            .where(
                MailContact.user_id == user_id,
                or_(
                    MailContact.email.ilike(f'%{query}%'),
                    MailContact.name.ilike(f'%{query}%')
                )
            )
            .order_by(
                MailContact.is_favorite.desc(),
                MailContact.frequency.desc()
            )
            .limit(limit)
        )
        return result.scalars().all()

    async def get_contact(
        self,
        db: AsyncSession,
        contact_id: UUID,
        user_id: UUID
    ) -> Optional[MailContact]:
        """Get a single contact by ID."""
        result = await db.execute(
            select(MailContact)
            .where(MailContact.id == contact_id, MailContact.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def list_contacts(
        self,
        db: AsyncSession,
        user_id: UUID,
        favorites_only: bool = False,
        limit: int = 100,
        offset: int = 0
    ) -> List[MailContact]:
        """
        List all contacts for a user.

        Args:
            db: Database session
            user_id: Owner's user ID
            favorites_only: Only return favorite contacts
            limit: Maximum results
            offset: Pagination offset

        Returns:
            List of contacts
        """
        query = select(MailContact).where(MailContact.user_id == user_id)

        if favorites_only:
            query = query.where(MailContact.is_favorite == True)

        query = query.order_by(
            MailContact.is_favorite.desc(),
            MailContact.frequency.desc(),
            MailContact.name
        ).offset(offset).limit(limit)

        result = await db.execute(query)
        return result.scalars().all()

    async def get_contacts_count(
        self,
        db: AsyncSession,
        user_id: UUID
    ) -> int:
        """Get total contact count for a user."""
        result = await db.execute(
            select(func.count(MailContact.id))
            .where(MailContact.user_id == user_id)
        )
        return result.scalar() or 0

    async def create_contact(
        self,
        db: AsyncSession,
        user_id: UUID,
        email: str,
        name: Optional[str] = None,
        is_favorite: bool = False
    ) -> MailContact:
        """
        Manually create a contact.

        Args:
            db: Database session
            user_id: Owner's user ID
            email: Contact email
            name: Contact name
            is_favorite: Mark as favorite

        Returns:
            Created MailContact
        """
        email = email.lower().strip()

        # Check if exists
        result = await db.execute(
            select(MailContact)
            .where(MailContact.user_id == user_id, MailContact.email == email)
        )
        existing = result.scalar_one_or_none()

        if existing:
            raise ValueError(f"Contact with email {email} already exists")

        contact = MailContact(
            user_id=user_id,
            email=email,
            name=name,
            is_favorite=is_favorite,
            source='manual',
            frequency=0
        )

        db.add(contact)
        await db.commit()
        await db.refresh(contact)

        logger.info(
            f"Created contact {email}",
            action="contact_created",
            user_id=str(user_id)
        )

        return contact

    async def update_contact(
        self,
        db: AsyncSession,
        contact_id: UUID,
        user_id: UUID,
        updates: Dict[str, Any]
    ) -> Optional[MailContact]:
        """
        Update a contact.

        Args:
            db: Database session
            contact_id: Contact UUID
            user_id: Owner's user ID
            updates: Dict of fields to update

        Returns:
            Updated MailContact or None
        """
        contact = await self.get_contact(db, contact_id, user_id)
        if not contact:
            return None

        allowed_fields = ['name', 'is_favorite']
        for field, value in updates.items():
            if field in allowed_fields and value is not None:
                setattr(contact, field, value)

        contact.updated_at = datetime.utcnow()

        await db.commit()
        await db.refresh(contact)

        return contact

    async def toggle_favorite(
        self,
        db: AsyncSession,
        contact_id: UUID,
        user_id: UUID,
        is_favorite: bool
    ) -> Optional[MailContact]:
        """Toggle favorite status of a contact."""
        return await self.update_contact(
            db=db,
            contact_id=contact_id,
            user_id=user_id,
            updates={'is_favorite': is_favorite}
        )

    async def delete_contact(
        self,
        db: AsyncSession,
        contact_id: UUID,
        user_id: UUID
    ) -> bool:
        """Delete a contact."""
        result = await db.execute(
            delete(MailContact)
            .where(MailContact.id == contact_id, MailContact.user_id == user_id)
        )
        await db.commit()
        return result.rowcount > 0

    async def delete_all_contacts(
        self,
        db: AsyncSession,
        user_id: UUID,
        source: Optional[str] = None
    ) -> int:
        """
        Delete all contacts for a user.

        Args:
            db: Database session
            user_id: Owner's user ID
            source: Optional filter by source ('auto', 'manual', 'import')

        Returns:
            Number of contacts deleted
        """
        query = delete(MailContact).where(MailContact.user_id == user_id)

        if source:
            query = query.where(MailContact.source == source)

        result = await db.execute(query)
        await db.commit()

        return result.rowcount

    async def import_contacts(
        self,
        db: AsyncSession,
        user_id: UUID,
        contacts: List[Dict[str, str]]
    ) -> Dict[str, int]:
        """
        Bulk import contacts.

        Args:
            db: Database session
            user_id: Owner's user ID
            contacts: List of {email, name} dicts

        Returns:
            Dict with imported/skipped counts
        """
        imported = 0
        skipped = 0

        for contact_data in contacts:
            email = contact_data.get('email', '').lower().strip()
            name = contact_data.get('name', '')

            if not email:
                skipped += 1
                continue

            try:
                await self.add_or_update_contact(
                    db=db,
                    user_id=user_id,
                    email=email,
                    name=name,
                    source='import'
                )
                imported += 1
            except Exception:
                skipped += 1

        logger.info(
            f"Imported {imported} contacts, skipped {skipped}",
            action="contacts_imported",
            user_id=str(user_id)
        )

        return {'imported': imported, 'skipped': skipped}

    def contact_to_dict(self, contact: MailContact) -> Dict[str, Any]:
        """Convert contact model to dictionary."""
        return {
            "id": str(contact.id),
            "email": contact.email,
            "name": contact.name,
            "frequency": contact.frequency,
            "is_favorite": contact.is_favorite,
            "source": contact.source,
            "last_contacted": contact.last_contacted.isoformat() if contact.last_contacted else None,
            "created_at": contact.created_at.isoformat() if contact.created_at else None,
        }


# Singleton instance
mail_contacts_service = MailContactsService()
