"""
Bheem Workspace - Enhanced Calendar Service
Service for world clock, focus time, and time insights
Phase 10: Calendar Enhancements
"""
from typing import Optional, List, Dict
from uuid import UUID
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, func
import pytz

from models.calendar_models import (
    UserCalendarSettings,
    FocusTimeBlock,
    CalendarTimeInsight
)


# Common timezones for world clock suggestions
COMMON_TIMEZONES = [
    {"id": "America/New_York", "name": "New York", "abbr": "EST/EDT"},
    {"id": "America/Los_Angeles", "name": "Los Angeles", "abbr": "PST/PDT"},
    {"id": "America/Chicago", "name": "Chicago", "abbr": "CST/CDT"},
    {"id": "Europe/London", "name": "London", "abbr": "GMT/BST"},
    {"id": "Europe/Paris", "name": "Paris", "abbr": "CET/CEST"},
    {"id": "Europe/Berlin", "name": "Berlin", "abbr": "CET/CEST"},
    {"id": "Asia/Tokyo", "name": "Tokyo", "abbr": "JST"},
    {"id": "Asia/Shanghai", "name": "Shanghai", "abbr": "CST"},
    {"id": "Asia/Singapore", "name": "Singapore", "abbr": "SGT"},
    {"id": "Asia/Dubai", "name": "Dubai", "abbr": "GST"},
    {"id": "Asia/Kolkata", "name": "Mumbai", "abbr": "IST"},
    {"id": "Australia/Sydney", "name": "Sydney", "abbr": "AEST/AEDT"},
    {"id": "Pacific/Auckland", "name": "Auckland", "abbr": "NZST/NZDT"},
]


