# Bheem Mail System - Enterprise Implementation Plan

## Overview

This document outlines the complete implementation roadmap to bring the Bheem Mail System to feature parity with Gmail and Zoho Mail, while leveraging our AI capabilities as a competitive advantage.

**Current Stack:**
- **Backend**: FastAPI (Python) + PostgreSQL
- **Frontend**: Next.js + React + Zustand
- **Mail Server**: Mailcow (IMAP/SMTP)
- **Transactional Email**: Bheem-Tele (MSG91)
- **AI Services**: Anthropic Claude API
- **Auth**: Bheem Passport (SSO)

---

## Phase 1: Security Hardening (Critical)

### 1.1 Session-Based Mail Authentication

**Current Issue:** Credentials stored in localStorage (plaintext exposure risk)

**Implementation Steps:**

#### Backend Changes

**File:** `backend/api/mail.py`

```python
# Add new endpoints for session-based auth

@router.post("/session/create")
async def create_mail_session(
    credentials: MailCredentials,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create encrypted mail session stored server-side.
    Returns session_id (not credentials).
    """
    # 1. Validate credentials with Mailcow
    # 2. Encrypt credentials using Fernet (AES-128-CBC)
    # 3. Store in Redis with TTL (24 hours)
    # 4. Return session_id to client
    pass

@router.delete("/session")
async def destroy_mail_session(
    current_user: dict = Depends(get_current_user)
):
    """Invalidate mail session."""
    pass

@router.post("/session/refresh")
async def refresh_mail_session(
    current_user: dict = Depends(get_current_user)
):
    """Extend session TTL without re-authenticating."""
    pass
```

**New File:** `backend/services/mail_session_service.py`

```python
from cryptography.fernet import Fernet
import redis
import json
from datetime import timedelta

class MailSessionService:
    def __init__(self):
        self.redis = redis.Redis(host='localhost', port=6379, db=1)
        self.cipher = Fernet(settings.MAIL_ENCRYPTION_KEY)
        self.session_ttl = timedelta(hours=24)

    def create_session(self, user_id: str, email: str, password: str) -> str:
        """Create encrypted mail session."""
        session_id = f"mail_session:{user_id}"
        encrypted_creds = self.cipher.encrypt(
            json.dumps({"email": email, "password": password}).encode()
        )
        self.redis.setex(session_id, self.session_ttl, encrypted_creds)
        return session_id

    def get_credentials(self, user_id: str) -> dict | None:
        """Retrieve and decrypt credentials from session."""
        session_id = f"mail_session:{user_id}"
        encrypted = self.redis.get(session_id)
        if not encrypted:
            return None
        return json.loads(self.cipher.decrypt(encrypted))

    def destroy_session(self, user_id: str):
        """Remove mail session."""
        self.redis.delete(f"mail_session:{user_id}")
```

#### Frontend Changes

**File:** `frontend/src/stores/credentialsStore.ts`

```typescript
// Replace localStorage with session-based approach

interface CredentialsState {
  hasMailSession: boolean;
  sessionExpiresAt: Date | null;

  // Actions
  createMailSession: (email: string, password: string) => Promise<void>;
  refreshMailSession: () => Promise<void>;
  destroyMailSession: () => Promise<void>;
  checkSessionValid: () => boolean;
}
```

**File:** `frontend/src/lib/mailApi.ts`

```typescript
// Remove credential passing - use session cookies instead

export async function getMessages(folder: string, page: number = 1) {
  // Session ID sent automatically via httpOnly cookie
  const response = await fetch(`${API_URL}/mail/messages?folder=${folder}&page=${page}`, {
    credentials: 'include', // Important: include cookies
  });
  return response.json();
}
```

#### Configuration

**File:** `backend/core/config.py`

```python
# Add encryption key for mail sessions
MAIL_ENCRYPTION_KEY: str = os.getenv("MAIL_ENCRYPTION_KEY")  # Generate with Fernet.generate_key()
REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/1")
MAIL_SESSION_TTL_HOURS: int = 24
```

**Checklist:**
- [ ] Install redis and cryptography packages
- [ ] Generate and store MAIL_ENCRYPTION_KEY in .env
- [ ] Create MailSessionService
- [ ] Add session endpoints to mail.py
- [ ] Update all mail endpoints to use session-based auth
- [ ] Remove credentials from frontend localStorage
- [ ] Update mailApi.ts to use credentials: 'include'
- [ ] Add session expiry handling in frontend
- [ ] Test session creation, refresh, and destruction

---

### 1.2 Remove Credentials from URL Query Params

**Current Issue:** `GET /mail/messages?email=xxx&password=xxx` exposes credentials in logs

**Implementation Steps:**

#### Backend Changes

**File:** `backend/api/mail.py`

```python
# BEFORE (insecure):
@router.get("/messages")
async def get_messages(
    email: str = Query(...),
    password: str = Query(...),  # Exposed in URL!
    folder: str = Query("INBOX")
):
    pass

# AFTER (secure):
@router.get("/messages")
async def get_messages(
    folder: str = Query("INBOX"),
    page: int = Query(1),
    limit: int = Query(50),
    current_user: dict = Depends(get_current_user),
    mail_session: MailSessionService = Depends(get_mail_session)
):
    """Get messages using server-side session credentials."""
    credentials = mail_session.get_credentials(current_user["id"])
    if not credentials:
        raise HTTPException(401, "Mail session expired. Please re-authenticate.")

    return await mailcow_service.get_inbox(
        credentials["email"],
        credentials["password"],
        folder,
        limit,
        (page - 1) * limit
    )
```

**Checklist:**
- [ ] Audit all mail endpoints for credential exposure
- [ ] Replace Query params with session-based auth
- [ ] Update OpenAPI docs to reflect changes
- [ ] Test all endpoints with new auth flow

---

### 1.3 API Rate Limiting

**Current Issue:** No rate limiting allows abuse and DoS

**Implementation Steps:**

**New File:** `backend/middleware/rate_limit.py`

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri="redis://localhost:6379/2"
)

# Rate limit configurations
RATE_LIMITS = {
    "mail_send": "10/minute",      # Sending emails
    "mail_read": "100/minute",     # Reading emails
    "mail_search": "30/minute",    # Searching
    "mail_ai": "20/minute",        # AI features
    "mail_login": "5/minute",      # Login attempts
}
```

**File:** `backend/api/mail.py`

```python
from middleware.rate_limit import limiter, RATE_LIMITS

@router.post("/send")
@limiter.limit(RATE_LIMITS["mail_send"])
async def send_email(
    request: Request,
    email_data: SendEmailRequest,
    current_user: dict = Depends(get_current_user)
):
    pass

@router.get("/messages")
@limiter.limit(RATE_LIMITS["mail_read"])
async def get_messages(request: Request, ...):
    pass
```

**File:** `backend/main.py`

```python
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from middleware.rate_limit import limiter

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

**Checklist:**
- [ ] Install slowapi package
- [ ] Configure Redis for rate limit storage
- [ ] Create rate_limit.py middleware
- [ ] Apply rate limits to all mail endpoints
- [ ] Add rate limit headers to responses (X-RateLimit-*)
- [ ] Create user-specific rate limits (based on plan)
- [ ] Add rate limit exceeded error handling in frontend

---

### 1.4 Two-Factor Authentication (2FA) for Mail

**Implementation Steps:**

**New File:** `backend/services/mail_2fa_service.py`

```python
import pyotp
import qrcode
from io import BytesIO
import base64

class Mail2FAService:
    def __init__(self, db: Session):
        self.db = db

    def generate_secret(self, user_id: str) -> str:
        """Generate TOTP secret for user."""
        secret = pyotp.random_base32()
        # Store encrypted in database
        return secret

    def get_qr_code(self, user_email: str, secret: str) -> str:
        """Generate QR code for authenticator app."""
        totp = pyotp.TOTP(secret)
        uri = totp.provisioning_uri(user_email, issuer_name="Bheem Mail")

        qr = qrcode.make(uri)
        buffer = BytesIO()
        qr.save(buffer, format='PNG')
        return base64.b64encode(buffer.getvalue()).decode()

    def verify_code(self, user_id: str, code: str) -> bool:
        """Verify TOTP code."""
        secret = self._get_user_secret(user_id)
        if not secret:
            return False
        totp = pyotp.TOTP(secret)
        return totp.verify(code, valid_window=1)
```

