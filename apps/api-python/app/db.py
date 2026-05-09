from supabase import create_client
from app.config import OPENROUTER_API_KEY
import os

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


async def insert_book(title: str, summary: str, embedding: list, json_content: dict):
    data = {
        "title": title,
        "summary": summary,
        "embedding": embedding,
        "json_content": json_content
    }

    response = supabase.table("books").insert(data).execute()

    return response.data[0]

async def find_similar(embedding: list, threshold: float = 0.88):
    response = supabase.rpc(
        "match_books",
        {
            "query_embedding": embedding,
            "match_threshold": threshold,
            "match_count": 3
        }
    ).execute()

    return response

async def insert_chunk(book_id, content, embedding):
    return supabase.table("book_chunks").insert({
        "book_id": book_id,
        "content": content,
        "embedding": embedding
    }).execute()

async def find_relevant_chunks(embedding: list, count: int = 5):
    response = supabase.rpc(
        "match_chunks",
        {
            "query_embedding": embedding,
            "match_count": count
        }
    ).execute()

    return response.data