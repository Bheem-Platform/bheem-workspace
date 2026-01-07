"""
Bheem Docs - ERP Integration API
==================================
Endpoints for document management within ERP context.
Provides easy access to documents from any ERP module.

Quick access endpoints for:
- Invoices, POs, Employees, Projects, etc.
"""

from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from pydantic import BaseModel, Field

from core.security import get_current_user
from services.docs_document_service import (
    get_docs_document_service,
    DocsDocumentService,
    EntityType
)
from services.docs_entity_service import (
    get_docs_entity_service,
    DocsEntityService
)

router = APIRouter(prefix="/docs/erp", tags=["Bheem Docs ERP"])


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class LinkDocumentRequest(BaseModel):
    """Request to link document to entity"""
    document_id: str
    entity_type: str
    entity_id: str
    link_type: str = "ATTACHMENT"
    is_primary: bool = False


class BulkLinkRequest(BaseModel):
    """Request to link multiple documents"""
    document_ids: List[str]
    entity_type: str
    entity_id: str
    link_type: str = "ATTACHMENT"


class EntityDocumentResponse(BaseModel):
    """Document with entity link info"""
    id: str
    title: str
    file_name: str
    file_size: int
    mime_type: str
    document_type: str
    link_type: str
    is_primary: bool
    created_at: Optional[str] = None


class EntitySummaryResponse(BaseModel):
    """Summary of documents for an entity"""
    entity_type: str
    entity_id: str
    total_documents: int
    total_size_bytes: int
    by_type: List[dict]


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_document_service() -> DocsDocumentService:
    return get_docs_document_service()


def get_entity_service() -> DocsEntityService:
    return get_docs_entity_service()


def get_user_company_id(user: dict) -> UUID:
    company_id = user.get('company_id') or user.get('erp_company_id')
    if not company_id:
        raise HTTPException(status_code=400, detail="Company context required")
    return UUID(company_id)


# =============================================================================
# GENERIC ENTITY ENDPOINTS
# =============================================================================

