# Bheem Platform Integration Recommendations

## Overview

This document covers three integration areas:
1. **Bheem Meet → Bheem Academy** (Live Classes)
2. **Calendar → Bheem Core** (ERP Calendar Module)
3. **Docs → Bheem Core** (ERP Document Management)

---

## 1. Bheem Meet Integration with Bheem Academy

### Current State

**Bheem Academy:**
- FastAPI + Vue.js LMS
- Reads from Moodle database
- Uses Bheem Passport for SSO
- Port 8030

**Bheem Meet (from bheem-workspace):**
- LiveKit-based video conferencing
- Room management via `/api/v1/meet`
- Recording support

### Integration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      BHEEM ACADEMY                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Courses    │    │  Live Class  │    │  Recordings  │      │
│  │   (Moodle)   │───▶│   Widget     │───▶│   Player     │      │
│  └──────────────┘    └──────┬───────┘    └──────────────┘      │
│                             │                                   │
└─────────────────────────────┼───────────────────────────────────┘
                              │ API Call
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BHEEM WORKSPACE                            │
├─────────────────────────────────────────────────────────────────┤
│  /api/v1/meet/rooms          → Create/join rooms               │
│  /api/v1/meet/token          → Generate LiveKit token          │
│  /api/v1/recordings          → List/playback recordings        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      LIVEKIT SERVER                             │
│  wss://meet.bheem.cloud                                         │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Steps

#### Step 1: Add Meet Service to Academy Backend

Create `bheem-academy/backend/services/meet_service.py`:

```python
"""
Bheem Academy - Meet Integration Service
"""
import httpx
from typing import Optional, Dict, Any
from datetime import datetime, timedelta

class BheemMeetService:
    def __init__(self):
        self.workspace_url = "https://workspace.bheem.cloud"
        self.meet_url = "https://meet.bheem.cloud"

    async def create_class_room(
        self,
        course_id: int,
        course_name: str,
        teacher_id: str,
        scheduled_time: datetime,
        duration_minutes: int = 60,
        access_token: str = None
    ) -> Dict[str, Any]:
        """Create a live class room for a course"""
        room_name = f"class-{course_id}-{int(scheduled_time.timestamp())}"

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.workspace_url}/api/v1/meet/rooms",
                json={
                    "room_name": room_name,
                    "title": f"Live Class: {course_name}",
                    "host_id": teacher_id,
                    "scheduled_at": scheduled_time.isoformat(),
                    "duration_minutes": duration_minutes,
                    "metadata": {
                        "type": "academy_class",
                        "course_id": course_id
                    }
                },
                headers={"Authorization": f"Bearer {access_token}"}
            )

            if response.status_code == 200:
                data = response.json()
                return {
                    "room_name": room_name,
                    "join_url": f"{self.meet_url}/room/{room_name}",
                    "room_id": data.get("room_id")
                }
            return None

    async def get_join_token(
        self,
        room_name: str,
        user_id: str,
        user_name: str,
        is_teacher: bool = False,
        access_token: str = None
    ) -> Optional[str]:
        """Get LiveKit token for joining a room"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.workspace_url}/api/v1/meet/token",
                json={
                    "room_name": room_name,
                    "participant_id": user_id,
                    "participant_name": user_name,
                    "can_publish": is_teacher,
                    "can_subscribe": True
                },
                headers={"Authorization": f"Bearer {access_token}"}
            )

            if response.status_code == 200:
                return response.json().get("token")
            return None

    async def get_class_recordings(
        self,
        course_id: int,
        access_token: str = None
    ) -> list:
        """Get recordings for a course"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.workspace_url}/api/v1/recordings",
                params={"metadata.course_id": course_id},
                headers={"Authorization": f"Bearer {access_token}"}
            )

            if response.status_code == 200:
                return response.json().get("recordings", [])
            return []

meet_service = BheemMeetService()
```

#### Step 2: Add API Routes in Academy

Create `bheem-academy/backend/api/live_classes.py`:

