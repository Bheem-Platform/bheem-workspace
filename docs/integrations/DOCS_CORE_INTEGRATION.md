# Docs Integration with Core - Implementation Guide

## Overview

This guide covers integrating Bheem Docs (document management via Nextcloud) with Bheem Core (ERP) to provide centralized document storage across all ERP modules.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   DOCS-CORE INTEGRATION                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    BHEEM CORE (ERP)                        │  │
│  │                                                            │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │  │
│  │  │   HR    │ │  Sales  │ │ Purchase│ │ Projects │          │  │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘          │  │
│  │       │           │           │           │                │  │
│  │       └───────────┴─────┬─────┴───────────┘                │  │
│  │                         │                                  │  │
│  │                         ▼                                  │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │              DMS MODULE (Centralized)                │  │  │
│  │  │                                                      │  │  │
│  │  │  • Upload documents                                 │  │  │
│  │  │  • Attach to entities (entity_type + entity_id)     │  │  │
│  │  │  • Version control                                  │  │  │
│  │  │  • Share links                                      │  │  │
│  │  │  • Full-text search                                 │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            │                                     │
│                            │ WebDAV / API                        │
│                            ▼                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  BHEEM WORKSPACE                           │  │
│  │                                                            │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │              Docs API (/api/v1/docs)                 │  │  │
│  │  │                                                      │  │  │
│  │  │  POST /upload     → Upload file                     │  │  │
│  │  │  GET  /files      → List files                      │  │  │
│  │  │  GET  /download   → Download file                   │  │  │
│  │  │  POST /share      → Create share link               │  │  │
│  │  │  DELETE /files    → Delete file                     │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            │                                     │
│                            ▼                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    NEXTCLOUD SERVER                        │  │
│  │                https://docs.bheem.cloud                    │  │
│  │                                                            │  │
│  │  • WebDAV file storage                                    │  │
│  │  • Version history                                        │  │
│  │  • Public share links                                     │  │
│  │  • Full-text search                                       │  │
│  │  • Online editing (Collabora/OnlyOffice)                  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

```sql
-- In bheem-core database, dms schema

CREATE SCHEMA IF NOT EXISTS dms;

-- =====================================================
-- 1. DOCUMENTS TABLE
-- =====================================================
CREATE TABLE dms.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id),

    -- File Info
    filename VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    mime_type VARCHAR(100),
    file_size BIGINT,
    file_extension VARCHAR(20),

    -- Storage Location
    storage_path VARCHAR(500) NOT NULL,  -- Path in Nextcloud
    nextcloud_file_id VARCHAR(100),

    -- Entity Linking (Polymorphic)
    entity_type VARCHAR(50) NOT NULL,  -- employee, customer, project, invoice, etc.
    entity_id UUID NOT NULL,

    -- Metadata
    description TEXT,
    tags JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',

    -- Versioning
    version INTEGER DEFAULT 1,
    parent_document_id UUID REFERENCES dms.documents(id),

    -- Status
    is_archived BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT FALSE,

    -- Share Info
    share_url VARCHAR(500),
    share_token VARCHAR(100),
    share_expires_at TIMESTAMP,

    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_documents_company ON dms.documents(company_id);
CREATE INDEX idx_documents_entity ON dms.documents(entity_type, entity_id);
CREATE INDEX idx_documents_filename ON dms.documents(filename);
CREATE INDEX idx_documents_tags ON dms.documents USING GIN(tags);

-- =====================================================
-- 2. DOCUMENT FOLDERS TABLE
-- =====================================================
CREATE TABLE dms.folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id),

    name VARCHAR(255) NOT NULL,
    path VARCHAR(500) NOT NULL,
    parent_id UUID REFERENCES dms.folders(id),

    -- Entity Linking (Optional)
    entity_type VARCHAR(50),
    entity_id UUID,

    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_folders_company ON dms.folders(company_id);
CREATE INDEX idx_folders_path ON dms.folders(path);

-- =====================================================
-- 3. DOCUMENT ACCESS LOG
-- =====================================================
CREATE TABLE dms.document_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES dms.documents(id),
    user_id UUID REFERENCES auth.users(id),

    action VARCHAR(50) NOT NULL,  -- view, download, edit, share
    ip_address INET,
    user_agent VARCHAR(500),

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_doc_access_document ON dms.document_access_log(document_id);
CREATE INDEX idx_doc_access_created ON dms.document_access_log(created_at);
```

