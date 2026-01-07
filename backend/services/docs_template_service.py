"""
Bheem Docs - Template Service
==============================
Manages document templates for both internal (ERP) and external (SaaS) users.
Templates can be global (public), tenant-specific, or company-specific.

Database Tables:
- workspace.docs_templates
"""

from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
import logging
import psycopg2
from psycopg2.extras import RealDictCursor
import json

from core.config import settings

logger = logging.getLogger(__name__)


# Default templates for common document types
DEFAULT_TEMPLATES = {
    "blank": {
        "name": "Blank Document",
        "description": "Start with an empty document",
        "category": "General",
        "content": {
            "type": "doc",
            "content": [
                {
                    "type": "paragraph"
                }
            ]
        }
    },
    "meeting_notes": {
        "name": "Meeting Notes",
        "description": "Template for meeting minutes and notes",
        "category": "Business",
        "content": {
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "Meeting Notes"}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Date: "}, {"type": "text", "text": "[Date]"}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Attendees: "}, {"type": "text", "text": "[Names]"}]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Agenda"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Item 1"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Item 2"}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Discussion"}]},
                {"type": "paragraph"},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Action Items"}]},
                {"type": "taskList", "content": [
                    {"type": "taskItem", "attrs": {"checked": False}, "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Task 1 - @assignee"}]}]},
                    {"type": "taskItem", "attrs": {"checked": False}, "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Task 2 - @assignee"}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Next Steps"}]},
                {"type": "paragraph"}
            ]
        }
    },
    "project_proposal": {
        "name": "Project Proposal",
        "description": "Template for project proposals and pitches",
        "category": "Business",
        "content": {
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "Project Proposal: [Project Name]"}]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Executive Summary"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "[Brief overview of the project]"}]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Problem Statement"}]},
                {"type": "paragraph"},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Proposed Solution"}]},
                {"type": "paragraph"},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Scope"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "In scope:"}]}]},
                    {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Out of scope:"}]}]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Resources Required"}]},
                {"type": "table", "content": [
                    {"type": "tableRow", "content": [
                        {"type": "tableHeader", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Resource"}]}]},
                        {"type": "tableHeader", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Quantity"}]}]},
                        {"type": "tableHeader", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Cost"}]}]}
                    ]},
                    {"type": "tableRow", "content": [
                        {"type": "tableCell", "content": [{"type": "paragraph"}]},
                        {"type": "tableCell", "content": [{"type": "paragraph"}]},
                        {"type": "tableCell", "content": [{"type": "paragraph"}]}
                    ]}
                ]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Timeline"}]},
                {"type": "paragraph"},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Success Metrics"}]},
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [{"type": "paragraph"}]}
                ]}
            ]
        }
    },
    "srs_document": {
        "name": "Software Requirements Specification",
        "description": "Template for software requirements documentation",
        "category": "Technical",
        "content": {
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "Software Requirements Specification"}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Version: "}, {"type": "text", "text": "1.0"}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Date: "}, {"type": "text", "text": "[Date]"}]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "1. Introduction"}]},
                {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "1.1 Purpose"}]},
                {"type": "paragraph"},
                {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "1.2 Scope"}]},
                {"type": "paragraph"},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "2. Functional Requirements"}]},
                {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "2.1 Feature 1"}]},
                {"type": "paragraph"},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "3. Non-Functional Requirements"}]},
                {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "3.1 Performance"}]},
                {"type": "paragraph"},
                {"type": "heading", "attrs": {"level": 3}, "content": [{"type": "text", "text": "3.2 Security"}]},
                {"type": "paragraph"},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "4. User Interface"}]},
                {"type": "paragraph"},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "5. Appendix"}]},
                {"type": "paragraph"}
            ]
        }
    },
    "invoice_template": {
        "name": "Invoice",
        "description": "Standard invoice template",
        "category": "Finance",
        "content": {
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "INVOICE"}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Invoice #: "}, {"type": "text", "text": "[Number]"}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Date: "}, {"type": "text", "text": "[Date]"}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Due Date: "}, {"type": "text", "text": "[Due Date]"}]},
                {"type": "horizontalRule"},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Bill To:"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "[Customer Name]"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "[Address]"}]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Items"}]},
                {"type": "table", "content": [
                    {"type": "tableRow", "content": [
                        {"type": "tableHeader", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Description"}]}]},
                        {"type": "tableHeader", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Qty"}]}]},
                        {"type": "tableHeader", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Rate"}]}]},
                        {"type": "tableHeader", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Amount"}]}]}
                    ]},
                    {"type": "tableRow", "content": [
                        {"type": "tableCell", "content": [{"type": "paragraph"}]},
                        {"type": "tableCell", "content": [{"type": "paragraph"}]},
                        {"type": "tableCell", "content": [{"type": "paragraph"}]},
                        {"type": "tableCell", "content": [{"type": "paragraph"}]}
                    ]}
                ]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Subtotal: "}, {"type": "text", "text": "[Amount]"}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Tax: "}, {"type": "text", "text": "[Amount]"}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Total: "}, {"type": "text", "text": "[Amount]"}]},
                {"type": "horizontalRule"},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "italic"}], "text": "Payment Terms: Net 30"}]}
            ]
        }
    },
    "employee_contract": {
        "name": "Employment Contract",
        "description": "Template for employment agreements",
        "category": "HR",
        "content": {
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "Employment Contract"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "This Employment Contract is entered into as of [Date], between:"}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Employer: "}, {"type": "text", "text": "[Company Name]"}]},
                {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Employee: "}, {"type": "text", "text": "[Employee Name]"}]},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "1. Position and Duties"}]},
                {"type": "paragraph"},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "2. Compensation"}]},
                {"type": "paragraph"},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "3. Benefits"}]},
                {"type": "paragraph"},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "4. Work Schedule"}]},
                {"type": "paragraph"},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "5. Confidentiality"}]},
                {"type": "paragraph"},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "6. Termination"}]},
                {"type": "paragraph"},
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Signatures"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "_________________________ Date: _________"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "Employer"}]},
                {"type": "paragraph"},
                {"type": "paragraph", "content": [{"type": "text", "text": "_________________________ Date: _________"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "Employee"}]}
            ]
        }
    }
}


