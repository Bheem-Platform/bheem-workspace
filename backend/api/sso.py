"""
Bheem Workspace - SSO API
OAuth2/OIDC Provider endpoints for Single Sign-On
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request, Form, Query
from fastapi.responses import RedirectResponse, HTMLResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import secrets
import hashlib

from core.database import get_db
from core.security import verify_password, get_current_user
from services.sso_service import sso_service

router = APIRouter(prefix="/sso", tags=["SSO/OIDC"])


# OIDC Discovery endpoint
@router.get("/.well-known/openid-configuration")
async def openid_configuration(request: Request):
    """OpenID Connect Discovery Document"""
    base_url = str(request.base_url).rstrip("/")
    return sso_service.get_openid_configuration(base_url)


# JWKS endpoint (simplified - in production use RS256 with proper key management)
@router.get("/.well-known/jwks.json")
async def jwks():
    """JSON Web Key Set"""
    return {
        "keys": [
            {
                "kty": "oct",
                "use": "sig",
                "alg": "HS256",
                "kid": "bheem-sso-key-1"
            }
        ]
    }


# SSO Session Cookie name
SSO_SESSION_COOKIE = "bheem_sso_session"


# Authorization endpoint
@router.get("/authorize")
async def authorize(
    request: Request,
    client_id: str,
    redirect_uri: str,
    response_type: str = "code",
    scope: str = "openid profile email",
    state: Optional[str] = None,
    nonce: Optional[str] = None,
    code_challenge: Optional[str] = None,
    code_challenge_method: Optional[str] = None
):
    """OAuth2/OIDC Authorization endpoint - checks session first, then displays login form"""
    # Validate client
    client = sso_service.get_client(client_id)
    if not client:
        raise HTTPException(status_code=400, detail="Invalid client_id")

    if redirect_uri not in client["redirect_uris"]:
        raise HTTPException(status_code=400, detail="Invalid redirect_uri")

    # ═══════════════════════════════════════════════════════════════════
    # CHECK FOR EXISTING SSO SESSION - Skip login if already authenticated
    # ═══════════════════════════════════════════════════════════════════
    session_id = request.cookies.get(SSO_SESSION_COOKIE)
    if session_id:
        session_data = sso_service.validate_session(session_id)
        if session_data:
            # User already authenticated - generate auth code and redirect immediately
            code = sso_service.generate_authorization_code(
                user_id=session_data["user_id"],
                client_id=client_id,
                redirect_uri=redirect_uri,
                scope=scope,
                code_challenge=code_challenge if code_challenge else None,
                code_challenge_method=code_challenge_method if code_challenge_method else None
            )

            # Build redirect URL
            redirect_params = f"code={code}"
            if state:
                redirect_params += f"&state={state}"

            separator = "&" if "?" in redirect_uri else "?"

            # Extend session (sliding expiration)
            sso_service.extend_session(session_id)

            return RedirectResponse(url=f"{redirect_uri}{separator}{redirect_params}", status_code=302)

    # Return login form
    login_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Bheem SSO - Sign In</title>
        <style>
            * {{ margin: 0; padding: 0; box-sizing: border-box; }}
            body {{
                font-family: 'Segoe UI', system-ui, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
            }}
            .login-container {{
                background: white;
                padding: 40px;
                border-radius: 16px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                width: 100%;
                max-width: 400px;
            }}
            .logo {{
                text-align: center;
                margin-bottom: 30px;
            }}
            .logo h1 {{
                color: #667eea;
                font-size: 28px;
                font-weight: 700;
            }}
            .logo p {{
                color: #666;
                margin-top: 5px;
            }}
            .form-group {{
                margin-bottom: 20px;
            }}
            label {{
                display: block;
                margin-bottom: 8px;
                color: #333;
                font-weight: 500;
            }}
            input {{
                width: 100%;
                padding: 12px 16px;
                border: 2px solid #e1e1e1;
                border-radius: 8px;
                font-size: 16px;
                transition: border-color 0.2s;
            }}
            input:focus {{
                outline: none;
                border-color: #667eea;
            }}
            button {{
                width: 100%;
                padding: 14px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: transform 0.2s, box-shadow 0.2s;
            }}
            button:hover {{
                transform: translateY(-2px);
                box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
            }}
            .client-info {{
                text-align: center;
                margin-top: 20px;
                padding-top: 20px;
                border-top: 1px solid #eee;
                color: #888;
                font-size: 14px;
            }}
            .error {{
                background: #fee2e2;
                color: #dc2626;
                padding: 12px;
                border-radius: 8px;
                margin-bottom: 20px;
                display: none;
            }}
        </style>
    </head>
    <body>
        <div class="login-container">
            <div class="logo">
                <h1>Bheem</h1>
                <p>Single Sign-On</p>
            </div>
            <div class="error" id="error"></div>
            <form method="POST" action="/api/v1/sso/authorize/submit">
                <input type="hidden" name="client_id" value="{client_id}">
                <input type="hidden" name="redirect_uri" value="{redirect_uri}">
                <input type="hidden" name="response_type" value="{response_type}">
                <input type="hidden" name="scope" value="{scope}">
                <input type="hidden" name="state" value="{state or ''}">
                <input type="hidden" name="nonce" value="{nonce or ''}">
                <input type="hidden" name="code_challenge" value="{code_challenge or ''}">
                <input type="hidden" name="code_challenge_method" value="{code_challenge_method or ''}">

                <div class="form-group">
                    <label for="username">Username or Email</label>
                    <input type="text" id="username" name="username" required autofocus>
                </div>
                <div class="form-group">
                    <label for="password">Password</label>
                    <input type="password" id="password" name="password" required>
                </div>
                <button type="submit">Sign In</button>
            </form>
            <div class="client-info">
                Signing in to <strong>{client['name']}</strong>
            </div>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=login_html)


@router.post("/authorize/submit")
async def authorize_submit(
    username: str = Form(...),
    password: str = Form(...),
    client_id: str = Form(...),
    redirect_uri: str = Form(...),
    response_type: str = Form("code"),
    scope: str = Form("openid profile email"),
    state: str = Form(""),
    nonce: str = Form(""),
    code_challenge: str = Form(""),
    code_challenge_method: str = Form(""),
    db: AsyncSession = Depends(get_db)
):
    """Process authorization form submission"""
    # Authenticate user against ERP database
    result = await db.execute(text("""
        SELECT id, username, email, password_hash, person_id, company_id, role, is_active
        FROM auth.users
        WHERE (username = :username OR email = :username) AND is_active = true
    """), {"username": username})

    user = result.fetchone()

    if not user or not verify_password(password, user.password_hash):
        # Return to login with error
        return RedirectResponse(
            url=f"/api/v1/sso/authorize?client_id={client_id}&redirect_uri={redirect_uri}&response_type={response_type}&scope={scope}&state={state}&error=invalid_credentials",
            status_code=302
        )

    # Get user's full name from person table
    name_result = await db.execute(text("""
        SELECT first_name, last_name FROM contact_management.persons WHERE id = :person_id
    """), {"person_id": user.person_id})
    person = name_result.fetchone()
    full_name = f"{person.first_name} {person.last_name}" if person else user.username

    # ═══════════════════════════════════════════════════════════════════
    # CREATE SSO SESSION - For seamless login to other services
    # ═══════════════════════════════════════════════════════════════════
    session_id = sso_service.create_session(
        user_id=user.id,
        username=user.username,
        email=user.email,
        name=full_name,
        company_id=user.company_id,
        person_id=user.person_id
    )

    # Generate authorization code
    code = sso_service.generate_authorization_code(
        user_id=user.id,
        client_id=client_id,
        redirect_uri=redirect_uri,
        scope=scope,
        code_challenge=code_challenge if code_challenge else None,
        code_challenge_method=code_challenge_method if code_challenge_method else None
    )

    # Build redirect URL
    redirect_params = f"code={code}"
    if state:
        redirect_params += f"&state={state}"

    separator = "&" if "?" in redirect_uri else "?"

    # Create response with redirect
    response = RedirectResponse(url=f"{redirect_uri}{separator}{redirect_params}", status_code=302)

    # ═══════════════════════════════════════════════════════════════════
    # SET SSO SESSION COOKIE - Works across all *.bheem.cloud subdomains
    # ═══════════════════════════════════════════════════════════════════
    response.set_cookie(
        key=SSO_SESSION_COOKIE,
        value=session_id,
        max_age=86400,  # 24 hours
        httponly=True,
        secure=True,  # HTTPS only
        samesite="lax",  # Allow cross-site navigation
        domain=".bheem.cloud",  # Works across all subdomains
        path="/"
    )

    return response


@router.post("/token")
async def token(
    grant_type: str = Form(...),
    code: Optional[str] = Form(None),
    redirect_uri: Optional[str] = Form(None),
    client_id: Optional[str] = Form(None),
    client_secret: Optional[str] = Form(None),
    refresh_token: Optional[str] = Form(None),
    code_verifier: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db)
):
    """OAuth2 Token endpoint"""
    # Validate client
    if not client_id or not client_secret:
        raise HTTPException(status_code=401, detail="Client authentication required")

    if not sso_service.validate_client(client_id, client_secret):
        raise HTTPException(status_code=401, detail="Invalid client credentials")

    if grant_type == "authorization_code":
        if not code or not redirect_uri:
            raise HTTPException(status_code=400, detail="Missing required parameters")

        # Validate authorization code
        code_data = sso_service.validate_authorization_code(
            code=code,
            client_id=client_id,
            redirect_uri=redirect_uri,
            code_verifier=code_verifier
        )

        if not code_data:
            raise HTTPException(status_code=400, detail="Invalid or expired authorization code")

        # Fetch user info
        result = await db.execute(text("""
            SELECT u.id, u.username, u.email, u.company_id, u.person_id,
                   p.first_name, p.last_name
            FROM auth.users u
            LEFT JOIN contact_management.persons p ON u.person_id = p.id
            WHERE u.id = :user_id
        """), {"user_id": code_data["user_id"]})
        user = result.fetchone()

        if not user:
            raise HTTPException(status_code=400, detail="User not found")

        full_name = f"{user.first_name} {user.last_name}" if user.first_name else user.username

        # Generate tokens
        tokens = sso_service.generate_tokens(
            user_id=user.id,
            username=user.username,
            email=user.email,
            name=full_name,
            client_id=client_id,
            scope=code_data["scope"],
            company_id=user.company_id
        )

        return tokens

    elif grant_type == "refresh_token":
        if not refresh_token:
            raise HTTPException(status_code=400, detail="Missing refresh_token")

        token_data = sso_service.refresh_access_token(refresh_token, client_id)
        if not token_data:
            raise HTTPException(status_code=400, detail="Invalid or expired refresh token")

        # Fetch user info and generate new tokens
        result = await db.execute(text("""
            SELECT u.id, u.username, u.email, u.company_id, u.person_id,
                   p.first_name, p.last_name
            FROM auth.users u
            LEFT JOIN contact_management.persons p ON u.person_id = p.id
            WHERE u.id = :user_id
        """), {"user_id": token_data["user_id"]})
        user = result.fetchone()

        if not user:
            raise HTTPException(status_code=400, detail="User not found")

        full_name = f"{user.first_name} {user.last_name}" if user.first_name else user.username

        tokens = sso_service.generate_tokens(
            user_id=user.id,
            username=user.username,
            email=user.email,
            name=full_name,
            client_id=client_id,
            scope=token_data["scope"],
            company_id=user.company_id
        )

        return tokens

    else:
        raise HTTPException(status_code=400, detail=f"Unsupported grant_type: {grant_type}")


@router.get("/userinfo")
async def userinfo(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """OIDC UserInfo endpoint"""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = auth_header.replace("Bearer ", "")
    payload = sso_service.validate_access_token(token)

    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    # Fetch full user info
    result = await db.execute(text("""
        SELECT u.id, u.username, u.email, u.company_id, u.role,
               p.first_name, p.last_name, p.phone, p.avatar_url
        FROM auth.users u
        LEFT JOIN contact_management.persons p ON u.person_id = p.id
        WHERE u.id = :user_id
    """), {"user_id": int(payload["sub"])})
    user = result.fetchone()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "sub": str(user.id),
        "preferred_username": user.username,
        "email": user.email,
        "email_verified": True,
        "name": f"{user.first_name} {user.last_name}" if user.first_name else user.username,
        "given_name": user.first_name or user.username,
        "family_name": user.last_name or "",
        "phone_number": user.phone,
        "picture": user.avatar_url,
        "company_id": user.company_id,
        "role": user.role
    }


@router.post("/introspect")
async def introspect(
    token: str = Form(...),
    client_id: str = Form(...),
    client_secret: str = Form(...)
):
    """Token introspection endpoint"""
    if not sso_service.validate_client(client_id, client_secret):
        raise HTTPException(status_code=401, detail="Invalid client credentials")

    payload = sso_service.validate_access_token(token)

    if not payload:
        return {"active": False}

    return {
        "active": True,
        "sub": payload.get("sub"),
        "username": payload.get("username"),
        "email": payload.get("email"),
        "scope": payload.get("scope"),
        "client_id": payload.get("aud"),
        "exp": payload.get("exp"),
        "iat": payload.get("iat")
    }


@router.post("/revoke")
async def revoke(
    token: str = Form(...),
    client_id: str = Form(...),
    client_secret: str = Form(...)
):
    """Token revocation endpoint"""
    if not sso_service.validate_client(client_id, client_secret):
        raise HTTPException(status_code=401, detail="Invalid client credentials")

    # Remove from storage
    from services.sso_service import access_tokens, refresh_tokens

    if token in access_tokens:
        del access_tokens[token]
    if token in refresh_tokens:
        del refresh_tokens[token]

    return {"status": "success"}


# ═══════════════════════════════════════════════════════════════════
# SSO LOGOUT - Clear session and redirect
# ═══════════════════════════════════════════════════════════════════

@router.get("/logout")
@router.post("/logout")
async def sso_logout(
    request: Request,
    post_logout_redirect_uri: Optional[str] = None
):
    """
    SSO Logout endpoint.
    Clears the SSO session cookie and redirects to the specified URI or workspace home.
    """
    session_id = request.cookies.get(SSO_SESSION_COOKIE)

    # Delete session from storage
    if session_id:
        sso_service.delete_session(session_id)

    # Determine redirect URL
    redirect_url = post_logout_redirect_uri or "https://workspace.bheem.cloud/login"

    # Create response with redirect
    response = RedirectResponse(url=redirect_url, status_code=302)

    # Clear the SSO session cookie
    response.delete_cookie(
        key=SSO_SESSION_COOKIE,
        domain=".bheem.cloud",
        path="/"
    )

    return response


@router.get("/session/check")
async def check_session(request: Request):
    """
    Check if user has an active SSO session.
    Returns user info if session exists, error if not.
    """
    session_id = request.cookies.get(SSO_SESSION_COOKIE)

    if not session_id:
        return JSONResponse(
            status_code=401,
            content={"authenticated": False, "error": "No session"}
        )

    session_data = sso_service.validate_session(session_id)

    if not session_data:
        return JSONResponse(
            status_code=401,
            content={"authenticated": False, "error": "Session expired"}
        )

    # Extend session
    sso_service.extend_session(session_id)

    return {
        "authenticated": True,
        "user": {
            "id": session_data["user_id"],
            "username": session_data["username"],
            "email": session_data["email"],
            "name": session_data["name"]
        }
    }


@router.post("/session/create")
async def create_session_from_token(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Create an SSO session from a valid JWT token.

    Use this endpoint after logging in via API to establish an SSO session
    that works across all Bheem services (mail, docs, meet).

    Returns a response with the SSO session cookie set.
    """
    # Get user details from database for full name
    user_id = current_user.get("id") or current_user.get("user_id") or current_user.get("sub")

    try:
        result = await db.execute(text("""
            SELECT u.id, u.username, u.email, u.company_id, u.person_id,
                   p.first_name, p.last_name
            FROM auth.users u
            LEFT JOIN contact_management.persons p ON u.person_id = p.id
            WHERE u.id = :user_id
        """), {"user_id": user_id})
        user = result.fetchone()

        if user:
            full_name = f"{user.first_name} {user.last_name}" if user.first_name else user.username
            email = user.email or current_user.get("email") or current_user.get("username")
            company_id = user.company_id
            person_id = user.person_id
        else:
            # Use info from token if database lookup fails
            full_name = current_user.get("name") or current_user.get("username", "User")
            email = current_user.get("email") or current_user.get("username")
            company_id = current_user.get("company_id")
            person_id = current_user.get("person_id")
    except Exception as e:
        # Use info from token if database query fails
        print(f"[SSO] Database lookup failed, using token data: {e}")
        await db.rollback()
        full_name = current_user.get("name") or current_user.get("username", "User")
        email = current_user.get("email") or current_user.get("username")
        company_id = current_user.get("company_id")
        person_id = current_user.get("person_id")

    # Create SSO session
    session_id = sso_service.create_session(
        user_id=user_id,  # Keep as string/UUID - don't convert to int
        username=current_user.get("username", "user"),
        email=email,
        name=full_name,
        company_id=company_id,
        person_id=person_id
    )

    # Return success with cookie
    response = JSONResponse(content={
        "success": True,
        "message": "SSO session created",
        "user": {
            "id": user_id,
            "username": current_user.get("username"),
            "email": email,
            "name": full_name
        }
    })

    # Set SSO session cookie
    response.set_cookie(
        key=SSO_SESSION_COOKIE,
        value=session_id,
        max_age=86400,  # 24 hours
        httponly=True,
        secure=True,
        samesite="lax",
        domain=".bheem.cloud",
        path="/"
    )

    return response
