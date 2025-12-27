# Meet Integration with Academy - Implementation Guide

## Overview

This guide covers integrating Bheem Meet (video conferencing) with Bheem Academy (LMS) to enable live classes, webinars, and interactive sessions.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  MEET-ACADEMY INTEGRATION                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   BHEEM ACADEMY                            │  │
│  │                  (Port 8030)                               │  │
│  │                                                            │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  Live Class Module                                   │  │  │
│  │  │                                                      │  │  │
│  │  │  • Schedule live classes                            │  │  │
│  │  │  • Teacher starts class                             │  │  │
│  │  │  • Students join class                              │  │  │
│  │  │  • Attendance tracking                              │  │  │
│  │  │  • Recording integration                            │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            │                                     │
│                            │ API Calls                           │
│                            ▼                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  BHEEM WORKSPACE                           │  │
│  │                  (Port 8500)                               │  │
│  │                                                            │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  Meet API                                            │  │  │
│  │  │                                                      │  │  │
│  │  │  POST /api/v1/meet/rooms       → Create room        │  │  │
│  │  │  POST /api/v1/meet/token       → Get join token     │  │  │
│  │  │  GET  /api/v1/meet/rooms/{id}  → Room info          │  │  │
│  │  │  POST /api/v1/meet/recordings  → Start recording    │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            │                                     │
│                            ▼                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    LIVEKIT SERVER                          │  │
│  │                wss://meet.bheem.cloud                      │  │
│  │                                                            │  │
│  │  • WebRTC media handling                                  │  │
│  │  • Room management                                        │  │
│  │  • Recording (Egress)                                     │  │
│  │  • Screen sharing                                         │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

```sql
-- In Bheem Academy database or ERP database

CREATE TABLE academy.live_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id INTEGER NOT NULL,  -- mdl_course.id
    title VARCHAR(255) NOT NULL,
    description TEXT,

    -- Meeting Room
    room_name VARCHAR(100) NOT NULL UNIQUE,
    room_url VARCHAR(500),

    -- Scheduling
    scheduled_start TIMESTAMP NOT NULL,
    scheduled_end TIMESTAMP NOT NULL,
    actual_start TIMESTAMP,
    actual_end TIMESTAMP,

    -- Status
    status VARCHAR(20) DEFAULT 'scheduled',  -- scheduled, live, ended, cancelled

    -- Host
    host_user_id UUID NOT NULL,  -- ERP user ID (teacher)
    host_moodle_id INTEGER,      -- Moodle user ID

    -- Recording
    recording_enabled BOOLEAN DEFAULT TRUE,
    recording_url VARCHAR(500),

    -- Settings
    max_participants INTEGER DEFAULT 100,
    allow_screen_share BOOLEAN DEFAULT TRUE,
    allow_chat BOOLEAN DEFAULT TRUE,
    require_password BOOLEAN DEFAULT FALSE,
    password VARCHAR(50),

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_live_classes_course ON academy.live_classes(course_id);
CREATE INDEX idx_live_classes_status ON academy.live_classes(status);
CREATE INDEX idx_live_classes_scheduled ON academy.live_classes(scheduled_start);

CREATE TABLE academy.live_class_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    live_class_id UUID NOT NULL REFERENCES academy.live_classes(id),
    user_id UUID NOT NULL,       -- ERP user ID
    moodle_user_id INTEGER,      -- Moodle user ID

    joined_at TIMESTAMP NOT NULL,
    left_at TIMESTAMP,
    duration_minutes INTEGER,

    -- Device info
    device_type VARCHAR(50),
    browser VARCHAR(100),

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_attendance_class ON academy.live_class_attendance(live_class_id);
CREATE INDEX idx_attendance_user ON academy.live_class_attendance(user_id);
```

---

## Academy Backend Implementation

### Live Class Service

