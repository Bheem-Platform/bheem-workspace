# BHEEM WORKSPACE - API INTEGRATION PLAN

**Date:** December 9, 2025
**Goal:** Connect Workspace apps to real backends (LiveKit, Mailcow, Nextcloud) + Bheem Core ERP

---

## ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        BHEEM WORKSPACE FRONTEND                         │
│         https://workspace.bheem.cloud (37.27.40.113:8500)              │
├─────────────┬─────────────┬─────────────┬─────────────┬────────────────┤
│  Bheem Meet │ Bheem Mail  │ Bheem Docs  │  Calendar   │    Admin       │
│   /meet     │   /mail     │  /docs-app  │  /calendar  │   /admin       │
└──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┴───────┬────────┘
       │             │             │             │              │
       ▼             ▼             ▼             ▼              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    BHEEM WORKSPACE BACKEND API                           │
│                    /api/v1/* (FastAPI :8500)                            │
├──────────────┬─────────────┬─────────────┬─────────────┬────────────────┤
│  /api/v1/    │  /api/v1/   │  /api/v1/   │  /api/v1/   │   /api/v1/     │
│    meet      │    mail     │    docs     │  calendar   │    auth        │
└──────┬───────┴──────┬──────┴──────┬──────┴──────┬──────┴───────┬────────┘
       │              │             │             │              │
       ▼              ▼             ▼             ▼              ▼
┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│  LiveKit   │ │  Mailcow   │ │ Nextcloud  │ │  CalDAV    │ │ Bheem Core │
│37.27.89.140│ │135.181.25.62│ │46.62.165.32│ │(Nextcloud) │ │   ERP      │
└────────────┘ └────────────┘ └────────────┘ └────────────┘ └────────────┘
```

---

## PHASE 1: AUTHENTICATION (Foundation)

### 1.1 Unified Auth with Bheem Core ERP

**Strategy:** Use ERP `auth.users` table as single source of truth

```python
# /api/v1/auth/login
POST /api/v1/auth/login
{
  "username": "user@bheem.cloud",
  "password": "password"
}

Response:
{
  "access_token": "jwt_token",
  "user": {
    "id": "uuid",
    "email": "user@bheem.cloud",
    "company_id": "uuid",
    "role": "Admin|User|Customer"
  }
}
```

**Integration Points:**
- ERP Database: `auth.users` table @ `65.109.167.218`
- JWT tokens with company_id for multi-tenancy
- Sync user to Nextcloud on first login
- Create mailbox in Mailcow on user creation

### 1.2 Files to Create
```
backend/api/auth.py          - Auth endpoints
backend/core/security.py     - JWT handling
backend/core/database.py     - ERP DB connection
backend/models/user.py       - User model
```

---

## PHASE 2: BHEEM MEET (LiveKit Integration)

### 2.1 Backend API Endpoints

```python
# Create meeting room
POST /api/v1/meet/rooms
{
  "name": "Team Standup",
  "scheduled_time": "2025-12-10T09:00:00Z",
  "duration_minutes": 60,
  "participants": ["user1@bheem.cloud", "user2@bheem.cloud"]
}

Response:
{
  "room_id": "bhm-abc-xyz",
  "join_url": "https://workspace.bheem.cloud/meet/room/bhm-abc-xyz",
  "host_token": "livekit_jwt_token"
}

# Get LiveKit token for joining
POST /api/v1/meet/token
{
  "room_id": "bhm-abc-xyz",
  "user_name": "John Doe"
}

Response:
{
  "token": "livekit_jwt_token",
  "ws_url": "wss://meet.bheem.cloud"
}

# List meetings
GET /api/v1/meet/rooms?status=scheduled|active|completed

# Start recording
POST /api/v1/meet/rooms/{room_id}/recording/start

# Stop recording & sync to S3
POST /api/v1/meet/rooms/{room_id}/recording/stop
```

### 2.2 LiveKit Integration Code

```python
# backend/services/livekit_service.py
from livekit import api

LIVEKIT_API_KEY = "BheemMeetAPI"
LIVEKIT_API_SECRET = "BheemMeet2024SecretKey"
LIVEKIT_URL = "wss://meet.bheem.cloud"

def create_token(room_name: str, participant_name: str, is_host: bool = False):
    token = api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    token.with_identity(participant_name)
    token.with_name(participant_name)

    grant = api.VideoGrants(
        room_join=True,
        room=room_name,
        can_publish=True,
        can_subscribe=True,
        room_admin=is_host,
        room_record=is_host
    )
    token.with_grants(grant)
    return token.to_jwt()
```

### 2.3 ERP Integration (Meeting Rooms)

```sql
-- Store meetings in ERP
INSERT INTO project_management.pm_meeting_rooms (
  id, name, room_code, created_by, company_id,
  scheduled_start, scheduled_end, status
) VALUES (...)

-- Store recordings
INSERT INTO project_management.pm_room_bookings (
  room_id, recording_url, s3_path, duration_seconds
) VALUES (...)
```

### 2.4 Frontend Updates

```javascript
// meeting-room.html - Connect to LiveKit
const token = await fetch('/api/v1/meet/token', {
  method: 'POST',
  body: JSON.stringify({ room_id: roomName, user_name: userName })
}).then(r => r.json());

const room = new LivekitClient.Room();
await room.connect('wss://meet.bheem.cloud', token.token);
```

---

## PHASE 3: BHEEM MAIL (Mailcow Integration)

### 3.1 Backend API Endpoints

```python
# Get inbox
GET /api/v1/mail/inbox?folder=INBOX&page=1&limit=50

# Get email
GET /api/v1/mail/messages/{message_id}

# Send email
POST /api/v1/mail/send
{
  "to": ["recipient@example.com"],
  "cc": [],
  "subject": "Hello",
  "body": "<p>HTML content</p>",
  "attachments": []
}

# List folders
GET /api/v1/mail/folders

# Move to folder
POST /api/v1/mail/messages/{id}/move
{
  "folder": "Trash"
}
```

### 3.2 Mailcow Integration

```python
# backend/services/mailcow_service.py
import imaplib
import smtplib
from email.mime.text import MIMEText

MAILCOW_API_KEY = "BheemMailAPI2024Key"
MAILCOW_URL = "https://mail.bheem.cloud"
IMAP_HOST = "mail.bheem.cloud"
SMTP_HOST = "mail.bheem.cloud"

class MailcowService:
    async def get_inbox(self, user_email: str, password: str):
        # Connect via IMAP
        mail = imaplib.IMAP4_SSL(IMAP_HOST)
        mail.login(user_email, password)
        mail.select('INBOX')
        # Fetch messages...

    async def send_email(self, from_email: str, password: str, to: list, subject: str, body: str):
        # Send via SMTP
        msg = MIMEText(body, 'html')
        msg['Subject'] = subject
        msg['From'] = from_email
        msg['To'] = ', '.join(to)

        with smtplib.SMTP_SSL(SMTP_HOST, 465) as server:
            server.login(from_email, password)
            server.send_message(msg)

    async def create_mailbox(self, email: str, password: str, name: str):
        # Use Mailcow API
        requests.post(f"{MAILCOW_URL}/api/v1/add/mailbox",
            headers={"X-API-Key": MAILCOW_API_KEY},
            json={
                "local_part": email.split('@')[0],
                "domain": email.split('@')[1],
                "password": password,
                "name": name
            }
        )
```

### 3.3 User Mailbox Provisioning

When user created in ERP → Auto-create mailbox in Mailcow:
```python
# On user registration
await mailcow_service.create_mailbox(
    email=f"{username}@bheem.cloud",
    password=generated_password,
    name=full_name
)
```

---

## PHASE 4: BHEEM DOCS (Nextcloud Integration)

### 4.1 Backend API Endpoints

```python
# List files/folders
GET /api/v1/docs/files?path=/&type=all|folder|file

# Upload file
POST /api/v1/docs/upload
multipart/form-data: file, path

# Download file
GET /api/v1/docs/download/{file_id}

# Create folder
POST /api/v1/docs/folders
{
  "name": "New Folder",
  "path": "/Documents"
}

# Share file
POST /api/v1/docs/share
{
  "file_path": "/Documents/report.pdf",
  "share_with": "user@bheem.cloud",
  "permissions": "read|write"
}

# Get share link
POST /api/v1/docs/share-link
{
  "file_path": "/Documents/report.pdf",
  "expires_days": 7
}
```

### 4.2 Nextcloud WebDAV Integration

```python
# backend/services/nextcloud_service.py
import requests
from webdav3.client import Client

NEXTCLOUD_URL = "https://docs.bheem.cloud"
NEXTCLOUD_ADMIN = "admin"
NEXTCLOUD_PASS = "admin_password"

class NextcloudService:
    def __init__(self, user: str, password: str):
        self.webdav = Client({
            'webdav_hostname': f"{NEXTCLOUD_URL}/remote.php/dav/files/{user}/",
            'webdav_login': user,
            'webdav_password': password
        })

    async def list_files(self, path: str = "/"):
        return self.webdav.list(path)

    async def upload_file(self, local_path: str, remote_path: str):
        self.webdav.upload_sync(remote_path, local_path)

    async def download_file(self, remote_path: str, local_path: str):
        self.webdav.download_sync(remote_path, local_path)

    async def create_folder(self, path: str):
        self.webdav.mkdir(path)

    async def share_file(self, path: str, share_with: str):
        # Use OCS Share API
        requests.post(
            f"{NEXTCLOUD_URL}/ocs/v2.php/apps/files_sharing/api/v1/shares",
            auth=(self.user, self.password),
            headers={"OCS-APIREQUEST": "true"},
            data={
                "path": path,
                "shareType": 0,  # User share
                "shareWith": share_with
            }
        )
```

### 4.3 User Provisioning in Nextcloud

```python
# Create Nextcloud user when ERP user created
async def create_nextcloud_user(username: str, password: str, email: str):
    requests.post(
        f"{NEXTCLOUD_URL}/ocs/v1.php/cloud/users",
        auth=(NEXTCLOUD_ADMIN, NEXTCLOUD_PASS),
        headers={"OCS-APIREQUEST": "true"},
        data={
            "userid": username,
            "password": password,
            "email": email
        }
    )
```

---

## PHASE 5: BHEEM CALENDAR (Nextcloud CalDAV)

### 5.1 Backend API Endpoints

```python
# List calendars
GET /api/v1/calendar/calendars

# List events
GET /api/v1/calendar/events?start=2025-12-01&end=2025-12-31&calendar=personal

# Create event
POST /api/v1/calendar/events
{
  "title": "Team Meeting",
  "start": "2025-12-10T09:00:00Z",
  "end": "2025-12-10T10:00:00Z",
  "calendar": "personal",
  "location": "Conference Room A",
  "description": "Weekly standup",
  "attendees": ["user1@bheem.cloud"],
  "create_meeting": true  // Auto-create Bheem Meet room
}

# Update event
PUT /api/v1/calendar/events/{event_id}

# Delete event
DELETE /api/v1/calendar/events/{event_id}
```

### 5.2 CalDAV Integration

```python
# backend/services/caldav_service.py
import caldav
from icalendar import Calendar, Event

CALDAV_URL = "https://docs.bheem.cloud/remote.php/dav"

class CalDAVService:
    def __init__(self, user: str, password: str):
        self.client = caldav.DAVClient(
            url=CALDAV_URL,
            username=user,
            password=password
        )
        self.principal = self.client.principal()

    async def get_calendars(self):
        return self.principal.calendars()

    async def get_events(self, calendar_name: str, start: datetime, end: datetime):
        calendar = self.principal.calendar(name=calendar_name)
        return calendar.date_search(start=start, end=end)

    async def create_event(self, calendar_name: str, event_data: dict):
        calendar = self.principal.calendar(name=calendar_name)

        cal = Calendar()
        event = Event()
        event.add('summary', event_data['title'])
        event.add('dtstart', event_data['start'])
        event.add('dtend', event_data['end'])
        event.add('location', event_data.get('location', ''))
        event.add('description', event_data.get('description', ''))
        cal.add_component(event)

        calendar.save_event(cal.to_ical())
```

### 5.3 Meeting Integration

When creating calendar event with `create_meeting: true`:
1. Create LiveKit room
2. Add meeting link to event description
3. Send email invites via Mailcow

---

## PHASE 6: ERP SYNC & MULTI-TENANCY

### 6.1 Company-Based Isolation

Every API request includes company context:
```python
@app.middleware("http")
async def add_company_context(request: Request, call_next):
    token = request.headers.get("Authorization")
    if token:
        payload = decode_jwt(token)
        request.state.company_id = payload.get("company_id")
        request.state.user_id = payload.get("user_id")
    return await call_next(request)
```

### 6.2 ERP Data Sync

```python
# Sync meetings to ERP
async def sync_meeting_to_erp(meeting: Meeting, company_id: str):
    async with get_erp_db() as db:
        await db.execute("""
            INSERT INTO project_management.pm_meeting_rooms
            (id, name, room_code, company_id, created_by, scheduled_start)
            VALUES ($1, $2, $3, $4, $5, $6)
        """, meeting.id, meeting.name, meeting.room_code,
             company_id, meeting.created_by, meeting.scheduled_time)

# Sync documents to ERP DMS
async def sync_document_to_erp(doc: Document, company_id: str):
    async with get_erp_db() as db:
        await db.execute("""
            INSERT INTO dms.documents
            (id, title, file_name, storage_path, company_id, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
        """, doc.id, doc.title, doc.file_name,
             doc.nextcloud_path, company_id, doc.created_by)
```

---

## IMPLEMENTATION ORDER

### Week 1: Foundation
1. [ ] Set up backend project structure
2. [ ] Create database connection to ERP
3. [ ] Implement JWT auth with ERP users
4. [ ] Create base API router

### Week 2: Bheem Meet
5. [ ] LiveKit service integration
6. [ ] Room creation/token generation APIs
7. [ ] Update meeting-room.html with real LiveKit
8. [ ] Recording API (start/stop/S3 sync)

### Week 3: Bheem Mail
9. [ ] Mailcow IMAP/SMTP integration
10. [ ] Inbox, send, folders APIs
11. [ ] Update bheem-mail.html with real API
12. [ ] User mailbox provisioning

### Week 4: Bheem Docs & Calendar
13. [ ] Nextcloud WebDAV integration
14. [ ] File upload/download/share APIs
15. [ ] CalDAV integration
16. [ ] Calendar events with meeting creation
17. [ ] Update frontend UIs

### Week 5: Polish & Multi-tenancy
18. [ ] Company-based data isolation
19. [ ] ERP sync for all modules
20. [ ] User provisioning workflow
21. [ ] Testing & bug fixes

---

## FILE STRUCTURE

```
/root/bheem-workspace/backend/
├── main.py                    # FastAPI app
├── requirements.txt
├── .env                       # Credentials
├── core/
│   ├── config.py             # Settings
│   ├── database.py           # ERP DB connection
│   ├── security.py           # JWT auth
│   └── dependencies.py       # Request dependencies
├── models/
│   ├── user.py
│   ├── meeting.py
│   ├── document.py
│   └── calendar.py
├── services/
│   ├── livekit_service.py    # LiveKit integration
│   ├── mailcow_service.py    # Mailcow integration
│   ├── nextcloud_service.py  # Nextcloud WebDAV
│   ├── caldav_service.py     # Calendar integration
│   └── erp_sync_service.py   # ERP data sync
├── api/
│   ├── auth.py               # /api/v1/auth/*
│   ├── meet.py               # /api/v1/meet/*
│   ├── mail.py               # /api/v1/mail/*
│   ├── docs.py               # /api/v1/docs/*
│   ├── calendar.py           # /api/v1/calendar/*
│   └── admin.py              # /api/v1/admin/*
└── schemas/
    ├── auth.py
    ├── meet.py
    ├── mail.py
    ├── docs.py
    └── calendar.py
```

---

## ENVIRONMENT VARIABLES

```env
# Database (ERP)
ERP_DATABASE_URL=postgresql+asyncpg://postgres:Bheem924924.@65.109.167.218:5432/erp_staging

# LiveKit
LIVEKIT_API_KEY=BheemMeetAPI
LIVEKIT_API_SECRET=BheemMeet2024SecretKey
LIVEKIT_URL=wss://meet.bheem.cloud

# Mailcow
MAILCOW_API_KEY=BheemMailAPI2024Key
MAILCOW_URL=https://mail.bheem.cloud
MAIL_DOMAIN=bheem.cloud

# Nextcloud
NEXTCLOUD_URL=https://docs.bheem.cloud
NEXTCLOUD_ADMIN_USER=admin
NEXTCLOUD_ADMIN_PASSWORD=<admin_password>

# S3 (Recording storage)
S3_ENDPOINT=https://hel1.your-objectstorage.com
S3_ACCESS_KEY=E8OBSHD5J85G0DQXAACX
S3_SECRET_KEY=O171vuUctulQfPRoz1W4ulfHOan3bXKuztnSgJDV
S3_BUCKET=bheem

# JWT
SECRET_KEY=<generate_secure_key>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

---

## SUCCESS CRITERIA

- [ ] Users can login with ERP credentials
- [ ] Users can create/join meetings with video/audio
- [ ] Users can send/receive emails
- [ ] Users can upload/download/share documents
- [ ] Users can create calendar events with meeting links
- [ ] All data synced to ERP database
- [ ] Multi-tenant isolation working
- [ ] Recording to S3 working

---

**Ready to implement? Start with Phase 1: Authentication!**
