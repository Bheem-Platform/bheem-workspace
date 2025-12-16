"""
Bheem Workspace - CalDAV Service
Calendar integration with Nextcloud CalDAV
"""
import httpx
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import xml.etree.ElementTree as ET
from core.config import settings

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
        """Parse iCal event data"""
        try:
            lines = ical_text.strip().split("\n")
            event = {}
            in_event = False
            
            for line in lines:
                line = line.strip()
                if line == "BEGIN:VEVENT":
                    in_event = True
                elif line == "END:VEVENT":
                    in_event = False
                elif in_event and ":" in line:
                    key, value = line.split(":", 1)
                    key = key.split(";")[0]  # Remove parameters
                    
                    if key == "UID":
                        event["id"] = value
                    elif key == "SUMMARY":
                        event["title"] = value
                    elif key == "DTSTART":
                        event["start"] = self._parse_ical_date(value)
                    elif key == "DTEND":
                        event["end"] = self._parse_ical_date(value)
                    elif key == "LOCATION":
                        event["location"] = value
                    elif key == "DESCRIPTION":
                        event["description"] = value.replace("\\n", "\n")
            
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
        description: str = ""
    ) -> Optional[str]:
        """Create a new calendar event"""
        event_uid = str(uuid.uuid4())
        caldav_url = "{}/{}/{}.ics".format(self._get_caldav_url(username), calendar_id, event_uid)

        start_str = start.strftime("%Y%m%dT%H%M%SZ")
        end_str = end.strftime("%Y%m%dT%H%M%SZ")
        now_str = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")

        # Escape newlines in description for iCal format
        escaped_description = description.replace("\n", "\\n") if description else ""

        ical_lines = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Bheem Workspace//NONSGML v1.0//EN",
            "BEGIN:VEVENT",
            "UID:" + event_uid,
            "DTSTAMP:" + now_str,
            "DTSTART:" + start_str,
            "DTEND:" + end_str,
            "SUMMARY:" + title,
            "LOCATION:" + location,
            "DESCRIPTION:" + escaped_description,
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
                return event_uid
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

# Singleton instance
caldav_service = CalDAVService()
