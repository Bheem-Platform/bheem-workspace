"""
Bheem Slides - Presentation API
Google Slides-like presentation functionality
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import uuid
import json

from core.database import get_db
from core.security import get_current_user
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/slides", tags=["Bheem Slides"])


# =============================================
# Models
# =============================================

class PresentationCreate(BaseModel):
    title: str
    description: Optional[str] = None
    folder_id: Optional[str] = None
    template_id: Optional[str] = None

    @validator('title')
    def validate_title(cls, v):
        if not v or len(v.strip()) < 1:
            raise ValueError('Title is required')
        return v.strip()


class PresentationUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    theme: Optional[Dict[str, Any]] = None
    is_starred: Optional[bool] = None


class SlideCreate(BaseModel):
    layout: str = "blank"  # title, title_content, two_column, section, blank
    content: Optional[Dict[str, Any]] = None
    index: Optional[int] = None


class SlideUpdate(BaseModel):
    layout: Optional[str] = None
    content: Optional[Dict[str, Any]] = None
    speaker_notes: Optional[str] = None
    transition: Optional[Dict[str, Any]] = None
    background: Optional[Dict[str, Any]] = None


class SlideReorder(BaseModel):
    slide_ids: List[str]  # Ordered list of slide IDs


# =============================================
# Presentation Endpoints
# =============================================

@router.get("")
async def list_presentations(
    folder_id: Optional[str] = Query(None),
    starred_only: bool = Query(False),
    search: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """List presentations accessible by the user"""
    user_id = current_user.get("id") or current_user.get("user_id")
    tenant_id = current_user.get("tenant_id")

    query = """
        SELECT
            p.id, p.title, p.description, p.is_starred, p.folder_id,
            p.theme, p.created_at, p.updated_at, p.created_by,
            u.name as owner_name,
            (SELECT COUNT(*) FROM workspace.slides s WHERE s.presentation_id = p.id) as slide_count
        FROM workspace.presentations p
        LEFT JOIN workspace.tenant_users u ON p.created_by = u.id
        LEFT JOIN workspace.presentation_shares ps ON p.id = ps.presentation_id AND ps.user_id = CAST(:user_id AS uuid)
        WHERE (p.created_by = CAST(:user_id AS uuid) OR ps.user_id IS NOT NULL)
        AND p.tenant_id = CAST(:tenant_id AS uuid)
        AND p.is_deleted = FALSE
    """
    params = {"user_id": user_id, "tenant_id": tenant_id, "limit": limit, "offset": offset}

    if folder_id:
        query += " AND p.folder_id = CAST(:folder_id AS uuid)"
        params["folder_id"] = folder_id

    if starred_only:
        query += " AND p.is_starred = TRUE"

    if search:
        query += " AND p.title ILIKE :search"
        params["search"] = f"%{search}%"

    query += " ORDER BY p.updated_at DESC LIMIT :limit OFFSET :offset"

    result = await db.execute(text(query), params)
    presentations = result.fetchall()

    return {
        "presentations": [
            {
                "id": str(p.id),
                "title": p.title,
                "description": p.description,
                "is_starred": p.is_starred,
                "folder_id": str(p.folder_id) if p.folder_id else None,
                "slide_count": p.slide_count,
                "theme": p.theme,
                "owner": {
                    "id": str(p.created_by),
                    "name": p.owner_name
                },
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "updated_at": p.updated_at.isoformat() if p.updated_at else None
            }
            for p in presentations
        ],
        "count": len(presentations)
    }


@router.post("")
async def create_presentation(
    data: PresentationCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Create a new presentation"""
    user_id = current_user.get("id") or current_user.get("user_id")
    tenant_id = current_user.get("tenant_id")
    presentation_id = str(uuid.uuid4())

    # Default theme
    default_theme = {
        "font_heading": "Arial",
        "font_body": "Arial",
        "color_primary": "#1a73e8",
        "color_secondary": "#34a853",
        "color_background": "#ffffff"
    }

    # Create presentation
    await db.execute(text("""
        INSERT INTO workspace.presentations
        (id, tenant_id, title, description, folder_id, theme, created_by, created_at, updated_at)
        VALUES (
            CAST(:id AS uuid),
            CAST(:tenant_id AS uuid),
            :title,
            :description,
            CAST(:folder_id AS uuid),
            :theme,
            CAST(:created_by AS uuid),
            NOW(),
            NOW()
        )
    """), {
        "id": presentation_id,
        "tenant_id": tenant_id,
        "title": data.title,
        "description": data.description,
        "folder_id": data.folder_id,
        "theme": json.dumps(default_theme),
        "created_by": user_id
    })

    # Create default title slide
    slide_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO workspace.slides
        (id, presentation_id, slide_index, layout, content, created_at, updated_at)
        VALUES (
            CAST(:id AS uuid),
            CAST(:presentation_id AS uuid),
            0,
            'title',
            :content,
            NOW(),
            NOW()
        )
    """), {
        "id": slide_id,
        "presentation_id": presentation_id,
        "content": json.dumps({
            "title": {"text": data.title, "x": 50, "y": 200, "width": 900, "fontSize": 48},
            "subtitle": {"text": "Click to add subtitle", "x": 50, "y": 300, "width": 900, "fontSize": 24}
        })
    })

    await db.commit()

    logger.info(f"Created presentation {data.title} ({presentation_id}) by user {user_id}")

    return {
        "id": presentation_id,
        "title": data.title,
        "default_slide_id": slide_id,
        "message": "Presentation created successfully"
    }


@router.get("/{presentation_id}")
async def get_presentation(
    presentation_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get presentation with all slides"""
    user_id = current_user.get("id") or current_user.get("user_id")
    tenant_id = current_user.get("tenant_id")

    # Get presentation
    result = await db.execute(text("""
        SELECT
            p.id, p.title, p.description, p.is_starred, p.folder_id, p.theme,
            p.created_at, p.updated_at, p.created_by,
            u.name as owner_name, u.email as owner_email,
            COALESCE(ps.permission, CASE WHEN p.created_by = CAST(:user_id AS uuid) THEN 'owner' ELSE NULL END) as permission
        FROM workspace.presentations p
        LEFT JOIN workspace.tenant_users u ON p.created_by = u.id
        LEFT JOIN workspace.presentation_shares ps ON p.id = ps.presentation_id AND ps.user_id = CAST(:user_id AS uuid)
        WHERE p.id = CAST(:presentation_id AS uuid)
        AND p.tenant_id = CAST(:tenant_id AS uuid)
        AND p.is_deleted = FALSE
        AND (p.created_by = CAST(:user_id AS uuid) OR ps.user_id IS NOT NULL)
    """), {"presentation_id": presentation_id, "user_id": user_id, "tenant_id": tenant_id})

    presentation = result.fetchone()
    if not presentation:
        raise HTTPException(status_code=404, detail="Presentation not found")

    # Get slides
    slides_result = await db.execute(text("""
        SELECT id, slide_index, layout, content, speaker_notes, transition, background, is_hidden
        FROM workspace.slides
        WHERE presentation_id = CAST(:presentation_id AS uuid)
        ORDER BY slide_index
    """), {"presentation_id": presentation_id})

    slides = slides_result.fetchall()

    return {
        "id": str(presentation.id),
        "title": presentation.title,
        "description": presentation.description,
        "is_starred": presentation.is_starred,
        "folder_id": str(presentation.folder_id) if presentation.folder_id else None,
        "theme": presentation.theme,
        "permission": presentation.permission,
        "owner": {
            "id": str(presentation.created_by),
            "name": presentation.owner_name,
            "email": presentation.owner_email
        },
        "slides": [
            {
                "id": str(s.id),
                "index": s.slide_index,
                "layout": s.layout,
                "content": s.content or {},
                "speaker_notes": s.speaker_notes,
                "transition": s.transition,
                "background": s.background,
                "is_hidden": s.is_hidden
            }
            for s in slides
        ],
        "created_at": presentation.created_at.isoformat() if presentation.created_at else None,
        "updated_at": presentation.updated_at.isoformat() if presentation.updated_at else None
    }


