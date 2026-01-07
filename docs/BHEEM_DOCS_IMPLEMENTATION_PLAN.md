# Bheem Docs - Complete Implementation Plan

## Executive Summary

This document outlines the complete implementation plan for **Bheem Docs** - a unified document management and collaboration platform serving both:
- **Internal Users**: ERP employees across all Bheemverse subsidiaries (BHM001-BHM009)
- **External Users**: SaaS customers with their own tenants

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [User Types & Access Modes](#2-user-types--access-modes)
3. [Technology Stack](#3-technology-stack)
4. [Database Schema Design](#4-database-schema-design)
5. [Implementation Phases](#5-implementation-phases)
6. [Phase 1: Foundation & Storage](#phase-1-foundation--storage)
7. [Phase 2: Rich Text Editor](#phase-2-rich-text-editor)
8. [Phase 3: Real-time Collaboration](#phase-3-real-time-collaboration)
9. [Phase 4: ERP Integration](#phase-4-erp-integration)
10. [Phase 5: Enterprise Features](#phase-5-enterprise-features)
11. [Phase 6: AI & Smart Features](#phase-6-ai--smart-features)
12. [API Specification](#7-api-specification)
13. [Frontend Components](#8-frontend-components)
14. [Security & Compliance](#9-security--compliance)
15. [Deployment Architecture](#10-deployment-architecture)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              BHEEM DOCS PLATFORM                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│                            ┌─────────────────────┐                              │
│                            │   BHEEM PASSPORT    │                              │
│                            │   (SSO Provider)    │                              │
│                            └──────────┬──────────┘                              │
│                                       │                                          │
│                                       ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         BHEEM DOCS FRONTEND                              │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐  │   │
│  │  │  File     │ │  Rich     │ │  Real-time│ │  Comments │ │  Version  │  │   │
│  │  │  Browser  │ │  Editor   │ │  Collab   │ │  System   │ │  History  │  │   │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                       │                                          │
│                                       ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         BHEEM DOCS BACKEND (FastAPI)                     │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐  │   │
│  │  │  Docs API │ │  Collab   │ │  Storage  │ │  Workflow │ │  AI       │  │   │
│  │  │           │ │  Server   │ │  Service  │ │  Engine   │ │  Service  │  │   │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                       │                                          │
│              ┌────────────────────────┼────────────────────────┐                │
│              │                        │                        │                │
│              ▼                        ▼                        ▼                │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐           │
│  │   PostgreSQL    │     │   Redis/Valkey  │     │   S3/MinIO      │           │
│  │   (Metadata)    │     │   (Real-time)   │     │   (Files)       │           │
│  └─────────────────┘     └─────────────────┘     └─────────────────┘           │
│              │                                                                   │
│              ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         ERP DATABASE (dms schema)                        │   │
│  │  documents | folders | versions | comments | access | workflows          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. User Types & Access Modes

### 2.1 Internal Mode (ERP Users)

| Aspect | Description |
|--------|-------------|
| **Users** | Employees of Bheemverse subsidiaries (BHM001-BHM009) |
| **Authentication** | Bheem Passport SSO with workspace email |
| **Storage** | Shared company storage with quotas |
| **Features** | Full ERP integration, entity linking, workflows |
| **Document Types** | Invoice, PO, Contract, Employee docs, etc. |

### 2.2 External Mode (SaaS Customers)

| Aspect | Description |
|--------|-------------|
| **Users** | External businesses subscribing to Bheem Docs |
| **Authentication** | Bheem Passport or custom OAuth |
| **Storage** | Isolated tenant storage with plan-based quotas |
| **Features** | Collaboration, sharing, templates |
| **Document Types** | General documents, custom types |

### 2.3 Access Level Matrix

| Access Level | View | Download | Edit | Delete | Share | Admin |
|--------------|:----:|:--------:|:----:|:------:|:-----:|:-----:|
| `VIEW` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `DOWNLOAD` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `EDIT` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `DELETE` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `SHARE` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `ADMIN` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 3. Technology Stack

### 3.1 Frontend

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | React 18 + TypeScript | UI Framework |
| State | Zustand | State management |
| Editor | **Tiptap v2** | Rich text editing |
| Collaboration | **Yjs + y-websocket** | Real-time sync (CRDT) |
| File Preview | **react-pdf**, **@react-pdf-viewer** | PDF preview |
| Office Preview | **OnlyOffice** or **Collabora** | Office file preview |
| UI Components | Tailwind CSS + Headless UI | Styling |

### 3.2 Backend

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | FastAPI (Python 3.11+) | REST API |
| WebSocket | FastAPI WebSockets + **y-py** | Real-time collaboration |
| Database | PostgreSQL 15 | Metadata storage |
| Cache | Redis/Valkey | Sessions, real-time state |
| Storage | S3 (MinIO compatible) | File storage |
| Search | PostgreSQL Full-text + **pgvector** | Document search |
| OCR | **Tesseract** or **AWS Textract** | Text extraction |
| AI | **Anthropic Claude** / OpenAI | Summarization, classification |

### 3.3 Infrastructure

| Component | Technology | Purpose |
|-----------|------------|---------|
| Container | Docker + Docker Compose | Containerization |
| Reverse Proxy | Nginx / Traefik | Load balancing, SSL |
| CI/CD | GitHub Actions | Deployment |
| Monitoring | Prometheus + Grafana | Metrics |

---

## 4. Database Schema Design

### 4.1 Using Existing ERP DMS Schema

The ERP database already has a comprehensive DMS schema. We will **extend and connect** to it.

### 4.2 New Tables for Bheem Docs

```sql
-- ============================================
-- WORKSPACE DOCS SCHEMA (workspace.docs_*)
-- ============================================

-- Collaborative document sessions
CREATE TABLE workspace.docs_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES dms.documents(id),
    session_token VARCHAR(255) NOT NULL UNIQUE,
    yjs_state BYTEA,  -- Yjs document state
    active_users JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- Document templates
CREATE TABLE workspace.docs_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    content JSONB NOT NULL,  -- Tiptap JSON content
    thumbnail_url VARCHAR(500),
    is_public BOOLEAN DEFAULT false,
    tenant_id UUID,  -- NULL = global template
    company_id UUID,  -- For internal templates
    usage_count INTEGER DEFAULT 0,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Real-time presence tracking
CREATE TABLE workspace.docs_presence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES dms.documents(id),
    user_id UUID NOT NULL,
    user_name VARCHAR(255),
    user_avatar VARCHAR(500),
    cursor_position JSONB,
    selection JSONB,
    color VARCHAR(7),  -- User cursor color
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_id, user_id)
);

-- Document export history
CREATE TABLE workspace.docs_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES dms.documents(id),
    format VARCHAR(50) NOT NULL,  -- pdf, docx, html, md
    file_path VARCHAR(500),
    file_size INTEGER,
    exported_by UUID NOT NULL,
    exported_at TIMESTAMPTZ DEFAULT NOW()
);

-- External tenant configuration (for SaaS mode)
CREATE TABLE workspace.docs_tenant_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE,
    storage_provider VARCHAR(50) DEFAULT 's3',  -- s3, azure, gcs
    storage_bucket VARCHAR(255),
    storage_prefix VARCHAR(255),
    max_storage_bytes BIGINT DEFAULT 10737418240,  -- 10GB
    max_documents INTEGER DEFAULT 10000,
    features_enabled JSONB DEFAULT '{"collaboration": true, "ai": false}',
    branding JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_docs_sessions_document ON workspace.docs_sessions(document_id);
CREATE INDEX idx_docs_sessions_token ON workspace.docs_sessions(session_token);
CREATE INDEX idx_docs_presence_document ON workspace.docs_presence(document_id);
CREATE INDEX idx_docs_templates_tenant ON workspace.docs_templates(tenant_id);
CREATE INDEX idx_docs_templates_company ON workspace.docs_templates(company_id);
```

### 4.3 ERP DMS Schema Extensions

```sql
-- Add Tiptap content storage to documents
ALTER TABLE dms.documents ADD COLUMN IF NOT EXISTS
    editor_content JSONB;  -- Tiptap JSON format

ALTER TABLE dms.documents ADD COLUMN IF NOT EXISTS
    editor_content_html TEXT;  -- Rendered HTML for search

ALTER TABLE dms.documents ADD COLUMN IF NOT EXISTS
    is_editable BOOLEAN DEFAULT false;  -- Can be edited in Bheem Docs

ALTER TABLE dms.documents ADD COLUMN IF NOT EXISTS
    last_edited_by UUID;

ALTER TABLE dms.documents ADD COLUMN IF NOT EXISTS
    last_edited_at TIMESTAMPTZ;

-- Add tenant support for external users
ALTER TABLE dms.documents ADD COLUMN IF NOT EXISTS
    tenant_id UUID;  -- NULL = internal (ERP)

ALTER TABLE dms.folders ADD COLUMN IF NOT EXISTS
    tenant_id UUID;  -- NULL = internal (ERP)

-- Update search vector to include editor content
CREATE OR REPLACE FUNCTION dms.update_document_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.editor_content_html, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(NEW.ocr_text, '')), 'D');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_document_search_vector
    BEFORE INSERT OR UPDATE ON dms.documents
    FOR EACH ROW
    EXECUTE FUNCTION dms.update_document_search_vector();
```

---

## 5. Implementation Phases

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                        IMPLEMENTATION TIMELINE                                  │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Phase 1          Phase 2          Phase 3          Phase 4          Phase 5   │
│  Foundation       Rich Editor      Collaboration    ERP Integration  Enterprise│
│  ───────────      ───────────      ─────────────    ───────────────  ──────────│
│  Week 1-3         Week 4-7         Week 8-11        Week 12-15       Week 16-20│
│                                                                                 │
│  ┌─────────┐     ┌─────────┐      ┌─────────┐      ┌─────────┐     ┌─────────┐│
│  │ Storage │     │ Tiptap  │      │ Yjs     │      │ Entity  │     │Workflows││
│  │ Service │     │ Editor  │      │ Collab  │      │ Linking │     │Approvals││
│  │         │     │         │      │         │      │         │     │         ││
│  │ File    │     │ Preview │      │ Presence│      │ Doc     │     │ Audit   ││
│  │ Browser │     │         │      │         │      │ Types   │     │ Logs    ││
│  │         │     │ Export  │      │ Comments│      │         │     │         ││
│  │ Folders │     │         │      │         │      │ Search  │     │ AI      ││
│  └─────────┘     └─────────┘      └─────────┘      └─────────┘     └─────────┘│
│                                                                                 │
│                              Phase 6: AI & Smart Features (Week 21-24)         │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Foundation & Storage

### Duration: Weeks 1-3

### 1.1 Objectives
- [x] Migrate from Nextcloud to unified storage service
- [ ] Implement file browser with ERP DMS schema
- [ ] Set up S3-compatible storage (MinIO)
- [ ] Create folder management system
- [ ] Implement file upload with chunking
- [ ] Add file preview capabilities

### 1.2 Backend Implementation

#### 1.2.1 Storage Service (`backend/services/docs_storage_service.py`)

```python
"""
Bheem Docs - Unified Storage Service
Handles file storage for both internal (ERP) and external (SaaS) users
"""
import boto3
from botocore.config import Config
from typing import Optional, BinaryIO, List
from uuid import UUID
import hashlib
from datetime import datetime, timedelta

from core.config import settings


class DocsStorageService:
    """Unified storage service using S3-compatible backend"""

    def __init__(self):
        self.s3_client = boto3.client(
            's3',
            endpoint_url=settings.S3_ENDPOINT,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            config=Config(signature_version='s3v4'),
            region_name=settings.S3_REGION
        )
        self.bucket = settings.S3_BUCKET

    def get_storage_path(
        self,
        company_id: Optional[UUID] = None,
        tenant_id: Optional[UUID] = None,
        folder_path: str = "/"
    ) -> str:
        """Generate storage path based on internal/external mode"""
        if company_id:
            # Internal mode - ERP company storage
            return f"internal/{company_id}{folder_path}"
        elif tenant_id:
            # External mode - SaaS tenant storage
            return f"external/{tenant_id}{folder_path}"
        else:
            raise ValueError("Either company_id or tenant_id required")

    async def upload_file(
        self,
        file: BinaryIO,
        filename: str,
        company_id: Optional[UUID] = None,
        tenant_id: Optional[UUID] = None,
        folder_path: str = "/",
        content_type: str = "application/octet-stream"
    ) -> dict:
        """Upload file to storage"""
        storage_path = self.get_storage_path(company_id, tenant_id, folder_path)
        key = f"{storage_path}/{filename}"

        # Calculate checksum
        file_content = file.read()
        checksum = hashlib.sha256(file_content).hexdigest()
        file.seek(0)

        # Upload to S3
        self.s3_client.upload_fileobj(
            file,
            self.bucket,
            key,
            ExtraArgs={
                'ContentType': content_type,
                'Metadata': {
                    'checksum': checksum,
                    'uploaded_at': datetime.utcnow().isoformat()
                }
            }
        )

        return {
            'storage_path': key,
            'storage_bucket': self.bucket,
            'checksum': checksum,
            'file_size': len(file_content)
        }

    async def download_file(self, storage_path: str) -> BinaryIO:
        """Download file from storage"""
        response = self.s3_client.get_object(
            Bucket=self.bucket,
            Key=storage_path
        )
        return response['Body']

    async def delete_file(self, storage_path: str) -> bool:
        """Delete file from storage"""
        self.s3_client.delete_object(
            Bucket=self.bucket,
            Key=storage_path
        )
        return True

    async def generate_presigned_url(
        self,
        storage_path: str,
        expires_in: int = 3600,
        operation: str = 'get_object'
    ) -> str:
        """Generate presigned URL for direct access"""
        return self.s3_client.generate_presigned_url(
            operation,
            Params={'Bucket': self.bucket, 'Key': storage_path},
            ExpiresIn=expires_in
        )

    async def get_storage_usage(
        self,
        company_id: Optional[UUID] = None,
        tenant_id: Optional[UUID] = None
    ) -> dict:
        """Calculate storage usage for company/tenant"""
        prefix = self.get_storage_path(company_id, tenant_id, "/")

        total_size = 0
        total_objects = 0

        paginator = self.s3_client.get_paginator('list_objects_v2')
        for page in paginator.paginate(Bucket=self.bucket, Prefix=prefix):
            for obj in page.get('Contents', []):
                total_size += obj['Size']
                total_objects += 1

        return {
            'used_bytes': total_size,
            'object_count': total_objects
        }
```

#### 1.2.2 Document Service (`backend/services/docs_document_service.py`)

```python
"""
Bheem Docs - Document Service
Handles document CRUD operations using ERP DMS schema
"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import mimetypes

from services.docs_storage_service import DocsStorageService


class DocsDocumentService:
    """Document management service integrated with ERP DMS"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.storage = DocsStorageService()

    async def create_document(
        self,
        title: str,
        file,
        filename: str,
        folder_id: Optional[UUID] = None,
        company_id: Optional[UUID] = None,
        tenant_id: Optional[UUID] = None,
        document_type: str = "OTHER",
        description: str = None,
        created_by: UUID = None,
        entity_type: str = None,
        entity_id: UUID = None
    ) -> dict:
        """Create new document with file upload"""

        # Get mime type and extension
        mime_type, _ = mimetypes.guess_type(filename)
        mime_type = mime_type or "application/octet-stream"
        extension = filename.rsplit('.', 1)[-1] if '.' in filename else ''

        # Get folder path
        folder_path = "/"
        if folder_id:
            folder_result = await self.db.execute(
                text("SELECT path FROM dms.folders WHERE id = :id"),
                {"id": str(folder_id)}
            )
            folder_row = folder_result.fetchone()
            if folder_row:
                folder_path = folder_row[0]

        # Upload file to storage
        storage_result = await self.storage.upload_file(
            file=file,
            filename=filename,
            company_id=company_id,
            tenant_id=tenant_id,
            folder_path=folder_path,
            content_type=mime_type
        )

        # Determine if editable in Bheem Docs
        editable_types = ['text/plain', 'text/markdown', 'text/html', 'application/json']
        is_editable = mime_type in editable_types or extension in ['md', 'txt', 'html', 'json']

        # Insert into DMS
        query = text("""
            INSERT INTO dms.documents (
                title, description, document_type, file_name, file_extension,
                file_size, mime_type, storage_path, storage_bucket,
                folder_id, company_id, tenant_id, entity_type, entity_id,
                is_editable, checksum, current_version, version_count,
                created_by, created_at, updated_at, is_active
            ) VALUES (
                :title, :description, :document_type::dms.documenttype,
                :file_name, :file_extension, :file_size, :mime_type,
                :storage_path, :storage_bucket, :folder_id,
                :company_id, :tenant_id, :entity_type::dms.entitytype, :entity_id,
                :is_editable, :checksum, 1, 1,
                :created_by, NOW(), NOW(), true
            )
            RETURNING id, title, file_name, storage_path, created_at
        """)

        result = await self.db.execute(query, {
            'title': title,
            'description': description,
            'document_type': document_type,
            'file_name': filename,
            'file_extension': extension,
            'file_size': storage_result['file_size'],
            'mime_type': mime_type,
            'storage_path': storage_result['storage_path'],
            'storage_bucket': storage_result['storage_bucket'],
            'folder_id': str(folder_id) if folder_id else None,
            'company_id': str(company_id) if company_id else None,
            'tenant_id': str(tenant_id) if tenant_id else None,
            'entity_type': entity_type,
            'entity_id': str(entity_id) if entity_id else None,
            'is_editable': is_editable,
            'checksum': storage_result['checksum'],
            'created_by': str(created_by)
        })

        await self.db.commit()
        row = result.fetchone()

        # Create initial version
        await self._create_version(
            document_id=row[0],
            version_number=1,
            filename=filename,
            file_size=storage_result['file_size'],
            mime_type=mime_type,
            storage_path=storage_result['storage_path'],
            checksum=storage_result['checksum'],
            uploaded_by=created_by
        )

        # Log audit
        await self._log_audit(
            document_id=row[0],
            action='UPLOAD',
            user_id=created_by
        )

        return {
            'id': str(row[0]),
            'title': row[1],
            'file_name': row[2],
            'storage_path': row[3],
            'created_at': row[4].isoformat()
        }

    async def list_documents(
        self,
        folder_id: Optional[UUID] = None,
        company_id: Optional[UUID] = None,
        tenant_id: Optional[UUID] = None,
        entity_type: str = None,
        entity_id: UUID = None,
        search: str = None,
        document_type: str = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[dict]:
        """List documents with filtering"""

        conditions = ["d.is_active = true", "d.deleted_at IS NULL"]
        params = {'limit': limit, 'offset': offset}

        if folder_id:
            conditions.append("d.folder_id = :folder_id")
            params['folder_id'] = str(folder_id)
        else:
            conditions.append("d.folder_id IS NULL")

        if company_id:
            conditions.append("d.company_id = :company_id")
            params['company_id'] = str(company_id)

        if tenant_id:
            conditions.append("d.tenant_id = :tenant_id")
            params['tenant_id'] = str(tenant_id)

        if entity_type and entity_id:
            conditions.append("d.entity_type = :entity_type::dms.entitytype")
            conditions.append("d.entity_id = :entity_id")
            params['entity_type'] = entity_type
            params['entity_id'] = str(entity_id)

        if search:
            conditions.append("d.search_vector @@ plainto_tsquery('english', :search)")
            params['search'] = search

        if document_type:
            conditions.append("d.document_type = :document_type::dms.documenttype")
            params['document_type'] = document_type

        where_clause = " AND ".join(conditions)

        query = text(f"""
            SELECT
                d.id, d.title, d.description, d.document_type,
                d.file_name, d.file_extension, d.file_size, d.mime_type,
                d.storage_path, d.current_version, d.is_editable,
                d.created_at, d.updated_at,
                u.email as created_by_email
            FROM dms.documents d
            LEFT JOIN auth.users u ON d.created_by = u.id
            WHERE {where_clause}
            ORDER BY d.updated_at DESC
            LIMIT :limit OFFSET :offset
        """)

        result = await self.db.execute(query, params)
        rows = result.fetchall()

        return [
            {
                'id': str(row[0]),
                'title': row[1],
                'description': row[2],
                'document_type': row[3],
                'file_name': row[4],
                'file_extension': row[5],
                'file_size': row[6],
                'mime_type': row[7],
                'storage_path': row[8],
                'current_version': row[9],
                'is_editable': row[10],
                'created_at': row[11].isoformat() if row[11] else None,
                'updated_at': row[12].isoformat() if row[12] else None,
                'created_by_email': row[13]
            }
            for row in rows
        ]

    async def get_document(self, document_id: UUID) -> Optional[dict]:
        """Get document by ID with full details"""
        query = text("""
            SELECT
                d.*,
                f.name as folder_name,
                f.path as folder_path,
                u.email as created_by_email
            FROM dms.documents d
            LEFT JOIN dms.folders f ON d.folder_id = f.id
            LEFT JOIN auth.users u ON d.created_by = u.id
            WHERE d.id = :id AND d.is_active = true
        """)

        result = await self.db.execute(query, {'id': str(document_id)})
        row = result.fetchone()

        if not row:
            return None

        return dict(row._mapping)

    async def update_document_content(
        self,
        document_id: UUID,
        editor_content: dict,
        editor_content_html: str,
        updated_by: UUID
    ) -> bool:
        """Update editable document content (Tiptap JSON)"""
        query = text("""
            UPDATE dms.documents SET
                editor_content = :editor_content,
                editor_content_html = :editor_content_html,
                last_edited_by = :updated_by,
                last_edited_at = NOW(),
                updated_at = NOW(),
                updated_by = :updated_by
            WHERE id = :id AND is_editable = true
        """)

        await self.db.execute(query, {
            'id': str(document_id),
            'editor_content': editor_content,
            'editor_content_html': editor_content_html,
            'updated_by': str(updated_by)
        })
        await self.db.commit()

        await self._log_audit(document_id, 'UPDATE', updated_by)
        return True

    async def _create_version(
        self,
        document_id: UUID,
        version_number: int,
        filename: str,
        file_size: int,
        mime_type: str,
        storage_path: str,
        checksum: str,
        uploaded_by: UUID,
        change_notes: str = None
    ):
        """Create document version record"""
        query = text("""
            INSERT INTO dms.document_versions (
                document_id, version_number, file_name, file_size,
                mime_type, storage_path, checksum, change_notes,
                is_current, uploaded_by, created_at
            ) VALUES (
                :document_id, :version_number, :file_name, :file_size,
                :mime_type, :storage_path, :checksum, :change_notes,
                true, :uploaded_by, NOW()
            )
        """)

        # Mark previous versions as not current
        await self.db.execute(
            text("UPDATE dms.document_versions SET is_current = false WHERE document_id = :id"),
            {'id': str(document_id)}
        )

        await self.db.execute(query, {
            'document_id': str(document_id),
            'version_number': version_number,
            'file_name': filename,
            'file_size': file_size,
            'mime_type': mime_type,
            'storage_path': storage_path,
            'checksum': checksum,
            'change_notes': change_notes,
            'uploaded_by': str(uploaded_by)
        })
        await self.db.commit()

    async def _log_audit(
        self,
        document_id: UUID,
        action: str,
        user_id: UUID,
        details: dict = None
    ):
        """Log document action to audit log"""
        query = text("""
            INSERT INTO dms.document_audit_logs (
                document_id, action, action_details, user_id, timestamp
            ) VALUES (
                :document_id, :action::dms.auditaction, :details, :user_id, NOW()
            )
        """)

        await self.db.execute(query, {
            'document_id': str(document_id),
            'action': action,
            'details': details or {},
            'user_id': str(user_id)
        })
        await self.db.commit()
```

### 1.3 Frontend Implementation

#### 1.3.1 Updated File Browser (`frontend/src/pages/docs/index.tsx`)

```tsx
// Key changes for Phase 1:
// 1. Connect to new backend API (not Nextcloud)
// 2. Add file preview modal
// 3. Support document types
// 4. Add entity context awareness

import { useState, useEffect } from 'react';
import { useDocsStore } from '@/stores/docsStore';
import { FileGrid } from '@/components/docs/FileGrid';
import { FilePreview } from '@/components/docs/FilePreview';
import { UploadModal } from '@/components/docs/UploadModal';
import { FolderTree } from '@/components/docs/FolderTree';

interface DocsPageProps {
  // For ERP integration - pass entity context
  entityType?: string;
  entityId?: string;
  companyId?: string;
  tenantId?: string;
}

export default function DocsPage({
  entityType,
  entityId,
  companyId,
  tenantId
}: DocsPageProps) {
  const {
    files,
    folders,
    currentFolder,
    loading,
    fetchFiles,
    uploadFile,
    deleteFile,
    createFolder
  } = useDocsStore();

  const [previewFile, setPreviewFile] = useState(null);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    fetchFiles({
      folderId: currentFolder?.id,
      entityType,
      entityId,
      companyId,
      tenantId
    });
  }, [currentFolder, entityType, entityId]);

  return (
    <div className="flex h-full">
      {/* Folder sidebar */}
      <div className="w-64 border-r bg-gray-50 p-4">
        <FolderTree
          folders={folders}
          currentFolder={currentFolder}
          onSelect={(folder) => setCurrentFolder(folder)}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 p-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Documents</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowUpload(true)}
              className="btn btn-primary"
            >
              Upload
            </button>
            <button
              onClick={() => createFolder()}
              className="btn btn-secondary"
            >
              New Folder
            </button>
          </div>
        </div>

        {/* File grid */}
        <FileGrid
          files={files}
          onPreview={setPreviewFile}
          onDelete={deleteFile}
        />
      </div>

      {/* Preview modal */}
      {previewFile && (
        <FilePreview
          file={previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}

      {/* Upload modal */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUpload={uploadFile}
          entityType={entityType}
          entityId={entityId}
        />
      )}
    </div>
  );
}
```

### 1.4 Phase 1 Deliverables

- [ ] `backend/services/docs_storage_service.py` - S3 storage service
- [ ] `backend/services/docs_document_service.py` - Document CRUD
- [ ] `backend/services/docs_folder_service.py` - Folder management
- [ ] `backend/api/docs_v2.py` - New docs API endpoints
- [ ] `frontend/src/pages/docs/index.tsx` - Updated file browser
- [ ] `frontend/src/components/docs/FilePreview.tsx` - File preview component
- [ ] `frontend/src/components/docs/FolderTree.tsx` - Folder navigation
- [ ] Database migrations for schema extensions

---

## Phase 2: Rich Text Editor

### Duration: Weeks 4-7

### 2.1 Objectives
- [ ] Integrate Tiptap v2 rich text editor
- [ ] Support multiple document formats (text, markdown, rich text)
- [ ] Implement auto-save functionality
- [ ] Add export capabilities (PDF, DOCX, HTML)
- [ ] Create document templates system

### 2.2 Tiptap Editor Setup

#### 2.2.1 Install Dependencies

```bash
# Frontend
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-collaboration \
  @tiptap/extension-collaboration-cursor @tiptap/extension-placeholder \
  @tiptap/extension-table @tiptap/extension-image @tiptap/extension-link \
  @tiptap/extension-highlight @tiptap/extension-task-list @tiptap/extension-task-item \
  @tiptap/extension-character-count @tiptap/extension-typography \
  @tiptap/extension-mention yjs y-websocket y-indexeddb
```

#### 2.2.2 Editor Component (`frontend/src/components/docs/Editor.tsx`)

```tsx
import { useEditor, EditorContent, BubbleMenu, FloatingMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import Placeholder from '@tiptap/extension-placeholder';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CharacterCount from '@tiptap/extension-character-count';
import Typography from '@tiptap/extension-typography';
import Mention from '@tiptap/extension-mention';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';
import { useEffect, useState, useCallback } from 'react';

import { EditorToolbar } from './EditorToolbar';
import { EditorBubbleMenu } from './EditorBubbleMenu';
import { MentionList } from './MentionList';

interface EditorProps {
  documentId: string;
  initialContent?: any;
  readOnly?: boolean;
  collaborationEnabled?: boolean;
  websocketUrl?: string;
  currentUser: {
    id: string;
    name: string;
    color: string;
    avatar?: string;
  };
  onSave?: (content: any, html: string) => void;
  onUsersChange?: (users: any[]) => void;
}

export function Editor({
  documentId,
  initialContent,
  readOnly = false,
  collaborationEnabled = true,
  websocketUrl = 'wss://workspace.bheem.cloud/docs/collab',
  currentUser,
  onSave,
  onUsersChange
}: EditorProps) {
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Initialize Yjs document for collaboration
  useEffect(() => {
    if (!collaborationEnabled) return;

    const doc = new Y.Doc();
    setYdoc(doc);

    // IndexedDB for offline persistence
    const indexeddbProvider = new IndexeddbPersistence(documentId, doc);

    // WebSocket for real-time sync
    const wsProvider = new WebsocketProvider(
      websocketUrl,
      documentId,
      doc,
      { params: { token: localStorage.getItem('token') } }
    );

    wsProvider.on('status', (event: any) => {
      console.log('Collaboration status:', event.status);
    });

    setProvider(wsProvider);

    return () => {
      wsProvider.destroy();
      indexeddbProvider.destroy();
      doc.destroy();
    };
  }, [documentId, collaborationEnabled, websocketUrl]);

  // Build extensions array
  const extensions = [
    StarterKit.configure({
      history: collaborationEnabled ? false : undefined, // Disable if using Yjs
    }),
    Placeholder.configure({
      placeholder: 'Start writing...',
    }),
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    Image.configure({
      HTMLAttributes: { class: 'rounded-lg max-w-full' },
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { class: 'text-blue-600 underline' },
    }),
    Highlight.configure({ multicolor: true }),
    TaskList,
    TaskItem.configure({ nested: true }),
    CharacterCount,
    Typography,
    Mention.configure({
      HTMLAttributes: { class: 'mention bg-blue-100 rounded px-1' },
      suggestion: {
        items: ({ query }) => {
          // Fetch users for mentions
          return fetchMentionSuggestions(query);
        },
        render: () => {
          let component: any;
          return {
            onStart: (props: any) => {
              component = new MentionList({ ...props });
            },
            onUpdate: (props: any) => component?.updateProps(props),
            onKeyDown: (props: any) => component?.onKeyDown(props),
            onExit: () => component?.destroy(),
          };
        },
      },
    }),
  ];

  // Add collaboration extensions if enabled
  if (collaborationEnabled && ydoc) {
    extensions.push(
      Collaboration.configure({
        document: ydoc,
      }),
      CollaborationCursor.configure({
        provider: provider!,
        user: currentUser,
      })
    );
  }

  const editor = useEditor({
    extensions,
    content: initialContent,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      // Debounced auto-save
      debouncedSave(editor.getJSON(), editor.getHTML());
    },
  });

  // Auto-save with debounce
  const debouncedSave = useCallback(
    debounce(async (json: any, html: string) => {
      if (onSave && !readOnly) {
        setIsSaving(true);
        try {
          await onSave(json, html);
          setLastSaved(new Date());
        } finally {
          setIsSaving(false);
        }
      }
    }, 2000),
    [onSave, readOnly]
  );

  // Track active users
  useEffect(() => {
    if (!provider || !onUsersChange) return;

    const awareness = provider.awareness;

    const updateUsers = () => {
      const users = Array.from(awareness.getStates().values())
        .filter((state: any) => state.user)
        .map((state: any) => state.user);
      onUsersChange(users);
    };

    awareness.on('change', updateUsers);
    return () => awareness.off('change', updateUsers);
  }, [provider, onUsersChange]);

  if (!editor) return <div>Loading editor...</div>;

  return (
    <div className="editor-container">
      {/* Toolbar */}
      {!readOnly && (
        <EditorToolbar
          editor={editor}
          isSaving={isSaving}
          lastSaved={lastSaved}
        />
      )}

      {/* Bubble menu for text selection */}
      {!readOnly && (
        <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
          <EditorBubbleMenu editor={editor} />
        </BubbleMenu>
      )}

      {/* Editor content */}
      <div className="prose prose-lg max-w-none p-8 min-h-[500px] bg-white">
        <EditorContent editor={editor} />
      </div>

      {/* Character count */}
      <div className="text-sm text-gray-500 p-2 border-t">
        {editor.storage.characterCount.characters()} characters
        {' | '}
        {editor.storage.characterCount.words()} words
      </div>
    </div>
  );
}

// Debounce utility
function debounce(func: Function, wait: number) {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Fetch mention suggestions
async function fetchMentionSuggestions(query: string) {
  const response = await fetch(`/api/v1/users/search?q=${query}`);
  const users = await response.json();
  return users.slice(0, 5).map((user: any) => ({
    id: user.id,
    label: user.name,
  }));
}
```

#### 2.2.3 Editor Toolbar (`frontend/src/components/docs/EditorToolbar.tsx`)

```tsx
import { Editor } from '@tiptap/react';
import {
  Bold, Italic, Underline, Strikethrough,
  List, ListOrdered, CheckSquare,
  AlignLeft, AlignCenter, AlignRight,
  Image, Link, Table,
  Undo, Redo,
  Heading1, Heading2, Heading3,
  Quote, Code, Minus,
  Save, Download
} from 'lucide-react';

interface EditorToolbarProps {
  editor: Editor;
  isSaving: boolean;
  lastSaved: Date | null;
}

export function EditorToolbar({ editor, isSaving, lastSaved }: EditorToolbarProps) {
  const ToolbarButton = ({
    onClick,
    isActive,
    icon: Icon,
    title
  }: {
    onClick: () => void;
    isActive?: boolean;
    icon: any;
    title: string;
  }) => (
    <button
      onClick={onClick}
      className={`p-2 rounded hover:bg-gray-100 ${isActive ? 'bg-gray-200' : ''}`}
      title={title}
    >
      <Icon size={18} />
    </button>
  );

  const addImage = () => {
    const url = prompt('Enter image URL:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const addLink = () => {
    const url = prompt('Enter URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const addTable = () => {
    editor.chain().focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  };

  return (
    <div className="border-b bg-gray-50 p-2 flex items-center gap-1 flex-wrap sticky top-0 z-10">
      {/* History */}
      <div className="flex gap-1 border-r pr-2 mr-2">
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          icon={Undo}
          title="Undo"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          icon={Redo}
          title="Redo"
        />
      </div>

      {/* Headings */}
      <div className="flex gap-1 border-r pr-2 mr-2">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive('heading', { level: 1 })}
          icon={Heading1}
          title="Heading 1"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          icon={Heading2}
          title="Heading 2"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
          icon={Heading3}
          title="Heading 3"
        />
      </div>

      {/* Text formatting */}
      <div className="flex gap-1 border-r pr-2 mr-2">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          icon={Bold}
          title="Bold"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          icon={Italic}
          title="Italic"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          icon={Strikethrough}
          title="Strikethrough"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editor.isActive('code')}
          icon={Code}
          title="Code"
        />
      </div>

      {/* Lists */}
      <div className="flex gap-1 border-r pr-2 mr-2">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          icon={List}
          title="Bullet List"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          icon={ListOrdered}
          title="Numbered List"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          isActive={editor.isActive('taskList')}
          icon={CheckSquare}
          title="Task List"
        />
      </div>

      {/* Insert */}
      <div className="flex gap-1 border-r pr-2 mr-2">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          icon={Quote}
          title="Quote"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          icon={Minus}
          title="Horizontal Rule"
        />
        <ToolbarButton
          onClick={addImage}
          icon={Image}
          title="Insert Image"
        />
        <ToolbarButton
          onClick={addLink}
          isActive={editor.isActive('link')}
          icon={Link}
          title="Add Link"
        />
        <ToolbarButton
          onClick={addTable}
          icon={Table}
          title="Insert Table"
        />
      </div>

      {/* Save status */}
      <div className="ml-auto flex items-center gap-2 text-sm text-gray-500">
        {isSaving ? (
          <span className="flex items-center gap-1">
            <Save size={14} className="animate-pulse" />
            Saving...
          </span>
        ) : lastSaved ? (
          <span>Saved {formatTimeAgo(lastSaved)}</span>
        ) : null}

        <button
          className="btn btn-sm btn-secondary flex items-center gap-1"
          onClick={() => {/* Export handler */}}
        >
          <Download size={14} />
          Export
        </button>
      </div>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
```

### 2.3 Export Service (`backend/services/docs_export_service.py`)

```python
"""
Bheem Docs - Export Service
Export documents to PDF, DOCX, HTML, Markdown
"""
from typing import Optional
from uuid import UUID
import tempfile
import os
from weasyprint import HTML, CSS
from docx import Document
from docx.shared import Inches, Pt
import markdown
from bs4 import BeautifulSoup


class DocsExportService:
    """Export documents to various formats"""

    async def export_to_pdf(
        self,
        html_content: str,
        title: str,
        include_header: bool = True
    ) -> bytes:
        """Export HTML content to PDF"""

        # Add header with title
        if include_header:
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>{title}</title>
                <style>
                    body {{ font-family: 'Segoe UI', Arial, sans-serif; margin: 40px; }}
                    h1, h2, h3 {{ color: #333; }}
                    table {{ border-collapse: collapse; width: 100%; }}
                    th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
                    th {{ background-color: #f5f5f5; }}
                    code {{ background-color: #f5f5f5; padding: 2px 4px; border-radius: 3px; }}
                    pre {{ background-color: #f5f5f5; padding: 10px; border-radius: 5px; overflow-x: auto; }}
                    blockquote {{ border-left: 4px solid #ddd; margin-left: 0; padding-left: 16px; color: #666; }}
                    img {{ max-width: 100%; height: auto; }}
                </style>
            </head>
            <body>
                <h1>{title}</h1>
                {html_content}
            </body>
            </html>
            """

        # Generate PDF
        html = HTML(string=html_content)
        pdf_bytes = html.write_pdf()

        return pdf_bytes

    async def export_to_docx(
        self,
        html_content: str,
        title: str
    ) -> bytes:
        """Export HTML content to DOCX"""

        doc = Document()

        # Add title
        doc.add_heading(title, 0)

        # Parse HTML and convert to DOCX
        soup = BeautifulSoup(html_content, 'html.parser')

        for element in soup.children:
            self._process_element(doc, element)

        # Save to bytes
        with tempfile.NamedTemporaryFile(delete=False, suffix='.docx') as tmp:
            doc.save(tmp.name)
            tmp.seek(0)
            with open(tmp.name, 'rb') as f:
                docx_bytes = f.read()
            os.unlink(tmp.name)

        return docx_bytes

    def _process_element(self, doc, element):
        """Process HTML element and add to DOCX"""
        if element.name == 'h1':
            doc.add_heading(element.get_text(), level=1)
        elif element.name == 'h2':
            doc.add_heading(element.get_text(), level=2)
        elif element.name == 'h3':
            doc.add_heading(element.get_text(), level=3)
        elif element.name == 'p':
            doc.add_paragraph(element.get_text())
        elif element.name == 'ul':
            for li in element.find_all('li', recursive=False):
                doc.add_paragraph(li.get_text(), style='List Bullet')
        elif element.name == 'ol':
            for li in element.find_all('li', recursive=False):
                doc.add_paragraph(li.get_text(), style='List Number')
        elif element.name == 'blockquote':
            para = doc.add_paragraph(element.get_text())
            para.style = 'Quote'
        elif element.name == 'table':
            self._add_table(doc, element)

    def _add_table(self, doc, table_element):
        """Add HTML table to DOCX"""
        rows = table_element.find_all('tr')
        if not rows:
            return

        # Get column count from first row
        first_row = rows[0]
        cols = len(first_row.find_all(['th', 'td']))

        # Create table
        table = doc.add_table(rows=len(rows), cols=cols)
        table.style = 'Table Grid'

        for i, row in enumerate(rows):
            cells = row.find_all(['th', 'td'])
            for j, cell in enumerate(cells):
                table.rows[i].cells[j].text = cell.get_text()

    async def export_to_markdown(
        self,
        html_content: str
    ) -> str:
        """Export HTML content to Markdown"""
        import html2text

        h = html2text.HTML2Text()
        h.body_width = 0  # No line wrapping
        h.ignore_links = False
        h.ignore_images = False

        return h.handle(html_content)

    async def export_to_html(
        self,
        html_content: str,
        title: str,
        standalone: bool = True
    ) -> str:
        """Export as standalone HTML file"""

        if standalone:
            return f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>{title}</title>
                <style>
                    body {{
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        max-width: 800px;
                        margin: 40px auto;
                        padding: 0 20px;
                        line-height: 1.6;
                        color: #333;
                    }}
                    h1, h2, h3 {{ margin-top: 24px; margin-bottom: 16px; }}
                    table {{ border-collapse: collapse; width: 100%; margin: 16px 0; }}
                    th, td {{ border: 1px solid #ddd; padding: 12px; text-align: left; }}
                    th {{ background-color: #f5f5f5; font-weight: 600; }}
                    code {{ background-color: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-size: 14px; }}
                    pre {{ background-color: #f5f5f5; padding: 16px; border-radius: 6px; overflow-x: auto; }}
                    blockquote {{ border-left: 4px solid #0066cc; margin-left: 0; padding-left: 16px; color: #666; }}
                    img {{ max-width: 100%; height: auto; border-radius: 8px; }}
                    a {{ color: #0066cc; }}
                </style>
            </head>
            <body>
                {html_content}
            </body>
            </html>
            """

        return html_content
```

### 2.4 Phase 2 Deliverables

- [ ] `frontend/src/components/docs/Editor.tsx` - Tiptap editor component
- [ ] `frontend/src/components/docs/EditorToolbar.tsx` - Toolbar component
- [ ] `frontend/src/components/docs/EditorBubbleMenu.tsx` - Selection menu
- [ ] `frontend/src/pages/docs/edit/[id].tsx` - Document editor page
- [ ] `backend/services/docs_export_service.py` - Export service
- [ ] `backend/api/docs_export.py` - Export API endpoints
- [ ] Document templates CRUD API
- [ ] Auto-save functionality

---

## Phase 3: Real-time Collaboration

### Duration: Weeks 8-11

### 3.1 Objectives
- [ ] Set up WebSocket server for real-time sync
- [ ] Implement Yjs document synchronization
- [ ] Add presence indicators (who's viewing/editing)
- [ ] Implement cursor tracking
- [ ] Add commenting system with @mentions
- [ ] Implement document locking for non-collaborative edits

### 3.2 WebSocket Collaboration Server

#### 3.2.1 Collaboration Server (`backend/services/docs_collaboration_server.py`)

```python
"""
Bheem Docs - Real-time Collaboration Server
WebSocket server for Yjs document synchronization
"""
import asyncio
from typing import Dict, Set
from uuid import UUID
from fastapi import WebSocket, WebSocketDisconnect
import y_py as Y
from datetime import datetime
import json
import logging

from core.security import verify_token
from services.docs_document_service import DocsDocumentService

logger = logging.getLogger(__name__)


class CollaborationRoom:
    """Represents a collaborative editing room for a document"""

    def __init__(self, document_id: str):
        self.document_id = document_id
        self.ydoc = Y.YDoc()
        self.connections: Dict[str, WebSocket] = {}  # user_id -> websocket
        self.users: Dict[str, dict] = {}  # user_id -> user info
        self.last_activity = datetime.utcnow()

    async def add_user(self, user_id: str, user_info: dict, websocket: WebSocket):
        """Add user to the room"""
        self.connections[user_id] = websocket
        self.users[user_id] = {
            **user_info,
            'joined_at': datetime.utcnow().isoformat(),
            'cursor': None,
            'selection': None
        }
        self.last_activity = datetime.utcnow()

        # Broadcast user joined
        await self.broadcast_presence()

        # Send current document state
        state = Y.encode_state_as_update(self.ydoc)
        await websocket.send_bytes(state)

    async def remove_user(self, user_id: str):
        """Remove user from the room"""
        if user_id in self.connections:
            del self.connections[user_id]
        if user_id in self.users:
            del self.users[user_id]

        await self.broadcast_presence()

    async def apply_update(self, update: bytes, from_user: str):
        """Apply Yjs update from a user"""
        Y.apply_update(self.ydoc, update)
        self.last_activity = datetime.utcnow()

        # Broadcast to all other users
        for user_id, ws in self.connections.items():
            if user_id != from_user:
                try:
                    await ws.send_bytes(update)
                except Exception as e:
                    logger.error(f"Failed to send update to {user_id}: {e}")

    async def update_cursor(self, user_id: str, cursor_data: dict):
        """Update user's cursor position"""
        if user_id in self.users:
            self.users[user_id]['cursor'] = cursor_data.get('cursor')
            self.users[user_id]['selection'] = cursor_data.get('selection')

        # Broadcast cursor update
        await self.broadcast_cursors()

    async def broadcast_presence(self):
        """Broadcast presence info to all users"""
        presence = {
            'type': 'presence',
            'users': list(self.users.values())
        }
        await self._broadcast_json(presence)

    async def broadcast_cursors(self):
        """Broadcast cursor positions"""
        cursors = {
            'type': 'cursors',
            'data': {
                user_id: {
                    'cursor': info['cursor'],
                    'selection': info['selection'],
                    'name': info.get('name'),
                    'color': info.get('color')
                }
                for user_id, info in self.users.items()
                if info.get('cursor')
            }
        }
        await self._broadcast_json(cursors)

    async def _broadcast_json(self, data: dict):
        """Broadcast JSON message to all users"""
        message = json.dumps(data)
        for ws in self.connections.values():
            try:
                await ws.send_text(message)
            except Exception as e:
                logger.error(f"Failed to broadcast: {e}")

    def get_state(self) -> bytes:
        """Get current document state"""
        return Y.encode_state_as_update(self.ydoc)

    def load_state(self, state: bytes):
        """Load document state"""
        Y.apply_update(self.ydoc, state)

    def is_empty(self) -> bool:
        """Check if room has no users"""
        return len(self.connections) == 0


class CollaborationManager:
    """Manages all collaboration rooms"""

    def __init__(self):
        self.rooms: Dict[str, CollaborationRoom] = {}
        self._cleanup_task = None

    async def start(self):
        """Start the collaboration manager"""
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())

    async def stop(self):
        """Stop the collaboration manager"""
        if self._cleanup_task:
            self._cleanup_task.cancel()

    def get_or_create_room(self, document_id: str) -> CollaborationRoom:
        """Get or create a collaboration room"""
        if document_id not in self.rooms:
            self.rooms[document_id] = CollaborationRoom(document_id)
        return self.rooms[document_id]

    async def handle_connection(
        self,
        websocket: WebSocket,
        document_id: str,
        user_id: str,
        user_info: dict,
        db_session
    ):
        """Handle WebSocket connection for collaboration"""

        await websocket.accept()

        room = self.get_or_create_room(document_id)

        # Load initial state from database if room is new
        if room.is_empty():
            doc_service = DocsDocumentService(db_session)
            doc = await doc_service.get_document(UUID(document_id))
            if doc and doc.get('editor_content'):
                # Convert Tiptap JSON to Yjs state
                # This requires a conversion utility
                pass

        # Add user to room
        await room.add_user(user_id, user_info, websocket)

        try:
            while True:
                # Receive message
                message = await websocket.receive()

                if 'bytes' in message:
                    # Yjs update
                    await room.apply_update(message['bytes'], user_id)

                elif 'text' in message:
                    # JSON message (cursor update, etc.)
                    data = json.loads(message['text'])

                    if data.get('type') == 'cursor':
                        await room.update_cursor(user_id, data)

                    elif data.get('type') == 'save':
                        # Manual save request
                        await self._save_document(document_id, room, db_session)

        except WebSocketDisconnect:
            await room.remove_user(user_id)

            # Save document when last user leaves
            if room.is_empty():
                await self._save_document(document_id, room, db_session)

        except Exception as e:
            logger.error(f"Collaboration error: {e}")
            await room.remove_user(user_id)

    async def _save_document(self, document_id: str, room: CollaborationRoom, db_session):
        """Save document state to database"""
        try:
            # Get Yjs state
            state = room.get_state()

            # TODO: Convert Yjs state to Tiptap JSON
            # This requires a conversion utility

            doc_service = DocsDocumentService(db_session)
            # await doc_service.update_document_content(...)

            logger.info(f"Saved document {document_id}")

        except Exception as e:
            logger.error(f"Failed to save document {document_id}: {e}")

    async def _cleanup_loop(self):
        """Periodically clean up empty rooms"""
        while True:
            await asyncio.sleep(300)  # Every 5 minutes

            empty_rooms = [
                doc_id for doc_id, room in self.rooms.items()
                if room.is_empty()
            ]

            for doc_id in empty_rooms:
                del self.rooms[doc_id]
                logger.info(f"Cleaned up empty room: {doc_id}")


# Global collaboration manager
collab_manager = CollaborationManager()
```

### 3.3 Comments Service (`backend/services/docs_comments_service.py`)

```python
"""
Bheem Docs - Comments Service
Document comments with threading, mentions, and annotations
"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text


class DocsCommentsService:
    """Comment management for documents"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_comment(
        self,
        document_id: UUID,
        content: str,
        created_by: UUID,
        company_id: UUID,
        parent_id: Optional[UUID] = None,
        page_number: Optional[int] = None,
        annotation_data: Optional[dict] = None,
        mentions: Optional[List[UUID]] = None
    ) -> dict:
        """Create a new comment"""

        query = text("""
            INSERT INTO dms.document_comments (
                id, document_id, parent_id, content, page_number,
                annotation_data, mentions, company_id, created_by, created_at
            ) VALUES (
                gen_random_uuid(), :document_id, :parent_id, :content, :page_number,
                :annotation_data, :mentions, :company_id, :created_by, NOW()
            )
            RETURNING id, created_at
        """)

        result = await self.db.execute(query, {
            'document_id': str(document_id),
            'parent_id': str(parent_id) if parent_id else None,
            'content': content,
            'page_number': page_number,
            'annotation_data': annotation_data,
            'mentions': [str(m) for m in mentions] if mentions else [],
            'company_id': str(company_id),
            'created_by': str(created_by)
        })

        await self.db.commit()
        row = result.fetchone()

        # Send notifications to mentioned users
        if mentions:
            await self._notify_mentions(
                document_id=document_id,
                comment_id=row[0],
                mentioned_users=mentions,
                commenter_id=created_by
            )

        return {
            'id': str(row[0]),
            'document_id': str(document_id),
            'content': content,
            'created_at': row[1].isoformat()
        }

    async def list_comments(
        self,
        document_id: UUID,
        include_resolved: bool = False
    ) -> List[dict]:
        """List comments for a document with threading"""

        conditions = ["c.document_id = :document_id"]
        if not include_resolved:
            conditions.append("c.is_resolved = false")

        where_clause = " AND ".join(conditions)

        query = text(f"""
            WITH RECURSIVE comment_tree AS (
                -- Root comments
                SELECT
                    c.id, c.document_id, c.parent_id, c.content,
                    c.page_number, c.annotation_data, c.mentions,
                    c.is_resolved, c.resolved_by, c.resolved_at,
                    c.created_by, c.created_at, c.updated_at,
                    u.email as created_by_email,
                    p.first_name || ' ' || p.last_name as created_by_name,
                    0 as depth,
                    ARRAY[c.created_at] as path
                FROM dms.document_comments c
                LEFT JOIN auth.users u ON c.created_by = u.id
                LEFT JOIN public.persons p ON u.person_id = p.id
                WHERE c.parent_id IS NULL AND {where_clause}

                UNION ALL

                -- Child comments
                SELECT
                    c.id, c.document_id, c.parent_id, c.content,
                    c.page_number, c.annotation_data, c.mentions,
                    c.is_resolved, c.resolved_by, c.resolved_at,
                    c.created_by, c.created_at, c.updated_at,
                    u.email as created_by_email,
                    p.first_name || ' ' || p.last_name as created_by_name,
                    ct.depth + 1,
                    ct.path || c.created_at
                FROM dms.document_comments c
                JOIN comment_tree ct ON c.parent_id = ct.id
                LEFT JOIN auth.users u ON c.created_by = u.id
                LEFT JOIN public.persons p ON u.person_id = p.id
            )
            SELECT * FROM comment_tree
            ORDER BY path
        """)

        result = await self.db.execute(query, {'document_id': str(document_id)})
        rows = result.fetchall()

        return [dict(row._mapping) for row in rows]

    async def resolve_comment(
        self,
        comment_id: UUID,
        resolved_by: UUID
    ) -> bool:
        """Mark comment as resolved"""

        query = text("""
            UPDATE dms.document_comments SET
                is_resolved = true,
                resolved_by = :resolved_by,
                resolved_at = NOW()
            WHERE id = :id
        """)

        await self.db.execute(query, {
            'id': str(comment_id),
            'resolved_by': str(resolved_by)
        })
        await self.db.commit()

        return True

    async def _notify_mentions(
        self,
        document_id: UUID,
        comment_id: UUID,
        mentioned_users: List[UUID],
        commenter_id: UUID
    ):
        """Send notifications to mentioned users"""
        # TODO: Implement notification service integration
        pass
```

### 3.4 Phase 3 Deliverables

- [ ] `backend/services/docs_collaboration_server.py` - WebSocket server
- [ ] `backend/api/docs_collaboration.py` - Collaboration endpoints
- [ ] `backend/services/docs_comments_service.py` - Comments service
- [ ] `backend/api/docs_comments.py` - Comments API
- [ ] `frontend/src/components/docs/PresenceIndicator.tsx` - User presence
- [ ] `frontend/src/components/docs/CursorOverlay.tsx` - Cursor tracking
- [ ] `frontend/src/components/docs/CommentsSidebar.tsx` - Comments panel
- [ ] `frontend/src/components/docs/MentionList.tsx` - @mention suggestions
- [ ] Document locking mechanism

---

## Phase 4: ERP Integration

### Duration: Weeks 12-15

### 4.1 Objectives
- [ ] Implement entity document linking (Invoice, PO, Employee, etc.)
- [ ] Create document type-specific views and workflows
- [ ] Integrate with ERP modules (HR, Sales, Purchase, etc.)
- [ ] Implement full-text search with ERP context
- [ ] Add document approval workflows

### 4.2 Entity Document Linking Service

#### 4.2.1 Entity Links Service (`backend/services/docs_entity_links_service.py`)

```python
"""
Bheem Docs - Entity Document Links Service
Links documents to ERP entities (Invoice, PO, Employee, Project, etc.)
"""
from typing import Optional, List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from enum import Enum


class ERPEntityType(str, Enum):
    # Sales
    CUSTOMER = "CUSTOMER"
    SALES_ORDER = "SALES_ORDER"
    SALES_INVOICE = "SALES_INVOICE"
    SALES_QUOTE = "SALES_QUOTE"

    # Purchase
    VENDOR = "VENDOR"
    PURCHASE_ORDER = "PURCHASE_ORDER"
    PURCHASE_BILL = "PURCHASE_BILL"
    PURCHASE_REQUEST = "PURCHASE_REQUEST"
    GRN = "GRN"

    # HR
    EMPLOYEE = "EMPLOYEE"
    CANDIDATE = "CANDIDATE"

    # Projects
    PROJECT = "PROJECT"
    TASK = "TASK"

    # CRM
    CRM_CONTACT = "CRM_CONTACT"
    CRM_LEAD = "CRM_LEAD"
    CRM_OPPORTUNITY = "CRM_OPPORTUNITY"

    # Finance
    EXPENSE = "EXPENSE"
    ASSET = "ASSET"
    JOURNAL_ENTRY = "JOURNAL_ENTRY"
    PAYMENT = "PAYMENT"

    # Company
    COMPANY = "COMPANY"


class DocsEntityLinksService:
    """Manage document-entity relationships"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def link_document(
        self,
        document_id: UUID,
        entity_type: ERPEntityType,
        entity_id: UUID,
        created_by: UUID,
        link_type: str = "ATTACHMENT",
        is_primary: bool = False
    ) -> dict:
        """Link a document to an ERP entity"""

        query = text("""
            INSERT INTO dms.entity_document_links (
                document_id, entity_type, entity_id, link_type, is_primary, created_by, created_at
            ) VALUES (
                :document_id, :entity_type::dms.entitytype, :entity_id,
                :link_type, :is_primary, :created_by, NOW()
            )
            ON CONFLICT (document_id, entity_type, entity_id) DO UPDATE SET
                link_type = EXCLUDED.link_type,
                is_primary = EXCLUDED.is_primary
            RETURNING id
        """)

        result = await self.db.execute(query, {
            'document_id': str(document_id),
            'entity_type': entity_type.value,
            'entity_id': str(entity_id),
            'link_type': link_type,
            'is_primary': is_primary,
            'created_by': str(created_by)
        })

        await self.db.commit()
        row = result.fetchone()

        # Update document entity reference
        await self.db.execute(
            text("""
                UPDATE dms.documents SET
                    entity_type = :entity_type::dms.entitytype,
                    entity_id = :entity_id
                WHERE id = :document_id AND entity_type IS NULL
            """),
            {
                'document_id': str(document_id),
                'entity_type': entity_type.value,
                'entity_id': str(entity_id)
            }
        )
        await self.db.commit()

        return {'id': str(row[0]), 'linked': True}

    async def get_entity_documents(
        self,
        entity_type: ERPEntityType,
        entity_id: UUID,
        document_type: Optional[str] = None
    ) -> List[dict]:
        """Get all documents linked to an entity"""

        conditions = [
            "edl.entity_type = :entity_type::dms.entitytype",
            "edl.entity_id = :entity_id"
        ]
        params = {
            'entity_type': entity_type.value,
            'entity_id': str(entity_id)
        }

        if document_type:
            conditions.append("d.document_type = :document_type::dms.documenttype")
            params['document_type'] = document_type

        where_clause = " AND ".join(conditions)

        query = text(f"""
            SELECT
                d.id, d.title, d.description, d.document_type,
                d.file_name, d.file_extension, d.file_size, d.mime_type,
                d.storage_path, d.current_version, d.is_editable,
                d.created_at, d.updated_at,
                edl.link_type, edl.is_primary,
                u.email as created_by_email
            FROM dms.entity_document_links edl
            JOIN dms.documents d ON edl.document_id = d.id
            LEFT JOIN auth.users u ON d.created_by = u.id
            WHERE {where_clause}
            AND d.is_active = true AND d.deleted_at IS NULL
            ORDER BY edl.is_primary DESC, d.created_at DESC
        """)

        result = await self.db.execute(query, params)
        rows = result.fetchall()

        return [dict(row._mapping) for row in rows]

    async def get_document_entities(
        self,
        document_id: UUID
    ) -> List[dict]:
        """Get all entities linked to a document"""

        query = text("""
            SELECT
                edl.id as link_id,
                edl.entity_type,
                edl.entity_id,
                edl.link_type,
                edl.is_primary,
                edl.created_at
            FROM dms.entity_document_links edl
            WHERE edl.document_id = :document_id
            ORDER BY edl.is_primary DESC, edl.created_at DESC
        """)

        result = await self.db.execute(query, {'document_id': str(document_id)})
        rows = result.fetchall()

        # Enrich with entity details
        entities = []
        for row in rows:
            entity_info = await self._get_entity_info(
                row.entity_type,
                UUID(row.entity_id)
            )
            entities.append({
                **dict(row._mapping),
                'entity_info': entity_info
            })

        return entities

    async def _get_entity_info(self, entity_type: str, entity_id: UUID) -> dict:
        """Get basic info about an entity"""

        # Define table and display field for each entity type
        entity_tables = {
            'CUSTOMER': ('crm.customers', 'name', 'customer_code'),
            'VENDOR': ('purchase.vendors', 'name', 'vendor_code'),
            'EMPLOYEE': ('hr.employees', "first_name || ' ' || last_name", 'employee_code'),
            'SALES_INVOICE': ('sales.invoices', 'invoice_number', 'invoice_number'),
            'PURCHASE_ORDER': ('purchase.purchase_orders', 'po_number', 'po_number'),
            'PROJECT': ('project_management.projects', 'name', 'project_code'),
            # Add more entity types...
        }

        if entity_type not in entity_tables:
            return {'name': 'Unknown', 'code': str(entity_id)}

        table, name_field, code_field = entity_tables[entity_type]

        query = text(f"""
            SELECT {name_field} as name, {code_field} as code
            FROM {table}
            WHERE id = :id
        """)

        result = await self.db.execute(query, {'id': str(entity_id)})
        row = result.fetchone()

        if row:
            return {'name': row[0], 'code': row[1]}
        return {'name': 'Unknown', 'code': str(entity_id)}

    async def unlink_document(
        self,
        document_id: UUID,
        entity_type: ERPEntityType,
        entity_id: UUID
    ) -> bool:
        """Remove document-entity link"""

        await self.db.execute(
            text("""
                DELETE FROM dms.entity_document_links
                WHERE document_id = :document_id
                AND entity_type = :entity_type::dms.entitytype
                AND entity_id = :entity_id
            """),
            {
                'document_id': str(document_id),
                'entity_type': entity_type.value,
                'entity_id': str(entity_id)
            }
        )
        await self.db.commit()

        return True
```

### 4.3 ERP Integration API (`backend/api/docs_erp.py`)

```python
"""
Bheem Docs - ERP Integration API
Endpoints for document management within ERP context
"""
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pydantic import BaseModel

from core.security import get_current_user
from services.docs_document_service import DocsDocumentService
from services.docs_entity_links_service import DocsEntityLinksService, ERPEntityType
from db.session import get_db

router = APIRouter(prefix="/docs/erp", tags=["Docs ERP Integration"])


class LinkDocumentRequest(BaseModel):
    document_id: UUID
    entity_type: ERPEntityType
    entity_id: UUID
    link_type: str = "ATTACHMENT"
    is_primary: bool = False


class UploadEntityDocumentRequest(BaseModel):
    entity_type: ERPEntityType
    entity_id: UUID
    document_type: str = "OTHER"
    title: Optional[str] = None
    description: Optional[str] = None


# ─────────────────────────────────────────────────────────────
# ENTITY DOCUMENT ENDPOINTS
# ─────────────────────────────────────────────────────────────

@router.get("/entities/{entity_type}/{entity_id}/documents")
async def get_entity_documents(
    entity_type: ERPEntityType,
    entity_id: UUID,
    document_type: Optional[str] = Query(None),
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Get all documents linked to an ERP entity.

    Use this to display documents in:
    - Invoice detail page
    - Purchase Order detail page
    - Employee profile
    - Project dashboard
    - etc.
    """
    service = DocsEntityLinksService(db)
    documents = await service.get_entity_documents(
        entity_type=entity_type,
        entity_id=entity_id,
        document_type=document_type
    )
    return {"documents": documents, "total": len(documents)}


@router.post("/entities/{entity_type}/{entity_id}/documents")
async def upload_entity_document(
    entity_type: ERPEntityType,
    entity_id: UUID,
    file: UploadFile = File(...),
    document_type: str = Query("OTHER"),
    title: Optional[str] = Query(None),
    description: Optional[str] = Query(None),
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload and link a document to an ERP entity.

    This creates the document AND links it to the entity in one call.
    """
    company_id = current_user.get('company_id')
    if not company_id:
        raise HTTPException(status_code=400, detail="Company context required")

    # Create document
    doc_service = DocsDocumentService(db)
    document = await doc_service.create_document(
        title=title or file.filename,
        file=file.file,
        filename=file.filename,
        company_id=UUID(company_id),
        document_type=document_type,
        description=description,
        created_by=UUID(current_user['id']),
        entity_type=entity_type.value,
        entity_id=entity_id
    )

    # Link to entity
    link_service = DocsEntityLinksService(db)
    await link_service.link_document(
        document_id=UUID(document['id']),
        entity_type=entity_type,
        entity_id=entity_id,
        created_by=UUID(current_user['id'])
    )

    return document


@router.post("/link")
async def link_document_to_entity(
    request: LinkDocumentRequest,
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Link an existing document to an ERP entity."""
    service = DocsEntityLinksService(db)
    result = await service.link_document(
        document_id=request.document_id,
        entity_type=request.entity_type,
        entity_id=request.entity_id,
        created_by=UUID(current_user['id']),
        link_type=request.link_type,
        is_primary=request.is_primary
    )
    return result


@router.delete("/entities/{entity_type}/{entity_id}/documents/{document_id}")
async def unlink_entity_document(
    entity_type: ERPEntityType,
    entity_id: UUID,
    document_id: UUID,
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Remove a document link from an entity (does not delete the document)."""
    service = DocsEntityLinksService(db)
    await service.unlink_document(
        document_id=document_id,
        entity_type=entity_type,
        entity_id=entity_id
    )
    return {"unlinked": True}


# ─────────────────────────────────────────────────────────────
# QUICK ACCESS ENDPOINTS FOR COMMON ERP SCENARIOS
# ─────────────────────────────────────────────────────────────

@router.get("/invoices/{invoice_id}/documents")
async def get_invoice_documents(
    invoice_id: UUID,
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get documents attached to a sales invoice."""
    service = DocsEntityLinksService(db)
    return await service.get_entity_documents(
        entity_type=ERPEntityType.SALES_INVOICE,
        entity_id=invoice_id
    )


@router.get("/purchase-orders/{po_id}/documents")
async def get_po_documents(
    po_id: UUID,
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get documents attached to a purchase order."""
    service = DocsEntityLinksService(db)
    return await service.get_entity_documents(
        entity_type=ERPEntityType.PURCHASE_ORDER,
        entity_id=po_id
    )


@router.get("/employees/{employee_id}/documents")
async def get_employee_documents(
    employee_id: UUID,
    document_type: Optional[str] = Query(None, description="Filter by type: ID_DOCUMENT, CONTRACT, CERTIFICATE, etc."),
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get documents for an employee (contracts, ID docs, certificates, etc.)."""
    service = DocsEntityLinksService(db)
    return await service.get_entity_documents(
        entity_type=ERPEntityType.EMPLOYEE,
        entity_id=employee_id,
        document_type=document_type
    )


@router.get("/projects/{project_id}/documents")
async def get_project_documents(
    project_id: UUID,
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get documents attached to a project."""
    service = DocsEntityLinksService(db)
    return await service.get_entity_documents(
        entity_type=ERPEntityType.PROJECT,
        entity_id=project_id
    )
```

### 4.4 Frontend ERP Integration Component

```tsx
// frontend/src/components/docs/EntityDocuments.tsx
// Reusable component to show documents for any ERP entity

import { useState, useEffect } from 'react';
import { Upload, File, Download, Trash2, Link, Eye } from 'lucide-react';
import { docsErpApi } from '@/lib/docsErpApi';

interface EntityDocumentsProps {
  entityType: string;
  entityId: string;
  title?: string;
  allowUpload?: boolean;
  allowDelete?: boolean;
  documentTypes?: string[];  // Filter by specific types
  compact?: boolean;
}

export function EntityDocuments({
  entityType,
  entityId,
  title = "Documents",
  allowUpload = true,
  allowDelete = true,
  documentTypes,
  compact = false
}: EntityDocumentsProps) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, [entityType, entityId]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const docs = await docsErpApi.getEntityDocuments(entityType, entityId);
      setDocuments(docs.documents);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (files: FileList) => {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await docsErpApi.uploadEntityDocument(entityType, entityId, file);
      }
      await loadDocuments();
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (documentId: string) => {
    if (confirm('Are you sure you want to remove this document?')) {
      await docsErpApi.unlinkEntityDocument(entityType, entityId, documentId);
      await loadDocuments();
    }
  };

  if (loading) {
    return <div className="animate-pulse">Loading documents...</div>;
  }

  return (
    <div className={`entity-documents ${compact ? 'compact' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">{title}</h3>
        {allowUpload && (
          <label className="btn btn-sm btn-primary cursor-pointer">
            <Upload size={16} className="mr-1" />
            Upload
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleUpload(e.target.files)}
            />
          </label>
        )}
      </div>

      {documents.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <File size={48} className="mx-auto mb-2 opacity-50" />
          <p>No documents attached</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc: any) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
            >
              <div className="flex items-center gap-3">
                <File size={20} className="text-gray-400" />
                <div>
                  <p className="font-medium">{doc.title}</p>
                  <p className="text-sm text-gray-500">
                    {doc.file_name} • {formatFileSize(doc.file_size)}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => window.open(`/docs/view/${doc.id}`)}
                  className="p-2 hover:bg-gray-200 rounded"
                  title="View"
                >
                  <Eye size={16} />
                </button>
                <button
                  onClick={() => docsErpApi.downloadDocument(doc.id)}
                  className="p-2 hover:bg-gray-200 rounded"
                  title="Download"
                >
                  <Download size={16} />
                </button>
                {allowDelete && (
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-2 hover:bg-red-100 text-red-600 rounded"
                    title="Remove"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
```

### 4.5 Phase 4 Deliverables

- [ ] `backend/services/docs_entity_links_service.py` - Entity linking service
- [ ] `backend/api/docs_erp.py` - ERP integration API
- [ ] `backend/services/docs_search_service.py` - Full-text search
- [ ] `backend/services/docs_workflow_service.py` - Approval workflows
- [ ] `frontend/src/components/docs/EntityDocuments.tsx` - Reusable component
- [ ] `frontend/src/lib/docsErpApi.ts` - ERP docs API client
- [ ] Integration with existing ERP pages (Invoice, PO, Employee, etc.)
- [ ] Document approval workflow UI

---

## Phase 5: Enterprise Features

### Duration: Weeks 16-20

### 5.1 Objectives
- [ ] Implement version control UI with diff view
- [ ] Add document approval workflows
- [ ] Create comprehensive audit logging
- [ ] Implement retention policies with automation
- [ ] Add legal hold functionality
- [ ] Create admin dashboard for docs management

### 5.2 Key Deliverables

- [ ] Version history UI with visual diff
- [ ] Multi-level approval workflow engine
- [ ] Audit log viewer with filtering
- [ ] Retention policy management
- [ ] Legal hold management
- [ ] Storage analytics dashboard
- [ ] User quota management

---

## Phase 6: AI & Smart Features

### Duration: Weeks 21-24

### 6.1 Objectives
- [ ] Integrate OCR for scanned documents
- [ ] Implement AI document summarization
- [ ] Add smart document classification
- [ ] Create intelligent search with semantic understanding
- [ ] Add AI-powered suggestions

### 6.2 AI Service (`backend/services/docs_ai_service.py`)

```python
"""
Bheem Docs - AI Service
OCR, summarization, classification, and smart search
"""
from typing import Optional, List
from uuid import UUID
import httpx
from anthropic import Anthropic

from core.config import settings


class DocsAIService:
    """AI-powered document features"""

    def __init__(self):
        self.anthropic = Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    async def summarize_document(
        self,
        content: str,
        max_length: int = 500
    ) -> str:
        """Generate AI summary of document content"""

        message = self.anthropic.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=max_length,
            messages=[
                {
                    "role": "user",
                    "content": f"""Summarize the following document in a clear, concise manner.
                    Focus on the key points and main takeaways.

                    Document:
                    {content[:10000]}

                    Summary:"""
                }
            ]
        )

        return message.content[0].text

    async def classify_document(
        self,
        content: str,
        filename: str
    ) -> dict:
        """Classify document type and extract metadata"""

        message = self.anthropic.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=500,
            messages=[
                {
                    "role": "user",
                    "content": f"""Analyze this document and provide:
                    1. Document type (INVOICE, CONTRACT, REPORT, LETTER, etc.)
                    2. Key entities mentioned (company names, people, dates, amounts)
                    3. Suggested tags
                    4. Brief description

                    Filename: {filename}
                    Content:
                    {content[:5000]}

                    Respond in JSON format:
                    {{"document_type": "", "entities": [], "tags": [], "description": ""}}"""
                }
            ]
        )

        import json
        try:
            return json.loads(message.content[0].text)
        except:
            return {"document_type": "OTHER", "entities": [], "tags": [], "description": ""}

    async def extract_text_ocr(
        self,
        file_bytes: bytes,
        mime_type: str
    ) -> str:
        """Extract text from images/PDFs using OCR"""

        # Option 1: Use Tesseract locally
        import pytesseract
        from PIL import Image
        import io

        if mime_type.startswith('image/'):
            image = Image.open(io.BytesIO(file_bytes))
            text = pytesseract.image_to_string(image)
            return text

        # Option 2: For PDFs, use pdf2image + tesseract
        if mime_type == 'application/pdf':
            from pdf2image import convert_from_bytes
            images = convert_from_bytes(file_bytes)
            text_parts = []
            for img in images:
                text_parts.append(pytesseract.image_to_string(img))
            return "\n\n".join(text_parts)

        return ""

    async def semantic_search(
        self,
        query: str,
        company_id: UUID,
        limit: int = 10
    ) -> List[dict]:
        """Semantic search using embeddings"""

        # Generate query embedding
        # Using OpenAI embeddings as example
        import openai
        openai.api_key = settings.OPENAI_API_KEY

        response = openai.embeddings.create(
            model="text-embedding-3-small",
            input=query
        )
        query_embedding = response.data[0].embedding

        # Search using pgvector
        # Requires pgvector extension and embeddings stored in documents
        # This is a placeholder for the actual implementation

        return []
```

### 6.3 Phase 6 Deliverables

- [ ] `backend/services/docs_ai_service.py` - AI service
- [ ] `backend/api/docs_ai.py` - AI endpoints
- [ ] OCR processing pipeline
- [ ] Document embedding generation
- [ ] Semantic search implementation
- [ ] AI classification on upload
- [ ] Smart suggestions UI

---

## 7. API Specification

### Complete API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| **File Management** |
| `GET` | `/api/v1/docs/files` | List files in folder |
| `POST` | `/api/v1/docs/files` | Upload file |
| `GET` | `/api/v1/docs/files/{id}` | Get file details |
| `PUT` | `/api/v1/docs/files/{id}` | Update file metadata |
| `DELETE` | `/api/v1/docs/files/{id}` | Delete file |
| `GET` | `/api/v1/docs/files/{id}/download` | Download file |
| `GET` | `/api/v1/docs/files/{id}/preview` | Get preview URL |
| **Folders** |
| `GET` | `/api/v1/docs/folders` | List folders |
| `POST` | `/api/v1/docs/folders` | Create folder |
| `PUT` | `/api/v1/docs/folders/{id}` | Update folder |
| `DELETE` | `/api/v1/docs/folders/{id}` | Delete folder |
| **Editor** |
| `GET` | `/api/v1/docs/editor/{id}` | Get document for editing |
| `PUT` | `/api/v1/docs/editor/{id}` | Save document content |
| `WS` | `/api/v1/docs/collab/{id}` | WebSocket collaboration |
| **Comments** |
| `GET` | `/api/v1/docs/{id}/comments` | List comments |
| `POST` | `/api/v1/docs/{id}/comments` | Add comment |
| `PUT` | `/api/v1/docs/comments/{id}` | Update comment |
| `DELETE` | `/api/v1/docs/comments/{id}` | Delete comment |
| `POST` | `/api/v1/docs/comments/{id}/resolve` | Resolve comment |
| **Versions** |
| `GET` | `/api/v1/docs/{id}/versions` | List versions |
| `POST` | `/api/v1/docs/{id}/versions` | Create version |
| `GET` | `/api/v1/docs/{id}/versions/{v}` | Get specific version |
| `POST` | `/api/v1/docs/{id}/versions/{v}/restore` | Restore version |
| **Sharing** |
| `GET` | `/api/v1/docs/{id}/access` | List access permissions |
| `POST` | `/api/v1/docs/{id}/access` | Add access |
| `DELETE` | `/api/v1/docs/{id}/access/{aid}` | Remove access |
| `POST` | `/api/v1/docs/{id}/share-link` | Create share link |
| **ERP Integration** |
| `GET` | `/api/v1/docs/erp/entities/{type}/{id}/documents` | Entity documents |
| `POST` | `/api/v1/docs/erp/entities/{type}/{id}/documents` | Upload to entity |
| `POST` | `/api/v1/docs/erp/link` | Link document |
| **Search** |
| `GET` | `/api/v1/docs/search` | Full-text search |
| `GET` | `/api/v1/docs/search/semantic` | AI semantic search |
| **AI** |
| `POST` | `/api/v1/docs/{id}/summarize` | Generate summary |
| `POST` | `/api/v1/docs/{id}/classify` | Classify document |
| `POST` | `/api/v1/docs/{id}/ocr` | Extract text (OCR) |
| **Admin** |
| `GET` | `/api/v1/docs/admin/storage` | Storage overview |
| `GET` | `/api/v1/docs/admin/quotas` | Quota management |
| `GET` | `/api/v1/docs/admin/audit` | Audit logs |
| `GET` | `/api/v1/docs/admin/retention` | Retention policies |

---

## 8. Frontend Components

### Component Structure

```
frontend/src/
├── pages/
│   └── docs/
│       ├── index.tsx              # File browser
│       ├── edit/[id].tsx          # Document editor
│       ├── view/[id].tsx          # Document viewer
│       └── admin/
│           ├── index.tsx          # Admin dashboard
│           ├── storage.tsx        # Storage management
│           └── audit.tsx          # Audit logs
├── components/
│   └── docs/
│       ├── Editor.tsx             # Tiptap editor
│       ├── EditorToolbar.tsx      # Editor toolbar
│       ├── EditorBubbleMenu.tsx   # Selection menu
│       ├── FileGrid.tsx           # File grid/list
│       ├── FilePreview.tsx        # Preview modal
│       ├── FolderTree.tsx         # Folder navigation
│       ├── UploadModal.tsx        # Upload dialog
│       ├── ShareModal.tsx         # Sharing dialog
│       ├── CommentsSidebar.tsx    # Comments panel
│       ├── VersionHistory.tsx     # Version panel
│       ├── PresenceIndicator.tsx  # Active users
│       ├── EntityDocuments.tsx    # ERP integration
│       └── SearchResults.tsx      # Search results
├── stores/
│   └── docsStore.ts               # Zustand store
├── lib/
│   ├── docsApi.ts                 # API client
│   ├── docsErpApi.ts              # ERP API client
│   └── docsCollabProvider.ts      # Yjs provider
└── types/
    └── docs.ts                    # TypeScript types
```

---

## 9. Security & Compliance

### 9.1 Access Control

- Row-level security (RLS) in PostgreSQL
- Company/tenant isolation
- Document-level permissions (VIEW, DOWNLOAD, EDIT, DELETE, SHARE, ADMIN)
- Integration with Bheem Passport SSO

### 9.2 Data Protection

- Encryption at rest (S3 server-side encryption)
- Encryption in transit (TLS 1.3)
- Optional client-side encryption for sensitive documents
- Secure presigned URLs for downloads

### 9.3 Compliance Features

- Full audit logging
- Legal hold support
- Retention policies
- eDiscovery support
- GDPR compliance (data export, deletion)

---

## 10. Deployment Architecture

### 10.1 Docker Compose Configuration

```yaml
# docker-compose.docs.yml
version: '3.8'

services:
  bheem-docs-api:
    build:
      context: ./backend
      dockerfile: Dockerfile.docs
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - S3_ENDPOINT=${S3_ENDPOINT}
      - S3_ACCESS_KEY=${S3_ACCESS_KEY}
      - S3_SECRET_KEY=${S3_SECRET_KEY}
      - REDIS_URL=${REDIS_URL}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    ports:
      - "8001:8001"
    depends_on:
      - redis
      - minio

  bheem-docs-collab:
    build:
      context: ./backend
      dockerfile: Dockerfile.collab
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    ports:
      - "8002:8002"
    depends_on:
      - redis

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      - MINIO_ROOT_USER=${S3_ACCESS_KEY}
      - MINIO_ROOT_PASSWORD=${S3_SECRET_KEY}
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

volumes:
  minio_data:
  redis_data:
```

---

## Summary

This implementation plan provides a complete roadmap for building **Bheem Docs** - a unified document management and collaboration platform that serves both internal ERP users and external SaaS customers.

### Key Milestones

| Phase | Duration | Key Deliverable |
|-------|----------|-----------------|
| Phase 1 | Weeks 1-3 | Foundation & Storage |
| Phase 2 | Weeks 4-7 | Rich Text Editor |
| Phase 3 | Weeks 8-11 | Real-time Collaboration |
| Phase 4 | Weeks 12-15 | ERP Integration |
| Phase 5 | Weeks 16-20 | Enterprise Features |
| Phase 6 | Weeks 21-24 | AI & Smart Features |

### Total Timeline: 24 weeks (6 months)

---

*Document Version: 1.0*
*Created: January 2025*
*Author: Bheem Platform Engineering*