---

## Core DMS Service

```python
# /root/bheem-core/apps/backend/app/modules/dms/core/services/document_service.py

import httpx
import os
from typing import Optional, List, Dict, Any, BinaryIO
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from uuid import UUID
import uuid
import mimetypes

class DocumentService:
    def __init__(self):
        self.workspace_url = os.getenv("WORKSPACE_URL", "https://workspace.bheem.cloud")
        self.nextcloud_url = os.getenv("NEXTCLOUD_URL", "https://docs.bheem.cloud")

    async def upload_document(
        self,
        db: AsyncSession,
        file: BinaryIO,
        filename: str,
        entity_type: str,
        entity_id: UUID,
        company_id: UUID,
        user_id: UUID,
        nc_credentials: Dict[str, str],
        description: str = None,
        tags: List[str] = None
    ) -> Dict[str, Any]:
        """
        Upload document and link to entity

        Args:
            db: Database session
            file: File content
            filename: Original filename
            entity_type: Type of entity (employee, customer, project, etc.)
            entity_id: ID of the entity
            company_id: Company ID
            user_id: Uploading user ID
            nc_credentials: Nextcloud credentials (username, password)
            description: Optional description
            tags: Optional tags
        """
        # Determine storage path based on entity type
        storage_path = self._get_storage_path(entity_type, entity_id, filename)

        # Upload to Nextcloud via Workspace API
        file_content = file.read()

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.workspace_url}/api/v1/docs/upload",
                files={"file": (filename, file_content)},
                data={
                    "path": storage_path,
                    "nc_user": nc_credentials["username"],
                    "nc_pass": nc_credentials["password"]
                }
            )

            if response.status_code != 200:
                raise Exception(f"Upload failed: {response.text}")

            upload_result = response.json()

        # Get mime type
        mime_type, _ = mimetypes.guess_type(filename)
        file_extension = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''

        # Create database record
        document = Document(
            company_id=company_id,
            filename=filename,
            display_name=filename,
            mime_type=mime_type,
            file_size=len(file_content),
            file_extension=file_extension,
            storage_path=storage_path,
            nextcloud_file_id=upload_result.get("file_id"),
            entity_type=entity_type,
            entity_id=entity_id,
            description=description,
            tags=tags or [],
            created_by=user_id
        )

        db.add(document)
        await db.commit()
        await db.refresh(document)

        return {
            "id": str(document.id),
            "filename": document.filename,
            "storage_path": storage_path,
            "file_size": document.file_size,
            "mime_type": document.mime_type
        }

    def _get_storage_path(
        self,
        entity_type: str,
        entity_id: UUID,
        filename: str
    ) -> str:
        """Generate storage path based on entity type"""
        paths = {
            "employee": f"/HR/Employees/{entity_id}/{filename}",
            "customer": f"/Sales/Customers/{entity_id}/{filename}",
            "vendor": f"/Purchase/Vendors/{entity_id}/{filename}",
            "project": f"/Projects/{entity_id}/Documents/{filename}",
            "invoice": f"/Accounting/Invoices/{entity_id}/{filename}",
            "purchase_order": f"/Purchase/Orders/{entity_id}/{filename}",
            "sales_order": f"/Sales/Orders/{entity_id}/{filename}",
            "contract": f"/Legal/Contracts/{entity_id}/{filename}",
            "product": f"/Inventory/Products/{entity_id}/{filename}"
        }
        return paths.get(entity_type, f"/Documents/{entity_type}/{entity_id}/{filename}")

    async def get_entity_documents(
        self,
        db: AsyncSession,
        entity_type: str,
        entity_id: UUID,
        include_archived: bool = False
    ) -> List[Dict[str, Any]]:
        """Get all documents for an entity"""
        query = select(Document).where(
            Document.entity_type == entity_type,
            Document.entity_id == entity_id
        )

        if not include_archived:
            query = query.where(Document.is_archived == False)

        query = query.order_by(Document.created_at.desc())

        result = await db.execute(query)
        documents = result.scalars().all()

        return [
            {
                "id": str(d.id),
                "filename": d.filename,
                "display_name": d.display_name,
                "mime_type": d.mime_type,
                "file_size": d.file_size,
                "description": d.description,
                "tags": d.tags,
                "version": d.version,
                "share_url": d.share_url,
                "created_at": d.created_at.isoformat(),
                "created_by": str(d.created_by)
            }
            for d in documents
        ]

    async def download_document(
        self,
        db: AsyncSession,
        document_id: UUID,
        user_id: UUID,
        nc_credentials: Dict[str, str]
    ) -> tuple:
        """Download document content"""
        result = await db.execute(
            select(Document).where(Document.id == document_id)
        )
        document = result.scalar()

        if not document:
            raise Exception("Document not found")

        # Log access
        access_log = DocumentAccessLog(
            document_id=document_id,
            user_id=user_id,
            action="download"
        )
        db.add(access_log)
        await db.commit()

        # Download from Nextcloud
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.workspace_url}/api/v1/docs/download",
                params={
                    "path": document.storage_path,
                    "nc_user": nc_credentials["username"],
                    "nc_pass": nc_credentials["password"]
                }
            )

            if response.status_code != 200:
                raise Exception(f"Download failed: {response.text}")

            return response.content, document.filename, document.mime_type

    async def create_share_link(
        self,
        db: AsyncSession,
        document_id: UUID,
        user_id: UUID,
        nc_credentials: Dict[str, str],
        expires_days: int = 7
    ) -> str:
        """Create public share link for document"""
        result = await db.execute(
            select(Document).where(Document.id == document_id)
        )
        document = result.scalar()

        if not document:
            raise Exception("Document not found")

        # Create share via Workspace API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.workspace_url}/api/v1/docs/share",
                json={
                    "path": document.storage_path,
                    "expires_days": expires_days
                },
                params={
                    "nc_user": nc_credentials["username"],
                    "nc_pass": nc_credentials["password"]
                }
            )

            if response.status_code != 200:
                raise Exception(f"Share creation failed: {response.text}")

            share_data = response.json()

        # Update document record
        document.share_url = share_data["share_url"]
        document.share_token = share_data.get("token")
        document.share_expires_at = datetime.utcnow() + timedelta(days=expires_days)
        document.is_public = True

        await db.commit()

        return document.share_url

    async def search_documents(
        self,
        db: AsyncSession,
        company_id: UUID,
        query: str,
        entity_type: str = None,
        tags: List[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Search documents by filename, description, or tags"""
        search_query = select(Document).where(
            Document.company_id == company_id,
            Document.is_archived == False
        )

        if query:
            search_query = search_query.where(
                Document.filename.ilike(f"%{query}%") |
                Document.description.ilike(f"%{query}%") |
                Document.display_name.ilike(f"%{query}%")
            )

        if entity_type:
            search_query = search_query.where(Document.entity_type == entity_type)

        if tags:
            search_query = search_query.where(
                Document.tags.contains(tags)
            )

        search_query = search_query.limit(limit)

        result = await db.execute(search_query)
        return [d.__dict__ for d in result.scalars().all()]

    async def delete_document(
        self,
        db: AsyncSession,
        document_id: UUID,
        user_id: UUID,
        nc_credentials: Dict[str, str],
        hard_delete: bool = False
    ) -> bool:
        """Delete or archive a document"""
        result = await db.execute(
            select(Document).where(Document.id == document_id)
        )
        document = result.scalar()

        if not document:
            raise Exception("Document not found")

        if hard_delete:
            # Delete from Nextcloud
            async with httpx.AsyncClient() as client:
                await client.delete(
                    f"{self.workspace_url}/api/v1/docs/files",
                    params={
                        "path": document.storage_path,
                        "nc_user": nc_credentials["username"],
                        "nc_pass": nc_credentials["password"]
                    }
                )

            await db.delete(document)
        else:
            # Soft delete (archive)
            document.is_archived = True
            document.updated_at = datetime.utcnow()

        await db.commit()
        return True

document_service = DocumentService()
```

