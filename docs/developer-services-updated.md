# Bheem Workspace - Developer Services Documentation

**Last Updated:** January 5, 2026

---

## Quick Reference

| Service | URL | Server | Port |
|---------|-----|--------|------|
| **Bheem Meet** | https://meet.bheem.cloud | 37.27.89.140 | 7880 |
| **Bheem Meet Egress** | (internal) | 37.27.89.140 | 9090 |
| **Bheem Mail** | https://mail.bheem.cloud | 135.181.25.62 | 8880 |
| **Bheem Docs** | https://docs.bheem.cloud | 46.62.165.32 | 8080 |
| **Bheem Workspace** | https://workspace.bheem.cloud | - | 8000/3000 |

---

## 1. BHEEM MEET (Video Conferencing)

### Technology
- **Platform:** LiveKit (WebRTC-based)
- **Recording:** LiveKit Egress
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
  - 9090: Egress Health Check
  - 50000-50100: UDP (RTC media)
```

### Recording Setup (LiveKit Egress)

Egress captures meeting video and saves to Bheem Docs (Nextcloud).

#### Architecture
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Bheem Meet     │────▶│  LiveKit Server │◀────│  Egress Service │
│  Frontend       │     │  37.27.89.140   │     │  (Chrome)       │
└─────────────────┘     └────────┬────────┘     └────────┬────────┘
                                 │                       │
                                 └───────┬───────────────┘
                                         │ Redis
                                         ▼
                                ┌─────────────────┐
                                │  Recording MP4  │
                                │  /opt/livekit/  │
                                │  recordings/    │
                                └────────┬────────┘
                                         │
                                         ▼
                                ┌─────────────────┐
                                │  Bheem Docs     │
                                │  (Nextcloud)    │
                                └─────────────────┘
```

#### Deploy Egress on LiveKit Server

```bash
# SSH to LiveKit server
ssh -i ~/.ssh/sundeep root@37.27.89.140

# Create directories
mkdir -p /opt/livekit/recordings
chmod 777 /opt/livekit/recordings

# Copy config files (from bheem-workspace repo)
cd /opt/livekit

# Create livekit.yaml
cat > livekit.yaml << 'EOF'
port: 7880
bind_addresses:
  - ""

rtc:
  port_range_start: 50000
  port_range_end: 50100
  tcp_port: 7881
  use_external_ip: true

redis:
  address: redis:6379

keys:
  BheemMeetAPI: BheemMeet2024SecretKey

logging:
  level: info

room:
  auto_create: true
  empty_timeout: 300
  max_participants: 100
EOF

# Create egress.yaml
cat > egress.yaml << 'EOF'
log_level: info
api_key: BheemMeetAPI
api_secret: BheemMeet2024SecretKey
ws_url: ws://livekit:7880

redis:
  address: redis:6379

file_output:
  local: true

health_port: 9090
EOF

# Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    container_name: livekit-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - livekit

  livekit:
    image: livekit/livekit-server:latest
    container_name: livekit-server
    restart: unless-stopped
    ports:
      - "7880:7880"
      - "7881:7881"
      - "7882:7882/udp"
      - "50000-50100:50000-50100/udp"
    volumes:
      - ./livekit.yaml:/etc/livekit.yaml:ro
    command: --config /etc/livekit.yaml
    networks:
      - livekit
    depends_on:
      - redis

  egress:
    image: livekit/egress:latest
    container_name: livekit-egress
    restart: unless-stopped
    environment:
      - EGRESS_CONFIG_FILE=/etc/egress.yaml
    ports:
      - "9090:9090"
    volumes:
      - ./egress.yaml:/etc/egress.yaml:ro
      - ./recordings:/tmp/recordings
    cap_add:
      - SYS_ADMIN
    shm_size: 2gb
    networks:
      - livekit
    depends_on:
      - redis
      - livekit

networks:
  livekit:
    driver: bridge

volumes:
  redis-data:
EOF

# Start all services
docker-compose down
docker-compose up -d

# Verify
docker-compose ps
docker logs livekit-egress -f
```

#### Verify Egress is Running

```bash
# Check health
curl http://37.27.89.140:9090/health

# Check logs
docker logs livekit-egress --tail 50
```

#### Test Recording

1. Open https://workspace.bheem.cloud/meet
2. Create a new meeting
3. Click "Start Recording" (host only)
4. Talk for 10-15 seconds
5. Click "Stop Recording"
6. Go to https://workspace.bheem.cloud/meet/recordings
7. Recording should appear with status "completed"

### Configuration File Location
```bash
# On LiveKit server (37.27.89.140)
/opt/livekit/livekit.yaml    # LiveKit config
/opt/livekit/egress.yaml     # Egress config
/opt/livekit/recordings/     # Temporary recordings
```

