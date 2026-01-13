"""
Bheem Workspace - Project Management API
Provides access to ERP PM module data for workspace users.
Uses Direct API approach - fetches from ERP in real-time.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel

from core.database import get_db
from core.security import get_current_user
from services.erp_client import erp_client
from core.config import settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pm", tags=["Project Management"])


# ═══════════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class ProjectSummary(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    status: str
    priority: str
    completion_percentage: int = 0
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    project_manager_id: Optional[str] = None
    team_count: int = 0


class TaskSummary(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    status: str
    priority: str
    completion_percentage: int = 0
    due_date: Optional[str] = None
    assigned_to: Optional[str] = None
    project_id: Optional[str] = None
    project_name: Optional[str] = None


class TaskStatusUpdate(BaseModel):
    status: str
    completion_percentage: Optional[int] = None


class TimeLogCreate(BaseModel):
    hours: float
    description: Optional[str] = None
    log_date: Optional[str] = None


class CommentCreate(BaseModel):
    content: str


class PMDashboard(BaseModel):
    total_projects: int = 0
    active_projects: int = 0
    total_tasks: int = 0
    my_tasks: int = 0
    overdue_tasks: int = 0
    tasks_by_status: dict = {}
    recent_projects: List[dict] = []
    recent_tasks: List[dict] = []


# ═══════════════════════════════════════════════════════════════════════════════
# DASHBOARD
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/dashboard", response_model=PMDashboard)
async def get_pm_dashboard(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get PM dashboard with project and task summaries.
    Shows data relevant to the current user.
    """
    try:
        # Get user's employee ID from ERP mapping
        employee_id = current_user.get("erp_employee_id")
        company_id = current_user.get("company_id")

        dashboard = await erp_client.get_pm_dashboard(
            company_id=company_id,
            employee_id=employee_id
        )

        return dashboard

    except Exception as e:
        logger.error(f"Failed to fetch PM dashboard: {e}")
        # Return empty dashboard on error
        return PMDashboard()


