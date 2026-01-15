"""
Bheem Forms Service
===================
Business logic for form operations.
Handles form CRUD, questions, responses, and analytics.
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
    Form,
    FormQuestion,
    FormResponse,
    FormShare,
    ProductivityTemplate
)

logger = logging.getLogger(__name__)


# Question types and their configurations
QUESTION_TYPES = {
    'short_text': {
        'name': 'Short Answer',
        'has_options': False,
        'supports_validation': True
    },
    'long_text': {
        'name': 'Paragraph',
        'has_options': False,
        'supports_validation': True
    },
    'multiple_choice': {
        'name': 'Multiple Choice',
        'has_options': True,
        'supports_validation': False
    },
    'checkbox': {
        'name': 'Checkboxes',
        'has_options': True,
        'supports_validation': False
    },
    'dropdown': {
        'name': 'Dropdown',
        'has_options': True,
        'supports_validation': False
    },
    'date': {
        'name': 'Date',
        'has_options': False,
        'supports_validation': True
    },
    'time': {
        'name': 'Time',
        'has_options': False,
        'supports_validation': False
    },
    'file': {
        'name': 'File Upload',
        'has_options': False,
        'supports_validation': True
    },
    'scale': {
        'name': 'Linear Scale',
        'has_options': False,
        'supports_validation': False,
        'default_settings': {'min': 1, 'max': 5, 'min_label': '', 'max_label': ''}
    },
    'grid': {
        'name': 'Multiple Choice Grid',
        'has_options': True,
        'supports_validation': False
    }
}

DEFAULT_SETTINGS = {
    'collect_email': False,
    'limit_responses': False,
    'response_limit': None,
    'allow_edit_response': True,
    'show_progress_bar': True,
    'shuffle_questions': False,
    'confirmation_message': 'Your response has been recorded.',
    'require_login': False,
    'one_response_per_user': False
}

DEFAULT_THEME = {
    'color_primary': '#1a73e8',
    'color_background': '#f8f9fa',
    'font_family': 'Roboto',
    'header_image': None
}


class FormsService:
    """Service class for Bheem Forms operations"""

    # =============================================
    # Form CRUD
    # =============================================

    async def create_form(
        self,
        db: AsyncSession,
        tenant_id: UUID,
        user_id: UUID,
        title: str,
        description: Optional[str] = None,
        folder_id: Optional[UUID] = None,
        template_id: Optional[UUID] = None,
        settings: Optional[Dict[str, Any]] = None,
        theme: Optional[Dict[str, Any]] = None
    ) -> Form:
        """Create a new form"""

        # Merge default settings with provided settings
        form_settings = {**DEFAULT_SETTINGS, **(settings or {})}
        form_theme = {**DEFAULT_THEME, **(theme or {})}

        form = Form(
            tenant_id=tenant_id,
            title=title,
            description=description,
            folder_id=folder_id,
            settings=form_settings,
            theme=form_theme,
            status='draft',
            created_by=user_id
        )
        db.add(form)
        await db.flush()

        # If template provided, load template questions
        if template_id:
            template = await self._get_template(db, template_id, 'form')
            if template and template.content:
                questions_data = template.content.get('questions', [])
                for idx, q_data in enumerate(questions_data):
                    question = FormQuestion(
                        form_id=form.id,
                        question_index=idx,
                        question_type=q_data.get('type', 'short_text'),
                        title=q_data.get('title', 'Untitled Question'),
                        description=q_data.get('description'),
                        is_required=q_data.get('required', False),
                        options=q_data.get('options'),
                        validation=q_data.get('validation'),
                        settings=q_data.get('settings', {})
                    )
                    db.add(question)
                template.use_count = (template.use_count or 0) + 1

        await db.commit()
        await db.refresh(form)

        logger.info(f"Created form {form.id} for tenant {tenant_id}")
        return form

    async def get_form(
        self,
        db: AsyncSession,
        form_id: UUID,
        user_id: UUID,
        include_questions: bool = True
    ) -> Optional[Form]:
        """Get a form by ID with access check"""

        query = select(Form).where(
            and_(
                Form.id == form_id,
                Form.is_deleted == False
            )
        )

        if include_questions:
            query = query.options(selectinload(Form.questions))

        result = await db.execute(query)
        form = result.scalar_one_or_none()

        if not form:
            return None

        # Check access
        if form.created_by != user_id:
            has_access = await self._check_access(db, form_id, user_id)
            if not has_access:
                return None

        return form

    async def get_public_form(
        self,
        db: AsyncSession,
        form_id: UUID
    ) -> Optional[Form]:
        """Get a published form for public viewing/responding"""

        query = select(Form).where(
            and_(
                Form.id == form_id,
                Form.status == 'published',
                Form.is_deleted == False
            )
        ).options(selectinload(Form.questions))

        result = await db.execute(query)
        return result.scalar_one_or_none()

    async def list_forms(
        self,
        db: AsyncSession,
        tenant_id: UUID,
        user_id: UUID,
        folder_id: Optional[UUID] = None,
        status: Optional[str] = None,
        starred: Optional[bool] = None,
        search: Optional[str] = None,
        include_deleted: bool = False,
        skip: int = 0,
        limit: int = 50
    ) -> tuple[List[Form], int]:
        """List forms for a user (owned + shared)"""

        # Get shared form IDs
        shared_query = select(FormShare.form_id).where(
            FormShare.user_id == user_id
        )
        shared_result = await db.execute(shared_query)
        shared_ids = [row[0] for row in shared_result.fetchall()]

        # Combine owned and shared
        if shared_ids:
            query = select(Form).where(
                and_(
                    Form.tenant_id == tenant_id,
                    or_(
                        Form.created_by == user_id,
                        Form.id.in_(shared_ids)
                    )
                )
            )
        else:
            query = select(Form).where(
                and_(
                    Form.tenant_id == tenant_id,
                    Form.created_by == user_id
                )
            )

        # Apply filters
        if not include_deleted:
            query = query.where(Form.is_deleted == False)

        if folder_id:
            query = query.where(Form.folder_id == folder_id)

        if status:
            query = query.where(Form.status == status)

        if starred is not None:
            query = query.where(Form.is_starred == starred)

        if search:
            query = query.where(Form.title.ilike(f'%{search}%'))

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar()

        # Apply pagination and sorting
        query = query.order_by(Form.updated_at.desc())
        query = query.offset(skip).limit(limit)

        result = await db.execute(query)
        forms = result.scalars().all()

        return list(forms), total

    async def update_form(
        self,
        db: AsyncSession,
        form_id: UUID,
        user_id: UUID,
        title: Optional[str] = None,
        description: Optional[str] = None,
        settings: Optional[Dict[str, Any]] = None,
        theme: Optional[Dict[str, Any]] = None,
        folder_id: Optional[UUID] = None
    ) -> Optional[Form]:
        """Update form metadata"""

        form = await self.get_form(db, form_id, user_id, include_questions=False)
        if not form:
            return None

        # Check edit permission
        if form.created_by != user_id:
            permission = await self._get_permission(db, form_id, user_id)
            if permission != 'edit':
                return None

        if title is not None:
            form.title = title
        if description is not None:
            form.description = description
        if settings is not None:
            form.settings = {**form.settings, **settings}
        if theme is not None:
            form.theme = {**form.theme, **theme}
        if folder_id is not None:
            form.folder_id = folder_id

        form.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(form)

        return form

    async def delete_form(
        self,
        db: AsyncSession,
        form_id: UUID,
        user_id: UUID,
        permanent: bool = False
    ) -> bool:
        """Delete a form"""

        form = await self.get_form(db, form_id, user_id, include_questions=False)
        if not form or form.created_by != user_id:
            return False

        if permanent:
            await db.delete(form)
        else:
            form.is_deleted = True
            form.deleted_at = datetime.utcnow()

        await db.commit()
        logger.info(f"Deleted form {form_id}")
        return True

    async def restore_form(
        self,
        db: AsyncSession,
        form_id: UUID,
        user_id: UUID
    ) -> Optional[Form]:
        """Restore a deleted form"""

        query = select(Form).where(
            and_(
                Form.id == form_id,
                Form.created_by == user_id,
                Form.is_deleted == True
            )
        )
        result = await db.execute(query)
        form = result.scalar_one_or_none()

        if not form:
            return None

        form.is_deleted = False
        form.deleted_at = None
        await db.commit()
        await db.refresh(form)

        return form

    async def toggle_star(
        self,
        db: AsyncSession,
        form_id: UUID,
        user_id: UUID
    ) -> Optional[bool]:
        """Toggle starred status"""

        form = await self.get_form(db, form_id, user_id, include_questions=False)
        if not form:
            return None

        form.is_starred = not form.is_starred
        await db.commit()

        return form.is_starred

    async def duplicate_form(
        self,
        db: AsyncSession,
        form_id: UUID,
        user_id: UUID,
        new_title: Optional[str] = None
    ) -> Optional[Form]:
        """Duplicate a form with all questions"""

        original = await self.get_form(db, form_id, user_id, include_questions=True)
        if not original:
            return None

        # Create copy
        new_form = Form(
            tenant_id=original.tenant_id,
            title=new_title or f"Copy of {original.title}",
            description=original.description,
            folder_id=original.folder_id,
            settings=copy.deepcopy(original.settings) if original.settings else DEFAULT_SETTINGS.copy(),
            theme=copy.deepcopy(original.theme) if original.theme else DEFAULT_THEME.copy(),
            status='draft',
            created_by=user_id
        )
        db.add(new_form)
        await db.flush()

        # Copy questions
        for q in original.questions:
            new_question = FormQuestion(
                form_id=new_form.id,
                question_index=q.question_index,
                question_type=q.question_type,
                title=q.title,
                description=q.description,
                is_required=q.is_required,
                options=copy.deepcopy(q.options) if q.options else None,
                validation=copy.deepcopy(q.validation) if q.validation else None,
                settings=copy.deepcopy(q.settings) if q.settings else {}
            )
            db.add(new_question)

        await db.commit()
        await db.refresh(new_form)

        logger.info(f"Duplicated form {form_id} to {new_form.id}")
        return new_form

    # =============================================
    # Publishing
    # =============================================

    async def publish_form(
        self,
        db: AsyncSession,
        form_id: UUID,
        user_id: UUID,
        closes_at: Optional[datetime] = None
    ) -> Optional[Form]:
        """Publish a form to accept responses"""

        form = await self.get_form(db, form_id, user_id, include_questions=True)
        if not form or form.created_by != user_id:
            return None

        # Must have at least one question
        if not form.questions or len(form.questions) == 0:
            raise ValueError("Form must have at least one question to publish")

        form.status = 'published'
        form.published_at = datetime.utcnow()
        form.closes_at = closes_at
        form.updated_at = datetime.utcnow()

        await db.commit()
        await db.refresh(form)

        logger.info(f"Published form {form_id}")
        return form

    async def close_form(
        self,
        db: AsyncSession,
        form_id: UUID,
        user_id: UUID
    ) -> Optional[Form]:
        """Close a form to stop accepting responses"""

        form = await self.get_form(db, form_id, user_id, include_questions=False)
        if not form or form.created_by != user_id:
            return None

        form.status = 'closed'
        form.closes_at = datetime.utcnow()
        form.updated_at = datetime.utcnow()

        await db.commit()
        await db.refresh(form)

        return form

    async def reopen_form(
        self,
        db: AsyncSession,
        form_id: UUID,
        user_id: UUID
    ) -> Optional[Form]:
        """Reopen a closed form"""

        form = await self.get_form(db, form_id, user_id, include_questions=False)
        if not form or form.created_by != user_id:
            return None

        form.status = 'published'
        form.closes_at = None
        form.updated_at = datetime.utcnow()

        await db.commit()
        await db.refresh(form)

        return form

    # =============================================
    # Question Operations
    # =============================================

    async def add_question(
        self,
        db: AsyncSession,
        form_id: UUID,
        user_id: UUID,
        question_type: str,
        title: str,
        description: Optional[str] = None,
        is_required: bool = False,
        options: Optional[List[Dict[str, Any]]] = None,
        validation: Optional[Dict[str, Any]] = None,
        settings: Optional[Dict[str, Any]] = None
    ) -> Optional[FormQuestion]:
        """Add a question to a form"""

        form = await self.get_form(db, form_id, user_id, include_questions=True)
        if not form:
            return None

        # Get next index
        max_index = max([q.question_index for q in form.questions], default=-1)

        question = FormQuestion(
            form_id=form_id,
            question_index=max_index + 1,
            question_type=question_type,
            title=title,
            description=description,
            is_required=is_required,
            options=options,
            validation=validation,
            settings=settings or {}
        )
        db.add(question)

        form.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(question)

        return question

    async def update_question(
        self,
        db: AsyncSession,
        form_id: UUID,
        question_id: UUID,
        user_id: UUID,
        question_type: Optional[str] = None,
        title: Optional[str] = None,
        description: Optional[str] = None,
        is_required: Optional[bool] = None,
        options: Optional[List[Dict[str, Any]]] = None,
        validation: Optional[Dict[str, Any]] = None,
        settings: Optional[Dict[str, Any]] = None
    ) -> Optional[FormQuestion]:
        """Update a question"""

        form = await self.get_form(db, form_id, user_id, include_questions=False)
        if not form:
            return None

        query = select(FormQuestion).where(
            and_(
                FormQuestion.id == question_id,
                FormQuestion.form_id == form_id
            )
        )
        result = await db.execute(query)
        question = result.scalar_one_or_none()

        if not question:
            return None

        if question_type is not None:
            question.question_type = question_type
        if title is not None:
            question.title = title
        if description is not None:
            question.description = description
        if is_required is not None:
            question.is_required = is_required
        if options is not None:
            question.options = options
        if validation is not None:
            question.validation = validation
        if settings is not None:
            question.settings = settings

        question.updated_at = datetime.utcnow()
        form.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(question)

        return question

    async def delete_question(
        self,
        db: AsyncSession,
        form_id: UUID,
        question_id: UUID,
        user_id: UUID
    ) -> bool:
        """Delete a question"""

        form = await self.get_form(db, form_id, user_id, include_questions=True)
        if not form:
            return False

        question = next((q for q in form.questions if q.id == question_id), None)
        if not question:
            return False

        deleted_index = question.question_index
        await db.delete(question)

        # Reindex remaining questions
        for q in form.questions:
            if q.id != question_id and q.question_index > deleted_index:
                q.question_index -= 1

        form.updated_at = datetime.utcnow()
        await db.commit()

        return True

    async def reorder_questions(
        self,
        db: AsyncSession,
        form_id: UUID,
        user_id: UUID,
        question_ids: List[UUID]
    ) -> bool:
        """Reorder questions"""

        form = await self.get_form(db, form_id, user_id, include_questions=True)
        if not form:
            return False

        form_question_ids = {q.id for q in form.questions}
        if set(question_ids) != form_question_ids:
            return False

        for new_index, question_id in enumerate(question_ids):
            question = next((q for q in form.questions if q.id == question_id), None)
            if question:
                question.question_index = new_index

        form.updated_at = datetime.utcnow()
        await db.commit()

        return True

    # =============================================
    # Response Operations
    # =============================================

    async def submit_response(
        self,
        db: AsyncSession,
        form_id: UUID,
        answers: Dict[str, Any],
        respondent_email: Optional[str] = None,
        respondent_user_id: Optional[UUID] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> FormResponse:
        """Submit a response to a form"""

        form = await self.get_public_form(db, form_id)
        if not form:
            raise ValueError("Form not found or not published")

        # Check if form is closed
        if form.status != 'published':
            raise ValueError("Form is not accepting responses")

        # Check response limit
        settings = form.settings or {}
        if settings.get('limit_responses'):
            limit = settings.get('response_limit')
            if limit and form.response_count >= limit:
                raise ValueError("Form has reached response limit")

        # Validate required questions
        questions_dict = {str(q.id): q for q in form.questions}
        for q_id, q in questions_dict.items():
            if q.is_required and q_id not in answers:
                raise ValueError(f"Question '{q.title}' is required")

        response = FormResponse(
            form_id=form_id,
            answers=answers,
            respondent_email=respondent_email,
            respondent_user_id=respondent_user_id,
            ip_address=ip_address,
            user_agent=user_agent
        )
        db.add(response)

        # Update response count
        form.response_count = (form.response_count or 0) + 1

        await db.commit()
        await db.refresh(response)

        logger.info(f"Submitted response {response.id} to form {form_id}")
        return response

    async def get_responses(
        self,
        db: AsyncSession,
        form_id: UUID,
        user_id: UUID,
        skip: int = 0,
        limit: int = 50
    ) -> tuple[List[FormResponse], int, List[FormQuestion]]:
        """Get all responses for a form"""

        form = await self.get_form(db, form_id, user_id, include_questions=True)
        if not form:
            return [], 0, []

        # Check view_responses permission
        if form.created_by != user_id:
            permission = await self._get_permission(db, form_id, user_id)
            if permission != 'view_responses' and permission != 'edit':
                return [], 0, []

        # Get total count
        count_query = select(func.count()).select_from(FormResponse).where(
            FormResponse.form_id == form_id
        )
        total_result = await db.execute(count_query)
        total = total_result.scalar()

        # Get responses
        query = select(FormResponse).where(
            FormResponse.form_id == form_id
        ).order_by(FormResponse.submitted_at.desc()).offset(skip).limit(limit)

        result = await db.execute(query)
        responses = list(result.scalars().all())

        return responses, total, list(form.questions)

    async def get_response(
        self,
        db: AsyncSession,
        form_id: UUID,
        response_id: UUID,
        user_id: UUID
    ) -> Optional[tuple[FormResponse, List[FormQuestion]]]:
        """Get a specific response"""

        form = await self.get_form(db, form_id, user_id, include_questions=True)
        if not form:
            return None

        query = select(FormResponse).where(
            and_(
                FormResponse.id == response_id,
                FormResponse.form_id == form_id
            )
        )
        result = await db.execute(query)
        response = result.scalar_one_or_none()

        if not response:
            return None

        return response, list(form.questions)

    async def delete_response(
        self,
        db: AsyncSession,
        form_id: UUID,
        response_id: UUID,
        user_id: UUID
    ) -> bool:
        """Delete a response"""

        form = await self.get_form(db, form_id, user_id, include_questions=False)
        if not form or form.created_by != user_id:
            return False

        query = select(FormResponse).where(
            and_(
                FormResponse.id == response_id,
                FormResponse.form_id == form_id
            )
        )
        result = await db.execute(query)
        response = result.scalar_one_or_none()

        if not response:
            return False

        await db.delete(response)
        form.response_count = max(0, (form.response_count or 1) - 1)
        await db.commit()

        return True

    async def get_response_summary(
        self,
        db: AsyncSession,
        form_id: UUID,
        user_id: UUID
    ) -> Optional[Dict[str, Any]]:
        """Get summary statistics for form responses"""

        form = await self.get_form(db, form_id, user_id, include_questions=True)
        if not form:
            return None

        # Get all responses
        query = select(FormResponse).where(FormResponse.form_id == form_id)
        result = await db.execute(query)
        responses = list(result.scalars().all())

        # Build summaries
        question_summaries = []
        for q in form.questions:
            summary = {
                'question_id': str(q.id),
                'title': q.title,
                'question_type': q.question_type,
                'response_count': 0,
                'data': {}
            }

            # Collect answers for this question
            answers = []
            for r in responses:
                if str(q.id) in r.answers:
                    answers.append(r.answers[str(q.id)])
                    summary['response_count'] += 1

            # Summarize based on question type
            if q.question_type in ['multiple_choice', 'dropdown']:
                counts = {}
                for a in answers:
                    counts[a] = counts.get(a, 0) + 1
                summary['data'] = {'counts': counts}

            elif q.question_type == 'checkbox':
                counts = {}
                for a in answers:
                    if isinstance(a, list):
                        for item in a:
                            counts[item] = counts.get(item, 0) + 1
                summary['data'] = {'counts': counts}

            elif q.question_type == 'scale':
                numeric = [a for a in answers if isinstance(a, (int, float))]
                if numeric:
                    summary['data'] = {
                        'average': sum(numeric) / len(numeric),
                        'min': min(numeric),
                        'max': max(numeric),
                        'distribution': {str(a): numeric.count(a) for a in set(numeric)}
                    }

            elif q.question_type in ['short_text', 'long_text']:
                summary['data'] = {'recent_answers': answers[-10:]}

            question_summaries.append(summary)

        return {
            'form_id': str(form_id),
            'total_responses': len(responses),
            'question_summaries': question_summaries
        }

    # =============================================
    # Sharing
    # =============================================

    async def share_form(
        self,
        db: AsyncSession,
        form_id: UUID,
        owner_id: UUID,
        user_id: UUID,
        permission: str = 'view'
    ) -> Optional[FormShare]:
        """Share a form with a user"""

        form = await self.get_form(db, form_id, owner_id, include_questions=False)
        if not form or form.created_by != owner_id:
            return None

        if permission not in ['view', 'edit', 'view_responses']:
            return None

        # Check if already shared
        query = select(FormShare).where(
            and_(
                FormShare.form_id == form_id,
                FormShare.user_id == user_id
            )
        )
        result = await db.execute(query)
        existing = result.scalar_one_or_none()

        if existing:
            existing.permission = permission
            await db.commit()
            return existing

        share = FormShare(
            form_id=form_id,
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
        form_id: UUID,
        owner_id: UUID,
        user_id: UUID
    ) -> bool:
        """Remove sharing for a user"""

        form = await self.get_form(db, form_id, owner_id, include_questions=False)
        if not form or form.created_by != owner_id:
            return False

        query = delete(FormShare).where(
            and_(
                FormShare.form_id == form_id,
                FormShare.user_id == user_id
            )
        )
        await db.execute(query)
        await db.commit()

        return True

    # =============================================
    # Helper Methods
    # =============================================

    async def _check_access(
        self,
        db: AsyncSession,
        form_id: UUID,
        user_id: UUID
    ) -> bool:
        """Check if user has any access to form"""
        query = select(FormShare).where(
            and_(
                FormShare.form_id == form_id,
                FormShare.user_id == user_id
            )
        )
        result = await db.execute(query)
        return result.scalar_one_or_none() is not None

    async def _get_permission(
        self,
        db: AsyncSession,
        form_id: UUID,
        user_id: UUID
    ) -> Optional[str]:
        """Get user's permission level"""
        query = select(FormShare.permission).where(
            and_(
                FormShare.form_id == form_id,
                FormShare.user_id == user_id
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

    def get_question_types(self) -> Dict[str, Dict[str, Any]]:
        """Get available question types"""
        return QUESTION_TYPES


# Singleton instance
forms_service = FormsService()
