from typing import List, Dict, Any, Optional
from collections import Counter, defaultdict
from pydantic import BaseModel, Field

class PlayerProfile(BaseModel):
    username: str
    total_messages: int = 0
    flagged_messages: int = 0
    flagged_percentage: float = 0.0
    critical_severity_count: int = 0
    high_severity_count: int = 0
    medium_severity_count: int = 0
    low_severity_count: int = 0
    average_toxicity: float = 0.0
    threat_count: int = 0
    harassment_count: int = 0
    insult_count: int = 0
    spam_count: int = 0
    profanity_count: int = 0
    common_categories: List[str] = Field(default_factory=list)
    review_status_tier: str = "clean" # clean, flagged, requires_review, repeated_flags, high_priority_review
    first_seen_timestamp: Optional[str] = None
    last_seen_timestamp: Optional[str] = None

class PlayerProfiler:
    """Aggregates per-player statistics and behavioral profiles across chat sessions."""

    def build_profiles(self, evaluated_messages: List[Dict[str, Any]]) -> Dict[str, PlayerProfile]:
        player_msgs = defaultdict(list)
        for msg in evaluated_messages:
            player_msgs[msg["player"]].append(msg)

        profiles: Dict[str, PlayerProfile] = {}

        for player, msgs in player_msgs.items():
            total = len(msgs)
            flagged_msgs = [m for m in msgs if m.get("is_flagged", False)]
            flagged_count = len(flagged_msgs)

            crit_count = sum(1 for m in flagged_msgs if m.get("severity") == "critical")
            high_count = sum(1 for m in flagged_msgs if m.get("severity") == "high")
            med_count = sum(1 for m in flagged_msgs if m.get("severity") == "medium")
            low_count = sum(1 for m in flagged_msgs if m.get("severity") == "low")

            category_counts = Counter()
            for m in flagged_msgs:
                for c in m.get("categories", []):
                    category_counts[c] += 1

            # Common categories
            common = [cat for cat, _ in category_counts.most_common(3)]

            # Toxicity average
            toxicity_scores = []
            for m in msgs:
                ai_b = m.get("ai_breakdown", {})
                if "toxicity" in ai_b:
                    toxicity_scores.append(ai_b["toxicity"])
            avg_toxicity = round(sum(toxicity_scores) / len(toxicity_scores), 2) if toxicity_scores else 0.0

            # Determine objective, neutral review status tier
            if crit_count > 0 or high_count >= 2:
                tier = "high_priority_review"
            elif flagged_count >= 3:
                tier = "repeated_flags"
            elif flagged_count >= 1:
                tier = "requires_review"
            else:
                tier = "clean"

            profiles[player] = PlayerProfile(
                username=player,
                total_messages=total,
                flagged_messages=flagged_count,
                flagged_percentage=round((flagged_count / total) * 100, 1) if total > 0 else 0.0,
                critical_severity_count=crit_count,
                high_severity_count=high_count,
                medium_severity_count=med_count,
                low_severity_count=low_count,
                average_toxicity=avg_toxicity,
                threat_count=category_counts.get("threat", 0),
                harassment_count=category_counts.get("harassment", 0),
                insult_count=category_counts.get("insult", 0),
                spam_count=category_counts.get("spam", 0),
                profanity_count=category_counts.get("profanity", 0),
                common_categories=common,
                review_status_tier=tier,
                first_seen_timestamp=msgs[0].get("timestamp") if msgs else None,
                last_seen_timestamp=msgs[-1].get("timestamp") if msgs else None
            )

        return profiles

player_profiler = PlayerProfiler()
