import type { LocalSource, QuizData, FlashcardData, MindMapData, MindMapNode, AudioSummaryData, SlideDeckData, SlideItem, InfographicData } from "../db";
import { getRouterBaseUrl } from "../ai-stream";
import { getStoredVoiceConfig, synthesizeSpeechChunked } from "../voice";
import { generateImage, getActiveImageModel, getStoredImageConfig, type ImageProvider } from "../image";
import { buildPresentationHtml } from "./presentation-builder";
import { executeCanvaMcp, executeComposioTool, renderPresentationPdfInSandbox, exportCanvaPresentation } from "../composio";
export { exportCanvaPresentation };
import { localDb } from "../db";

export interface GenerateStudioArtifactOptions {
  type: "quiz" | "flashcard" | "mind_map" | "audio_summary";
  learnId: string;
  topic?: string;
  difficulty?: "easy" | "medium" | "hard";
  count?: number;
  lengthMode?: "short" | "medium" | "long" | "auto";
  sources: LocalSource[];
  language?: "id" | "en";
  themeId?: string;
  customPrompt?: string;
  voiceModel?: string;
  voiceId?: string;
  audioLanguage?: string;
}

function extractJson(text: string): any {
  if (!text) return null;
  // Strip reasoning / thinking tags from thinking models (e.g. DeepSeek R1)
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // Strip markdown fences
  cleaned = cleaned
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to find the outermost JSON object
    const startIdx = cleaned.indexOf("{");
    const endIdx = cleaned.lastIndexOf("}");
    if (startIdx >= 0 && endIdx > startIdx) {
      const candidate = cleaned.slice(startIdx, endIdx + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        // Fix trailing commas if present
        try {
          const sanitized = candidate.replace(/,\s*([}\]])/g, "$1");
          return JSON.parse(sanitized);
        } catch {}
      }
    }
  }
  return null;
}

interface RawOption {
  text?: string;
  explanation?: string;
  isCorrect?: boolean;
}

function shuffleAndFormatQuizQuestions(rawQuestions: any[]): Array<{
  id: string;
  question: string;
  options: Array<{ id: string; text: string; explanation: string; isCorrect: boolean }>;
  hint?: string;
}> {
  const letters = ["A", "B", "C", "D"];
  return rawQuestions.map((q: any, qIdx: number) => {
    const rawOptions: RawOption[] = (q.options || []).map((opt: any) => ({
      text: String(opt.text || ""),
      explanation: String(opt.explanation || ""),
      isCorrect: Boolean(opt.isCorrect),
    }));

    // Ensure at least one option is marked correct, and at most one
    const correctIndices: number[] = [];
    rawOptions.forEach((opt, idx) => {
      if (opt.isCorrect) correctIndices.push(idx);
    });

    if (correctIndices.length === 0 && rawOptions.length > 0) {
      rawOptions[qIdx % rawOptions.length]!.isCorrect = true;
    } else if (correctIndices.length > 1) {
      for (let i = 1; i < correctIndices.length; i++) {
        const idxToReset = correctIndices[i];
        if (idxToReset !== undefined && rawOptions[idxToReset]) {
          rawOptions[idxToReset]!.isCorrect = false;
        }
      }
    }

    // Shuffle options array so the correct answer position is completely randomized
    const shuffled = [...rawOptions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = shuffled[i]!;
      shuffled[i] = shuffled[j]!;
      shuffled[j] = temp;
    }

    // Re-assign clean IDs (A, B, C, D)
    const options = shuffled.map((opt, optIdx) => ({
      id: letters[optIdx] || String.fromCharCode(65 + optIdx),
      text: opt.text || "",
      explanation: opt.explanation || "",
      isCorrect: Boolean(opt.isCorrect),
    }));

    return {
      id: String(q.id || qIdx + 1),
      question: q.question || `Pertanyaan ${qIdx + 1}`,
      options,
      hint: q.hint || undefined,
    };
  });
}

