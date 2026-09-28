/**
 * Groq Cloud Whisper Audio Transcription Client
 * Fast, accurate speech-to-text powered by Groq LPU inference.
 * Reference: https://console.groq.com/docs/api-reference#audio-transcription
 */

export interface TranscribeAudioOptions {
  audioBlob: Blob;
  language?: string; // 'id' | 'en' | 'auto'
  prompt?: string;
  model?: "whisper-large-v3-turbo" | "whisper-large-v3" | string;
  apiKey?: string;
}

export interface TranscribeAudioResult {
  text: string;
}

const GROQ_DEFAULT_API_KEY = "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";

export function getGroqApiKey(): string {
  const envKey =
    (import.meta as any).env?.VITE_GROQ_API_KEY ||
    (import.meta as any).env?.GROQ_API_KEY;

  if (envKey && typeof envKey === "string" && envKey.trim().length > 0) {
    return envKey.trim();
  }

  return GROQ_DEFAULT_API_KEY;
}

/**
 * Transcribes an audio blob using Groq Cloud Whisper API.
 * Average inference latency: ~150ms - 250ms on Groq LPU.
 */
export async function transcribeAudioWithGroq({
  audioBlob,
  language = "id",
  prompt,
  model = "whisper-large-v3-turbo",
  apiKey,
}: TranscribeAudioOptions): Promise<TranscribeAudioResult> {
  const token = apiKey || getGroqApiKey();
  if (!token) {
    throw new Error("Groq API Key tidak ditemukan. Pastikan VITE_GROQ_API_KEY sudah terpasang.");
  }

  // Determine appropriate filename & extension based on MIME type
  let filename = "recording.webm";
  const mimeType = audioBlob.type || "audio/webm";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) {
    filename = "recording.m4a";
  } else if (mimeType.includes("wav")) {
    filename = "recording.wav";
  } else if (mimeType.includes("ogg")) {
    filename = "recording.ogg";
  } else if (mimeType.includes("mp3")) {
    filename = "recording.mp3";
  }

  const audioFile = new File([audioBlob], filename, { type: mimeType });

  const formData = new FormData();
  formData.append("file", audioFile);
  formData.append("model", model);
  formData.append("response_format", "json");
  formData.append("temperature", "0");

  if (language && language !== "auto") {
    // Whisper expects ISO 639-1 format (e.g. 'id' or 'en')
    const langCode = language.startsWith("en") ? "en" : "id";
    formData.append("language", langCode);
  }

  if (prompt) {
    formData.append("prompt", prompt);
  }

  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    let errorDetails = "";
    try {
      const errJson = await response.json();
      errorDetails = errJson?.error?.message || JSON.stringify(errJson);
    } catch {
      errorDetails = await response.text();
    }
    throw new Error(errorDetails || `Groq Whisper API error (HTTP ${response.status})`);
  }

  const data = await response.json();
  return {
    text: (data.text || "").trim(),
  };
}
