# BHEEM WORKSPACE - PROJECT MEMORY

**Last Updated:** December 9, 2025
**Status:** Services Deployed, SSO Implemented, Backend APIs Ready

---

## INFRASTRUCTURE OVERVIEW

### Servers

| Server | IP | Purpose |
|--------|-----|---------|
| **Main/Proxy** | `37.27.40.113` | Traefik proxy, Bheem Cloud, Workspace Frontend |
| **LiveKit** | `37.27.89.140` | Video conferencing (Bheem Meet) |
| **Mailcow** | `135.181.25.62` | Email server (Bheem Mail) |
| **Nextcloud** | `46.62.165.32` | Document storage & Calendar (Bheem Docs) |
| **App Servers** | `65.108.12.171` | Kodee IDE, Apps |
| **Database** | `65.109.167.218` | PostgreSQL (ERP, Bheem Cloud) |

---

## SERVICE CREDENTIALS

### 1. LiveKit (Bheem Meet)
```yaml
URL: https://meet.bheem.cloud
WebSocket: wss://meet.bheem.cloud
Server: 37.27.89.140:7880
API_KEY: BheemMeetAPI
API_SECRET: BheemMeet2024SecretKey
Config: /opt/livekit/livekit.yaml

Settings:
  - Port: 7880
  - RTC Ports: 50000-50100
  - TCP Port: 7881
  - Max Participants: 100
  - Empty Timeout: 300s
  - Auto Create Rooms: true
```

### 2. Mailcow (Bheem Mail)
```yaml
URL: https://mail.bheem.cloud
Server: 135.181.25.62:8880
API_KEY: BheemMailAPI2024Key
API_KEY_READ_ONLY: BheemMailReadOnly2024
Config: /opt/mailcow/mailcow.conf

Database:
  Password: BheemMail2024DB!

Redis:
  Password: BheemRedis2024!

Admin Email: admin@bheem.cloud
```

### 3. Nextcloud (Bheem Docs & Calendar)
```yaml
URL: https://docs.bheem.cloud
Server: 46.62.165.32:8080
Container: nextcloud-app
Version: 32.0.2

Database:
  Type: MySQL
  Host: nextcloud-db
  Name: nextcloud
  User: nextcloud
  Password: BheemDocs2024!

S3 Storage:
  Bucket: bheem
  Region: hel1
  Hostname: hel1.your-objectstorage.com
  Key: E8OBSHD5J85G0DQXAACX
  Secret: O171vuUctulQfPRoz1W4ulfHOan3bXKuztnSgJDV

Instance ID: ocxewk5t330c
Secret: eXjdNePNkl1w/CPuLPyKaOovFoWsePT5PJcQOCy/oZxuqKrH
```

### 4. OnlyOffice (Document Editor)
```yaml
Server: 46.62.165.32
Container: onlyoffice
Integrated with Nextcloud
```

---

## BHEEM WORKSPACE URLS

| App | URL | Backend |
|-----|-----|---------|
| **Workspace Home** | https://workspace.bheem.cloud | FastAPI :8500 |
| **Bheem Meet** | https://workspace.bheem.cloud/meet | LiveKit |
| **Bheem Mail** | https://workspace.bheem.cloud/mail | Mailcow |
| **Bheem Docs** | https://workspace.bheem.cloud/docs-app | Nextcloud |
| **Bheem Calendar** | https://workspace.bheem.cloud/calendar | Nextcloud CalDAV |

---

## WORKSPACE BACKEND

### Location
```
Server: 37.27.40.113
Path: /root/bheem-workspace/backend/
Port: 8500
```

### Main Files
```
main.py          - FastAPI app with routes
api/meet.py      - Meeting API (LiveKit integration)
api/docs.py      - Document API (Nextcloud integration)
api/mail.py      - Mail API (Mailcow integration)
api/calendar.py  - Calendar API (Nextcloud CalDAV)
api/workspace.py - Workspace management
api/tenants.py   - Multi-tenant support
api/admin.py     - Admin functions
```

### Frontend Files
```
Path: /root/bheem-workspace/frontend/dist/
- index.html
- dashboard.html
- bheem-meet.html
- bheem-mail.html
- bheem-docs.html
- bheem-calendar.html
- meeting-room.html
- admin.html
```

---

## SSO/OIDC CONFIGURATION

### Bheem SSO Provider
```yaml
Discovery URL: https://workspace.bheem.cloud/.well-known/openid-configuration
Authorization: /api/v1/sso/authorize
Token: /api/v1/sso/token
UserInfo: /api/v1/sso/userinfo
```

### Registered OIDC Clients
```yaml
Bheem Docs:
  client_id: bheem-docs
  client_secret: BheemDocsSecret2024
  redirect_uri: https://docs.bheem.cloud/apps/user_oidc/code

Bheem Mail:
  client_id: bheem-mail
  client_secret: BheemMailSecret2024
  redirect_uri: https://mail.bheem.cloud/sso/callback

Bheem Meet:
  client_id: bheem-meet
  client_secret: BheemMeetSecret2024
  redirect_uri: https://workspace.bheem.cloud/meet/callback

Bheem Workspace:
  client_id: bheem-workspace
  client_secret: BheemWorkspaceSecret2024
  redirect_uri: https://workspace.bheem.cloud/callback
```