class CalendarEnhancedService:
    """Service for enhanced calendar features"""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ═══════════════════════════════════════════════════════════════════
    # World Clock
    # ═══════════════════════════════════════════════════════════════════

    def get_world_clock_times(
        self,
        timezones: List[str],
        reference_time: Optional[datetime] = None
    ) -> List[dict]:
        """Get current times for a list of timezones"""
        if reference_time is None:
            reference_time = datetime.utcnow()

        utc_time = pytz.UTC.localize(reference_time)
        result = []

        for tz_id in timezones:
            try:
                tz = pytz.timezone(tz_id)
                local_time = utc_time.astimezone(tz)

                # Find timezone info from common list
                tz_info = next(
                    (t for t in COMMON_TIMEZONES if t["id"] == tz_id),
                    {"id": tz_id, "name": tz_id.split("/")[-1], "abbr": ""}
                )

                result.append({
                    "timezone_id": tz_id,
                    "name": tz_info["name"],
                    "abbreviation": tz_info["abbr"],
                    "time": local_time.strftime("%H:%M"),
                    "date": local_time.strftime("%Y-%m-%d"),
                    "day_of_week": local_time.strftime("%A"),
                    "offset": local_time.strftime("%z"),
                    "is_dst": bool(local_time.dst())
                })
            except Exception:
                continue

        return result

    def get_common_timezones(self) -> List[dict]:
        """Get list of common timezones for selection"""
        return COMMON_TIMEZONES

    def search_timezones(self, query: str) -> List[dict]:
        """Search for timezones by name or city"""
        query = query.lower()
        results = []

        for tz_name in pytz.all_timezones:
            if query in tz_name.lower():
                city = tz_name.split("/")[-1].replace("_", " ")
                results.append({
                    "id": tz_name,
                    "name": city,
                    "full_name": tz_name
                })
                if len(results) >= 20:
                    break

        return results

    async def update_world_clock_timezones(
        self,
        user_id: UUID,
        timezones: List[str]
    ) -> UserCalendarSettings:
        """Update user's world clock timezone list"""
        settings = await self._get_or_create_settings(user_id)

        await self.db.execute(
            update(UserCalendarSettings)
            .where(UserCalendarSettings.user_id == user_id)
            .values(world_clock_timezones=timezones)
        )
        await self.db.commit()

        settings.world_clock_timezones = timezones
        return settings

    # ═══════════════════════════════════════════════════════════════════
    # Dual Timezone
    # ═══════════════════════════════════════════════════════════════════

    async def set_secondary_timezone(
        self,
        user_id: UUID,
        timezone: Optional[str],
        show: bool = True
    ) -> UserCalendarSettings:
        """Set secondary timezone for dual view"""
        settings = await self._get_or_create_settings(user_id)

        await self.db.execute(
            update(UserCalendarSettings)
            .where(UserCalendarSettings.user_id == user_id)
            .values(
                secondary_timezone=timezone,
                show_secondary_timezone=show
            )
        )
        await self.db.commit()

        settings.secondary_timezone = timezone
        settings.show_secondary_timezone = show
        return settings

    def convert_time_between_zones(
        self,
        time: datetime,
        from_tz: str,
        to_tz: str
    ) -> dict:
        """Convert time between timezones"""
        try:
            from_zone = pytz.timezone(from_tz)
            to_zone = pytz.timezone(to_tz)

            if time.tzinfo is None:
                local_time = from_zone.localize(time)
            else:
                local_time = time.astimezone(from_zone)

            converted = local_time.astimezone(to_zone)

            return {
                "original": {
                    "time": local_time.strftime("%Y-%m-%d %H:%M"),
                    "timezone": from_tz,
                    "offset": local_time.strftime("%z")
                },
                "converted": {
                    "time": converted.strftime("%Y-%m-%d %H:%M"),
                    "timezone": to_tz,
                    "offset": converted.strftime("%z")
                }
            }
        except Exception as e:
            return {"error": str(e)}

    # ═══════════════════════════════════════════════════════════════════
    # Focus Time
    # ═══════════════════════════════════════════════════════════════════

    async def create_focus_block(
        self,
        user_id: UUID,
        start_time: datetime,
        end_time: datetime,
        title: str = "Focus Time",
        auto_decline: bool = False,
        show_as_busy: bool = True
    ) -> FocusTimeBlock:
        """Create a focus time block"""
        block = FocusTimeBlock(
            user_id=user_id,
            title=title,
            start_time=start_time,
            end_time=end_time,
            auto_decline_meetings=auto_decline,
            show_as_busy=show_as_busy,
            status='scheduled'
        )

        self.db.add(block)
        await self.db.commit()
        await self.db.refresh(block)
        return block

    async def get_focus_blocks(
        self,
        user_id: UUID,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[FocusTimeBlock]:
        """Get focus time blocks for a user"""
        query = select(FocusTimeBlock).where(
            FocusTimeBlock.user_id == user_id
        )

        if start_date:
            query = query.where(FocusTimeBlock.start_time >= start_date)
        if end_date:
            query = query.where(FocusTimeBlock.end_time <= end_date)

        query = query.order_by(FocusTimeBlock.start_time.asc())

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update_focus_block(
        self,
        block_id: UUID,
        user_id: UUID,
        **kwargs
    ) -> Optional[FocusTimeBlock]:
        """Update a focus block"""
        result = await self.db.execute(
            select(FocusTimeBlock).where(
                and_(
                    FocusTimeBlock.id == block_id,
                    FocusTimeBlock.user_id == user_id
                )
            )
        )
        block = result.scalar_one_or_none()

        if not block:
            return None

        for key, value in kwargs.items():
            if hasattr(block, key):
                setattr(block, key, value)

        await self.db.commit()
        await self.db.refresh(block)
        return block

    async def complete_focus_block(
        self,
        block_id: UUID,
        user_id: UUID,
        was_interrupted: bool = False,
        actual_minutes: Optional[int] = None
    ) -> bool:
        """Mark a focus block as completed"""
        result = await self.db.execute(
            update(FocusTimeBlock)
            .where(
                and_(
                    FocusTimeBlock.id == block_id,
                    FocusTimeBlock.user_id == user_id
                )
            )
            .values(
                status='completed',
                was_interrupted=was_interrupted,
                actual_focus_minutes=actual_minutes,
                completed_at=datetime.utcnow()
            )
        )
        await self.db.commit()
        return result.rowcount > 0

    async def delete_focus_block(
        self,
        block_id: UUID,
        user_id: UUID
    ) -> bool:
        """Delete a focus block"""
        result = await self.db.execute(
            delete(FocusTimeBlock).where(
                and_(
                    FocusTimeBlock.id == block_id,
                    FocusTimeBlock.user_id == user_id
                )
            )
        )
        await self.db.commit()
        return result.rowcount > 0

    async def update_focus_settings(
        self,
        user_id: UUID,
        **kwargs
    ) -> UserCalendarSettings:
        """Update focus time preferences"""
        settings = await self._get_or_create_settings(user_id)

        update_values = {}
        allowed_fields = [
            'focus_time_enabled', 'focus_time_duration',
            'focus_time_days', 'focus_time_start',
            'focus_time_end', 'focus_time_auto_decline'
        ]

        for key, value in kwargs.items():
            if key in allowed_fields:
                update_values[key] = value

        if update_values:
            await self.db.execute(
                update(UserCalendarSettings)
                .where(UserCalendarSettings.user_id == user_id)
                .values(**update_values)
            )
            await self.db.commit()

        return await self._get_or_create_settings(user_id)

    # ═══════════════════════════════════════════════════════════════════
    # Time Insights
    # ═══════════════════════════════════════════════════════════════════

    async def get_time_insights(
        self,
        user_id: UUID,
        week_start: datetime
    ) -> Optional[CalendarTimeInsight]:
        """Get time insights for a specific week"""
        result = await self.db.execute(
            select(CalendarTimeInsight).where(
                and_(
                    CalendarTimeInsight.user_id == user_id,
                    CalendarTimeInsight.week_start == week_start
                )
            )
        )
        return result.scalar_one_or_none()

    async def get_recent_insights(
        self,
        user_id: UUID,
        weeks: int = 4
    ) -> List[CalendarTimeInsight]:
        """Get recent time insights"""
        cutoff = datetime.utcnow() - timedelta(weeks=weeks)

        result = await self.db.execute(
            select(CalendarTimeInsight)
            .where(
                and_(
                    CalendarTimeInsight.user_id == user_id,
                    CalendarTimeInsight.week_start >= cutoff
                )
            )
            .order_by(CalendarTimeInsight.week_start.desc())
        )
        return list(result.scalars().all())

    async def update_time_insights(
        self,
        user_id: UUID,
        week_start: datetime,
        metrics: Dict
    ) -> CalendarTimeInsight:
        """Update or create time insights for a week"""
        # Find Monday of the week
        monday = week_start - timedelta(days=week_start.weekday())
        sunday = monday + timedelta(days=6)

        result = await self.db.execute(
            select(CalendarTimeInsight).where(
                and_(
                    CalendarTimeInsight.user_id == user_id,
                    CalendarTimeInsight.week_start == monday
                )
            )
        )
        insight = result.scalar_one_or_none()

        if insight:
            for key, value in metrics.items():
                if hasattr(insight, key):
                    setattr(insight, key, value)
        else:
            insight = CalendarTimeInsight(
                user_id=user_id,
                week_start=monday,
                week_end=sunday,
                **metrics
            )
            self.db.add(insight)

        await self.db.commit()
        await self.db.refresh(insight)
        return insight

    async def get_insights_summary(
        self,
        user_id: UUID,
        weeks: int = 4
    ) -> dict:
        """Get aggregated insights summary"""
        insights = await self.get_recent_insights(user_id, weeks)

        if not insights:
            return {
                "total_meeting_hours": 0,
                "avg_meeting_hours_per_week": 0,
                "total_focus_hours": 0,
                "avg_focus_hours_per_week": 0,
                "meeting_trend": "stable",
                "focus_trend": "stable"
            }

        total_meeting = sum(i.total_meeting_hours or 0 for i in insights)
        total_focus = sum(i.total_focus_hours or 0 for i in insights)
        weeks_count = len(insights)

        # Calculate trend
        meeting_trend = "stable"
        focus_trend = "stable"

        if len(insights) >= 2:
            recent = insights[0]
            previous = insights[1]

            if recent.total_meeting_hours > previous.total_meeting_hours * 1.1:
                meeting_trend = "increasing"
            elif recent.total_meeting_hours < previous.total_meeting_hours * 0.9:
                meeting_trend = "decreasing"

            if recent.total_focus_hours > previous.total_focus_hours * 1.1:
                focus_trend = "increasing"
            elif recent.total_focus_hours < previous.total_focus_hours * 0.9:
                focus_trend = "decreasing"

        return {
            "total_meeting_hours": total_meeting // 60,  # Convert to hours
            "avg_meeting_hours_per_week": (total_meeting // weeks_count) // 60 if weeks_count else 0,
            "total_focus_hours": total_focus // 60,
            "avg_focus_hours_per_week": (total_focus // weeks_count) // 60 if weeks_count else 0,
            "meeting_trend": meeting_trend,
            "focus_trend": focus_trend,
            "weeks_analyzed": weeks_count
        }

    # ═══════════════════════════════════════════════════════════════════
    # Helper Methods
    # ═══════════════════════════════════════════════════════════════════

    async def _get_or_create_settings(self, user_id: UUID) -> UserCalendarSettings:
        """Get or create user calendar settings"""
        result = await self.db.execute(
            select(UserCalendarSettings).where(
                UserCalendarSettings.user_id == user_id
            )
        )
        settings = result.scalar_one_or_none()

        if not settings:
            settings = UserCalendarSettings(user_id=user_id)
            self.db.add(settings)
            await self.db.commit()
            await self.db.refresh(settings)

        return settings
