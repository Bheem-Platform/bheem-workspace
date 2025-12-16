# How User Workspace Integration Works

## The Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ERP USER LOGIN                                     │
│                                                                              │
│   User: sundeep@bheem.co.uk                                                 │
│   Password: ********                                                         │
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                    Bheem Workspace Backend                            │  │
│   │                                                                       │  │
│   │   1. Authenticate against ERP (auth.users table)                     │  │
│   │   2. Get user's email from profile                                   │  │
│   │   3. Use email as identifier for all services                        │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     USER'S EMAIL = UNIVERSAL ID                             │
│                                                                              │
│                      sundeep@bheem.co.uk                                    │
│                            │                                                 │
│         ┌──────────────────┼──────────────────┬──────────────────┐          │
│         ▼                  ▼                  ▼                  ▼          │
│   ┌──────────┐      ┌──────────┐       ┌──────────┐       ┌──────────┐     │
│   │  EMAIL   │      │  FILES   │       │ CALENDAR │       │ MEETINGS │     │
│   │ Mailcow  │      │Nextcloud │       │  CalDAV  │       │ LiveKit  │     │
│   └──────────┘      └──────────┘       └──────────┘       └──────────┘     │
│        │                 │                  │                  │            │
│        ▼                 ▼                  ▼                  ▼            │
│   ┌──────────┐      ┌──────────┐       ┌──────────┐       ┌──────────┐     │
│   │  INBOX   │      │  /home/  │       │ Personal │       │  Rooms   │     │
│   │  SENT    │      │  sundeep │       │ Calendar │       │  Tokens  │     │
│   │  DRAFTS  │      │  @bheem  │       │          │       │          │     │
│   │  TRASH   │      │  .co.uk/ │       │          │       │          │     │
│   └──────────┘      └──────────┘       └──────────┘       └──────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Database Connection

```sql
-- ERP User Table (auth.users)
┌─────────────────────────────────────────────────────────────┐
│ id (UUID)         │ a6067626-a8ff-49a7-95dd-1b622b24691b   │
│ username          │ sundeep@bheem.co.uk                     │
│ email             │ sundeep@bheem.co.uk                     │
│ company_id        │ 79f70aef-17eb-48a8-b599-2879721e8796   │
│ person_id         │ (link to contact_management.persons)   │
│ role              │ Employee / Admin / SuperAdmin          │
└─────────────────────────────────────────────────────────────┘
          │
          │ Same email used across all services
          ▼
┌─────────────────────────────────────────────────────────────┐
│                    WORKSPACE SERVICES                        │
├──────────────┬──────────────────────────────────────────────┤
│ Mailcow      │ Mailbox: sundeep@bheem.co.uk                │
│              │ IMAP: mail.bheem.cloud:993                   │
│              │ SMTP: mail.bheem.cloud:465                   │
├──────────────┼──────────────────────────────────────────────┤
│ Nextcloud    │ Username: sundeep@bheem.co.uk               │
│              │ WebDAV: /remote.php/dav/files/sundeep@.../  │
│              │ Files, Shares, Group Folders                 │
├──────────────┼──────────────────────────────────────────────┤
│ CalDAV       │ Calendar: /dav/calendars/sundeep@.../       │
│              │ Personal calendar, shared calendars          │
├──────────────┼──────────────────────────────────────────────┤
│ LiveKit      │ Participant ID: user UUID                    │
│              │ Name: from ERP profile                       │
│              │ JWT token with permissions                   │
└──────────────┴──────────────────────────────────────────────┘
```

## API Endpoints

### 1. Get User's Complete Workspace
```bash
GET /api/v1/workspace/me
Authorization: Bearer <JWT_TOKEN>

Response:
{
  "user": {
    "id": "uuid",
    "email": "sundeep@bheem.co.uk",
    "name": "Sundeep",
    "company": "Bheemverse"
  },
  "workspace": {
    "email": {
      "enabled": true,
      "address": "sundeep@bheem.co.uk",
      "imap_server": "mail.bheem.cloud",
      "webmail_url": "https://mail.bheem.cloud/SOGo"
    },
    "files": {
      "enabled": true,
      "webdav_url": "https://docs.bheem.cloud/remote.php/dav/files/sundeep@bheem.co.uk/"
    },
    "calendar": {
      "enabled": true,
      "caldav_url": "https://docs.bheem.cloud/remote.php/dav/calendars/sundeep@bheem.co.uk/"
    },
    "meetings": {
      "enabled": true,
      "server_url": "wss://meet.bheem.cloud"
    }
  }
}
```

