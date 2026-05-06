from fastapi import FastAPI
from app.schemas import StoryRequest

app = FastAPI(title="AI Bilingual Book Engine")

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.post("/generate")
async def generate_book(payload: StoryRequest):
    return {
        "message": "Server is working",
        "input_received": payload.idea
    }