```python
"""
Bheem Academy - Live Classes API
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

from services.meet_service import meet_service
from platform_auth_client import get_current_user

router = APIRouter(prefix="/live-classes", tags=["Live Classes"])

class ScheduleClassRequest(BaseModel):
    course_id: int
    title: str
    scheduled_at: datetime
    duration_minutes: int = 60
    description: Optional[str] = None

class JoinClassRequest(BaseModel):
    room_name: str

@router.post("/schedule")
async def schedule_live_class(
    request: ScheduleClassRequest,
    current_user: dict = Depends(get_current_user)
):
    """Schedule a live class for a course (Teacher only)"""
    # Verify user is teacher/admin
    if current_user.get("role") not in ["Teacher", "Admin"]:
        raise HTTPException(status_code=403, detail="Only teachers can schedule classes")

    room = await meet_service.create_class_room(
        course_id=request.course_id,
        course_name=request.title,
        teacher_id=str(current_user["id"]),
        scheduled_time=request.scheduled_at,
        duration_minutes=request.duration_minutes,
        access_token=current_user.get("access_token")
    )

    if not room:
        raise HTTPException(status_code=500, detail="Failed to create live class")

    # TODO: Save to Moodle events table
    # TODO: Send notifications to enrolled students

    return {
        "success": True,
        "room_name": room["room_name"],
        "join_url": room["join_url"]
    }

@router.post("/join")
async def join_live_class(
    request: JoinClassRequest,
    current_user: dict = Depends(get_current_user)
):
    """Get token to join a live class"""
    is_teacher = current_user.get("role") in ["Teacher", "Admin"]

    token = await meet_service.get_join_token(
        room_name=request.room_name,
        user_id=str(current_user["id"]),
        user_name=current_user.get("name", current_user["username"]),
        is_teacher=is_teacher,
        access_token=current_user.get("access_token")
    )

    if not token:
        raise HTTPException(status_code=500, detail="Failed to get join token")

    return {
        "token": token,
        "room_name": request.room_name,
        "livekit_url": "wss://meet.bheem.cloud"
    }

@router.get("/recordings/{course_id}")
async def get_class_recordings(
    course_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get recordings for a course"""
    # TODO: Verify user is enrolled in course

    recordings = await meet_service.get_class_recordings(
        course_id=course_id,
        access_token=current_user.get("access_token")
    )

    return {
        "course_id": course_id,
        "count": len(recordings),
        "recordings": recordings
    }
```

#### Step 3: Frontend Integration

Add to course detail page:
```html
<!-- Live Class Widget for bheem-academy/frontend/courses/detail.html -->
<div id="live-class-section" v-if="course.has_live_class">
    <h3>Live Classes</h3>

    <!-- Upcoming Classes -->
    <div v-for="session in upcomingSessions" class="live-session">
        <span>{{ session.title }}</span>
        <span>{{ formatDate(session.scheduled_at) }}</span>
        <button @click="joinClass(session.room_name)"
                :disabled="!session.is_live">
            {{ session.is_live ? 'Join Now' : 'Scheduled' }}
        </button>
    </div>

    <!-- Join Room (embedded or new tab) -->
    <div v-if="activeRoom" class="meeting-container">
        <iframe :src="meetingUrl" allow="camera; microphone"></iframe>
    </div>

    <!-- Recordings -->
    <div v-if="recordings.length" class="recordings-section">
        <h4>Class Recordings</h4>
        <div v-for="rec in recordings" class="recording">
            <span>{{ rec.title }}</span>
            <button @click="playRecording(rec.id)">Watch</button>
        </div>
    </div>
</div>
```

---

## 2. Calendar Integration with Bheem Core

### Current State

**bheem-workspace:**
- CalDAV integration with Nextcloud
- `caldav_service.py` for calendar operations
- `/api/v1/calendar` endpoints

**bheem-core:**
- No calendar module currently
- Has project_management module with tasks/deadlines
- Has event_bus for real-time events

