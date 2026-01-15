"""
Bheem Workspace - DLP (Data Loss Prevention) API
API endpoints for DLP rules and incident management
"""
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from datetime import datetime

from core.database import get_db
from core.security import get_current_user, require_admin
from services.dlp_service import DLPService

router = APIRouter(prefix="/dlp", tags=["DLP"])


# =============================================
# Pydantic Schemas
# =============================================

class DLPRuleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    pattern_type: str = Field(..., pattern="^(regex|keyword|predefined)$")
    pattern: str = Field(..., min_length=1)
    predefined_type: Optional[str] = None
    action: str = Field(..., pattern="^(warn|block|notify|log)$")
    scope: Optional[dict] = None
    notify_admins: bool = True
    notify_user: bool = True
    custom_message: Optional[str] = None
    severity: str = Field(default="medium", pattern="^(low|medium|high|critical)$")


class DLPRuleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    pattern: Optional[str] = None
    action: Optional[str] = Field(None, pattern="^(warn|block|notify|log)$")
    scope: Optional[dict] = None
    notify_admins: Optional[bool] = None
    notify_user: Optional[bool] = None
    custom_message: Optional[str] = None
    severity: Optional[str] = Field(None, pattern="^(low|medium|high|critical)$")
    is_enabled: Optional[bool] = None


class DLPRuleResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    pattern_type: str
    pattern: str
    predefined_type: Optional[str]
    action: str
    scope: dict
    notify_admins: bool
    notify_user: bool
    custom_message: Optional[str]
    severity: str
    is_enabled: bool
    trigger_count: int
    last_triggered_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ContentScanRequest(BaseModel):
    content: str = Field(..., min_length=1)
    content_type: str = Field(..., min_length=1)
    content_id: Optional[UUID] = None
    content_title: Optional[str] = None


class ContentScanResponse(BaseModel):
    has_violations: bool
    should_block: bool
    max_severity: Optional[str]
    violations: List[dict]


class IncidentStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(open|reviewed|resolved|false_positive)$")
    resolution_notes: Optional[str] = None


class DLPIncidentResponse(BaseModel):
    id: UUID
    rule_id: Optional[UUID]
    user_id: UUID
    content_type: str
    content_id: Optional[UUID]
    content_title: Optional[str]
    matched_pattern: Optional[str]
    matched_content: Optional[str]
    match_count: int
    action_taken: str
    was_blocked: bool
    status: str
    reviewed_by: Optional[UUID]
    reviewed_at: Optional[datetime]
    resolution_notes: Optional[str]
    ip_address: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class PatternTestRequest(BaseModel):
    pattern: str = Field(..., min_length=1)
    test_content: str = Field(..., min_length=1)


class PatternTestResponse(BaseModel):
    valid: bool
    error: Optional[str] = None
    matches: List[str]
    match_count: int


# =============================================
# DLP Rules Endpoints
# =============================================

@router.post("/rules", response_model=DLPRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_dlp_rule(
    data: DLPRuleCreate,
    current_user: dict = Depends(require_admin),
    db = Depends(get_db)
):
    """Create a new DLP rule (admin only)"""
    service = DLPService(db)

    rule = await service.create_rule(
        tenant_id=current_user["tenant_id"],
        created_by=current_user["user_id"],
        name=data.name,
        pattern_type=data.pattern_type,
        pattern=data.pattern,
        action=data.action,
        description=data.description,
        predefined_type=data.predefined_type,
        scope=data.scope,
        notify_admins=data.notify_admins,
        notify_user=data.notify_user,
        custom_message=data.custom_message,
        severity=data.severity
    )

    return rule


@router.get("/rules", response_model=List[DLPRuleResponse])
async def list_dlp_rules(
    is_enabled: Optional[bool] = None,
    severity: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(require_admin),
    db = Depends(get_db)
):
    """List DLP rules (admin only)"""
    service = DLPService(db)

    rules = await service.list_rules(
        tenant_id=current_user["tenant_id"],
        is_enabled=is_enabled,
        severity=severity,
        skip=skip,
        limit=limit
    )

    return rules


@router.get("/rules/{rule_id}", response_model=DLPRuleResponse)
async def get_dlp_rule(
    rule_id: UUID,
    current_user: dict = Depends(require_admin),
    db = Depends(get_db)
):
    """Get a DLP rule by ID (admin only)"""
    service = DLPService(db)

    rule = await service.get_rule(rule_id, current_user["tenant_id"])
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="DLP rule not found"
        )

    return rule


