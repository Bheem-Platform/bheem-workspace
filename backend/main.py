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
            "workspace_email": "/api/v1/workspace-email"
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
    from api.calendar import router as calendar_router
    app.include_router(calendar_router, prefix="/api/v1")
except Exception as e:
    print(f"Could not load calendar router: {e}")

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

# Frontend routes
@app.get("/", response_class=HTMLResponse)
async def homepage():
    path = os.path.join(FRONTEND_PATH, "index.html")
    if os.path.exists(path):
        with open(path, "r") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>Bheem Workspace</h1>")

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

@app.get("/settings", response_class=HTMLResponse)
async def settings_page():
    path = os.path.join(FRONTEND_PATH, "dashboard.html")
    if os.path.exists(path):
        with open(path, "r") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>Settings</h1>")

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
