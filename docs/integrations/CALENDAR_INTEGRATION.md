# Calendar Integration - Implementation Guide

## Overview

This guide covers integrating Bheem Calendar (via Nextcloud CalDAV) with Bheem Core (ERP) and other services to provide unified scheduling across the platform.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   CALENDAR INTEGRATION                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              APPLICATION LAYER                             │  │
│  │                                                            │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │  │
│  │  │bheem-core│ │workspace│ │ academy │ │  CRM    │          │  │
│  │  │         │ │         │ │         │ │         │          │  │
│  │  │• Tasks  │ │• Meet   │ │• Classes│ │• Meetings│          │  │
│  │  │• Projects│ │• Events │ │• Exams  │ │• Calls  │          │  │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘          │  │
│  │       │           │           │           │                │  │
│  │       └───────────┴─────┬─────┴───────────┘                │  │
│  │                         │                                  │  │
│  │                         ▼                                  │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │              BHEEM WORKSPACE                         │  │  │
│  │  │              Calendar API                            │  │  │
│  │  │                                                      │  │  │
│  │  │  GET  /calendar/calendars    → List calendars       │  │  │
│  │  │  POST /calendar/events       → Create event         │  │  │
│  │  │  GET  /calendar/events       → Get events           │  │  │
│  │  │  PATCH /calendar/events/{id} → Update event         │  │  │
│  │  │  DELETE /calendar/events/{id}→ Delete event         │  │  │
│  │  │  GET  /calendar/availability → Check availability   │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            │                                     │
│                            │ CalDAV                              │
│                            ▼                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   NEXTCLOUD SERVER                         │  │
│  │               https://docs.bheem.cloud                     │  │
│  │                                                            │  │
│  │  • CalDAV server                                          │  │
│  │  • Multiple calendars per user                            │  │
│  │  • Shared calendars                                       │  │
│  │  • Recurring events                                       │  │
│  │  • Reminders                                              │  │
│  │  • iCal import/export                                     │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema (for ERP Calendar Module)

```sql
-- In bheem-core database, calendar schema

CREATE SCHEMA IF NOT EXISTS calendar;

-- =====================================================
-- 1. EVENTS TABLE (Synced from/to CalDAV)
-- =====================================================
CREATE TABLE calendar.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id),

    -- CalDAV Reference
    caldav_uid VARCHAR(255) UNIQUE,
    caldav_calendar_id VARCHAR(100),
    etag VARCHAR(100),

    -- Event Details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(500),

    -- Timing
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    all_day BOOLEAN DEFAULT FALSE,
    timezone VARCHAR(50) DEFAULT 'UTC',

    -- Recurrence
    recurrence_rule VARCHAR(500),  -- RRULE format
    recurrence_id TIMESTAMP WITH TIME ZONE,
    is_recurring BOOLEAN DEFAULT FALSE,
    parent_event_id UUID REFERENCES calendar.events(id),

    -- Entity Linking (what is this event for?)
    entity_type VARCHAR(50),  -- project, task, meeting, appointment, etc.
    entity_id UUID,

    -- Participants
    organizer_id UUID REFERENCES auth.users(id),
    attendees JSONB DEFAULT '[]',  -- [{email, name, status, role}]

    -- Status
    status VARCHAR(20) DEFAULT 'confirmed',  -- confirmed, tentative, cancelled

    -- Reminders
    reminders JSONB DEFAULT '[]',  -- [{minutes_before, type}]

    -- Metadata
    color VARCHAR(20),
    categories JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',

    -- Sync Status
    last_synced_at TIMESTAMP,
    sync_status VARCHAR(20) DEFAULT 'synced',

    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_events_company ON calendar.events(company_id);
CREATE INDEX idx_events_time ON calendar.events(start_time, end_time);
CREATE INDEX idx_events_entity ON calendar.events(entity_type, entity_id);
CREATE INDEX idx_events_organizer ON calendar.events(organizer_id);
CREATE INDEX idx_events_caldav ON calendar.events(caldav_uid);

-- =====================================================
-- 2. CALENDARS TABLE
-- =====================================================
CREATE TABLE calendar.calendars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id),
    user_id UUID REFERENCES auth.users(id),

    -- CalDAV Reference
    caldav_id VARCHAR(100),
    caldav_url VARCHAR(500),

    -- Calendar Details
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT '#4CAF50',

    -- Type
    calendar_type VARCHAR(50) DEFAULT 'personal',  -- personal, shared, resource

    -- Settings
    is_visible BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    timezone VARCHAR(50) DEFAULT 'UTC',

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_calendars_user ON calendar.calendars(user_id);

-- =====================================================
-- 3. EVENT ATTENDEES TABLE
-- =====================================================
CREATE TABLE calendar.event_attendees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES calendar.events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),

    email VARCHAR(320) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(20) DEFAULT 'attendee',  -- organizer, attendee, optional
    status VARCHAR(20) DEFAULT 'needs-action',  -- accepted, declined, tentative, needs-action

    responded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_attendees_event ON calendar.event_attendees(event_id);
CREATE INDEX idx_attendees_user ON calendar.event_attendees(user_id);
```

