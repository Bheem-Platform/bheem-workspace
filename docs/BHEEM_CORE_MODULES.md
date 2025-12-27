# Bheem Core - ERP Modules Documentation

## Overview

Bheem Core is a modular ERP system built with FastAPI, SQLAlchemy, and PostgreSQL. Each business domain is implemented as an independent module with event-driven communication.

**Repository**: `/root/bheem-core`
**Tech Stack**: FastAPI, SQLAlchemy 2.0, PostgreSQL, Alembic, Redis

---

## Architecture

```
bheem-core/apps/backend/app/
├── core/                           # Core system components
│   ├── base_module.py              # Abstract base for modules
│   ├── database.py                 # Database configuration
│   ├── erp_system.py               # Main ERP manager
│   ├── event_bus.py                # Inter-module events
│   ├── tenant_context.py           # Multi-tenant context
│   ├── tenant_db_manager.py        # Database-per-tenant
│   ├── auth_dependencies.py        # JWT/Auth handling
│   └── bheem_passport_client.py    # SSO client
│
├── modules/                        # Business modules
│   ├── auth/                       # Authentication & Authorization
│   ├── accounting/                 # Financial Management
│   ├── crm/                        # Customer Relationship Management
│   ├── hr/                         # Human Resources
│   ├── sales/                      # Sales & Customers
│   ├── purchase/                   # Purchasing & Vendors
│   ├── inventory/                  # Stock Management
│   ├── project_management/         # Projects & Tasks
│   ├── dms/                        # Document Management
│   ├── communication/              # Notifications
│   └── dynamic_features/           # Extensibility
│
└── shared/                         # Shared components
    ├── models.py                   # UserRole, Activity, etc.
    └── schemas.py                  # Shared Pydantic schemas
```

---

## Module Structure

Each module follows a standard structure:

```
app/modules/{module_name}/
├── __init__.py
├── core/
│   ├── models/                 # SQLAlchemy models
│   │   └── {entity}_models.py
│   ├── schemas/                # Pydantic schemas
│   │   └── {entity}_schemas.py
│   └── services/               # Business logic
│       └── {entity}_service.py
├── routes/
│   └── {entity}_routes.py      # FastAPI endpoints
├── module.py                   # Module registration
├── README.md                   # Module documentation
└── tests/
    └── test_{entity}.py
```

---

## 1. Auth Module

**Path**: `app/modules/auth/`
**Schema**: `auth.*`

### Features

| Feature | Description |
|---------|-------------|
| User Management | CRUD, activation, suspension |
| Authentication | Login, logout, JWT tokens |
| 2FA | TOTP, backup codes |
| Sessions | Multi-device, revocation |
| Password | Reset, history, complexity |
| Audit Logs | Security event tracking |

### Models

```python
# auth.users
class User(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "auth"}

    id = Column(UUID, primary_key=True)
    username = Column(String(100), unique=True)
    email = Column(String(320), index=True)
    hashed_password = Column(String(255))
    role = Column(PGEnum(UserRole))
    is_active = Column(Boolean, default=True)
    is_banned = Column(Boolean, default=False)
    company_id = Column(UUID, ForeignKey("public.companies.id"))

    # 2FA
    totp_secret = Column(String(32))
    totp_enabled = Column(Boolean, default=False)
    backup_codes = Column(JSON)

    # Timestamps
    created_at = Column(DateTime)
    last_login_at = Column(DateTime)

# auth.user_sessions
class UserSession(Base):
    __tablename__ = "user_sessions"
    __table_args__ = {"schema": "auth"}

    id = Column(UUID, primary_key=True)
    user_id = Column(UUID, ForeignKey("auth.users.id"))
    token_hash = Column(String(64), unique=True)
    ip_address = Column(String(45))
    device_name = Column(String(100))
    expires_at = Column(DateTime)

# auth.auth_audit_logs
class AuthAuditLog(Base):
    __tablename__ = "auth_audit_logs"
    __table_args__ = {"schema": "auth"}

    id = Column(UUID, primary_key=True)
    event_type = Column(String(50))
    user_id = Column(UUID)
    ip_address = Column(String(45))
    success = Column(Boolean)
    details = Column(JSON)
```

