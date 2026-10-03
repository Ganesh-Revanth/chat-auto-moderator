from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class ContextMessage(BaseModel):
    line_number: int
    timestamp: str
    player: str
    message: str
    is_target: bool = False
    is_flagged: bool = False
    severity: str = "none"

class ContextAnalysisResult(BaseModel):
    target_line_number: int
    target_player: str
    preceding: List[ContextMessage] = Field(default_factory=list)
    target: ContextMessage
    succeeding: List[ContextMessage] = Field(default_factory=list)
    classification: str = "isolated_remark" # isolated_remark, repeated_harassment, escalation, targeted_abuse, normal_disagreement, ambiguous
    context_notes: List[str] = Field(default_factory=list)
    context_boost: float = 0.0

class ContextAnalyzer:
    """
    Analyzes multi-message dialogue sequences surrounding flagged messages
    to detect escalation patterns, repeated targeted abuse, or isolated remarks.
    """

    def extract_and_analyze(
        self,
        messages: List[Dict[str, Any]],
        target_idx: int,
        window: int = 3
    ) -> ContextAnalysisResult:
        total = len(messages)
        if target_idx < 0 or target_idx >= total:
            raise ValueError(f"Target index {target_idx} is out of bounds (total: {total})")

        start_idx = max(0, target_idx - window)
        end_idx = min(total, target_idx + window + 1)

        preceding: List[ContextMessage] = []
        for i in range(start_idx, target_idx):
            m = messages[i]
            preceding.append(ContextMessage(
                line_number=m.get("line_number", i + 1),
                timestamp=m.get("timestamp", "Unknown"),
                player=m.get("player", "Unknown"),
                message=m.get("message", ""),
                is_target=False,
                is_flagged=m.get("is_flagged", False),
                severity=m.get("severity", "none")
            ))

        target_m = messages[target_idx]
        target = ContextMessage(
            line_number=target_m.get("line_number", target_idx + 1),
            timestamp=target_m.get("timestamp", "Unknown"),
            player=target_m.get("player", "Unknown"),
            message=target_m.get("message", ""),
            is_target=True,
            is_flagged=target_m.get("is_flagged", False),
            severity=target_m.get("severity", "none")
        )

        succeeding: List[ContextMessage] = []
        for i in range(target_idx + 1, end_idx):
            m = messages[i]
            succeeding.append(ContextMessage(
                line_number=m.get("line_number", i + 1),
                timestamp=m.get("timestamp", "Unknown"),
                player=m.get("player", "Unknown"),
                message=m.get("message", ""),
                is_target=False,
                is_flagged=m.get("is_flagged", False),
                severity=m.get("severity", "none")
            ))

        # Contextual Behavioral Analysis
        author = target.player
        same_author_count = sum(1 for p in preceding if p.player == author) + sum(1 for s in succeeding if s.player == author)
        same_author_flags = sum(1 for p in preceding if p.player == author and p.is_flagged)

        context_notes: List[str] = []
        context_boost = 0.0
        classification = "isolated_remark"

        # Check for repeated harassment from same player
        if same_author_flags >= 1:
            classification = "repeated_harassment"
            context_notes.append(f"Player {author} has sent multiple flagged messages in this immediate dialogue sequence.")
            context_boost = 0.15

        # Check for rapid conversational escalation between 2 players
        all_players_in_window = {p.player for p in preceding} | {s.player for s in succeeding}
        other_players = [p for p in all_players_in_window if p != author]
        
        has_dialogue_exchange = len(other_players) == 1 and len(preceding) >= 2
        if has_dialogue_exchange and target.is_flagged:
            if classification == "repeated_harassment":
                classification = "targeted_abuse"
                context_notes.append(f"Targeted hostility concentrated towards {other_players[0]}.")
                context_boost = 0.20
            else:
                classification = "escalation"
                context_notes.append(f"Heated dialogue exchange observed between {author} and {other_players[0]}.")
                context_boost = 0.10

        if not target.is_flagged and same_author_flags == 0:
            classification = "normal_disagreement" if len(preceding) > 0 else "isolated_remark"

        return ContextAnalysisResult(
            target_line_number=target.line_number,
            target_player=target.player,
            preceding=preceding,
            target=target,
            succeeding=succeeding,
            classification=classification,
            context_notes=context_notes,
            context_boost=context_boost
        )

context_analyzer = ContextAnalyzer()
