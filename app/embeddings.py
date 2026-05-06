import httpx
import os

from app.config import OPENROUTER_API_KEY
print("API KEY:", OPENROUTER_API_KEY)

EMBEDDING_MODEL = "openai/text-embedding-3-small"

async def generate_embedding(text: str) -> list:
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/embeddings",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:8000",
                "X-Title": "AI Book Engine"
            },
            json={
                "model": EMBEDDING_MODEL,
                "input": text
            }
        )

        if response.status_code != 200:
            print(response.text)

        response.raise_for_status()

        data = response.json()
        return data["data"][0]["embedding"]