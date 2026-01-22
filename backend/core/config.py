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
    BHEEM_JWT_ALGORITHM: str = "HS256"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 43200  # 30 days
    
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
    MAILCOW_SMTP_PORT: int = 587  # Use STARTTLS on port 587

    # Mailcow SSH (for direct password sync fallback)
    MAILCOW_SSH_HOST: Optional[str] = None
    MAILCOW_SSH_USER: str = "root"
    MAILCOW_SSH_KEY_PATH: Optional[str] = None
    MAILCOW_MYSQL_USER: str = "root"
    MAILCOW_MYSQL_PASSWORD: Optional[str] = None
    
    # S3 Storage for Recordings
    S3_ENDPOINT: str = "https://hel1.your-objectstorage.com"
    S3_ACCESS_KEY: str = "E8OBSHD5J85G0DQXAACX"
    S3_SECRET_KEY: str = "O171vuUctulQfPRoz1W4ulfHOan3bXKuztnSgJDV"
    S3_BUCKET: str = "bheem"
    S3_REGION: str = "hel1"
    
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

    # ============================================
    # BHEEM NOTIFY CONFIGURATION
    # ============================================
    NOTIFY_SERVICE_URL: str = "https://platform.bheem.co.uk"
    NOTIFY_API_KEY: Optional[str] = None
    NOTIFY_TIMEOUT: float = 30.0
    NOTIFY_SENDER_EMAIL: str = "noreply@bheem.cloud"
    NOTIFY_SENDER_NAME: str = "Bheem Workspace"

    # ============================================
    # MAIL SESSION SECURITY
    # ============================================
    REDIS_URL: str = "redis://localhost:6379/1"
    MAIL_ENCRYPTION_KEY: Optional[str] = None  # Fernet key for encrypting mail credentials
    MAIL_SESSION_TTL_HOURS: int = 24
    UNDO_SEND_DELAY_SECONDS: int = 30

    # ============================================
    # USER PROVISIONING CONFIGURATION
    # ============================================
    WORKSPACE_FRONTEND_URL: str = "https://workspace.bheem.cloud"
    PROVISIONING_AUTO_MAILBOX: bool = True
    PROVISIONING_SEND_WELCOME: bool = True
    PROVISIONING_SYNC_PASSPORT: bool = True
    PROVISIONING_SYNC_NEXTCLOUD: bool = False  # Enable when ready

    # ============================================
    # ERP INTEGRATION CONFIGURATION
    # ============================================

    # Bheem Core ERP API
    ERP_SERVICE_URL: str = "http://localhost:8000"
    # Service account for ERP authentication via Bheem Passport
    ERP_SERVICE_USERNAME: Optional[str] = None  # e.g., workspace-service@bheem.internal
    ERP_SERVICE_PASSWORD: Optional[str] = None
    # Bheem Passport URL for token authentication
    BHEEM_PASSPORT_URL: str = "https://platform.bheem.co.uk"

    # ERP Database Direct Connection (for workspace email migration)
    ERP_DB_HOST: str = "65.109.167.218"
    ERP_DB_PORT: int = 5432
    ERP_DB_NAME: str = "erp_staging"
    ERP_DB_USER: str = "postgres"
    ERP_DB_PASSWORD: str = "Bheem924924.@"

    # BheemPay Payment Gateway Service
    BHEEMPAY_URL: str = "http://bheem-pay:8006"
    BHEEMPAY_API_KEY: Optional[str] = None
    BHEEMPAY_WEBHOOK_SECRET: Optional[str] = None

    # ERP Employee Webhook Secret (for receiving employee create/update/delete events)
    ERP_WEBHOOK_SECRET: Optional[str] = None

    # Bheemverse Company Codes (internal mode tenants)
    BHEEMVERSE_COMPANY_CODES: str = "BHM001,BHM002,BHM003,BHM004,BHM005,BHM006,BHM007,BHM008"

    # BHM001 - Bheemverse Innovation (Parent company - all external revenue goes here)
    BHEEMVERSE_PARENT_COMPANY_ID: str = "79f70aef-17eb-48a8-b599-2879721e8796"
    BHEEMVERSE_PARENT_COMPANY_CODE: str = "BHM001"

    # ============================================
    # BHEEM DOCS CONFIGURATION
    # ============================================
    DOCS_S3_ENDPOINT: Optional[str] = None  # Falls back to S3_ENDPOINT if not set
    DOCS_S3_ACCESS_KEY: Optional[str] = None
    DOCS_S3_SECRET_KEY: Optional[str] = None
    DOCS_S3_BUCKET: str = "bheem-docs"
    DOCS_S3_REGION: str = "hel1"

    # Storage quotas
    DOCS_DEFAULT_QUOTA_BYTES: int = 10737418240  # 10GB default
    DOCS_MAX_FILE_SIZE_BYTES: int = 104857600  # 100MB max file size
    DOCS_ALLOWED_EXTENSIONS: str = "pdf,doc,docx,xls,xlsx,ppt,pptx,txt,md,csv,json,xml,jpg,jpeg,png,gif,svg,mp4,mp3,zip,rar"

    # Collaboration
    DOCS_COLLAB_WEBSOCKET_URL: str = "wss://workspace.bheem.cloud/docs/collab"
    DOCS_AUTO_SAVE_INTERVAL_MS: int = 3000  # 3 seconds

    # AI Features
    DOCS_AI_ENABLED: bool = True
    DOCS_OCR_ENABLED: bool = True

    # ============================================
    # ONLYOFFICE DOCUMENT SERVER CONFIGURATION
    # ============================================
    ONLYOFFICE_URL: str = "https://office.bheem.cloud"  # OnlyOffice Document Server URL
    ONLYOFFICE_JWT_SECRET: Optional[str] = "BheemOffice2024JWT!"  # JWT secret for OnlyOffice (must match OnlyOffice server)
    ONLYOFFICE_JWT_ENABLED: bool = True  # JWT enabled
    ONLYOFFICE_JWT_HEADER: str = "Authorization"
    ONLYOFFICE_CALLBACK_URL: str = "https://workspace.bheem.cloud/api/v1/sheets"  # Callback base URL

    # ============================================
    # MIGRATION SERVICE CONFIGURATION (One-Click Migration)
    # ============================================
    # Google OAuth for migration (Gmail, Contacts, Drive)
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None

    # Microsoft OAuth for migration (Outlook, Contacts, OneDrive)
    MICROSOFT_CLIENT_ID: Optional[str] = None
    MICROSOFT_CLIENT_SECRET: Optional[str] = None

    # Encryption key for storing OAuth tokens (Fernet key - 32 bytes, base64 encoded)
    # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    ENCRYPTION_KEY: str = "your-fernet-encryption-key-here"

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