```python
# /root/bheem-academy/backend/services/live_class_service.py

import httpx
import os
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from uuid import UUID
import uuid

class LiveClassService:
    def __init__(self):
        self.workspace_url = os.getenv("WORKSPACE_URL", "https://workspace.bheem.cloud")
        self.meet_url = os.getenv("MEET_URL", "https://meet.bheem.cloud")

    async def create_live_class(
        self,
        db: AsyncSession,
        course_id: int,
        title: str,
        description: str,
        scheduled_start: datetime,
        duration_minutes: int,
        host_user_id: UUID,
        host_token: str,
        settings: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Create a new live class

        Args:
            db: Database session
            course_id: Moodle course ID
            title: Class title
            description: Class description
            scheduled_start: When class starts
            duration_minutes: Class duration
            host_user_id: Teacher's ERP user ID
            host_token: Teacher's access token
            settings: Optional settings (max_participants, etc.)
        """
        # Generate unique room name
        room_name = f"academy-{course_id}-{int(datetime.now().timestamp())}"

        # Create room via Workspace Meet API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.workspace_url}/api/v1/meet/rooms",
                json={
                    "room_name": room_name,
                    "title": title,
                    "max_participants": settings.get("max_participants", 100) if settings else 100,
                    "enable_recording": settings.get("recording_enabled", True) if settings else True
                },
                headers={"Authorization": f"Bearer {host_token}"}
            )

            if response.status_code != 200:
                raise Exception(f"Failed to create meeting room: {response.text}")

            room_data = response.json()

        # Calculate end time
        scheduled_end = scheduled_start + timedelta(minutes=duration_minutes)

        # Create database record
        live_class = LiveClass(
            course_id=course_id,
            title=title,
            description=description,
            room_name=room_name,
            room_url=f"{self.meet_url}/room/{room_name}",
            scheduled_start=scheduled_start,
            scheduled_end=scheduled_end,
            host_user_id=host_user_id,
            recording_enabled=settings.get("recording_enabled", True) if settings else True,
            max_participants=settings.get("max_participants", 100) if settings else 100,
            allow_screen_share=settings.get("allow_screen_share", True) if settings else True,
            allow_chat=settings.get("allow_chat", True) if settings else True
        )

        db.add(live_class)
        await db.commit()
        await db.refresh(live_class)

        return {
            "id": str(live_class.id),
            "room_name": room_name,
            "room_url": live_class.room_url,
            "scheduled_start": scheduled_start.isoformat(),
            "scheduled_end": scheduled_end.isoformat()
        }

    async def get_join_token(
        self,
        room_name: str,
        participant_name: str,
        user_token: str,
        is_host: bool = False
    ) -> str:
        """
        Get LiveKit token to join a class

        Args:
            room_name: Room name
            participant_name: User's display name
            user_token: User's access token
            is_host: Whether user is the host (teacher)
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.workspace_url}/api/v1/meet/token",
                json={
                    "room_name": room_name,
                    "participant_name": participant_name,
                    "can_publish": is_host or True,  # Teachers and students can publish
                    "can_subscribe": True,
                    "can_record": is_host  # Only teachers can record
                },
                headers={"Authorization": f"Bearer {user_token}"}
            )

            if response.status_code != 200:
                raise Exception(f"Failed to get join token: {response.text}")

            return response.json()["token"]

    async def start_class(
        self,
        db: AsyncSession,
        live_class_id: UUID,
        host_token: str
    ) -> Dict[str, Any]:
        """Start a live class (teacher action)"""
        result = await db.execute(
            select(LiveClass).where(LiveClass.id == live_class_id)
        )
        live_class = result.scalar()

        if not live_class:
            raise Exception("Live class not found")

        if live_class.status != "scheduled":
            raise Exception(f"Cannot start class with status: {live_class.status}")

        # Update status
        live_class.status = "live"
        live_class.actual_start = datetime.utcnow()
        await db.commit()

        # Get host token
        token = await self.get_join_token(
            room_name=live_class.room_name,
            participant_name="Teacher",  # Will be replaced with actual name
            user_token=host_token,
            is_host=True
        )

        return {
            "room_name": live_class.room_name,
            "room_url": live_class.room_url,
            "token": token,
            "livekit_url": os.getenv("LIVEKIT_URL", "wss://meet.bheem.cloud")
        }

    async def join_class(
        self,
        db: AsyncSession,
        live_class_id: UUID,
        user_id: UUID,
        user_name: str,
        user_token: str
    ) -> Dict[str, Any]:
        """Student joins a live class"""
        result = await db.execute(
            select(LiveClass).where(LiveClass.id == live_class_id)
        )
        live_class = result.scalar()

        if not live_class:
            raise Exception("Live class not found")

        if live_class.status != "live":
            raise Exception("Class is not currently live")

        # Record attendance
        attendance = LiveClassAttendance(
            live_class_id=live_class_id,
            user_id=user_id,
            joined_at=datetime.utcnow()
        )
        db.add(attendance)
        await db.commit()

        # Get join token
        token = await self.get_join_token(
            room_name=live_class.room_name,
            participant_name=user_name,
            user_token=user_token,
            is_host=False
        )

        return {
            "room_name": live_class.room_name,
            "room_url": live_class.room_url,
            "token": token,
            "livekit_url": os.getenv("LIVEKIT_URL", "wss://meet.bheem.cloud"),
            "attendance_id": str(attendance.id)
        }

    async def end_class(
        self,
        db: AsyncSession,
        live_class_id: UUID
    ) -> Dict[str, Any]:
        """End a live class"""
        result = await db.execute(
            select(LiveClass).where(LiveClass.id == live_class_id)
        )
        live_class = result.scalar()

        if not live_class:
            raise Exception("Live class not found")

        # Update status
        live_class.status = "ended"
        live_class.actual_end = datetime.utcnow()

        # Calculate attendance durations
        await db.execute(
            update(LiveClassAttendance)
            .where(
                LiveClassAttendance.live_class_id == live_class_id,
                LiveClassAttendance.left_at.is_(None)
            )
            .values(
                left_at=datetime.utcnow()
            )
        )

        await db.commit()

        # Get attendance count
        attendance_count = await db.execute(
            select(func.count(LiveClassAttendance.id))
            .where(LiveClassAttendance.live_class_id == live_class_id)
        )

        return {
            "status": "ended",
            "actual_start": live_class.actual_start.isoformat() if live_class.actual_start else None,
            "actual_end": live_class.actual_end.isoformat(),
            "attendance_count": attendance_count.scalar() or 0
        }

    async def get_upcoming_classes(
        self,
        db: AsyncSession,
        course_id: int = None,
        user_id: UUID = None
    ) -> List[Dict[str, Any]]:
        """Get upcoming live classes"""
        query = select(LiveClass).where(
            LiveClass.status == "scheduled",
            LiveClass.scheduled_start > datetime.utcnow()
        )

        if course_id:
            query = query.where(LiveClass.course_id == course_id)

        query = query.order_by(LiveClass.scheduled_start)

        result = await db.execute(query)
        classes = result.scalars().all()

        return [
            {
                "id": str(c.id),
                "course_id": c.course_id,
                "title": c.title,
                "description": c.description,
                "room_url": c.room_url,
                "scheduled_start": c.scheduled_start.isoformat(),
                "scheduled_end": c.scheduled_end.isoformat(),
                "host_user_id": str(c.host_user_id)
            }
            for c in classes
        ]

    async def get_attendance_report(
        self,
        db: AsyncSession,
        live_class_id: UUID
    ) -> Dict[str, Any]:
        """Get attendance report for a class"""
        result = await db.execute(
            select(LiveClass).where(LiveClass.id == live_class_id)
        )
        live_class = result.scalar()

        if not live_class:
            raise Exception("Live class not found")

        # Get attendance records
        attendance = await db.execute(
            select(LiveClassAttendance)
            .where(LiveClassAttendance.live_class_id == live_class_id)
            .order_by(LiveClassAttendance.joined_at)
        )
        records = attendance.scalars().all()

        return {
            "class_id": str(live_class_id),
            "title": live_class.title,
            "actual_start": live_class.actual_start.isoformat() if live_class.actual_start else None,
            "actual_end": live_class.actual_end.isoformat() if live_class.actual_end else None,
            "total_attendees": len(records),
            "attendees": [
                {
                    "user_id": str(a.user_id),
                    "joined_at": a.joined_at.isoformat(),
                    "left_at": a.left_at.isoformat() if a.left_at else None,
                    "duration_minutes": a.duration_minutes
                }
                for a in records
            ]
        }

live_class_service = LiveClassService()
```

