import pytest
from app.engine.rules import rule_engine

def test_detect_insult():
    res = rule_engine.evaluate("You are such an idiot")
    assert res.is_flagged
    assert "insult" in res.categories
    assert res.severity in ("low", "medium", "high")
    assert res.confidence >= 0.85
    assert any("idiot" in r for r in res.reasons)

def test_detect_obfuscated_insult():
    obfuscated_cases = [
        "You are an IDIOT",
        "You are an iDiOt",
        "You are an i.d.i.o.t",
        "You are an i d i o t",
        "You are an 1d!0t",
    ]
    for case in obfuscated_cases:
        res = rule_engine.evaluate(case)
        assert res.is_flagged, f"Failed to flag obfuscated case: {case}"
        assert "insult" in res.categories

def test_detect_threats():
    res = rule_engine.evaluate("kys right now")
    assert res.is_flagged
    assert "threat" in res.categories
    assert res.severity == "critical"
    assert res.confidence >= 0.95

    res2 = rule_engine.evaluate("I will find and kill you")
    assert res2.is_flagged
    assert "threat" in res2.categories
    assert res2.severity == "critical"

def test_detect_profanity():
    res = rule_engine.evaluate("What the fuck are you doing?")
    assert res.is_flagged
    assert "profanity" in res.categories
    assert res.severity in ("medium", "high")

def test_detect_caps_spam():
    res = rule_engine.evaluate("PLEASE GIVE ME DIAMONDS RIGHT NOW")
    assert res.is_flagged
    assert "spam" in res.categories
    assert any("caps lock" in r.lower() for r in res.reasons)

def test_detect_punctuation_spam():
    res = rule_engine.evaluate("where are you guys??????!!!!!")
    assert res.is_flagged
    assert "spam" in res.categories

def test_detect_suspicious_url():
    res = rule_engine.evaluate("Join our voice at discord.gg/abcxyz")
    assert res.is_flagged
    assert "suspicious_url" in res.categories

    res2 = rule_engine.evaluate("Connect to 192.168.1.100:25565 now")
    assert res2.is_flagged
    assert "suspicious_url" in res2.categories

def test_false_positive_prevention():
    """
    Critical tests ensuring innocent words containing problematic substrings
    are NOT flagged by mistake (Scunthorpe problem).
    """
    clean_messages = [
        "Look at that tall green grass in the field",
        "I caught a large bass while fishing in the lake",
        "Check your compass to navigate towards coordinates",
        "This fortress is a classic build design",
        "Can anyone assist me with gathering stone?",
        "The jet has a high tech cockpit setup",
        "We need to recycle that scrap metal",
        "Hello everyone, welcome to the new world",
        "I reached the highest title in the clan",
        "The entity count on the chunk is normal",
        "She has a wonderful attitude towards newcomers",
        "Just passing through the spawn village",
        "Let's make a glass dome over the farm"
    ]
    for msg in clean_messages:
        res = rule_engine.evaluate(msg)
        assert not res.is_flagged, f"FALSE POSITIVE: '{msg}' was incorrectly flagged with categories {res.categories} and reasons {res.reasons}"