### API Endpoints

```
POST   /auth/login              # User login
POST   /auth/logout             # User logout
POST   /auth/refresh            # Refresh token
POST   /auth/password/change    # Change password
POST   /auth/password/reset     # Request password reset
GET    /auth/users/             # List users
POST   /auth/users/             # Create user
GET    /auth/users/{id}         # Get user
PATCH  /auth/users/{id}         # Update user
POST   /auth/users/{id}/activate # Activate user
POST   /auth/users/{id}/suspend  # Suspend user
GET    /auth/sessions/          # List sessions
DELETE /auth/sessions/{id}      # Revoke session
POST   /auth/2fa/setup          # Setup 2FA
POST   /auth/2fa/verify         # Verify 2FA code
```

### Events Published

```python
"auth.user.created"      # New user registered
"auth.login.success"     # Successful login
"auth.login.failed"      # Failed login attempt
"auth.password.changed"  # Password changed
"auth.session.expired"   # Session expired
"auth.role.assigned"     # Role assigned to user
```

---

## 2. Accounting Module

**Path**: `app/modules/accounting/`
**Schema**: `accounting.*`

### Features

| Feature | Description |
|---------|-------------|
| Chart of Accounts | Account management, types |
| Journal Entries | Double-entry bookkeeping |
| Invoices | AR invoices, PDF generation |
| Bills | AP bills, vendor payments |
| Payments | Payment processing |
| Reports | Balance sheet, P&L, trial balance |
| Bank Reconciliation | Transaction matching |

### Models

```python
# accounting.accounts
class Account(Base):
    __tablename__ = "accounts"
    __table_args__ = {"schema": "accounting"}

    id = Column(UUID, primary_key=True)
    code = Column(String(20), unique=True)
    name = Column(String(255))
    account_type = Column(String(50))  # asset, liability, equity, revenue, expense
    parent_id = Column(UUID, ForeignKey("accounting.accounts.id"))
    is_active = Column(Boolean, default=True)
    balance = Column(Numeric(15, 2), default=0)

# accounting.journal_entries
class JournalEntry(Base):
    __tablename__ = "journal_entries"
    __table_args__ = {"schema": "accounting"}

    id = Column(UUID, primary_key=True)
    entry_number = Column(String(50), unique=True)
    entry_date = Column(Date)
    description = Column(Text)
    status = Column(String(20))  # draft, posted, cancelled
    total_debit = Column(Numeric(15, 2))
    total_credit = Column(Numeric(15, 2))

# accounting.journal_lines
class JournalLine(Base):
    __tablename__ = "journal_lines"
    __table_args__ = {"schema": "accounting"}

    id = Column(UUID, primary_key=True)
    journal_entry_id = Column(UUID, ForeignKey("accounting.journal_entries.id"))
    account_id = Column(UUID, ForeignKey("accounting.accounts.id"))
    debit = Column(Numeric(15, 2), default=0)
    credit = Column(Numeric(15, 2), default=0)
    description = Column(String(255))

# accounting.invoices
class Invoice(Base):
    __tablename__ = "invoices"
    __table_args__ = {"schema": "accounting"}

    id = Column(UUID, primary_key=True)
    invoice_number = Column(String(50), unique=True)
    customer_id = Column(UUID, ForeignKey("sales.customers.id"))
    invoice_date = Column(Date)
    due_date = Column(Date)
    subtotal = Column(Numeric(15, 2))
    tax_amount = Column(Numeric(15, 2))
    total = Column(Numeric(15, 2))
    status = Column(String(20))  # draft, sent, paid, cancelled
```

### API Endpoints

