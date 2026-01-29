"""
Bheem Workspace - Meeting AI Service
Service for AI-generated meeting summaries, action items, and highlights
Phase 11: AI Meeting Summaries
"""
from typing import Optional, List, Dict
from uuid import UUID
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, or_
import json
import re

from models.meet_enhancements import MeetingSummary, MeetingActionItem, MeetingHighlight


class MeetingAIService:
    """Service for AI-powered meeting analysis"""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ═══════════════════════════════════════════════════════════════════
    # Meeting Summaries
    # ═══════════════════════════════════════════════════════════════════

    async def create_summary(
        self,
        meeting_id: UUID,
        title: str,
        summary: str,
        key_points: List[str],
        decisions: List[str],
        topics: List[Dict],
        meeting_date: Optional[datetime] = None,
        source_type: str = 'transcript',
        transcript_id: Optional[UUID] = None,
        recording_id: Optional[UUID] = None,
        ai_model: str = 'claude'
    ) -> MeetingSummary:
        """Create a meeting summary"""
        meeting_summary = MeetingSummary(
            meeting_id=meeting_id,
            title=title,
            summary=summary,
            key_points=key_points,
            decisions=decisions,
            topics=topics,
            meeting_date=meeting_date or datetime.utcnow(),
            source_type=source_type,
            transcript_id=transcript_id,
            recording_id=recording_id,
            ai_model=ai_model,
            status='completed'
        )

        self.db.add(meeting_summary)
        await self.db.commit()
        await self.db.refresh(meeting_summary)
        return meeting_summary

    async def get_summary(self, summary_id: UUID) -> Optional[MeetingSummary]:
        """Get a meeting summary by ID"""
        result = await self.db.execute(
            select(MeetingSummary).where(MeetingSummary.id == summary_id)
        )
        return result.scalar_one_or_none()

    async def get_meeting_summary(self, meeting_id: UUID) -> Optional[MeetingSummary]:
        """Get summary for a specific meeting"""
        result = await self.db.execute(
            select(MeetingSummary)
            .where(MeetingSummary.meeting_id == meeting_id)
            .order_by(MeetingSummary.created_at.desc())
        )
        return result.scalar_one_or_none()

    async def list_summaries(
        self,
        user_id: Optional[UUID] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 20
    ) -> List[MeetingSummary]:
        """List meeting summaries with filters"""
        query = select(MeetingSummary).where(
            MeetingSummary.status == 'completed'
        )

        if start_date:
            query = query.where(MeetingSummary.meeting_date >= start_date)
        if end_date:
            query = query.where(MeetingSummary.meeting_date <= end_date)

        query = query.order_by(MeetingSummary.meeting_date.desc())
        query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update_summary(
        self,
        summary_id: UUID,
        **kwargs
    ) -> Optional[MeetingSummary]:
        """Update a meeting summary"""
        summary = await self.get_summary(summary_id)
        if not summary:
            return None

        for key, value in kwargs.items():
            if hasattr(summary, key):
                setattr(summary, key, value)

        await self.db.commit()
        await self.db.refresh(summary)
        return summary

    async def share_summary(
        self,
        summary_id: UUID,
        user_ids: List[UUID]
    ) -> bool:
        """Share summary with users"""
        result = await self.db.execute(
            update(MeetingSummary)
            .where(MeetingSummary.id == summary_id)
            .values(
                is_shared=True,
                shared_with=[str(uid) for uid in user_ids]
            )
        )
        await self.db.commit()
        return result.rowcount > 0

    # ═══════════════════════════════════════════════════════════════════
    # Action Items
    # ═══════════════════════════════════════════════════════════════════

    async def create_action_item(
        self,
        summary_id: UUID,
        meeting_id: UUID,
        title: str,
        description: Optional[str] = None,
        priority: str = 'medium',
        assignee_id: Optional[UUID] = None,
        assignee_name: Optional[str] = None,
        assignee_email: Optional[str] = None,
        due_date: Optional[datetime] = None,
        is_due_date_ai_suggested: bool = False,
        context: Optional[str] = None,
        timestamp_start: Optional[int] = None,
        confidence_score: int = 80
    ) -> MeetingActionItem:
        """Create an action item"""
        action_item = MeetingActionItem(
            summary_id=summary_id,
            meeting_id=meeting_id,
            title=title,
            description=description,
            priority=priority,
            assignee_id=assignee_id,
            assignee_name=assignee_name,
            assignee_email=assignee_email,
            due_date=due_date,
            is_due_date_ai_suggested=is_due_date_ai_suggested,
            context=context,
            timestamp_start=timestamp_start,
            confidence_score=confidence_score,
            status='open'
        )

        self.db.add(action_item)
        await self.db.commit()
        await self.db.refresh(action_item)
        return action_item

    async def get_action_items(
        self,
        meeting_id: Optional[UUID] = None,
        summary_id: Optional[UUID] = None,
        assignee_id: Optional[UUID] = None,
        status: Optional[str] = None
    ) -> List[MeetingActionItem]:
        """Get action items with filters"""
        query = select(MeetingActionItem)

        if meeting_id:
            query = query.where(MeetingActionItem.meeting_id == meeting_id)
        if summary_id:
            query = query.where(MeetingActionItem.summary_id == summary_id)
        if assignee_id:
            query = query.where(MeetingActionItem.assignee_id == assignee_id)
        if status:
            query = query.where(MeetingActionItem.status == status)

        query = query.order_by(MeetingActionItem.created_at.desc())

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update_action_item(
        self,
        action_item_id: UUID,
        **kwargs
    ) -> Optional[MeetingActionItem]:
        """Update an action item"""
        result = await self.db.execute(
            select(MeetingActionItem).where(
                MeetingActionItem.id == action_item_id
            )
        )
        action_item = result.scalar_one_or_none()

        if not action_item:
            return None

        for key, value in kwargs.items():
            if hasattr(action_item, key):
                setattr(action_item, key, value)

        if kwargs.get('status') == 'completed':
            action_item.completed_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(action_item)
        return action_item

    async def complete_action_item(self, action_item_id: UUID) -> bool:
        """Mark action item as completed"""
        result = await self.db.execute(
            update(MeetingActionItem)
            .where(MeetingActionItem.id == action_item_id)
            .values(
                status='completed',
                completed_at=datetime.utcnow()
            )
        )
        await self.db.commit()
        return result.rowcount > 0

    async def get_my_action_items(
        self,
        user_id: UUID,
        include_completed: bool = False
    ) -> List[MeetingActionItem]:
        """Get action items assigned to a user"""
        query = select(MeetingActionItem).where(
            MeetingActionItem.assignee_id == user_id
        )

        if not include_completed:
            query = query.where(
                MeetingActionItem.status.in_(['open', 'in_progress'])
            )

        query = query.order_by(
            MeetingActionItem.due_date.asc().nullslast(),
            MeetingActionItem.priority.desc()
        )

        result = await self.db.execute(query)
        return list(result.scalars().all())

    # ═══════════════════════════════════════════════════════════════════
    # Meeting Highlights
    # ═══════════════════════════════════════════════════════════════════

    async def create_highlight(
        self,
        meeting_id: UUID,
        highlight_type: str,
        content: str,
        title: Optional[str] = None,
        summary_id: Optional[UUID] = None,
        timestamp_seconds: Optional[int] = None,
        participants: Optional[List[Dict]] = None,
        confidence_score: int = 80
    ) -> MeetingHighlight:
        """Create a meeting highlight"""
        highlight = MeetingHighlight(
            meeting_id=meeting_id,
            summary_id=summary_id,
            highlight_type=highlight_type,
            title=title,
            content=content,
            timestamp_seconds=timestamp_seconds,
            participants=participants or [],
            confidence_score=confidence_score,
            is_ai_generated=True
        )

        self.db.add(highlight)
        await self.db.commit()
        await self.db.refresh(highlight)
        return highlight

    async def get_meeting_highlights(
        self,
        meeting_id: UUID,
        highlight_type: Optional[str] = None
    ) -> List[MeetingHighlight]:
        """Get highlights for a meeting"""
        query = select(MeetingHighlight).where(
            MeetingHighlight.meeting_id == meeting_id
        )

        if highlight_type:
            query = query.where(
                MeetingHighlight.highlight_type == highlight_type
            )

        query = query.order_by(MeetingHighlight.timestamp_seconds.asc().nullslast())

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def bookmark_highlight(
        self,
        highlight_id: UUID,
        user_id: UUID
    ) -> bool:
        """Bookmark a highlight"""
        result = await self.db.execute(
            select(MeetingHighlight).where(
                MeetingHighlight.id == highlight_id
            )
        )
        highlight = result.scalar_one_or_none()

        if not highlight:
            return False

        bookmarked = highlight.bookmarked_by or []
        user_str = str(user_id)

        if user_str not in bookmarked:
            bookmarked.append(user_str)

        await self.db.execute(
            update(MeetingHighlight)
            .where(MeetingHighlight.id == highlight_id)
            .values(
                is_bookmarked=True,
                bookmarked_by=bookmarked
            )
        )
        await self.db.commit()
        return True

    # ═══════════════════════════════════════════════════════════════════
    # AI Analysis (placeholder for actual AI integration)
    # ═══════════════════════════════════════════════════════════════════

    async def analyze_transcript(
        self,
        meeting_id: UUID,
        transcript: str,
        participants: List[Dict]
    ) -> MeetingSummary:
        """
        Analyze meeting transcript and generate summary.
        This is a placeholder - in production, integrate with AI service.
        """
        # Create pending summary
        summary = MeetingSummary(
            meeting_id=meeting_id,
            status='processing',
            source_type='transcript',
            meeting_date=datetime.utcnow()
        )
        self.db.add(summary)
        await self.db.commit()
        await self.db.refresh(summary)

        try:
            # In production: Call AI service here
            # For now, create placeholder analysis
            analysis = self._mock_analyze_transcript(transcript, participants)

            summary.title = analysis['title']
            summary.summary = analysis['summary']
            summary.key_points = analysis['key_points']
            summary.decisions = analysis['decisions']
            summary.topics = analysis['topics']
            summary.overall_sentiment = analysis['sentiment']
            summary.engagement_score = analysis['engagement_score']
            summary.status = 'completed'
            summary.ai_model = 'placeholder'

            await self.db.commit()
            await self.db.refresh(summary)

            # Create action items
            for action in analysis.get('action_items', []):
                await self.create_action_item(
                    summary_id=summary.id,
                    meeting_id=meeting_id,
                    title=action['title'],
                    description=action.get('description'),
                    assignee_name=action.get('assignee'),
                    priority=action.get('priority', 'medium'),
                    confidence_score=action.get('confidence', 70)
                )

            # Create highlights
            for highlight in analysis.get('highlights', []):
                await self.create_highlight(
                    meeting_id=meeting_id,
                    summary_id=summary.id,
                    highlight_type=highlight['type'],
                    content=highlight['content'],
                    title=highlight.get('title'),
                    timestamp_seconds=highlight.get('timestamp'),
                    confidence_score=highlight.get('confidence', 70)
                )

            return summary

        except Exception as e:
            summary.status = 'failed'
            summary.error_message = str(e)
            await self.db.commit()
            raise

    def _mock_analyze_transcript(
        self,
        transcript: str,
        participants: List[Dict]
    ) -> Dict:
        """
        Mock transcript analysis for demonstration.
        Replace with actual AI service integration.
        """
        word_count = len(transcript.split())
        participant_names = [p.get('name', 'Unknown') for p in participants]

        return {
            'title': 'Meeting Summary',
            'summary': f'This meeting included {len(participants)} participants and covered multiple topics.',
            'key_points': [
                'Discussion of project timeline',
                'Review of current progress',
                'Planning for next steps'
            ],
            'decisions': [
                'Proceed with proposed approach',
                'Schedule follow-up meeting'
            ],
            'topics': [
                {'topic': 'Project Update', 'duration_minutes': 15},
                {'topic': 'Planning', 'duration_minutes': 10},
                {'topic': 'Q&A', 'duration_minutes': 5}
            ],
            'sentiment': 'positive',
            'engagement_score': 75,
            'action_items': [
                {
                    'title': 'Review project documentation',
                    'assignee': participant_names[0] if participant_names else None,
                    'priority': 'medium',
                    'confidence': 80
                }
            ],
            'highlights': [
                {
                    'type': 'decision',
                    'title': 'Approach Approved',
                    'content': 'Team agreed to proceed with the proposed approach',
                    'confidence': 85
                }
            ]
        }

    async def get_pending_analyses(self) -> List[MeetingSummary]:
        """Get summaries pending analysis"""
        result = await self.db.execute(
            select(MeetingSummary).where(
                MeetingSummary.status.in_(['pending', 'processing'])
            )
        )
        return list(result.scalars().all())
