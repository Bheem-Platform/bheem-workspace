"""
Bheem Workspace - Workflow Automation Service
Business logic for Bheem Flows - workflow automation engine
"""
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, or_, func
from sqlalchemy.orm import selectinload

from models.workflow_models import (
    Workflow, WorkflowRun, WorkflowTemplate,
    WORKFLOW_TRIGGERS, WORKFLOW_ACTIONS
)


class WorkflowService:
    """Service for managing automated workflows"""

    def __init__(self, db: AsyncSession):
        self.db = db

    # =============================================
    # Workflow CRUD
    # =============================================

    async def create_workflow(
        self,
        tenant_id: UUID,
        created_by: UUID,
        name: str,
        trigger_type: str,
        trigger_config: Optional[Dict] = None,
        actions: Optional[List[Dict]] = None,
        conditions: Optional[Dict] = None,
        description: Optional[str] = None
    ) -> Workflow:
        """Create a new workflow"""
        # Validate trigger type
        if trigger_type not in WORKFLOW_TRIGGERS:
            raise ValueError(f"Invalid trigger type: {trigger_type}")

        workflow = Workflow(
            tenant_id=tenant_id,
            created_by=created_by,
            name=name,
            description=description,
            trigger_type=trigger_type,
            trigger_config=trigger_config or {},
            actions=actions or [],
            conditions=conditions or {},
            is_enabled=False
        )

        self.db.add(workflow)
        await self.db.commit()
        await self.db.refresh(workflow)
        return workflow

    async def get_workflow(
        self,
        workflow_id: UUID,
        tenant_id: UUID
    ) -> Optional[Workflow]:
        """Get a workflow by ID"""
        result = await self.db.execute(
            select(Workflow)
            .options(selectinload(Workflow.runs))
            .where(
                Workflow.id == workflow_id,
                Workflow.tenant_id == tenant_id
            )
        )
        return result.scalar_one_or_none()

    async def list_workflows(
        self,
        tenant_id: UUID,
        trigger_type: Optional[str] = None,
        is_enabled: Optional[bool] = None,
        created_by: Optional[UUID] = None,
        skip: int = 0,
        limit: int = 50
    ) -> List[Workflow]:
        """List workflows with optional filters"""
        query = select(Workflow).where(Workflow.tenant_id == tenant_id)

        if trigger_type:
            query = query.where(Workflow.trigger_type == trigger_type)
        if is_enabled is not None:
            query = query.where(Workflow.is_enabled == is_enabled)
        if created_by:
            query = query.where(Workflow.created_by == created_by)

        query = query.order_by(Workflow.created_at.desc())
        query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update_workflow(
        self,
        workflow_id: UUID,
        tenant_id: UUID,
        **updates
    ) -> Optional[Workflow]:
        """Update a workflow"""
        workflow = await self.get_workflow(workflow_id, tenant_id)
        if not workflow:
            return None

        # Validate trigger type if being updated
        if 'trigger_type' in updates and updates['trigger_type'] not in WORKFLOW_TRIGGERS:
            raise ValueError(f"Invalid trigger type: {updates['trigger_type']}")

        allowed_fields = [
            'name', 'description', 'trigger_type', 'trigger_config',
            'actions', 'conditions', 'is_enabled'
        ]

        for field, value in updates.items():
            if field in allowed_fields and value is not None:
                setattr(workflow, field, value)

        workflow.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(workflow)
        return workflow

    async def delete_workflow(
        self,
        workflow_id: UUID,
        tenant_id: UUID
    ) -> bool:
        """Delete a workflow"""
        result = await self.db.execute(
            delete(Workflow).where(
                Workflow.id == workflow_id,
                Workflow.tenant_id == tenant_id
            )
        )
        await self.db.commit()
        return result.rowcount > 0

    async def enable_workflow(
        self,
        workflow_id: UUID,
        tenant_id: UUID
    ) -> Optional[Workflow]:
        """Enable a workflow"""
        return await self.update_workflow(
            workflow_id, tenant_id, is_enabled=True
        )

    async def disable_workflow(
        self,
        workflow_id: UUID,
        tenant_id: UUID
    ) -> Optional[Workflow]:
        """Disable a workflow"""
        return await self.update_workflow(
            workflow_id, tenant_id, is_enabled=False
        )

    # =============================================
    # Workflow Execution
    # =============================================

    async def trigger_workflow(
        self,
        workflow_id: UUID,
        tenant_id: UUID,
        trigger_data: Dict[str, Any]
    ) -> Optional[WorkflowRun]:
        """Trigger a workflow execution"""
        workflow = await self.get_workflow(workflow_id, tenant_id)
        if not workflow or not workflow.is_enabled:
            return None

        # Create workflow run
        run = WorkflowRun(
            workflow_id=workflow_id,
            status='running',
            trigger_data=trigger_data,
            execution_log=[]
        )

        self.db.add(run)
        await self.db.commit()
        await self.db.refresh(run)

        # Execute workflow asynchronously
        # In production, this would be queued for background execution
        await self._execute_workflow(workflow, run, trigger_data)

        return run

    async def _execute_workflow(
        self,
        workflow: Workflow,
        run: WorkflowRun,
        trigger_data: Dict[str, Any]
    ):
        """Execute workflow actions"""
        execution_log = []
        context = {'trigger': trigger_data}

        try:
            # Check conditions
            if workflow.conditions:
                if not self._evaluate_conditions(workflow.conditions, context):
                    execution_log.append({
                        'step': 'conditions',
                        'status': 'skipped',
                        'message': 'Conditions not met'
                    })
                    run.status = 'completed'
                    run.execution_log = execution_log
                    run.completed_at = datetime.utcnow()
                    await self.db.commit()
                    return

            # Execute each action
            for i, action in enumerate(workflow.actions):
                action_type = action.get('type')
                action_config = action.get('config', {})

                execution_log.append({
                    'step': i + 1,
                    'action': action_type,
                    'status': 'started',
                    'started_at': datetime.utcnow().isoformat()
                })

                try:
                    result = await self._execute_action(
                        action_type, action_config, context
                    )
                    execution_log[-1]['status'] = 'completed'
                    execution_log[-1]['result'] = result
                    context[f'action_{i}'] = result
                except Exception as e:
                    execution_log[-1]['status'] = 'failed'
                    execution_log[-1]['error'] = str(e)
                    raise

            # Update run status
            run.status = 'completed'
            run.execution_log = execution_log
            run.completed_at = datetime.utcnow()
            run.duration_ms = int(
                (run.completed_at - run.started_at).total_seconds() * 1000
            )

            # Update workflow stats
            workflow.run_count += 1
            workflow.last_run_at = datetime.utcnow()

        except Exception as e:
            run.status = 'failed'
            run.error = str(e)
            run.execution_log = execution_log
            run.completed_at = datetime.utcnow()
            workflow.last_error = str(e)

        await self.db.commit()

    def _evaluate_conditions(
        self,
        conditions: Dict,
        context: Dict
    ) -> bool:
        """Evaluate workflow conditions"""
        # Simple condition evaluation
        # In production, this would support complex condition logic
        for field, expected in conditions.items():
            actual = self._get_nested_value(context, field)
            if actual != expected:
                return False
        return True

    def _get_nested_value(self, data: Dict, path: str) -> Any:
        """Get nested value from dict using dot notation"""
        keys = path.split('.')
        value = data
        for key in keys:
            if isinstance(value, dict):
                value = value.get(key)
            else:
                return None
        return value

    async def _execute_action(
        self,
        action_type: str,
        config: Dict,
        context: Dict
    ) -> Dict[str, Any]:
        """Execute a single workflow action"""
        if action_type not in WORKFLOW_ACTIONS:
            raise ValueError(f"Unknown action type: {action_type}")

        # Replace template variables in config
        resolved_config = self._resolve_variables(config, context)

        # Execute action based on type
        # In production, each action type would have its own handler
        if action_type == 'mail.send':
            return await self._action_send_email(resolved_config)
        elif action_type == 'notification.send':
            return await self._action_send_notification(resolved_config)
        elif action_type == 'webhook.call':
            return await self._action_call_webhook(resolved_config)
        elif action_type == 'delay':
            return await self._action_delay(resolved_config)
        else:
            # Placeholder for other actions
            return {'status': 'executed', 'action': action_type}

    def _resolve_variables(self, config: Dict, context: Dict) -> Dict:
        """Replace {{variable}} placeholders with actual values"""
        import re
        resolved = {}

        for key, value in config.items():
            if isinstance(value, str):
                # Find all {{variable}} patterns
                pattern = r'\{\{(\w+(?:\.\w+)*)\}\}'
                matches = re.findall(pattern, value)

                resolved_value = value
                for match in matches:
                    actual = self._get_nested_value(context, match)
                    if actual is not None:
                        resolved_value = resolved_value.replace(
                            f'{{{{{match}}}}}', str(actual)
                        )
                resolved[key] = resolved_value
            elif isinstance(value, dict):
                resolved[key] = self._resolve_variables(value, context)
            else:
                resolved[key] = value

        return resolved

    async def _action_send_email(self, config: Dict) -> Dict:
        """Execute send email action"""
        # In production, this would integrate with the email service
        return {
            'status': 'sent',
            'to': config.get('to'),
            'subject': config.get('subject')
        }

    async def _action_send_notification(self, config: Dict) -> Dict:
        """Execute send notification action"""
        return {
            'status': 'sent',
            'to': config.get('to'),
            'title': config.get('title')
        }

    async def _action_call_webhook(self, config: Dict) -> Dict:
        """Execute webhook call action"""
        import aiohttp

        url = config.get('url')
        method = config.get('method', 'POST')
        headers = config.get('headers', {})
        body = config.get('body')

        async with aiohttp.ClientSession() as session:
            async with session.request(
                method, url, headers=headers, data=body
            ) as response:
                return {
                    'status_code': response.status,
                    'response': await response.text()
                }

    async def _action_delay(self, config: Dict) -> Dict:
        """Execute delay action"""
        import asyncio
        duration = config.get('duration_seconds', 0)
        await asyncio.sleep(duration)
        return {'delayed_seconds': duration}

    # =============================================
    # Workflow Runs
    # =============================================

    async def get_workflow_runs(
        self,
        workflow_id: UUID,
        tenant_id: UUID,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 50
    ) -> List[WorkflowRun]:
        """Get workflow execution history"""
        # First verify workflow belongs to tenant
        workflow = await self.get_workflow(workflow_id, tenant_id)
        if not workflow:
            return []

        query = select(WorkflowRun).where(
            WorkflowRun.workflow_id == workflow_id
        )

        if status:
            query = query.where(WorkflowRun.status == status)

        query = query.order_by(WorkflowRun.started_at.desc())
        query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_workflow_run(
        self,
        run_id: UUID,
        tenant_id: UUID
    ) -> Optional[WorkflowRun]:
        """Get a specific workflow run"""
        result = await self.db.execute(
            select(WorkflowRun)
            .join(Workflow)
            .where(
                WorkflowRun.id == run_id,
                Workflow.tenant_id == tenant_id
            )
        )
        return result.scalar_one_or_none()

    # =============================================
    # Workflow Templates
    # =============================================

    async def list_templates(
        self,
        tenant_id: UUID,
        category: Optional[str] = None,
        include_public: bool = True
    ) -> List[WorkflowTemplate]:
        """List available workflow templates"""
        conditions = []

        if include_public:
            conditions.append(
                or_(
                    WorkflowTemplate.tenant_id == tenant_id,
                    WorkflowTemplate.is_public == True
                )
            )
        else:
            conditions.append(WorkflowTemplate.tenant_id == tenant_id)

        if category:
            conditions.append(WorkflowTemplate.category == category)

        query = select(WorkflowTemplate).where(and_(*conditions))
        query = query.order_by(WorkflowTemplate.use_count.desc())

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def create_from_template(
        self,
        template_id: UUID,
        tenant_id: UUID,
        created_by: UUID,
        name: Optional[str] = None
    ) -> Optional[Workflow]:
        """Create a workflow from a template"""
        result = await self.db.execute(
            select(WorkflowTemplate).where(
                WorkflowTemplate.id == template_id,
                or_(
                    WorkflowTemplate.tenant_id == tenant_id,
                    WorkflowTemplate.is_public == True
                )
            )
        )
        template = result.scalar_one_or_none()

        if not template:
            return None

        # Create workflow from template
        workflow = await self.create_workflow(
            tenant_id=tenant_id,
            created_by=created_by,
            name=name or template.name,
            description=template.description,
            trigger_type=template.trigger_type,
            trigger_config=template.trigger_config,
            actions=template.actions,
            conditions=template.conditions
        )

        # Increment template use count
        template.use_count += 1
        await self.db.commit()

        return workflow

    async def save_as_template(
        self,
        workflow_id: UUID,
        tenant_id: UUID,
        name: str,
        category: Optional[str] = None,
        is_public: bool = False
    ) -> Optional[WorkflowTemplate]:
        """Save a workflow as a template"""
        workflow = await self.get_workflow(workflow_id, tenant_id)
        if not workflow:
            return None

        template = WorkflowTemplate(
            tenant_id=tenant_id if not is_public else None,
            name=name,
            description=workflow.description,
            category=category,
            trigger_type=workflow.trigger_type,
            trigger_config=workflow.trigger_config,
            actions=workflow.actions,
            conditions=workflow.conditions,
            is_public=is_public
        )

        self.db.add(template)
        await self.db.commit()
        await self.db.refresh(template)
        return template

    # =============================================
    # Event Handlers for Triggers
    # =============================================

    async def find_workflows_for_trigger(
        self,
        tenant_id: UUID,
        trigger_type: str
    ) -> List[Workflow]:
        """Find all enabled workflows matching a trigger type"""
        result = await self.db.execute(
            select(Workflow).where(
                Workflow.tenant_id == tenant_id,
                Workflow.trigger_type == trigger_type,
                Workflow.is_enabled == True
            )
        )
        return list(result.scalars().all())

    async def process_trigger_event(
        self,
        tenant_id: UUID,
        trigger_type: str,
        trigger_data: Dict[str, Any]
    ) -> List[WorkflowRun]:
        """Process a trigger event and execute matching workflows"""
        workflows = await self.find_workflows_for_trigger(tenant_id, trigger_type)
        runs = []

        for workflow in workflows:
            # Check if trigger config matches
            if self._matches_trigger_config(
                workflow.trigger_config, trigger_data
            ):
                run = await self.trigger_workflow(
                    workflow.id, tenant_id, trigger_data
                )
                if run:
                    runs.append(run)

        return runs

    def _matches_trigger_config(
        self,
        config: Dict,
        data: Dict
    ) -> bool:
        """Check if trigger data matches workflow trigger config"""
        if not config:
            return True

        for key, expected in config.items():
            if expected is None or expected == '':
                continue

            actual = data.get(key)
            if actual is None:
                return False

            # String contains check
            if isinstance(expected, str) and isinstance(actual, str):
                if expected.lower() not in actual.lower():
                    return False
            elif actual != expected:
                return False

        return True

    # =============================================
    # Available Triggers and Actions
    # =============================================

    @staticmethod
    def get_available_triggers() -> Dict[str, Dict]:
        """Get all available trigger types"""
        return WORKFLOW_TRIGGERS

    @staticmethod
    def get_available_actions() -> Dict[str, Dict]:
        """Get all available action types"""
        return WORKFLOW_ACTIONS
