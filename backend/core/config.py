"""
Bheem Workspace - Configuration
"""
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str
    ERP_DATABASE_URL: Optional[str] = None
    
    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    
    # LiveKit
    LIVEKIT_API_KEY: str
    LIVEKIT_API_SECRET: str
    LIVEKIT_URL: str
    
    # Nextcloud
    NEXTCLOUD_URL: str
    NEXTCLOUD_ADMIN_USER: str
    NEXTCLOUD_ADMIN_PASSWORD: str
    
    # Mailcow
    MAILCOW_URL: str
    MAILCOW_API_KEY: str
    MAIL_DOMAIN: str = "bheem.cloud"
    
    # S3
    S3_ENDPOINT: str
    S3_ACCESS_KEY: str
    S3_SECRET_KEY: str
    S3_BUCKET: str
    S3_REGION: str
    
    # Recording
    RECORDING_ENCRYPTION_KEY: Optional[str] = None
    WATERMARK_ENABLED: bool = True
    DRM_ENABLED: bool = True
    
    # Workspace
    WORKSPACE_URL: str = "https://workspace.bheem.cloud"

    # Cloudflare
    CLOUDFLARE_API_TOKEN: Optional[str] = None

    # AI Services
    ANTHROPIC_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None

    # Bheem-Tele Communication Service (white-labeled)
    MSG91_AUTH_KEY: Optional[str] = None
    MSG91_SENDER_EMAIL: str = "noreply@bheem.co.uk"
    MSG91_SENDER_NAME: str = "Bheem-Tele"

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
