import unicodedata
import re

class TextNormalizer:
    """
    Normalizes chat messages to reveal obfuscated terms while preserving
    clean tokens for semantic matching.
    """

    # Common leetspeak substitutions
    LEET_MAP = {
        '0': 'o',
        '1': 'i',
        '!': 'i',
        '|': 'l',
        '3': 'e',
        '4': 'a',
        '@': 'a',
        '5': 's',
        '$': 's',
        '7': 't',
        '+': 't',
        '8': 'b',
        '9': 'g',
    }

    def __init__(self):
        # Build translation table
        self.leet_trans = str.maketrans(self.LEET_MAP)

    def normalize(self, text: str) -> str:
        """Standard normalization: Unicode NFKD, lowercase, whitespace stripped."""
        if not text:
            return ""
        # 1. Unicode NFKD normalization (decomposes accents, strips homoglyphs)
        nfkd = unicodedata.normalize('NFKD', text)
        # Strip combining diacritical marks (accents)
        stripped_accents = ''.join(c for c in nfkd if unicodedata.category(c) != 'Mn')
        # 2. Lowercase
        normalized = stripped_accents.lower()
        # 3. Collapse multiple whitespace characters into single space
        normalized = re.sub(r'\s+', ' ', normalized).strip()
        return normalized

    def deobfuscate(self, text: str) -> str:
        """
        Aggressive normalization to catch obfuscated words like:
        - i.d.i.o.t -> idiot
        - i d i o t -> idiot
        - 1d!0t -> idiot
        - baaaad -> baad
        """
        normalized = self.normalize(text)

        # 1. Collapse repetition: 3 or more of any identical character to 2 (e.g., "baaaad" -> "baad", "nooooo" -> "noo")
        collapsed_repeats = re.sub(r'(.)\1{2,}', r'\1\1', normalized)

        # 2. Translate leetspeak numbers and symbols
        de_leeted = collapsed_repeats.translate(self.leet_trans)

        # 3. Handle dot/space/dash separation within words:
        # e.g., "i.d.i.o.t" or "i d i o t" or "i-d-i-o-t"
        # If single characters are separated by punctuation or spaces, merge them
        merged_spaced = re.sub(r'(?<=\b[a-z])[\s\.\-_/\\*~]+(?=[a-z]\b)', '', de_leeted)

        return merged_spaced

    def collapse_char_floods(self, text: str) -> str:
        """Collapses extreme runs of repeated characters to a single character."""
        return re.sub(r'(.)\1{2,}', r'\1', text)

normalizer = TextNormalizer()
