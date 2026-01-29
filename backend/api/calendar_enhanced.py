"""
Bheem Workspace - Enhanced Calendar API
API endpoints for world clock, focus time, and time insights
Phase 10: Calendar Enhancements
"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field

from core.database import get_db
from core.security import get_current_user
from services.calendar_enhanced_service import CalendarEnhancedService

router = APIRouter(prefix="/calendar/enhanced", tags=["Calendar - Enhanced"])


# =============================================
# Pydantic Schemas
# =============================================

class WorldClockTime(BaseModel):
    timezone_id: str
    name: str
    abbreviation: str
    time: str
    date: str
    day_of_week: str
    offset: str
    is_dst: bool


class TimezoneInfo(BaseModel):
    id: str
    name: str
    abbr: Optional[str] = None
    full_name: Optional[str] = None


class WorldClockUpdate(BaseModel):
    timezones: List[str] = Field(..., max_items=10)


class SecondaryTimezoneUpdate(BaseModel):
    timezone: Optional[str] = None
    show: bool = True


class TimeConvertRequest(BaseModel):
    time: datetime
    from_timezone: str
    to_timezone: str


class FocusBlockCreate(BaseModel):
    start_time: datetime
    end_time: datetime
    title: str = "Focus Time"
    auto_decline_meetings: bool = False
    show_as_busy: bool = True


class FocusBlockResponse(BaseModel):
    id: str
    title: str
    start_time: str
    end_time: str
    status: str
    auto_decline_meetings: bool
    show_as_busy: bool
    was_interrupted: Optional[bool]
    actual_focus_minutes: Optional[int]
    created_at: str


class FocusBlockComplete(BaseModel):
    was_interrupted: bool = False
    actual_minutes: Optional[int] = None


class FocusSettingsUpdate(BaseModel):
    focus_time_enabled: Optional[bool] = None
    focus_time_duration: Optional[int] = Field(None, ge=15, le=480)
    focus_time_days: Optional[List[str]] = None
    focus_time_start: Optional[str] = Field(None, pattern='^([01]?[0-9]|2[0-3]):[0-5][0-9]$')
    focus_time_end: Optional[str] = Field(None, pattern='^([01]?[0-9]|2[0-3]):[0-5][0-9]$')
    focus_time_auto_decline: Optional[bool] = None


class TimeInsightResponse(BaseModel):
    id: str
    week_start: str
    week_end: str
    total_meeting_hours: int
    meeting_count: int
    avg_meeting_duration: int
    one_on_one_hours: int
    team_meeting_hours: int
    external_meeting_hours: int
    total_focus_hours: int
    focus_blocks_count: int
    focus_blocks_completed: int
    largest_free_block: int
    busiest_day: Optional[str]


class InsightsSummary(BaseModel):
    total_meeting_hours: int
    avg_meeting_hours_per_week: int
    total_focus_hours: int
    avg_focus_hours_per_week: int
    meeting_trend: str
    focus_trend: str
    weeks_analyzed: int


# =============================================
# World Clock Endpoints
# =============================================

@router.get("/world-clock", response_model=List[WorldClockTime])
async def get_world_clock(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get world clock times for user's saved timezones"""
    service = CalendarEnhancedService(db)

    # Get user's saved timezones
    settings = await service._get_or_create_settings(current_user["user_id"])
    timezones = settings.world_clock_timezones or []

    if not timezones:
        # Return default timezones if none saved
        timezones = ["America/New_York", "Europe/London", "Asia/Tokyo"]

    times = service.get_world_clock_times(timezones)
    return times


