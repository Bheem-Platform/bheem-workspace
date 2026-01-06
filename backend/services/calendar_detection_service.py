"""
Bheem Workspace - Calendar Detection Service
Detects potential calendar events from email content and ICS attachments
"""
import re
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from dateutil import parser as date_parser
from dateutil.relativedelta import relativedelta
from core.logging import get_logger

logger = get_logger("bheem.mail.calendar.detection")


class CalendarDetectionService:
    """
    Service to detect calendar events from email content.

    Features:
    - Parse natural language date/time expressions
    - Detect meeting keywords and context
    - Parse ICS (iCalendar) attachments
    - Extract event details (title, time, location, attendees)
    """

    # Date patterns to match various formats
    DATE_PATTERNS = [
        # "Monday, January 15th, 2025"
        r'\b(?:on\s+)?(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s*(?:\d{4})?',
        # "January 15, 2025" or "January 15th 2025"
        r'\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4}',
        # "Jan 15, 2025"
        r'\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4}',
        # "15 January 2025"
        r'\b\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December),?\s*\d{4}',
        # "01/15/2025" or "1/15/25"
        r'\b\d{1,2}/\d{1,2}/\d{2,4}\b',
        # "2025-01-15"
        r'\b\d{4}-\d{2}-\d{2}\b',
        # Relative dates
        r'\b(?:next|this|coming)\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b',
        r'\b(?:tomorrow|today)\b',
    ]

    # Time patterns
    TIME_PATTERNS = [
        # "2:30 PM" or "2:30PM" or "14:30"
        r'\b\d{1,2}:\d{2}\s*(?:AM|PM|am|pm|a\.m\.|p\.m\.)?',
        # "2 PM" or "2PM"
        r'\b\d{1,2}\s*(?:AM|PM|am|pm|a\.m\.|p\.m\.)',
        # "at noon" or "at midnight"
        r'\b(?:at\s+)?(?:noon|midnight)\b',
    ]

    # Duration patterns
    DURATION_PATTERNS = [
        r'(?:for\s+)?(\d+)\s*(?:hour|hr)s?',
        r'(?:for\s+)?(\d+)\s*(?:minute|min)s?',
        r'(\d+)\s*-\s*(\d+)\s*(?:hours?|hrs?)',
    ]

    # Keywords indicating a calendar event
    EVENT_KEYWORDS = [
        'meeting', 'call', 'conference', 'appointment', 'interview',
        'demo', 'presentation', 'review', 'sync', 'standup', 'stand-up',
        'catch-up', 'catch up', 'one-on-one', '1:1', '1-on-1',
        'lunch', 'dinner', 'coffee', 'breakfast',
        'event', 'webinar', 'workshop', 'training', 'session',
        'deadline', 'due date', 'reminder',
        'flight', 'travel', 'trip',
        'birthday', 'anniversary',
        'schedule', 'scheduled for', 'booked for',
        'invite you', 'inviting you', 'join us',
        'rsvp', 'please confirm', 'calendar invite',
    ]

    # Location indicators
    LOCATION_PATTERNS = [
        r'(?:at|in|@)\s+(.+?)(?:\.|,|$|\n)',
        r'(?:location|venue|place|room|address):\s*(.+?)(?:\.|,|$|\n)',
        r'(?:zoom|teams|meet|google meet|webex)(?:\s+link)?:\s*(https?://\S+)',
        r'conference room\s+(\w+)',
        r'room\s+(\d+\w*)',
    ]

    def __init__(self):
        self.event_keywords_pattern = re.compile(
            r'\b(' + '|'.join(re.escape(kw) for kw in self.EVENT_KEYWORDS) + r')\b',
            re.IGNORECASE
        )

    def detect_events(
        self,
        email_body: str,
        email_subject: str,
        attachments: Optional[List[Dict]] = None
    ) -> List[Dict[str, Any]]:
        """
        Detect potential calendar events in email.

        Args:
            email_body: The email body text (HTML will be stripped)
            email_subject: The email subject line
            attachments: List of attachment dicts with 'filename' and 'content' keys

        Returns:
            List of detected events with title, datetime, location, confidence
        """
        events = []

        # Check for ICS attachments first (highest confidence)
        if attachments:
            for attachment in attachments:
                filename = attachment.get('filename', '').lower()
                if filename.endswith('.ics') or filename.endswith('.ical'):
                    ics_events = self._parse_ics_attachment(attachment.get('content', ''))
                    for event in ics_events:
                        event['source'] = 'ics_attachment'
                        event['confidence'] = 0.95
                    events.extend(ics_events)

        # Strip HTML and combine text for analysis
        text = self._strip_html(email_body)
        combined_text = f"{email_subject}\n{text}"

        # Check if email contains event keywords
        has_event_keyword = bool(self.event_keywords_pattern.search(combined_text))

        if not has_event_keyword:
            # No event keywords, return ICS events only (if any)
            return events

        # Find dates in the text
        dates_found = self._find_dates(combined_text)

        # Find times in the text
        times_found = self._find_times(combined_text)

        # Find locations
        locations = self._find_locations(combined_text)

        # Extract potential event title
        title = self._extract_event_title(combined_text, email_subject)

        # Create events from found dates
        for date_info in dates_found[:3]:  # Limit to first 3 dates
            try:
                parsed_date = date_info['parsed']

                # Skip dates in the past
                if parsed_date < datetime.now() - timedelta(days=1):
                    continue

                # Try to pair with time
                event_time = None
                if times_found:
                    event_time = times_found[0]
                    try:
                        parsed_time = date_parser.parse(event_time['raw'])
                        parsed_date = parsed_date.replace(
                            hour=parsed_time.hour,
                            minute=parsed_time.minute
                        )
                    except:
                        pass

                # Estimate duration (default 1 hour)
                duration = self._estimate_duration(combined_text)
                end_time = parsed_date + timedelta(minutes=duration)

                event = {
                    'title': title,
                    'start': parsed_date.isoformat(),
                    'end': end_time.isoformat(),
                    'date_str': date_info['raw'],
                    'time_str': event_time['raw'] if event_time else None,
                    'location': locations[0] if locations else None,
                    'duration_minutes': duration,
                    'source': 'text_detection',
                    'confidence': self._calculate_confidence(
                        has_time=bool(event_time),
                        has_location=bool(locations),
                        keyword_count=len(self.event_keywords_pattern.findall(combined_text))
                    )
                }

                events.append(event)

            except Exception as e:
                logger.warning(f"Failed to parse date: {date_info['raw']}: {e}")
                continue

        # Sort by confidence
        events.sort(key=lambda e: e['confidence'], reverse=True)

        return events

    def _strip_html(self, html: str) -> str:
        """Strip HTML tags and decode entities."""
        import html as html_module

        # Remove script and style elements
        text = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)

        # Remove HTML tags
        text = re.sub(r'<[^>]+>', ' ', text)

        # Decode HTML entities
        text = html_module.unescape(text)

        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text).strip()

        return text

    def _find_dates(self, text: str) -> List[Dict[str, Any]]:
        """Find and parse date expressions in text."""
        dates = []

        for pattern in self.DATE_PATTERNS:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                raw_date = match.group()
                try:
                    # Handle relative dates
                    parsed = self._parse_relative_date(raw_date)
                    if parsed:
                        dates.append({
                            'raw': raw_date,
                            'parsed': parsed,
                            'position': match.start()
                        })
                except Exception as e:
                    logger.debug(f"Could not parse date '{raw_date}': {e}")

        # Remove duplicates (keep first occurrence)
        seen = set()
        unique_dates = []
        for d in dates:
            date_key = d['parsed'].date().isoformat()
            if date_key not in seen:
                seen.add(date_key)
                unique_dates.append(d)

        return sorted(unique_dates, key=lambda d: d['position'])

    def _parse_relative_date(self, date_str: str) -> Optional[datetime]:
        """Parse relative date expressions like 'next Monday' or 'tomorrow'."""
        date_lower = date_str.lower().strip()
        today = datetime.now().replace(hour=9, minute=0, second=0, microsecond=0)

        if 'today' in date_lower:
            return today

        if 'tomorrow' in date_lower:
            return today + timedelta(days=1)

        # Handle "next/this [day of week]"
        days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        for i, day in enumerate(days):
            if day in date_lower:
                # Calculate days until that day
                current_day = today.weekday()
                target_day = i

                if 'next' in date_lower:
                    # Next week's occurrence
                    days_ahead = target_day - current_day
                    if days_ahead <= 0:
                        days_ahead += 7
                    days_ahead += 7  # Add extra week for "next"
                else:
                    # This week or next occurrence
                    days_ahead = target_day - current_day
                    if days_ahead <= 0:
                        days_ahead += 7

                return today + timedelta(days=days_ahead)

        # Try dateutil parser for other formats
        try:
            return date_parser.parse(date_str, fuzzy=True, dayfirst=False)
        except:
            return None

    def _find_times(self, text: str) -> List[Dict[str, str]]:
        """Find time expressions in text."""
        times = []

        for pattern in self.TIME_PATTERNS:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                raw_time = match.group()
                times.append({
                    'raw': raw_time,
                    'position': match.start()
                })

        return sorted(times, key=lambda t: t['position'])

    def _find_locations(self, text: str) -> List[str]:
        """Extract location information from text."""
        locations = []

        for pattern in self.LOCATION_PATTERNS:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                loc = match.group(1).strip()
                if loc and len(loc) > 2 and len(loc) < 200:
                    locations.append(loc)

        return locations

    def _extract_event_title(self, text: str, subject: str) -> str:
        """Extract a suitable event title."""
        # Try to find specific meeting title patterns
        title_patterns = [
            r'(?:meeting|call|conference)\s+(?:about|regarding|to discuss|for|on)\s+(.+?)(?:\.|,|$|\n)',
            r'(?:join us for|invite you to|inviting you to)\s+(?:a\s+)?(.+?)(?:\.|,|$|\n)',
            r'(?:re|regarding|about):\s*(.+?)(?:\.|,|$|\n)',
        ]

        for pattern in title_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                title = match.group(1).strip()
                if len(title) > 5 and len(title) < 150:
                    return title[:100]

        # Use subject line if it looks like a meeting
        if any(kw in subject.lower() for kw in self.EVENT_KEYWORDS):
            # Clean up common prefixes
            clean_subject = re.sub(r'^(re:|fwd:|fw:)\s*', '', subject, flags=re.IGNORECASE).strip()
            if len(clean_subject) > 3:
                return clean_subject[:100]

        return "Event from email"

    def _estimate_duration(self, text: str) -> int:
        """Estimate event duration in minutes (default 60)."""
        # Look for explicit duration mentions
        for pattern in self.DURATION_PATTERNS:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    groups = match.groups()
                    if 'hour' in pattern.lower() or 'hr' in pattern.lower():
                        hours = int(groups[0])
                        return hours * 60
                    elif 'minute' in pattern.lower() or 'min' in pattern.lower():
                        return int(groups[0])
                except:
                    pass

        # Default durations based on event type
        text_lower = text.lower()
        if any(kw in text_lower for kw in ['standup', 'stand-up', 'sync', '1:1', '1-on-1']):
            return 30
        if any(kw in text_lower for kw in ['lunch', 'coffee']):
            return 60
        if any(kw in text_lower for kw in ['workshop', 'training', 'webinar']):
            return 90

        return 60  # Default 1 hour

    def _calculate_confidence(
        self,
        has_time: bool,
        has_location: bool,
        keyword_count: int
    ) -> float:
        """Calculate confidence score for detected event."""
        confidence = 0.4  # Base confidence

        if has_time:
            confidence += 0.2
        if has_location:
            confidence += 0.15
        if keyword_count >= 2:
            confidence += 0.15
        elif keyword_count == 1:
            confidence += 0.1

        return min(confidence, 0.9)  # Cap at 0.9 for text detection

    def _parse_ics_attachment(self, ics_content: str) -> List[Dict[str, Any]]:
        """Parse ICS (iCalendar) attachment content."""
        events = []

        try:
            # Simple ICS parser (for basic events)
            # For production, consider using icalendar library

            # Find VEVENT blocks
            vevent_pattern = r'BEGIN:VEVENT(.*?)END:VEVENT'
            vevent_matches = re.findall(vevent_pattern, ics_content, re.DOTALL)

            for vevent in vevent_matches:
                event = {}

                # Extract properties
                props = {
                    'SUMMARY': 'title',
                    'DTSTART': 'start',
                    'DTEND': 'end',
                    'LOCATION': 'location',
                    'DESCRIPTION': 'description',
                    'UID': 'uid',
                }

                for ics_prop, event_key in props.items():
                    # Handle properties with parameters (e.g., DTSTART;TZID=...)
                    pattern = rf'{ics_prop}[^:]*:(.+?)(?:\r?\n|\Z)'
                    match = re.search(pattern, vevent)
                    if match:
                        value = match.group(1).strip()

                        # Parse datetime values
                        if event_key in ['start', 'end']:
                            try:
                                # Handle various ICS datetime formats
                                value = value.replace('Z', '')
                                if 'T' in value:
                                    dt = datetime.strptime(value[:15], '%Y%m%dT%H%M%S')
                                else:
                                    dt = datetime.strptime(value[:8], '%Y%m%d')
                                value = dt.isoformat()
                            except:
                                pass

                        event[event_key] = value

                if event.get('title') and event.get('start'):
                    events.append(event)

        except Exception as e:
            logger.error(f"Failed to parse ICS attachment: {e}")

        return events

    def parse_ics_file(self, ics_content: str) -> List[Dict[str, Any]]:
        """Public method to parse ICS file content."""
        events = self._parse_ics_attachment(ics_content)
        for event in events:
            event['source'] = 'ics_file'
            event['confidence'] = 0.98
        return events


# Singleton instance
calendar_detection_service = CalendarDetectionService()
