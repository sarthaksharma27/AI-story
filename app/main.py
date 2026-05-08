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
import dirtyjson  # Use this for resilient JSON parsing

app = FastAPI(title="AI Bilingual Book Engine")


def clean_llm_output(raw: str) -> str:
    """
    Refined cleaning logic to strip markdown and handle raw text chatter.
    """
    raw = raw.strip()
    # Handle markdown code blocks specifically
    if "```json" in raw:
        raw = raw.split("```json")[1].split("```")[0]
    elif "```" in raw:
        raw = raw.split("```")[1].split("```")[0]
    
    return raw.strip()


async def safe_parse_json(raw_output: str, prompt: str):
    """
    Senior Engineer Pattern: A dedicated helper to handle retries and 
    malformed JSON strings before they crash the main logic.
    """
    cleaned = clean_llm_output(raw_output)
    try:
        # dirtyjson is much more forgiving than standard json.loads
        return dirtyjson.loads(cleaned)
    except Exception as e:
        print(f"⚠️ Primary JSON parse failed: {e}. Retrying LLM...")
        
        # Retry logic
        raw_retry = await generate_book_json(prompt)
        cleaned_retry = clean_llm_output(raw_retry)
        try:
            return dirtyjson.loads(cleaned_retry)
        except Exception as e_final:
            print(f"❌ Critical: LLM failed twice to produce valid JSON: {e_final}")
            # Return a minimal valid structure to prevent backend crash
            return {
                "title": "Generation Error",
                "summary": "The AI failed to format the response correctly.",
                "chapters": []
            }


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
    book_json = await safe_parse_json(raw_output, payload.idea)

    inserted = await insert_book(
        title=book_json.get("title", "Untitled"),
        summary=book_json.get("summary", ""),
        embedding=embedding,
        json_content=book_json
    )

    full_text = ""
    for chapter in book_json.get("chapters", []):
        # chapter["content"] is now a string, not a dict
        content = chapter.get("content", "")
        full_text += content + "\n"

    if full_text.strip():
        chunks = chunk_text(full_text)
        for chunk in chunks:
            chunk_embedding = await generate_embedding(chunk)
            await insert_chunk(inserted["id"], chunk, chunk_embedding)

    return {
        "status": "book_created",
        "id": inserted["id"],
        "book": book_json
    }

@app.post("/generate-from-voice")
async def generate_from_voice(payload: StoryRequest):
    print(f"🎙️ Received voice transcript: {payload.idea}")
    
    enhanced_prompt = (
        "You are an AI story generator. Extract the core ideas from the transcript "
        "below and write a 10-chapter English book. "
        "CRITICAL: You MUST strictly follow the JSON schema provided.\n\n"
        f"TRANSCRIPT:\n{payload.idea}"
    )

    raw_output = await generate_book_json(enhanced_prompt)
    book_json = await safe_parse_json(raw_output, enhanced_prompt)
    embedding = await generate_embedding(payload.idea)

    inserted = await insert_book(
        title=book_json.get("title", "Untitled Story"),
        summary=book_json.get("summary", "No summary generated."),
        embedding=embedding,
        json_content=book_json
    )

    full_text = ""
    chapters = book_json.get("chapters", [])
    for chapter in chapters:
        content = chapter.get("content", "")
        if content:
            full_text += content + "\n"

    if full_text.strip():
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
        return {"answer": "No relevant context found", "context_used": []}

    context = "\n\n".join([c["content"] for c in chunks])
    answer = await generate_answer(payload.idea, context)

    return {"answer": answer, "context_used": chunks}