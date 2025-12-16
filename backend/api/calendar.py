"""
Bheem Workspace - Calendar API (Nextcloud CalDAV Integration)
Calendar and event management
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta

from core.security import get_current_user
from services.caldav_service import caldav_service

router = APIRouter(prefix="/calendar", tags=["Bheem Calendar"])

# Schemas
class EventCreate(BaseModel):
    calendar_id: str
    title: str
    start: datetime
    end: datetime
    location: Optional[str] = ""
    description: Optional[str] = ""

class EventUpdate(BaseModel):
    title: Optional[str]
    start: Optional[datetime]
    end: Optional[datetime]
    location: Optional[str]
    description: Optional[str]

class CalendarInfo(BaseModel):
    id: str
    name: str
    href: str

class EventInfo(BaseModel):
    id: str
    title: str
    start: str
    end: Optional[str]
    location: Optional[str]
    description: Optional[str]

# Endpoints
@router.get("/calendars")
async def get_calendars(
    nc_user: str = None,
    nc_pass: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Get list of user's calendars from Nextcloud"""
    username = nc_user or current_user["username"]
    password = nc_pass or ""

    if not password:
        return {
            "message": "Nextcloud credentials required",
            "note": "Provide nc_user and nc_pass query parameters"
        }

    calendars = await caldav_service.get_calendars(username, password)
    return {
        "count": len(calendars),
        "calendars": calendars
    }

@router.get("/events")
async def get_events(
    calendar_id: str = "personal",
    start: datetime = None,
    end: datetime = None,
    nc_user: str = None,
    nc_pass: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Get calendar events within a time range"""
    username = nc_user or current_user["username"]
    password = nc_pass or ""

    if not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nextcloud credentials required"
        )

    # Default to current month if not specified
    if not start:
        start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if not end:
        end = start + timedelta(days=31)

    events = await caldav_service.get_events(username, password, calendar_id, start, end)
    return {
        "calendar_id": calendar_id,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "count": len(events),
        "events": events
    }

@router.post("/events")
async def create_event(
    request: EventCreate,
    nc_user: str = None,
    nc_pass: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Create a new calendar event"""
    username = nc_user or current_user["username"]
    password = nc_pass or ""

    if not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nextcloud credentials required"
        )

    event_uid = await caldav_service.create_event(
        username=username,
        password=password,
        calendar_id=request.calendar_id,
        title=request.title,
        start=request.start,
        end=request.end,
        location=request.location or "",
        description=request.description or ""
    )

    if not event_uid:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create event"
        )

    return {
        "success": True,
        "event_uid": event_uid,
        "calendar_id": request.calendar_id
    }

@router.delete("/events/{event_uid}")
async def delete_event(
    event_uid: str,
    calendar_id: str = "personal",
    nc_user: str = None,
    nc_pass: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Delete a calendar event"""
    username = nc_user or current_user["username"]
    password = nc_pass or ""

    if not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nextcloud credentials required"
        )

    success = await caldav_service.delete_event(username, password, calendar_id, event_uid)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete event"
        )

    return {"success": True, "deleted": event_uid}

@router.get("/today")
async def get_today_events(
    calendar_id: str = "personal",
    nc_user: str = None,
    nc_pass: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Get today's events for quick view"""
    username = nc_user or current_user["username"]
    password = nc_pass or ""

    if not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nextcloud credentials required"
        )

    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + timedelta(days=1)

    events = await caldav_service.get_events(username, password, calendar_id, today, tomorrow)
    return {
        "date": today.date().isoformat(),
        "count": len(events),
        "events": events
    }

@router.get("/week")
async def get_week_events(
    calendar_id: str = "personal",
    nc_user: str = None,
    nc_pass: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Get this week's events"""
    username = nc_user or current_user["username"]
    password = nc_pass or ""

    if not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nextcloud credentials required"
        )

    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    # Start from Monday of current week
    start_of_week = today - timedelta(days=today.weekday())
    end_of_week = start_of_week + timedelta(days=7)

    events = await caldav_service.get_events(username, password, calendar_id, start_of_week, end_of_week)
    return {
        "week_start": start_of_week.date().isoformat(),
        "week_end": end_of_week.date().isoformat(),
        "count": len(events),
        "events": events
    }