@router.patch("/rules/{rule_id}", response_model=DLPRuleResponse)
async def update_dlp_rule(
    rule_id: UUID,
    data: DLPRuleUpdate,
    current_user: dict = Depends(require_admin),
    db = Depends(get_db)
):
    """Update a DLP rule (admin only)"""
    service = DLPService(db)

    rule = await service.update_rule(
        rule_id=rule_id,
        tenant_id=current_user["tenant_id"],
        **data.model_dump(exclude_unset=True)
    )

    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="DLP rule not found"
        )

    return rule


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dlp_rule(
    rule_id: UUID,
    current_user: dict = Depends(require_admin),
    db = Depends(get_db)
):
    """Delete a DLP rule (admin only)"""
    service = DLPService(db)

    deleted = await service.delete_rule(rule_id, current_user["tenant_id"])
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="DLP rule not found"
        )


@router.post("/rules/{rule_id}/enable", response_model=DLPRuleResponse)
async def enable_dlp_rule(
    rule_id: UUID,
    current_user: dict = Depends(require_admin),
    db = Depends(get_db)
):
    """Enable a DLP rule (admin only)"""
    service = DLPService(db)

    rule = await service.enable_rule(rule_id, current_user["tenant_id"])
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="DLP rule not found"
        )

    return rule


@router.post("/rules/{rule_id}/disable", response_model=DLPRuleResponse)
async def disable_dlp_rule(
    rule_id: UUID,
    current_user: dict = Depends(require_admin),
    db = Depends(get_db)
):
    """Disable a DLP rule (admin only)"""
    service = DLPService(db)

    rule = await service.disable_rule(rule_id, current_user["tenant_id"])
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="DLP rule not found"
        )

    return rule


# =============================================
# Content Scanning Endpoints
# =============================================

@router.post("/scan", response_model=ContentScanResponse)
async def scan_content(
    data: ContentScanRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Scan content for DLP violations"""
    service = DLPService(db)

    result = await service.scan_content(
        tenant_id=current_user["tenant_id"],
        user_id=current_user["user_id"],
        content=data.content,
        content_type=data.content_type,
        content_id=data.content_id,
        content_title=data.content_title,
        ip_address=None,  # TODO: Get from request
        user_agent=None   # TODO: Get from request
    )

    return result


@router.post("/test-pattern", response_model=PatternTestResponse)
async def test_pattern(
    data: PatternTestRequest,
    current_user: dict = Depends(require_admin),
    db = Depends(get_db)
):
    """Test a regex pattern against sample content (admin only)"""
    service = DLPService(db)

    result = await service.test_pattern(
        pattern=data.pattern,
        test_content=data.test_content
    )

    return result


@router.get("/predefined-patterns")
async def get_predefined_patterns(
    current_user: dict = Depends(require_admin)
):
    """Get available predefined DLP patterns (admin only)"""
    return DLPService.get_predefined_patterns()


# =============================================
# Incidents Endpoints
# =============================================

@router.get("/incidents", response_model=List[DLPIncidentResponse])
async def list_incidents(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    user_id: Optional[UUID] = None,
    content_type: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(require_admin),
    db = Depends(get_db)
):
    """List DLP incidents (admin only)"""
    service = DLPService(db)

    incidents = await service.list_incidents(
        tenant_id=current_user["tenant_id"],
        status=status,
        severity=severity,
        user_id=user_id,
        content_type=content_type,
        skip=skip,
        limit=limit
    )

    return incidents


@router.get("/incidents/{incident_id}", response_model=DLPIncidentResponse)
async def get_incident(
    incident_id: UUID,
    current_user: dict = Depends(require_admin),
    db = Depends(get_db)
):
    """Get a DLP incident by ID (admin only)"""
    service = DLPService(db)

    incident = await service.get_incident(incident_id, current_user["tenant_id"])
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="DLP incident not found"
        )

    return incident


@router.patch("/incidents/{incident_id}/status", response_model=DLPIncidentResponse)
async def update_incident_status(
    incident_id: UUID,
    data: IncidentStatusUpdate,
    current_user: dict = Depends(require_admin),
    db = Depends(get_db)
):
    """Update incident status (admin only)"""
    service = DLPService(db)

    incident = await service.update_incident_status(
        incident_id=incident_id,
        tenant_id=current_user["tenant_id"],
        status=data.status,
        reviewed_by=current_user["user_id"],
        resolution_notes=data.resolution_notes
    )

    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="DLP incident not found"
        )

    return incident


@router.get("/incidents/stats")
async def get_incident_stats(
    current_user: dict = Depends(require_admin),
    db = Depends(get_db)
):
    """Get DLP incident statistics (admin only)"""
    service = DLPService(db)

    stats = await service.get_incident_stats(current_user["tenant_id"])
    return stats