**Database Migration:** `backend/migrations/004_mail_2fa.sql`

```sql
-- Add 2FA columns to tenant_users
ALTER TABLE workspace.tenant_users
ADD COLUMN mail_2fa_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN mail_2fa_secret TEXT,
ADD COLUMN mail_2fa_backup_codes TEXT[];

-- Add 2FA audit log
CREATE TABLE workspace.mail_2fa_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES workspace.tenant_users(id),
    action VARCHAR(50) NOT NULL, -- 'enabled', 'disabled', 'verified', 'backup_used'
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**API Endpoints:** `backend/api/mail_2fa.py`

```python
@router.post("/2fa/setup")
async def setup_2fa(current_user: dict = Depends(get_current_user)):
    """Generate 2FA secret and QR code."""
    pass

@router.post("/2fa/verify")
async def verify_2fa_setup(
    code: str,
    current_user: dict = Depends(get_current_user)
):
    """Verify 2FA code and enable 2FA."""
    pass

@router.post("/2fa/disable")
async def disable_2fa(
    code: str,
    current_user: dict = Depends(get_current_user)
):
    """Disable 2FA (requires valid code)."""
    pass

@router.get("/2fa/backup-codes")
async def get_backup_codes(
    code: str,
    current_user: dict = Depends(get_current_user)
):
    """Generate backup codes (requires 2FA verification)."""
    pass
```

**Checklist:**
- [ ] Install pyotp and qrcode packages
- [ ] Create mail_2fa_service.py
- [ ] Run database migration for 2FA tables
- [ ] Create 2FA API endpoints
- [ ] Add 2FA enforcement to mail login flow
- [ ] Create frontend 2FA setup UI
- [ ] Implement backup codes
- [ ] Add 2FA status to user profile

---

## Phase 2: Core UX Improvements (High Priority)

### 2.1 Conversation Threading

**Current Issue:** Emails displayed individually, hard to follow conversations

**Implementation Steps:**

#### Backend Changes

**File:** `backend/services/mailcow_service.py`

```python
def get_inbox_threaded(
    self,
    email: str,
    password: str,
    folder: str = "INBOX",
    limit: int = 50,
    offset: int = 0
) -> list[dict]:
    """Get emails grouped by conversation thread."""
    emails = self._fetch_emails(email, password, folder)

    # Group by thread using Message-ID and References headers
    threads = {}
    for email_msg in emails:
        thread_id = self._get_thread_id(email_msg)
        if thread_id not in threads:
            threads[thread_id] = {
                "thread_id": thread_id,
                "subject": self._clean_subject(email_msg.subject),
                "participants": set(),
                "messages": [],
                "last_date": None,
                "unread_count": 0,
                "starred": False
            }

        threads[thread_id]["messages"].append(email_msg)
        threads[thread_id]["participants"].add(email_msg.from_address)

        if not threads[thread_id]["last_date"] or email_msg.date > threads[thread_id]["last_date"]:
            threads[thread_id]["last_date"] = email_msg.date

        if not email_msg.is_read:
            threads[thread_id]["unread_count"] += 1

        if email_msg.is_starred:
            threads[thread_id]["starred"] = True

    # Sort threads by last_date descending
    sorted_threads = sorted(
        threads.values(),
        key=lambda t: t["last_date"],
        reverse=True
    )

    return sorted_threads[offset:offset + limit]

def _get_thread_id(self, email_msg) -> str:
    """Extract thread ID from email headers."""
    # Use In-Reply-To or first Reference as thread ID
    if email_msg.in_reply_to:
        return email_msg.in_reply_to
    if email_msg.references:
        return email_msg.references[0]
    return email_msg.message_id

def _clean_subject(self, subject: str) -> str:
    """Remove Re:, Fwd:, etc. from subject."""
    import re
    return re.sub(r'^(Re|Fwd|Fw):\s*', '', subject, flags=re.IGNORECASE).strip()
```

**New API Endpoint:** `backend/api/mail.py`

```python
@router.get("/threads")
async def get_email_threads(
    folder: str = Query("INBOX"),
    page: int = Query(1),
    limit: int = Query(20),
    current_user: dict = Depends(get_current_user),
    mail_session: MailSessionService = Depends(get_mail_session)
):
    """Get emails grouped by conversation thread."""
    credentials = mail_session.get_credentials(current_user["id"])
    threads = await mailcow_service.get_inbox_threaded(
        credentials["email"],
        credentials["password"],
        folder,
        limit,
        (page - 1) * limit
    )
    return {"threads": threads, "page": page, "limit": limit}

@router.get("/threads/{thread_id}")
async def get_thread_messages(
    thread_id: str,
    current_user: dict = Depends(get_current_user),
    mail_session: MailSessionService = Depends(get_mail_session)
):
    """Get all messages in a conversation thread."""
    credentials = mail_session.get_credentials(current_user["id"])
    messages = await mailcow_service.get_thread_messages(
        credentials["email"],
        credentials["password"],
        thread_id
    )
    return {"thread_id": thread_id, "messages": messages}
```

#### Frontend Changes

**File:** `frontend/src/types/mail.ts`

```typescript
export interface EmailThread {
  thread_id: string;
  subject: string;
  participants: string[];
  messages: Email[];
  last_date: string;
  unread_count: number;
  starred: boolean;
  snippet: string; // Preview of latest message
}
```

**File:** `frontend/src/stores/mailStore.ts`

```typescript
interface MailState {
  // Add thread support
  threads: EmailThread[];
  selectedThread: EmailThread | null;
  viewMode: 'threads' | 'messages'; // Toggle between views

  // Actions
  fetchThreads: (folder: string, page: number) => Promise<void>;
  fetchThreadMessages: (threadId: string) => Promise<void>;
  setViewMode: (mode: 'threads' | 'messages') => void;
}
```

**New Component:** `frontend/src/components/mail/ThreadList.tsx`

```typescript
export function ThreadList({ threads }: { threads: EmailThread[] }) {
  return (
    <div className="divide-y">
      {threads.map(thread => (
        <ThreadItem key={thread.thread_id} thread={thread} />
      ))}
    </div>
  );
}

