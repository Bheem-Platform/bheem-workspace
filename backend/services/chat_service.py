"""
Bheem Workspace - Chat Service
Handles conversations, messages, calls, external contacts, and file attachments
Supports internal (Team tab) and external (Clients tab) communication

Key Features:
- Internal conversations (within same tenant)
- External conversations (with guests or cross-tenant users)
- Audio/video calls via LiveKit
- File attachments
- Read receipts and typing indicators
- Email invitations for external users
"""

from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID
from datetime import datetime, timedelta, timezone
import secrets
from sqlalchemy import select, and_, or_, func, desc, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.chat_models import (
    Conversation, ConversationParticipant, DirectMessage,
    MessageAttachment, CallLog, ExternalContact, ChatInvitation
)
from services.livekit_service import livekit_service
from core.config import settings


class ChatService:
    """
    Main service class for chat functionality.
    Handles all CRUD operations and business logic.
    """

    # ==========================================
    # CONVERSATION MANAGEMENT
    # ==========================================

    async def get_or_create_direct_conversation(
        self,
        db: AsyncSession,
        user1_id: UUID,
        user1_name: str,
        user1_email: str,
        user1_tenant_id: UUID,
        user2_id: UUID = None,
        user2_name: str = None,
        user2_email: str = None,
        user2_tenant_id: UUID = None,
        user2_participant_type: str = 'internal',
        external_contact_id: UUID = None,
    ) -> Conversation:
        """
        Get existing direct conversation or create new one.
        Supports internal, cross-tenant, and guest conversations.

        Args:
            user1_*: Current user info (always internal)
            user2_*: Other participant info
            user2_participant_type: 'internal', 'external_user', or 'guest'
            external_contact_id: Required for guest type

        Returns:
            Conversation object
        """
        # Determine conversation scope
        if user2_participant_type == 'guest':
            scope = 'external'
        elif user2_tenant_id and str(user2_tenant_id) != str(user1_tenant_id):
            scope = 'cross_tenant'
        else:
            scope = 'internal'

        # Find existing direct conversation
        existing = await self._find_direct_conversation(
            db=db,
            user1_id=user1_id,
            user2_id=user2_id,
            user2_participant_type=user2_participant_type,
            external_contact_id=external_contact_id
        )

        if existing:
            return existing

        # Create new conversation
        conversation = Conversation(
            type='direct',
            scope=scope,
            tenant_id=user1_tenant_id,
            created_by=user1_id,
            created_by_tenant_id=user1_tenant_id,
        )
        db.add(conversation)
        await db.flush()

        # Add first participant (current user - always internal)
        participant1 = ConversationParticipant(
            conversation_id=conversation.id,
            participant_type='internal',
            user_id=user1_id,
            tenant_id=user1_tenant_id,
            user_name=user1_name,
            user_email=user1_email,
            role='member',
        )
        db.add(participant1)

        # Add second participant based on type
        if user2_participant_type == 'guest':
            participant2 = ConversationParticipant(
                conversation_id=conversation.id,
                participant_type='guest',
                external_contact_id=external_contact_id,
                user_name=user2_name,
                user_email=user2_email,
                role='member',
                invited_by=user1_id,
            )
        elif user2_participant_type == 'external_user':
            participant2 = ConversationParticipant(
                conversation_id=conversation.id,
                participant_type='external_user',
                user_id=user2_id,
                tenant_id=user2_tenant_id,
                external_tenant_id=user2_tenant_id,
                user_name=user2_name,
                user_email=user2_email,
                role='member',
                invited_by=user1_id,
            )
        else:
            # Internal user from same tenant
            participant2 = ConversationParticipant(
                conversation_id=conversation.id,
                participant_type='internal',
                user_id=user2_id,
                tenant_id=user1_tenant_id,
                user_name=user2_name,
                user_email=user2_email,
                role='member',
            )

        db.add(participant2)
        await db.commit()

        # Reload with relationships
        return await self.get_conversation(db, conversation.id, user1_id)

    async def _find_direct_conversation(
        self,
        db: AsyncSession,
        user1_id: UUID,
        user2_id: UUID = None,
        user2_participant_type: str = 'internal',
        external_contact_id: UUID = None,
    ) -> Optional[Conversation]:
        """Find existing direct conversation between two participants."""

        # Build subquery to find conversations with both users
        if user2_participant_type == 'guest':
            # For guest, match by external_contact_id
            subquery = (
                select(ConversationParticipant.conversation_id)
                .where(
                    and_(
                        ConversationParticipant.left_at.is_(None),
                        or_(
                            ConversationParticipant.user_id == user1_id,
                            ConversationParticipant.external_contact_id == external_contact_id
                        )
                    )
                )
                .group_by(ConversationParticipant.conversation_id)
                .having(func.count(ConversationParticipant.id) == 2)
            )
        else:
            # For internal/external_user, match by user_id
            # We need to ensure BOTH users are in the conversation
            # First, find conversations that have user1
            user1_convs = (
                select(ConversationParticipant.conversation_id)
                .where(
                    and_(
                        ConversationParticipant.left_at.is_(None),
                        ConversationParticipant.user_id == user1_id
                    )
                )
            )
            # Then, find conversations that have user2
            user2_convs = (
                select(ConversationParticipant.conversation_id)
                .where(
                    and_(
                        ConversationParticipant.left_at.is_(None),
                        ConversationParticipant.user_id == user2_id
                    )
                )
            )
            # Subquery finds conversations that have BOTH users
            subquery = (
                select(ConversationParticipant.conversation_id)
                .where(
                    and_(
                        ConversationParticipant.conversation_id.in_(user1_convs),
                        ConversationParticipant.conversation_id.in_(user2_convs)
                    )
                )
                .distinct()
            )

        query = (
            select(Conversation)
            .options(selectinload(Conversation.participants))
            .where(
                and_(
                    Conversation.type == 'direct',
                    Conversation.id.in_(subquery)
                )
            )
        )

        result = await db.execute(query)
        return result.scalar_one_or_none()

    async def create_group_conversation(
        self,
        db: AsyncSession,
        creator_id: UUID,
        creator_name: str,
        creator_email: str,
        creator_tenant_id: UUID,
        name: str,
        participants: List[Dict[str, Any]],
        description: str = None,
    ) -> Conversation:
        """
        Create a new group conversation.
        Participants can be internal, external_user, or guest.

        Args:
            creator_*: Creator's info
            name: Group name
            participants: List of participant dicts with keys:
                - id, name, email (for internal/external_user)
                - type: 'internal', 'external_user', 'guest'
                - tenant_id (for external_user)
                - external_contact_id (for guest)
            description: Optional group description

        Returns:
            Conversation object
        """
        # Determine scope based on participants
        has_external = any(
            p.get('type') in ['external_user', 'guest']
            for p in participants
        )
        has_cross_tenant = any(
            p.get('type') == 'external_user' and
            p.get('tenant_id') and
            str(p.get('tenant_id')) != str(creator_tenant_id)
            for p in participants
        )

        if has_external:
            scope = 'external'
        elif has_cross_tenant:
            scope = 'cross_tenant'
        else:
            scope = 'internal'

        # Create conversation
        conversation = Conversation(
            type='group',
            scope=scope,
            name=name,
            description=description,
            tenant_id=creator_tenant_id,
            created_by=creator_id,
            created_by_tenant_id=creator_tenant_id,
            allow_external_files=True,
        )
        db.add(conversation)
        await db.flush()

        # Add creator as owner
        owner = ConversationParticipant(
            conversation_id=conversation.id,
            participant_type='internal',
            user_id=creator_id,
            tenant_id=creator_tenant_id,
            user_name=creator_name,
            user_email=creator_email,
            role='owner',
        )
        db.add(owner)

        # Add other participants
        for p in participants:
            p_type = p.get('type', 'internal')

            if p_type == 'guest':
                participant = ConversationParticipant(
                    conversation_id=conversation.id,
                    participant_type='guest',
                    external_contact_id=p.get('external_contact_id'),
                    user_name=p['name'],
                    user_email=p.get('email'),
                    company_name=p.get('company'),
                    role='member',
                    invited_by=creator_id,
                )
            elif p_type == 'external_user':
                participant = ConversationParticipant(
                    conversation_id=conversation.id,
                    participant_type='external_user',
                    user_id=UUID(p['id']) if isinstance(p['id'], str) else p['id'],
                    tenant_id=UUID(p['tenant_id']) if p.get('tenant_id') else None,
                    external_tenant_id=UUID(p['tenant_id']) if p.get('tenant_id') else None,
                    external_tenant_name=p.get('tenant_name'),
                    user_name=p['name'],
                    user_email=p.get('email'),
                    company_name=p.get('company'),
                    role='member',
                    invited_by=creator_id,
                )
            else:
                # Internal participant
                participant = ConversationParticipant(
                    conversation_id=conversation.id,
                    participant_type='internal',
                    user_id=UUID(p['id']) if isinstance(p['id'], str) else p['id'],
                    tenant_id=creator_tenant_id,
                    user_name=p['name'],
                    user_email=p.get('email'),
                    role='member',
                )
            db.add(participant)

        # Add system message
        system_msg = DirectMessage(
            conversation_id=conversation.id,
            sender_id=creator_id,
            sender_name='System',
            sender_tenant_id=creator_tenant_id,
            content=f'{creator_name} created the group "{name}"',
            message_type='system',
        )
        db.add(system_msg)

        await db.commit()

        # Reload with relationships
        return await self.get_conversation(db, conversation.id, creator_id)

    async def get_user_conversations(
        self,
        db: AsyncSession,
        user_id: UUID,
        tenant_id: UUID,
        scope: str = None,  # 'internal', 'external', or None for all
        unread_only: bool = False,
        conv_type: str = None,  # 'direct' or 'group'
        archived_only: bool = False,
        limit: int = 50,
        offset: int = 0,
        include_archived: bool = False,
    ) -> List[Conversation]:
        """
        Get all conversations for a user, optionally filtered by scope.

        Args:
            user_id: Current user ID
            tenant_id: Current user's tenant ID
            scope: Filter by scope ('internal' for Team tab, 'external' for Clients tab)
            unread_only: Only return conversations with unread messages
            conv_type: Filter by type ('direct' or 'group')
            archived_only: Only return archived conversations
            limit: Max results
            offset: Pagination offset
            include_archived: Include archived conversations

        Returns:
            List of Conversation objects with participants loaded
        """
        # Get conversation IDs where user is an active participant
        participant_conditions = [
            ConversationParticipant.user_id == user_id,
            ConversationParticipant.left_at.is_(None)
        ]

        # Add unread filter at participant level
        if unread_only:
            participant_conditions.append(ConversationParticipant.unread_count > 0)

        participant_subquery = (
            select(ConversationParticipant.conversation_id)
            .where(and_(*participant_conditions))
        )

        query = (
            select(Conversation)
            .options(selectinload(Conversation.participants))
            .where(Conversation.id.in_(participant_subquery))
        )

        # Handle archived filtering
        if archived_only:
            query = query.where(Conversation.is_archived == True)
        elif not include_archived:
            query = query.where(Conversation.is_archived == False)

        # Filter by scope
        if scope == 'internal':
            query = query.where(Conversation.scope == 'internal')
        elif scope == 'external':
            query = query.where(Conversation.scope.in_(['external', 'cross_tenant']))

        # Filter by conversation type
        if conv_type == 'direct':
            query = query.where(Conversation.type == 'direct')
        elif conv_type == 'group':
            query = query.where(Conversation.type == 'group')

        # Order by last message, newest first (nulls last)
        query = (
            query
            .order_by(Conversation.last_message_at.desc().nulls_last())
            .offset(offset)
            .limit(limit)
        )

        result = await db.execute(query)
        return list(result.scalars().all())

    async def get_conversation(
        self,
        db: AsyncSession,
        conversation_id: UUID,
        user_id: UUID,
    ) -> Optional[Conversation]:
        """
        Get a conversation if user is an active participant.

        Args:
            conversation_id: Conversation UUID
            user_id: User requesting access

        Returns:
            Conversation object or None if not found/not authorized
        """
        # First check if user is a participant
        participant_check = (
            select(ConversationParticipant.conversation_id)
            .where(
                and_(
                    ConversationParticipant.conversation_id == conversation_id,
                    ConversationParticipant.user_id == user_id,
                    ConversationParticipant.left_at.is_(None)
                )
            )
        )

        query = (
            select(Conversation)
            .options(selectinload(Conversation.participants))
            .where(
                and_(
                    Conversation.id == conversation_id,
                    Conversation.id.in_(participant_check)
                )
            )
        )

        result = await db.execute(query)
        return result.scalar_one_or_none()

    async def archive_conversation(
        self,
        db: AsyncSession,
        conversation_id: UUID,
        user_id: UUID,
    ) -> bool:
        """Archive a conversation for a user."""
        conversation = await self.get_conversation(db, conversation_id, user_id)
        if not conversation:
            return False

        conversation.is_archived = True
        await db.commit()
        return True

    async def update_conversation_avatar(
        self,
        db: AsyncSession,
        conversation_id: UUID,
        avatar_url: str,
    ) -> bool:
        """Update a conversation's avatar URL."""
        query = select(Conversation).where(Conversation.id == conversation_id)
        result = await db.execute(query)
        conversation = result.scalar_one_or_none()

        if not conversation:
            return False

        conversation.avatar_url = avatar_url
        await db.commit()
        return True

    async def update_conversation(
        self,
        db: AsyncSession,
        conversation_id: UUID,
        name: Optional[str] = None,
        description: Optional[str] = None,
    ) -> Optional[Conversation]:
        """Update a conversation's name and/or description."""
        query = (
            select(Conversation)
            .options(selectinload(Conversation.participants))
            .where(Conversation.id == conversation_id)
        )
        result = await db.execute(query)
        conversation = result.scalar_one_or_none()

        if not conversation:
            return None

        if name is not None:
            conversation.name = name
        if description is not None:
            conversation.description = description

        await db.commit()
        await db.refresh(conversation)
        return conversation

    async def add_group_members(
        self,
        db: AsyncSession,
        conversation_id: UUID,
        participants: List[Dict[str, Any]],
        added_by_id: UUID,
        added_by_name: str,
    ) -> int:
        """
        Add members to a group conversation.

        Returns:
            Number of members added
        """
        # Get existing participant user_ids
        existing_query = (
            select(ConversationParticipant.user_id)
            .where(
                and_(
                    ConversationParticipant.conversation_id == conversation_id,
                    ConversationParticipant.left_at.is_(None)
                )
            )
        )
        existing_result = await db.execute(existing_query)
        existing_ids = {str(row[0]) for row in existing_result.fetchall() if row[0]}

        added_count = 0

        for p in participants:
            # Skip if already a member
            if p['id'] in existing_ids:
                continue

            participant_type = p.get('type', 'internal')

            new_participant = ConversationParticipant(
                conversation_id=conversation_id,
                user_id=UUID(p['id']) if p['id'] and participant_type != 'guest' else None,
                participant_type=participant_type,
                user_name=p['name'],
                user_email=p.get('email'),
                tenant_id=UUID(p['tenant_id']) if p.get('tenant_id') else None,
                company_name=p.get('company') or p.get('tenant_name'),
                external_contact_id=UUID(p['external_contact_id']) if p.get('external_contact_id') else None,
                role='member',
                joined_at=datetime.utcnow(),
            )

            db.add(new_participant)
            added_count += 1

        if added_count > 0:
            await db.commit()

        return added_count

    async def unarchive_conversation(
        self,
        db: AsyncSession,
        conversation_id: UUID,
        user_id: UUID,
    ) -> bool:
        """Unarchive a conversation for a user."""
        # Need to get conversation even if archived
        participant_check = (
            select(ConversationParticipant.conversation_id)
            .where(
                and_(
                    ConversationParticipant.conversation_id == conversation_id,
                    ConversationParticipant.user_id == user_id,
                    ConversationParticipant.left_at.is_(None)
                )
            )
        )

        query = (
            select(Conversation)
            .where(
                and_(
                    Conversation.id == conversation_id,
                    Conversation.id.in_(participant_check)
                )
            )
        )

        result = await db.execute(query)
        conversation = result.scalar_one_or_none()

        if not conversation:
            return False

        conversation.is_archived = False
        await db.commit()
        return True

    async def set_conversation_muted(
        self,
        db: AsyncSession,
        conversation_id: UUID,
        user_id: UUID,
        muted: bool,
    ) -> bool:
        """Mute or unmute conversation notifications for a user."""
        query = (
            select(ConversationParticipant)
            .where(
                and_(
                    ConversationParticipant.conversation_id == conversation_id,
                    ConversationParticipant.user_id == user_id,
                    ConversationParticipant.left_at.is_(None)
                )
            )
        )

        result = await db.execute(query)
        participant = result.scalar_one_or_none()

        if not participant:
            return False

        participant.is_muted = muted
        await db.commit()
        return True

    async def set_conversation_pinned(
        self,
        db: AsyncSession,
        conversation_id: UUID,
        user_id: UUID,
        pinned: bool,
    ) -> bool:
        """Pin or unpin a conversation for a user."""
        query = (
            select(ConversationParticipant)
            .where(
                and_(
                    ConversationParticipant.conversation_id == conversation_id,
                    ConversationParticipant.user_id == user_id,
                    ConversationParticipant.left_at.is_(None)
                )
            )
        )

        result = await db.execute(query)
        participant = result.scalar_one_or_none()

        if not participant:
            return False

        participant.is_pinned = pinned
        await db.commit()
        return True

    async def remove_group_member(
        self,
        db: AsyncSession,
        conversation_id: UUID,
        admin_user_id: UUID,
        member_user_id: UUID,
    ) -> str:
        """
        Remove a member from a group conversation.
        Only admins/owners can remove members.

        Returns:
            'success' if removed
            'not_found' if conversation or member not found
            'not_authorized' if user is not admin/owner
            'cannot_remove_self' if trying to remove self
        """
        # Check if the admin is a participant with owner/admin role
        admin_query = (
            select(ConversationParticipant)
            .where(
                and_(
                    ConversationParticipant.conversation_id == conversation_id,
                    ConversationParticipant.user_id == admin_user_id,
                    ConversationParticipant.left_at.is_(None),
                    ConversationParticipant.role.in_(['owner', 'admin'])
                )
            )
        )
        admin_result = await db.execute(admin_query)
        admin_participant = admin_result.scalar_one_or_none()

        if not admin_participant:
            return "not_authorized"

        # Can't remove yourself
        if str(admin_user_id) == str(member_user_id):
            return "cannot_remove_self"

        # Find the member to remove
        member_query = (
            select(ConversationParticipant)
            .where(
                and_(
                    ConversationParticipant.conversation_id == conversation_id,
                    ConversationParticipant.user_id == member_user_id,
                    ConversationParticipant.left_at.is_(None)
                )
            )
        )
        member_result = await db.execute(member_query)
        member_participant = member_result.scalar_one_or_none()

        if not member_participant:
            return "not_found"

        # Remove member (soft delete)
        member_participant.left_at = datetime.utcnow()
        await db.commit()
        return "success"

    async def leave_conversation(
        self,
        db: AsyncSession,
        conversation_id: UUID,
        user_id: UUID,
    ) -> bool:
        """Leave a group conversation."""
        query = (
            select(ConversationParticipant)
            .where(
                and_(
                    ConversationParticipant.conversation_id == conversation_id,
                    ConversationParticipant.user_id == user_id,
                    ConversationParticipant.left_at.is_(None)
                )
            )
        )

        result = await db.execute(query)
        participant = result.scalar_one_or_none()

        if not participant:
            return False

        participant.left_at = datetime.utcnow()
        await db.commit()
        return True

    async def get_shared_files(
        self,
        db: AsyncSession,
        conversation_id: UUID,
        file_type: str = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        Get shared files in a conversation.

        Args:
            conversation_id: Conversation to get files from
            file_type: Filter by 'images', 'documents', or 'links'
            limit: Max results
            offset: Pagination offset

        Returns:
            Dict with images, documents, and links arrays
        """
        # Get messages with attachments
        query = (
            select(DirectMessage)
            .options(selectinload(DirectMessage.attachments))
            .where(
                and_(
                    DirectMessage.conversation_id == conversation_id,
                    DirectMessage.is_deleted == False
                )
            )
            .order_by(desc(DirectMessage.created_at))
        )

        result = await db.execute(query)
        messages = list(result.scalars().all())

        images = []
        documents = []
        links = []

        import re
        url_pattern = re.compile(r'https?://[^\s<>"]+')

        for msg in messages:
            # Collect attachments
            for att in msg.attachments:
                file_info = {
                    'id': str(att.id),
                    'file_name': att.file_name,
                    'file_type': att.file_type,
                    'file_size': att.file_size,
                    'file_url': att.file_url,
                    'thumbnail_url': att.thumbnail_url,
                    'width': att.width,
                    'height': att.height,
                    'sender_name': msg.sender_name,
                    'sent_at': msg.created_at.isoformat() if msg.created_at else None,
                }

                if att.file_type and att.file_type.startswith('image/'):
                    images.append(file_info)
                else:
                    documents.append(file_info)

            # Extract links from message content
            if msg.content:
                found_urls = url_pattern.findall(msg.content)
                for url in found_urls:
                    links.append({
                        'url': url,
                        'sender_name': msg.sender_name,
                        'sent_at': msg.created_at.isoformat() if msg.created_at else None,
                        'message_preview': msg.content[:100] if msg.content else None,
                    })

        # Apply type filter if specified
        if file_type == 'images':
            return {'images': images[offset:offset+limit], 'total': len(images)}
        elif file_type == 'documents':
            return {'documents': documents[offset:offset+limit], 'total': len(documents)}
        elif file_type == 'links':
            return {'links': links[offset:offset+limit], 'total': len(links)}

        # Return all with pagination applied to each category
        return {
            'images': images[:limit],
            'documents': documents[:limit],
            'links': links[:limit],
            'totals': {
                'images': len(images),
                'documents': len(documents),
                'links': len(links),
            }
        }

    async def get_conversation_stats(
        self,
        db: AsyncSession,
        conversation_id: UUID,
    ) -> Dict[str, Any]:
        """
        Get conversation statistics.

        Args:
            conversation_id: Conversation to get stats for

        Returns:
            Dict with message_count, media_count, link_count, started_at
        """
        # Get total message count
        msg_count_query = (
            select(func.count(DirectMessage.id))
            .where(
                and_(
                    DirectMessage.conversation_id == conversation_id,
                    DirectMessage.is_deleted == False,
                    DirectMessage.message_type != 'system'
                )
            )
        )
        msg_count_result = await db.execute(msg_count_query)
        message_count = msg_count_result.scalar() or 0

        # Get media count (images and files)
        media_count_query = (
            select(func.count(MessageAttachment.id))
            .join(DirectMessage, MessageAttachment.message_id == DirectMessage.id)
            .where(
                and_(
                    DirectMessage.conversation_id == conversation_id,
                    DirectMessage.is_deleted == False
                )
            )
        )
        media_count_result = await db.execute(media_count_query)
        media_count = media_count_result.scalar() or 0

        # Get conversation start date
        conversation = await db.get(Conversation, conversation_id)
        started_at = conversation.created_at.isoformat() if conversation and conversation.created_at else None

        # Count links in messages (approximate)
        import re
        url_pattern = re.compile(r'https?://[^\s<>"]+')

        link_query = (
            select(DirectMessage.content)
            .where(
                and_(
                    DirectMessage.conversation_id == conversation_id,
                    DirectMessage.is_deleted == False,
                    DirectMessage.content.isnot(None)
                )
            )
        )
        link_result = await db.execute(link_query)
        link_count = 0
        for (content,) in link_result:
            if content:
                link_count += len(url_pattern.findall(content))

        return {
            'message_count': message_count,
            'media_count': media_count,
            'link_count': link_count,
            'started_at': started_at,
        }

    # ==========================================
    # EXTERNAL CONTACTS
    # ==========================================

    async def create_external_contact(
        self,
        db: AsyncSession,
        owner_tenant_id: UUID,
        created_by: UUID,
        email: str,
        name: str,
        company_name: str = None,
        phone: str = None,
        job_title: str = None,
        notes: str = None,
        tags: List[str] = None,
    ) -> ExternalContact:
        """
        Create a new external contact.
        Each workspace maintains their own contact list.

        Args:
            owner_tenant_id: Tenant creating the contact
            created_by: User creating the contact
            email: Contact email (unique per tenant)
            name: Contact display name
            company_name: Optional company
            phone: Optional phone
            job_title: Optional job title
            notes: Optional internal notes
            tags: Optional tags like ['client', 'partner']

        Returns:
            ExternalContact object

        Raises:
            ValueError if contact with email already exists
        """
        # Check if contact already exists in this tenant
        existing = await db.execute(
            select(ExternalContact).where(
                and_(
                    ExternalContact.owner_tenant_id == owner_tenant_id,
                    ExternalContact.email == email.lower()
                )
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError("Contact with this email already exists")

        contact = ExternalContact(
            owner_tenant_id=owner_tenant_id,
            created_by=created_by,
            email=email.lower(),
            name=name,
            company_name=company_name,
            phone=phone,
            job_title=job_title,
            notes=notes,
            tags=tags or [],
        )
        db.add(contact)
        await db.commit()
        await db.refresh(contact)

        return contact

    async def get_external_contacts(
        self,
        db: AsyncSession,
        tenant_id: UUID,
        search: str = None,
        tags: List[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[ExternalContact]:
        """
        Get external contacts for a tenant.
        Only returns contacts owned by the specified tenant.

        Args:
            tenant_id: Owner tenant
            search: Search in name, email, company
            tags: Filter by tags
            limit: Max results
            offset: Pagination offset

        Returns:
            List of ExternalContact objects
        """
        query = (
            select(ExternalContact)
            .where(
                and_(
                    ExternalContact.owner_tenant_id == tenant_id,
                    ExternalContact.is_active == True,
                    ExternalContact.is_blocked == False
                )
            )
        )

        if search:
            search_filter = f"%{search}%"
            query = query.where(
                or_(
                    ExternalContact.name.ilike(search_filter),
                    ExternalContact.email.ilike(search_filter),
                    ExternalContact.company_name.ilike(search_filter)
                )
            )

        if tags:
            # Filter contacts that have any of the specified tags
            query = query.where(
                ExternalContact.tags.op('?|')(tags)
            )

        query = (
            query
            .order_by(ExternalContact.name)
            .offset(offset)
            .limit(limit)
        )

        result = await db.execute(query)
        return list(result.scalars().all())

    async def get_external_contact(
        self,
        db: AsyncSession,
        contact_id: UUID,
        tenant_id: UUID,
    ) -> Optional[ExternalContact]:
        """Get a specific external contact by ID."""
        query = (
            select(ExternalContact)
            .where(
                and_(
                    ExternalContact.id == contact_id,
                    ExternalContact.owner_tenant_id == tenant_id
                )
            )
        )
        result = await db.execute(query)
        return result.scalar_one_or_none()

    async def update_external_contact(
        self,
        db: AsyncSession,
        contact_id: UUID,
        tenant_id: UUID,
        **updates
    ) -> Optional[ExternalContact]:
        """Update an external contact."""
        contact = await self.get_external_contact(db, contact_id, tenant_id)
        if not contact:
            return None

        allowed_fields = ['name', 'phone', 'company_name', 'job_title', 'notes', 'tags']
        for field, value in updates.items():
            if field in allowed_fields and value is not None:
                setattr(contact, field, value)

        await db.commit()
        await db.refresh(contact)
        return contact

    async def link_external_contact_to_workspace(
        self,
        db: AsyncSession,
        contact_id: UUID,
        linked_user_id: UUID,
        linked_tenant_id: UUID,
    ) -> Optional[ExternalContact]:
        """
        Link an external contact to a workspace user account.
        Called when an invited contact accepts and has a Bheem workspace account.
        """
        contact = await db.get(ExternalContact, contact_id)
        if not contact:
            return None

        contact.linked_user_id = linked_user_id
        contact.linked_tenant_id = linked_tenant_id
        contact.linked_at = datetime.utcnow()
        contact.invitation_accepted_at = datetime.utcnow()

        await db.commit()
        await db.refresh(contact)
        return contact

    # ==========================================
    # INVITATIONS
    # ==========================================

    async def create_invitation(
        self,
        db: AsyncSession,
        conversation_id: UUID,
        inviter_id: UUID,
        inviter_name: str,
        inviter_tenant_id: UUID,
        inviter_tenant_name: str,
        invitee_email: str,
        invitee_name: str = None,
        message: str = None,
        expires_in_days: int = 7,
    ) -> ChatInvitation:
        """
        Create an invitation for an external user to join a conversation.

        Args:
            conversation_id: Conversation to invite to
            inviter_*: Inviter's info
            invitee_email: Email to send invitation to
            invitee_name: Optional name
            message: Optional personal message
            expires_in_days: Invitation validity period

        Returns:
            ChatInvitation object with token
        """
        token = secrets.token_urlsafe(32)

        invitation = ChatInvitation(
            conversation_id=conversation_id,
            inviter_id=inviter_id,
            inviter_name=inviter_name,
            inviter_tenant_id=inviter_tenant_id,
            inviter_tenant_name=inviter_tenant_name,
            invitee_email=invitee_email.lower(),
            invitee_name=invitee_name,
            token=token,
            message=message,
            expires_at=datetime.utcnow() + timedelta(days=expires_in_days),
        )
        db.add(invitation)
        await db.commit()
        await db.refresh(invitation)

        return invitation

    async def get_invitation_by_token(
        self,
        db: AsyncSession,
        token: str,
    ) -> Optional[ChatInvitation]:
        """Get a pending invitation by token."""
        query = (
            select(ChatInvitation)
            .where(
                and_(
                    ChatInvitation.token == token,
                    ChatInvitation.status == 'pending',
                    ChatInvitation.expires_at > datetime.utcnow()
                )
            )
        )
        result = await db.execute(query)
        return result.scalar_one_or_none()

    async def accept_invitation(
        self,
        db: AsyncSession,
        token: str,
        user_id: UUID = None,
        user_name: str = None,
        user_email: str = None,
        tenant_id: UUID = None,
    ) -> Optional[Conversation]:
        """
        Accept a chat invitation.

        Args:
            token: Invitation token
            user_id: Accepting user's ID (if they have workspace account)
            user_name: Display name
            user_email: Email
            tenant_id: User's tenant ID (if they have workspace account)

        Returns:
            Conversation object if successful, None if invalid token
        """
        invitation = await self.get_invitation_by_token(db, token)
        if not invitation:
            return None

        # Update invitation status
        invitation.status = 'accepted'
        invitation.responded_at = datetime.utcnow()

        # Determine participant type
        if tenant_id and str(tenant_id) != str(invitation.inviter_tenant_id):
            participant_type = 'external_user'
        elif tenant_id:
            participant_type = 'internal'
        else:
            participant_type = 'guest'

        # Add as participant
        participant = ConversationParticipant(
            conversation_id=invitation.conversation_id,
            participant_type=participant_type,
            user_id=user_id,
            tenant_id=tenant_id,
            external_tenant_id=tenant_id if participant_type == 'external_user' else None,
            user_name=user_name or invitation.invitee_name or invitation.invitee_email,
            user_email=user_email or invitation.invitee_email,
            role='member',
            invited_by=invitation.inviter_id,
        )
        db.add(participant)

        # Update conversation scope if needed
        conversation = await db.get(Conversation, invitation.conversation_id)
        if conversation and participant_type in ['external_user', 'guest']:
            if conversation.scope == 'internal':
                conversation.scope = 'external' if participant_type == 'guest' else 'cross_tenant'

        await db.commit()

        # Return conversation with participants
        return await self.get_conversation(db, invitation.conversation_id, user_id)

    async def decline_invitation(
        self,
        db: AsyncSession,
        token: str,
    ) -> bool:
        """Decline a chat invitation."""
        invitation = await self.get_invitation_by_token(db, token)
        if not invitation:
            return False

        invitation.status = 'declined'
        invitation.responded_at = datetime.utcnow()
        await db.commit()
        return True

    # ==========================================
    # MESSAGE MANAGEMENT
    # ==========================================

    async def send_message(
        self,
        db: AsyncSession,
        conversation_id: UUID,
        sender_id: UUID,
        sender_name: str,
        sender_avatar: str = None,
        sender_tenant_id: UUID = None,
        is_external_sender: bool = False,
        content: str = None,
        message_type: str = 'text',
        reply_to_id: UUID = None,
        attachments: List[Dict] = None,
        call_log_id: UUID = None,
    ) -> DirectMessage:
        """
        Send a message in a conversation.

        Args:
            conversation_id: Target conversation
            sender_*: Sender info
            is_external_sender: True if sender is external
            content: Message text
            message_type: 'text', 'image', 'file', 'system', 'call'
            reply_to_id: ID of message being replied to
            attachments: List of attachment dicts
            call_log_id: Reference to call log (for call messages)

        Returns:
            DirectMessage object with attachments
        """
        print(f"[ChatService.send_message] Starting - conversation_id: {conversation_id}")
        print(f"[ChatService.send_message] Attachments received: {attachments}")
        print(f"[ChatService.send_message] Attachments count: {len(attachments) if attachments else 0}")

        message = DirectMessage(
            conversation_id=conversation_id,
            sender_id=sender_id,
            sender_name=sender_name,
            sender_avatar=sender_avatar,
            sender_tenant_id=sender_tenant_id,
            is_external_sender=is_external_sender,
            content=content,
            message_type=message_type,
            reply_to_id=reply_to_id,
            call_log_id=call_log_id,
        )
        db.add(message)
        await db.flush()

        # Add attachments if any
        if attachments:
            print(f"[ChatService.send_message] Creating {len(attachments)} attachment(s) for message {message.id}")
            for i, att in enumerate(attachments):
                print(f"[ChatService.send_message] Creating attachment {i+1}: {att}")
                attachment = MessageAttachment(
                    message_id=message.id,
                    file_name=att['file_name'],
                    file_type=att.get('file_type'),
                    file_size=att.get('file_size'),
                    file_url=att['file_url'],
                    thumbnail_url=att.get('thumbnail_url'),
                    width=att.get('width'),
                    height=att.get('height'),
                )
                db.add(attachment)
                print(f"[ChatService.send_message] Attachment added to session: {attachment.file_name}")
        else:
            print(f"[ChatService.send_message] No attachments to process")

        print(f"[ChatService.send_message] Committing to database...")
        await db.commit()
        print(f"[ChatService.send_message] Committed successfully")

        # Reload with relationships - use explicit query to load attachments
        print(f"[ChatService.send_message] Reloading message with attachments...")
        result = await db.execute(
            select(DirectMessage)
            .options(selectinload(DirectMessage.attachments))
            .where(DirectMessage.id == message.id)
        )
        message = result.scalar_one()
        print(f"[ChatService.send_message] Message reloaded, attachments: {len(message.attachments) if message.attachments else 0}")
        if message.attachments:
            for att in message.attachments:
                print(f"[ChatService.send_message] Loaded attachment: {att.id} - {att.file_name}")
        return message

    async def get_messages(
        self,
        db: AsyncSession,
        conversation_id: UUID,
        limit: int = 50,
        before_id: UUID = None,
        after_id: UUID = None,
    ) -> List[DirectMessage]:
        """
        Get messages in a conversation with cursor-based pagination.

        Args:
            conversation_id: Conversation to get messages from
            limit: Max messages to return
            before_id: Get messages before this ID (for scrolling up)
            after_id: Get messages after this ID (for new messages)

        Returns:
            List of DirectMessage objects in chronological order
        """
        query = (
            select(DirectMessage)
            .options(
                selectinload(DirectMessage.attachments),
                selectinload(DirectMessage.call_log)
            )
            .where(DirectMessage.conversation_id == conversation_id)
        )

        if before_id:
            before_msg = await db.get(DirectMessage, before_id)
            if before_msg:
                query = query.where(DirectMessage.created_at < before_msg.created_at)

        if after_id:
            after_msg = await db.get(DirectMessage, after_id)
            if after_msg:
                query = query.where(DirectMessage.created_at > after_msg.created_at)

        # Get in reverse order for before_id, then reverse the list
        query = query.order_by(desc(DirectMessage.created_at)).limit(limit)

        result = await db.execute(query)
        messages = list(result.scalars().all())

        # Return in chronological order
        return list(reversed(messages))

    async def get_message(
        self,
        db: AsyncSession,
        message_id: UUID,
    ) -> Optional[DirectMessage]:
        """Get a specific message by ID."""
        query = (
            select(DirectMessage)
            .options(
                selectinload(DirectMessage.attachments),
                selectinload(DirectMessage.call_log)
            )
            .where(DirectMessage.id == message_id)
        )
        result = await db.execute(query)
        return result.scalar_one_or_none()

    async def edit_message(
        self,
        db: AsyncSession,
        message_id: UUID,
        user_id: UUID,
        new_content: str,
    ) -> Optional[DirectMessage]:
        """
        Edit a message (only by sender).

        Args:
            message_id: Message to edit
            user_id: User attempting to edit (must be sender)
            new_content: New message content

        Returns:
            Updated DirectMessage or None if not found/not authorized
        """
        message = await db.get(DirectMessage, message_id)
        if not message or str(message.sender_id) != str(user_id):
            return None

        message.content = new_content
        message.is_edited = True
        message.updated_at = datetime.utcnow()

        await db.commit()

        # Reload with relationships
        result = await db.execute(
            select(DirectMessage)
            .options(selectinload(DirectMessage.attachments))
            .where(DirectMessage.id == message_id)
        )
        message = result.scalar_one()
        return message

    async def delete_message(
        self,
        db: AsyncSession,
        message_id: UUID,
        user_id: UUID,
    ) -> bool:
        """
        Soft delete a message (only by sender).

        Args:
            message_id: Message to delete
            user_id: User attempting to delete (must be sender)

        Returns:
            True if deleted, False if not found/not authorized
        """
        message = await db.get(DirectMessage, message_id)
        if not message or str(message.sender_id) != str(user_id):
            return False

        message.is_deleted = True
        message.content = None
        message.updated_at = datetime.utcnow()

        await db.commit()
        return True

    async def add_reaction(
        self,
        db: AsyncSession,
        message_id: UUID,
        user_id: UUID,
        emoji: str,
    ) -> Dict:
        """
        Add or toggle a reaction on a message.

        Args:
            message_id: Message to react to
            user_id: User reacting
            emoji: Emoji to add/remove

        Returns:
            Updated reactions dict
        """
        message = await db.get(DirectMessage, message_id)
        if not message:
            return {}

        reactions = message.reactions or {}
        user_id_str = str(user_id)

        if emoji in reactions:
            if user_id_str in reactions[emoji]:
                # Remove reaction
                reactions[emoji].remove(user_id_str)
                if not reactions[emoji]:
                    del reactions[emoji]
            else:
                # Add to existing emoji
                reactions[emoji].append(user_id_str)
        else:
            # New emoji
            reactions[emoji] = [user_id_str]

        message.reactions = reactions
        await db.commit()

        return reactions

    async def forward_message(
        self,
        db: AsyncSession,
        message_id: UUID,
        target_conversation_ids: List[str],
        forwarder_id: UUID,
        forwarder_name: str,
        forwarder_avatar: str = None,
        forwarder_tenant_id: UUID = None,
    ) -> Dict[str, Any]:
        """
        Forward a message to one or more conversations.

        Args:
            message_id: ID of the message to forward
            target_conversation_ids: List of conversation IDs to forward to
            forwarder_*: Forwarder's info

        Returns:
            Dict with forwarded_to list and any errors
        """
        # Get the original message with attachments
        original_message = await self.get_message(db, message_id)
        if not original_message:
            return {"error": "Message not found", "forwarded_to": []}

        forwarded_to = []
        errors = []

        for conv_id_str in target_conversation_ids:
            try:
                conv_id = UUID(conv_id_str)

                # Verify forwarder has access to target conversation
                conversation = await self.get_conversation(db, conv_id, forwarder_id)
                if not conversation:
                    errors.append({"conversation_id": conv_id_str, "error": "Not authorized"})
                    continue

                # Build forwarded content
                content = original_message.content or ""

                # Add forwarded indicator
                forwarded_content = f"[Forwarded message]\n{content}" if content else "[Forwarded message]"

                # Copy attachments if any
                attachments = []
                if original_message.attachments:
                    for att in original_message.attachments:
                        attachments.append({
                            'file_name': att.file_name,
                            'file_type': att.file_type,
                            'file_size': att.file_size,
                            'file_url': att.file_url,
                            'thumbnail_url': att.thumbnail_url,
                            'width': att.width,
                            'height': att.height,
                        })

                # Determine message type
                message_type = 'text'
                if attachments:
                    if any(a.get('file_type', '').startswith('image/') for a in attachments):
                        message_type = 'image'
                    else:
                        message_type = 'file'

                # Send the forwarded message
                new_message = await self.send_message(
                    db=db,
                    conversation_id=conv_id,
                    sender_id=forwarder_id,
                    sender_name=forwarder_name,
                    sender_avatar=forwarder_avatar,
                    sender_tenant_id=forwarder_tenant_id,
                    content=forwarded_content,
                    message_type=message_type,
                    attachments=attachments if attachments else None,
                )

                forwarded_to.append({
                    "conversation_id": conv_id_str,
                    "message_id": str(new_message.id),
                })

            except Exception as e:
                errors.append({"conversation_id": conv_id_str, "error": str(e)})

        return {
            "forwarded_to": forwarded_to,
            "errors": errors if errors else None,
        }

    # ==========================================
    # READ RECEIPTS
    # ==========================================

    async def mark_as_read(
        self,
        db: AsyncSession,
        conversation_id: UUID,
        user_id: UUID,
        message_id: UUID = None,
    ) -> None:
        """
        Mark conversation as read up to a specific message.

        Args:
            conversation_id: Conversation to mark as read
            user_id: User marking as read
            message_id: Optional specific message (defaults to latest)
        """
        query = (
            select(ConversationParticipant)
            .where(
                and_(
                    ConversationParticipant.conversation_id == conversation_id,
                    ConversationParticipant.user_id == user_id,
                    ConversationParticipant.left_at.is_(None),
                )
            )
            .limit(1)
        )

        result = await db.execute(query)
        participant = result.scalar()

        if participant:
            participant.last_read_at = datetime.utcnow()
            participant.last_read_message_id = message_id
            participant.unread_count = 0
            await db.commit()

    async def get_unread_counts(
        self,
        db: AsyncSession,
        user_id: UUID,
    ) -> Tuple[int, Dict[str, int]]:
        """
        Get unread message counts for all conversations.

        Args:
            user_id: User to get counts for

        Returns:
            Tuple of (total_unread, {conversation_id: count})
        """
        query = (
            select(
                ConversationParticipant.conversation_id,
                ConversationParticipant.unread_count
            )
            .where(
                and_(
                    ConversationParticipant.user_id == user_id,
                    ConversationParticipant.unread_count > 0,
                    ConversationParticipant.left_at.is_(None)
                )
            )
        )

        result = await db.execute(query)
        rows = result.all()

        counts = {str(row.conversation_id): row.unread_count for row in rows}
        total = sum(counts.values())

        return total, counts

    # ==========================================
    # AUDIO/VIDEO CALLS
    # ==========================================

    async def initiate_call(
        self,
        db: AsyncSession,
        conversation_id: UUID,
        caller_id: UUID,
        caller_name: str,
        caller_tenant_id: UUID = None,
        call_type: str = 'audio',
    ) -> CallLog:
        """
        Initiate a new audio/video call.

        Args:
            conversation_id: Conversation to call in
            caller_*: Caller info
            call_type: 'audio' or 'video'

        Returns:
            CallLog object with room_name for LiveKit
        """
        room_name = livekit_service.generate_call_room_name(str(conversation_id))

        call_log = CallLog(
            conversation_id=conversation_id,
            call_type=call_type,
            room_name=room_name,
            caller_id=caller_id,
            caller_name=caller_name,
            caller_tenant_id=caller_tenant_id,
            status='ringing',
            participants_joined=[{
                'user_id': str(caller_id),
                'user_name': caller_name,
                'tenant_id': str(caller_tenant_id) if caller_tenant_id else None,
                'joined_at': datetime.utcnow().isoformat(),
            }],
        )
        db.add(call_log)
        await db.commit()
        await db.refresh(call_log)

        return call_log

    async def answer_call(
        self,
        db: AsyncSession,
        call_id: UUID,
        user_id: UUID,
        user_name: str,
        tenant_id: UUID = None,
    ) -> Optional[CallLog]:
        """
        Answer an incoming call.

        Args:
            call_id: Call to answer
            user_*: Answering user info

        Returns:
            Updated CallLog or None if call not found/not ringing
        """
        call_log = await db.get(CallLog, call_id)
        if not call_log or call_log.status != 'ringing':
            return None

        call_log.status = 'ongoing'
        call_log.answered_at = datetime.utcnow()

        # Add participant
        participants = call_log.participants_joined or []
        if not any(p['user_id'] == str(user_id) for p in participants):
            participants.append({
                'user_id': str(user_id),
                'user_name': user_name,
                'tenant_id': str(tenant_id) if tenant_id else None,
                'joined_at': datetime.utcnow().isoformat(),
            })
            call_log.participants_joined = participants

        await db.commit()
        await db.refresh(call_log)
        return call_log

    async def end_call(
        self,
        db: AsyncSession,
        call_id: UUID,
        user_id: UUID,
        end_reason: str = 'completed',
    ) -> Optional[CallLog]:
        """
        End an ongoing call.

        Args:
            call_id: Call to end
            user_id: User ending the call
            end_reason: Reason for ending

        Returns:
            Updated CallLog with call message created
        """
        call_log = await db.get(CallLog, call_id)
        if not call_log:
            return None

        call_log.status = 'ended'
        call_log.ended_at = datetime.utcnow()
        call_log.end_reason = end_reason

        # Calculate duration
        if call_log.answered_at:
            # Both are timezone-naive UTC
            answered = call_log.answered_at
            if answered.tzinfo is not None:
                answered = answered.replace(tzinfo=None)
            duration = (call_log.ended_at - answered).total_seconds()
            call_log.duration_seconds = int(duration)

        await db.commit()
        await db.refresh(call_log)

        # Create call message
        status_text = self._get_call_status_text(call_log)
        await self.send_message(
            db=db,
            conversation_id=call_log.conversation_id,
            sender_id=call_log.caller_id,
            sender_name=call_log.caller_name,
            sender_tenant_id=call_log.caller_tenant_id,
            content=status_text,
            message_type='call',
            call_log_id=call_log.id,
        )

        return call_log

    async def decline_call(
        self,
        db: AsyncSession,
        call_id: UUID,
        user_id: UUID,
    ) -> Optional[CallLog]:
        """Decline an incoming call."""
        call_log = await db.get(CallLog, call_id)
        if not call_log or call_log.status != 'ringing':
            return None

        call_log.status = 'ended'
        call_log.ended_at = datetime.utcnow()
        call_log.end_reason = 'declined'

        await db.commit()
        await db.refresh(call_log)

        # Create declined call message
        await self.send_message(
            db=db,
            conversation_id=call_log.conversation_id,
            sender_id=call_log.caller_id,
            sender_name=call_log.caller_name,
            sender_tenant_id=call_log.caller_tenant_id,
            content='Call declined',
            message_type='call',
            call_log_id=call_log.id,
        )

        return call_log

    async def miss_call(
        self,
        db: AsyncSession,
        call_id: UUID,
    ) -> Optional[CallLog]:
        """Mark a call as missed (no answer timeout)."""
        call_log = await db.get(CallLog, call_id)
        if not call_log or call_log.status != 'ringing':
            return None

        call_log.status = 'ended'
        call_log.ended_at = datetime.utcnow()
        call_log.end_reason = 'missed'

        await db.commit()
        await db.refresh(call_log)

        # Create missed call message
        await self.send_message(
            db=db,
            conversation_id=call_log.conversation_id,
            sender_id=call_log.caller_id,
            sender_name=call_log.caller_name,
            sender_tenant_id=call_log.caller_tenant_id,
            content='Missed call',
            message_type='call',
            call_log_id=call_log.id,
        )

        return call_log

    async def get_call(
        self,
        db: AsyncSession,
        call_id: UUID,
    ) -> Optional[CallLog]:
        """Get call by ID."""
        return await db.get(CallLog, call_id)

    async def get_active_call(
        self,
        db: AsyncSession,
        conversation_id: UUID,
    ) -> Optional[CallLog]:
        """Get active call for a conversation (ringing or ongoing)."""
        query = (
            select(CallLog)
            .where(
                and_(
                    CallLog.conversation_id == conversation_id,
                    CallLog.status.in_(['ringing', 'ongoing'])
                )
            )
            .order_by(desc(CallLog.started_at))
            .limit(1)
        )

        result = await db.execute(query)
        return result.scalar_one_or_none()

    async def get_call_history(
        self,
        db: AsyncSession,
        conversation_id: UUID,
        limit: int = 20,
    ) -> List[CallLog]:
        """Get call history for a conversation."""
        query = (
            select(CallLog)
            .where(CallLog.conversation_id == conversation_id)
            .order_by(desc(CallLog.started_at))
            .limit(limit)
        )

        result = await db.execute(query)
        return list(result.scalars().all())

    def _get_call_status_text(self, call_log: CallLog) -> str:
        """Generate human-readable call status text for message."""
        if call_log.end_reason == 'declined':
            return 'Call declined'
        elif call_log.end_reason == 'missed':
            return 'Missed call'
        elif call_log.end_reason == 'no_answer':
            return 'No answer'
        elif call_log.duration_seconds:
            minutes = call_log.duration_seconds // 60
            seconds = call_log.duration_seconds % 60
            if minutes > 0:
                return f'Call ended - {minutes}m {seconds}s'
            else:
                return f'Call ended - {seconds}s'
        else:
            return 'Call ended'

    # ==========================================
    # LIVEKIT TOKENS
    # ==========================================

    def get_chat_token(
        self,
        conversation_id: str,
        user_id: str,
        user_name: str,
        is_external: bool = False,
    ) -> str:
        """Generate LiveKit token for chat room (data channel only)."""
        return livekit_service.create_chat_token(
            conversation_id=conversation_id,
            participant_identity=user_id,
            participant_name=user_name,
            is_external=is_external,
        )

    def get_call_token(
        self,
        call_room_name: str,
        user_id: str,
        user_name: str,
        is_caller: bool = False,
        is_external: bool = False,
    ) -> str:
        """Generate LiveKit token for audio/video call."""
        return livekit_service.create_call_token(
            call_room_name=call_room_name,
            participant_identity=user_id,
            participant_name=user_name,
            is_caller=is_caller,
            is_external=is_external,
        )

    def get_ws_url(self) -> str:
        """Get LiveKit WebSocket URL."""
        return livekit_service.get_ws_url()

    # ==========================================
    # TEAM MEMBERS (Internal Search)
    # ==========================================

    async def search_team_members(
        self,
        db: AsyncSession,
        tenant_id: UUID,
        search: str = None,
        exclude_user_ids: List[UUID] = None,
        limit: int = 20,
    ) -> List[Dict]:
        """
        Search team members within a tenant (for Team tab / internal chat).
        This only returns users from the SAME tenant.

        First tries to fetch from ERP employees, falls back to TenantUser table.

        Args:
            tenant_id: Tenant to search within
            search: Search query for name/email
            exclude_user_ids: User IDs to exclude
            limit: Max results

        Returns:
            List of user dicts with id, name, email, avatar
        """
        # Try to get employees from ERP first
        try:
            from services.erp_client import erp_client

            # Get all active employees from ERP
            employees = await erp_client.get_employees(
                company_id=str(tenant_id),
                status="ACTIVE",
                limit=100
            )

            if employees:
                # Filter by search term
                results = []
                search_lower = search.lower() if search else ""
                exclude_ids = set(str(uid) for uid in exclude_user_ids) if exclude_user_ids else set()

                for emp in employees:
                    # Get user_id - this is the auth.users.id
                    user_id = emp.get("user_id") or emp.get("id")
                    if not user_id:
                        continue

                    # Skip excluded users
                    if str(user_id) in exclude_ids:
                        continue

                    # Build name
                    first_name = emp.get("first_name", "")
                    last_name = emp.get("last_name", "")
                    full_name = f"{first_name} {last_name}".strip()
                    email = emp.get("work_email") or emp.get("email", "")
                    job_title = emp.get("job_title", "")
                    department = emp.get("department", {})
                    department_name = department.get("name", "") if isinstance(department, dict) else str(department or "")

                    # Search filter
                    if search_lower:
                        searchable = f"{full_name} {email} {job_title} {department_name}".lower()
                        if search_lower not in searchable:
                            continue

                    results.append({
                        'id': str(user_id),
                        'name': full_name or email.split('@')[0] if email else 'Unknown',
                        'email': email,
                        'avatar': emp.get("profile_picture_url") or emp.get("avatar"),
                        'username': email,
                        'job_title': job_title,
                        'is_online': False,
                    })

                    if len(results) >= limit:
                        break

                if results:
                    return results

        except Exception as e:
            print(f"[ChatService] ERP employee fetch failed: {e}, falling back to TenantUser")

        # Fall back to TenantUser table
        from models.admin_models import TenantUser

        query = (
            select(TenantUser)
            .where(
                and_(
                    TenantUser.tenant_id == tenant_id,
                    TenantUser.is_active == True
                )
            )
        )

        if search:
            search_filter = f"%{search}%"
            query = query.where(
                or_(
                    TenantUser.name.ilike(search_filter),
                    TenantUser.email.ilike(search_filter),
                    TenantUser.job_title.ilike(search_filter),
                    TenantUser.department.ilike(search_filter)
                )
            )

        if exclude_user_ids:
            query = query.where(TenantUser.user_id.notin_(exclude_user_ids))

        query = query.limit(limit)

        result = await db.execute(query)
        users = result.scalars().all()

        return [
            {
                'id': str(u.user_id),  # Use user_id as the identifier for creating conversations
                'name': u.name or u.email.split('@')[0] if u.email else 'Unknown',
                'email': u.email,
                'avatar': None,  # TenantUser doesn't have avatar
                'username': u.email,  # Use email as username
                'job_title': u.job_title,
                'is_online': False,  # Would need presence tracking to determine
            }
            for u in users
        ]


    # ==========================================
    # PRESENCE TRACKING
    # ==========================================

    async def update_last_seen(
        self,
        db: AsyncSession,
        user_id: UUID,
        tenant_id: UUID = None,
    ) -> None:
        """
        Update user's last_seen_at timestamp across all their conversations.
        Called on heartbeat or when user sends a message.
        """
        now = datetime.now(timezone.utc)

        # Update last_seen_at for all conversations this user is part of
        stmt = (
            update(ConversationParticipant)
            .where(
                and_(
                    ConversationParticipant.user_id == user_id,
                    ConversationParticipant.left_at.is_(None)
                )
            )
            .values(last_seen_at=now)
        )
        await db.execute(stmt)
        await db.commit()

    async def get_conversation_presence(
        self,
        db: AsyncSession,
        conversation_id: UUID,
        user_id: UUID,
    ) -> List[Dict]:
        """
        Get presence (last_seen, online status) for all participants in a conversation.
        A user is considered online if last_seen_at is within 2 minutes.
        """
        from datetime import timedelta

        query = (
            select(ConversationParticipant)
            .where(
                and_(
                    ConversationParticipant.conversation_id == conversation_id,
                    ConversationParticipant.left_at.is_(None)
                )
            )
        )

        result = await db.execute(query)
        participants = result.scalars().all()

        now = datetime.now(timezone.utc)
        online_threshold = now - timedelta(minutes=2)

        presence_data = []
        for p in participants:
            is_online = False
            if p.last_seen_at:
                # Make sure both datetimes are offset-aware for comparison
                last_seen = p.last_seen_at
                if last_seen.tzinfo is None:
                    last_seen = last_seen.replace(tzinfo=timezone.utc)
                is_online = last_seen > online_threshold

            presence_data.append({
                "user_id": str(p.user_id) if p.user_id else None,
                "user_name": p.user_name,
                "user_avatar": p.user_avatar,
                "last_seen_at": p.last_seen_at.isoformat() if p.last_seen_at else None,
                "is_online": is_online,
                "participant_type": p.participant_type,
            })

        return presence_data

    # ==========================================
    # MESSAGE DELIVERY TRACKING
    # ==========================================

    async def mark_as_delivered(
        self,
        db: AsyncSession,
        conversation_id: UUID,
        user_id: UUID,
        message_ids: List[UUID] = None,
    ) -> int:
        """
        Mark messages as delivered to a user.
        If message_ids is None, marks all undelivered messages in the conversation.

        Returns count of messages updated.
        """
        # Get messages that haven't been delivered to this user yet
        query = (
            select(DirectMessage)
            .where(
                and_(
                    DirectMessage.conversation_id == conversation_id,
                    DirectMessage.sender_id != user_id,  # Don't mark own messages
                    DirectMessage.is_deleted == False
                )
            )
        )

        if message_ids:
            query = query.where(DirectMessage.id.in_(message_ids))

        result = await db.execute(query)
        messages = result.scalars().all()

        updated_count = 0
        user_id_str = str(user_id)

        for msg in messages:
            delivered_to = msg.delivered_to or []
            if user_id_str not in delivered_to:
                delivered_to.append(user_id_str)
                msg.delivered_to = delivered_to
                updated_count += 1

        if updated_count > 0:
            await db.commit()

        return updated_count

    async def auto_mark_delivered_on_fetch(
        self,
        db: AsyncSession,
        conversation_id: UUID,
        user_id: UUID,
        messages: List[DirectMessage],
    ) -> List[DirectMessage]:
        """
        Automatically mark messages as delivered when a user fetches them.
        Returns the messages with updated delivered_to arrays.
        """
        user_id_str = str(user_id)
        updated = False

        for msg in messages:
            if str(msg.sender_id) != user_id_str:  # Don't mark own messages
                delivered_to = msg.delivered_to or []
                if user_id_str not in delivered_to:
                    delivered_to.append(user_id_str)
                    msg.delivered_to = delivered_to
                    updated = True

        if updated:
            await db.commit()

        return messages

    # ==========================================
    # ENHANCED READ RECEIPTS
    # ==========================================

    async def mark_messages_as_read(
        self,
        db: AsyncSession,
        conversation_id: UUID,
        user_id: UUID,
        message_id: UUID = None,
        read_receipts_enabled: bool = True,
    ) -> List[str]:
        """
        Enhanced mark as read that also updates message read_by arrays.

        Args:
            conversation_id: Conversation to mark as read
            user_id: User marking as read
            message_id: Optional - mark up to this message (defaults to all)
            read_receipts_enabled: If False, don't add to read_by (privacy mode)

        Returns:
            List of message IDs that were marked as read (for broadcasting)
        """
        # First, update participant's read status (original functionality)
        await self.mark_as_read(db, conversation_id, user_id, message_id)

        marked_message_ids = []

        # If privacy mode is disabled, don't add to read_by
        if not read_receipts_enabled:
            return marked_message_ids

        # Now update message-level read_by arrays
        query = (
            select(DirectMessage)
            .where(
                and_(
                    DirectMessage.conversation_id == conversation_id,
                    DirectMessage.sender_id != user_id,  # Don't mark own messages
                    DirectMessage.is_deleted == False
                )
            )
        )

        if message_id:
            # Get the message to find its timestamp
            target_msg = await db.get(DirectMessage, message_id)
            if target_msg:
                query = query.where(DirectMessage.created_at <= target_msg.created_at)

        result = await db.execute(query)
        messages = result.scalars().all()

        user_id_str = str(user_id)

        for msg in messages:
            read_by = msg.read_by or []
            if user_id_str not in read_by:
                read_by.append(user_id_str)
                msg.read_by = read_by
                marked_message_ids.append(str(msg.id))

        if marked_message_ids:
            await db.commit()

        return marked_message_ids

    async def get_message_read_receipts(
        self,
        db: AsyncSession,
        message_id: UUID,
        conversation_id: UUID,
    ) -> Dict:
        """
        Get detailed read receipts for a specific message.

        Returns:
            {
                "message_id": str,
                "delivered_to": [...],
                "read_by": [...],
                "participants": [...]
            }
        """
        # Get the message
        message = await db.get(DirectMessage, message_id)
        if not message:
            return None

        # Get all participants for user info
        query = (
            select(ConversationParticipant)
            .where(
                and_(
                    ConversationParticipant.conversation_id == conversation_id,
                    ConversationParticipant.left_at.is_(None)
                )
            )
        )
        result = await db.execute(query)
        participants = result.scalars().all()

        # Build participant info map
        participant_map = {}
        for p in participants:
            if p.user_id:
                participant_map[str(p.user_id)] = {
                    "user_id": str(p.user_id),
                    "user_name": p.user_name,
                    "user_avatar": p.user_avatar,
                    "last_read_at": p.last_read_at.isoformat() if p.last_read_at else None,
                }

        delivered_to = message.delivered_to or []
        read_by = message.read_by or []

        # Build detailed lists
        delivered_details = []
        for uid in delivered_to:
            if uid in participant_map:
                delivered_details.append(participant_map[uid])
            else:
                delivered_details.append({"user_id": uid, "user_name": "Unknown"})

        read_details = []
        for uid in read_by:
            if uid in participant_map:
                read_details.append(participant_map[uid])
            else:
                read_details.append({"user_id": uid, "user_name": "Unknown"})

        return {
            "message_id": str(message_id),
            "sender_id": str(message.sender_id),
            "delivered_to": delivered_details,
            "read_by": read_details,
            "total_delivered": len(delivered_to),
            "total_read": len(read_by),
            "total_participants": len(participants) - 1,  # Exclude sender
        }


# Singleton instance
chat_service = ChatService()
