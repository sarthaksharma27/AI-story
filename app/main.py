from fastapi import FastAPI
from app.schemas import StoryRequest
from app.embeddings import generate_embedding
from app.db import find_similar
import json
from app.llm import generate_book_json
from app.db import insert_book

app = FastAPI(title="AI Bilingual Book Engine")

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.post("/generate")
async def generate_book(payload: StoryRequest):
    embedding = await generate_embedding(payload.idea)

    similar = await find_similar(embedding)

    if similar.data:
        return {
            "status": "duplicate_detected",
            "similar_books": similar.data
        }

    # First attempt
    raw_output = await generate_book_json(payload.idea)
    raw_output = clean_llm_output(raw_output)

    try:
        book_json = json.loads(raw_output)
    except json.JSONDecodeError:
        # Retry once
        raw_output_retry = await generate_book_json(payload.idea)
        raw_output_retry = clean_llm_output(raw_output_retry)

        try:
            book_json = json.loads(raw_output_retry)
        except json.JSONDecodeError:
            return {
                "status": "llm_output_invalid",
                "raw_output": raw_output_retry
            }

        inserted = await insert_book(
        title=book_json["title"],
        summary=book_json["summary"],
        embedding=embedding,
        json_content=book_json
    )

    return {
        "status": "book_created",
        "id": inserted["id"],
        "book": book_json
    }

def clean_llm_output(raw: str) -> str:
    raw = raw.strip()

    if raw.startswith("```"):
        raw = raw.split("```")[1]

    return raw