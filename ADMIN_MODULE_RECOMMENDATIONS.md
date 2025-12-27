# Bheem Workspace - Admin Module Recommendations

## Analysis Summary

### Existing Architecture

#### bheem-core (ERP System)
```
apps/backend/app/
├── core/
│   ├── tenant_context.py      → Multi-tenant context (per-request)
│   ├── tenant_db_manager.py   → Database-per-tenant isolation
│   ├── auth_dependencies.py   → JWT/Auth handling
│   └── bheem_passport_client.py → SSO client
├── modules/
│   ├── auth/                  → User auth, sessions, 2FA, audit logs
│   ├── accounting/            → Full accounting module
│   ├── crm/                   → Customer relationship management
│   ├── hr/                    → Human resources
│   ├── inventory/             → Stock management
│   ├── sales/                 → Sales & customers
│   ├── purchase/              → Purchasing
│   ├── project_management/    → Projects & tasks
│   ├── dms/                   → Document management
│   ├── communication/         → Notifications
│   └── dynamic_features/      → Extensibility
└── shared/
    └── models.py              → UserRole enum, shared models
```

**Existing UserRole Enum (bheem-core):**
```python
class UserRole(str, enum.Enum):
    SUPERADMIN = "SuperAdmin"      # Platform admin
    ADMIN = "Admin"                # Company admin
    ACCOUNTANT = "Accountant"
    HR = "HR"
    EMPLOYEE = "Employee"
    SALES_MANAGER = "SalesManager"
    SALES_REP = "SalesRep"
    VIEWER = "Viewer"
    PROJECT_MANAGER = "ProjectManager"
    WAREHOUSE_MANAGER = "WarehouseManager"
    CUSTOMER = "Customer"          # B2B customer portal
```

**Multi-Tenant Architecture:**
- Each tenant (company) gets dedicated PostgreSQL database
- `tenant_context.py` manages per-request tenant isolation
- `tenant_db_manager.py` handles database lifecycle (create, migrate, seed)

#### bheem-workspace (Current State)
```
backend/
├── api/
│   ├── admin.py       → In-memory tenant/user management (needs DB)
│   ├── tenants.py     → Basic CRUD (in-memory)
│   ├── auth.py        → ERP-based auth (auth.users table)
│   └── sso.py         → OAuth2/OIDC provider
├── services/
│   ├── sso_service.py      → Token management
│   ├── mailcow_service.py  → Mail server
│   └── notify_client.py    → Notifications
└── core/
    └── database.py    → ERP database connection
```

---

## Updated Recommendations

### 1. Domain Admin Module

**Integrate with bheem-core multi-tenant system:**

```
New: api/domains.py + services/domain_service.py
┌─────────────────────────────────────────────────────────────────┐
│ DOMAIN MANAGEMENT (Per Tenant)                                  │
├─────────────────────────────────────────────────────────────────┤
│ POST   /api/v1/admin/domains           → Add domain to tenant   │
│ GET    /api/v1/admin/domains           → List tenant domains    │
│ GET    /api/v1/admin/domains/{id}      → Get domain details     │
│ GET    /api/v1/admin/domains/{id}/dns  → Get DNS records        │
│ POST   /api/v1/admin/domains/{id}/verify → Trigger verification │
│ DELETE /api/v1/admin/domains/{id}      → Remove domain          │
├─────────────────────────────────────────────────────────────────┤
│ INTEGRATIONS                                                    │
│ • Mailgun API  → Sending domain management                      │
│ • Cloudflare API → DNS record management                        │
│ • Mailcow API  → Receiving domain (if self-hosted mail)         │
└─────────────────────────────────────────────────────────────────┘
```

