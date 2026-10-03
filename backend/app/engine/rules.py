import re
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from app.engine.normalizer import normalizer

class RuleResult(BaseModel):
    is_flagged: bool = False
    categories: List[str] = Field(default_factory=list)
    severity: str = "none" # "none", "low", "medium", "high", "critical"
    confidence: float = 0.0
    reasons: List[str] = Field(default_factory=list)

class RuleModerationEngine:
    """
    Deterministic rule-based moderation engine with de-obfuscation,
    repetition collapse, spam detection, and false-positive guards.
    """

    SEVERITY_RANKS = {
        "none": 0,
        "low": 1,
        "medium": 2,
        "high": 3,
        "critical": 4
    }

    # Strict false-positive exemptions: if matched exact word is in this list, do not flag as profanity
    EXEMPT_WORDS = {
        "grass", "bass", "compass", "classic", "class", "classes",
        "mass", "pass", "passed", "passing", "glass", "glasses",
        "asset", "assets", "assist", "assistant", "assistance",
        "peacock", "cockpit", "cockatoo", "cocktail",
        "scrap", "scraps", "scrapped",
        "hello", "shell", "shells", "helium",
        "title", "titles", "titan", "attitude", "entity", "entities",
        "spite", "despite", "hospitable",
        "butter", "canal", "country", "count"
    }

    # Severe slurs and hate speech (critical severity)
    SLUR_PATTERNS = [
        (r"\b(n[i1l]gg[e3a4]r?|n[i1l]g+a)\b", "Severe racial slur detected", 0.99, "critical"),
        (r"\b(f[a4]gg?[o0i1]t?s?|f[a4]g)\b", "Severe homophobic slur detected", 0.98, "critical"),
        (r"\b(tr[a4]nn[y1i]|ch[i1]nk|k[i1]ke|sp[i1]c|w[e3]tb[a4]ck)\b", "Hate speech / identity slur detected", 0.98, "critical"),
        (r"\b(retard(?:ed)?|tard)\b", "Ableist slur / derogatory term detected", 0.94, "high"),
    ]

    # Threats and violence
    THREAT_PATTERNS = [
        (r"\b(k[y1i]s|k[i1]ll\s+y(?:our)?self)\b", "Suicide encouragement / threat (kys)", 0.98, "critical"),
        (r"\b(i(?:\s*will|'ll|\s+gonna)\s+(?:[\w\s]{0,20}\s+)?(?:kill|murder|hunt|shoot|stab|slit)\s+(?:you|u))\b", "Direct physical violence threat", 0.95, "critical"),
        (r"\b(doxx?(?:ing|ed)?\s+you|leak(?:ing)?\s+your\s+(?:ip|address|coords))\b", "Doxxing / personal information threat", 0.93, "high"),
        (r"\b(swat(?:ting)?\s+you)\b", "Swatting threat", 0.95, "critical"),
    ]

    # Targeted insults
    INSULT_PATTERNS = [
        (r"\b(idiot|idiots|idiotic)\b", "Direct insult (idiot)", 0.90, "medium"),
        (r"\b(moron|morons|imbecile)\b", "Direct insult (moron)", 0.88, "medium"),
        (r"\b(loser|losers|noob|trash\s+player)\b", "Derogatory taunt / insult", 0.75, "low"),
        (r"\b(stfu|shut\s+up|get\s+lost|get\s+cancer)\b", "Hostile harassment / abusive demand", 0.86, "medium"),
        (r"\b(clown|garbage|worthless)\b", "Belittling insult", 0.80, "low"),
    ]

    # General profanity (medium to high)
    PROFANITY_PATTERNS = [
        (r"\b(f+u+c+k+(?:ing|er|ed)?|f+k)\b", "Explicit profanity (f-word)", 0.92, "medium"),
        (r"\b(s+h+i+t+(?:ty|head)?)\b", "Vulgar profanity (shit)", 0.85, "low"),
        (r"\b(b+i+t+c+h+(?:es)?)\b", "Vulgar profanity (bitch)", 0.90, "medium"),
        (r"\b(a+s+s+h+o+l+e+s?)\b", "Vulgar profanity (asshole)", 0.90, "medium"),
        (r"\b(b+a+s+t+a+r+d+s?)\b", "Vulgar profanity (bastard)", 0.85, "low"),
        (r"\b(c+u+n+t+s?)\b", "Severe profanity (cunt)", 0.96, "high"),
        (r"\b(d+i+c+k+(?:head)?)\b", "Vulgar profanity (dick)", 0.88, "medium"),
        (r"\b(p+u+s+s+y+)\b", "Vulgar profanity (pussy)", 0.90, "medium"),
    ]

    # Sexual content
    SEXUAL_PATTERNS = [
        (r"\b(send\s+nudes?|nsfw|porn(?:o|ography)?|xxx)\b", "Inappropriate / sexual solicitation", 0.92, "high"),
        (r"\b(horny|blowjob|handjob|hentai)\b", "Sexually explicit content", 0.88, "medium"),
    ]

    # Suspicious advertisements / URLs / External server promotion
    SUSPICIOUS_URL_PATTERNS = [
        (r"(?:https?:\/\/)?discord(?:\.gg|\.com\/invite)\/[a-zA-Z0-9]+", "External Discord server invite advertisement", 0.95, "medium"),
        (r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d{1,5})?\b", "Suspicious raw IPv4 address advertisement", 0.92, "medium"),
        (r"\b(?:join|play|connect)\s+(?:at|on|my\s+server)\s+[a-zA-Z0-9\.\-]+\.[a-z]{2,}\b", "External server advertisement", 0.85, "low"),
    ]

    def evaluate(self, raw_message: str) -> RuleResult:
        if not raw_message or not raw_message.strip():
            return RuleResult()

        reasons: List[str] = []
        categories: set = set()
        highest_severity = "none"
        max_confidence = 0.0

        def update_severity(cand_sev: str):
            nonlocal highest_severity
            if self.SEVERITY_RANKS.get(cand_sev, 0) > self.SEVERITY_RANKS.get(highest_severity, 0):
                highest_severity = cand_sev

        def update_confidence(cand_conf: float):
            nonlocal max_confidence
            if cand_conf > max_confidence:
                max_confidence = cand_conf

        # 1. Spam checks on original message
        # Excessive capitalization (> 70% uppercase in messages with >= 6 alphabetic characters)
        alpha_chars = [c for c in raw_message if c.isalpha()]
        if len(alpha_chars) >= 6:
            upper_count = sum(1 for c in alpha_chars if c.isupper())
            if (upper_count / len(alpha_chars)) >= 0.75:
                categories.add("spam")
                update_severity("low")
                update_confidence(0.85)
                reasons.append("Excessive capitalization (caps lock spam)")

        # Excessive punctuation (4 or more consecutive exclamation or question marks)
        if re.search(r"[!?]{4,}", raw_message):
            categories.add("spam")
            update_severity("low")
            update_confidence(0.80)
            reasons.append("Excessive punctuation spam")

        # Character flooding (e.g. "aaaaaaa" or "noooooooo")
        if re.search(r"([a-zA-Z])\1{5,}", raw_message):
            categories.add("spam")
            update_severity("low")
            update_confidence(0.80)
            reasons.append("Character flood repetition spam")

        # 2. Suspicious URLs / Ads
        for pattern, reason, conf, sev in self.SUSPICIOUS_URL_PATTERNS:
            if re.search(pattern, raw_message, re.IGNORECASE):
                categories.add("suspicious_url")
                update_severity(sev)
                update_confidence(conf)
                reasons.append(reason)

        # 3. Content normalization for lexical & obfuscation checks
        deobfuscated = normalizer.deobfuscate(raw_message)

        # Check slurs
        for pattern, reason, conf, sev in self.SLUR_PATTERNS:
            if re.search(pattern, deobfuscated):
                categories.add("slur")
                update_severity(sev)
                update_confidence(conf)
                reasons.append(reason)

        # Check threats
        for pattern, reason, conf, sev in self.THREAT_PATTERNS:
            if re.search(pattern, deobfuscated):
                categories.add("threat")
                update_severity(sev)
                update_confidence(conf)
                reasons.append(reason)

        # Check insults
        for pattern, reason, conf, sev in self.INSULT_PATTERNS:
            if re.search(pattern, deobfuscated):
                categories.add("insult")
                update_severity(sev)
                update_confidence(conf)
                reasons.append(reason)

        # Check profanity with false positive protection
        for pattern, reason, conf, sev in self.PROFANITY_PATTERNS:
            for match in re.finditer(pattern, deobfuscated):
                word = match.group(0).lower()
                # Verify word is not in exempt list
                if word in self.EXEMPT_WORDS:
                    continue
                categories.add("profanity")
                update_severity(sev)
                update_confidence(conf)
                reasons.append(f"{reason}: '{word}'")
                break

        # Check sexual content
        for pattern, reason, conf, sev in self.SEXUAL_PATTERNS:
            if re.search(pattern, deobfuscated):
                categories.add("sexual")
                update_severity(sev)
                update_confidence(conf)
                reasons.append(reason)

        is_flagged = len(categories) > 0

        return RuleResult(
            is_flagged=is_flagged,
            categories=sorted(list(categories)),
            severity=highest_severity if is_flagged else "none",
            confidence=round(max_confidence, 2) if is_flagged else 0.0,
            reasons=reasons
        )

rule_engine = RuleModerationEngine()
