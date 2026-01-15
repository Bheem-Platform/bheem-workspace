#!/usr/bin/env python3
"""
Test script to verify ERP Sales & Accounting integration.
Tests the complete payment → ERP flow.
"""
import asyncio
import sys
from datetime import date
from uuid import uuid4

# Add backend to path
sys.path.insert(0, '/home/coder/bheem-workspace/backend')

from services.erp_client import erp_client
from core.config import settings


async def test_erp_connection():
    """Test basic ERP connectivity"""
    print("\n" + "="*60)
    print("1. TESTING ERP CONNECTION")
    print("="*60)

    try:
        # Test getting sales customers
        customers = await erp_client.get_sales_customers(limit=1)
        print(f"✓ ERP Sales API connected - Found {len(customers)} customers")
        return True
    except Exception as e:
        print(f"✗ ERP Sales API error: {e}")
        return False


async def test_create_sales_customer():
    """Test creating a sales customer"""
    print("\n" + "="*60)
    print("2. TESTING SALES CUSTOMER CREATION")
    print("="*60)

    try:
        test_email = f"test-{uuid4().hex[:8]}@bheemworkspace.test"
        customer = await erp_client.create_sales_customer(
            name="Test Workspace Tenant",
            email=test_email,
            company_id=settings.BHEEMVERSE_PARENT_COMPANY_CODE,
            phone="+91-9999999999",
            address={"country": "IN", "city": "Mumbai"},
            payment_terms=30,
            metadata={
                "source": "test_script",
                "workspace_tenant_id": str(uuid4())
            }
        )
        customer_id = customer.get("id")
        print(f"✓ Created Sales Customer: {customer_id}")
        print(f"  Name: {customer.get('name')}")
        print(f"  Email: {test_email}")
        return customer_id
    except Exception as e:
        print(f"✗ Failed to create customer: {e}")
        return None


async def test_create_sales_order(customer_id: str):
    """Test creating a sales order"""
    print("\n" + "="*60)
    print("3. TESTING SALES ORDER CREATION")
    print("="*60)

    try:
        order_items = [{
            "sku_code": "WORKSPACE-PROFESSIONAL",
            "description": "Bheem Workspace Professional Subscription (Monthly)",
            "quantity": 1,
            "unit_price": 2499.00,
            "tax_rate": 18.0
        }]

        order = await erp_client.create_sales_order(
            customer_id=customer_id,
            company_id=settings.BHEEMVERSE_PARENT_COMPANY_CODE,
            items=order_items,
            currency="INR",
            reference=f"TEST-{uuid4().hex[:8]}",
            notes="Test order from Bheem Workspace"
        )
        order_id = order.get("id")
        print(f"✓ Created Sales Order: {order_id}")
        print(f"  Status: {order.get('status', 'created')}")

        # Confirm the order
        try:
            await erp_client.confirm_sales_order(order_id)
            print(f"✓ Confirmed Sales Order: {order_id}")
        except Exception as e:
            print(f"⚠ Order confirmation: {e}")

        return order_id
    except Exception as e:
        print(f"✗ Failed to create order: {e}")
        return None


async def test_create_sales_invoice(customer_id: str, order_id: str = None):
    """Test creating a sales invoice"""
    print("\n" + "="*60)
    print("4. TESTING SALES INVOICE CREATION")
    print("="*60)

    try:
        invoice_items = [{
            "sku_code": "WORKSPACE-PROFESSIONAL",
            "description": "Bheem Workspace Professional Subscription (Monthly)",
            "quantity": 1,
            "unit_price": 2499.00,
            "tax_rate": 18.0
        }]

        invoice = await erp_client.create_sales_invoice(
            customer_id=customer_id,
            company_id=settings.BHEEMVERSE_PARENT_COMPANY_CODE,
            items=invoice_items,
            currency="INR",
            due_date=date.today().isoformat(),
            reference=f"INV-TEST-{uuid4().hex[:8]}",
            notes="Test invoice from Bheem Workspace",
            sales_order_id=order_id
        )
        invoice_id = invoice.get("id")
        print(f"✓ Created Sales Invoice: {invoice_id}")
        print(f"  Total: ₹{invoice.get('total', 'N/A')}")

        # Issue the invoice
        try:
            await erp_client.issue_sales_invoice(invoice_id)
            print(f"✓ Issued Sales Invoice: {invoice_id}")
        except Exception as e:
            print(f"⚠ Invoice issuance: {e}")

        # Mark as paid
        try:
            payment = await erp_client.mark_invoice_paid(
                invoice_id=invoice_id,
                payment_date=date.today().isoformat(),
                payment_method="online",
                payment_reference=f"PAY-TEST-{uuid4().hex[:8]}"
            )
            print(f"✓ Marked Invoice Paid: {payment.get('id', 'success')}")
        except Exception as e:
            print(f"⚠ Payment recording: {e}")

        return invoice_id
    except Exception as e:
        print(f"✗ Failed to create invoice: {e}")
        return None


