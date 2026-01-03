"""
Bheem Meet - Recording API
Full-featured recording management with transcription, watermarks, and storage
"""
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Query
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
import uuid
import os
import json

from core.security import get_current_user
from core.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from services.livekit_egress_service import livekit_egress_service
from services.recording_storage_service import recording_storage_service
from services.transcription_service import transcription_service
from services.watermark_service import watermark_service

router = APIRouter(tags=["Recordings"])


# ============== SCHEMAS ==============

class StartRecordingRequest(BaseModel):
    room_code: str
    layout: str = "grid"
    resolution: str = "1080p"
    audio_only: bool = False
    watermark_enabled: bool = True
    watermark_text: Optional[str] = None
    transcription_enabled: bool = True


class StopRecordingRequest(BaseModel):
    apply_watermark: bool = True
    generate_transcript: bool = True


class RecordingResponse(BaseModel):
    id: str
    room_code: str
    status: str
    duration_seconds: Optional[int] = None
    file_size_bytes: Optional[int] = None
    resolution: Optional[str] = None
    storage_path: Optional[str] = None
    download_url: Optional[str] = None
    has_transcript: bool = False
    watermark_applied: bool = False
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    created_at: datetime


class RecordingListResponse(BaseModel):
    recordings: List[RecordingResponse]
    total: int
    page: int
    limit: int


class TranscriptResponse(BaseModel):
    recording_id: str
    text: str
    segments: List[dict]
    summary: Optional[str] = None
    action_items: List[dict] = []
    key_topics: List[str] = []
    language: str
    word_count: int
    created_at: datetime


class ShareLinkRequest(BaseModel):
    expire_days: int = 7
    password: Optional[str] = None
    max_views: Optional[int] = None


class ShareLinkResponse(BaseModel):
    share_url: str
    expires_at: datetime
    password_protected: bool


# ============== RECORDING ENDPOINTS ==============