### API Endpoints

```python
# /root/bheem-academy/backend/api/live_classes.py

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID

from services.live_class_service import live_class_service
from core.database import get_db
from core.auth import get_current_user

router = APIRouter(prefix="/api/live-classes", tags=["Live Classes"])

class LiveClassCreate(BaseModel):
    course_id: int
    title: str
    description: Optional[str] = None
    scheduled_start: datetime
    duration_minutes: int = 60
    max_participants: int = 100
    recording_enabled: bool = True

class LiveClassResponse(BaseModel):
    id: str
    course_id: int
    title: str
    room_url: str
    scheduled_start: datetime
    scheduled_end: datetime
    status: str

@router.post("/", response_model=LiveClassResponse)
async def create_live_class(
    data: LiveClassCreate,
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new live class (Teacher only)

    Returns room URL and scheduling details
    """
    # Verify teacher role
    if current_user["role"] not in ["teacher", "admin"]:
        raise HTTPException(403, "Only teachers can create live classes")

    result = await live_class_service.create_live_class(
        db=db,
        course_id=data.course_id,
        title=data.title,
        description=data.description,
        scheduled_start=data.scheduled_start,
        duration_minutes=data.duration_minutes,
        host_user_id=UUID(current_user["id"]),
        host_token=current_user["token"],
        settings={
            "max_participants": data.max_participants,
            "recording_enabled": data.recording_enabled
        }
    )

    return result

@router.get("/course/{course_id}")
async def list_course_live_classes(
    course_id: int,
    status: Optional[str] = None,
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List live classes for a course"""
    query = select(LiveClass).where(LiveClass.course_id == course_id)

    if status:
        query = query.where(LiveClass.status == status)

    query = query.order_by(LiveClass.scheduled_start.desc())

    result = await db.execute(query)
    return result.scalars().all()

@router.get("/upcoming")
async def get_upcoming_classes(
    course_id: Optional[int] = None,
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get upcoming live classes"""
    return await live_class_service.get_upcoming_classes(
        db=db,
        course_id=course_id,
        user_id=UUID(current_user["id"])
    )

@router.post("/{class_id}/start")
async def start_live_class(
    class_id: UUID,
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Start a live class (Teacher only)

    Returns LiveKit token and connection URL
    """
    return await live_class_service.start_class(
        db=db,
        live_class_id=class_id,
        host_token=current_user["token"]
    )

@router.post("/{class_id}/join")
async def join_live_class(
    class_id: UUID,
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Join a live class (Student)

    Records attendance and returns LiveKit token
    """
    return await live_class_service.join_class(
        db=db,
        live_class_id=class_id,
        user_id=UUID(current_user["id"]),
        user_name=current_user["name"],
        user_token=current_user["token"]
    )

@router.post("/{class_id}/end")
async def end_live_class(
    class_id: UUID,
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """End a live class (Teacher only)"""
    return await live_class_service.end_class(
        db=db,
        live_class_id=class_id
    )

@router.get("/{class_id}/attendance")
async def get_attendance(
    class_id: UUID,
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get attendance report (Teacher only)"""
    return await live_class_service.get_attendance_report(
        db=db,
        live_class_id=class_id
    )
```

