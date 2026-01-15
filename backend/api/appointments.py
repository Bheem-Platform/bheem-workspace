"""
Bheem Workspace - Appointments API
Calendly-like appointment scheduling endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel, EmailStr
from datetime import datetime, date

from core.database import get_db
from services.appointment_service import AppointmentService

router = APIRouter(prefix="/appointments", tags=["Appointments"])


# =============================================
# Request/Response Models
# =============================================

class CreateAppointmentTypeRequest(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    duration_minutes: int = 30
    color: Optional[str] = None
    location_type: str = "meet"  # meet, phone, custom
    custom_location: Optional[str] = None
    availability: Optional[Dict[str, Any]] = None
    questions: Optional[List[Dict[str, Any]]] = None
    buffer_before_minutes: int = 0
    buffer_after_minutes: int = 0
    min_notice_hours: int = 24
    max_days_ahead: int = 60


class UpdateAppointmentTypeRequest(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    duration_minutes: Optional[int] = None
    color: Optional[str] = None
    location_type: Optional[str] = None
    custom_location: Optional[str] = None
    availability: Optional[Dict[str, Any]] = None
    questions: Optional[List[Dict[str, Any]]] = None
    buffer_before_minutes: Optional[int] = None
    buffer_after_minutes: Optional[int] = None
    min_notice_hours: Optional[int] = None
    max_days_ahead: Optional[int] = None
    is_active: Optional[bool] = None
    confirmation_email_template: Optional[str] = None
    reminder_email_template: Optional[str] = None


class BookAppointmentRequest(BaseModel):
    guest_email: EmailStr
    start_time: datetime
    guest_name: Optional[str] = None
    guest_timezone: Optional[str] = None
    answers: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None


class RescheduleRequest(BaseModel):
    new_start_time: datetime


class CancelRequest(BaseModel):
    reason: Optional[str] = None


class AppointmentTypeResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    description: Optional[str]
    duration_minutes: int
    color: Optional[str]
    location_type: str
    custom_location: Optional[str]
    availability: Dict[str, Any]
    questions: List[Dict[str, Any]]
    buffer_before_minutes: int
    buffer_after_minutes: int
    min_notice_hours: int
    max_days_ahead: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AppointmentResponse(BaseModel):
    id: UUID
    appointment_type_id: UUID
    host_id: UUID
    guest_email: str
    guest_name: Optional[str]
    guest_timezone: Optional[str]
    start_time: datetime
    end_time: datetime
    status: str
    answers: Dict[str, Any]
    notes: Optional[str]
    cancelled_at: Optional[datetime]
    cancellation_reason: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class AvailableSlotsResponse(BaseModel):
    appointment_type_id: UUID
    slots: Dict[str, List[Dict[str, str]]]


# =============================================
# Appointment Types
# =============================================

@router.post("/types", response_model=AppointmentTypeResponse)
async def create_appointment_type(
    request: CreateAppointmentTypeRequest,
    tenant_id: UUID = Query(...),
    user_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Create a new appointment type"""
    service = AppointmentService(db)
    appointment_type = await service.create_appointment_type(
        tenant_id=tenant_id,
        user_id=user_id,
        **request.model_dump()
    )
    return appointment_type


@router.get("/types", response_model=List[AppointmentTypeResponse])
async def list_appointment_types(
    user_id: UUID = Query(...),
    active_only: bool = True,
    db: AsyncSession = Depends(get_db)
):
    """List appointment types for a user"""
    service = AppointmentService(db)
    types = await service.list_appointment_types(
        user_id=user_id,
        active_only=active_only
    )
    return types