class DocsTemplateService:
    """
    Document template management service.

    Supports:
    - Global public templates
    - Company-specific templates (internal ERP)
    - Tenant-specific templates (external SaaS)
    """

    def __init__(self):
        """Initialize with ERP database connection."""
        self.db_config = {
            'host': settings.ERP_DB_HOST,
            'port': settings.ERP_DB_PORT,
            'database': settings.ERP_DB_NAME,
            'user': settings.ERP_DB_USER,
            'password': settings.ERP_DB_PASSWORD,
        }

    def _get_connection(self):
        """Get database connection."""
        return psycopg2.connect(**self.db_config)

    async def list_templates(
        self,
        category: Optional[str] = None,
        company_id: Optional[UUID] = None,
        tenant_id: Optional[UUID] = None,
        include_public: bool = True,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        List available templates.

        Args:
            category: Filter by category
            company_id: For internal users - show company templates
            tenant_id: For external users - show tenant templates
            include_public: Include global public templates
            limit: Max results
            offset: Pagination offset

        Returns:
            List of templates
        """
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            conditions = ["is_active = true"]
            params = []

            # Build access conditions
            access_conditions = []

            if include_public:
                access_conditions.append("is_public = true")

            if company_id:
                access_conditions.append("company_id = %s")
                params.append(str(company_id))

            if tenant_id:
                access_conditions.append("tenant_id = %s")
                params.append(str(tenant_id))

            if access_conditions:
                conditions.append(f"({' OR '.join(access_conditions)})")

            if category:
                conditions.append("category = %s")
                params.append(category)

            where_clause = " AND ".join(conditions)

            params.extend([limit, offset])

            cur.execute(f"""
                SELECT
                    id, name, description, category, thumbnail_url,
                    is_public, tenant_id, company_id, usage_count,
                    created_at, updated_at
                FROM workspace.docs_templates
                WHERE {where_clause}
                ORDER BY usage_count DESC, name ASC
                LIMIT %s OFFSET %s
            """, params)

            templates = [dict(row) for row in cur.fetchall()]

            # Add default templates if no custom ones and including public
            if include_public and not company_id and not tenant_id:
                for key, default in DEFAULT_TEMPLATES.items():
                    templates.append({
                        'id': f'default_{key}',
                        'name': default['name'],
                        'description': default['description'],
                        'category': default['category'],
                        'is_public': True,
                        'is_default': True,
                        'usage_count': 0
                    })

            return templates

        finally:
            cur.close()
            conn.close()

    async def get_template(
        self,
        template_id: str,
        company_id: Optional[UUID] = None,
        tenant_id: Optional[UUID] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get a template by ID.

        Args:
            template_id: Template ID or default template key
            company_id: Requesting company (for access check)
            tenant_id: Requesting tenant (for access check)

        Returns:
            Template with content
        """
        # Check if it's a default template
        if template_id.startswith('default_'):
            key = template_id.replace('default_', '')
            if key in DEFAULT_TEMPLATES:
                return {
                    'id': template_id,
                    **DEFAULT_TEMPLATES[key],
                    'is_public': True,
                    'is_default': True
                }
            return None

        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            # Build access check
            access_conditions = ["is_public = true"]
            params = [template_id]

            if company_id:
                access_conditions.append("company_id = %s")
                params.append(str(company_id))

            if tenant_id:
                access_conditions.append("tenant_id = %s")
                params.append(str(tenant_id))

            access_clause = f"({' OR '.join(access_conditions)})"

            cur.execute(f"""
                SELECT
                    id, name, description, category, content,
                    thumbnail_url, is_public, tenant_id, company_id,
                    usage_count, created_by, created_at, updated_at
                FROM workspace.docs_templates
                WHERE id = %s AND is_active = true AND {access_clause}
            """, params)

            row = cur.fetchone()
            return dict(row) if row else None

        finally:
            cur.close()
            conn.close()

    async def create_template(
        self,
        name: str,
        content: Dict[str, Any],
        created_by: UUID,
        description: Optional[str] = None,
        category: Optional[str] = None,
        is_public: bool = False,
        company_id: Optional[UUID] = None,
        tenant_id: Optional[UUID] = None,
        thumbnail_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a new template.

        Args:
            name: Template name
            content: Tiptap JSON content
            created_by: User creating the template
            description: Template description
            category: Category (Business, Technical, HR, Finance, etc.)
            is_public: Make globally available
            company_id: Associate with company (internal)
            tenant_id: Associate with tenant (external)
            thumbnail_url: Preview image URL

        Returns:
            Created template
        """
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            cur.execute("""
                INSERT INTO workspace.docs_templates (
                    name, description, category, content,
                    thumbnail_url, is_public, company_id, tenant_id,
                    created_by, created_at, updated_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW()
                )
                RETURNING *
            """, (
                name, description, category, json.dumps(content),
                thumbnail_url, is_public,
                str(company_id) if company_id else None,
                str(tenant_id) if tenant_id else None,
                str(created_by)
            ))

            row = cur.fetchone()
            conn.commit()

            logger.info(f"Created template: {name} (ID: {row['id']})")

            return dict(row)

        except Exception as e:
            conn.rollback()
            logger.error(f"Failed to create template: {e}")
            raise
        finally:
            cur.close()
            conn.close()

    async def update_template(
        self,
        template_id: UUID,
        updated_by: UUID,
        name: Optional[str] = None,
        content: Optional[Dict[str, Any]] = None,
        description: Optional[str] = None,
        category: Optional[str] = None,
        is_public: Optional[bool] = None,
        thumbnail_url: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Update an existing template."""
        conn = self._get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            updates = []
            params = []

            if name is not None:
                updates.append("name = %s")
                params.append(name)

            if content is not None:
                updates.append("content = %s")
                params.append(json.dumps(content))

            if description is not None:
                updates.append("description = %s")
                params.append(description)

            if category is not None:
                updates.append("category = %s")
                params.append(category)

            if is_public is not None:
                updates.append("is_public = %s")
                params.append(is_public)

            if thumbnail_url is not None:
                updates.append("thumbnail_url = %s")
                params.append(thumbnail_url)

            if not updates:
                return await self.get_template(str(template_id))

            updates.append("updated_at = NOW()")
            params.append(str(template_id))

            cur.execute(f"""
                UPDATE workspace.docs_templates
                SET {', '.join(updates)}
                WHERE id = %s AND is_active = true
                RETURNING *
            """, params)

            row = cur.fetchone()
            conn.commit()

            return dict(row) if row else None

        except Exception as e:
            conn.rollback()
            logger.error(f"Failed to update template: {e}")
            raise
        finally:
            cur.close()
            conn.close()

    async def delete_template(
        self,
        template_id: UUID,
        deleted_by: UUID
    ) -> bool:
        """Soft delete a template."""
        conn = self._get_connection()
        cur = conn.cursor()

        try:
            cur.execute("""
                UPDATE workspace.docs_templates
                SET is_active = false, updated_at = NOW()
                WHERE id = %s
            """, (str(template_id),))

            conn.commit()
            return cur.rowcount > 0

        except Exception as e:
            conn.rollback()
            raise
        finally:
            cur.close()
            conn.close()

    async def increment_usage(self, template_id: str) -> None:
        """Increment template usage count."""
        if template_id.startswith('default_'):
            return  # Don't track default template usage in DB

        conn = self._get_connection()
        cur = conn.cursor()

        try:
            cur.execute("""
                UPDATE workspace.docs_templates
                SET usage_count = usage_count + 1
                WHERE id = %s
            """, (template_id,))
            conn.commit()

        except Exception as e:
            conn.rollback()
            logger.warning(f"Failed to increment template usage: {e}")
        finally:
            cur.close()
            conn.close()

    async def list_categories(
        self,
        company_id: Optional[UUID] = None,
        tenant_id: Optional[UUID] = None
    ) -> List[str]:
        """Get list of available template categories."""
        conn = self._get_connection()
        cur = conn.cursor()

        try:
            access_conditions = ["is_public = true"]
            params = []

            if company_id:
                access_conditions.append("company_id = %s")
                params.append(str(company_id))

            if tenant_id:
                access_conditions.append("tenant_id = %s")
                params.append(str(tenant_id))

            access_clause = f"({' OR '.join(access_conditions)})"

            cur.execute(f"""
                SELECT DISTINCT category
                FROM workspace.docs_templates
                WHERE is_active = true AND category IS NOT NULL
                AND {access_clause}
                ORDER BY category
            """, params)

            categories = [row[0] for row in cur.fetchall()]

            # Add default categories
            default_categories = set(t['category'] for t in DEFAULT_TEMPLATES.values())
            categories = list(set(categories) | default_categories)
            categories.sort()

            return categories

        finally:
            cur.close()
            conn.close()

    async def create_document_from_template(
        self,
        template_id: str,
        title: str,
        company_id: Optional[UUID] = None,
        tenant_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Get template content ready for document creation.

        This method retrieves the template and prepares the content
        for creating a new document.

        Args:
            template_id: Template ID
            title: New document title
            company_id: Company context
            tenant_id: Tenant context

        Returns:
            Dict with content ready for document creation
        """
        template = await self.get_template(
            template_id,
            company_id=company_id,
            tenant_id=tenant_id
        )

        if not template:
            raise ValueError(f"Template not found: {template_id}")

        # Increment usage
        await self.increment_usage(template_id)

        return {
            'title': title,
            'content': template['content'],
            'template_id': template_id,
            'template_name': template['name']
        }


# Singleton instance
_template_service: Optional[DocsTemplateService] = None


def get_docs_template_service() -> DocsTemplateService:
    """Get or create template service instance."""
    global _template_service
    if _template_service is None:
        _template_service = DocsTemplateService()
    return _template_service