# ═══════════════════════════════════════════════════════════════════════════════
# PROJECTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/projects")
async def list_projects(
    status: Optional[str] = Query(None, description="Filter by status: ACTIVE, ON_HOLD, COMPLETED"),
    limit: int = Query(50, le=100),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List projects accessible to the current user.
    For internal mode users, shows company projects.
    """
    try:
        company_id = current_user.get("company_id")
        employee_id = current_user.get("erp_employee_id")

        # If user has employee ID, get their projects
        if employee_id:
            projects = await erp_client.get_user_projects(employee_id)
        elif company_id:
            # Otherwise get company projects
            projects = await erp_client.get_projects(
                company_id=company_id,
                status=status or "active",
                limit=limit
            )
        else:
            projects = []

        return {
            "projects": projects,
            "count": len(projects)
        }

    except Exception as e:
        logger.error(f"Failed to fetch projects: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch projects: {str(e)}")


@router.get("/projects/{project_id}")
async def get_project(
    project_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get project details including team and phases.
    """
    try:
        project = await erp_client.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Get team members
        team = await erp_client.get_project_team(project_id)

        # Get phases if available
        try:
            phases = await erp_client.get_project_phases(project_id)
        except Exception:
            phases = []

        # Get milestones
        try:
            milestones = await erp_client.get_project_milestones(project_id)
        except Exception:
            milestones = []

        return {
            "project": project,
            "team": team,
            "phases": phases,
            "milestones": milestones,
            "team_count": len(team)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch project: {str(e)}")


@router.get("/projects/{project_id}/team")
async def get_project_team(
    project_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get project team members.
    """
    try:
        team = await erp_client.get_project_team(project_id)
        return {
            "project_id": project_id,
            "team": team,
            "count": len(team)
        }

    except Exception as e:
        logger.error(f"Failed to fetch project team: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch team: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# TASKS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/projects/{project_id}/tasks")
async def get_project_tasks(
    project_id: str,
    status: Optional[str] = Query(None, description="Filter: TODO, IN_PROGRESS, UNDER_REVIEW, COMPLETED"),
    limit: int = Query(100, le=500),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get tasks for a specific project.
    """
    try:
        tasks = await erp_client.get_project_tasks(
            project_id=project_id,
            status=status,
            limit=limit
        )

        return {
            "project_id": project_id,
            "tasks": tasks,
            "count": len(tasks)
        }

    except Exception as e:
        logger.error(f"Failed to fetch project tasks: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch tasks: {str(e)}")


@router.get("/my-tasks")
async def get_my_tasks(
    status: Optional[str] = Query(None, description="Filter: TODO, IN_PROGRESS, UNDER_REVIEW, COMPLETED"),
    limit: int = Query(50, le=200),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get tasks assigned to the current user.
    """
    try:
        employee_id = current_user.get("erp_employee_id")
        if not employee_id:
            return {"tasks": [], "count": 0, "message": "No ERP employee ID linked"}

        tasks = await erp_client.get_my_tasks(
            employee_id=employee_id,
            status=status,
            limit=limit
        )

        return {
            "tasks": tasks,
            "count": len(tasks)
        }

    except Exception as e:
        logger.error(f"Failed to fetch user tasks: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch tasks: {str(e)}")


@router.get("/tasks/{task_id}")
async def get_task(
    task_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get task details with comments and time logs.
    """
    try:
        task = await erp_client.get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        # Get comments
        try:
            comments = await erp_client.get_task_comments(task_id)
        except Exception:
            comments = []

        # Get time logs
        try:
            time_logs = await erp_client.get_task_time_logs(task_id)
        except Exception:
            time_logs = []

        return {
            "task": task,
            "comments": comments,
            "time_logs": time_logs
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch task {task_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch task: {str(e)}")


@router.patch("/tasks/{task_id}/status")
async def update_task_status(
    task_id: str,
    update: TaskStatusUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update task status and completion percentage.
    """
    try:
        result = await erp_client.update_task_status(
            task_id=task_id,
            status=update.status,
            completion_percentage=update.completion_percentage
        )

        logger.info(f"Task {task_id} status updated to {update.status} by user {current_user.get('id')}")

        return {
            "success": True,
            "task": result
        }

    except Exception as e:
        logger.error(f"Failed to update task status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update task: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# TIME TRACKING
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/tasks/{task_id}/time-logs")
async def log_time(
    task_id: str,
    time_log: TimeLogCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Log time against a task.
    """
    try:
        employee_id = current_user.get("erp_employee_id")
        if not employee_id:
            raise HTTPException(status_code=400, detail="No ERP employee ID linked to your account")

        result = await erp_client.log_time(
            task_id=task_id,
            employee_id=employee_id,
            hours=time_log.hours,
            description=time_log.description,
            log_date=time_log.log_date
        )

        logger.info(f"Time logged: {time_log.hours}h on task {task_id} by {employee_id}")

        return {
            "success": True,
            "time_log": result
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to log time: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to log time: {str(e)}")


@router.get("/tasks/{task_id}/time-logs")
async def get_task_time_logs(
    task_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get time logs for a task.
    """
    try:
        time_logs = await erp_client.get_task_time_logs(task_id)

        return {
            "task_id": task_id,
            "time_logs": time_logs,
            "total_hours": sum(log.get("hours", 0) for log in time_logs)
        }

    except Exception as e:
        logger.error(f"Failed to fetch time logs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch time logs: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# COMMENTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/tasks/{task_id}/comments")
async def add_task_comment(
    task_id: str,
    comment: CommentCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Add a comment to a task.
    """
    try:
        user_id = str(current_user.get("id"))

        result = await erp_client.add_task_comment(
            task_id=task_id,
            user_id=user_id,
            content=comment.content
        )

        return {
            "success": True,
            "comment": result
        }

    except Exception as e:
        logger.error(f"Failed to add comment: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to add comment: {str(e)}")


@router.get("/tasks/{task_id}/comments")
async def get_task_comments(
    task_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get comments for a task.
    """
    try:
        comments = await erp_client.get_task_comments(task_id)

        return {
            "task_id": task_id,
            "comments": comments,
            "count": len(comments)
        }

    except Exception as e:
        logger.error(f"Failed to fetch comments: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch comments: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# MILESTONES
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/projects/{project_id}/milestones")
async def get_project_milestones(
    project_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get milestones for a project.
    """
    try:
        milestones = await erp_client.get_project_milestones(project_id)

        return {
            "project_id": project_id,
            "milestones": milestones,
            "count": len(milestones)
        }

    except Exception as e:
        logger.error(f"Failed to fetch milestones: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch milestones: {str(e)}")
