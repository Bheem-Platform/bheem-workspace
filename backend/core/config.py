"""
Bheem Workspace - Configuration
"""
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str
    ERP_DATABASE_URL: Optional[str] = None

    # Bheem Passport (Centralized Authentication)
    BHEEM_PASSPORT_URL: str = "https://platform.bheem.co.uk"
    USE_PASSPORT_AUTH: bool = True  # Set to False to use local auth

    # JWT Configuration (MUST match Bheem Passport settings for SSO)
    # This should be identical to Bheem Platform's SECRET_KEY for token validation
    SECRET_KEY: str
    BHEEM_JWT_SECRET: Optional[str] = None  # Passport JWT secret for SSO validation
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
    MAILCOW_IMAP_HOST: str = "mail.bheem.cloud"
    MAILCOW_SMTP_HOST: str = "mail.bheem.cloud"
    MAILCOW_IMAP_PORT: int = 993
    MAILCOW_SMTP_PORT: int = 465

    # Mailcow SSH (for direct password sync fallback)
    MAILCOW_SSH_HOST: Optional[str] = None
    MAILCOW_SSH_USER: str = "root"
    MAILCOW_SSH_KEY_PATH: Optional[str] = None
    MAILCOW_MYSQL_USER: str = "root"
    MAILCOW_MYSQL_PASSWORD: Optional[str] = None
    
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

    # Mailgun
    MAILGUN_API_KEY: Optional[str] = None
    MAILGUN_DOMAIN: str = "bheem.co.uk"
    MAILGUN_FROM_NAME: str = "Bheem Platform"
    MAILGUN_FROM_EMAIL: str = "noreply@bheem.co.uk"

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
