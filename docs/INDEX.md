# Bheem Platform - Developer Documentation Index

## Overview

The Bheem Platform is a comprehensive enterprise suite consisting of multiple integrated services:

```
BHEEM PLATFORM
├── bheem-core         → ERP System (Accounting, HR, CRM, Sales, Inventory)
├── bheem-workspace    → Collaboration Suite (Meet, Docs, Mail, Calendar)
├── bheem-academy      → Learning Management System
├── bheem-notify       → Notification Service (Email, SMS, Push)
└── bheem-passport     → SSO & Identity Provider
```

---

## Quick Links

| Document | Description | Location |
|----------|-------------|----------|
| **Workspace Developer Guide** | Complete workspace integration and admin module | [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) |
| **Admin Module Recommendations** | Domain, Customer, Developer management | [ADMIN_MODULE_RECOMMENDATIONS.md](../ADMIN_MODULE_RECOMMENDATIONS.md) |
| **Integration Recommendations** | Meet, Calendar, Docs integration | [INTEGRATION_RECOMMENDATIONS.md](../INTEGRATION_RECOMMENDATIONS.md) |
| **bheem-core Modules** | ERP module documentation | [BHEEM_CORE_MODULES.md](./BHEEM_CORE_MODULES.md) |
| **bheem-academy Guide** | LMS integration guide | [BHEEM_ACADEMY_GUIDE.md](./BHEEM_ACADEMY_GUIDE.md) |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BHEEM PLATFORM                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        USER INTERFACES                                  │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │ │
│  │  │   ERP    │ │Workspace │ │ Academy  │ │  Mobile  │ │  Admin   │     │ │
│  │  │ Frontend │ │ Frontend │ │ Frontend │ │   Apps   │ │  Panel   │     │ │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘     │ │
│  └───────┼────────────┼────────────┼────────────┼────────────┼───────────┘ │
│          │            │            │            │            │              │
│          ▼            ▼            ▼            ▼            ▼              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        API GATEWAY / TRAEFIK                            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│          │            │            │            │            │              │
│          ▼            ▼            ▼            ▼            ▼              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         BACKEND SERVICES                                │ │
│  │                                                                         │ │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐               │ │
│  │  │  BHEEM-CORE   │  │BHEEM-WORKSPACE│  │ BHEEM-ACADEMY │               │ │
│  │  │  (Port 8000)  │  │  (Port 8500)  │  │  (Port 8030)  │               │ │
│  │  │               │  │               │  │               │               │ │
│  │  │ ├─ Auth       │  │ ├─ Meet       │  │ ├─ Courses    │               │ │
│  │  │ ├─ Accounting │  │ ├─ Docs       │  │ ├─ Quizzes    │               │ │
│  │  │ ├─ CRM        │  │ ├─ Mail       │  │ ├─ Grades     │               │ │
│  │  │ ├─ HR         │  │ ├─ Calendar   │  │ ├─ Forums     │               │ │
│  │  │ ├─ Sales      │  │ ├─ SSO        │  │ └─ Badges     │               │ │
│  │  │ ├─ Inventory  │  │ └─ Admin      │  │               │               │ │
│  │  │ └─ Projects   │  │               │  │               │               │ │
│  │  └───────────────┘  └───────────────┘  └───────────────┘               │ │
│  │                                                                         │ │
│  │  ┌───────────────┐  ┌───────────────┐                                  │ │
│  │  │ BHEEM-NOTIFY  │  │BHEEM-PASSPORT │                                  │ │
│  │  │  (Port 8040)  │  │  (Port 8010)  │                                  │ │
│  │  │               │  │               │                                  │ │
│  │  │ ├─ Email      │  │ ├─ OAuth2     │                                  │ │
│  │  │ ├─ SMS        │  │ ├─ OIDC       │                                  │ │
│  │  │ └─ Push       │  │ └─ Sessions   │                                  │ │
│  │  └───────────────┘  └───────────────┘                                  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
│                                    ▼                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        DATA & EXTERNAL SERVICES                         │ │
│  │                                                                         │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │ │
│  │  │ PostgreSQL  │ │   Redis     │ │  LiveKit    │ │  Nextcloud  │       │ │
│  │  │ (Multi-DB)  │ │  (Cache)    │ │   (Meet)    │ │(Docs/CalDAV)│       │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘       │ │
│  │                                                                         │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │ │
│  │  │   Mailgun   │ │ Cloudflare  │ │   Mailcow   │ │   MSG91     │       │ │
│  │  │   (Email)   │ │    (DNS)    │ │   (Mail)    │ │  (SMS/OTP)  │       │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘       │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Service Directory