```
# Chart of Accounts
GET    /accounting/accounts/              # List accounts
POST   /accounting/accounts/              # Create account
GET    /accounting/accounts/{id}          # Get account
PATCH  /accounting/accounts/{id}          # Update account
GET    /accounting/accounts/{id}/transactions # Account ledger

# Journal Entries
GET    /accounting/journal-entries/       # List entries
POST   /accounting/journal-entries/       # Create entry
POST   /accounting/journal-entries/{id}/post   # Post entry
POST   /accounting/journal-entries/{id}/cancel # Cancel entry

# Invoices
GET    /accounting/invoices/              # List invoices
POST   /accounting/invoices/              # Create invoice
POST   /accounting/invoices/{id}/send     # Send invoice
GET    /accounting/invoices/{id}/pdf      # Get PDF
POST   /accounting/invoices/{id}/payment  # Record payment

# Reports
GET    /accounting/reports/balance-sheet     # Balance sheet
GET    /accounting/reports/income-statement  # P&L
GET    /accounting/reports/trial-balance     # Trial balance
GET    /accounting/reports/cash-flow         # Cash flow
```

### Events Published

```python
"accounting.journal_entry.posted"  # Entry posted
"accounting.invoice.created"       # Invoice created
"accounting.invoice.paid"          # Invoice paid
"accounting.payment.processed"     # Payment processed
"accounting.budget.exceeded"       # Budget threshold exceeded
```

---

## 3. CRM Module

**Path**: `app/modules/crm/`
**Schema**: `crm.*`

### Features

| Feature | Description |
|---------|-------------|
| Contacts | Contact management |
| Leads | Lead tracking, conversion |
| Opportunities | Sales pipeline |
| Activities | Tasks, calls, meetings |
| Campaigns | Marketing campaigns |

### Models

```python
# crm.contacts
class Contact(Base):
    __tablename__ = "contacts"
    __table_args__ = {"schema": "crm"}

    id = Column(UUID, primary_key=True)
    first_name = Column(String(100))
    last_name = Column(String(100))
    email = Column(String(320))
    phone = Column(String(50))
    company_name = Column(String(255))
    job_title = Column(String(100))
    lead_source = Column(String(50))
    status = Column(String(20))  # new, contacted, qualified, customer

# crm.leads
class Lead(Base):
    __tablename__ = "leads"
    __table_args__ = {"schema": "crm"}

    id = Column(UUID, primary_key=True)
    contact_id = Column(UUID, ForeignKey("crm.contacts.id"))
    title = Column(String(255))
    value = Column(Numeric(15, 2))
    probability = Column(Integer)  # 0-100
    stage = Column(String(50))  # qualification, proposal, negotiation, closed
    expected_close_date = Column(Date)
    assigned_to = Column(UUID, ForeignKey("auth.users.id"))

# crm.activities
class Activity(Base):
    __tablename__ = "activities"
    __table_args__ = {"schema": "crm"}

    id = Column(UUID, primary_key=True)
    contact_id = Column(UUID)
    activity_type = Column(String(20))  # call, email, meeting, task
    subject = Column(String(255))
    description = Column(Text)
    due_date = Column(DateTime)
    completed_at = Column(DateTime)
```

### API Endpoints

```
# Contacts
GET    /crm/contacts/            # List contacts
POST   /crm/contacts/            # Create contact
GET    /crm/contacts/{id}        # Get contact
PATCH  /crm/contacts/{id}        # Update contact
GET    /crm/contacts/{id}/activities # Contact activities

# Leads
GET    /crm/leads/               # List leads
POST   /crm/leads/               # Create lead
PATCH  /crm/leads/{id}           # Update lead
POST   /crm/leads/{id}/convert   # Convert to customer

# Pipeline
GET    /crm/pipeline/            # Pipeline view
GET    /crm/pipeline/analytics   # Pipeline analytics
```

---

## 4. HR Module

**Path**: `app/modules/hr/`
**Schema**: `hr.*`

### Features

