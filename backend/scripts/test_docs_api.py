#!/usr/bin/env python3
"""
Bheem Docs API Test Script
==========================
Tests all endpoints implemented in Phases 1-6
"""

import requests
import json
import sys
from datetime import datetime

BASE_URL = "http://localhost:8000/api/v1"
CREDENTIALS = {
    "username": "jishnu.developer@bheem.co.uk",
    "password": "dTC6gmvmhc"
}

class DocsAPITester:
    def __init__(self):
        self.token = None
        self.user = None
        self.results = {"passed": 0, "failed": 0, "errors": []}

    def login(self):
        """Authenticate and get token"""
        print("\n" + "="*60)
        print("AUTHENTICATION")
        print("="*60)

        response = requests.post(
            f"{BASE_URL}/auth/login",
            json=CREDENTIALS
        )

        if response.status_code == 200:
            data = response.json()
            self.token = data["access_token"]
            self.user = data.get("user", {})
            print(f"✓ Login successful")
            print(f"  User: {self.user.get('username')}")
            print(f"  Role: {self.user.get('role')}")
            print(f"  Company: {self.user.get('company_code')}")
            return True
        else:
            print(f"✗ Login failed: {response.status_code}")
            print(f"  {response.text}")
            return False

    def headers(self):
        """Get auth headers"""
        return {"Authorization": f"Bearer {self.token}"}

    def test_endpoint(self, method, endpoint, description, data=None, expected_status=200):
        """Test a single endpoint"""
        url = f"{BASE_URL}{endpoint}"
        try:
            if method == "GET":
                response = requests.get(url, headers=self.headers())
            elif method == "POST":
                response = requests.post(url, headers=self.headers(), json=data)
            elif method == "PUT":
                response = requests.put(url, headers=self.headers(), json=data)
            elif method == "DELETE":
                response = requests.delete(url, headers=self.headers())

            if response.status_code == expected_status:
                self.results["passed"] += 1
                print(f"  ✓ {description}")
                return response.json() if response.text else {}
            else:
                self.results["failed"] += 1
                self.results["errors"].append(f"{description}: {response.status_code} - {response.text[:100]}")
                print(f"  ✗ {description} (HTTP {response.status_code})")
                if response.status_code == 500:
                    print(f"    Error: {response.text[:200]}")
                return None

        except Exception as e:
            self.results["failed"] += 1
            self.results["errors"].append(f"{description}: {str(e)}")
            print(f"  ✗ {description} (Exception: {str(e)[:50]})")
            return None

    def test_phase1_storage(self):
        """Phase 1: Foundation & Storage"""
        print("\n" + "="*60)
        print("PHASE 1: Foundation & Storage")
        print("="*60)

        # Storage usage
        self.test_endpoint("GET", "/docs/v2/storage/usage", "Get storage usage")

        # Presigned upload URL (query params)
        self.test_endpoint("POST", "/docs/v2/storage/presigned-upload?filename=test.pdf&content_type=application/pdf",
                          "Get presigned upload URL")

        # Reference data
        self.test_endpoint("GET", "/docs/v2/reference/document-types", "List document types")
        self.test_endpoint("GET", "/docs/v2/reference/entity-types", "List entity types")

    def test_phase1_folders(self):
        """Phase 1: Folder Management"""
        print("\n" + "-"*40)
        print("Phase 1: Folder Management")
        print("-"*40)

        # List folders
        result = self.test_endpoint("GET", "/docs/v2/folders", "List folders")

        # Folder tree
        self.test_endpoint("GET", "/docs/v2/folders/tree", "Get folder tree")

        # Create folder
        folder_data = {
            "name": f"Test Folder {datetime.now().strftime('%H%M%S')}",
            "description": "Created by API test"
        }
        created = self.test_endpoint("POST", "/docs/v2/folders", "Create folder", data=folder_data)

        if created and created.get("id"):
            folder_id = created["id"]

            # Get folder
            self.test_endpoint("GET", f"/docs/v2/folders/{folder_id}", "Get folder by ID")

            # Get breadcrumb
            self.test_endpoint("GET", f"/docs/v2/folders/{folder_id}/breadcrumb", "Get folder breadcrumb")

            # Update folder
            self.test_endpoint("PUT", f"/docs/v2/folders/{folder_id}", "Update folder",
                             data={"name": "Updated Test Folder"})

            # Delete folder
            self.test_endpoint("DELETE", f"/docs/v2/folders/{folder_id}", "Delete folder")

    def test_phase1_documents(self):
        """Phase 1: Document Management"""
        print("\n" + "-"*40)
        print("Phase 1: Document Management")
        print("-"*40)

        # List documents
        self.test_endpoint("GET", "/docs/v2/documents", "List documents")

    def test_phase2_editor(self):
        """Phase 2: Rich Text Editor"""
        print("\n" + "="*60)
        print("PHASE 2: Rich Text Editor")
        print("="*60)

        # Templates
        self.test_endpoint("GET", "/docs/editor/templates", "List templates")
        self.test_endpoint("GET", "/docs/editor/templates/categories", "List template categories")

        # Conversion endpoints (not yet implemented - expect 501)
        self.test_endpoint("POST", "/docs/editor/convert/html-to-tiptap?html=%3Cp%3EHello%3C%2Fp%3E",
                          "Convert HTML to TipTap (not implemented)", expected_status=501)

        self.test_endpoint("POST", "/docs/editor/convert/markdown-to-tiptap?markdown=%23%20Hello",
                          "Convert Markdown to TipTap (not implemented)", expected_status=501)

    def test_phase3_collaboration(self):
        """Phase 3: Real-time Collaboration"""
        print("\n" + "="*60)
        print("PHASE 3: Real-time Collaboration")
        print("="*60)

        # Collaboration rooms (admin endpoint)
        self.test_endpoint("GET", "/docs/collab/rooms", "List collaboration rooms", expected_status=403)

    def test_phase3_comments(self):
        """Phase 3: Comments & Annotations"""
        print("\n" + "-"*40)
        print("Phase 3: Comments & Annotations")
        print("-"*40)

        # Need a document ID to test comments
        # Using a placeholder UUID for testing endpoint availability
        test_doc_id = "00000000-0000-0000-0000-000000000001"

        # These will return 404 or empty but test the endpoint works
        self.test_endpoint("GET", f"/docs/comments/documents/{test_doc_id}",
                          "List document comments", expected_status=200)

        self.test_endpoint("GET", f"/docs/comments/documents/{test_doc_id}/stats",
                          "Get comment stats", expected_status=200)

        self.test_endpoint("GET", f"/docs/comments/documents/{test_doc_id}/annotations",
                          "List annotations", expected_status=200)

    def test_phase4_workflow(self):
        """Phase 4: ERP Workflow Integration"""
        print("\n" + "="*60)
        print("PHASE 4: ERP Workflow Integration")
        print("="*60)

        # Workflow stats
        self.test_endpoint("GET", "/docs/workflow/stats", "Get workflow stats")

        # Pending approvals
        self.test_endpoint("GET", "/docs/workflow/pending", "Get pending approvals")

        # Test document ID for workflow status (404 expected for non-existent doc)
        test_doc_id = "00000000-0000-0000-0000-000000000001"
        self.test_endpoint("GET", f"/docs/workflow/documents/{test_doc_id}/status",
                          "Get document approval status (non-existent doc)", expected_status=404)

    def test_phase5_audit(self):
        """Phase 5: Enterprise - Audit"""
        print("\n" + "="*60)
        print("PHASE 5: Enterprise Features - Audit")
        print("="*60)

        # Audit action types (reference)
        self.test_endpoint("GET", "/docs/enterprise/audit/actions", "List audit action types")

        # Audit stats
        self.test_endpoint("GET", "/docs/enterprise/audit/stats", "Get audit stats")

        # Document audit history
        test_doc_id = "00000000-0000-0000-0000-000000000001"
        self.test_endpoint("GET", f"/docs/enterprise/audit/documents/{test_doc_id}",
                          "Get document audit history")

        # User activity
        user_id = self.user.get("id", "00000000-0000-0000-0000-000000000001")
        self.test_endpoint("GET", f"/docs/enterprise/audit/users/{user_id}",
                          "Get user audit activity")

    def test_phase5_signatures(self):
        """Phase 5: Enterprise - Signatures"""
        print("\n" + "-"*40)
        print("Phase 5: Enterprise Features - Signatures")
        print("-"*40)

        # Pending signatures for current user
        self.test_endpoint("GET", "/docs/enterprise/signatures/pending",
                          "Get pending signatures")

        # Document signatures
        test_doc_id = "00000000-0000-0000-0000-000000000001"
        self.test_endpoint("GET", f"/docs/enterprise/signatures/documents/{test_doc_id}",
                          "Get document signatures")

    def test_phase6_ai(self):
        """Phase 6: AI & Smart Features"""
        print("\n" + "="*60)
        print("PHASE 6: AI & Smart Features")
        print("="*60)

        # AI status
        self.test_endpoint("GET", "/docs/ai/status", "Get AI service status")

        # Summarize
        self.test_endpoint("POST", "/docs/ai/summarize", "Summarize content",
                          data={
                              "content": "This is a test document with some content that needs to be summarized. It contains multiple sentences and paragraphs for testing purposes.",
                              "max_length": 100,
                              "style": "concise"
                          })

        # Extract keywords
        self.test_endpoint("POST", "/docs/ai/keywords", "Extract keywords",
                          data={
                              "content": "Machine learning and artificial intelligence are transforming the technology industry with deep learning neural networks.",
                              "max_keywords": 5
                          })

        # Suggest tags
        self.test_endpoint("POST", "/docs/ai/suggest-tags", "Suggest tags",
                          data={
                              "content": "Financial report for Q4 2025 showing revenue growth in the technology sector.",
                              "max_suggestions": 5
                          })

        # Analyze document
        self.test_endpoint("POST", "/docs/ai/analyze", "Analyze document",
                          data={
                              "content": "This is a comprehensive document that needs analysis. It contains multiple paragraphs with varying sentence lengths. The readability and structure should be evaluated.",
                              "title": "Test Document"
                          })

        # Improve writing
        self.test_endpoint("POST", "/docs/ai/improve", "Improve writing",
                          data={
                              "text": "this is some text that could be better written",
                              "style": "professional"
                          })

    def test_phase4_erp(self):
        """Phase 4: ERP Entity Links"""
        print("\n" + "-"*40)
        print("Phase 4: ERP Entity Links")
        print("-"*40)

        # Entity types
        self.test_endpoint("GET", "/docs/erp/entity-types", "List ERP entity types")

        # Test entity documents (will be empty but tests endpoint)
        self.test_endpoint("GET", "/docs/erp/entities/PROJECT/00000000-0000-0000-0000-000000000001/documents",
                          "Get entity documents")

    def run_all_tests(self):
        """Run all tests"""
        print("\n" + "#"*60)
        print("  BHEEM DOCS API TEST SUITE")
        print("  " + datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        print("#"*60)

        if not self.login():
            print("\n✗ Cannot continue without authentication")
            return False

        # Run all phase tests
        self.test_phase1_storage()
        self.test_phase1_folders()
        self.test_phase1_documents()
        self.test_phase2_editor()
        self.test_phase3_collaboration()
        self.test_phase3_comments()
        self.test_phase4_workflow()
        self.test_phase4_erp()
        self.test_phase5_audit()
        self.test_phase5_signatures()
        self.test_phase6_ai()

        # Print summary
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)
        print(f"  Passed: {self.results['passed']}")
        print(f"  Failed: {self.results['failed']}")
        print(f"  Total:  {self.results['passed'] + self.results['failed']}")

        if self.results["errors"]:
            print("\n  Errors:")
            for error in self.results["errors"][:10]:
                print(f"    - {error[:80]}")
            if len(self.results["errors"]) > 10:
                print(f"    ... and {len(self.results['errors']) - 10} more")

        return self.results["failed"] == 0


if __name__ == "__main__":
    tester = DocsAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)
