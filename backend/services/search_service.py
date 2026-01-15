"""
Bheem Workspace - Enterprise Search Service
Business logic for unified search across all workspace apps
"""
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, func, text
from sqlalchemy.orm import selectinload

from models.mail_models import MailDraft, MailContact
from models.drive_models import DriveFile
from models.productivity_models import Spreadsheet, Presentation, Form
from models.meet_models import MeetingRoom
from models.calendar_models import SearchIndexLog


class SearchService:
    """Service for enterprise-wide search"""

    def __init__(self, db: AsyncSession):
        self.db = db

    # =============================================
    # Unified Search
    # =============================================

    async def search(
        self,
        tenant_id: UUID,
        user_id: UUID,
        query: str,
        apps: Optional[List[str]] = None,
        file_types: Optional[List[str]] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        owner_id: Optional[UUID] = None,
        shared_with_me: bool = False,
        skip: int = 0,
        limit: int = 20
    ) -> Dict[str, Any]:
        """
        Perform unified search across workspace apps

        Args:
            tenant_id: Tenant UUID
            user_id: User performing the search
            query: Search query string
            apps: List of apps to search (mail, drive, docs, sheets, etc.)
            file_types: Filter by file types
            date_from: Filter by date range start
            date_to: Filter by date range end
            owner_id: Filter by owner
            shared_with_me: Only show shared items
            skip: Pagination offset
            limit: Pagination limit

        Returns:
            Dict with results grouped by app
        """
        # Default to all apps if none specified
        if not apps:
            apps = ['mail', 'drive', 'docs', 'sheets', 'slides', 'forms', 'meet', 'contacts']

        results = {
            'query': query,
            'total': 0,
            'results': []
        }

        search_tasks = []

        # Search each requested app
        if 'mail' in apps:
            mail_results = await self._search_mail(
                tenant_id, user_id, query, date_from, date_to, skip, limit
            )
            results['results'].extend(mail_results)

        if 'drive' in apps:
            drive_results = await self._search_drive(
                tenant_id, user_id, query, file_types, date_from, date_to,
                owner_id, shared_with_me, skip, limit
            )
            results['results'].extend(drive_results)

        if 'docs' in apps:
            docs_results = await self._search_docs(
                tenant_id, user_id, query, date_from, date_to,
                owner_id, shared_with_me, skip, limit
            )
            results['results'].extend(docs_results)

        if 'sheets' in apps:
            sheets_results = await self._search_sheets(
                tenant_id, user_id, query, date_from, date_to,
                owner_id, shared_with_me, skip, limit
            )
            results['results'].extend(sheets_results)

        if 'slides' in apps:
            slides_results = await self._search_slides(
                tenant_id, user_id, query, date_from, date_to,
                owner_id, shared_with_me, skip, limit
            )
            results['results'].extend(slides_results)

        if 'forms' in apps:
            forms_results = await self._search_forms(
                tenant_id, user_id, query, date_from, date_to,
                owner_id, skip, limit
            )
            results['results'].extend(forms_results)

        if 'meet' in apps:
            meet_results = await self._search_meetings(
                tenant_id, user_id, query, date_from, date_to, skip, limit
            )
            results['results'].extend(meet_results)

        if 'contacts' in apps:
            contact_results = await self._search_contacts(
                tenant_id, user_id, query, skip, limit
            )
            results['results'].extend(contact_results)

        # Sort by relevance score (descending) and then by date
        results['results'].sort(key=lambda x: (-x.get('score', 0), x.get('updated_at', '')), reverse=False)

        # Apply pagination to combined results
        results['total'] = len(results['results'])
        results['results'] = results['results'][skip:skip + limit]

        # Log search
        await self._log_search(tenant_id, user_id, query, apps, results['total'])

        return results

    async def _search_mail(
        self,
        tenant_id: UUID,
        user_id: UUID,
        query: str,
        date_from: Optional[datetime],
        date_to: Optional[datetime],
        skip: int,
        limit: int
    ) -> List[Dict]:
        """Search mail drafts"""
        conditions = [
            MailDraft.tenant_id == tenant_id,
            MailDraft.user_id == user_id,
            or_(
                MailDraft.subject.ilike(f'%{query}%'),
                MailDraft.body.ilike(f'%{query}%'),
                MailDraft.to_addresses.cast(text('text')).ilike(f'%{query}%')
            )
        ]

        if date_from:
            conditions.append(MailDraft.created_at >= date_from)
        if date_to:
            conditions.append(MailDraft.created_at <= date_to)

        result = await self.db.execute(
            select(MailDraft)
            .where(and_(*conditions))
            .order_by(MailDraft.updated_at.desc())
            .offset(skip)
            .limit(limit)
        )

        drafts = result.scalars().all()

        return [
            {
                'id': str(draft.id),
                'type': 'mail',
                'title': draft.subject or '(No Subject)',
                'snippet': (draft.body or '')[:200],
                'score': self._calculate_score(query, draft.subject, draft.body),
                'created_at': draft.created_at.isoformat() if draft.created_at else None,
                'updated_at': draft.updated_at.isoformat() if draft.updated_at else None
            }
            for draft in drafts
        ]

    async def _search_drive(
        self,
        tenant_id: UUID,
        user_id: UUID,
        query: str,
        file_types: Optional[List[str]],
        date_from: Optional[datetime],
        date_to: Optional[datetime],
        owner_id: Optional[UUID],
        shared_with_me: bool,
        skip: int,
        limit: int
    ) -> List[Dict]:
        """Search Drive files"""
        conditions = [
            DriveFile.tenant_id == tenant_id,
            DriveFile.is_deleted == False,
            or_(
                DriveFile.name.ilike(f'%{query}%'),
                DriveFile.description.ilike(f'%{query}%')
            )
        ]

        if shared_with_me:
            # TODO: Join with DriveShare to check shared files
            pass
        else:
            conditions.append(DriveFile.owner_id == user_id)

        if owner_id:
            conditions.append(DriveFile.owner_id == owner_id)

        if file_types:
            conditions.append(DriveFile.mime_type.in_(file_types))

        if date_from:
            conditions.append(DriveFile.created_at >= date_from)
        if date_to:
            conditions.append(DriveFile.created_at <= date_to)

        result = await self.db.execute(
            select(DriveFile)
            .where(and_(*conditions))
            .order_by(DriveFile.updated_at.desc())
            .offset(skip)
            .limit(limit)
        )

        files = result.scalars().all()

        return [
            {
                'id': str(file.id),
                'type': 'drive',
                'title': file.name,
                'snippet': file.description or '',
                'mime_type': file.mime_type,
                'size': file.size,
                'score': self._calculate_score(query, file.name, file.description),
                'created_at': file.created_at.isoformat() if file.created_at else None,
                'updated_at': file.updated_at.isoformat() if file.updated_at else None
            }
            for file in files
        ]

    async def _search_docs(
        self,
        tenant_id: UUID,
        user_id: UUID,
        query: str,
        date_from: Optional[datetime],
        date_to: Optional[datetime],
        owner_id: Optional[UUID],
        shared_with_me: bool,
        skip: int,
        limit: int
    ) -> List[Dict]:
        """Search documents (Drive files with document type)"""
        doc_types = [
            'application/vnd.bheem.document',
            'application/vnd.google-apps.document',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ]

        conditions = [
            DriveFile.tenant_id == tenant_id,
            DriveFile.is_deleted == False,
            DriveFile.mime_type.in_(doc_types),
            or_(
                DriveFile.name.ilike(f'%{query}%'),
                DriveFile.description.ilike(f'%{query}%')
            )
        ]

        if not shared_with_me:
            conditions.append(DriveFile.owner_id == user_id)

        if owner_id:
            conditions.append(DriveFile.owner_id == owner_id)

        if date_from:
            conditions.append(DriveFile.created_at >= date_from)
        if date_to:
            conditions.append(DriveFile.created_at <= date_to)

        result = await self.db.execute(
            select(DriveFile)
            .where(and_(*conditions))
            .order_by(DriveFile.updated_at.desc())
            .offset(skip)
            .limit(limit)
        )

        files = result.scalars().all()

        return [
            {
                'id': str(file.id),
                'type': 'docs',
                'title': file.name,
                'snippet': file.description or '',
                'score': self._calculate_score(query, file.name, file.description),
                'created_at': file.created_at.isoformat() if file.created_at else None,
                'updated_at': file.updated_at.isoformat() if file.updated_at else None
            }
            for file in files
        ]

    async def _search_sheets(
        self,
        tenant_id: UUID,
        user_id: UUID,
        query: str,
        date_from: Optional[datetime],
        date_to: Optional[datetime],
        owner_id: Optional[UUID],
        shared_with_me: bool,
        skip: int,
        limit: int
    ) -> List[Dict]:
        """Search spreadsheets"""
        conditions = [
            Spreadsheet.tenant_id == tenant_id,
            Spreadsheet.is_deleted == False,
            or_(
                Spreadsheet.name.ilike(f'%{query}%'),
                Spreadsheet.description.ilike(f'%{query}%')
            )
        ]

        if not shared_with_me:
            conditions.append(Spreadsheet.owner_id == user_id)

        if owner_id:
            conditions.append(Spreadsheet.owner_id == owner_id)

        if date_from:
            conditions.append(Spreadsheet.created_at >= date_from)
        if date_to:
            conditions.append(Spreadsheet.created_at <= date_to)

        result = await self.db.execute(
            select(Spreadsheet)
            .where(and_(*conditions))
            .order_by(Spreadsheet.updated_at.desc())
            .offset(skip)
            .limit(limit)
        )

        sheets = result.scalars().all()

        return [
            {
                'id': str(sheet.id),
                'type': 'sheets',
                'title': sheet.name,
                'snippet': sheet.description or '',
                'score': self._calculate_score(query, sheet.name, sheet.description),
                'created_at': sheet.created_at.isoformat() if sheet.created_at else None,
                'updated_at': sheet.updated_at.isoformat() if sheet.updated_at else None
            }
            for sheet in sheets
        ]

    async def _search_slides(
        self,
        tenant_id: UUID,
        user_id: UUID,
        query: str,
        date_from: Optional[datetime],
        date_to: Optional[datetime],
        owner_id: Optional[UUID],
        shared_with_me: bool,
        skip: int,
        limit: int
    ) -> List[Dict]:
        """Search presentations"""
        conditions = [
            Presentation.tenant_id == tenant_id,
            Presentation.is_deleted == False,
            or_(
                Presentation.name.ilike(f'%{query}%'),
                Presentation.description.ilike(f'%{query}%')
            )
        ]

        if not shared_with_me:
            conditions.append(Presentation.owner_id == user_id)

        if owner_id:
            conditions.append(Presentation.owner_id == owner_id)

        if date_from:
            conditions.append(Presentation.created_at >= date_from)
        if date_to:
            conditions.append(Presentation.created_at <= date_to)

        result = await self.db.execute(
            select(Presentation)
            .where(and_(*conditions))
            .order_by(Presentation.updated_at.desc())
            .offset(skip)
            .limit(limit)
        )

        presentations = result.scalars().all()

        return [
            {
                'id': str(pres.id),
                'type': 'slides',
                'title': pres.name,
                'snippet': pres.description or '',
                'slide_count': pres.slide_count,
                'score': self._calculate_score(query, pres.name, pres.description),
                'created_at': pres.created_at.isoformat() if pres.created_at else None,
                'updated_at': pres.updated_at.isoformat() if pres.updated_at else None
            }
            for pres in presentations
        ]

    async def _search_forms(
        self,
        tenant_id: UUID,
        user_id: UUID,
        query: str,
        date_from: Optional[datetime],
        date_to: Optional[datetime],
        owner_id: Optional[UUID],
        skip: int,
        limit: int
    ) -> List[Dict]:
        """Search forms"""
        conditions = [
            Form.tenant_id == tenant_id,
            Form.is_deleted == False,
            or_(
                Form.title.ilike(f'%{query}%'),
                Form.description.ilike(f'%{query}%')
            )
        ]

        if owner_id:
            conditions.append(Form.owner_id == owner_id)
        else:
            conditions.append(Form.owner_id == user_id)

        if date_from:
            conditions.append(Form.created_at >= date_from)
        if date_to:
            conditions.append(Form.created_at <= date_to)

        result = await self.db.execute(
            select(Form)
            .where(and_(*conditions))
            .order_by(Form.updated_at.desc())
            .offset(skip)
            .limit(limit)
        )

        forms = result.scalars().all()

        return [
            {
                'id': str(form.id),
                'type': 'forms',
                'title': form.title,
                'snippet': form.description or '',
                'response_count': form.response_count,
                'score': self._calculate_score(query, form.title, form.description),
                'created_at': form.created_at.isoformat() if form.created_at else None,
                'updated_at': form.updated_at.isoformat() if form.updated_at else None
            }
            for form in forms
        ]

    async def _search_meetings(
        self,
        tenant_id: UUID,
        user_id: UUID,
        query: str,
        date_from: Optional[datetime],
        date_to: Optional[datetime],
        skip: int,
        limit: int
    ) -> List[Dict]:
        """Search meetings"""
        conditions = [
            MeetingRoom.tenant_id == tenant_id,
            or_(
                MeetingRoom.title.ilike(f'%{query}%'),
                MeetingRoom.description.ilike(f'%{query}%')
            )
        ]

        if date_from:
            conditions.append(MeetingRoom.scheduled_start >= date_from)
        if date_to:
            conditions.append(MeetingRoom.scheduled_start <= date_to)

        result = await self.db.execute(
            select(MeetingRoom)
            .where(and_(*conditions))
            .order_by(MeetingRoom.scheduled_start.desc())
            .offset(skip)
            .limit(limit)
        )

        meetings = result.scalars().all()

        return [
            {
                'id': str(meeting.id),
                'type': 'meet',
                'title': meeting.title or 'Untitled Meeting',
                'snippet': meeting.description or '',
                'meeting_code': meeting.meeting_code,
                'scheduled_start': meeting.scheduled_start.isoformat() if meeting.scheduled_start else None,
                'score': self._calculate_score(query, meeting.title, meeting.description),
                'created_at': meeting.created_at.isoformat() if meeting.created_at else None,
                'updated_at': None
            }
            for meeting in meetings
        ]

    async def _search_contacts(
        self,
        tenant_id: UUID,
        user_id: UUID,
        query: str,
        skip: int,
        limit: int
    ) -> List[Dict]:
        """Search contacts"""
        result = await self.db.execute(
            select(MailContact)
            .where(
                MailContact.tenant_id == tenant_id,
                MailContact.user_id == user_id,
                or_(
                    MailContact.name.ilike(f'%{query}%'),
                    MailContact.email.ilike(f'%{query}%'),
                    MailContact.company.ilike(f'%{query}%'),
                    MailContact.notes.ilike(f'%{query}%')
                )
            )
            .order_by(MailContact.name.asc())
            .offset(skip)
            .limit(limit)
        )

        contacts = result.scalars().all()

        return [
            {
                'id': str(contact.id),
                'type': 'contacts',
                'title': contact.name or contact.email,
                'snippet': f"{contact.email} - {contact.company or ''}"[:200],
                'email': contact.email,
                'score': self._calculate_score(query, contact.name, contact.email),
                'created_at': contact.created_at.isoformat() if contact.created_at else None,
                'updated_at': contact.updated_at.isoformat() if contact.updated_at else None
            }
            for contact in contacts
        ]

    def _calculate_score(
        self,
        query: str,
        title: Optional[str],
        content: Optional[str]
    ) -> float:
        """Calculate relevance score for search result"""
        score = 0.0
        query_lower = query.lower()

        # Title match (higher weight)
        if title:
            title_lower = title.lower()
            if query_lower == title_lower:
                score += 100
            elif query_lower in title_lower:
                score += 50
                # Boost for match at beginning
                if title_lower.startswith(query_lower):
                    score += 20

        # Content match
        if content:
            content_lower = content.lower()
            if query_lower in content_lower:
                score += 25
                # Count occurrences
                count = content_lower.count(query_lower)
                score += min(count * 2, 20)  # Cap at 20

        return score

    async def _log_search(
        self,
        tenant_id: UUID,
        user_id: UUID,
        query: str,
        apps: List[str],
        result_count: int
    ):
        """Log search for analytics"""
        log = SearchIndexLog(
            tenant_id=tenant_id,
            entity_type='search',
            entity_id=user_id,
            status='completed',
            records_indexed=result_count,
            details={
                'query': query,
                'apps': apps,
                'result_count': result_count
            }
        )
        self.db.add(log)
        await self.db.commit()

    # =============================================
    # Search Suggestions
    # =============================================

    async def get_suggestions(
        self,
        tenant_id: UUID,
        user_id: UUID,
        prefix: str,
        limit: int = 5
    ) -> List[Dict]:
        """Get search suggestions based on prefix"""
        suggestions = []

        # Get recent searches
        result = await self.db.execute(
            select(SearchIndexLog)
            .where(
                SearchIndexLog.tenant_id == tenant_id,
                SearchIndexLog.entity_id == user_id,
                SearchIndexLog.entity_type == 'search',
                SearchIndexLog.details['query'].astext.ilike(f'{prefix}%')
            )
            .order_by(SearchIndexLog.indexed_at.desc())
            .limit(limit)
        )

        logs = result.scalars().all()

        for log in logs:
            if log.details and 'query' in log.details:
                suggestions.append({
                    'type': 'recent',
                    'text': log.details['query'],
                    'result_count': log.details.get('result_count', 0)
                })

        # Get popular searches (if we have less than limit)
        if len(suggestions) < limit:
            # Get most common search queries
            popular_result = await self.db.execute(
                select(
                    SearchIndexLog.details['query'].astext.label('query'),
                    func.count().label('count')
                )
                .where(
                    SearchIndexLog.tenant_id == tenant_id,
                    SearchIndexLog.entity_type == 'search',
                    SearchIndexLog.details['query'].astext.ilike(f'{prefix}%')
                )
                .group_by(SearchIndexLog.details['query'].astext)
                .order_by(func.count().desc())
                .limit(limit - len(suggestions))
            )

            for row in popular_result:
                if row.query not in [s['text'] for s in suggestions]:
                    suggestions.append({
                        'type': 'popular',
                        'text': row.query,
                        'search_count': row.count
                    })

        return suggestions[:limit]

    # =============================================
    # Recent Items
    # =============================================

    async def get_recent_items(
        self,
        tenant_id: UUID,
        user_id: UUID,
        apps: Optional[List[str]] = None,
        limit: int = 20
    ) -> List[Dict]:
        """Get recently accessed items across apps"""
        if not apps:
            apps = ['drive', 'docs', 'sheets', 'slides', 'forms']

        recent_items = []

        # Get recent Drive files
        if 'drive' in apps or 'docs' in apps or 'sheets' in apps or 'slides' in apps:
            result = await self.db.execute(
                select(DriveFile)
                .where(
                    DriveFile.tenant_id == tenant_id,
                    DriveFile.owner_id == user_id,
                    DriveFile.is_deleted == False
                )
                .order_by(DriveFile.updated_at.desc())
                .limit(limit)
            )

            files = result.scalars().all()

            for file in files:
                item_type = self._get_item_type(file.mime_type)
                if item_type in apps:
                    recent_items.append({
                        'id': str(file.id),
                        'type': item_type,
                        'title': file.name,
                        'updated_at': file.updated_at.isoformat() if file.updated_at else None
                    })

        # Get recent spreadsheets
        if 'sheets' in apps:
            result = await self.db.execute(
                select(Spreadsheet)
                .where(
                    Spreadsheet.tenant_id == tenant_id,
                    Spreadsheet.owner_id == user_id,
                    Spreadsheet.is_deleted == False
                )
                .order_by(Spreadsheet.updated_at.desc())
                .limit(limit)
            )

            sheets = result.scalars().all()

            for sheet in sheets:
                recent_items.append({
                    'id': str(sheet.id),
                    'type': 'sheets',
                    'title': sheet.name,
                    'updated_at': sheet.updated_at.isoformat() if sheet.updated_at else None
                })

        # Get recent presentations
        if 'slides' in apps:
            result = await self.db.execute(
                select(Presentation)
                .where(
                    Presentation.tenant_id == tenant_id,
                    Presentation.owner_id == user_id,
                    Presentation.is_deleted == False
                )
                .order_by(Presentation.updated_at.desc())
                .limit(limit)
            )

            presentations = result.scalars().all()

            for pres in presentations:
                recent_items.append({
                    'id': str(pres.id),
                    'type': 'slides',
                    'title': pres.name,
                    'updated_at': pres.updated_at.isoformat() if pres.updated_at else None
                })

        # Get recent forms
        if 'forms' in apps:
            result = await self.db.execute(
                select(Form)
                .where(
                    Form.tenant_id == tenant_id,
                    Form.owner_id == user_id,
                    Form.is_deleted == False
                )
                .order_by(Form.updated_at.desc())
                .limit(limit)
            )

            forms = result.scalars().all()

            for form in forms:
                recent_items.append({
                    'id': str(form.id),
                    'type': 'forms',
                    'title': form.title,
                    'updated_at': form.updated_at.isoformat() if form.updated_at else None
                })

        # Sort by updated_at and limit
        recent_items.sort(key=lambda x: x.get('updated_at', ''), reverse=True)
        return recent_items[:limit]

    def _get_item_type(self, mime_type: Optional[str]) -> str:
        """Determine item type from mime type"""
        if not mime_type:
            return 'drive'

        doc_types = ['document', 'msword', 'wordprocessingml']
        sheet_types = ['spreadsheet', 'excel', 'spreadsheetml']
        slide_types = ['presentation', 'powerpoint', 'presentationml']

        mime_lower = mime_type.lower()

        for doc_type in doc_types:
            if doc_type in mime_lower:
                return 'docs'

        for sheet_type in sheet_types:
            if sheet_type in mime_lower:
                return 'sheets'

        for slide_type in slide_types:
            if slide_type in mime_lower:
                return 'slides'

        return 'drive'
