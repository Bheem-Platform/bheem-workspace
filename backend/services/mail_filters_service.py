"""
Bheem Workspace - Email Filters Service
Manage email filter rules and apply them to incoming emails
"""
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
import re
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from models.mail_models import MailFilter
from core.logging import get_logger

logger = get_logger("bheem.mail.filters")


# ===========================================
# Supported Filter Conditions and Actions
# ===========================================

CONDITION_FIELDS = ['from', 'to', 'cc', 'subject', 'body', 'has_attachment']

CONDITION_OPERATORS = ['contains', 'not_contains', 'equals', 'not_equals', 'starts_with', 'ends_with', 'matches_regex']

FILTER_ACTIONS = [
    'move_to',           # Move to folder
    'mark_as_read',      # Mark as read
    'mark_as_starred',   # Star the email
    'apply_label',       # Apply a label (for future use)
    'delete',            # Move to trash
    'forward_to',        # Forward to address
    'skip_inbox',        # Archive immediately
    'never_spam',        # Prevent spam classification
]


class MailFiltersService:
    """
    Service for managing email filters/rules.

    Filters consist of:
    - Conditions: What emails to match (from, to, subject, etc.)
    - Actions: What to do with matching emails (move, mark read, star, etc.)
    """

    async def create_filter(
        self,
        db: AsyncSession,
        user_id: UUID,
        name: str,
        conditions: List[Dict[str, Any]],
        actions: List[Dict[str, Any]],
        is_enabled: bool = True,
        priority: int = 0,
        stop_processing: bool = False
    ) -> MailFilter:
        """
        Create a new email filter.

        Args:
            db: Database session
            user_id: Owner's user ID
            name: Filter name
            conditions: List of condition objects
            actions: List of action objects
            is_enabled: Whether filter is active
            priority: Lower number = higher priority
            stop_processing: Stop checking other filters if this matches

        Returns:
            Created MailFilter object
        """
        # Validate conditions
        self._validate_conditions(conditions)

        # Validate actions
        self._validate_actions(actions)

        mail_filter = MailFilter(
            user_id=user_id,
            name=name,
            conditions=conditions,
            actions=actions,
            is_enabled=is_enabled,
            priority=priority,
            stop_processing=stop_processing
        )

        db.add(mail_filter)
        await db.commit()
        await db.refresh(mail_filter)

        logger.info(
            f"Created filter {mail_filter.id}",
            action="filter_created",
            filter_id=str(mail_filter.id),
            user_id=str(user_id)
        )

        return mail_filter

    async def get_filter(
        self,
        db: AsyncSession,
        filter_id: UUID,
        user_id: UUID
    ) -> Optional[MailFilter]:
        """Get a single filter by ID."""
        result = await db.execute(
            select(MailFilter)
            .where(MailFilter.id == filter_id, MailFilter.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def list_filters(
        self,
        db: AsyncSession,
        user_id: UUID,
        enabled_only: bool = False
    ) -> List[MailFilter]:
        """
        List all filters for a user.

        Returns filters ordered by priority (ascending).
        """
        query = select(MailFilter).where(MailFilter.user_id == user_id)

        if enabled_only:
            query = query.where(MailFilter.is_enabled == True)

        query = query.order_by(MailFilter.priority, MailFilter.created_at)

        result = await db.execute(query)
        return result.scalars().all()

    async def update_filter(
        self,
        db: AsyncSession,
        filter_id: UUID,
        user_id: UUID,
        updates: Dict[str, Any]
    ) -> Optional[MailFilter]:
        """
        Update an existing filter.

        Args:
            db: Database session
            filter_id: Filter UUID
            user_id: Owner's user ID
            updates: Dict of fields to update

        Returns:
            Updated MailFilter or None if not found
        """
        # Get the filter first
        mail_filter = await self.get_filter(db, filter_id, user_id)
        if not mail_filter:
            return None

        # Validate updates
        if 'conditions' in updates:
            self._validate_conditions(updates['conditions'])
        if 'actions' in updates:
            self._validate_actions(updates['actions'])

        # Apply updates
        allowed_fields = ['name', 'conditions', 'actions', 'is_enabled', 'priority', 'stop_processing']
        for field, value in updates.items():
            if field in allowed_fields and value is not None:
                setattr(mail_filter, field, value)

        mail_filter.updated_at = datetime.utcnow()

        await db.commit()
        await db.refresh(mail_filter)

        return mail_filter

    async def delete_filter(
        self,
        db: AsyncSession,
        filter_id: UUID,
        user_id: UUID
    ) -> bool:
        """Delete a filter."""
        result = await db.execute(
            delete(MailFilter)
            .where(MailFilter.id == filter_id, MailFilter.user_id == user_id)
        )
        await db.commit()
        return result.rowcount > 0

    async def toggle_filter(
        self,
        db: AsyncSession,
        filter_id: UUID,
        user_id: UUID,
        enabled: bool
    ) -> Optional[MailFilter]:
        """Enable or disable a filter."""
        return await self.update_filter(db, filter_id, user_id, {'is_enabled': enabled})

    async def reorder_filters(
        self,
        db: AsyncSession,
        user_id: UUID,
        filter_order: List[str]
    ) -> List[MailFilter]:
        """
        Reorder filters by setting priorities.

        Args:
            db: Database session
            user_id: Owner's user ID
            filter_order: List of filter IDs in desired order

        Returns:
            Updated list of filters
        """
        for idx, filter_id in enumerate(filter_order):
            await db.execute(
                update(MailFilter)
                .where(MailFilter.id == UUID(filter_id), MailFilter.user_id == user_id)
                .values(priority=idx)
            )

        await db.commit()
        return await self.list_filters(db, user_id)

    def apply_filters_to_email(
        self,
        email: Dict[str, Any],
        filters: List[MailFilter]
    ) -> List[Dict[str, Any]]:
        """
        Apply filters to an email and return matching actions.

        Args:
            email: Email data (from, to, cc, subject, body, has_attachment)
            filters: List of filters to check (should be pre-sorted by priority)

        Returns:
            List of actions to apply from matching filters
        """
        all_actions = []

        for mail_filter in filters:
            if not mail_filter.is_enabled:
                continue

            if self._check_conditions(email, mail_filter.conditions):
                # Filter matched
                all_actions.extend(mail_filter.actions)

                logger.debug(
                    f"Filter {mail_filter.name} matched email",
                    action="filter_matched",
                    filter_id=str(mail_filter.id)
                )

                if mail_filter.stop_processing:
                    break

        return all_actions

    def _check_conditions(
        self,
        email: Dict[str, Any],
        conditions: List[Dict[str, Any]]
    ) -> bool:
        """
        Check if email matches all conditions.

        All conditions must match (AND logic).
        """
        if not conditions:
            return False

        for condition in conditions:
            if not self._check_single_condition(email, condition):
                return False

        return True

    def _check_single_condition(
        self,
        email: Dict[str, Any],
        condition: Dict[str, Any]
    ) -> bool:
        """Check if email matches a single condition."""
        field = condition.get('field', '')
        operator = condition.get('operator', '')
        value = condition.get('value', '')

        # Get the email field value
        if field == 'from':
            email_value = email.get('from', '')
        elif field == 'to':
            # Join all to addresses
            to_list = email.get('to', [])
            email_value = ' '.join(to_list) if isinstance(to_list, list) else str(to_list)
        elif field == 'cc':
            cc_list = email.get('cc', [])
            email_value = ' '.join(cc_list) if isinstance(cc_list, list) else str(cc_list)
        elif field == 'subject':
            email_value = email.get('subject', '')
        elif field == 'body':
            email_value = email.get('body', '')
        elif field == 'has_attachment':
            has_att = email.get('has_attachment', False) or len(email.get('attachments', [])) > 0
            return has_att == (value.lower() == 'true' if isinstance(value, str) else bool(value))
        else:
            return False

        # Normalize to lowercase for comparison
        email_value = str(email_value).lower()
        value = str(value).lower()

        # Apply operator
        if operator == 'contains':
            return value in email_value
        elif operator == 'not_contains':
            return value not in email_value
        elif operator == 'equals':
            return email_value == value
        elif operator == 'not_equals':
            return email_value != value
        elif operator == 'starts_with':
            return email_value.startswith(value)
        elif operator == 'ends_with':
            return email_value.endswith(value)
        elif operator == 'matches_regex':
            try:
                return bool(re.search(value, email_value, re.IGNORECASE))
            except re.error:
                return False

        return False

    def _validate_conditions(self, conditions: List[Dict[str, Any]]):
        """Validate filter conditions."""
        if not conditions:
            raise ValueError("At least one condition is required")

        for condition in conditions:
            field = condition.get('field')
            operator = condition.get('operator')

            if field not in CONDITION_FIELDS:
                raise ValueError(f"Invalid condition field: {field}. Must be one of: {CONDITION_FIELDS}")

            if operator not in CONDITION_OPERATORS:
                raise ValueError(f"Invalid operator: {operator}. Must be one of: {CONDITION_OPERATORS}")

            if 'value' not in condition and field != 'has_attachment':
                raise ValueError(f"Value is required for condition on field: {field}")

    def _validate_actions(self, actions: List[Dict[str, Any]]):
        """Validate filter actions."""
        if not actions:
            raise ValueError("At least one action is required")

        for action in actions:
            action_type = action.get('action')

            if action_type not in FILTER_ACTIONS:
                raise ValueError(f"Invalid action: {action_type}. Must be one of: {FILTER_ACTIONS}")

            # Validate action-specific requirements
            if action_type in ['move_to', 'apply_label', 'forward_to'] and not action.get('value'):
                raise ValueError(f"Value is required for action: {action_type}")

    def filter_to_dict(self, mail_filter: MailFilter) -> Dict[str, Any]:
        """Convert filter model to dictionary."""
        return {
            "id": str(mail_filter.id),
            "name": mail_filter.name,
            "is_enabled": mail_filter.is_enabled,
            "priority": mail_filter.priority,
            "stop_processing": mail_filter.stop_processing,
            "conditions": mail_filter.conditions,
            "actions": mail_filter.actions,
            "created_at": mail_filter.created_at.isoformat() if mail_filter.created_at else None,
            "updated_at": mail_filter.updated_at.isoformat() if mail_filter.updated_at else None,
        }


# Singleton instance
mail_filters_service = MailFiltersService()
