import httpx
import os

from app.config import OPENROUTER_API_KEY

LLM_MODEL = "meta-llama/llama-3-8b-instruct"


SYSTEM_PROMPT = """
You are an AI that generates structured bilingual books.

Return STRICT JSON only.
No markdown.
No explanations.
No commentary.

Structure:

{
  "title": string,
  "summary": string,
  "chapters": [
    {
      "chapter_number": int,
      "title": string,
      "content": {
        "english": string,
        "spanish": string
      }
    }
  ]
}
"""


async def generate_book_json(idea: str, rag_context: str = ""):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:8000",
                "X-Title": "AI Book Engine"
            },
            json={
                "model": LLM_MODEL,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": f"""
Idea: {idea}

Ensure the story is meaningfully different from:
{rag_context}

Generate 3 chapters.
Return JSON only.
"""
                    }
                ],
                "temperature": 0.7
            }
        )

        response.raise_for_status()
        data = response.json()

        return data["choices"][0]["message"]["content"]