---

## Module Integration Examples

### HR Module - Employee Documents

```python
# /root/bheem-core/apps/backend/app/modules/hr/routes/employee_routes.py

from fastapi import APIRouter, UploadFile, File, Depends
from uuid import UUID
from modules.dms.core.services.document_service import document_service

router = APIRouter()

@router.post("/employees/{employee_id}/documents")
async def upload_employee_document(
    employee_id: UUID,
    file: UploadFile = File(...),
    description: str = None,
    document_type: str = "general",  # contract, id_proof, certificate, etc.
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload document for an employee

    Document types:
    - contract: Employment contract
    - id_proof: ID card, passport
    - certificate: Degree, certification
    - general: Other documents
    """
    result = await document_service.upload_document(
        db=db,
        file=file.file,
        filename=file.filename,
        entity_type="employee",
        entity_id=employee_id,
        company_id=UUID(current_user["company_id"]),
        user_id=UUID(current_user["id"]),
        nc_credentials={
            "username": current_user["nc_user"],
            "password": current_user["nc_pass"]
        },
        description=description,
        tags=[document_type]
    )

    return result

@router.get("/employees/{employee_id}/documents")
async def get_employee_documents(
    employee_id: UUID,
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get all documents for an employee"""
    return await document_service.get_entity_documents(
        db=db,
        entity_type="employee",
        entity_id=employee_id
    )
```