export async function generateStudioArtifact({
  type,
  learnId: _learnId,
  topic,
  difficulty = "medium",
  count = 10,
  lengthMode = "auto",
  sources,
  language = "id",
  themeId = "auto",
  customPrompt,
  voiceModel = "inworld-tts-2",
  voiceId = "Ashley",
  audioLanguage,
}: GenerateStudioArtifactOptions): Promise<{
  title: string;
  data: QuizData | FlashcardData | MindMapData | AudioSummaryData;
}> {
  // Aggregate source texts for grounding context
  const sourceSnippets = sources
    .slice(0, 5)
    .map((s, idx) => {
      const rawContent =
        typeof s.content === "string"
          ? s.content
          : typeof s.content === "object" && s.content !== null
          ? JSON.stringify(s.content)
          : String(s.content || "");
      const content = rawContent.slice(0, 4000);
      return `### Sumber [${idx + 1}]: "${s.title}"\n${content}`;
    })
    .join("\n\n");

  const isIndo = language === "id";
  const numItems = Math.max(1, Math.min(50, count));

  let systemPrompt = "";
  let userPrompt = "";

  if (type === "quiz") {
    systemPrompt = isIndo
      ? `Anda adalah pembuat kuis edukatif ahli. Tugas Anda adalah menyusun kuis pilihan ganda terverifikasi berkualitas tinggi berdasarkan materi sumber yang diberikan.
Aturan Sangat Penting:
1. Buat tepat ${numItems} soal pilihan ganda (A, B, C, D) dengan tepat SATU jawaban benar per soal.
2. Tingkat kesulitan: ${difficulty}.
3. RANDOMISASI JAWABAN BENAR (WAJIB): Posisi pilihan jawaban yang benar (A, B, C, atau D) HARUS DIACAK dan didistribusikan secara bervariasi dan merata di antara soal-soal. JANGAN PERNAH membuat semua jawaban benar berada di opsi A! Buat variasi posisi jawaban benar seperti: Soal 1 di C, Soal 2 di A, Soal 3 di D, Soal 4 di B, dst.
4. SETIAP opsi (baik yang benar maupun yang salah) WAJIB memiliki penjelasan ("explanation") singkat dan jelas mengapa opsi tersebut benar atau salah berdasarkan sumber.
5. Sertakan petunjuk ("hint") singkat yang membantu pengguna tanpa langsung membocorkan jawaban.
6. Format output HANYA JSON valid tanpa teks pengantar atau penutup.`
      : `You are an expert educational quiz creator. Your task is to craft high-quality verified multiple-choice questions based on the provided source material.
Critical Rules:
1. Create exactly ${numItems} multiple-choice questions (A, B, C, D) with exactly ONE correct answer per question.
2. Difficulty: ${difficulty}.
3. RANDOMIZE CORRECT ANSWER POSITIONS (MANDATORY): The correct answer option (A, B, C, or D) MUST be evenly and randomly distributed across all questions. NEVER make option A the correct answer for all questions! (For example: Question 1 is C, Question 2 is A, Question 3 is D, Question 4 is B).
4. EVERY option (both correct and incorrect) MUST have an explanation explaining why it is correct or incorrect based on the sources.
5. Include a subtle hint for each question.
6. Output ONLY valid JSON with no introductory or concluding text.`;

    userPrompt = `Materi Sumber Belajar:\n${sourceSnippets || "Topik Umum: " + (topic || "Pengetahuan Umum")}\n\n` +
      (topic ? `Fokus Topik Spesifik: ${topic}\n\n` : "") +
      `Silakan hasilkan kuis dalam format JSON persis seperti berikut (perhatikan variasi letak jawaban benar):\n` +
      JSON.stringify(
        {
          title: `AI Kuis: ${topic || sources[0]?.title || "Materi Belajar"}`,
          questions: [
            {
              id: "1",
              question: "Teks pertanyaan pertama di sini?",
              options: [
                {
                  id: "A",
                  text: "Pilihan A (distraktor)",
                  explanation: "Penjelasan mengapa opsi ini kurang tepat",
                  isCorrect: false,
                },
                {
                  id: "B",
                  text: "Pilihan B (distraktor)",
                  explanation: "Penjelasan mengapa opsi ini keliru",
                  isCorrect: false,
                },
                {
                  id: "C",
                  text: "Pilihan C (jawaban benar)",
                  explanation: "Penjelasan mengapa opsi C benar sesuai materi sumber",
                  isCorrect: true,
                },
                {
                  id: "D",
                  text: "Pilihan D (distraktor)",
                  explanation: "Penjelasan mengapa opsi ini kurang relevan",
                  isCorrect: false,
                },
              ],
              hint: "Petunjuk untuk soal 1",
            },
            {
              id: "2",
              question: "Teks pertanyaan kedua di sini?",
              options: [
                {
                  id: "A",
                  text: "Pilihan A (jawaban benar)",
                  explanation: "Penjelasan mengapa opsi A benar sesuai materi sumber",
                  isCorrect: true,
                },
                {
                  id: "B",
                  text: "Pilihan B (distraktor)",
                  explanation: "Penjelasan mengapa opsi ini salah",
                  isCorrect: false,
                },
                {
                  id: "C",
                  text: "Pilihan C (distraktor)",
                  explanation: "Penjelasan mengapa opsi ini keliru",
                  isCorrect: false,
                },
                {
                  id: "D",
                  text: "Pilihan D (distraktor)",
                  explanation: "Penjelasan mengapa opsi ini salah",
                  isCorrect: false,
                },
              ],
              hint: "Petunjuk untuk soal 2",
            },
          ],
        },
        null,
        2
      );
  } else if (type === "flashcard") {
    // Flashcards
    systemPrompt = isIndo
      ? `Anda adalah pembuat flashcard edukatif ahli. Tugas Anda adalah mengekstrak konsep kunci, definisi, atau tanya-jawab penting dari materi sumber yang diberikan.
Aturan:
1. Buat tepat ${numItems} kartu flashcard.
2. Tingkat kesulitan materi: ${difficulty}.
3. Sisi depan ("front") berisi istilah, konsep, atau pertanyaan ringkas.
4. Sisi belakang ("back") berisi definisi, intisari penjelasan, atau fakta kunci yang terverifikasi.
5. Sertakan petunjuk pengingat ("hint") jika relevan.
6. Format output HANYA JSON valid tanpa teks pengantar atau penutup.`
      : `You are an expert flashcard creator. Your task is to extract key concepts, definitions, or Q&A from the provided source material.
Rules:
1. Create exactly ${numItems} flashcard items.
2. Difficulty level: ${difficulty}.
3. "front" contains the term, concept, or concise question.
4. "back" contains the clear explanation, definition, or key verified takeaway.
5. Include a hint where relevant.
6. Output ONLY valid JSON with no introductory text.`;

    userPrompt = `Materi Sumber Belajar:\n${sourceSnippets || "Topik: " + (topic || "Pengetahuan Umum")}\n\n` +
      (topic ? `Fokus Topik Spesifik: ${topic}\n\n` : "") +
      `Silakan hasilkan flashcards dalam format JSON persis seperti berikut:\n` +
      JSON.stringify(
        {
          title: `Flashcard: ${topic || sources[0]?.title || "Konsep Kunci"}`,
          cards: [
            {
              id: "1",
              front: "Istilah atau Pertanyaan?",
              back: "Penjelasan rinci dan intisari jawaban.",
              hint: "Petunjuk pengingat",
            },
          ],
        },
        null,
        2
      );
  } else if (type === "mind_map") {
    // Mind Map
    systemPrompt = isIndo
      ? `Anda adalah pembuat peta pikiran (mind map) terstruktur ahli untuk Const Learn.
Tugas Anda adalah menyusun hierarki konsep komprehensif, logis, dan bersih dalam format JSON berdasarkan materi sumber belajar.
Aturan Penting:
1. Kembalikan HANYA objek JSON valid sesuai interface:
{
  "title": string,
  "root": {
    "id": "root",
    "label": string,
    "children": [
      {
        "id": string,
        "label": string,
        "children": [
          {
            "id": string,
            "label": string,
            "children": [
              { "id": string, "label": string }
            ]
          }
        ]
      }
    ]
  }
}
2. Panduan Hirarki:
   - Root memiliki 4 sampai 6 cabang utama (Level 1).
   - Setiap cabang Level 1 memiliki 2 sampai 4 sub-cabang (Level 2).
   - Label simpul ringkas dan jelas (2 sampai 6 kata).
   - Setiap simpul dapat memiliki properti "description" (penjelasan intisari konsep dalam 1-2 kalimat ringkas).
   - Gunakan ID alfanumerik unik untuk setiap simpul (misal: "c1", "c1_1").
3. Bahasa: Gunakan Bahasa Indonesia.
4. Output HANYA JSON valid tanpa teks pengantar atau markdown.`
      : `You are an expert hierarchical knowledge-structuring engine for Const Learn.
Your task is to analyze study materials and output a clean, comprehensive hierarchical Mind Map in valid JSON.
Rules:
1. Return ONLY a valid JSON object matching:
{
  "title": string,
  "root": {
    "id": "root",
    "label": string,
    "description"?: string,
    "children": [
      {
        "id": string,
        "label": string,
        "description"?: string,
        "children": [
          {
            "id": string,
            "label": string,
            "description"?: string,
            "children": [
              { "id": string, "label": string, "description"?: string }
            ]
          }
        ]
      }
    ]
  }
}
2. Hierarchy Guidelines:
   - Root has 4 to 6 main Level 1 branches.
   - Each Level 1 branch has 2 to 4 Level 2 children.
   - Concise node labels (2 to 6 words max).
   - Each node can optionally include a concise 1-2 sentence "description" summarizing the key concept.
   - Unique alphanumeric IDs for each node.
3. Language: English.
4. STRICT: Pure JSON only without markdown or introductory text.`;

    userPrompt = `Materi Sumber Belajar:\n${sourceSnippets || "Topik: " + (topic || "Pengetahuan Umum")}\n\n` +
      (topic ? `Fokus Topik Spesifik / Instruksi: ${topic}\n\n` : "") +
      `Silakan buatkan Peta Pikiran hierarkis dalam format JSON yang valid.`;
  } else if (type === "audio_summary") {
    const lengthGuideline =
      lengthMode === "short"
        ? (isIndo ? "Ringkas: sekitar 300-500 kata, intisari pokok yang padat dan langsung ke poin utama." : "Concise: around 300-500 words, direct highlights and key takeaways.")
        : lengthMode === "long"
        ? (isIndo ? "Panjang & Mendalam: sekitar 1000-1600 kata, elaborasi komprehensif dengan latar belakang, analisis mendalam, dan contoh relevan." : "In-depth: around 1000-1600 words, comprehensive explanation with context, analysis, and examples.")
        : (isIndo ? "Otomatis: sekitar 500-900 kata, pembahasan berimbang yang mencakup seluruh poin penting materi." : "Auto: around 500-900 words, balanced educational overview.");

    systemPrompt = isIndo
      ? `Anda adalah narator ahli dan produser audio edukasi untuk Const Learn.
Tugas Anda adalah merangkum materi sumber ke dalam bentuk naskah audio (narasi suara) yang menarik, jernih, dan enak didengarkan.
Aturan Penulisan Naskah:
1. Kembalikan HANYA objek JSON valid:
{
  "title": string,
  "script": string
}
2. Format Naskah:
   - Tulis dalam gaya berbicara lisan yang natural, hangat, dan komunikatif (seperti mendengarkan podcast edukatif atau audiobook berkualitas tinggi).
   - Hindari simbol visual seperti tabel, bullet points berlebihan, markdown tebal yang tidak dapat dibaca suara, atau URL.
   - Gunakan tanda baca yang tepat agar intonasi suara AI mengalir dengan alami.
   - Anda boleh menyisipkan steering tags Inworld TTS-2 dalam kurung siku secara wajar untuk variasi emosi/jeda, misalnya: [warmly], [thoughtful], [pause: 1s].
3. Panjang Naskah: ${lengthGuideline}
4. Bahasa: ${audioLanguage?.startsWith("en") ? "English" : "Bahasa Indonesia"}.
5. Output HANYA JSON valid tanpa teks pengantar.`
      : `You are an expert audio educator and narrative producer for Const Learn.
Your task is to synthesize source materials into an engaging, natural-sounding audio overview script.
Rules:
1. Return ONLY a valid JSON object:
{
  "title": string,
  "script": string
}
2. Script Format:
   - Written for the ear: spoken-style narration, engaging and conversational yet informative.
   - Avoid visual markdown tables, raw links, or dense bullet points that sound awkward when read aloud.
   - You may subtly include Inworld TTS-2 steering tags like [warmly], [thoughtful], [excited], [pause: 1s] where fitting.
3. Target Length: ${lengthGuideline}
4. Language: ${audioLanguage?.startsWith("id") ? "Indonesian" : "English"}.
5. STRICT: Pure JSON only without markdown or extra commentary.`;

    userPrompt = `Materi Sumber Belajar:\n${sourceSnippets || "Topik: " + (topic || "Pengetahuan Umum")}\n\n` +
      (topic ? `Fokus Topik Spesifik: ${topic}\n\n` : "") +
      (customPrompt ? `Instruksi Khusus Tambahan: ${customPrompt}\n\n` : "") +
      `Silakan buatkan naskah ringkasan audio dalam format JSON yang valid.`;
  }

  // Attempt API call to Router AI Gateway
  try {
    const baseUrl = getRouterBaseUrl();
    const endpoint = baseUrl.endsWith("/chat/completions")
      ? baseUrl
      : `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

    const authToken =
      (typeof localStorage !== "undefined" &&
        (localStorage.getItem("const_learn_auth_token") ||
          localStorage.getItem("const_sso_token"))) ||
      "";

    const apiKey =
      authToken ||
      (import.meta as any).env?.VITE_CONST_ROUTER_API_KEY ||
      (import.meta as any).env?.VITE_CONST_ENGINE_API_KEY ||
      "";

    const activeModel =
      (typeof localStorage !== "undefined" &&
        localStorage.getItem("const_learn_active_model")) ||
      "gemini-3.8-flash";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: activeModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        stream: false,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const json = await response.json();
      const content = json.choices?.[0]?.message?.content;
      if (content) {
        const parsed = extractJson(content);
        if (parsed) {
          if (type === "quiz" && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
            const formattedQuestions = shuffleAndFormatQuizQuestions(parsed.questions).slice(0, numItems);
            const quizData: QuizData = {
              title: parsed.title || `AI Kuis: ${topic || sources[0]?.title || "Materi Belajar"}`,
              topic,
              difficulty,
              sourceCount: sources.length,
              sourceTitles: sources.map((s) => s.title),
              questions: formattedQuestions,
            };
            return { title: quizData.title, data: quizData };
          } else if (type === "flashcard" && Array.isArray(parsed.cards) && parsed.cards.length > 0) {
            const flashcardData: FlashcardData = {
              title: parsed.title || `Flashcard: ${topic || sources[0]?.title || "Konsep Belajar"}`,
              topic,
              difficulty,
              sourceCount: sources.length,
              sourceTitles: sources.map((s) => s.title),
              cards: parsed.cards.slice(0, numItems).map((c: any, cIdx: number) => ({
                id: String(c.id || cIdx + 1),
                front: c.front || `Konsep ${cIdx + 1}`,
                back: c.back || "Penjelasan materi.",
                hint: c.hint || undefined,
              })),
            };
            return { title: flashcardData.title, data: flashcardData };
          } else if (type === "mind_map" && parsed.root && Array.isArray(parsed.root.children)) {
            const mindMapData: MindMapData = {
              id: `mindmap_${Date.now()}`,
              title: parsed.title || (topic ? `Peta Pikiran: ${topic}` : `Peta Pikiran: ${sources[0]?.title || "Materi Belajar"}`),
              topic,
              root: parsed.root,
              sourceCount: sources.length,
              sourceTitles: sources.map((s) => s.title),
              sourceIds: sources.map((s) => s.id),
              sourceNames: sources.map((s) => s.title),
              prompt: topic,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            return { title: mindMapData.title, data: mindMapData };
          } else if (type === "audio_summary" && (parsed.script || parsed.summary)) {
            const scriptText = String(parsed.script || parsed.summary || "").trim();
            const summaryTitle = parsed.title || (topic ? (isIndo ? `Ringkasan Audio: ${topic}` : `Audio Summary: ${topic}`) : (isIndo ? `Ringkasan Audio: ${sources[0]?.title || "Materi Belajar"}` : `Audio Summary: ${sources[0]?.title || "Study Material"}`));

            let audioUrl: string | undefined;
            let audioBase64: string | undefined;
            let audioError: string | undefined;

            const voiceConfig = getStoredVoiceConfig();
            const provider = voiceConfig.providers.find((p) => p.protocol === "inworld") || voiceConfig.providers[0];

            if (provider && provider.apiKey?.trim()) {
              try {
                console.log("[Studio Generator Mobile] Synthesizing audio, provider:", provider.name, "voice:", voiceId || provider.voice);
                const synthRes = await synthesizeSpeechChunked({
                  provider: {
                    ...provider,
                    model: voiceModel || provider.model || "inworld-tts-2",
                    voice: voiceId || provider.voice || "Ashley",
                  },
                  text: scriptText,
                });
                if (synthRes.success) {
                  audioUrl = synthRes.audioUrl;
                  audioBase64 = synthRes.audioBase64;
                  console.log("[Studio Generator Mobile] Audio synthesized successfully.");
                } else {
                  audioError = synthRes.error;
                  console.error("[Studio Generator Mobile] Audio synthesis failed:", synthRes.error);
                }
              } catch (synthErr: any) {
                audioError = synthErr?.message || "Synthesis exception";
                console.error("[Studio Generator Mobile] Audio synthesis error:", synthErr);
              }
            } else {
              audioError = isIndo
                ? "API Key Inworld belum dikonfigurasi di menu Pengaturan Model."
                : "Inworld API Key is not configured in Models settings.";
              console.warn("[Studio Generator Mobile]", audioError);
            }

            const audioSummaryData: AudioSummaryData = {
              title: summaryTitle,
              script: scriptText,
              audioUrl,
              audioBase64,
              voiceModel: voiceModel || provider?.model || "inworld-tts-2",
              voiceId: voiceId || provider?.voice || "Ashley",
              language: audioLanguage || language,
              lengthMode: lengthMode as any,
              sourceCount: sources.length,
              sourceTitles: sources.map((s) => s.title),
              sourceIds: sources.map((s) => s.id),
              createdAt: Date.now(),
              audioError,
            };
            return { title: audioSummaryData.title, data: audioSummaryData };
          }
        } else {
          console.warn("[Studio Generator Mobile] Router fetch returned unparseable content:", content);
        }
      }
    } else {
      const errText = await response.text().catch(() => "");
      console.warn("[Studio Generator Mobile] Direct HTTP fetch failed with status:", response.status, errText);
    }
  } catch (err) {
    console.warn("API call to Const Router failed in mobile, using fallback:", err);
  }

  // Graceful offline/fallback generator
  const fallbackTitle = topic
    ? (type === "quiz" ? `AI Kuis: ${topic}` : type === "flashcard" ? `Flashcard: ${topic}` : type === "audio_summary" ? (isIndo ? `Ringkasan Audio: ${topic}` : `Audio Summary: ${topic}`) : `Peta Pikiran: ${topic}`)
    : sources.length > 0
    ? (type === "quiz" ? `AI Kuis: ${sources[0]!.title}` : type === "flashcard" ? `Flashcard: ${sources[0]!.title}` : type === "audio_summary" ? (isIndo ? `Ringkasan Audio: ${sources[0]!.title}` : `Audio Summary: ${sources[0]!.title}`) : `Peta Pikiran: ${sources[0]!.title}`)
    : type === "quiz" ? "AI Kuis Mandiri" : type === "flashcard" ? "Flashcard Mandiri" : type === "audio_summary" ? (isIndo ? "Ringkasan Audio Mandiri" : "Audio Summary") : "Peta Pikiran Mandiri";

  if (type === "audio_summary") {
    const primarySource = sources[0];
    const sourceTitle = primarySource?.title || "Materi Belajar";
    const script = isIndo
      ? `Selamat datang di Ringkasan Audio Const Learn. Pada sesi kali ini, kita akan membahas mengenai ${topic || sourceTitle}. ${
          primarySource?.content
            ? `Berdasarkan materi yang telah dipelajari, terdapat beberapa gagasan utama yang sangat penting untuk dipahami secara menyeluruh.`
            : `Materi ini memberikan wawasan mendalam mengenai konsep-konsep kunci dan penerapannya.`
        } [warmly] Mari kita telaah intisari penting dan bagaimana konsep-konsep ini saling terhubung secara terstruktur.`
      : `Welcome to the Const Learn Audio Summary. In this session, we will explore ${topic || sourceTitle}. [warmly] Based on our study materials, there are several foundational insights and core takeaways to understand thoroughly. Let's walk through the key concepts and their practical context.`;

    let audioUrl: string | undefined;
    let audioBase64: string | undefined;
    let audioError: string | undefined;

    const voiceConfig = getStoredVoiceConfig();
    const provider = voiceConfig.providers.find((p) => p.protocol === "inworld") || voiceConfig.providers[0];

    if (provider && provider.apiKey?.trim()) {
      try {
        console.log("[Studio Generator Mobile] Synthesizing audio via Fallback, provider:", provider.name, "voice:", voiceId || provider.voice);
        const synthRes = await synthesizeSpeechChunked({
          provider: {
            ...provider,
            model: voiceModel || provider.model || "inworld-tts-2",
            voice: voiceId || provider.voice || "Ashley",
          },
          text: script,
        });
        if (synthRes.success) {
          audioUrl = synthRes.audioUrl;
          audioBase64 = synthRes.audioBase64;
          console.log("[Studio Generator Mobile] Fallback audio synthesized successfully.");
        } else {
          audioError = synthRes.error;
          console.error("[Studio Generator Mobile] Fallback audio synthesis failed:", synthRes.error);
        }
      } catch (synthErr: any) {
        audioError = synthErr?.message || "Synthesis exception";
        console.error("[Studio Generator Mobile] Fallback audio synthesis threw:", synthErr);
      }
    } else {
      audioError = isIndo
        ? "API Key Inworld belum dikonfigurasi di menu Pengaturan Model."
        : "Inworld API Key is not configured in Models settings.";
      console.warn("[Studio Generator Mobile]", audioError);
    }

    const audioSummaryData: AudioSummaryData = {
      title: isIndo ? `Ringkasan Audio: ${topic || sourceTitle}` : `Audio Summary: ${topic || sourceTitle}`,
      script,
      audioUrl,
      audioBase64,
      voiceModel: voiceModel || provider?.model || "inworld-tts-2",
      voiceId: voiceId || provider?.voice || "Ashley",
      language: audioLanguage || language,
      lengthMode: lengthMode as any,
      sourceCount: sources.length,
      sourceTitles: sources.map((s) => s.title),
      sourceIds: sources.map((s) => s.id),
      createdAt: Date.now(),
      audioError,
    };
    return { title: audioSummaryData.title, data: audioSummaryData };
  }

  if (type === "quiz") {
    const rawSampleQuestions = [
      {
        id: "1",
        question: `Berdasarkan ${sources[0]?.title || "materi rujukan"}, prinsip utama apa yang menjadi landasan konsep ini?`,
        options: [
          {
            id: "A",
            text: "Kecepatan eksekusi tanpa pertimbangan konteks data.",
            explanation: "Salah. Kecepatan tanpa akurasi konteks bukanlah prinsip yang direkomendasikan.",
            isCorrect: false,
          },
          {
            id: "B",
            text: "Penggunaan asumsi statis tanpa pengujian hipotesis.",
            explanation: "Salah. Konsep ini justru mengedepankan verifikasi berbasis fakta.",
            isCorrect: false,
          },
          {
            id: "C",
            text: "Penalaran adaptif dan pemrosesan mendalam secara terstruktur.",
            explanation: "Benar! Sumber menekankan bahwa penalaran terstruktur adalah kunci utama dalam metodologi ini.",
            isCorrect: true,
          },
          {
            id: "D",
            text: "Isolasi data dari variabel pengujian eksternal.",
            explanation: "Salah. Variabel eksternal tetap diperhitungkan dalam analisis.",
            isCorrect: false,
          },
        ],
        hint: "Perhatikan parameter penalaran dan verifikasi fakta dalam dokumen.",
      },
      {
        id: "2",
        question: "Apa perbedaan paling signifikan antara pendekatan terstruktur dengan non-terstruktur dalam konteks ini?",
        options: [
          {
            id: "A",
            text: "Pendekatan terstruktur memvalidasi setiap tahapan logika sebelum kesimpulan.",
            explanation: "Benar! Setiap langkah analisis diperiksa secara berkesinambungan.",
            isCorrect: true,
          },
          {
            id: "B",
            text: "Pendekatan terstruktur membutuhkan sumber daya yang tidak terukur.",
            explanation: "Salah. Sumber daya tetap dapat diukur dan diproyeksikan.",
            isCorrect: false,
          },
          {
            id: "C",
            text: "Pendekatan non-terstruktur memberikan akurasi yang lebih konsisten.",
            explanation: "Salah. Non-terstruktur memiliki variansi hasil yang lebih tinggi.",
            isCorrect: false,
          },
          {
            id: "D",
            text: "Tidak ada perbedaan nyata antara keduanya.",
            explanation: "Salah. Perbedaannya terletak pada sistematika pemecahan masalah.",
            isCorrect: false,
          },
        ],
        hint: "Fokus pada sistematika langkah pemikiran.",
      },
      {
        id: "3",
        question: "Bagaimana integrasi sumber rujukan mempengaruhi hasil penalaran AI?",
        options: [
          {
            id: "A",
            text: "Mengurangi kecepatan output secara drastis tanpa manfaat akurasi.",
            explanation: "Salah. Peningkatan akurasi jauh lebih dominan dibanding perubahan latensi.",
            isCorrect: false,
          },
          {
            id: "B",
            text: "Membatasi model untuk menjawab hal-hal di luar teks sama sekali.",
            explanation: "Salah. Model tetap dapat mensintesis dan menghubungkan konsep secara socrates.",
            isCorrect: false,
          },
          {
            id: "C",
            text: "Hanya berfungsi sebagai hiasan bibliografi.",
            explanation: "Salah. Sumber secara aktif diproses dalam prompt context.",
            isCorrect: false,
          },
          {
            id: "D",
            text: "Menyediakan data terverifikasi sehingga meminimalisir halusinasi dan asumsi.",
            explanation: "Benar! Dokumen rujukan menjadi jangkar kebenaran faktual bagi model.",
            isCorrect: true,
          },
        ],
        hint: "Ingat prinsip grounding dan mitigasi halusinasi.",
      },
      {
        id: "4",
        question: "Manakah peran terpenting dari evaluasi aktif (active recall) dalam pembelajaran?",
        options: [
          {
            id: "A",
            text: "Sekadar menghafal kata kunci tanpa memahami hubungan antarkonsep.",
            explanation: "Salah. Menghafal pasif tidak menguatkan retensi jangka panjang.",
            isCorrect: false,
          },
          {
            id: "B",
            text: "Memperkuat jejak memori neural dan mengidentifikasi celah pemahaman lebih awal.",
            explanation: "Benar! Menguji pemahaman secara aktif terbukti meningkatkan retensi belajar secara signifikan.",
            isCorrect: true,
          },
          {
            id: "C",
            text: "Menghindari membaca materi sumber asli secara menyeluruh.",
            explanation: "Salah. Active recall melengkapi pemahaman dari materi sumber.",
            isCorrect: false,
          },
          {
            id: "D",
            text: "Mempercepat waktu belajar tanpa perlu fokus mendalam.",
            explanation: "Salah. Pembelajaran efektif tetap membutuhkan konsentrasi dan refleksi.",
            isCorrect: false,
          },
        ],
        hint: "Pikirkan dampak pengujian diri terhadap penguatan daya ingat.",
      },
    ];

    // Generate questions dynamically up to numItems
    const dynamicQuestions = [];
    for (let i = 0; i < numItems; i++) {
      const baseQ = rawSampleQuestions[i % rawSampleQuestions.length]!;
      dynamicQuestions.push({
        ...baseQ,
        id: String(i + 1),
        question:
          i < rawSampleQuestions.length
            ? baseQ.question
            : `${baseQ.question} (Bagian ${Math.floor(i / rawSampleQuestions.length) + 1})`,
      });
    }

    const fallbackQuiz: QuizData = {
      title: fallbackTitle,
      topic,
      difficulty,
      sourceCount: sources.length,
      sourceTitles: sources.map((s) => s.title),
      questions: shuffleAndFormatQuizQuestions(dynamicQuestions),
    };
    return { title: fallbackTitle, data: fallbackQuiz };
  } else if (type === "flashcard") {
    const sampleCards = [
      {
        id: "1",
        front: "Prinsip Grounding Berbasis Sumber",
        back: "Metode pemberian konteks dokumen rujukan ke dalam model AI agar setiap jawaban memiliki dasar fakta yang terverifikasi dan dapat ditelusuri sitasinya.",
        hint: "Jangkar fakta AI",
      },
      {
        id: "2",
        front: "Metode Pembelajaran Socratic",
        back: "Pendekatan dialogis di mana AI membimbing pengguna memahami konsep melalui pertanyaan mendalam dan analogi terstruktur, bukan sekadar memberikan jawaban langsung.",
        hint: "Tanya-jawab terbimbing",
      },
      {
        id: "3",
        front: "Penalaran Adaptif (Reasoning Effort)",
        back: "Kemampuan model AI mengalokasikan waktu berpikir ekstra untuk memecah masalah rumit menjadi langkah-langkah logis sebelum memformulasikan respons akhir.",
        hint: "Thinking process",
      },
    ];

    // Generate flashcards dynamically up to numItems
    const dynamicCards = [];
    for (let i = 0; i < numItems; i++) {
      const baseCard = sampleCards[i % sampleCards.length]!;
      dynamicCards.push({
        id: String(i + 1),
        front:
          i < sampleCards.length
            ? baseCard.front
            : `${baseCard.front} (Bagian ${Math.floor(i / sampleCards.length) + 1})`,
        back: baseCard.back,
        hint: baseCard.hint,
      });
    }

    const fallbackFlashcard: FlashcardData = {
      title: fallbackTitle,
      topic,
      difficulty,
      sourceCount: sources.length,
      sourceTitles: sources.map((s) => s.title),
      cards: dynamicCards,
    };
    return { title: fallbackTitle, data: fallbackFlashcard };
  }

  // Mind Map fallback
  const rootTitle = topic?.trim() || sources[0]?.title || (isIndo ? "Peta Pikiran" : "Mind Map");
  const children: MindMapNode[] = [];
  if (sources.length > 0) {
    sources.slice(0, 5).forEach((src, sIdx) => {
      children.push({
        id: `branch_${sIdx}`,
        label: src.title.slice(0, 26),
        children: [
          { id: `c_${sIdx}_1`, label: isIndo ? "Konsep Utama" : "Key Concepts" },
          { id: `c_${sIdx}_2`, label: isIndo ? "Rincian & Fakta" : "Details & Facts" },
          { id: `c_${sIdx}_3`, label: isIndo ? "Penerapan" : "Applications" },
        ],
      });
    });
  } else {
    children.push(
      {
        id: "b1",
        label: isIndo ? "Konsep Inti" : "Core Concepts",
        children: [
          { id: "b1_1", label: isIndo ? "Definisi & Ruang Lingkup" : "Definition & Scope" },
          { id: "b1_2", label: isIndo ? "Fokus Utama" : "Primary Focus" },
        ],
      },
      {
        id: "b2",
        label: isIndo ? "Analisis & Parameter" : "Analysis & Parameters",
        children: [
          { id: "b2_1", label: isIndo ? "Karakteristik Kunci" : "Key Characteristics" },
          { id: "b2_2", label: isIndo ? "Metrik Kinerja" : "Performance Metrics" },
        ],
      },
      {
        id: "b3",
        label: isIndo ? "Penerapan & Hasil" : "Applications & Results",
        children: [
          { id: "b3_1", label: isIndo ? "Temuan Utama" : "Key Findings" },
          { id: "b3_2", label: isIndo ? "Langkah Lanjutan" : "Next Steps" },
        ],
      }
    );
  }

  const fallbackMindMap: MindMapData = {
    id: `mindmap_${Date.now()}`,
    title: fallbackTitle,
    topic,
    root: { id: "root", label: rootTitle, children },
    sourceCount: sources.length,
    sourceTitles: sources.map((s) => s.title),
    sourceIds: sources.map((s) => s.id),
    sourceNames: sources.map((s) => s.title),
    prompt: topic,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  return { title: fallbackTitle, data: fallbackMindMap };
}

// ---------------------------------------------------------------------------
// Presentation Slides Generator for Mobile (Native Cloud Sandbox, Canva, Google Slides)
// ---------------------------------------------------------------------------

export interface GeneratePresentationOptions {
  artifactId?: string;
  learnId: string;
  sources: LocalSource[];
  provider: "native" | "canva" | "slides";
  lengthMode: "short" | "medium" | "long" | "auto";
  slideCount?: number;
  language?: "id" | "en";
  themeId?: "bold_dark" | "swiss_blue" | "sea_indigo" | "ash_lime" | string;
  customInstructions?: string;
}

export async function generatePresentationArtifact(
  options: GeneratePresentationOptions
): Promise<{ title: string; data: SlideDeckData }> {
  const {
    artifactId,
    learnId,
    sources,
    provider = "native",
    lengthMode = "auto",
    slideCount,
    language = "id",
    themeId = "bold_dark",
    customInstructions,
  } = options;

  const isIndo = language === "id";
  const primaryTitle = sources[0]?.title || (isIndo ? "Materi Belajar" : "Study Material");

  const sourceSnippets = sources
    .slice(0, 5)
    .map((s, idx) => {
      const rawContent =
        typeof s.content === "string"
          ? s.content
          : typeof s.content === "object" && s.content !== null
          ? JSON.stringify(s.content)
          : String(s.content || "");
      const content = rawContent.slice(0, 4000);
      return `### Sumber [${idx + 1}]: "${s.title}"\n${content}`;
    })
    .join("\n\n");

  // Determine slide count
  let targetCount = 6;
  if (slideCount && slideCount > 0) {
    targetCount = slideCount;
  } else if (lengthMode === "short") {
    targetCount = 4;
  } else if (lengthMode === "long") {
    targetCount = 10;
  } else if (lengthMode === "medium") {
    targetCount = 7;
  } else {
    targetCount = Math.min(8, Math.max(5, sources.length * 2));
  }

  // -------------------------------------------------------------------------
  // PROVIDER 1: CANVA (Canva MCP on Composio)
  // -------------------------------------------------------------------------
  if (provider === "canva") {
    const canvaLength: "short" | "balanced" | "comprehensive" =
      targetCount <= 5 ? "short" : targetCount <= 15 ? "balanced" : "comprehensive";

    const promptText = `Slide presentasi profesional tentang: "${primaryTitle}". Target: ${targetCount} slide. ${
      customInstructions ? `Instruksi: "${customInstructions}". ` : ""
    }Konteks: ${sourceSnippets.slice(0, 2000)}`;

    let canvaResult: any = null;
    try {
      const res = await executeCanvaMcp({
        prompt: promptText,
        slideCount: targetCount,
        length: canvaLength,
      });

      if (res && res.success) {
        canvaResult = {
          designId: res.designId,
          title: res.title || primaryTitle,
          pageCount: res.pageCount || targetCount,
          editUrl: res.editUrl,
          viewUrl: res.viewUrl,
          thumbnails: res.thumbnails || [],
        };
      }
    } catch (err) {
      console.warn("[Mobile Presentation] Canva MCP invocation error:", err);
    }

    const fallbackUrl = `https://www.canva.com/search?q=${encodeURIComponent(primaryTitle + " presentation")}`;
    const actualSlideCount = canvaResult?.pageCount || canvaResult?.thumbnails?.length || targetCount;

    // Build representation slide items so sheet/activity list displays real slide count
    const canvaSlides: SlideItem[] =
      canvaResult?.thumbnails && canvaResult.thumbnails.length > 0
        ? canvaResult.thumbnails.map((t: any, idx: number) => ({
            id: `canva_slide_${idx + 1}`,
            slideNumber: idx + 1,
            title: `Slide ${idx + 1}`,
            subtitle: canvaResult?.title || primaryTitle,
            layout: "hero" as const,
            speakerNotes: `Canva Slide #${idx + 1}`,
          }))
        : Array.from({ length: actualSlideCount }).map((_, idx) => ({
            id: `canva_slide_${idx + 1}`,
            slideNumber: idx + 1,
            title: `Slide ${idx + 1}`,
            subtitle: canvaResult?.title || primaryTitle,
            layout: "hero" as const,
            speakerNotes: `Canva Slide #${idx + 1}`,
          }));

    const deckData: SlideDeckData = {
      id: artifactId,
      learnId,
      title: canvaResult?.title || primaryTitle,
      provider: "canva",
      lengthMode,
      slideCount: actualSlideCount,
      language,
      themeId,
      sourceCount: sources.length,
      sourceTitles: sources.map((s) => s.title),
      slides: canvaSlides,
      canvaDesignId: canvaResult?.designId,
      canvaEditUrl: canvaResult?.editUrl || fallbackUrl,
      canvaViewUrl: canvaResult?.viewUrl || fallbackUrl,
      canvaThumbnails: canvaResult?.thumbnails || [],
      renderingStatus: "completed",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    return { title: deckData.title, data: deckData };
  }

  // -------------------------------------------------------------------------
  // PROVIDER 2: GOOGLE SLIDES & PROVIDER 3: NATIVE (Open-Design 1920x1080)
  // -------------------------------------------------------------------------
  const effectiveTheme = provider === "slides" ? "swiss_blue" : (themeId || "bold_dark");

  const systemPrompt = isIndo
    ? `Anda adalah Lead Presentation Designer dan Slide Architect profesional.
Tugas Anda adalah merancang Slide Presentasi kelas dunia (1920x1080 canvas deck) yang memukau, terstruktur, berbasis data riil dari materi sumber rujukan.

ATURAN DESAIN OPEN-DESIGN & HARNESS:
1. Target jumlah slide: TEPAT ${targetCount} slide.
2. Setiap slide memiliki satu fokus visual (visual hierarchy) yang tajam.
3. Gunakan ragam layout yang dinamis dan bervariasi:
   - "hero": Slide pembuka dengan judul tebal, kicker tag, dan 3 kartu intisari.
   - "metrics": Slide statistik & data kuantitatif dengan angka besar ("statHighlight" atau "numbers"), label, dan konteks.
   - "comparison": Slide komparasi/perbandingan ("comparisonDetails") dengan aspek kiri dan kanan yang seimbang.
   - "timeline": Slide alur proses, fase, atau arsitektur langkah demi langkah ("timelineSteps").
   - "bento-grid": Slide 3-4 kartu pilar ("bentoCards") dengan badge, judul, dan deskripsi.
   - "quote": Slide kutipan esensial ("quote") dengan text, author, context.
   - "takeaway": Slide penutup dengan bullet kesimpulan dan langkah aksi.
4. Tulis "speakerNotes" lengkap untuk setiap slide agar pembicara dapat menyampaikan materi dengan artikulatif dan percaya diri.
5. ZERO SITASI: JANGAN pernah menyertakan tag sitasi seperti [source:...] dalam teks slide atau speaker notes. Teks harus 100% bersih dan siap presentasi profesional.
6. MANDAT BAHASA: Tulis judul, isi slide, dan speaker notes dalam Bahasa Indonesia.
7. Output WAJIB berupa JSON murni sesuai format spesifikasi.`
    : `You are an elite Presentation Designer and Slide Architect.
Your task is to craft a world-class 1920x1080 slide presentation deck from the provided source materials.

OPEN-DESIGN SPECIFICATIONS:
1. Target slide count: EXACTLY ${targetCount} slides.
2. Distinct visual hierarchy for each slide.
3. Use rich, varied layouts across slides: "hero", "metrics", "comparison", "timeline", "bento-grid", "quote", "takeaway".
4. Include detailed "speakerNotes" for each slide.
5. NO CITATION TAGS: Do not include [source:...] tags in the output.
6. Language: Output 100% in English.
7. Return pure JSON only matching the schema.`;

  const userPrompt = `Materi Sumber Rujukan:\n${sourceSnippets || primaryTitle}\n\n${
    customInstructions ? `Instruksi Khusus: "${customInstructions}"\n` : ""
  }Target Jumlah Slide: TEPAT ${targetCount} slide.\nKeluarkan output JSON terstruktur ("title", "topic", "slides" dengan "slideNumber", "title", "subtitle", "layout", "kicker", "bullets", "bentoCards", "numbers", "statHighlight", "comparisonDetails", "timelineSteps", "speakerNotes").`;

  let parsedResponse: any = null;
  try {
    const routerBaseUrl = getRouterBaseUrl();
    const endpoint = `${routerBaseUrl}/chat/completions`;

    const authToken =
      (typeof localStorage !== "undefined" &&
        (localStorage.getItem("const_auth_token") ||
          localStorage.getItem("authToken") ||
          localStorage.getItem("token") ||
          localStorage.getItem("const_learn_auth_token") ||
          localStorage.getItem("const_sso_token"))) ||
      "";

    const apiKey =
      authToken ||
      (import.meta as any).env?.VITE_CONST_ROUTER_API_KEY ||
      (import.meta as any).env?.VITE_CONST_ENGINE_API_KEY ||
      "";

    const activeModel =
      (typeof localStorage !== "undefined" &&
        localStorage.getItem("const_learn_active_model")) ||
      "gemini-3.8-flash";

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: activeModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (response.ok) {
      const json = await response.json();
      const content = json.choices?.[0]?.message?.content;
      if (content) {
        parsedResponse = extractJson(content);
      }
    }
  } catch (err) {
    console.warn("[Mobile Presentation] Direct LLM completion error:", err);
  }

  const deckTitle = parsedResponse?.title || primaryTitle;
  const rawSlides: any[] = Array.isArray(parsedResponse?.slides) ? parsedResponse.slides : [];

  const slides: SlideItem[] =
    rawSlides.length > 0
      ? rawSlides.map((s, idx) => ({
          id: `slide_${idx + 1}`,
          slideNumber: s.slideNumber || idx + 1,
          title: s.title || `Slide ${idx + 1}`,
          subtitle: s.subtitle,
          layout: s.layout || (idx === 0 ? "hero" : "bullets"),
          kicker: s.kicker,
          bullets: Array.isArray(s.bullets) ? s.bullets : [],
          bentoCards: Array.isArray(s.bentoCards) ? s.bentoCards : undefined,
          numbers: Array.isArray(s.numbers) ? s.numbers : undefined,
          statHighlight: s.statHighlight,
          comparisonDetails: s.comparisonDetails,
          timelineSteps: Array.isArray(s.timelineSteps) ? s.timelineSteps : undefined,
          quote: s.quote,
          speakerNotes: s.speakerNotes,
          accentTag: s.accentTag,
        }))
      : [
          {
            id: "slide_1",
            slideNumber: 1,
            title: deckTitle,
            subtitle: isIndo ? "Ringkasan Eksekutif Materi" : "Executive Summary & Pillars",
            layout: "hero",
            kicker: "OVERVIEW",
            bullets: [
              isIndo ? "Konsep esensial materi rujukan" : "Essential reference concepts",
              isIndo ? "Struktur logika dan metodologi" : "Methodology and framework",
              isIndo ? "Hasil kunci dan kesimpulan" : "Key takeaways and insights",
            ],
            speakerNotes: isIndo
              ? "Slide pengantar materi pembelajaran."
              : "Introductory presentation slide.",
          },
          {
            id: "slide_2",
            slideNumber: 2,
            title: isIndo ? "Pilar Inti Pembahasan" : "Core Knowledge Pillars",
            subtitle: isIndo ? "Elemen dasar yang menopang konsep" : "Foundational elements",
            layout: "bento-grid",
            kicker: "KEY PILLARS",
            bentoCards: [
              { badge: "Pilar 1", title: isIndo ? "Konseptual" : "Conceptual", desc: isIndo ? "Definisi dan batasan konsep." : "Core definition and context." },
              { badge: "Pilar 2", title: isIndo ? "Analisis" : "Analysis", desc: isIndo ? "Analisis mekanisme kerja." : "Mechanism and evaluation." },
              { badge: "Pilar 3", title: isIndo ? "Penerapan" : "Execution", desc: isIndo ? "Langkah penerapan praktis." : "Practical execution steps." },
            ],
            speakerNotes: isIndo ? "Penjelasan tiga pilar utama materi." : "Overview of three core pillars.",
          },
          {
            id: "slide_3",
            slideNumber: 3,
            title: isIndo ? "Kesimpulan & Rekomendasi" : "Summary & Action Points",
            subtitle: isIndo ? "Poin kunci yang dapat segera diterapkan" : "Actionable next steps",
            layout: "takeaway",
            kicker: "SUMMARY",
            bullets: [
              isIndo ? "Pahami prinsip mula secara utuh" : "Understand core principles thoroughly",
              isIndo ? "Implementasikan solusi secara bertahap" : "Implement steps progressively",
              isIndo ? "Lakukan evaluasi berkala" : "Iterate with periodic evaluation",
            ],
            speakerNotes: isIndo ? "Kesimpulan penutup presentasi." : "Closing synthesis and takeaways.",
          },
        ];

  let slidesResult: any = null;
  if (provider === "slides") {
    const markdownDeck = `Theme: corporate_blue\n\n# ${deckTitle}\n\n${sourceSnippets.slice(0, 2500)}`;
    try {
      const res = await executeComposioTool("GOOGLESLIDES_CREATE_SLIDES_MARKDOWN", {
        title: deckTitle,
        markdown_text: markdownDeck,
      });
      if (res?.success && res.data) {
        const presId = res.data.presentation_id || res.data.presentationId || res.data.id;
        if (presId) {
          slidesResult = {
            id: presId,
            title: deckTitle,
            url: `https://docs.google.com/presentation/d/${presId}/edit`,
            embedUrl: `https://docs.google.com/presentation/d/${presId}/embed?start=false&loop=false&delayms=3000`,
          };
        }
      }
    } catch (err) {
      console.warn("[Mobile Presentation] Google Slides execution error:", err);
    }
  }

  const fallbackUrl = "https://docs.google.com/presentation/create";
  const deckData: SlideDeckData = {
    id: artifactId,
    learnId,
    title: deckTitle,
    topic: parsedResponse?.topic || primaryTitle,
    provider,
    lengthMode,
    slideCount: slides.length,
    language,
    themeId: effectiveTheme,
    sourceCount: sources.length,
    sourceTitles: sources.map((s) => s.title),
    slides,
    googleSlidesId: slidesResult?.id,
    googleSlidesUrl: slidesResult?.url || (provider === "slides" ? fallbackUrl : undefined),
    googleSlidesEmbedUrl: slidesResult?.embedUrl,
    renderingStatus: "completed",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const htmlContent = buildPresentationHtml(deckData);
  deckData.htmlContent = htmlContent;

  // Mobile: Cloud Sandbox execution to render PDF via Composio CodeInterpreter (for native)
  if (artifactId && provider === "native") {
    (async () => {
      try {
        const sandboxRes = await renderPresentationPdfInSandbox({ htmlContent });
        if (sandboxRes?.success && sandboxRes.pdfBase64) {
          const pdfDataUrl = `data:application/pdf;base64,${sandboxRes.pdfBase64}`;
          const existingArt = await localDb.getArtifact(artifactId);
          if (existingArt) {
            const updatedData: SlideDeckData = {
              ...(existingArt.data as SlideDeckData),
              pdfUrl: pdfDataUrl,
              updatedAt: Date.now(),
            };
            await localDb.updateArtifact(artifactId, {
              data: updatedData,
              content: JSON.stringify(updatedData),
            });
          }
        }
      } catch (sandboxErr) {
        console.warn("[Mobile Presentation] Sandbox PDF background render error:", sandboxErr);
      }
    })();
  }

  return { title: deckData.title, data: deckData };
}

export interface GenerateInfographicOptions {
  artifactId?: string;
  learnId: string;
  sources: LocalSource[];
  language?: "id" | "en";
  orientation: "landscape" | "portrait" | "square";
  style: string;
  detailLevel: "brief" | "standard" | "detailed";
  customDescription?: string;
  providerId?: string;
  modelId?: string;
}

const INFOGRAPHIC_STYLE_DESCRIPTORS: Record<string, { labelId: string; labelEn: string; promptDesc: string }> = {
  auto: {
    labelId: "Pilih otomatis",
    labelEn: "Auto select",
    promptDesc: "Modern, clean, highly informative visual infographic with structured data visualization cards, elegant layout, balanced hierarchy, and sharp typography.",
  },
  kawaii: {
    labelId: "Kawaii",
    labelEn: "Kawaii",
    promptDesc: "Adorable Japanese kawaii aesthetic, cute rounded mascot characters with joyful expressions, pastel rainbow color palette, playful sparkle stars, and charming educational badges.",
  },
  clay: {
    labelId: "Tanah liat",
    labelEn: "Claymation",
    promptDesc: "Tactile plasticine claymation art style, handcrafted 3D colorful clay figures, miniature sculpted scene, soft studio clay lighting, subtle matte clay textures, stop-motion animation feel.",
  },
  sketch_notes: {
    labelId: "Catatan Sketsa",
    labelEn: "Sketch Notes",
    promptDesc: "Architectural sketchnotes, hand-drawn ink line art, clean notebook doodle annotations, black and white technical diagram style with clean cross-hatching and callout arrows.",
  },
  anime: {
    labelId: "Anime",
    labelEn: "Anime",
    promptDesc: "Vibrant Japanese anime dynamic keyframe art style, cinematic high-energy composition, glowing neon accents, sharp mecha lines, dramatic perspective and colorful cel-shading.",
  },
  editorial: {
    labelId: "Editorial",
    labelEn: "Editorial",
    promptDesc: "High-end Swiss modernist graphic design, bold minimalist grid composition, elegant editorial magazine poster layout, refined color blocking, sophisticated graphic layout.",
  },
  vector: {
    labelId: "Minimalis Vektor",
    labelEn: "Vector Minimalist",
    promptDesc: "Crisp flat minimalist vector infographic art, clean geometric iconography, smooth subtle gradients, modern tech diagram aesthetic, precise lines and clean cards.",
  },
  "3d_photorealistic": {
    labelId: "Fotorealistik 3D",
    labelEn: "3D Photorealistic",
    promptDesc: "Photorealistic 3D Octane render, cinematic studio lighting, detailed realistic textures, volumetric light rays, polished materials and depth of field.",
  },
  retro_comic: {
    labelId: "Komik Retro",
    labelEn: "Retro Comic",
    promptDesc: "Classic vintage comic book pop-art style, bold halftone dots, dynamic action paneling, Roy Lichtenstein inspired retro print aesthetic with bold ink outlines.",
  },
};

export async function generateInfographicArtifact(
  options: GenerateInfographicOptions
): Promise<{ title: string; data: InfographicData }> {
  const {
    artifactId,
    learnId,
    sources = [],
    language = "id",
    orientation = "landscape",
    style = "auto",
    detailLevel = "standard",
    customDescription = "",
    providerId,
    modelId,
  } = options;

  const isIndo = language === "id";
  const primaryTitle = sources[0]?.title || (isIndo ? "Infografis Materi" : "Study Infographic");

  const dimensions =
    orientation === "portrait"
      ? { width: 1024, height: 1792 }
      : orientation === "square"
      ? { width: 1024, height: 1024 }
      : { width: 1792, height: 1024 };

  const sizeStr = `${dimensions.width}x${dimensions.height}`;

  const styleMeta = INFOGRAPHIC_STYLE_DESCRIPTORS[style] || INFOGRAPHIC_STYLE_DESCRIPTORS["auto"] || {
    labelId: "Pilih otomatis",
    labelEn: "Auto select",
    promptDesc: "Modern, clean, highly informative visual infographic with structured data visualization cards, elegant layout, balanced hierarchy, and sharp typography.",
  };
  const styleLabel = isIndo ? styleMeta.labelId : styleMeta.labelEn;

  const sourceSnippets = sources
    .map(
      (s, idx) =>
        `--- SUMBER [${idx + 1}]: "${s.title || "Untitled"}" ---\n${(s.content || "").slice(0, 3500)}`
    )
    .join("\n\n");

  const detailGuideline =
    detailLevel === "brief"
      ? "Focus on high-level executive essence, 3 key takeaways, and a bold clean visual focus."
      : detailLevel === "detailed"
      ? "Comprehensive data density: detail 5-7 core points, structured sections, multi-dimensional visual layout."
      : "Standard balanced depth: 4-5 well-structured insights, clear visual hierarchy and clean callout highlights.";

  const systemPrompt = isIndo
    ? `Anda adalah Art Director & Visual Content Strategist ahli untuk Const Learn.
Tugas Anda adalah membaca materi sumber belajar dan merancang Infografis visual yang memukau, akurat, dan edukatif.
Anda harus mengembalikan HANYA sebuah objek JSON dengan struktur:
{
  "title": "Judul infografis yang menarik dan informatif",
  "summary": "Ringkasan intisari materi 2-3 kalimat",
  "keyPoints": ["Poin kunci 1", "Poin kunci 2", "Poin kunci 3", "Poin kunci 4"],
  "visualPrompt": "Prompt bahasa Inggris yang sangat deskriptif dan detail untuk image generation model (Flux / SDXL / DALL-E) yang menggambarkan seluruh komposisi infografis, palet warna, elemen grafis, diagram/karakter, dan teks visual yang rapi sesuai gaya yang dipilih."
}
Aturan Penting untuk "visualPrompt":
- WAJIB dalam bahasa Inggris agar kualitas generasi gambar maksimal.
- Gaya visual yang dipilih: ${styleMeta.promptDesc}
- Orientasi kanvas: ${orientation} (${dimensions.width}x${dimensions.height} aspect ratio).
- Instruksi detail: ${detailGuideline}
${customDescription ? `- Permintaan khusus pengguna: "${customDescription}"` : ""}
- Jangan sertakan teks lorem ipsum acak. Pastikan prompt meminta tipografi yang tajam dan elemen data/kartu yang tertata rapi.
Output HANYA JSON valid tanpa teks pendahuluan.`
    : `You are an expert Art Director and Visual Content Strategist for Const Learn.
Your task is to analyze study sources and design a stunning, informative, visually rich Infographic.
Return ONLY a valid JSON object matching:
{
  "title": "Engaging, concise title for the infographic",
  "summary": "2-3 sentence executive summary of the core concepts",
  "keyPoints": ["Key takeaway 1", "Key takeaway 2", "Key takeaway 3", "Key takeaway 4"],
  "visualPrompt": "A highly detailed English prompt for an AI image generator (Flux / SDXL / DALL-E) describing the visual layout, infographic cards, diagrams, colors, illustration style, and crisp composition."
}
Crucial rules for "visualPrompt":
- MUST be in English for optimal image generation fidelity.
- Target visual style: ${styleMeta.promptDesc}
- Canvas orientation: ${orientation} (${dimensions.width}x${dimensions.height} aspect ratio).
- Detail guideline: ${detailGuideline}
${customDescription ? `- User specific styling / focus: "${customDescription}"` : ""}
- Pure valid JSON only with no markdown wrapping or preamble.`;

  const userPrompt = `Materi Sumber Belajar:\n${sourceSnippets || "Topik: " + primaryTitle}\n\n` +
    (customDescription ? `Fokus / Deskripsi Tambahan: ${customDescription}\n\n` : "") +
    `Gaya visual: ${styleLabel}\nOrientasi: ${orientation}\nTingkat detail: ${detailLevel}\n\n` +
    `Silakan rancang infografis dan kembalikan JSON valid.`;

  let parsedSynthesis: {
    title?: string;
    summary?: string;
    keyPoints?: string[];
    visualPrompt?: string;
  } | null = null;

  try {
    const baseUrl = getRouterBaseUrl();
    const endpoint = baseUrl.endsWith("/chat/completions")
      ? baseUrl
      : `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

    const authToken =
      (typeof localStorage !== "undefined" &&
        (localStorage.getItem("const_learn_auth_token") ||
          localStorage.getItem("const_sso_token"))) ||
      "";

    const apiKey =
      authToken ||
      (import.meta as any).env?.VITE_CONST_ROUTER_API_KEY ||
      (import.meta as any).env?.VITE_CONST_ENGINE_API_KEY ||
      "";

    const activeModel =
      (typeof localStorage !== "undefined" &&
        localStorage.getItem("const_learn_active_model")) ||
      "gemini-3.8-flash";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: activeModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        stream: false,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (response.ok) {
      const json = await response.json();
      const content = json.choices?.[0]?.message?.content;
      if (content) {
        parsedSynthesis = extractJson(content);
      }
    }
  } catch (httpErr) {
    console.warn("[Mobile Infographic] HTTP router synthesis error:", httpErr);
  }

  const infoTitle = parsedSynthesis?.title || (isIndo ? `Infografis: ${primaryTitle}` : `Infographic: ${primaryTitle}`);
  const summary = parsedSynthesis?.summary || (isIndo ? "Visualisasi rangkuman materi pembelajaran terstruktur." : "Structured visual summary of study material.");
  const keyPoints = Array.isArray(parsedSynthesis?.keyPoints) && parsedSynthesis.keyPoints.length > 0
    ? parsedSynthesis.keyPoints
    : [
        isIndo ? "Intisari konsep utama materi" : "Core concept key takeaways",
        isIndo ? "Visualisasi komprehensif & terarah" : "Comprehensive targeted visualization",
        isIndo ? "Analisis mendalam poin penting" : "In-depth breakdown of essential points",
      ];

  const visualPrompt = parsedSynthesis?.visualPrompt ||
    `High-resolution infographic poster about ${primaryTitle}, ${styleMeta.promptDesc}, ${detailGuideline}, clean layout, sharp focus, professional graphic design, 8k resolution.`;

  const imageConfig = getStoredImageConfig();
  let resolvedProvider: ImageProvider | null = null;
  let resolvedModelId: string = "";

  if (providerId) {
    resolvedProvider = imageConfig.providers.find((p) => p.id === providerId) || null;
  }
  if (!resolvedProvider) {
    const active = getActiveImageModel();
    resolvedProvider = active.provider;
    resolvedModelId = active.model?.id || "";
  }

  if (modelId) {
    resolvedModelId = modelId;
  } else if (!resolvedModelId && resolvedProvider) {
    resolvedModelId = resolvedProvider.models[0]?.id || "";
  }

  if (!resolvedProvider) {
    throw new Error(
      isIndo
        ? "Belum ada Provider Model Gambar yang dikonfigurasi. Silakan buka Pengaturan > Model > Image."
        : "No Image Provider configured. Please configure an Image Provider in Settings > Models > Image."
    );
  }

  if (!resolvedModelId) {
    throw new Error(
      isIndo
        ? `Provider "${resolvedProvider.name}" belum memiliki Model ID. Silakan tambahkan model di Pengaturan > Model > Image.`
        : `Provider "${resolvedProvider.name}" has no Model ID. Please add a model in Settings > Models > Image.`
    );
  }

  const imgResult = await generateImage({
    prompt: visualPrompt,
    provider: resolvedProvider,
    modelId: resolvedModelId,
    size: sizeStr,
    timeoutMs: 90000,
  });

  if (!imgResult.success || !imgResult.imageUrl) {
    throw new Error(
      imgResult.error || (isIndo ? "Gagal menghasilkan gambar infografis." : "Failed to generate infographic image.")
    );
  }

  const infographicData: InfographicData = {
    id: artifactId || `info_${Date.now()}`,
    learnId,
    title: infoTitle,
    topic: primaryTitle,
    imageUrl: imgResult.imageUrl,
    prompt: customDescription || visualPrompt,
    visualPrompt,
    orientation,
    style,
    styleLabel,
    detailLevel,
    language,
    summary,
    keyPoints,
    dimensions,
    sourceCount: sources.length,
    sourceTitles: sources.map((s) => s.title),
    sourceIds: sources.map((s) => s.id),
    modelUsed: resolvedModelId,
    providerUsed: resolvedProvider.name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return {
    title: infographicData.title,
    data: infographicData,
  };
}