---

## Workspace CalDAV Service

```python
# /root/bheem-workspace/backend/services/caldav_service.py

import caldav
from caldav.elements import dav, cdav
import os
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import uuid
from icalendar import Calendar, Event, Alarm
import pytz

class CalDAVService:
    def __init__(self):
        self.nextcloud_url = os.getenv("NEXTCLOUD_URL", "https://docs.bheem.cloud")

    def _get_client(self, username: str, password: str) -> caldav.DAVClient:
        """Get CalDAV client for user"""
        return caldav.DAVClient(
            url=f"{self.nextcloud_url}/remote.php/dav",
            username=username,
            password=password
        )

    async def get_calendars(
        self,
        username: str,
        password: str
    ) -> List[Dict[str, Any]]:
        """Get all calendars for user"""
        client = self._get_client(username, password)
        principal = client.principal()
        calendars = principal.calendars()

        return [
            {
                "id": cal.id,
                "name": cal.name,
                "url": str(cal.url),
                "color": getattr(cal, 'calendar_color', '#4CAF50')
            }
            for cal in calendars
        ]

    async def create_event(
        self,
        username: str,
        password: str,
        calendar_id: str,
        title: str,
        start: datetime,
        end: datetime,
        description: str = None,
        location: str = None,
        attendees: List[Dict[str, str]] = None,
        reminders: List[int] = None,  # minutes before
        recurrence_rule: str = None,
        timezone: str = "UTC"
    ) -> Dict[str, Any]:
        """
        Create calendar event

        Args:
            username: Nextcloud username
            password: Nextcloud password
            calendar_id: Calendar ID
            title: Event title
            start: Start datetime
            end: End datetime
            description: Event description
            location: Event location
            attendees: List of {email, name}
            reminders: List of minutes before event
            recurrence_rule: RRULE string
            timezone: Timezone name
        """
        client = self._get_client(username, password)
        principal = client.principal()

        # Find calendar
        calendars = principal.calendars()
        calendar = next((c for c in calendars if c.id == calendar_id), None)

        if not calendar:
            raise Exception(f"Calendar {calendar_id} not found")

        # Create iCal event
        cal = Calendar()
        cal.add('prodid', '-//Bheem Platform//bheem.cloud//')
        cal.add('version', '2.0')

        event = Event()
        event_uid = str(uuid.uuid4())
        event.add('uid', event_uid)
        event.add('summary', title)
        event.add('dtstart', start.replace(tzinfo=pytz.timezone(timezone)))
        event.add('dtend', end.replace(tzinfo=pytz.timezone(timezone)))
        event.add('dtstamp', datetime.now(pytz.UTC))

        if description:
            event.add('description', description)

        if location:
            event.add('location', location)

        if attendees:
            for attendee in attendees:
                event.add('attendee', f'mailto:{attendee["email"]}', parameters={
                    'CN': attendee.get('name', attendee['email']),
                    'ROLE': 'REQ-PARTICIPANT',
                    'PARTSTAT': 'NEEDS-ACTION'
                })

        if recurrence_rule:
            event.add('rrule', recurrence_rule)

        if reminders:
            for minutes in reminders:
                alarm = Alarm()
                alarm.add('action', 'DISPLAY')
                alarm.add('description', f'Reminder: {title}')
                alarm.add('trigger', timedelta(minutes=-minutes))
                event.add_component(alarm)

        cal.add_component(event)

        # Save to CalDAV
        created_event = calendar.save_event(cal.to_ical())

        return {
            "uid": event_uid,
            "url": str(created_event.url) if hasattr(created_event, 'url') else None,
            "title": title,
            "start": start.isoformat(),
            "end": end.isoformat()
        }

    async def get_events(
        self,
        username: str,
        password: str,
        calendar_id: str,
        start: datetime,
        end: datetime
    ) -> List[Dict[str, Any]]:
        """Get events in date range"""
        client = self._get_client(username, password)
        principal = client.principal()

        # Find calendar
        calendars = principal.calendars()
        calendar = next((c for c in calendars if c.id == calendar_id), None)

        if not calendar:
            raise Exception(f"Calendar {calendar_id} not found")

        # Search events
        events = calendar.date_search(
            start=start,
            end=end,
            expand=True
        )

        result = []
        for event in events:
            ical = event.icalendar_component
            result.append({
                "uid": str(ical.get('uid')),
                "title": str(ical.get('summary', '')),
                "description": str(ical.get('description', '')),
                "location": str(ical.get('location', '')),
                "start": ical.get('dtstart').dt.isoformat() if ical.get('dtstart') else None,
                "end": ical.get('dtend').dt.isoformat() if ical.get('dtend') else None,
                "all_day": not hasattr(ical.get('dtstart').dt, 'hour') if ical.get('dtstart') else False
            })

        return result

    async def update_event(
        self,
        username: str,
        password: str,
        calendar_id: str,
        event_uid: str,
        **updates
    ) -> Dict[str, Any]:
        """Update an existing event"""
        client = self._get_client(username, password)
        principal = client.principal()

        calendars = principal.calendars()
        calendar = next((c for c in calendars if c.id == calendar_id), None)

        if not calendar:
            raise Exception(f"Calendar {calendar_id} not found")

        # Find event
        events = calendar.events()
        event = next((e for e in events if str(e.vobject_instance.vevent.uid.value) == event_uid), None)

        if not event:
            raise Exception(f"Event {event_uid} not found")

        # Update fields
        vevent = event.vobject_instance.vevent

        if 'title' in updates:
            vevent.summary.value = updates['title']

        if 'description' in updates:
            if hasattr(vevent, 'description'):
                vevent.description.value = updates['description']
            else:
                vevent.add('description').value = updates['description']

        if 'location' in updates:
            if hasattr(vevent, 'location'):
                vevent.location.value = updates['location']
            else:
                vevent.add('location').value = updates['location']

        if 'start' in updates:
            vevent.dtstart.value = updates['start']

        if 'end' in updates:
            vevent.dtend.value = updates['end']

        event.save()

        return {"uid": event_uid, "updated": True}

    async def delete_event(
        self,
        username: str,
        password: str,
        calendar_id: str,
        event_uid: str
    ) -> bool:
        """Delete an event"""
        client = self._get_client(username, password)
        principal = client.principal()

        calendars = principal.calendars()
        calendar = next((c for c in calendars if c.id == calendar_id), None)

        if not calendar:
            raise Exception(f"Calendar {calendar_id} not found")

        events = calendar.events()
        event = next((e for e in events if str(e.vobject_instance.vevent.uid.value) == event_uid), None)

        if event:
            event.delete()
            return True

        return False

    async def check_availability(
        self,
        username: str,
        password: str,
        start: datetime,
        end: datetime
    ) -> Dict[str, Any]:
        """Check if user is available in time slot"""
        client = self._get_client(username, password)
        principal = client.principal()

        # Get all calendars
        calendars = principal.calendars()

        conflicts = []
        for calendar in calendars:
            events = calendar.date_search(start=start, end=end, expand=True)
            for event in events:
                ical = event.icalendar_component
                conflicts.append({
                    "title": str(ical.get('summary', 'Busy')),
                    "start": ical.get('dtstart').dt.isoformat() if ical.get('dtstart') else None,
                    "end": ical.get('dtend').dt.isoformat() if ical.get('dtend') else None
                })

        return {
            "available": len(conflicts) == 0,
            "conflicts": conflicts
        }

caldav_service = CalDAVService()
```