### 2. Get User's Inbox
```bash
GET /api/v1/workspace/email/inbox?password=<EMAIL_PASSWORD>
Authorization: Bearer <JWT_TOKEN>

Response:
{
  "email": "sundeep@bheem.co.uk",
  "folder": "INBOX",
  "count": 25,
  "messages": [
    {
      "id": "123",
      "subject": "Meeting Tomorrow",
      "from": "team@bheem.co.uk",
      "date": "2025-12-09T10:30:00Z",
      "preview": "Hi Sundeep, reminder about..."
    }
  ]
}
```

### 3. Get User's Files
```bash
GET /api/v1/workspace/files?password=<NC_PASSWORD>&path=/Documents
Authorization: Bearer <JWT_TOKEN>

Response:
{
  "path": "/Documents",
  "count": 5,
  "files": [
    {
      "name": "Report.pdf",
      "type": "file",
      "size": 1024000,
      "modified": "2025-12-09T08:00:00Z"
    }
  ]
}
```

### 4. Get Today's Events
```bash
GET /api/v1/workspace/calendar/events?password=<NC_PASSWORD>
Authorization: Bearer <JWT_TOKEN>

Response:
{
  "calendar_id": "personal",
  "count": 3,
  "events": [
    {
      "title": "Team Standup",
      "start": "2025-12-09T09:00:00Z",
      "end": "2025-12-09T09:30:00Z"
    }
  ]
}
```

### 5. Join Meeting
```bash
POST /api/v1/workspace/meeting/token?room_name=daily-standup
Authorization: Bearer <JWT_TOKEN>

Response:
{
  "token": "eyJhbG...",
  "room_name": "daily-standup",
  "server_url": "wss://meet.bheem.cloud",
  "participant": {
    "id": "uuid",
    "name": "Sundeep"
  }
}
```

### 6. Unified Dashboard
```bash
GET /api/v1/workspace/dashboard?password=<PASSWORD>
Authorization: Bearer <JWT_TOKEN>

Response:
{
  "user": {...},
  "summary": {
    "unread_emails": 5,
    "total_files": 42,
    "today_events": 3
  },
  "recent_emails": [...],
  "recent_files": [...],
  "today_events": [...],
  "quick_links": {
    "webmail": "https://mail.bheem.cloud/SOGo",
    "files": "https://docs.bheem.cloud",
    "calendar": "https://docs.bheem.cloud/apps/calendar",
    "meet": "https://workspace.bheem.cloud/meet"
  }
}
```

## User Provisioning Flow

When a new user is added to ERP:

```
1. Admin creates user in ERP
   └── username: john@bheem.co.uk
   └── email: john@bheem.co.uk
   └── company_id: Bheemverse

2. Call provisioning API
   POST /api/v1/workspace/provision
   { "password": "UserPassword123" }

3. System automatically creates:
   ├── Mailbox in Mailcow (john@bheem.co.uk)
   ├── Nextcloud account (john@bheem.co.uk)
   ├── Personal calendar
   └── Access to company shared folders

4. User can now:
   ├── Login to ERP with john@bheem.co.uk
   ├── Access email via webmail or IMAP
   ├── Access files via Nextcloud
   ├── See calendar events
   └── Join/create meetings
```

## Password Management

Currently uses **separate passwords** for each service:
- ERP login password
- Email/Nextcloud password (should be same)

**Recommended**: Use SSO so user logs in once and gets access to all services.

```
User Login (SSO)
      │
      ▼
┌─────────────────────┐
│   Bheem SSO         │
│   (OIDC Provider)   │
└─────────────────────┘
      │
      ├──► ERP Access (JWT token)
      ├──► Nextcloud (OIDC login)
      ├──► Mailcow (credential passthrough)
      └──► LiveKit (JWT token from SSO)
```

## Summary

| Service | Identifier | Access Method |
|---------|------------|---------------|
| ERP | user UUID | JWT Token |
| Email | user's email | IMAP/SMTP with password |
| Files | user's email | WebDAV with password |
| Calendar | user's email | CalDAV with password |
| Meetings | user UUID + name | LiveKit JWT Token |

**The user's email is the key that links everything together!**
