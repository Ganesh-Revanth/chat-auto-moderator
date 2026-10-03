import pytest
from app.engine.ai_moderator import LocalSemanticModerator, ThresholdConfig

def test_clean_message_ai_evaluation():
    moderator = LocalSemanticModerator()
    res = moderator.analyze_message("Hey Steve, can you pass the iron ingots?")
    assert res.threshold_tier == "unlikely"
    assert res.max_confidence < 0.40
    assert res.scores.toxicity == 0.0
    assert res.model_name == "LocalSemanticModerator-DistilNLP"
    assert res.model_version is not None
    assert res.analysis_timestamp is not None

def test_harassment_detection_without_direct_slurs():
    moderator = LocalSemanticModerator()
    # Problematic message that doesn't rely solely on vulgar swearwords
    res = moderator.analyze_message("nobody wants you here, uninstall the game and delete your account")
    assert res.scores.harassment >= 0.70
    assert res.scores.toxicity >= 0.70
    assert res.threshold_tier in ("likely", "highly_likely")
    assert res.top_category in ("toxicity", "harassment", "personal_attack")

def test_threat_detection_ai():
    moderator = LocalSemanticModerator()
    res = moderator.analyze_message("i know where you live, watch your back")
    assert res.scores.threat >= 0.85
    assert res.threshold_tier in ("likely", "highly_likely")

def test_configurable_thresholds():
    custom_thresholds = ThresholdConfig(
        unlikely_max=0.20,
        questionable_max=0.50,
        likely_max=0.80,
        highly_likely_min=0.81
    )
    custom_mod = LocalSemanticModerator(thresholds=custom_thresholds)
    res = custom_mod.analyze_message("stop talking and get out of here")
    assert res.scores.toxicity > 0.50
    # Under custom thresholds, > 0.50 triggers likely or highly_likely
    assert res.threshold_tier in ("likely", "highly_likely")