| Feature | Description |
|---------|-------------|
| Employees | Employee management |
| Departments | Organizational structure |
| Attendance | Time tracking |
| Leave | Leave management |
| Payroll | Salary processing |

### Models

```python
# hr.departments
class Department(Base):
    __tablename__ = "departments"
    __table_args__ = {"schema": "hr"}

    id = Column(UUID, primary_key=True)
    name = Column(String(100))
    code = Column(String(20), unique=True)
    parent_id = Column(UUID, ForeignKey("hr.departments.id"))
    manager_id = Column(UUID)

# hr.employees
class Employee(Base):
    __tablename__ = "employees"
    __table_args__ = {"schema": "hr"}

    id = Column(UUID, primary_key=True)
    employee_number = Column(String(20), unique=True)
    user_id = Column(UUID, ForeignKey("auth.users.id"))
    department_id = Column(UUID, ForeignKey("hr.departments.id"))
    job_title = Column(String(100))
    employment_type = Column(String(20))  # full-time, part-time, contract
    hire_date = Column(Date)
    salary = Column(Numeric(15, 2))
    manager_id = Column(UUID, ForeignKey("hr.employees.id"))

# hr.leave_requests
class LeaveRequest(Base):
    __tablename__ = "leave_requests"
    __table_args__ = {"schema": "hr"}

    id = Column(UUID, primary_key=True)
    employee_id = Column(UUID, ForeignKey("hr.employees.id"))
    leave_type = Column(String(20))  # annual, sick, personal
    start_date = Column(Date)
    end_date = Column(Date)
    status = Column(String(20))  # pending, approved, rejected
    approved_by = Column(UUID)
```

### API Endpoints

```
# Departments
GET    /hr/departments/          # List departments
POST   /hr/departments/          # Create department
GET    /hr/departments/{id}      # Get department
GET    /hr/departments/{id}/employees # Department employees

# Employees
GET    /hr/employees/            # List employees
POST   /hr/employees/            # Create employee
GET    /hr/employees/{id}        # Get employee
PATCH  /hr/employees/{id}        # Update employee
POST   /hr/employees/{id}/activate   # Activate
POST   /hr/employees/{id}/deactivate # Deactivate

# Leave
GET    /hr/leave/                # List leave requests
POST   /hr/leave/                # Request leave
POST   /hr/leave/{id}/approve    # Approve leave
POST   /hr/leave/{id}/reject     # Reject leave

# Attendance
POST   /hr/attendance/clock-in   # Clock in
POST   /hr/attendance/clock-out  # Clock out
GET    /hr/attendance/           # Attendance records
```

---

## 5. Sales Module

**Path**: `app/modules/sales/`
**Schema**: `sales.*`

### Features

| Feature | Description |
|---------|-------------|
| Customers | Customer management |
| Orders | Sales orders |
| Quotations | Price quotes |
| Price Lists | Pricing management |

### Models

```python
# sales.customers
class Customer(Base):
    __tablename__ = "customers"
    __table_args__ = {"schema": "sales"}

    id = Column(UUID, primary_key=True)
    customer_code = Column(String(20), unique=True)
    name = Column(String(255))
    email = Column(String(320))
    phone = Column(String(50))
    billing_address = Column(JSON)
    shipping_address = Column(JSON)
    credit_limit = Column(Numeric(15, 2))
    payment_terms = Column(Integer)  # days

# sales.orders
class SalesOrder(Base):
    __tablename__ = "orders"
    __table_args__ = {"schema": "sales"}

    id = Column(UUID, primary_key=True)
    order_number = Column(String(50), unique=True)
    customer_id = Column(UUID, ForeignKey("sales.customers.id"))
    order_date = Column(Date)
    delivery_date = Column(Date)
    subtotal = Column(Numeric(15, 2))
    tax_amount = Column(Numeric(15, 2))
    total = Column(Numeric(15, 2))
    status = Column(String(20))  # draft, confirmed, shipped, delivered, cancelled

# sales.order_lines
class OrderLine(Base):
    __tablename__ = "order_lines"
    __table_args__ = {"schema": "sales"}

    id = Column(UUID, primary_key=True)
    order_id = Column(UUID, ForeignKey("sales.orders.id"))
    product_id = Column(UUID, ForeignKey("inventory.products.id"))
    quantity = Column(Numeric(10, 2))
    unit_price = Column(Numeric(15, 2))
    discount = Column(Numeric(5, 2), default=0)
    line_total = Column(Numeric(15, 2))
```

