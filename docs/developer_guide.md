# Bheem Workspace - Developer Services Documentation

**Last Updated:** January 3, 2026

---

## Quick Reference

| Service | URL | Server | Port |
|---------|-----|--------|------|
| **Bheem Meet** | https://meet.bheem.cloud | 37.27.89.140 | 7880 |
| **Bheem Mail** | https://mail.bheem.cloud | 135.181.25.62 | 8880 |
| **Bheem Docs** | https://docs.bheem.cloud | 46.62.165.32 | 8080 |

---

## 1. BHEEM MEET (Video Conferencing)

### Technology
- **Platform:** LiveKit (WebRTC-based)
- **Server:** 37.27.89.140
- **Proxy:** meet.bheem.cloud via Traefik

### Connection Details
```yaml
HTTP URL: https://meet.bheem.cloud
WebSocket URL: wss://meet.bheem.cloud
Direct Server: 37.27.89.140:7880

API_KEY: BheemMeetAPI
API_SECRET: BheemMeet2024SecretKey

Ports:
  - 7880: HTTP/WebSocket (main)
  - 7881: TCP (TURN)
  - 7882: UDP (WebRTC)
  - 50000-50100: UDP (RTC media)
```

### Configuration File
```bash
# Location on LiveKit server
/opt/livekit/livekit.yaml
```

### Generate Access Token (Node.js)
```javascript
const { AccessToken } = require('livekit-server-sdk');

function generateToken(userId, roomName, canPublish = true) {
  const token = new AccessToken('BheemMeetAPI', 'BheemMeet2024SecretKey', {
    identity: userId,
    name: userName, // Display name
  });

  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: canPublish,
    canSubscribe: true,
    canPublishData: true,
  });

  return token.toJwt();
}
```

### Generate Access Token (Python)
```python
from livekit import api
import time

def generate_token(user_id: str, room_name: str, can_publish: bool = True) -> str:
    token = api.AccessToken(
        api_key='BheemMeetAPI',
        api_secret='BheemMeet2024SecretKey'
    )
    token.with_identity(user_id)
    token.with_name(user_id)  # Display name
    token.with_grants(api.VideoGrants(
        room_join=True,
        room=room_name,
        can_publish=can_publish,
        can_subscribe=True,
        can_publish_data=True,
    ))
    token.with_ttl(timedelta(hours=6))

    return token.to_jwt()
```

### Frontend Integration (JavaScript)
```javascript
import { Room, RoomEvent } from 'livekit-client';

const room = new Room();

// Connect to room
await room.connect('wss://meet.bheem.cloud', token);

// Handle events
room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
  if (track.kind === 'video') {
    const element = track.attach();
    document.getElementById('video-container').appendChild(element);
  }
});

// Publish camera/mic
await room.localParticipant.enableCameraAndMicrophone();
```

### API Endpoints (via Workspace Backend)
```bash
# Create meeting room
POST https://workspace.bheem.cloud/api/v1/meet/rooms
Content-Type: application/json
{
  "name": "my-meeting",
  "metadata": {"title": "Team Standup"}
}

# Get join token
POST https://workspace.bheem.cloud/api/v1/meet/token
Content-Type: application/json
{
  "room": "my-meeting",
  "identity": "user-123",
  "name": "John Doe"
}

# List active rooms
GET https://workspace.bheem.cloud/api/v1/meet/rooms

# End meeting
DELETE https://workspace.bheem.cloud/api/v1/meet/rooms/{room_name}
```

### SSH Access
```bash
ssh -i ~/.ssh/sundeep root@37.27.89.140

# View logs
docker logs livekit-server -f

# Restart service
docker restart livekit-server
```

---

## 2. BHEEM MAIL (Email Server)

### Technology
- **Platform:** Mailcow (Docker-based)
- **Server:** 135.181.25.62
- **Admin UI:** https://mail.bheem.cloud

