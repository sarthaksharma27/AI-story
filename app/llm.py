import httpx
import os

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
LLM_MODEL = "openai/gpt-3.5-turbo"

async def generate_book_json(idea: str):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": LLM_MODEL,
                "messages": [
                    {
                        "role": "system",
                        "content": """Return ONLY valid JSON. You must strictly follow this exact schema:
{
  "title": "String",
  "summary": "String",
  "chapters": [
    {
      "content": {
        "english": "String",
        "spanish": "String"
      }
    }
  ]
}
Create a bilingual book based on the user's idea."""
                    },
                    {
                        "role": "user",
                        "content": idea
                    }
                ]
            }
        )

        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]

async def generate_answer(question: str, context: str):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": LLM_MODEL,
                "messages": [
                    {
                        "role": "system",
                        "content": "Answer ONLY using the provided context. If answer is not in context, say you don't know."
                    },
                    {
                        "role": "user",
                        "content": f"Context:\n{context}\n\nQuestion:\n{question}"
                    }
                ]
            }
        )

        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]