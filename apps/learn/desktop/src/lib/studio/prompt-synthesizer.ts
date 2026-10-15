import type { LocalSource } from "../db";
import { buildGroundedContext } from "../grounding/context-builder";
import { streamChatCompletion } from "../ai-stream";
import { getStoredVoiceConfig } from "../voice";

export interface SynthesizePresentationPromptOptions {
  sources: LocalSource[];
  provider?: "native";
  lengthMode: "medium" | "long" | "auto";
  slideCount?: number;
  customInstructions?: string;
  language?: "id" | "en";
  downloadsPath?: string;
}

export interface SynthesizeVideoSummaryPromptOptions {
  sources: LocalSource[];
  coverageMode: "long" | "auto";
  language: "id" | "en";
  audioLanguage?: string;
  voiceProviderId?: string;
  voiceModel?: string;
  voiceId?: string;
  voiceName?: string;
  deliveryMode?: string;
  speed?: number;
  customInstructions?: string;
  downloadsPath?: string;
}

/**
 * Sanitize a string for file names (remove non-alphanumeric, spaces to underscores)
 */
function sanitizeFileName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 40)
      .replace(/^_|_$/g, "") || "presentation"
  );
}

/**
 * Synthesizes a high-impact, AI-tailored prompt to create Presentation Slides in the SideChat.
 * Automatically injects skills (/taste-presentation and /pdf) and constructs direct tool execution
 * instructions for the Agent Harness without any looping or redundant fallbacks.
 */
