"""
Bheem Workspace - DLP (Data Loss Prevention) Service
Business logic for detecting and handling sensitive data
"""
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
import re
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, func
from sqlalchemy.orm import selectinload

from models.enterprise_models import DLPRule, DLPIncident, DLP_PREDEFINED_PATTERNS


class DLPService:
    """Service for Data Loss Prevention"""

    def __init__(self, db: AsyncSession):
        self.db = db

    # =============================================
    # DLP Rules
    # =============================================

    async def create_rule(
        self,
        tenant_id: UUID,
        created_by: UUID,
        name: str,
        pattern_type: str,
        pattern: str,
        action: str,
        description: Optional[str] = None,
        predefined_type: Optional[str] = None,
        scope: Optional[Dict] = None,
        notify_admins: bool = True,
        notify_user: bool = True,
        custom_message: Optional[str] = None,
        severity: str = 'medium'
    ) -> DLPRule:
        """Create a new DLP rule"""
        # If using predefined pattern, get the regex
        if pattern_type == 'predefined' and predefined_type:
            predefined = DLP_PREDEFINED_PATTERNS.get(predefined_type)
            if predefined:
                pattern = predefined['regex']

        rule = DLPRule(
            tenant_id=tenant_id,
            created_by=created_by,
            name=name,
            description=description,
            pattern_type=pattern_type,
            pattern=pattern,
            predefined_type=predefined_type,
            action=action,
            scope=scope or {},
            notify_admins=notify_admins,
            notify_user=notify_user,
            custom_message=custom_message,
            severity=severity,
            is_enabled=True
        )

        self.db.add(rule)
        await self.db.commit()
        await self.db.refresh(rule)
        return rule

    async def get_rule(
        self,
        rule_id: UUID,
        tenant_id: UUID
    ) -> Optional[DLPRule]:
        """Get a DLP rule by ID"""
        result = await self.db.execute(
            select(DLPRule).where(
                DLPRule.id == rule_id,
                DLPRule.tenant_id == tenant_id
            )
        )
        return result.scalar_one_or_none()

    async def list_rules(
        self,
        tenant_id: UUID,
        is_enabled: Optional[bool] = None,
        severity: Optional[str] = None,
        skip: int = 0,
        limit: int = 50
    ) -> List[DLPRule]:
        """List DLP rules"""
        query = select(DLPRule).where(DLPRule.tenant_id == tenant_id)

        if is_enabled is not None:
            query = query.where(DLPRule.is_enabled == is_enabled)
        if severity:
            query = query.where(DLPRule.severity == severity)

        query = query.order_by(DLPRule.created_at.desc())
        query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update_rule(
        self,
        rule_id: UUID,
        tenant_id: UUID,
        **updates
    ) -> Optional[DLPRule]:
        """Update a DLP rule"""
        rule = await self.get_rule(rule_id, tenant_id)
        if not rule:
            return None

        allowed_fields = [
            'name', 'description', 'pattern', 'action', 'scope',
            'notify_admins', 'notify_user', 'custom_message',
            'severity', 'is_enabled'
        ]

        for field, value in updates.items():
            if field in allowed_fields and value is not None:
                setattr(rule, field, value)

        rule.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(rule)
        return rule

    async def delete_rule(
        self,
        rule_id: UUID,
        tenant_id: UUID
    ) -> bool:
        """Delete a DLP rule"""
        result = await self.db.execute(
            delete(DLPRule).where(
                DLPRule.id == rule_id,
                DLPRule.tenant_id == tenant_id
            )
        )
        await self.db.commit()
        return result.rowcount > 0

    async def enable_rule(
        self,
        rule_id: UUID,
        tenant_id: UUID
    ) -> Optional[DLPRule]:
        """Enable a DLP rule"""
        return await self.update_rule(rule_id, tenant_id, is_enabled=True)

    async def disable_rule(
        self,
        rule_id: UUID,
        tenant_id: UUID
    ) -> Optional[DLPRule]:
        """Disable a DLP rule"""
        return await self.update_rule(rule_id, tenant_id, is_enabled=False)

    # =============================================
    # Content Scanning
    # =============================================

    async def scan_content(
        self,
        tenant_id: UUID,
        user_id: UUID,
        content: str,
        content_type: str,
        content_id: Optional[UUID] = None,
        content_title: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Dict[str, Any]:
        """Scan content for DLP violations"""
        # Get all enabled rules for tenant
        rules = await self.list_rules(tenant_id, is_enabled=True)

        violations = []
        should_block = False
        max_severity = None

        for rule in rules:
            # Check if content matches rule scope
            if not self._matches_scope(rule.scope, content_type):
                continue

            # Check for pattern match
            matches = self._find_matches(rule.pattern, content)
            if matches:
                violation = {
                    'rule_id': rule.id,
                    'rule_name': rule.name,
                    'severity': rule.severity,
                    'action': rule.action,
                    'match_count': len(matches),
                    'message': rule.custom_message or f"Sensitive data detected: {rule.name}"
                }
                violations.append(violation)

                # Create incident
                await self._create_incident(
                    tenant_id=tenant_id,
                    rule=rule,
                    user_id=user_id,
                    content_type=content_type,
                    content_id=content_id,
                    content_title=content_title,
                    matches=matches,
                    ip_address=ip_address,
                    user_agent=user_agent
                )

                if rule.action == 'block':
                    should_block = True

                # Track max severity
                severity_order = {'low': 1, 'medium': 2, 'high': 3, 'critical': 4}
                if max_severity is None or severity_order.get(rule.severity, 0) > severity_order.get(max_severity, 0):
                    max_severity = rule.severity

        return {
            'has_violations': len(violations) > 0,
            'should_block': should_block,
            'max_severity': max_severity,
            'violations': violations
        }

    def _matches_scope(self, scope: Dict, content_type: str) -> bool:
        """Check if content type matches rule scope"""
        if not scope:
            return True

        apps = scope.get('apps', [])
        if apps and content_type not in apps:
            return False

        return True

    def _find_matches(self, pattern: str, content: str) -> List[str]:
        """Find all pattern matches in content"""
        try:
            matches = re.findall(pattern, content, re.IGNORECASE)
            return matches
        except re.error:
            return []

    def _redact_match(self, match: str) -> str:
        """Redact sensitive match for logging"""
        if len(match) <= 4:
            return '*' * len(match)
        return match[:2] + '*' * (len(match) - 4) + match[-2:]

    async def _create_incident(
        self,
        tenant_id: UUID,
        rule: DLPRule,
        user_id: UUID,
        content_type: str,
        content_id: Optional[UUID],
        content_title: Optional[str],
        matches: List[str],
        ip_address: Optional[str],
        user_agent: Optional[str]
    ):
        """Create a DLP incident"""
        # Redact matches for storage
        redacted_matches = [self._redact_match(m) for m in matches[:5]]

        incident = DLPIncident(
            tenant_id=tenant_id,
            rule_id=rule.id,
            user_id=user_id,
            content_type=content_type,
            content_id=content_id,
            content_title=content_title,
            matched_pattern=rule.pattern[:200],
            matched_content=', '.join(redacted_matches),
            match_count=len(matches),
            action_taken=rule.action,
            was_blocked=(rule.action == 'block'),
            ip_address=ip_address,
            user_agent=user_agent
        )

        self.db.add(incident)

        # Update rule stats
        rule.trigger_count += 1
        rule.last_triggered_at = datetime.utcnow()

        await self.db.commit()

    # =============================================
    # Incidents
    # =============================================

    async def list_incidents(
        self,
        tenant_id: UUID,
        status: Optional[str] = None,
        severity: Optional[str] = None,
        user_id: Optional[UUID] = None,
        content_type: Optional[str] = None,
        skip: int = 0,
        limit: int = 50
    ) -> List[DLPIncident]:
        """List DLP incidents"""
        query = select(DLPIncident).where(DLPIncident.tenant_id == tenant_id)

        if status:
            query = query.where(DLPIncident.status == status)
        if user_id:
            query = query.where(DLPIncident.user_id == user_id)
        if content_type:
            query = query.where(DLPIncident.content_type == content_type)

        # Join with rule to filter by severity
        if severity:
            query = query.join(DLPRule).where(DLPRule.severity == severity)

        query = query.order_by(DLPIncident.created_at.desc())
        query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_incident(
        self,
        incident_id: UUID,
        tenant_id: UUID
    ) -> Optional[DLPIncident]:
        """Get a DLP incident by ID"""
        result = await self.db.execute(
            select(DLPIncident)
            .options(selectinload(DLPIncident.rule))
            .where(
                DLPIncident.id == incident_id,
                DLPIncident.tenant_id == tenant_id
            )
        )
        return result.scalar_one_or_none()

    async def update_incident_status(
        self,
        incident_id: UUID,
        tenant_id: UUID,
        status: str,
        reviewed_by: UUID,
        resolution_notes: Optional[str] = None
    ) -> Optional[DLPIncident]:
        """Update incident status"""
        incident = await self.get_incident(incident_id, tenant_id)
        if not incident:
            return None

        incident.status = status
        incident.reviewed_by = reviewed_by
        incident.reviewed_at = datetime.utcnow()
        if resolution_notes:
            incident.resolution_notes = resolution_notes

        await self.db.commit()
        await self.db.refresh(incident)
        return incident

    async def get_incident_stats(
        self,
        tenant_id: UUID
    ) -> Dict[str, Any]:
        """Get DLP incident statistics"""
        # Count by status
        status_query = select(
            DLPIncident.status,
            func.count(DLPIncident.id)
        ).where(
            DLPIncident.tenant_id == tenant_id
        ).group_by(DLPIncident.status)

        status_result = await self.db.execute(status_query)
        status_counts = dict(status_result.all())

        # Count by content type
        type_query = select(
            DLPIncident.content_type,
            func.count(DLPIncident.id)
        ).where(
            DLPIncident.tenant_id == tenant_id
        ).group_by(DLPIncident.content_type)

        type_result = await self.db.execute(type_query)
        type_counts = dict(type_result.all())

        # Total count
        total_query = select(func.count(DLPIncident.id)).where(
            DLPIncident.tenant_id == tenant_id
        )
        total_result = await self.db.execute(total_query)
        total = total_result.scalar() or 0

        return {
            'total_incidents': total,
            'by_status': status_counts,
            'by_content_type': type_counts,
            'open_count': status_counts.get('open', 0),
            'resolved_count': status_counts.get('resolved', 0)
        }

    # =============================================
    # Predefined Patterns
    # =============================================

    @staticmethod
    def get_predefined_patterns() -> Dict[str, Dict]:
        """Get available predefined DLP patterns"""
        return DLP_PREDEFINED_PATTERNS

    async def test_pattern(
        self,
        pattern: str,
        test_content: str
    ) -> Dict[str, Any]:
        """Test a pattern against sample content"""
        try:
            matches = re.findall(pattern, test_content, re.IGNORECASE)
            return {
                'valid': True,
                'matches': matches,
                'match_count': len(matches)
            }
        except re.error as e:
            return {
                'valid': False,
                'error': str(e),
                'matches': [],
                'match_count': 0
            }