### bheem-core (ERP System)
**Repository**: `/root/bheem-core`
**Port**: 8000
**Database**: Per-tenant isolation (database-per-tenant)

| Module | Description | Status |
|--------|-------------|--------|
| Auth | User authentication, 2FA, sessions | Active |
| Accounting | GL, AP/AR, invoicing, reports | Active |
| CRM | Customer relationship management | Active |
| HR | Employee management, departments | Active |
| Sales | Orders, customers, pricing | Active |
| Purchase | Vendor management, POs | Active |
| Inventory | Stock, movements, warehouses | Active |
| Project Management | Projects, tasks, timesheets | Active |
| DMS | Document management | Active |
| Communication | Notifications, messaging | Active |

### bheem-workspace (Collaboration Suite)
**Repository**: `/root/bheem-workspace`
**Port**: 8500
**Database**: Shared ERP database + workspace schema

| Module | Description | Integration |
|--------|-------------|-------------|
| Meet | Video conferencing | LiveKit |
| Docs | Document storage | Nextcloud WebDAV |
| Mail | Email management | Mailcow |
| Calendar | Events & scheduling | Nextcloud CalDAV |
| SSO | OAuth2/OIDC provider | Internal |
| Admin | Tenant/User/Domain management | Internal |

### bheem-academy (LMS)
**Repository**: `/root/bheem-academy`
**Port**: 8030
**Database**: Moodle DB (read) + ERP DB (auth)

| Feature | Description |
|---------|-------------|
| Courses | Catalog, enrollment, content |
| Quizzes | MCQ, essay, timed tests |
| Assignments | Submissions, grading |
| Forums | Discussions, Q&A |
| Badges | Achievements, certificates |
| Grades | Gradebook, reports |

### bheem-notify (Notification Service)
**Repository**: `/root/bheem-platform/services/bheem-notify`
**Port**: 8040

| Channel | Provider |
|---------|----------|
| Email | Mailgun / ZeptoMail |
| SMS | MSG91 |
| OTP | MSG91 |
| Push | Firebase (planned) |

---

## Multi-Tenant Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    TENANT ISOLATION MODEL                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   MASTER DATABASE                           │ │
│  │  - Platform configuration                                   │ │
│  │  - Tenant registry                                          │ │
│  │  - Global settings                                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│          ┌───────────────────┼───────────────────┐              │
│          ▼                   ▼                   ▼              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐        │
│  │   TENANT A   │   │   TENANT B   │   │   TENANT C   │        │
│  │   Database   │   │   Database   │   │   Database   │        │
│  │              │   │              │   │              │        │
│  │ ├─ auth.*    │   │ ├─ auth.*    │   │ ├─ auth.*    │        │
│  │ ├─ sales.*   │   │ ├─ sales.*   │   │ ├─ sales.*   │        │
│  │ ├─ hr.*      │   │ ├─ hr.*      │   │ ├─ hr.*      │        │
│  │ └─ ...       │   │ └─ ...       │   │ └─ ...       │        │
│  └──────────────┘   └──────────────┘   └──────────────┘        │
│                                                                  │
│  Key Files:                                                      │
│  - bheem-core/app/core/tenant_context.py                        │
│  - bheem-core/app/core/tenant_db_manager.py                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Role Hierarchy

