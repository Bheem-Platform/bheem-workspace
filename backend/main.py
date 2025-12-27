"""
Bheem Workspace - Unified Collaboration Platform
Meet | Docs | Mail | Admin
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Bheem Workspace starting...")
    yield
    print("Bheem Workspace shutting down...")

app = FastAPI(
    title="Bheem Workspace",
    description="Unified Collaboration Platform - Meet, Docs, Mail, Admin",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_PATH = "/root/bheem-workspace/frontend/dist"

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
            "mail": "/api/v1/mail",
            "workspace": "/api/v1/workspace",
            "tenants": "/api/v1/tenants",
            "recordings": "/api/v1/recordings",
            "admin": "/api/v1/admin"
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
    from api.admin import router as admin_router
    app.include_router(admin_router, prefix="/api/v1/admin", tags=["Admin"])
except Exception as e:
    print(f"Could not load admin router: {e}")

# Frontend routes
@app.get("/", response_class=HTMLResponse)
async def homepage():
    path = os.path.join(FRONTEND_PATH, "index.html")
    if os.path.exists(path):
        with open(path, "r") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>Bheem Workspace</h1>")

@app.get("/login", response_class=HTMLResponse)
async def login_page():
    path = os.path.join(FRONTEND_PATH, "login.html")
    if os.path.exists(path):
        with open(path, "r") as f:
            return HTMLResponse(content=f.read())
    # Redirect to Bheem Passport if no login page
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="https://platform.bheem.co.uk/login?redirect=https://workspace.bheem.cloud/dashboard")

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard():
    path = os.path.join(FRONTEND_PATH, "dashboard.html")
    if os.path.exists(path):
        with open(path, "r") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>Dashboard</h1>")

# Bheem Meet - Main page with meeting creation
@app.get("/meet", response_class=HTMLResponse)
async def meet_page():
    path = os.path.join(FRONTEND_PATH, "bheem-meet.html")
    if os.path.exists(path):
        with open(path, "r") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>Bheem Meet</h1>")

# Meeting room - for joining meetings via link
@app.get("/meet/room/{room_name}", response_class=HTMLResponse)
async def meet_room(room_name: str):
    path = os.path.join(FRONTEND_PATH, "meeting-room.html")
    if os.path.exists(path):
        with open(path, "r") as f:
            content = f.read()
            content = content.replace("{{ROOM_NAME}}", room_name)
            return HTMLResponse(content=content)
    return HTMLResponse(content=f"<h1>Meeting Room: {room_name}</h1>")

# Bheem Mail
@app.get("/mail", response_class=HTMLResponse)
async def mail_page():
    path = os.path.join(FRONTEND_PATH, "bheem-mail.html")
    if os.path.exists(path):
        with open(path, "r") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>Bheem Mail</h1>")

# Bheem Docs
@app.get("/docs-app", response_class=HTMLResponse)
async def docs_app():
    path = os.path.join(FRONTEND_PATH, "bheem-docs.html")
    if os.path.exists(path):
        with open(path, "r") as f:
            return HTMLResponse(content=f.read())
    path = os.path.join(FRONTEND_PATH, "dashboard.html")
    if os.path.exists(path):
        with open(path, "r") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>Bheem Docs</h1>")

# Recordings
@app.get("/recordings", response_class=HTMLResponse)
async def recordings_page():
    path = os.path.join(FRONTEND_PATH, "bheem-meet.html")
    if os.path.exists(path):
        with open(path, "r") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>Recordings</h1>")

# Admin
@app.get("/admin", response_class=HTMLResponse)
async def admin_page():
    path = os.path.join(FRONTEND_PATH, "admin.html")
    if os.path.exists(path):
        with open(path, "r") as f:
            return HTMLResponse(content=f.read())
    path = os.path.join(FRONTEND_PATH, "dashboard.html")
    if os.path.exists(path):
        with open(path, "r") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>Admin</h1>")

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

# Bheem Calendar
@app.get("/calendar", response_class=HTMLResponse)
async def calendar_page():
    path = os.path.join(FRONTEND_PATH, "bheem-calendar.html")
    if os.path.exists(path):
        with open(path, "r") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>Bheem Calendar</h1>")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8500)
