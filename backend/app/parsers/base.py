from abc import ABC, abstractmethod
from typing import List, Optional, Tuple
from app.schemas.log import MessageRecord, ParseErrorRecord

class BaseParser(ABC):
    """Abstract base class for log parsers."""
    name: str = "base"

    @abstractmethod
    def can_parse(self, sample_lines: List[str]) -> bool:
        """Determines if this parser is suitable for the given sample lines."""
        pass

    @abstractmethod
    def parse_line(self, raw_line: str, line_number: int) -> Optional[MessageRecord]:
        """
        Parses a single line.
        Returns:
            MessageRecord if line is a chat message.
            None if line is recognized as a non-chat line (e.g. system info, player joined/left).
        Raises:
            ValueError if line appears to be a chat message but is malformed.
        """
        pass

    def parse_lines(self, lines: List[str]) -> Tuple[List[MessageRecord], List[ParseErrorRecord]]:
        """Parses a full list of lines, returning records and any syntax errors."""
        messages: List[MessageRecord] = []
        errors: List[ParseErrorRecord] = []

        for idx, line in enumerate(lines, start=1):
            line_str = line.rstrip("\r\n")
            if not line_str.strip():
                continue
            try:
                record = self.parse_line(line_str, idx)
                if record is not None:
                    messages.append(record)
            except ValueError as e:
                errors.append(ParseErrorRecord(
                    line_number=idx,
                    raw_line=line_str,
                    reason=str(e)
                ))
            except Exception as e:
                errors.append(ParseErrorRecord(
                    line_number=idx,
                    raw_line=line_str,
                    reason=f"Unexpected parsing error: {e}"
                ))

        return messages, errors