### Integration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      BHEEM CORE ERP                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │    Sales     │  │   Project    │  │     HR       │          │
│  │  (Meetings)  │  │  (Deadlines) │  │  (Leave)     │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         └────────────────┬┴─────────────────┘                   │
│                          ▼                                      │
│              ┌──────────────────────┐                           │
│              │   Calendar Module    │  ← NEW                    │
│              │   (Unified Events)   │                           │
│              └──────────┬───────────┘                           │
│                         │                                       │
└─────────────────────────┼───────────────────────────────────────┘
                          │ Sync
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              BHEEM WORKSPACE (CalDAV)                           │
│              Nextcloud Calendar Backend                         │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Steps

#### Step 1: Create Calendar Module in bheem-core

Create `bheem-core/apps/backend/app/modules/calendar/`:

```python
# module.py
"""
Bheem Core - Calendar Module
Unified calendar for all ERP events
"""
from app.core.base_module import BaseModule

class CalendarModule(BaseModule):
    def __init__(self):
        super().__init__("calendar", "Calendar & Events")

    async def initialize(self, app):
        from .core.routes import calendar_router
        app.include_router(calendar_router, prefix="/api/v1/calendar", tags=["Calendar"])

        # Subscribe to events from other modules
        from app.core.hybrid_event_bus import get_hybrid_event_bus
        bus = await get_hybrid_event_bus()

        # Sync sales meetings to calendar
        await bus.subscribe("sales.meeting.created", self.on_meeting_created)

        # Sync project deadlines to calendar
        await bus.subscribe("project.task.created", self.on_task_created)
        await bus.subscribe("project.milestone.created", self.on_milestone_created)

        # Sync HR leave to calendar
        await bus.subscribe("hr.leave.approved", self.on_leave_approved)

    async def on_meeting_created(self, event_data):
        """Create calendar event when sales meeting is scheduled"""
        from .core.services import calendar_service
        await calendar_service.create_event(
            title=f"Meeting: {event_data['customer_name']}",
            start=event_data['scheduled_at'],
            end=event_data['end_at'],
            event_type="sales_meeting",
            entity_id=event_data['meeting_id'],
            company_id=event_data['company_id']
        )

    async def on_task_created(self, event_data):
        """Create calendar event for task deadlines"""
        if event_data.get('due_date'):
            from .core.services import calendar_service
            await calendar_service.create_event(
                title=f"Due: {event_data['task_name']}",
                start=event_data['due_date'],
                all_day=True,
                event_type="task_deadline",
                entity_id=event_data['task_id'],
                company_id=event_data['company_id']
            )
```

#### Step 2: Calendar Models

```python
# core/models/calendar_models.py
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.shared.models import Base
import uuid
import enum

class EventType(str, enum.Enum):
    MEETING = "meeting"
    TASK_DEADLINE = "task_deadline"
    MILESTONE = "milestone"
    LEAVE = "leave"
    HOLIDAY = "holiday"
    REMINDER = "reminder"
    CUSTOM = "custom"

class CalendarEvent(Base):
    __tablename__ = "calendar_events"
    __table_args__ = {"schema": "calendar"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("public.companies.id"), nullable=False)

    # Event details
    title = Column(String(255), nullable=False)
    description = Column(Text)
    location = Column(String(255))

    # Timing
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime)
    all_day = Column(Boolean, default=False)
    timezone = Column(String(50), default="UTC")

    # Recurrence
    is_recurring = Column(Boolean, default=False)
    recurrence_rule = Column(String(255))  # RRULE format

    # Type and source
    event_type = Column(String(50), nullable=False)
    source_module = Column(String(50))  # sales, project, hr, etc.
    entity_type = Column(String(50))    # meeting, task, leave
    entity_id = Column(UUID(as_uuid=True))

    # Participants
    organizer_id = Column(UUID(as_uuid=True), ForeignKey("auth.users.id"))

    # Status
    is_cancelled = Column(Boolean, default=False)

    # External sync
    external_id = Column(String(255))  # CalDAV UID
    last_synced_at = Column(DateTime)

    # Metadata
    metadata = Column(JSONB, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)

class EventParticipant(Base):
    __tablename__ = "event_participants"
    __table_args__ = {"schema": "calendar"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("calendar.calendar_events.id", ondelete="CASCADE"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("auth.users.id"))

    status = Column(String(20), default="pending")  # pending, accepted, declined, tentative
    is_organizer = Column(Boolean, default=False)

    # External participant (customer, vendor)
    external_email = Column(String(320))
    external_name = Column(String(255))
```

