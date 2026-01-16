"""
Bheem Workspace - Calendar Tasks API
Google Tasks-like task management with ERP integration
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text, and_, or_
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field
from datetime import datetime

from core.database import get_db
from core.security import get_current_user, require_tenant_member
from models.calendar_models import TaskList, Task
from services.erp_client import erp_client
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/calendar", tags=["Calendar Tasks"])


# ═══════════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class TaskListCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    color: Optional[str] = '#4285f4'
    icon: Optional[str] = 'list'


class TaskListUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    sort_order: Optional[int] = None


class TaskListResponse(BaseModel):
    id: str
    name: str
    color: str
    icon: str
    is_default: bool
    sort_order: int
    task_count: int = 0
    created_at: datetime


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    notes: Optional[str] = None
    due_date: Optional[datetime] = None
    due_time: Optional[str] = None
    task_list_id: Optional[str] = None
    priority: Optional[str] = 'normal'
    parent_task_id: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None
    due_date: Optional[datetime] = None
    due_time: Optional[str] = None
    status: Optional[str] = None
    is_starred: Optional[bool] = None
    priority: Optional[str] = None
    task_list_id: Optional[str] = None
    sort_order: Optional[int] = None


class TaskResponse(BaseModel):
    id: str
    title: str
    notes: Optional[str]
    due_date: Optional[datetime]
    due_time: Optional[str]
    status: str
    completed_at: Optional[datetime]
    is_starred: bool
    priority: str
    sort_order: int
    task_list_id: Optional[str]
    task_list_name: Optional[str] = None
    parent_task_id: Optional[str]
    source: str
    erp_task_id: Optional[str]
    erp_project_id: Optional[str]
    erp_project_name: Optional[str] = None
    subtasks: List['TaskResponse'] = []
    created_at: datetime
    updated_at: datetime


class PersonResponse(BaseModel):
    id: str
    email: str
    name: Optional[str]
    role: Optional[str]
    department: Optional[str]
    avatar_url: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════════════
# PEOPLE SEARCH
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/people/search", response_model=List[PersonResponse])
async def search_workspace_people(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
):
    """
    Search for people in the workspace.
    Searches by name or email.
    """
    tenant_id = current_user.get("tenant_id")
    search_term = f"%{q.lower()}%"

    result = await db.execute(text("""
        SELECT
            id, user_id, email, name, role, department, job_title
        FROM workspace.tenant_users
        WHERE tenant_id = CAST(:tenant_id AS uuid)
          AND is_active = true
          AND (
              LOWER(name) LIKE :search
              OR LOWER(email) LIKE :search
          )
        ORDER BY
            CASE WHEN LOWER(name) LIKE :exact THEN 0 ELSE 1 END,
            name
        LIMIT :limit
    """), {
        "tenant_id": tenant_id,
        "search": search_term,
        "exact": f"{q.lower()}%",
        "limit": limit
    })

    users = result.fetchall()

    return [
        PersonResponse(
            id=str(u.user_id or u.id),
            email=u.email or "",
            name=u.name,
            role=u.role,
            department=u.department
        )
        for u in users
    ]


@router.get("/people", response_model=List[PersonResponse])
async def list_workspace_people(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
):
    """
    List all people in the workspace.
    """
    tenant_id = current_user.get("tenant_id")

    result = await db.execute(text("""
        SELECT
            id, user_id, email, name, role, department, job_title
        FROM workspace.tenant_users
        WHERE tenant_id = CAST(:tenant_id AS uuid)
          AND is_active = true
        ORDER BY name NULLS LAST, email
        LIMIT :limit OFFSET :offset
    """), {
        "tenant_id": tenant_id,
        "limit": limit,
        "offset": offset
    })

    users = result.fetchall()

    return [
        PersonResponse(
            id=str(u.user_id or u.id),
            email=u.email or "",
            name=u.name,
            role=u.role,
            department=u.department
        )
        for u in users
    ]


# ═══════════════════════════════════════════════════════════════════════════════
# TASK LISTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/task-lists", response_model=List[TaskListResponse])
async def get_task_lists(
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
):
    """Get all task lists for the current user."""
    tenant_id = current_user.get("tenant_id")
    user_id = current_user.get("id") or current_user.get("user_id")

    result = await db.execute(text("""
        SELECT
            tl.id, tl.name, tl.color, tl.icon, tl.is_default, tl.sort_order, tl.created_at,
            COUNT(t.id) FILTER (WHERE t.status = 'needsAction') as task_count
        FROM workspace.task_lists tl
        LEFT JOIN workspace.tasks t ON t.task_list_id = tl.id
        WHERE tl.tenant_id = CAST(:tenant_id AS uuid)
          AND tl.user_id = CAST(:user_id AS uuid)
        GROUP BY tl.id
        ORDER BY tl.is_default DESC, tl.sort_order, tl.created_at
    """), {"tenant_id": tenant_id, "user_id": user_id})

    lists = result.fetchall()

    # If no lists exist, create the default "My Tasks" list
    if not lists:
        await db.execute(text("""
            INSERT INTO workspace.task_lists (tenant_id, user_id, name, is_default)
            VALUES (CAST(:tenant_id AS uuid), CAST(:user_id AS uuid), 'My Tasks', true)
        """), {"tenant_id": tenant_id, "user_id": user_id})
        await db.commit()

        # Fetch again
        result = await db.execute(text("""
            SELECT
                tl.id, tl.name, tl.color, tl.icon, tl.is_default, tl.sort_order, tl.created_at,
                0 as task_count
            FROM workspace.task_lists tl
            WHERE tl.tenant_id = CAST(:tenant_id AS uuid)
              AND tl.user_id = CAST(:user_id AS uuid)
        """), {"tenant_id": tenant_id, "user_id": user_id})
        lists = result.fetchall()

    return [
        TaskListResponse(
            id=str(l.id),
            name=l.name,
            color=l.color or '#4285f4',
            icon=l.icon or 'list',
            is_default=l.is_default,
            sort_order=l.sort_order or 0,
            task_count=l.task_count or 0,
            created_at=l.created_at
        )
        for l in lists
    ]


@router.post("/task-lists", response_model=TaskListResponse)
async def create_task_list(
    data: TaskListCreate,
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
):
    """Create a new task list."""
    tenant_id = current_user.get("tenant_id")
    user_id = current_user.get("id") or current_user.get("user_id")

    result = await db.execute(text("""
        INSERT INTO workspace.task_lists (tenant_id, user_id, name, color, icon)
        VALUES (CAST(:tenant_id AS uuid), CAST(:user_id AS uuid), :name, :color, :icon)
        RETURNING id, name, color, icon, is_default, sort_order, created_at
    """), {
        "tenant_id": tenant_id,
        "user_id": user_id,
        "name": data.name,
        "color": data.color,
        "icon": data.icon
    })
    await db.commit()

    row = result.fetchone()
    return TaskListResponse(
        id=str(row.id),
        name=row.name,
        color=row.color,
        icon=row.icon,
        is_default=row.is_default,
        sort_order=row.sort_order or 0,
        task_count=0,
        created_at=row.created_at
    )


@router.patch("/task-lists/{list_id}", response_model=TaskListResponse)
async def update_task_list(
    list_id: str,
    data: TaskListUpdate,
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
):
    """Update a task list."""
    user_id = current_user.get("id") or current_user.get("user_id")

    # Build update query dynamically
    updates = []
    params = {"list_id": list_id, "user_id": user_id}

    if data.name is not None:
        updates.append("name = :name")
        params["name"] = data.name
    if data.color is not None:
        updates.append("color = :color")
        params["color"] = data.color
    if data.icon is not None:
        updates.append("icon = :icon")
        params["icon"] = data.icon
    if data.sort_order is not None:
        updates.append("sort_order = :sort_order")
        params["sort_order"] = data.sort_order

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    updates.append("updated_at = NOW()")

    result = await db.execute(text(f"""
        UPDATE workspace.task_lists
        SET {', '.join(updates)}
        WHERE id = CAST(:list_id AS uuid) AND user_id = CAST(:user_id AS uuid)
        RETURNING id, name, color, icon, is_default, sort_order, created_at
    """), params)
    await db.commit()

    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Task list not found")

    return TaskListResponse(
        id=str(row.id),
        name=row.name,
        color=row.color,
        icon=row.icon,
        is_default=row.is_default,
        sort_order=row.sort_order or 0,
        task_count=0,
        created_at=row.created_at
    )


@router.delete("/task-lists/{list_id}")
async def delete_task_list(
    list_id: str,
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
):
    """Delete a task list (cannot delete default list)."""
    user_id = current_user.get("id") or current_user.get("user_id")

    # Check if it's the default list
    result = await db.execute(text("""
        SELECT is_default FROM workspace.task_lists
        WHERE id = CAST(:list_id AS uuid) AND user_id = CAST(:user_id AS uuid)
    """), {"list_id": list_id, "user_id": user_id})

    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Task list not found")
    if row.is_default:
        raise HTTPException(status_code=400, detail="Cannot delete the default task list")

    await db.execute(text("""
        DELETE FROM workspace.task_lists
        WHERE id = CAST(:list_id AS uuid) AND user_id = CAST(:user_id AS uuid)
    """), {"list_id": list_id, "user_id": user_id})
    await db.commit()

    return {"success": True, "message": "Task list deleted"}


# ═══════════════════════════════════════════════════════════════════════════════
# TASKS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/tasks", response_model=List[TaskResponse])
async def get_tasks(
    list_id: Optional[str] = Query(None, description="Filter by task list"),
    starred: Optional[bool] = Query(None, description="Filter starred tasks"),
    status: Optional[str] = Query(None, description="Filter by status (needsAction, completed)"),
    include_erp: bool = Query(True, description="Include ERP project tasks"),
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all tasks for the current user.
    Combines personal tasks with ERP project tasks.
    """
    tenant_id = current_user.get("tenant_id")
    user_id = current_user.get("id") or current_user.get("user_id")

    # Build query conditions
    conditions = [
        "t.tenant_id = CAST(:tenant_id AS uuid)",
        "t.user_id = CAST(:user_id AS uuid)",
        "t.parent_task_id IS NULL"  # Only top-level tasks
    ]
    params = {"tenant_id": tenant_id, "user_id": user_id}

    if list_id:
        conditions.append("t.task_list_id = CAST(:list_id AS uuid)")
        params["list_id"] = list_id
    if starred is not None:
        conditions.append("t.is_starred = :starred")
        params["starred"] = starred
    if status:
        conditions.append("t.status = :status")
        params["status"] = status

    result = await db.execute(text(f"""
        SELECT
            t.id, t.title, t.notes, t.due_date, t.due_time, t.status, t.completed_at,
            t.is_starred, t.priority, t.sort_order, t.task_list_id, t.parent_task_id,
            t.source, t.erp_task_id, t.erp_project_id, t.created_at, t.updated_at,
            tl.name as task_list_name
        FROM workspace.tasks t
        LEFT JOIN workspace.task_lists tl ON t.task_list_id = tl.id
        WHERE {' AND '.join(conditions)}
        ORDER BY
            CASE WHEN t.status = 'needsAction' THEN 0 ELSE 1 END,
            t.due_date NULLS LAST,
            t.sort_order,
            t.created_at DESC
    """), params)

    tasks = result.fetchall()

    # Get subtasks
    task_ids = [str(t.id) for t in tasks]
    subtasks_map = {}

    if task_ids:
        # Use IN clause with proper UUID casting for each ID
        task_ids_str = ','.join([f"'{tid}'" for tid in task_ids])
        subtasks_result = await db.execute(text(f"""
            SELECT
                t.id, t.title, t.notes, t.due_date, t.due_time, t.status, t.completed_at,
                t.is_starred, t.priority, t.sort_order, t.task_list_id, t.parent_task_id,
                t.source, t.erp_task_id, t.erp_project_id, t.created_at, t.updated_at
            FROM workspace.tasks t
            WHERE t.parent_task_id IN ({task_ids_str})
            ORDER BY t.sort_order, t.created_at
        """))

        for st in subtasks_result.fetchall():
            parent_id = str(st.parent_task_id)
            if parent_id not in subtasks_map:
                subtasks_map[parent_id] = []
            subtasks_map[parent_id].append(TaskResponse(
                id=str(st.id),
                title=st.title,
                notes=st.notes,
                due_date=st.due_date,
                due_time=st.due_time,
                status=st.status,
                completed_at=st.completed_at,
                is_starred=st.is_starred,
                priority=st.priority,
                sort_order=st.sort_order or 0,
                task_list_id=str(st.task_list_id) if st.task_list_id else None,
                parent_task_id=str(st.parent_task_id) if st.parent_task_id else None,
                source=st.source,
                erp_task_id=st.erp_task_id,
                erp_project_id=st.erp_project_id,
                subtasks=[],
                created_at=st.created_at,
                updated_at=st.updated_at
            ))

    response_tasks = [
        TaskResponse(
            id=str(t.id),
            title=t.title,
            notes=t.notes,
            due_date=t.due_date,
            due_time=t.due_time,
            status=t.status,
            completed_at=t.completed_at,
            is_starred=t.is_starred,
            priority=t.priority,
            sort_order=t.sort_order or 0,
            task_list_id=str(t.task_list_id) if t.task_list_id else None,
            task_list_name=t.task_list_name,
            parent_task_id=str(t.parent_task_id) if t.parent_task_id else None,
            source=t.source,
            erp_task_id=t.erp_task_id,
            erp_project_id=t.erp_project_id,
            subtasks=subtasks_map.get(str(t.id), []),
            created_at=t.created_at,
            updated_at=t.updated_at
        )
        for t in tasks
    ]

    # Optionally include ERP tasks
    if include_erp and not list_id:
        try:
            erp_tasks = await get_erp_tasks(current_user, db)
            response_tasks.extend(erp_tasks)
        except Exception as e:
            logger.warning(f"Failed to fetch ERP tasks: {e}")

    return response_tasks


