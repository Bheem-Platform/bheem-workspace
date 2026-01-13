"""
Bheem Workspace - Resource Booking API
Meeting room and equipment booking system.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date, time, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from uuid import UUID

from core.database import get_db
from core.security import get_current_user, require_tenant_admin, require_tenant_member
from models.admin_models import Resource, ResourceBooking
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/resources", tags=["Resource Booking"])


# Schemas
class ResourceCreate(BaseModel):
    """Request to create a resource."""
    name: str
    resource_type: str  # room, equipment, vehicle
    capacity: Optional[int] = None
    location: Optional[str] = None
    description: Optional[str] = None
    available_from: Optional[str] = "09:00"
    available_until: Optional[str] = "18:00"
    available_days: Optional[List[int]] = [1, 2, 3, 4, 5]
    requires_approval: bool = False
    min_booking_minutes: int = 30
    max_booking_minutes: int = 480


class ResourceResponse(BaseModel):
    """Resource response."""
    id: str
    name: str
    resource_type: str
    capacity: Optional[int]
    location: Optional[str]
    description: Optional[str]
    is_active: bool


class BookingCreate(BaseModel):
    """Request to create a booking."""
    title: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    create_meeting: bool = False  # Create a Meet room for this booking


class BookingResponse(BaseModel):
    """Booking response."""
    id: str
    resource_id: str
    resource_name: str
    title: str
    start_time: datetime
    end_time: datetime
    status: str
    booked_by_name: Optional[str]
    meeting_room_code: Optional[str]


class TimeSlot(BaseModel):
    """Available time slot."""
    start: str
    end: str
    available: bool


# Endpoints
@router.get("")
async def list_resources(
    resource_type: Optional[str] = None,
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
):
    """
    List available resources for the tenant.
    Filter by type if specified.
    """
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not associated with a workspace"
        )

    query = select(Resource).where(
        Resource.tenant_id == tenant_id,
        Resource.is_active == True
    )

    if resource_type:
        query = query.where(Resource.resource_type == resource_type)

    result = await db.execute(query)
    resources = result.scalars().all()

    return {
        "resources": [
            {
                "id": str(r.id),
                "name": r.name,
                "resource_type": r.resource_type,
                "capacity": r.capacity,
                "location": r.location,
                "description": r.description,
                "available_from": r.available_from,
                "available_until": r.available_until,
                "available_days": r.available_days,
                "requires_approval": r.requires_approval
            }
            for r in resources
        ],
        "count": len(resources)
    }


@router.post("", response_model=ResourceResponse)
async def create_resource(
    resource: ResourceCreate,
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new resource.
    Requires workspace admin role.
    """
    tenant_id = current_user.get("tenant_id")
    user_id = current_user.get("id") or current_user.get("user_id")

    new_resource = Resource(
        tenant_id=tenant_id,
        name=resource.name,
        resource_type=resource.resource_type,
        capacity=resource.capacity,
        location=resource.location,
        description=resource.description,
        available_from=resource.available_from,
        available_until=resource.available_until,
        available_days=resource.available_days,
        requires_approval=resource.requires_approval,
        min_booking_minutes=resource.min_booking_minutes,
        max_booking_minutes=resource.max_booking_minutes,
        created_by=user_id
    )

    db.add(new_resource)
    await db.commit()
    await db.refresh(new_resource)

    return ResourceResponse(
        id=str(new_resource.id),
        name=new_resource.name,
        resource_type=new_resource.resource_type,
        capacity=new_resource.capacity,
        location=new_resource.location,
        description=new_resource.description,
        is_active=new_resource.is_active
    )


@router.get("/{resource_id}")
async def get_resource(
    resource_id: str,
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
):
    """Get resource details."""
    tenant_id = current_user.get("tenant_id")

    result = await db.execute(
        select(Resource).where(
            Resource.id == resource_id,
            Resource.tenant_id == tenant_id
        )
    )
    resource = result.scalar_one_or_none()

    if not resource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resource not found"
        )

    return {
        "id": str(resource.id),
        "name": resource.name,
        "resource_type": resource.resource_type,
        "capacity": resource.capacity,
        "location": resource.location,
        "description": resource.description,
        "available_from": resource.available_from,
        "available_until": resource.available_until,
        "available_days": resource.available_days,
        "requires_approval": resource.requires_approval,
        "is_active": resource.is_active
    }


