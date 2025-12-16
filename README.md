# Bheem Workspace

Unified Collaboration Platform - Meet, Docs, Mail, Calendar

## Features

### Bheem Meet
- HD Video Conferencing with LiveKit
- Screen sharing and recording
- Up to 100 participants
- Anti-piracy protection for recordings

### Bheem Docs
- Document collaboration via Nextcloud
- Real-time editing with OnlyOffice
- Version history and secure sharing

### Bheem Mail
- Professional email with Mailcow
- Custom domain support
- AI-powered email assistance

### Bheem Calendar
- CalDAV integration
- Meeting scheduling
- Team calendars

## Architecture

```
bheem-workspace/
├── backend/           # FastAPI backend
│   ├── api/          # API routes
│   ├── core/         # Config, database, security
│   ├── services/     # External service integrations
│   ├── agents/       # AI agents
│   └── ai_services/  # AI service integrations
├── frontend/         # Next.js frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── lib/
│   └── public/
├── docker/           # Docker configurations
└── email-templates/  # Email templates
```

## Tech Stack

- **Backend**: FastAPI, SQLAlchemy, PostgreSQL
- **Frontend**: Next.js, React, TailwindCSS
- **Video**: LiveKit
- **Docs**: Nextcloud + OnlyOffice
- **Mail**: Mailcow
- **Calendar**: CalDAV (Radicale/Nextcloud)

## Getting Started

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

See `backend/core/config.py` for required environment variables.

## License

Proprietary - Bheem Platform

---

Part of the [Bheem Platform](https://github.com/Bheem-Platform)
