# Bheem Workspace - ERP Integration Architecture

## Executive Summary

Bheem Workspace is a collaborative platform designed for dual-mode operation:
1. **Internal Mode**: For Bheemverse Innovation subsidiaries (BHM001-BHM008) with full ERP integration
2. **External Mode**: Commercial SaaS product sold by **Bheemverse Innovation (BHM001)** to external customers

**IMPORTANT**: Both modes integrate with ERP. External customers are tracked under **BHM001 (Bheemverse Innovation)** as the selling entity:
- **CRM**: Customer created as contact under BHM001
- **Sales**: Invoices generated under BHM001
- **Accounting**: Revenue recorded in BHM001 books
- **Customer Payments**: Payment records linked to BHM001

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Dual-Mode Tenant System](#dual-mode-tenant-system)
3. [Bheemverse Subsidiary Companies](#bheemverse-subsidiary-companies)
4. [External Customer ERP Integration](#external-customer-erp-integration)
5. [ERP SKU Subscription System](#erp-sku-subscription-system)
6. [BheemPay Service Integration](#bheempay-service-integration)
7. [Internal Mode Implementation](#internal-mode-implementation)
8. [External Mode Implementation](#external-mode-implementation)
9. [Database Schema Changes](#database-schema-changes)
10. [Step-by-Step Implementation Guide](#step-by-step-implementation-guide)
11. [API Reference](#api-reference)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                  BHEEM ECOSYSTEM                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│   ┌───────────────────────────────────────────────────────────────────────────────────┐ │
│   │                         BHEEM WORKSPACE (Port 8500)                               │ │
│   ├───────────────────────────────────────────────────────────────────────────────────┤ │
│   │                                                                                   │ │
│   │   ┌─────────────────────────────┐         ┌─────────────────────────────┐        │ │
│   │   │      INTERNAL MODE          │         │      EXTERNAL MODE          │        │ │
│   │   │   (Bheemverse BHM001-008)   │         │  (Commercial SaaS - BHM001) │        │ │
│   │   ├─────────────────────────────┤         ├─────────────────────────────┤        │ │
│   │   │ • Full ERP Integration      │         │ • Customer in CRM (BHM001)  │        │ │
│   │   │ • HR Employee Sync          │         │ • BheemPay Checkout         │        │ │
│   │   │ • PM Project Sync           │         │ • Invoice in Sales (BHM001) │        │ │
│   │   │ • No Billing Required       │         │ • Journal in Acct (BHM001)  │        │ │
│   │   │ • SSO via Passport          │         │ • Revenue to Bheemverse     │        │ │
│   │   └─────────────┬───────────────┘         └─────────────┬───────────────┘        │ │
│   │                 │                                       │                         │ │
│   │                 │         ┌─────────────────────────────┘                         │ │
│   │                 │         │   BOTH MODES USE ERP                                  │ │
│   │                 └─────────┼───────────────────────────────┐                       │ │
│   │                           ▼                               │                       │ │
│   │            ┌─────────────────────────────┐                │                       │ │
│   │            │        MODE ROUTER          │                │                       │ │
│   │            │   tenant_mode: 'internal'   │                │                       │ │
│   │            │            OR               │                │                       │ │
│   │            │   tenant_mode: 'external'   │                │                       │ │
│   │            │   (Sold by BHM001)          │                │                       │ │
│   │            └─────────────────────────────┘                │                       │ │
│   │                           │                               │                       │ │
│   └───────────────────────────┼───────────────────────────────┼───────────────────────┘ │
│                               ▼                               ▼                         │
│ ┌─────────────────────────────────────────────────────────────────────────────────────┐ │
│ │                           BHEEM PLATFORM SERVICES                                    │ │
│ ├───────────────────┬────────────────┬────────────────┬────────────────┬──────────────┤ │
│ │    BHEEM-PAY      │ BHEEM-PASSPORT │  BHEEM-NOTIFY  │  BHEEM-CREDITS │  BHEEM-ADMIN │ │
│ │    (Port 8006)    │  (Port 8003)   │  (Port 8005)   │  (Port 8004)   │              │ │
│ ├───────────────────┼────────────────┼────────────────┼────────────────┼──────────────┤ │
│ │ • Subscription    │ • SSO/OAuth2   │ • Email        │ • Credit Mgmt  │ • Admin UI   │ │
│ │   Checkout        │ • JWT Auth     │ • SMS          │ • Usage Track  │ • Config     │ │
│ │ • Payment to ERP  │ • User Sync    │ • Push         │ • Billing      │              │ │
│ │ • Invoice Gen     │                │ • WhatsApp     │                │              │ │
│ │ • Journal Entry   │                │                │                │              │ │
│ └───────────────────┴────────────────┴────────────────┴────────────────┴──────────────┘ │
│                                         │                                                │
│                                         ▼                                                │
│ ┌─────────────────────────────────────────────────────────────────────────────────────┐ │
│ │                           BHEEM CORE ERP (Port 8000)                                 │ │
│ │                      ALL DATA UNDER BHEEMVERSE (BHM001)                              │ │
│ ├────────────┬────────────┬────────────┬────────────┬────────────┬────────────────────┤ │
│ │     HR     │     PM     │    CRM     │   SALES    │ ACCOUNTING │   INVENTORY/SKU   │ │
│ ├────────────┼────────────┼────────────┼────────────┼────────────┼────────────────────┤ │
│ │ [Internal] │ [Internal] │ [Both]     │ [External] │ [External] │ [Both]             │ │
│ │ • Employee │ • Projects │ • Contacts │ • Invoices │ • Journals │ • SKU Plans        │ │
│ │ • Payroll  │ • Tasks    │ • Accounts │ • Payments │ • Revenue  │ • Subscriptions    │ │
│ │ • Attend.  │ • Teams    │ • Customer │ • Orders   │ • Reports  │ • Tiers            │ │
│ └────────────┴────────────┴────────────┴────────────┴────────────┴────────────────────┘ │
│                                         │                                                │
│                                         ▼                                                │
│                      ┌──────────────────────────────────┐                                │
│                      │      PostgreSQL Database         │                                │
│                      │      erp_staging:5432            │                                │
│                      └──────────────────────────────────┘                                │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Module Usage by Mode

| ERP Module | Internal Mode (BHM001-008) | External Mode (BHM001 sells) |
|------------|---------------------------|------------------------------|
| **HR** | Full access for employees | Not used |
| **PM** | Full access for projects | Not used |
| **CRM** | Access own contacts | Customer created under BHM001 |
| **Sales** | Own invoices | Invoices under BHM001 |
| **Accounting** | Own journal entries | Revenue to BHM001 |
| **Inventory/SKU** | View plans | Subscription plans under BHM001 |

---

## Bheemverse Subsidiary Companies

All Bheemverse subsidiaries use Internal Mode with full ERP access:

| Code | Company Name | UUID | Mode | Description |
|------|-------------|------|------|-------------|
| **BHM001** | BHEEMVERSE | `79f70aef-17eb-48a8-b599-2879721e8796` | Internal | Parent Company |
| **BHM002** | BHEEM CLOUD | `4bb6da85-66ab-4707-8d65-3ffee7927e5b` | Internal | Cloud Infrastructure |
| **BHM003** | BHEEM FLOW | `03ac8147-a3bf-455a-8d87-a04f9dbc3580` | Internal | Workflow Automation |
| **BHM004** | SOCIAL SELLING | `1b505aaf-981e-4155-bb97-7650827b0e12` | Internal | Social Commerce |
| **BHM005** | MARKETPLACE | `9fa118b2-d50a-4867-86c1-b3c532d69f70` | Internal | B2B/B2C Marketplace |
| **BHM006** | COMMUNITY | `9bad628b-6d66-441b-a514-09adbbb31b3c` | Internal | Community Platform |
| **BHM007** | SHIELD | `0cccce62-b3b5-4108-884e-1fb89c58001d` | Internal | Security Services |
| **BHM008** | BHEEM ACADEMY | `cafe17e8-72a3-438b-951e-7af25af4bab8` | Internal | Education Platform |

---

## External Customer ERP Integration

**Bheem Workspace is a product of Bheemverse Innovation (BHM001)**. When sold to external customers, all business transactions are tracked in the ERP under BHM001.

### Complete ERP Integration Flow for External Customers

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                    EXTERNAL CUSTOMER → ERP INTEGRATION (BHM001)                          │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  1. CUSTOMER REGISTRATION                                                                │
│     ══════════════════════                                                               │
│     ┌─────────────────┐                                                                  │
│     │  New Customer   │                                                                  │
│     │  Signs Up       │                                                                  │
│     └────────┬────────┘                                                                  │
│              │                                                                           │
│              ▼                                                                           │
│     ┌─────────────────────────────────────────────────────────────────┐                 │
│     │  CRM MODULE (BHM001)                                             │                 │
│     │  ─────────────────────                                           │                 │
│     │  • Create Contact: crm.contacts                                  │                 │
│     │    - contact_type: 'CUSTOMER'                                    │                 │
│     │    - source: 'WORKSPACE'                                         │                 │
│     │    - company_id: BHM001 UUID                                     │                 │
│     │  • Link to Workspace Tenant: tenant.erp_customer_id              │                 │
│     └─────────────────────────────────────────────────────────────────┘                 │
│                                                                                          │
│  2. SUBSCRIPTION PURCHASE                                                                │
│     ═════════════════════                                                                │
│     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐                 │
│     │  Select Plan    │────▶│  BheemPay       │────▶│  Razorpay       │                 │
│     │  & Checkout     │     │  Checkout       │     │  Payment        │                 │
│     └─────────────────┘     └────────┬────────┘     └────────┬────────┘                 │
│                                      │                       │                           │
│                                      ▼                       ▼                           │
│     ┌─────────────────────────────────────────────────────────────────┐                 │
│     │  ERP RECORDS CREATED (All under BHM001)                          │                 │
│     │  ─────────────────────────────────────                           │                 │
│     │                                                                  │                 │
│     │  ┌─────────────────────────────────────────────────────────┐    │                 │
│     │  │  public.subscriptions                                    │    │                 │
│     │  │  • user_id: Customer's auth user                         │    │                 │
│     │  │  • plan_id: SKU ID (WORKSPACE-STARTER, etc.)             │    │                 │
│     │  │  • company_id: BHM001 (Bheemverse Innovation)            │    │                 │
│     │  │  • status: 'active'                                      │    │                 │
│     │  └─────────────────────────────────────────────────────────┘    │                 │
│     │                                                                  │                 │
│     │  ┌─────────────────────────────────────────────────────────┐    │                 │
│     │  │  sales.customer_payments                                 │    │                 │
│     │  │  • company_id: BHM001                                    │    │                 │
│     │  │  • customer_id: CRM contact ID                           │    │                 │
│     │  │  • amount: Subscription amount                           │    │                 │
│     │  │  • payment_method: 'RAZORPAY'                            │    │                 │
│     │  │  • gateway_payment_id: Razorpay payment ID               │    │                 │
│     │  │  • status: 'COMPLETED'                                   │    │                 │
│     │  └─────────────────────────────────────────────────────────┘    │                 │
│     │                                                                  │                 │
│     │  ┌─────────────────────────────────────────────────────────┐    │                 │
│     │  │  sales.invoices (Auto-generated)                         │    │                 │
│     │  │  • company_id: BHM001                                    │    │                 │
│     │  │  • customer_id: CRM contact ID                           │    │                 │
│     │  │  • invoice_number: Auto-generated                        │    │                 │
│     │  │  • total_amount: Subscription amount                     │    │                 │
│     │  │  • status: 'PAID'                                        │    │                 │
│     │  │  • payment_id: Link to customer_payments                 │    │                 │
│     │  └─────────────────────────────────────────────────────────┘    │                 │
│     │                                                                  │                 │
│     │  ┌─────────────────────────────────────────────────────────┐    │                 │
│     │  │  accounting.journal_entries (Auto-generated)             │    │                 │
│     │  │  • company_id: BHM001                                    │    │                 │
│     │  │  • entry_date: Payment date                              │    │                 │
│     │  │  • reference: Invoice number                             │    │                 │
│     │  │  • Lines:                                                │    │                 │
│     │  │    - DEBIT:  Bank/Razorpay Account (Asset)               │    │                 │
│     │  │    - CREDIT: Subscription Revenue (Income)               │    │                 │
│     │  └─────────────────────────────────────────────────────────┘    │                 │
│     └─────────────────────────────────────────────────────────────────┘                 │
│                                                                                          │
│  3. RECURRING BILLING (Monthly/Annual)                                                   │
│     ══════════════════════════════════                                                   │
│     • BheemPay webhook: subscription.charged                                             │
│     • New payment record in sales.customer_payments                                      │
│     • New invoice in sales.invoices                                                      │
│     • New journal entry in accounting.journal_entries                                    │
│     • Credits added to user_credit_balances (if plan includes)                          │
│                                                                                          │
│  4. REVENUE REPORTING                                                                    │
│     ═════════════════                                                                    │
│     All revenue appears in BHM001 (Bheemverse Innovation) financial reports:            │
│     • Income Statement: Subscription Revenue                                             │
│     • Balance Sheet: Accounts Receivable, Bank balances                                  │
│     • Cash Flow: Operating income from subscriptions                                     │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### ERP Tables Used for External Customers

| ERP Module | Table | Purpose | Company |
|------------|-------|---------|---------|
| **CRM** | `crm.contacts` | Customer profile | BHM001 |
| **CRM** | `crm.accounts` | Customer organization | BHM001 |
| **Inventory** | `public.sku` | Subscription plans | BHM001 |
| **Inventory** | `public.sku_subscriptions` | Plan configuration | BHM001 |
| **Sales** | `public.subscriptions` | Active subscriptions | BHM001 |
| **Sales** | `sales.customer_payments` | Payment records | BHM001 |
| **Sales** | `sales.invoices` | Invoice records | BHM001 |
| **Accounting** | `accounting.journal_entries` | Revenue entries | BHM001 |
| **Accounting** | `accounting.accounts` | GL accounts | BHM001 |
| **Credits** | `user_credit_balances` | User credits | - |

### Account Mapping for Workspace Subscriptions

```
Chart of Accounts (BHM001 - Bheemverse Innovation)
══════════════════════════════════════════════════

ASSETS
├── 1100 - Accounts Receivable
├── 1200 - Bank - Razorpay
└── 1201 - Bank - Stripe

LIABILITIES
├── 2100 - Unearned Revenue (Deferred)
└── 2200 - GST/Tax Payable

INCOME
├── 4100 - Subscription Revenue - Workspace
├── 4101 - Subscription Revenue - Starter
├── 4102 - Subscription Revenue - Professional
└── 4103 - Subscription Revenue - Enterprise

EXPENSES
└── (Cost of revenue if applicable)
```

### Journal Entry Examples

**1. New Subscription Payment (₹2,499/month Professional Plan)**

| Date | Account | Debit | Credit | Description |
|------|---------|-------|--------|-------------|
| 2025-01-01 | 1200 Bank-Razorpay | ₹2,499 | | Payment received |
| 2025-01-01 | 4102 Subscription Revenue-Professional | | ₹2,499 | Workspace subscription |

**2. Annual Subscription with Deferred Revenue (₹24,990/year)**

| Date | Account | Debit | Credit | Description |
|------|---------|-------|--------|-------------|
| 2025-01-01 | 1200 Bank-Razorpay | ₹24,990 | | Annual payment received |
| 2025-01-01 | 2100 Unearned Revenue | | ₹24,990 | Deferred for 12 months |
| 2025-01-31 | 2100 Unearned Revenue | ₹2,082.50 | | Monthly recognition |
| 2025-01-31 | 4102 Subscription Revenue | | ₹2,082.50 | Revenue recognized |

---

## ERP SKU Subscription System

Subscriptions in Bheem Core ERP are managed through the SKU system, NOT separate subscription tables in workspace.

### Key Models in ERP

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         ERP SUBSCRIPTION SCHEMA                                      │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  PUBLIC SCHEMA                                                                       │
│  ═══════════════                                                                     │
│                                                                                      │
│  ┌─────────────────────┐         ┌─────────────────────────────┐                    │
│  │        SKU          │────────▶│     SKUSubscription         │                    │
│  │  (public.sku)       │   1:1   │  (public.sku_subscriptions) │                    │
│  ├─────────────────────┤         ├─────────────────────────────┤                    │
│  │ sku_id (PK)         │         │ id (PK)                     │                    │
│  │ sku_code            │         │ sku_id (FK, UNIQUE)         │                    │
│  │ name                │         │ company_id                  │                    │
│  │ description         │         │ billing_cycle               │                    │
│  │ base_price          │         │ base_price                  │                    │
│  │ billing_type        │         │ offer_price                 │                    │
│  │ unit_type           │         │ setup_fee                   │                    │
│  │ status              │         │ trial_period_days           │                    │
│  └─────────────────────┘         │ contract_length_months      │                    │
│                                  │ auto_renew_enabled          │                    │
│                                  │ has_usage_limits            │                    │
│                                  └──────────────┬──────────────┘                    │
│                                                 │                                    │
│                                                 │ 1:N                               │
│                                                 ▼                                    │
│                                  ┌─────────────────────────────┐                    │
│                                  │   SKUSubscriptionTier       │                    │
│                                  │ (sku_subscription_tiers)    │                    │
│                                  ├─────────────────────────────┤                    │
│                                  │ id (PK)                     │                    │
│                                  │ subscription_id (FK)        │                    │
│                                  │ tier_name                   │                    │
│                                  │ tier_code                   │                    │
│                                  │ price                       │                    │
│                                  │ max_users                   │                    │
│                                  │ max_storage_gb              │                    │
│                                  │ features_included (JSONB)   │──▶ {"credits": 100}│
│                                  │ is_featured                 │                    │
│                                  └─────────────────────────────┘                    │
│                                                                                      │
│  PUBLIC SCHEMA (User Subscriptions)          BILLING SCHEMA (B2B)                   │
│  ═══════════════════════════════════         ══════════════════════                 │
│                                                                                      │
│  ┌─────────────────────────────┐         ┌─────────────────────────────┐           │
│  │     Subscription            │         │   CustomerSubscription      │           │
│  │  (public.subscriptions)     │         │  (billing.subscriptions)    │           │
│  ├─────────────────────────────┤         ├─────────────────────────────┤           │
│  │ id (PK)                     │         │ id (PK)                     │           │
│  │ user_id (FK → persons)      │         │ subscription_number         │           │
│  │ plan_id (FK → sku.sku_id)   │         │ company_id                  │           │
│  │ company_id                  │         │ customer_id (FK → CRM)      │           │
│  │ start_date                  │         │ sku_id (FK → sku)           │           │
│  │ end_date                    │         │ tier_id (FK → tiers)        │           │
│  │ status                      │         │ subscription_status         │           │
│  │ payment_status              │         │ final_price                 │           │
│  │ auto_renew                  │         │ billing_frequency           │           │
│  │ next_billing_date           │         │ next_billing_date           │           │
│  │ last_payment_date           │         │ auto_charge                 │           │
│  └─────────────────────────────┘         └─────────────────────────────┘           │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### UserSubscriptionService (ERP)

**File**: `/apps/backend/app/shared/services/user_subscription_service.py`

Key methods:
- `get_user_subscription(user_id, auto_create_hobby=False)` - Get user's active subscription
- `create_user_subscription(user_id, plan_id, ...)` - Create new subscription
- `update_subscription(subscription_id, ...)` - Update subscription
- `cancel_subscription(subscription_id, ...)` - Cancel subscription
- `activate_subscription(subscription_id, payment_reference)` - Activate after payment
- `upgrade_subscription(subscription_id, new_plan_id)` - Upgrade/downgrade
- `get_available_plans(plan_prefix)` - List available plans
- `auto_create_hobby_subscription(user_id)` - Auto-create free tier

---

## BheemPay Service Integration

### Service Overview

**Location**: `/bheem-platform/services/bheem-pay/`
**Port**: 8006
**Authentication**: JWT + API Key (flexible_auth)

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/pay/create` | POST | Create payment order |
| `/api/v1/pay/verify` | POST | Verify payment signature |
| `/api/v1/pay/status/{payment_id}` | GET | Get payment status |
| `/api/v1/pay/refund` | POST | Process refund |
| `/api/v1/pay/webhook` | POST | Payment gateway webhooks |
| `/api/v1/pay/checkout/subscription` | POST | Create subscription checkout |
| `/api/v1/pay/webhook/subscription` | POST | Subscription webhooks |
| `/api/v1/pay/checkout/{order_id}` | GET | Get checkout status |
| `/api/v1/auth/sso` | GET | SSO login verification |
| `/api/v1/pay/transactions` | GET | List transactions |

### Subscription Checkout Flow

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   WORKSPACE      │     │   BHEEM-PAY      │     │   RAZORPAY       │     │   ERP DATABASE   │
│   FRONTEND       │     │   (8006)         │     │   GATEWAY        │     │                  │
├──────────────────┤     ├──────────────────┤     ├──────────────────┤     ├──────────────────┤
│                  │     │                  │     │                  │     │                  │
│  1. Select Plan  │────▶│  2. Create       │     │                  │     │                  │
│     & Checkout   │     │     Checkout     │────▶│  3. Create Order │     │                  │
│                  │     │                  │     │                  │     │                  │
│                  │     │  4. Store Pending│─────────────────────────────▶│  public.         │
│                  │     │     Subscription │     │                  │     │  subscriptions   │
│                  │     │                  │     │                  │     │                  │
│                  │◀────│  5. Return       │     │                  │     │                  │
│                  │     │     order_id,    │     │                  │     │                  │
│                  │     │     key_id       │     │                  │     │                  │
│                  │     │                  │     │                  │     │                  │
│  6. Open         │─────────────────────────────▶│  7. Payment UI   │     │                  │
│     Razorpay     │     │                  │     │                  │     │                  │
│     Checkout     │     │                  │     │                  │     │                  │
│                  │     │                  │     │                  │     │                  │
│                  │     │                  │◀────│  8. Webhook:     │     │                  │
│                  │     │                  │     │     payment.     │     │                  │
│                  │     │                  │     │     captured     │     │                  │
│                  │     │                  │     │                  │     │                  │
│                  │     │  9. Activate     │─────────────────────────────▶│  UPDATE status   │
│                  │     │     Subscription │     │                  │     │  = 'active'      │
│                  │     │                  │     │                  │     │                  │
│                  │     │  10. Add Credits │─────────────────────────────▶│  user_credit_    │
│                  │     │      (if plan    │     │                  │     │  balances        │
│                  │     │       includes)  │     │                  │     │                  │
│                  │     │                  │     │                  │     │                  │
│  11. Poll for    │────▶│  12. Return      │     │                  │     │                  │
│      Status      │◀────│      Completed   │     │                  │     │                  │
│                  │     │                  │     │                  │     │                  │
│  13. Redirect    │     │                  │     │                  │     │                  │
│      to Success  │     │                  │     │                  │     │                  │
│                  │     │                  │     │                  │     │                  │
└──────────────────┘     └──────────────────┘     └──────────────────┘     └──────────────────┘
```

### Webhook Events Handled

| Event | Action |
|-------|--------|
| `payment.captured` | Activate subscription, add credits |
| `subscription.charged` | Renew subscription, add monthly credits |
| `subscription.cancelled` | Mark subscription cancelled |
| `subscription.pending` | Mark payment pending |
| `subscription.halted` | Suspend subscription |
| `payment.failed` | Mark payment failed |

---

## Internal Mode Implementation

### Use Case
Bheemverse subsidiaries (BHM001-BHM008) need workspace access without billing.

### Features
- Full ERP module access (HR, PM, CRM, Sales, Accounting)
- Employee sync from HR module
- Project sync from PM module
- SSO via Bheem Passport
- No subscription billing required

### Service Implementation

```python
# File: /bheem-workspace/backend/services/internal_workspace_service.py

from typing import List, Optional
from uuid import UUID
import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings

# Bheemverse company codes (Internal Mode)
BHEEMVERSE_COMPANY_CODES = {
    "BHM001": "79f70aef-17eb-48a8-b599-2879721e8796",
    "BHM002": "4bb6da85-66ab-4707-8d65-3ffee7927e5b",
    "BHM003": "03ac8147-a3bf-455a-8d87-a04f9dbc3580",
    "BHM004": "1b505aaf-981e-4155-bb97-7650827b0e12",
    "BHM005": "9fa118b2-d50a-4867-86c1-b3c532d69f70",
    "BHM006": "9bad628b-6d66-441b-a514-09adbbb31b3c",
    "BHM007": "0cccce62-b3b5-4108-884e-1fb89c58001d",
    "BHM008": "cafe17e8-72a3-438b-951e-7af25af4bab8",
}


class InternalWorkspaceService:
    """Service for internal Bheemverse tenants with full ERP integration"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.erp_base_url = settings.ERP_SERVICE_URL
        self.erp_api_key = settings.ERP_API_KEY

    def is_internal_company(self, company_code: str) -> bool:
        """Check if company code is a Bheemverse subsidiary"""
        return company_code.upper() in BHEEMVERSE_COMPANY_CODES

    def get_company_id(self, company_code: str) -> Optional[str]:
        """Get company UUID from code"""
        return BHEEMVERSE_COMPANY_CODES.get(company_code.upper())

    async def _erp_request(self, method: str, endpoint: str, **kwargs) -> dict:
        """Make authenticated request to ERP API"""
        headers = {
            "Authorization": f"Bearer {self.erp_api_key}",
            "X-Source": "workspace-internal",
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(
                method=method,
                url=f"{self.erp_base_url}/api/v1{endpoint}",
                headers=headers,
                **kwargs
            )
            response.raise_for_status()
            return response.json()

    # ─────────────────────────────────────────────────────────────────
    # HR Module Integration
    # ─────────────────────────────────────────────────────────────────

    async def sync_employees(self, company_code: str) -> dict:
        """
        Sync employees from ERP HR module to workspace users.

        For internal mode tenants, employees are automatically provisioned
        as workspace users with appropriate roles.
        """
        company_id = self.get_company_id(company_code)
        if not company_id:
            raise ValueError(f"Invalid company code: {company_code}")

        # Get active employees from ERP
        employees = await self._erp_request(
            "GET",
            "/hr/employees",
            params={"company_id": company_id, "status": "ACTIVE"}
        )

        synced = 0
        errors = []

        for emp in employees.get("items", []):
            try:
                await self._upsert_workspace_user(
                    email=emp.get("work_email"),
                    name=f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip(),
                    erp_employee_id=emp.get("id"),
                    department=emp.get("department", {}).get("name"),
                    job_title=emp.get("job_title"),
                    company_code=company_code,
                    provisioned_by="erp_hr"
                )
                synced += 1
            except Exception as e:
                errors.append({"employee_id": emp.get("id"), "error": str(e)})

        return {
            "status": "completed",
            "synced": synced,
            "errors": errors,
            "total": len(employees.get("items", []))
        }

    async def get_employee_details(self, employee_id: UUID) -> dict:
        """Get employee details from ERP"""
        return await self._erp_request("GET", f"/hr/employees/{employee_id}")

    # ─────────────────────────────────────────────────────────────────
    # PM Module Integration
    # ─────────────────────────────────────────────────────────────────

    async def sync_projects(self, company_code: str) -> dict:
        """Sync projects from ERP PM module"""
        company_id = self.get_company_id(company_code)
        if not company_id:
            raise ValueError(f"Invalid company code: {company_code}")

        projects = await self._erp_request(
            "GET",
            "/projects",
            params={"company_id": company_id, "status": "active"}
        )

        synced = 0
        for project in projects.get("items", []):
            await self._upsert_workspace_project(
                erp_project_id=project.get("id"),
                name=project.get("name"),
                description=project.get("description"),
                team_members=[m.get("employee_id") for m in project.get("team", [])]
            )
            synced += 1

        return {"status": "completed", "synced": synced}

    # ─────────────────────────────────────────────────────────────────
    # Internal User Provisioning
    # ─────────────────────────────────────────────────────────────────

    async def _upsert_workspace_user(
        self,
        email: str,
        name: str,
        erp_employee_id: str,
        department: Optional[str],
        job_title: Optional[str],
        company_code: str,
        provisioned_by: str
    ):
        """Create or update workspace user from ERP employee"""
        from sqlalchemy import text

        query = text("""
            INSERT INTO workspace.tenant_users (
                id, tenant_id, user_id, email, name, role,
                erp_employee_id, department, job_title, provisioned_by,
                is_active, created_at, updated_at
            )
            SELECT
                gen_random_uuid(),
                t.id,
                u.id,
                :email,
                :name,
                :role,
                CAST(:erp_employee_id AS uuid),
                :department,
                :job_title,
                :provisioned_by,
                true,
                NOW(),
                NOW()
            FROM workspace.tenants t
            CROSS JOIN auth.users u
            WHERE t.erp_company_code = :company_code
              AND u.email = :email
            ON CONFLICT (tenant_id, user_id) DO UPDATE SET
                name = EXCLUDED.name,
                department = EXCLUDED.department,
                job_title = EXCLUDED.job_title,
                erp_employee_id = EXCLUDED.erp_employee_id,
                updated_at = NOW()
        """)

        await self.db.execute(query, {
            "email": email,
            "name": name,
            "role": self._map_role_from_job_title(job_title),
            "erp_employee_id": erp_employee_id,
            "department": department,
            "job_title": job_title,
            "provisioned_by": provisioned_by,
            "company_code": company_code
        })
        await self.db.commit()

    def _map_role_from_job_title(self, job_title: Optional[str]) -> str:
        """Map ERP job title to workspace role"""
        if not job_title:
            return "member"

        title_lower = job_title.lower()
        if any(x in title_lower for x in ["director", "ceo", "cto", "cfo", "head"]):
            return "admin"
        elif any(x in title_lower for x in ["manager", "lead", "senior"]):
            return "manager"
        return "member"

    async def _upsert_workspace_project(
        self,
        erp_project_id: str,
        name: str,
        description: Optional[str],
        team_members: List[str]
    ):
        """Create or update workspace project from ERP"""
        # Implementation for project sync
        pass


class InternalTenantProvisioner:
    """Provision internal tenants for Bheemverse subsidiaries"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def provision_subsidiary(self, company_code: str) -> dict:
        """
        Create a workspace tenant for a Bheemverse subsidiary.
        Called once during initial setup or when new subsidiary is added.
        """
        from sqlalchemy import text

        if company_code not in BHEEMVERSE_COMPANY_CODES:
            raise ValueError(f"Not a Bheemverse subsidiary: {company_code}")

        company_id = BHEEMVERSE_COMPANY_CODES[company_code]

        # Create tenant in internal mode
        query = text("""
            INSERT INTO workspace.tenants (
                id, name, slug, tenant_mode, erp_company_code, erp_company_id,
                plan, max_users, is_active, created_at
            )
            SELECT
                gen_random_uuid(),
                c.company_name,
                LOWER(REPLACE(c.company_name, ' ', '-')),
                'internal',
                :company_code,
                c.id,
                'enterprise',  -- Internal tenants get full access
                -1,  -- Unlimited users
                true,
                NOW()
            FROM public.companies c
            WHERE c.id = CAST(:company_id AS uuid)
            ON CONFLICT (slug) DO UPDATE SET
                erp_company_code = EXCLUDED.erp_company_code,
                updated_at = NOW()
            RETURNING id::text, name, slug
        """)

        result = await self.db.execute(query, {
            "company_code": company_code,
            "company_id": company_id
        })
        await self.db.commit()

        row = result.fetchone()
        return {
            "tenant_id": row.id if row else None,
            "name": row.name if row else None,
            "slug": row.slug if row else None,
            "mode": "internal"
        }
```

---

## External Mode Implementation

### Use Case
Commercial customers purchasing workspace subscriptions via BheemPay.

### Features
- Self-service registration
- Subscription billing via BheemPay/Razorpay
- CRM contact sync for invoicing
- Automatic journal entries in ERP Accounting
- Credit allocation based on plan

### Service Implementation

```python
# File: /bheem-workspace/backend/services/external_workspace_service.py

from typing import Optional, Dict, Any
from uuid import UUID
import httpx
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from core.config import settings


class BheemPayClient:
    """Client for BheemPay payment gateway service"""

    def __init__(self):
        self.base_url = settings.BHEEMPAY_URL  # http://bheem-pay:8006
        self.api_key = settings.BHEEMPAY_API_KEY
        self.webhook_secret = settings.BHEEMPAY_WEBHOOK_SECRET

    async def _request(self, method: str, endpoint: str, **kwargs) -> dict:
        """Make authenticated request to BheemPay"""
        headers = {
            "X-API-Key": self.api_key,
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(
                method=method,
                url=f"{self.base_url}/api/v1{endpoint}",
                headers=headers,
                **kwargs
            )
            response.raise_for_status()
            return response.json()

    async def create_subscription_checkout(
        self,
        user_id: str,
        plan_id: str,
        customer_email: str,
        customer_phone: Optional[str] = None,
        company_code: str = "BHM001",
        success_url: Optional[str] = None,
        cancel_url: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> dict:
        """
        Create subscription checkout session via BheemPay.

        BheemPay will:
        1. Fetch plan details from public.sku_subscriptions
        2. Create Razorpay order
        3. Create pending subscription in public.subscriptions
        4. Return checkout details for frontend
        """
        return await self._request(
            "POST",
            "/pay/checkout/subscription",
            json={
                "user_id": user_id,
                "plan_id": plan_id,
                "customer_email": customer_email,
                "customer_phone": customer_phone,
                "company_code": company_code,
                "success_url": success_url or f"{settings.WORKSPACE_URL}/billing/success",
                "cancel_url": cancel_url or f"{settings.WORKSPACE_URL}/billing/cancel",
                "metadata": {
                    "source": "workspace",
                    **(metadata or {})
                }
            }
        )

    async def get_checkout_status(self, order_id: str) -> dict:
        """Get checkout/payment status"""
        return await self._request("GET", f"/pay/checkout/{order_id}")

    async def verify_webhook(self, payload: bytes, signature: str) -> bool:
        """Verify webhook signature"""
        import hmac
        import hashlib

        expected = hmac.new(
            self.webhook_secret.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()

        return hmac.compare_digest(signature, expected)


class ERPClient:
    """Client for ERP API interactions"""

    def __init__(self):
        self.base_url = settings.ERP_SERVICE_URL
        self.api_key = settings.ERP_API_KEY

    async def _request(self, method: str, endpoint: str, **kwargs) -> dict:
        """Make authenticated request to ERP"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "X-Source": "workspace-external",
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(
                method=method,
                url=f"{self.base_url}/api/v1{endpoint}",
                headers=headers,
                **kwargs
            )
            response.raise_for_status()
            return response.json()

    # ─────────────────────────────────────────────────────────────────
    # Subscription Plans (SKU)
    # ─────────────────────────────────────────────────────────────────

    async def get_workspace_plans(self, plan_prefix: str = "WORKSPACE-") -> list:
        """
        Get available workspace subscription plans from ERP.
        Uses the UserSubscriptionService.get_available_plans() method.
        """
        return await self._request(
            "GET",
            "/shared/sku-subscription",
            params={"plan_prefix": plan_prefix}
        )

    async def get_plan_details(self, sku_id: str) -> dict:
        """Get plan details with tiers"""
        return await self._request("GET", f"/shared/sku-subscription/sku/{sku_id}")

    # ─────────────────────────────────────────────────────────────────
    # CRM Integration (for external customers)
    # ─────────────────────────────────────────────────────────────────

    async def create_crm_contact(
        self,
        name: str,
        email: str,
        company: Optional[str] = None,
        phone: Optional[str] = None,
        company_id: str = "79f70aef-17eb-48a8-b599-2879721e8796"  # BHM001
    ) -> dict:
        """
        Create CRM contact for external customer.
        Used for billing/invoicing integration.
        """
        return await self._request(
            "POST",
            "/crm/contacts",
            json={
                "first_name": name.split()[0] if name else "",
                "last_name": " ".join(name.split()[1:]) if name and len(name.split()) > 1 else "",
                "email": email,
                "company_name": company,
                "phone": phone,
                "contact_type": "CUSTOMER",
                "source": "WORKSPACE",
                "company_id": company_id
            }
        )

    async def get_user_subscription(self, user_id: str) -> Optional[dict]:
        """Get user's active subscription from ERP"""
        try:
            return await self._request("GET", f"/subscriptions/user/{user_id}")
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise


class ExternalWorkspaceService:
    """Service for external commercial tenants with billing"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.bheempay = BheemPayClient()
        self.erp = ERPClient()

    async def get_available_plans(self) -> list:
        """Get available workspace subscription plans"""
        plans = await self.erp.get_workspace_plans("WORKSPACE-")
        return plans.get("data", [])

    async def create_checkout_session(
        self,
        tenant_id: UUID,
        plan_id: str,
        billing_cycle: str = "monthly"
    ) -> dict:
        """
        Create subscription checkout session for external tenant.

        Flow:
        1. Get tenant details
        2. Create/get CRM contact for invoicing
        3. Create checkout via BheemPay
        4. Update tenant with pending subscription reference
        """
        # Get tenant
        tenant = await self._get_tenant(tenant_id)
        if not tenant:
            raise ValueError(f"Tenant {tenant_id} not found")

        if tenant.tenant_mode == "internal":
            raise ValueError("Internal tenants cannot purchase subscriptions")

        # Ensure CRM contact exists for billing
        if not tenant.erp_customer_id:
            crm_contact = await self.erp.create_crm_contact(
                name=tenant.name,
                email=tenant.billing_email or tenant.owner_email,
                company=tenant.name
            )
            await self._update_tenant_crm_id(tenant_id, crm_contact["id"])

        # Get auth user ID for the tenant owner
        user_id = await self._get_owner_user_id(tenant_id)

        # Create checkout via BheemPay
        checkout = await self.bheempay.create_subscription_checkout(
            user_id=str(user_id),
            plan_id=plan_id,
            customer_email=tenant.billing_email or tenant.owner_email,
            metadata={
                "tenant_id": str(tenant_id),
                "billing_cycle": billing_cycle
            }
        )

        return {
            "checkout_id": checkout["checkout_id"],
            "order_id": checkout["order_id"],
            "amount": checkout["amount"],
            "currency": checkout["currency"],
            "plan_name": checkout["plan_name"],
            "key_id": checkout["key_id"],  # Razorpay public key for frontend
            "gateway_response": checkout["gateway_response"]
        }

    async def handle_payment_webhook(self, event_type: str, payload: dict) -> dict:
        """
        Handle BheemPay webhook events.

        Note: Most processing is done by BheemPay service itself.
        This is for workspace-specific actions like:
        - Updating tenant subscription status
        - Applying plan quotas
        - Enabling/disabling features
        """
        tenant_id = payload.get("metadata", {}).get("tenant_id")

        if not tenant_id:
            return {"status": "ignored", "reason": "no_tenant_id"}

        if event_type == "payment.captured":
            # Payment successful - update tenant subscription
            subscription_id = payload.get("subscription_id")
            plan_id = payload.get("plan_id")

            await self._activate_tenant_subscription(
                tenant_id=tenant_id,
                subscription_id=subscription_id,
                plan_id=plan_id
            )

            return {"status": "success", "action": "subscription_activated"}

        elif event_type == "subscription.cancelled":
            await self._deactivate_tenant_subscription(tenant_id)
            return {"status": "success", "action": "subscription_cancelled"}

        elif event_type == "subscription.halted":
            await self._suspend_tenant(tenant_id)
            return {"status": "success", "action": "tenant_suspended"}

        return {"status": "ignored", "reason": "unhandled_event"}

    async def get_subscription_status(self, tenant_id: UUID) -> dict:
        """Get current subscription status for tenant"""
        query = text("""
            SELECT
                t.erp_subscription_id,
                t.subscription_status,
                t.subscription_plan,
                t.subscription_period_end,
                s.status as erp_status,
                s.payment_status,
                s.next_billing_date,
                sk.name as plan_name,
                ss.base_price,
                ss.offer_price
            FROM workspace.tenants t
            LEFT JOIN public.subscriptions s ON t.erp_subscription_id = s.id
            LEFT JOIN public.sku sk ON s.plan_id = sk.sku_id
            LEFT JOIN public.sku_subscriptions ss ON sk.sku_id = ss.sku_id
            WHERE t.id = CAST(:tenant_id AS uuid)
        """)

        result = await self.db.execute(query, {"tenant_id": str(tenant_id)})
        row = result.fetchone()

        if not row:
            return {"status": "not_found"}

        return {
            "subscription_id": str(row.erp_subscription_id) if row.erp_subscription_id else None,
            "status": row.subscription_status or row.erp_status,
            "payment_status": row.payment_status,
            "plan": row.subscription_plan or row.plan_name,
            "price": float(row.offer_price or row.base_price) if row.base_price else None,
            "next_billing_date": row.next_billing_date.isoformat() if row.next_billing_date else None,
            "period_end": row.subscription_period_end.isoformat() if row.subscription_period_end else None
        }

    async def cancel_subscription(self, tenant_id: UUID, reason: Optional[str] = None) -> dict:
        """Cancel tenant subscription"""
        tenant = await self._get_tenant(tenant_id)
        if not tenant or not tenant.erp_subscription_id:
            raise ValueError("No active subscription found")

        # Cancel via ERP UserSubscriptionService
        # This will be handled by BheemPay webhook when processed
        await self.erp._request(
            "POST",
            f"/subscriptions/{tenant.erp_subscription_id}/cancel",
            json={"reason": reason, "immediate": False}
        )

        return {"status": "cancellation_scheduled"}

    # ─────────────────────────────────────────────────────────────────
    # Private Methods
    # ─────────────────────────────────────────────────────────────────

    async def _get_tenant(self, tenant_id: UUID):
        """Get tenant by ID"""
        from sqlalchemy import text
        query = text("""
            SELECT * FROM workspace.tenants WHERE id = CAST(:tenant_id AS uuid)
        """)
        result = await self.db.execute(query, {"tenant_id": str(tenant_id)})
        return result.fetchone()

    async def _get_owner_user_id(self, tenant_id: UUID) -> UUID:
        """Get auth user ID for tenant owner"""
        query = text("""
            SELECT u.id FROM auth.users u
            JOIN workspace.tenants t ON u.email = t.owner_email
            WHERE t.id = CAST(:tenant_id AS uuid)
        """)
        result = await self.db.execute(query, {"tenant_id": str(tenant_id)})
        row = result.fetchone()
        if not row:
            raise ValueError("Tenant owner not found in auth.users")
        return row.id

    async def _update_tenant_crm_id(self, tenant_id: UUID, crm_id: str):
        """Update tenant with CRM contact ID"""
        query = text("""
            UPDATE workspace.tenants
            SET erp_customer_id = CAST(:crm_id AS uuid), updated_at = NOW()
            WHERE id = CAST(:tenant_id AS uuid)
        """)
        await self.db.execute(query, {"tenant_id": str(tenant_id), "crm_id": crm_id})
        await self.db.commit()

    async def _activate_tenant_subscription(
        self,
        tenant_id: str,
        subscription_id: str,
        plan_id: str
    ):
        """Activate subscription for tenant"""
        # Get plan limits
        plan = await self.erp.get_plan_details(plan_id)
        tier = plan.get("tiers", [{}])[0] if plan.get("tiers") else {}

        query = text("""
            UPDATE workspace.tenants SET
                erp_subscription_id = CAST(:subscription_id AS uuid),
                subscription_status = 'active',
                subscription_plan = :plan_name,
                max_users = COALESCE(:max_users, max_users),
                docs_quota_mb = COALESCE(:storage_mb, docs_quota_mb),
                updated_at = NOW()
            WHERE id = CAST(:tenant_id AS uuid)
        """)

        await self.db.execute(query, {
            "tenant_id": tenant_id,
            "subscription_id": subscription_id,
            "plan_name": plan.get("name"),
            "max_users": tier.get("max_users"),
            "storage_mb": (tier.get("max_storage_gb") or 0) * 1024
        })
        await self.db.commit()

    async def _deactivate_tenant_subscription(self, tenant_id: str):
        """Deactivate tenant subscription"""
        query = text("""
            UPDATE workspace.tenants SET
                subscription_status = 'cancelled',
                updated_at = NOW()
            WHERE id = CAST(:tenant_id AS uuid)
        """)
        await self.db.execute(query, {"tenant_id": tenant_id})
        await self.db.commit()

    async def _suspend_tenant(self, tenant_id: str):
        """Suspend tenant due to payment failure"""
        query = text("""
            UPDATE workspace.tenants SET
                subscription_status = 'suspended',
                is_suspended = true,
                suspended_reason = 'Payment failed',
                updated_at = NOW()
            WHERE id = CAST(:tenant_id AS uuid)
        """)
        await self.db.execute(query, {"tenant_id": tenant_id})
        await self.db.commit()
```

---

## Database Schema Changes

### Workspace Tenant Table Updates

```sql
-- Migration: Add ERP integration columns to tenants table

ALTER TABLE workspace.tenants ADD COLUMN IF NOT EXISTS tenant_mode VARCHAR(20) DEFAULT 'external';
ALTER TABLE workspace.tenants ADD COLUMN IF NOT EXISTS erp_company_code VARCHAR(20);
ALTER TABLE workspace.tenants ADD COLUMN IF NOT EXISTS erp_company_id UUID;
ALTER TABLE workspace.tenants ADD COLUMN IF NOT EXISTS erp_customer_id UUID;
ALTER TABLE workspace.tenants ADD COLUMN IF NOT EXISTS erp_subscription_id UUID;
ALTER TABLE workspace.tenants ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20);
ALTER TABLE workspace.tenants ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(100);
ALTER TABLE workspace.tenants ADD COLUMN IF NOT EXISTS subscription_period_end TIMESTAMP;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tenants_mode ON workspace.tenants(tenant_mode);
CREATE INDEX IF NOT EXISTS idx_tenants_erp_company ON workspace.tenants(erp_company_code);
CREATE INDEX IF NOT EXISTS idx_tenants_subscription ON workspace.tenants(erp_subscription_id);

-- Constraint: internal tenants must have erp_company_code
ALTER TABLE workspace.tenants ADD CONSTRAINT chk_internal_mode
    CHECK (tenant_mode != 'internal' OR erp_company_code IS NOT NULL);

COMMENT ON COLUMN workspace.tenants.tenant_mode IS 'internal = Bheemverse subsidiary, external = commercial customer';
COMMENT ON COLUMN workspace.tenants.erp_company_code IS 'BHM001-BHM008 for internal mode';
COMMENT ON COLUMN workspace.tenants.erp_subscription_id IS 'References public.subscriptions.id';
```

### Workspace TenantUser Table Updates

```sql
-- Migration: Add ERP linkage to tenant_users table

ALTER TABLE workspace.tenant_users ADD COLUMN IF NOT EXISTS erp_employee_id UUID;
ALTER TABLE workspace.tenant_users ADD COLUMN IF NOT EXISTS erp_user_id UUID;
ALTER TABLE workspace.tenant_users ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE workspace.tenant_users ADD COLUMN IF NOT EXISTS job_title VARCHAR(100);
ALTER TABLE workspace.tenant_users ADD COLUMN IF NOT EXISTS provisioned_by VARCHAR(20) DEFAULT 'self';

CREATE INDEX IF NOT EXISTS idx_tenant_users_erp_employee ON workspace.tenant_users(erp_employee_id);

COMMENT ON COLUMN workspace.tenant_users.provisioned_by IS 'self = self-registered, erp_hr = synced from HR, admin = manually added';
```

---

## Step-by-Step Implementation Guide

### Phase 1: Database & Model Updates

#### Step 1.1: Create Migration File

```bash
# Create new migration in workspace backend
cd /root/bheem-core/bheem-workspace/backend
alembic revision -m "add_erp_integration_columns"
```

#### Step 1.2: Apply Migration

```python
# File: migrations/versions/XXXX_add_erp_integration_columns.py

def upgrade():
    # Add columns to tenants
    op.add_column('tenants', sa.Column('tenant_mode', sa.String(20), server_default='external'), schema='workspace')
    op.add_column('tenants', sa.Column('erp_company_code', sa.String(20)), schema='workspace')
    op.add_column('tenants', sa.Column('erp_company_id', postgresql.UUID(as_uuid=True)), schema='workspace')
    op.add_column('tenants', sa.Column('erp_customer_id', postgresql.UUID(as_uuid=True)), schema='workspace')
    op.add_column('tenants', sa.Column('erp_subscription_id', postgresql.UUID(as_uuid=True)), schema='workspace')
    op.add_column('tenants', sa.Column('subscription_status', sa.String(20)), schema='workspace')
    op.add_column('tenants', sa.Column('subscription_plan', sa.String(100)), schema='workspace')
    op.add_column('tenants', sa.Column('subscription_period_end', sa.DateTime), schema='workspace')

    # Add columns to tenant_users
    op.add_column('tenant_users', sa.Column('erp_employee_id', postgresql.UUID(as_uuid=True)), schema='workspace')
    op.add_column('tenant_users', sa.Column('erp_user_id', postgresql.UUID(as_uuid=True)), schema='workspace')
    op.add_column('tenant_users', sa.Column('department', sa.String(100)), schema='workspace')
    op.add_column('tenant_users', sa.Column('job_title', sa.String(100)), schema='workspace')
    op.add_column('tenant_users', sa.Column('provisioned_by', sa.String(20), server_default='self'), schema='workspace')

    # Create indexes
    op.create_index('idx_tenants_mode', 'tenants', ['tenant_mode'], schema='workspace')
    op.create_index('idx_tenants_erp_company', 'tenants', ['erp_company_code'], schema='workspace')
```

#### Step 1.3: Update SQLAlchemy Models

```python
# File: /bheem-workspace/backend/models/admin_models.py

# Add to Tenant model:
tenant_mode = Column(String(20), default='external')
erp_company_code = Column(String(20))
erp_company_id = Column(UUID(as_uuid=True))
erp_customer_id = Column(UUID(as_uuid=True))
erp_subscription_id = Column(UUID(as_uuid=True))
subscription_status = Column(String(20))
subscription_plan = Column(String(100))
subscription_period_end = Column(DateTime)

# Add to TenantUser model:
erp_employee_id = Column(UUID(as_uuid=True))
erp_user_id = Column(UUID(as_uuid=True))
department = Column(String(100))
job_title = Column(String(100))
provisioned_by = Column(String(20), default='self')
```

### Phase 2: Create Service Clients

#### Step 2.1: Create BheemPayClient

```bash
# Create file
touch /root/bheem-core/bheem-workspace/backend/services/bheempay_client.py
```

See full implementation in [External Mode Implementation](#external-mode-implementation) section.

#### Step 2.2: Create ERPClient

```bash
# Create file
touch /root/bheem-core/bheem-workspace/backend/services/erp_client.py
```

#### Step 2.3: Create InternalWorkspaceService

```bash
# Create file
touch /root/bheem-core/bheem-workspace/backend/services/internal_workspace_service.py
```

#### Step 2.4: Create ExternalWorkspaceService

```bash
# Create file
touch /root/bheem-core/bheem-workspace/backend/services/external_workspace_service.py
```

### Phase 3: Create API Routes

#### Step 3.1: Billing Routes (External Mode)

```python
# File: /bheem-workspace/backend/api/billing.py

from fastapi import APIRouter, Depends, HTTPException, Request
from ..services.external_workspace_service import ExternalWorkspaceService

router = APIRouter(prefix="/api/v1/billing", tags=["Billing"])

@router.get("/plans")
async def list_plans(service: ExternalWorkspaceService = Depends()):
    """List available subscription plans"""
    return {"plans": await service.get_available_plans()}

@router.post("/checkout")
async def create_checkout(
    request: CheckoutRequest,
    tenant = Depends(get_current_tenant),
    service: ExternalWorkspaceService = Depends()
):
    """Create subscription checkout session"""
    if tenant.tenant_mode == "internal":
        raise HTTPException(400, "Internal tenants cannot manage billing")

    return await service.create_checkout_session(
        tenant_id=tenant.id,
        plan_id=request.plan_id,
        billing_cycle=request.billing_cycle
    )

@router.get("/subscription")
async def get_subscription(
    tenant = Depends(get_current_tenant),
    service: ExternalWorkspaceService = Depends()
):
    """Get current subscription status"""
    return await service.get_subscription_status(tenant.id)

@router.post("/subscription/cancel")
async def cancel_subscription(
    request: CancelRequest,
    tenant = Depends(get_current_tenant),
    service: ExternalWorkspaceService = Depends()
):
    """Cancel subscription"""
    return await service.cancel_subscription(tenant.id, request.reason)

@router.post("/webhook")
async def handle_webhook(
    request: Request,
    service: ExternalWorkspaceService = Depends()
):
    """Handle BheemPay webhooks"""
    payload = await request.body()
    signature = request.headers.get("X-BheemPay-Signature")

    if not await service.bheempay.verify_webhook(payload, signature):
        raise HTTPException(400, "Invalid signature")

    data = await request.json()
    return await service.handle_payment_webhook(data["event"], data["payload"])
```

#### Step 3.2: ERP Sync Routes (Internal Mode)

```python
# File: /bheem-workspace/backend/api/erp_sync.py

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from ..services.internal_workspace_service import InternalWorkspaceService

router = APIRouter(prefix="/api/v1/erp-sync", tags=["ERP Sync"])

@router.post("/employees")
async def sync_employees(
    background_tasks: BackgroundTasks,
    tenant = Depends(get_current_tenant),
    service: InternalWorkspaceService = Depends()
):
    """Trigger employee sync from ERP HR module"""
    if tenant.tenant_mode != "internal":
        raise HTTPException(400, "Only internal tenants can sync from ERP")

    background_tasks.add_task(service.sync_employees, tenant.erp_company_code)
    return {"status": "sync_started"}

@router.post("/projects")
async def sync_projects(
    background_tasks: BackgroundTasks,
    tenant = Depends(get_current_tenant),
    service: InternalWorkspaceService = Depends()
):
    """Trigger project sync from ERP PM module"""
    if tenant.tenant_mode != "internal":
        raise HTTPException(400, "Only internal tenants can sync from ERP")

    background_tasks.add_task(service.sync_projects, tenant.erp_company_code)
    return {"status": "sync_started"}
```

### Phase 4: Provision Internal Tenants

#### Step 4.1: Create Script to Provision Bheemverse Subsidiaries

```python
# File: /bheem-workspace/backend/scripts/provision_internal_tenants.py

import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from services.internal_workspace_service import InternalTenantProvisioner, BHEEMVERSE_COMPANY_CODES
from core.config import settings

async def provision_all_subsidiaries():
    """Provision workspace tenants for all Bheemverse subsidiaries"""
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        provisioner = InternalTenantProvisioner(session)

        for company_code in BHEEMVERSE_COMPANY_CODES:
            print(f"Provisioning {company_code}...")
            result = await provisioner.provision_subsidiary(company_code)
            print(f"  Created tenant: {result}")

if __name__ == "__main__":
    asyncio.run(provision_all_subsidiaries())
```

### Phase 5: Environment Configuration

```bash
# Add to /bheem-workspace/backend/.env

# Mode Detection
BHEEMVERSE_COMPANY_CODES=BHM001,BHM002,BHM003,BHM004,BHM005,BHM006,BHM007,BHM008

# BheemPay Configuration
BHEEMPAY_URL=http://bheem-pay:8006
BHEEMPAY_API_KEY=your-api-key
BHEEMPAY_WEBHOOK_SECRET=your-webhook-secret

# ERP Configuration
ERP_SERVICE_URL=http://localhost:8000
ERP_API_KEY=your-erp-api-key

# Workspace URLs
WORKSPACE_URL=https://workspace.bheem.cloud
```

---

## API Reference

### Billing API (External Mode)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/billing/plans` | GET | Optional | List available plans |
| `/api/v1/billing/checkout` | POST | Required | Create checkout session |
| `/api/v1/billing/subscription` | GET | Required | Get subscription status |
| `/api/v1/billing/subscription/cancel` | POST | Required | Cancel subscription |
| `/api/v1/billing/invoices` | GET | Required | List invoices |
| `/api/v1/billing/webhook` | POST | Signature | Handle payment webhooks |

### ERP Sync API (Internal Mode)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/erp-sync/employees` | POST | Admin | Sync employees from HR |
| `/api/v1/erp-sync/projects` | POST | Admin | Sync projects from PM |
| `/api/v1/erp-sync/status` | GET | Admin | Get sync status |

### BheemPay Endpoints (Reference)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/pay/checkout/subscription` | POST | Create subscription checkout |
| `/api/v1/pay/checkout/{order_id}` | GET | Get checkout status |
| `/api/v1/pay/webhook/subscription` | POST | Subscription webhooks |
| `/api/v1/pay/verify` | POST | Verify payment |

---

## Summary

### Key Points

1. **Bheemverse Innovation (BHM001) is the seller**: All external customers are tracked under BHM001
2. **Full ERP Integration for Both Modes**:
   - **Internal Mode**: HR, PM, CRM access for subsidiaries
   - **External Mode**: CRM, Sales, Accounting for revenue tracking
3. **Subscriptions are in ERP**: Use `public.sku`, `public.sku_subscriptions`, `public.subscriptions` tables
4. **BheemPay handles checkout + ERP sync**: Creates orders, invoices, journal entries
5. **Workspace links via tenant fields**: `erp_subscription_id`, `erp_customer_id`, `erp_company_code`
6. **No duplicate models**: Workspace references ERP data, doesn't duplicate it

### ERP Records Created for External Customers

| Action | ERP Module | Table | Company |
|--------|------------|-------|---------|
| Customer signup | CRM | `crm.contacts` | BHM001 |
| Plan purchase | Inventory | `public.subscriptions` | BHM001 |
| Payment received | Sales | `sales.customer_payments` | BHM001 |
| Invoice generated | Sales | `sales.invoices` | BHM001 |
| Revenue recorded | Accounting | `accounting.journal_entries` | BHM001 |
| Credits allocated | Credits | `user_credit_balances` | - |

### Implementation Checklist

- [ ] Run database migrations for tenant table updates
- [ ] Create BheemPayClient service
- [ ] Create ERPClient service (with CRM, Sales, Accounting methods)
- [ ] Create InternalWorkspaceService
- [ ] Create ExternalWorkspaceService
- [ ] Add billing API routes
- [ ] Add ERP sync API routes
- [ ] **Setup chart of accounts** for Workspace subscription revenue in BHM001
- [ ] **Create SKU plans** in ERP (WORKSPACE-STARTER, WORKSPACE-PRO, etc.)
- [ ] Provision internal tenants for BHM001-BHM008
- [ ] Configure environment variables
- [ ] Test checkout flow end-to-end (verify invoice + journal created)
- [ ] Test employee sync for internal mode
- [ ] Verify revenue appears in BHM001 financial reports

---

## Bheem Notify Integration

### Overview

Bheem Notify is the centralized notification service for all Bheem platform services. Workspace integrates with Bheem Notify to provide multi-channel notifications across Email, SMS, WhatsApp, Push, and In-App channels.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                         BHEEM WORKSPACE NOTIFICATION ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│   ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│   │                         BHEEM WORKSPACE (Port 8500)                               │  │
│   ├──────────────────────────────────────────────────────────────────────────────────┤  │
│   │                                                                                   │  │
│   │  NOTIFICATION TRIGGERS                                                            │  │
│   │  ═══════════════════════                                                          │  │
│   │                                                                                   │  │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │  │
│   │  │    USER      │  │   MEETING    │  │   DOCUMENT   │  │   BILLING    │          │  │
│   │  │   EVENTS     │  │    EVENTS    │  │    EVENTS    │  │    EVENTS    │          │  │
│   │  ├──────────────┤  ├──────────────┤  ├──────────────┤  ├──────────────┤          │  │
│   │  │ • Register   │  │ • Invite     │  │ • Shared     │  │ • Payment    │          │  │
│   │  │ • Login      │  │ • Reminder   │  │ • Comment    │  │ • Invoice    │          │  │
│   │  │ • Pwd Reset  │  │ • Started    │  │ • Mentioned  │  │ • Renewal    │          │  │
│   │  │ • Welcome    │  │ • Ended      │  │ • Updated    │  │ • Failed     │          │  │
│   │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘          │  │
│   │                                                                                   │  │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │  │
│   │  │   CALENDAR   │  │    MAIL      │  │  ERP SYNC    │  │    TEAM      │          │  │
│   │  │   EVENTS     │  │   EVENTS     │  │   EVENTS     │  │   EVENTS     │          │  │
│   │  ├──────────────┤  ├──────────────┤  ├──────────────┤  ├──────────────┤          │  │
│   │  │ • Reminder   │  │ • New Mail   │  │ • Employee   │  │ • Invited    │          │  │
│   │  │ • Updated    │  │ • Mention    │  │   Synced     │  │ • Role Chg   │          │  │
│   │  │ • Cancelled  │  │              │  │ • Project    │  │ • Removed    │          │  │
│   │  │              │  │              │  │   Updated    │  │              │          │  │
│   │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘          │  │
│   │                                                                                   │  │
│   │                            │                                                      │  │
│   │                            ▼                                                      │  │
│   │              ┌─────────────────────────────────┐                                  │  │
│   │              │      NotifyClient               │                                  │  │
│   │              │  (services/notify_client.py)    │                                  │  │
│   │              │  ────────────────────────────   │                                  │  │
│   │              │  • Event-based notifications    │                                  │  │
│   │              │  • Direct channel methods       │                                  │  │
│   │              │  • Template support             │                                  │  │
│   │              │  • Multi-channel dispatch       │                                  │  │
│   │              └─────────────┬───────────────────┘                                  │  │
│   │                            │                                                      │  │
│   └────────────────────────────┼──────────────────────────────────────────────────────┘  │
│                                │ HTTP/REST                                               │
│                                ▼                                                         │
│   ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│   │                         BHEEM NOTIFY SERVICE (Port 8005)                          │  │
│   ├──────────────────────────────────────────────────────────────────────────────────┤  │
│   │                                                                                   │  │
│   │  ┌─────────────────────────────────────────────────────────────────────────────┐ │  │
│   │  │                    EVENT ROUTER & TEMPLATE MAPPER                           │ │  │
│   │  │   company_event_template_mapping → Routes events to correct channels         │ │  │
│   │  └─────────────────────────────────────────────────────────────────────────────┘ │  │
│   │                                                                                   │  │
│   │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐ │  │
│   │  │   EMAIL    │  │    SMS     │  │  WHATSAPP  │  │    PUSH    │  │   VOICE    │ │  │
│   │  │  (Mailgun) │  │  (MSG91)   │  │   (Meta)   │  │ (Firebase) │  │  (MSG91)   │ │  │
│   │  └────────────┘  └────────────┘  └────────────┘  └────────────┘  └────────────┘ │  │
│   │                                                                                   │  │
│   │  FEATURES:                                                                        │  │
│   │  • Exponential backoff retry (max 5 retries)                                      │  │
│   │  • Dead letter queue for failed notifications                                     │  │
│   │  • Rate limiting per channel/company                                              │  │
│   │  • Delivery status webhooks                                                       │  │
│   │  • Template management                                                            │  │
│   │  • Multi-tenant isolation                                                         │  │
│   │                                                                                   │  │
│   └──────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Workspace Notification Event Types

| Event Type | Description | Channels | Template |
|------------|-------------|----------|----------|
| **User Events** | | | |
| `WORKSPACE_USER_REGISTERED` | New user registration | Email, SMS | WORKSPACE_WELCOME |
| `WORKSPACE_USER_VERIFIED` | Email verified | Email | WORKSPACE_VERIFIED |
| `WORKSPACE_PASSWORD_RESET` | Password reset request | Email | WORKSPACE_PASSWORD_RESET |
| `WORKSPACE_LOGIN_ALERT` | New device login | Email, SMS | WORKSPACE_LOGIN_ALERT |
| **Meeting Events** | | | |
| `WORKSPACE_MEETING_INVITE` | Meeting invitation | Email, WhatsApp | WORKSPACE_MEETING_INVITE |
| `WORKSPACE_MEETING_REMINDER` | Meeting reminder (15min/1hr) | Email, SMS, Push | WORKSPACE_MEETING_REMINDER |
| `WORKSPACE_MEETING_STARTED` | Meeting has started | Push, SMS | WORKSPACE_MEETING_STARTED |
| `WORKSPACE_MEETING_ENDED` | Meeting ended with summary | Email | WORKSPACE_MEETING_SUMMARY |
| `WORKSPACE_MEETING_RECORDING` | Recording available | Email | WORKSPACE_RECORDING_READY |
| **Document Events** | | | |
| `WORKSPACE_DOCUMENT_SHARED` | Document shared with user | Email, Push | WORKSPACE_DOC_SHARED |
| `WORKSPACE_DOCUMENT_COMMENT` | New comment on document | Email, Push | WORKSPACE_DOC_COMMENT |
| `WORKSPACE_DOCUMENT_MENTIONED` | User mentioned in document | Email, Push | WORKSPACE_DOC_MENTION |
| **Billing Events** | | | |
| `WORKSPACE_PAYMENT_SUCCESS` | Payment completed | Email | WORKSPACE_PAYMENT_RECEIPT |
| `WORKSPACE_PAYMENT_FAILED` | Payment failed | Email, SMS | WORKSPACE_PAYMENT_FAILED |
| `WORKSPACE_INVOICE_GENERATED` | New invoice generated | Email | WORKSPACE_INVOICE |
| `WORKSPACE_SUBSCRIPTION_RENEWAL` | Subscription renewing soon | Email | WORKSPACE_RENEWAL_REMINDER |
| `WORKSPACE_SUBSCRIPTION_CANCELLED` | Subscription cancelled | Email | WORKSPACE_SUBSCRIPTION_CANCELLED |
| **Team Events** | | | |
| `WORKSPACE_TEAM_INVITE` | Invited to workspace | Email | WORKSPACE_TEAM_INVITE |
| `WORKSPACE_ROLE_CHANGED` | Role changed in workspace | Email | WORKSPACE_ROLE_CHANGED |
| **Calendar Events** | | | |
| `WORKSPACE_CALENDAR_REMINDER` | Event reminder | Email, SMS, Push | WORKSPACE_CALENDAR_REMINDER |
| `WORKSPACE_CALENDAR_UPDATED` | Event updated | Email, Push | WORKSPACE_CALENDAR_UPDATED |
| **ERP Sync Events** | | | |
| `WORKSPACE_EMPLOYEE_SYNCED` | Employee provisioned from ERP | Email | WORKSPACE_EMPLOYEE_WELCOME |
| `WORKSPACE_PROJECT_SYNCED` | Project synced from ERP | Email | WORKSPACE_PROJECT_ASSIGNED |

### Event-Template Mapping Configuration

Configure event-to-template mappings via Bheem Notify API:

```bash
# Create event mapping for Workspace (BHM001 or specific tenant company)
POST http://bheem-notify:8005/api/v1/company/{company_id}/notify/mappings
Content-Type: application/json
X-API-Key: your-api-key

{
  "event_type": "WORKSPACE_MEETING_INVITE",
  "channel": "EMAIL",
  "template_name": "workspace_meeting_invite",
  "variable_mapping": {
    "meeting_name": "meeting_name",
    "host_name": "host_name",
    "meeting_url": "meeting_url",
    "scheduled_time": "scheduled_time",
    "recipient_name": "recipient.name"
  },
  "default_variables": {
    "app_name": "Bheem Workspace",
    "support_email": "support@bheem.cloud"
  },
  "description": "Meeting invitation email for Workspace",
  "is_enabled": true
}
```

### Multi-Channel Notification Configuration

```sql
-- Company notification config for Workspace tenants
INSERT INTO public.company_notification_config (
    company_id, company_code, channel, provider,
    sender_email, sender_phone, is_enabled, is_default, priority
) VALUES
-- BHM001 (Bheemverse - sells external workspace)
('79f70aef-17eb-48a8-b599-2879721e8796', 'BHM001', 'EMAIL', 'mailgun',
 'workspace@bheem.cloud', NULL, true, true, 1),
('79f70aef-17eb-48a8-b599-2879721e8796', 'BHM001', 'SMS', 'bheem_tele',
 NULL, '+44XXXXXXXXXX', true, true, 1),
('79f70aef-17eb-48a8-b599-2879721e8796', 'BHM001', 'WHATSAPP', 'meta',
 NULL, '+44XXXXXXXXXX', true, true, 1),
('79f70aef-17eb-48a8-b599-2879721e8796', 'BHM001', 'PUSH', 'firebase',
 NULL, NULL, true, false, 2);
```

### NotifyClient Integration in Workspace

**Reference Implementation**: Bheem Core uses a unified notify client at:
`/bheem-core/apps/backend/app/integrations/notify/notify_client.py`

**Workspace should follow the same pattern** for consistency across the Bheem ecosystem.

### Bheem Core NotifyClient Pattern (To Adopt in Workspace)

```python
# ═══════════════════════════════════════════════════════════════════
# BHEEM CORE PATTERN - USE THIS IN WORKSPACE
# ═══════════════════════════════════════════════════════════════════
# Reference: /bheem-core/apps/backend/app/integrations/notify/notify_client.py

from app.integrations.notify.notify_client import notify_client

# ─────────────────────────────────────────────────────────────────
# 1. TEMPLATE EMAILS (Primary method for transactional emails)
# ─────────────────────────────────────────────────────────────────
# Used in: HR (leave_calendar_service), CRM (meeting_calendar_service),
#          Accounting (ar_service), PM (task_calendar_service)

await notify_client.send_template_email(
    to="customer@example.com",
    template_name="leave_approved",  # Template registered in bheem-notify
    template_vars={
        "employee_name": "John Doe",
        "leave_type": "Annual Leave",
        "start_date": "January 15, 2026",
        "end_date": "January 20, 2026",
        "approver_name": "Jane Smith",
        "days": 6
    }
)

# ─────────────────────────────────────────────────────────────────
# 2. MEETING INVITATIONS (Built-in method)
# ─────────────────────────────────────────────────────────────────
# Used in: CRM (meeting_calendar_service.py:162)

await notify_client.send_meeting_invite(
    to="attendee@example.com",
    meeting_title="Sales Discovery Call",
    meeting_time="January 15, 2026 at 10:00 AM",
    meeting_url="https://meet.bheem.cloud/room123",
    host_name="John Doe"
)

# ─────────────────────────────────────────────────────────────────
# 3. SMS NOTIFICATIONS
# ─────────────────────────────────────────────────────────────────
# Used in: HR (leave_calendar_service.py:317), CRM (meeting_calendar_service.py:189)

await notify_client.send_sms(
    to="919876543210",
    message="Your Annual Leave from 15 Jan to 20 Jan has been approved by Jane Smith."
)

# ─────────────────────────────────────────────────────────────────
# 4. WHATSAPP MESSAGES
# ─────────────────────────────────────────────────────────────────
# Used in: PM (task_calendar_service.py:326)

# Template message (for proactive notifications)
await notify_client.send_whatsapp_template(
    to="919876543210",
    template_name="task_reminder",
    template_variables={"task_name": "Review PR", "due_date": "Today 5 PM"}
)

# Text message (within 24h session window)
await notify_client.send_whatsapp_text(
    to="919876543210",
    message="Your task 'Review PR' is due today at 5 PM"
)

# ─────────────────────────────────────────────────────────────────
# 5. OTP VERIFICATION
# ─────────────────────────────────────────────────────────────────

# Send OTP
result = await notify_client.send_otp(to="919876543210", otp_length=6)
request_id = result.get("request_id")

# Verify OTP
verified = await notify_client.verify_otp(to="919876543210", otp="123456")

# ─────────────────────────────────────────────────────────────────
# 6. WELCOME EMAIL
# ─────────────────────────────────────────────────────────────────

await notify_client.send_welcome_email(
    to="newuser@example.com",
    name="John Doe",
    company_name="Bheem Workspace"
)

# ─────────────────────────────────────────────────────────────────
# 7. MULTI-CHANNEL PATTERN (Email + SMS)
# ─────────────────────────────────────────────────────────────────
# Pattern from: HR leave_calendar_service.py

async def send_leave_approved_notification(
    employee_email: str,
    employee_phone: Optional[str],
    employee_name: str,
    leave_type: str,
    start_date: date,
    end_date: date,
    approver_name: str
) -> Dict[str, Any]:
    """Multi-channel notification pattern from bheem-core"""
    results = {"email": None, "sms": None}

    # Email notification
    try:
        results["email"] = await notify_client.send_template_email(
            to=employee_email,
            template_name="leave_approved",
            template_vars={
                "employee_name": employee_name,
                "leave_type": leave_type,
                "start_date": start_date.strftime("%B %d, %Y"),
                "end_date": end_date.strftime("%B %d, %Y"),
                "approver_name": approver_name,
                "days": (end_date - start_date).days + 1
            }
        )
    except Exception as e:
        logger.error(f"Email notification failed: {e}")
        results["email"] = {"error": str(e)}

    # SMS notification (if phone provided)
    if employee_phone:
        try:
            results["sms"] = await notify_client.send_sms(
                to=employee_phone,
                message=f"Your {leave_type} from {start_date.strftime('%d %b')} to {end_date.strftime('%d %b')} has been approved by {approver_name}."
            )
        except Exception as e:
            logger.error(f"SMS notification failed: {e}")
            results["sms"] = {"error": str(e)}

    return {"notifications_sent": True, "channels": results}
```

### Workspace NotifyClient Alignment

The current workspace `notify_client.py` should be updated to match bheem-core's implementation:

| Feature | Bheem Core | Workspace (Current) | Action Needed |
|---------|------------|---------------------|---------------|
| Location | `app/integrations/notify/` | `services/` | Move to integrations folder |
| Auth Header | `X-API-Key` | `Bearer` token | Update to X-API-Key |
| Email Endpoint | `/api/v1/email/send` | `/bheem-tele/email/send` | Update endpoints |
| Template Email | `send_template_email(to, template_name, template_vars)` | `send_template_email(to, template_code, variables)` | Align signature |
| Meeting Invite | `send_meeting_invite(to, title, time, url, host)` | Custom implementation | Use built-in method |

### Recommended Workspace NotifyClient Update

```python
# File: /bheem-workspace/backend/integrations/notify/notify_client.py
# Copy from: /bheem-core/apps/backend/app/integrations/notify/notify_client.py

"""
Notify Client for Bheem Notify Service
=======================================
Client for centralized notification service.
Aligned with bheem-core implementation.
"""

import os
import httpx
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)


class NotifyClient:
    """Client for Bheem Notify Service (Port 8005)"""

    def __init__(self):
        self.notify_url = os.getenv("NOTIFY_SERVICE_URL", "http://bheem-notify:8005")
        self.api_key = os.getenv("NOTIFY_API_KEY", "")
        self.timeout = float(os.getenv("NOTIFY_TIMEOUT", "30.0"))

    def _headers(self) -> Dict[str, str]:
        """Get request headers with X-API-Key authentication"""
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        return headers

    async def send_template_email(
        self,
        to: str,
        template_name: str,
        template_vars: Dict[str, Any],
        subject: Optional[str] = None,
        from_email: Optional[str] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Send email using a predefined template (bheem-core pattern)"""
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.notify_url}/api/v1/email/send/template",
                json={
                    "to": to,
                    "template_name": template_name,
                    "template_vars": template_vars,
                    "subject": subject,
                    "from_email": from_email,
                    "cc": cc,
                    "bcc": bcc
                },
                headers=self._headers()
            )
            return response.json()

    async def send_meeting_invite(
        self,
        to: str,
        meeting_title: str,
        meeting_time: str,
        meeting_url: str,
        host_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send meeting invitation email (bheem-core pattern)"""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.notify_url}/api/v1/mail/bheem-tele/meeting-invite",
                json={
                    "to": to,
                    "meeting_title": meeting_title,
                    "meeting_time": meeting_time,
                    "meeting_url": meeting_url,
                    "host_name": host_name
                },
                headers=self._headers()
            )
            return response.json()

    async def send_sms(
        self,
        to: str,
        message: str,
        sender_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send SMS via MSG91/BheemTele (bheem-core pattern)"""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.notify_url}/api/v1/bheem-tele/sms/send",
                json={
                    "to": to,
                    "message": message,
                    "sender_id": sender_id
                },
                headers=self._headers()
            )
            return response.json()

    # ... (copy remaining methods from bheem-core)


# Singleton instance
notify_client = NotifyClient()
```

### Integration Points in Workspace (Using Bheem Core Pattern)

#### 1. User Registration & Authentication

```python
# File: /bheem-workspace/backend/api/auth.py
# Pattern: Bheem Core HR module

from integrations.notify.notify_client import notify_client

@router.post("/register")
async def register_user(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # ... create user logic ...

    # Send welcome notification (bheem-core pattern)
    await notify_client.send_welcome_email(
        to=request.email,
        name=request.name,
        company_name="Bheem Workspace"
    )

    # If phone provided, send OTP for verification
    if request.phone:
        result = await notify_client.send_otp(
            to=request.phone,
            otp_length=6
        )
        # Store request_id for verification

    return {"message": "Registration successful"}


@router.post("/password-reset/request")
async def request_password_reset(request: PasswordResetRequest, db: AsyncSession = Depends(get_db)):
    # ... generate reset token ...

    # Use template email (bheem-core pattern)
    await notify_client.send_template_email(
        to=request.email,
        template_name="password_reset",
        template_vars={
            "user_name": user.name,
            "reset_link": f"{settings.WORKSPACE_URL}/reset-password?token={reset_token}",
            "expiry_hours": 1
        }
    )

    return {"message": "Reset email sent"}
```

#### 2. Meeting Notifications

```python
# File: /bheem-workspace/backend/api/meet.py
# Pattern: Bheem Core CRM meeting_calendar_service.py

from integrations.notify.notify_client import notify_client

@router.post("/rooms/{room_id}/invite")
async def invite_to_meeting(
    room_id: str,
    request: InviteRequest,
    current_user: User = Depends(get_current_user)
):
    room = await get_room(room_id)
    meet_url = f"https://meet.bheem.cloud/{room_id}"

    # Send to each invitee (bheem-core pattern)
    notifications = {"email": [], "sms": []}

    for invitee in request.invitees:
        # Email notification
        if invitee.email:
            try:
                email_result = await notify_client.send_meeting_invite(
                    to=invitee.email,
                    meeting_title=room.name,
                    meeting_time=room.scheduled_at.strftime("%B %d, %Y at %I:%M %p") if room.scheduled_at else "Now",
                    meeting_url=meet_url,
                    host_name=current_user.name
                )
                notifications["email"].append({"to": invitee.email, "result": email_result})
            except Exception as e:
                logger.error(f"[MEET] Email notification failed: {e}")

        # SMS notification
        if invitee.phone:
            try:
                message = f"Meeting: {room.name} - Join: {meet_url}"
                sms_result = await notify_client.send_sms(
                    to=invitee.phone,
                    message=message
                )
                notifications["sms"].append({"to": invitee.phone, "result": sms_result})
            except Exception as e:
                logger.error(f"[MEET] SMS notification failed: {e}")

    return {
        "message": f"Invitations sent to {len(request.invitees)} participants",
        "notifications": notifications
    }
```

#### 3. Billing & Subscription Notifications

```python
# File: /bheem-workspace/backend/api/billing.py
# Pattern: Bheem Core Sales subscription_notification_handler.py

from integrations.notify.notify_client import notify_client

@router.post("/webhook")
async def handle_bheempay_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.json()
    event_type = payload.get("event")
    data = payload.get("payload", {})

    tenant_id = data.get("metadata", {}).get("tenant_id")
    tenant = await get_tenant(db, tenant_id)

    if event_type == "payment.captured":
        # Send payment success notification (bheem-core pattern)
        try:
            await notify_client.send_template_email(
                to=tenant.billing_email,
                template_name="payment_receipt",
                template_vars={
                    "customer_name": tenant.name,
                    "invoice_number": data.get("invoice_number"),
                    "amount": f"₹{data.get('amount'):,.2f}",
                    "plan_name": data.get("plan_name"),
                    "payment_date": datetime.now().strftime("%B %d, %Y"),
                    "receipt_url": f"{settings.WORKSPACE_URL}/billing/receipt/{data.get('payment_id')}"
                }
            )
        except Exception as e:
            logger.error(f"[BILLING] Payment receipt email failed: {e}")

    elif event_type == "payment.failed":
        # Multi-channel notification (bheem-core pattern)
        results = {"email": None, "sms": None}

        try:
            results["email"] = await notify_client.send_template_email(
                to=tenant.billing_email,
                template_name="payment_failed",
                template_vars={
                    "customer_name": tenant.name,
                    "plan_name": data.get("plan_name"),
                    "amount": f"₹{data.get('amount'):,.2f}",
                    "retry_url": f"{settings.WORKSPACE_URL}/billing/retry"
                }
            )
        except Exception as e:
            logger.error(f"[BILLING] Payment failed email error: {e}")

        if tenant.billing_phone:
            try:
                results["sms"] = await notify_client.send_sms(
                    to=tenant.billing_phone,
                    message=f"Payment failed for {data.get('plan_name')}. Please retry: {settings.WORKSPACE_URL}/billing/retry"
                )
            except Exception as e:
                logger.error(f"[BILLING] Payment failed SMS error: {e}")

    elif event_type == "subscription.cancelled":
        await notify_client.send_template_email(
            to=tenant.billing_email,
            template_name="subscription_cancelled",
            template_vars={
                "customer_name": tenant.name,
                "plan_name": data.get("plan_name"),
                "end_date": data.get("period_end"),
                "reactivate_url": f"{settings.WORKSPACE_URL}/billing/plans"
            }
        )

    return {"status": "processed"}
```

#### 4. ERP Sync Notifications

```python
# File: /bheem-workspace/backend/services/internal_workspace_service.py
# Pattern: Bheem Core HR handlers.py

from integrations.notify.notify_client import notify_client

async def sync_employees(self, company_code: str) -> dict:
    """Sync employees from ERP and send welcome notifications"""
    company_id = self.get_company_id(company_code)
    employees = await self._erp_request("GET", "/hr/employees", params={"company_id": company_id})

    synced = 0
    notifications_sent = 0

    for emp in employees.get("items", []):
        # Upsert user
        is_new = await self._upsert_workspace_user(...)

        # Send welcome notification for new employees (bheem-core pattern)
        if is_new:
            try:
                await notify_client.send_template_email(
                    to=emp["work_email"],
                    template_name="employee_workspace_welcome",
                    template_vars={
                        "employee_name": f"{emp['first_name']} {emp['last_name']}",
                        "company_name": company_code,
                        "department": emp.get("department", {}).get("name", ""),
                        "manager_name": emp.get("manager", {}).get("name", ""),
                        "login_url": f"{settings.WORKSPACE_URL}/login",
                        "help_url": f"{settings.WORKSPACE_URL}/help"
                    }
                )
                notifications_sent += 1
            except Exception as e:
                logger.error(f"[ERP_SYNC] Welcome email failed for {emp['work_email']}: {e}")

        synced += 1

    return {
        "synced": synced,
        "notifications_sent": notifications_sent
    }
```

#### 5. Document Sharing Notifications

```python
# File: /bheem-workspace/backend/api/docs.py
# Pattern: Bheem Core DMS notification_service.py

from integrations.notify.notify_client import notify_client

@router.post("/documents/{doc_id}/share")
async def share_document(
    doc_id: str,
    request: ShareRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    document = await get_document(db, doc_id)

    # Share with each recipient
    for recipient in request.recipients:
        # Create share record
        await create_share_record(db, doc_id, recipient.email, request.permission)

        # Send notification (bheem-core pattern)
        try:
            await notify_client.send_template_email(
                to=recipient.email,
                template_name="document_shared",
                template_vars={
                    "recipient_name": recipient.name or recipient.email,
                    "document_name": document.name,
                    "shared_by": current_user.name,
                    "permission": request.permission,  # view, edit, comment
                    "document_url": f"{settings.WORKSPACE_URL}/docs/{doc_id}",
                    "message": request.message or ""
                }
            )
        except Exception as e:
            logger.error(f"[DOCS] Share notification failed: {e}")

    return {"shared_with": len(request.recipients)}
```

#### 6. Calendar Event Reminders

```python
# File: /bheem-workspace/backend/services/calendar_service.py
# Pattern: Bheem Core PM task_calendar_service.py

from integrations.notify.notify_client import notify_client

async def send_event_reminder(
    event: CalendarEvent,
    reminder_minutes: int = 15
) -> Dict[str, Any]:
    """Send calendar event reminder notification"""
    results = {"email": None, "sms": None, "whatsapp": None}

    # Get attendees
    attendees = await get_event_attendees(event.id)

    for attendee in attendees:
        # Email reminder
        try:
            results["email"] = await notify_client.send_template_email(
                to=attendee.email,
                template_name="calendar_reminder",
                template_vars={
                    "event_title": event.title,
                    "event_time": event.start_time.strftime("%I:%M %p"),
                    "reminder_text": f"in {reminder_minutes} minutes",
                    "event_url": f"{settings.WORKSPACE_URL}/calendar/event/{event.id}",
                    "location": event.location or "No location specified"
                }
            )
        except Exception as e:
            logger.error(f"[CALENDAR] Reminder email failed: {e}")

        # SMS reminder (if phone available)
        if attendee.phone:
            try:
                results["sms"] = await notify_client.send_sms(
                    to=attendee.phone,
                    message=f"Reminder: {event.title} starts in {reminder_minutes} min"
                )
            except Exception as e:
                logger.error(f"[CALENDAR] Reminder SMS failed: {e}")

        # WhatsApp reminder (optional)
        if attendee.whatsapp_enabled and attendee.phone:
            try:
                results["whatsapp"] = await notify_client.send_whatsapp_text(
                    to=attendee.phone,
                    message=f"📅 Reminder: {event.title} starts in {reminder_minutes} minutes"
                )
            except Exception as e:
                logger.error(f"[CALENDAR] Reminder WhatsApp failed: {e}")

    return results
```

### WhatsApp Templates for Workspace

Register these templates with Meta WhatsApp Business:

| Template Name | Category | Variables | Message |
|---------------|----------|-----------|---------|
| `workspace_meeting_invite` | UTILITY | meeting_name, host_name, meeting_url | "You're invited to {{1}} by {{2}}. Join here: {{3}}" |
| `workspace_meeting_reminder` | UTILITY | meeting_name, time, url | "Reminder: {{1}} starts in {{2}}. Join: {{3}}" |
| `workspace_document_shared` | UTILITY | doc_name, shared_by, url | "{{2}} shared '{{1}}' with you. View: {{3}}" |
| `workspace_payment_reminder` | UTILITY | amount, due_date, url | "Payment of {{1}} is due on {{2}}. Pay now: {{3}}" |
| `workspace_otp` | AUTHENTICATION | otp_code | "Your Bheem Workspace code is {{1}}. Valid for 10 minutes." |

### Real-Time In-App Notifications (Future Enhancement)

For real-time notifications within the Workspace UI:

```
┌─────────────────────────────────────────────────────────────────┐
│                    REAL-TIME NOTIFICATION FLOW                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Workspace Backend ──────────▶ Redis Pub/Sub ──────────▶ WebSocket Server
│                                    │                              │
│                                    │                              │
│                                    ▼                              ▼
│                            Bheem Notify              Frontend Clients
│                            (stores history)          (real-time updates)
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation Plan**:

1. Add WebSocket endpoint in Workspace backend
2. Publish notifications to Redis channel on events
3. Frontend connects via WebSocket to receive real-time updates
4. Store notification history in database for notification center

```python
# Proposed: /bheem-workspace/backend/api/notifications_ws.py

from fastapi import WebSocket, WebSocketDisconnect
import aioredis

class NotificationManager:
    def __init__(self):
        self.connections: Dict[str, WebSocket] = {}
        self.redis = None

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        self.connections[user_id] = websocket
        await self._subscribe_to_user_channel(user_id)

    async def send_notification(self, user_id: str, notification: dict):
        if user_id in self.connections:
            await self.connections[user_id].send_json(notification)

    async def broadcast_to_tenant(self, tenant_id: str, notification: dict):
        # Get all users in tenant and send notification
        pass


@router.websocket("/ws/notifications")
async def notification_websocket(
    websocket: WebSocket,
    token: str = Query(...),
    manager: NotificationManager = Depends()
):
    user = await verify_token(token)
    await manager.connect(user.id, websocket)

    try:
        while True:
            # Keep connection alive, receive acknowledgments
            data = await websocket.receive_json()
            if data.get("type") == "ack":
                await mark_notification_read(data["notification_id"])
    except WebSocketDisconnect:
        manager.disconnect(user.id)
```

### Environment Configuration

Add to `/bheem-workspace/backend/.env`:

```bash
# ═══════════════════════════════════════════════════════════════════
# BHEEM NOTIFY CONFIGURATION
# ═══════════════════════════════════════════════════════════════════

# Notify Service URLs
NOTIFY_SERVICE_URL=http://bheem-notify:8005
NOTIFY_PUBLIC_URL=https://bheem.co.uk:8005

# API Key for Notify Service
NOTIFY_API_KEY=your-workspace-notify-api-key

# Company ID for External Customers (BHM001)
WORKSPACE_NOTIFY_COMPANY_ID=79f70aef-17eb-48a8-b599-2879721e8796

# Default sender configuration
NOTIFY_FROM_EMAIL=workspace@bheem.cloud
NOTIFY_FROM_NAME=Bheem Workspace
NOTIFY_SMS_SENDER_ID=BHEEM
NOTIFY_WHATSAPP_NUMBER=+44XXXXXXXXXX

# Real-time notifications (future)
REDIS_URL=redis://redis:6379
NOTIFICATION_WS_ENABLED=false
```

### Notification Service Setup Script

```python
# File: /bheem-workspace/backend/scripts/setup_notifications.py

"""
Setup notification templates and event mappings for Bheem Workspace.
Run once during initial deployment or when adding new notification types.
"""

import asyncio
import httpx

NOTIFY_URL = "http://bheem-notify:8005/api/v1"
API_KEY = "your-api-key"
WORKSPACE_COMPANY_ID = "79f70aef-17eb-48a8-b599-2879721e8796"  # BHM001

# Event-Template Mappings
WORKSPACE_MAPPINGS = [
    {
        "event_type": "WORKSPACE_USER_REGISTERED",
        "channel": "EMAIL",
        "template_name": "workspace_welcome",
        "variable_mapping": {
            "username": "recipient.name",
            "dashboard_url": "data.dashboard_url"
        }
    },
    {
        "event_type": "WORKSPACE_MEETING_INVITE",
        "channel": "EMAIL",
        "template_name": "workspace_meeting_invite",
        "variable_mapping": {
            "meeting_name": "data.meeting_name",
            "host_name": "data.host_name",
            "meeting_url": "data.meeting_url",
            "scheduled_time": "data.scheduled_time"
        }
    },
    {
        "event_type": "WORKSPACE_MEETING_INVITE",
        "channel": "WHATSAPP",
        "template_name": "workspace_meeting_invite",
        "variable_mapping": {
            "1": "data.meeting_name",
            "2": "data.host_name",
            "3": "data.meeting_url"
        }
    },
    {
        "event_type": "WORKSPACE_PAYMENT_SUCCESS",
        "channel": "EMAIL",
        "template_name": "workspace_payment_receipt",
        "variable_mapping": {
            "invoice_number": "data.invoice_number",
            "amount": "data.amount",
            "plan_name": "data.plan_name",
            "receipt_url": "data.receipt_url"
        }
    },
    {
        "event_type": "WORKSPACE_DOCUMENT_SHARED",
        "channel": "EMAIL",
        "template_name": "workspace_doc_shared",
        "variable_mapping": {
            "document_name": "data.document_name",
            "shared_by": "data.shared_by",
            "document_url": "data.document_url"
        }
    },
    {
        "event_type": "WORKSPACE_DOCUMENT_SHARED",
        "channel": "WHATSAPP",
        "template_name": "workspace_document_shared",
        "variable_mapping": {
            "1": "data.document_name",
            "2": "data.shared_by",
            "3": "data.document_url"
        }
    }
]


async def setup_mappings():
    async with httpx.AsyncClient() as client:
        headers = {"X-API-Key": API_KEY, "Content-Type": "application/json"}

        for mapping in WORKSPACE_MAPPINGS:
            response = await client.post(
                f"{NOTIFY_URL}/company/{WORKSPACE_COMPANY_ID}/notify/mappings",
                headers=headers,
                json=mapping
            )

            if response.status_code in (200, 201):
                print(f"✓ Created: {mapping['event_type']} -> {mapping['channel']}")
            elif response.status_code == 409:
                print(f"⊘ Exists: {mapping['event_type']} -> {mapping['channel']}")
            else:
                print(f"✗ Failed: {mapping['event_type']} -> {response.text}")


if __name__ == "__main__":
    asyncio.run(setup_mappings())
```

### Implementation Checklist - Bheem Notify Integration

- [ ] Verify notify_client.py is properly configured
- [ ] Add event notification helper function
- [ ] Update auth.py with welcome/OTP notifications
- [ ] Update meet.py with meeting invitation notifications
- [ ] Update billing.py webhook handler with payment notifications
- [ ] Update internal_workspace_service.py with ERP sync notifications
- [ ] Update docs.py with document sharing notifications
- [ ] Run setup_notifications.py to create event mappings
- [ ] Configure environment variables
- [ ] Register WhatsApp templates with Meta
- [ ] Test all notification flows end-to-end
- [ ] (Future) Implement WebSocket real-time notifications
- [ ] (Future) Add notification preferences per user

---

## Summary

### Key Points

1. **Bheemverse Innovation (BHM001) is the seller**: All external customers are tracked under BHM001
2. **Full ERP Integration for Both Modes**:
   - **Internal Mode**: HR, PM, CRM access for subsidiaries
   - **External Mode**: CRM, Sales, Accounting for revenue tracking
3. **Subscriptions are in ERP**: Use `public.sku`, `public.sku_subscriptions`, `public.subscriptions` tables
4. **BheemPay handles checkout + ERP sync**: Creates orders, invoices, journal entries
5. **Workspace links via tenant fields**: `erp_subscription_id`, `erp_customer_id`, `erp_company_code`
6. **No duplicate models**: Workspace references ERP data, doesn't duplicate it
7. **Bheem Notify for all notifications**: Centralized multi-channel notification via event-based system

### ERP Records Created for External Customers

| Action | ERP Module | Table | Company |
|--------|------------|-------|---------|
| Customer signup | CRM | `crm.contacts` | BHM001 |
| Plan purchase | Inventory | `public.subscriptions` | BHM001 |
| Payment received | Sales | `sales.customer_payments` | BHM001 |
| Invoice generated | Sales | `sales.invoices` | BHM001 |
| Revenue recorded | Accounting | `accounting.journal_entries` | BHM001 |
| Credits allocated | Credits | `user_credit_balances` | - |

### Implementation Checklist

- [ ] Run database migrations for tenant table updates
- [ ] Create BheemPayClient service
- [ ] Create ERPClient service (with CRM, Sales, Accounting methods)
- [ ] Create InternalWorkspaceService
- [ ] Create ExternalWorkspaceService
- [ ] Add billing API routes
- [ ] Add ERP sync API routes
- [ ] **Setup chart of accounts** for Workspace subscription revenue in BHM001
- [ ] **Create SKU plans** in ERP (WORKSPACE-STARTER, WORKSPACE-PRO, etc.)
- [ ] Provision internal tenants for BHM001-BHM008
- [ ] Configure environment variables
- [ ] Test checkout flow end-to-end (verify invoice + journal created)
- [ ] Test employee sync for internal mode
- [ ] Verify revenue appears in BHM001 financial reports
- [ ] **Setup Bheem Notify event mappings for Workspace**
- [ ] **Configure notification channels (Email, SMS, WhatsApp)**
- [ ] **Register WhatsApp templates with Meta**
- [ ] **Integrate notifications in all Workspace API endpoints**
- [ ] **Test notification delivery across all channels**

---

*Document Version: 3.0*
*Last Updated: January 2, 2026*
*Author: Bheem Development Team*