function ThreadItem({ thread }: { thread: EmailThread }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="p-4 hover:bg-gray-50 cursor-pointer">
      <div onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2">
          <span className={thread.unread_count > 0 ? 'font-bold' : ''}>
            {thread.participants.join(', ')}
          </span>
          {thread.messages.length > 1 && (
            <span className="text-gray-500 text-sm">
              ({thread.messages.length})
            </span>
          )}
        </div>
        <div className="text-sm">{thread.subject}</div>
        <div className="text-xs text-gray-500">{thread.snippet}</div>
      </div>

      {expanded && (
        <div className="mt-4 ml-4 border-l-2 pl-4">
          {thread.messages.map(msg => (
            <ThreadMessage key={msg.id} message={msg} />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Checklist:**
- [ ] Add threading logic to mailcow_service.py
- [ ] Create thread-based API endpoints
- [ ] Update mail types with EmailThread
- [ ] Add thread state to mailStore
- [ ] Create ThreadList and ThreadItem components
- [ ] Add view mode toggle (threads/messages)
- [ ] Update reply/forward to maintain thread headers
- [ ] Test with various email clients (Gmail, Outlook)

---

### 2.2 Server-Side Full-Text Search

**Current Issue:** Client-side filtering doesn't scale, can't search all emails

**Implementation Steps:**

#### Option A: Meilisearch (Recommended)

**New File:** `backend/services/mail_search_service.py`

```python
import meilisearch
from datetime import datetime

class MailSearchService:
    def __init__(self):
        self.client = meilisearch.Client(
            settings.MEILISEARCH_URL,
            settings.MEILISEARCH_API_KEY
        )
        self.index_name = "emails"

    def setup_index(self):
        """Configure search index settings."""
        index = self.client.index(self.index_name)

        # Searchable fields
        index.update_searchable_attributes([
            'subject',
            'body_text',
            'from_name',
            'from_email',
            'to_names',
            'to_emails',
            'cc_names',
            'cc_emails'
        ])

        # Filterable fields
        index.update_filterable_attributes([
            'user_id',
            'folder',
            'has_attachment',
            'is_read',
            'is_starred',
            'date_timestamp'
        ])

        # Sortable fields
        index.update_sortable_attributes([
            'date_timestamp',
            'subject'
        ])

    def index_email(self, user_id: str, email: dict):
        """Add email to search index."""
        document = {
            'id': f"{user_id}_{email['message_id']}",
            'user_id': user_id,
            'message_id': email['message_id'],
            'subject': email['subject'],
            'body_text': self._strip_html(email['body']),
            'from_name': email['from']['name'],
            'from_email': email['from']['email'],
            'to_names': [t['name'] for t in email['to']],
            'to_emails': [t['email'] for t in email['to']],
            'cc_names': [c['name'] for c in email.get('cc', [])],
            'cc_emails': [c['email'] for c in email.get('cc', [])],
            'folder': email['folder'],
            'has_attachment': len(email.get('attachments', [])) > 0,
            'is_read': email.get('is_read', False),
            'is_starred': email.get('is_starred', False),
            'date_timestamp': int(datetime.fromisoformat(email['date']).timestamp())
        }

        self.client.index(self.index_name).add_documents([document])

    def search(
        self,
        user_id: str,
        query: str,
        filters: dict = None,
        page: int = 1,
        limit: int = 20
    ) -> dict:
        """Search emails with advanced filters."""
        filter_conditions = [f"user_id = '{user_id}'"]

        if filters:
            if filters.get('folder'):
                filter_conditions.append(f"folder = '{filters['folder']}'")
            if filters.get('has_attachment'):
                filter_conditions.append("has_attachment = true")
            if filters.get('is_unread'):
                filter_conditions.append("is_read = false")
            if filters.get('is_starred'):
                filter_conditions.append("is_starred = true")
            if filters.get('from'):
                filter_conditions.append(f"from_email = '{filters['from']}'")
            if filters.get('date_from'):
                filter_conditions.append(f"date_timestamp >= {filters['date_from']}")
            if filters.get('date_to'):
                filter_conditions.append(f"date_timestamp <= {filters['date_to']}")

        results = self.client.index(self.index_name).search(
            query,
            {
                'filter': ' AND '.join(filter_conditions),
                'offset': (page - 1) * limit,
                'limit': limit,
                'sort': ['date_timestamp:desc'],
                'attributesToHighlight': ['subject', 'body_text'],
                'highlightPreTag': '<mark>',
                'highlightPostTag': '</mark>'
            }
        )

        return {
            'hits': results['hits'],
            'total': results['estimatedTotalHits'],
            'page': page,
            'limit': limit,
            'query': query
        }

    def delete_email(self, user_id: str, message_id: str):
        """Remove email from search index."""
        self.client.index(self.index_name).delete_document(f"{user_id}_{message_id}")

    def reindex_user_emails(self, user_id: str, emails: list):
        """Reindex all emails for a user."""
        # Delete existing
        self.client.index(self.index_name).delete_documents_by_filter(
            f"user_id = '{user_id}'"
        )
        # Add all
        for email in emails:
            self.index_email(user_id, email)
```

**API Endpoint:** `backend/api/mail.py`

```python
@router.get("/search")
async def search_emails(
    q: str = Query(..., min_length=2),
    folder: str = Query(None),
    has_attachment: bool = Query(None),
    is_unread: bool = Query(None),
    is_starred: bool = Query(None),
    from_address: str = Query(None, alias="from"),
    date_from: str = Query(None),
    date_to: str = Query(None),
    page: int = Query(1),
    limit: int = Query(20),
    current_user: dict = Depends(get_current_user)
):
    """Full-text search with advanced filters."""
    filters = {
        'folder': folder,
        'has_attachment': has_attachment,
        'is_unread': is_unread,
        'is_starred': is_starred,
        'from': from_address,
        'date_from': parse_date(date_from) if date_from else None,
        'date_to': parse_date(date_to) if date_to else None,
    }
    filters = {k: v for k, v in filters.items() if v is not None}

    return mail_search_service.search(
        current_user["id"],
        q,
        filters,
        page,
        limit
    )
```

#### Frontend Search Component

**New File:** `frontend/src/components/mail/AdvancedSearch.tsx`

```typescript
interface SearchFilters {
  query: string;
  folder?: string;
  from?: string;
  to?: string;
  hasAttachment?: boolean;
  isUnread?: boolean;
  isStarred?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

export function AdvancedSearch() {
  const [filters, setFilters] = useState<SearchFilters>({ query: '' });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { searchEmails, searchResults } = useMailStore();

  const handleSearch = useCallback(
    debounce((filters: SearchFilters) => {
      if (filters.query.length >= 2) {
        searchEmails(filters);
      }
    }, 300),
    []
  );

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Search mail..."
          className="flex-1 px-4 py-2 border rounded"
          value={filters.query}
          onChange={(e) => {
            const newFilters = { ...filters, query: e.target.value };
            setFilters(newFilters);
            handleSearch(newFilters);
          }}
        />
        <button onClick={() => setShowAdvanced(!showAdvanced)}>
          <FilterIcon />
        </button>
      </div>

      {showAdvanced && (
        <div className="absolute top-full mt-2 p-4 bg-white shadow-lg rounded-lg w-96 z-50">
          <div className="grid grid-cols-2 gap-4">
            <input placeholder="From" value={filters.from} onChange={...} />
            <input placeholder="To" value={filters.to} onChange={...} />
            <input type="date" placeholder="After" value={filters.dateFrom} onChange={...} />
            <input type="date" placeholder="Before" value={filters.dateTo} onChange={...} />
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={filters.hasAttachment} onChange={...} />
              Has attachment
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={filters.isUnread} onChange={...} />
              Unread only
            </label>
          </div>
          <button onClick={() => handleSearch(filters)} className="mt-4 btn-primary">
            Search
          </button>
        </div>
      )}
    </div>
  );
}
```

**Checklist:**
- [ ] Set up Meilisearch (Docker: `meilisearch/meilisearch`)
- [ ] Create MailSearchService
- [ ] Add search indexing when emails are fetched
- [ ] Create /search API endpoint
- [ ] Build AdvancedSearch component
- [ ] Add search result highlighting
- [ ] Implement background reindexing job
- [ ] Add search suggestions (recent queries)

---

### 2.3 Draft Auto-Save

**Current Issue:** Drafts lost on page refresh

**Implementation Steps:**

#### Backend Changes

**Database Migration:** `backend/migrations/005_mail_drafts.sql`

```sql
CREATE TABLE workspace.mail_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES workspace.tenant_users(id),
    subject TEXT,
    body TEXT,
    to_addresses JSONB DEFAULT '[]',
    cc_addresses JSONB DEFAULT '[]',
    bcc_addresses JSONB DEFAULT '[]',
    attachments JSONB DEFAULT '[]',
    reply_to_message_id TEXT,
    forward_message_id TEXT,
    is_html BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_drafts_user_id ON workspace.mail_drafts(user_id);
CREATE INDEX idx_drafts_updated_at ON workspace.mail_drafts(updated_at);
```

**New File:** `backend/api/mail_drafts.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import uuid

router = APIRouter(prefix="/mail/drafts", tags=["mail-drafts"])

class DraftCreate(BaseModel):
    subject: Optional[str] = ""
    body: Optional[str] = ""
    to_addresses: list[dict] = []
    cc_addresses: list[dict] = []
    bcc_addresses: list[dict] = []
    attachments: list[dict] = []
    reply_to_message_id: Optional[str] = None
    forward_message_id: Optional[str] = None
    is_html: bool = True

@router.get("")
async def list_drafts(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all drafts for current user."""
    drafts = db.query(MailDraft).filter(
        MailDraft.user_id == current_user["id"]
    ).order_by(MailDraft.updated_at.desc()).all()
    return {"drafts": drafts}

@router.post("")
async def create_draft(
    draft: DraftCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create new draft."""
    new_draft = MailDraft(
        id=uuid.uuid4(),
        user_id=current_user["id"],
        **draft.dict()
    )
    db.add(new_draft)
    db.commit()
    return {"id": new_draft.id}

@router.put("/{draft_id}")
async def update_draft(
    draft_id: uuid.UUID,
    draft: DraftCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update existing draft (auto-save)."""
    existing = db.query(MailDraft).filter(
        MailDraft.id == draft_id,
        MailDraft.user_id == current_user["id"]
    ).first()

    if not existing:
        raise HTTPException(404, "Draft not found")

    for key, value in draft.dict().items():
        setattr(existing, key, value)
    existing.updated_at = datetime.utcnow()

    db.commit()
    return {"id": existing.id, "updated_at": existing.updated_at}

@router.delete("/{draft_id}")
async def delete_draft(
    draft_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete draft."""
    deleted = db.query(MailDraft).filter(
        MailDraft.id == draft_id,
        MailDraft.user_id == current_user["id"]
    ).delete()

    if not deleted:
        raise HTTPException(404, "Draft not found")

    db.commit()
    return {"success": True}

@router.post("/{draft_id}/send")
async def send_draft(
    draft_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    mail_session: MailSessionService = Depends(get_mail_session)
):
    """Send draft as email and delete it."""
    draft = db.query(MailDraft).filter(
        MailDraft.id == draft_id,
        MailDraft.user_id == current_user["id"]
    ).first()

    if not draft:
        raise HTTPException(404, "Draft not found")

    # Send email
    credentials = mail_session.get_credentials(current_user["id"])
    await mailcow_service.send_email(
        from_email=credentials["email"],
        password=credentials["password"],
        to=[a["email"] for a in draft.to_addresses],
        cc=[a["email"] for a in draft.cc_addresses],
        bcc=[a["email"] for a in draft.bcc_addresses],
        subject=draft.subject,
        body=draft.body,
        is_html=draft.is_html,
        attachments=draft.attachments,
        in_reply_to=draft.reply_to_message_id
    )

    # Delete draft
    db.delete(draft)
    db.commit()

    return {"success": True, "message": "Email sent"}
```

#### Frontend Changes

**File:** `frontend/src/stores/mailStore.ts`

```typescript
interface MailState {
  // Add draft state
  currentDraftId: string | null;
  draftSaving: boolean;
  draftLastSaved: Date | null;

  // Actions
  saveDraft: () => Promise<void>;
  loadDraft: (draftId: string) => Promise<void>;
  deleteDraft: (draftId: string) => Promise<void>;
  sendDraft: (draftId: string) => Promise<void>;
}

// Auto-save implementation
const useAutoSaveDraft = () => {
  const { composeData, currentDraftId, saveDraft } = useMailStore();
  const debouncedSave = useMemo(
    () => debounce(saveDraft, 5000), // Save every 5 seconds of inactivity
    [saveDraft]
  );

  useEffect(() => {
    if (composeData && (composeData.subject || composeData.body)) {
      debouncedSave();
    }
  }, [composeData, debouncedSave]);

  // Save on unmount
  useEffect(() => {
    return () => {
      if (composeData && (composeData.subject || composeData.body)) {
        saveDraft();
      }
    };
  }, []);
};
```

**Checklist:**
- [ ] Run database migration for drafts table
- [ ] Create mail_drafts.py API router
- [ ] Register router in main.py
- [ ] Add draft state to mailStore
- [ ] Implement auto-save with debounce
- [ ] Add draft indicator in compose UI
- [ ] Show "Saved at X:XX" timestamp
- [ ] Handle draft recovery on page load
- [ ] Sync drafts to IMAP Drafts folder (optional)

---

### 2.4 Email Signatures

**Implementation Steps:**

**Database Migration:** `backend/migrations/006_mail_signatures.sql`

```sql
CREATE TABLE workspace.mail_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES workspace.tenant_users(id),
    name VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    is_html BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_signatures_user_default
ON workspace.mail_signatures(user_id)
WHERE is_default = TRUE;
```

**API Endpoints:** `backend/api/mail_signatures.py`

```python
@router.get("")
async def list_signatures(current_user: dict = Depends(get_current_user)):
    """List all signatures for current user."""
    pass

@router.post("")
async def create_signature(signature: SignatureCreate, current_user: dict = Depends(get_current_user)):
    """Create new signature."""
    pass

@router.put("/{signature_id}")
async def update_signature(signature_id: uuid.UUID, signature: SignatureUpdate, current_user: dict = Depends(get_current_user)):
    """Update signature."""
    pass

@router.delete("/{signature_id}")
async def delete_signature(signature_id: uuid.UUID, current_user: dict = Depends(get_current_user)):
    """Delete signature."""
    pass

@router.post("/{signature_id}/default")
async def set_default_signature(signature_id: uuid.UUID, current_user: dict = Depends(get_current_user)):
    """Set signature as default."""
    pass
```

**Frontend Component:** `frontend/src/components/mail/SignatureEditor.tsx`

```typescript
export function SignatureEditor({ signature, onSave }: Props) {
  const [content, setContent] = useState(signature?.content || '');
  const [name, setName] = useState(signature?.name || 'My Signature');

  return (
    <div className="space-y-4">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Signature name"
        className="input"
      />

      <RichTextEditor
        value={content}
        onChange={setContent}
        placeholder="Enter your signature..."
        toolbar={['bold', 'italic', 'link', 'image']}
      />

      <div className="flex gap-2">
        <button onClick={() => onSave({ name, content })} className="btn-primary">
          Save Signature
        </button>
      </div>

      {/* Preview */}
      <div className="border-t pt-4">
        <h4 className="text-sm font-medium mb-2">Preview:</h4>
        <div className="border-l-2 pl-4 text-gray-600">
          <div dangerouslySetInnerHTML={{ __html: content }} />
        </div>
      </div>
    </div>
  );
}
```

**Checklist:**
- [ ] Run database migration for signatures table
- [ ] Create mail_signatures.py API router
- [ ] Build SignatureEditor component
- [ ] Add signature settings page
- [ ] Auto-insert signature in compose
- [ ] Allow signature selection per email
- [ ] Support HTML formatting in signatures

---

## Phase 3: Power Features (High Priority)

### 3.1 Scheduled Send

**Implementation Steps:**

**Database Migration:** `backend/migrations/007_scheduled_emails.sql`

```sql
CREATE TABLE workspace.scheduled_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES workspace.tenant_users(id),
    scheduled_at TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, sent, cancelled, failed
    email_data JSONB NOT NULL,
    sent_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_scheduled_pending ON workspace.scheduled_emails(scheduled_at)
WHERE status = 'pending';
```

**New File:** `backend/services/email_scheduler.py`

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.date import DateTrigger
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class EmailScheduler:
    def __init__(self, db_session_factory, mailcow_service, mail_session_service):
        self.scheduler = AsyncIOScheduler()
        self.db_factory = db_session_factory
        self.mailcow = mailcow_service
        self.mail_session = mail_session_service

    def start(self):
        """Start the scheduler and load pending jobs."""
        self.scheduler.start()
        self._load_pending_jobs()

    def _load_pending_jobs(self):
        """Load all pending scheduled emails from database."""
        with self.db_factory() as db:
            pending = db.query(ScheduledEmail).filter(
                ScheduledEmail.status == 'pending',
                ScheduledEmail.scheduled_at > datetime.utcnow()
            ).all()

            for email in pending:
                self._add_job(email)

    def schedule_email(
        self,
        user_id: str,
        email_data: dict,
        scheduled_at: datetime
    ) -> str:
        """Schedule an email for future delivery."""
        with self.db_factory() as db:
            scheduled = ScheduledEmail(
                user_id=user_id,
                email_data=email_data,
                scheduled_at=scheduled_at,
                status='pending'
            )
            db.add(scheduled)
            db.commit()

            self._add_job(scheduled)
            return str(scheduled.id)

    def _add_job(self, scheduled_email: ScheduledEmail):
        """Add APScheduler job for scheduled email."""
        self.scheduler.add_job(
            self._send_scheduled_email,
            trigger=DateTrigger(run_date=scheduled_email.scheduled_at),
            args=[str(scheduled_email.id)],
            id=f"email_{scheduled_email.id}",
            replace_existing=True
        )

    async def _send_scheduled_email(self, scheduled_id: str):
        """Send the scheduled email."""
        with self.db_factory() as db:
            scheduled = db.query(ScheduledEmail).filter(
                ScheduledEmail.id == scheduled_id
            ).first()

            if not scheduled or scheduled.status != 'pending':
                return

            try:
                credentials = self.mail_session.get_credentials(scheduled.user_id)
                if not credentials:
                    raise Exception("Mail session expired")

                await self.mailcow.send_email(
                    from_email=credentials["email"],
                    password=credentials["password"],
                    **scheduled.email_data
                )

                scheduled.status = 'sent'
                scheduled.sent_at = datetime.utcnow()

            except Exception as e:
                logger.error(f"Failed to send scheduled email {scheduled_id}: {e}")
                scheduled.status = 'failed'
                scheduled.error_message = str(e)

            db.commit()

    def cancel_scheduled_email(self, scheduled_id: str, user_id: str) -> bool:
        """Cancel a scheduled email."""
        with self.db_factory() as db:
            scheduled = db.query(ScheduledEmail).filter(
                ScheduledEmail.id == scheduled_id,
                ScheduledEmail.user_id == user_id,
                ScheduledEmail.status == 'pending'
            ).first()

            if not scheduled:
                return False

            scheduled.status = 'cancelled'
            db.commit()

            try:
                self.scheduler.remove_job(f"email_{scheduled_id}")
            except:
                pass

            return True
```

**API Endpoints:** `backend/api/mail.py`

```python
@router.post("/schedule")
async def schedule_email(
    email_data: SendEmailRequest,
    scheduled_at: datetime = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Schedule email for future delivery."""
    if scheduled_at <= datetime.utcnow():
        raise HTTPException(400, "Scheduled time must be in the future")

    scheduled_id = email_scheduler.schedule_email(
        current_user["id"],
        email_data.dict(),
        scheduled_at
    )

    return {"id": scheduled_id, "scheduled_at": scheduled_at}

@router.get("/scheduled")
async def list_scheduled_emails(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List pending scheduled emails."""
    scheduled = db.query(ScheduledEmail).filter(
        ScheduledEmail.user_id == current_user["id"],
        ScheduledEmail.status == 'pending'
    ).order_by(ScheduledEmail.scheduled_at).all()

    return {"scheduled_emails": scheduled}

@router.delete("/scheduled/{scheduled_id}")
async def cancel_scheduled_email(
    scheduled_id: uuid.UUID,
    current_user: dict = Depends(get_current_user)
):
    """Cancel a scheduled email."""
    success = email_scheduler.cancel_scheduled_email(
        str(scheduled_id),
        current_user["id"]
    )

    if not success:
        raise HTTPException(404, "Scheduled email not found or already sent")

    return {"success": True}
```

**Checklist:**
- [ ] Install APScheduler package
- [ ] Run database migration
- [ ] Create EmailScheduler service
- [ ] Initialize scheduler on app startup
- [ ] Add schedule endpoints
- [ ] Create schedule UI in compose modal
- [ ] Add scheduled emails list view
- [ ] Handle timezone conversions

---

### 3.2 Undo Send (30-Second Delay)

**Implementation Steps:**

**New File:** `backend/services/send_queue_service.py`

```python
import asyncio
from datetime import datetime, timedelta

class SendQueueService:
    def __init__(self, redis_client, mailcow_service):
        self.redis = redis_client
        self.mailcow = mailcow_service
        self.default_delay = 30  # seconds

    async def queue_email(
        self,
        user_id: str,
        credentials: dict,
        email_data: dict,
        delay_seconds: int = None
    ) -> str:
        """Queue email with delay for undo capability."""
        delay = delay_seconds or self.default_delay
        send_at = datetime.utcnow() + timedelta(seconds=delay)

        queue_id = f"send_queue:{user_id}:{uuid.uuid4()}"

        self.redis.setex(
            queue_id,
            delay + 60,  # Keep in Redis slightly longer
            json.dumps({
                "credentials": credentials,
                "email_data": email_data,
                "send_at": send_at.isoformat(),
                "status": "pending"
            })
        )

        # Schedule async send
        asyncio.create_task(self._delayed_send(queue_id, delay))

        return queue_id

    async def _delayed_send(self, queue_id: str, delay: int):
        """Wait and send if not cancelled."""
        await asyncio.sleep(delay)

        data = self.redis.get(queue_id)
        if not data:
            return  # Cancelled or expired

        queued = json.loads(data)
        if queued["status"] != "pending":
            return  # Already cancelled

        try:
            await self.mailcow.send_email(
                from_email=queued["credentials"]["email"],
                password=queued["credentials"]["password"],
                **queued["email_data"]
            )
            queued["status"] = "sent"
        except Exception as e:
            queued["status"] = "failed"
            queued["error"] = str(e)

        # Update status
        self.redis.setex(queue_id, 300, json.dumps(queued))  # Keep for 5 min

    def cancel_send(self, queue_id: str, user_id: str) -> bool:
        """Cancel a queued email (undo send)."""
        # Verify ownership
        if not queue_id.startswith(f"send_queue:{user_id}:"):
            return False

        data = self.redis.get(queue_id)
        if not data:
            return False

        queued = json.loads(data)
        if queued["status"] != "pending":
            return False  # Already sent or cancelled

        queued["status"] = "cancelled"
        self.redis.setex(queue_id, 60, json.dumps(queued))

        return True

    def get_pending_sends(self, user_id: str) -> list:
        """Get all pending sends for user (for undo UI)."""
        pattern = f"send_queue:{user_id}:*"
        pending = []

        for key in self.redis.scan_iter(pattern):
            data = self.redis.get(key)
            if data:
                queued = json.loads(data)
                if queued["status"] == "pending":
                    pending.append({
                        "queue_id": key,
                        "send_at": queued["send_at"],
                        "subject": queued["email_data"].get("subject", ""),
                        "to": queued["email_data"].get("to", [])
                    })

        return pending
```

**API Endpoints:**

```python
@router.post("/send")
async def send_email(
    email_data: SendEmailRequest,
    immediate: bool = Query(False),  # Skip queue for immediate send
    current_user: dict = Depends(get_current_user),
    mail_session: MailSessionService = Depends(get_mail_session)
):
    """Send email (with 30-second undo window by default)."""
    credentials = mail_session.get_credentials(current_user["id"])

    if immediate:
        # Send immediately
        await mailcow_service.send_email(
            from_email=credentials["email"],
            password=credentials["password"],
            **email_data.dict()
        )
        return {"success": True, "sent": True}

    # Queue with delay
    queue_id = await send_queue_service.queue_email(
        current_user["id"],
        credentials,
        email_data.dict()
    )

    return {
        "success": True,
        "queued": True,
        "queue_id": queue_id,
        "send_at": (datetime.utcnow() + timedelta(seconds=30)).isoformat(),
        "can_undo_until": (datetime.utcnow() + timedelta(seconds=30)).isoformat()
    }

@router.post("/send/undo")
async def undo_send(
    queue_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Cancel a pending email send (undo)."""
    success = send_queue_service.cancel_send(queue_id, current_user["id"])

    if not success:
        raise HTTPException(400, "Cannot undo - email already sent or expired")

    return {"success": True, "message": "Email cancelled"}
```

**Frontend Component:** `frontend/src/components/mail/UndoSendToast.tsx`

```typescript
export function UndoSendToast({ queueId, sendAt, subject, onUndo }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [undone, setUndone] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(sendAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);

      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sendAt]);

  const handleUndo = async () => {
    try {
      await mailApi.undoSend(queueId);
      setUndone(true);
      onUndo();
    } catch (e) {
      toast.error('Cannot undo - email already sent');
    }
  };

  if (undone) {
    return (
      <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-3 rounded-lg">
        Email cancelled
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-3 rounded-lg flex items-center gap-4">
      <span>Sending "{subject}" in {secondsLeft}s</span>
      <button
        onClick={handleUndo}
        className="bg-white text-gray-800 px-3 py-1 rounded font-medium"
        disabled={secondsLeft === 0}
      >
        Undo
      </button>
    </div>
  );
}
```

**Checklist:**
- [ ] Create SendQueueService
- [ ] Add send queue endpoints
- [ ] Build UndoSendToast component
- [ ] Add user preference for undo delay (5/10/30s)
- [ ] Show progress indicator during countdown
- [ ] Handle page close during countdown (warn user)

---

### 3.3 Email Filters & Rules

**Implementation Steps:**

**Database Migration:** `backend/migrations/008_mail_filters.sql`

```sql
CREATE TABLE workspace.mail_filters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES workspace.tenant_users(id),
    name VARCHAR(255) NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    priority INT DEFAULT 0,  -- Lower = higher priority
    stop_processing BOOLEAN DEFAULT FALSE,  -- Stop if this filter matches

    -- Conditions (all must match)
    conditions JSONB NOT NULL,
    /*
    Example conditions:
    [
        {"field": "from", "operator": "contains", "value": "@company.com"},
        {"field": "subject", "operator": "contains", "value": "[Important]"},
        {"field": "has_attachment", "operator": "equals", "value": true}
    ]
    */

    -- Actions (all applied)
    actions JSONB NOT NULL,
    /*
    Example actions:
    [
        {"action": "move_to", "value": "Important"},
        {"action": "mark_read", "value": true},
        {"action": "star", "value": true},
        {"action": "forward_to", "value": "backup@example.com"}
    ]
    */

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_filters_user ON workspace.mail_filters(user_id, is_enabled, priority);
```

**New File:** `backend/services/mail_filter_service.py`

```python
from typing import Optional
import re

class MailFilterService:
    OPERATORS = {
        'contains': lambda v, p: p.lower() in v.lower(),
        'not_contains': lambda v, p: p.lower() not in v.lower(),
        'equals': lambda v, p: v.lower() == p.lower() if isinstance(v, str) else v == p,
        'not_equals': lambda v, p: v.lower() != p.lower() if isinstance(v, str) else v != p,
        'starts_with': lambda v, p: v.lower().startswith(p.lower()),
        'ends_with': lambda v, p: v.lower().endswith(p.lower()),
        'matches_regex': lambda v, p: bool(re.search(p, v, re.IGNORECASE)),
    }

    def __init__(self, db, mailcow_service):
        self.db = db
        self.mailcow = mailcow_service

    def get_user_filters(self, user_id: str) -> list:
        """Get all filters for user, ordered by priority."""
        return self.db.query(MailFilter).filter(
            MailFilter.user_id == user_id,
            MailFilter.is_enabled == True
        ).order_by(MailFilter.priority).all()

    async def apply_filters(
        self,
        user_id: str,
        credentials: dict,
        email: dict
    ) -> list:
        """Apply filters to email, return list of actions taken."""
        filters = self.get_user_filters(user_id)
        actions_taken = []

        for filter in filters:
            if self._matches_conditions(email, filter.conditions):
                # Apply actions
                for action in filter.actions:
                    result = await self._apply_action(
                        credentials,
                        email,
                        action
                    )
                    actions_taken.append({
                        'filter': filter.name,
                        'action': action,
                        'result': result
                    })

                if filter.stop_processing:
                    break

        return actions_taken

    def _matches_conditions(self, email: dict, conditions: list) -> bool:
        """Check if email matches all conditions."""
        for condition in conditions:
            field = condition['field']
            operator = condition['operator']
            value = condition['value']

            email_value = self._get_field_value(email, field)

            if operator not in self.OPERATORS:
                continue

            if not self.OPERATORS[operator](email_value, value):
                return False

        return True

    def _get_field_value(self, email: dict, field: str):
        """Extract field value from email."""
        field_map = {
            'from': lambda e: e.get('from', {}).get('email', ''),
            'from_name': lambda e: e.get('from', {}).get('name', ''),
            'to': lambda e: ','.join([t.get('email', '') for t in e.get('to', [])]),
            'cc': lambda e: ','.join([c.get('email', '') for c in e.get('cc', [])]),
            'subject': lambda e: e.get('subject', ''),
            'body': lambda e: e.get('body_text', '') or e.get('body', ''),
            'has_attachment': lambda e: len(e.get('attachments', [])) > 0,
            'size': lambda e: e.get('size', 0),
        }

        return field_map.get(field, lambda e: '')(email)

    async def _apply_action(
        self,
        credentials: dict,
        email: dict,
        action: dict
    ) -> dict:
        """Apply a single action to email."""
        action_type = action['action']
        value = action['value']

        if action_type == 'move_to':
            await self.mailcow.move_email(
                credentials['email'],
                credentials['password'],
                email['message_id'],
                email.get('folder', 'INBOX'),
                value
            )
            return {'moved_to': value}

        elif action_type == 'mark_read':
            await self.mailcow.mark_as_read(
                credentials['email'],
                credentials['password'],
                email['message_id'],
                value
            )
            return {'marked_read': value}

        elif action_type == 'star':
            await self.mailcow.toggle_star(
                credentials['email'],
                credentials['password'],
                email['message_id'],
                value
            )
            return {'starred': value}

        elif action_type == 'label':
            # Add label (if implemented)
            return {'labeled': value}

        elif action_type == 'forward_to':
            await self.mailcow.forward_email(
                credentials['email'],
                credentials['password'],
                email['message_id'],
                value
            )
            return {'forwarded_to': value}

        elif action_type == 'delete':
            await self.mailcow.delete_email(
                credentials['email'],
                credentials['password'],
                email['message_id']
            )
            return {'deleted': True}

        return {'unknown_action': action_type}
```

**Checklist:**
- [ ] Run database migration
- [ ] Create MailFilterService
- [ ] Add filter CRUD endpoints
- [ ] Apply filters when fetching new emails
- [ ] Create filter builder UI
- [ ] Add filter testing (preview matches)
- [ ] Support regex patterns

---

### 3.4 Real-Time Sync (WebSocket/SSE)

**Implementation Steps:**

**New File:** `backend/api/mail_realtime.py`

```python
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import Dict, Set
import asyncio
import json

router = APIRouter(prefix="/mail/ws", tags=["mail-realtime"])

class MailConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)

    async def send_to_user(self, user_id: str, message: dict):
        if user_id in self.active_connections:
            disconnected = set()
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except:
                    disconnected.add(connection)

            # Clean up disconnected
            self.active_connections[user_id] -= disconnected

manager = MailConnectionManager()

@router.websocket("")
async def mail_websocket(
    websocket: WebSocket,
    token: str  # JWT token for auth
):
    """WebSocket endpoint for real-time mail updates."""
    try:
        # Validate token
        user = await validate_ws_token(token)
        if not user:
            await websocket.close(code=4001)
            return

        user_id = user["id"]
        await manager.connect(websocket, user_id)

        # Start IMAP IDLE monitoring
        mail_session = mail_session_service.get_credentials(user_id)
        if mail_session:
            asyncio.create_task(
                monitor_imap_idle(user_id, mail_session, manager)
            )

        # Keep connection alive
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)

                # Handle client messages
                if message.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                elif message.get("type") == "subscribe_folder":
                    # Track folder subscriptions
                    pass

            except WebSocketDisconnect:
                break

    finally:
        manager.disconnect(websocket, user_id)

async def monitor_imap_idle(
    user_id: str,
    credentials: dict,
    manager: MailConnectionManager
):
    """Monitor IMAP IDLE for new emails."""
    import imaplib

    while user_id in manager.active_connections:
        try:
            imap = imaplib.IMAP4_SSL(
                settings.MAILCOW_IMAP_HOST,
                settings.MAILCOW_IMAP_PORT
            )
            imap.login(credentials["email"], credentials["password"])
            imap.select("INBOX")

            # IDLE command
            imap.send(b'IDLE\r\n')

            while True:
                # Wait for IDLE response (with timeout)
                response = imap.readline()

                if b'EXISTS' in response:
                    # New email arrived
                    await manager.send_to_user(user_id, {
                        "type": "new_email",
                        "folder": "INBOX"
                    })
                elif b'BYE' in response:
                    break

                # Check if user still connected
                if user_id not in manager.active_connections:
                    break

            imap.send(b'DONE\r\n')
            imap.logout()

        except Exception as e:
            await asyncio.sleep(5)  # Retry after error
```

**Frontend WebSocket Hook:** `frontend/src/hooks/useMailWebSocket.ts`

```typescript
export function useMailWebSocket() {
  const { token } = useAuthStore();
  const { fetchEmails, addNewEmail } = useMailStore();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) return;

    const ws = new WebSocket(`${WS_URL}/mail/ws?token=${token}`);

    ws.onopen = () => {
      setConnected(true);
      console.log('Mail WebSocket connected');
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'new_email':
          // Fetch new emails for folder
          fetchEmails(message.folder, 1);
          // Show notification
          showNotification('New email received');
          break;

        case 'email_updated':
          // Refresh email in store
          break;

        case 'email_deleted':
          // Remove from store
          break;
      }
    };

    ws.onclose = () => {
      setConnected(false);
      // Reconnect after delay
      setTimeout(() => {
        // Reconnect logic
      }, 3000);
    };

    // Ping every 30s to keep alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => {
      clearInterval(pingInterval);
      ws.close();
    };
  }, [token]);

  return { connected };
}
```

**Checklist:**
- [ ] Create WebSocket endpoint
- [ ] Implement IMAP IDLE monitoring
- [ ] Create useMailWebSocket hook
- [ ] Add browser notifications for new mail
- [ ] Handle reconnection logic
- [ ] Add connection status indicator in UI

---

## Phase 4: Integration (Medium Priority)

### 4.1 Calendar Integration

**Implementation Steps:**

**New File:** `backend/services/calendar_detection_service.py`

```python
import re
from datetime import datetime
from dateutil import parser as date_parser

class CalendarDetectionService:
    # Regex patterns for date/time detection
    DATE_PATTERNS = [
        r'\b(?:on\s+)?(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}',
        r'\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}',
        r'\b\d{1,2}/\d{1,2}/\d{2,4}\b',
        r'\b\d{4}-\d{2}-\d{2}\b',
    ]

    TIME_PATTERNS = [
        r'\b\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?\b',
        r'\b\d{1,2}\s*(?:AM|PM|am|pm)\b',
    ]

    EVENT_KEYWORDS = [
        'meeting', 'call', 'conference', 'appointment', 'interview',
        'demo', 'presentation', 'review', 'sync', 'standup', 'catch-up',
        'lunch', 'dinner', 'coffee', 'event', 'webinar', 'workshop'
    ]

    def detect_events(self, email_body: str, email_subject: str) -> list:
        """Detect potential calendar events in email."""
        events = []

        # Check for meeting invites (ICS attachments handled separately)
        text = f"{email_subject} {email_body}"

        # Find dates
        dates = []
        for pattern in self.DATE_PATTERNS:
            matches = re.findall(pattern, text, re.IGNORECASE)
            dates.extend(matches)

        # Find times
        times = []
        for pattern in self.TIME_PATTERNS:
            matches = re.findall(pattern, text, re.IGNORECASE)
            times.extend(matches)

        # Check for event keywords
        has_event_keyword = any(kw in text.lower() for kw in self.EVENT_KEYWORDS)

        if dates and has_event_keyword:
            for date_str in dates[:3]:  # Limit to 3 potential events
                try:
                    parsed_date = date_parser.parse(date_str, fuzzy=True)

                    # Try to pair with time
                    event_time = times[0] if times else None
                    if event_time:
                        try:
                            parsed_time = date_parser.parse(event_time)
                            parsed_date = parsed_date.replace(
                                hour=parsed_time.hour,
                                minute=parsed_time.minute
                            )
                        except:
                            pass

                    events.append({
                        'title': self._extract_event_title(text),
                        'datetime': parsed_date.isoformat(),
                        'date_str': date_str,
                        'time_str': event_time,
                        'confidence': 0.7 if event_time else 0.5
                    })

                except:
                    continue

        return events

    def _extract_event_title(self, text: str) -> str:
        """Extract potential event title from text."""
        # Look for patterns like "Meeting about X" or "Call to discuss Y"
        patterns = [
            r'(?:meeting|call|conference)\s+(?:about|regarding|to discuss|for)\s+(.+?)(?:\.|,|$)',
            r'(?:join us for|invite you to)\s+(.+?)(?:\.|,|$)',
        ]

        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1)[:100].strip()

        return "Event from email"
```

**API Endpoint:** `backend/api/mail.py`

```python
@router.get("/messages/{message_id}/events")
async def detect_calendar_events(
    message_id: str,
    current_user: dict = Depends(get_current_user),
    mail_session: MailSessionService = Depends(get_mail_session)
):
    """Detect potential calendar events in email."""
    credentials = mail_session.get_credentials(current_user["id"])
    email = await mailcow_service.get_email(
        credentials["email"],
        credentials["password"],
        message_id
    )

    events = calendar_detection_service.detect_events(
        email['body'],
        email['subject']
    )

    return {"events": events}

@router.post("/messages/{message_id}/add-to-calendar")
async def add_email_to_calendar(
    message_id: str,
    event_data: CalendarEventCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add detected event to user's calendar."""
    # Integration with Bheem Calendar service
    calendar_event = await calendar_service.create_event(
        user_id=current_user["id"],
        title=event_data.title,
        start_time=event_data.start_time,
        end_time=event_data.end_time,
        description=f"Created from email: {event_data.email_subject}",
        source_email_id=message_id
    )

    return {"event_id": calendar_event.id}
```

**Checklist:**
- [ ] Create CalendarDetectionService
- [ ] Add event detection endpoint
- [ ] Parse ICS attachments
- [ ] Integrate with Bheem Calendar API
- [ ] Add "Add to Calendar" button in email view
- [ ] Show detected events in email UI

---

### 4.2 Contact Autocomplete

**Implementation Steps:**

**Database Migration:** `backend/migrations/009_mail_contacts.sql`

```sql
CREATE TABLE workspace.mail_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES workspace.tenant_users(id),
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    frequency INT DEFAULT 1,  -- How often emailed
    last_contacted TIMESTAMP,
    is_favorite BOOLEAN DEFAULT FALSE,
    source VARCHAR(50) DEFAULT 'auto',  -- auto, manual, import
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(user_id, email)
);

CREATE INDEX idx_contacts_user_email ON workspace.mail_contacts(user_id, email);
CREATE INDEX idx_contacts_user_frequency ON workspace.mail_contacts(user_id, frequency DESC);
```

**New File:** `backend/services/mail_contacts_service.py`

```python
class MailContactsService:
    def __init__(self, db):
        self.db = db

    def record_contact(self, user_id: str, email: str, name: str = None):
        """Record/update contact from sent email."""
        existing = self.db.query(MailContact).filter(
            MailContact.user_id == user_id,
            MailContact.email == email.lower()
        ).first()

        if existing:
            existing.frequency += 1
            existing.last_contacted = datetime.utcnow()
            if name and not existing.name:
                existing.name = name
        else:
            contact = MailContact(
                user_id=user_id,
                email=email.lower(),
                name=name,
                frequency=1,
                last_contacted=datetime.utcnow()
            )
            self.db.add(contact)

        self.db.commit()

    def search_contacts(
        self,
        user_id: str,
        query: str,
        limit: int = 10
    ) -> list:
        """Search contacts by name or email."""
        return self.db.query(MailContact).filter(
            MailContact.user_id == user_id,
            or_(
                MailContact.email.ilike(f"%{query}%"),
                MailContact.name.ilike(f"%{query}%")
            )
        ).order_by(
            MailContact.is_favorite.desc(),
            MailContact.frequency.desc()
        ).limit(limit).all()

    def get_suggestions(self, user_id: str, limit: int = 5) -> list:
        """Get top suggested contacts."""
        return self.db.query(MailContact).filter(
            MailContact.user_id == user_id
        ).order_by(
            MailContact.is_favorite.desc(),
            MailContact.frequency.desc()
        ).limit(limit).all()
```

**API Endpoint:**

```python
@router.get("/contacts/search")
async def search_contacts(
    q: str = Query(..., min_length=1),
    limit: int = Query(10),
    current_user: dict = Depends(get_current_user)
):
    """Search contacts for autocomplete."""
    contacts = mail_contacts_service.search_contacts(
        current_user["id"],
        q,
        limit
    )
    return {"contacts": contacts}

@router.get("/contacts/suggestions")
async def get_contact_suggestions(
    current_user: dict = Depends(get_current_user)
):
    """Get frequently contacted for quick access."""
    suggestions = mail_contacts_service.get_suggestions(current_user["id"])
    return {"suggestions": suggestions}
```

**Frontend Component:** `frontend/src/components/mail/RecipientInput.tsx`

```typescript
export function RecipientInput({ value, onChange, placeholder }: Props) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Contact[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const debouncedSearch = useMemo(
    () => debounce(async (q: string) => {
      if (q.length >= 1) {
        const results = await mailApi.searchContacts(q);
        setSuggestions(results.contacts);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 200),
    []
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    debouncedSearch(newQuery);
  };

  const addRecipient = (contact: Contact) => {
    onChange([...value, { email: contact.email, name: contact.name }]);
    setQuery('');
    setShowSuggestions(false);
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1 p-2 border rounded">
        {value.map((recipient, i) => (
          <span key={i} className="bg-blue-100 px-2 py-1 rounded flex items-center gap-1">
            {recipient.name || recipient.email}
            <button onClick={() => onChange(value.filter((_, j) => j !== i))}>
              <XIcon className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 outline-none min-w-[100px]"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && query.includes('@')) {
              addRecipient({ email: query, name: '' });
            }
          }}
        />
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-white shadow-lg rounded-b border-t z-50">
          {suggestions.map((contact) => (
            <button
              key={contact.id}
              onClick={() => addRecipient(contact)}
              className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3"
            >
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                {(contact.name || contact.email)[0].toUpperCase()}
              </div>
              <div>
                <div className="font-medium">{contact.name || contact.email}</div>
                {contact.name && (
                  <div className="text-sm text-gray-500">{contact.email}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Checklist:**
- [ ] Run database migration
- [ ] Create MailContactsService
- [ ] Add contact search endpoint
- [ ] Record contacts when sending emails
- [ ] Build RecipientInput component with autocomplete
- [ ] Import contacts from sent emails
- [ ] Add contact management UI

---

## Phase 5: Enterprise Features (Future)

### 5.1 Shared Mailboxes / Team Inboxes

**High-Level Design:**

```sql
-- Shared mailbox model
CREATE TABLE workspace.shared_mailboxes (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE workspace.shared_mailbox_members (
    id UUID PRIMARY KEY,
    mailbox_id UUID REFERENCES workspace.shared_mailboxes(id),
    user_id UUID REFERENCES workspace.tenant_users(id),
    role VARCHAR(20) DEFAULT 'member',  -- admin, member
    can_send BOOLEAN DEFAULT TRUE,
    can_delete BOOLEAN DEFAULT FALSE,
    UNIQUE(mailbox_id, user_id)
);
```

**Key Features:**
- Multiple users access same inbox
- Assign emails to team members
- Internal comments on emails
- Send on behalf of shared mailbox
- Activity tracking per email

---

### 5.2 Offline Support (Service Worker)

**High-Level Design:**

```typescript
// service-worker.ts
const MAIL_CACHE = 'bheem-mail-v1';

// Cache strategies
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/mail/')) {
    event.respondWith(
      networkFirst(event.request, MAIL_CACHE)
    );
  }
});

// Background sync for offline sends
self.addEventListener('sync', (event) => {
  if (event.tag === 'mail-outbox') {
    event.waitUntil(sendPendingEmails());
  }
});
```

**Key Features:**
- Cache recent emails (last 100 per folder)
- Queue sends when offline
- Sync when back online
- Show offline indicator

---

### 5.3 Attachment Preview

**High-Level Design:**

```python
# Supported preview types
PREVIEW_HANDLERS = {
    'image/*': ImagePreviewHandler,      # Direct display
    'application/pdf': PDFPreviewHandler, # PDF.js
    'text/*': TextPreviewHandler,         # Syntax highlighted
    'application/json': JSONPreviewHandler,
    'video/*': VideoPreviewHandler,       # HTML5 video
    'audio/*': AudioPreviewHandler,       # HTML5 audio
}
```

**Key Features:**
- In-browser preview for images, PDFs, text
- Thumbnail generation
- Download fallback for unsupported types

---

## Testing Checklist

### Security Tests
- [ ] Penetration testing for auth endpoints
- [ ] XSS testing in email rendering
- [ ] SQL injection testing
- [ ] Rate limit bypass testing
- [ ] Session hijacking prevention

### Performance Tests
- [ ] Load test with 1000+ emails
- [ ] Search performance with 10,000+ emails
- [ ] WebSocket scalability (1000 concurrent connections)
- [ ] Memory usage profiling

### Integration Tests
- [ ] End-to-end email flow
- [ ] Calendar event detection accuracy
- [ ] Contact autocomplete relevance
- [ ] Filter rule execution

### User Acceptance Tests
- [ ] Thread grouping correctness
- [ ] Draft auto-save reliability
- [ ] Undo send timing accuracy
- [ ] Scheduled send delivery

---

## Dependencies & Prerequisites

### New Packages Required

**Backend (Python):**
```
redis>=4.0.0
cryptography>=41.0.0
pyotp>=2.9.0
qrcode>=7.4.0
slowapi>=0.1.9
meilisearch>=0.28.0
apscheduler>=3.10.0
python-dateutil>=2.8.0
```

**Frontend (Node.js):**
```
@meilisearch/instant-meilisearch
date-fns
lodash.debounce
```

### Infrastructure Requirements

| Service | Purpose | Deployment |
|---------|---------|------------|
| Redis | Session storage, rate limiting, send queue | Docker or managed |
| Meilisearch | Full-text search | Docker or cloud |
| APScheduler | Scheduled sends | Built-in (Python) |

### Environment Variables

```bash
# New variables to add
MAIL_ENCRYPTION_KEY=<generate with Fernet.generate_key()>
REDIS_URL=redis://localhost:6379
MEILISEARCH_URL=http://localhost:7700
MEILISEARCH_API_KEY=<your-key>
MAIL_SESSION_TTL_HOURS=24
UNDO_SEND_DELAY_SECONDS=30
```

---

## Summary

This implementation plan transforms the Bheem Mail System from a basic webmail client into an enterprise-grade email platform competitive with Gmail and Zoho Mail.

**Phase 1 (Critical):** Addresses security vulnerabilities that could expose user credentials.

**Phase 2 (High Priority):** Adds core UX features users expect from modern email.

**Phase 3 (Power Features):** Differentiates with productivity features like scheduled send and undo.

**Phase 4 (Integration):** Creates a connected workspace with calendar and contacts.

**Phase 5 (Enterprise):** Prepares for team/enterprise deployments.

The AI features already implemented (smart compose, summarization, etc.) provide a significant competitive advantage that should be highlighted and expanded upon.
