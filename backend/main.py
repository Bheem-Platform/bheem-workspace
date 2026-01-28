"""
Bheem Workspace - Unified Collaboration Platform
Meet | Docs | Mail | Admin
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os
import time
import httpx
from dotenv import load_dotenv

load_dotenv()

# Setup structured logging
from core.logging import setup_logging, get_logger, log_request

setup_logging(
    level=os.getenv("LOG_LEVEL", "INFO"),
    json_format=os.getenv("LOG_FORMAT", "json") == "json"
)

logger = get_logger("bheem.workspace.main")

# Next.js server URL for admin pages
NEXTJS_URL = os.getenv("NEXTJS_URL", "http://localhost:3000")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Bheem Workspace starting...", action="app_startup")

    # Initialize email scheduler
    try:
        from services.email_scheduler_service import email_scheduler_service
        from core.database import async_session_maker

        email_scheduler_service.initialize()

        # Load pending scheduled emails
        async with async_session_maker() as db:
            await email_scheduler_service.load_pending_jobs(db)

        logger.info("Email scheduler initialized", action="email_scheduler_started")
    except Exception as e:
        logger.warning(f"Could not initialize email scheduler: {e}", action="email_scheduler_failed")

    # Initialize calendar reminder scheduler
    try:
        from services.calendar_reminder_service import calendar_reminder_service
        from core.database import async_session_maker

        calendar_reminder_service.initialize()

        # Load pending calendar reminders
        async with async_session_maker() as db:
            await calendar_reminder_service.load_pending_reminders(db)

        logger.info("Calendar reminder scheduler initialized", action="calendar_reminder_started")
    except Exception as e:
        logger.warning(f"Could not initialize calendar reminder scheduler: {e}", action="calendar_reminder_failed")

    yield

    # Shutdown email scheduler
    try:
        from services.email_scheduler_service import email_scheduler_service
        email_scheduler_service.shutdown()
        logger.info("Email scheduler stopped", action="email_scheduler_stopped")
    except Exception as e:
        logger.warning(f"Error shutting down email scheduler: {e}", action="email_scheduler_shutdown_error")

    # Shutdown calendar reminder scheduler
    try:
        from services.calendar_reminder_service import calendar_reminder_service
        calendar_reminder_service.shutdown()
        logger.info("Calendar reminder scheduler stopped", action="calendar_reminder_stopped")
    except Exception as e:
        logger.warning(f"Error shutting down calendar reminder scheduler: {e}", action="calendar_reminder_shutdown_error")

    logger.info("Bheem Workspace shutting down...", action="app_shutdown")

app = FastAPI(
    title="Bheem Workspace",
    description="Unified Collaboration Platform - Meet, Docs, Mail, Admin",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api-docs",      # Changed from /docs to avoid conflict with Bheem Docs
    redoc_url="/api-redoc",    # Changed from /redoc
    openapi_url="/api-openapi.json"  # Changed from /openapi.json
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting
try:
    from slowapi.errors import RateLimitExceeded
    from middleware.rate_limit import limiter, rate_limit_exceeded_handler

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
    logger.info("Rate limiting enabled", action="rate_limit_enabled")
except ImportError as e:
    logger.warning(f"Rate limiting not available: {e}", action="rate_limit_disabled")

# Mount static files for branding assets (logos, etc.)
import os as _os
_static_path = _os.path.join(_os.path.dirname(__file__), "static")
if _os.path.exists(_static_path):
    app.mount("/static", StaticFiles(directory=_static_path), name="static")
    logger.info("Static files mounted at /static", action="static_mounted")

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()

    # Skip logging for static files and health checks
    if request.url.path.startswith("/_next") or request.url.path == "/health":
        return await call_next(request)

    response = await call_next(request)

    duration_ms = (time.time() - start_time) * 1000

    # Log API requests
    if request.url.path.startswith("/api/"):
        await log_request(
            request=request,
            response_status=response.status_code,
            duration_ms=duration_ms
        )

    return response

FRONTEND_PATH = "/home/coder/bheem-workspace/frontend/dist"

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "bheem-workspace"}

@app.get("/.well-known/openid-configuration")
async def root_openid_configuration(request: Request):
    """Root-level OIDC Discovery - redirects to API endpoint"""
    from services.sso_service import sso_service
    base_url = str(request.base_url).rstrip("/")
    return sso_service.get_openid_configuration(base_url)

@app.get("/api/v1")
async def api_info():
    return {
        "version": "v1",
        "endpoints": {
            "meet": "/api/v1/meet",
            "docs": "/api/v1/docs",
            "docs_v2": "/api/v1/docs/v2",
            "docs_erp": "/api/v1/docs/erp",
            "mail": "/api/v1/mail",
            "workspace": "/api/v1/workspace",
            "tenants": "/api/v1/tenants",
            "recordings": "/api/v1/recordings",
            "admin": "/api/v1/admin",
            "billing": "/api/v1/billing",
            "erp_sync": "/api/v1/erp-sync",
            "workspace_email": "/api/v1/workspace-email",
            "pm": "/api/v1/pm",
            "drive": "/api/v1/drive",
            "sheets": "/api/v1/sheets",
            "slides": "/api/v1/slides",
            "forms": "/api/v1/forms",
            "workflows": "/api/v1/workflows",
            "appointments": "/api/v1/appointments",
            "dlp": "/api/v1/dlp",
            "devices": "/api/v1/devices",
            "ai": "/api/v1/ai",
            "search": "/api/v1/search"
        }
    }

# Import API routers
try:
    from api.auth import router as auth_router
    app.include_router(auth_router, prefix="/api/v1")
except Exception as e:
    print(f"Could not load auth router: {e}")

try:
    from api.meet import router as meet_router
    app.include_router(meet_router, prefix="/api/v1")
except Exception as e:
    print(f"Could not load meet router: {e}")

try:
    from api.docs import router as docs_router
    app.include_router(docs_router, prefix="/api/v1")
except Exception as e:
    print(f"Could not load docs router: {e}")

try:
    from api.mail import router as mail_router
    app.include_router(mail_router, prefix="/api/v1")
except Exception as e:
    print(f"Could not load mail router: {e}")

try:
    from api.mail_ai import router as mail_ai_router
    app.include_router(mail_ai_router, prefix="/api/v1")
except Exception as e:
    print(f"Could not load mail AI router: {e}")

try:
    from api.mail_2fa import router as mail_2fa_router
    app.include_router(mail_2fa_router, prefix="/api/v1")
except Exception as e:
    print(f"Could not load mail 2FA router: {e}")

try:
    from api.mail_drafts import router as mail_drafts_router
    app.include_router(mail_drafts_router, prefix="/api/v1")
except Exception as e:
    print(f"Could not load mail drafts router: {e}")

try:
    from api.mail_signatures import router as mail_signatures_router
    app.include_router(mail_signatures_router, prefix="/api/v1")
except Exception as e:
    print(f"Could not load mail signatures router: {e}")

try:
    from api.mail_scheduled import router as mail_scheduled_router
    app.include_router(mail_scheduled_router, prefix="/api/v1")
except Exception as e:
    print(f"Could not load mail scheduled router: {e}")

try:
    from api.mail_undo_send import router as mail_undo_send_router
    app.include_router(mail_undo_send_router, prefix="/api/v1")
except Exception as e:
    print(f"Could not load mail undo send router: {e}")

try:
    from api.mail_filters import router as mail_filters_router
    app.include_router(mail_filters_router, prefix="/api/v1")
except Exception as e:
    print(f"Could not load mail filters router: {e}")

try:
    from api.mail_contacts import router as mail_contacts_router
    app.include_router(mail_contacts_router, prefix="/api/v1")
except Exception as e:
    print(f"Could not load mail contacts router: {e}")

try:
    from api.mail_labels import router as mail_labels_router
    app.include_router(mail_labels_router, prefix="/api/v1")
except Exception as e:
    print(f"Could not load mail labels router: {e}")

try:
    from api.mail_templates import router as mail_templates_router
    app.include_router(mail_templates_router, prefix="/api/v1")
except Exception as e:
    print(f"Could not load mail templates router: {e}")

try:
    from api.mail_vacation import router as mail_vacation_router
    app.include_router(mail_vacation_router, prefix="/api/v1")
except Exception as e:
    print(f"Could not load mail vacation router: {e}")

try:
    from api.mail_realtime import router as mail_realtime_router
    app.include_router(mail_realtime_router, prefix="/api/v1")
except Exception as e:
    print(f"Could not load mail realtime router: {e}")

try:
    from api.mail_calendar import router as mail_calendar_router
    app.include_router(mail_calendar_router, prefix="/api/v1")
except Exception as e:
    print(f"Could not load mail calendar router: {e}")

try:
    from api.mail_shared import router as mail_shared_router
    app.include_router(mail_shared_router, prefix="/api/v1")
except Exception as e:
    print(f"Could not load mail shared router: {e}")

try:
    from api.mail_attachments import router as mail_attachments_router
    app.include_router(mail_attachments_router, prefix="/api/v1")
except Exception as e:
    print(f"Could not load mail attachments router: {e}")

try:
    from api.mail_gmail_features import router as mail_gmail_features_router
    app.include_router(mail_gmail_features_router, prefix="/api/v1")
except Exception as e:
    print(f"Could not load mail gmail features router: {e}")

try:
    from api.calendar import router as calendar_router
    app.include_router(calendar_router, prefix="/api/v1")
except Exception as e:
    print(f"Could not load calendar router: {e}")

try:
    from api.calendar_tasks import router as calendar_tasks_router
    app.include_router(calendar_tasks_router, prefix="/api/v1", tags=["Calendar Tasks"])
    logger.info("Calendar Tasks API loaded")
except Exception as e:
    print(f"Could not load calendar tasks router: {e}")

try:
    from api.sso import router as sso_router
    app.include_router(sso_router, prefix="/api/v1")
except Exception as e:
    print(f"Could not load sso router: {e}")

try:
    from api.user_workspace import router as user_workspace_router
    app.include_router(user_workspace_router, prefix="/api/v1")
except Exception as e:
    print(f"Could not load user_workspace router: {e}")

try:
    from api.settings import router as settings_router
    app.include_router(settings_router, prefix="/api/v1/settings")
except Exception as e:
    print(f"Could not load settings router: {e}")

try:
    from api.workspace import router as workspace_router
    app.include_router(workspace_router, prefix="/api/v1/workspace", tags=["Workspace"])
except Exception as e:
    print(f"Could not load workspace router: {e}")

try:
    from api.tenants import router as tenants_router
    app.include_router(tenants_router, prefix="/api/v1/tenants", tags=["Tenants"])
except Exception as e:
    print(f"Could not load tenants router: {e}")

try:
    from api.recordings import router as recordings_router
    app.include_router(recordings_router, prefix="/api/v1/recordings", tags=["Recordings"])
except Exception as e:
    print(f"Could not load recordings router: {e}")

try:
    from api.chat import router as chat_router
    app.include_router(chat_router, prefix="/api/v1", tags=["Meet Chat"])
except Exception as e:
    print(f"Could not load chat router: {e}")

try:
    from api.waiting_room import router as waiting_room_router
    app.include_router(waiting_room_router, prefix="/api/v1", tags=["Waiting Room"])
except Exception as e:
    print(f"Could not load waiting_room router: {e}")

try:
    from api.admin import router as admin_router
    app.include_router(admin_router, prefix="/api/v1/admin", tags=["Admin"])
except Exception as e:
    print(f"Could not load admin router: {e}")

try:
    from api.health import router as health_router
    app.include_router(health_router, prefix="/api/v1", tags=["Health"])
except Exception as e:
    print(f"Could not load health router: {e}")

try:
    from api.docs_admin import router as docs_admin_router
    app.include_router(docs_admin_router, prefix="/api/v1/admin", tags=["Docs Admin"])
except Exception as e:
    print(f"Could not load docs_admin router: {e}")

try:
    from api.reporting import router as reporting_router
    app.include_router(reporting_router, prefix="/api/v1/admin", tags=["Reporting"])
except Exception as e:
    print(f"Could not load reporting router: {e}")

# ERP Integration routes
try:
    from api.billing import router as billing_router
    app.include_router(billing_router, prefix="/api/v1", tags=["Billing"])
except Exception as e:
    print(f"Could not load billing router: {e}")

try:
    from api.erp_sync import router as erp_sync_router
    app.include_router(erp_sync_router, prefix="/api/v1", tags=["ERP Sync"])
except Exception as e:
    print(f"Could not load erp_sync router: {e}")

try:
    from api.workspace_email import router as workspace_email_router
    app.include_router(workspace_email_router, prefix="/api/v1", tags=["Workspace Email"])
except Exception as e:
    print(f"Could not load workspace_email router: {e}")

# Project Management (ERP PM Module Integration)
try:
    from api.pm import router as pm_router
    app.include_router(pm_router, prefix="/api/v1", tags=["Project Management"])
    logger.info("Project Management API loaded", action="pm_loaded")
except Exception as e:
    print(f"Could not load pm router: {e}")

# Bheem Docs v2 API (ERP DMS Integration)
try:
    from api.docs_v2 import router as docs_v2_router
    app.include_router(docs_v2_router, prefix="/api/v1", tags=["Bheem Docs v2"])
    logger.info("Bheem Docs v2 API loaded", action="docs_v2_loaded")
except Exception as e:
    print(f"Could not load docs_v2 router: {e}")

# Bheem Docs ERP Integration API (Entity Document Links)
try:
    from api.docs_erp import router as docs_erp_router
    app.include_router(docs_erp_router, prefix="/api/v1", tags=["Bheem Docs ERP"])
    logger.info("Bheem Docs ERP API loaded", action="docs_erp_loaded")
except Exception as e:
    print(f"Could not load docs_erp router: {e}")

# Bheem Docs Editor & Templates API
try:
    from api.docs_editor import router as docs_editor_router
    app.include_router(docs_editor_router, prefix="/api/v1", tags=["Bheem Docs Editor"])
    logger.info("Bheem Docs Editor API loaded", action="docs_editor_loaded")
except Exception as e:
    print(f"Could not load docs_editor router: {e}")

# Bheem Docs Comments & Annotations API
try:
    from api.docs_comments import router as docs_comments_router
    app.include_router(docs_comments_router, prefix="/api/v1", tags=["Bheem Docs Comments"])
    logger.info("Bheem Docs Comments API loaded", action="docs_comments_loaded")
except Exception as e:
    print(f"Could not load docs_comments router: {e}")

# Bheem Docs WebSocket Collaboration API
try:
    from api.docs_websocket import router as docs_websocket_router
    app.include_router(docs_websocket_router, prefix="/api/v1", tags=["Bheem Docs Collaboration"])
    logger.info("Bheem Docs WebSocket API loaded", action="docs_websocket_loaded")
except Exception as e:
    print(f"Could not load docs_websocket router: {e}")

# Bheem Docs Workflow & Approval API
try:
    from api.docs_workflow import router as docs_workflow_router
    app.include_router(docs_workflow_router, prefix="/api/v1", tags=["Bheem Docs Workflow"])
    logger.info("Bheem Docs Workflow API loaded", action="docs_workflow_loaded")
except Exception as e:
    print(f"Could not load docs_workflow router: {e}")

# Bheem Docs Enterprise API (Audit, eSignature)
try:
    from api.docs_enterprise import router as docs_enterprise_router
    app.include_router(docs_enterprise_router, prefix="/api/v1", tags=["Bheem Docs Enterprise"])
    logger.info("Bheem Docs Enterprise API loaded", action="docs_enterprise_loaded")
except Exception as e:
    print(f"Could not load docs_enterprise router: {e}")

# Bheem Docs AI API (Summarization, Smart Search, Analysis)
try:
    from api.docs_ai import router as docs_ai_router
    app.include_router(docs_ai_router, prefix="/api/v1", tags=["Bheem Docs AI"])
    logger.info("Bheem Docs AI API loaded", action="docs_ai_loaded")
except Exception as e:
    print(f"Could not load docs_ai router: {e}")

# Team Chat API (Mattermost Integration)
try:
    from api.team_chat import router as team_chat_router
    app.include_router(team_chat_router, prefix="/api/v1", tags=["Team Chat"])
    logger.info("Team Chat API loaded", action="team_chat_loaded")
except Exception as e:
    print(f"Could not load team_chat router: {e}")

# Onboarding API
try:
    from api.onboarding import router as onboarding_router
    app.include_router(onboarding_router, prefix="/api/v1", tags=["Onboarding"])
    logger.info("Onboarding API loaded", action="onboarding_loaded")
except Exception as e:
    print(f"Could not load onboarding router: {e}")

# User Workspace API
try:
    from api.user_workspace import router as user_workspace_router
    app.include_router(user_workspace_router, prefix="/api/v1", tags=["User Workspace"])
    logger.info("User Workspace API loaded", action="user_workspace_loaded")
except Exception as e:
    print(f"Could not load user_workspace router: {e}")

# Resource Booking API
try:
    from api.resources import router as resources_router
    app.include_router(resources_router, prefix="/api/v1", tags=["Resource Booking"])
    logger.info("Resource Booking API loaded", action="resources_loaded")
except Exception as e:
    print(f"Could not load resources router: {e}")

# Security API
try:
    from api.security import router as security_router
    app.include_router(security_router, prefix="/api/v1", tags=["Security"])
    logger.info("Security API loaded", action="security_loaded")
except Exception as e:
    print(f"Could not load security router: {e}")

# Data Migration API
try:
    from api.migration import router as migration_router
    app.include_router(migration_router, prefix="/api/v1", tags=["Data Migration"])
    logger.info("Migration API loaded", action="migration_loaded")
except Exception as e:
    print(f"Could not load migration router: {e}")

# One-Click Migration API (Google Workspace / Microsoft 365)
try:
    from api.migration_v2 import router as migration_v2_router
    app.include_router(migration_v2_router, prefix="/api/v1", tags=["One-Click Migration"])
    logger.info("One-Click Migration API loaded", action="migration_v2_loaded")
except Exception as e:
    print(f"Could not load migration_v2 router: {e}")

# Bulk Import API
try:
    from api.bulk_import import router as bulk_import_router
    app.include_router(bulk_import_router, prefix="/api/v1", tags=["Bulk Import"])
    logger.info("Bulk Import API loaded", action="bulk_import_loaded")
except Exception as e:
    print(f"Could not load bulk_import router: {e}")

# Organizational Units API
try:
    from api.org_units import router as org_units_router
    app.include_router(org_units_router, prefix="/api/v1", tags=["Organizational Units"])
    logger.info("Org Units API loaded", action="org_units_loaded")
except Exception as e:
    print(f"Could not load org_units router: {e}")

# User Groups API
try:
    from api.user_groups import router as user_groups_router
    app.include_router(user_groups_router, prefix="/api/v1", tags=["User Groups"])
    logger.info("User Groups API loaded", action="user_groups_loaded")
except Exception as e:
    print(f"Could not load user_groups router: {e}")

# Admin Roles API
try:
    from api.admin_roles import router as admin_roles_router
    app.include_router(admin_roles_router, prefix="/api/v1", tags=["Admin Roles"])
    logger.info("Admin Roles API loaded", action="admin_roles_loaded")
except Exception as e:
    print(f"Could not load admin_roles router: {e}")

# Domain Aliases API
try:
    from api.domain_aliases import router as domain_aliases_router
    app.include_router(domain_aliases_router, prefix="/api/v1", tags=["Domain Aliases"])
    logger.info("Domain Aliases API loaded", action="domain_aliases_loaded")
except Exception as e:
    print(f"Could not load domain_aliases router: {e}")

# SSO Configuration API
try:
    from api.sso_config import router as sso_config_router
    app.include_router(sso_config_router, prefix="/api/v1", tags=["SSO Configuration"])
    logger.info("SSO Config API loaded", action="sso_config_loaded")
except Exception as e:
    print(f"Could not load sso_config router: {e}")

# =============================================
# Phase 2: Productivity Suite APIs
# =============================================

# Bheem Sheets API (Spreadsheets)
try:
    from api.sheets import router as sheets_router
    app.include_router(sheets_router, prefix="/api/v1", tags=["Bheem Sheets"])
    logger.info("Bheem Sheets API loaded", action="sheets_loaded")
except Exception as e:
    print(f"Could not load sheets router: {e}")

# Bheem Slides API (Presentations)
try:
    from api.slides import router as slides_router
    app.include_router(slides_router, prefix="/api/v1", tags=["Bheem Slides"])
    logger.info("Bheem Slides API loaded", action="slides_loaded")
except Exception as e:
    print(f"Could not load slides router: {e}")

# Bheem Forms API (Forms & Surveys)
try:
    from api.forms import router as forms_router
    app.include_router(forms_router, prefix="/api/v1", tags=["Bheem Forms"])
    logger.info("Bheem Forms API loaded", action="forms_loaded")
except Exception as e:
    print(f"Could not load forms router: {e}")

# Bheem OForms API (OnlyOffice Document Forms)
try:
    from api.oforms import router as oforms_router
    app.include_router(oforms_router, prefix="/api/v1", tags=["Bheem OForms"])
    logger.info("Bheem OForms API loaded", action="oforms_loaded")
except Exception as e:
    print(f"Could not load oforms router: {e}")

# =============================================
# Phase 3: Drive, Workflows, Meet Enhancements, Appointments
# =============================================

# Bheem Drive API (File Storage & Management)
try:
    from api.drive import router as drive_router
    app.include_router(drive_router, prefix="/api/v1", tags=["Bheem Drive"])
    logger.info("Bheem Drive API loaded", action="drive_loaded")
except Exception as e:
    print(f"Could not load drive router: {e}")

# Bheem Flows API (Workflow Automation)
try:
    from api.workflows import router as workflows_router
    app.include_router(workflows_router, prefix="/api/v1", tags=["Bheem Flows"])
    logger.info("Bheem Flows API loaded", action="workflows_loaded")
except Exception as e:
    print(f"Could not load workflows router: {e}")

# Bheem Meet Enhancements API (Breakout Rooms, Polls, Q&A, Whiteboard)
try:
    from api.meet_enhancements import router as meet_enhancements_router
    app.include_router(meet_enhancements_router, prefix="/api/v1", tags=["Bheem Meet Enhancements"])
    logger.info("Bheem Meet Enhancements API loaded", action="meet_enhancements_loaded")
except Exception as e:
    print(f"Could not load meet_enhancements router: {e}")

# Bheem Appointments API (Calendly-like Scheduling)
try:
    from api.appointments import router as appointments_router
    app.include_router(appointments_router, prefix="/api/v1", tags=["Bheem Appointments"])
    logger.info("Bheem Appointments API loaded", action="appointments_loaded")
except Exception as e:
    print(f"Could not load appointments router: {e}")

# =============================================
# Phase 4: Enterprise Features (DLP, Devices, AI, Search)
# =============================================

# DLP (Data Loss Prevention) API
try:
    from api.dlp import router as dlp_router
    app.include_router(dlp_router, prefix="/api/v1", tags=["DLP"])
    logger.info("DLP API loaded", action="dlp_loaded")
except Exception as e:
    print(f"Could not load dlp router: {e}")

# Device Management API
try:
    from api.devices import router as devices_router
    app.include_router(devices_router, prefix="/api/v1", tags=["Devices"])
    logger.info("Devices API loaded", action="devices_loaded")
except Exception as e:
    print(f"Could not load devices router: {e}")

# AI Assistant API
try:
    from api.ai import router as ai_router
    app.include_router(ai_router, prefix="/api/v1", tags=["AI"])
    logger.info("AI API loaded", action="ai_loaded")
except Exception as e:
    print(f"Could not load ai router: {e}")

# Enterprise Search API
try:
    from api.search import router as search_router
    app.include_router(search_router, prefix="/api/v1", tags=["Search"])
    logger.info("Search API loaded", action="search_loaded")
except Exception as e:
    print(f"Could not load search router: {e}")

# =============================================
# Phase 5: Unified Productivity & Videos
# =============================================

# Bheem Videos API
try:
    from api.videos import router as videos_router
    app.include_router(videos_router, prefix="/api/v1", tags=["Bheem Videos"])
    logger.info("Bheem Videos API loaded", action="videos_loaded")
except Exception as e:
    print(f"Could not load videos router: {e}")

# Unified Productivity API (Home view for all doc types)
try:
    from api.productivity_unified import router as productivity_unified_router
    app.include_router(productivity_unified_router, prefix="/api/v1", tags=["Unified Productivity"])
    logger.info("Unified Productivity API loaded", action="productivity_unified_loaded")
except Exception as e:
    print(f"Could not load productivity_unified router: {e}")

# Frontend routes - Proxy homepage to Next.js server
@app.api_route("/", methods=["GET"])
async def homepage(request: Request):
    """Proxy homepage to Next.js server"""
    target_url = NEXTJS_URL

    if request.query_params:
        target_url += f"?{request.query_params}"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(target_url, timeout=30.0)
            return StreamingResponse(
                iter([response.content]),
                status_code=response.status_code,
                headers={k: v for k, v in response.headers.items() if k.lower() not in ['content-encoding', 'transfer-encoding', 'content-length']},
                media_type=response.headers.get('content-type', 'text/html')
            )
        except httpx.RequestError as e:
            return HTMLResponse(content=f"<h1>Service unavailable</h1><p>{str(e)}</p>", status_code=503)

@app.api_route("/login", methods=["GET", "POST"])
async def login_proxy(request: Request):
    """Proxy login page to Next.js server"""
    target_url = f"{NEXTJS_URL}/login"

    # Add query params
    if request.query_params:
        target_url += f"?{request.query_params}"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.request(
                method=request.method,
                url=target_url,
                headers={k: v for k, v in request.headers.items() if k.lower() not in ['host', 'content-length']},
                content=await request.body() if request.method == "POST" else None,
                timeout=30.0
            )

            return StreamingResponse(
                iter([response.content]),
                status_code=response.status_code,
                headers={k: v for k, v in response.headers.items() if k.lower() not in ['content-encoding', 'transfer-encoding', 'content-length']},
                media_type=response.headers.get('content-type', 'text/html')
            )
        except httpx.RequestError as e:
            return HTMLResponse(content=f"<h1>Login service unavailable</h1><p>{str(e)}</p>", status_code=503)

# Dashboard - Proxy to Next.js server
@app.api_route("/dashboard", methods=["GET"])
async def dashboard_proxy(request: Request):
    """Proxy dashboard to Next.js server"""
    target_url = f"{NEXTJS_URL}/dashboard"

    if request.query_params:
        target_url += f"?{request.query_params}"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(target_url, timeout=30.0)
            return StreamingResponse(
                iter([response.content]),
                status_code=response.status_code,
                headers={k: v for k, v in response.headers.items() if k.lower() not in ['content-encoding', 'transfer-encoding', 'content-length']},
                media_type=response.headers.get('content-type', 'text/html')
            )
        except httpx.RequestError as e:
            return HTMLResponse(content=f"<h1>Dashboard unavailable</h1><p>{str(e)}</p>", status_code=503)

# Bheem Meet - Proxy to Next.js server
@app.api_route("/meet", methods=["GET"])
async def meet_page(request: Request):
    """Proxy meet page to Next.js server"""
    target_url = f"{NEXTJS_URL}/meet"

    if request.query_params:
        target_url += f"?{request.query_params}"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(target_url, timeout=30.0)
            return StreamingResponse(
                iter([response.content]),
                status_code=response.status_code,
                headers={k: v for k, v in response.headers.items() if k.lower() not in ['content-encoding', 'transfer-encoding', 'content-length']},
                media_type=response.headers.get('content-type', 'text/html')
            )
        except httpx.RequestError as e:
            return HTMLResponse(content=f"<h1>Meet service unavailable</h1><p>{str(e)}</p>", status_code=503)

# Meeting room - Proxy to Next.js server
@app.api_route("/meet/room/{room_name}", methods=["GET"])
async def meet_room(request: Request, room_name: str):
    """Proxy meet room to Next.js server"""
    target_url = f"{NEXTJS_URL}/meet/room/{room_name}"

    if request.query_params:
        target_url += f"?{request.query_params}"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(target_url, timeout=30.0)
            return StreamingResponse(
                iter([response.content]),
                status_code=response.status_code,
                headers={k: v for k, v in response.headers.items() if k.lower() not in ['content-encoding', 'transfer-encoding', 'content-length']},
                media_type=response.headers.get('content-type', 'text/html')
            )
        except httpx.RequestError as e:
            return HTMLResponse(content=f"<h1>Meet room unavailable</h1><p>{str(e)}</p>", status_code=503)

# Meet recordings - Proxy to Next.js server
@app.api_route("/meet/recordings", methods=["GET"])
async def meet_recordings(request: Request):
    """Proxy meet recordings to Next.js server"""
    target_url = f"{NEXTJS_URL}/meet/recordings"

    if request.query_params:
        target_url += f"?{request.query_params}"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(target_url, timeout=30.0)
            return StreamingResponse(
                iter([response.content]),
                status_code=response.status_code,
                headers={k: v for k, v in response.headers.items() if k.lower() not in ['content-encoding', 'transfer-encoding', 'content-length']},
                media_type=response.headers.get('content-type', 'text/html')
            )
        except httpx.RequestError as e:
            return HTMLResponse(content=f"<h1>Recordings unavailable</h1><p>{str(e)}</p>", status_code=503)

# Bheem Mail - Proxy to Next.js server
@app.api_route("/mail/{path:path}", methods=["GET"])
@app.api_route("/mail", methods=["GET"])
async def mail_proxy(request: Request, path: str = ""):
    """Proxy mail routes to Next.js server"""
    target_url = f"{NEXTJS_URL}/mail/{path}" if path else f"{NEXTJS_URL}/mail"

    if request.query_params:
        target_url += f"?{request.query_params}"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(target_url, timeout=30.0)
            return StreamingResponse(
                iter([response.content]),
                status_code=response.status_code,
                headers={k: v for k, v in response.headers.items() if k.lower() not in ['content-encoding', 'transfer-encoding', 'content-length']},
                media_type=response.headers.get('content-type', 'text/html')
            )
        except httpx.RequestError as e:
            return HTMLResponse(content=f"<h1>Mail service unavailable</h1><p>{str(e)}</p>", status_code=503)

# Bheem Docs - Proxy to Next.js server
@app.api_route("/docs/{path:path}", methods=["GET"])
@app.api_route("/docs", methods=["GET"])
async def docs_proxy(request: Request, path: str = ""):
    """Proxy docs routes to Next.js server"""
    target_url = f"{NEXTJS_URL}/docs/{path}" if path else f"{NEXTJS_URL}/docs"

    if request.query_params:
        target_url += f"?{request.query_params}"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(target_url, timeout=30.0)
            return StreamingResponse(
                iter([response.content]),
                status_code=response.status_code,
                headers={k: v for k, v in response.headers.items() if k.lower() not in ['content-encoding', 'transfer-encoding', 'content-length']},
                media_type=response.headers.get('content-type', 'text/html')
            )
        except httpx.RequestError as e:
            return HTMLResponse(content=f"<h1>Docs service unavailable</h1><p>{str(e)}</p>", status_code=503)

# Recordings - Proxy to Next.js server (redirects to /meet/recordings)
@app.api_route("/recordings", methods=["GET"])
async def recordings_proxy(request: Request):
    """Proxy recordings to Next.js server"""
    target_url = f"{NEXTJS_URL}/meet/recordings"

    if request.query_params:
        target_url += f"?{request.query_params}"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(target_url, timeout=30.0)
            return StreamingResponse(
                iter([response.content]),
                status_code=response.status_code,
                headers={k: v for k, v in response.headers.items() if k.lower() not in ['content-encoding', 'transfer-encoding', 'content-length']},
                media_type=response.headers.get('content-type', 'text/html')
            )
        except httpx.RequestError as e:
            return HTMLResponse(content=f"<h1>Recordings unavailable</h1><p>{str(e)}</p>", status_code=503)

# Admin - Proxy to Next.js server
@app.api_route("/admin/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
@app.api_route("/admin", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def admin_proxy(request: Request, path: str = ""):
    """Proxy admin routes to Next.js server"""
    target_url = f"{NEXTJS_URL}/admin/{path}" if path else f"{NEXTJS_URL}/admin"

    # Add query params
    if request.query_params:
        target_url += f"?{request.query_params}"

    async with httpx.AsyncClient() as client:
        try:
            # Forward the request
            response = await client.request(
                method=request.method,
                url=target_url,
                headers={k: v for k, v in request.headers.items() if k.lower() not in ['host', 'content-length']},
                content=await request.body() if request.method in ["POST", "PUT", "PATCH"] else None,
                timeout=30.0
            )

            # Return the response
            return StreamingResponse(
                iter([response.content]),
                status_code=response.status_code,
                headers={k: v for k, v in response.headers.items() if k.lower() not in ['content-encoding', 'transfer-encoding', 'content-length']},
                media_type=response.headers.get('content-type', 'text/html')
            )
        except httpx.RequestError as e:
            return HTMLResponse(content=f"<h1>Admin service unavailable</h1><p>{str(e)}</p>", status_code=503)

# Proxy Next.js static files (_next)
@app.api_route("/_next/{path:path}", methods=["GET"])
async def nextjs_static_proxy(request: Request, path: str):
    """Proxy Next.js static files"""
    target_url = f"{NEXTJS_URL}/_next/{path}"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(target_url, timeout=30.0)
            return StreamingResponse(
                iter([response.content]),
                status_code=response.status_code,
                headers={k: v for k, v in response.headers.items() if k.lower() not in ['content-encoding', 'transfer-encoding', 'content-length']},
                media_type=response.headers.get('content-type')
            )
        except httpx.RequestError:
            return HTMLResponse(content="Static file not found", status_code=404)

# Super Admin - Proxy to Next.js server
@app.api_route("/super-admin/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
@app.api_route("/super-admin", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def super_admin_proxy(request: Request, path: str = ""):
    """Proxy super-admin routes to Next.js server"""
    target_url = f"{NEXTJS_URL}/super-admin/{path}" if path else f"{NEXTJS_URL}/super-admin"

    if request.query_params:
        target_url += f"?{request.query_params}"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.request(
                method=request.method,
                url=target_url,
                headers={k: v for k, v in request.headers.items() if k.lower() not in ['host', 'content-length']},
                content=await request.body() if request.method in ["POST", "PUT", "PATCH"] else None,
                timeout=30.0
            )

            return StreamingResponse(
                iter([response.content]),
                status_code=response.status_code,
                headers={k: v for k, v in response.headers.items() if k.lower() not in ['content-encoding', 'transfer-encoding', 'content-length']},
                media_type=response.headers.get('content-type', 'text/html')
            )
        except httpx.RequestError as e:
            return HTMLResponse(content=f"<h1>Admin service unavailable</h1><p>{str(e)}</p>", status_code=503)

@app.get("/team", response_class=HTMLResponse)
async def team_page():
    path = os.path.join(FRONTEND_PATH, "dashboard.html")
    if os.path.exists(path):
        with open(path, "r") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>Team</h1>")

# Bheem Settings - Proxy to Next.js server
@app.api_route("/settings/{path:path}", methods=["GET"])
@app.api_route("/settings", methods=["GET"])
async def settings_proxy(request: Request, path: str = ""):
    """Proxy settings routes to Next.js server"""
    target_url = f"{NEXTJS_URL}/settings/{path}" if path else f"{NEXTJS_URL}/settings"

    if request.query_params:
        target_url += f"?{request.query_params}"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(target_url, timeout=30.0)
            return StreamingResponse(
                iter([response.content]),
                status_code=response.status_code,
                headers={k: v for k, v in response.headers.items() if k.lower() not in ['content-encoding', 'transfer-encoding', 'content-length']},
                media_type=response.headers.get('content-type', 'text/html')
            )
        except httpx.RequestError as e:
            return HTMLResponse(content=f"<h1>Settings service unavailable</h1><p>{str(e)}</p>", status_code=503)

# Bheem Calendar - Proxy to Next.js server
@app.api_route("/calendar/{path:path}", methods=["GET"])
@app.api_route("/calendar", methods=["GET"])
async def calendar_proxy(request: Request, path: str = ""):
    """Proxy calendar routes to Next.js server"""
    target_url = f"{NEXTJS_URL}/calendar/{path}" if path else f"{NEXTJS_URL}/calendar"

    if request.query_params:
        target_url += f"?{request.query_params}"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(target_url, timeout=30.0)
            return StreamingResponse(
                iter([response.content]),
                status_code=response.status_code,
                headers={k: v for k, v in response.headers.items() if k.lower() not in ['content-encoding', 'transfer-encoding', 'content-length']},
                media_type=response.headers.get('content-type', 'text/html')
            )
        except httpx.RequestError as e:
            return HTMLResponse(content=f"<h1>Calendar service unavailable</h1><p>{str(e)}</p>", status_code=503)

# Bheem Drive - Proxy to Next.js server
@app.api_route("/drive/{path:path}", methods=["GET"])
@app.api_route("/drive", methods=["GET"])
async def drive_proxy(request: Request, path: str = ""):
    """Proxy drive routes to Next.js server"""
    target_url = f"{NEXTJS_URL}/drive/{path}" if path else f"{NEXTJS_URL}/drive"

    if request.query_params:
        target_url += f"?{request.query_params}"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(target_url, timeout=30.0)
            return StreamingResponse(
                iter([response.content]),
                status_code=response.status_code,
                headers={k: v for k, v in response.headers.items() if k.lower() not in ['content-encoding', 'transfer-encoding', 'content-length']},
                media_type=response.headers.get('content-type', 'text/html')
            )
        except httpx.RequestError as e:
            return HTMLResponse(content=f"<h1>Drive service unavailable</h1><p>{str(e)}</p>", status_code=503)

# Bheem Sheets - Proxy to Next.js server
@app.api_route("/sheets/{path:path}", methods=["GET"])
@app.api_route("/sheets", methods=["GET"])
async def sheets_proxy(request: Request, path: str = ""):
    """Proxy sheets routes to Next.js server"""
    target_url = f"{NEXTJS_URL}/sheets/{path}" if path else f"{NEXTJS_URL}/sheets"

    if request.query_params:
        target_url += f"?{request.query_params}"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(target_url, timeout=30.0)
            return StreamingResponse(
                iter([response.content]),
                status_code=response.status_code,
                headers={k: v for k, v in response.headers.items() if k.lower() not in ['content-encoding', 'transfer-encoding', 'content-length']},
                media_type=response.headers.get('content-type', 'text/html')
            )
        except httpx.RequestError as e:
            return HTMLResponse(content=f"<h1>Sheets service unavailable</h1><p>{str(e)}</p>", status_code=503)

# Bheem Slides - Proxy to Next.js server
@app.api_route("/slides/{path:path}", methods=["GET"])
@app.api_route("/slides", methods=["GET"])
async def slides_proxy(request: Request, path: str = ""):
    """Proxy slides routes to Next.js server"""
    target_url = f"{NEXTJS_URL}/slides/{path}" if path else f"{NEXTJS_URL}/slides"

    if request.query_params:
        target_url += f"?{request.query_params}"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(target_url, timeout=30.0)
            return StreamingResponse(
                iter([response.content]),
                status_code=response.status_code,
                headers={k: v for k, v in response.headers.items() if k.lower() not in ['content-encoding', 'transfer-encoding', 'content-length']},
                media_type=response.headers.get('content-type', 'text/html')
            )
        except httpx.RequestError as e:
            return HTMLResponse(content=f"<h1>Slides service unavailable</h1><p>{str(e)}</p>", status_code=503)

# Bheem Forms - Proxy to Next.js server
@app.api_route("/forms/{path:path}", methods=["GET"])
@app.api_route("/forms", methods=["GET"])
async def forms_proxy(request: Request, path: str = ""):
    """Proxy forms routes to Next.js server"""
    target_url = f"{NEXTJS_URL}/forms/{path}" if path else f"{NEXTJS_URL}/forms"

    if request.query_params:
        target_url += f"?{request.query_params}"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(target_url, timeout=30.0)
            return StreamingResponse(
                iter([response.content]),
                status_code=response.status_code,
                headers={k: v for k, v in response.headers.items() if k.lower() not in ['content-encoding', 'transfer-encoding', 'content-length']},
                media_type=response.headers.get('content-type', 'text/html')
            )
        except httpx.RequestError as e:
            return HTMLResponse(content=f"<h1>Forms service unavailable</h1><p>{str(e)}</p>", status_code=503)

# Bheem OForms - Proxy to Next.js server
@app.api_route("/oforms/{path:path}", methods=["GET"])
@app.api_route("/oforms", methods=["GET"])
async def oforms_proxy(request: Request, path: str = ""):
    """Proxy oforms routes to Next.js server"""
    target_url = f"{NEXTJS_URL}/oforms/{path}" if path else f"{NEXTJS_URL}/oforms"

    if request.query_params:
        target_url += f"?{request.query_params}"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(target_url, timeout=30.0)
            return StreamingResponse(
                iter([response.content]),
                status_code=response.status_code,
                headers={k: v for k, v in response.headers.items() if k.lower() not in ['content-encoding', 'transfer-encoding', 'content-length']},
                media_type=response.headers.get('content-type', 'text/html')
            )
        except httpx.RequestError as e:
            return HTMLResponse(content=f"<h1>OForms service unavailable</h1><p>{str(e)}</p>", status_code=503)

# Bheem Videos - Proxy to Next.js server
@app.api_route("/videos/{path:path}", methods=["GET"])
@app.api_route("/videos", methods=["GET"])
async def videos_proxy(request: Request, path: str = ""):
    """Proxy videos routes to Next.js server"""
    target_url = f"{NEXTJS_URL}/videos/{path}" if path else f"{NEXTJS_URL}/videos"

    if request.query_params:
        target_url += f"?{request.query_params}"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(target_url, timeout=30.0)
            return StreamingResponse(
                iter([response.content]),
                status_code=response.status_code,
                headers={k: v for k, v in response.headers.items() if k.lower() not in ['content-encoding', 'transfer-encoding', 'content-length']},
                media_type=response.headers.get('content-type', 'text/html')
            )
        except httpx.RequestError as e:
            return HTMLResponse(content=f"<h1>Videos service unavailable</h1><p>{str(e)}</p>", status_code=503)

# Bheem Booking Pages - Proxy to Next.js server
@app.api_route("/book/{path:path}", methods=["GET"])
@app.api_route("/book", methods=["GET"])
async def book_proxy(request: Request, path: str = ""):
    """Proxy booking pages to Next.js server"""
    target_url = f"{NEXTJS_URL}/book/{path}" if path else f"{NEXTJS_URL}/book"

    if request.query_params:
        target_url += f"?{request.query_params}"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(target_url, timeout=30.0)
            return StreamingResponse(
                iter([response.content]),
                status_code=response.status_code,
                headers={k: v for k, v in response.headers.items() if k.lower() not in ['content-encoding', 'transfer-encoding', 'content-length']},
                media_type=response.headers.get('content-type', 'text/html')
            )
        except httpx.RequestError as e:
            return HTMLResponse(content=f"<h1>Booking service unavailable</h1><p>{str(e)}</p>", status_code=503)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
