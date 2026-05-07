require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.static('public')); 

app.use((req, res, next) => {
    console.log(`\n[${new Date().toLocaleTimeString()}] 🚀 Incoming ${req.method} request to ${req.url}`);
    next();
});

const upload = multer({ storage: multer.memoryStorage() });

app.post('/process-audio', upload.single('audio'), async (req, res) => {
    try {
        console.log("Step 1: Route hit. Did multer find the file?", req.file ? "YES" : "NO");
        if (!req.file) {
            return res.status(400).json({ error: "No audio file received" });
        }

        console.log(`Step 2: File size is ${req.file.size} bytes. Hitting Deepgram API directly...`);
        
        // SENIOR MOVE: Explicitly pass the mimetype in the URL to help Deepgram decode the .webm file
        const mimetype = req.file.mimetype || 'audio/webm';
        const deepgramUrl = `https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&diarize=true&mimetype=${encodeURIComponent(mimetype)}`;
        
        const response = await fetch(deepgramUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
                'Content-Type': mimetype // Ensure headers match the URL
            },
            body: req.file.buffer
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Deepgram API returned ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        console.log("Step 3: Deepgram success. Analyzing raw response...");

        // ==========================================
        // 🛑 SENIOR DEBUGGING: DUMP THE RAW JSON
        // ==========================================
        const alt = result.results?.channels?.[0]?.alternatives?.[0];
        
        if (!alt) {
            console.log("\n❌ CRITICAL: Deepgram returned a weird JSON shape:");
            console.log(JSON.stringify(result, null, 2));
            return res.json({ error: "Bad JSON from Deepgram" });
        }

        console.log("\n================ RAW DEEPGRAM DATA ================");
        console.log("Raw Transcript String:", alt.transcript);
        console.log("Did it detect words?", alt.words ? `Yes, ${alt.words.length} words` : "No words array found.");
        console.log("=====================================================\n");

        if (!alt.words || alt.words.length === 0) {
            console.log("🚨 WARNING: Deepgram processed the file but heard NO WORDS. Your microphone might be recording silence.");
            return res.json({ status: 'success', transcript: "" });
        }

        // If we DO have words, let's do our formatting
        let formattedTranscript = "";
        let currentSpeaker = -1;

        alt.words.forEach(word => {
            // Provide a fallback if diarize didn't assign a speaker
            const speakerLabel = word.speaker !== undefined ? word.speaker : "Unknown";
            
            if (speakerLabel !== currentSpeaker) {
                formattedTranscript += `\nSpeaker ${speakerLabel}: `;
                currentSpeaker = speakerLabel;
            }
            formattedTranscript += `${word.punctuated_word} `;
        });

        console.log("Step 4: Transcript formatted! Sending back to frontend.");
        res.json({ status: 'success', transcript: formattedTranscript.trim() });

    } catch (err) {
        console.error("❌ BACKEND ERROR:", err.message || err);
        res.status(500).json({ error: err.message || "Internal Server Error" });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`\n✅ Voice Bridge backend running at http://localhost:${PORT}`);
});