### Connection Details
```yaml
Web Admin: https://mail.bheem.cloud
API Base: https://mail.bheem.cloud/api/v1

API Keys:
  Read/Write: BheemMailAPI2024Key
  Read Only: BheemMailReadOnly2024

IMAP:
  Host: mail.bheem.cloud
  Port: 993 (SSL)

SMTP:
  Host: mail.bheem.cloud
  Port: 587 (STARTTLS)
  Port: 465 (SSL) - may be blocked on some networks

POP3:
  Host: mail.bheem.cloud
  Port: 995 (SSL)
```

### API Authentication
```bash
# All API requests require X-API-Key header
curl -X GET "https://mail.bheem.cloud/api/v1/get/mailbox/all" \
  -H "X-API-Key: BheemMailAPI2024Key"
```

### Common API Endpoints
```bash
# Get all mailboxes
GET /api/v1/get/mailbox/all

# Get specific mailbox
GET /api/v1/get/mailbox/{email}

# Create mailbox
POST /api/v1/add/mailbox
{
  "local_part": "john",
  "domain": "bheem.cloud",
  "password": "SecurePassword123!",
  "name": "John Doe",
  "quota": 1024  // MB
}

# Update mailbox
POST /api/v1/edit/mailbox
{
  "attr": {
    "name": "John Smith"
  },
  "items": ["john@bheem.cloud"]
}

# Delete mailbox
POST /api/v1/delete/mailbox
{
  "items": ["john@bheem.cloud"]
}

# Get domains
GET /api/v1/get/domain/all

# Add domain
POST /api/v1/add/domain
{
  "domain": "example.com"
}

# Get aliases
GET /api/v1/get/alias/all

# Create alias
POST /api/v1/add/alias
{
  "address": "info@bheem.cloud",
  "goto": "admin@bheem.cloud"
}
```

### Python Integration
```python
import requests

class BheemMailClient:
    def __init__(self):
        self.base_url = "https://mail.bheem.cloud/api/v1"
        self.headers = {"X-API-Key": "BheemMailAPI2024Key"}

    def get_mailboxes(self):
        response = requests.get(
            f"{self.base_url}/get/mailbox/all",
            headers=self.headers
        )
        return response.json()

    def create_mailbox(self, email: str, password: str, name: str):
        local_part, domain = email.split("@")
        response = requests.post(
            f"{self.base_url}/add/mailbox",
            headers=self.headers,
            json={
                "local_part": local_part,
                "domain": domain,
                "password": password,
                "name": name,
                "quota": 1024,
                "active": 1
            }
        )
        return response.json()

    def send_email(self, from_email: str, to_email: str, subject: str, body: str):
        # Use SMTP for sending
        import smtplib
        from email.mime.text import MIMEText

        msg = MIMEText(body)
        msg['Subject'] = subject
        msg['From'] = from_email
        msg['To'] = to_email

        with smtplib.SMTP_SSL('mail.bheem.cloud', 465) as server:
            server.login(from_email, 'password')
            server.send_message(msg)
```

### IMAP Integration (Reading Emails)
```python
import imaplib
import email

def get_emails(username: str, password: str, folder: str = "INBOX"):
    mail = imaplib.IMAP4_SSL('mail.bheem.cloud', 993)
    mail.login(username, password)
    mail.select(folder)

    _, messages = mail.search(None, 'ALL')
    emails = []

    for num in messages[0].split()[-10:]:  # Last 10 emails
        _, data = mail.fetch(num, '(RFC822)')
        msg = email.message_from_bytes(data[0][1])
        emails.append({
            'subject': msg['subject'],
            'from': msg['from'],
            'date': msg['date']
        })

    mail.logout()
    return emails
```

### SSH Access
```bash
ssh -i ~/.ssh/sundeep root@135.181.25.62

# View logs
cd /opt/mailcow && docker-compose logs -f

# Restart services
cd /opt/mailcow && docker-compose restart

# Update mailcow
cd /opt/mailcow && ./update.sh
```

### Configuration
```bash
# Main config
/opt/mailcow/mailcow.conf

# Docker compose
/opt/mailcow/docker-compose.yml
```

---

## 3. BHEEM DOCS (Document Storage & Collaboration)

### Technology
- **Platform:** Nextcloud + OnlyOffice
- **Server:** 46.62.165.32
- **Version:** Nextcloud 32.0.2