@router.put("/{presentation_id}")
async def update_presentation(
    presentation_id: str,
    data: PresentationUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Update presentation metadata"""
    user_id = current_user.get("id") or current_user.get("user_id")

    # Verify access
    existing = await db.execute(text("""
        SELECT id FROM workspace.presentations
        WHERE id = CAST(:id AS uuid)
        AND is_deleted = FALSE
        AND (created_by = CAST(:user_id AS uuid) OR id IN (
            SELECT presentation_id FROM workspace.presentation_shares
            WHERE user_id = CAST(:user_id AS uuid) AND permission = 'edit'
        ))
    """), {"id": presentation_id, "user_id": user_id})

    if not existing.fetchone():
        raise HTTPException(status_code=404, detail="Presentation not found or no edit permission")

    updates = ["updated_at = NOW()"]
    params = {"id": presentation_id}

    if data.title is not None:
        updates.append("title = :title")
        params["title"] = data.title

    if data.description is not None:
        updates.append("description = :description")
        params["description"] = data.description

    if data.theme is not None:
        updates.append("theme = :theme")
        params["theme"] = json.dumps(data.theme)

    if data.is_starred is not None:
        updates.append("is_starred = :is_starred")
        params["is_starred"] = data.is_starred

    query = f"UPDATE workspace.presentations SET {', '.join(updates)} WHERE id = CAST(:id AS uuid)"
    await db.execute(text(query), params)
    await db.commit()

    return {"id": presentation_id, "message": "Presentation updated successfully"}


@router.delete("/{presentation_id}")
async def delete_presentation(
    presentation_id: str,
    permanent: bool = Query(False),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Delete a presentation"""
    user_id = current_user.get("id") or current_user.get("user_id")

    # Verify ownership
    existing = await db.execute(text("""
        SELECT id, title FROM workspace.presentations
        WHERE id = CAST(:id AS uuid) AND created_by = CAST(:user_id AS uuid)
    """), {"id": presentation_id, "user_id": user_id})

    presentation = existing.fetchone()
    if not presentation:
        raise HTTPException(status_code=404, detail="Presentation not found or not owner")

    if permanent:
        await db.execute(text("DELETE FROM workspace.slides WHERE presentation_id = CAST(:id AS uuid)"), {"id": presentation_id})
        await db.execute(text("DELETE FROM workspace.presentation_shares WHERE presentation_id = CAST(:id AS uuid)"), {"id": presentation_id})
        await db.execute(text("DELETE FROM workspace.presentations WHERE id = CAST(:id AS uuid)"), {"id": presentation_id})
    else:
        await db.execute(text("""
            UPDATE workspace.presentations
            SET is_deleted = TRUE, deleted_at = NOW()
            WHERE id = CAST(:id AS uuid)
        """), {"id": presentation_id})

    await db.commit()

    return {"message": f"Presentation '{presentation.title}' deleted successfully"}


# =============================================
# Slide Endpoints
# =============================================

@router.post("/{presentation_id}/slides")
async def create_slide(
    presentation_id: str,
    data: SlideCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Add a new slide to a presentation"""
    user_id = current_user.get("id") or current_user.get("user_id")

    # Verify access
    await _verify_presentation_access(db, presentation_id, user_id, "edit")

    # Get next index
    if data.index is None:
        count_result = await db.execute(text("""
            SELECT COALESCE(MAX(slide_index), -1) + 1 as next_index
            FROM workspace.slides
            WHERE presentation_id = CAST(:presentation_id AS uuid)
        """), {"presentation_id": presentation_id})
        next_index = count_result.fetchone().next_index
    else:
        next_index = data.index
        # Shift existing slides
        await db.execute(text("""
            UPDATE workspace.slides
            SET slide_index = slide_index + 1
            WHERE presentation_id = CAST(:presentation_id AS uuid) AND slide_index >= :index
        """), {"presentation_id": presentation_id, "index": next_index})

    # Default content based on layout
    default_content = _get_default_slide_content(data.layout)
    content = data.content or default_content

    slide_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO workspace.slides
        (id, presentation_id, slide_index, layout, content, created_at, updated_at)
        VALUES (
            CAST(:id AS uuid),
            CAST(:presentation_id AS uuid),
            :index,
            :layout,
            :content,
            NOW(),
            NOW()
        )
    """), {
        "id": slide_id,
        "presentation_id": presentation_id,
        "index": next_index,
        "layout": data.layout,
        "content": json.dumps(content)
    })

    await db.execute(text("""
        UPDATE workspace.presentations SET updated_at = NOW() WHERE id = CAST(:id AS uuid)
    """), {"id": presentation_id})

    await db.commit()

    return {
        "id": slide_id,
        "index": next_index,
        "layout": data.layout,
        "message": "Slide created successfully"
    }


