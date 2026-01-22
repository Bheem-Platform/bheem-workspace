"""
OAuth service for migration providers.
Handles OAuth flows for Google and Microsoft.
"""

import secrets
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from urllib.parse import urlencode
import aiohttp
from cryptography.fernet import Fernet

from core.config import settings

logger = logging.getLogger(__name__)


class OAuthService:
    """Handle OAuth flows for migration providers"""

    # Google OAuth endpoints
    GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
    GOOGLE_SCOPES = [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/contacts.readonly",
        "https://www.googleapis.com/auth/drive.readonly",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
    ]

    # Microsoft OAuth endpoints
    MICROSOFT_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
    MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
    MICROSOFT_SCOPES = [
        "Mail.Read",
        "Contacts.Read",
        "Files.Read.All",
        "User.Read",
        "offline_access",
    ]

    def __init__(self):
        # Generate a valid Fernet key if not configured
        encryption_key = settings.ENCRYPTION_KEY
        if encryption_key == "your-fernet-encryption-key-here" or not encryption_key:
            # Use a fallback key for development (NOT for production!)
            encryption_key = Fernet.generate_key().decode()
            logger.warning("Using auto-generated encryption key - set ENCRYPTION_KEY in production!")

        try:
            self.fernet = Fernet(encryption_key.encode())
        except Exception as e:
            logger.warning(f"Invalid encryption key, generating new one: {e}")
            self.fernet = Fernet(Fernet.generate_key())

        self._state_store: Dict[str, dict] = {}  # In production, use Redis

    def encrypt_token(self, token: str) -> str:
        """Encrypt token for storage"""
        if not token:
            return ""
        return self.fernet.encrypt(token.encode()).decode()

    def decrypt_token(self, encrypted: str) -> str:
        """Decrypt stored token"""
        if not encrypted:
            return ""
        return self.fernet.decrypt(encrypted.encode()).decode()

    def generate_state(self, tenant_id: str, user_id: str, provider: str) -> str:
        """Generate OAuth state parameter"""
        state = secrets.token_urlsafe(32)
        self._state_store[state] = {
            "tenant_id": tenant_id,
            "user_id": user_id,
            "provider": provider,
            "created_at": datetime.utcnow()
        }
        return state

    def validate_state(self, state: str) -> Optional[dict]:
        """Validate and consume state parameter"""
        data = self._state_store.pop(state, None)
        if not data:
            return None
        # Check expiry (10 minutes)
        if datetime.utcnow() - data["created_at"] > timedelta(minutes=10):
            return None
        return data

    def get_google_auth_url(
        self,
        tenant_id: str,
        user_id: str,
        redirect_uri: str
    ) -> str:
        """Generate Google OAuth authorization URL"""
        if not settings.GOOGLE_CLIENT_ID:
            raise ValueError("GOOGLE_CLIENT_ID not configured")

        state = self.generate_state(tenant_id, user_id, "google")

        params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": " ".join(self.GOOGLE_SCOPES),
            "state": state,
            "access_type": "offline",  # Get refresh token
            "prompt": "consent",  # Force consent to get refresh token
        }

        return f"{self.GOOGLE_AUTH_URL}?{urlencode(params)}"

    async def exchange_google_code(
        self,
        code: str,
        redirect_uri: str
    ) -> Dict[str, Any]:
        """Exchange authorization code for tokens"""
        async with aiohttp.ClientSession() as session:
            async with session.post(
                self.GOOGLE_TOKEN_URL,
                data={
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri,
                }
            ) as resp:
                if resp.status != 200:
                    error_data = await resp.text()
                    logger.error(f"Google token exchange failed: {error_data}")
                    raise Exception(f"Token exchange failed: {resp.status}")

                data = await resp.json()

                return {
                    "access_token": data["access_token"],
                    "refresh_token": data.get("refresh_token"),
                    "expires_in": data.get("expires_in", 3600),
                    "token_type": data.get("token_type", "Bearer"),
                    "scope": data.get("scope", "").split(),
                }

    async def refresh_google_token(self, refresh_token: str) -> Dict[str, Any]:
        """Refresh expired Google access token"""
        async with aiohttp.ClientSession() as session:
            async with session.post(
                self.GOOGLE_TOKEN_URL,
                data={
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token",
                }
            ) as resp:
                resp.raise_for_status()
                data = await resp.json()

                return {
                    "access_token": data["access_token"],
                    "expires_in": data.get("expires_in", 3600),
                }

    def get_microsoft_auth_url(
        self,
        tenant_id: str,
        user_id: str,
        redirect_uri: str
    ) -> str:
        """Generate Microsoft OAuth authorization URL"""
        if not settings.MICROSOFT_CLIENT_ID:
            raise ValueError("MICROSOFT_CLIENT_ID not configured")

        state = self.generate_state(tenant_id, user_id, "microsoft")

        params = {
            "client_id": settings.MICROSOFT_CLIENT_ID,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": " ".join(self.MICROSOFT_SCOPES),
            "state": state,
            "response_mode": "query",
        }

        return f"{self.MICROSOFT_AUTH_URL}?{urlencode(params)}"

    async def exchange_microsoft_code(
        self,
        code: str,
        redirect_uri: str
    ) -> Dict[str, Any]:
        """Exchange Microsoft authorization code for tokens"""
        async with aiohttp.ClientSession() as session:
            async with session.post(
                self.MICROSOFT_TOKEN_URL,
                data={
                    "client_id": settings.MICROSOFT_CLIENT_ID,
                    "client_secret": settings.MICROSOFT_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri,
                }
            ) as resp:
                resp.raise_for_status()
                return await resp.json()


# Singleton
oauth_service = OAuthService()
