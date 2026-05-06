# AI-Book

A specialized Retrieval-Augmented Generation (RAG) pipeline that generates stories and provides a grounded Q&A interface.

## Setup & Environment

### 1. Environment Variables
Create a `.env` file in the root directory:
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
OPENROUTER_API_KEY=your_openrouter_key
```

### 2. Installation
```bash
python -m venv venv
source venv/Scripts/activate

pip install -r requirements.txt
```

### 3. Start the Server
```bash
uvicorn app.main:app --reload
```

## How to Test

### 1. Ingest/Generate a Story
Generates a story (English/Spanish) and indexes it into the vector database.

```bash
curl -X POST [http://127.0.0.1:8000/generate](http://127.0.0.1:8000/generate) \
-H "Content-Type: application/json" \
-d '{"idea":"A story about a dragon facing a philosophical dilemma"}'
```

### 2. Ask a Question (RAG)
Queries the database for context and generates a grounded answer.

```bash
curl -X POST [http://127.0.0.1:8000/ask](http://127.0.0.1:8000/ask) \
-H "Content-Type: application/json" \
-d '{"idea":"What is the name of the dragon?"}'
```

## How it Works

### 1. Ingestion
The system uses an LLM to generate a structured JSON story containing dual-language chapters. This text is then:

Chunked: Broken into smaller semantic pieces.

Embedded: Converted into 1536-dimensional vectors.

Stored: Saved in Supabase via pgvector for high-speed similarity search.

### 2. Semantic Retrieval
When a question is asked, we don't look for keywords. We perform a Cosine Similarity search between the question's vector and our stored chunks. This allows for:

Cross-Lingual Search: Asking in Spanish and finding English context.

Semantic Matching: Understanding that "Giant lizard" refers to "Dragon."

### 3. Grounded Q&A
The retrieved context is fed back into the LLM as the "Source of Truth."

Hallucination Protection: If the answer isn't in the context, the system is programmed to say "I don't know."

Accuracy: The response is derived only from the generated book content, not general AI training data.

## Tech Stack
FastAPI: High-performance backend API.

Supabase (PostgreSQL + pgvector): Vector database and relational storage.

OpenRouter: LLM orchestration.