@router.put("/{presentation_id}/slides/{slide_id}")
async def update_slide(
    presentation_id: str,
    slide_id: str,
    data: SlideUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Update a slide"""
    user_id = current_user.get("id") or current_user.get("user_id")

    await _verify_presentation_access(db, presentation_id, user_id, "edit")

    updates = ["updated_at = NOW()"]
    params = {"slide_id": slide_id, "presentation_id": presentation_id}

    if data.layout is not None:
        updates.append("layout = :layout")
        params["layout"] = data.layout

    if data.content is not None:
        updates.append("content = :content")
        params["content"] = json.dumps(data.content)

    if data.speaker_notes is not None:
        updates.append("speaker_notes = :speaker_notes")
        params["speaker_notes"] = data.speaker_notes

    if data.transition is not None:
        updates.append("transition = :transition")
        params["transition"] = json.dumps(data.transition)

    if data.background is not None:
        updates.append("background = :background")
        params["background"] = json.dumps(data.background)

    query = f"""
        UPDATE workspace.slides SET {', '.join(updates)}
        WHERE id = CAST(:slide_id AS uuid) AND presentation_id = CAST(:presentation_id AS uuid)
    """
    await db.execute(text(query), params)

    await db.execute(text("""
        UPDATE workspace.presentations SET updated_at = NOW() WHERE id = CAST(:id AS uuid)
    """), {"id": presentation_id})

    await db.commit()

    return {"id": slide_id, "message": "Slide updated successfully"}


@router.delete("/{presentation_id}/slides/{slide_id}")
async def delete_slide(
    presentation_id: str,
    slide_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Delete a slide"""
    user_id = current_user.get("id") or current_user.get("user_id")

    await _verify_presentation_access(db, presentation_id, user_id, "edit")

    # Check slide count
    count_result = await db.execute(text("""
        SELECT COUNT(*) as count FROM workspace.slides
        WHERE presentation_id = CAST(:presentation_id AS uuid)
    """), {"presentation_id": presentation_id})

    if count_result.fetchone().count <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the only slide")

    # Get slide index for reordering
    slide_result = await db.execute(text("""
        SELECT slide_index FROM workspace.slides
        WHERE id = CAST(:slide_id AS uuid)
    """), {"slide_id": slide_id})

    slide = slide_result.fetchone()
    if not slide:
        raise HTTPException(status_code=404, detail="Slide not found")

    # Delete slide
    await db.execute(text("""
        DELETE FROM workspace.slides WHERE id = CAST(:slide_id AS uuid)
    """), {"slide_id": slide_id})

    # Reorder remaining slides
    await db.execute(text("""
        UPDATE workspace.slides
        SET slide_index = slide_index - 1
        WHERE presentation_id = CAST(:presentation_id AS uuid) AND slide_index > :index
    """), {"presentation_id": presentation_id, "index": slide.slide_index})

    await db.commit()

    return {"message": "Slide deleted successfully"}


@router.put("/{presentation_id}/slides/reorder")
async def reorder_slides(
    presentation_id: str,
    data: SlideReorder,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Reorder slides in a presentation"""
    user_id = current_user.get("id") or current_user.get("user_id")

    await _verify_presentation_access(db, presentation_id, user_id, "edit")

    # Update slide indices
    for index, slide_id in enumerate(data.slide_ids):
        await db.execute(text("""
            UPDATE workspace.slides
            SET slide_index = :index
            WHERE id = CAST(:slide_id AS uuid) AND presentation_id = CAST(:presentation_id AS uuid)
        """), {"index": index, "slide_id": slide_id, "presentation_id": presentation_id})

    await db.commit()

    return {"message": "Slides reordered successfully"}


# =============================================
# Helper Functions
# =============================================

async def _verify_presentation_access(db, presentation_id: str, user_id: str, required: str):
    """Verify user has required access"""
    result = await db.execute(text("""
        SELECT p.id,
            COALESCE(ps.permission, CASE WHEN p.created_by = CAST(:user_id AS uuid) THEN 'owner' ELSE NULL END) as permission
        FROM workspace.presentations p
        LEFT JOIN workspace.presentation_shares ps ON p.id = ps.presentation_id AND ps.user_id = CAST(:user_id AS uuid)
        WHERE p.id = CAST(:presentation_id AS uuid) AND p.is_deleted = FALSE
        AND (p.created_by = CAST(:user_id AS uuid) OR ps.user_id IS NOT NULL)
    """), {"presentation_id": presentation_id, "user_id": user_id})

    presentation = result.fetchone()
    if not presentation:
        raise HTTPException(status_code=404, detail="Presentation not found")

    if required == "edit" and presentation.permission not in ['owner', 'edit']:
        raise HTTPException(status_code=403, detail="No edit permission")


def _get_default_slide_content(layout: str) -> Dict[str, Any]:
    """Get default content for a slide layout"""
    layouts = {
        "title": {
            "title": {"text": "Click to add title", "x": 50, "y": 200, "width": 900, "fontSize": 48},
            "subtitle": {"text": "Click to add subtitle", "x": 50, "y": 300, "width": 900, "fontSize": 24}
        },
        "title_content": {
            "title": {"text": "Title", "x": 50, "y": 50, "width": 900, "fontSize": 36},
            "content": {"text": "Click to add content", "x": 50, "y": 120, "width": 900, "height": 400, "fontSize": 18}
        },
        "two_column": {
            "title": {"text": "Title", "x": 50, "y": 50, "width": 900, "fontSize": 36},
            "left": {"text": "Left column", "x": 50, "y": 120, "width": 420, "height": 400, "fontSize": 18},
            "right": {"text": "Right column", "x": 500, "y": 120, "width": 420, "height": 400, "fontSize": 18}
        },
        "section": {
            "title": {"text": "Section Header", "x": 50, "y": 250, "width": 900, "fontSize": 60, "textAlign": "center"}
        },
        "blank": {}
    }
    return layouts.get(layout, {})