#### Step 3: CalDAV Sync Service

```python
# core/services/caldav_sync_service.py
"""
Sync calendar events with Nextcloud CalDAV
"""
import httpx
from datetime import datetime
from typing import Optional

class CalDAVSyncService:
    def __init__(self):
        self.workspace_url = "https://workspace.bheem.cloud"

    async def sync_event_to_caldav(
        self,
        event: CalendarEvent,
        user_credentials: dict
    ) -> Optional[str]:
        """Push event to user's Nextcloud calendar"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.workspace_url}/api/v1/calendar/events",
                json={
                    "calendar_id": "work",  # or user's default calendar
                    "title": event.title,
                    "start": event.start_time.isoformat(),
                    "end": event.end_time.isoformat() if event.end_time else None,
                    "location": event.location,
                    "description": event.description
                },
                params={
                    "nc_user": user_credentials["username"],
                    "nc_pass": user_credentials["password"]
                }
            )

            if response.status_code == 200:
                return response.json().get("event_uid")
            return None

    async def pull_events_from_caldav(
        self,
        user_credentials: dict,
        start: datetime,
        end: datetime
    ) -> list:
        """Pull events from Nextcloud calendar"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.workspace_url}/api/v1/calendar/events",
                params={
                    "calendar_id": "work",
                    "start": start.isoformat(),
                    "end": end.isoformat(),
                    "nc_user": user_credentials["username"],
                    "nc_pass": user_credentials["password"]
                }
            )

            if response.status_code == 200:
                return response.json().get("events", [])
            return []
```

---

## 3. Docs Integration with Bheem Core

### Current State

**bheem-workspace:**
- WebDAV integration with Nextcloud
- `nextcloud_service.py` for file operations
- `/api/v1/docs` endpoints

**bheem-core:**
- Has DMS (Document Management System) module
- Files linked to entities (quotes, invoices, projects)

### Integration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      BHEEM CORE ERP                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │    Sales     │  │   Project    │  │     HR       │          │
│  │  (Quotes)    │  │  (Documents) │  │  (Contracts) │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         └────────────────┬┴─────────────────┘                   │
│                          ▼                                      │
│              ┌──────────────────────┐                           │
│              │     DMS Module       │                           │
│              │  (Document Storage)  │                           │
│              └──────────┬───────────┘                           │
│                         │                                       │
└─────────────────────────┼───────────────────────────────────────┘
                          │ Storage Backend
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              BHEEM WORKSPACE (WebDAV)                           │
│              Nextcloud File Storage                             │
│  OR                                                             │
│              Local MinIO / S3 Storage                           │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Steps

#### Step 1: Enhance DMS Module in bheem-core