export async function synthesizePresentationPrompt(
  options: SynthesizePresentationPromptOptions
): Promise<string> {
  const {
    sources,
    lengthMode = "auto",
    slideCount,
    customInstructions,
    language = "id",
    downloadsPath,
  } = options;

  const isIndo = language === "id";
  const primaryTitle =
    sources[0]?.title || (isIndo ? "Materi Pembelajaran" : "Study Material");

  // Determine slide count target
  let targetCount = 6;
  if (slideCount && slideCount > 0) {
    targetCount = slideCount;
  } else if (lengthMode === "long") {
    targetCount = 10;
  } else if (lengthMode === "medium") {
    targetCount = 7;
  } else {
    targetCount = Math.min(8, Math.max(5, sources.length * 2));
  }

  const cleanTitle = sanitizeFileName(primaryTitle);
  const targetPdfFileName = `${cleanTitle}.pdf`;
  const effectiveDownloadsPath = downloadsPath
    ? downloadsPath.replace(/\\/g, "/")
    : "~/Downloads";
  const targetPdfFullPath = `${effectiveDownloadsPath}/${targetPdfFileName}`;

  // Strict internet connectivity verification
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error(
      isIndo
        ? "Tidak ada koneksi internet. Pastikan perangkat Anda terhubung ke jaringan."
        : "No internet connection. Please check your network connection."
    );
  }

  const groundedContext = buildGroundedContext(sources);
  const activeModelId =
    (typeof localStorage !== "undefined" &&
      localStorage.getItem("const_learn_active_model")) ||
    "gemini-3.8-flash";

  const systemPrompt = `You are Const Learn AI Presentation Director & Prompt Architect.
Your task is to take the user's presentation options and sources, and synthesize an optimal, strict, and direct execution prompt to run in an isolated SideChat harness.
Guidelines:
1. Always begin with skill triggers: /taste-presentation /pdf
2. Autonomous Aesthetics: Instruct the agent to analyze the content and determine the best visual theme, color palette, typography hierarchy, and slide layout archetypes according to /taste-presentation standards (1 main concept per slide, strong typography, generous negative space, dynamic data layouts).
3. Enforce a direct, non-looping execution pipeline using available tools (write, python, run_command):
   - Step 1: Write a complete, standalone 16:9 HTML slide deck ('slides.html') with Google Fonts and CSS styles.
   - Step 2: Convert directly to PDF ('${targetPdfFileName}') using chromium/google-chrome headless: 'chromium --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${targetPdfFullPath}" slides.html' or python weasyprint/playwright.
   - Step 3: Ensure the compiled PDF is saved directly to '${targetPdfFullPath}'.
   - Step 4: Output the completion summary with the absolute file path '${targetPdfFullPath}'.
4. STRICT CRITICAL RULES:
   - "DO NOT invoke the 'create_studio_artifact' tool. Slides must NOT be created via create_studio_artifact."
   - "DO NOT run pdftoppm or extract images for visual QA loops."
   - "DO NOT create dummy test scripts in /tmp."
   - "Directly execute tool calls (write, run_command) to produce and save the final PDF."
5. Language: ${isIndo ? "Indonesian (Bahasa Indonesia)" : "English"}.
6. Output ONLY the finalized prompt ready to execute. No conversational intro.`;

  const userPrompt = `Synthesize an isolated presentation creation prompt for:
- Topic: ${primaryTitle}
- Slide Count Target: ${targetCount} Slides (${lengthMode.toUpperCase()})
- Visual Direction: AI determines best color palette and layout hierarchy based on content following /taste-presentation
- Target Output PDF Path: ${targetPdfFullPath}
- User Guidance: ${customInstructions?.trim() || "None"}
- Sources: ${sources.map((s) => s.title).join(", ")}
- Brief Context Sample: ${groundedContext.formattedContext.slice(0, 1000)}`;

  let aiResult = "";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    await streamChatCompletion({
      model: activeModelId,
      systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      signal: controller.signal,
      onToken: (token) => {
        aiResult += token;
      },
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    throw new Error(
      err?.message ||
        (isIndo
          ? "Gagal meracik prompt presentasi dengan AI. Silakan coba kembali."
          : "Failed to synthesize presentation prompt with AI. Please try again.")
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const trimmed = aiResult.trim();
  if (!trimmed || trimmed.length < 50) {
    throw new Error(
      isIndo
        ? "AI gagal menghasilkan prompt presentasi yang valid. Silakan coba lagi."
        : "AI failed to produce a valid presentation prompt. Please try again."
    );
  }

  let sanitized = trimmed;
  if (!sanitized.includes("/taste-presentation")) {
    sanitized = `/taste-presentation /pdf\n\n${sanitized}`;
  }
  return sanitized;
}

/**
 * Synthesizes a high-impact, AI-tailored prompt to create a Video Summary in the SideChat.
 * Checks and enforces Inworld TTS configuration before synthesis, injects HyperFrames skills,
 * and sets direct execution tools to produce MP4 into the user's Downloads directory.
 */
export async function synthesizeVideoSummaryPrompt(
  options: SynthesizeVideoSummaryPromptOptions
): Promise<string> {
  const {
    sources,
    coverageMode = "auto",
    language = "id",
    audioLanguage,
    voiceModel = "inworld-tts-2",
    voiceName = "Ashley",
    deliveryMode = "conversational",
    speed = 1.0,
    customInstructions,
    downloadsPath,
  } = options;

  const isIndo = language === "id";

  // Check Inworld TTS configuration: user cannot create if API key or model config is invalid
  const voiceConfig = getStoredVoiceConfig();
  const inworldProvider = voiceConfig.providers.find(
    (p) => p.protocol === "inworld" || p.id === "inworld"
  );
  const inworldApiKey = inworldProvider?.apiKey?.trim() || "";

  if (!inworldApiKey) {
    throw new Error(
      isIndo
        ? "API Key Inworld TTS belum dikonfigurasi. Silakan buka Pengaturan > Suara & Model untuk memasukkan API Key Inworld sebelum membuat Video Summary."
        : "Inworld TTS API Key is not configured. Please open Settings > Voice & Models to configure your Inworld API Key before creating a Video Summary."
    );
  }

  const primaryTitle =
    sources[0]?.title || (isIndo ? "Materi Pembelajaran" : "Study Material");

  const sceneCountDesc =
    coverageMode === "long"
      ? isIndo
        ? "7-10 Scene (Mendalam & Komprehensif)"
        : "7-10 Scenes (In-Depth & Comprehensive)"
      : isIndo
      ? "4-7 Scene (Adaptif & Seimbang)"
      : "4-7 Scenes (Adaptive & Balanced)";

  const cleanTitle = sanitizeFileName(primaryTitle);
  const targetMp4FileName = `${cleanTitle}.mp4`;
  const effectiveDownloadsPath = downloadsPath
    ? downloadsPath.replace(/\\/g, "/")
    : "~/Downloads";
  const targetMp4FullPath = `${effectiveDownloadsPath}/${targetMp4FileName}`;
  const effectiveAudioLang = audioLanguage || (isIndo ? "id-ID" : "en-US");

  // Strict internet connectivity verification
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error(
      isIndo
        ? "Tidak ada koneksi internet. Pastikan perangkat Anda terhubung ke jaringan."
        : "No internet connection. Please check your network connection."
    );
  }

  const activeModelId =
    (typeof localStorage !== "undefined" &&
      localStorage.getItem("const_learn_active_model")) ||
    "gemini-3.8-flash";

  const systemPrompt = `You are Const Learn AI Video Director & Prompt Architect.
Your task is to take the user's video summary options and study sources, and synthesize an optimal, strict, and direct execution prompt to run in an isolated SideChat harness.
Guidelines:
1. Always begin with skill triggers: /hyperframes-core /hyperframes-creative /hyperframes-animation /hyperframes-audio
2. Enforce a direct, non-looping execution pipeline using available tools (write, python, run_command):
   - Step 1: Write structured scenes with storyboard and narration scripts based on the study sources.
   - Step 2: Generate narration audio for each scene using Inworld TTS API (model: ${voiceModel}, voice: ${voiceName}, lang: ${effectiveAudioLang}, speed: ${speed}x, delivery: ${deliveryMode}). Write a python script or call Inworld API directly to produce MP3 audio tracks.
   - Step 3: Compose and render video scenes into high quality 60fps MP4 using ffmpeg or python moviepy.
   - Step 4: Save the final compiled video directly to '${targetMp4FullPath}'.
   - Step 5: Output the completion summary with the absolute file path '${targetMp4FullPath}'.
3. STRICT CRITICAL RULES:
   - "DO NOT invoke the 'create_studio_artifact' tool. Video summaries must NOT be created via create_studio_artifact."
   - "DO NOT get stuck in repetitive planning loops."
   - "Directly invoke write, python, and run_command tools to generate the audio, video, and final MP4 file."
4. Language: ${isIndo ? "Indonesian (Bahasa Indonesia)" : "English"}.
5. Output ONLY the finalized prompt ready to execute. No conversational intro.`;

  const userPrompt = `Synthesize an isolated video creation prompt for:
- Topic: ${primaryTitle}
- Coverage: ${sceneCountDesc}
- Voice: Inworld TTS (${voiceName}, ${voiceModel}, ${effectiveAudioLang}, speed: ${speed}x, delivery: ${deliveryMode})
- Target Output MP4 Path: ${targetMp4FullPath}
- User Guidance: ${customInstructions?.trim() || "None"}
- Sources: ${sources.map((s) => s.title).join(", ")}`;

  let aiResult = "";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    await streamChatCompletion({
      model: activeModelId,
      systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      signal: controller.signal,
      onToken: (token) => {
        aiResult += token;
      },
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    throw new Error(
      err?.message ||
        (isIndo
          ? "Gagal meracik prompt video summary dengan AI. Silakan coba kembali."
          : "Failed to synthesize video summary prompt with AI. Please try again.")
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const trimmed = aiResult.trim();
  if (!trimmed || trimmed.length < 50) {
    throw new Error(
      isIndo
        ? "AI gagal menghasilkan prompt video summary yang valid. Silakan coba lagi."
        : "AI failed to produce a valid video summary prompt. Please try again."
    );
  }

  let sanitized = trimmed;
  if (!sanitized.includes("/hyperframes-core")) {
    sanitized = `/hyperframes-core /hyperframes-creative /hyperframes-animation /hyperframes-audio\n\n${sanitized}`;
  }
  return sanitized;
}
