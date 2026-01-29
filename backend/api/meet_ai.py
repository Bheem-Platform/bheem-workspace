"""
Bheem Workspace - Meeting AI API
API endpoints for AI-generated meeting summaries and action items
Phase 11: AI Meeting Summaries
"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from pydantic import BaseModel, Field

from core.database import get_db
from core.security import get_current_user
from services.meeting_ai_service import MeetingAIService

router = APIRouter(prefix="/meet/ai", tags=["Meet - AI"])


# =============================================
# Pydantic Schemas
# =============================================

class SummaryCreate(BaseModel):
    meeting_id: str
    title: str
    summary: str
    key_points: List[str] = []
    decisions: List[str] = []
    topics: List[dict] = []
    meeting_date: Optional[datetime] = None


class SummaryResponse(BaseModel):
    id: str
    meeting_id: str
    title: Optional[str]
    summary: Optional[str]
    key_points: List[str]
    decisions: List[str]
    topics: List[dict]
    overall_sentiment: Optional[str]
    engagement_score: Optional[int]
    status: str
    meeting_date: Optional[str]
    created_at: str


class ActionItemCreate(BaseModel):
    meeting_id: str
    summary_id: str
    title: str
    description: Optional[str] = None
    priority: str = Field('medium', pattern='^(low|medium|high|urgent)$')
    assignee_id: Optional[str] = None
    assignee_name: Optional[str] = None
    assignee_email: Optional[str] = None
    due_date: Optional[datetime] = None


class ActionItemResponse(BaseModel):
    id: str
    meeting_id: str
    title: str
    description: Optional[str]
    priority: str
    assignee_id: Optional[str]
    assignee_name: Optional[str]
    due_date: Optional[str]
    status: str
    completed_at: Optional[str]
    context: Optional[str]
    confidence_score: Optional[int]
    created_at: str


class ActionItemUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    assignee_id: Optional[str] = None
    assignee_name: Optional[str] = None
    due_date: Optional[datetime] = None
    status: Optional[str] = None


class HighlightResponse(BaseModel):
    id: str
    meeting_id: str
    highlight_type: str
    title: Optional[str]
    content: str
    timestamp_seconds: Optional[int]
    participants: List[dict]
    is_bookmarked: bool
    confidence_score: Optional[int]
    created_at: str


class AnalyzeRequest(BaseModel):
    meeting_id: str
    transcript: str
    participants: List[dict] = []


class ShareRequest(BaseModel):
    user_ids: List[str]


# =============================================
# Summary Endpoints
# =============================================

@router.post("/summaries", response_model=SummaryResponse, status_code=status.HTTP_201_CREATED)
async def create_summary(
    data: SummaryCreate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Create a meeting summary manually"""
    service = MeetingAIService(db)

    summary = await service.create_summary(
        meeting_id=UUID(data.meeting_id),
        title=data.title,
        summary=data.summary,
        key_points=data.key_points,
        decisions=data.decisions,
        topics=data.topics,
        meeting_date=data.meeting_date
    )

    return _summary_to_response(summary)