---

## Workspace Calendar API

```python
# /root/bheem-workspace/backend/api/calendar.py

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from services.caldav_service import caldav_service

router = APIRouter(prefix="/api/v1/calendar", tags=["Calendar"])

class EventCreate(BaseModel):
    calendar_id: str
    title: str
    start: datetime
    end: datetime
    description: Optional[str] = None
    location: Optional[str] = None
    attendees: Optional[List[dict]] = None
    reminders: Optional[List[int]] = None  # minutes before
    recurrence_rule: Optional[str] = None
    timezone: str = "UTC"

class EventUpdate(BaseModel):
    title: Optional[str] = None
    start: Optional[datetime] = None
    end: Optional[datetime] = None
    description: Optional[str] = None
    location: Optional[str] = None

@router.get("/calendars")
async def list_calendars(
    nc_user: str = Query(...),
    nc_pass: str = Query(...)
):
    """List all calendars for user"""
    return await caldav_service.get_calendars(nc_user, nc_pass)

@router.get("/events")
async def get_events(
    calendar_id: str = Query(...),
    start: datetime = Query(...),
    end: datetime = Query(...),
    nc_user: str = Query(...),
    nc_pass: str = Query(...)
):
    """Get events in date range"""
    return await caldav_service.get_events(
        username=nc_user,
        password=nc_pass,
        calendar_id=calendar_id,
        start=start,
        end=end
    )

@router.post("/events")
async def create_event(
    event: EventCreate,
    nc_user: str = Query(...),
    nc_pass: str = Query(...)
):
    """Create a new calendar event"""
    return await caldav_service.create_event(
        username=nc_user,
        password=nc_pass,
        calendar_id=event.calendar_id,
        title=event.title,
        start=event.start,
        end=event.end,
        description=event.description,
        location=event.location,
        attendees=event.attendees,
        reminders=event.reminders,
        recurrence_rule=event.recurrence_rule,
        timezone=event.timezone
    )

@router.patch("/events/{event_uid}")
async def update_event(
    event_uid: str,
    calendar_id: str,
    updates: EventUpdate,
    nc_user: str = Query(...),
    nc_pass: str = Query(...)
):
    """Update an event"""
    update_dict = updates.dict(exclude_unset=True)
    return await caldav_service.update_event(
        username=nc_user,
        password=nc_pass,
        calendar_id=calendar_id,
        event_uid=event_uid,
        **update_dict
    )

@router.delete("/events/{event_uid}")
async def delete_event(
    event_uid: str,
    calendar_id: str,
    nc_user: str = Query(...),
    nc_pass: str = Query(...)
):
    """Delete an event"""
    result = await caldav_service.delete_event(
        username=nc_user,
        password=nc_pass,
        calendar_id=calendar_id,
        event_uid=event_uid
    )
    return {"deleted": result}

@router.get("/availability")
async def check_availability(
    start: datetime = Query(...),
    end: datetime = Query(...),
    nc_user: str = Query(...),
    nc_pass: str = Query(...)
):
    """Check user availability"""
    return await caldav_service.check_availability(
        username=nc_user,
        password=nc_pass,
        start=start,
        end=end
    )
```

