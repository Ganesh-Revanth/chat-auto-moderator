import re
from typing import List, Optional
from app.parsers.base import BaseParser
from app.schemas.log import MessageRecord

class GenericTextParser(BaseParser):
    """
    Fallback parser for standard chat logs:
      [21:14:32] Steve: hello world
      21:14:32 Steve: hello world
      Steve: hello world
      [21:14:32] <Steve> hello world
    """
    name: str = "generic"

    GENERIC_PATTERN = re.compile(
        r"^(?:\[(?P<timestamp_bracket>[^\]]+)\]\s*|(?P<timestamp_plain>\d{2}:\d{2}(?::\d{2})?)\s+)?(?:<(?P<player_angle>[^>]+)>|(?P<player_colon>[a-zA-Z0-9_\-\.]{2,20}))\s*[:>]\s*(?P<message>.*)$"
    )

    def can_parse(self, sample_lines: List[str]) -> bool:
        matches = 0
        for line in sample_lines[:20]:
            if self.GENERIC_PATTERN.match(line):
                matches += 1
        return matches >= 2

    def parse_line(self, raw_line: str, line_number: int) -> Optional[MessageRecord]:
        m = self.GENERIC_PATTERN.match(raw_line)
        if not m:
            return None
        timestamp = m.group("timestamp_bracket") or m.group("timestamp_plain") or "Unknown"
        player = (m.group("player_angle") or m.group("player_colon") or "").strip()
        message = m.group("message")
        if not player or not message:
            return None
        return MessageRecord(
            timestamp=timestamp,
            player=player,
            message=message,
            raw_line=raw_line,
            line_number=line_number
        )