```python
class UserRole(str, Enum):
    # Platform Level
    SUPERADMIN = "SuperAdmin"        # Bheem platform staff

    # Company Level
    ADMIN = "Admin"                  # Company administrator

    # Department Level
    ACCOUNTANT = "Accountant"
    HR = "HR"
    SALES_MANAGER = "SalesManager"
    PROJECT_MANAGER = "ProjectManager"
    WAREHOUSE_MANAGER = "WarehouseManager"

    # Employee Level
    SALES_REP = "SalesRep"
    EMPLOYEE = "Employee"

    # Read-Only
    VIEWER = "Viewer"

    # External
    CUSTOMER = "Customer"            # B2B customer portal

    # Developer (Workspace)
    LEAD_DEVELOPER = "LeadDeveloper"
    DEVELOPER = "Developer"
    JUNIOR_DEVELOPER = "JuniorDeveloper"
```

---

## API Authentication

All APIs use JWT-based authentication:

```bash
# Login to get token
curl -X POST https://api.bheem.cloud/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "user", "password": "pass"}'

# Use token for API calls
curl https://api.bheem.cloud/api/v1/users/me \
  -H "Authorization: Bearer <access_token>"
```

### SSO Integration

For cross-service authentication, use Bheem Passport:

```python
# OAuth2 Authorization URL
https://workspace.bheem.cloud/api/v1/sso/authorize
  ?client_id=your-app
  &redirect_uri=https://your-app.com/callback
  &response_type=code
  &scope=openid profile email

# Token Exchange
POST https://workspace.bheem.cloud/api/v1/sso/token
```

---

## Environment Configuration

### Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/erp_staging

# JWT
SECRET_KEY=your-secret-key
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Email (Mailgun)
MAILGUN_API_KEY=your-api-key
MAILGUN_DOMAIN=bheem.co.uk

# DNS (Cloudflare)
CLOUDFLARE_API_TOKEN=your-token

# Video (LiveKit)
LIVEKIT_API_KEY=your-key
LIVEKIT_API_SECRET=your-secret
LIVEKIT_URL=wss://meet.bheem.cloud

# Docs/Calendar (Nextcloud)
NEXTCLOUD_URL=https://docs.bheem.cloud
NEXTCLOUD_ADMIN_USER=admin
NEXTCLOUD_ADMIN_PASS=password

# Mail Server (Mailcow)
MAILCOW_API_KEY=your-key
MAILCOW_API_URL=https://mail.bheem.cloud/api/v1

# SMS/OTP (MSG91)
MSG91_AUTH_KEY=your-key
```

---

## Development Workflow

### 1. Local Development

```bash
# Clone repositories
git clone https://github.com/Bheem-Platform/bheem-core.git
git clone https://github.com/Bheem-Platform/bheem-workspace.git
git clone https://github.com/Bheem-Platform/bheem-academy.git

# Setup virtual environment
cd bheem-workspace/backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run development server
uvicorn main:app --host 0.0.0.0 --port 8500 --reload
```

### 2. Database Migrations

```bash
# bheem-core uses Alembic
cd bheem-core/apps/backend
alembic upgrade head

# Generate new migration
alembic revision --autogenerate -m "Description"
```

### 3. Testing

```bash
# Run tests
pytest app/tests/

# With coverage
pytest --cov=app --cov-report=html
```

---

## Deployment

### Production URLs

| Service | URL |
|---------|-----|
| ERP Frontend | https://erp.bheem.cloud |
| Workspace | https://workspace.bheem.cloud |
| Academy | https://academy.bheem.cloud |
| Meet | https://meet.bheem.cloud |
| Docs | https://docs.bheem.cloud |
| Mail | https://mail.bheem.cloud |
| IDE | https://bheem.co.uk/ide |

### Docker Deployment

```yaml
# docker-compose.yml
services:
  bheem-core:
    image: bheem/core:latest
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=${DATABASE_URL}

  bheem-workspace:
    image: bheem/workspace:latest
    ports:
      - "8500:8500"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - LIVEKIT_URL=${LIVEKIT_URL}
```

---

## Support

- **GitHub Issues**: https://github.com/Bheem-Platform/bheem-core/issues
- **Documentation**: This folder
- **API Docs**: https://api.bheem.cloud/docs

---

*Document Version: 1.0*
*Last Updated: December 26, 2025*