### Generate Access Token (Python)
```python
from livekit import api
from datetime import timedelta

def generate_token(user_id: str, room_name: str, is_host: bool = False) -> str:
    token = api.AccessToken(
        api_key='BheemMeetAPI',
        api_secret='BheemMeet2024SecretKey'
    )
    token.with_identity(user_id)
    token.with_name(user_id)

    grants = api.VideoGrants(
        room_join=True,
        room=room_name,
        can_publish=True,
        can_subscribe=True,
        can_publish_data=True,
        can_update_own_metadata=True,
    )

    if is_host:
        grants.room_admin = True
        grants.room_record = True  # Required for recording

    token.with_grants(grants)
    token.with_ttl(timedelta(hours=6))

    return token.to_jwt()
```

### Recording API Endpoints
```bash
# Start recording (host only)
POST https://workspace.bheem.cloud/api/v1/recordings/start
Content-Type: application/json
Authorization: Bearer {token}
{
  "room_code": "bhm-xxx-yyy",
  "layout": "grid",
  "resolution": "1080p"
}

# Stop recording
POST https://workspace.bheem.cloud/api/v1/recordings/{recording_id}/stop
Authorization: Bearer {token}

# List recordings
GET https://workspace.bheem.cloud/api/v1/recordings
Authorization: Bearer {token}

# Get recording status
GET https://workspace.bheem.cloud/api/v1/recordings/{recording_id}/status
Authorization: Bearer {token}

# Delete recording
DELETE https://workspace.bheem.cloud/api/v1/recordings/{recording_id}
Authorization: Bearer {token}

# Fix stuck recordings
POST https://workspace.bheem.cloud/api/v1/recordings/fix-stuck
Authorization: Bearer {token}
```

### SSH Access
```bash
ssh -i ~/.ssh/sundeep root@37.27.89.140

# View LiveKit logs
docker logs livekit-server -f

# View Egress logs
docker logs livekit-egress -f

# Restart all services
cd /opt/livekit && docker-compose restart

# Check recordings
ls -la /opt/livekit/recordings/
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
  Port: 465 (SSL)

POP3:
  Host: mail.bheem.cloud
  Port: 995 (SSL)
```

### API Authentication
```bash
curl -X GET "https://mail.bheem.cloud/api/v1/get/mailbox/all" \
  -H "X-API-Key: BheemMailAPI2024Key"
```

### SSH Access
```bash
ssh -i ~/.ssh/sundeep root@135.181.25.62

# View logs
cd /opt/mailcow && docker-compose logs -f

# Restart services
cd /opt/mailcow && docker-compose restart
```

---

## 3. BHEEM DOCS (Document Storage)

### Technology
- **Platform:** Nextcloud + OnlyOffice
- **Server:** 46.62.165.32
- **Version:** Nextcloud 32.0.2

### Connection Details
```yaml
Web UI: https://docs.bheem.cloud
WebDAV: https://docs.bheem.cloud/remote.php/dav

S3 Storage:
  Bucket: bheem
  Region: hel1
  Hostname: hel1.your-objectstorage.com
```

### Recording Storage

Recordings from Bheem Meet are saved to:
```
/Bheem Meet Recordings/{room_code}/{recording_id}.mp4
```

### SSH Access
```bash
ssh -i ~/.ssh/sundeep root@46.62.165.32

# View logs
docker logs nextcloud-app -f
```

---

## Troubleshooting

### Recording Not Working

1. **Check Egress is running:**
```bash
ssh -i ~/.ssh/sundeep root@37.27.89.140
docker ps | grep egress
docker logs livekit-egress --tail 50
```

2. **Check Redis connection:**
```bash
docker exec livekit-redis redis-cli ping
# Should return: PONG
```

3. **Check recordings directory:**
```bash
ls -la /opt/livekit/recordings/
```

4. **Fix stuck recordings:**
```bash
curl -X POST https://workspace.bheem.cloud/api/v1/recordings/fix-stuck \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Recording Status Meanings

| Status | Meaning |
|--------|---------|
| `recording` | Egress is actively capturing |
| `processing` | Recording stopped, uploading to Nextcloud |
| `completed` | Recording available for playback |
| `failed` | Error occurred (check logs) |

---

## Quick Commands

```bash
# LiveKit Server (37.27.89.140)
ssh -i ~/.ssh/sundeep root@37.27.89.140
cd /opt/livekit
docker-compose ps
docker-compose logs -f
docker-compose restart

# Mail Server (135.181.25.62)
ssh -i ~/.ssh/sundeep root@135.181.25.62
cd /opt/mailcow
docker-compose ps

# Docs Server (46.62.165.32)
ssh -i ~/.ssh/sundeep root@46.62.165.32
docker logs nextcloud-app -f
```

---

*Part of Bheem Platform - https://github.com/Bheem-Platform*
