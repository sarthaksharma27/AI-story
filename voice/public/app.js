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

function renderStory(book, transcript) {
    transcriptDiv.innerHTML = '';

    const transcriptHeader = document.createElement('h3');
    transcriptHeader.innerText = "Audio Transcript";
    transcriptHeader.style.color = "#888";
    transcriptHeader.style.fontSize = "0.9rem";
    
    const transcriptText = document.createElement('p');
    transcriptText.innerText = transcript;
    transcriptText.style.fontStyle = "italic";
    transcriptText.style.marginBottom = "2rem";
    transcriptText.style.color = "#555";

    const title = document.createElement('h1');
    title.innerText = book.title;
    title.style.fontSize = "2.5rem";
    title.style.marginBottom = "0.5rem";

    const summary = document.createElement('p');
    summary.innerHTML = `<strong>Summary:</strong> ${book.summary}`;
    summary.style.marginBottom = "3rem";
    summary.style.lineHeight = "1.6";

    transcriptDiv.append(transcriptHeader, transcriptText, title, summary);

    if (book.chapters && book.chapters.length > 0) {
        book.chapters.forEach((chapter, index) => {
            const chapterWrapper = document.createElement('section');
            chapterWrapper.style.marginBottom = "3rem";

            const chapTitle = document.createElement('h2');
            chapTitle.innerText = chapter.chapter_title || `Chapter ${index + 1}`;
            chapTitle.style.borderBottom = "1px solid #333";
            chapTitle.style.paddingBottom = "0.5rem";

            const chapContent = document.createElement('p');
            chapContent.innerText = chapter.content;
            chapContent.style.lineHeight = "1.8";
            chapContent.style.whiteSpace = "pre-wrap"; // Preserves paragraph breaks

            chapterWrapper.append(chapTitle, chapContent);
            transcriptDiv.appendChild(chapterWrapper);
        });
    }
}

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

            transcriptDiv.innerText = "Generating your 10-chapter story... this may take a moment.";
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
                
                if (data.book) {
                    renderStory(data.book, data.transcript);
                } else if (data.error) {
                    transcriptDiv.innerText = `System Error: ${data.error}`;
                }

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