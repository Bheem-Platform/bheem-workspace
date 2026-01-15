"""
Bheem Workspace - Workflow API
Workflow automation (Bheem Flows) endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel
from datetime import datetime

from core.database import get_db
from services.workflow_service import WorkflowService

router = APIRouter(prefix="/workflows", tags=["Workflows"])


# =============================================
# Request/Response Models
# =============================================

class CreateWorkflowRequest(BaseModel):
    name: str
    description: Optional[str] = None
    trigger_type: str
    trigger_config: Optional[Dict[str, Any]] = None
    actions: Optional[List[Dict[str, Any]]] = None
    conditions: Optional[Dict[str, Any]] = None


class UpdateWorkflowRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    trigger_type: Optional[str] = None
    trigger_config: Optional[Dict[str, Any]] = None
    actions: Optional[List[Dict[str, Any]]] = None
    conditions: Optional[Dict[str, Any]] = None
    is_enabled: Optional[bool] = None


class TriggerWorkflowRequest(BaseModel):
    trigger_data: Dict[str, Any]


class CreateFromTemplateRequest(BaseModel):
    template_id: UUID
    name: Optional[str] = None


class SaveAsTemplateRequest(BaseModel):
    name: str
    category: Optional[str] = None
    is_public: bool = False


class WorkflowResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    trigger_type: str
    trigger_config: Dict[str, Any]
    actions: List[Dict[str, Any]]
    conditions: Dict[str, Any]
    is_enabled: bool
    run_count: int
    last_run_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WorkflowRunResponse(BaseModel):
    id: UUID
    workflow_id: UUID
    status: str
    trigger_data: Optional[Dict[str, Any]]
    execution_log: List[Dict[str, Any]]
    started_at: datetime
    completed_at: Optional[datetime]
    duration_ms: Optional[int]
    error: Optional[str]

    class Config:
        from_attributes = True


class WorkflowTemplateResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    category: Optional[str]
    icon: Optional[str]
    trigger_type: str
    is_public: bool
    use_count: int

    class Config:
        from_attributes = True


# =============================================
# Workflow CRUD
# =============================================

@router.post("", response_model=WorkflowResponse)
async def create_workflow(
    request: CreateWorkflowRequest,
    tenant_id: UUID = Query(...),
    user_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Create a new workflow"""
    service = WorkflowService(db)
    try:
        workflow = await service.create_workflow(
            tenant_id=tenant_id,
            created_by=user_id,
            name=request.name,
            description=request.description,
            trigger_type=request.trigger_type,
            trigger_config=request.trigger_config,
            actions=request.actions,
            conditions=request.conditions
        )
        return workflow
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=List[WorkflowResponse])
async def list_workflows(
    tenant_id: UUID = Query(...),
    trigger_type: Optional[str] = None,
    is_enabled: Optional[bool] = None,
    created_by: Optional[UUID] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """List all workflows"""
    service = WorkflowService(db)
    workflows = await service.list_workflows(
        tenant_id=tenant_id,
        trigger_type=trigger_type,
        is_enabled=is_enabled,
        created_by=created_by,
        skip=skip,
        limit=limit
    )
    return workflows


@router.get("/triggers")
async def get_available_triggers():
    """Get all available workflow trigger types"""
    return {"triggers": WorkflowService.get_available_triggers()}


@router.get("/actions")
async def get_available_actions():
    """Get all available workflow action types"""
    return {"actions": WorkflowService.get_available_actions()}


@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(
    workflow_id: UUID,
    tenant_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Get a workflow by ID"""
    service = WorkflowService(db)
    workflow = await service.get_workflow(workflow_id, tenant_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow


@router.patch("/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(
    workflow_id: UUID,
    request: UpdateWorkflowRequest,
    tenant_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Update a workflow"""
    service = WorkflowService(db)
    try:
        workflow = await service.update_workflow(
            workflow_id=workflow_id,
            tenant_id=tenant_id,
            **request.model_dump(exclude_unset=True)
        )
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        return workflow
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{workflow_id}")
async def delete_workflow(
    workflow_id: UUID,
    tenant_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Delete a workflow"""
    service = WorkflowService(db)
    success = await service.delete_workflow(workflow_id, tenant_id)
    if not success:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return {"status": "deleted"}


# =============================================
# Enable/Disable
# =============================================

@router.post("/{workflow_id}/enable", response_model=WorkflowResponse)
async def enable_workflow(
    workflow_id: UUID,
    tenant_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Enable a workflow"""
    service = WorkflowService(db)
    workflow = await service.enable_workflow(workflow_id, tenant_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow


@router.post("/{workflow_id}/disable", response_model=WorkflowResponse)
async def disable_workflow(
    workflow_id: UUID,
    tenant_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Disable a workflow"""
    service = WorkflowService(db)
    workflow = await service.disable_workflow(workflow_id, tenant_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow


# =============================================
# Execution
# =============================================

@router.post("/{workflow_id}/trigger", response_model=WorkflowRunResponse)
async def trigger_workflow(
    workflow_id: UUID,
    request: TriggerWorkflowRequest,
    tenant_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Manually trigger a workflow"""
    service = WorkflowService(db)
    run = await service.trigger_workflow(
        workflow_id=workflow_id,
        tenant_id=tenant_id,
        trigger_data=request.trigger_data
    )
    if not run:
        raise HTTPException(
            status_code=400,
            detail="Workflow not found or not enabled"
        )
    return run


@router.get("/{workflow_id}/runs", response_model=List[WorkflowRunResponse])
async def list_workflow_runs(
    workflow_id: UUID,
    tenant_id: UUID = Query(...),
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Get workflow execution history"""
    service = WorkflowService(db)
    runs = await service.get_workflow_runs(
        workflow_id=workflow_id,
        tenant_id=tenant_id,
        status=status,
        skip=skip,
        limit=limit
    )
    return runs


@router.get("/runs/{run_id}", response_model=WorkflowRunResponse)
async def get_workflow_run(
    run_id: UUID,
    tenant_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific workflow run"""
    service = WorkflowService(db)
    run = await service.get_workflow_run(run_id, tenant_id)
    if not run:
        raise HTTPException(status_code=404, detail="Workflow run not found")
    return run


# =============================================
# Templates
# =============================================

@router.get("/templates", response_model=List[WorkflowTemplateResponse])
async def list_templates(
    tenant_id: UUID = Query(...),
    category: Optional[str] = None,
    include_public: bool = True,
    db: AsyncSession = Depends(get_db)
):
    """List available workflow templates"""
    service = WorkflowService(db)
    templates = await service.list_templates(
        tenant_id=tenant_id,
        category=category,
        include_public=include_public
    )
    return templates


@router.post("/from-template", response_model=WorkflowResponse)
async def create_from_template(
    request: CreateFromTemplateRequest,
    tenant_id: UUID = Query(...),
    user_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Create a workflow from a template"""
    service = WorkflowService(db)
    workflow = await service.create_from_template(
        template_id=request.template_id,
        tenant_id=tenant_id,
        created_by=user_id,
        name=request.name
    )
    if not workflow:
        raise HTTPException(status_code=404, detail="Template not found")
    return workflow


@router.post("/{workflow_id}/save-as-template", response_model=WorkflowTemplateResponse)
async def save_as_template(
    workflow_id: UUID,
    request: SaveAsTemplateRequest,
    tenant_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Save a workflow as a reusable template"""
    service = WorkflowService(db)
    template = await service.save_as_template(
        workflow_id=workflow_id,
        tenant_id=tenant_id,
        name=request.name,
        category=request.category,
        is_public=request.is_public
    )
    if not template:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return template


# =============================================
# Event Processing (Internal)
# =============================================

@router.post("/events/{trigger_type}")
async def process_trigger_event(
    trigger_type: str,
    trigger_data: Dict[str, Any],
    tenant_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Process a trigger event and execute matching workflows"""
    service = WorkflowService(db)
    runs = await service.process_trigger_event(
        tenant_id=tenant_id,
        trigger_type=trigger_type,
        trigger_data=trigger_data
    )
    return {
        "processed": len(runs),
        "runs": [{"id": str(r.id), "status": r.status} for r in runs]
    }
