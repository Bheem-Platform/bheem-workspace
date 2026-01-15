"""
Bheem Forms API
Google Forms-like functionality for surveys, quizzes, and data collection
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
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
router = APIRouter(prefix="/forms", tags=["Bheem Forms"])


# =============================================
# Pydantic Models
# =============================================

class QuestionOption(BaseModel):
    """Option for choice-based questions"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    is_other: bool = False


class QuestionValidation(BaseModel):
    """Validation rules for questions"""
    min_length: Optional[int] = None
    max_length: Optional[int] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    pattern: Optional[str] = None
    error_message: Optional[str] = None


class QuestionCreate(BaseModel):
    """Create a new question"""
    question_type: str  # short_text, long_text, multiple_choice, checkbox, dropdown, file, date, time, scale, grid
    title: str
    description: Optional[str] = None
    is_required: bool = False
    options: Optional[List[QuestionOption]] = None
    validation: Optional[QuestionValidation] = None
    settings: Dict[str, Any] = {}


class QuestionUpdate(BaseModel):
    """Update a question"""
    question_type: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    is_required: Optional[bool] = None
    options: Optional[List[QuestionOption]] = None
    validation: Optional[QuestionValidation] = None
    settings: Optional[Dict[str, Any]] = None


class FormSettings(BaseModel):
    """Form settings"""
    collect_email: bool = False
    limit_responses: bool = False
    response_limit: Optional[int] = None
    allow_edit_response: bool = True
    show_progress_bar: bool = True
    shuffle_questions: bool = False
    confirmation_message: str = "Your response has been recorded."
    require_login: bool = False
    one_response_per_user: bool = False


class FormTheme(BaseModel):
    """Form theme settings"""
    color_primary: str = "#1a73e8"
    color_background: str = "#f8f9fa"
    font_family: str = "Roboto"
    header_image: Optional[str] = None


class FormCreate(BaseModel):
    """Create a new form"""
    title: str
    description: Optional[str] = None
    folder_id: Optional[str] = None
    template_id: Optional[str] = None
    settings: Optional[FormSettings] = None
    theme: Optional[FormTheme] = None


class FormUpdate(BaseModel):
    """Update a form"""
    title: Optional[str] = None
    description: Optional[str] = None
    folder_id: Optional[str] = None
    settings: Optional[FormSettings] = None
    theme: Optional[FormTheme] = None


class ResponseAnswer(BaseModel):
    """Answer to a question"""
    question_id: str
    value: Any  # String, list, dict depending on question type


class FormResponseCreate(BaseModel):
    """Submit a form response"""
    answers: List[ResponseAnswer]
    respondent_email: Optional[str] = None


class ShareRequest(BaseModel):
    """Share a form with a user"""
    email: str
    permission: str = "view"  # view, edit, view_responses
    notify: bool = True


# =============================================
# Form Endpoints
# =============================================