---

## bheem-core Calendar Client

```python
# /root/bheem-core/apps/backend/app/core/calendar_client.py

import httpx
import os
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

class CalendarClient:
    def __init__(self):
        self.workspace_url = os.getenv("WORKSPACE_URL", "https://workspace.bheem.cloud")

    async def create_event(
        self,
        calendar_id: str,
        title: str,
        start: datetime,
        end: datetime,
        nc_user: str,
        nc_pass: str,
        description: str = None,
        location: str = None,
        attendees: List[Dict[str, str]] = None,
        reminders: List[int] = None
    ) -> Dict[str, Any]:
        """Create calendar event via Workspace API"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.workspace_url}/api/v1/calendar/events",
                json={
                    "calendar_id": calendar_id,
                    "title": title,
                    "start": start.isoformat(),
                    "end": end.isoformat(),
                    "description": description,
                    "location": location,
                    "attendees": attendees,
                    "reminders": reminders
                },
                params={"nc_user": nc_user, "nc_pass": nc_pass}
            )

            if response.status_code != 200:
                raise Exception(f"Failed to create event: {response.text}")

            return response.json()

    async def get_events(
        self,
        calendar_id: str,
        start: datetime,
        end: datetime,
        nc_user: str,
        nc_pass: str
    ) -> List[Dict[str, Any]]:
        """Get events in date range"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.workspace_url}/api/v1/calendar/events",
                params={
                    "calendar_id": calendar_id,
                    "start": start.isoformat(),
                    "end": end.isoformat(),
                    "nc_user": nc_user,
                    "nc_pass": nc_pass
                }
            )

            if response.status_code != 200:
                raise Exception(f"Failed to get events: {response.text}")

            return response.json()

    async def check_availability(
        self,
        start: datetime,
        end: datetime,
        nc_user: str,
        nc_pass: str
    ) -> Dict[str, Any]:
        """Check if user is available"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.workspace_url}/api/v1/calendar/availability",
                params={
                    "start": start.isoformat(),
                    "end": end.isoformat(),
                    "nc_user": nc_user,
                    "nc_pass": nc_pass
                }
            )

            return response.json()

calendar_client = CalendarClient()
```