@router.post("/start")
async def start_recording(
    request: StartRecordingRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Start recording a meeting room.
    """
    user_id = current_user.get("user_id") or current_user.get("id") or current_user.get("sub")
    company_id = current_user.get("company_id")
    username = current_user.get("username", "unknown")

    # Verify room exists
    room_query = text("""
        SELECT id, room_code, created_by, status
        FROM workspace.meet_rooms
        WHERE room_code = :room_code
    """)
    result = await db.execute(room_query, {"room_code": request.room_code})
    room = result.fetchone()

    if not room:
        raise HTTPException(status_code=404, detail="Meeting room not found")

    # Check if already recording
    active_query = text("""
        SELECT id FROM workspace.meet_recordings
        WHERE room_code = :room_code AND status = 'recording'
    """)
    active_result = await db.execute(active_query, {"room_code": request.room_code})
    if active_result.fetchone():
        raise HTTPException(status_code=400, detail="Recording already in progress")

    # Create recording record
    recording_id = str(uuid.uuid4())
    watermark_text = request.watermark_text or f"{username} | Bheem Meet"

    insert_query = text("""
        INSERT INTO workspace.meet_recordings
        (id, room_id, room_code, status, resolution, user_id, user_name,
         watermark_applied, watermark_text, has_transcript, started_at, created_at, updated_at)
        VALUES (:id, :room_id, :room_code, 'pending', :resolution, :user_id, :user_name,
                :watermark_applied, :watermark_text, FALSE, NOW(), NOW(), NOW())
    """)

    await db.execute(insert_query, {
        "id": recording_id,
        "room_id": str(room.id) if room else None,
        "room_code": request.room_code,
        "resolution": request.resolution,
        "user_id": user_id,
        "user_name": username,
        "watermark_applied": request.watermark_enabled,
        "watermark_text": watermark_text
    })
    await db.commit()

    # Start LiveKit egress in background
    background_tasks.add_task(
        _start_recording_task,
        recording_id,
        request.room_code,
        {
            "layout": request.layout,
            "resolution": request.resolution,
            "audio_only": request.audio_only
        }
    )

    return {
        "recording_id": recording_id,
        "room_code": request.room_code,
        "status": "starting",
        "message": "Recording is starting..."
    }


async def _start_recording_task(recording_id: str, room_code: str, options: dict):
    """Background task to start LiveKit egress"""
    from core.database import async_session_maker

    async with async_session_maker() as db:
        try:
            result = await livekit_egress_service.start_room_composite_egress(
                room_name=room_code,
                recording_id=recording_id,
                options=options
            )

            if result["success"]:
                update_query = text("""
                    UPDATE workspace.meet_recordings
                    SET egress_id = :egress_id, status = 'recording', updated_at = NOW()
                    WHERE id = :id
                """)
                await db.execute(update_query, {
                    "egress_id": result.get("egress_id"),
                    "id": recording_id
                })
            else:
                update_query = text("""
                    UPDATE workspace.meet_recordings
                    SET status = 'failed', updated_at = NOW()
                    WHERE id = :id
                """)
                await db.execute(update_query, {"id": recording_id})
                print(f"Recording start failed: {result.get('error')}")

            await db.commit()

        except Exception as e:
            print(f"Recording task error: {e}")
            update_query = text("""
                UPDATE workspace.meet_recordings
                SET status = 'failed', updated_at = NOW()
                WHERE id = :id
            """)
            await db.execute(update_query, {"id": recording_id})
            await db.commit()


@router.post("/{recording_id}/stop")
async def stop_recording(
    recording_id: str,
    request: StopRecordingRequest = None,
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Stop an active recording.
    """
    request = request or StopRecordingRequest()

    query = text("""
        SELECT id, egress_id, room_code, status, user_id, watermark_applied,
               watermark_text, has_transcript
        FROM workspace.meet_recordings
        WHERE id = :id
    """)
    result = await db.execute(query, {"id": recording_id})
    recording = result.fetchone()

    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")

    if recording.status != "recording":
        raise HTTPException(
            status_code=400,
            detail=f"Recording is not active (status: {recording.status})"
        )

    update_query = text("""
        UPDATE workspace.meet_recordings
        SET status = 'processing', ended_at = NOW(), updated_at = NOW()
        WHERE id = :id
    """)
    await db.execute(update_query, {"id": recording_id})
    await db.commit()

    background_tasks.add_task(
        _process_recording_task,
        recording_id,
        recording.egress_id,
        recording.room_code,
        current_user,
        {
            "apply_watermark": request.apply_watermark and recording.watermark_applied,
            "watermark_text": recording.watermark_text,
            "generate_transcript": request.generate_transcript
        }
    )

    return {
        "recording_id": recording_id,
        "status": "processing",
        "message": "Recording stopped. Processing and uploading..."
    }


async def _process_recording_task(
    recording_id: str,
    egress_id: str,
    room_code: str,
    user: dict,
    options: dict
):
    """Background task to stop egress, apply watermark, upload, and transcribe"""
    from core.database import async_session_maker
    import asyncio

    async with async_session_maker() as db:
        try:
            if egress_id:
                await livekit_egress_service.stop_egress(egress_id)

            await asyncio.sleep(5)

            local_path = livekit_egress_service.get_recording_file_path(recording_id)
            final_path = local_path

            watermark_applied = False
            if options.get("apply_watermark") and os.path.exists(local_path):
                watermarked_path = f"/tmp/recordings/{recording_id}_watermarked.mp4"
                watermark_result = await watermark_service.apply_watermark(
                    input_path=local_path,
                    output_path=watermarked_path,
                    options={
                        "text": options.get("watermark_text"),
                        "user_email": user.get("email") or user.get("username"),
                        "timestamp": True
                    }
                )
                if watermark_result["success"] and watermark_result.get("watermark_applied"):
                    final_path = watermarked_path
                    watermark_applied = True

            file_size = os.path.getsize(final_path) if os.path.exists(final_path) else 0

            storage_result = await recording_storage_service.save_recording(
                recording_id=recording_id,
                room_code=room_code,
                local_file_path=final_path,
                user_id=user.get("user_id") or user.get("id"),
                username=user.get("username", "admin")
            )

            if storage_result["success"]:
                update_query = text("""
                    UPDATE workspace.meet_recordings
                    SET status = :status,
                        storage_type = :storage_type,
                        storage_path = :storage_path,
                        file_size_bytes = :file_size,
                        watermark_enabled = :watermark_applied,
                        updated_at = NOW()
                    WHERE id = :id
                """)
                await db.execute(update_query, {
                    "id": recording_id,
                    "status": "transcribing" if options.get("generate_transcript") else "completed",
                    "storage_type": storage_result["storage_type"],
                    "storage_path": storage_result["storage_path"],
                    "file_size": file_size,
                    "watermark_applied": watermark_applied
                })
                await db.commit()

                if options.get("generate_transcript"):
                    await _transcribe_recording_task(
                        recording_id,
                        storage_result["storage_path"],
                        storage_result["storage_type"]
                    )

            livekit_egress_service.delete_local_recording(recording_id)
            if watermark_applied and os.path.exists(final_path):
                os.remove(final_path)

        except Exception as e:
            print(f"Recording processing error: {e}")
            update_query = text("""
                UPDATE workspace.meet_recordings
                SET status = 'failed', updated_at = NOW()
                WHERE id = :id
            """)
            await db.execute(update_query, {"id": recording_id})
            await db.commit()


async def _transcribe_recording_task(recording_id: str, storage_path: str, storage_type: str):
    """Background task to transcribe recording"""
    from core.database import async_session_maker

    async with async_session_maker() as db:
        try:
            local_path = storage_path
            if not os.path.exists(local_path):
                print(f"Recording file not found for transcription: {local_path}")
                return

            result = await transcription_service.transcribe_recording(
                recording_path=local_path,
                recording_id=recording_id,
                options={"generate_summary": True}
            )

            if result["success"]:
                insert_query = text("""
                    INSERT INTO workspace.meet_transcripts
                    (id, recording_id, text, segments, summary, action_items,
                     key_topics, language, word_count, confidence, created_at)
                    VALUES (gen_random_uuid(), :recording_id, :text, :segments, :summary,
                            :action_items, :key_topics, :language, :word_count, :confidence, NOW())
                """)
                await db.execute(insert_query, {
                    "recording_id": recording_id,
                    "text": result["text"],
                    "segments": json.dumps(result.get("segments", [])),
                    "summary": result.get("summary"),
                    "action_items": json.dumps(result.get("action_items", [])),
                    "key_topics": json.dumps(result.get("key_topics", [])),
                    "language": result.get("language", "en"),
                    "word_count": result.get("word_count", 0),
                    "confidence": result.get("confidence", 0.95)
                })

                update_query = text("""
                    UPDATE workspace.meet_recordings
                    SET status = 'completed', has_transcript = TRUE, updated_at = NOW()
                    WHERE id = :id
                """)
                await db.execute(update_query, {"id": recording_id})
                await db.commit()
            else:
                update_query = text("""
                    UPDATE workspace.meet_recordings
                    SET status = 'completed', has_transcript = FALSE, updated_at = NOW()
                    WHERE id = :id
                """)
                await db.execute(update_query, {"id": recording_id})
                await db.commit()

        except Exception as e:
            print(f"Transcription error: {e}")


@router.get("/")
async def list_recordings(
    room_code: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List recordings for the current user"""
    user_id = current_user.get("user_id") or current_user.get("id") or current_user.get("sub")
    offset = (page - 1) * limit

    where_clauses = ["user_id = :user_id"]
    params = {"user_id": user_id, "limit": limit, "offset": offset}

    if room_code:
        where_clauses.append("room_code = :room_code")
        params["room_code"] = room_code

    if status:
        where_clauses.append("status = :status")
        params["status"] = status

    where_sql = " AND ".join(where_clauses)

    query = text(f"""
        SELECT r.id, r.room_code, r.status, r.duration_seconds, r.file_size_bytes,
               r.resolution, r.storage_path, r.storage_type, r.watermark_applied,
               r.has_transcript, r.started_at, r.ended_at, r.created_at
        FROM workspace.meet_recordings r
        WHERE {where_sql}
        ORDER BY r.created_at DESC
        LIMIT :limit OFFSET :offset
    """)

    count_query = text(f"""
        SELECT COUNT(*) FROM workspace.meet_recordings WHERE {where_sql}
    """)

    result = await db.execute(query, params)
    count_result = await db.execute(count_query, params)

    recordings = []
    for row in result:
        recordings.append({
            "id": str(row.id),
            "room_code": row.room_code,
            "status": row.status,
            "duration_seconds": row.duration_seconds,
            "file_size_bytes": row.file_size_bytes,
            "resolution": row.resolution,
            "storage_path": row.storage_path,
            "has_transcript": row.has_transcript or False,
            "watermark_applied": row.watermark_applied or False,
            "started_at": row.started_at.isoformat() if row.started_at else None,
            "ended_at": row.ended_at.isoformat() if row.ended_at else None,
            "created_at": row.created_at.isoformat() if row.created_at else None
        })

    total = count_result.scalar() or 0

    return {
        "recordings": recordings,
        "total": total,
        "page": page,
        "limit": limit
    }


@router.get("/{recording_id}")
async def get_recording(
    recording_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get recording details"""
    query = text("""
        SELECT r.*, m.room_name as meeting_name
        FROM workspace.meet_recordings r
        LEFT JOIN workspace.meet_rooms m ON r.room_code = m.room_code
        WHERE r.id = :id
    """)

    result = await db.execute(query, {"id": recording_id})
    recording = result.fetchone()

    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")

    download_url = None
    if recording.status == "completed" and recording.storage_path:
        download_url = await recording_storage_service.get_recording_url(
            recording.storage_type,
            recording.storage_path,
            current_user.get("username")
        )

    return {
        "id": str(recording.id),
        "room_code": recording.room_code,
        "meeting_name": getattr(recording, 'meeting_name', None),
        "status": recording.status,
        "duration_seconds": recording.duration_seconds,
        "file_size_bytes": recording.file_size_bytes,
        "resolution": recording.resolution,
        "storage_path": recording.storage_path,
        "download_url": download_url,
        "has_transcript": recording.has_transcript or False,
        "watermark_applied": recording.watermark_applied or False,
        "started_at": recording.started_at.isoformat() if recording.started_at else None,
        "ended_at": recording.ended_at.isoformat() if recording.ended_at else None,
        "created_at": recording.created_at.isoformat() if recording.created_at else None
    }


@router.get("/{recording_id}/transcript")
async def get_transcript(
    recording_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get transcript for a recording"""
    query = text("""
        SELECT * FROM workspace.meet_transcripts
        WHERE recording_id = :recording_id
    """)

    result = await db.execute(query, {"recording_id": recording_id})
    transcript = result.fetchone()

    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")

    return {
        "recording_id": recording_id,
        "text": transcript.text or "",
        "segments": json.loads(transcript.segments) if transcript.segments else [],
        "summary": transcript.summary,
        "action_items": json.loads(transcript.action_items) if transcript.action_items else [],
        "key_topics": json.loads(transcript.key_topics) if transcript.key_topics else [],
        "language": transcript.language or "en",
        "word_count": transcript.word_count or 0,
        "created_at": transcript.created_at.isoformat() if transcript.created_at else None
    }


@router.post("/{recording_id}/transcribe")
async def trigger_transcription(
    recording_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Manually trigger transcription for a recording"""
    query = text("""
        SELECT id, storage_path, storage_type, has_transcript
        FROM workspace.meet_recordings
        WHERE id = :id
    """)
    result = await db.execute(query, {"id": recording_id})
    recording = result.fetchone()

    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")

    if recording.has_transcript:
        raise HTTPException(status_code=400, detail="Transcript already exists")

    update_query = text("""
        UPDATE workspace.meet_recordings
        SET status = 'transcribing', updated_at = NOW()
        WHERE id = :id
    """)
    await db.execute(update_query, {"id": recording_id})
    await db.commit()

    background_tasks.add_task(
        _transcribe_recording_task,
        recording_id,
        recording.storage_path,
        recording.storage_type
    )

    return {"message": "Transcription started", "recording_id": recording_id}


@router.delete("/{recording_id}")
async def delete_recording(
    recording_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete a recording"""
    user_id = current_user.get("user_id") or current_user.get("id") or current_user.get("sub")

    query = text("""
        SELECT id, storage_path, storage_type, user_id
        FROM workspace.meet_recordings
        WHERE id = :id
    """)
    result = await db.execute(query, {"id": recording_id})
    recording = result.fetchone()

    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")

    if str(recording.user_id) != str(user_id):
        raise HTTPException(status_code=403, detail="Only recording owner can delete")

    if recording.storage_path:
        await recording_storage_service.delete_recording(
            recording.storage_type,
            recording.storage_path,
            current_user.get("username")
        )

    await db.execute(
        text("DELETE FROM workspace.meet_transcripts WHERE recording_id = :id"),
        {"id": recording_id}
    )

    await db.execute(
        text("DELETE FROM workspace.meet_recordings WHERE id = :id"),
        {"id": recording_id}
    )
    await db.commit()

    return {"success": True, "message": "Recording deleted"}


@router.get("/{recording_id}/status")
async def get_recording_status(
    recording_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get real-time status of a recording (for polling)"""
    query = text("""
        SELECT id, status, egress_id, file_size_bytes, duration_seconds, has_transcript
        FROM workspace.meet_recordings
        WHERE id = :id
    """)
    result = await db.execute(query, {"id": recording_id})
    recording = result.fetchone()

    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")

    return {
        "recording_id": str(recording.id),
        "status": recording.status,
        "has_transcript": recording.has_transcript or False,
        "file_size_bytes": recording.file_size_bytes,
        "duration_seconds": recording.duration_seconds
    }


@router.post("/{recording_id}/share")
async def create_share_link(
    recording_id: str,
    request: ShareLinkRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a shareable link for a recording"""
    query = text("""
        SELECT id, storage_path, storage_type, user_id
        FROM workspace.meet_recordings
        WHERE id = :id
    """)
    result = await db.execute(query, {"id": recording_id})
    recording = result.fetchone()

    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")

    share_url = f"/api/v1/recordings/{recording_id}/view"
    expires_at = datetime.utcnow() + timedelta(days=request.expire_days)

    update_query = text("""
        UPDATE workspace.meet_recordings
        SET share_url = :share_url, share_expires_at = :expires_at, updated_at = NOW()
        WHERE id = :id
    """)
    await db.execute(update_query, {
        "id": recording_id,
        "share_url": share_url,
        "expires_at": expires_at
    })
    await db.commit()

    return {
        "share_url": share_url,
        "expires_at": expires_at.isoformat(),
        "password_protected": bool(request.password)
    }
