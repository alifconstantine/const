import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "@const/ui";
import { transcribeAudio } from "./whisper";

export interface UseVoiceRecognitionOptions {
  language?: string; // 'id' | 'en' | 'auto'
  onTranscript?: (transcript: string) => void;
  onError?: (error: string) => void;
  prompt?: string;
}

export function useVoiceRecognition({
  language = "id",
  onTranscript,
  onError,
  prompt,
}: UseVoiceRecognitionOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isListeningRef = useRef(false);
  const textBeforeRef = useRef("");
  const startTimeRef = useRef<number>(0);

  isListeningRef.current = isListening;

  const cleanupMedia = useCallback(() => {
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
      } catch {}
      mediaRecorderRef.current = null;
    }

    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      } catch {}
      mediaStreamRef.current = null;
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!isListeningRef.current && !mediaRecorderRef.current) return;

    isListeningRef.current = false;
    setIsListening(false);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.warn("[MediaRecorder stop err]", err);
      }
    }
  }, []);

  const startListening = useCallback(
    async (currentText = "") => {
      // 1. Check browser mediaDevices support
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        toast.error("Browser tidak mendukung perekaman audio (MediaDevices).");
        return;
      }

      textBeforeRef.current = currentText.trim();
      audioChunksRef.current = [];

      try {
        // Request mic access
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        mediaStreamRef.current = stream;

        // Choose best supported MIME type
        let selectedMimeType = "";
        const candidateTypes = [
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/mp4",
          "audio/aac",
          "audio/ogg;codecs=opus",
          "audio/wav",
        ];
        if (typeof MediaRecorder !== "undefined") {
          for (const type of candidateTypes) {
            if (MediaRecorder.isTypeSupported(type)) {
              selectedMimeType = type;
              break;
            }
          }
        }

        const options = selectedMimeType ? { mimeType: selectedMimeType } : undefined;
        const recorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event: BlobEvent) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        recorder.onstop = async () => {
          // Immediately stop mic hardware indicator
          if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((track) => track.stop());
            mediaStreamRef.current = null;
          }

          const durationMs = Date.now() - startTimeRef.current;
          const chunks = audioChunksRef.current;

          // If recorded audio is too short (e.g. accidental tap under 350ms) or empty, ignore
          if (durationMs < 350 || chunks.length === 0) {
            setIsListening(false);
            return;
          }

          const mime = selectedMimeType || "audio/webm";
          const audioBlob = new Blob(chunks, { type: mime });

          if (audioBlob.size < 200) {
            setIsListening(false);
            return;
          }

          // Transcribe via Const Router Whisper API
          setIsTranscribing(true);
          try {
            const { text } = await transcribeAudio({
              audioBlob,
              language,
              prompt,
            });

            if (text) {
              const fullResult = textBeforeRef.current
                ? `${textBeforeRef.current} ${text}`
                : text;
              onTranscript?.(fullResult);
            }
          } catch (err: any) {
            console.error("[Voice Transcription Error]", err);
            const msg = err?.message || "Gagal mentranskripsi audio";
            toast.error(`Suara: ${msg}`);
            onError?.(msg);
          } finally {
            setIsTranscribing(false);
            setIsListening(false);
          }
        };

        // Start recording
        startTimeRef.current = Date.now();
        recorder.start(250); // Slice into 250ms chunks
        isListeningRef.current = true;
        setIsListening(true);
      } catch (err: any) {
        console.warn("[Mic Permission Denied / Error]", err);
        setIsListening(false);
        isListeningRef.current = false;
        cleanupMedia();

        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          toast.error(
            language === "en"
              ? "Microphone access was denied. Please allow microphone permission."
              : "Akses mikrofon ditolak. Izinkan akses mikrofon di pengaturan sistem."
          );
          onError?.("mic-denied");
        } else {
          toast.error(
            language === "en"
              ? `Microphone error: ${err.message || "Unknown"}`
              : `Gagal mengakses mikrofon: ${err.message || "Unknown"}`
          );
          onError?.(err.message || "mic-error");
        }
      }
    },
    [language, prompt, onTranscript, onError, cleanupMedia]
  );

  const toggleListening = useCallback(
    (currentText = "") => {
      if (isListeningRef.current) {
        stopListening();
      } else {
        startListening(currentText);
      }
    },
    [startListening, stopListening]
  );

  useEffect(() => {
    return () => {
      cleanupMedia();
    };
  }, [cleanupMedia]);

  return {
    isListening,
    isTranscribing,
    startListening,
    stopListening,
    toggleListening,
  };
}