@router.put("/world-clock")
async def update_world_clock(
    data: WorldClockUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Update user's world clock timezones"""
    service = CalendarEnhancedService(db)

    await service.update_world_clock_timezones(
        user_id=current_user["user_id"],
        timezones=data.timezones
    )

    return {"message": "World clock updated", "timezones": data.timezones}


@router.get("/timezones/common", response_model=List[TimezoneInfo])
async def get_common_timezones():
    """Get list of common timezones"""
    service = CalendarEnhancedService(None)
    return service.get_common_timezones()


@router.get("/timezones/search", response_model=List[TimezoneInfo])
async def search_timezones(
    q: str = Query(..., min_length=2, max_length=50)
):
    """Search for timezones"""
    service = CalendarEnhancedService(None)
    return service.search_timezones(q)


# =============================================
# Dual Timezone Endpoints
# =============================================

@router.put("/secondary-timezone")
async def set_secondary_timezone(
    data: SecondaryTimezoneUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Set secondary timezone for dual view"""
    service = CalendarEnhancedService(db)

    await service.set_secondary_timezone(
        user_id=current_user["user_id"],
        timezone=data.timezone,
        show=data.show
    )

    return {"message": "Secondary timezone updated"}


@router.post("/convert-time")
async def convert_time(data: TimeConvertRequest):
    """Convert time between timezones"""
    service = CalendarEnhancedService(None)

    result = service.convert_time_between_zones(
        time=data.time,
        from_tz=data.from_timezone,
        to_tz=data.to_timezone
    )

    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["error"]
        )

    return result


# =============================================
# Focus Time Endpoints
# =============================================

@router.post("/focus", response_model=FocusBlockResponse, status_code=status.HTTP_201_CREATED)
async def create_focus_block(
    data: FocusBlockCreate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Create a focus time block"""
    service = CalendarEnhancedService(db)

    block = await service.create_focus_block(
        user_id=current_user["user_id"],
        start_time=data.start_time,
        end_time=data.end_time,
        title=data.title,
        auto_decline=data.auto_decline_meetings,
        show_as_busy=data.show_as_busy
    )

    return _focus_to_response(block)


@router.get("/focus", response_model=List[FocusBlockResponse])
async def list_focus_blocks(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get focus time blocks"""
    service = CalendarEnhancedService(db)

    blocks = await service.get_focus_blocks(
        user_id=current_user["user_id"],
        start_date=start_date,
        end_date=end_date
    )

    return [_focus_to_response(b) for b in blocks]


@router.post("/focus/{block_id}/complete")
async def complete_focus_block(
    block_id: UUID,
    data: FocusBlockComplete,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Mark a focus block as completed"""
    service = CalendarEnhancedService(db)

    success = await service.complete_focus_block(
        block_id=block_id,
        user_id=current_user["user_id"],
        was_interrupted=data.was_interrupted,
        actual_minutes=data.actual_minutes
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Focus block not found"
        )

    return {"message": "Focus block completed"}


@router.delete("/focus/{block_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_focus_block(
    block_id: UUID,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Delete a focus block"""
    service = CalendarEnhancedService(db)

    success = await service.delete_focus_block(
        block_id=block_id,
        user_id=current_user["user_id"]
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Focus block not found"
        )


@router.patch("/focus/settings")
async def update_focus_settings(
    data: FocusSettingsUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Update focus time preferences"""
    service = CalendarEnhancedService(db)

    settings = await service.update_focus_settings(
        user_id=current_user["user_id"],
        **data.dict(exclude_unset=True)
    )

    return {
        "focus_time_enabled": settings.focus_time_enabled,
        "focus_time_duration": settings.focus_time_duration,
        "focus_time_days": settings.focus_time_days,
        "focus_time_start": settings.focus_time_start,
        "focus_time_end": settings.focus_time_end,
        "focus_time_auto_decline": settings.focus_time_auto_decline
    }


# =============================================
# Time Insights Endpoints
# =============================================

@router.get("/insights/current", response_model=Optional[TimeInsightResponse])
async def get_current_week_insights(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get insights for the current week"""
    service = CalendarEnhancedService(db)

    # Get Monday of current week
    today = datetime.utcnow()
    monday = today - timedelta(days=today.weekday())
    monday = monday.replace(hour=0, minute=0, second=0, microsecond=0)

    insight = await service.get_time_insights(
        user_id=current_user["user_id"],
        week_start=monday
    )

    if not insight:
        return None

    return _insight_to_response(insight)


@router.get("/insights/recent", response_model=List[TimeInsightResponse])
async def get_recent_insights(
    weeks: int = Query(4, ge=1, le=12),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get recent weeks' insights"""
    service = CalendarEnhancedService(db)

    insights = await service.get_recent_insights(
        user_id=current_user["user_id"],
        weeks=weeks
    )

    return [_insight_to_response(i) for i in insights]


@router.get("/insights/summary", response_model=InsightsSummary)
async def get_insights_summary(
    weeks: int = Query(4, ge=1, le=12),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get aggregated insights summary"""
    service = CalendarEnhancedService(db)

    summary = await service.get_insights_summary(
        user_id=current_user["user_id"],
        weeks=weeks
    )

    return InsightsSummary(**summary)


# =============================================
# Helper Functions
# =============================================

def _focus_to_response(block) -> dict:
    return {
        "id": str(block.id),
        "title": block.title,
        "start_time": block.start_time.isoformat(),
        "end_time": block.end_time.isoformat(),
        "status": block.status,
        "auto_decline_meetings": block.auto_decline_meetings,
        "show_as_busy": block.show_as_busy,
        "was_interrupted": block.was_interrupted,
        "actual_focus_minutes": block.actual_focus_minutes,
        "created_at": block.created_at.isoformat()
    }


def _insight_to_response(insight) -> dict:
    return {
        "id": str(insight.id),
        "week_start": insight.week_start.isoformat(),
        "week_end": insight.week_end.isoformat(),
        "total_meeting_hours": insight.total_meeting_hours or 0,
        "meeting_count": insight.meeting_count or 0,
        "avg_meeting_duration": insight.avg_meeting_duration or 0,
        "one_on_one_hours": insight.one_on_one_hours or 0,
        "team_meeting_hours": insight.team_meeting_hours or 0,
        "external_meeting_hours": insight.external_meeting_hours or 0,
        "total_focus_hours": insight.total_focus_hours or 0,
        "focus_blocks_count": insight.focus_blocks_count or 0,
        "focus_blocks_completed": insight.focus_blocks_completed or 0,
        "largest_free_block": insight.largest_free_block or 0,
        "busiest_day": insight.busiest_day
    }
