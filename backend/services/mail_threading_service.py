"""
Bheem Workspace - Mail Threading Service
Groups emails into conversations based on Message-ID/References/In-Reply-To headers
"""
from typing import List, Dict, Any, Optional
from datetime import datetime
from email.utils import parsedate_to_datetime
import re
from core.logging import get_logger

logger = get_logger("bheem.mail.threading")


class MailThreadingService:
    """
    Service for grouping emails into threaded conversations.

    Uses standard email headers for threading:
    - Message-ID: Unique identifier for the email
    - In-Reply-To: Message-ID of the email being replied to
    - References: List of Message-IDs in the conversation chain
    """

    def __init__(self):
        pass

    def _normalize_message_id(self, message_id: str) -> str:
        """Normalize Message-ID by stripping angle brackets and whitespace."""
        if not message_id:
            return ""
        # Remove angle brackets and strip whitespace
        return message_id.strip().strip("<>").strip()

    def _parse_references(self, references: str) -> List[str]:
        """Parse References header into list of Message-IDs."""
        if not references:
            return []

        # References can be space or newline separated
        ref_list = re.split(r'\s+', references.strip())
        return [self._normalize_message_id(r) for r in ref_list if r]

    def _get_subject_key(self, subject: str) -> str:
        """
        Get normalized subject for grouping.
        Strips Re:, Fwd:, etc. prefixes.
        """
        if not subject:
            return ""

        # Common reply/forward prefixes to strip
        prefixes = [
            r'^re:\s*',
            r'^fwd:\s*',
            r'^fw:\s*',
            r'^aw:\s*',  # German "Antwort"
            r'^sv:\s*',  # Swedish "Svar"
            r'^\[.*?\]\s*',  # Mailing list prefixes like [list-name]
        ]

        normalized = subject.strip().lower()

        # Keep stripping prefixes until none match
        changed = True
        while changed:
            changed = False
            for prefix in prefixes:
                new_normalized = re.sub(prefix, '', normalized, flags=re.IGNORECASE)
                if new_normalized != normalized:
                    normalized = new_normalized
                    changed = True

        return normalized.strip()

    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """Parse email date string to datetime."""
        if not date_str:
            return None

        try:
            return parsedate_to_datetime(date_str)
        except Exception:
            # Try common formats
            formats = [
                "%a, %d %b %Y %H:%M:%S %z",
                "%d %b %Y %H:%M:%S %z",
                "%a, %d %b %Y %H:%M:%S",
                "%Y-%m-%d %H:%M:%S"
            ]
            for fmt in formats:
                try:
                    return datetime.strptime(date_str[:30], fmt)
                except ValueError:
                    continue
            return None

    def group_into_threads(
        self,
        messages: List[Dict[str, Any]],
        use_subject_fallback: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Group messages into threaded conversations.

        Args:
            messages: List of email messages with threading headers
            use_subject_fallback: Whether to group by subject when no headers match

        Returns:
            List of conversation objects, each containing a list of messages
        """
        if not messages:
            return []

        # Build message lookup by Message-ID
        msg_by_id: Dict[str, Dict] = {}
        for msg in messages:
            msg_id = self._normalize_message_id(msg.get("message_id", ""))
            if msg_id:
                msg_by_id[msg_id] = msg

        # Track which messages belong to which thread
        thread_map: Dict[str, str] = {}  # message_id -> thread_root_id
        threads: Dict[str, List[Dict]] = {}  # thread_root_id -> messages

        for msg in messages:
            msg_id = self._normalize_message_id(msg.get("message_id", ""))
            in_reply_to = self._normalize_message_id(msg.get("in_reply_to", ""))
            references = self._parse_references(msg.get("references", ""))

            # Find the thread this message belongs to
            thread_root = None

            # Check In-Reply-To first
            if in_reply_to and in_reply_to in thread_map:
                thread_root = thread_map[in_reply_to]

            # Check References (older messages in the chain)
            if not thread_root:
                for ref in references:
                    if ref in thread_map:
                        thread_root = thread_map[ref]
                        break

            # If we found a thread, add this message to it
            if thread_root:
                threads[thread_root].append(msg)
                if msg_id:
                    thread_map[msg_id] = thread_root
            else:
                # Start a new thread with this message as root
                thread_id = msg_id or f"thread_{len(threads)}"
                threads[thread_id] = [msg]
                if msg_id:
                    thread_map[msg_id] = thread_id

        # Subject-based fallback grouping
        if use_subject_fallback:
            threads = self._merge_threads_by_subject(threads)

        # Convert to conversation list
        conversations = []
        for thread_id, thread_messages in threads.items():
            # Sort messages by date (oldest first)
            sorted_messages = sorted(
                thread_messages,
                key=lambda m: self._parse_date(m.get("date", "")) or datetime.min
            )

            # Get the latest message for preview
            latest = sorted_messages[-1] if sorted_messages else thread_messages[0]
            oldest = sorted_messages[0] if sorted_messages else thread_messages[0]

            # Build conversation object
            conversation = {
                "thread_id": thread_id,
                "subject": self._get_conversation_subject(thread_messages),
                "message_count": len(thread_messages),
                "participants": self._get_participants(thread_messages),
                "latest_date": latest.get("date", ""),
                "oldest_date": oldest.get("date", ""),
                "preview": latest.get("preview", ""),
                "has_unread": any(not m.get("read", True) for m in thread_messages),
                "messages": sorted_messages
            }
            conversations.append(conversation)

        # Sort conversations by latest message date (newest first)
        conversations.sort(
            key=lambda c: self._parse_date(c["latest_date"]) or datetime.min,
            reverse=True
        )

        return conversations

    def _merge_threads_by_subject(
        self,
        threads: Dict[str, List[Dict]]
    ) -> Dict[str, List[Dict]]:
        """
        Merge threads that have the same normalized subject but no header links.
        This handles cases where reply chains are broken.
        """
        subject_to_thread: Dict[str, str] = {}
        merged_threads: Dict[str, List[Dict]] = {}

        for thread_id, messages in threads.items():
            # Get normalized subject from first message
            if not messages:
                continue

            subject_key = self._get_subject_key(messages[0].get("subject", ""))

            if subject_key and subject_key in subject_to_thread:
                # Merge into existing thread
                existing_thread = subject_to_thread[subject_key]
                merged_threads[existing_thread].extend(messages)
            else:
                # New thread
                merged_threads[thread_id] = messages
                if subject_key:
                    subject_to_thread[subject_key] = thread_id

        return merged_threads

    def _get_conversation_subject(self, messages: List[Dict]) -> str:
        """Get the most appropriate subject for the conversation."""
        if not messages:
            return ""

        # Find the original subject (without Re:/Fwd: prefixes)
        for msg in messages:
            subject = msg.get("subject", "")
            if subject and not re.match(r'^(re|fwd|fw):\s*', subject, re.IGNORECASE):
                return subject

        # Fall back to first message's subject
        return messages[0].get("subject", "(No Subject)")

    def _get_participants(self, messages: List[Dict]) -> List[str]:
        """Get unique participants in a conversation."""
        participants = set()

        for msg in messages:
            # Add sender
            from_addr = msg.get("from", "")
            if from_addr:
                # Extract email from "Name <email>" format
                match = re.search(r'<([^>]+)>', from_addr)
                if match:
                    participants.add(match.group(1))
                else:
                    participants.add(from_addr)

            # Add recipients
            to_addr = msg.get("to", "")
            if to_addr:
                for addr in re.findall(r'[\w\.-]+@[\w\.-]+', to_addr):
                    participants.add(addr)

        return list(participants)

    def get_thread_for_message(
        self,
        message: Dict[str, Any],
        all_messages: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Get all messages in the same thread as the given message.

        Args:
            message: The target message
            all_messages: All available messages to search

        Returns:
            List of messages in the thread, sorted by date
        """
        threads = self.group_into_threads(all_messages)

        msg_id = self._normalize_message_id(message.get("message_id", ""))

        for conversation in threads:
            for thread_msg in conversation.get("messages", []):
                thread_msg_id = self._normalize_message_id(
                    thread_msg.get("message_id", "")
                )
                if thread_msg_id and thread_msg_id == msg_id:
                    return conversation.get("messages", [])

        # Message not found in any thread, return just this message
        return [message]


# Singleton instance
mail_threading_service = MailThreadingService()
