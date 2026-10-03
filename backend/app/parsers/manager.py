from typing import List, Optional, Tuple, Dict, Any
from collections import Counter
from app.parsers.base import BaseParser
from app.parsers.minecraft import MinecraftParser
from app.parsers.generic import GenericTextParser
from app.parsers.csv_parser import CSVLogParser
from app.parsers.discord_parser import DiscordLogParser
from app.schemas.log import LogParseResponse, MessageRecord, ParseErrorRecord
from app.engine.rules import rule_engine
from app.engine.ai_moderator import ai_moderator
from app.engine.hybrid_scorer import hybrid_scorer
from app.engine.player_profiler import player_profiler, PlayerProfile
from app.engine.context_analyzer import context_analyzer, ContextAnalysisResult


class ParserManager:
    """Coordinates parsers, AI/rule hybrid analysis, context windows, and player profiles."""

    def __init__(self):
        self.parsers: List[BaseParser] = [
            DiscordLogParser(),
            MinecraftParser(),
            CSVLogParser(),
            GenericTextParser(),
        ]
        # Active in-memory session cache
        self.current_messages: List[MessageRecord] = []
        self.current_profiles: Dict[str, PlayerProfile] = {}

    def detect_parser(self, lines: List[str], filename: str) -> BaseParser:
        if filename.lower().endswith('.csv'):
            return CSVLogParser()

        # If the file contains the Discord-like delimiter '»', use DiscordLogParser
        if any('»' in line for line in lines[:100]):
            return DiscordLogParser()

        # Use a larger sample for parser detection to improve accuracy
        sample_lines = [l.strip() for l in lines[:100] if l.strip()]
        for parser in self.parsers:
            if parser.can_parse(sample_lines):
                return parser

        return MinecraftParser()

    def process_file_content(self, filename: str, content: str, parser_override: Optional[str] = None) -> LogParseResponse:
        lines = content.splitlines()
        total_lines = len(lines)
        file_size_bytes = len(content.encode("utf-8"))

        if parser_override:
            parser = next((p for p in self.parsers if p.name == parser_override), None)
            if not parser:
                parser = self.detect_parser(lines, filename)
        else:
            parser = self.detect_parser(lines, filename)

        raw_messages, errors = parser.parse_lines(lines)

        evaluated_messages: List[MessageRecord] = []
        severity_counts: Dict[str, int] = Counter()
        category_counts: Dict[str, int] = Counter()
        flagged_count = 0
        crit_count = 0
        high_count = 0

        for idx, msg in enumerate(raw_messages):
            # 1. Rule evaluation
            rule_eval = rule_engine.evaluate(msg.message)
            # 2. AI evaluation
            ai_eval = ai_moderator.analyze_message(msg.message)
            # 3. Hybrid synthesis
            hybrid_eval = hybrid_scorer.score(msg.message, rule_eval, ai_eval)

            is_flagged = hybrid_eval.is_flagged

            if is_flagged:
                flagged_count += 1
                severity_counts[hybrid_eval.severity] += 1
                if hybrid_eval.severity == "critical":
                    crit_count += 1
                elif hybrid_eval.severity == "high":
                    high_count += 1

                for cat in hybrid_eval.all_categories:
                    category_counts[cat] += 1

            evaluated_messages.append(MessageRecord(
                id=idx,
                timestamp=msg.timestamp,
                player=msg.player,
                message=msg.message,
                raw_line=msg.raw_line,
                line_number=msg.line_number,
                is_flagged=is_flagged,
                overall_score=hybrid_eval.overall_score,
                rule_score=hybrid_eval.rule_score,
                ai_score=hybrid_eval.ai_score,
                severity=hybrid_eval.severity,
                confidence=hybrid_eval.confidence,
                primary_category=hybrid_eval.primary_category,
                categories=hybrid_eval.all_categories,
                reasons=hybrid_eval.reasons,
                ai_breakdown=hybrid_eval.ai_breakdown,
                review_status="unreviewed",
                moderator_notes=""
            ))

        # Store in current session
        self.current_messages = evaluated_messages

        # Build player behavioral profiles
        dict_msgs = [m.model_dump() for m in evaluated_messages]
        profiles = player_profiler.build_profiles(dict_msgs)
        self.current_profiles = profiles

        unique_players = sorted(list(profiles.keys()))

        return LogParseResponse(
            file_name=filename,
            file_size_bytes=file_size_bytes,
            lines_processed=total_lines,
            messages_detected=len(evaluated_messages),
            unique_players_count=len(unique_players),
            unique_players=unique_players,
            detected_format=parser.name,
            parsing_errors=errors,
            flagged_messages_count=flagged_count,
            critical_severity_count=crit_count,
            high_severity_count=high_count,
            severity_breakdown=dict(severity_counts),
            category_breakdown=dict(category_counts),
            player_profiles=profiles,
            messages_preview=evaluated_messages
        )

    def get_message_context(self, msg_id: int, window: int = 3) -> ContextAnalysisResult:
        if not self.current_messages:
            raise ValueError("No active log dataset loaded.")
        dict_msgs = [m.model_dump() for m in self.current_messages]
        return context_analyzer.extract_and_analyze(dict_msgs, msg_id, window=window)

    def update_message_action(self, msg_id: int, action: str, notes: Optional[str] = None) -> MessageRecord:
        if msg_id < 0 or msg_id >= len(self.current_messages):
            raise ValueError(f"Message ID {msg_id} not found.")

        msg = self.current_messages[msg_id]
        msg.review_status = action
        if notes is not None:
            msg.moderator_notes = notes

        # Update in-memory
        self.current_messages[msg_id] = msg
        return msg

parser_manager = ParserManager()
