"use client";

import { useState, useEffect, useRef } from 'react';
import { Mic, Square, Loader2, AudioLines } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ----------------------------------------------------------------------
// 1. Type Definitions
// ----------------------------------------------------------------------
interface Chapter {
    chapter_title?: string;
    content: string;
}

interface Book {
    title: string;
    summary: string;
    chapters?: Chapter[];
}

interface StoryData {
    book: Book | null;
    transcript: string | null;
}

declare global {
    interface Window {
        webkitAudioContext: typeof AudioContext;
    }
}

// ----------------------------------------------------------------------
// 2. Main Component
// ----------------------------------------------------------------------
export default function Home() {
    // UI State
    const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
    const [selectedMic, setSelectedMic] = useState<string>('');
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [statusText, setStatusText] = useState<string>('Ready to record');
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    
    // Data State
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [storyData, setStoryData] = useState<StoryData>({ book: null, transcript: null });
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Mutable References
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const visualizerAnimationIdRef = useRef<number | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        const getMicrophones = async () => {
            try {
                await navigator.mediaDevices.getUserMedia({ audio: true });
                const devices = await navigator.mediaDevices.enumerateDevices();
                const audioInputs = devices.filter(device => device.kind === 'audioinput');
                setMics(audioInputs);
                if (audioInputs.length > 0) {
                    setSelectedMic(audioInputs[0].deviceId);
                }
            } catch (err) {
                console.error("Microphone access denied", err);
                setErrorMsg('Microphone access denied. Please allow permissions.');
            }
        };
        getMicrophones();
        
        return () => {
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close();
            }
            if (visualizerAnimationIdRef.current !== null) {
                cancelAnimationFrame(visualizerAnimationIdRef.current);
            }
        };
    }, []);

    const drawVisualizer = () => {
        const canvas = canvasRef.current;
        if (!canvas || !analyserRef.current) return;

        const canvasCtx = canvas.getContext('2d');
        if (!canvasCtx) return;

        const width = canvas.width = canvas.offsetWidth;
        const height = canvas.height = canvas.offsetHeight;
        
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const draw = () => {
            visualizerAnimationIdRef.current = requestAnimationFrame(draw);
            analyserRef.current!.getByteTimeDomainData(dataArray);

            canvasCtx.fillStyle = '#1c1917'; 
            canvasCtx.fillRect(0, 0, width, height);
            
            canvasCtx.lineWidth = 2;
            canvasCtx.strokeStyle = '#a8a29e'; 
            canvasCtx.beginPath();

            const sliceWidth = (width * 1.0) / bufferLength;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = (v * height) / 2;

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
    };

    const startRecording = async () => {
        try {
            setErrorMsg(null);
            setStoryData({ book: null, transcript: null }); 
            setAudioUrl(null);

            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: { deviceId: selectedMic ? { exact: selectedMic } : undefined } 
            });
            streamRef.current = stream;
            
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            audioContextRef.current = new AudioContextClass();
            analyserRef.current = audioContextRef.current.createAnalyser();
            
            const source = audioContextRef.current.createMediaStreamSource(stream);
            source.connect(analyserRef.current);
            analyserRef.current.fftSize = 2048; 
            
            drawVisualizer(); 

            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = []; 

            mediaRecorder.ondataavailable = (event: BlobEvent) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = handleStopRecording;
            mediaRecorder.start(500); 
            
            setIsRecording(true);
            setStatusText("Recording... talk with a friend.");
            
        } catch (err: unknown) {
            console.error(err);
            setErrorMsg("Failed to start recording. Check mic permissions.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
        setIsProcessing(true);
    };

    const handleStopRecording = async () => {
        if (visualizerAnimationIdRef.current !== null) {
            cancelAnimationFrame(visualizerAnimationIdRef.current);
        }

        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#1c1917';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        }
        
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
        }
        
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }

        setStatusText("Synthesizing your story...");
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const generatedAudioUrl = URL.createObjectURL(audioBlob);
        setAudioUrl(generatedAudioUrl);

        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');

        try {
            const response = await fetch('http://localhost:3001/process-audio', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server Error (${response.status}): ${errorText}`);
            }

            const data: { book?: Book; transcript?: string; error?: string } = await response.json();
            
            if (data.book && data.transcript) {
                setStoryData({ book: data.book, transcript: data.transcript });
            } else if (data.error) {
                setErrorMsg(`System Error: ${data.error}`);
            }

        } catch (error: any) {
            setErrorMsg("Error: " + (error.message || "Unknown error occurred"));
        } finally {
            setIsProcessing(false);
            setStatusText("Ready to record");
        }
    };

    return (
        <main className="min-h-screen bg-stone-950 p-6 flex flex-col items-center justify-start font-sans">
            <div className="w-full max-w-3xl space-y-6 mt-12">
                
                <Card className="border-stone-800 bg-stone-900/50 backdrop-blur-sm shadow-xl">
                    <CardHeader>
                        <CardTitle className="text-2xl font-light tracking-tight text-stone-100 flex items-center gap-2">
                            <AudioLines className="w-6 h-6 text-stone-400" />
                            Audio to Story
                        </CardTitle>
                        <CardDescription className="text-stone-400">
                            Capture a conversation and transform it into a structured narrative.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        
                        <div className="space-y-2">
                            <Select 
                                value={selectedMic} 
                                onValueChange={setSelectedMic}
                                disabled={isRecording || isProcessing}
                            >
                                <SelectTrigger className="w-full bg-stone-950 border-stone-800 text-stone-300">
                                    <SelectValue placeholder="Select a microphone" />
                                </SelectTrigger>
                                <SelectContent className="bg-stone-900 border-stone-800 text-stone-300">
                                    {mics.length === 0 ? (
                                        <SelectItem value="none" disabled>Requesting permissions...</SelectItem>
                                    ) : (
                                        mics.map((mic, idx) => (
                                            <SelectItem key={mic.deviceId} value={mic.deviceId}>
                                                {mic.label || `Microphone ${idx + 1}`}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex gap-4">
                            <Button 
                                onClick={startRecording} 
                                disabled={isRecording || isProcessing}
                                className="flex-1 bg-stone-100 text-stone-900 hover:bg-stone-300 transition-colors"
                            >
                                <Mic className="w-4 h-4 mr-2" />
                                Start Recording
                            </Button>
                            <Button 
                                onClick={stopRecording} 
                                disabled={!isRecording}
                                variant="destructive"
                                className="flex-1 bg-red-900/80 text-red-100 hover:bg-red-900 border border-red-800"
                            >
                                <Square className="w-4 h-4 mr-2" />
                                Stop & Process
                            </Button>
                        </div>

                        <div className="relative rounded-lg overflow-hidden border border-stone-800 bg-stone-900">
                            <canvas 
                                ref={canvasRef} 
                                className="w-full h-24 block"
                            />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                {(isRecording || isProcessing) && (
                                    <span className="bg-stone-950/80 px-3 py-1.5 rounded-full text-xs font-medium text-stone-300 flex items-center gap-2 border border-stone-800 backdrop-blur-md">
                                        {isProcessing && <Loader2 className="w-3 h-3 animate-spin" />}
                                        {isRecording && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                                        {statusText}
                                    </span>
                                )}
                            </div>
                        </div>

                        {audioUrl && !isRecording && (
                            <div className="pt-2">
                                <audio src={audioUrl} controls className="w-full h-10 [&::-webkit-media-controls-panel]:bg-stone-800" />
                            </div>
                        )}
                    </CardContent>
                </Card>

                {errorMsg && (
                    <div className="p-4 rounded-lg bg-red-950/50 border border-red-900 text-red-200 text-sm">
                        {errorMsg}
                    </div>
                )}

                {storyData.book && (
                    <Card className="border-stone-800 bg-stone-900/30 shadow-xl">
                        <CardContent className="p-8">
                            <div className="space-y-8">
                                
                                <div className="space-y-2">
                                    <p className="text-xs font-mono uppercase tracking-wider text-stone-500">Source Transcript</p>
                                    <div className="p-4 rounded-md bg-stone-950 border border-stone-800 text-stone-400 font-mono text-sm leading-relaxed">
                                        {storyData.transcript}
                                    </div>
                                </div>

                                <div className="space-y-6 pt-6 border-t border-stone-800">
                                    <div>
                                        <h1 className="text-3xl font-semibold text-stone-100 tracking-tight mb-2">
                                            {storyData.book.title}
                                        </h1>
                                        <p className="text-stone-400 leading-relaxed text-lg">
                                            {storyData.book.summary}
                                        </p>
                                    </div>
                                    
                                    <div className="space-y-10 mt-10">
                                        {storyData.book.chapters?.map((chapter, index) => (
                                            <section key={index} className="space-y-4">
                                                <h2 className="text-xl font-medium text-stone-200 flex items-center gap-3">
                                                    <span className="text-sm font-mono text-stone-500">{(index + 1).toString().padStart(2, '0')}</span>
                                                    {chapter.chapter_title || `Chapter ${index + 1}`}
                                                </h2>
                                                <p className="text-stone-400 leading-loose whitespace-pre-wrap">
                                                    {chapter.content}
                                                </p>
                                            </section>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </main>
    );
}