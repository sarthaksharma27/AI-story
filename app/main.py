from fastapi import FastAPI
from app.schemas import StoryRequest
from app.embeddings import generate_embedding
from app.llm import generate_book_json, generate_answer
from app.db import (
    find_similar,
    insert_book,
    insert_chunk,
    find_relevant_chunks
)
from app.chunking import chunk_text
import json

app = FastAPI(title="AI Bilingual Book Engine")


def clean_llm_output(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
    return raw


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

    raw_output = await generate_book_json(payload.idea)
    raw_output = clean_llm_output(raw_output)

    try:
        book_json = json.loads(raw_output)
    except json.JSONDecodeError:
        raw_output_retry = await generate_book_json(payload.idea)
        raw_output_retry = clean_llm_output(raw_output_retry)
        book_json = json.loads(raw_output_retry)

    inserted = await insert_book(
        title=book_json["title"],
        summary=book_json["summary"],
        embedding=embedding,
        json_content=book_json
    )

    full_text = ""

    for chapter in book_json["chapters"]:
        full_text += chapter["content"]["english"] + "\n"
        full_text += chapter["content"]["spanish"] + "\n"

    chunks = chunk_text(full_text)

    for chunk in chunks:
        chunk_embedding = await generate_embedding(chunk)
        await insert_chunk(inserted["id"], chunk, chunk_embedding)

    return {
        "status": "book_created",
        "id": inserted["id"],
        "book": book_json
    }


@app.post("/ask")
async def ask_question(payload: StoryRequest):
    question_embedding = await generate_embedding(payload.idea)

    chunks = await find_relevant_chunks(question_embedding)

    if not chunks:
        return {
            "answer": "No relevant context found",
            "context_used": []
        }

    context = "\n\n".join([c["content"] for c in chunks])

    answer = await generate_answer(payload.idea, context)

    return {
        "answer": answer,
        "context_used": chunks
    }