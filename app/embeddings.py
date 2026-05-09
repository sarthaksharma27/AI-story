import httpx
import os
from app.config import OPENROUTER_API_KEY

EMBEDDING_MODEL = "openai/text-embedding-3-small"

async def generate_embedding(text: str) -> list:
    if not text or not text.strip():
        print("Warning: Attempted to generate embedding for empty text.")
        return [0.0] * 1536

    async with httpx.AsyncClient() as client:
        try:
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
                    "input": text.replace("\n", " ")
                },
                timeout=20.0 
            )

            if response.status_code != 200:
                print(f"Embedding API Error ({response.status_code}): {response.text}")
                response.raise_for_status()

            data = response.json()

            if "data" in data and len(data["data"]) > 0:
                return data["data"][0]["embedding"]
            else:
                print(f"Unexpected Embedding Response Shape: {data}")
                raise KeyError("Key 'data' missing from embedding response")

        except httpx.ReadTimeout:
            print("Embedding request timed out.")
            raise
        except Exception as e:
            print(f"CRITICAL error in generate_embedding: {e}")
            raise