@router.get("/{resource_id}/availability")
async def get_availability(
    resource_id: str,
    date_str: str = Query(..., description="Date in YYYY-MM-DD format"),
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
):
    """
    Get available time slots for a resource on a specific date.
    Returns slots in 30-minute increments.
    """
    tenant_id = current_user.get("tenant_id")

    # Get resource
    result = await db.execute(
        select(Resource).where(
            Resource.id == resource_id,
            Resource.tenant_id == tenant_id
        )
    )
    resource = result.scalar_one_or_none()

    if not resource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resource not found"
        )

    # Parse date
    try:
        check_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid date format. Use YYYY-MM-DD"
        )

    # Check if day is available
    day_of_week = check_date.isoweekday()  # 1=Monday, 7=Sunday
    if day_of_week not in (resource.available_days or [1, 2, 3, 4, 5]):
        return {
            "resource_id": resource_id,
            "date": date_str,
            "available": False,
            "reason": "Resource not available on this day",
            "slots": []
        }

    # Get existing bookings for this date
    start_of_day = datetime.combine(check_date, time.min)
    end_of_day = datetime.combine(check_date, time.max)

    bookings_result = await db.execute(
        select(ResourceBooking).where(
            ResourceBooking.resource_id == resource_id,
            ResourceBooking.status != "cancelled",
            ResourceBooking.start_time >= start_of_day,
            ResourceBooking.end_time <= end_of_day
        )
    )
    bookings = bookings_result.scalars().all()

    # Generate time slots
    slots = []
    available_from = datetime.strptime(resource.available_from or "09:00", "%H:%M").time()
    available_until = datetime.strptime(resource.available_until or "18:00", "%H:%M").time()

    current_time = datetime.combine(check_date, available_from)
    end_time = datetime.combine(check_date, available_until)

    while current_time < end_time:
        slot_end = current_time + timedelta(minutes=30)

        # Check if slot is booked
        is_booked = False
        for booking in bookings:
            if booking.start_time < slot_end and booking.end_time > current_time:
                is_booked = True
                break

        slots.append({
            "start": current_time.strftime("%H:%M"),
            "end": slot_end.strftime("%H:%M"),
            "available": not is_booked
        })

        current_time = slot_end

    return {
        "resource_id": resource_id,
        "resource_name": resource.name,
        "date": date_str,
        "available_from": resource.available_from,
        "available_until": resource.available_until,
        "slots": slots,
        "existing_bookings": len(bookings)
    }


@router.post("/{resource_id}/book")
async def book_resource(
    resource_id: str,
    booking: BookingCreate,
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
):
    """
    Book a resource for a time slot.
    Optionally creates a Meet room for the booking.
    """
    tenant_id = current_user.get("tenant_id")
    user_id = current_user.get("id") or current_user.get("user_id")
    user_name = current_user.get("name") or current_user.get("username") or "Unknown"

    # Get resource
    result = await db.execute(
        select(Resource).where(
            Resource.id == resource_id,
            Resource.tenant_id == tenant_id,
            Resource.is_active == True
        )
    )
    resource = result.scalar_one_or_none()

    if not resource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resource not found"
        )

    # Validate times
    if booking.end_time <= booking.start_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End time must be after start time"
        )

    # Check for conflicts
    conflicts_result = await db.execute(
        select(ResourceBooking).where(
            ResourceBooking.resource_id == resource_id,
            ResourceBooking.status != "cancelled",
            or_(
                and_(
                    ResourceBooking.start_time <= booking.start_time,
                    ResourceBooking.end_time > booking.start_time
                ),
                and_(
                    ResourceBooking.start_time < booking.end_time,
                    ResourceBooking.end_time >= booking.end_time
                ),
                and_(
                    ResourceBooking.start_time >= booking.start_time,
                    ResourceBooking.end_time <= booking.end_time
                )
            )
        )
    )
    conflicts = conflicts_result.scalars().all()

    if conflicts:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Time slot is already booked"
        )

    # Create meeting room code if requested
    meeting_room_code = None
    if booking.create_meeting:
        import uuid
        meeting_room_code = f"room-{uuid.uuid4().hex[:8]}"

    # Determine initial status
    status_value = "pending" if resource.requires_approval else "confirmed"

    # Create booking
    new_booking = ResourceBooking(
        resource_id=resource_id,
        booked_by=user_id,
        booked_by_name=user_name,
        title=booking.title,
        description=booking.description,
        start_time=booking.start_time,
        end_time=booking.end_time,
        status=status_value,
        meeting_room_code=meeting_room_code
    )

    db.add(new_booking)
    await db.commit()
    await db.refresh(new_booking)

    return {
        "success": True,
        "booking": {
            "id": str(new_booking.id),
            "resource_id": str(resource_id),
            "resource_name": resource.name,
            "title": new_booking.title,
            "start_time": new_booking.start_time.isoformat(),
            "end_time": new_booking.end_time.isoformat(),
            "status": new_booking.status,
            "meeting_room_code": meeting_room_code
        }
    }


