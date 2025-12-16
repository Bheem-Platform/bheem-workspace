"""
Bheem Workspace - Authentication API
Integrates with Bheem Core ERP auth.users table
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import timedelta

from core.database import get_db
from core.security import (
    verify_password, get_password_hash, create_access_token,
    get_current_user
)
from core.config import settings
from services.mailcow_service import mailcow_service
import asyncio

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Schemas
class LoginRequest(BaseModel):
    username: str  # Can be username or email
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict

class UserResponse(BaseModel):
    id: str
    username: str
    email: Optional[str]
    role: str
    company_id: Optional[str]
    person_id: Optional[str]

class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str
    full_name: Optional[str] = None

# Endpoints
@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Login with ERP credentials (username or email)
    Returns JWT token for subsequent requests
    """
    # Check if input is email or username
    if "@" in request.username:
        query = text("""
            SELECT id, username, email, hashed_password, role, company_id, person_id, is_active
            FROM auth.users 
            WHERE email = :identifier AND is_deleted = false
        """)
    else:
        query = text("""
            SELECT id, username, email, hashed_password, role, company_id, person_id, is_active
            FROM auth.users 
            WHERE username = :identifier AND is_deleted = false
        """)
    
    result = await db.execute(query, {"identifier": request.username})
    user = result.fetchone()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled"
        )
    
    if not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    # Create access token
    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "company_id": str(user.company_id) if user.company_id else None
        }
    )
    
    # Update last login (optional - don't fail if it errors)
    try:
        await db.execute(
            text("UPDATE auth.users SET updated_at = NOW() WHERE id = :user_id"),
            {"user_id": user.id}
        )
        await db.commit()
    except:
        pass

    # Sync password to Mailcow (SSO - single password for all services)
    # This ensures Mailcow mailbox password stays in sync with Bheem Core
    try:
        if user.email:
            asyncio.create_task(
                mailcow_service.sync_password_to_mailcow(user.email, request.password)
            )
    except Exception as e:
        # Don't fail login if mailcow sync fails
        print(f"Mailcow password sync skipped: {e}")

    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user={
            "id": str(user.id),
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "company_id": str(user.company_id) if user.company_id else None,
            "person_id": str(user.person_id) if user.person_id else None
        }
    )

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current authenticated user info"""
    return UserResponse(**current_user)

@router.post("/refresh")
async def refresh_token(current_user: dict = Depends(get_current_user)):
    """Refresh access token"""
    access_token = create_access_token(
        data={
            "sub": current_user["id"],
            "username": current_user["username"],
            "email": current_user.get("email"),
            "role": current_user["role"],
            "company_id": current_user.get("company_id")
        }
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    }

@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """Logout (client should discard token)"""
    # In a stateless JWT system, logout is handled client-side
    # For stateful sessions, we would invalidate the token here
    return {"message": "Successfully logged out"}

@router.get("/verify")
async def verify_token(current_user: dict = Depends(get_current_user)):
    """Verify if token is valid"""
    return {
        "valid": True,
        "user_id": current_user["id"],
        "username": current_user["username"]
    }