---

## Frontend Integration

### Teacher View - Start Class

```html
<!-- /root/bheem-academy/frontend/live-class/teacher.html -->

<!DOCTYPE html>
<html>
<head>
    <title>Live Class - Teacher</title>
    <script src="https://cdn.jsdelivr.net/npm/livekit-client/dist/livekit-client.umd.min.js"></script>
</head>
<body>
    <div id="app">
        <div id="class-info">
            <h1>{{ classTitle }}</h1>
            <p>Students: {{ participantCount }}</p>
            <button @click="toggleRecording">
                {{ isRecording ? 'Stop Recording' : 'Start Recording' }}
            </button>
            <button @click="endClass">End Class</button>
        </div>

        <div id="video-grid">
            <div id="local-video" class="video-container">
                <video id="local-stream" autoplay muted></video>
            </div>
            <div id="remote-videos"></div>
        </div>

        <div id="controls">
            <button @click="toggleCamera">Camera</button>
            <button @click="toggleMic">Microphone</button>
            <button @click="shareScreen">Share Screen</button>
        </div>
    </div>

    <script>
        const { Room, RoomEvent, VideoPresets } = LivekitClient;

        class TeacherLiveClass {
            constructor(roomUrl, token, classId) {
                this.room = new Room();
                this.roomUrl = roomUrl;
                this.token = token;
                this.classId = classId;
                this.isRecording = false;
            }

            async connect() {
                // Set up event handlers
                this.room.on(RoomEvent.ParticipantConnected, (participant) => {
                    console.log('Student joined:', participant.identity);
                    this.updateParticipantCount();
                });

                this.room.on(RoomEvent.ParticipantDisconnected, (participant) => {
                    console.log('Student left:', participant.identity);
                    this.updateParticipantCount();
                });

                this.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
                    this.attachTrack(track, participant);
                });

                // Connect to room
                await this.room.connect(this.roomUrl, this.token);

                // Publish local video/audio
                await this.room.localParticipant.enableCameraAndMicrophone();

                // Attach local video
                const localTrack = this.room.localParticipant.getTrack('camera');
                if (localTrack) {
                    localTrack.attach(document.getElementById('local-stream'));
                }
            }

            attachTrack(track, participant) {
                const element = track.attach();
                element.id = `track-${participant.identity}`;

                const container = document.createElement('div');
                container.className = 'video-container';
                container.appendChild(element);

                document.getElementById('remote-videos').appendChild(container);
            }

            updateParticipantCount() {
                const count = this.room.participants.size;
                document.getElementById('participant-count').textContent = count;
            }

            async toggleCamera() {
                await this.room.localParticipant.setCameraEnabled(
                    !this.room.localParticipant.isCameraEnabled
                );
            }

            async toggleMic() {
                await this.room.localParticipant.setMicrophoneEnabled(
                    !this.room.localParticipant.isMicrophoneEnabled
                );
            }

            async shareScreen() {
                await this.room.localParticipant.setScreenShareEnabled(true);
            }

            async endClass() {
                // API call to end class
                await fetch(`/api/live-classes/${this.classId}/end`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });

                this.room.disconnect();
                window.location.href = '/courses';
            }
        }

        // Initialize
        async function startClass(classId) {
            const response = await fetch(`/api/live-classes/${classId}/start`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const data = await response.json();

            const teacher = new TeacherLiveClass(
                data.livekit_url,
                data.token,
                classId
            );

            await teacher.connect();
        }
    </script>
</body>
</html>
```

