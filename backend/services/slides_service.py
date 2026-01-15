"""
Bheem Slides Service
====================
Business logic for presentation operations.
Handles CRUD, slides, sharing, and presentation mode.
"""
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
import logging
import copy

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, or_, func
from sqlalchemy.orm import selectinload

from models.productivity_models import (
    Presentation,
    Slide,
    PresentationShare,
    ProductivityTemplate
)

logger = logging.getLogger(__name__)


# Default slide layouts with content templates
SLIDE_LAYOUTS = {
    'title': {
        'name': 'Title Slide',
        'default_content': {
            'title': 'Presentation Title',
            'subtitle': 'Subtitle'
        }
    },
    'title_content': {
        'name': 'Title and Content',
        'default_content': {
            'title': 'Slide Title',
            'body': 'Click to add content'
        }
    },
    'two_column': {
        'name': 'Two Columns',
        'default_content': {
            'title': 'Slide Title',
            'left_content': 'Left column content',
            'right_content': 'Right column content'
        }
    },
    'section': {
        'name': 'Section Header',
        'default_content': {
            'title': 'Section Title'
        }
    },
    'blank': {
        'name': 'Blank',
        'default_content': {}
    },
    'title_bullets': {
        'name': 'Title and Bullets',
        'default_content': {
            'title': 'Slide Title',
            'bullets': ['Point 1', 'Point 2', 'Point 3']
        }
    },
    'image_caption': {
        'name': 'Image with Caption',
        'default_content': {
            'image_url': None,
            'caption': 'Image caption'
        }
    }
}

DEFAULT_THEME = {
    'font_heading': 'Arial',
    'font_body': 'Arial',
    'color_primary': '#1a73e8',
    'color_secondary': '#34a853',
    'color_background': '#ffffff'
}


