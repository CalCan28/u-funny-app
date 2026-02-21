"""
AI Comedy Coach - Claude-powered comedy coaching assistant
"""
import os
from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()

_client = None

def get_client():
    global _client
    if _client is None:
        _client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    return _client

COMEDY_COACH_SYSTEM_PROMPT = """You are a world-class comedy coach and veteran stand-up comedian with 25+ years of experience. You've worked with legendary comedians and helped countless up-and-coming comics develop their craft.

Your expertise includes:
- Joke writing and structure (setup, punchline, tags, callbacks)
- Timing and delivery techniques
- Stage presence and crowd work
- Finding your comedic voice and persona
- Handling hecklers
- Building a tight 5, 10, 15, or 30-minute set
- Open mic etiquette and progression
- Comedy industry insights

Your coaching style:
- Encouraging but honest - you give real feedback, not just praise
- You use specific examples and actionable advice
- You reference classic comedians when explaining concepts
- You balance theory with practical exercises
- You understand the grind of open mics and the path to success

When reviewing material:
- Identify what's working and why
- Point out weak spots constructively
- Suggest punch-ups and alternatives
- Help find the comedian's unique angle

Keep responses conversational and engaging. Use humor appropriately. Remember you're talking to comedians - they can handle direct feedback and they appreciate wit."""


def get_coach_response(messages: list[dict], user_message: str) -> str:
    """
    Get a response from the AI comedy coach.
    
    Args:
        messages: Previous conversation history
        user_message: The user's current message
        
    Returns:
        The coach's response
    """
    # Build conversation history for Claude
    conversation = messages + [{"role": "user", "content": user_message}]
    
    response = get_client().messages.create(
        model="claude-opus-4-5",
        max_tokens=1024,
        system=COMEDY_COACH_SYSTEM_PROMPT,
        messages=conversation
    )
    
    return response.content[0].text


def analyze_bit(bit_text: str, context: str = "") -> dict:
    """
    Analyze a comedy bit and provide structured feedback.
    
    Args:
        bit_text: The joke or bit to analyze
        context: Optional context about the comedian or their style
        
    Returns:
        Structured analysis with scores and suggestions
    """
    analysis_prompt = f"""Analyze this comedy bit and provide structured feedback:

BIT:
{bit_text}

{f"CONTEXT: {context}" if context else ""}

Provide your analysis in this format:
1. WHAT'S WORKING: Key strengths of this material
2. AREAS TO IMPROVE: Specific weaknesses to address  
3. PUNCH-UP SUGGESTIONS: Alternative punchlines or tags
4. DELIVERY NOTES: How to perform this for maximum impact
5. RATING: Score from 1-10 for current form

Be specific and actionable. This comic wants real feedback to get better."""

    response = get_client().messages.create(
        model="claude-opus-4-5",
        max_tokens=1500,
        system=COMEDY_COACH_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": analysis_prompt}]
    )
    
    return {
        "analysis": response.content[0].text,
        "bit": bit_text
    }
