let mediaRecorder;
let audioChunks = [];

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const transcriptDiv = document.getElementById('transcript');

startBtn.onclick = async () => {
    console.log("🎙️ Requesting microphone access...");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log("✅ Microphone access granted.");
    
    // We request data in smaller chunks (e.g., every 500ms) so we can see the logs fire
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            audioChunks.push(event.data);
            console.log(`🔊 Captured audio chunk: ${event.data.size} bytes. Total chunks: ${audioChunks.length}`);
        }
    };

    mediaRecorder.onstop = async () => {
        console.log("⏹️ Recording stopped. Packaging audio...");
        transcriptDiv.innerText = "Processing audio... watch the console!";
        
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        console.log(`📦 Final audio file size: ${audioBlob.size} bytes`);

        // ==========================================
        // 🛑 SENIOR TEST: LISTEN TO THE AUDIO 
        // ==========================================
        const audioUrl = URL.createObjectURL(audioBlob);
        const player = document.getElementById('audioPlayback');
        player.src = audioUrl;
        player.style.display = 'block'; // Show the player
        console.log("🎧 Play the audio in the browser. Can you hear yourself?");
        // ==========================================

        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');

        try {
            console.log("🚀 Sending POST request to http://localhost:3000/process-audio...");
            
            // SENIOR FIX: Explicitly hardcode the backend URL so we bypass Live Server issues
            const response = await fetch('http://localhost:3000/process-audio', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server Error (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            console.log("🎉 Success! Received transcript from backend:\n", data.transcript);
            transcriptDiv.innerText = data.transcript;
            
        } catch (error) {
            console.error("❌ Frontend Fetch Error:", error);
            transcriptDiv.innerText = "Error: " + error.message;
        }
    };

    // The '500' tells the recorder to fire the 'ondataavailable' event every 500 milliseconds
    mediaRecorder.start(500); 
    startBtn.disabled = true;
    stopBtn.disabled = false;
    transcriptDiv.innerText = "Recording... talk with a friend!";
    console.log("🔴 Recording started...");
};

stopBtn.onclick = () => {
    mediaRecorder.stop();
    startBtn.disabled = false;
    stopBtn.disabled = true;
};