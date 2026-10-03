import re
from typing import List, Optional
from app.parsers.base import BaseParser
from app.schemas.log import MessageRecord

class MinecraftParser(BaseParser):
    """
    Parser for Minecraft server logs (Vanilla, Bukkit, Spigot, Paper, Purpur).
    Supports formats like:
      [21:14:32 INFO]: <Steve> ez
      [21:14:32] [Server thread/INFO]: <Steve> ez
      [21:14:32] [Async Chat Thread - #0/INFO]: <Steve> ez
      [2026-10-01 21:14:32] [Server thread/INFO]: <Steve> ez
      2026-10-01 21:14:32 [INFO] <Steve> ez
    Also handles player ranks/prefixes:
      [21:14:32 INFO]: [Admin] <Steve> ez
      [21:14:32 INFO]: <[VIP] Steve> ez
    And private whispers:
      [21:14:32 INFO]: Steve whispers to Alex: ez
    """
    name: str = "minecraft"

    # Regex to extract timestamp and log body
    # Group 1: Timestamp (time or datetime)
    # Group 2: Thread/Level header (e.g. Server thread/INFO or INFO)
    # Group 3: Rest of message
    LINE_PATTERN = re.compile(
        r"^(?:\[(?P<timestamp_bracket>[^\]]+)\](?:\s*\[(?P<thread_level>[^\]]+)\])?|(?P<timestamp_plain>\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+\[(?P<level_plain>[^\]]+)\])\s*:?\s*(?P<content>.*)$"
    )

    # Standard public chat: <Player> Message, optionally with prefix [Rank] <Player> or <[Rank] Player>
    CHAT_PATTERN = re.compile(
        r"^(?:\[[^\]]+\]\s*)?<(?P<player>[a-zA-Z0-9_]{2,16}|\[[^\]]+\]\s*[a-zA-Z0-9_]{2,16})>\s*(?P<message>.*)$"
    )

    # Whisper/Private message: Player whispers to Target: Message
    WHISPER_PATTERN = re.compile(
        r"^(?P<player>[a-zA-Z0-9_]{2,16})\s+whispers\s+to\s+[a-zA-Z0-9_]{2,16}\s*:\s*(?P<message>.*)$",
        re.IGNORECASE
    )

    # Alternate whisper: [Player -> Target] Message
    WHISPER_ARROW_PATTERN = re.compile(
        r"^\[(?P<player>[a-zA-Z0-9_]{2,16})\s*->\s*[a-zA-Z0-9_]{2,16}\]\s*(?P<message>.*)$"
    )

    # Common non-chat events to ignore cleanly (return None)
    NON_CHAT_INDICATORS = [
        "joined the game",
        "left the game",
        "lost connection",
        "logged in with entity id",
        "issued server command:",
        "UUID of player",
        "fell from a high place",
        "was slain by",
        "drowned",
        "burned to death",
        "was shot by",
        "hit the ground too hard",
        "tried to swim in lava",
        "suffocated in a wall",
        "was blown up by",
        "Starting minecraft server",
        "Loading properties",
        "Default game type:",
        "Generating keypair",
        "Starting Minecraft server on",
        "Using default channel type",
        "Preparing level",
        "Preparing start region",
        "Time elapsed:",
        "Done (",
        "Stopping server",
        "Saving players",
        "Saving worlds",
        "Closing Server"
    ]

    def can_parse(self, sample_lines: List[str]) -> bool:
        match_count = 0
        for line in sample_lines[:20]:
            if self.LINE_PATTERN.match(line):
                match_count += 1
        return match_count >= 2

    def parse_line(self, raw_line: str, line_number: int) -> Optional[MessageRecord]:
        m = self.LINE_PATTERN.match(raw_line)
        if not m:
            # Check if this might be a chat line without standard header
            chat_direct = self.CHAT_PATTERN.match(raw_line)
            if chat_direct:
                player = self._clean_player_name(chat_direct.group("player"))
                return MessageRecord(
                    timestamp="Unknown",
                    player=player,
                    message=chat_direct.group("message").strip(),
                    raw_line=raw_line,
                    line_number=line_number
                )
            return None

        # Determine timestamp
        timestamp = m.group("timestamp_bracket") or m.group("timestamp_plain") or "Unknown"
        # If timestamp is something like "21:14:32 INFO", extract just the time
        if " " in timestamp and ("INFO" in timestamp or "WARN" in timestamp or "ERROR" in timestamp):
            timestamp = timestamp.split()[0]

        content = m.group("content").strip()

        # Check for standard public chat
        chat_match = self.CHAT_PATTERN.match(content)
        if chat_match:
            raw_player = chat_match.group("player")
            player = self._clean_player_name(raw_player)
            message = chat_match.group("message")
            return MessageRecord(
                timestamp=timestamp,
                player=player,
                message=message,
                raw_line=raw_line,
                line_number=line_number
            )

        # Check for whispers
        whisper_match = self.WHISPER_PATTERN.match(content) or self.WHISPER_ARROW_PATTERN.match(content)
        if whisper_match:
            player = self._clean_player_name(whisper_match.group("player"))
            message = whisper_match.group("message")
            return MessageRecord(
                timestamp=timestamp,
                player=player,
                message=message,
                raw_line=raw_line,
                line_number=line_number
            )

        # If it looks like a chat message attempt (e.g. contains < >) but failed
        if "<" in content and ">" in content and not any(ind in content for ind in self.NON_CHAT_INDICATORS):
            # Try a looser extraction
            loose_match = re.search(r"<([^>]+)>\s*(.*)$", content)
            if loose_match:
                player = self._clean_player_name(loose_match.group(1))
                message = loose_match.group(2)
                if player:
                    return MessageRecord(
                        timestamp=timestamp,
                        player=player,
                        message=message,
                        raw_line=raw_line,
                        line_number=line_number
                    )

        # Non-chat line (system message, player join/leave, death, etc.)
        return None

    def _clean_player_name(self, raw_player: str) -> str:
        """Strips rank prefixes like [VIP] or [Admin] if present in username."""
        # e.g. "[Admin] Steve" -> "Steve"
        cleaned = re.sub(r"^\[[^\]]+\]\s*", "", raw_player.strip())
        # e.g. "Steve [Mod]" -> "Steve"
        cleaned = re.sub(r"\s*\[[^\]]+\]$", "", cleaned)
        return cleaned.strip()
