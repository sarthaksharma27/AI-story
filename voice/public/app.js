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

async function getMicrophones() {
    try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        
        micSelect.innerHTML = ''; 
        
        audioInputs.forEach(mic => {
            const option = document.createElement('option');
            option.value = mic.deviceId;
            option.text = mic.label || `Microphone ${micSelect.length + 1}`;
            micSelect.appendChild(option);
        });
    } catch (err) {
        micSelect.innerHTML = '<option value="">Microphone access denied</option>';
    }
}
getMicrophones();

function drawVisualizer() {
    const width = canvas.width = canvas.offsetWidth;
    const height = canvas.height = canvas.offsetHeight;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
        visualizerAnimationId = requestAnimationFrame(draw);
        analyser.getByteTimeDomainData(dataArray);

        canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        canvasCtx.fillRect(0, 0, width, height);
        
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = '#00f2fe'; 
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

startBtn.onclick = async () => {
    try {
        const selectedMicId = micSelect.value;
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { deviceId: selectedMicId ? { exact: selectedMicId } : undefined } 
        });
        
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 2048; 
        drawVisualizer(); 

        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            cancelAnimationFrame(visualizerAnimationId);
            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            if (audioContext.state !== 'closed') audioContext.close();

            transcriptDiv.innerText = "Processing audio with Deepgram and FastAPI... please wait.";
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            
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
                
                let finalText = `TRANSCRIPT:\n${data.transcript}\n\n`;
                
                if (data.book) {
                    finalText += `====================================\n`;
                    finalText += `${data.book.title.toUpperCase()}\n`;
                    finalText += `====================================\n`;
                    finalText += `Summary: ${data.book.summary}\n\n`;

                    if (data.book.chapters && data.book.chapters.length > 0) {
                        data.book.chapters.forEach((chapter, index) => {
                            finalText += `CHAPTER ${index + 1}\n`;
                            finalText += `------------------------------------\n`;
                            
                            const content = chapter.content || {};
                            const english = content.english || "Text missing...";
                            const spanish = content.spanish || "Texto faltante...";
                            
                            finalText += `${english}\n\n`;
                            finalText += `${spanish}\n`;
                            finalText += `------------------------------------\n\n`;
                        });
                    }
                    finalText += `Story complete and saved to Vector DB.`;
                } else if (data.error) {
                    finalText += `System Error: ${data.error}`;
                }

                transcriptDiv.innerText = finalText;

            } catch (error) {
                transcriptDiv.innerText = "Error: " + error.message;
            }
            
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start(500); 
        startBtn.disabled = true;
        stopBtn.disabled = false;
        transcriptDiv.innerText = "Recording... talk with a friend!";
        
    } catch (err) {
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