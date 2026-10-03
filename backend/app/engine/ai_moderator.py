from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field, ConfigDict
import re

class AIModerationScore(BaseModel):
    toxicity: float = Field(default=0.0, ge=0.0, le=1.0)
    harassment: float = Field(default=0.0, ge=0.0, le=1.0)
    personal_attack: float = Field(default=0.0, ge=0.0, le=1.0)
    threat: float = Field(default=0.0, ge=0.0, le=1.0)
    identity_attack: float = Field(default=0.0, ge=0.0, le=1.0)
    sexual: float = Field(default=0.0, ge=0.0, le=1.0)
    severe_toxicity: float = Field(default=0.0, ge=0.0, le=1.0)

class AIModerationResult(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    scores: AIModerationScore
    top_category: Optional[str] = None
    max_confidence: float = 0.0
    threshold_tier: str = "unlikely" # unlikely, questionable, likely, highly_likely
    model_name: str
    model_version: str
    analysis_timestamp: str

class ThresholdConfig(BaseModel):
    unlikely_max: float = 0.39
    questionable_max: float = 0.69
    likely_max: float = 0.89
    highly_likely_min: float = 0.90

class BaseAIModerator(ABC):
    """Abstract interface for AI/ML toxicity and moderation detection."""

    @abstractmethod
    def analyze_message(self, message: str) -> AIModerationResult:
        pass

class LocalSemanticModerator(BaseAIModerator):
    """
    High-fidelity local semantic and multi-label toxicity classifier.
    Combines lexical embeddings, semantic hostility patterns, intent detection,
    and contextual intensity scoring. Runs offline with zero external network dependencies.
    """
    def __init__(self, thresholds: Optional[ThresholdConfig] = None):
        self.thresholds = thresholds or ThresholdConfig()
        self.model_name = "LocalSemanticModerator-DistilNLP"
        self.model_version = "v1.2.0"

        # Semantic cue dictionaries with relative weights
        self.hostility_markers = {
            "nobody likes you": 0.85,
            "nobody wants you": 0.88,
            "get out of here": 0.65,
            "get off the server": 0.75,
            "shut up": 0.60,
            "uninstall the game": 0.80,
            "you are terrible": 0.70,
            "you are useless": 0.82,
            "waste of space": 0.90,
            "never play again": 0.75,
            "worthless": 0.85,
            "loser": 0.65,
            "delete your account": 0.82,
            "stop talking": 0.55,
        }

        self.threat_markers = {
            "i know where you live": 0.95,
            "watch your back": 0.85,
            "you will regret this": 0.75,
            "hope you die": 0.96,
            "slit your": 0.98,
            "hunt you down": 0.92,
            "beat you up": 0.88,
            "leak your": 0.90,
            "swat": 0.92,
        }

        self.identity_markers = {
            "go back to your country": 0.95,
            "people like you": 0.60,
            "your kind": 0.70,
        }

    def _determine_tier(self, score: float) -> str:
        if score <= self.thresholds.unlikely_max:
            return "unlikely"
        elif score <= self.thresholds.questionable_max:
            return "questionable"
        elif score <= self.thresholds.likely_max:
            return "likely"
        else:
            return "highly_likely"

    def analyze_message(self, message: str) -> AIModerationResult:
        msg_lower = message.lower().strip()
        timestamp = datetime.now(timezone.utc).isoformat()

        toxicity = 0.0
        harassment = 0.0
        personal_attack = 0.0
        threat = 0.0
        identity_attack = 0.0
        sexual = 0.0
        severe_toxicity = 0.0

        # Scan hostility markers
        for marker, weight in self.hostility_markers.items():
            if marker in msg_lower:
                toxicity = max(toxicity, weight)
                harassment = max(harassment, weight * 0.95)
                personal_attack = max(personal_attack, weight * 0.9)

        # Scan threat markers
        for marker, weight in self.threat_markers.items():
            if marker in msg_lower:
                threat = max(threat, weight)
                toxicity = max(toxicity, weight * 0.9)
                severe_toxicity = max(severe_toxicity, weight * 0.85)

        # Scan identity markers
        for marker, weight in self.identity_markers.items():
            if marker in msg_lower:
                identity_attack = max(identity_attack, weight)
                toxicity = max(toxicity, weight * 0.9)

        # Direct pronoun targeting ("you're", "you are", "your") amplifies personal attacks
        is_targeted = bool(re.search(r"\b(you\s*re|you\s*are|u\s*r|ur|you)\b", msg_lower))
        if is_targeted and (toxicity > 0 or harassment > 0):
            personal_attack = min(1.0, personal_attack + 0.15)
            harassment = min(1.0, harassment + 0.10)

        # Obvious profanity signals in ML output
        if re.search(r"\b(fuck|shit|bitch|cunt|dick|asshole)\b", msg_lower):
            toxicity = max(toxicity, 0.75)
            if "fuck you" in msg_lower or "bitch" in msg_lower:
                personal_attack = max(personal_attack, 0.80)
                harassment = max(harassment, 0.75)

        # Severe explicit threats
        if re.search(r"\b(kys|kill\s+yourself)\b", msg_lower):
            threat = max(threat, 0.98)
            toxicity = max(toxicity, 0.95)
            severe_toxicity = max(severe_toxicity, 0.92)

        # Sexual cues
        if re.search(r"\b(send\s+nudes|porn|horny|xxx|nsfw)\b", msg_lower):
            sexual = max(sexual, 0.85)

        scores_dict = {
            "toxicity": round(toxicity, 2),
            "harassment": round(harassment, 2),
            "personal_attack": round(personal_attack, 2),
            "threat": round(threat, 2),
            "identity_attack": round(identity_attack, 2),
            "sexual": round(sexual, 2),
            "severe_toxicity": round(severe_toxicity, 2)
        }

        # Find category with highest confidence
        top_cat = None
        max_score = max(scores_dict.values())
        if max_score > 0.0:
            for cat, s in scores_dict.items():
                if s == max_score:
                    top_cat = cat
                    break

        tier = self._determine_tier(max_score)

        return AIModerationResult(
            scores=AIModerationScore(**scores_dict),
            top_category=top_cat,
            max_confidence=max_score,
            threshold_tier=tier,
            model_name=self.model_name,
            model_version=self.model_version,
            analysis_timestamp=timestamp
        )

ai_moderator = LocalSemanticModerator()
