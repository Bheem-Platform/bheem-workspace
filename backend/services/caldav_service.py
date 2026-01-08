"""
Bheem Workspace - CalDAV Service
Calendar integration with Nextcloud CalDAV
Supports recurring events with RRULE (RFC 5545)
"""
import httpx
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import xml.etree.ElementTree as ET
from dateutil.rrule import rrule, DAILY, WEEKLY, MONTHLY, YEARLY, weekday
from dateutil.rrule import MO, TU, WE, TH, FR, SA, SU
from core.config import settings

# Frequency mapping for dateutil.rrule
FREQ_MAP = {
    'DAILY': DAILY,
    'WEEKLY': WEEKLY,
    'MONTHLY': MONTHLY,
    'YEARLY': YEARLY
}

# Weekday mapping for dateutil.rrule
WEEKDAY_MAP = {
    'MO': MO, 'TU': TU, 'WE': WE, 'TH': TH, 'FR': FR, 'SA': SA, 'SU': SU
}

class CalDAVService:
    def __init__(self):
        self.base_url = settings.NEXTCLOUD_URL
    
    def _get_caldav_url(self, username: str) -> str:
        return f"{self.base_url}/remote.php/dav/calendars/{username}"
    
    async def get_calendars(self, username: str, password: str) -> List[Dict[str, Any]]:
        """Get list of calendars for a user"""
        caldav_url = self._get_caldav_url(username)
        
        propfind_body = '''<?xml version="1.0"?>
        <d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/">
            <d:prop>
                <d:displayname/>
                <cs:getctag/>
                <d:resourcetype/>
                <c:supported-calendar-component-set/>
            </d:prop>
        </d:propfind>'''
        
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.request(
                method="PROPFIND",
                url=caldav_url,
                content=propfind_body,
                auth=(username, password),
                headers={"Depth": "1", "Content-Type": "application/xml"}
            )
            
            if response.status_code != 207:
                return []
            
            calendars = []
            root = ET.fromstring(response.content)
            ns = {
                "d": "DAV:",
                "c": "urn:ietf:params:xml:ns:caldav",
                "cs": "http://calendarserver.org/ns/"
            }
            
            for response_elem in root.findall(".//d:response", ns):
                href = response_elem.find("d:href", ns).text
                props = response_elem.find(".//d:prop", ns)
                
                # Check if it's a calendar (has calendar component)
                resource_type = props.find(".//d:resourcetype", ns)
                if resource_type is not None:
                    cal_elem = resource_type.find(".//c:calendar", ns)
                    if cal_elem is None:
                        continue
                
                displayname_elem = props.find("d:displayname", ns)
                name = displayname_elem.text if displayname_elem is not None else href.rstrip("/").split("/")[-1]
                
                if name and name != username:
                    calendars.append({
                        "id": href.rstrip("/").split("/")[-1],
                        "name": name,
                        "href": href
                    })
            
            return calendars
    
    async def get_events(
        self, 
        username: str, 
        password: str, 
        calendar_id: str,
        start: datetime,
        end: datetime
    ) -> List[Dict[str, Any]]:
        """Get calendar events within a time range"""
        caldav_url = f"{self._get_caldav_url(username)}/{calendar_id}/"
        
        start_str = start.strftime("%Y%m%dT%H%M%SZ")
        end_str = end.strftime("%Y%m%dT%H%M%SZ")
        
        report_body = f'''<?xml version="1.0"?>
        <c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
            <d:prop>
                <d:getetag/>
                <c:calendar-data/>
            </d:prop>
            <c:filter>
                <c:comp-filter name="VCALENDAR">
                    <c:comp-filter name="VEVENT">
                        <c:time-range start="{start_str}" end="{end_str}"/>
                    </c:comp-filter>
                </c:comp-filter>
            </c:filter>
        </c:calendar-query>'''
        
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.request(
                method="REPORT",
                url=caldav_url,
                content=report_body,
                auth=(username, password),
                headers={"Depth": "1", "Content-Type": "application/xml"}
            )
            
            if response.status_code != 207:
                return []
            
            events = []
            root = ET.fromstring(response.content)
            ns = {
                "d": "DAV:",
                "c": "urn:ietf:params:xml:ns:caldav"
            }
            
            for response_elem in root.findall(".//d:response", ns):
                cal_data = response_elem.find(".//c:calendar-data", ns)
                if cal_data is not None and cal_data.text:
                    event = self._parse_ical_event(cal_data.text)
                    if event:
                        events.append(event)
            
            return events
    
    def _parse_ical_event(self, ical_text: str) -> Optional[Dict[str, Any]]:
        """Parse iCal event data including recurrence rules"""
        try:
            lines = ical_text.strip().split("\n")
            event = {}
            in_event = False
            exdates = []

            for line in lines:
                line = line.strip()
                if line == "BEGIN:VEVENT":
                    in_event = True
                elif line == "END:VEVENT":
                    in_event = False
                elif in_event and ":" in line:
                    key, value = line.split(":", 1)
                    key_base = key.split(";")[0]  # Remove parameters

                    if key_base == "UID":
                        event["id"] = value
                    elif key_base == "SUMMARY":
                        event["title"] = value
                    elif key_base == "DTSTART":
                        event["start"] = self._parse_ical_date(value)
                        # Check if it's an all-day event
                        if "VALUE=DATE" in key or ("T" not in value and len(value) == 8):
                            event["all_day"] = True
                    elif key_base == "DTEND":
                        event["end"] = self._parse_ical_date(value)
                    elif key_base == "LOCATION":
                        event["location"] = value
                    elif key_base == "DESCRIPTION":
                        event["description"] = value.replace("\\n", "\n")
                    elif key_base == "RRULE":
                        event["recurrence"] = value
                        event["recurrence_parsed"] = self._parse_rrule(value)
                    elif key_base == "RECURRENCE-ID":
                        event["recurrence_id"] = self._parse_ical_date(value)
                    elif key_base == "EXDATE":
                        # Parse excluded dates
                        exdates.append(self._parse_ical_date(value))

            if exdates:
                event["exdates"] = exdates

            return event if event.get("title") else None
        except Exception as e:
            print(f"Error parsing iCal: {e}")
            return None
    
    def _parse_ical_date(self, date_str: str) -> str:
        """Parse iCal date string to ISO format"""
        try:
            if "T" in date_str:
                if date_str.endswith("Z"):
                    dt = datetime.strptime(date_str, "%Y%m%dT%H%M%SZ")
                else:
                    dt = datetime.strptime(date_str, "%Y%m%dT%H%M%S")
            else:
                dt = datetime.strptime(date_str, "%Y%m%d")
            return dt.isoformat()
        except:
            return date_str
    
    async def create_event(
        self,
        username: str,
        password: str,
        calendar_id: str,
        title: str,
        start: datetime,
        end: datetime,
        location: str = "",
        description: str = "",
        all_day: bool = False,
        recurrence: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        """Create a new calendar event with optional recurrence"""
        event_uid = str(uuid.uuid4())
        caldav_url = "{}/{}/{}.ics".format(self._get_caldav_url(username), calendar_id, event_uid)

        now_str = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")

        # Format dates based on all-day or timed event
        if all_day:
            # All-day events use VALUE=DATE format without time
            start_line = f"DTSTART;VALUE=DATE:{start.strftime('%Y%m%d')}"
            end_line = f"DTEND;VALUE=DATE:{end.strftime('%Y%m%d')}"
        else:
            start_line = f"DTSTART:{start.strftime('%Y%m%dT%H%M%SZ')}"
            end_line = f"DTEND:{end.strftime('%Y%m%dT%H%M%SZ')}"

        # Escape newlines in description for iCal format
        escaped_description = description.replace("\n", "\\n") if description else ""

        ical_lines = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Bheem Workspace//NONSGML v1.0//EN",
            "BEGIN:VEVENT",
            "UID:" + event_uid,
            "DTSTAMP:" + now_str,
            start_line,
            end_line,
            "SUMMARY:" + title,
            "LOCATION:" + location,
            "DESCRIPTION:" + escaped_description,
        ]

        # Add recurrence rule if provided
        if recurrence and recurrence.get("freq"):
            rrule_line = self._build_rrule(recurrence)
            ical_lines.append(rrule_line)

        ical_lines.extend([
            "END:VEVENT",
            "END:VCALENDAR"
        ])

        ical_event = "\r\n".join(ical_lines)

        async with httpx.AsyncClient(verify=False) as client:
            response = await client.put(
                url=caldav_url,
                content=ical_event,
                auth=(username, password),
                headers={"Content-Type": "text/calendar; charset=utf-8"}
            )

            if response.status_code in [201, 204]:
                return event_uid
            else:
                print(f"CalDAV create_event failed: status={response.status_code}, url={caldav_url}, response={response.text[:500]}")
                return None
    
    async def delete_event(
        self,
        username: str,
        password: str,
        calendar_id: str,
        event_uid: str
    ) -> bool:
        """Delete a calendar event"""
        caldav_url = f"{self._get_caldav_url(username)}/{calendar_id}/{event_uid}.ics"

        async with httpx.AsyncClient(verify=False) as client:
            response = await client.delete(
                url=caldav_url,
                auth=(username, password)
            )
            return response.status_code in [204, 200]

    async def get_event(
        self,
        username: str,
        password: str,
        calendar_id: str,
        event_uid: str
    ) -> Optional[Dict[str, Any]]:
        """Get a single calendar event by UID"""
        caldav_url = f"{self._get_caldav_url(username)}/{calendar_id}/{event_uid}.ics"

        async with httpx.AsyncClient(verify=False) as client:
            response = await client.get(
                url=caldav_url,
                auth=(username, password)
            )

            if response.status_code == 200:
                event = self._parse_ical_event(response.text)
                if event:
                    event["_raw_ical"] = response.text
                return event
            return None

    async def update_event(
        self,
        username: str,
        password: str,
        calendar_id: str,
        event_uid: str,
        title: Optional[str] = None,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
        location: Optional[str] = None,
        description: Optional[str] = None,
        all_day: Optional[bool] = None,
        recurrence: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Update an existing calendar event with optional recurrence"""
        caldav_url = f"{self._get_caldav_url(username)}/{calendar_id}/{event_uid}.ics"

        # Fetch existing event
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.get(
                url=caldav_url,
                auth=(username, password)
            )

            if response.status_code != 200:
                return False

            existing_ical = response.text

        # Parse existing event to get current values
        existing_event = self._parse_ical_event(existing_ical)
        if not existing_event:
            return False

        # Use existing values if new ones not provided
        final_title = title if title is not None else existing_event.get("title", "")
        final_location = location if location is not None else existing_event.get("location", "")
        final_description = description if description is not None else existing_event.get("description", "")

        # Parse existing dates or use new ones
        if start is not None:
            final_start = start
        else:
            existing_start = existing_event.get("start")
            if existing_start:
                final_start = datetime.fromisoformat(existing_start.replace("Z", "+00:00"))
            else:
                final_start = datetime.utcnow()

        if end is not None:
            final_end = end
        else:
            existing_end = existing_event.get("end")
            if existing_end:
                final_end = datetime.fromisoformat(existing_end.replace("Z", "+00:00"))
            else:
                final_end = final_start + timedelta(hours=1)

        # Determine if this is an all-day event
        is_all_day = all_day if all_day is not None else self._is_all_day_event(existing_ical)

        # Build updated iCal
        now_str = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")

        if is_all_day:
            # All-day events use VALUE=DATE format without time
            start_str = f"DTSTART;VALUE=DATE:{final_start.strftime('%Y%m%d')}"
            end_str = f"DTEND;VALUE=DATE:{final_end.strftime('%Y%m%d')}"
        else:
            start_str = f"DTSTART:{final_start.strftime('%Y%m%dT%H%M%SZ')}"
            end_str = f"DTEND:{final_end.strftime('%Y%m%dT%H%M%SZ')}"

        # Escape newlines in description for iCal format
        escaped_description = final_description.replace("\n", "\\n") if final_description else ""

        ical_lines = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Bheem Workspace//NONSGML v1.0//EN",
            "BEGIN:VEVENT",
            f"UID:{event_uid}",
            f"DTSTAMP:{now_str}",
            start_str,
            end_str,
            f"SUMMARY:{final_title}",
            f"LOCATION:{final_location}",
            f"DESCRIPTION:{escaped_description}",
        ]

        # Handle recurrence
        if recurrence is not None:
            # If recurrence is provided (even empty dict), update it
            if recurrence and recurrence.get("freq"):
                rrule_line = self._build_rrule(recurrence)
                ical_lines.append(rrule_line)
            # If recurrence is None or empty, don't add RRULE (removes recurrence)
        else:
            # Keep existing recurrence if not updating
            if existing_event.get("recurrence"):
                # Preserve the original RRULE
                rrule_str = existing_event["recurrence"]
                if not rrule_str.startswith("RRULE:"):
                    rrule_str = f"RRULE:{rrule_str}"
                ical_lines.append(rrule_str)

            # Preserve existing EXDATEs
            for exdate in existing_event.get("exdates", []):
                try:
                    ex_dt = datetime.fromisoformat(exdate.replace("Z", "+00:00"))
                    if is_all_day:
                        ical_lines.append(f"EXDATE;VALUE=DATE:{ex_dt.strftime('%Y%m%d')}")
                    else:
                        ical_lines.append(f"EXDATE:{ex_dt.strftime('%Y%m%dT%H%M%SZ')}")
                except:
                    pass

        ical_lines.extend([
            "END:VEVENT",
            "END:VCALENDAR"
        ])

        ical_event = "\r\n".join(ical_lines)

        # PUT updated event
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.put(
                url=caldav_url,
                content=ical_event,
                auth=(username, password),
                headers={"Content-Type": "text/calendar; charset=utf-8"}
            )

            return response.status_code in [200, 201, 204]

    def _is_all_day_event(self, ical_text: str) -> bool:
        """Check if an iCal event is an all-day event"""
        lines = ical_text.strip().split("\n")
        for line in lines:
            line = line.strip()
            if line.startswith("DTSTART") and "VALUE=DATE" in line:
                return True
            # If DTSTART has no time component (8 characters = YYYYMMDD)
            if line.startswith("DTSTART:") and "T" not in line:
                value = line.split(":", 1)[1].strip()
                if len(value) == 8:
                    return True
        return False

    def _parse_rrule(self, rrule_str: str) -> Optional[Dict[str, Any]]:
        """Parse RRULE string to dictionary"""
        try:
            # Remove RRULE: prefix if present
            if rrule_str.startswith("RRULE:"):
                rrule_str = rrule_str[6:]

            parts = {}
            for part in rrule_str.split(";"):
                if "=" in part:
                    key, value = part.split("=", 1)
                    parts[key] = value

            result = {
                "freq": parts.get("FREQ"),
                "interval": int(parts.get("INTERVAL", 1)),
            }

            if "BYDAY" in parts:
                result["by_day"] = parts["BYDAY"].split(",")

            if "BYMONTHDAY" in parts:
                result["by_month_day"] = [int(d) for d in parts["BYMONTHDAY"].split(",")]

            if "BYMONTH" in parts:
                result["by_month"] = [int(m) for m in parts["BYMONTH"].split(",")]

            if "BYSETPOS" in parts:
                result["by_set_pos"] = int(parts["BYSETPOS"])

            if "COUNT" in parts:
                result["count"] = int(parts["COUNT"])

            if "UNTIL" in parts:
                result["until"] = self._parse_ical_date(parts["UNTIL"])

            return result
        except Exception as e:
            print(f"Error parsing RRULE: {e}")
            return None

    def _build_rrule(self, recurrence: Dict[str, Any]) -> str:
        """Build RRULE string from recurrence dictionary"""
        parts = [f"FREQ={recurrence['freq']}"]

        if recurrence.get("interval", 1) > 1:
            parts.append(f"INTERVAL={recurrence['interval']}")

        if recurrence.get("by_day"):
            parts.append(f"BYDAY={','.join(recurrence['by_day'])}")

        if recurrence.get("by_month_day"):
            parts.append(f"BYMONTHDAY={','.join(map(str, recurrence['by_month_day']))}")

        if recurrence.get("by_month"):
            parts.append(f"BYMONTH={','.join(map(str, recurrence['by_month']))}")

        if recurrence.get("by_set_pos") is not None:
            parts.append(f"BYSETPOS={recurrence['by_set_pos']}")

        if recurrence.get("count"):
            parts.append(f"COUNT={recurrence['count']}")
        elif recurrence.get("until"):
            until = recurrence["until"]
            if isinstance(until, datetime):
                until_str = until.strftime("%Y%m%dT%H%M%SZ")
            else:
                until_str = until
            parts.append(f"UNTIL={until_str}")

        return "RRULE:" + ";".join(parts)

    def _parse_weekday(self, day_str: str) -> Any:
        """Parse weekday string like 'MO', '1MO', '-1FR' to dateutil weekday"""
        # Extract numeric prefix if present (e.g., "1MO" -> 1, "MO")
        import re
        match = re.match(r'^(-?\d+)?([A-Z]{2})$', day_str.upper())
        if not match:
            return None

        nth = match.group(1)
        day_code = match.group(2)

        if day_code not in WEEKDAY_MAP:
            return None

        wd = WEEKDAY_MAP[day_code]
        if nth:
            return wd(int(nth))
        return wd

    def expand_recurring_events(
        self,
        events: List[Dict[str, Any]],
        start: datetime,
        end: datetime
    ) -> List[Dict[str, Any]]:
        """Expand recurring events into individual instances within the date range"""
        expanded = []

        for event in events:
            # Skip exception events (they have RECURRENCE-ID)
            if event.get("recurrence_id"):
                expanded.append(event)
                continue

            # Non-recurring events pass through
            if not event.get("recurrence"):
                expanded.append(event)
                continue

            # Parse recurrence rule
            rule = event.get("recurrence_parsed") or self._parse_rrule(event["recurrence"])
            if not rule or not rule.get("freq"):
                expanded.append(event)
                continue

            try:
                # Get event start and duration
                event_start_str = event.get("start")
                event_end_str = event.get("end")

                if not event_start_str:
                    expanded.append(event)
                    continue

                event_start = datetime.fromisoformat(event_start_str.replace("Z", "+00:00"))
                if event_start.tzinfo:
                    event_start = event_start.replace(tzinfo=None)

                if event_end_str:
                    event_end = datetime.fromisoformat(event_end_str.replace("Z", "+00:00"))
                    if event_end.tzinfo:
                        event_end = event_end.replace(tzinfo=None)
                    event_duration = event_end - event_start
                else:
                    event_duration = timedelta(hours=1)

                # Get excluded dates
                exdates = set()
                for exdate in event.get("exdates", []):
                    try:
                        ex_dt = datetime.fromisoformat(exdate.replace("Z", "+00:00"))
                        if ex_dt.tzinfo:
                            ex_dt = ex_dt.replace(tzinfo=None)
                        exdates.add(ex_dt.date())
                    except:
                        pass

                # Build rrule parameters
                rrule_kwargs = {
                    "freq": FREQ_MAP.get(rule["freq"], DAILY),
                    "interval": rule.get("interval", 1),
                    "dtstart": event_start
                }

                # Add count or until
                if rule.get("count"):
                    rrule_kwargs["count"] = rule["count"]
                elif rule.get("until"):
                    until = rule["until"]
                    if isinstance(until, str):
                        until = datetime.fromisoformat(until.replace("Z", "+00:00"))
                    if until.tzinfo:
                        until = until.replace(tzinfo=None)
                    rrule_kwargs["until"] = until

                # Add by_day for weekly recurrence
                if rule.get("by_day"):
                    weekdays = []
                    for day in rule["by_day"]:
                        wd = self._parse_weekday(day)
                        if wd:
                            weekdays.append(wd)
                    if weekdays:
                        rrule_kwargs["byweekday"] = weekdays

                # Add by_month_day for monthly recurrence
                if rule.get("by_month_day"):
                    rrule_kwargs["bymonthday"] = rule["by_month_day"]

                # Add by_month for yearly recurrence
                if rule.get("by_month"):
                    rrule_kwargs["bymonth"] = rule["by_month"]

                # Add by_set_pos for "first Monday", "last Friday" etc.
                if rule.get("by_set_pos") is not None:
                    rrule_kwargs["bysetpos"] = rule["by_set_pos"]

                # Create rrule object
                rr = rrule(**rrule_kwargs)

                # Generate occurrences within the range
                # Expand a bit before start to catch events that span into our range
                search_start = start - event_duration if start > event_duration else datetime.min
                search_end = end

                for occurrence in rr.between(search_start, search_end, inc=True):
                    # Skip excluded dates
                    if occurrence.date() in exdates:
                        continue

                    # Create instance event
                    instance = event.copy()
                    instance["start"] = occurrence.isoformat()
                    instance["end"] = (occurrence + event_duration).isoformat()
                    instance["is_recurring_instance"] = True
                    instance["master_event_id"] = event["id"]
                    instance["instance_date"] = occurrence.date().isoformat()

                    # Generate unique instance ID
                    instance["id"] = f"{event['id']}_{occurrence.strftime('%Y%m%dT%H%M%S')}"

                    expanded.append(instance)

            except Exception as e:
                print(f"Error expanding recurring event: {e}")
                # Fall back to including the original event
                expanded.append(event)

        return expanded

    async def update_recurring_instance(
        self,
        username: str,
        password: str,
        calendar_id: str,
        master_event_uid: str,
        original_start: datetime,
        title: Optional[str] = None,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
        location: Optional[str] = None,
        description: Optional[str] = None
    ) -> Optional[str]:
        """
        Update a single instance of a recurring event.
        Creates an exception event with RECURRENCE-ID pointing to the original instance.
        """
        # First, get the master event to copy base properties
        master_event = await self.get_event(username, password, calendar_id, master_event_uid)
        if not master_event:
            return None

        # Generate new UID for exception event
        exception_uid = f"{master_event_uid}-exception-{original_start.strftime('%Y%m%d%H%M%S')}"
        caldav_url = f"{self._get_caldav_url(username)}/{calendar_id}/{exception_uid}.ics"

        now_str = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")

        # Use provided values or fall back to master event values
        final_title = title if title is not None else master_event.get("title", "")
        final_location = location if location is not None else master_event.get("location", "")
        final_description = description if description is not None else master_event.get("description", "")

        # Calculate event times
        if master_event.get("end"):
            master_end = datetime.fromisoformat(master_event["end"].replace("Z", "+00:00"))
            master_start = datetime.fromisoformat(master_event["start"].replace("Z", "+00:00"))
            duration = master_end - master_start
        else:
            duration = timedelta(hours=1)

        final_start = start if start is not None else original_start
        final_end = end if end is not None else (final_start + duration)

        # Determine if all-day
        is_all_day = master_event.get("all_day", False)

        # Format dates
        if is_all_day:
            start_line = f"DTSTART;VALUE=DATE:{final_start.strftime('%Y%m%d')}"
            end_line = f"DTEND;VALUE=DATE:{final_end.strftime('%Y%m%d')}"
            recurrence_id_line = f"RECURRENCE-ID;VALUE=DATE:{original_start.strftime('%Y%m%d')}"
        else:
            start_line = f"DTSTART:{final_start.strftime('%Y%m%dT%H%M%SZ')}"
            end_line = f"DTEND:{final_end.strftime('%Y%m%dT%H%M%SZ')}"
            recurrence_id_line = f"RECURRENCE-ID:{original_start.strftime('%Y%m%dT%H%M%SZ')}"

        escaped_description = final_description.replace("\n", "\\n") if final_description else ""

        ical_lines = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Bheem Workspace//NONSGML v1.0//EN",
            "BEGIN:VEVENT",
            f"UID:{exception_uid}",
            f"DTSTAMP:{now_str}",
            recurrence_id_line,
            start_line,
            end_line,
            f"SUMMARY:{final_title}",
            f"LOCATION:{final_location}",
            f"DESCRIPTION:{escaped_description}",
            "END:VEVENT",
            "END:VCALENDAR"
        ]
        ical_event = "\r\n".join(ical_lines)

        async with httpx.AsyncClient(verify=False) as client:
            response = await client.put(
                url=caldav_url,
                content=ical_event,
                auth=(username, password),
                headers={"Content-Type": "text/calendar; charset=utf-8"}
            )

            if response.status_code in [201, 204]:
                return exception_uid
            return None

    async def delete_recurring_instance(
        self,
        username: str,
        password: str,
        calendar_id: str,
        event_uid: str,
        exclude_date: datetime
    ) -> bool:
        """
        Delete a single instance of a recurring event.
        Adds EXDATE to the master event to exclude this occurrence.
        """
        caldav_url = f"{self._get_caldav_url(username)}/{calendar_id}/{event_uid}.ics"

        # Fetch existing event
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.get(
                url=caldav_url,
                auth=(username, password)
            )

            if response.status_code != 200:
                return False

            existing_ical = response.text

        # Parse existing event
        existing_event = self._parse_ical_event(existing_ical)
        if not existing_event:
            return False

        # Check if this is a recurring event
        if not existing_event.get("recurrence"):
            return False

        # Build updated iCal with EXDATE
        now_str = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
        is_all_day = self._is_all_day_event(existing_ical)

        # Get existing properties
        final_title = existing_event.get("title", "")
        final_location = existing_event.get("location", "")
        final_description = existing_event.get("description", "")

        # Get existing dates
        existing_start = existing_event.get("start")
        if existing_start:
            final_start = datetime.fromisoformat(existing_start.replace("Z", "+00:00"))
        else:
            return False

        existing_end = existing_event.get("end")
        if existing_end:
            final_end = datetime.fromisoformat(existing_end.replace("Z", "+00:00"))
        else:
            final_end = final_start + timedelta(hours=1)

        # Format dates
        if is_all_day:
            start_line = f"DTSTART;VALUE=DATE:{final_start.strftime('%Y%m%d')}"
            end_line = f"DTEND;VALUE=DATE:{final_end.strftime('%Y%m%d')}"
            exdate_line = f"EXDATE;VALUE=DATE:{exclude_date.strftime('%Y%m%d')}"
        else:
            start_line = f"DTSTART:{final_start.strftime('%Y%m%dT%H%M%SZ')}"
            end_line = f"DTEND:{final_end.strftime('%Y%m%dT%H%M%SZ')}"
            exdate_line = f"EXDATE:{exclude_date.strftime('%Y%m%dT%H%M%SZ')}"

        escaped_description = final_description.replace("\n", "\\n") if final_description else ""

        # Collect existing EXDATEs
        existing_exdates = []
        for exdate in existing_event.get("exdates", []):
            try:
                ex_dt = datetime.fromisoformat(exdate.replace("Z", "+00:00"))
                if is_all_day:
                    existing_exdates.append(f"EXDATE;VALUE=DATE:{ex_dt.strftime('%Y%m%d')}")
                else:
                    existing_exdates.append(f"EXDATE:{ex_dt.strftime('%Y%m%dT%H%M%SZ')}")
            except:
                pass

        # Add new EXDATE
        existing_exdates.append(exdate_line)

        ical_lines = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Bheem Workspace//NONSGML v1.0//EN",
            "BEGIN:VEVENT",
            f"UID:{event_uid}",
            f"DTSTAMP:{now_str}",
            start_line,
            end_line,
            f"SUMMARY:{final_title}",
            f"LOCATION:{final_location}",
            f"DESCRIPTION:{escaped_description}",
            existing_event.get("recurrence", ""),
        ]

        # Add all EXDATEs
        ical_lines.extend(existing_exdates)

        ical_lines.extend([
            "END:VEVENT",
            "END:VCALENDAR"
        ])

        # Filter out empty lines
        ical_lines = [line for line in ical_lines if line]
        ical_event = "\r\n".join(ical_lines)

        # PUT updated event
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.put(
                url=caldav_url,
                content=ical_event,
                auth=(username, password),
                headers={"Content-Type": "text/calendar; charset=utf-8"}
            )

            return response.status_code in [200, 201, 204]


# Singleton instance
caldav_service = CalDAVService()
