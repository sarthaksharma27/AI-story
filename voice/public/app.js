let mediaRecorder;
let audioChunks = [];
let audioContext;
let analyser;
let visualizerAnimationId;

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const transcriptDiv = document.getElementById('transcript');
const micSelect = document.getElementById('micSelect');
const canvas = document.getElementById('visualizer');
const canvasCtx = canvas.getContext('2d');

// 1. Populate Microphone Dropdown on Load
async function getMicrophones() {
    try {
        // We must ask for initial permission to see the real names of the devices
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        
        micSelect.innerHTML = ''; // Clear loading text
        
        audioInputs.forEach(mic => {
            const option = document.createElement('option');
            option.value = mic.deviceId;
            option.text = mic.label || `Microphone ${micSelect.length + 1}`;
            micSelect.appendChild(option);
        });
    } catch (err) {
        micSelect.innerHTML = '<option value="">Microphone access denied</option>';
        console.error("Mic access error:", err);
    }
}
// Run immediately on page load
getMicrophones();

// 2. The Visualizer Drawing Function
function drawVisualizer() {
    // Canvas setup
    const width = canvas.width = canvas.offsetWidth;
    const height = canvas.height = canvas.offsetHeight;
    
    // Get audio data
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
        visualizerAnimationId = requestAnimationFrame(draw);
        analyser.getByteTimeDomainData(dataArray);

        // Clear previous frame
        canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        canvasCtx.fillRect(0, 0, width, height);
        
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = '#00f2fe'; // Neon blue wave
        canvasCtx.beginPath();

        const sliceWidth = width * 1.0 / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * height / 2;

            if (i === 0) {
                canvasCtx.moveTo(x, y);
            } else {
                canvasCtx.lineTo(x, y);
            }
            x += sliceWidth;
        }

        canvasCtx.lineTo(canvas.width, canvas.height / 2);
        canvasCtx.stroke();
    };
    draw();
}

// 3. The Core Recording Logic
startBtn.onclick = async () => {
    try {
        const selectedMicId = micSelect.value;
        // Request the EXACT microphone the user chose from the dropdown
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { deviceId: selectedMicId ? { exact: selectedMicId } : undefined } 
        });
        
        // Setup Web Audio API for the visualizer
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 2048; // Resolution of the wave
        drawVisualizer(); // Start drawing

        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            // Stop the visualizer wave
            cancelAnimationFrame(visualizerAnimationId);
            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            if (audioContext.state !== 'closed') audioContext.close();

            transcriptDiv.innerText = "Processing audio... watch the console!";
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            
            // Setup local playback
            const audioUrl = URL.createObjectURL(audioBlob);
            const player = document.getElementById('audioPlayback');
            player.src = audioUrl;
            player.style.display = 'block';

            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.webm');

            try {
                const response = await fetch('http://localhost:3000/process-audio', {
                    method: 'POST',
                    body: formData
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Server Error (${response.status}): ${errorText}`);
                }

                const data = await response.json();
                transcriptDiv.innerText = data.transcript;
            } catch (error) {
                console.error("Frontend Fetch Error:", error);
                transcriptDiv.innerText = "Error: " + error.message;
            }
            
            // Stop all microphone tracks to release the hardware
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start(500); 
        startBtn.disabled = true;
        stopBtn.disabled = false;
        transcriptDiv.innerText = "Recording... talk with a friend!";
        
    } catch (err) {
        console.error("Failed to start recording:", err);
        alert("Failed to start recording. Check mic permissions.");
    }
};

stopBtn.onclick = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
    }
    startBtn.disabled = false;
    stopBtn.disabled = true;
};