**Database Schema (add to bheem-core shared models):**
```sql
-- Schema: workspace (new schema in tenant databases)
CREATE SCHEMA IF NOT EXISTS workspace;

CREATE TABLE workspace.domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,  -- Links to public.companies
    domain VARCHAR(255) NOT NULL UNIQUE,
    domain_type VARCHAR(20) NOT NULL DEFAULT 'email',
    -- Provider references
    mailgun_domain_id VARCHAR(100),
    cloudflare_zone_id VARCHAR(50),
    -- Verification status
    spf_verified BOOLEAN DEFAULT FALSE,
    dkim_verified BOOLEAN DEFAULT FALSE,
    mx_verified BOOLEAN DEFAULT FALSE,
    is_primary BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    verified_at TIMESTAMP,
    created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE workspace.domain_dns_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID REFERENCES workspace.domains(id) ON DELETE CASCADE,
    record_type VARCHAR(10) NOT NULL,  -- TXT, CNAME, MX
    name VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    priority INTEGER,  -- For MX records
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

### 2. Customer Management Module (Full Admin)

**Leverage bheem-core's existing role system:**

```
┌─────────────────────────────────────────────────────────────────┐
│ ROLE HIERARCHY (Extended)                                       │
├─────────────────────────────────────────────────────────────────┤
│ SUPERADMIN (Bheem Platform Staff)                               │
│ ├── Full platform access                                        │
│ ├── Manage all tenants/companies                                │
│ ├── View all billing & usage                                    │
│ └── System configuration                                        │
├─────────────────────────────────────────────────────────────────┤
│ ADMIN (Customer's Company Admin)                                │
│ ├── Manage own company users                                    │
│ ├── Manage company domains                                      │
│ ├── View company billing                                        │
│ └── Configure company settings                                  │
├─────────────────────────────────────────────────────────────────┤
│ MANAGER (Department Manager)                                    │
│ ├── Manage team members                                         │
│ ├── View team reports                                           │
│ └── Limited admin functions                                     │
├─────────────────────────────────────────────────────────────────┤
│ EMPLOYEE/MEMBER                                                 │
│ └── Use workspace features (mail, meet, docs)                   │
└─────────────────────────────────────────────────────────────────┘
```

**API Endpoints:**
```
# SUPERADMIN APIs (Platform Level)
GET    /api/v1/platform/customers         → List all customers
POST   /api/v1/platform/customers         → Create customer (+ tenant DB)
GET    /api/v1/platform/customers/{id}    → Customer details
PATCH  /api/v1/platform/customers/{id}    → Update customer
POST   /api/v1/platform/customers/{id}/suspend  → Suspend
POST   /api/v1/platform/customers/{id}/activate → Activate
GET    /api/v1/platform/customers/{id}/usage    → Usage stats
GET    /api/v1/platform/billing           → Platform billing

# ADMIN APIs (Customer Level - uses tenant context)
GET    /api/v1/admin/organization         → Own org details
PATCH  /api/v1/admin/organization         → Update org settings
GET    /api/v1/admin/users                → List org users
POST   /api/v1/admin/users                → Create user
PATCH  /api/v1/admin/users/{id}           → Update user
DELETE /api/v1/admin/users/{id}           → Deactivate user
GET    /api/v1/admin/billing              → Org billing & usage
```

**Integration with bheem-core:**
```python
# Use existing tenant_db_manager for customer onboarding
from app.core.tenant_db_manager import get_tenant_db_manager

async def create_customer(customer_data):
    db_manager = get_tenant_db_manager()

    # 1. Create tenant database
    db_name = generate_db_name(customer_data.slug)
    db_url = await db_manager.create_database(db_name)

    # 2. Run migrations
    await db_manager.run_migrations_async(db_url)

    # 3. Seed initial data
    await db_manager.seed_initial_data(db_url, company_id, config)

    # 4. Add domain to Mailgun
    await domain_service.add_domain(customer_data.domain)

    return customer
```

---

### 3. Multi-Developer Access System

**New roles to add to UserRole enum:**
```python
# Add to bheem-core shared/models.py UserRole enum
class UserRole(str, enum.Enum):
    # ... existing roles ...

    # Developer roles (new)
    LEAD_DEVELOPER = "LeadDeveloper"
    DEVELOPER = "Developer"
    JUNIOR_DEVELOPER = "JuniorDeveloper"
```

**Developer Access Table:**
```sql
CREATE TABLE workspace.developers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    role VARCHAR(30) NOT NULL,  -- LeadDeveloper, Developer, JuniorDeveloper
    ssh_public_key TEXT,
    github_username VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE workspace.developer_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    developer_id UUID REFERENCES workspace.developers(id) ON DELETE CASCADE,
    project_name VARCHAR(100) NOT NULL,  -- e.g., 'bheem-workspace', 'bheem-notify'
    access_level VARCHAR(20) NOT NULL,   -- read, write, admin
    git_branch_pattern VARCHAR(100),     -- e.g., 'feature/*', 'develop'
    granted_at TIMESTAMP DEFAULT NOW(),
    granted_by UUID REFERENCES auth.users(id)
);

