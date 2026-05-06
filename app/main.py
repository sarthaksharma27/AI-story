from fastapi import FastAPI
from app.schemas import StoryRequest
from app.embeddings import generate_embedding
from app.db import find_similar

app = FastAPI(title="AI Bilingual Book Engine")

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.post("/generate")
async def generate_book(payload: StoryRequest):
    embedding = await generate_embedding(payload.idea)

    similar = await find_similar(embedding)

    return {
        "embedding_dimension": len(embedding),
        "similar_books": similar.data if similar else []
    }