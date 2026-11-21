/**
 * Realtime PCM -> WAV encoder and chunked live Whisper dictation controller
 * for Const Harness Desktop (routes to active STT provider / Const Router Whisper).
 */

export function encodePcmToWavBase64(samples: Float32Array, sampleRate = 16000): string {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // ByteRate = sampleRate * 1 * 2
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample
  writeStr(36, "data");
  view.setUint32(40, numSamples * 2, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function concatFloat32Chunks(chunks: Float32Array[]): Float32Array {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Float32Array(total);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

export interface VoiceDictationOptions {
  transcribe: (audioBase64: string, mimeType: string) => Promise<{ success: boolean; text?: string; error?: string }>;
  onLevels: (levels: number[]) => void;
  onInterim: (text: string) => void;
  onCommit: (text: string) => void;
  onError: (message: string) => void;
  onTranscribingChange?: (busy: boolean) => void;
}

export interface VoiceDictationController {
  stop: () => Promise<void>;
}

const NUM_BARS = 10;
const INTERIM_INTERVAL_MS = 1400;
const SILENCE_COMMIT_MS = 750;
const MAX_UTTERANCE_MS = 12000;
const SPEECH_RMS_THRESHOLD = 0.011;

export async function startRealtimeVoiceDictation(
  opts: VoiceDictationOptions,
): Promise<VoiceDictationController> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone access is not available in this environment.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioCtx({ sampleRate: 16000 });
  if (audioCtx.state === "suspended") {
    await audioCtx.resume().catch(() => {});
  }
  const actualSampleRate = audioCtx.sampleRate || 16000;

  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 64;
  analyser.smoothingTimeConstant = 0.55;

  const processor = audioCtx.createScriptProcessor(4096, 1, 1);
  const silentGain = audioCtx.createGain();
  silentGain.gain.value = 0;

  source.connect(analyser);
  source.connect(processor);
  processor.connect(silentGain);
  silentGain.connect(audioCtx.destination);

  // Rolling waveform bars for smooth real-time animation matching the voice pill UI
  const bars = new Array<number>(NUM_BARS).fill(0);
  const freqData = new Uint8Array(analyser.frequencyBinCount);
  let stopped = false;
  let rafId = 0;
  let lastLevelEmit = 0;

  const updateWaveform = (ts: number) => {
    if (stopped) return;
    if (ts - lastLevelEmit >= 45) {
      lastLevelEmit = ts;
      analyser.getByteFrequencyData(freqData);
      let sum = 0;
      const limit = Math.min(18, freqData.length);
      for (let i = 0; i < limit; i++) sum += freqData[i]!;
      const avg = limit > 0 ? sum / (limit * 255) : 0;
      const normalized = avg < 0.03 ? 0 : Math.min(1, Math.pow(avg * 2.4, 0.85));
      bars.shift();
      bars.push(normalized);
      opts.onLevels([...bars]);
    }
    rafId = requestAnimationFrame(updateWaveform);
  };
  rafId = requestAnimationFrame(updateWaveform);

  // Utterance buffers & state
  let preSpeechRoll: Float32Array[] = [];
  let utteranceChunks: Float32Array[] = [];
  let hasSpeech = false;
  let utteranceStartedAt = 0;
  let lastSpeechAt = 0;
  let lastInterimAt = 0;
  let inFlight = false;
  let utteranceGeneration = 0;

  const runInterim = async (samples: Float32Array, gen: number) => {
    if (inFlight || stopped || samples.length < actualSampleRate * 0.35) return;
    inFlight = true;
    try {
      const b64 = encodePcmToWavBase64(samples, actualSampleRate);
      const res = await opts.transcribe(b64, "audio/wav");
      if (!stopped && gen === utteranceGeneration && res.success && res.text?.trim()) {
        opts.onInterim(res.text.trim());
      }
    } catch {
      // Ignore transient interim errors while continuing capture
    } finally {
      inFlight = false;
    }
  };

  const commitSnapshot = async (chunks: Float32Array[]) => {
    const merged = concatFloat32Chunks(chunks);
    if (merged.length < actualSampleRate * 0.25) return;
    opts.onTranscribingChange?.(true);
    try {
      const b64 = encodePcmToWavBase64(merged, actualSampleRate);
      const res = await opts.transcribe(b64, "audio/wav");
      if (res.success && res.text?.trim()) {
        opts.onCommit(res.text.trim());
      } else {
        opts.onCommit("");
        if (!res.success && res.error) {
          opts.onError(res.error);
        }
      }
    } catch (err: any) {
      opts.onCommit("");
      opts.onError(err?.message || "Voice transcription failed.");
    } finally {
      opts.onTranscribingChange?.(false);
    }
  };

  processor.onaudioprocess = (event) => {
    if (stopped) return;
    const channelData = event.inputBuffer.getChannelData(0);
    const copy = new Float32Array(channelData.length);
    copy.set(channelData);

    let sumSq = 0;
    for (let i = 0; i < copy.length; i++) {
      const v = copy[i]!;
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / Math.max(1, copy.length));
    const now = Date.now();

    if (!hasSpeech) {
      preSpeechRoll.push(copy);
      if (preSpeechRoll.length > 3) preSpeechRoll.shift();
      if (rms >= SPEECH_RMS_THRESHOLD) {
        hasSpeech = true;
        utteranceStartedAt = now;
        lastSpeechAt = now;
        lastInterimAt = now;
        utteranceChunks = [...preSpeechRoll];
        preSpeechRoll = [];
      }
      return;
    }

    utteranceChunks.push(copy);
    if (rms >= SPEECH_RMS_THRESHOLD) {
      lastSpeechAt = now;
    }

    const silenceElapsed = now - lastSpeechAt;
    const utteranceAge = now - utteranceStartedAt;

    if (silenceElapsed >= SILENCE_COMMIT_MS || utteranceAge >= MAX_UTTERANCE_MS) {
      const snapshot = utteranceChunks;
      utteranceChunks = [];
      preSpeechRoll = [];
      hasSpeech = false;
      utteranceGeneration++;
      void commitSnapshot(snapshot);
      return;
    }

    if (now - lastInterimAt >= INTERIM_INTERVAL_MS && !inFlight) {
      lastInterimAt = now;
      const merged = concatFloat32Chunks(utteranceChunks);
      void runInterim(merged, utteranceGeneration);
    }
  };

  return {
    stop: async () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(rafId);
      const pendingChunks = hasSpeech ? [...utteranceChunks] : [];
      utteranceChunks = [];
      preSpeechRoll = [];
      hasSpeech = false;
      utteranceGeneration++;
      try {
        processor.disconnect();
        source.disconnect();
        analyser.disconnect();
        silentGain.disconnect();
      } catch {}
      try {
        stream.getTracks().forEach((t) => t.stop());
      } catch {}
      try {
        await audioCtx.close();
      } catch {}
      opts.onLevels(new Array<number>(NUM_BARS).fill(0));
      if (pendingChunks.length > 0) {
        await commitSnapshot(pendingChunks);
      } else {
        opts.onCommit("");
      }
    },
  };
}

export interface SttTranscribeBridgeResult {
  success: boolean;
  text?: string;
  model?: string;
  providerId?: string;
  error?: string;
}

export interface SttTranscribeBridgePayload {
  audioBase64?: string;
  filePath?: string;
  mimeType?: string;
  filename?: string;
  language?: string;
  prompt?: string;
  providerId?: string;
  model?: string;
  authToken?: string;
}

type SttTranscribeFn = (payload: SttTranscribeBridgePayload) => Promise<SttTranscribeBridgeResult>;

function getDesktopSttTranscriber(): SttTranscribeFn | undefined {
  const win = (globalThis as { window?: { electron?: { stt?: { transcribe?: SttTranscribeFn } } } }).window;
  return win?.electron?.stt?.transcribe;
}

export async function transcribeVoiceChunk(
  audioBase64: string,
  mimeType: string,
  authToken?: string,
): Promise<SttTranscribeBridgeResult> {
  const transcribe = getDesktopSttTranscriber();
  if (!transcribe) {
    return {
      success: false,
      error: "Speech-to-text bridge is unavailable in this environment.",
    };
  }
  return transcribe({
    audioBase64,
    mimeType,
    filename: "dictation.wav",
    authToken: authToken || undefined,
  });
}

export interface AudioAttachmentLike {
  name: string;
  type: string;
  path?: string;
  base64?: string;
  textContent?: string;
}

/**
 * Populates missing `textContent` on audio attachments using the configured
 * STT provider (`whisper-large-v3-turbo` on Const Router or BYOK endpoint)
 * so text-only and reasoning LLMs receive accurate transcripts alongside media metadata.
 */
export async function transcribeAudioAttachments<T extends AudioAttachmentLike>(
  attachments: T[] | undefined,
  authToken?: string,
): Promise<T[] | undefined> {
  if (!attachments || attachments.length === 0) return attachments;
  const transcribe = getDesktopSttTranscriber();
  if (!transcribe) return attachments;

  let changed = false;
  const next = await Promise.all(
    attachments.map(async (att) => {
      if (att.type !== "audio" || att.textContent?.trim()) return att;
      if (!att.path && !att.base64) return att;
      try {
        const res = await transcribe({
          filePath: att.path,
          audioBase64: att.path ? undefined : att.base64,
          filename: att.name,
          authToken: authToken || undefined,
        });
        if (res?.success && res.text?.trim()) {
          changed = true;
          return { ...att, textContent: res.text.trim() };
        }
      } catch {
        // Leave untranscribed so payload builder falls back to the offline notice cleanly
      }
      return att;
    }),
  );
  return changed ? next : attachments;
}