### Sales Module - Customer Documents

```python
# /root/bheem-core/apps/backend/app/modules/sales/routes/customer_routes.py

@router.post("/customers/{customer_id}/documents")
async def upload_customer_document(
    customer_id: UUID,
    file: UploadFile = File(...),
    description: str = None,
    document_type: str = "general",
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Upload document for a customer (contracts, quotes, etc.)"""
    return await document_service.upload_document(
        db=db,
        file=file.file,
        filename=file.filename,
        entity_type="customer",
        entity_id=customer_id,
        company_id=UUID(current_user["company_id"]),
        user_id=UUID(current_user["id"]),
        nc_credentials={
            "username": current_user["nc_user"],
            "password": current_user["nc_pass"]
        },
        description=description,
        tags=[document_type]
    )
```

### Project Module - Project Documents

```python
# /root/bheem-core/apps/backend/app/modules/project_management/routes/project_routes.py

@router.post("/projects/{project_id}/documents")
async def upload_project_document(
    project_id: UUID,
    file: UploadFile = File(...),
    description: str = None,
    folder: str = "Documents",  # Documents, Deliverables, Reports
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Upload document for a project"""
    return await document_service.upload_document(
        db=db,
        file=file.file,
        filename=file.filename,
        entity_type="project",
        entity_id=project_id,
        company_id=UUID(current_user["company_id"]),
        user_id=UUID(current_user["id"]),
        nc_credentials={
            "username": current_user["nc_user"],
            "password": current_user["nc_pass"]
        },
        description=description,
        tags=[folder]
    )

@router.get("/projects/{project_id}/documents")
async def get_project_documents(
    project_id: UUID,
    folder: str = None,
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get all documents for a project, optionally filtered by folder"""
    documents = await document_service.get_entity_documents(
        db=db,
        entity_type="project",
        entity_id=project_id
    )

    if folder:
        documents = [d for d in documents if folder in d.get("tags", [])]

    return documents
```

---

## Workspace Docs API Reference

