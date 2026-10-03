from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from app.engine.rules import RuleResult
from app.engine.ai_moderator import AIModerationResult

class HybridModerationScore(BaseModel):
    is_flagged: bool = False
    overall_score: float = 0.0
    rule_score: float = 0.0
    ai_score: float = 0.0
    severity: str = "none" # none, low, medium, high, critical
    confidence: float = 0.0
    primary_category: str = "none"
    all_categories: List[str] = Field(default_factory=list)
    reasons: List[str] = Field(default_factory=list)
    ai_breakdown: Dict[str, float] = Field(default_factory=dict)
    rule_breakdown: List[str] = Field(default_factory=list)

class HybridScorer:
    """
    Synthesizes deterministic rule evaluations and ML/AI toxicity scores into an
    explainable overall moderation verdict with clear human-readable justifications.
    """

    SEVERITY_WEIGHTS = {
        "none": 0.0,
        "low": 0.45,
        "medium": 0.70,
        "high": 0.88,
        "critical": 0.98
    }

    def score(
        self,
        message: str,
        rule_res: RuleResult,
        ai_res: AIModerationResult,
        context_boost: float = 0.0
    ) -> HybridModerationScore:
        rule_score = self.SEVERITY_WEIGHTS.get(rule_res.severity, 0.0)
        ai_score = ai_res.max_confidence

        # Combine scores with explainable weighting
        if rule_res.severity in ("critical", "high") and rule_score >= 0.88:
            # Deterministic hard-rule violations take priority
            overall_score = max(rule_score, ai_score)
        elif rule_res.is_flagged and ai_score > 0.40:
            # Dual reinforcement: both rule and AI detected signals
            overall_score = min(1.0, (rule_score * 0.5) + (ai_score * 0.5) + context_boost)
        elif rule_res.is_flagged:
            overall_score = rule_score
        elif ai_score >= 0.70:
            # AI caught subtle hostility/harassment missed by keyword rules
            overall_score = ai_score
        elif ai_score >= 0.40:
            overall_score = ai_score * 0.8
        else:
            overall_score = 0.0

        overall_score = round(min(1.0, overall_score), 2)
        confidence = round(max(rule_res.confidence, ai_res.max_confidence), 2)

        # Severity tier
        if overall_score >= 0.95 or rule_res.severity == "critical":
            severity = "critical"
        elif overall_score >= 0.80 or rule_res.severity == "high":
            severity = "high"
        elif overall_score >= 0.55 or rule_res.severity == "medium":
            severity = "medium"
        elif overall_score >= 0.35 or rule_res.severity == "low":
            severity = "low"
        else:
            severity = "none"

        is_flagged = severity != "none"

        # Combine all categories
        combined_categories = set(rule_res.categories)
        if ai_res.top_category and ai_res.max_confidence >= 0.50:
            combined_categories.add(ai_res.top_category)

        # Primary category
        if "threat" in combined_categories:
            primary_category = "threat"
        elif "slur" in combined_categories:
            primary_category = "slur"
        elif "harassment" in combined_categories:
            primary_category = "harassment"
        elif "insult" in combined_categories:
            primary_category = "insult"
        elif "profanity" in combined_categories:
            primary_category = "profanity"
        elif "suspicious_url" in combined_categories:
            primary_category = "suspicious_url"
        elif "spam" in combined_categories:
            primary_category = "spam"
        elif combined_categories:
            primary_category = sorted(list(combined_categories))[0]
        else:
            primary_category = "none"

        # Synthesize explainable bullet points
        reasons: List[str] = []
        for r in rule_res.reasons:
            reasons.append(f"Rule match: {r}")

        ai_scores_dict = ai_res.scores.model_dump()
        for cat, val in ai_scores_dict.items():
            if val >= 0.70:
                reasons.append(f"AI detected strong {cat.replace('_', ' ')} signals ({int(val * 100)}%)")
            elif val >= 0.45:
                reasons.append(f"AI detected moderate {cat.replace('_', ' ')} signals ({int(val * 100)}%)")

        if context_boost > 0.0:
            reasons.append("Escalation pattern detected in surrounding chat context")

        return HybridModerationScore(
            is_flagged=is_flagged,
            overall_score=overall_score,
            rule_score=round(rule_score, 2),
            ai_score=round(ai_score, 2),
            severity=severity,
            confidence=confidence if is_flagged else 0.0,
            primary_category=primary_category,
            all_categories=sorted(list(combined_categories)),
            reasons=reasons,
            ai_breakdown=ai_scores_dict,
            rule_breakdown=rule_res.reasons
        )

hybrid_scorer = HybridScorer()