CREATE TABLE workspace.developer_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    developer_id UUID REFERENCES workspace.developers(id),
    action VARCHAR(50) NOT NULL,
    project_name VARCHAR(100),
    details JSONB,
    ip_address INET,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**API Endpoints:**
```
# Developer Management (SUPERADMIN/LEAD_DEVELOPER only)
GET    /api/v1/admin/developers           → List developers
POST   /api/v1/admin/developers           → Add developer
GET    /api/v1/admin/developers/{id}      → Developer details
PATCH  /api/v1/admin/developers/{id}      → Update developer
DELETE /api/v1/admin/developers/{id}      → Remove access
POST   /api/v1/admin/developers/{id}/projects → Assign to project
DELETE /api/v1/admin/developers/{id}/projects/{project} → Remove from project
GET    /api/v1/admin/developers/{id}/activity → Activity log

# IDE Integration
GET    /api/v1/developer/projects         → My projects
GET    /api/v1/developer/ssh-key          → Get SSH key setup
POST   /api/v1/developer/ssh-key          → Update SSH key
```

**IDE (code-server) Integration:**
```yaml
# code-server config with SSO
bind-addr: 0.0.0.0:8080
auth: none  # Use reverse proxy auth
cert: false

# Traefik middleware for SSO
http:
  middlewares:
    developer-auth:
      forwardAuth:
        address: "http://workspace.bheem.cloud/api/v1/developer/verify"
        authResponseHeaders:
          - "X-Developer-Id"
          - "X-Developer-Role"
          - "X-Developer-Projects"
```

---

### 4. Implementation Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     BHEEM PLATFORM                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  BHEEM WORKSPACE                         │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │   │
│  │  │  Domain  │ │ Customer │ │Developer │ │  SSO     │    │   │
│  │  │  Admin   │ │  Admin   │ │  Access  │ │ Provider │    │   │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘    │   │
│  └───────┼────────────┼────────────┼────────────┼──────────┘   │
│          │            │            │            │               │
│  ┌───────┴────────────┴────────────┴────────────┴──────────┐   │
│  │                    BHEEM CORE                            │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │   │
│  │  │  Auth   │ │ Tenant  │ │  Event  │ │  Shared │        │   │
│  │  │ Module  │ │   DB    │ │   Bus   │ │ Models  │        │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│  ┌───────────────────────────┴─────────────────────────────┐   │
│  │                    EXTERNAL SERVICES                     │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │   │
│  │  │ Mailgun │ │Cloudflare│ │ Mailcow │ │ LiveKit │        │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

### 5. API Credentials Management

Store in bheem-workspace `.env`:
```bash
# Database (shared with bheem-core)
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/erp_staging

# Email Provider
MAILGUN_API_KEY=xxx
MAILGUN_DOMAIN=bheem.co.uk

# DNS Provider
CLOUDFLARE_API_TOKEN=xxx

# Mail Server (optional - for receiving)
MAILCOW_API_KEY=xxx
MAILCOW_API_URL=https://mail.bheem.cloud/api/v1

# Notification Service
MSG91_AUTH_KEY=xxx
```

---

### 6. Implementation Priority

| Phase | Module | Description | Effort |
|-------|--------|-------------|--------|
| 1 | Database Migration | Move admin.py from in-memory to PostgreSQL | 2 days |
| 2 | Domain Admin | Mailgun + Cloudflare integration | 3 days |
| 3 | Customer Admin | Multi-tenant management with bheem-core | 2 days |
| 4 | Developer Access | Role-based IDE access | 2 days |
| 5 | Activity Logging | Audit trail for all actions | 1 day |

---

### 7. Files to Create/Modify

**New Files:**
```
bheem-workspace/backend/
├── api/
│   ├── domains.py          # Domain management API
│   ├── platform.py         # SuperAdmin platform APIs
│   └── developers.py       # Developer management API
├── services/
│   ├── domain_service.py   # Mailgun/Cloudflare integration
│   ├── mailgun_service.py  # Mailgun API wrapper
│   └── cloudflare_service.py # Cloudflare API wrapper
└── models/
    ├── domain.py           # SQLAlchemy models
    └── developer.py        # Developer models
```

**Modify:**
```
bheem-core/apps/backend/app/shared/models.py
  → Add LEAD_DEVELOPER, DEVELOPER, JUNIOR_DEVELOPER to UserRole

bheem-workspace/backend/api/admin.py
  → Replace in-memory storage with database queries
  → Add tenant context support
```

---

*Document Created: December 26, 2025*
*Based on analysis of bheem-core and bheem-workspace codebases*
