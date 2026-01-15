"""
Bheem Workspace - AI Assistant API
API endpoints for AI-powered features
"""
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from datetime import datetime

from core.database import get_db
from core.security import get_current_user, require_admin
from services.ai_service import AIService

router = APIRouter(prefix="/ai", tags=["AI"])


# =============================================
# Pydantic Schemas
# =============================================

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=10000)
    conversation_id: Optional[UUID] = None
    context_type: Optional[str] = None
    context_id: Optional[UUID] = None
    context_content: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    conversation_id: UUID
    tokens_used: int


class SummarizeRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=100000)
    max_length: int = Field(default=200, ge=50, le=1000)
    style: str = Field(default="concise", pattern="^(concise|detailed|bullet_points)$")
    context_type: Optional[str] = None
    context_id: Optional[UUID] = None


class SummarizeResponse(BaseModel):
    summary: str
    original_length: int
    summary_length: int


class TranslateRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=50000)
    target_language: str = Field(..., min_length=2, max_length=50)
    source_language: Optional[str] = None
    context_type: Optional[str] = None
    context_id: Optional[UUID] = None


class TranslateResponse(BaseModel):
    translated_content: str
    source_language: Optional[str]
    target_language: str


class ComposeRequest(BaseModel):
    content_type: str = Field(..., pattern="^(email|document|message|response)$")
    instructions: str = Field(..., min_length=1, max_length=5000)
    tone: str = Field(default="professional", pattern="^(professional|casual|formal|friendly)$")
    length: str = Field(default="medium", pattern="^(short|medium|long)$")
    context: Optional[str] = None
    context_type: Optional[str] = None
    context_id: Optional[UUID] = None


class ComposeResponse(BaseModel):
    content: str
    word_count: int


class AnalyzeRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=100000)
    analysis_type: str = Field(..., pattern="^(sentiment|grammar|keywords|structure|readability)$")
    context_type: Optional[str] = None
    context_id: Optional[UUID] = None


class AnalyzeResponse(BaseModel):
    analysis_type: str
    result: dict


class ExtractRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=100000)
    extract_type: str = Field(..., pattern="^(dates|names|emails|phones|addresses|tasks|key_points)$")
    context_type: Optional[str] = None
    context_id: Optional[UUID] = None


class ExtractResponse(BaseModel):
    extract_type: str
    items: List[str]


class ConversationResponse(BaseModel):
    id: UUID
    title: Optional[str]
    context_type: Optional[str]
    context_id: Optional[UUID]
    message_count: int
    total_tokens: int
    is_archived: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ConversationDetailResponse(ConversationResponse):
    messages: List[dict]


class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    is_archived: Optional[bool] = None


# =============================================
# Chat Endpoints
# =============================================