@router.post("")
async def create_form(
    data: FormCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new form"""
    user_id = current_user.get("id") or current_user.get("user_id")
    tenant_id = current_user.get("tenant_id")
    form_id = str(uuid.uuid4())

    settings = (data.settings or FormSettings()).model_dump()
    theme = (data.theme or FormTheme()).model_dump()

    await db.execute(text("""
        INSERT INTO workspace.forms
        (id, tenant_id, title, description, folder_id, settings, theme, status, created_by, created_at, updated_at)
        VALUES (
            CAST(:id AS uuid),
            CAST(:tenant_id AS uuid),
            :title,
            :description,
            CAST(:folder_id AS uuid),
            :settings,
            :theme,
            'draft',
            CAST(:created_by AS uuid),
            NOW(),
            NOW()
        )
    """), {
        "id": form_id,
        "tenant_id": tenant_id,
        "title": data.title,
        "description": data.description,
        "folder_id": data.folder_id,
        "settings": json.dumps(settings),
        "theme": json.dumps(theme),
        "created_by": user_id
    })

    await db.commit()

    logger.info(f"Created form {data.title} ({form_id}) by user {user_id}")

    return {
        "message": "Form created successfully",
        "form": {
            "id": form_id,
            "title": data.title,
            "description": data.description,
            "status": "draft",
            "settings": settings,
            "theme": theme
        }
    }


@router.get("")
async def list_forms(
    folder_id: Optional[str] = None,
    status: Optional[str] = None,
    starred: Optional[bool] = None,
    include_deleted: bool = False,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all forms"""
    user_id = current_user.get("id") or current_user.get("user_id")
    tenant_id = current_user.get("tenant_id")

    query = """
        SELECT
            f.id, f.title, f.description, f.status, f.is_starred, f.folder_id,
            f.settings, f.theme, f.response_count, f.created_at, f.updated_at,
            f.published_at, f.closes_at, f.created_by,
            u.name as owner_name,
            (SELECT COUNT(*) FROM workspace.form_questions fq WHERE fq.form_id = f.id) as question_count
        FROM workspace.forms f
        LEFT JOIN workspace.tenant_users u ON f.created_by = u.id
        LEFT JOIN workspace.form_shares fs ON f.id = fs.form_id AND fs.user_id = CAST(:user_id AS uuid)
        WHERE (f.created_by = CAST(:user_id AS uuid) OR fs.user_id IS NOT NULL)
        AND f.tenant_id = CAST(:tenant_id AS uuid)
    """
    params = {"user_id": user_id, "tenant_id": tenant_id, "limit": limit, "offset": skip}

    if not include_deleted:
        query += " AND f.is_deleted = FALSE"

    if folder_id:
        query += " AND f.folder_id = CAST(:folder_id AS uuid)"
        params["folder_id"] = folder_id

    if status:
        query += " AND f.status = :status"
        params["status"] = status

    if starred is not None:
        query += " AND f.is_starred = :starred"
        params["starred"] = starred

    if search:
        query += " AND f.title ILIKE :search"
        params["search"] = f"%{search}%"

    query += " ORDER BY f.updated_at DESC LIMIT :limit OFFSET :offset"

    result = await db.execute(text(query), params)
    forms = result.fetchall()

    return {
        "forms": [
            {
                "id": str(f.id),
                "title": f.title,
                "description": f.description,
                "status": f.status,
                "is_starred": f.is_starred,
                "folder_id": str(f.folder_id) if f.folder_id else None,
                "question_count": f.question_count,
                "response_count": f.response_count or 0,
                "owner": {
                    "id": str(f.created_by),
                    "name": f.owner_name
                },
                "created_at": f.created_at.isoformat() if f.created_at else None,
                "updated_at": f.updated_at.isoformat() if f.updated_at else None,
                "published_at": f.published_at.isoformat() if f.published_at else None
            }
            for f in forms
        ],
        "total": len(forms)
    }


@router.get("/{form_id}")
async def get_form(
    form_id: str,
    include_questions: bool = True,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a form by ID"""
    user_id = current_user.get("id") or current_user.get("user_id")
    tenant_id = current_user.get("tenant_id")

    result = await db.execute(text("""
        SELECT
            f.id, f.title, f.description, f.status, f.is_starred, f.folder_id,
            f.settings, f.theme, f.response_count, f.created_at, f.updated_at,
            f.published_at, f.closes_at, f.created_by,
            u.name as owner_name, u.email as owner_email,
            COALESCE(fs.permission, CASE WHEN f.created_by = CAST(:user_id AS uuid) THEN 'owner' ELSE NULL END) as permission
        FROM workspace.forms f
        LEFT JOIN workspace.tenant_users u ON f.created_by = u.id
        LEFT JOIN workspace.form_shares fs ON f.id = fs.form_id AND fs.user_id = CAST(:user_id AS uuid)
        WHERE f.id = CAST(:form_id AS uuid)
        AND f.tenant_id = CAST(:tenant_id AS uuid)
        AND f.is_deleted = FALSE
        AND (f.created_by = CAST(:user_id AS uuid) OR fs.user_id IS NOT NULL)
    """), {"form_id": form_id, "user_id": user_id, "tenant_id": tenant_id})

    form = result.fetchone()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    form_data = {
        "id": str(form.id),
        "title": form.title,
        "description": form.description,
        "status": form.status,
        "is_starred": form.is_starred,
        "folder_id": str(form.folder_id) if form.folder_id else None,
        "settings": form.settings or {},
        "theme": form.theme or {},
        "response_count": form.response_count or 0,
        "permission": form.permission,
        "owner": {
            "id": str(form.created_by),
            "name": form.owner_name,
            "email": form.owner_email
        },
        "created_at": form.created_at.isoformat() if form.created_at else None,
        "updated_at": form.updated_at.isoformat() if form.updated_at else None,
        "published_at": form.published_at.isoformat() if form.published_at else None,
        "closes_at": form.closes_at.isoformat() if form.closes_at else None
    }

    if include_questions:
        questions_result = await db.execute(text("""
            SELECT id, question_type, title, description, is_required, options, validation, settings, question_index
            FROM workspace.form_questions
            WHERE form_id = CAST(:form_id AS uuid)
            ORDER BY question_index
        """), {"form_id": form_id})

        questions = questions_result.fetchall()
        form_data["questions"] = [
            {
                "id": str(q.id),
                "question_type": q.question_type,
                "title": q.title,
                "description": q.description,
                "is_required": q.is_required,
                "options": q.options,
                "validation": q.validation,
                "settings": q.settings or {},
                "question_index": q.question_index
            }
            for q in questions
        ]

    return form_data


@router.put("/{form_id}")
async def update_form(
    form_id: str,
    data: FormUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a form"""
    user_id = current_user.get("id") or current_user.get("user_id")
    tenant_id = current_user.get("tenant_id")

    # Verify access
    existing = await db.execute(text("""
        SELECT id FROM workspace.forms
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
        AND is_deleted = FALSE
        AND (created_by = CAST(:user_id AS uuid) OR id IN (
            SELECT form_id FROM workspace.form_shares
            WHERE user_id = CAST(:user_id AS uuid) AND permission = 'edit'
        ))
    """), {"id": form_id, "user_id": user_id, "tenant_id": tenant_id})

    if not existing.fetchone():
        raise HTTPException(status_code=404, detail="Form not found or no edit permission")

    updates = ["updated_at = NOW()"]
    params = {"id": form_id}

    if data.title is not None:
        updates.append("title = :title")
        params["title"] = data.title

    if data.description is not None:
        updates.append("description = :description")
        params["description"] = data.description

    if data.folder_id is not None:
        updates.append("folder_id = CAST(:folder_id AS uuid)")
        params["folder_id"] = data.folder_id

    if data.settings is not None:
        updates.append("settings = :settings")
        params["settings"] = json.dumps(data.settings.model_dump())

    if data.theme is not None:
        updates.append("theme = :theme")
        params["theme"] = json.dumps(data.theme.model_dump())

    query = f"UPDATE workspace.forms SET {', '.join(updates)} WHERE id = CAST(:id AS uuid)"
    await db.execute(text(query), params)
    await db.commit()

    return {"message": "Form updated successfully", "id": form_id}


@router.delete("/{form_id}")
async def delete_form(
    form_id: str,
    permanent: bool = False,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a form (soft delete by default)"""
    user_id = current_user.get("id") or current_user.get("user_id")
    tenant_id = current_user.get("tenant_id")

    # Verify ownership
    existing = await db.execute(text("""
        SELECT id, title FROM workspace.forms
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
        AND created_by = CAST(:user_id AS uuid)
    """), {"id": form_id, "user_id": user_id, "tenant_id": tenant_id})

    form = existing.fetchone()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found or not owner")

    if permanent:
        # Delete responses first
        await db.execute(text("DELETE FROM workspace.form_responses WHERE form_id = CAST(:id AS uuid)"), {"id": form_id})
        # Delete questions
        await db.execute(text("DELETE FROM workspace.form_questions WHERE form_id = CAST(:id AS uuid)"), {"id": form_id})
        # Delete shares
        await db.execute(text("DELETE FROM workspace.form_shares WHERE form_id = CAST(:id AS uuid)"), {"id": form_id})
        # Delete form
        await db.execute(text("DELETE FROM workspace.forms WHERE id = CAST(:id AS uuid)"), {"id": form_id})
        message = "Form permanently deleted"
    else:
        await db.execute(text("""
            UPDATE workspace.forms
            SET is_deleted = TRUE, deleted_at = NOW()
            WHERE id = CAST(:id AS uuid)
        """), {"id": form_id})
        message = "Form moved to trash"

    await db.commit()
    return {"message": message}


@router.post("/{form_id}/restore")
async def restore_form(
    form_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Restore a deleted form"""
    user_id = current_user.get("id") or current_user.get("user_id")
    tenant_id = current_user.get("tenant_id")

    result = await db.execute(text("""
        UPDATE workspace.forms
        SET is_deleted = FALSE, deleted_at = NULL, updated_at = NOW()
        WHERE id = CAST(:id AS uuid)
        AND tenant_id = CAST(:tenant_id AS uuid)
        AND created_by = CAST(:user_id AS uuid)
        AND is_deleted = TRUE
        RETURNING id
    """), {"id": form_id, "user_id": user_id, "tenant_id": tenant_id})

    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Form not found or not deleted")

    await db.commit()
    return {"message": "Form restored successfully"}


@router.post("/{form_id}/star")
async def toggle_star(
    form_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Toggle starred status"""
    user_id = current_user.get("id") or current_user.get("user_id")
    tenant_id = current_user.get("tenant_id")

    # Get current star status
    result = await db.execute(text("""
        SELECT is_starred FROM workspace.forms
        WHERE id = CAST(:id AS uuid)
        AND tenant_id = CAST(:tenant_id AS uuid)
        AND is_deleted = FALSE
        AND (created_by = CAST(:user_id AS uuid) OR id IN (
            SELECT form_id FROM workspace.form_shares WHERE user_id = CAST(:user_id AS uuid)
        ))
    """), {"id": form_id, "user_id": user_id, "tenant_id": tenant_id})

    form = result.fetchone()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    new_status = not form.is_starred

    await db.execute(text("""
        UPDATE workspace.forms SET is_starred = :is_starred, updated_at = NOW()
        WHERE id = CAST(:id AS uuid)
    """), {"id": form_id, "is_starred": new_status})

    await db.commit()

    return {"message": "Star status updated", "is_starred": new_status}


@router.post("/{form_id}/duplicate")
async def duplicate_form(
    form_id: str,
    title: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Duplicate a form"""
    user_id = current_user.get("id") or current_user.get("user_id")
    tenant_id = current_user.get("tenant_id")

    # Get original form
    result = await db.execute(text("""
        SELECT id, title, description, folder_id, settings, theme
        FROM workspace.forms
        WHERE id = CAST(:id AS uuid)
        AND tenant_id = CAST(:tenant_id AS uuid)
        AND is_deleted = FALSE
        AND (created_by = CAST(:user_id AS uuid) OR id IN (
            SELECT form_id FROM workspace.form_shares WHERE user_id = CAST(:user_id AS uuid)
        ))
    """), {"id": form_id, "user_id": user_id, "tenant_id": tenant_id})

    form = result.fetchone()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    new_form_id = str(uuid.uuid4())
    new_title = title or f"Copy of {form.title}"

    # Create new form
    await db.execute(text("""
        INSERT INTO workspace.forms
        (id, tenant_id, title, description, folder_id, settings, theme, status, created_by, created_at, updated_at)
        VALUES (
            CAST(:id AS uuid),
            CAST(:tenant_id AS uuid),
            :title,
            :description,
            CAST(:folder_id AS uuid),
            :settings,
            :theme,
            'draft',
            CAST(:created_by AS uuid),
            NOW(),
            NOW()
        )
    """), {
        "id": new_form_id,
        "tenant_id": tenant_id,
        "title": new_title,
        "description": form.description,
        "folder_id": str(form.folder_id) if form.folder_id else None,
        "settings": json.dumps(form.settings) if form.settings else json.dumps({}),
        "theme": json.dumps(form.theme) if form.theme else json.dumps({}),
        "created_by": user_id
    })

    # Duplicate questions
    questions_result = await db.execute(text("""
        SELECT question_type, title, description, is_required, options, validation, settings, question_index
        FROM workspace.form_questions
        WHERE form_id = CAST(:form_id AS uuid)
        ORDER BY question_index
    """), {"form_id": form_id})

    questions = questions_result.fetchall()
    for q in questions:
        new_q_id = str(uuid.uuid4())
        await db.execute(text("""
            INSERT INTO workspace.form_questions
            (id, form_id, question_type, title, description, is_required, options, validation, settings, question_index, created_at, updated_at)
            VALUES (
                CAST(:id AS uuid),
                CAST(:form_id AS uuid),
                :question_type,
                :title,
                :description,
                :is_required,
                :options,
                :validation,
                :settings,
                :question_index,
                NOW(),
                NOW()
            )
        """), {
            "id": new_q_id,
            "form_id": new_form_id,
            "question_type": q.question_type,
            "title": q.title,
            "description": q.description,
            "is_required": q.is_required,
            "options": json.dumps(q.options) if q.options else None,
            "validation": json.dumps(q.validation) if q.validation else None,
            "settings": json.dumps(q.settings) if q.settings else None,
            "question_index": q.question_index
        })

    await db.commit()

    return {
        "message": "Form duplicated successfully",
        "form": {
            "id": new_form_id,
            "title": new_title
        }
    }


# =============================================
# Publishing Endpoints
# =============================================

@router.post("/{form_id}/publish")
async def publish_form(
    form_id: str,
    closes_at: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Publish a form to accept responses"""
    user_id = current_user.get("id") or current_user.get("user_id")
    tenant_id = current_user.get("tenant_id")

    # Verify ownership and get form
    result = await db.execute(text("""
        SELECT id FROM workspace.forms
        WHERE id = CAST(:id AS uuid)
        AND tenant_id = CAST(:tenant_id AS uuid)
        AND is_deleted = FALSE
        AND (created_by = CAST(:user_id AS uuid) OR id IN (
            SELECT form_id FROM workspace.form_shares WHERE user_id = CAST(:user_id AS uuid) AND permission = 'edit'
        ))
    """), {"id": form_id, "user_id": user_id, "tenant_id": tenant_id})

    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Form not found")

    # Check for questions
    questions_result = await db.execute(text("""
        SELECT COUNT(*) as count FROM workspace.form_questions WHERE form_id = CAST(:form_id AS uuid)
    """), {"form_id": form_id})

    if questions_result.fetchone().count == 0:
        raise HTTPException(status_code=400, detail="Form must have at least one question to publish")

    # Update status
    await db.execute(text("""
        UPDATE workspace.forms
        SET status = 'published', published_at = NOW(), closes_at = :closes_at, updated_at = NOW()
        WHERE id = CAST(:id AS uuid)
    """), {"id": form_id, "closes_at": closes_at})

    await db.commit()

    return {
        "message": "Form published successfully",
        "public_url": f"/forms/{form_id}/respond"
    }


@router.post("/{form_id}/close")
async def close_form(
    form_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Close a form to stop accepting responses"""
    user_id = current_user.get("id") or current_user.get("user_id")
    tenant_id = current_user.get("tenant_id")

    result = await db.execute(text("""
        UPDATE workspace.forms
        SET status = 'closed', closes_at = NOW(), updated_at = NOW()
        WHERE id = CAST(:id AS uuid)
        AND tenant_id = CAST(:tenant_id AS uuid)
        AND is_deleted = FALSE
        AND (created_by = CAST(:user_id AS uuid) OR id IN (
            SELECT form_id FROM workspace.form_shares WHERE user_id = CAST(:user_id AS uuid) AND permission = 'edit'
        ))
        RETURNING id
    """), {"id": form_id, "user_id": user_id, "tenant_id": tenant_id})

    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Form not found")

    await db.commit()
    return {"message": "Form closed successfully"}


@router.post("/{form_id}/reopen")
async def reopen_form(
    form_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Reopen a closed form"""
    user_id = current_user.get("id") or current_user.get("user_id")
    tenant_id = current_user.get("tenant_id")

    result = await db.execute(text("""
        UPDATE workspace.forms
        SET status = 'published', closes_at = NULL, updated_at = NOW()
        WHERE id = CAST(:id AS uuid)
        AND tenant_id = CAST(:tenant_id AS uuid)
        AND is_deleted = FALSE
        AND (created_by = CAST(:user_id AS uuid) OR id IN (
            SELECT form_id FROM workspace.form_shares WHERE user_id = CAST(:user_id AS uuid) AND permission = 'edit'
        ))
        RETURNING id
    """), {"id": form_id, "user_id": user_id, "tenant_id": tenant_id})

    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Form not found")

    await db.commit()
    return {"message": "Form reopened successfully"}


# =============================================
# Question Endpoints
# =============================================

@router.post("/{form_id}/questions")
async def add_question(
    form_id: str,
    question: QuestionCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Add a question to a form"""
    user_id = current_user.get("id") or current_user.get("user_id")

    # Verify access
    form = await _verify_form_access(db, form_id, user_id, "edit")
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    # Get next index
    count_result = await db.execute(text("""
        SELECT COALESCE(MAX(question_index), -1) + 1 as next_index
        FROM workspace.form_questions
        WHERE form_id = CAST(:form_id AS uuid)
    """), {"form_id": form_id})
    next_index = count_result.fetchone().next_index

    question_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO workspace.form_questions
        (id, form_id, question_type, title, description, is_required, options, validation, settings, question_index, created_at, updated_at)
        VALUES (
            CAST(:id AS uuid),
            CAST(:form_id AS uuid),
            :question_type,
            :title,
            :description,
            :is_required,
            :options,
            :validation,
            :settings,
            :question_index,
            NOW(),
            NOW()
        )
    """), {
        "id": question_id,
        "form_id": form_id,
        "question_type": question.question_type,
        "title": question.title,
        "description": question.description,
        "is_required": question.is_required,
        "options": json.dumps([o.model_dump() for o in question.options]) if question.options else None,
        "validation": json.dumps(question.validation.model_dump()) if question.validation else None,
        "settings": json.dumps(question.settings),
        "question_index": next_index
    })

    # Update form timestamp
    await db.execute(text("UPDATE workspace.forms SET updated_at = NOW() WHERE id = CAST(:id AS uuid)"), {"id": form_id})

    await db.commit()

    return {
        "message": "Question added successfully",
        "question": {
            "id": question_id,
            "question_type": question.question_type,
            "title": question.title,
            "question_index": next_index
        }
    }


@router.get("/{form_id}/questions")
async def get_questions(
    form_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all questions for a form"""
    user_id = current_user.get("id") or current_user.get("user_id")

    form = await _verify_form_access(db, form_id, user_id, "view")
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    result = await db.execute(text("""
        SELECT id, question_type, title, description, is_required, options, validation, settings, question_index
        FROM workspace.form_questions
        WHERE form_id = CAST(:form_id AS uuid)
        ORDER BY question_index
    """), {"form_id": form_id})

    questions = result.fetchall()

    return {
        "questions": [
            {
                "id": str(q.id),
                "question_type": q.question_type,
                "title": q.title,
                "description": q.description,
                "is_required": q.is_required,
                "options": q.options,
                "validation": q.validation,
                "settings": q.settings or {},
                "question_index": q.question_index
            }
            for q in questions
        ]
    }


@router.put("/{form_id}/questions/{question_id}")
async def update_question(
    form_id: str,
    question_id: str,
    update: QuestionUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a question"""
    user_id = current_user.get("id") or current_user.get("user_id")

    form = await _verify_form_access(db, form_id, user_id, "edit")
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    # Verify question exists
    existing = await db.execute(text("""
        SELECT id FROM workspace.form_questions
        WHERE id = CAST(:id AS uuid) AND form_id = CAST(:form_id AS uuid)
    """), {"id": question_id, "form_id": form_id})

    if not existing.fetchone():
        raise HTTPException(status_code=404, detail="Question not found")

    updates = ["updated_at = NOW()"]
    params = {"id": question_id}

    if update.question_type is not None:
        updates.append("question_type = :question_type")
        params["question_type"] = update.question_type

    if update.title is not None:
        updates.append("title = :title")
        params["title"] = update.title

    if update.description is not None:
        updates.append("description = :description")
        params["description"] = update.description

    if update.is_required is not None:
        updates.append("is_required = :is_required")
        params["is_required"] = update.is_required

    if update.options is not None:
        updates.append("options = :options")
        params["options"] = json.dumps([o.model_dump() for o in update.options])

    if update.validation is not None:
        updates.append("validation = :validation")
        params["validation"] = json.dumps(update.validation.model_dump())

    if update.settings is not None:
        updates.append("settings = :settings")
        params["settings"] = json.dumps(update.settings)

    query = f"UPDATE workspace.form_questions SET {', '.join(updates)} WHERE id = CAST(:id AS uuid)"
    await db.execute(text(query), params)

    # Update form timestamp
    await db.execute(text("UPDATE workspace.forms SET updated_at = NOW() WHERE id = CAST(:id AS uuid)"), {"id": form_id})

    await db.commit()

    return {"message": "Question updated successfully", "id": question_id}


@router.delete("/{form_id}/questions/{question_id}")
async def delete_question(
    form_id: str,
    question_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a question"""
    user_id = current_user.get("id") or current_user.get("user_id")

    form = await _verify_form_access(db, form_id, user_id, "edit")
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    # Get question index for reordering
    result = await db.execute(text("""
        SELECT question_index FROM workspace.form_questions
        WHERE id = CAST(:id AS uuid) AND form_id = CAST(:form_id AS uuid)
    """), {"id": question_id, "form_id": form_id})

    question = result.fetchone()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    deleted_index = question.question_index

    # Delete question
    await db.execute(text("DELETE FROM workspace.form_questions WHERE id = CAST(:id AS uuid)"), {"id": question_id})

    # Reindex remaining questions
    await db.execute(text("""
        UPDATE workspace.form_questions
        SET question_index = question_index - 1
        WHERE form_id = CAST(:form_id AS uuid) AND question_index > :deleted_index
    """), {"form_id": form_id, "deleted_index": deleted_index})

    # Update form timestamp
    await db.execute(text("UPDATE workspace.forms SET updated_at = NOW() WHERE id = CAST(:id AS uuid)"), {"id": form_id})

    await db.commit()

    return {"message": "Question deleted successfully"}


@router.post("/{form_id}/questions/reorder")
async def reorder_questions(
    form_id: str,
    question_ids: List[str],
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Reorder questions in a form"""
    user_id = current_user.get("id") or current_user.get("user_id")

    form = await _verify_form_access(db, form_id, user_id, "edit")
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    for index, question_id in enumerate(question_ids):
        await db.execute(text("""
            UPDATE workspace.form_questions
            SET question_index = :index
            WHERE id = CAST(:id AS uuid) AND form_id = CAST(:form_id AS uuid)
        """), {"index": index, "id": question_id, "form_id": form_id})

    # Update form timestamp
    await db.execute(text("UPDATE workspace.forms SET updated_at = NOW() WHERE id = CAST(:id AS uuid)"), {"id": form_id})

    await db.commit()

    return {"message": "Questions reordered successfully"}


# =============================================
# Response Endpoints
# =============================================

@router.post("/{form_id}/responses")
async def submit_response(
    form_id: str,
    response: FormResponseCreate,
    db: AsyncSession = Depends(get_db)
):
    """Submit a response to a form (public endpoint)"""
    # Get form and verify it's accepting responses
    result = await db.execute(text("""
        SELECT id, status, settings FROM workspace.forms
        WHERE id = CAST(:id AS uuid) AND is_deleted = FALSE
    """), {"id": form_id})

    form = result.fetchone()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    if form.status != "published":
        raise HTTPException(status_code=400, detail="Form is not accepting responses")

    settings = form.settings or {}

    # Check response limit
    if settings.get("limit_responses"):
        limit = settings.get("response_limit")
        if limit:
            count_result = await db.execute(text("""
                SELECT COUNT(*) as count FROM workspace.form_responses WHERE form_id = CAST(:form_id AS uuid)
            """), {"form_id": form_id})
            if count_result.fetchone().count >= limit:
                raise HTTPException(status_code=400, detail="Form has reached response limit")

    # Validate required questions
    questions_result = await db.execute(text("""
        SELECT id, title, is_required FROM workspace.form_questions WHERE form_id = CAST(:form_id AS uuid)
    """), {"form_id": form_id})

    questions = {str(q.id): q for q in questions_result.fetchall()}
    answers_dict = {a.question_id: a.value for a in response.answers}

    for q_id, q in questions.items():
        if q.is_required and q_id not in answers_dict:
            raise HTTPException(status_code=400, detail=f"Question '{q.title}' is required")

    # Create response
    response_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO workspace.form_responses
        (id, form_id, answers, respondent_email, submitted_at)
        VALUES (
            CAST(:id AS uuid),
            CAST(:form_id AS uuid),
            :answers,
            :respondent_email,
            NOW()
        )
    """), {
        "id": response_id,
        "form_id": form_id,
        "answers": json.dumps(answers_dict),
        "respondent_email": response.respondent_email
    })

    # Update response count
    await db.execute(text("""
        UPDATE workspace.forms SET response_count = COALESCE(response_count, 0) + 1 WHERE id = CAST(:id AS uuid)
    """), {"id": form_id})

    await db.commit()

    confirmation = settings.get("confirmation_message", "Your response has been recorded.")

    return {
        "message": confirmation,
        "response_id": response_id
    }


@router.get("/{form_id}/responses")
async def get_responses(
    form_id: str,
    skip: int = 0,
    limit: int = 50,
    sort_by: str = "submitted_at",
    sort_order: str = "desc",
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all responses for a form"""
    user_id = current_user.get("id") or current_user.get("user_id")

    form = await _verify_form_access(db, form_id, user_id, "view")
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    # Validate sort_by to prevent SQL injection
    valid_sort_columns = ["submitted_at", "respondent_email"]
    if sort_by not in valid_sort_columns:
        sort_by = "submitted_at"

    order = "DESC" if sort_order == "desc" else "ASC"

    result = await db.execute(text(f"""
        SELECT id, answers, respondent_email, submitted_at, edited_at
        FROM workspace.form_responses
        WHERE form_id = CAST(:form_id AS uuid)
        ORDER BY {sort_by} {order}
        LIMIT :limit OFFSET :offset
    """), {"form_id": form_id, "limit": limit, "offset": skip})

    responses = result.fetchall()

    # Get questions for context
    questions_result = await db.execute(text("""
        SELECT id, question_type, title, question_index
        FROM workspace.form_questions
        WHERE form_id = CAST(:form_id AS uuid)
        ORDER BY question_index
    """), {"form_id": form_id})

    questions = questions_result.fetchall()

    # Get total count
    count_result = await db.execute(text("""
        SELECT COUNT(*) as count FROM workspace.form_responses WHERE form_id = CAST(:form_id AS uuid)
    """), {"form_id": form_id})
    total = count_result.fetchone().count

    return {
        "responses": [
            {
                "id": str(r.id),
                "answers": r.answers or {},
                "respondent_email": r.respondent_email,
                "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None,
                "edited_at": r.edited_at.isoformat() if r.edited_at else None
            }
            for r in responses
        ],
        "total": total,
        "questions": [
            {
                "id": str(q.id),
                "question_type": q.question_type,
                "title": q.title,
                "question_index": q.question_index
            }
            for q in questions
        ]
    }


@router.get("/{form_id}/responses/{response_id}")
async def get_response(
    form_id: str,
    response_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific response"""
    user_id = current_user.get("id") or current_user.get("user_id")

    form = await _verify_form_access(db, form_id, user_id, "view")
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    result = await db.execute(text("""
        SELECT id, answers, respondent_email, submitted_at, edited_at
        FROM workspace.form_responses
        WHERE id = CAST(:id AS uuid) AND form_id = CAST(:form_id AS uuid)
    """), {"id": response_id, "form_id": form_id})

    response = result.fetchone()
    if not response:
        raise HTTPException(status_code=404, detail="Response not found")

    # Get questions
    questions_result = await db.execute(text("""
        SELECT id, question_type, title, description, options, question_index
        FROM workspace.form_questions
        WHERE form_id = CAST(:form_id AS uuid)
        ORDER BY question_index
    """), {"form_id": form_id})

    questions = questions_result.fetchall()

    return {
        "response": {
            "id": str(response.id),
            "answers": response.answers or {},
            "respondent_email": response.respondent_email,
            "submitted_at": response.submitted_at.isoformat() if response.submitted_at else None,
            "edited_at": response.edited_at.isoformat() if response.edited_at else None
        },
        "questions": [
            {
                "id": str(q.id),
                "question_type": q.question_type,
                "title": q.title,
                "description": q.description,
                "options": q.options,
                "question_index": q.question_index
            }
            for q in questions
        ]
    }


@router.delete("/{form_id}/responses/{response_id}")
async def delete_response(
    form_id: str,
    response_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a response"""
    user_id = current_user.get("id") or current_user.get("user_id")

    form = await _verify_form_access(db, form_id, user_id, "edit")
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    result = await db.execute(text("""
        DELETE FROM workspace.form_responses
        WHERE id = CAST(:id AS uuid) AND form_id = CAST(:form_id AS uuid)
        RETURNING id
    """), {"id": response_id, "form_id": form_id})

    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Response not found")

    # Update response count
    await db.execute(text("""
        UPDATE workspace.forms SET response_count = GREATEST(COALESCE(response_count, 1) - 1, 0) WHERE id = CAST(:id AS uuid)
    """), {"id": form_id})

    await db.commit()

    return {"message": "Response deleted successfully"}


@router.get("/{form_id}/responses/summary")
async def get_response_summary(
    form_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get summary statistics for form responses"""
    user_id = current_user.get("id") or current_user.get("user_id")

    form = await _verify_form_access(db, form_id, user_id, "view")
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    # Get responses
    responses_result = await db.execute(text("""
        SELECT answers FROM workspace.form_responses WHERE form_id = CAST(:form_id AS uuid)
    """), {"form_id": form_id})
    responses = responses_result.fetchall()

    # Get questions
    questions_result = await db.execute(text("""
        SELECT id, question_type, title, options, question_index
        FROM workspace.form_questions
        WHERE form_id = CAST(:form_id AS uuid)
        ORDER BY question_index
    """), {"form_id": form_id})
    questions = questions_result.fetchall()

    # Build summary for each question
    question_summaries = []
    for q in questions:
        q_id = str(q.id)
        q_type = q.question_type

        summary = {
            "question_id": q_id,
            "title": q.title,
            "question_type": q_type,
            "response_count": 0,
            "data": {}
        }

        # Collect answers
        answers = []
        for r in responses:
            r_answers = r.answers or {}
            if q_id in r_answers:
                answers.append(r_answers[q_id])
                summary["response_count"] += 1

        # Summarize based on question type
        if q_type in ["multiple_choice", "dropdown"]:
            counts = {}
            for a in answers:
                counts[str(a)] = counts.get(str(a), 0) + 1
            summary["data"] = {"counts": counts}

        elif q_type == "checkbox":
            counts = {}
            for a in answers:
                if isinstance(a, list):
                    for item in a:
                        counts[str(item)] = counts.get(str(item), 0) + 1
            summary["data"] = {"counts": counts}

        elif q_type == "scale":
            numeric_answers = [a for a in answers if isinstance(a, (int, float))]
            if numeric_answers:
                summary["data"] = {
                    "average": sum(numeric_answers) / len(numeric_answers),
                    "min": min(numeric_answers),
                    "max": max(numeric_answers),
                    "distribution": {str(a): numeric_answers.count(a) for a in set(numeric_answers)}
                }

        elif q_type in ["short_text", "long_text"]:
            summary["data"] = {"recent_answers": answers[-10:]}

        question_summaries.append(summary)

    return {
        "form_id": form_id,
        "total_responses": len(responses),
        "question_summaries": question_summaries
    }


@router.get("/{form_id}/responses/export")
async def export_responses(
    form_id: str,
    format: str = "csv",
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Export form responses"""
    user_id = current_user.get("id") or current_user.get("user_id")

    form = await _verify_form_access(db, form_id, user_id, "view")
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    # Get responses
    responses_result = await db.execute(text("""
        SELECT id, answers, respondent_email, submitted_at
        FROM workspace.form_responses
        WHERE form_id = CAST(:form_id AS uuid)
        ORDER BY submitted_at DESC
    """), {"form_id": form_id})
    responses = responses_result.fetchall()

    # Get questions
    questions_result = await db.execute(text("""
        SELECT id, title, question_index
        FROM workspace.form_questions
        WHERE form_id = CAST(:form_id AS uuid)
        ORDER BY question_index
    """), {"form_id": form_id})
    questions = questions_result.fetchall()

    if format == "csv":
        headers = ["Response ID", "Submitted At", "Email"]
        headers.extend([q.title for q in questions])

        rows = []
        for r in responses:
            r_answers = r.answers or {}
            row = [str(r.id), r.submitted_at.isoformat() if r.submitted_at else "", r.respondent_email or ""]
            for q in questions:
                answer = r_answers.get(str(q.id), "")
                if isinstance(answer, list):
                    answer = ", ".join(str(a) for a in answer)
                row.append(str(answer))
            rows.append(row)

        return {
            "format": "csv",
            "headers": headers,
            "rows": rows,
            "download_url": f"/forms/{form_id}/responses/download?format=csv"
        }

    elif format == "json":
        return {
            "format": "json",
            "questions": [{"id": str(q.id), "title": q.title, "index": q.question_index} for q in questions],
            "responses": [
                {
                    "id": str(r.id),
                    "answers": r.answers or {},
                    "respondent_email": r.respondent_email,
                    "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None
                }
                for r in responses
            ]
        }

    raise HTTPException(status_code=400, detail="Unsupported format")


# =============================================
# Sharing Endpoints
# =============================================

@router.post("/{form_id}/share")
async def share_form(
    form_id: str,
    share: ShareRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Share a form with a user"""
    user_id = current_user.get("id") or current_user.get("user_id")
    tenant_id = current_user.get("tenant_id")

    # Verify ownership
    result = await db.execute(text("""
        SELECT id FROM workspace.forms
        WHERE id = CAST(:id AS uuid) AND created_by = CAST(:user_id AS uuid)
    """), {"id": form_id, "user_id": user_id})

    if not result.fetchone():
        raise HTTPException(status_code=403, detail="Only the owner can share this form")

    if share.permission not in ["view", "edit", "view_responses"]:
        raise HTTPException(status_code=400, detail="Invalid permission")

    # Find target user
    target_result = await db.execute(text("""
        SELECT id, name FROM workspace.tenant_users
        WHERE email = :email AND tenant_id = CAST(:tenant_id AS uuid)
    """), {"email": share.email, "tenant_id": tenant_id})

    target = target_result.fetchone()
    if not target:
        raise HTTPException(status_code=404, detail="User not found in workspace")

    # Create or update share
    share_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO workspace.form_shares
        (id, form_id, user_id, permission, created_by, created_at)
        VALUES (
            CAST(:id AS uuid),
            CAST(:form_id AS uuid),
            CAST(:target_id AS uuid),
            :permission,
            CAST(:created_by AS uuid),
            NOW()
        )
        ON CONFLICT (form_id, user_id)
        DO UPDATE SET permission = :permission
    """), {
        "id": share_id,
        "form_id": form_id,
        "target_id": str(target.id),
        "permission": share.permission,
        "created_by": user_id
    })

    await db.commit()

    return {
        "message": f"Form shared with {target.name}",
        "permission": share.permission
    }


@router.get("/{form_id}/shares")
async def get_shares(
    form_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all shares for a form"""
    user_id = current_user.get("id") or current_user.get("user_id")

    form = await _verify_form_access(db, form_id, user_id, "view")
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    result = await db.execute(text("""
        SELECT fs.id, fs.permission, fs.created_at,
               u.id as user_id, u.email, u.name
        FROM workspace.form_shares fs
        JOIN workspace.tenant_users u ON fs.user_id = u.id
        WHERE fs.form_id = CAST(:form_id AS uuid)
        ORDER BY fs.created_at DESC
    """), {"form_id": form_id})

    shares = result.fetchall()

    return {
        "shares": [
            {
                "id": str(s.id),
                "user": {
                    "id": str(s.user_id),
                    "email": s.email,
                    "name": s.name
                },
                "permission": s.permission,
                "created_at": s.created_at.isoformat() if s.created_at else None
            }
            for s in shares
        ]
    }


@router.put("/{form_id}/shares/{share_id}")
async def update_share(
    form_id: str,
    share_id: str,
    permission: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update share permission"""
    user_id = current_user.get("id") or current_user.get("user_id")

    # Verify ownership
    form_result = await db.execute(text("""
        SELECT id FROM workspace.forms WHERE id = CAST(:id AS uuid) AND created_by = CAST(:user_id AS uuid)
    """), {"id": form_id, "user_id": user_id})

    if not form_result.fetchone():
        raise HTTPException(status_code=403, detail="Only the owner can modify shares")

    if permission not in ["view", "edit", "view_responses"]:
        raise HTTPException(status_code=400, detail="Invalid permission")

    result = await db.execute(text("""
        UPDATE workspace.form_shares SET permission = :permission
        WHERE id = CAST(:id AS uuid) AND form_id = CAST(:form_id AS uuid)
        RETURNING id
    """), {"id": share_id, "form_id": form_id, "permission": permission})

    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Share not found")

    await db.commit()

    return {"message": "Share updated successfully", "permission": permission}


@router.delete("/{form_id}/shares/{share_id}")
async def remove_share(
    form_id: str,
    share_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove a share"""
    user_id = current_user.get("id") or current_user.get("user_id")

    # Verify ownership
    form_result = await db.execute(text("""
        SELECT id FROM workspace.forms WHERE id = CAST(:id AS uuid) AND created_by = CAST(:user_id AS uuid)
    """), {"id": form_id, "user_id": user_id})

    if not form_result.fetchone():
        raise HTTPException(status_code=403, detail="Only the owner can remove shares")

    result = await db.execute(text("""
        DELETE FROM workspace.form_shares
        WHERE id = CAST(:id AS uuid) AND form_id = CAST(:form_id AS uuid)
        RETURNING id
    """), {"id": share_id, "form_id": form_id})

    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Share not found")

    await db.commit()

    return {"message": "Share removed successfully"}


# =============================================
# Public Form Endpoints (for respondents)
# =============================================

@router.get("/{form_id}/public")
async def get_public_form(
    form_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get form for public viewing/responding"""
    result = await db.execute(text("""
        SELECT id, title, description, status, settings, theme
        FROM workspace.forms
        WHERE id = CAST(:id AS uuid) AND is_deleted = FALSE
    """), {"id": form_id})

    form = result.fetchone()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    if form.status != "published":
        raise HTTPException(status_code=404, detail="Form is not available")

    settings = form.settings or {}

    # Get questions
    questions_result = await db.execute(text("""
        SELECT id, question_type, title, description, is_required, options, settings, question_index
        FROM workspace.form_questions
        WHERE form_id = CAST(:form_id AS uuid)
        ORDER BY question_index
    """), {"form_id": form_id})

    questions = questions_result.fetchall()

    return {
        "id": str(form.id),
        "title": form.title,
        "description": form.description,
        "theme": form.theme,
        "settings": {
            "show_progress_bar": settings.get("show_progress_bar", True),
            "shuffle_questions": settings.get("shuffle_questions", False),
            "collect_email": settings.get("collect_email", False),
        },
        "questions": [
            {
                "id": str(q.id),
                "question_type": q.question_type,
                "title": q.title,
                "description": q.description,
                "is_required": q.is_required,
                "options": q.options,
                "settings": q.settings or {}
            }
            for q in questions
        ]
    }


# =============================================
# Templates
# =============================================

@router.get("/templates/list")
async def list_templates(category: Optional[str] = None):
    """List available form templates"""
    templates = [
        {
            "id": "event-registration",
            "name": "Event Registration",
            "description": "Collect attendee information for events",
            "category": "Events",
            "thumbnail": None
        },
        {
            "id": "feedback-survey",
            "name": "Feedback Survey",
            "description": "Gather customer feedback and suggestions",
            "category": "Surveys",
            "thumbnail": None
        },
        {
            "id": "job-application",
            "name": "Job Application",
            "description": "Collect job applications with resume upload",
            "category": "HR",
            "thumbnail": None
        },
        {
            "id": "contact-form",
            "name": "Contact Form",
            "description": "Simple contact form for websites",
            "category": "General",
            "thumbnail": None
        },
        {
            "id": "rsvp",
            "name": "RSVP",
            "description": "Collect RSVPs for events",
            "category": "Events",
            "thumbnail": None
        },
        {
            "id": "quiz",
            "name": "Quiz",
            "description": "Create quizzes with scoring",
            "category": "Education",
            "thumbnail": None
        }
    ]

    if category:
        templates = [t for t in templates if t["category"].lower() == category.lower()]

    return {"templates": templates}


# =============================================
# Helper Functions
# =============================================

async def _verify_form_access(
    db: AsyncSession,
    form_id: str,
    user_id: str,
    required_permission: str
) -> Optional[Any]:
    """Verify user has required access to form"""
    result = await db.execute(text("""
        SELECT f.id, f.created_by,
            COALESCE(fs.permission, CASE WHEN f.created_by = CAST(:user_id AS uuid) THEN 'owner' ELSE NULL END) as permission
        FROM workspace.forms f
        LEFT JOIN workspace.form_shares fs ON f.id = fs.form_id AND fs.user_id = CAST(:user_id AS uuid)
        WHERE f.id = CAST(:form_id AS uuid)
        AND f.is_deleted = FALSE
        AND (f.created_by = CAST(:user_id AS uuid) OR fs.user_id IS NOT NULL)
    """), {"form_id": form_id, "user_id": user_id})

    form = result.fetchone()
    if not form:
        return None

    permission = form.permission
    if required_permission == "view":
        return form  # Any permission allows view
    elif required_permission == "edit":
        if permission in ['owner', 'edit']:
            return form
    elif required_permission == "owner":
        if permission == 'owner':
            return form

    return None