### API Endpoints

```
# Customers
GET    /sales/customers/         # List customers
POST   /sales/customers/         # Create customer
GET    /sales/customers/{id}     # Get customer
PATCH  /sales/customers/{id}     # Update customer
GET    /sales/customers/{id}/orders # Customer orders

# Orders
GET    /sales/orders/            # List orders
POST   /sales/orders/            # Create order
GET    /sales/orders/{id}        # Get order
PATCH  /sales/orders/{id}        # Update order
POST   /sales/orders/{id}/confirm # Confirm order
POST   /sales/orders/{id}/ship    # Ship order
POST   /sales/orders/{id}/cancel  # Cancel order

# Quotations
GET    /sales/quotations/        # List quotations
POST   /sales/quotations/        # Create quotation
POST   /sales/quotations/{id}/convert # Convert to order
```

---

## 6. Inventory Module

**Path**: `app/modules/inventory/`
**Schema**: `inventory.*`

### Features

| Feature | Description |
|---------|-------------|
| Products | Product catalog |
| Categories | Product categories |
| Stock Levels | Current inventory |
| Stock Movements | Transactions |
| Warehouses | Multi-location |

### Models

```python
# inventory.categories
class Category(Base):
    __tablename__ = "categories"
    __table_args__ = {"schema": "inventory"}

    id = Column(UUID, primary_key=True)
    name = Column(String(100))
    parent_id = Column(UUID, ForeignKey("inventory.categories.id"))

# inventory.products
class Product(Base):
    __tablename__ = "products"
    __table_args__ = {"schema": "inventory"}

    id = Column(UUID, primary_key=True)
    sku = Column(String(50), unique=True)
    name = Column(String(255))
    description = Column(Text)
    category_id = Column(UUID, ForeignKey("inventory.categories.id"))
    unit_of_measure = Column(String(20))
    cost_price = Column(Numeric(15, 2))
    sale_price = Column(Numeric(15, 2))
    reorder_level = Column(Integer)
    is_active = Column(Boolean, default=True)

# inventory.stock_levels
class StockLevel(Base):
    __tablename__ = "stock_levels"
    __table_args__ = {"schema": "inventory"}

    id = Column(UUID, primary_key=True)
    product_id = Column(UUID, ForeignKey("inventory.products.id"))
    warehouse_id = Column(UUID, ForeignKey("inventory.warehouses.id"))
    quantity = Column(Numeric(10, 2), default=0)
    reserved = Column(Numeric(10, 2), default=0)

# inventory.stock_movements
class StockMovement(Base):
    __tablename__ = "stock_movements"
    __table_args__ = {"schema": "inventory"}

    id = Column(UUID, primary_key=True)
    product_id = Column(UUID, ForeignKey("inventory.products.id"))
    movement_type = Column(String(20))  # in, out, transfer, adjustment
    quantity = Column(Numeric(10, 2))
    reference_type = Column(String(50))  # sales_order, purchase_order
    reference_id = Column(UUID)
```

### API Endpoints

```
# Products
GET    /inventory/products/      # List products
POST   /inventory/products/      # Create product
GET    /inventory/products/{id}  # Get product
PATCH  /inventory/products/{id}  # Update product
GET    /inventory/products/{id}/stock # Get stock level

# Stock
POST   /inventory/products/{id}/stock/adjust  # Adjust stock
POST   /inventory/stock/transfer              # Transfer between warehouses
GET    /inventory/stock/low                   # Low stock report

# Categories
GET    /inventory/categories/    # List categories
POST   /inventory/categories/    # Create category

# Warehouses
GET    /inventory/warehouses/    # List warehouses
POST   /inventory/warehouses/    # Create warehouse
```