async def test_create_ar_invoice(customer_id: str):
    """Test creating AR invoice in accounting module"""
    print("\n" + "="*60)
    print("5. TESTING AR INVOICE (ACCOUNTING MODULE)")
    print("="*60)

    try:
        amount = 2949.82  # Including 18% GST
        base_amount = amount / 1.18
        tax_amount = amount - base_amount

        ar_items = [{
            "description": "Bheem Workspace Professional Subscription",
            "quantity": 1,
            "unit_price": base_amount,
            "tax_rate": 18.0,
            "tax_amount": tax_amount,
            "total": amount
        }]

        ar_invoice = await erp_client.create_ar_invoice(
            customer_id=customer_id,
            company_id=settings.BHEEMVERSE_PARENT_COMPANY_CODE,
            items=ar_items,
            invoice_date=date.today().isoformat(),
            due_date=date.today().isoformat(),
            reference=f"AR-TEST-{uuid4().hex[:8]}",
            currency="INR",
            notes="Test AR invoice for accounting entries"
        )
        ar_invoice_id = ar_invoice.get("id")
        print(f"✓ Created AR Invoice: {ar_invoice_id}")
        print(f"  Company: {settings.BHEEMVERSE_PARENT_COMPANY_CODE}")

        return ar_invoice_id
    except Exception as e:
        print(f"✗ Failed to create AR invoice: {e}")
        return None


async def test_post_ar_invoice(ar_invoice_id: str):
    """Test posting AR invoice to create journal entries"""
    print("\n" + "="*60)
    print("6. TESTING AR INVOICE POSTING (JOURNAL ENTRY CREATION)")
    print("="*60)

    try:
        result = await erp_client.post_ar_invoice(ar_invoice_id)
        journal_entry_id = result.get("journal_entry_id")
        print(f"✓ Posted AR Invoice: {ar_invoice_id}")
        print(f"  Journal Entry Created: {journal_entry_id}")
        print(f"  Status: {result.get('status', 'posted')}")

        # This should have created journal entries:
        # Dr. Accounts Receivable
        # Cr. Revenue
        # Cr. GST Payable

        return journal_entry_id
    except Exception as e:
        print(f"✗ Failed to post AR invoice: {e}")
        return None


async def test_record_ar_payment(customer_id: str, ar_invoice_id: str):
    """Test recording AR payment"""
    print("\n" + "="*60)
    print("7. TESTING AR PAYMENT (CLEARS RECEIVABLE)")
    print("="*60)

    try:
        payment = await erp_client.create_ar_payment(
            customer_id=customer_id,
            amount=2949.82,
            payment_date=date.today().isoformat(),
            payment_method="online_gateway",
            reference=f"BHEEMPAY-TEST-{uuid4().hex[:8]}",
            invoice_id=ar_invoice_id
        )
        payment_id = payment.get("id")
        print(f"✓ Recorded AR Payment: {payment_id}")
        print(f"  Amount: ₹2,949.82")
        print(f"  Method: Online Gateway (BheemPay)")

        # This should have created journal entries:
        # Dr. Cash/Bank
        # Cr. Accounts Receivable

        return payment_id
    except Exception as e:
        print(f"✗ Failed to record AR payment: {e}")
        return None


