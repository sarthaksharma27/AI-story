require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static('public')); 

const upload = multer({ storage: multer.memoryStorage() });

app.post('/process-audio', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No audio file received" });
        
        const mimetype = req.file.mimetype || 'audio/webm';
        const deepgramUrl = `https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&diarize=true&mimetype=${encodeURIComponent(mimetype)}`;
        
        const response = await fetch(deepgramUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
                'Content-Type': mimetype 
            },
            body: req.file.buffer
        });

        if (!response.ok) throw new Error(`Deepgram API returned ${response.status}`);
        const result = await response.json();

        const alt = result.results?.channels?.[0]?.alternatives?.[0];
        if (!alt || !alt.words || alt.words.length === 0) {
            return res.json({ status: 'success', transcript: "", error: "No words detected in audio." });
        }

        let formattedTranscript = "";
        let currentSpeaker = -1;

        alt.words.forEach(word => {
            const speakerLabel = word.speaker !== undefined ? word.speaker : "Unknown";
            if (speakerLabel !== currentSpeaker) {
                formattedTranscript += `\nSpeaker ${speakerLabel}: `;
                currentSpeaker = speakerLabel;
            }
            formattedTranscript += `${word.punctuated_word} `;
        });

        const finalTranscript = formattedTranscript.trim();
        
        try {
            const fastApiUrl = 'http://127.0.0.1:8000/generate-from-voice'; 
            const aiResponse = await fetch(fastApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idea: finalTranscript })
            });

            if (!aiResponse.ok) throw new Error(`FastAPI returned ${aiResponse.status}`);
            const storyData = await aiResponse.json();
            
            res.json({ status: 'success', transcript: finalTranscript, book: storyData.book });

        } catch (fastApiError) {
            res.status(500).json({ 
                status: 'partial_success', 
                transcript: finalTranscript,
                error: "Audio processed, but failed to reach Python AI."
            });
        }

    } catch (err) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.listen(3000);