@router.get("/entities/{entity_type}/{entity_id}/documents")
async def get_entity_documents(
    entity_type: str,
    entity_id: str,
    document_type: Optional[str] = Query(None, description="Filter by document type"),
    service: DocsEntityService = Depends(get_entity_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Get all documents linked to an ERP entity.

    Use this endpoint from any ERP module to display attached documents.

    **Supported Entity Types:**
    - CUSTOMER, VENDOR
    - EMPLOYEE, CANDIDATE
    - SALES_ORDER, SALES_INVOICE, SALES_QUOTE
    - PURCHASE_ORDER, PURCHASE_BILL, PURCHASE_REQUEST, GRN
    - PROJECT, TASK
    - CRM_CONTACT, CRM_LEAD, CRM_OPPORTUNITY
    - EXPENSE, ASSET, JOURNAL_ENTRY, PAYMENT
    """
    documents = await service.get_entity_documents(
        entity_type=entity_type.upper(),
        entity_id=UUID(entity_id),
        document_type=document_type
    )

    return {
        "entity_type": entity_type,
        "entity_id": entity_id,
        "documents": documents,
        "total": len(documents)
    }


@router.post("/entities/{entity_type}/{entity_id}/documents")
async def upload_entity_document(
    entity_type: str,
    entity_id: str,
    file: UploadFile = File(...),
    title: Optional[str] = Query(None, description="Document title"),
    document_type: Optional[str] = Query(None, description="Document type"),
    description: Optional[str] = Query(None),
    doc_service: DocsDocumentService = Depends(get_document_service),
    entity_service: DocsEntityService = Depends(get_entity_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload and link a document to an ERP entity in one step.

    Creates the document and automatically links it to the specified entity.
    """
    company_id = get_user_company_id(current_user)
    user_id = UUID(current_user['id'])

    try:
        # Create document with entity reference
        document = await doc_service.create_document(
            title=title or file.filename,
            file=file.file,
            filename=file.filename,
            company_id=company_id,
            created_by=user_id,
            document_type=document_type,
            description=description,
            entity_type=entity_type.upper(),
            entity_id=UUID(entity_id)
        )

        return {
            "document": document,
            "linked_to": {
                "entity_type": entity_type,
                "entity_id": entity_id
            }
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/link")
async def link_document_to_entity(
    request: LinkDocumentRequest,
    service: DocsEntityService = Depends(get_entity_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Link an existing document to an ERP entity.

    Use this when you have an existing document that needs to be
    associated with an entity.
    """
    user_id = UUID(current_user['id'])

    result = await service.link_document(
        document_id=UUID(request.document_id),
        entity_type=request.entity_type.upper(),
        entity_id=UUID(request.entity_id),
        created_by=user_id,
        link_type=request.link_type,
        is_primary=request.is_primary
    )

    return result


@router.post("/bulk-link")
async def bulk_link_documents(
    request: BulkLinkRequest,
    service: DocsEntityService = Depends(get_entity_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Link multiple documents to an entity at once.

    Useful for attaching several documents to a project, invoice, etc.
    """
    user_id = UUID(current_user['id'])

    result = await service.bulk_link_documents(
        document_ids=[UUID(d) for d in request.document_ids],
        entity_type=request.entity_type.upper(),
        entity_id=UUID(request.entity_id),
        created_by=user_id,
        link_type=request.link_type
    )

    return result


@router.delete("/entities/{entity_type}/{entity_id}/documents/{document_id}")
async def unlink_entity_document(
    entity_type: str,
    entity_id: str,
    document_id: str,
    service: DocsEntityService = Depends(get_entity_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Remove a document link from an entity.

    Note: This does not delete the document, only removes the association.
    """
    await service.unlink_document(
        document_id=UUID(document_id),
        entity_type=entity_type.upper(),
        entity_id=UUID(entity_id)
    )

    return {"unlinked": True}


@router.get("/entities/{entity_type}/{entity_id}/summary", response_model=EntitySummaryResponse)
async def get_entity_document_summary(
    entity_type: str,
    entity_id: str,
    service: DocsEntityService = Depends(get_entity_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Get summary of documents for an entity.

    Returns total counts and breakdown by document type.
    Useful for dashboard widgets.
    """
    return await service.get_entity_document_summary(
        entity_type=entity_type.upper(),
        entity_id=UUID(entity_id)
    )


@router.get("/documents/{document_id}/entities")
async def get_document_entities(
    document_id: str,
    service: DocsEntityService = Depends(get_entity_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Get all entities linked to a document.

    Shows which invoices, projects, employees, etc. this document is attached to.
    """
    entities = await service.get_document_entities(UUID(document_id))
    return {"entities": entities}


# =============================================================================
# QUICK ACCESS ENDPOINTS - SALES
# =============================================================================

@router.get("/invoices/{invoice_id}/documents")
async def get_invoice_documents(
    invoice_id: str,
    service: DocsEntityService = Depends(get_entity_service),
    current_user: dict = Depends(get_current_user)
):
    """Get documents attached to a sales invoice."""
    return await service.get_entity_documents(
        entity_type="SALES_INVOICE",
        entity_id=UUID(invoice_id)
    )


@router.get("/quotes/{quote_id}/documents")
async def get_quote_documents(
    quote_id: str,
    service: DocsEntityService = Depends(get_entity_service),
    current_user: dict = Depends(get_current_user)
):
    """Get documents attached to a sales quotation."""
    return await service.get_entity_documents(
        entity_type="SALES_QUOTE",
        entity_id=UUID(quote_id)
    )


@router.get("/sales-orders/{order_id}/documents")
async def get_sales_order_documents(
    order_id: str,
    service: DocsEntityService = Depends(get_entity_service),
    current_user: dict = Depends(get_current_user)
):
    """Get documents attached to a sales order."""
    return await service.get_entity_documents(
        entity_type="SALES_ORDER",
        entity_id=UUID(order_id)
    )


# =============================================================================
# QUICK ACCESS ENDPOINTS - PURCHASE
# =============================================================================

@router.get("/purchase-orders/{po_id}/documents")
async def get_purchase_order_documents(
    po_id: str,
    service: DocsEntityService = Depends(get_entity_service),
    current_user: dict = Depends(get_current_user)
):
    """Get documents attached to a purchase order."""
    return await service.get_entity_documents(
        entity_type="PURCHASE_ORDER",
        entity_id=UUID(po_id)
    )


@router.get("/bills/{bill_id}/documents")
async def get_bill_documents(
    bill_id: str,
    service: DocsEntityService = Depends(get_entity_service),
    current_user: dict = Depends(get_current_user)
):
    """Get documents attached to a purchase bill."""
    return await service.get_entity_documents(
        entity_type="PURCHASE_BILL",
        entity_id=UUID(bill_id)
    )


@router.get("/grn/{grn_id}/documents")
async def get_grn_documents(
    grn_id: str,
    service: DocsEntityService = Depends(get_entity_service),
    current_user: dict = Depends(get_current_user)
):
    """Get documents attached to a goods received note."""
    return await service.get_entity_documents(
        entity_type="GRN",
        entity_id=UUID(grn_id)
    )


# =============================================================================
# QUICK ACCESS ENDPOINTS - HR
# =============================================================================

@router.get("/employees/{employee_id}/documents")
async def get_employee_documents(
    employee_id: str,
    document_type: Optional[str] = Query(
        None,
        description="Filter by type: ID_DOCUMENT, CONTRACT, CERTIFICATE, etc."
    ),
    service: DocsEntityService = Depends(get_entity_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Get documents for an employee.

    Common document types:
    - ID_DOCUMENT: Passport, ID cards
    - CONTRACT: Employment contracts
    - CERTIFICATE: Training certificates, qualifications
    - LETTER: Offer letters, termination letters
    """
    return await service.get_entity_documents(
        entity_type="EMPLOYEE",
        entity_id=UUID(employee_id),
        document_type=document_type
    )


@router.get("/candidates/{candidate_id}/documents")
async def get_candidate_documents(
    candidate_id: str,
    service: DocsEntityService = Depends(get_entity_service),
    current_user: dict = Depends(get_current_user)
):
    """Get documents for a job candidate (resume, certificates, etc.)."""
    return await service.get_entity_documents(
        entity_type="CANDIDATE",
        entity_id=UUID(candidate_id)
    )


# =============================================================================
# QUICK ACCESS ENDPOINTS - PROJECT MANAGEMENT
# =============================================================================

@router.get("/projects/{project_id}/documents")
async def get_project_documents(
    project_id: str,
    document_type: Optional[str] = Query(None),
    service: DocsEntityService = Depends(get_entity_service),
    current_user: dict = Depends(get_current_user)
):
    """Get documents attached to a project."""
    return await service.get_entity_documents(
        entity_type="PROJECT",
        entity_id=UUID(project_id),
        document_type=document_type
    )


@router.get("/tasks/{task_id}/documents")
async def get_task_documents(
    task_id: str,
    service: DocsEntityService = Depends(get_entity_service),
    current_user: dict = Depends(get_current_user)
):
    """Get documents attached to a task."""
    return await service.get_entity_documents(
        entity_type="TASK",
        entity_id=UUID(task_id)
    )


# =============================================================================
# QUICK ACCESS ENDPOINTS - CRM
# =============================================================================

@router.get("/customers/{customer_id}/documents")
async def get_customer_documents(
    customer_id: str,
    service: DocsEntityService = Depends(get_entity_service),
    current_user: dict = Depends(get_current_user)
):
    """Get documents for a customer."""
    return await service.get_entity_documents(
        entity_type="CUSTOMER",
        entity_id=UUID(customer_id)
    )


@router.get("/vendors/{vendor_id}/documents")
async def get_vendor_documents(
    vendor_id: str,
    service: DocsEntityService = Depends(get_entity_service),
    current_user: dict = Depends(get_current_user)
):
    """Get documents for a vendor."""
    return await service.get_entity_documents(
        entity_type="VENDOR",
        entity_id=UUID(vendor_id)
    )


@router.get("/leads/{lead_id}/documents")
async def get_lead_documents(
    lead_id: str,
    service: DocsEntityService = Depends(get_entity_service),
    current_user: dict = Depends(get_current_user)
):
    """Get documents for a CRM lead."""
    return await service.get_entity_documents(
        entity_type="CRM_LEAD",
        entity_id=UUID(lead_id)
    )


@router.get("/opportunities/{opportunity_id}/documents")
async def get_opportunity_documents(
    opportunity_id: str,
    service: DocsEntityService = Depends(get_entity_service),
    current_user: dict = Depends(get_current_user)
):
    """Get documents for a CRM opportunity."""
    return await service.get_entity_documents(
        entity_type="CRM_OPPORTUNITY",
        entity_id=UUID(opportunity_id)
    )


# =============================================================================
# ENTITY TYPES REFERENCE
# =============================================================================

@router.get("/entity-types")
async def list_entity_types():
    """
    List all available ERP entity types for document linking.

    Returns the entity types that can have documents attached.
    """
    return {
        "entity_types": [
            {"value": t.value, "label": t.value.replace("_", " ").title(), "category": _get_category(t.value)}
            for t in EntityType
        ]
    }


def _get_category(entity_type: str) -> str:
    """Get category for entity type."""
    categories = {
        "CUSTOMER": "CRM",
        "VENDOR": "Purchase",
        "EMPLOYEE": "HR",
        "CANDIDATE": "HR",
        "SALES_ORDER": "Sales",
        "SALES_INVOICE": "Sales",
        "SALES_QUOTE": "Sales",
        "PURCHASE_ORDER": "Purchase",
        "PURCHASE_BILL": "Purchase",
        "PURCHASE_REQUEST": "Purchase",
        "GRN": "Purchase",
        "PROJECT": "Projects",
        "TASK": "Projects",
        "CRM_CONTACT": "CRM",
        "CRM_LEAD": "CRM",
        "CRM_OPPORTUNITY": "CRM",
        "EXPENSE": "Finance",
        "ASSET": "Finance",
        "JOURNAL_ENTRY": "Finance",
        "PAYMENT": "Finance",
        "COMPANY": "System"
    }
    return categories.get(entity_type, "Other")