### Connection Details
```yaml
Web UI: https://docs.bheem.cloud
WebDAV: https://docs.bheem.cloud/remote.php/dav
CalDAV: https://docs.bheem.cloud/remote.php/dav/calendars
CardDAV: https://docs.bheem.cloud/remote.php/dav/addressbooks

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
```

### WebDAV API (File Operations)
```bash
# List files
curl -u "username:password" -X PROPFIND \
  "https://docs.bheem.cloud/remote.php/dav/files/username/"

# Download file
curl -u "username:password" \
  "https://docs.bheem.cloud/remote.php/dav/files/username/path/to/file.pdf" \
  -o file.pdf

# Upload file
curl -u "username:password" -X PUT \
  -T "local-file.pdf" \
  "https://docs.bheem.cloud/remote.php/dav/files/username/Documents/file.pdf"

# Create folder
curl -u "username:password" -X MKCOL \
  "https://docs.bheem.cloud/remote.php/dav/files/username/NewFolder"

# Delete file/folder
curl -u "username:password" -X DELETE \
  "https://docs.bheem.cloud/remote.php/dav/files/username/path/to/delete"

# Move/Rename
curl -u "username:password" -X MOVE \
  -H "Destination: https://docs.bheem.cloud/remote.php/dav/files/username/new-path" \
  "https://docs.bheem.cloud/remote.php/dav/files/username/old-path"
```

### OCS API (Users, Shares, Apps)
```bash
# Get user info
curl -u "admin:password" -H "OCS-APIREQUEST: true" \
  "https://docs.bheem.cloud/ocs/v2.php/cloud/users/username?format=json"

# List users
curl -u "admin:password" -H "OCS-APIREQUEST: true" \
  "https://docs.bheem.cloud/ocs/v2.php/cloud/users?format=json"

# Create user
curl -u "admin:password" -X POST -H "OCS-APIREQUEST: true" \
  -d "userid=newuser&password=userpass&email=user@example.com" \
  "https://docs.bheem.cloud/ocs/v2.php/cloud/users?format=json"

# Create share link
curl -u "username:password" -X POST -H "OCS-APIREQUEST: true" \
  -d "path=/Documents/file.pdf&shareType=3&permissions=1" \
  "https://docs.bheem.cloud/ocs/v2.php/apps/files_sharing/api/v1/shares?format=json"

# Share Types: 0=user, 1=group, 3=public link, 4=email
# Permissions: 1=read, 2=update, 4=create, 8=delete, 16=share, 31=all
```

### CalDAV Integration (Calendar)
```bash
# List calendars
curl -u "username:password" -X PROPFIND \
  "https://docs.bheem.cloud/remote.php/dav/calendars/username/"

# Get calendar events (ICS format)
curl -u "username:password" \
  "https://docs.bheem.cloud/remote.php/dav/calendars/username/personal/?export"

# Create event
curl -u "username:password" -X PUT \
  -H "Content-Type: text/calendar" \
  -d "BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:unique-id-123
DTSTART:20260103T100000Z
DTEND:20260103T110000Z
SUMMARY:Team Meeting
END:VEVENT
END:VCALENDAR" \
  "https://docs.bheem.cloud/remote.php/dav/calendars/username/personal/event-123.ics"
```

### Python Integration
```python
import requests
from requests.auth import HTTPBasicAuth
import xml.etree.ElementTree as ET

class BheemDocsClient:
    def __init__(self, username: str, password: str):
        self.base_url = "https://docs.bheem.cloud"
        self.auth = HTTPBasicAuth(username, password)
        self.dav_url = f"{self.base_url}/remote.php/dav/files/{username}"

    def list_files(self, path: str = "/"):
        response = requests.request(
            "PROPFIND",
            f"{self.dav_url}{path}",
            auth=self.auth,
            headers={"Depth": "1"}
        )
        # Parse XML response
        return response.text

    def upload_file(self, local_path: str, remote_path: str):
        with open(local_path, 'rb') as f:
            response = requests.put(
                f"{self.dav_url}{remote_path}",
                auth=self.auth,
                data=f
            )
        return response.status_code == 201

    def download_file(self, remote_path: str, local_path: str):
        response = requests.get(
            f"{self.dav_url}{remote_path}",
            auth=self.auth
        )
        with open(local_path, 'wb') as f:
            f.write(response.content)
        return True

    def create_share_link(self, path: str, password: str = None):
        data = {
            "path": path,
            "shareType": 3,  # Public link
            "permissions": 1  # Read only
        }
        if password:
            data["password"] = password

        response = requests.post(
            f"{self.base_url}/ocs/v2.php/apps/files_sharing/api/v1/shares",
            auth=self.auth,
            headers={"OCS-APIREQUEST": "true"},
            data=data,
            params={"format": "json"}
        )
        return response.json()
```

