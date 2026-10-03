import csv
import io
from typing import List, Optional, Tuple
from app.parsers.base import BaseParser
from app.schemas.log import MessageRecord, ParseErrorRecord

class CSVLogParser(BaseParser):
    """
    Parser for CSV formatted chat logs with headers like:
    timestamp,player,message
    or time,user,text
    """
    name: str = "csv"

    def can_parse(self, sample_lines: List[str]) -> bool:
        if not sample_lines:
            return False
        header = sample_lines[0].lower()
        return ("player" in header or "user" in header or "author" in header) and (
            "message" in header or "text" in header or "content" in header
        )

    def parse_line(self, raw_line: str, line_number: int) -> Optional[MessageRecord]:
        # Handled in parse_lines because CSV parsing requires reader context
        return None

    def parse_lines(self, lines: List[str]) -> Tuple[List[MessageRecord], List[ParseErrorRecord]]:
        messages: List[MessageRecord] = []
        errors: List[ParseErrorRecord] = []

        content = "\n".join(lines)
        reader = csv.reader(io.StringIO(content))

        header = None
        for idx, row in enumerate(reader, start=1):
            if not row or not any(field.strip() for field in row):
                continue
            if header is None:
                header = [col.strip().lower() for col in row]
                continue

            raw_line = ",".join(row)
            try:
                # Find column indices
                ts_idx = -1
                player_idx = -1
                msg_idx = -1

                for i, col_name in enumerate(header):
                    if col_name in ("timestamp", "time", "date", "datetime"):
                        ts_idx = i
                    elif col_name in ("player", "user", "username", "author", "sender"):
                        player_idx = i
                    elif col_name in ("message", "text", "content", "msg"):
                        msg_idx = i

                if player_idx == -1 or msg_idx == -1:
                    raise ValueError(f"CSV missing player or message column in header: {header}")

                if player_idx >= len(row) or msg_idx >= len(row):
                    raise ValueError("Row has fewer columns than header requires")

                timestamp = row[ts_idx].strip() if ts_idx != -1 and ts_idx < len(row) else "Unknown"
                player = row[player_idx].strip()
                message = row[msg_idx].strip()

                if not player or not message:
                    continue

                messages.append(MessageRecord(
                    timestamp=timestamp,
                    player=player,
                    message=message,
                    raw_line=raw_line,
                    line_number=idx
                ))
            except Exception as e:
                errors.append(ParseErrorRecord(
                    line_number=idx,
                    raw_line=raw_line,
                    reason=str(e)
                ))

        return messages, errors
