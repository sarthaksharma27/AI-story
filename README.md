# AI-Book

A speech-to-narrative pipeline that converts conversational input into structured story output.

## Setup & Environment

### 1. Environment Variables
Create a `.env` file in the root directory:
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
OPENROUTER_API_KEY=your_openrouter_key
```

Create a .env file in the voice/ directory:
```env
DEEPGRAM_API_KEY=your_key_here
```

### 2. Installation
```bash
# Setup Python Backend
python -m venv venv
source venv/Scripts/activate # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Setup Node.js Voice Bridge
cd voice
npm install
```

### 3. Start the Services
You must run both servers simultaneously to use the voice features:

Terminal 1 (FastAPI):
```bash
uvicorn app.main:app --reload
```

Terminal 2 (Node.js):
```bash
cd voice
node server.js
```

## How to Test

### 1. Voice - Collaborative Storytelling
The Voice feature allows two users to brainstorm a story via microphone. The system diarizes speakers, transcribes the conversation, and triggers the Python AI to build the book.

Ensure the FastAPI server is running on port 8000.

Open http://localhost:3000 in Chrome.

Select Mic: Choose your physical hardware from the dropdown.

Record: Click "Start Recording" and have a conversation.

Process: Click "Stop & Process." The UI will display the transcript and the generated story.

Narration(comming soon): Click "Play Audio Book" to hear the professional AI voice narrate your story.

### CLI - Ingest/Generate a Story
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

### 1. Voice Orchestration
The voice pipeline separates hardware I/O from AI logic to ensure stability:

Audio Capture: Browser MediaRecorder API captures audio with real-time waveform visualization.

Speaker Diarization: Deepgram’s nova-2 distinguishes speakers based on frequency and pitch.

AI Narration: Deepgram’s aura-asteria-en (TTS) generates professional storytelling audio once the book is ready.

### 2. Resilient Ingestion
To handle the inherent unpredictability of LLM-generated JSON, the pipeline implements:

Self-Healing JSON: Uses dirtyjson to parse and repair common formatting errors (like trailing commas).

Defensive Parsing: Python backend uses .get() patterns to prevent KeyError crashes.

### 3. Semantic Retrieval & Grounded Q&A
When a question is asked, we don't look for keywords. We perform a Cosine Similarity search between the question's vector and our stored chunks. This allows for:

Cross-Lingual Search: Asking in Spanish and finding English context.

Semantic Matching: Understanding that "Giant lizard" refers to "Dragon."

The retrieved context is fed back into the LLM as the "Source of Truth."

Hallucination Protection: If the answer isn't in the context, the system is programmed to say "I don't know."

Accuracy: The response is derived only from the generated book content, not general AI training data.

## Tech Stack
FastAPI: High-performance Python backend.

Node.js: Audio processing gateway.

Deepgram: Speech-to-Text (Diarization) and Text-to-Speech (Aura).

Supabase: Vector database (pgvector).

OpenRouter: LLM orchestration.
