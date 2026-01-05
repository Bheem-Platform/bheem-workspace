# LiveKit Egress Setup for Bheem Meet Recording

## Overview

LiveKit Egress is a service that captures video from LiveKit rooms and saves them as recording files. It works by running a headless Chrome browser that joins the room and records the composite video.

## Prerequisites

- Docker and Docker Compose installed
- LiveKit server running (you're using `wss://meet.bheem.cloud`)
- At least 4GB RAM (Egress uses Chrome headless)
- Port 6379 available for Redis

## Quick Setup

### 1. Navigate to docker directory

```bash
cd /home/coder/bheem-workspace/docker
```

### 2. Create the recordings directory

```bash
sudo mkdir -p /tmp/bheem-recordings
sudo chmod 777 /tmp/bheem-recordings
```

### 3. Update the Egress config with your credentials

Edit `egress-config.yaml` and update:

```yaml
# Must match your LiveKit server credentials
api_key: BheemMeetAPI
api_secret: BheemMeet2024SecretKey

# Your LiveKit server URL
ws_url: wss://meet.bheem.cloud
```

### 4. Start Egress service

```bash
docker-compose -f docker-compose.egress.yml up -d
```

### 5. Check if it's running

```bash
docker logs bheem-egress -f
```

You should see:
```
starting egress service
egress starting
```

## Verify Setup

### Check Egress health:

```bash
curl http://localhost:9090/health
```

### Test recording (from backend):

```bash
curl -X POST http://localhost:8000/api/v1/recordings/start \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"room_code": "bhm-xxx-yyy"}'
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Bheem Meet     │────▶│  LiveKit Server │◀────│  Egress Service │
│  Frontend       │     │  (meet.bheem)   │     │  (Chrome)       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │  Recording File │
                                               │  /tmp/bheem-    │
                                               │  recordings/    │
                                               └─────────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │  Nextcloud      │
                                               │  (Bheem Docs)   │
                                               └─────────────────┘
```

## How Recording Works

1. User clicks "Start Recording" in Bheem Meet
2. Backend creates a recording entry in database
3. Backend calls LiveKit Egress API to start capturing
4. Egress service joins the room with a headless Chrome
5. Chrome captures the composite video and saves to `/tmp/bheem-recordings/`
6. When user clicks "Stop Recording":
   - Egress stops capturing
   - Backend picks up the MP4 file
   - Backend uploads to Nextcloud (Bheem Docs)
   - Recording status updated to "completed"

## Troubleshooting

### Egress not connecting to LiveKit

Check if Egress can reach your LiveKit server:

```bash
docker exec bheem-egress curl -v https://meet.bheem.cloud
```

### Recording file not created

1. Check Egress logs:
```bash
docker logs bheem-egress
```

2. Check the recordings directory:
```bash
ls -la /tmp/bheem-recordings/
```

3. Make sure the directory is mounted correctly:
```bash
docker exec bheem-egress ls -la /tmp/recordings/
```

### Redis connection issues

```bash
docker exec bheem-egress-redis redis-cli ping
# Should return: PONG
```

## LiveKit Cloud Option

If you're using LiveKit Cloud instead of self-hosted:

1. Go to https://cloud.livekit.io
2. Navigate to your project settings
3. Enable "Egress" feature
4. No need to run the Egress Docker container

LiveKit Cloud handles recording automatically and provides S3/GCS storage options.

## Resource Requirements

| Component | CPU | RAM | Disk |
|-----------|-----|-----|------|
| Egress | 2+ cores | 2GB+ | 10GB+ |
| Redis | 0.5 cores | 256MB | 1GB |

## Security Notes

- Egress needs `SYS_ADMIN` capability for Chrome sandbox
- Use `shm_size: 2gb` to prevent Chrome crashes
- Recording files are temporarily stored in `/tmp` - ensure cleanup
