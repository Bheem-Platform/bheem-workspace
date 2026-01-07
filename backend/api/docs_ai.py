"""
Bheem Docs - AI & Smart Features API
====================================
REST API endpoints for AI-powered document features.
"""

from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from core.security import get_current_user
from services.docs_ai_service import get_docs_ai_service, DocsAIService

router = APIRouter(prefix="/docs/ai", tags=["Bheem Docs AI"])


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class SummarizeRequest(BaseModel):
    """Request to summarize document content"""
    content: str = Field(..., min_length=1)
    max_length: int = Field(default=500, ge=50, le=2000)
    style: str = Field(default="concise", pattern="^(concise|detailed|bullet_points)$")


class KeywordsRequest(BaseModel):
    """Request to extract keywords"""
    content: str = Field(..., min_length=1)
    max_keywords: int = Field(default=10, ge=1, le=50)


class TagSuggestionRequest(BaseModel):
    """Request for tag suggestions"""
    content: str = Field(..., min_length=1)
    existing_tags: Optional[List[str]] = None
    max_suggestions: int = Field(default=5, ge=1, le=20)


class AnalyzeRequest(BaseModel):
    """Request to analyze document"""
    content: str = Field(..., min_length=1)
    title: Optional[str] = None


class SearchDocument(BaseModel):
    """Document for search"""
    id: str
    title: str
    content: str


class SemanticSearchRequest(BaseModel):
    """Request for semantic search"""
    query: str = Field(..., min_length=1)
    documents: List[SearchDocument]
    top_k: int = Field(default=10, ge=1, le=50)


class SimilarDocumentsRequest(BaseModel):
    """Request to find similar documents"""
    document_id: str
    document_content: str
    candidates: List[SearchDocument]
    top_k: int = Field(default=5, ge=1, le=20)


class ImproveWritingRequest(BaseModel):
    """Request to improve writing"""
    text: str = Field(..., min_length=1, max_length=10000)
    style: str = Field(default="professional", pattern="^(professional|casual|academic|concise)$")


class GenerateContentRequest(BaseModel):
    """Request to generate content"""
    prompt: str = Field(..., min_length=1, max_length=1000)
    document_context: Optional[str] = Field(None, max_length=5000)
    max_length: int = Field(default=500, ge=50, le=2000)


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_ai_service() -> DocsAIService:
    return get_docs_ai_service()


# =============================================================================
# SUMMARIZATION ENDPOINTS
# =============================================================================

