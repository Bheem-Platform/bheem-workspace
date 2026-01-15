"""
Bheem Workspace - Meet Enhancements API
Endpoints for breakout rooms, polls, Q&A, and whiteboard
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel
from datetime import datetime

from core.database import get_db
from services.meet_enhancement_service import (
    BreakoutRoomService,
    MeetingPollService,
    MeetingQAService,
    MeetingWhiteboardService
)

router = APIRouter(prefix="/meet", tags=["Meet Enhancements"])


# =============================================
# Request/Response Models
# =============================================

# Breakout Rooms
class CreateBreakoutRoomsRequest(BaseModel):
    rooms: List[Dict[str, str]]  # [{"name": "Room 1"}, {"name": "Room 2"}]
    duration_minutes: Optional[int] = None


class AssignParticipantRequest(BaseModel):
    participant_id: UUID
    assignment_type: str = "manual"


class AutoAssignRequest(BaseModel):
    participant_ids: List[UUID]


class BreakoutRoomResponse(BaseModel):
    id: UUID
    meeting_id: UUID
    name: str
    room_index: int
    status: str
    duration_minutes: Optional[int]
    started_at: Optional[datetime]
    ended_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


# Polls
class CreatePollRequest(BaseModel):
    question: str
    options: List[Dict[str, str]]  # [{"text": "Option 1"}, {"text": "Option 2"}]
    poll_type: str = "single"  # single, multiple
    is_anonymous: bool = False


class VoteRequest(BaseModel):
    selected_options: List[int]


class PollResponse(BaseModel):
    id: UUID
    meeting_id: UUID
    question: str
    poll_type: str
    options: List[Dict[str, str]]
    is_anonymous: bool
    status: str
    results: Optional[Dict[str, Any]]
    created_at: datetime
    started_at: Optional[datetime]
    ended_at: Optional[datetime]

    class Config:
        from_attributes = True


# Q&A
class AskQuestionRequest(BaseModel):
    question: str
    is_anonymous: bool = False


class AnswerQuestionRequest(BaseModel):
    answer: str


class QAResponse(BaseModel):
    id: UUID
    meeting_id: UUID
    question: str
    asked_by_name: Optional[str]
    is_anonymous: bool
    upvote_count: int
    is_answered: bool
    answer: Optional[str]
    answered_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


# Whiteboard
class CreateWhiteboardRequest(BaseModel):
    name: str = "Whiteboard"
    background_color: str = "#ffffff"
    grid_enabled: bool = False


class UpdateWhiteboardPageRequest(BaseModel):
    page_index: int
    page_data: Dict[str, Any]


class UpdateWhiteboardSettingsRequest(BaseModel):
    name: Optional[str] = None
    background_color: Optional[str] = None
    grid_enabled: Optional[bool] = None


class WhiteboardResponse(BaseModel):
    id: UUID
    meeting_id: UUID
    name: str
    pages: List[Dict[str, Any]]
    background_color: str
    grid_enabled: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# =============================================
# Breakout Rooms
# =============================================

@router.post("/meetings/{meeting_id}/breakout-rooms")
async def create_breakout_rooms(
    meeting_id: UUID,
    request: CreateBreakoutRoomsRequest,
    db: AsyncSession = Depends(get_db)
):
    """Create breakout rooms for a meeting"""
    service = BreakoutRoomService(db)
    rooms = await service.create_breakout_rooms(
        meeting_id=meeting_id,
        rooms=request.rooms,
        duration_minutes=request.duration_minutes
    )
    return {"rooms": rooms}


@router.get("/meetings/{meeting_id}/breakout-rooms")
async def list_breakout_rooms(
    meeting_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get all breakout rooms for a meeting"""
    service = BreakoutRoomService(db)
    rooms = await service.get_breakout_rooms(meeting_id)
    return {"rooms": rooms}