async def get_erp_tasks(current_user: dict, db: AsyncSession) -> List[TaskResponse]:
    """Fetch tasks from ERP project management."""
    try:
        employee_id = current_user.get("erp_employee_id")
        company_id = current_user.get("company_id")

        if not employee_id or not company_id:
            return []

        erp_tasks = await erp_client.get_my_tasks(
            company_id=company_id,
            employee_id=employee_id
        )

        return [
            TaskResponse(
                id=f"erp-{t.get('id')}",
                title=t.get('title', 'Untitled Task'),
                notes=t.get('description'),
                due_date=datetime.fromisoformat(t['due_date']) if t.get('due_date') else None,
                due_time=None,
                status='completed' if t.get('status') == 'Completed' else 'needsAction',
                completed_at=None,
                is_starred=False,
                priority=t.get('priority', 'normal').lower(),
                sort_order=0,
                task_list_id=None,
                task_list_name=None,
                parent_task_id=None,
                source='erp',
                erp_task_id=str(t.get('id')),
                erp_project_id=str(t.get('project_id')),
                erp_project_name=t.get('project_name'),
                subtasks=[],
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            for t in erp_tasks
        ]
    except Exception as e:
        logger.warning(f"ERP tasks fetch failed: {e}")
        return []


@router.post("/tasks", response_model=TaskResponse)
async def create_task(
    data: TaskCreate,
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
):
    """Create a new task."""
    tenant_id = current_user.get("tenant_id")
    user_id = current_user.get("id") or current_user.get("user_id")

    # If no task list specified, use the default one
    task_list_id = data.task_list_id
    if not task_list_id:
        result = await db.execute(text("""
            SELECT id FROM workspace.task_lists
            WHERE tenant_id = CAST(:tenant_id AS uuid)
              AND user_id = CAST(:user_id AS uuid)
              AND is_default = true
            LIMIT 1
        """), {"tenant_id": tenant_id, "user_id": user_id})
        row = result.fetchone()
        if row:
            task_list_id = str(row.id)

    result = await db.execute(text("""
        INSERT INTO workspace.tasks (
            tenant_id, user_id, task_list_id, title, notes, due_date, due_time,
            priority, parent_task_id, source
        )
        VALUES (
            CAST(:tenant_id AS uuid), CAST(:user_id AS uuid),
            CAST(:task_list_id AS uuid), :title, :notes, :due_date, :due_time,
            :priority, CAST(:parent_task_id AS uuid), 'personal'
        )
        RETURNING id, title, notes, due_date, due_time, status, completed_at,
                  is_starred, priority, sort_order, task_list_id, parent_task_id,
                  source, erp_task_id, erp_project_id, created_at, updated_at
    """), {
        "tenant_id": tenant_id,
        "user_id": user_id,
        "task_list_id": task_list_id,
        "title": data.title,
        "notes": data.notes,
        "due_date": data.due_date,
        "due_time": data.due_time,
        "priority": data.priority,
        "parent_task_id": data.parent_task_id
    })
    await db.commit()

    t = result.fetchone()
    return TaskResponse(
        id=str(t.id),
        title=t.title,
        notes=t.notes,
        due_date=t.due_date,
        due_time=t.due_time,
        status=t.status,
        completed_at=t.completed_at,
        is_starred=t.is_starred,
        priority=t.priority,
        sort_order=t.sort_order or 0,
        task_list_id=str(t.task_list_id) if t.task_list_id else None,
        parent_task_id=str(t.parent_task_id) if t.parent_task_id else None,
        source=t.source,
        erp_task_id=t.erp_task_id,
        erp_project_id=t.erp_project_id,
        subtasks=[],
        created_at=t.created_at,
        updated_at=t.updated_at
    )


@router.patch("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    data: TaskUpdate,
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
):
    """Update a task."""
    user_id = current_user.get("id") or current_user.get("user_id")

    # Build update query dynamically
    updates = []
    params = {"task_id": task_id, "user_id": user_id}

    if data.title is not None:
        updates.append("title = :title")
        params["title"] = data.title
    if data.notes is not None:
        updates.append("notes = :notes")
        params["notes"] = data.notes
    if data.due_date is not None:
        updates.append("due_date = :due_date")
        params["due_date"] = data.due_date
    if data.due_time is not None:
        updates.append("due_time = :due_time")
        params["due_time"] = data.due_time
    if data.status is not None:
        updates.append("status = :status")
        params["status"] = data.status
        if data.status == 'completed':
            updates.append("completed_at = NOW()")
        else:
            updates.append("completed_at = NULL")
    if data.is_starred is not None:
        updates.append("is_starred = :is_starred")
        params["is_starred"] = data.is_starred
    if data.priority is not None:
        updates.append("priority = :priority")
        params["priority"] = data.priority
    if data.task_list_id is not None:
        updates.append("task_list_id = CAST(:task_list_id AS uuid)")
        params["task_list_id"] = data.task_list_id
    if data.sort_order is not None:
        updates.append("sort_order = :sort_order")
        params["sort_order"] = data.sort_order

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    updates.append("updated_at = NOW()")

    result = await db.execute(text(f"""
        UPDATE workspace.tasks
        SET {', '.join(updates)}
        WHERE id = CAST(:task_id AS uuid) AND user_id = CAST(:user_id AS uuid)
        RETURNING id, title, notes, due_date, due_time, status, completed_at,
                  is_starred, priority, sort_order, task_list_id, parent_task_id,
                  source, erp_task_id, erp_project_id, created_at, updated_at
    """), params)
    await db.commit()

    t = result.fetchone()
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")

    return TaskResponse(
        id=str(t.id),
        title=t.title,
        notes=t.notes,
        due_date=t.due_date,
        due_time=t.due_time,
        status=t.status,
        completed_at=t.completed_at,
        is_starred=t.is_starred,
        priority=t.priority,
        sort_order=t.sort_order or 0,
        task_list_id=str(t.task_list_id) if t.task_list_id else None,
        parent_task_id=str(t.parent_task_id) if t.parent_task_id else None,
        source=t.source,
        erp_task_id=t.erp_task_id,
        erp_project_id=t.erp_project_id,
        subtasks=[],
        created_at=t.created_at,
        updated_at=t.updated_at
    )


@router.delete("/tasks/{task_id}")
async def delete_task(
    task_id: str,
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
):
    """Delete a task and its subtasks."""
    user_id = current_user.get("id") or current_user.get("user_id")

    result = await db.execute(text("""
        DELETE FROM workspace.tasks
        WHERE id = CAST(:task_id AS uuid) AND user_id = CAST(:user_id AS uuid)
        RETURNING id
    """), {"task_id": task_id, "user_id": user_id})
    await db.commit()

    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Task not found")

    return {"success": True, "message": "Task deleted"}


@router.post("/tasks/{task_id}/toggle-star")
async def toggle_task_star(
    task_id: str,
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
):
    """Toggle the starred status of a task."""
    user_id = current_user.get("id") or current_user.get("user_id")

    result = await db.execute(text("""
        UPDATE workspace.tasks
        SET is_starred = NOT is_starred, updated_at = NOW()
        WHERE id = CAST(:task_id AS uuid) AND user_id = CAST(:user_id AS uuid)
        RETURNING is_starred
    """), {"task_id": task_id, "user_id": user_id})
    await db.commit()

    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Task not found")

    return {"success": True, "is_starred": row.is_starred}


@router.post("/tasks/{task_id}/complete")
async def complete_task(
    task_id: str,
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
):
    """Mark a task as completed."""
    user_id = current_user.get("id") or current_user.get("user_id")

    result = await db.execute(text("""
        UPDATE workspace.tasks
        SET status = 'completed', completed_at = NOW(), updated_at = NOW()
        WHERE id = CAST(:task_id AS uuid) AND user_id = CAST(:user_id AS uuid)
        RETURNING id
    """), {"task_id": task_id, "user_id": user_id})
    await db.commit()

    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Task not found")

    return {"success": True, "message": "Task completed"}


@router.post("/tasks/{task_id}/uncomplete")
async def uncomplete_task(
    task_id: str,
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
):
    """Mark a completed task as incomplete."""
    user_id = current_user.get("id") or current_user.get("user_id")

    result = await db.execute(text("""
        UPDATE workspace.tasks
        SET status = 'needsAction', completed_at = NULL, updated_at = NOW()
        WHERE id = CAST(:task_id AS uuid) AND user_id = CAST(:user_id AS uuid)
        RETURNING id
    """), {"task_id": task_id, "user_id": user_id})
    await db.commit()

    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Task not found")

    return {"success": True, "message": "Task marked as incomplete"}
