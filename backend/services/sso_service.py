"""
Bheem Workspace - SSO Service
OAuth2/OIDC Provider for Single Sign-On across all Bheem services
"""
import secrets
import hashlib
import base64
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
import jwt
from pydantic import BaseModel
from core.config import settings

# In-memory storage for SSO sessions (use Redis in production)
authorization_codes: Dict[str, Dict] = {}
access_tokens: Dict[str, Dict] = {}
refresh_tokens: Dict[str, Dict] = {}
sso_sessions: Dict[str, Dict] = {}  # SSO session storage for seamless login

class SSOConfig:
    """SSO Configuration for Bheem Workspace"""
    ISSUER = "https://workspace.bheem.cloud"
    AUTHORIZATION_ENDPOINT = "/api/v1/sso/authorize"
    TOKEN_ENDPOINT = "/api/v1/sso/token"
    USERINFO_ENDPOINT = "/api/v1/sso/userinfo"
    JWKS_ENDPOINT = "/api/v1/sso/.well-known/jwks.json"

    # Token lifetimes
    AUTH_CODE_LIFETIME = 600  # 10 minutes
    ACCESS_TOKEN_LIFETIME = 3600  # 1 hour
    REFRESH_TOKEN_LIFETIME = 86400 * 30  # 30 days
    ID_TOKEN_LIFETIME = 3600  # 1 hour

    # Registered clients
    CLIENTS = {
        "bheem-docs": {
            "client_id": "bheem-docs",
            "client_secret": "BheemDocsSecret2024",
            "redirect_uris": [
                "https://docs.bheem.cloud/apps/oidc_login/oidc",
                "https://docs.bheem.cloud/index.php/apps/oidc_login/oidc"
            ],
            "name": "Bheem Docs"
        },
        "bheem-mail": {
            "client_id": "bheem-mail",
            "client_secret": "BheemMailSecret2024",
            "redirect_uris": [
                "https://mail.bheem.cloud/sso/callback"
            ],
            "name": "Bheem Mail"
        },
        "bheem-meet": {
            "client_id": "bheem-meet",
            "client_secret": "BheemMeetSecret2024",
            "redirect_uris": [
                "https://meet.bheem.cloud/oauth/callback",
                "https://workspace.bheem.cloud/meet/callback"
            ],
            "name": "Bheem Meet"
        },
        "bheem-workspace": {
            "client_id": "bheem-workspace",
            "client_secret": "BheemWorkspaceSecret2024",
            "redirect_uris": [
                "https://workspace.bheem.cloud/callback",
                "http://localhost:8500/callback"
            ],
            "name": "Bheem Workspace"
        }
    }