### SSH Access
```bash
ssh -i ~/.ssh/sundeep root@46.62.165.32

# View logs
docker logs nextcloud-app -f

# Run occ commands
docker exec -u www-data nextcloud-app php occ [command]

# Examples:
docker exec -u www-data nextcloud-app php occ user:list
docker exec -u www-data nextcloud-app php occ files:scan --all
docker exec -u www-data nextcloud-app php occ maintenance:mode --on
```

### Configuration
```bash
# Nextcloud config
/var/lib/docker/volumes/nextcloud_data/_data/config/config.php

# Docker compose
/opt/nextcloud/docker-compose.yml
```

---

## SSO/OIDC Integration

All services can authenticate via Bheem SSO:

```yaml
Discovery URL: https://workspace.bheem.cloud/.well-known/openid-configuration
Authorization: https://workspace.bheem.cloud/api/v1/sso/authorize
Token: https://workspace.bheem.cloud/api/v1/sso/token
UserInfo: https://workspace.bheem.cloud/api/v1/sso/userinfo

Registered Clients:
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
```

---

## Workspace Backend API

The workspace backend provides unified API access to all services:

```yaml
Base URL: https://workspace.bheem.cloud/api/v1
Health Check: https://workspace.bheem.cloud/health

Endpoints:
  Meet:
    - POST /meet/rooms - Create room
    - GET /meet/rooms - List rooms
    - POST /meet/token - Get join token
    - DELETE /meet/rooms/{name} - End meeting

  Mail:
    - GET /mail/mailboxes - List mailboxes
    - POST /mail/send - Send email
    - GET /mail/inbox - Get inbox

  Docs:
    - GET /docs/files - List files
    - POST /docs/upload - Upload file
    - GET /docs/download/{path} - Download file
    - POST /docs/share - Create share link

  Calendar:
    - GET /calendar/events - List events
    - POST /calendar/events - Create event
    - PUT /calendar/events/{id} - Update event
    - DELETE /calendar/events/{id} - Delete event
```

---

## Troubleshooting

### Meet Issues
```bash
# Check LiveKit status
ssh -i ~/.ssh/sundeep root@37.27.89.140 "docker ps | grep livekit"

# View LiveKit logs
ssh -i ~/.ssh/sundeep root@37.27.89.140 "docker logs livekit-server --tail 100"

# Test WebSocket connection
wscat -c "wss://meet.bheem.cloud"
```

### Mail Issues
```bash
# Check Mailcow status
ssh -i ~/.ssh/sundeep root@135.181.25.62 "cd /opt/mailcow && docker-compose ps"

# Test IMAP connection
openssl s_client -connect mail.bheem.cloud:993

# Test SMTP connection
openssl s_client -connect mail.bheem.cloud:587 -starttls smtp
```

### Docs Issues
```bash
# Check Nextcloud status
ssh -i ~/.ssh/sundeep root@46.62.165.32 "docker ps | grep nextcloud"

# Run maintenance
ssh -i ~/.ssh/sundeep root@46.62.165.32 "docker exec -u www-data nextcloud-app php occ maintenance:repair"

# Check storage
ssh -i ~/.ssh/sundeep root@46.62.165.32 "df -h"
```

---

## Contact

For infrastructure issues, contact the DevOps team.

---

*Part of Bheem Platform - https://github.com/Bheem-Platform*