@router.post("/summarize")
async def summarize_document(
    request: SummarizeRequest,
    service: DocsAIService = Depends(get_ai_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Generate a summary of document content.

    Supports three styles:
    - concise: Brief overview
    - detailed: Comprehensive summary
    - bullet_points: Key points as list
    """
    result = await service.summarize_document(
        content=request.content,
        max_length=request.max_length,
        style=request.style
    )

    return result


@router.post("/documents/{document_id}/summarize")
async def summarize_document_by_id(
    document_id: str,
    max_length: int = Query(500, ge=50, le=2000),
    style: str = Query("concise", pattern="^(concise|detailed|bullet_points)$"),
    service: DocsAIService = Depends(get_ai_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Generate summary for a specific document.

    Fetches document content and generates summary.
    """
    # This would normally fetch from docs service
    # For now, return placeholder
    return {
        "document_id": document_id,
        "summary": "Document content would be fetched and summarized",
        "note": "Integrate with docs_document_service for full functionality"
    }


# =============================================================================
# KEYWORD & TAG ENDPOINTS
# =============================================================================

@router.post("/keywords")
async def extract_keywords(
    request: KeywordsRequest,
    service: DocsAIService = Depends(get_ai_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Extract keywords and key phrases from content.

    Returns keywords with relevance scores.
    """
    result = await service.extract_keywords(
        content=request.content,
        max_keywords=request.max_keywords
    )

    return result


@router.post("/suggest-tags")
async def suggest_tags(
    request: TagSuggestionRequest,
    service: DocsAIService = Depends(get_ai_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Suggest tags for document categorization.

    Analyzes content and suggests relevant tags.
    """
    result = await service.suggest_tags(
        content=request.content,
        existing_tags=request.existing_tags,
        max_suggestions=request.max_suggestions
    )

    return result


# =============================================================================
# ANALYSIS ENDPOINTS
# =============================================================================

@router.post("/analyze")
async def analyze_document(
    request: AnalyzeRequest,
    service: DocsAIService = Depends(get_ai_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Comprehensive document analysis.

    Returns:
    - Statistics (word count, sentences, etc.)
    - Readability metrics
    - Keywords
    - Summary
    - Language detection
    """
    result = await service.analyze_document(
        content=request.content,
        title=request.title
    )

    return result


@router.post("/documents/{document_id}/analyze")
async def analyze_document_by_id(
    document_id: str,
    service: DocsAIService = Depends(get_ai_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Analyze a specific document.

    Fetches document and performs comprehensive analysis.
    """
    return {
        "document_id": document_id,
        "analysis": "Document would be fetched and analyzed",
        "note": "Integrate with docs_document_service for full functionality"
    }


# =============================================================================
# SEARCH ENDPOINTS
# =============================================================================

@router.post("/search")
async def semantic_search(
    request: SemanticSearchRequest,
    service: DocsAIService = Depends(get_ai_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Semantic search across documents.

    Uses AI embeddings for better relevance when available,
    falls back to keyword matching otherwise.
    """
    documents = [
        {"id": d.id, "title": d.title, "content": d.content}
        for d in request.documents
    ]

    results = await service.semantic_search(
        query=request.query,
        documents=documents,
        top_k=request.top_k
    )

    return {
        "query": request.query,
        "results": results,
        "count": len(results)
    }


@router.post("/similar")
async def find_similar_documents(
    request: SimilarDocumentsRequest,
    service: DocsAIService = Depends(get_ai_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Find documents similar to a given document.

    Uses content analysis to find related documents.
    """
    candidates = [
        {"id": d.id, "title": d.title, "content": d.content}
        for d in request.candidates
    ]

    results = await service.find_similar_documents(
        document_id=UUID(request.document_id),
        document_content=request.document_content,
        candidates=candidates,
        top_k=request.top_k
    )

    return {
        "source_document": request.document_id,
        "similar": results,
        "count": len(results)
    }


# =============================================================================
# WRITING ASSISTANCE ENDPOINTS
# =============================================================================

@router.post("/improve")
async def improve_writing(
    request: ImproveWritingRequest,
    service: DocsAIService = Depends(get_ai_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Suggest improvements for text.

    Styles:
    - professional: Clear and business-appropriate
    - casual: Friendly and conversational
    - academic: Formal and scholarly
    - concise: Shorter without losing meaning
    """
    result = await service.improve_writing(
        text=request.text,
        style=request.style
    )

    return result


@router.post("/generate")
async def generate_content(
    request: GenerateContentRequest,
    service: DocsAIService = Depends(get_ai_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Generate content based on a prompt.

    Can use existing document as context for better results.
    """
    result = await service.generate_content(
        prompt=request.prompt,
        document_context=request.document_context,
        max_length=request.max_length
    )

    return result


# =============================================================================
# STATUS ENDPOINT
# =============================================================================

@router.get("/status")
async def get_ai_status(
    service: DocsAIService = Depends(get_ai_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Get AI service status.

    Returns availability of AI features.
    """
    return {
        "ai_enabled": service.ai_enabled,
        "features": {
            "summarization": True,
            "keywords": True,
            "analysis": True,
            "semantic_search": service.ai_enabled,
            "writing_assistance": service.ai_enabled,
            "content_generation": service.ai_enabled
        },
        "note": "Some features use AI APIs, others fall back to statistical methods"
    }
