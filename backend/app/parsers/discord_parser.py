import re
from typing import List, Optional, Tuple
from app.parsers.base import BaseParser
from app.schemas.log import MessageRecord, ParseErrorRecord


GUILD_DELIMITER = "\u00bb"  # The » character used in Discord guild chat exports


class DiscordLogParser(BaseParser):
    """
    Parser for Discord-exported guild chat logs with the following block format:

        [01-10-2026 12.04 AM] PlumSMP#1260
        MEMBER brandtexe >> message

        [01-10-2026 12.04 AM] PlumSMP#1260

        {Embed}
        youruncle6767 left the server

    Each message block consists of:
      1. A timestamp header line: [DD-MM-YYYY HH.MM AM/PM] BotName#0000
      2. A chat message line using the guild delimiter
         OR an {Embed} block with join/leave server events

    The parser tracks timestamps stateully as it reads through lines.
    """

    name: str = "discord"

    # Matches: [01-10-2026 12.04 AM] PlumSMP#1260
    TIMESTAMP_HEADER = re.compile(
        r"^\[(\d{2}-\d{2}-\d{4})\s+(\d{1,2}[.:]\d{2}(?:\s*[AP]M)?)\]\s+\S+",
        re.IGNORECASE,
    )

    # Matches guild chat lines with the >> delimiter character
    # Examples:
    #   MEMBER brandtexe >> no
    #   **Warden** WARDEN phd12 >> ok
    #   **Knight** KNIGHT fwars >> so u are using it
    CHAT_LINE = re.compile(
        r"^"
        r"(?:\*\*[^*]+\*\*\s+)?"        # optional bold role **Warden** etc.
        r"(?:[A-Z][A-Z0-9_]{1,15}\s+)?" # optional ALL-CAPS rank word
        r"([^\s\u00bb]{1,32})"           # player name (no spaces, no delimiter)
        r"\s+\u00bb\s+"                  # the >> delimiter
        r"(.+)$"                         # message body
    )

    # Header / metadata lines to skip
    HEADER_LINE = re.compile(r"^(={3,}|Guild:|Channel:|Topic:|After:|\*\*\*)")

    # Server event text found inside {Embed} blocks
    SERVER_EVENTS = re.compile(
        r"(joined the server|left the server|joined the server for the first time)",
        re.IGNORECASE,
    )

    def can_parse(self, sample_lines: List[str]) -> bool:
        """Detect Discord guild log format."""
        has_delim = any(GUILD_DELIMITER in line for line in sample_lines)
        has_ts = any(self.TIMESTAMP_HEADER.match(line.strip()) for line in sample_lines)
        return has_delim and has_ts

    def parse_lines(self, lines: List[str]) -> Tuple[List[MessageRecord], List[ParseErrorRecord]]:
        """
        Stateful multi-line parser. Tracks the most recent timestamp header
        so it can attach the right timestamp to each chat message line.
        """
        messages: List[MessageRecord] = []
        errors: List[ParseErrorRecord] = []

        current_ts = "Unknown"
        in_embed = False

        for idx, raw in enumerate(lines, start=1):
            line = raw.rstrip("\r\n")
            stripped = line.strip()

            # Blank line resets embed context
            if not stripped:
                in_embed = False
                continue

            # Skip file header / metadata lines
            if self.HEADER_LINE.match(stripped):
                continue

            # Timestamp header line – capture timestamp and move on
            ts_m = self.TIMESTAMP_HEADER.match(stripped)
            if ts_m:
                date_part = ts_m.group(1)
                time_part = ts_m.group(2).replace(".", ":")
                current_ts = f"{date_part} {time_part}"
                in_embed = False
                continue

            # {Embed} marker – next content line is a server event
            if stripped == "{Embed}":
                in_embed = True
                continue

            # Skip server events (inside or outside embed blocks)
            if in_embed or self.SERVER_EVENTS.search(stripped):
                continue

            # Try to match a chat message line
            chat_m = self.CHAT_LINE.match(stripped)
            if chat_m:
                player = chat_m.group(1).strip()
                message = chat_m.group(2).strip()
                if player and message:
                    messages.append(
                        MessageRecord(
                            timestamp=current_ts,
                            player=player,
                            message=message,
                            raw_line=line,
                            line_number=idx,
                        )
                    )

        return messages, errors

    def parse_line(self, raw_line: str, line_number: int) -> Optional[MessageRecord]:
        """Fallback single-line parse (used when called directly)."""
        stripped = raw_line.strip()
        chat_m = self.CHAT_LINE.match(stripped)
        if chat_m:
            return MessageRecord(
                timestamp="Unknown",
                player=chat_m.group(1).strip(),
                message=chat_m.group(2).strip(),
                raw_line=raw_line,
                line_number=line_number,
            )
        return None
