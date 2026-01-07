"""
Bheem Docs - Comments & Annotations API
========================================
REST API endpoints for document comments, replies, and annotations.
"""

from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from core.security import get_current_user
from services.docs_comments_service import (
    get_docs_comments_service,
    DocsCommentsService
)

router = APIRouter(prefix="/docs/comments", tags=["Bheem Docs Comments"])


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class CreateCommentRequest(BaseModel):
    """Request to create a comment"""
    content: str = Field(..., min_length=1, max_length=10000)
    position: Optional[dict] = None  # {from, to} for inline comments
    selection_text: Optional[str] = None
    parent_id: Optional[str] = None  # For replies


class UpdateCommentRequest(BaseModel):
    """Request to update a comment"""
    content: str = Field(..., min_length=1, max_length=10000)


class ReactionRequest(BaseModel):
    """Request to add/remove reaction"""
    emoji: str = Field(..., min_length=1, max_length=10)


class CreateAnnotationRequest(BaseModel):
    """Request to create an annotation"""
    annotation_type: str = Field(..., pattern="^(highlight|underline|strikethrough)$")
    position: dict  # {from, to}
    color: str = "#ffeb3b"
    note: Optional[str] = None


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_comments_service() -> DocsCommentsService:
    return get_docs_comments_service()


# =============================================================================
# COMMENT ENDPOINTS
# =============================================================================

