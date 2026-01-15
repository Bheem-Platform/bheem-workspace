"""
Bheem Workspace - Meet Enhancement Service
Business logic for breakout rooms, polls, Q&A, and whiteboard
"""
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, func
from sqlalchemy.orm import selectinload

from models.meet_enhancements import (
    BreakoutRoom, BreakoutParticipant,
    MeetingPoll, MeetingPollVote,
    MeetingQA, MeetingQAUpvote,
    MeetingWhiteboard
)


class BreakoutRoomService:
    """Service for managing meeting breakout rooms"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_breakout_rooms(
        self,
        meeting_id: UUID,
        rooms: List[Dict[str, Any]],
        duration_minutes: Optional[int] = None
    ) -> List[BreakoutRoom]:
        """Create multiple breakout rooms for a meeting"""
        created_rooms = []

        for i, room_data in enumerate(rooms):
            room = BreakoutRoom(
                meeting_id=meeting_id,
                name=room_data.get('name', f'Room {i + 1}'),
                room_index=i,
                duration_minutes=duration_minutes,
                status='waiting'
            )
            self.db.add(room)
            created_rooms.append(room)

        await self.db.commit()

        for room in created_rooms:
            await self.db.refresh(room)

        return created_rooms

    async def get_breakout_rooms(
        self,
        meeting_id: UUID
    ) -> List[BreakoutRoom]:
        """Get all breakout rooms for a meeting"""
        result = await self.db.execute(
            select(BreakoutRoom)
            .options(selectinload(BreakoutRoom.participants))
            .where(BreakoutRoom.meeting_id == meeting_id)
            .order_by(BreakoutRoom.room_index)
        )
        return list(result.scalars().all())

    async def get_breakout_room(
        self,
        room_id: UUID
    ) -> Optional[BreakoutRoom]:
        """Get a specific breakout room"""
        result = await self.db.execute(
            select(BreakoutRoom)
            .options(selectinload(BreakoutRoom.participants))
            .where(BreakoutRoom.id == room_id)
        )
        return result.scalar_one_or_none()

    async def assign_participant(
        self,
        room_id: UUID,
        participant_id: UUID,
        assignment_type: str = 'manual'
    ) -> Optional[BreakoutParticipant]:
        """Assign a participant to a breakout room"""
        # Check if already assigned to this room
        existing = await self.db.execute(
            select(BreakoutParticipant).where(
                BreakoutParticipant.breakout_room_id == room_id,
                BreakoutParticipant.participant_id == participant_id
            )
        )
        if existing.scalar_one_or_none():
            return None

        assignment = BreakoutParticipant(
            breakout_room_id=room_id,
            participant_id=participant_id,
            assignment_type=assignment_type
        )

        self.db.add(assignment)
        await self.db.commit()
        await self.db.refresh(assignment)
        return assignment

    async def auto_assign_participants(
        self,
        meeting_id: UUID,
        participant_ids: List[UUID]
    ) -> Dict[UUID, UUID]:
        """Automatically distribute participants across breakout rooms"""
        rooms = await self.get_breakout_rooms(meeting_id)
        if not rooms:
            return {}

        assignments = {}
        room_count = len(rooms)

        for i, participant_id in enumerate(participant_ids):
            room = rooms[i % room_count]
            await self.assign_participant(
                room.id, participant_id, 'auto'
            )
            assignments[participant_id] = room.id

        return assignments

    async def start_breakout_rooms(
        self,
        meeting_id: UUID
    ) -> List[BreakoutRoom]:
        """Start all breakout rooms for a meeting"""
        await self.db.execute(
            update(BreakoutRoom)
            .where(
                BreakoutRoom.meeting_id == meeting_id,
                BreakoutRoom.status == 'waiting'
            )
            .values(
                status='active',
                started_at=datetime.utcnow()
            )
        )
        await self.db.commit()
        return await self.get_breakout_rooms(meeting_id)

    async def close_breakout_rooms(
        self,
        meeting_id: UUID
    ) -> List[BreakoutRoom]:
        """Close all breakout rooms and return participants to main room"""
        await self.db.execute(
            update(BreakoutRoom)
            .where(
                BreakoutRoom.meeting_id == meeting_id,
                BreakoutRoom.status == 'active'
            )
            .values(
                status='closed',
                ended_at=datetime.utcnow()
            )
        )
        await self.db.commit()
        return await self.get_breakout_rooms(meeting_id)

    async def participant_join_room(
        self,
        room_id: UUID,
        participant_id: UUID
    ) -> bool:
        """Record when a participant joins a breakout room"""
        result = await self.db.execute(
            update(BreakoutParticipant)
            .where(
                BreakoutParticipant.breakout_room_id == room_id,
                BreakoutParticipant.participant_id == participant_id
            )
            .values(joined_at=datetime.utcnow())
        )
        await self.db.commit()
        return result.rowcount > 0

    async def participant_leave_room(
        self,
        room_id: UUID,
        participant_id: UUID
    ) -> bool:
        """Record when a participant leaves a breakout room"""
        result = await self.db.execute(
            update(BreakoutParticipant)
            .where(
                BreakoutParticipant.breakout_room_id == room_id,
                BreakoutParticipant.participant_id == participant_id
            )
            .values(left_at=datetime.utcnow())
        )
        await self.db.commit()
        return result.rowcount > 0

    async def delete_breakout_rooms(
        self,
        meeting_id: UUID
    ) -> int:
        """Delete all breakout rooms for a meeting"""
        result = await self.db.execute(
            delete(BreakoutRoom).where(
                BreakoutRoom.meeting_id == meeting_id
            )
        )
        await self.db.commit()
        return result.rowcount


class MeetingPollService:
    """Service for managing meeting polls"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_poll(
        self,
        meeting_id: UUID,
        created_by: UUID,
        question: str,
        options: List[Dict[str, str]],
        poll_type: str = 'single',
        is_anonymous: bool = False
    ) -> MeetingPoll:
        """Create a new poll"""
        poll = MeetingPoll(
            meeting_id=meeting_id,
            created_by=created_by,
            question=question,
            options=options,
            poll_type=poll_type,
            is_anonymous=is_anonymous,
            status='draft'
        )

        self.db.add(poll)
        await self.db.commit()
        await self.db.refresh(poll)
        return poll

    async def get_poll(
        self,
        poll_id: UUID
    ) -> Optional[MeetingPoll]:
        """Get a poll by ID"""
        result = await self.db.execute(
            select(MeetingPoll)
            .options(selectinload(MeetingPoll.votes))
            .where(MeetingPoll.id == poll_id)
        )
        return result.scalar_one_or_none()

    async def list_meeting_polls(
        self,
        meeting_id: UUID
    ) -> List[MeetingPoll]:
        """List all polls for a meeting"""
        result = await self.db.execute(
            select(MeetingPoll)
            .where(MeetingPoll.meeting_id == meeting_id)
            .order_by(MeetingPoll.created_at.desc())
        )
        return list(result.scalars().all())

    async def start_poll(
        self,
        poll_id: UUID
    ) -> Optional[MeetingPoll]:
        """Start a poll (make it active for voting)"""
        poll = await self.get_poll(poll_id)
        if not poll or poll.status != 'draft':
            return None

        poll.status = 'active'
        poll.started_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(poll)
        return poll

    async def close_poll(
        self,
        poll_id: UUID
    ) -> Optional[MeetingPoll]:
        """Close a poll and calculate results"""
        poll = await self.get_poll(poll_id)
        if not poll or poll.status != 'active':
            return None

        # Calculate results
        results = await self._calculate_results(poll)

        poll.status = 'closed'
        poll.ended_at = datetime.utcnow()
        poll.results = results
        await self.db.commit()
        await self.db.refresh(poll)
        return poll

    async def _calculate_results(
        self,
        poll: MeetingPoll
    ) -> Dict[str, Any]:
        """Calculate poll results"""
        total_votes = len(poll.votes) if poll.votes else 0
        option_counts = {}

        for i, option in enumerate(poll.options):
            option_counts[i] = 0

        for vote in poll.votes:
            for option_idx in vote.selected_options:
                if option_idx in option_counts:
                    option_counts[option_idx] += 1

        return {
            'total_votes': total_votes,
            'option_counts': option_counts,
            'percentages': {
                k: round(v / total_votes * 100, 1) if total_votes > 0 else 0
                for k, v in option_counts.items()
            }
        }

    async def vote(
        self,
        poll_id: UUID,
        participant_id: UUID,
        selected_options: List[int]
    ) -> Optional[MeetingPollVote]:
        """Submit a vote on a poll"""
        poll = await self.get_poll(poll_id)
        if not poll or poll.status != 'active':
            return None

        # Check if already voted
        existing = await self.db.execute(
            select(MeetingPollVote).where(
                MeetingPollVote.poll_id == poll_id,
                MeetingPollVote.participant_id == participant_id
            )
        )
        if existing.scalar_one_or_none():
            return None  # Already voted

        # Validate options
        if poll.poll_type == 'single' and len(selected_options) > 1:
            raise ValueError("Single choice poll allows only one selection")

        for idx in selected_options:
            if idx < 0 or idx >= len(poll.options):
                raise ValueError(f"Invalid option index: {idx}")

        vote = MeetingPollVote(
            poll_id=poll_id,
            participant_id=participant_id,
            selected_options=selected_options
        )

        self.db.add(vote)
        await self.db.commit()
        await self.db.refresh(vote)
        return vote

    async def delete_poll(
        self,
        poll_id: UUID
    ) -> bool:
        """Delete a poll"""
        result = await self.db.execute(
            delete(MeetingPoll).where(MeetingPoll.id == poll_id)
        )
        await self.db.commit()
        return result.rowcount > 0