---

## Module Integration Examples

### Project Management - Task Deadlines

```python
# /root/bheem-core/apps/backend/app/modules/project_management/core/services/task_service.py

from core.calendar_client import calendar_client

async def create_task_with_calendar(
    db: AsyncSession,
    task_data: dict,
    user_credentials: dict
) -> dict:
    """Create task and add deadline to calendar"""

    # Create task in database
    task = Task(**task_data)
    db.add(task)
    await db.commit()

    # If task has due date, create calendar event
    if task.due_date:
        await calendar_client.create_event(
            calendar_id="work",  # or user's default calendar
            title=f"Task Due: {task.title}",
            start=task.due_date,
            end=task.due_date + timedelta(hours=1),
            nc_user=user_credentials["nc_user"],
            nc_pass=user_credentials["nc_pass"],
            description=f"Task: {task.description}\nProject: {task.project_name}",
            reminders=[60, 1440]  # 1 hour and 1 day before
        )

    return task
```

### CRM - Meeting Scheduling

```python
# /root/bheem-core/apps/backend/app/modules/crm/core/services/meeting_service.py

from core.calendar_client import calendar_client

async def schedule_customer_meeting(
    db: AsyncSession,
    customer_id: UUID,
    title: str,
    start: datetime,
    duration_minutes: int,
    attendee_ids: List[UUID],
    user_credentials: dict
) -> dict:
    """Schedule meeting with customer"""

    # Get customer info
    customer = await get_customer(db, customer_id)

    # Get attendee emails
    attendees = []
    for user_id in attendee_ids:
        user = await get_user(db, user_id)
        attendees.append({"email": user.email, "name": user.name})

    # Add customer as attendee
    if customer.email:
        attendees.append({"email": customer.email, "name": customer.name})

    # Create calendar event
    event = await calendar_client.create_event(
        calendar_id="work",
        title=title,
        start=start,
        end=start + timedelta(minutes=duration_minutes),
        nc_user=user_credentials["nc_user"],
        nc_pass=user_credentials["nc_pass"],
        attendees=attendees,
        description=f"Meeting with {customer.name}",
        reminders=[30, 60]  # 30 min and 1 hour before
    )

    # Save meeting record
    meeting = CRMMeeting(
        customer_id=customer_id,
        title=title,
        start_time=start,
        duration_minutes=duration_minutes,
        calendar_event_uid=event["uid"],
        attendees=[{"user_id": str(u)} for u in attendee_ids]
    )
    db.add(meeting)
    await db.commit()

    return {"meeting_id": str(meeting.id), "calendar_event": event}
```

### HR - Leave Calendar

```python
# /root/bheem-core/apps/backend/app/modules/hr/core/services/leave_service.py

async def approve_leave_request(
    db: AsyncSession,
    leave_id: UUID,
    approver_id: UUID,
    user_credentials: dict
):
    """Approve leave and add to calendar"""

    leave = await get_leave_request(db, leave_id)
    employee = await get_employee(db, leave.employee_id)

    # Update leave status
    leave.status = "approved"
    leave.approved_by = approver_id
    leave.approved_at = datetime.utcnow()

    # Create calendar event for leave period
    await calendar_client.create_event(
        calendar_id="work",
        title=f"Leave: {employee.name} ({leave.leave_type})",
        start=datetime.combine(leave.start_date, datetime.min.time()),
        end=datetime.combine(leave.end_date, datetime.max.time()),
        nc_user=user_credentials["nc_user"],
        nc_pass=user_credentials["nc_pass"],
        description=f"{employee.name} is on {leave.leave_type} leave",
        reminders=[]  # No reminders for leave
    )

    await db.commit()

    return leave
```

---

## Environment Variables

```bash
# Workspace
NEXTCLOUD_URL=https://docs.bheem.cloud
NEXTCLOUD_ADMIN_USER=admin
NEXTCLOUD_ADMIN_PASS=password

# Core
WORKSPACE_URL=https://workspace.bheem.cloud
```

---

## Calendar Types

| Calendar | Purpose | Users |
|----------|---------|-------|
| `personal` | Personal appointments | Individual |
| `work` | Work events, meetings | Individual |
| `team` | Team calendar | Department |
| `resource` | Room/equipment booking | Shared |
| `project` | Project milestones | Project team |
| `hr` | Company holidays, leave | All employees |

---

*Document Version: 1.0*
*Last Updated: December 26, 2025*