class SlidesService:
    """Service class for Bheem Slides operations"""

    # =============================================
    # Presentation CRUD
    # =============================================

    async def create_presentation(
        self,
        db: AsyncSession,
        tenant_id: UUID,
        user_id: UUID,
        title: str,
        description: Optional[str] = None,
        folder_id: Optional[UUID] = None,
        template_id: Optional[UUID] = None,
        theme: Optional[Dict[str, Any]] = None
    ) -> Presentation:
        """Create a new presentation with initial slide"""

        # Create presentation
        presentation = Presentation(
            tenant_id=tenant_id,
            title=title,
            description=description,
            folder_id=folder_id,
            theme=theme or DEFAULT_THEME.copy(),
            created_by=user_id
        )
        db.add(presentation)
        await db.flush()

        # If template provided, load template slides
        if template_id:
            template = await self._get_template(db, template_id, 'presentation')
            if template and template.content:
                slides_data = template.content.get('slides', [])
                for idx, slide_data in enumerate(slides_data):
                    slide = Slide(
                        presentation_id=presentation.id,
                        slide_index=idx,
                        layout=slide_data.get('layout', 'blank'),
                        content=slide_data.get('content', {}),
                        speaker_notes=slide_data.get('notes')
                    )
                    db.add(slide)
                template.use_count = (template.use_count or 0) + 1
        else:
            # Create default title slide
            slide = Slide(
                presentation_id=presentation.id,
                slide_index=0,
                layout='title',
                content=SLIDE_LAYOUTS['title']['default_content'].copy()
            )
            db.add(slide)

        await db.commit()
        await db.refresh(presentation)

        logger.info(f"Created presentation {presentation.id} for tenant {tenant_id}")
        return presentation

    async def get_presentation(
        self,
        db: AsyncSession,
        presentation_id: UUID,
        user_id: UUID,
        include_slides: bool = True
    ) -> Optional[Presentation]:
        """Get a presentation by ID with access check"""

        query = select(Presentation).where(
            and_(
                Presentation.id == presentation_id,
                Presentation.is_deleted == False
            )
        )

        if include_slides:
            query = query.options(selectinload(Presentation.slides))

        result = await db.execute(query)
        presentation = result.scalar_one_or_none()

        if not presentation:
            return None

        # Check access
        if presentation.created_by != user_id:
            has_access = await self._check_access(db, presentation_id, user_id)
            if not has_access:
                return None

        return presentation

    async def list_presentations(
        self,
        db: AsyncSession,
        tenant_id: UUID,
        user_id: UUID,
        folder_id: Optional[UUID] = None,
        starred: Optional[bool] = None,
        search: Optional[str] = None,
        include_deleted: bool = False,
        skip: int = 0,
        limit: int = 50
    ) -> tuple[List[Presentation], int]:
        """List presentations for a user (owned + shared)"""

        # Get shared presentation IDs
        shared_query = select(PresentationShare.presentation_id).where(
            PresentationShare.user_id == user_id
        )
        shared_result = await db.execute(shared_query)
        shared_ids = [row[0] for row in shared_result.fetchall()]

        # Combine owned and shared
        if shared_ids:
            query = select(Presentation).where(
                and_(
                    Presentation.tenant_id == tenant_id,
                    or_(
                        Presentation.created_by == user_id,
                        Presentation.id.in_(shared_ids)
                    )
                )
            )
        else:
            query = select(Presentation).where(
                and_(
                    Presentation.tenant_id == tenant_id,
                    Presentation.created_by == user_id
                )
            )

        # Apply filters
        if not include_deleted:
            query = query.where(Presentation.is_deleted == False)

        if folder_id:
            query = query.where(Presentation.folder_id == folder_id)

        if starred is not None:
            query = query.where(Presentation.is_starred == starred)

        if search:
            query = query.where(Presentation.title.ilike(f'%{search}%'))

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar()

        # Apply pagination and sorting
        query = query.order_by(Presentation.updated_at.desc())
        query = query.offset(skip).limit(limit)
        query = query.options(selectinload(Presentation.slides))

        result = await db.execute(query)
        presentations = result.scalars().all()

        return list(presentations), total

    async def update_presentation(
        self,
        db: AsyncSession,
        presentation_id: UUID,
        user_id: UUID,
        title: Optional[str] = None,
        description: Optional[str] = None,
        theme: Optional[Dict[str, Any]] = None,
        folder_id: Optional[UUID] = None
    ) -> Optional[Presentation]:
        """Update presentation metadata"""

        presentation = await self.get_presentation(db, presentation_id, user_id, include_slides=False)
        if not presentation:
            return None

        # Check edit permission
        if presentation.created_by != user_id:
            permission = await self._get_permission(db, presentation_id, user_id)
            if permission != 'edit':
                return None

        if title is not None:
            presentation.title = title
        if description is not None:
            presentation.description = description
        if theme is not None:
            presentation.theme = theme
        if folder_id is not None:
            presentation.folder_id = folder_id

        presentation.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(presentation)

        return presentation

    async def delete_presentation(
        self,
        db: AsyncSession,
        presentation_id: UUID,
        user_id: UUID,
        permanent: bool = False
    ) -> bool:
        """Delete a presentation"""

        presentation = await self.get_presentation(db, presentation_id, user_id, include_slides=False)
        if not presentation or presentation.created_by != user_id:
            return False

        if permanent:
            await db.delete(presentation)
        else:
            presentation.is_deleted = True
            presentation.deleted_at = datetime.utcnow()

        await db.commit()
        logger.info(f"Deleted presentation {presentation_id}")
        return True

    async def toggle_star(
        self,
        db: AsyncSession,
        presentation_id: UUID,
        user_id: UUID
    ) -> Optional[bool]:
        """Toggle starred status"""

        presentation = await self.get_presentation(db, presentation_id, user_id, include_slides=False)
        if not presentation:
            return None

        presentation.is_starred = not presentation.is_starred
        await db.commit()

        return presentation.is_starred

    async def duplicate_presentation(
        self,
        db: AsyncSession,
        presentation_id: UUID,
        user_id: UUID,
        new_title: Optional[str] = None
    ) -> Optional[Presentation]:
        """Duplicate a presentation with all slides"""

        original = await self.get_presentation(db, presentation_id, user_id, include_slides=True)
        if not original:
            return None

        # Create copy
        new_presentation = Presentation(
            tenant_id=original.tenant_id,
            title=new_title or f"Copy of {original.title}",
            description=original.description,
            folder_id=original.folder_id,
            theme=copy.deepcopy(original.theme) if original.theme else DEFAULT_THEME.copy(),
            created_by=user_id
        )
        db.add(new_presentation)
        await db.flush()

        # Copy slides
        for slide in original.slides:
            new_slide = Slide(
                presentation_id=new_presentation.id,
                slide_index=slide.slide_index,
                layout=slide.layout,
                content=copy.deepcopy(slide.content) if slide.content else {},
                speaker_notes=slide.speaker_notes,
                transition=copy.deepcopy(slide.transition) if slide.transition else None,
                background=copy.deepcopy(slide.background) if slide.background else None,
                is_hidden=slide.is_hidden
            )
            db.add(new_slide)

        await db.commit()
        await db.refresh(new_presentation)

        logger.info(f"Duplicated presentation {presentation_id} to {new_presentation.id}")
        return new_presentation

    # =============================================
    # Slide Operations
    # =============================================

    async def add_slide(
        self,
        db: AsyncSession,
        presentation_id: UUID,
        user_id: UUID,
        layout: str = 'blank',
        after_index: Optional[int] = None,
        content: Optional[Dict[str, Any]] = None
    ) -> Optional[Slide]:
        """Add a new slide to a presentation"""

        presentation = await self.get_presentation(db, presentation_id, user_id, include_slides=True)
        if not presentation:
            return None

        # Check edit permission
        if presentation.created_by != user_id:
            permission = await self._get_permission(db, presentation_id, user_id)
            if permission != 'edit':
                return None

        # Determine index
        max_index = max([s.slide_index for s in presentation.slides], default=-1)
        if after_index is not None and after_index < max_index:
            new_index = after_index + 1
            # Shift existing slides
            for s in presentation.slides:
                if s.slide_index >= new_index:
                    s.slide_index += 1
        else:
            new_index = max_index + 1

        # Get default content for layout
        default_content = SLIDE_LAYOUTS.get(layout, {}).get('default_content', {})
        slide_content = content or default_content.copy()

        slide = Slide(
            presentation_id=presentation_id,
            slide_index=new_index,
            layout=layout,
            content=slide_content
        )
        db.add(slide)

        presentation.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(slide)

        return slide

    async def get_slide(
        self,
        db: AsyncSession,
        presentation_id: UUID,
        slide_id: UUID,
        user_id: UUID
    ) -> Optional[Slide]:
        """Get a specific slide"""

        presentation = await self.get_presentation(db, presentation_id, user_id, include_slides=False)
        if not presentation:
            return None

        query = select(Slide).where(
            and_(
                Slide.id == slide_id,
                Slide.presentation_id == presentation_id
            )
        )
        result = await db.execute(query)
        return result.scalar_one_or_none()

    async def update_slide(
        self,
        db: AsyncSession,
        presentation_id: UUID,
        slide_id: UUID,
        user_id: UUID,
        layout: Optional[str] = None,
        content: Optional[Dict[str, Any]] = None,
        speaker_notes: Optional[str] = None,
        background: Optional[Dict[str, Any]] = None,
        transition: Optional[Dict[str, Any]] = None,
        is_hidden: Optional[bool] = None
    ) -> Optional[Slide]:
        """Update a slide"""

        presentation = await self.get_presentation(db, presentation_id, user_id, include_slides=False)
        if not presentation:
            return None

        # Check edit permission
        if presentation.created_by != user_id:
            permission = await self._get_permission(db, presentation_id, user_id)
            if permission != 'edit':
                return None

        query = select(Slide).where(
            and_(
                Slide.id == slide_id,
                Slide.presentation_id == presentation_id
            )
        )
        result = await db.execute(query)
        slide = result.scalar_one_or_none()

        if not slide:
            return None

        if layout is not None:
            slide.layout = layout
        if content is not None:
            slide.content = content
        if speaker_notes is not None:
            slide.speaker_notes = speaker_notes
        if background is not None:
            slide.background = background
        if transition is not None:
            slide.transition = transition
        if is_hidden is not None:
            slide.is_hidden = is_hidden

        slide.updated_at = datetime.utcnow()
        presentation.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(slide)

        return slide

    async def delete_slide(
        self,
        db: AsyncSession,
        presentation_id: UUID,
        slide_id: UUID,
        user_id: UUID
    ) -> bool:
        """Delete a slide"""

        presentation = await self.get_presentation(db, presentation_id, user_id, include_slides=True)
        if not presentation:
            return False

        # Must have at least one slide
        if len(presentation.slides) <= 1:
            return False

        slide = next((s for s in presentation.slides if s.id == slide_id), None)
        if not slide:
            return False

        deleted_index = slide.slide_index
        await db.delete(slide)

        # Reindex remaining slides
        for s in presentation.slides:
            if s.id != slide_id and s.slide_index > deleted_index:
                s.slide_index -= 1

        presentation.updated_at = datetime.utcnow()
        await db.commit()

        return True

    async def duplicate_slide(
        self,
        db: AsyncSession,
        presentation_id: UUID,
        slide_id: UUID,
        user_id: UUID
    ) -> Optional[Slide]:
        """Duplicate a slide"""

        presentation = await self.get_presentation(db, presentation_id, user_id, include_slides=True)
        if not presentation:
            return None

        original_slide = next((s for s in presentation.slides if s.id == slide_id), None)
        if not original_slide:
            return None

        # Shift slides after this one
        for s in presentation.slides:
            if s.slide_index > original_slide.slide_index:
                s.slide_index += 1

        new_slide = Slide(
            presentation_id=presentation_id,
            slide_index=original_slide.slide_index + 1,
            layout=original_slide.layout,
            content=copy.deepcopy(original_slide.content) if original_slide.content else {},
            speaker_notes=original_slide.speaker_notes,
            transition=copy.deepcopy(original_slide.transition) if original_slide.transition else None,
            background=copy.deepcopy(original_slide.background) if original_slide.background else None
        )
        db.add(new_slide)

        presentation.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(new_slide)

        return new_slide

    async def reorder_slides(
        self,
        db: AsyncSession,
        presentation_id: UUID,
        user_id: UUID,
        slide_ids: List[UUID]
    ) -> bool:
        """Reorder slides"""

        presentation = await self.get_presentation(db, presentation_id, user_id, include_slides=True)
        if not presentation:
            return False

        # Validate all slide IDs belong to this presentation
        presentation_slide_ids = {s.id for s in presentation.slides}
        if set(slide_ids) != presentation_slide_ids:
            return False

        # Update indexes
        for new_index, slide_id in enumerate(slide_ids):
            slide = next((s for s in presentation.slides if s.id == slide_id), None)
            if slide:
                slide.slide_index = new_index

        presentation.updated_at = datetime.utcnow()
        await db.commit()

        return True

    # =============================================
    # Sharing
    # =============================================

    async def share_presentation(
        self,
        db: AsyncSession,
        presentation_id: UUID,
        owner_id: UUID,
        user_id: UUID,
        permission: str = 'view'
    ) -> Optional[PresentationShare]:
        """Share a presentation with a user"""

        presentation = await self.get_presentation(db, presentation_id, owner_id, include_slides=False)
        if not presentation or presentation.created_by != owner_id:
            return None

        if permission not in ['view', 'comment', 'edit']:
            return None

        # Check if already shared
        query = select(PresentationShare).where(
            and_(
                PresentationShare.presentation_id == presentation_id,
                PresentationShare.user_id == user_id
            )
        )
        result = await db.execute(query)
        existing = result.scalar_one_or_none()

        if existing:
            existing.permission = permission
            await db.commit()
            return existing

        share = PresentationShare(
            presentation_id=presentation_id,
            user_id=user_id,
            permission=permission,
            created_by=owner_id
        )
        db.add(share)
        await db.commit()
        await db.refresh(share)

        return share

    async def remove_share(
        self,
        db: AsyncSession,
        presentation_id: UUID,
        owner_id: UUID,
        user_id: UUID
    ) -> bool:
        """Remove sharing for a user"""

        presentation = await self.get_presentation(db, presentation_id, owner_id, include_slides=False)
        if not presentation or presentation.created_by != owner_id:
            return False

        query = delete(PresentationShare).where(
            and_(
                PresentationShare.presentation_id == presentation_id,
                PresentationShare.user_id == user_id
            )
        )
        await db.execute(query)
        await db.commit()

        return True

    async def get_shares(
        self,
        db: AsyncSession,
        presentation_id: UUID,
        user_id: UUID
    ) -> List[PresentationShare]:
        """Get all shares for a presentation"""

        presentation = await self.get_presentation(db, presentation_id, user_id, include_slides=False)
        if not presentation:
            return []

        query = select(PresentationShare).where(
            PresentationShare.presentation_id == presentation_id
        )
        result = await db.execute(query)
        return list(result.scalars().all())

    # =============================================
    # Helper Methods
    # =============================================

    async def _check_access(
        self,
        db: AsyncSession,
        presentation_id: UUID,
        user_id: UUID
    ) -> bool:
        """Check if user has any access to presentation"""
        query = select(PresentationShare).where(
            and_(
                PresentationShare.presentation_id == presentation_id,
                PresentationShare.user_id == user_id
            )
        )
        result = await db.execute(query)
        return result.scalar_one_or_none() is not None

    async def _get_permission(
        self,
        db: AsyncSession,
        presentation_id: UUID,
        user_id: UUID
    ) -> Optional[str]:
        """Get user's permission level"""
        query = select(PresentationShare.permission).where(
            and_(
                PresentationShare.presentation_id == presentation_id,
                PresentationShare.user_id == user_id
            )
        )
        result = await db.execute(query)
        row = result.first()
        return row[0] if row else None

    async def _get_template(
        self,
        db: AsyncSession,
        template_id: UUID,
        template_type: str
    ) -> Optional[ProductivityTemplate]:
        """Get a template by ID"""
        query = select(ProductivityTemplate).where(
            and_(
                ProductivityTemplate.id == template_id,
                ProductivityTemplate.template_type == template_type
            )
        )
        result = await db.execute(query)
        return result.scalar_one_or_none()

    def get_available_layouts(self) -> Dict[str, Dict[str, Any]]:
        """Get available slide layouts"""
        return SLIDE_LAYOUTS


# Singleton instance
slides_service = SlidesService()