@router.post("/documents/{document_id}")
async def create_comment(
    document_id: str,
    request: CreateCommentRequest,
    service: DocsCommentsService = Depends(get_comments_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Create a comment on a document.

    Supports:
    - Inline comments at specific positions
    - General document comments
    - Replies to existing comments
    - @mentions (notifies mentioned users)
    """
    user_id = UUID(current_user['id'])

    try:
        comment = await service.create_comment(
            document_id=UUID(document_id),
            user_id=user_id,
            content=request.content,
            position=request.position,
            selection_text=request.selection_text,
            parent_id=UUID(request.parent_id) if request.parent_id else None
        )

        return comment

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/documents/{document_id}")
async def list_comments(
    document_id: str,
    include_resolved: bool = Query(False, description="Include resolved comments"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    service: DocsCommentsService = Depends(get_comments_service),
    current_user: dict = Depends(get_current_user)
):
    """
    List comments for a document.

    Returns top-level comments with reply counts.
    """
    comments = await service.list_document_comments(
        document_id=UUID(document_id),
        include_resolved=include_resolved,
        limit=limit,
        offset=offset
    )

    return {
        "comments": comments,
        "total": len(comments),
        "document_id": document_id
    }


@router.get("/documents/{document_id}/stats")
async def get_comment_stats(
    document_id: str,
    service: DocsCommentsService = Depends(get_comments_service),
    current_user: dict = Depends(get_current_user)
):
    """Get comment statistics for a document."""
    stats = await service.get_document_comment_stats(UUID(document_id))
    return stats


@router.get("/{comment_id}")
async def get_comment(
    comment_id: str,
    service: DocsCommentsService = Depends(get_comments_service),
    current_user: dict = Depends(get_current_user)
):
    """Get a single comment by ID."""
    comment = await service.get_comment(UUID(comment_id))

    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    return comment


@router.get("/{comment_id}/thread")
async def get_comment_thread(
    comment_id: str,
    service: DocsCommentsService = Depends(get_comments_service),
    current_user: dict = Depends(get_current_user)
):
    """Get a comment with all its replies."""
    thread = await service.get_comment_thread(UUID(comment_id))

    if not thread:
        raise HTTPException(status_code=404, detail="Comment not found")

    return thread


@router.put("/{comment_id}")
async def update_comment(
    comment_id: str,
    request: UpdateCommentRequest,
    service: DocsCommentsService = Depends(get_comments_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Update a comment.

    Only the comment author can edit.
    """
    user_id = UUID(current_user['id'])

    comment = await service.update_comment(
        comment_id=UUID(comment_id),
        user_id=user_id,
        content=request.content
    )

    if not comment:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to edit this comment"
        )

    return comment


@router.delete("/{comment_id}")
async def delete_comment(
    comment_id: str,
    service: DocsCommentsService = Depends(get_comments_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a comment.

    Only the author or an admin can delete.
    """
    user_id = UUID(current_user['id'])
    is_admin = current_user.get('role') in ['ADMIN', 'SUPER_ADMIN']

    success = await service.delete_comment(
        comment_id=UUID(comment_id),
        user_id=user_id,
        is_admin=is_admin
    )

    if not success:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to delete this comment"
        )

    return {"deleted": True}


# =============================================================================
# RESOLUTION ENDPOINTS
# =============================================================================

@router.post("/{comment_id}/resolve")
async def resolve_comment(
    comment_id: str,
    service: DocsCommentsService = Depends(get_comments_service),
    current_user: dict = Depends(get_current_user)
):
    """Mark a comment thread as resolved."""
    user_id = UUID(current_user['id'])

    comment = await service.resolve_comment(
        comment_id=UUID(comment_id),
        user_id=user_id
    )

    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    return comment


@router.post("/{comment_id}/unresolve")
async def unresolve_comment(
    comment_id: str,
    service: DocsCommentsService = Depends(get_comments_service),
    current_user: dict = Depends(get_current_user)
):
    """Mark a comment thread as unresolved."""
    comment = await service.unresolve_comment(UUID(comment_id))

    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    return comment


# =============================================================================
# REACTION ENDPOINTS
# =============================================================================

@router.post("/{comment_id}/reactions")
async def add_reaction(
    comment_id: str,
    request: ReactionRequest,
    service: DocsCommentsService = Depends(get_comments_service),
    current_user: dict = Depends(get_current_user)
):
    """Add a reaction to a comment."""
    user_id = UUID(current_user['id'])

    result = await service.add_reaction(
        comment_id=UUID(comment_id),
        user_id=user_id,
        emoji=request.emoji
    )

    return result


@router.delete("/{comment_id}/reactions/{emoji}")
async def remove_reaction(
    comment_id: str,
    emoji: str,
    service: DocsCommentsService = Depends(get_comments_service),
    current_user: dict = Depends(get_current_user)
):
    """Remove a reaction from a comment."""
    user_id = UUID(current_user['id'])

    result = await service.remove_reaction(
        comment_id=UUID(comment_id),
        user_id=user_id,
        emoji=emoji
    )

    return result


@router.get("/{comment_id}/reactions")
async def get_reactions(
    comment_id: str,
    service: DocsCommentsService = Depends(get_comments_service),
    current_user: dict = Depends(get_current_user)
):
    """Get all reactions for a comment."""
    return await service.get_reaction_counts(UUID(comment_id))


# =============================================================================
# ANNOTATION ENDPOINTS
# =============================================================================

@router.post("/documents/{document_id}/annotations")
async def create_annotation(
    document_id: str,
    request: CreateAnnotationRequest,
    service: DocsCommentsService = Depends(get_comments_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Create an annotation (highlight, underline, etc.).

    Annotations mark specific positions in the document.
    """
    user_id = UUID(current_user['id'])

    annotation = await service.create_annotation(
        document_id=UUID(document_id),
        user_id=user_id,
        annotation_type=request.annotation_type,
        position=request.position,
        color=request.color,
        note=request.note
    )

    return annotation


@router.get("/documents/{document_id}/annotations")
async def list_annotations(
    document_id: str,
    my_only: bool = Query(False, description="Only show my annotations"),
    service: DocsCommentsService = Depends(get_comments_service),
    current_user: dict = Depends(get_current_user)
):
    """List annotations for a document."""
    user_id = UUID(current_user['id']) if my_only else None

    annotations = await service.list_annotations(
        document_id=UUID(document_id),
        user_id=user_id
    )

    return {"annotations": annotations}


@router.delete("/annotations/{annotation_id}")
async def delete_annotation(
    annotation_id: str,
    service: DocsCommentsService = Depends(get_comments_service),
    current_user: dict = Depends(get_current_user)
):
    """Delete an annotation."""
    user_id = UUID(current_user['id'])

    success = await service.delete_annotation(
        annotation_id=UUID(annotation_id),
        user_id=user_id
    )

    if not success:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to delete this annotation"
        )

    return {"deleted": True}
