"""
Bheem Mail AI API
AI-powered email endpoints
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional

from core.security import get_current_user
from ai_services.mail_ai_service import (
    mail_ai_service,
    ComposeRequest,
    RewriteRequest,
    SummarizeRequest,
    SmartReplyRequest
)

router = APIRouter(prefix="/mail/ai", tags=["Mail AI"])


# Request/Response Models
class ComposeEmailRequest(BaseModel):
    prompt: str
    tone: str = "professional"
    context: Optional[str] = None


class ComposeEmailResponse(BaseModel):
    subject: str
    body: str


class RewriteEmailRequest(BaseModel):
    content: str
    tone: str = "professional"


class RewriteEmailResponse(BaseModel):
    body: str


class SummarizeEmailRequest(BaseModel):
    content: str
    max_length: int = 200


class SummarizeEmailResponse(BaseModel):
    summary: str
    key_points: List[str]
    action_items: List[str]
    sentiment: str


class SmartReplyRequestModel(BaseModel):
    email_content: str
    sender_name: str
    count: int = 3


class SmartReplyResponse(BaseModel):
    replies: List[str]


class CategorizeRequest(BaseModel):
    content: str
    sender: str


class CategorizeResponse(BaseModel):
    priority: str
    category: str
    is_spam: bool
    requires_response: bool
    suggested_labels: List[str]


class ActionItemsRequest(BaseModel):
    content: str


class GrammarCheckRequest(BaseModel):
    content: str


class SubjectLinesRequest(BaseModel):
    body: str
    count: int = 3


# Endpoints

@router.post("/compose", response_model=ComposeEmailResponse)
async def compose_email(request: ComposeEmailRequest, current_user: dict = Depends(get_current_user)):
    """
    Generate an email from a natural language prompt.

    Example prompts:
    - "Write an email to client about project delay"
    - "Thank John for the meeting yesterday"
    - "Follow up on the proposal we sent last week"
    """
    try:
        result = await mail_ai_service.compose_email(ComposeRequest(
            prompt=request.prompt,
            tone=request.tone,
            context=request.context
        ))
        return ComposeEmailResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rewrite", response_model=RewriteEmailResponse)
async def rewrite_email(request: RewriteEmailRequest, current_user: dict = Depends(get_current_user)):
    """
    Rewrite an email with a different tone.

    Available tones:
    - professional
    - friendly
    - formal
    - casual
    - urgent
    - shorter
    - longer
    """
    try:
        result = await mail_ai_service.rewrite_email(RewriteRequest(
            content=request.content,
            tone=request.tone
        ))
        return RewriteEmailResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/summarize", response_model=SummarizeEmailResponse)
async def summarize_email(request: SummarizeEmailRequest, current_user: dict = Depends(get_current_user)):
    """
    Summarize an email and extract key information.

    Returns:
    - Brief summary
    - Key points
    - Action items
    - Sentiment analysis
    """
    try:
        result = await mail_ai_service.summarize_email(SummarizeRequest(
            content=request.content,
            max_length=request.max_length
        ))
        return SummarizeEmailResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/replies", response_model=SmartReplyResponse)
async def generate_smart_replies(request: SmartReplyRequestModel, current_user: dict = Depends(get_current_user)):
    """
    Generate smart reply suggestions for an email.

    Returns 3 contextually appropriate reply options.
    """
    try:
        result = await mail_ai_service.generate_smart_replies(SmartReplyRequest(
            email_content=request.email_content,
            sender_name=request.sender_name,
            count=request.count
        ))
        return SmartReplyResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/categorize", response_model=CategorizeResponse)
async def categorize_email(request: CategorizeRequest, current_user: dict = Depends(get_current_user)):
    """
    Categorize an email by importance and type.

    Returns:
    - Priority level (high, normal, low)
    - Category (work, personal, newsletter, etc.)
    - Spam detection
    - Response requirement
    - Suggested labels
    """
    try:
        result = await mail_ai_service.categorize_email(request.content, request.sender)
        return CategorizeResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/actions")
async def extract_action_items(request: ActionItemsRequest, current_user: dict = Depends(get_current_user)):
    """
    Extract action items, deadlines, and questions from an email.
    """
    try:
        result = await mail_ai_service.extract_action_items(request.content)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/grammar-check")
async def check_grammar(request: GrammarCheckRequest, current_user: dict = Depends(get_current_user)):
    """
    Check grammar, tone, and professionalism of email draft.

    Returns:
    - Quality score (0-100)
    - Detected tone
    - Issues found
    - Improvement suggestions
    """
    try:
        result = await mail_ai_service.check_grammar_tone(request.content)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/subjects")
async def generate_subjects(request: SubjectLinesRequest, current_user: dict = Depends(get_current_user)):
    """
    Generate subject line suggestions for an email body.
    """
    try:
        result = await mail_ai_service.generate_subject_lines(request.body, request.count)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def ai_status():
    """Check AI service status and available features"""
    from core.config import settings
    has_api_key = bool(getattr(settings, 'ANTHROPIC_API_KEY', None))

    return {
        "status": "active" if has_api_key else "limited",
        "model": mail_ai_service.model if has_api_key else "fallback",
        "features": {
            "compose": True,
            "rewrite": True,
            "summarize": has_api_key,
            "smart_replies": has_api_key,
            "categorize": has_api_key,
            "actions": has_api_key,
            "grammar_check": has_api_key,
            "subjects": True
        },
        "note": "Configure ANTHROPIC_API_KEY for full AI features" if not has_api_key else None
    }