@router.post("/chat", response_model=ChatResponse)
async def chat(
    data: ChatRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Send a message to AI and get a response"""
    service = AIService(db)

    result = await service.chat(
        tenant_id=current_user["tenant_id"],
        user_id=current_user["user_id"],
        message=data.message,
        conversation_id=data.conversation_id,
        context_type=data.context_type,
        context_id=data.context_id,
        context_content=data.context_content
    )

    return result


@router.post("/summarize", response_model=SummarizeResponse)
async def summarize(
    data: SummarizeRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Summarize content"""
    service = AIService(db)

    result = await service.summarize(
        tenant_id=current_user["tenant_id"],
        user_id=current_user["user_id"],
        content=data.content,
        max_length=data.max_length,
        style=data.style,
        context_type=data.context_type,
        context_id=data.context_id
    )

    return result


@router.post("/translate", response_model=TranslateResponse)
async def translate(
    data: TranslateRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Translate content to another language"""
    service = AIService(db)

    result = await service.translate(
        tenant_id=current_user["tenant_id"],
        user_id=current_user["user_id"],
        content=data.content,
        target_language=data.target_language,
        source_language=data.source_language,
        context_type=data.context_type,
        context_id=data.context_id
    )

    return result


@router.post("/compose", response_model=ComposeResponse)
async def compose(
    data: ComposeRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Compose content using AI"""
    service = AIService(db)

    result = await service.compose(
        tenant_id=current_user["tenant_id"],
        user_id=current_user["user_id"],
        content_type=data.content_type,
        instructions=data.instructions,
        tone=data.tone,
        length=data.length,
        context=data.context,
        context_type=data.context_type,
        context_id=data.context_id
    )

    return result


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(
    data: AnalyzeRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Analyze content"""
    service = AIService(db)

    result = await service.analyze(
        tenant_id=current_user["tenant_id"],
        user_id=current_user["user_id"],
        content=data.content,
        analysis_type=data.analysis_type,
        context_type=data.context_type,
        context_id=data.context_id
    )

    return result


@router.post("/extract", response_model=ExtractResponse)
async def extract(
    data: ExtractRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Extract information from content"""
    service = AIService(db)

    result = await service.extract(
        tenant_id=current_user["tenant_id"],
        user_id=current_user["user_id"],
        content=data.content,
        extract_type=data.extract_type,
        context_type=data.context_type,
        context_id=data.context_id
    )

    return result


# =============================================
# Conversation Management
# =============================================

@router.get("/conversations", response_model=List[ConversationResponse])
async def list_conversations(
    context_type: Optional[str] = None,
    is_archived: bool = False,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """List user's AI conversations"""
    service = AIService(db)

    conversations = await service.list_conversations(
        tenant_id=current_user["tenant_id"],
        user_id=current_user["user_id"],
        context_type=context_type,
        is_archived=is_archived,
        skip=skip,
        limit=limit
    )

    return conversations


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailResponse)
async def get_conversation(
    conversation_id: UUID,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get a conversation with messages"""
    service = AIService(db)

    conversation = await service.get_conversation(
        conversation_id=conversation_id,
        tenant_id=current_user["tenant_id"],
        user_id=current_user["user_id"]
    )

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    return conversation


@router.patch("/conversations/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    conversation_id: UUID,
    data: ConversationUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Update conversation (title, archive status)"""
    service = AIService(db)

    conversation = await service.update_conversation(
        conversation_id=conversation_id,
        tenant_id=current_user["tenant_id"],
        user_id=current_user["user_id"],
        title=data.title,
        is_archived=data.is_archived
    )

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    return conversation


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: UUID,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Delete a conversation"""
    service = AIService(db)

    deleted = await service.delete_conversation(
        conversation_id=conversation_id,
        tenant_id=current_user["tenant_id"],
        user_id=current_user["user_id"]
    )

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )


@router.post("/conversations/{conversation_id}/archive", response_model=ConversationResponse)
async def archive_conversation(
    conversation_id: UUID,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Archive a conversation"""
    service = AIService(db)

    conversation = await service.update_conversation(
        conversation_id=conversation_id,
        tenant_id=current_user["tenant_id"],
        user_id=current_user["user_id"],
        is_archived=True
    )

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    return conversation


# =============================================
# Usage Statistics (Admin)
# =============================================

@router.get("/usage/stats")
async def get_ai_usage_stats(
    current_user: dict = Depends(require_admin),
    db = Depends(get_db)
):
    """Get AI usage statistics (admin only)"""
    service = AIService(db)

    stats = await service.get_usage_stats(current_user["tenant_id"])
    return stats


@router.get("/usage/by-user")
async def get_ai_usage_by_user(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(require_admin),
    db = Depends(get_db)
):
    """Get AI usage by user (admin only)"""
    service = AIService(db)

    usage = await service.get_usage_by_user(
        tenant_id=current_user["tenant_id"],
        skip=skip,
        limit=limit
    )

    return usage


@router.get("/usage/by-feature")
async def get_ai_usage_by_feature(
    current_user: dict = Depends(require_admin),
    db = Depends(get_db)
):
    """Get AI usage by feature (admin only)"""
    service = AIService(db)

    usage = await service.get_usage_by_feature(current_user["tenant_id"])
    return usage