@router.get("/breakout-rooms/{room_id}", response_model=BreakoutRoomResponse)
async def get_breakout_room(
    room_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific breakout room"""
    service = BreakoutRoomService(db)
    room = await service.get_breakout_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Breakout room not found")
    return room


@router.post("/breakout-rooms/{room_id}/assign")
async def assign_participant(
    room_id: UUID,
    request: AssignParticipantRequest,
    db: AsyncSession = Depends(get_db)
):
    """Assign a participant to a breakout room"""
    service = BreakoutRoomService(db)
    assignment = await service.assign_participant(
        room_id=room_id,
        participant_id=request.participant_id,
        assignment_type=request.assignment_type
    )
    if not assignment:
        raise HTTPException(
            status_code=400,
            detail="Participant already assigned to this room"
        )
    return {"status": "assigned", "assignment_id": str(assignment.id)}


@router.post("/meetings/{meeting_id}/breakout-rooms/auto-assign")
async def auto_assign_participants(
    meeting_id: UUID,
    request: AutoAssignRequest,
    db: AsyncSession = Depends(get_db)
):
    """Automatically distribute participants across breakout rooms"""
    service = BreakoutRoomService(db)
    assignments = await service.auto_assign_participants(
        meeting_id=meeting_id,
        participant_ids=request.participant_ids
    )
    return {
        "assigned": len(assignments),
        "assignments": {str(k): str(v) for k, v in assignments.items()}
    }


@router.post("/meetings/{meeting_id}/breakout-rooms/start")
async def start_breakout_rooms(
    meeting_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Start all breakout rooms for a meeting"""
    service = BreakoutRoomService(db)
    rooms = await service.start_breakout_rooms(meeting_id)
    return {"status": "started", "rooms": rooms}


@router.post("/meetings/{meeting_id}/breakout-rooms/close")
async def close_breakout_rooms(
    meeting_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Close all breakout rooms and return to main meeting"""
    service = BreakoutRoomService(db)
    rooms = await service.close_breakout_rooms(meeting_id)
    return {"status": "closed", "rooms": rooms}


@router.post("/breakout-rooms/{room_id}/join")
async def join_breakout_room(
    room_id: UUID,
    participant_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Record participant joining a breakout room"""
    service = BreakoutRoomService(db)
    success = await service.participant_join_room(room_id, participant_id)
    if not success:
        raise HTTPException(
            status_code=404,
            detail="Assignment not found"
        )
    return {"status": "joined"}


@router.post("/breakout-rooms/{room_id}/leave")
async def leave_breakout_room(
    room_id: UUID,
    participant_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Record participant leaving a breakout room"""
    service = BreakoutRoomService(db)
    success = await service.participant_leave_room(room_id, participant_id)
    if not success:
        raise HTTPException(
            status_code=404,
            detail="Assignment not found"
        )
    return {"status": "left"}


@router.delete("/meetings/{meeting_id}/breakout-rooms")
async def delete_breakout_rooms(
    meeting_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Delete all breakout rooms for a meeting"""
    service = BreakoutRoomService(db)
    count = await service.delete_breakout_rooms(meeting_id)
    return {"deleted": count}


# =============================================
# Polls
# =============================================

@router.post("/meetings/{meeting_id}/polls", response_model=PollResponse)
async def create_poll(
    meeting_id: UUID,
    request: CreatePollRequest,
    created_by: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Create a new poll"""
    service = MeetingPollService(db)
    poll = await service.create_poll(
        meeting_id=meeting_id,
        created_by=created_by,
        question=request.question,
        options=request.options,
        poll_type=request.poll_type,
        is_anonymous=request.is_anonymous
    )
    return poll


@router.get("/meetings/{meeting_id}/polls")
async def list_polls(
    meeting_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """List all polls for a meeting"""
    service = MeetingPollService(db)
    polls = await service.list_meeting_polls(meeting_id)
    return {"polls": polls}


@router.get("/polls/{poll_id}", response_model=PollResponse)
async def get_poll(
    poll_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific poll"""
    service = MeetingPollService(db)
    poll = await service.get_poll(poll_id)
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")
    return poll


@router.post("/polls/{poll_id}/start", response_model=PollResponse)
async def start_poll(
    poll_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Start a poll for voting"""
    service = MeetingPollService(db)
    poll = await service.start_poll(poll_id)
    if not poll:
        raise HTTPException(
            status_code=400,
            detail="Poll not found or already started"
        )
    return poll


@router.post("/polls/{poll_id}/close", response_model=PollResponse)
async def close_poll(
    poll_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Close a poll and calculate results"""
    service = MeetingPollService(db)
    poll = await service.close_poll(poll_id)
    if not poll:
        raise HTTPException(
            status_code=400,
            detail="Poll not found or not active"
        )
    return poll


@router.post("/polls/{poll_id}/vote")
async def vote_on_poll(
    poll_id: UUID,
    request: VoteRequest,
    participant_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Submit a vote on a poll"""
    service = MeetingPollService(db)
    try:
        vote = await service.vote(
            poll_id=poll_id,
            participant_id=participant_id,
            selected_options=request.selected_options
        )
        if not vote:
            raise HTTPException(
                status_code=400,
                detail="Already voted or poll not active"
            )
        return {"status": "voted", "vote_id": str(vote.id)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/polls/{poll_id}")
async def delete_poll(
    poll_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Delete a poll"""
    service = MeetingPollService(db)
    success = await service.delete_poll(poll_id)
    if not success:
        raise HTTPException(status_code=404, detail="Poll not found")
    return {"status": "deleted"}


# =============================================
# Q&A
# =============================================

@router.post("/meetings/{meeting_id}/qa", response_model=QAResponse)
async def ask_question(
    meeting_id: UUID,
    request: AskQuestionRequest,
    asked_by: Optional[UUID] = None,
    asked_by_name: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Ask a question in the Q&A"""
    service = MeetingQAService(db)
    qa = await service.ask_question(
        meeting_id=meeting_id,
        question=request.question,
        asked_by=asked_by,
        asked_by_name=asked_by_name,
        is_anonymous=request.is_anonymous
    )
    return qa


@router.get("/meetings/{meeting_id}/qa")
async def list_questions(
    meeting_id: UUID,
    answered_only: bool = False,
    unanswered_only: bool = False,
    order_by: str = "upvotes",
    db: AsyncSession = Depends(get_db)
):
    """List all Q&A questions for a meeting"""
    service = MeetingQAService(db)
    questions = await service.list_questions(
        meeting_id=meeting_id,
        answered_only=answered_only,
        unanswered_only=unanswered_only,
        order_by=order_by
    )
    return {"questions": questions}


@router.get("/qa/{question_id}", response_model=QAResponse)
async def get_question(
    question_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific question"""
    service = MeetingQAService(db)
    question = await service.get_question(question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    return question


@router.post("/qa/{question_id}/upvote")
async def upvote_question(
    question_id: UUID,
    participant_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Upvote a question"""
    service = MeetingQAService(db)
    success = await service.upvote_question(question_id, participant_id)
    if not success:
        raise HTTPException(
            status_code=400,
            detail="Already upvoted this question"
        )
    return {"status": "upvoted"}


@router.delete("/qa/{question_id}/upvote")
async def remove_upvote(
    question_id: UUID,
    participant_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Remove upvote from a question"""
    service = MeetingQAService(db)
    success = await service.remove_upvote(question_id, participant_id)
    if not success:
        raise HTTPException(
            status_code=400,
            detail="No upvote to remove"
        )
    return {"status": "upvote_removed"}


@router.post("/qa/{question_id}/answer", response_model=QAResponse)
async def answer_question(
    question_id: UUID,
    request: AnswerQuestionRequest,
    answered_by: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Answer a question"""
    service = MeetingQAService(db)
    question = await service.answer_question(
        question_id=question_id,
        answer=request.answer,
        answered_by=answered_by
    )
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    return question


@router.delete("/qa/{question_id}")
async def delete_question(
    question_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Delete a question"""
    service = MeetingQAService(db)
    success = await service.delete_question(question_id)
    if not success:
        raise HTTPException(status_code=404, detail="Question not found")
    return {"status": "deleted"}


# =============================================
# Whiteboard
# =============================================

@router.post("/meetings/{meeting_id}/whiteboards", response_model=WhiteboardResponse)
async def create_whiteboard(
    meeting_id: UUID,
    request: CreateWhiteboardRequest,
    created_by: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Create a new whiteboard"""
    service = MeetingWhiteboardService(db)
    whiteboard = await service.create_whiteboard(
        meeting_id=meeting_id,
        created_by=created_by,
        name=request.name,
        background_color=request.background_color,
        grid_enabled=request.grid_enabled
    )
    return whiteboard


@router.get("/meetings/{meeting_id}/whiteboards")
async def list_whiteboards(
    meeting_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """List all whiteboards for a meeting"""
    service = MeetingWhiteboardService(db)
    whiteboards = await service.list_meeting_whiteboards(meeting_id)
    return {"whiteboards": whiteboards}


@router.get("/whiteboards/{whiteboard_id}", response_model=WhiteboardResponse)
async def get_whiteboard(
    whiteboard_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific whiteboard"""
    service = MeetingWhiteboardService(db)
    whiteboard = await service.get_whiteboard(whiteboard_id)
    if not whiteboard:
        raise HTTPException(status_code=404, detail="Whiteboard not found")
    return whiteboard


@router.put("/whiteboards/{whiteboard_id}/pages", response_model=WhiteboardResponse)
async def update_whiteboard_page(
    whiteboard_id: UUID,
    request: UpdateWhiteboardPageRequest,
    db: AsyncSession = Depends(get_db)
):
    """Update a whiteboard page"""
    service = MeetingWhiteboardService(db)
    whiteboard = await service.update_whiteboard_page(
        whiteboard_id=whiteboard_id,
        page_index=request.page_index,
        page_data=request.page_data
    )
    if not whiteboard:
        raise HTTPException(status_code=404, detail="Whiteboard not found")
    return whiteboard


@router.post("/whiteboards/{whiteboard_id}/pages", response_model=WhiteboardResponse)
async def add_whiteboard_page(
    whiteboard_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Add a new page to a whiteboard"""
    service = MeetingWhiteboardService(db)
    whiteboard = await service.add_whiteboard_page(whiteboard_id)
    if not whiteboard:
        raise HTTPException(status_code=404, detail="Whiteboard not found")
    return whiteboard


@router.delete("/whiteboards/{whiteboard_id}/pages/{page_index}", response_model=WhiteboardResponse)
async def delete_whiteboard_page(
    whiteboard_id: UUID,
    page_index: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete a page from a whiteboard"""
    service = MeetingWhiteboardService(db)
    whiteboard = await service.delete_whiteboard_page(whiteboard_id, page_index)
    if not whiteboard:
        raise HTTPException(status_code=404, detail="Whiteboard not found")
    return whiteboard


@router.patch("/whiteboards/{whiteboard_id}/settings", response_model=WhiteboardResponse)
async def update_whiteboard_settings(
    whiteboard_id: UUID,
    request: UpdateWhiteboardSettingsRequest,
    db: AsyncSession = Depends(get_db)
):
    """Update whiteboard settings"""
    service = MeetingWhiteboardService(db)
    whiteboard = await service.update_settings(
        whiteboard_id=whiteboard_id,
        **request.model_dump(exclude_unset=True)
    )
    if not whiteboard:
        raise HTTPException(status_code=404, detail="Whiteboard not found")
    return whiteboard


@router.delete("/whiteboards/{whiteboard_id}")
async def delete_whiteboard(
    whiteboard_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Delete a whiteboard"""
    service = MeetingWhiteboardService(db)
    success = await service.delete_whiteboard(whiteboard_id)
    if not success:
        raise HTTPException(status_code=404, detail="Whiteboard not found")
    return {"status": "deleted"}


@router.get("/whiteboards/{whiteboard_id}/export")
async def export_whiteboard(
    whiteboard_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Export whiteboard data"""
    service = MeetingWhiteboardService(db)
    data = await service.export_whiteboard(whiteboard_id)
    if not data:
        raise HTTPException(status_code=404, detail="Whiteboard not found")
    return data