### Student View - Join Class

```html
<!-- /root/bheem-academy/frontend/live-class/student.html -->

<!DOCTYPE html>
<html>
<head>
    <title>Live Class - Student</title>
    <script src="https://cdn.jsdelivr.net/npm/livekit-client/dist/livekit-client.umd.min.js"></script>
</head>
<body>
    <div id="app">
        <div id="class-info">
            <h1>{{ classTitle }}</h1>
            <p>Teacher: {{ teacherName }}</p>
        </div>

        <div id="video-grid">
            <div id="teacher-video" class="video-container main">
                <!-- Teacher's video will be displayed here -->
            </div>
            <div id="local-video" class="video-container small">
                <video id="local-stream" autoplay muted></video>
            </div>
        </div>

        <div id="controls">
            <button @click="toggleCamera">Camera</button>
            <button @click="toggleMic">Microphone</button>
            <button @click="raiseHand">Raise Hand</button>
            <button @click="leaveClass">Leave</button>
        </div>
    </div>

    <script>
        const { Room, RoomEvent } = LivekitClient;

        class StudentLiveClass {
            constructor(roomUrl, token) {
                this.room = new Room();
                this.roomUrl = roomUrl;
                this.token = token;
            }

            async connect() {
                this.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
                    // Check if this is the teacher (host)
                    if (participant.permissions.canPublish) {
                        this.attachTeacherTrack(track);
                    }
                });

                await this.room.connect(this.roomUrl, this.token);

                // Enable camera/mic (optional for students)
                await this.room.localParticipant.enableCameraAndMicrophone();
            }

            attachTeacherTrack(track) {
                const element = track.attach();
                document.getElementById('teacher-video').appendChild(element);
            }

            async leaveClass() {
                this.room.disconnect();
                window.location.href = '/my-courses';
            }
        }

        // Initialize
        async function joinClass(classId) {
            const response = await fetch(`/api/live-classes/${classId}/join`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const data = await response.json();

            const student = new StudentLiveClass(
                data.livekit_url,
                data.token
            );

            await student.connect();
        }
    </script>
</body>
</html>
```

---

## Environment Variables

```bash
# Academy .env

# Workspace Integration
WORKSPACE_URL=https://workspace.bheem.cloud
MEET_URL=https://meet.bheem.cloud
LIVEKIT_URL=wss://meet.bheem.cloud

# Optional: Direct LiveKit access (if not using Workspace API)
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
```

---

## Usage Flow

### Creating a Live Class

```
1. Teacher navigates to course page
2. Teacher clicks "Schedule Live Class"
3. Teacher fills form (title, date/time, duration)
4. System creates room via Workspace API
5. Calendar event created for enrolled students
6. Notification sent to students
```

### Starting a Live Class

```
1. Teacher opens scheduled class
2. Teacher clicks "Start Class"
3. System updates status to "live"
4. Teacher receives LiveKit token
5. Teacher's video/audio published
6. Students see "Join" button enabled
```

### Joining a Live Class

```
1. Student sees "Class is Live" notification
2. Student clicks "Join"
3. Attendance recorded
4. Student receives LiveKit token
5. Student connects and sees teacher
```

---

*Document Version: 1.0*
*Last Updated: December 26, 2025*