### Events Published

```python
"inventory.stock.low"           # Stock below reorder level
"inventory.stock.adjusted"      # Stock adjustment made
"inventory.product.created"     # New product added
```

---

## 7. Project Management Module

**Path**: `app/modules/project_management/`
**Schema**: `project_management.*`

### Features

| Feature | Description |
|---------|-------------|
| Projects | Project management |
| Tasks | Task tracking |
| Milestones | Project milestones |
| Timesheets | Time tracking |

### Models

```python
# project_management.projects
class Project(Base):
    __tablename__ = "projects"
    __table_args__ = {"schema": "project_management"}

    id = Column(UUID, primary_key=True)
    name = Column(String(255))
    description = Column(Text)
    customer_id = Column(UUID, ForeignKey("sales.customers.id"))
    project_manager_id = Column(UUID, ForeignKey("auth.users.id"))
    start_date = Column(Date)
    end_date = Column(Date)
    budget = Column(Numeric(15, 2))
    status = Column(String(20))  # planning, in_progress, on_hold, completed

# project_management.tasks
class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = {"schema": "project_management"}

    id = Column(UUID, primary_key=True)
    project_id = Column(UUID, ForeignKey("project_management.projects.id"))
    title = Column(String(255))
    description = Column(Text)
    assigned_to = Column(UUID, ForeignKey("auth.users.id"))
    priority = Column(String(20))  # low, medium, high, urgent
    status = Column(String(20))  # todo, in_progress, review, done
    due_date = Column(Date)
    estimated_hours = Column(Numeric(5, 2))

# project_management.timesheets
class Timesheet(Base):
    __tablename__ = "timesheets"
    __table_args__ = {"schema": "project_management"}

    id = Column(UUID, primary_key=True)
    task_id = Column(UUID, ForeignKey("project_management.tasks.id"))
    user_id = Column(UUID, ForeignKey("auth.users.id"))
    date = Column(Date)
    hours = Column(Numeric(5, 2))
    description = Column(Text)
```

### API Endpoints

```
# Projects
GET    /projects/                # List projects
POST   /projects/                # Create project
GET    /projects/{id}            # Get project
PATCH  /projects/{id}            # Update project
GET    /projects/{id}/tasks      # Project tasks
GET    /projects/{id}/timeline   # Gantt chart data

# Tasks
GET    /projects/{id}/tasks/     # List tasks
POST   /projects/{id}/tasks/     # Create task
PATCH  /tasks/{id}               # Update task
POST   /tasks/{id}/assign        # Assign task

# Timesheets
GET    /timesheets/              # List timesheets
POST   /timesheets/              # Log time
GET    /timesheets/report        # Time report
```

---

## Inter-Module Communication

Modules communicate through the event bus:

```python
# Publishing events
await self._event_bus.publish("inventory.stock.low", {
    "product_id": "123",
    "current_stock": 5,
    "reorder_level": 10
})

# Subscribing to events
await self._event_bus.subscribe(
    "sales.order.confirmed",
    self._handle_order_confirmed
)

async def _handle_order_confirmed(self, data: dict):
    # Reserve stock for order
    for line in data["lines"]:
        await self._reserve_stock(
            product_id=line["product_id"],
            quantity=line["quantity"]
        )
```

---

## Database Migrations

```bash
# Generate migration
cd bheem-core/apps/backend
alembic revision --autogenerate -m "Add new feature"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

---

## Testing

```bash
# Run all module tests
pytest app/modules/

# Run specific module
pytest app/modules/auth/tests/

# With coverage
pytest --cov=app/modules --cov-report=html
```

---

*Document Version: 1.0*
*Last Updated: December 26, 2025*
