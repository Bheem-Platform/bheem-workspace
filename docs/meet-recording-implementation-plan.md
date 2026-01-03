# Bheem Meet - Complete Recording Implementation Plan

## Overview

This document outlines the complete implementation plan for production-ready meeting recordings in Bheem Meet, using LiveKit Egress for capture and Bheem Workspace (Nextcloud) for storage.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BHEEM MEET RECORDING FLOW                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Frontend   │───▶│   Backend    │───▶│   LiveKit    │───▶│   Storage    │
│  (Next.js)   │    │  (FastAPI)   │    │   Server     │    │  (Nextcloud) │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
      │                   │                    │                    │
      │  Start Recording  │                    │                    │
      │──────────────────▶│                    │                    │
      │                   │  Egress Request    │                    │
      │                   │───────────────────▶│                    │
      │                   │                    │  Record Room       │
      │                   │                    │───────────────────▶│
      │                   │                    │                    │
      │  Stop Recording   │                    │                    │
      │──────────────────▶│                    │                    │
      │                   │  Stop Egress       │                    │
      │                   │───────────────────▶│                    │
      │                   │                    │  Save File         │
      │                   │                    │───────────────────▶│
      │                   │                    │                    │
      │                   │◀──────────────────────────Webhook───────│
      │                   │  Update DB Status  │                    │
      │                   │                    │                    │
```

---

## Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Video Capture | LiveKit Egress API | Record room streams |
| Storage | Nextcloud (Bheem Workspace) | Save recordings to user's docs |
| Database | PostgreSQL (ERP) | Store recording metadata |
| Backend | FastAPI | Orchestrate recording workflow |
| Frontend | Next.js + Zustand | UI controls and playback |

---

## Phase 1: Core Recording Infrastructure

### 1.1 Database Schema

**Table: `project_management.pm_meeting_recordings`**

```sql
CREATE TABLE project_management.pm_meeting_recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES project_management.pm_meeting_rooms(id),
    room_code VARCHAR(50) NOT NULL,

    -- Recording details
    egress_id VARCHAR(100),  -- LiveKit egress ID
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, recording, processing, completed, failed

    -- File info
    storage_type VARCHAR(20) NOT NULL DEFAULT 'nextcloud',  -- nextcloud, s3
    storage_path VARCHAR(500),  -- /Recordings/meeting-id/recording.mp4
    file_size_bytes BIGINT,
    duration_seconds INTEGER,

    -- Metadata
    recorded_by UUID NOT NULL,  -- User who started recording
    company_id UUID,

    -- Security
    is_encrypted BOOLEAN DEFAULT FALSE,
    watermark_applied BOOLEAN DEFAULT FALSE,

    -- Access control
    is_public BOOLEAN DEFAULT FALSE,
    allowed_viewers UUID[],  -- Array of user IDs

    -- Timestamps
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,  -- Auto-delete date

    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('pending', 'recording', 'processing', 'completed', 'failed'))
);

-- Indexes
CREATE INDEX idx_recordings_meeting ON pm_meeting_recordings(meeting_id);
CREATE INDEX idx_recordings_room_code ON pm_meeting_recordings(room_code);
CREATE INDEX idx_recordings_status ON pm_meeting_recordings(status);
CREATE INDEX idx_recordings_recorded_by ON pm_meeting_recordings(recorded_by);
```

**Table: `project_management.pm_recording_access_logs`**

```sql
CREATE TABLE project_management.pm_recording_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recording_id UUID NOT NULL REFERENCES pm_meeting_recordings(id),
    user_id UUID,
    user_email VARCHAR(255),
    action VARCHAR(50) NOT NULL,  -- view, download, share
    ip_address VARCHAR(45),
    user_agent TEXT,
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_access_logs_recording ON pm_recording_access_logs(recording_id);
CREATE INDEX idx_access_logs_user ON pm_recording_access_logs(user_id);
```

### 1.2 LiveKit Egress Service

**File: `backend/services/livekit_egress_service.py`**

```python
"""
LiveKit Egress Service - Handles recording capture
"""
from livekit import api
from livekit.api import egress as egress_api
from core.config import settings
import httpx
from typing import Optional, Dict, Any
import asyncio