class MeetingQAService:
    """Service for managing meeting Q&A"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def ask_question(
        self,
        meeting_id: UUID,
        question: str,
        asked_by: Optional[UUID] = None,
        asked_by_name: Optional[str] = None,
        is_anonymous: bool = False
    ) -> MeetingQA:
        """Submit a question"""
        qa = MeetingQA(
            meeting_id=meeting_id,
            question=question,
            asked_by=None if is_anonymous else asked_by,
            asked_by_name=None if is_anonymous else asked_by_name,
            is_anonymous=is_anonymous
        )

        self.db.add(qa)
        await self.db.commit()
        await self.db.refresh(qa)
        return qa

    async def get_question(
        self,
        question_id: UUID
    ) -> Optional[MeetingQA]:
        """Get a specific question"""
        result = await self.db.execute(
            select(MeetingQA)
            .options(selectinload(MeetingQA.upvotes))
            .where(MeetingQA.id == question_id)
        )
        return result.scalar_one_or_none()

    async def list_questions(
        self,
        meeting_id: UUID,
        answered_only: bool = False,
        unanswered_only: bool = False,
        order_by: str = 'upvotes'
    ) -> List[MeetingQA]:
        """List questions for a meeting"""
        query = select(MeetingQA).where(MeetingQA.meeting_id == meeting_id)

        if answered_only:
            query = query.where(MeetingQA.is_answered == True)
        elif unanswered_only:
            query = query.where(MeetingQA.is_answered == False)

        if order_by == 'upvotes':
            query = query.order_by(MeetingQA.upvote_count.desc())
        else:
            query = query.order_by(MeetingQA.created_at.desc())

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def upvote_question(
        self,
        question_id: UUID,
        participant_id: UUID
    ) -> bool:
        """Upvote a question"""
        # Check if already upvoted
        existing = await self.db.execute(
            select(MeetingQAUpvote).where(
                MeetingQAUpvote.qa_id == question_id,
                MeetingQAUpvote.participant_id == participant_id
            )
        )
        if existing.scalar_one_or_none():
            return False  # Already upvoted

        upvote = MeetingQAUpvote(
            qa_id=question_id,
            participant_id=participant_id
        )
        self.db.add(upvote)

        # Increment count
        await self.db.execute(
            update(MeetingQA)
            .where(MeetingQA.id == question_id)
            .values(upvote_count=MeetingQA.upvote_count + 1)
        )

        await self.db.commit()
        return True

    async def remove_upvote(
        self,
        question_id: UUID,
        participant_id: UUID
    ) -> bool:
        """Remove an upvote from a question"""
        result = await self.db.execute(
            delete(MeetingQAUpvote).where(
                MeetingQAUpvote.qa_id == question_id,
                MeetingQAUpvote.participant_id == participant_id
            )
        )

        if result.rowcount > 0:
            # Decrement count
            await self.db.execute(
                update(MeetingQA)
                .where(MeetingQA.id == question_id)
                .values(upvote_count=MeetingQA.upvote_count - 1)
            )
            await self.db.commit()
            return True

        return False

    async def answer_question(
        self,
        question_id: UUID,
        answer: str,
        answered_by: UUID
    ) -> Optional[MeetingQA]:
        """Answer a question"""
        question = await self.get_question(question_id)
        if not question:
            return None

        question.answer = answer
        question.answered_by = answered_by
        question.answered_at = datetime.utcnow()
        question.is_answered = True

        await self.db.commit()
        await self.db.refresh(question)
        return question

    async def delete_question(
        self,
        question_id: UUID
    ) -> bool:
        """Delete a question"""
        result = await self.db.execute(
            delete(MeetingQA).where(MeetingQA.id == question_id)
        )
        await self.db.commit()
        return result.rowcount > 0


class MeetingWhiteboardService:
    """Service for managing meeting whiteboards"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_whiteboard(
        self,
        meeting_id: UUID,
        created_by: UUID,
        name: str = 'Whiteboard',
        background_color: str = '#ffffff',
        grid_enabled: bool = False
    ) -> MeetingWhiteboard:
        """Create a new whiteboard"""
        whiteboard = MeetingWhiteboard(
            meeting_id=meeting_id,
            created_by=created_by,
            name=name,
            pages=[{}],
            background_color=background_color,
            grid_enabled=grid_enabled
        )

        self.db.add(whiteboard)
        await self.db.commit()
        await self.db.refresh(whiteboard)
        return whiteboard

    async def get_whiteboard(
        self,
        whiteboard_id: UUID
    ) -> Optional[MeetingWhiteboard]:
        """Get a whiteboard by ID"""
        result = await self.db.execute(
            select(MeetingWhiteboard).where(
                MeetingWhiteboard.id == whiteboard_id
            )
        )
        return result.scalar_one_or_none()

    async def list_meeting_whiteboards(
        self,
        meeting_id: UUID
    ) -> List[MeetingWhiteboard]:
        """List all whiteboards for a meeting"""
        result = await self.db.execute(
            select(MeetingWhiteboard)
            .where(MeetingWhiteboard.meeting_id == meeting_id)
            .order_by(MeetingWhiteboard.created_at)
        )
        return list(result.scalars().all())

    async def update_whiteboard_page(
        self,
        whiteboard_id: UUID,
        page_index: int,
        page_data: Dict[str, Any]
    ) -> Optional[MeetingWhiteboard]:
        """Update a specific page of the whiteboard"""
        whiteboard = await self.get_whiteboard(whiteboard_id)
        if not whiteboard:
            return None

        pages = whiteboard.pages or [{}]

        # Extend pages list if needed
        while len(pages) <= page_index:
            pages.append({})

        pages[page_index] = page_data
        whiteboard.pages = pages
        whiteboard.updated_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(whiteboard)
        return whiteboard

    async def add_whiteboard_page(
        self,
        whiteboard_id: UUID
    ) -> Optional[MeetingWhiteboard]:
        """Add a new page to the whiteboard"""
        whiteboard = await self.get_whiteboard(whiteboard_id)
        if not whiteboard:
            return None

        pages = whiteboard.pages or []
        pages.append({})
        whiteboard.pages = pages
        whiteboard.updated_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(whiteboard)
        return whiteboard

    async def delete_whiteboard_page(
        self,
        whiteboard_id: UUID,
        page_index: int
    ) -> Optional[MeetingWhiteboard]:
        """Delete a page from the whiteboard"""
        whiteboard = await self.get_whiteboard(whiteboard_id)
        if not whiteboard:
            return None

        pages = whiteboard.pages or []
        if 0 <= page_index < len(pages) and len(pages) > 1:
            pages.pop(page_index)
            whiteboard.pages = pages
            whiteboard.updated_at = datetime.utcnow()
            await self.db.commit()
            await self.db.refresh(whiteboard)

        return whiteboard

    async def update_settings(
        self,
        whiteboard_id: UUID,
        name: Optional[str] = None,
        background_color: Optional[str] = None,
        grid_enabled: Optional[bool] = None
    ) -> Optional[MeetingWhiteboard]:
        """Update whiteboard settings"""
        whiteboard = await self.get_whiteboard(whiteboard_id)
        if not whiteboard:
            return None

        if name is not None:
            whiteboard.name = name
        if background_color is not None:
            whiteboard.background_color = background_color
        if grid_enabled is not None:
            whiteboard.grid_enabled = grid_enabled

        whiteboard.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(whiteboard)
        return whiteboard

    async def delete_whiteboard(
        self,
        whiteboard_id: UUID
    ) -> bool:
        """Delete a whiteboard"""
        result = await self.db.execute(
            delete(MeetingWhiteboard).where(
                MeetingWhiteboard.id == whiteboard_id
            )
        )
        await self.db.commit()
        return result.rowcount > 0

    async def export_whiteboard(
        self,
        whiteboard_id: UUID
    ) -> Optional[Dict[str, Any]]:
        """Export whiteboard data for saving/sharing"""
        whiteboard = await self.get_whiteboard(whiteboard_id)
        if not whiteboard:
            return None

        return {
            'name': whiteboard.name,
            'pages': whiteboard.pages,
            'background_color': whiteboard.background_color,
            'grid_enabled': whiteboard.grid_enabled,
            'exported_at': datetime.utcnow().isoformat()
        }
