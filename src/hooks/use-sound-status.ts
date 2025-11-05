'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// --- Configuration ---
// The time in milliseconds the sound needs to be above threshold to be considered "started".
const START_DELAY = 500;
// The time in milliseconds the sound needs to be below threshold to be considered "stopped".
const STOP_DELAY = 1500;
// The sensitivity threshold in dB. More negative is more sensitive.
const SENSITIVITY_THRESHOLD = -55;


interface UseSoundStatusResult {
  isSoundDetected: boolean | undefined;
  error: string | null;
  start: () => void;
  stop: () => void;
}

export function useSoundStatus(): UseSoundStatusResult {
  const [isSoundDetected, setIsSoundDetected] = useState<boolean | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const startTimerRef = useRef<NodeJS.Timeout | null>(null);
  const stopTimerRef = useRef<NodeJS.Timeout | null>(null);

  const monitor = useCallback(() => {
    if (!analyserRef.current) {
        if(animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        return;
    };

    const dataArray = new Uint8Array(analyserRef.current.fftSize);
    analyserRef.current.getByteTimeDomainData(dataArray);

    let sumSquares = 0.0;
    for (const amplitude of dataArray) {
      const normalizedAmplitude = amplitude / 128.0 - 1.0; // Convert to -1.0 to 1.0
      sumSquares += normalizedAmplitude * normalizedAmplitude;
    }
    const rms = Math.sqrt(sumSquares / dataArray.length);
    const db = 20 * Math.log10(rms);

    const currentlySoundDetected = db > SENSITIVITY_THRESHOLD;

    if (currentlySoundDetected) {
        if (stopTimerRef.current) {
            clearTimeout(stopTimerRef.current);
            stopTimerRef.current = null;
        }
        if (!isSoundDetected && !startTimerRef.current) {
            startTimerRef.current = setTimeout(() => {
                setIsSoundDetected(true);
                startTimerRef.current = null;
            }, START_DELAY);
        }
    } else { // Silence is detected
        if (startTimerRef.current) {
            clearTimeout(startTimerRef.current);
            startTimerRef.current = null;
        }
        if (isSoundDetected && !stopTimerRef.current) {
            stopTimerRef.current = setTimeout(() => {
                setIsSoundDetected(false);
                stopTimerRef.current = null;
            }, STOP_DELAY);
        }
    }

    animationFrameRef.current = requestAnimationFrame(monitor);
  }, [isSoundDetected]);


  const stop = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (startTimerRef.current) clearTimeout(startTimerRef.current);
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    
    analyserRef.current = null;
    if(isSoundDetected !== undefined) setIsSoundDetected(undefined);
    if(error !== null) setError(null);
  }, [isSoundDetected, error]);


  const start = useCallback(async () => {
    if (audioContextRef.current) return; // Already started
    
    setError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser does not support microphone access.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      mediaStreamRef.current = stream;

      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = context;

      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;
      
      // Initial state before detection starts
      if (isSoundDetected === undefined) {
         setIsSoundDetected(false);
      }
      
      animationFrameRef.current = requestAnimationFrame(monitor);

    } catch (err) {
      console.error("Error accessing microphone:", err);
      if(err instanceof Error) {
        if(err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            setError("Microphone permission denied. Please allow access in your browser settings.");
        } else {
            setError(`Error accessing microphone: ${err.message}`);
        }
      } else {
        setError("An unknown error occurred while accessing the microphone.");
      }
      stop(); // Clean up on error
    }
  }, [monitor, stop, isSoundDetected]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { isSoundDetected, error, start, stop };
}