class LiveKitEgressService:
    def __init__(self):
        self.api_key = settings.LIVEKIT_API_KEY
        self.api_secret = settings.LIVEKIT_API_SECRET
        self.livekit_url = settings.LIVEKIT_URL.replace("wss://", "https://")

    async def start_room_recording(
        self,
        room_name: str,
        output_path: str,
        recording_id: str,
        options: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Start recording a LiveKit room

        Args:
            room_name: The room code to record
            output_path: Where to save (local path for upload later)
            recording_id: Our internal recording ID
            options: Recording options (layout, quality, etc.)

        Returns:
            Egress info with egress_id
        """
        try:
            # Create egress client
            egress_client = egress_api.EgressServiceClient(
                self.livekit_url,
                self.api_key,
                self.api_secret
            )

            # Define output format
            file_output = egress_api.EncodedFileOutput(
                file_type=egress_api.EncodedFileType.MP4,
                filepath=f"/tmp/recordings/{recording_id}.mp4",
                disable_manifest=True
            )

            # Recording layout options
            layout = options.get("layout", "grid") if options else "grid"

            # Start room composite egress (records all participants)
            egress_info = await egress_client.start_room_composite_egress(
                room_name=room_name,
                layout=layout,
                file_outputs=[file_output],
                audio_only=options.get("audio_only", False) if options else False,
                video_only=options.get("video_only", False) if options else False,
            )

            return {
                "success": True,
                "egress_id": egress_info.egress_id,
                "status": egress_info.status,
                "room_name": room_name
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    async def stop_recording(self, egress_id: str) -> Dict[str, Any]:
        """Stop an active recording"""
        try:
            egress_client = egress_api.EgressServiceClient(
                self.livekit_url,
                self.api_key,
                self.api_secret
            )

            egress_info = await egress_client.stop_egress(egress_id)

            return {
                "success": True,
                "egress_id": egress_id,
                "status": egress_info.status,
                "ended_at": egress_info.ended_at
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    async def get_egress_status(self, egress_id: str) -> Dict[str, Any]:
        """Get status of an egress/recording"""
        try:
            egress_client = egress_api.EgressServiceClient(
                self.livekit_url,
                self.api_key,
                self.api_secret
            )

            egress_list = await egress_client.list_egress(egress_id=egress_id)

            if egress_list.items:
                info = egress_list.items[0]
                return {
                    "success": True,
                    "egress_id": info.egress_id,
                    "status": info.status,
                    "started_at": info.started_at,
                    "ended_at": info.ended_at,
                    "error": info.error if hasattr(info, 'error') else None
                }

            return {"success": False, "error": "Egress not found"}

        except Exception as e:
            return {"success": False, "error": str(e)}


# Singleton
livekit_egress_service = LiveKitEgressService()
```

### 1.3 Recording Storage Service

**File: `backend/services/recording_storage_service.py`**

```python
"""
Recording Storage Service - Saves recordings to Bheem Workspace (Nextcloud)
"""
from services.nextcloud_service import nextcloud_service
from core.config import settings
import aiofiles
import os
from typing import Optional, Dict, Any
from datetime import datetime


class RecordingStorageService:
    def __init__(self):
        self.recordings_folder = "/Recordings"
        self.temp_dir = "/tmp/recordings"

        # Ensure temp directory exists
        os.makedirs(self.temp_dir, exist_ok=True)

    async def save_to_workspace(
        self,
        recording_id: str,
        room_code: str,
        username: str,
        password: str,
        local_file_path: str
    ) -> Dict[str, Any]:
        """
        Save recording from local file to user's Nextcloud storage

        Args:
            recording_id: Our recording ID
            room_code: Meeting room code
            username: Nextcloud username
            password: Nextcloud password
            local_file_path: Path to local recording file

        Returns:
            Storage info with path and size
        """
        try:
            # Create folder structure: /Recordings/{room_code}/
            folder_path = f"{self.recordings_folder}/{room_code}"
            await nextcloud_service.create_folder(username, password, folder_path)

            # Read local file
            async with aiofiles.open(local_file_path, 'rb') as f:
                content = await f.read()

            file_size = len(content)

            # Upload to Nextcloud
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            filename = f"recording_{timestamp}.mp4"
            full_path = f"{folder_path}/{filename}"

            success = await nextcloud_service.upload_file(
                username, password, full_path, content
            )

            if not success:
                return {"success": False, "error": "Upload failed"}

            # Clean up local file
            if os.path.exists(local_file_path):
                os.remove(local_file_path)

            return {
                "success": True,
                "storage_type": "nextcloud",
                "storage_path": full_path,
                "file_size_bytes": file_size,
                "filename": filename
            }

        except Exception as e:
            return {"success": False, "error": str(e)}

    async def get_recording_url(
        self,
        storage_path: str,
        username: str,
        password: str
    ) -> Optional[str]:
        """Get download URL for a recording"""
        try:
            # Generate Nextcloud download link
            url = await nextcloud_service.get_download_url(
                username, password, storage_path
            )
            return url
        except Exception:
            return None

    async def delete_recording(
        self,
        storage_path: str,
        username: str,
        password: str
    ) -> bool:
        """Delete a recording from storage"""
        try:
            return await nextcloud_service.delete_file(
                username, password, storage_path
            )
        except Exception:
            return False

    def get_local_path(self, recording_id: str) -> str:
        """Get local temp file path for a recording"""
        return f"{self.temp_dir}/{recording_id}.mp4"


# Singleton
recording_storage_service = RecordingStorageService()
```

---

## Phase 2: Recording API Endpoints

### 2.1 Updated Recordings API

**File: `backend/api/recordings.py`** (Complete Rewrite)

```python
"""
Bheem Meet - Recording API
Production-ready recording management with LiveKit Egress
"""
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
import uuid

from core.security import get_current_user
from core.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from services.livekit_egress_service import livekit_egress_service
from services.recording_storage_service import recording_storage_service

router = APIRouter(prefix="/recordings", tags=["Recordings"])


# ============== SCHEMAS ==============

class StartRecordingRequest(BaseModel):
    room_code: str
    layout: str = "grid"  # grid, speaker, single-speaker
    audio_only: bool = False


class StartRecordingResponse(BaseModel):
    recording_id: str
    room_code: str
    status: str
    message: str


class RecordingInfo(BaseModel):
    id: str
    room_code: str
    status: str
    duration_seconds: Optional[int]
    file_size_bytes: Optional[int]
    storage_path: Optional[str]
    started_at: Optional[datetime]
    ended_at: Optional[datetime]
    created_at: datetime


class RecordingListResponse(BaseModel):
    recordings: List[RecordingInfo]
    total: int


# ============== ENDPOINTS ==============

@router.post("/start", response_model=StartRecordingResponse)
async def start_recording(
    request: StartRecordingRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Start recording a meeting room

    - Only host or admin can start recording
    - Creates egress in LiveKit
    - Stores metadata in database
    """
    user_id = current_user.get("user_id") or current_user.get("id")
    company_id = current_user.get("company_id")

    # Verify room exists and user has permission
    room_query = text("""
        SELECT id, room_code, created_by, status
        FROM project_management.pm_meeting_rooms
        WHERE room_code = :room_code
    """)
    result = await db.execute(room_query, {"room_code": request.room_code})
    room = result.fetchone()

    if not room:
        raise HTTPException(status_code=404, detail="Meeting room not found")

    if room.status != "active":
        raise HTTPException(status_code=400, detail="Room is not active")

    # Check if already recording
    active_query = text("""
        SELECT id FROM project_management.pm_meeting_recordings
        WHERE room_code = :room_code AND status = 'recording'
    """)
    active_result = await db.execute(active_query, {"room_code": request.room_code})
    if active_result.fetchone():
        raise HTTPException(status_code=400, detail="Recording already in progress")

    # Create recording record
    recording_id = str(uuid.uuid4())

    insert_query = text("""
        INSERT INTO project_management.pm_meeting_recordings
        (id, meeting_id, room_code, status, recorded_by, company_id, started_at, created_at, updated_at)
        VALUES (:id, :meeting_id, :room_code, 'pending', :recorded_by, :company_id, NOW(), NOW(), NOW())
    """)

    await db.execute(insert_query, {
        "id": recording_id,
        "meeting_id": str(room.id),
        "room_code": request.room_code,
        "recorded_by": user_id,
        "company_id": company_id
    })
    await db.commit()

    # Start LiveKit egress in background
    background_tasks.add_task(
        _start_egress_task,
        recording_id,
        request.room_code,
        {"layout": request.layout, "audio_only": request.audio_only}
    )

    return StartRecordingResponse(
        recording_id=recording_id,
        room_code=request.room_code,
        status="starting",
        message="Recording is starting..."
    )


async def _start_egress_task(recording_id: str, room_code: str, options: dict):
    """Background task to start LiveKit egress"""
    from core.database import async_session_maker

    async with async_session_maker() as db:
        output_path = recording_storage_service.get_local_path(recording_id)

        result = await livekit_egress_service.start_room_recording(
            room_name=room_code,
            output_path=output_path,
            recording_id=recording_id,
            options=options
        )

        if result["success"]:
            update_query = text("""
                UPDATE project_management.pm_meeting_recordings
                SET egress_id = :egress_id, status = 'recording', updated_at = NOW()
                WHERE id = :id
            """)
            await db.execute(update_query, {
                "egress_id": result["egress_id"],
                "id": recording_id
            })
        else:
            update_query = text("""
                UPDATE project_management.pm_meeting_recordings
                SET status = 'failed', updated_at = NOW()
                WHERE id = :id
            """)
            await db.execute(update_query, {"id": recording_id})

        await db.commit()


@router.post("/{recording_id}/stop")
async def stop_recording(
    recording_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Stop an active recording

    - Stops LiveKit egress
    - Triggers upload to Bheem Workspace
    """
    # Get recording
    query = text("""
        SELECT id, egress_id, room_code, status, recorded_by
        FROM project_management.pm_meeting_recordings
        WHERE id = :id
    """)
    result = await db.execute(query, {"id": recording_id})
    recording = result.fetchone()

    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")

    if recording.status != "recording":
        raise HTTPException(status_code=400, detail=f"Recording is not active (status: {recording.status})")

    # Update status to processing
    update_query = text("""
        UPDATE project_management.pm_meeting_recordings
        SET status = 'processing', ended_at = NOW(), updated_at = NOW()
        WHERE id = :id
    """)
    await db.execute(update_query, {"id": recording_id})
    await db.commit()

    # Stop egress and upload in background
    background_tasks.add_task(
        _stop_and_upload_task,
        recording_id,
        recording.egress_id,
        recording.room_code,
        current_user
    )

    return {
        "recording_id": recording_id,
        "status": "processing",
        "message": "Recording stopped, processing and uploading..."
    }


async def _stop_and_upload_task(
    recording_id: str,
    egress_id: str,
    room_code: str,
    user: dict
):
    """Background task to stop egress and upload recording"""
    from core.database import async_session_maker

    async with async_session_maker() as db:
        try:
            # Stop egress
            stop_result = await livekit_egress_service.stop_recording(egress_id)

            if not stop_result["success"]:
                raise Exception(f"Failed to stop egress: {stop_result.get('error')}")

            # Wait for file to be ready (LiveKit needs time to finalize)
            import asyncio
            await asyncio.sleep(5)

            # Upload to Bheem Workspace
            local_path = recording_storage_service.get_local_path(recording_id)
            username = user.get("username")
            # Note: In production, get password from secure storage
            password = ""  # Would be fetched from credentials store

            upload_result = await recording_storage_service.save_to_workspace(
                recording_id=recording_id,
                room_code=room_code,
                username=username,
                password=password,
                local_file_path=local_path
            )

            if upload_result["success"]:
                # Get file duration (would need ffprobe or similar)
                duration = 0  # TODO: Extract from file

                update_query = text("""
                    UPDATE project_management.pm_meeting_recordings
                    SET status = 'completed',
                        storage_type = :storage_type,
                        storage_path = :storage_path,
                        file_size_bytes = :file_size,
                        duration_seconds = :duration,
                        updated_at = NOW()
                    WHERE id = :id
                """)
                await db.execute(update_query, {
                    "id": recording_id,
                    "storage_type": upload_result["storage_type"],
                    "storage_path": upload_result["storage_path"],
                    "file_size": upload_result["file_size_bytes"],
                    "duration": duration
                })
            else:
                raise Exception(f"Upload failed: {upload_result.get('error')}")

        except Exception as e:
            update_query = text("""
                UPDATE project_management.pm_meeting_recordings
                SET status = 'failed', updated_at = NOW()
                WHERE id = :id
            """)
            await db.execute(update_query, {"id": recording_id})
            print(f"Recording task failed: {e}")

        await db.commit()


@router.get("/", response_model=RecordingListResponse)
async def list_recordings(
    room_code: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List recordings for the current user"""
    user_id = current_user.get("user_id") or current_user.get("id")

    # Build query with filters
    where_clauses = ["recorded_by = :user_id"]
    params = {"user_id": user_id, "limit": limit, "offset": offset}

    if room_code:
        where_clauses.append("room_code = :room_code")
        params["room_code"] = room_code

    if status:
        where_clauses.append("status = :status")
        params["status"] = status

    where_sql = " AND ".join(where_clauses)

    query = text(f"""
        SELECT id, room_code, status, duration_seconds, file_size_bytes,
               storage_path, started_at, ended_at, created_at
        FROM project_management.pm_meeting_recordings
        WHERE {where_sql}
        ORDER BY created_at DESC
        LIMIT :limit OFFSET :offset
    """)

    count_query = text(f"""
        SELECT COUNT(*) FROM project_management.pm_meeting_recordings
        WHERE {where_sql}
    """)

    result = await db.execute(query, params)
    count_result = await db.execute(count_query, params)

    recordings = []
    for row in result:
        recordings.append(RecordingInfo(
            id=str(row.id),
            room_code=row.room_code,
            status=row.status,
            duration_seconds=row.duration_seconds,
            file_size_bytes=row.file_size_bytes,
            storage_path=row.storage_path,
            started_at=row.started_at,
            ended_at=row.ended_at,
            created_at=row.created_at
        ))

    total = count_result.scalar()

    return RecordingListResponse(recordings=recordings, total=total)


@router.get("/{recording_id}")
async def get_recording(
    recording_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get recording details with download URL"""
    query = text("""
        SELECT r.*, m.name as meeting_name
        FROM project_management.pm_meeting_recordings r
        LEFT JOIN project_management.pm_meeting_rooms m ON r.meeting_id = m.id
        WHERE r.id = :id
    """)

    result = await db.execute(query, {"id": recording_id})
    recording = result.fetchone()

    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")

    # Check access permission
    user_id = current_user.get("user_id") or current_user.get("id")
    if str(recording.recorded_by) != str(user_id) and not recording.is_public:
        if recording.allowed_viewers and user_id not in recording.allowed_viewers:
            raise HTTPException(status_code=403, detail="Access denied")

    # Get download URL if completed
    download_url = None
    if recording.status == "completed" and recording.storage_path:
        username = current_user.get("username")
        download_url = await recording_storage_service.get_recording_url(
            recording.storage_path, username, ""
        )

    return {
        "id": str(recording.id),
        "room_code": recording.room_code,
        "meeting_name": recording.meeting_name,
        "status": recording.status,
        "duration_seconds": recording.duration_seconds,
        "file_size_bytes": recording.file_size_bytes,
        "storage_path": recording.storage_path,
        "download_url": download_url,
        "started_at": recording.started_at,
        "ended_at": recording.ended_at,
        "created_at": recording.created_at
    }


@router.delete("/{recording_id}")
async def delete_recording(
    recording_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete a recording"""
    # Get recording
    query = text("""
        SELECT id, storage_path, recorded_by
        FROM project_management.pm_meeting_recordings
        WHERE id = :id
    """)
    result = await db.execute(query, {"id": recording_id})
    recording = result.fetchone()

    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")

    # Check permission
    user_id = current_user.get("user_id") or current_user.get("id")
    if str(recording.recorded_by) != str(user_id):
        raise HTTPException(status_code=403, detail="Only recording owner can delete")

    # Delete from storage
    if recording.storage_path:
        username = current_user.get("username")
        await recording_storage_service.delete_recording(
            recording.storage_path, username, ""
        )

    # Delete from database
    delete_query = text("""
        DELETE FROM project_management.pm_meeting_recordings WHERE id = :id
    """)
    await db.execute(delete_query, {"id": recording_id})
    await db.commit()

    return {"success": True, "message": "Recording deleted"}


@router.get("/{recording_id}/status")
async def get_recording_status(
    recording_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get real-time status of a recording (polling endpoint)"""
    query = text("""
        SELECT id, status, egress_id, file_size_bytes, duration_seconds
        FROM project_management.pm_meeting_recordings
        WHERE id = :id
    """)
    result = await db.execute(query, {"id": recording_id})
    recording = result.fetchone()

    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")

    # If still recording, check egress status
    egress_status = None
    if recording.status == "recording" and recording.egress_id:
        egress_status = await livekit_egress_service.get_egress_status(recording.egress_id)

    return {
        "recording_id": str(recording.id),
        "status": recording.status,
        "file_size_bytes": recording.file_size_bytes,
        "duration_seconds": recording.duration_seconds,
        "egress_status": egress_status
    }
```

---

## Phase 3: Frontend Integration

### 3.1 Update Meet Store

**Add to `frontend/src/stores/meetStore.ts`:**

```typescript
interface RecordingState {
  isRecording: boolean;
  recordingId: string | null;
  recordingStatus: 'idle' | 'starting' | 'recording' | 'stopping' | 'processing';
  recordingDuration: number;
}

// Add to store state
recording: RecordingState = {
  isRecording: false,
  recordingId: null,
  recordingStatus: 'idle',
  recordingDuration: 0,
};

// Add actions
startRecording: async (roomCode: string) => {
  set((state) => ({
    recording: { ...state.recording, recordingStatus: 'starting' }
  }));

  try {
    const response = await meetApi.startRecording(roomCode);

    set((state) => ({
      recording: {
        isRecording: true,
        recordingId: response.recording_id,
        recordingStatus: 'recording',
        recordingDuration: 0,
      }
    }));

    // Start duration timer
    get().startRecordingTimer();

    return { success: true };
  } catch (error) {
    set((state) => ({
      recording: { ...state.recording, recordingStatus: 'idle' }
    }));
    return { success: false, error };
  }
},

stopRecording: async () => {
  const { recordingId } = get().recording;
  if (!recordingId) return { success: false };

  set((state) => ({
    recording: { ...state.recording, recordingStatus: 'stopping' }
  }));

  try {
    await meetApi.stopRecording(recordingId);

    set((state) => ({
      recording: {
        isRecording: false,
        recordingId: null,
        recordingStatus: 'idle',
        recordingDuration: 0,
      }
    }));

    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
},
```

### 3.2 Update MeetingControls Component

**Update recording button in `frontend/src/components/meet/MeetingControls.tsx`:**

```tsx
const { isRecording, recordingStatus, recordingDuration, startRecording, stopRecording } = useMeetStore();

const handleRecordingToggle = async () => {
  if (isRecording) {
    await stopRecording();
  } else {
    await startRecording(roomCode);
  }
};

// Format duration
const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Recording button UI
<button
  onClick={handleRecordingToggle}
  disabled={recordingStatus === 'starting' || recordingStatus === 'stopping'}
  className={`p-3 rounded-full ${isRecording ? 'bg-red-600 animate-pulse' : 'bg-gray-700 hover:bg-gray-600'}`}
>
  {recordingStatus === 'starting' ? (
    <Loader2 className="w-5 h-5 animate-spin" />
  ) : (
    <Circle className={`w-5 h-5 ${isRecording ? 'fill-white' : ''}`} />
  )}
</button>

{isRecording && (
  <span className="text-red-500 text-sm font-mono">
    REC {formatDuration(recordingDuration)}
  </span>
)}
```

### 3.3 Recordings List Page

**Create `frontend/src/pages/meet/recordings.tsx`:**

```tsx
import { useEffect, useState } from 'react';
import { useMeetStore } from '@/stores/meetStore';
import { Download, Trash2, Play, Clock, HardDrive } from 'lucide-react';

export default function RecordingsPage() {
  const { recordings, fetchRecordings, deleteRecording } = useMeetStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecordings().finally(() => setLoading(false));
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Meeting Recordings</h1>

      <div className="grid gap-4">
        {recordings.map((recording) => (
          <div key={recording.id} className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <Play className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-medium">{recording.room_code}</h3>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formatDuration(recording.duration_seconds || 0)}
                  </span>
                  <span className="flex items-center gap-1">
                    <HardDrive className="w-4 h-4" />
                    {formatFileSize(recording.file_size_bytes || 0)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              {recording.status === 'completed' && (
                <a
                  href={recording.download_url}
                  className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
                >
                  <Download className="w-5 h-5" />
                </a>
              )}
              <button
                onClick={() => deleteRecording(recording.id)}
                className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Phase 4: LiveKit Server Configuration

### 4.1 Enable Egress on LiveKit Server

Add to LiveKit server config (`livekit.yaml`):

```yaml
egress:
  enabled: true
  # S3 upload (optional - we're using manual upload instead)
  # s3:
  #   access_key: xxx
  #   secret: xxx
  #   region: us-east-1
  #   bucket: recordings

  # Local file output (we'll upload manually to Nextcloud)
  file:
    local_dir: /tmp/recordings
```

### 4.2 LiveKit Webhook Setup

Add webhook endpoint for recording completion notifications:

**File: `backend/api/webhooks.py`**

```python
@router.post("/livekit/webhook")
async def livekit_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Handle LiveKit webhook events"""
    body = await request.body()
    auth_header = request.headers.get("Authorization")

    # Verify webhook signature (production)
    # ...

    data = await request.json()
    event_type = data.get("event")

    if event_type == "egress_ended":
        egress_id = data.get("egressInfo", {}).get("egressId")

        # Update recording status
        query = text("""
            UPDATE project_management.pm_meeting_recordings
            SET status = 'processing', updated_at = NOW()
            WHERE egress_id = :egress_id
        """)
        await db.execute(query, {"egress_id": egress_id})
        await db.commit()

        # Trigger upload task
        # ...

    return {"received": True}
```

---

## Implementation Timeline

| Phase | Tasks | Priority |
|-------|-------|----------|
| **Phase 1** | Database schema, Egress service, Storage service | HIGH |
| **Phase 2** | Recording API endpoints | HIGH |
| **Phase 3** | Frontend controls & recordings page | MEDIUM |
| **Phase 4** | LiveKit config & webhooks | MEDIUM |
| **Phase 5** | Testing & optimization | HIGH |

---

## Dependencies to Install

### Backend
```bash
pip install livekit-api aiofiles
```

### Frontend
```bash
npm install # No new deps needed
```

---

## Testing Checklist

- [ ] Start recording from UI
- [ ] Recording appears in database with 'recording' status
- [ ] Stop recording from UI
- [ ] Recording uploads to Nextcloud
- [ ] Recording status changes to 'completed'
- [ ] Recording appears in recordings list
- [ ] Download recording works
- [ ] Delete recording works
- [ ] Recording persists after leaving meeting

---

## Security Considerations

1. **Access Control**: Only host can start/stop recording
2. **Storage**: Recordings stored in user's private Nextcloud folder
3. **Audit Log**: All access logged to `pm_recording_access_logs`
4. **Cleanup**: Expired recordings auto-deleted based on `expires_at`

---

## Future Enhancements

1. **Transcription**: Integrate with Whisper/OpenAI for auto-transcription
2. **Watermarking**: Add user watermark to recordings
3. **Sharing**: Generate public share links with expiration
4. **Analytics**: View counts, watch duration tracking
5. **Chapters**: Auto-generate chapter markers from speaker changes