async def test_get_journal_entries():
    """Get recent journal entries to verify"""
    print("\n" + "="*60)
    print("8. CHECKING JOURNAL ENTRIES IN ACCOUNTING")
    print("="*60)

    try:
        entries = await erp_client.get_journal_entries(
            company_id=settings.BHEEMVERSE_PARENT_COMPANY_CODE,
            limit=5
        )
        print(f"✓ Found {len(entries)} recent journal entries")

        for i, entry in enumerate(entries[:3], 1):
            print(f"\n  Entry {i}:")
            print(f"    ID: {entry.get('id')}")
            print(f"    Date: {entry.get('entry_date')}")
            print(f"    Reference: {entry.get('reference', 'N/A')}")
            print(f"    Description: {entry.get('description', 'N/A')[:50]}...")
            print(f"    Status: {entry.get('status', 'N/A')}")

        return entries
    except Exception as e:
        print(f"✗ Failed to get journal entries: {e}")
        return []


async def test_get_trial_balance():
    """Get trial balance to verify accounting"""
    print("\n" + "="*60)
    print("9. CHECKING TRIAL BALANCE")
    print("="*60)

    try:
        trial_balance = await erp_client.get_trial_balance(
            company_id=settings.BHEEMVERSE_PARENT_COMPANY_CODE,
            as_of_date=date.today().isoformat()
        )
        print(f"✓ Retrieved Trial Balance for {settings.BHEEMVERSE_PARENT_COMPANY_CODE}")

        # Show some key accounts
        accounts = trial_balance.get("accounts", trial_balance.get("items", []))
        if accounts:
            print(f"  Total Accounts: {len(accounts)}")
            # Look for relevant accounts
            for acc in accounts[:5]:
                name = acc.get("account_name", acc.get("name", "N/A"))
                debit = acc.get("debit", 0)
                credit = acc.get("credit", 0)
                print(f"    {name}: Dr {debit} / Cr {credit}")

        return trial_balance
    except Exception as e:
        print(f"✗ Failed to get trial balance: {e}")
        return None


async def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("  BHEEM WORKSPACE - ERP INTEGRATION TEST")
    print("  Testing Sales & Accounting Flow")
    print("="*60)
    print(f"\nCompany: {settings.BHEEMVERSE_PARENT_COMPANY_CODE}")
    print(f"ERP URL: {settings.ERP_SERVICE_URL}")

    # Test 1: Connection
    if not await test_erp_connection():
        print("\n❌ ERP connection failed. Aborting tests.")
        return

    # Test 2: Create Customer
    customer_id = await test_create_sales_customer()
    if not customer_id:
        print("\n⚠ Customer creation failed. Trying with existing...")
        # Try to get existing customers
        customers = await erp_client.get_sales_customers(limit=1)
        if customers:
            customer_id = customers[0].get("id")
            print(f"  Using existing customer: {customer_id}")

    if not customer_id:
        print("\n❌ No customer available. Aborting tests.")
        return

    # Test 3: Create Sales Order
    order_id = await test_create_sales_order(customer_id)

    # Test 4: Create Sales Invoice
    invoice_id = await test_create_sales_invoice(customer_id, order_id)

    # Test 5: Create AR Invoice (Accounting)
    ar_invoice_id = await test_create_ar_invoice(customer_id)

    # Test 6: Post AR Invoice (Creates Journal Entries!)
    journal_entry_id = None
    if ar_invoice_id:
        journal_entry_id = await test_post_ar_invoice(ar_invoice_id)

    # Test 7: Record AR Payment
    if ar_invoice_id:
        await test_record_ar_payment(customer_id, ar_invoice_id)

    # Test 8: Verify Journal Entries
    await test_get_journal_entries()

    # Test 9: Check Trial Balance
    await test_get_trial_balance()

    # Summary
    print("\n" + "="*60)
    print("  TEST SUMMARY")
    print("="*60)
    print(f"  Customer ID: {customer_id}")
    print(f"  Sales Order: {order_id}")
    print(f"  Sales Invoice: {invoice_id}")
    print(f"  AR Invoice: {ar_invoice_id}")
    print(f"  Journal Entry: {journal_entry_id}")
    print("="*60)

    if journal_entry_id:
        print("\n✅ SUCCESS: Journal entries created in ERP Accounting!")
        print("   Revenue recognized under Bheemverse (BHM001)")
    else:
        print("\n⚠ Journal entry creation may have issues - check ERP logs")


if __name__ == "__main__":
    asyncio.run(main())
