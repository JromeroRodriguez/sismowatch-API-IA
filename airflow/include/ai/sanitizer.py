"""Input sanitization module for external text to prevent Prompt Injection (OWASP LLM01:2025)."""

import re
import unicodedata

# Common prompt injection triggers to sanitize
SUSPICIOUS_PATTERNS = [
    r"(?i)ignore\s+(all\s+)?(previous|prior|above)\s+instructions",
    r"(?i)disregard\s+(all\s+)?(previous|prior|above)\s+instructions",
    r"(?i)system\s*prompt",
    r"(?i)you\s+are\s+now",
    r"(?i)jailbreak",
    r"(?i)drop\s+table",
    r"(?i)exec\s*\(",
    r"(?i)<script.*?>.*?</script>",
]


def sanitize_place_text(raw_text: str | None, max_length: int = 150) -> str:
    """Sanitize 'place' or location string before passing to LLM prompts.

    1. Normalizes unicode characters.
    2. Strips control and non-printable characters.
    3. Neutralizes known prompt injection and instruction override patterns.
    4. Truncates length to prevent buffer/token bloating.
    """
    if not raw_text:
        return "Ubicación no especificada"

    # Normalize unicode (NFKC)
    text = unicodedata.normalize("NFKC", str(raw_text))

    # Remove non-printable / control characters (keep standard ASCII and accented letters)
    text = re.sub(r"[\x00-\x1f\x7f-\x9f]", "", text)

    # Neutralize injection patterns
    for pattern in SUSPICIOUS_PATTERNS:
        text = re.sub(pattern, "[FILTRADO_POR_SEGURIDAD]", text)

    # Remove dangerous markup/delimiters
    text = text.replace("```", "").replace("<", "").replace(">", "")

    # Clean redundant whitespace
    text = " ".join(text.split())

    # Truncate
    if len(text) > max_length:
        text = text[:max_length] + "..."

    return text.strip()