### Nextcloud OIDC Provider Configured
```bash
Provider: Bheem SSO
Client ID: bheem-docs
Discovery URI: https://workspace.bheem.cloud/.well-known/openid-configuration
```

---

## ERP INTEGRATION (Bheem Core)

### Database: erp_staging @ 65.109.167.218

| Schema | Purpose |
|--------|---------|
| `auth` | Users, authentication |
| `dms` | Document Management System |
| `project_management` | Projects, tasks, calendar events, meeting rooms |
| `hr` | Employees, attendance |
| `accounting` | Invoices, payments |
| `crm` | Contacts, opportunities |
| `sales` | Orders, customers |

### Key Tables for Workspace
```sql
-- Calendar Events
project_management.pm_calendar_events

-- Meeting Rooms
project_management.pm_meeting_rooms
project_management.pm_room_bookings

-- Documents
dms.documents
dms.folders
dms.document_versions

-- Users
auth.users
```

---

## API ENDPOINTS

### Nextcloud API
```bash
# List files
curl -u "admin:password" "https://docs.bheem.cloud/remote.php/dav/files/admin/"

# CalDAV Calendar
curl -u "admin:password" "https://docs.bheem.cloud/remote.php/dav/calendars/admin/"

# OCS API
curl -u "admin:password" -H "OCS-APIREQUEST: true" \
  "https://docs.bheem.cloud/ocs/v2.php/cloud/users?format=json"
```

### Mailcow API
```bash
# Get mailboxes
curl -X GET "https://mail.bheem.cloud/api/v1/get/mailbox/all" \
  -H "X-API-Key: BheemMailAPI2024Key"

# Create mailbox
curl -X POST "https://mail.bheem.cloud/api/v1/add/mailbox" \
  -H "X-API-Key: BheemMailAPI2024Key" \
  -H "Content-Type: application/json" \
  -d '{"local_part":"user","domain":"bheem.cloud","password":"secret"}'
```

### LiveKit API
```javascript
// Generate token (Node.js)
const { AccessToken } = require('livekit-server-sdk');

const token = new AccessToken('BheemMeetAPI', 'BheemMeet2024SecretKey', {
  identity: 'user-id',
});
token.addGrant({ roomJoin: true, room: 'room-name' });
const jwt = token.toJwt();
```

---

## DOCKER COMPOSE (Planned)

```yaml
# /root/bheem-workspace/docker/docker-compose.yml
services:
  workspace-api:
    environment:
      - LIVEKIT_API_KEY=BheemMeetAPI
      - LIVEKIT_API_SECRET=BheemMeet2024SecretKey
      - LIVEKIT_URL=wss://meet.bheem.cloud
      - NEXTCLOUD_URL=https://docs.bheem.cloud
      - MAILCOW_URL=https://mail.bheem.cloud
      - MAILCOW_API_KEY=BheemMailAPI2024Key
```

---

## SSH ACCESS

```bash
# Main server
ssh -i /root/.ssh/sundeep root@37.27.40.113

# LiveKit server
ssh -i /root/.ssh/sundeep root@37.27.89.140

# Mailcow server
ssh -i /root/.ssh/sundeep root@135.181.25.62

# Nextcloud server
ssh -i /root/.ssh/sundeep root@46.62.165.32

# App server
ssh -i /root/.ssh/sundeep root@65.108.12.171

# Database server
PGPASSWORD='Bheem924924.@' psql -h 65.109.167.218 -U postgres
```

---

## CURRENT STATUS

### Completed
- [x] LiveKit server deployed
- [x] Mailcow server deployed
- [x] Nextcloud server deployed (with OnlyOffice)
- [x] Workspace frontend UI created
- [x] Bheem Meet UI (meeting creation, room joining)
- [x] Bheem Mail UI (webmail interface)
- [x] Bheem Docs UI (document manager)
- [x] Bheem Calendar UI (calendar with events)
- [x] Traefik routing configured
- [x] Backend API services implemented
- [x] SSO/OIDC provider implemented
- [x] Nextcloud OIDC SSO configured
- [x] Bheem branding applied to all services

### Pending
- [ ] Frontend SSO login integration
- [ ] Recording sync to S3
- [ ] Multi-tenant workspace support

---

## QUICK COMMANDS

```bash
# Restart Workspace backend
ssh -i /root/.ssh/sundeep root@37.27.40.113 "pkill -f 'uvicorn.*8500'; cd /root/bheem-workspace/backend && nohup python3 -m uvicorn main:app --host 0.0.0.0 --port 8500 > /var/log/bheem-workspace.log 2>&1 &"

# Check workspace health
curl https://workspace.bheem.cloud/health

# Upload frontend file
scp -i /root/.ssh/sundeep /tmp/file.html root@37.27.40.113:/root/bheem-workspace/frontend/dist/

# View logs
ssh -i /root/.ssh/sundeep root@37.27.40.113 "tail -f /var/log/bheem-workspace.log"
```

---

## RELATED DOCUMENTATION

- `/root/bheem-platform/` on socialselling.ai - Bheem Core ERP
- `/root/bheem-cloud/` on 37.27.40.113 - Bheem Cloud PaaS
- `/opt/livekit/livekit.yaml` on 37.27.89.140 - LiveKit config
- `/opt/mailcow/mailcow.conf` on 135.181.25.62 - Mailcow config

---

**Remember:** This is the single source of truth for Bheem Workspace infrastructure!