```python
# modules/dms/core/services/storage_service.py
"""
Unified storage service - supports multiple backends
"""
import httpx
from abc import ABC, abstractmethod
from typing import Optional, BinaryIO

class StorageBackend(ABC):
    @abstractmethod
    async def upload(self, path: str, content: bytes) -> bool:
        pass

    @abstractmethod
    async def download(self, path: str) -> Optional[bytes]:
        pass

    @abstractmethod
    async def delete(self, path: str) -> bool:
        pass

    @abstractmethod
    async def get_share_link(self, path: str) -> Optional[str]:
        pass

class NextcloudBackend(StorageBackend):
    """Nextcloud/WebDAV storage via bheem-workspace"""

    def __init__(self, workspace_url: str):
        self.workspace_url = workspace_url

    async def upload(self, path: str, content: bytes, credentials: dict) -> bool:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.workspace_url}/api/v1/docs/upload",
                files={"file": ("file", content)},
                data={
                    "path": path,
                    "nc_user": credentials["username"],
                    "nc_pass": credentials["password"]
                }
            )
            return response.status_code == 200

    async def download(self, path: str, credentials: dict) -> Optional[bytes]:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.workspace_url}/api/v1/docs/download",
                params={
                    "path": path,
                    "nc_user": credentials["username"],
                    "nc_pass": credentials["password"]
                }
            )
            if response.status_code == 200:
                return response.content
            return None

    async def get_share_link(self, path: str, credentials: dict) -> Optional[str]:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.workspace_url}/api/v1/docs/share",
                json={"path": path, "expires_days": 7},
                params={
                    "nc_user": credentials["username"],
                    "nc_pass": credentials["password"]
                }
            )
            if response.status_code == 200:
                return response.json().get("share_url")
            return None

class LocalMinioBackend(StorageBackend):
    """Local MinIO/S3 storage"""
    # Implementation for self-hosted storage
    pass

# Factory
def get_storage_backend() -> StorageBackend:
    storage_type = os.getenv("STORAGE_BACKEND", "nextcloud")
    if storage_type == "nextcloud":
        return NextcloudBackend(os.getenv("WORKSPACE_URL"))
    elif storage_type == "minio":
        return LocalMinioBackend()
```

#### Step 2: Document Entity Linking

```python
# modules/dms/core/models/document_models.py
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from app.shared.models import Base
import uuid

class Document(Base):
    __tablename__ = "documents"
    __table_args__ = {"schema": "dms"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("public.companies.id"), nullable=False)

    # File info
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255))
    file_path = Column(String(1000), nullable=False)  # Path in storage backend
    file_size = Column(Integer)
    mime_type = Column(String(100))

    # Entity linking (polymorphic)
    entity_type = Column(String(50))  # quote, invoice, project, task, employee
    entity_id = Column(UUID(as_uuid=True))

    # Categorization
    category = Column(String(50))  # contract, invoice, report, image, etc.
    tags = Column(Text)  # Comma-separated tags

    # Versioning
    version = Column(Integer, default=1)
    parent_document_id = Column(UUID(as_uuid=True), ForeignKey("dms.documents.id"))

    # Status
    is_archived = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)

    # Storage
    storage_backend = Column(String(50), default="nextcloud")
    external_id = Column(String(255))  # ID in external storage

    # Audit
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("auth.users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
```

---

## Summary

### Integration Matrix

| Source | Target | Integration Type | Status |
|--------|--------|-----------------|--------|
| Bheem Meet | Bheem Academy | API + Embed | Design Ready |
| Calendar | Bheem Core | New Module + Event Bus | Design Ready |
| Docs | Bheem Core | DMS Enhancement | Design Ready |

### Files to Create/Modify

```
bheem-academy/backend/
├── services/meet_service.py      # NEW - Meet API client
├── api/live_classes.py           # NEW - Live class endpoints
└── main.py                       # ADD - Include live_classes router

bheem-core/apps/backend/app/modules/
├── calendar/                     # NEW MODULE
│   ├── module.py
│   ├── core/
│   │   ├── models/calendar_models.py
│   │   ├── services/calendar_service.py
│   │   ├── services/caldav_sync_service.py
│   │   └── routes/calendar_routes.py
└── dms/
    └── core/
        └── services/storage_service.py  # ENHANCE - Add Nextcloud backend
```

### Priority Order

1. **Bheem Meet → Academy** (High impact for online learning)
2. **Calendar → bheem-core** (Unified scheduling across ERP)
3. **Docs → bheem-core** (File storage unification)

---

*Document Created: December 26, 2025*