```python
# /root/bheem-workspace/backend/api/docs.py

from fastapi import APIRouter, UploadFile, File, Query
import httpx
import os

router = APIRouter(prefix="/api/v1/docs", tags=["Docs"])

NEXTCLOUD_URL = os.getenv("NEXTCLOUD_URL")

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    path: str = Query(...),
    nc_user: str = Query(...),
    nc_pass: str = Query(...)
):
    """Upload file to Nextcloud via WebDAV"""
    webdav_url = f"{NEXTCLOUD_URL}/remote.php/dav/files/{nc_user}{path}"

    async with httpx.AsyncClient() as client:
        response = await client.put(
            webdav_url,
            content=await file.read(),
            auth=(nc_user, nc_pass),
            headers={"Content-Type": file.content_type}
        )

        if response.status_code in [200, 201, 204]:
            return {
                "success": True,
                "path": path,
                "filename": file.filename
            }

        raise HTTPException(500, f"Upload failed: {response.text}")

@router.get("/files")
async def list_files(
    path: str = Query(...),
    nc_user: str = Query(...),
    nc_pass: str = Query(...)
):
    """List files in a directory"""
    webdav_url = f"{NEXTCLOUD_URL}/remote.php/dav/files/{nc_user}{path}"

    async with httpx.AsyncClient() as client:
        response = await client.request(
            "PROPFIND",
            webdav_url,
            auth=(nc_user, nc_pass),
            headers={"Depth": "1"}
        )

        if response.status_code == 207:
            # Parse WebDAV response
            return parse_webdav_response(response.text)

        raise HTTPException(500, f"List failed: {response.text}")

@router.get("/download")
async def download_file(
    path: str = Query(...),
    nc_user: str = Query(...),
    nc_pass: str = Query(...)
):
    """Download file from Nextcloud"""
    webdav_url = f"{NEXTCLOUD_URL}/remote.php/dav/files/{nc_user}{path}"

    async with httpx.AsyncClient() as client:
        response = await client.get(
            webdav_url,
            auth=(nc_user, nc_pass)
        )

        if response.status_code == 200:
            return Response(
                content=response.content,
                media_type=response.headers.get("Content-Type")
            )

        raise HTTPException(404, "File not found")

@router.post("/share")
async def create_share(
    path: str,
    expires_days: int = 7,
    nc_user: str = Query(...),
    nc_pass: str = Query(...)
):
    """Create public share link"""
    share_api = f"{NEXTCLOUD_URL}/ocs/v2.php/apps/files_sharing/api/v1/shares"

    async with httpx.AsyncClient() as client:
        response = await client.post(
            share_api,
            auth=(nc_user, nc_pass),
            headers={"OCS-APIRequest": "true"},
            data={
                "path": path,
                "shareType": 3,  # Public link
                "expireDate": (datetime.now() + timedelta(days=expires_days)).strftime("%Y-%m-%d")
            }
        )

        if response.status_code == 200:
            data = response.json()
            return {
                "share_url": data["ocs"]["data"]["url"],
                "token": data["ocs"]["data"]["token"]
            }

        raise HTTPException(500, "Share creation failed")

@router.delete("/files")
async def delete_file(
    path: str = Query(...),
    nc_user: str = Query(...),
    nc_pass: str = Query(...)
):
    """Delete file from Nextcloud"""
    webdav_url = f"{NEXTCLOUD_URL}/remote.php/dav/files/{nc_user}{path}"

    async with httpx.AsyncClient() as client:
        response = await client.delete(
            webdav_url,
            auth=(nc_user, nc_pass)
        )

        return {"success": response.status_code in [200, 204]}
```

---

## Environment Variables

```bash
# bheem-core .env
WORKSPACE_URL=https://workspace.bheem.cloud
NEXTCLOUD_URL=https://docs.bheem.cloud

# bheem-workspace .env
NEXTCLOUD_URL=https://docs.bheem.cloud
NEXTCLOUD_ADMIN_USER=admin
NEXTCLOUD_ADMIN_PASS=password
```

---

## Folder Structure in Nextcloud

```
/Nextcloud
├── HR/
│   └── Employees/
│       └── {employee_id}/
│           ├── contract.pdf
│           ├── id_proof.jpg
│           └── certificates/
├── Sales/
│   ├── Customers/
│   │   └── {customer_id}/
│   │       ├── contracts/
│   │       └── quotes/
│   └── Orders/
│       └── {order_id}/
│           └── invoice.pdf
├── Purchase/
│   ├── Vendors/
│   │   └── {vendor_id}/
│   └── Orders/
│       └── {po_id}/
├── Projects/
│   └── {project_id}/
│       ├── Documents/
│       ├── Deliverables/
│       └── Reports/
├── Accounting/
│   └── Invoices/
│       └── {invoice_id}/
└── Legal/
    └── Contracts/
        └── {contract_id}/
```

---

*Document Version: 1.0*
*Last Updated: December 26, 2025*
