"""OpenAI-powered preference interviewer.

The agent conducts a conversational interview in Hebrew to build the user's
rental preference profile. It ends with a structured JSON extraction that
gets saved to User.preferences.

Without an OPENAI_API_KEY set, the service returns a scripted fallback
conversation so the UI is still developable end-to-end.
"""

import json
import logging

from flask import current_app

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """אתה סוכן AI חברותי של פלטפורמת RentMate — אתר חיפוש דירות ושותפים בישראל.
המשימה שלך: לראיין את המשתמש בשיחה טבעית בעברית ולאסוף את העדפותיו לחיפוש דירה.
כללים:
- אל תשאל יותר משאלה אחת או שתיים בהודעה.
- שמור על טון חם וידידותי, לא בירוקרטי.
- אם המשתמש נותן תשובה עמומה, בקש הבהרה פעם אחת בלבד.
- עצור אחרי שאספת את כל הפרטים הבאים:
  1. טווח תקציב חודשי (מינימום ומקסימום)
  2. אזורים גיאוגרפיים מועדפים (ערים/שכונות)
  3. תאריך כניסה רצוי
  4. סגנון חיים (שקט / חברתי, רמת ניקיון 1-5, עישון, חיות מחמד, אורחים, עבודה מהבית)
  5. עדיפות: מה הכי חשוב מבין: מחיר, מיקום, אורח חיים
- כשאספת את הכל: סיים בהודעה "אוקיי, יש לי מה שאני צריך! שמרתי את ההעדפות שלך ותתחיל לראות התאמות."
  והוסף שורה חדשה, ואז בלוק JSON יחיד בפורמט המדויק המצוין למטה ללא שום טקסט נוסף.
- אם משתמש חוזר לעדכן — התחל מההעדפות הקיימות ושאל רק מה רוצה לשנות.
פורמט ה-JSON בסיום:
```json
{
  "budget_min": 3000, "budget_max": 6000,
  "preferred_cities": ["תל אביב"], "preferred_neighborhoods": ["פלורנטין"],
  "move_in_date": "2026-05-01",
  "lifestyle": {
    "social_level": "social|balanced|quiet",
    "cleanliness": 4,
    "smoking": "no|outdoor|yes",
    "pets": true,
    "guests_frequency": "rare|sometimes|often",
    "wfh": false
  },
  "priority": "price|location|lifestyle"
}
```
"""


# Reference schema for downstream validation. Pure dict, no external lib needed.
EXTRACTED_PREFERENCES_SCHEMA = {
    "budget_min": int, "budget_max": int,
    "preferred_cities": list, "preferred_neighborhoods": list,
    "move_in_date": (str, type(None)),
    "lifestyle": dict, "priority": str,
}


class OpenAINotConfigured(RuntimeError):
    pass


def _client():
    key = current_app.config.get("OPENAI_API_KEY")
    if not key:
        return None
    from openai import OpenAI
    return OpenAI(api_key=key)


def continue_conversation(messages_so_far):
    """Given the transcript (list of {role, content}) return the assistant's next message.

    Returns (assistant_text, is_final, extracted_json_or_none).
    """
    client = _client()
    model = current_app.config.get("OPENAI_MODEL", "gpt-4o-mini")

    if client is None:
        return _dev_fallback(messages_so_far)

    full = [{"role": "system", "content": SYSTEM_PROMPT}] + messages_so_far
    try:
        resp = client.chat.completions.create(
            model=model, messages=full, temperature=0.6, max_tokens=400,
        )
        text = resp.choices[0].message.content.strip()
    except Exception as e:
        logger.exception("OpenAI call failed")
        return ("נתקלתי בבעיה זמנית בחיבור ל-AI, נסה שוב בעוד רגע.", False, None)

    extracted = _extract_final_json(text)
    if extracted is not None:
        # Strip the JSON block from the user-visible message
        visible = text.split("```")[0].strip()
        return (visible, True, extracted)
    return (text, False, None)


def _extract_final_json(text):
    """Pull out a ```json ...``` block if present and return as dict, or None."""
    if "```" not in text:
        return None
    try:
        block = text.split("```", 2)[1]
        # Remove the language hint (json\n)
        if block.lower().startswith("json"):
            block = block[4:]
        block = block.strip()
        data = json.loads(block)
        if isinstance(data, dict):
            return data
    except Exception:
        return None
    return None


# ---------------------------------------------------------------------------
# Dev fallback — makes the UI usable without an API key
# ---------------------------------------------------------------------------

FALLBACK_SCRIPT = [
    "היי! אני העוזר של RentMate 👋 בוא נבנה יחד את הפרופיל שלך. באיזו עיר בא לך לגור?",
    "סבבה. מה טווח התקציב החודשי שלך? (למשל 3500 עד 5500)",
    "מעולה. יש לך תאריך כניסה רצוי? (אפשר לכתוב 'גמיש')",
    "ולגבי סגנון חיים — אתה יותר חברותי או שקט? ומה לגבי עישון וחיות מחמד?",
    "אחרון: מה הכי חשוב לך — מחיר, מיקום או סגנון חיים?",
    "אוקיי, יש לי מה שאני צריך! שמרתי את ההעדפות שלך ותתחיל לראות התאמות.",
]


def _dev_fallback(messages_so_far):
    """Scripted 5-question interview when no API key is set."""
    user_turns = sum(1 for m in messages_so_far if m.get("role") == "user")
    if user_turns >= len(FALLBACK_SCRIPT) - 1:
        extracted = {
            "budget_min": 3000, "budget_max": 6000,
            "preferred_cities": ["תל אביב"], "preferred_neighborhoods": [],
            "move_in_date": None,
            "lifestyle": {
                "social_level": "balanced", "cleanliness": 3,
                "smoking": "no", "pets": False,
                "guests_frequency": "sometimes", "wfh": False,
            },
            "priority": "location",
        }
        return (FALLBACK_SCRIPT[-1], True, extracted)
    return (FALLBACK_SCRIPT[user_turns], False, None)


def kickoff_message():
    """Opener for a brand new AI conversation."""
    return FALLBACK_SCRIPT[0]
