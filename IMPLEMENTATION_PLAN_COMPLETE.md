# BHEEM WORKSPACE - COMPLETE IMPLEMENTATION PLAN
## Google/Zoho Level Features with Best Practices

> **Version**: 1.0
> **Date**: January 2026
> **Dual Mode**: Internal Employees (ERP-based) + External Customers (Self-service)

---

## TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Phase 1: Critical Foundation (Week 1-4)](#phase-1-critical-foundation-week-1-4)
4. [Phase 2: Core Productivity Suite (Week 5-10)](#phase-2-core-productivity-suite-week-5-10)
5. [Phase 3: Advanced Features (Week 11-16)](#phase-3-advanced-features-week-11-16)
6. [Phase 4: Enterprise & Automation (Week 17-22)](#phase-4-enterprise--automation-week-17-22)
7. [Phase 5: Mobile & Desktop Apps (Week 23-28)](#phase-5-mobile--desktop-apps-week-23-28)
8. [Phase 6: Polish & Launch (Week 29-32)](#phase-6-polish--launch-week-29-32)
9. [Database Schema](#database-schema)
10. [API Reference](#api-reference)
11. [Best Practices](#best-practices)

---

## EXECUTIVE SUMMARY

### Current State
- Basic workspace with Mail, Docs, Meet, Calendar, Chat
- Authentication via Bheem Passport
- Multi-tenant architecture for external customers
- ERP integration for internal employees

### Target State
- Full Google Workspace/Zoho Workplace parity
- Sheets, Slides, Forms apps
- Workflow automation
- Enterprise search
- Mobile & Desktop apps
- Advanced AI features

### Priority Gaps to Address

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| P0 | Bheem Sheets (Spreadsheets) | High | Critical |
| P0 | Bheem Slides (Presentations) | High | Critical |
| P0 | Bheem Forms | Medium | Critical |
| P0 | Bulk User Import (CSV) | Low | High |
| P0 | Mobile Apps | High | Critical |
| P1 | Workflow Automation | High | High |
| P1 | Enterprise Search | High | High |
| P1 | Breakout Rooms (Meet) | Medium | Medium |
| P1 | SAML/OIDC SSO | Medium | High |
| P2 | Desktop App | High | Medium |
| P2 | Whiteboard | Medium | Medium |

---

## ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BHEEM WORKSPACE PLATFORM                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────┐    ┌────────────────────────────────────┐ │
│  │       INTERNAL MODE          │    │         EXTERNAL MODE              │ │
│  │    (Bheem Employees)         │    │     (External Customers)           │ │
│  ├──────────────────────────────┤    ├────────────────────────────────────┤ │
│  │ • ERP Integration            │    │ • Self-service signup              │ │
│  │ • Company-wide features      │    │ • Multi-tenant isolation           │ │
│  │ • HR/Payroll integration     │    │ • Custom branding (white-label)    │ │
│  │ • Internal directories       │    │ • Subscription billing             │ │
│  │ • Cross-department collab    │    │ • Domain management                │ │
│  │ • Single tenant              │    │ • Per-tenant storage quotas        │ │
│  └──────────────────────────────┘    └────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        SHARED CORE SERVICES                            │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │                                                                        │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │ │
│  │  │  Mail   │ │  Docs   │ │ Sheets  │ │ Slides  │ │  Forms  │          │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘          │ │
│  │                                                                        │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │ │
│  │  │  Meet   │ │Calendar │ │  Chat   │ │  Drive  │ │ Search  │          │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘          │ │
│  │                                                                        │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                      │ │
│  │  │  Admin  │ │Security │ │   AI    │ │Workflow │                      │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘                      │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         INFRASTRUCTURE                                 │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │  Bheem Passport │ Mailcow │ Nextcloud │ LiveKit │ Mattermost          │ │
│  │  PostgreSQL │ Redis │ MinIO │ Elasticsearch │ RabbitMQ │ ClickHouse   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                           CLIENTS                                      │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │  Web App (Next.js) │ iOS App │ Android App │ Desktop App (Electron)   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## PHASE 1: CRITICAL FOUNDATION (Week 1-4)

### 1.1 Bulk User Import (CSV)

**Priority**: P0
**Effort**: 3 days
**Impact**: High - Essential for enterprise onboarding

#### Backend API

**File**: `/backend/api/admin_users.py`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/users/import/csv` | POST | Upload CSV and start import |
| `/admin/users/import/{job_id}` | GET | Get import job status |
| `/admin/users/import/template` | GET | Download CSV template |
| `/admin/users/export/csv` | POST | Export all users to CSV |

**CSV Format**:
```csv
email,first_name,last_name,department,job_title,role,org_unit
john@company.com,John,Doe,Engineering,Developer,member,/Engineering/Backend
jane@company.com,Jane,Smith,HR,Manager,manager,/HR
```

**Features**:
- Validation before import (email format, required fields)
- Preview first 10 rows before confirming
- Background processing for large files (500+ users)
- Progress tracking with WebSocket updates
- Error reporting with row numbers
- Option to send invite emails
- Duplicate detection (skip or update)

#### Frontend Page

**File**: `/frontend/src/pages/admin/users/import.tsx`

**UI Components**:
- Drag & drop CSV upload zone
- Template download button
- Preview table with validation status
- Progress bar during import
- Error summary with downloadable error report
- Success summary with "View Users" link

---

### 1.2 Organizational Units (Departments)

**Priority**: P1
**Effort**: 5 days
**Impact**: High - Required for enterprise structure

#### Backend API

**File**: `/backend/api/org_units.py`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/org-units` | GET | List all org units (hierarchical) |
| `/admin/org-units` | POST | Create org unit |
| `/admin/org-units/{id}` | GET | Get org unit details |
| `/admin/org-units/{id}` | PUT | Update org unit |
| `/admin/org-units/{id}` | DELETE | Delete org unit |
| `/admin/org-units/{id}/users` | GET | List users in org unit |
| `/admin/org-units/{id}/users` | POST | Add users to org unit |
| `/admin/org-units/chart` | GET | Get org chart data |

**Features**:
- Hierarchical structure (parent/child units)
- Service access control per unit (enable/disable apps)
- Inheritance from parent units
- Org chart visualization
- Bulk move users between units
- Department managers

#### Database Schema

```sql
CREATE TABLE workspace.org_units (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES workspace.org_units(id),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE workspace.tenant_users
ADD COLUMN org_unit_id UUID REFERENCES workspace.org_units(id);
```

---

### 1.3 User Groups (Distribution Lists)

**Priority**: P1
**Effort**: 4 days
**Impact**: Medium - Important for email workflows

#### Backend API

**File**: `/backend/api/groups.py`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/groups` | GET | List all groups |
| `/admin/groups` | POST | Create group |
| `/admin/groups/{id}` | GET | Get group details |
| `/admin/groups/{id}` | PUT | Update group |
| `/admin/groups/{id}` | DELETE | Delete group |
| `/admin/groups/{id}/members` | GET | List group members |
| `/admin/groups/{id}/members` | POST | Add members |
| `/admin/groups/{id}/members/{user_id}` | DELETE | Remove member |

**Group Types**:
- **Distribution**: Email distribution list
- **Security**: Access control group
- **Dynamic**: Auto-populated based on rules (department, role)

---

### 1.4 Custom Admin Roles

**Priority**: P2
**Effort**: 3 days
**Impact**: Medium - Enterprise requirement

#### Backend API

**File**: `/backend/api/admin_roles.py`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/roles` | GET | List admin roles |
| `/admin/roles` | POST | Create custom role |
| `/admin/roles/{id}` | PUT | Update role |
| `/admin/roles/{id}` | DELETE | Delete role |

**Predefined Roles**:
- Super Admin (full access)
- User Admin (manage users only)
- Billing Admin (manage billing only)
- Help Desk Admin (view-only + password reset)
- Groups Admin (manage groups only)

**Permissions**:
```json
{
  "users": ["read", "write", "delete", "invite"],
  "groups": ["read", "write", "delete"],
  "domains": ["read", "write", "verify"],
  "billing": ["read", "write"],
  "security": ["read", "audit"],
  "settings": ["read", "write"]
}
```

---

### 1.5 Domain Aliases

**Priority**: P2
**Effort**: 2 days
**Impact**: Medium - Multi-domain support

#### Backend API

**File**: `/backend/api/domains.py` (extend existing)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/domains/{id}/aliases` | GET | List domain aliases |
| `/admin/domains/{id}/aliases` | POST | Add alias domain |
| `/admin/domains/{id}/aliases/{alias_id}` | DELETE | Remove alias |

**Features**:
- Users get email at all alias domains automatically
- Single DNS verification for aliases
- Primary domain remains main identity

---

### 1.6 SAML/OIDC SSO

**Priority**: P1
**Effort**: 7 days
**Impact**: High - Enterprise requirement

#### Backend API

**File**: `/backend/api/sso.py`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/sso/config` | GET | Get SSO configuration |
| `/admin/sso/config` | PUT | Update SSO config |
| `/admin/sso/saml/metadata` | GET | Get SAML metadata |
| `/auth/sso/saml/login` | GET | SAML login redirect |
| `/auth/sso/saml/acs` | POST | SAML assertion consumer |
| `/auth/sso/oidc/login` | GET | OIDC login redirect |
| `/auth/sso/oidc/callback` | GET | OIDC callback |

**Supported Providers**:
- Okta
- Azure AD
- Google Workspace
- OneLogin
- Custom SAML 2.0
- Custom OIDC

---

## PHASE 2: CORE PRODUCTIVITY SUITE (Week 5-10)

### 2.1 Bheem Sheets (Spreadsheets)

**Priority**: P0
**Effort**: 15 days
**Impact**: Critical - Core productivity app

#### Technology Stack
- **Frontend**: Luckysheet or Univer (open-source spreadsheet libraries)
- **Backend**: Custom calculation engine + Nextcloud storage
- **Real-time**: WebSocket for collaboration

#### Backend API

**File**: `/backend/api/sheets.py`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/sheets` | GET | List user's spreadsheets |
| `/sheets` | POST | Create new spreadsheet |
| `/sheets/{id}` | GET | Get spreadsheet data |
| `/sheets/{id}` | PUT | Update spreadsheet |
| `/sheets/{id}` | DELETE | Delete spreadsheet |
| `/sheets/{id}/export` | POST | Export (xlsx, csv, pdf) |
| `/sheets/{id}/import` | POST | Import from xlsx/csv |
| `/sheets/{id}/share` | POST | Share with users |
| `/sheets/{id}/collaborators` | GET | List collaborators |
| `/sheets/{id}/history` | GET | Version history |
| `/sheets/{id}/comments` | GET/POST | Cell comments |
| `/sheets/templates` | GET | List templates |

#### Features

**Core Spreadsheet**:
- Multiple sheets/tabs per workbook
- Cell formatting (fonts, colors, borders)
- Number formats (currency, date, percentage)
- Formulas (400+ Excel-compatible functions)
- Charts (bar, line, pie, scatter, etc.)
- Conditional formatting
- Data validation
- Freeze rows/columns
- Filter and sort
- Find and replace

**Collaboration**:
- Real-time multi-user editing
- User cursors with names
- Cell-level comments
- @mentions in comments
- Version history with restore
- Sharing permissions (view, comment, edit)

**AI Features**:
- Formula suggestions
- Data analysis insights
- Auto-fill patterns
- Natural language to formula

#### Database Schema

```sql
CREATE TABLE workspace.spreadsheets (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    owner_id UUID NOT NULL,
    title VARCHAR(500) NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    is_template BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE workspace.spreadsheet_shares (
    id UUID PRIMARY KEY,
    spreadsheet_id UUID NOT NULL,
    user_id UUID,
    email VARCHAR(255),
    permission VARCHAR(50) DEFAULT 'view',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE workspace.spreadsheet_versions (
    id UUID PRIMARY KEY,
    spreadsheet_id UUID NOT NULL,
    version_number INT NOT NULL,
    data JSONB NOT NULL,
    created_by UUID,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Frontend Pages

**Files**:
- `/frontend/src/pages/sheets/index.tsx` - List view
- `/frontend/src/pages/sheets/[id].tsx` - Editor
- `/frontend/src/components/sheets/SpreadsheetEditor.tsx`
- `/frontend/src/components/sheets/FormulaBar.tsx`
- `/frontend/src/components/sheets/Toolbar.tsx`
- `/frontend/src/components/sheets/SheetTabs.tsx`

---

### 2.2 Bheem Slides (Presentations)

**Priority**: P0
**Effort**: 15 days
**Impact**: Critical - Core productivity app

#### Technology Stack
- **Frontend**: Custom React + Fabric.js or reveal.js
- **Backend**: Slide data storage + asset management
- **Real-time**: WebSocket for collaboration

#### Backend API

**File**: `/backend/api/slides.py`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/slides` | GET | List presentations |
| `/slides` | POST | Create presentation |
| `/slides/{id}` | GET | Get presentation |
| `/slides/{id}` | PUT | Update presentation |
| `/slides/{id}` | DELETE | Delete presentation |
| `/slides/{id}/slides` | GET | Get all slides |
| `/slides/{id}/slides` | POST | Add slide |
| `/slides/{id}/slides/{slide_id}` | PUT | Update slide |
| `/slides/{id}/slides/{slide_id}` | DELETE | Delete slide |
| `/slides/{id}/slides/reorder` | POST | Reorder slides |
| `/slides/{id}/export` | POST | Export (pptx, pdf) |
| `/slides/{id}/present` | GET | Get presentation mode URL |
| `/slides/{id}/share` | POST | Share presentation |
| `/slides/templates` | GET | List templates |

#### Features

**Core Presentation**:
- Multiple slides per presentation
- Slide layouts (title, content, two-column, blank)
- Text boxes with rich formatting
- Images, shapes, icons
- Tables and charts
- Transitions and animations
- Speaker notes
- Slide master/themes

**Collaboration**:
- Real-time co-editing
- Comments on slides
- @mentions
- Version history
- Sharing with permissions

**Presentation Mode**:
- Full-screen presentation
- Presenter view (notes + next slide)
- Remote control (mobile)
- Audience Q&A
- Live polls

**AI Features**:
- Auto-generate slides from outline
- Design suggestions
- Image recommendations
- Speaker notes generation

#### Database Schema

```sql
CREATE TABLE workspace.presentations (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    owner_id UUID NOT NULL,
    title VARCHAR(500) NOT NULL,
    theme JSONB DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    slide_order UUID[] DEFAULT '{}',
    is_template BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE workspace.presentation_slides (
    id UUID PRIMARY KEY,
    presentation_id UUID NOT NULL,
    layout VARCHAR(100) DEFAULT 'blank',
    content JSONB NOT NULL DEFAULT '{}',
    notes TEXT,
    transition JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

### 2.3 Bheem Forms

**Priority**: P0
**Effort**: 10 days
**Impact**: Critical - Data collection essential

#### Backend API

**File**: `/backend/api/forms.py`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/forms` | GET | List forms |
| `/forms` | POST | Create form |
| `/forms/{id}` | GET | Get form |
| `/forms/{id}` | PUT | Update form |
| `/forms/{id}` | DELETE | Delete form |
| `/forms/{id}/publish` | POST | Publish form |
| `/forms/{id}/unpublish` | POST | Unpublish form |
| `/forms/{id}/responses` | GET | Get responses |
| `/forms/{id}/responses/export` | POST | Export responses |
| `/forms/{id}/analytics` | GET | Response analytics |
| `/forms/public/{slug}` | GET | Get public form |
| `/forms/public/{slug}/submit` | POST | Submit response |
| `/forms/templates` | GET | List templates |

#### Features

**Form Builder**:
- Drag-and-drop builder
- Question types:
  - Short text
  - Long text (paragraph)
  - Multiple choice
  - Checkboxes
  - Dropdown
  - Linear scale (1-10)
  - Date picker
  - Time picker
  - File upload
  - Rating (stars)
  - Matrix/Grid
  - Section headers
  - Page breaks
- Required fields
- Field validation
- Conditional logic (show/hide based on answers)
- Custom thank you page

**Distribution**:
- Public link
- Email invitations
- Embed in website
- QR code
- Limit responses
- Close date
- Password protection

**Responses**:
- Real-time response view
- Summary charts
- Individual responses
- Export to Sheets/CSV
- Email notifications

**AI Features**:
- Generate form from description
- Suggest questions
- Analyze sentiment in responses

#### Database Schema

```sql
CREATE TABLE workspace.forms (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    owner_id UUID NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    slug VARCHAR(100) UNIQUE,
    questions JSONB NOT NULL DEFAULT '[]',
    settings JSONB DEFAULT '{}',
    theme JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'draft',
    response_count INT DEFAULT 0,
    is_template BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE workspace.form_responses (
    id UUID PRIMARY KEY,
    form_id UUID NOT NULL,
    respondent_id UUID,
    respondent_email VARCHAR(255),
    answers JSONB NOT NULL,
    submitted_at TIMESTAMP DEFAULT NOW(),
    ip_address INET
);
```

---

### 2.4 Bheem Drive (Enhanced File Management)

**Priority**: P1
**Effort**: 7 days
**Impact**: High - Central file storage

#### Backend API

**File**: `/backend/api/drive.py`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/drive/files` | GET | List files/folders |
| `/drive/files` | POST | Upload file |
| `/drive/files/{id}` | GET | Get file details |
| `/drive/files/{id}` | PUT | Update file |
| `/drive/files/{id}` | DELETE | Delete file |
| `/drive/files/{id}/download` | GET | Download file |
| `/drive/files/{id}/share` | POST | Share file |
| `/drive/files/{id}/copy` | POST | Copy file |
| `/drive/files/{id}/move` | POST | Move file |
| `/drive/folders` | POST | Create folder |
| `/drive/shared` | GET | Shared with me |
| `/drive/recent` | GET | Recent files |
| `/drive/starred` | GET | Starred files |
| `/drive/trash` | GET | Trash |
| `/drive/search` | GET | Search files |
| `/drive/storage` | GET | Storage usage |

#### Features
- Folder hierarchy
- File preview (docs, images, videos)
- File versions
- Sharing with permissions
- Public links
- Storage quotas
- Trash with 30-day retention
- Search by name, type, owner
- Star/favorite files
- Offline sync (desktop)

---

## PHASE 3: ADVANCED FEATURES (Week 11-16)

### 3.1 Enhanced Meet Features

#### 3.1.1 Breakout Rooms

**Priority**: P1
**Effort**: 5 days

**Backend API** (`/backend/api/meet.py` - extend):

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/meet/rooms/{id}/breakout` | POST | Create breakout rooms |
| `/meet/rooms/{id}/breakout` | GET | List breakout rooms |
| `/meet/rooms/{id}/breakout/{room_id}` | PUT | Update breakout room |
| `/meet/rooms/{id}/breakout/assign` | POST | Assign participants |
| `/meet/rooms/{id}/breakout/close` | POST | Close all breakout rooms |
| `/meet/rooms/{id}/breakout/broadcast` | POST | Broadcast message to all |

**Features**:
- Create 2-50 breakout rooms
- Auto-assign or manual assign
- Timer for breakout sessions
- Host can visit any room
- Broadcast message to all rooms
- Return all to main room

#### 3.1.2 Polls & Q&A

**Priority**: P2
**Effort**: 3 days

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/meet/rooms/{id}/polls` | POST | Create poll |
| `/meet/rooms/{id}/polls/{poll_id}/vote` | POST | Submit vote |
| `/meet/rooms/{id}/polls/{poll_id}/results` | GET | Get results |
| `/meet/rooms/{id}/qa` | GET | Get Q&A questions |
| `/meet/rooms/{id}/qa` | POST | Submit question |
| `/meet/rooms/{id}/qa/{question_id}/upvote` | POST | Upvote question |
| `/meet/rooms/{id}/qa/{question_id}/answer` | POST | Mark as answered |

#### 3.1.3 Whiteboard

**Priority**: P2
**Effort**: 7 days

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/meet/rooms/{id}/whiteboard` | POST | Create whiteboard |
| `/meet/rooms/{id}/whiteboard/{wb_id}` | GET | Get whiteboard |
| `/meet/rooms/{id}/whiteboard/{wb_id}/export` | POST | Export as image |

**Features**:
- Drawing tools (pen, shapes, text)
- Sticky notes
- Real-time collaboration
- Multiple pages
- Export to image/PDF

#### 3.1.4 Caption Translations

**Priority**: P2
**Effort**: 5 days

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/meet/rooms/{id}/captions/translate` | POST | Enable translation |
| `/meet/rooms/{id}/captions/languages` | GET | Available languages |

**Supported Languages**: English, Spanish, French, German, Hindi, Chinese, Japanese, Korean, Arabic, Portuguese

---

### 3.2 Enterprise Search

**Priority**: P1
**Effort**: 10 days
**Impact**: High - Unified search across all apps

#### Technology Stack
- **Search Engine**: Elasticsearch or Meilisearch
- **Indexing**: Background workers for real-time indexing
- **Frontend**: Unified search bar with filters

#### Backend API

**File**: `/backend/api/search.py`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/search` | GET | Search across all apps |
| `/search/mail` | GET | Search emails only |
| `/search/docs` | GET | Search documents |
| `/search/drive` | GET | Search files |
| `/search/calendar` | GET | Search events |
| `/search/chat` | GET | Search chat messages |
| `/search/suggestions` | GET | Search suggestions |
| `/search/recent` | GET | Recent searches |
| `/search/saved` | GET | Saved searches |
| `/search/saved` | POST | Save search |

**Search Features**:
- Unified search across Mail, Docs, Sheets, Slides, Drive, Calendar, Chat
- Filters by app, date, owner, file type
- Natural language queries ("emails from John last week")
- Spelling correction
- Search suggestions
- Highlighted results
- Saved searches
- Recent searches

**Query Examples**:
```
from:john@company.com has:attachment after:2024-01-01
type:spreadsheet owner:me modified:today
meeting with "product team" next week
```

#### Database (Elasticsearch Index)

```json
{
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "tenant_id": { "type": "keyword" },
      "type": { "type": "keyword" },
      "title": { "type": "text", "analyzer": "standard" },
      "content": { "type": "text", "analyzer": "standard" },
      "owner_id": { "type": "keyword" },
      "owner_name": { "type": "text" },
      "created_at": { "type": "date" },
      "updated_at": { "type": "date" },
      "tags": { "type": "keyword" },
      "permissions": { "type": "keyword" }
    }
  }
}
```

---

### 3.3 Email Enhancements

#### 3.3.1 Email Snooze

**Priority**: P2
**Effort**: 2 days

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mail/{id}/snooze` | POST | Snooze email |
| `/mail/snoozed` | GET | List snoozed emails |
| `/mail/{id}/unsnooze` | POST | Unsnooze email |

**Snooze Options**: Later today, Tomorrow, This weekend, Next week, Custom date/time

#### 3.3.2 Priority Inbox

**Priority**: P2
**Effort**: 5 days

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mail/priority` | GET | Get priority emails |
| `/mail/settings/priority` | PUT | Configure priority rules |

**Features**:
- AI-detected important emails on top
- Categories: Primary, Social, Promotions, Updates
- Learning from user behavior
- Manual priority override

#### 3.3.3 Email Templates

**Priority**: P2
**Effort**: 3 days

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mail/templates` | GET | List templates |
| `/mail/templates` | POST | Create template |
| `/mail/templates/{id}` | PUT | Update template |
| `/mail/templates/{id}` | DELETE | Delete template |

**Features**:
- Rich text templates
- Variables ({{name}}, {{company}})
- Shared team templates
- Quick insert in compose

---

### 3.4 Calendar Enhancements

#### 3.4.1 Find a Time

**Priority**: P1
**Effort**: 3 days

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/calendar/find-time` | POST | Find available slots |

**Request**:
```json
{
  "attendees": ["user1@company.com", "user2@company.com"],
  "duration_minutes": 60,
  "date_range": {
    "start": "2024-01-15",
    "end": "2024-01-22"
  },
  "working_hours_only": true
}
```

**Response**:
```json
{
  "available_slots": [
    { "start": "2024-01-15T10:00:00", "end": "2024-01-15T11:00:00" },
    { "start": "2024-01-15T14:00:00", "end": "2024-01-15T15:00:00" }
  ]
}
```

#### 3.4.2 Appointment Scheduling

**Priority**: P1
**Effort**: 5 days

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/calendar/appointment-types` | GET | List appointment types |
| `/calendar/appointment-types` | POST | Create appointment type |
| `/calendar/booking/{slug}` | GET | Get booking page |
| `/calendar/booking/{slug}/slots` | GET | Get available slots |
| `/calendar/booking/{slug}/book` | POST | Book appointment |

**Features**:
- Public booking page (like Calendly)
- Multiple appointment types (15min, 30min, 60min)
- Buffer between appointments
- Custom availability
- Integration with Meet (auto-create room)
- Email confirmations

---

## PHASE 4: ENTERPRISE & AUTOMATION (Week 17-22)

### 4.1 Workflow Automation (Bheem Flows)

**Priority**: P1
**Effort**: 15 days
**Impact**: High - Major differentiator

#### Technology Stack
- **Backend**: Custom workflow engine with RabbitMQ
- **Frontend**: Visual flow builder (React Flow)

#### Backend API

**File**: `/backend/api/workflows.py`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/workflows` | GET | List workflows |
| `/workflows` | POST | Create workflow |
| `/workflows/{id}` | GET | Get workflow |
| `/workflows/{id}` | PUT | Update workflow |
| `/workflows/{id}` | DELETE | Delete workflow |
| `/workflows/{id}/enable` | POST | Enable workflow |
| `/workflows/{id}/disable` | POST | Disable workflow |
| `/workflows/{id}/run` | POST | Manual run |
| `/workflows/{id}/runs` | GET | Execution history |
| `/workflows/{id}/runs/{run_id}` | GET | Run details |
| `/workflows/triggers` | GET | Available triggers |
| `/workflows/actions` | GET | Available actions |
| `/workflows/templates` | GET | Workflow templates |

#### Triggers

| Trigger | Description |
|---------|-------------|
| `mail.received` | New email received |
| `mail.sent` | Email sent |
| `calendar.event_created` | New event created |
| `calendar.event_starting` | Event starting (5min before) |
| `docs.created` | Document created |
| `docs.shared` | Document shared |
| `form.submitted` | Form response submitted |
| `user.joined` | User joined workspace |
| `schedule.daily` | Daily at specific time |
| `schedule.weekly` | Weekly on specific day |
| `webhook.received` | External webhook |

#### Actions

| Action | Description |
|--------|-------------|
| `mail.send` | Send email |
| `mail.forward` | Forward email |
| `mail.add_label` | Add label to email |
| `calendar.create_event` | Create calendar event |
| `chat.send_message` | Send chat message |
| `docs.create` | Create document |
| `sheets.add_row` | Add row to spreadsheet |
| `drive.move_file` | Move file |
| `notification.send` | Send notification |
| `webhook.call` | Call external API |
| `ai.summarize` | AI summarize content |
| `ai.translate` | AI translate |
| `condition` | If/else condition |
| `delay` | Wait for duration |
| `loop` | Loop over items |

#### Workflow Examples

**1. Auto-respond to specific emails**:
```json
{
  "name": "Auto-respond to support emails",
  "trigger": {
    "type": "mail.received",
    "conditions": {
      "to": "support@company.com"
    }
  },
  "actions": [
    {
      "type": "mail.send",
      "to": "{{trigger.from}}",
      "subject": "Re: {{trigger.subject}}",
      "body": "Thank you for contacting us. We'll respond within 24 hours."
    },
    {
      "type": "chat.send_message",
      "channel": "support-team",
      "message": "New support email from {{trigger.from}}: {{trigger.subject}}"
    }
  ]
}
```

**2. Meeting reminder with agenda**:
```json
{
  "name": "Send meeting agenda",
  "trigger": {
    "type": "calendar.event_starting",
    "minutes_before": 15
  },
  "actions": [
    {
      "type": "mail.send",
      "to": "{{trigger.attendees}}",
      "subject": "Reminder: {{trigger.title}} starts in 15 minutes",
      "body": "Meeting link: {{trigger.meet_link}}\n\nAgenda:\n{{trigger.description}}"
    }
  ]
}
```

**3. Form to Spreadsheet**:
```json
{
  "name": "Log form responses to sheet",
  "trigger": {
    "type": "form.submitted",
    "form_id": "contact-form"
  },
  "actions": [
    {
      "type": "sheets.add_row",
      "spreadsheet_id": "responses-sheet",
      "values": ["{{trigger.answers.name}}", "{{trigger.answers.email}}", "{{trigger.submitted_at}}"]
    },
    {
      "type": "notification.send",
      "to": "sales@company.com",
      "message": "New contact form submission from {{trigger.answers.name}}"
    }
  ]
}
```

#### Database Schema

```sql
CREATE TABLE workspace.workflows (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    owner_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger JSONB NOT NULL,
    actions JSONB NOT NULL DEFAULT '[]',
    is_enabled BOOLEAN DEFAULT FALSE,
    run_count INT DEFAULT 0,
    last_run_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE workspace.workflow_runs (
    id UUID PRIMARY KEY,
    workflow_id UUID NOT NULL,
    status VARCHAR(50) DEFAULT 'running',
    trigger_data JSONB,
    execution_log JSONB DEFAULT '[]',
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    error TEXT
);
```

---

### 4.2 AI Enhancements

**Priority**: P1
**Effort**: 10 days

#### Backend API

**File**: `/backend/api/ai.py`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/ai/chat` | POST | AI chat (like ChatGPT) |
| `/ai/summarize` | POST | Summarize content |
| `/ai/translate` | POST | Translate text |
| `/ai/compose` | POST | Compose email/doc |
| `/ai/analyze` | POST | Analyze data |
| `/ai/extract` | POST | Extract info from text |
| `/ai/generate-image` | POST | Generate image |

#### Features

**AI Assistant (Bheem AI)**:
- Contextual in every app
- Ask questions about your data
- Generate content
- Summarize documents
- Translate messages
- Analyze spreadsheet data

**Smart Features**:
- Email smart compose
- Document auto-complete
- Meeting summary generation
- Calendar smart scheduling
- Search query understanding

---

### 4.3 Data Loss Prevention (DLP)

**Priority**: P2
**Effort**: 7 days

#### Backend API

**File**: `/backend/api/dlp.py`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/dlp/rules` | GET | List DLP rules |
| `/admin/dlp/rules` | POST | Create rule |
| `/admin/dlp/rules/{id}` | PUT | Update rule |
| `/admin/dlp/rules/{id}` | DELETE | Delete rule |
| `/admin/dlp/incidents` | GET | View incidents |
| `/admin/dlp/incidents/{id}` | GET | Incident details |

**DLP Rules**:
- Detect credit card numbers
- Detect SSN/PAN numbers
- Detect custom patterns (regex)
- Block external sharing
- Warn before sending
- Require approval
- Log incidents

---

### 4.4 Device Management

**Priority**: P2
**Effort**: 5 days

#### Backend API

**File**: `/backend/api/devices.py`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/devices` | GET | List devices |
| `/admin/devices/{id}` | GET | Device details |
| `/admin/devices/{id}/block` | POST | Block device |
| `/admin/devices/{id}/wipe` | POST | Remote wipe |
| `/admin/devices/policies` | GET | Device policies |
| `/admin/devices/policies` | POST | Create policy |

**Features**:
- View all devices accessing workspace
- Block compromised devices
- Remote wipe company data
- Enforce password policies
- Require screen lock
- Track device location (optional)

---

## PHASE 5: MOBILE & DESKTOP APPS (Week 23-28)

### 5.1 Mobile Apps (iOS & Android)

**Priority**: P0
**Effort**: 20 days (parallel iOS + Android)
**Technology**: React Native

#### App Structure

```
/mobile
├── /src
│   ├── /screens
│   │   ├── /auth
│   │   │   ├── LoginScreen.tsx
│   │   │   └── SSOScreen.tsx
│   │   ├── /mail
│   │   │   ├── InboxScreen.tsx
│   │   │   ├── ComposeScreen.tsx
│   │   │   └── EmailDetailScreen.tsx
│   │   ├── /docs
│   │   │   ├── DocsListScreen.tsx
│   │   │   └── DocEditorScreen.tsx
│   │   ├── /meet
│   │   │   ├── MeetHomeScreen.tsx
│   │   │   └── MeetingRoomScreen.tsx
│   │   ├── /calendar
│   │   │   ├── CalendarScreen.tsx
│   │   │   └── EventDetailScreen.tsx
│   │   ├── /chat
│   │   │   ├── ChatListScreen.tsx
│   │   │   └── ConversationScreen.tsx
│   │   ├── /drive
│   │   │   ├── DriveScreen.tsx
│   │   │   └── FilePreviewScreen.tsx
│   │   └── /settings
│   │       └── SettingsScreen.tsx
│   ├── /components
│   ├── /services
│   ├── /stores
│   └── /utils
├── /ios
├── /android
└── package.json
```

#### Mobile Features

**Authentication**:
- Email/password login
- Biometric login (Face ID, fingerprint)
- SSO support
- Session management

**Mail**:
- Inbox, sent, drafts, folders
- Compose with rich text
- Attachments (camera, files)
- Push notifications
- Swipe actions (archive, delete)
- Offline support

**Docs/Sheets/Slides**:
- View documents
- Basic editing
- Comments
- Sharing

**Meet**:
- Join meetings
- Video/audio calls
- Screen sharing (device screen)
- Background blur

**Calendar**:
- View events
- Create/edit events
- RSVP to invitations
- Push reminders

**Chat**:
- All conversations
- Send messages
- File sharing
- Push notifications

**Drive**:
- Browse files
- Upload from camera/device
- Download for offline
- Share files

---

### 5.2 Desktop App (Windows & macOS)

**Priority**: P2
**Effort**: 15 days
**Technology**: Electron with React

#### App Structure

```
/desktop
├── /src
│   ├── /main          # Electron main process
│   │   ├── main.ts
│   │   ├── menu.ts
│   │   ├── tray.ts
│   │   └── ipc.ts
│   ├── /renderer      # React app (same as web)
│   │   ├── /pages
│   │   └── /components
│   ├── /shared
│   └── /utils
├── /build
├── package.json
└── electron-builder.yml
```

#### Desktop Features

**Unified Experience**:
- All apps in one window
- Sidebar navigation
- Multiple accounts
- Native notifications
- System tray icon
- Menu bar integration

**Offline Support**:
- Sync emails offline
- View cached documents
- Queue actions when offline

**Native Features**:
- Screen sharing (window/screen)
- File system access
- Keyboard shortcuts
- Auto-update

**Performance**:
- Background sync
- Low memory footprint
- Quick startup

---

## PHASE 6: POLISH & LAUNCH (Week 29-32)

### 6.1 Performance Optimization

- Database query optimization
- API response caching (Redis)
- CDN for static assets
- Image optimization
- Lazy loading
- Code splitting

### 6.2 Security Hardening

- Penetration testing
- Security audit
- OWASP compliance
- Data encryption review
- Access control audit

### 6.3 Documentation

- API documentation (OpenAPI/Swagger)
- User guides
- Admin guides
- Developer documentation
- Video tutorials

### 6.4 Testing

- Unit tests (80%+ coverage)
- Integration tests
- E2E tests (Playwright)
- Performance tests
- Load tests
- Security tests

### 6.5 Monitoring & Observability

- Application metrics (Prometheus)
- Logging (ELK Stack)
- Error tracking (Sentry)
- Uptime monitoring
- Performance monitoring
- User analytics

---

## DATABASE SCHEMA

### Complete Schema Additions

```sql
-- =============================================
-- PHASE 1: Admin Improvements
-- =============================================

-- Organizational Units
CREATE TABLE workspace.org_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES workspace.org_units(id),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- User Groups
CREATE TABLE workspace.user_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    group_type VARCHAR(50) DEFAULT 'distribution',
    description TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE workspace.user_group_members (
    group_id UUID NOT NULL REFERENCES workspace.user_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role VARCHAR(50) DEFAULT 'member',
    added_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);

-- Admin Roles
CREATE TABLE workspace.admin_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id),
    name VARCHAR(255) NOT NULL,
    permissions JSONB NOT NULL DEFAULT '[]',
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- SSO Configuration
CREATE TABLE workspace.sso_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID UNIQUE NOT NULL REFERENCES workspace.tenants(id),
    provider VARCHAR(100) NOT NULL,
    config JSONB NOT NULL,
    is_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- PHASE 2: Productivity Suite
-- =============================================

-- Spreadsheets
CREATE TABLE workspace.spreadsheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id),
    owner_id UUID NOT NULL,
    title VARCHAR(500) NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    is_template BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE workspace.spreadsheet_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spreadsheet_id UUID NOT NULL REFERENCES workspace.spreadsheets(id) ON DELETE CASCADE,
    user_id UUID,
    email VARCHAR(255),
    permission VARCHAR(50) DEFAULT 'view',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Presentations
CREATE TABLE workspace.presentations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id),
    owner_id UUID NOT NULL,
    title VARCHAR(500) NOT NULL,
    theme JSONB DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    slide_order UUID[] DEFAULT '{}',
    is_template BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE workspace.presentation_slides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    presentation_id UUID NOT NULL REFERENCES workspace.presentations(id) ON DELETE CASCADE,
    layout VARCHAR(100) DEFAULT 'blank',
    content JSONB NOT NULL DEFAULT '{}',
    notes TEXT,
    transition JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Forms
CREATE TABLE workspace.forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id),
    owner_id UUID NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    slug VARCHAR(100) UNIQUE,
    questions JSONB NOT NULL DEFAULT '[]',
    settings JSONB DEFAULT '{}',
    theme JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'draft',
    response_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE workspace.form_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES workspace.forms(id) ON DELETE CASCADE,
    respondent_email VARCHAR(255),
    answers JSONB NOT NULL,
    submitted_at TIMESTAMP DEFAULT NOW(),
    ip_address INET
);

-- =============================================
-- PHASE 3: Advanced Features
-- =============================================

-- Breakout Rooms
CREATE TABLE workspace.breakout_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_room_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    participants UUID[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    closed_at TIMESTAMP
);

-- Meeting Polls
CREATE TABLE workspace.meeting_polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_room_id UUID NOT NULL,
    question TEXT NOT NULL,
    options JSONB NOT NULL,
    votes JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Search Index Tracking
CREATE TABLE workspace.search_index_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    indexed_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- PHASE 4: Automation
-- =============================================

-- Workflows
CREATE TABLE workspace.workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id),
    owner_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger JSONB NOT NULL,
    actions JSONB NOT NULL DEFAULT '[]',
    is_enabled BOOLEAN DEFAULT FALSE,
    run_count INT DEFAULT 0,
    last_run_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE workspace.workflow_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workspace.workflows(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'running',
    trigger_data JSONB,
    execution_log JSONB DEFAULT '[]',
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    error TEXT
);

-- DLP Rules
CREATE TABLE workspace.dlp_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id),
    name VARCHAR(255) NOT NULL,
    pattern_type VARCHAR(50) NOT NULL,
    pattern TEXT NOT NULL,
    action VARCHAR(50) NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE workspace.dlp_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id),
    rule_id UUID NOT NULL REFERENCES workspace.dlp_rules(id),
    user_id UUID NOT NULL,
    content_type VARCHAR(100),
    content_id UUID,
    matched_content TEXT,
    action_taken VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- Indexes
-- =============================================

CREATE INDEX idx_org_units_tenant ON workspace.org_units(tenant_id);
CREATE INDEX idx_org_units_parent ON workspace.org_units(parent_id);
CREATE INDEX idx_user_groups_tenant ON workspace.user_groups(tenant_id);
CREATE INDEX idx_spreadsheets_tenant ON workspace.spreadsheets(tenant_id);
CREATE INDEX idx_spreadsheets_owner ON workspace.spreadsheets(owner_id);
CREATE INDEX idx_presentations_tenant ON workspace.presentations(tenant_id);
CREATE INDEX idx_forms_tenant ON workspace.forms(tenant_id);
CREATE INDEX idx_forms_slug ON workspace.forms(slug);
CREATE INDEX idx_form_responses_form ON workspace.form_responses(form_id);
CREATE INDEX idx_workflows_tenant ON workspace.workflows(tenant_id);
CREATE INDEX idx_workflow_runs_workflow ON workspace.workflow_runs(workflow_id);
```

---

## API REFERENCE

### Complete API Endpoints by Phase

#### Phase 1: Admin Improvements
| Module | Endpoints |
|--------|-----------|
| Bulk Import | 4 endpoints |
| Org Units | 8 endpoints |
| User Groups | 8 endpoints |
| Admin Roles | 5 endpoints |
| SSO | 8 endpoints |
| **Total** | **33 endpoints** |

#### Phase 2: Productivity Suite
| Module | Endpoints |
|--------|-----------|
| Sheets | 15 endpoints |
| Slides | 18 endpoints |
| Forms | 14 endpoints |
| Drive | 18 endpoints |
| **Total** | **65 endpoints** |

#### Phase 3: Advanced Features
| Module | Endpoints |
|--------|-----------|
| Breakout Rooms | 6 endpoints |
| Polls & Q&A | 7 endpoints |
| Whiteboard | 4 endpoints |
| Enterprise Search | 9 endpoints |
| Email Enhancements | 8 endpoints |
| Calendar Enhancements | 6 endpoints |
| **Total** | **40 endpoints** |

#### Phase 4: Enterprise & Automation
| Module | Endpoints |
|--------|-----------|
| Workflows | 12 endpoints |
| AI | 8 endpoints |
| DLP | 6 endpoints |
| Device Management | 6 endpoints |
| **Total** | **32 endpoints** |

### Grand Total: **170+ new endpoints**

---

## BEST PRACTICES

### 1. Code Organization

```
/backend
├── /api              # API routes by feature
│   ├── auth.py
│   ├── mail.py
│   ├── docs.py
│   ├── sheets.py
│   ├── slides.py
│   ├── forms.py
│   ├── meet.py
│   ├── calendar.py
│   ├── drive.py
│   ├── search.py
│   ├── workflows.py
│   └── admin/
│       ├── users.py
│       ├── org_units.py
│       ├── groups.py
│       ├── roles.py
│       ├── sso.py
│       ├── dlp.py
│       └── devices.py
├── /services         # Business logic
├── /models           # Database models
├── /schemas          # Pydantic schemas
├── /core             # Core utilities
└── /tests            # Test files

/frontend
├── /src
│   ├── /pages        # Next.js pages
│   ├── /components   # Reusable components
│   ├── /hooks        # Custom hooks
│   ├── /stores       # Zustand stores
│   ├── /services     # API services
│   ├── /utils        # Utilities
│   └── /types        # TypeScript types
└── /tests
```

### 2. API Design Principles

- RESTful endpoints
- Consistent naming (plural nouns)
- Proper HTTP methods (GET, POST, PUT, DELETE)
- Pagination for list endpoints
- Filtering and sorting support
- Proper error responses
- Rate limiting
- Request validation

### 3. Security Best Practices

- JWT with refresh tokens
- RBAC (Role-Based Access Control)
- Input validation
- SQL injection prevention
- XSS prevention
- CSRF protection
- Rate limiting
- Audit logging
- Encryption at rest and in transit

### 4. Performance Best Practices

- Database indexing
- Query optimization
- Redis caching
- CDN for static assets
- Lazy loading
- Code splitting
- Image optimization
- Gzip compression

### 5. Testing Strategy

- Unit tests: 80%+ coverage
- Integration tests: API endpoints
- E2E tests: Critical user flows
- Performance tests: Load testing
- Security tests: Penetration testing

---

## TIMELINE SUMMARY

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1 | Week 1-4 | Bulk import, Org units, Groups, SSO |
| Phase 2 | Week 5-10 | Sheets, Slides, Forms, Drive |
| Phase 3 | Week 11-16 | Breakout rooms, Search, Email/Calendar enhancements |
| Phase 4 | Week 17-22 | Workflows, AI, DLP, Device management |
| Phase 5 | Week 23-28 | Mobile apps, Desktop app |
| Phase 6 | Week 29-32 | Polish, Testing, Documentation, Launch |

**Total Duration**: 32 weeks (8 months)

---

## CONCLUSION

This implementation plan brings Bheem Workspace to full Google Workspace/Zoho Workplace parity with:

- **Core Apps**: Mail, Docs, Sheets, Slides, Forms, Meet, Calendar, Chat, Drive
- **Enterprise Features**: SSO, DLP, Device Management, Audit Logs
- **Automation**: Workflow builder, AI integration
- **Search**: Enterprise-wide unified search
- **Mobile**: iOS and Android apps
- **Desktop**: Windows and macOS app

The dual-mode architecture ensures both internal employees (ERP-integrated) and external customers (self-service) have a seamless experience with proper isolation and customization.

