import pytest
from app.engine.rules import rule_engine
from app.engine.ai_moderator import ai_moderator
from app.engine.hybrid_scorer import hybrid_scorer
from app.engine.context_analyzer import context_analyzer
from app.engine.player_profiler import player_profiler
from app.parsers.manager import parser_manager

def test_hybrid_scoring_synthesis():
    message = "nobody wants you here, uninstall the game"
    rule_res = rule_engine.evaluate(message)
    ai_res = ai_moderator.analyze_message(message)
    hybrid_res = hybrid_scorer.score(message, rule_res, ai_res)

    assert hybrid_res.is_flagged
    assert hybrid_res.overall_score >= 0.70
    assert hybrid_res.severity in ("medium", "high", "critical")
    assert any("AI detected" in r for r in hybrid_res.reasons)

def test_context_window_extraction():
    messages = [
        {"line_number": 1, "timestamp": "12:00:01", "player": "Steve", "message": "hello", "is_flagged": False, "severity": "none"},
        {"line_number": 2, "timestamp": "12:00:05", "player": "Griefer", "message": "shut up noob", "is_flagged": True, "severity": "low"},
        {"line_number": 3, "timestamp": "12:00:10", "player": "Griefer", "message": "nobody likes you", "is_flagged": True, "severity": "medium"},
        {"line_number": 4, "timestamp": "12:00:15", "player": "Steve", "message": "stop it", "is_flagged": False, "severity": "none"},
    ]
    # Target is message at index 2 (line 3)
    ctx = context_analyzer.extract_and_analyze(messages, target_idx=2, window=2)
    assert ctx.target_line_number == 3
    assert len(ctx.preceding) == 2
    assert len(ctx.succeeding) == 1
    assert ctx.classification in ("repeated_harassment", "targeted_abuse", "escalation")
    assert ctx.context_boost > 0.0

def test_player_profiling():
    messages = [
        {"player": "Steve", "is_flagged": False, "severity": "none", "categories": [], "ai_breakdown": {"toxicity": 0.0}},
        {"player": "Steve", "is_flagged": False, "severity": "none", "categories": [], "ai_breakdown": {"toxicity": 0.0}},
        {"player": "BadActor", "is_flagged": True, "severity": "high", "categories": ["harassment"], "ai_breakdown": {"toxicity": 0.85}},
        {"player": "BadActor", "is_flagged": True, "severity": "critical", "categories": ["threat"], "ai_breakdown": {"toxicity": 0.95}},
    ]
    profiles = player_profiler.build_profiles(messages)
    assert "Steve" in profiles
    assert "BadActor" in profiles

    steve_p = profiles["Steve"]
    assert steve_p.total_messages == 2
    assert steve_p.flagged_messages == 0
    assert steve_p.review_status_tier == "clean"

    bad_p = profiles["BadActor"]
    assert bad_p.total_messages == 2
    assert bad_p.flagged_messages == 2
    assert bad_p.critical_severity_count == 1
    assert bad_p.review_status_tier == "high_priority_review"

def test_moderator_action_persistence():
    content = "[21:14:00 INFO]: <Griefer> kys noob"
    res = parser_manager.process_file_content("test.log", content)
    assert res.flagged_messages_count == 1

    # Update action
    updated = parser_manager.update_message_action(0, "confirmed", "Confirmed severe suicide threat")
    assert updated.review_status == "confirmed"
    assert updated.moderator_notes == "Confirmed severe suicide threat"

    # Context retrieval
    ctx = parser_manager.get_message_context(0, window=2)
    assert ctx.target.player == "Griefer"
