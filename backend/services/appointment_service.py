"""
Bheem Workspace - Appointment Scheduling Service
Business logic for Calendly-like appointment booking
"""
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime, timedelta, date, time
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, or_
from sqlalchemy.orm import selectinload

from models.calendar_models import AppointmentType, ScheduledAppointment


class AppointmentService:
    """Service for managing appointment types and bookings"""

    def __init__(self, db: AsyncSession):
        self.db = db

    # =============================================
    # Appointment Types
    # =============================================

    async def create_appointment_type(
        self,
        tenant_id: UUID,
        user_id: UUID,
        name: str,
        slug: str,
        duration_minutes: int = 30,
        description: Optional[str] = None,
        color: Optional[str] = None,
        location_type: str = 'meet',
        custom_location: Optional[str] = None,
        availability: Optional[Dict] = None,
        questions: Optional[List[Dict]] = None,
        buffer_before_minutes: int = 0,
        buffer_after_minutes: int = 0,
        min_notice_hours: int = 24,
        max_days_ahead: int = 60
    ) -> AppointmentType:
        """Create a new appointment type"""
        # Ensure slug is URL-safe
        slug = slug.lower().replace(' ', '-')

        appointment_type = AppointmentType(
            tenant_id=tenant_id,
            user_id=user_id,
            name=name,
            slug=slug,
            description=description,
            duration_minutes=duration_minutes,
            color=color,
            location_type=location_type,
            custom_location=custom_location,
            availability=availability or self._default_availability(),
            questions=questions or [],
            buffer_before_minutes=buffer_before_minutes,
            buffer_after_minutes=buffer_after_minutes,
            min_notice_hours=min_notice_hours,
            max_days_ahead=max_days_ahead,
            is_active=True
        )

        self.db.add(appointment_type)
        await self.db.commit()
        await self.db.refresh(appointment_type)
        return appointment_type

    def _default_availability(self) -> Dict:
        """Get default working hours availability"""
        return {
            'monday': {'enabled': True, 'start': '09:00', 'end': '17:00'},
            'tuesday': {'enabled': True, 'start': '09:00', 'end': '17:00'},
            'wednesday': {'enabled': True, 'start': '09:00', 'end': '17:00'},
            'thursday': {'enabled': True, 'start': '09:00', 'end': '17:00'},
            'friday': {'enabled': True, 'start': '09:00', 'end': '17:00'},
            'saturday': {'enabled': False, 'start': '09:00', 'end': '17:00'},
            'sunday': {'enabled': False, 'start': '09:00', 'end': '17:00'}
        }

    async def get_appointment_type(
        self,
        appointment_type_id: UUID
    ) -> Optional[AppointmentType]:
        """Get an appointment type by ID"""
        result = await self.db.execute(
            select(AppointmentType)
            .options(selectinload(AppointmentType.appointments))
            .where(AppointmentType.id == appointment_type_id)
        )
        return result.scalar_one_or_none()

    async def get_appointment_type_by_slug(
        self,
        user_id: UUID,
        slug: str
    ) -> Optional[AppointmentType]:
        """Get an appointment type by user and slug"""
        result = await self.db.execute(
            select(AppointmentType).where(
                AppointmentType.user_id == user_id,
                AppointmentType.slug == slug,
                AppointmentType.is_active == True
            )
        )
        return result.scalar_one_or_none()

    async def list_appointment_types(
        self,
        user_id: UUID,
        active_only: bool = True
    ) -> List[AppointmentType]:
        """List all appointment types for a user"""
        query = select(AppointmentType).where(
            AppointmentType.user_id == user_id
        )

        if active_only:
            query = query.where(AppointmentType.is_active == True)

        query = query.order_by(AppointmentType.created_at.desc())

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update_appointment_type(
        self,
        appointment_type_id: UUID,
        user_id: UUID,
        **updates
    ) -> Optional[AppointmentType]:
        """Update an appointment type"""
        apt = await self.db.execute(
            select(AppointmentType).where(
                AppointmentType.id == appointment_type_id,
                AppointmentType.user_id == user_id
            )
        )
        appointment_type = apt.scalar_one_or_none()

        if not appointment_type:
            return None

        allowed_fields = [
            'name', 'slug', 'description', 'duration_minutes', 'color',
            'location_type', 'custom_location', 'availability', 'questions',
            'buffer_before_minutes', 'buffer_after_minutes',
            'min_notice_hours', 'max_days_ahead', 'is_active',
            'confirmation_email_template', 'reminder_email_template'
        ]

        for field, value in updates.items():
            if field in allowed_fields and value is not None:
                setattr(appointment_type, field, value)

        appointment_type.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(appointment_type)
        return appointment_type

    async def delete_appointment_type(
        self,
        appointment_type_id: UUID,
        user_id: UUID
    ) -> bool:
        """Delete an appointment type"""
        result = await self.db.execute(
            delete(AppointmentType).where(
                AppointmentType.id == appointment_type_id,
                AppointmentType.user_id == user_id
            )
        )
        await self.db.commit()
        return result.rowcount > 0

    # =============================================
    # Available Slots
    # =============================================

    async def get_available_slots(
        self,
        appointment_type_id: UUID,
        start_date: date,
        end_date: date,
        timezone: str = 'UTC'
    ) -> Dict[str, List[Dict[str, str]]]:
        """Get available time slots for booking"""
        appointment_type = await self.get_appointment_type(appointment_type_id)
        if not appointment_type or not appointment_type.is_active:
            return {}

        # Get existing appointments in the date range
        existing_appointments = await self._get_appointments_in_range(
            appointment_type.user_id,
            datetime.combine(start_date, time.min),
            datetime.combine(end_date, time.max)
        )

        # Build blocked time slots
        blocked_slots = []
        for apt in existing_appointments:
            buffer_start = apt.start_time - timedelta(
                minutes=appointment_type.buffer_before_minutes
            )
            buffer_end = apt.end_time + timedelta(
                minutes=appointment_type.buffer_after_minutes
            )
            blocked_slots.append((buffer_start, buffer_end))

        # Generate available slots
        availability = appointment_type.availability or {}
        duration = appointment_type.duration_minutes
        min_notice = timedelta(hours=appointment_type.min_notice_hours)
        now = datetime.utcnow()

        available_slots = {}
        current_date = start_date

        while current_date <= end_date:
            day_name = current_date.strftime('%A').lower()
            day_config = availability.get(day_name, {})

            if day_config.get('enabled', False):
                day_slots = []
                start_time_str = day_config.get('start', '09:00')
                end_time_str = day_config.get('end', '17:00')

                start_hour, start_min = map(int, start_time_str.split(':'))
                end_hour, end_min = map(int, end_time_str.split(':'))

                slot_start = datetime.combine(
                    current_date,
                    time(start_hour, start_min)
                )
                day_end = datetime.combine(
                    current_date,
                    time(end_hour, end_min)
                )

                while slot_start + timedelta(minutes=duration) <= day_end:
                    slot_end = slot_start + timedelta(minutes=duration)

                    # Check minimum notice
                    if slot_start < now + min_notice:
                        slot_start = slot_end
                        continue

                    # Check if slot conflicts with existing appointments
                    is_blocked = False
                    for blocked_start, blocked_end in blocked_slots:
                        if (slot_start < blocked_end and slot_end > blocked_start):
                            is_blocked = True
                            break

                    if not is_blocked:
                        day_slots.append({
                            'start': slot_start.isoformat(),
                            'end': slot_end.isoformat()
                        })

                    slot_start = slot_end

                if day_slots:
                    available_slots[current_date.isoformat()] = day_slots

            current_date += timedelta(days=1)

        return available_slots

    async def _get_appointments_in_range(
        self,
        host_id: UUID,
        start: datetime,
        end: datetime
    ) -> List[ScheduledAppointment]:
        """Get all appointments for a host in a date range"""
        result = await self.db.execute(
            select(ScheduledAppointment).where(
                ScheduledAppointment.host_id == host_id,
                ScheduledAppointment.status == 'confirmed',
                ScheduledAppointment.start_time >= start,
                ScheduledAppointment.end_time <= end
            )
        )
        return list(result.scalars().all())

    # =============================================
    # Appointment Bookings
    # =============================================

    async def book_appointment(
        self,
        appointment_type_id: UUID,
        guest_email: str,
        start_time: datetime,
        guest_name: Optional[str] = None,
        guest_timezone: Optional[str] = None,
        answers: Optional[Dict] = None,
        notes: Optional[str] = None
    ) -> Optional[ScheduledAppointment]:
        """Book an appointment"""
        appointment_type = await self.get_appointment_type(appointment_type_id)
        if not appointment_type or not appointment_type.is_active:
            return None

        # Calculate end time
        end_time = start_time + timedelta(
            minutes=appointment_type.duration_minutes
        )

        # Verify slot is still available
        is_available = await self._is_slot_available(
            appointment_type.user_id,
            start_time,
            end_time,
            appointment_type.buffer_before_minutes,
            appointment_type.buffer_after_minutes
        )

        if not is_available:
            raise ValueError("Selected time slot is no longer available")

        # Create the appointment
        appointment = ScheduledAppointment(
            appointment_type_id=appointment_type_id,
            host_id=appointment_type.user_id,
            guest_email=guest_email,
            guest_name=guest_name,
            guest_timezone=guest_timezone,
            start_time=start_time,
            end_time=end_time,
            status='confirmed',
            answers=answers or {},
            notes=notes
        )

        self.db.add(appointment)
        await self.db.commit()
        await self.db.refresh(appointment)

        # TODO: Send confirmation emails, create calendar event, etc.

        return appointment

    async def _is_slot_available(
        self,
        host_id: UUID,
        start_time: datetime,
        end_time: datetime,
        buffer_before: int,
        buffer_after: int
    ) -> bool:
        """Check if a time slot is available"""
        check_start = start_time - timedelta(minutes=buffer_before)
        check_end = end_time + timedelta(minutes=buffer_after)

        result = await self.db.execute(
            select(ScheduledAppointment).where(
                ScheduledAppointment.host_id == host_id,
                ScheduledAppointment.status == 'confirmed',
                or_(
                    and_(
                        ScheduledAppointment.start_time < check_end,
                        ScheduledAppointment.end_time > check_start
                    )
                )
            )
        )

        conflicts = result.scalars().all()
        return len(list(conflicts)) == 0

    async def get_appointment(
        self,
        appointment_id: UUID
    ) -> Optional[ScheduledAppointment]:
        """Get an appointment by ID"""
        result = await self.db.execute(
            select(ScheduledAppointment)
            .options(selectinload(ScheduledAppointment.appointment_type))
            .where(ScheduledAppointment.id == appointment_id)
        )
        return result.scalar_one_or_none()

    async def list_host_appointments(
        self,
        host_id: UUID,
        status: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        skip: int = 0,
        limit: int = 50
    ) -> List[ScheduledAppointment]:
        """List appointments for a host"""
        query = select(ScheduledAppointment).where(
            ScheduledAppointment.host_id == host_id
        )

        if status:
            query = query.where(ScheduledAppointment.status == status)

        if start_date:
            query = query.where(
                ScheduledAppointment.start_time >= datetime.combine(
                    start_date, time.min
                )
            )

        if end_date:
            query = query.where(
                ScheduledAppointment.end_time <= datetime.combine(
                    end_date, time.max
                )
            )

        query = query.order_by(ScheduledAppointment.start_time.asc())
        query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def cancel_appointment(
        self,
        appointment_id: UUID,
        cancelled_by: str,  # 'host' or 'guest'
        reason: Optional[str] = None
    ) -> Optional[ScheduledAppointment]:
        """Cancel an appointment"""
        appointment = await self.get_appointment(appointment_id)
        if not appointment or appointment.status != 'confirmed':
            return None

        appointment.status = 'cancelled'
        appointment.cancelled_at = datetime.utcnow()
        appointment.cancellation_reason = f"[{cancelled_by}] {reason}" if reason else f"Cancelled by {cancelled_by}"

        await self.db.commit()
        await self.db.refresh(appointment)

        # TODO: Send cancellation emails, remove calendar event, etc.

        return appointment

    async def reschedule_appointment(
        self,
        appointment_id: UUID,
        new_start_time: datetime
    ) -> Optional[ScheduledAppointment]:
        """Reschedule an appointment"""
        appointment = await self.get_appointment(appointment_id)
        if not appointment or appointment.status != 'confirmed':
            return None

        appointment_type = await self.get_appointment_type(
            appointment.appointment_type_id
        )
        if not appointment_type:
            return None

        new_end_time = new_start_time + timedelta(
            minutes=appointment_type.duration_minutes
        )

        # Check availability (excluding current appointment)
        is_available = await self._is_slot_available(
            appointment.host_id,
            new_start_time,
            new_end_time,
            appointment_type.buffer_before_minutes,
            appointment_type.buffer_after_minutes
        )

        if not is_available:
            raise ValueError("New time slot is not available")

        appointment.start_time = new_start_time
        appointment.end_time = new_end_time

        await self.db.commit()
        await self.db.refresh(appointment)

        # TODO: Update calendar event, send notification emails

        return appointment

    # =============================================
    # Statistics
    # =============================================

    async def get_booking_stats(
        self,
        host_id: UUID,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """Get booking statistics for a host"""
        from sqlalchemy import func

        query = select(
            func.count(ScheduledAppointment.id).label('total'),
            func.sum(
                func.case(
                    (ScheduledAppointment.status == 'confirmed', 1),
                    else_=0
                )
            ).label('confirmed'),
            func.sum(
                func.case(
                    (ScheduledAppointment.status == 'cancelled', 1),
                    else_=0
                )
            ).label('cancelled')
        ).where(
            ScheduledAppointment.host_id == host_id
        )

        if start_date:
            query = query.where(
                ScheduledAppointment.start_time >= datetime.combine(
                    start_date, time.min
                )
            )

        if end_date:
            query = query.where(
                ScheduledAppointment.end_time <= datetime.combine(
                    end_date, time.max
                )
            )

        result = await self.db.execute(query)
        row = result.one()

        return {
            'total_appointments': row.total or 0,
            'confirmed': row.confirmed or 0,
            'cancelled': row.cancelled or 0,
            'completion_rate': (
                round((row.confirmed or 0) / row.total * 100, 1)
                if row.total else 0
            )
        }