@router.get("/summaries", response_model=List[SummaryResponse])
async def list_summaries(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """List meeting summaries"""
    service = MeetingAIService(db)

    summaries = await service.list_summaries(
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=limit
    )

    return [_summary_to_response(s) for s in summaries]


@router.get("/summaries/{summary_id}", response_model=SummaryResponse)
async def get_summary(
    summary_id: UUID,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get a meeting summary"""
    service = MeetingAIService(db)

    summary = await service.get_summary(summary_id)

    if not summary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Summary not found"
        )

    return _summary_to_response(summary)


@router.get("/meetings/{meeting_id}/summary", response_model=Optional[SummaryResponse])
async def get_meeting_summary(
    meeting_id: UUID,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get summary for a specific meeting"""
    service = MeetingAIService(db)

    summary = await service.get_meeting_summary(meeting_id)

    if not summary:
        return None

    return _summary_to_response(summary)


@router.post("/summaries/{summary_id}/share")
async def share_summary(
    summary_id: UUID,
    data: ShareRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Share summary with users"""
    service = MeetingAIService(db)

    success = await service.share_summary(
        summary_id=summary_id,
        user_ids=[UUID(uid) for uid in data.user_ids]
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Summary not found"
        )

    return {"message": "Summary shared successfully"}


# =============================================
# Action Items Endpoints
# =============================================

@router.post("/action-items", response_model=ActionItemResponse, status_code=status.HTTP_201_CREATED)
async def create_action_item(
    data: ActionItemCreate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Create an action item"""
    service = MeetingAIService(db)

    action_item = await service.create_action_item(
        summary_id=UUID(data.summary_id),
        meeting_id=UUID(data.meeting_id),
        title=data.title,
        description=data.description,
        priority=data.priority,
        assignee_id=UUID(data.assignee_id) if data.assignee_id else None,
        assignee_name=data.assignee_name,
        assignee_email=data.assignee_email,
        due_date=data.due_date
    )

    return _action_item_to_response(action_item)


@router.get("/action-items", response_model=List[ActionItemResponse])
async def list_action_items(
    meeting_id: Optional[UUID] = None,
    summary_id: Optional[UUID] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """List action items"""
    service = MeetingAIService(db)

    items = await service.get_action_items(
        meeting_id=meeting_id,
        summary_id=summary_id,
        status=status
    )

    return [_action_item_to_response(i) for i in items]


@router.get("/action-items/my", response_model=List[ActionItemResponse])
async def get_my_action_items(
    include_completed: bool = Query(False),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get action items assigned to current user"""
    service = MeetingAIService(db)

    items = await service.get_my_action_items(
        user_id=current_user["user_id"],
        include_completed=include_completed
    )

    return [_action_item_to_response(i) for i in items]


@router.patch("/action-items/{action_item_id}", response_model=ActionItemResponse)
async def update_action_item(
    action_item_id: UUID,
    data: ActionItemUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Update an action item"""
    service = MeetingAIService(db)

    update_data = data.dict(exclude_unset=True)
    if 'assignee_id' in update_data and update_data['assignee_id']:
        update_data['assignee_id'] = UUID(update_data['assignee_id'])

    item = await service.update_action_item(
        action_item_id=action_item_id,
        **update_data
    )

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Action item not found"
        )

    return _action_item_to_response(item)


@router.post("/action-items/{action_item_id}/complete")
async def complete_action_item(
    action_item_id: UUID,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Mark action item as completed"""
    service = MeetingAIService(db)

    success = await service.complete_action_item(action_item_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Action item not found"
        )

    return {"message": "Action item completed"}


# =============================================
# Highlights Endpoints
# =============================================

@router.get("/meetings/{meeting_id}/highlights", response_model=List[HighlightResponse])
async def get_meeting_highlights(
    meeting_id: UUID,
    highlight_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get highlights for a meeting"""
    service = MeetingAIService(db)

    highlights = await service.get_meeting_highlights(
        meeting_id=meeting_id,
        highlight_type=highlight_type
    )

    return [_highlight_to_response(h) for h in highlights]


@router.post("/highlights/{highlight_id}/bookmark")
async def bookmark_highlight(
    highlight_id: UUID,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Bookmark a highlight"""
    service = MeetingAIService(db)

    success = await service.bookmark_highlight(
        highlight_id=highlight_id,
        user_id=current_user["user_id"]
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Highlight not found"
        )

    return {"message": "Highlight bookmarked"}


# =============================================
# AI Analysis Endpoints
# =============================================

@router.post("/analyze", response_model=SummaryResponse)
async def analyze_meeting(
    data: AnalyzeRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Analyze meeting transcript and generate summary"""
    service = MeetingAIService(db)

    summary = await service.analyze_transcript(
        meeting_id=UUID(data.meeting_id),
        transcript=data.transcript,
        participants=data.participants
    )

    return _summary_to_response(summary)


# =============================================
# Helper Functions
# =============================================

def _summary_to_response(summary) -> dict:
    return {
        "id": str(summary.id),
        "meeting_id": str(summary.meeting_id),
        "title": summary.title,
        "summary": summary.summary,
        "key_points": summary.key_points or [],
        "decisions": summary.decisions or [],
        "topics": summary.topics or [],
        "overall_sentiment": summary.overall_sentiment,
        "engagement_score": summary.engagement_score,
        "status": summary.status,
        "meeting_date": summary.meeting_date.isoformat() if summary.meeting_date else None,
        "created_at": summary.created_at.isoformat()
    }


def _action_item_to_response(item) -> dict:
    return {
        "id": str(item.id),
        "meeting_id": str(item.meeting_id),
        "title": item.title,
        "description": item.description,
        "priority": item.priority,
        "assignee_id": str(item.assignee_id) if item.assignee_id else None,
        "assignee_name": item.assignee_name,
        "due_date": item.due_date.isoformat() if item.due_date else None,
        "status": item.status,
        "completed_at": item.completed_at.isoformat() if item.completed_at else None,
        "context": item.context,
        "confidence_score": item.confidence_score,
        "created_at": item.created_at.isoformat()
    }


def _highlight_to_response(highlight) -> dict:
    return {
        "id": str(highlight.id),
        "meeting_id": str(highlight.meeting_id),
        "highlight_type": highlight.highlight_type,
        "title": highlight.title,
        "content": highlight.content,
        "timestamp_seconds": highlight.timestamp_seconds,
        "participants": highlight.participants or [],
        "is_bookmarked": highlight.is_bookmarked,
        "confidence_score": highlight.confidence_score,
        "created_at": highlight.created_at.isoformat()
    }