class SSOService:
    def __init__(self):
        self.config = SSOConfig()
        self.secret_key = settings.SECRET_KEY

    def generate_authorization_code(
        self,
        user_id: int,
        client_id: str,
        redirect_uri: str,
        scope: str,
        code_challenge: Optional[str] = None,
        code_challenge_method: Optional[str] = None
    ) -> str:
        """Generate an authorization code for OAuth2 flow"""
        code = secrets.token_urlsafe(32)

        authorization_codes[code] = {
            "user_id": user_id,
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "scope": scope,
            "code_challenge": code_challenge,
            "code_challenge_method": code_challenge_method,
            "expires_at": datetime.utcnow() + timedelta(seconds=self.config.AUTH_CODE_LIFETIME)
        }

        return code

    def validate_authorization_code(
        self,
        code: str,
        client_id: str,
        redirect_uri: str,
        code_verifier: Optional[str] = None
    ) -> Optional[Dict]:
        """Validate authorization code and return user info"""
        if code not in authorization_codes:
            return None

        code_data = authorization_codes[code]

        # Check expiration
        if datetime.utcnow() > code_data["expires_at"]:
            del authorization_codes[code]
            return None

        # Validate client and redirect URI
        if code_data["client_id"] != client_id or code_data["redirect_uri"] != redirect_uri:
            return None

        # PKCE validation if present
        if code_data["code_challenge"]:
            if not code_verifier:
                return None

            if code_data["code_challenge_method"] == "S256":
                verifier_hash = base64.urlsafe_b64encode(
                    hashlib.sha256(code_verifier.encode()).digest()
                ).decode().rstrip("=")
                if verifier_hash != code_data["code_challenge"]:
                    return None
            elif code_data["code_challenge_method"] == "plain":
                if code_verifier != code_data["code_challenge"]:
                    return None

        # Remove used code
        result = {
            "user_id": code_data["user_id"],
            "scope": code_data["scope"]
        }
        del authorization_codes[code]

        return result

    def generate_tokens(
        self,
        user_id: int,
        username: str,
        email: str,
        name: str,
        client_id: str,
        scope: str,
        company_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Generate access token, refresh token, and ID token"""
        now = datetime.utcnow()

        # Access token
        access_token_payload = {
            "iss": self.config.ISSUER,
            "sub": str(user_id),
            "aud": client_id,
            "exp": now + timedelta(seconds=self.config.ACCESS_TOKEN_LIFETIME),
            "iat": now,
            "scope": scope,
            "username": username,
            "email": email,
            "company_id": company_id
        }
        access_token = jwt.encode(access_token_payload, self.secret_key, algorithm="HS256")

        # Refresh token
        refresh_token = secrets.token_urlsafe(48)
        refresh_tokens[refresh_token] = {
            "user_id": user_id,
            "client_id": client_id,
            "scope": scope,
            "expires_at": now + timedelta(seconds=self.config.REFRESH_TOKEN_LIFETIME)
        }

        # ID token (OIDC)
        id_token_payload = {
            "iss": self.config.ISSUER,
            "sub": str(user_id),
            "aud": client_id,
            "exp": now + timedelta(seconds=self.config.ID_TOKEN_LIFETIME),
            "iat": now,
            "auth_time": int(now.timestamp()),
            "nonce": secrets.token_urlsafe(16),
            # Standard OIDC claims
            "preferred_username": username,
            "email": email,
            "email_verified": True,
            "name": name,
            "given_name": name.split()[0] if name else username,
            "family_name": name.split()[-1] if name and len(name.split()) > 1 else "",
        }
        id_token = jwt.encode(id_token_payload, self.secret_key, algorithm="HS256")

        # Store access token for introspection
        access_tokens[access_token] = {
            "user_id": user_id,
            "client_id": client_id,
            "scope": scope,
            "expires_at": now + timedelta(seconds=self.config.ACCESS_TOKEN_LIFETIME)
        }

        return {
            "access_token": access_token,
            "token_type": "Bearer",
            "expires_in": self.config.ACCESS_TOKEN_LIFETIME,
            "refresh_token": refresh_token,
            "id_token": id_token,
            "scope": scope
        }

    def refresh_access_token(self, refresh_token: str, client_id: str) -> Optional[Dict]:
        """Refresh an access token using refresh token"""
        if refresh_token not in refresh_tokens:
            return None

        token_data = refresh_tokens[refresh_token]

        if datetime.utcnow() > token_data["expires_at"]:
            del refresh_tokens[refresh_token]
            return None

        if token_data["client_id"] != client_id:
            return None

        # Generate new tokens (user info would need to be fetched from DB)
        # For now, return minimal response
        return {
            "user_id": token_data["user_id"],
            "scope": token_data["scope"]
        }

    def validate_access_token(self, token: str) -> Optional[Dict]:
        """Validate and decode access token"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=["HS256"])
            return payload
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None

    def get_client(self, client_id: str) -> Optional[Dict]:
        """Get client configuration"""
        return self.config.CLIENTS.get(client_id)

    def validate_client(self, client_id: str, client_secret: str) -> bool:
        """Validate client credentials"""
        client = self.get_client(client_id)
        if not client:
            return False
        return client["client_secret"] == client_secret

    def get_openid_configuration(self, base_url: str) -> Dict:
        """Return OpenID Connect discovery document"""
        return {
            "issuer": self.config.ISSUER,
            "authorization_endpoint": f"{base_url}{self.config.AUTHORIZATION_ENDPOINT}",
            "token_endpoint": f"{base_url}{self.config.TOKEN_ENDPOINT}",
            "userinfo_endpoint": f"{base_url}{self.config.USERINFO_ENDPOINT}",
            "jwks_uri": f"{base_url}{self.config.JWKS_ENDPOINT}",
            "response_types_supported": ["code", "token", "id_token", "code token", "code id_token", "token id_token", "code token id_token"],
            "subject_types_supported": ["public"],
            "id_token_signing_alg_values_supported": ["HS256", "RS256"],
            "scopes_supported": ["openid", "profile", "email", "offline_access"],
            "token_endpoint_auth_methods_supported": ["client_secret_basic", "client_secret_post"],
            "claims_supported": [
                "sub", "iss", "aud", "exp", "iat", "auth_time",
                "name", "given_name", "family_name", "email", "email_verified",
                "preferred_username"
            ],
            "code_challenge_methods_supported": ["plain", "S256"]
        }

    # ═══════════════════════════════════════════════════════════════════
    # SSO SESSION MANAGEMENT - For seamless cross-service authentication
    # ═══════════════════════════════════════════════════════════════════

    def create_session(
        self,
        user_id,  # Can be int, str, or UUID
        username: str,
        email: str,
        name: str,
        company_id = None,
        person_id = None
    ) -> str:
        """
        Create an SSO session after successful authentication.
        Returns session_id to be stored in cookie.
        """
        session_id = secrets.token_urlsafe(48)
        sso_sessions[session_id] = {
            "user_id": user_id,
            "username": username,
            "email": email,
            "name": name,
            "company_id": company_id,
            "person_id": person_id,
            "created_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(hours=24)  # 24-hour session
        }
        return session_id

    def validate_session(self, session_id: str) -> Optional[Dict]:
        """
        Validate an SSO session by session_id.
        Returns user info if valid, None if expired/invalid.
        """
        if not session_id or session_id not in sso_sessions:
            return None

        session = sso_sessions[session_id]

        # Check expiration
        if datetime.utcnow() > session["expires_at"]:
            del sso_sessions[session_id]
            return None

        return {
            "user_id": session["user_id"],
            "username": session["username"],
            "email": session["email"],
            "name": session["name"],
            "company_id": session["company_id"],
            "person_id": session["person_id"]
        }

    def delete_session(self, session_id: str) -> bool:
        """Delete an SSO session (logout)"""
        if session_id in sso_sessions:
            del sso_sessions[session_id]
            return True
        return False

    def extend_session(self, session_id: str) -> bool:
        """Extend session expiration (sliding expiration)"""
        if session_id in sso_sessions:
            sso_sessions[session_id]["expires_at"] = datetime.utcnow() + timedelta(hours=24)
            return True
        return False


# Singleton instance
sso_service = SSOService()