@router.get("/{resource_id}/bookings")
async def list_resource_bookings(
    resource_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
):
    """List bookings for a resource."""
    tenant_id = current_user.get("tenant_id")

    # Verify resource belongs to tenant
    resource_result = await db.execute(
        select(Resource).where(
            Resource.id == resource_id,
            Resource.tenant_id == tenant_id
        )
    )
    resource = resource_result.scalar_one_or_none()

    if not resource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resource not found"
        )

    # Build query
    query = select(ResourceBooking).where(
        ResourceBooking.resource_id == resource_id,
        ResourceBooking.status != "cancelled"
    )

    if start_date:
        try:
            start = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.where(ResourceBooking.start_time >= start)
        except ValueError:
            pass

    if end_date:
        try:
            end = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
            query = query.where(ResourceBooking.end_time <= end)
        except ValueError:
            pass

    query = query.order_by(ResourceBooking.start_time)

    result = await db.execute(query)
    bookings = result.scalars().all()

    return {
        "resource_id": resource_id,
        "resource_name": resource.name,
        "bookings": [
            {
                "id": str(b.id),
                "title": b.title,
                "start_time": b.start_time.isoformat(),
                "end_time": b.end_time.isoformat(),
                "status": b.status,
                "booked_by": b.booked_by_name,
                "meeting_room_code": b.meeting_room_code
            }
            for b in bookings
        ],
        "count": len(bookings)
    }


@router.delete("/bookings/{booking_id}")
async def cancel_booking(
    booking_id: str,
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
):
    """Cancel a booking."""
    tenant_id = current_user.get("tenant_id")
    user_id = current_user.get("id") or current_user.get("user_id")

    # Get booking with resource check
    result = await db.execute(
        select(ResourceBooking).join(Resource).where(
            ResourceBooking.id == booking_id,
            Resource.tenant_id == tenant_id
        )
    )
    booking = result.scalar_one_or_none()

    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )

    # Check if user owns booking or is admin
    user_role = current_user.get("tenant_role", "member")
    if str(booking.booked_by) != str(user_id) and user_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only cancel your own bookings"
        )

    # Cancel booking
    booking.status = "cancelled"
    booking.cancelled_at = datetime.utcnow()
    booking.updated_at = datetime.utcnow()

    await db.commit()

    return {
        "success": True,
        "message": "Booking cancelled",
        "booking_id": booking_id
    }


@router.get("/my/bookings")
async def get_my_bookings(
    status_filter: Optional[str] = None,
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
):
    """Get current user's bookings."""
    tenant_id = current_user.get("tenant_id")
    user_id = current_user.get("id") or current_user.get("user_id")

    query = select(ResourceBooking).join(Resource).where(
        Resource.tenant_id == tenant_id,
        ResourceBooking.booked_by == user_id
    )

    if status_filter:
        query = query.where(ResourceBooking.status == status_filter)
    else:
        query = query.where(ResourceBooking.status != "cancelled")

    query = query.order_by(ResourceBooking.start_time.desc())

    result = await db.execute(query)
    bookings = result.scalars().all()

    return {
        "bookings": [
            {
                "id": str(b.id),
                "resource_id": str(b.resource_id),
                "title": b.title,
                "start_time": b.start_time.isoformat(),
                "end_time": b.end_time.isoformat(),
                "status": b.status,
                "meeting_room_code": b.meeting_room_code
            }
            for b in bookings
        ],
        "count": len(bookings)
    }
