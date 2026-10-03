import pytest
from app.engine.normalizer import normalizer

def test_basic_normalize():
    raw = "  Hello   WORLD!  "
    assert normalizer.normalize(raw) == "hello world!"

def test_unicode_accents_homoglyphs():
    raw = "Héllò Wörld"
    assert "hello" in normalizer.normalize(raw)

def test_deobfuscation_repetition():
    raw = "baaaad"
    assert normalizer.deobfuscate(raw) == "baad"
    raw2 = "noooooooo"
    assert normalizer.deobfuscate(raw2) == "noo"

def test_deobfuscation_leetspeak():
    raw = "1d!0t"
    deobf = normalizer.deobfuscate(raw)
    assert deobf == "idiot"

def test_deobfuscation_spaced_and_dotted():
    test_cases = [
        ("idiot", "idiot"),
        ("IDIOT", "idiot"),
        ("iDiOt", "idiot"),
        ("i.d.i.o.t", "idiot"),
        ("i d i o t", "idiot"),
        ("i-d-i-o-t", "idiot"),
    ]
    for input_text, expected in test_cases:
        assert normalizer.deobfuscate(input_text) == expected, f"Failed for {input_text}"