@router.get("/types/{appointment_type_id}", response_model=AppointmentTypeResponse)
async def get_appointment_type(
    appointment_type_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get an appointment type by ID"""
    service = AppointmentService(db)
    apt_type = await service.get_appointment_type(appointment_type_id)
    if not apt_type:
        raise HTTPException(status_code=404, detail="Appointment type not found")
    return apt_type


@router.get("/types/by-slug/{user_id}/{slug}", response_model=AppointmentTypeResponse)
async def get_appointment_type_by_slug(
    user_id: UUID,
    slug: str,
    db: AsyncSession = Depends(get_db)
):
    """Get an appointment type by user and slug (public booking page)"""
    service = AppointmentService(db)
    apt_type = await service.get_appointment_type_by_slug(user_id, slug)
    if not apt_type:
        raise HTTPException(status_code=404, detail="Appointment type not found")
    return apt_type


@router.patch("/types/{appointment_type_id}", response_model=AppointmentTypeResponse)
async def update_appointment_type(
    appointment_type_id: UUID,
    request: UpdateAppointmentTypeRequest,
    user_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Update an appointment type"""
    service = AppointmentService(db)
    apt_type = await service.update_appointment_type(
        appointment_type_id=appointment_type_id,
        user_id=user_id,
        **request.model_dump(exclude_unset=True)
    )
    if not apt_type:
        raise HTTPException(status_code=404, detail="Appointment type not found")
    return apt_type


@router.delete("/types/{appointment_type_id}")
async def delete_appointment_type(
    appointment_type_id: UUID,
    user_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Delete an appointment type"""
    service = AppointmentService(db)
    success = await service.delete_appointment_type(
        appointment_type_id=appointment_type_id,
        user_id=user_id
    )
    if not success:
        raise HTTPException(status_code=404, detail="Appointment type not found")
    return {"status": "deleted"}


# =============================================
# Available Slots
# =============================================

@router.get("/types/{appointment_type_id}/slots", response_model=AvailableSlotsResponse)
async def get_available_slots(
    appointment_type_id: UUID,
    start_date: date = Query(...),
    end_date: date = Query(...),
    timezone: str = "UTC",
    db: AsyncSession = Depends(get_db)
):
    """Get available time slots for booking"""
    service = AppointmentService(db)
    slots = await service.get_available_slots(
        appointment_type_id=appointment_type_id,
        start_date=start_date,
        end_date=end_date,
        timezone=timezone
    )
    return {
        "appointment_type_id": appointment_type_id,
        "slots": slots
    }


# =============================================
# Bookings
# =============================================

@router.post("/types/{appointment_type_id}/book", response_model=AppointmentResponse)
async def book_appointment(
    appointment_type_id: UUID,
    request: BookAppointmentRequest,
    db: AsyncSession = Depends(get_db)
):
    """Book an appointment"""
    service = AppointmentService(db)
    try:
        appointment = await service.book_appointment(
            appointment_type_id=appointment_type_id,
            guest_email=request.guest_email,
            start_time=request.start_time,
            guest_name=request.guest_name,
            guest_timezone=request.guest_timezone,
            answers=request.answers,
            notes=request.notes
        )
        if not appointment:
            raise HTTPException(
                status_code=400,
                detail="Appointment type not available"
            )
        return appointment
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=List[AppointmentResponse])
async def list_appointments(
    host_id: UUID = Query(...),
    status: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """List appointments for a host"""
    service = AppointmentService(db)
    appointments = await service.list_host_appointments(
        host_id=host_id,
        status=status,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=limit
    )
    return appointments


@router.get("/{appointment_id}", response_model=AppointmentResponse)
async def get_appointment(
    appointment_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get an appointment by ID"""
    service = AppointmentService(db)
    appointment = await service.get_appointment(appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appointment


@router.post("/{appointment_id}/reschedule", response_model=AppointmentResponse)
async def reschedule_appointment(
    appointment_id: UUID,
    request: RescheduleRequest,
    db: AsyncSession = Depends(get_db)
):
    """Reschedule an appointment"""
    service = AppointmentService(db)
    try:
        appointment = await service.reschedule_appointment(
            appointment_id=appointment_id,
            new_start_time=request.new_start_time
        )
        if not appointment:
            raise HTTPException(
                status_code=400,
                detail="Appointment not found or cannot be rescheduled"
            )
        return appointment
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{appointment_id}/cancel", response_model=AppointmentResponse)
async def cancel_appointment(
    appointment_id: UUID,
    request: CancelRequest,
    cancelled_by: str = Query(..., regex="^(host|guest)$"),
    db: AsyncSession = Depends(get_db)
):
    """Cancel an appointment"""
    service = AppointmentService(db)
    appointment = await service.cancel_appointment(
        appointment_id=appointment_id,
        cancelled_by=cancelled_by,
        reason=request.reason
    )
    if not appointment:
        raise HTTPException(
            status_code=400,
            detail="Appointment not found or already cancelled"
        )
    return appointment


# =============================================
# Statistics
# =============================================

@router.get("/stats/{host_id}")
async def get_booking_stats(
    host_id: UUID,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get booking statistics for a host"""
    service = AppointmentService(db)
    stats = await service.get_booking_stats(
        host_id=host_id,
        start_date=start_date,
        end_date=end_date
    )
    return stats


# =============================================
# Public Booking Page
# =============================================

@router.get("/public/{user_id}/{slug}")
async def get_public_booking_page(
    user_id: UUID,
    slug: str,
    db: AsyncSession = Depends(get_db)
):
    """Get public booking page data"""
    service = AppointmentService(db)
    apt_type = await service.get_appointment_type_by_slug(user_id, slug)
    if not apt_type:
        raise HTTPException(status_code=404, detail="Booking page not found")

    # Return public-safe data
    return {
        "id": apt_type.id,
        "name": apt_type.name,
        "description": apt_type.description,
        "duration_minutes": apt_type.duration_minutes,
        "color": apt_type.color,
        "location_type": apt_type.location_type,
        "questions": apt_type.questions,
        "availability": apt_type.availability,
        "min_notice_hours": apt_type.min_notice_hours,
        "max_days_ahead": apt_type.max_days_ahead
    }
