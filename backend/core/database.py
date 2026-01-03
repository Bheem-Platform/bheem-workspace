"""
Bheem Workspace - Database Connection (ERP)
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import text
from .config import settings

# Create async engine for ERP database
# SQLite uses NullPool and doesn't support pool_size/max_overflow
if settings.DATABASE_URL.startswith("sqlite"):
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
    )
else:
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True
    )

# Session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

Base = declarative_base()

async def get_db():
    """Dependency to get database session"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

async def test_connection():
    """Test database connection"""
    try:
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        print(f"Database connection failed: {e}")
        return False


# Alias for background tasks that need session maker
async_session_maker = AsyncSessionLocal


def get_db_connection():
    """
    Get a synchronous database connection using psycopg2.
    Used by APIs that need sync database access.
    """
    import psycopg2
    from urllib.parse import urlparse, unquote

    # Parse the async database URL to get connection params
    db_url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    parsed = urlparse(db_url)

    # URL decode the password (handles special characters like @ and #)
    password = unquote(parsed.password) if parsed.password else None

    return psycopg2.connect(
        host=parsed.hostname,
        port=parsed.port or 5432,
        user=parsed.username,
        password=password,
        database=parsed.path.lstrip('/')
    )
