<img width="1060" height="401" alt="image" src="https://github.com/user-attachments/assets/9ce415ab-6703-4a41-b3de-1b0d933b81f5" />


<p align="center">
  <strong>Turn conversations into stories instantly</strong>
</p>

<p align="center">
  <i>A speech-to-narrative pipeline that converts conversational input into structured story output.<i>
</p>



> **Note:** This is an early MVP built in 4 hours to validate the core architecture and workflow.  
> It is not production-ready, and several core features are still under active development.
> If you see areas for improvement or believe you can add value, feel free to open a PR.  
All contributions are reviewed thoughtfully.


## Setup & Environment

### 1. Environment Variables
Create a `.env` file in the root directory:
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
OPENROUTER_API_KEY=your_openrouter_key
```

You can generate a Openrouter API key here: [Openrouter](https://openrouter.ai)

Create a .env file in the voice/ directory:
```env
DEEPGRAM_API_KEY=your_key_here
```

You can generate a Deepgram API key here: [Deepgram](https://deepgram.com)

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
Feature Overview: Two users brainstorm a story and the system performs speaker diarization, speech-to-text transcription, and sends the result to the Python AI engine to generate the story.

**Steps to Run**
- Ensure the **FastAPI server** is running on **port 8000**
- Open **http://localhost:3000** in **Chrome**
- Select your **microphone device**
- Click **Start Recording**
- Have a conversation
- Click **Stop & Process**
- View:
  - ✅ **Speaker transcript**
  - ✅ **Generated story**

> [!TIP]
> Avoid talking over each other. Clear turn-taking improves speaker diarization, transcript accuracy, and overall story quality.

## 🔊 Narration (Coming Soon)

### CLI – Ingest / Generate a Story

Generates a story and indexes it into the **vector database** for retrieval.

#### Endpoint
`POST /generate`

#### Example Request

```bash
curl -X POST http://127.0.0.1:8000/generate \
  -H "Content-Type: application/json" \
  -d '{"idea":"A story about a dragon facing a philosophical dilemma"}'
```

#### What Happens

- The **AI engine** generates a story from the provided idea  
- The story is converted into **vector embeddings**  
- The embeddings are stored in the **vector database**  
- The story becomes available for **RAG-based querying**

---

### Ask a Question (RAG – Retrieval-Augmented Generation)

Queries the **vector database** for relevant context and generates a **grounded response**.

#### Endpoint
`POST /ask`

#### Example Request

```bash
curl -X POST http://127.0.0.1:8000/ask \
  -H "Content-Type: application/json" \
  -d '{"idea":"What is the name of the dragon?"}'
```

#### What Happens

- Relevant chunks are retrieved from the **vector database**  
- Retrieved context is injected into the **LLM prompt**  
- The model generates a **context-aware response**  
- Retrieval grounding helps reduce **hallucinations**

## How It Works

The system follows a **microservice architecture**, where each service has a single responsibility and communicates over HTTP.  
This separation allows independent scaling, easier debugging, and clean onboarding for new engineers.

---

### 1. High-Level Flow

<img width="1096" height="484" alt="image" src="https://github.com/user-attachments/assets/9b711715-e14d-4a7a-9c75-7bdec48d7e5e" />


- The **Frontend** captures voice input from the browser  
- Audio is sent to the **Audio Gateway (Node.js microservice)**  
- Transcription and diarization are handled via **Deepgram STT**
- Cleaned transcript is sent to the **AI Service (FastAPI microservice)**
- The AI service:
  - Generates the story
  - Creates vector embeddings
  - Stores embeddings in **Supabase (pgvector)**
- Generated story is returned to the frontend

Each component can be deployed, scaled, and maintained independently.

---

### 2. Voice Orchestration (Audio Pipeline)

The voice layer is intentionally isolated from AI logic for stability and fault tolerance.

- **Audio Capture**
  - Browser uses the **MediaRecorder API**
  - Provides real-time waveform visualization
  - Streams audio to backend gateway

- **Speaker Diarization**
  - Powered by **Deepgram nova-2**
  - Separates speakers using frequency and pitch modeling
  - Produces structured speaker-attributed transcript

This separation prevents AI processing failures from impacting audio capture reliability.

---

### 3. AI Story Generation Service

Handled by the **FastAPI microservice**.

Responsibilities:

- Accepts structured transcript or CLI input
- Sends prompt to LLM via **OpenRouter**
- Generates story in English or Spanish
- Validates and parses structured JSON output
- Returns final narrative to caller

This service contains no audio logic — only AI orchestration.

---

### 4. Semantic Retrieval & Grounded Q&A (RAG)

The system does not use keyword matching.

Instead, it performs **vector similarity search**:

- Story content is chunked and converted into embeddings
- Embeddings are stored in **Supabase (pgvector)**
- When a question is asked:
  - The question is embedded
  - A **Cosine Similarity search** retrieves the most relevant chunks
  - Retrieved context is injected into the LLM prompt

Capabilities:

- **Cross-Lingual Search**
  - Spanish query can retrieve English context

- **Semantic Matching**
  - Understands that “giant lizard” may refer to “dragon”

- **Grounded Responses**
  - Retrieved chunks are treated as the **source of truth**
  - If answer is not present in retrieved context:
    - The system returns **"I don't know"**

This reduces hallucination and ensures answers are derived strictly from generated content.

---

## Tech Stack

- **FastAPI** – AI orchestration and API layer  
- **Node.js** – Audio processing gateway  
- **Deepgram** – Speech-to-Text (Diarization) and Text-to-Speech  
- **Supabase (pgvector)** – Vector storage and similarity search  
- **OpenRouter** – LLM routing and orchestration  

---

## License
Distributed under the MIT License. See `LICENSE` for more information.
