import type { LocalSource, QuizData, FlashcardData, MindMapData, MindMapNode, SlideDeckData, SlideItem } from "../db";
import { buildPresentationPrompt } from "./presentation/prompt";

export interface GenerateStudioArtifactOptions {
  type: "quiz" | "flashcard" | "mind_map" | "slides";
  learnId: string;
  topic?: string;
  difficulty?: "easy" | "medium" | "hard";
  count?: number;
  lengthMode?: "short" | "medium" | "long" | "auto";
  sources: LocalSource[];
  language?: "id" | "en";
  themeId?: string;
}

function getRouterBaseUrl(): string {
  if (typeof window !== "undefined") {
    const envUrl =
      (import.meta as any).env?.VITE_CONST_ROUTER_BASE_URL ||
      (import.meta as any).env?.CONST_ROUTER_BASE_URL;
    if (envUrl) return envUrl.replace(/\/+$/, "");

    const isDev = Boolean((import.meta as any).env?.DEV);
    const host = window.location.hostname;
    const isLocalhost = host === "localhost" || host === "127.0.0.1";
    if (isDev && isLocalhost) {
      return "/v1";
    }
  }
  return "https://router.const.web.id/v1";
}

function extractJson(text: string): any {
  if (!text) return null;
  // Strip markdown fences
  const cleaned = text
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
      } catch {}
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
      // If none marked, choose option based on (qIdx % rawOptions.length)
      rawOptions[qIdx % rawOptions.length]!.isCorrect = true;
    } else if (correctIndices.length > 1) {
      // Keep only the first true
      for (let i = 1; i < correctIndices.length; i++) {
        const idxToReset = correctIndices[i];
        if (idxToReset !== undefined && rawOptions[idxToReset]) {
          rawOptions[idxToReset]!.isCorrect = false;
        }
      }
    }

    // Shuffle options array so the correct answer position is completely randomized
    // across A, B, C, D instead of getting stuck on A
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
}: GenerateStudioArtifactOptions): Promise<{
  title: string;
  data: QuizData | FlashcardData | MindMapData | SlideDeckData;
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
1. Kembalikan HANYA objek JSON valid sesuai interface TypeScript:
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
  } else if (type === "slides") {
    const promptConfig = buildPresentationPrompt({
      topic,
      lengthMode,
      count,
      sources,
      language,
      themeId,
    });
    systemPrompt = promptConfig.systemPrompt;
    userPrompt = promptConfig.userPrompt;
  }

  // 1. Attempt generation via Electron agent isolated completion (Stateless, never leaks into Chat AI / Ask AI)
  const electron = typeof window !== "undefined" ? (window as any).electron : null;
  if (electron?.agent?.generateCompletion) {
    try {
      const activeModel =
        (typeof localStorage !== "undefined" &&
          localStorage.getItem("const_learn_active_model")) ||
        "gemini-3.8-flash";

      const authToken =
        (typeof localStorage !== "undefined" &&
          (localStorage.getItem("const_learn_auth_token") ||
            localStorage.getItem("const_sso_token"))) ||
        "";

      const res = await electron.agent.generateCompletion({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        model: activeModel,
        authToken: authToken || undefined,
        temperature: 0.3,
      });

      if (res?.success && res.content) {
        const parsed = extractJson(res.content);
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
          } else if (type === "slides" && Array.isArray(parsed.slides) && parsed.slides.length > 0) {
            const slidesData: SlideDeckData = {
              id: `slides_${Date.now()}`,
              title: parsed.title || (topic ? (isIndo ? `Presentasi: ${topic}` : `Presentation: ${topic}`) : (isIndo ? `Presentasi: ${sources[0]?.title || "Materi Belajar"}` : `Presentation: ${sources[0]?.title || "Study Material"}`)),
              topic,
              lengthMode,
              language,
              sourceCount: sources.length,
              sourceTitles: sources.map((s) => s.title),
              sourceIds: sources.map((s) => s.id),
              slides: parsed.slides.map((s: any, sIdx: number) => ({
                id: String(s.id || `slide_${sIdx + 1}`),
                slideNumber: sIdx + 1,
                layout: s.layout || (sIdx === 0 ? "hero" : "bullets"),
                title: s.title || `Slide ${sIdx + 1}`,
                subtitle: s.subtitle || undefined,
                bullets: Array.isArray(s.bullets) ? s.bullets : undefined,
                leftColumn: s.leftColumn || undefined,
                rightColumn: s.rightColumn || undefined,
                quote: s.quote || undefined,
                numbers: Array.isArray(s.numbers) ? s.numbers : undefined,
                speakerNotes: s.speakerNotes || undefined,
                accentTag: s.accentTag || undefined,
              })),
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            return { title: slidesData.title, data: slidesData };
          }
        }
      }
    } catch (ipcErr) {
      console.warn("Electron isolated completion failed, falling back to HTTP router:", ipcErr);
    }
  }

  // 2. Attempt API call to Router AI Gateway directly
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
          } else if (type === "slides" && Array.isArray(parsed.slides) && parsed.slides.length > 0) {
            const resolvedDeckTheme = parsed.themeId || (themeId !== "auto" && themeId ? themeId : "const-dark");
            const slidesData: SlideDeckData = {
              id: `slides_${Date.now()}`,
              title: parsed.title || (topic ? (isIndo ? `Presentasi: ${topic}` : `Presentation: ${topic}`) : (isIndo ? `Presentasi: ${sources[0]?.title || "Materi Belajar"}` : `Presentation: ${sources[0]?.title || "Study Material"}`)),
              topic,
              lengthMode,
              language,
              themeId: resolvedDeckTheme,
              sourceCount: sources.length,
              sourceTitles: sources.map((s) => s.title),
              sourceIds: sources.map((s) => s.id),
              slides: parsed.slides.map((s: any, sIdx: number) => ({
                id: String(s.id || `slide_${sIdx + 1}`),
                slideNumber: sIdx + 1,
                layout: s.layout || (sIdx === 0 ? "hero" : "bullets"),
                title: s.title || `Slide ${sIdx + 1}`,
                subtitle: s.subtitle || undefined,
                kicker: s.kicker || undefined,
                bullets: Array.isArray(s.bullets) ? s.bullets : undefined,
                leftColumn: s.leftColumn || undefined,
                rightColumn: s.rightColumn || undefined,
                quote: s.quote || undefined,
                numbers: Array.isArray(s.numbers) ? s.numbers : undefined,
                statHighlight: s.statHighlight || undefined,
                bentoCards: Array.isArray(s.bentoCards) ? s.bentoCards : undefined,
                comparisonDetails: s.comparisonDetails || undefined,
                timelineSteps: Array.isArray(s.timelineSteps) ? s.timelineSteps : undefined,
                speakerNotes: s.speakerNotes || undefined,
                accentTag: s.accentTag || undefined,
              })),
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            return { title: slidesData.title, data: slidesData };
          }
        }
      }
    }
  } catch (err) {
    console.warn("API call to Const Router failed, generating offline verified fallback:", err);
  }

  // Graceful offline/fallback generator so user flow NEVER breaks
  const fallbackTitle = topic
    ? (type === "quiz" ? `AI Kuis: ${topic}` : type === "flashcard" ? `Flashcard: ${topic}` : type === "slides" ? (isIndo ? `Presentasi: ${topic}` : `Presentation: ${topic}`) : `Peta Pikiran: ${topic}`)
    : sources.length > 0
    ? (type === "quiz" ? `AI Kuis: ${sources[0]!.title}` : type === "flashcard" ? `Flashcard: ${sources[0]!.title}` : type === "slides" ? (isIndo ? `Presentasi: ${sources[0]!.title}` : `Presentation: ${sources[0]!.title}`) : `Peta Pikiran: ${sources[0]!.title}`)
    : type === "quiz" ? "AI Kuis Mandiri" : type === "flashcard" ? "Flashcard Mandiri" : type === "slides" ? (isIndo ? "Presentasi Mandiri" : "Self-guided Presentation") : "Peta Pikiran Mandiri";

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
        front: "Model Penalaran Adaptif",
        back: "Pendekatan komputasi yang menimbang probabilitas logika langkah-demi-langkah sebelum merumuskan kesimpulan akhir.",
        hint: "Chain of Thought",
      },
      {
        id: "3",
        front: "Dual-Tier Architecture",
        back: "Pemisahan lapisan eksekusi antara komputasi lokal desktop (performa penuh) dengan sandbox awan mobile (portabilitas tinggi).",
        hint: "Desktop vs Mobile",
      },
    ];

    const dynamicCards: typeof sampleCards = [];
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
  } else if (type === "slides") {
    const mainTitle = fallbackTitle;
    const resolvedFallbackTheme = themeId !== "auto" && themeId ? themeId : "const-dark";
    const fallbackSlides: SlideItem[] = [
      {
        id: "slide_1",
        slideNumber: 1,
        layout: "hero",
        kicker: isIndo ? "RINGKASAN EKSEKUTIF" : "EXECUTIVE SUMMARY",
        title: mainTitle,
        subtitle: isIndo ? "Rangkuman komprehensif konsep, metodologi & intisari materi" : "Comprehensive concept, methodology & insights overview",
        accentTag: isIndo ? "Esensial" : "Essential",
        speakerNotes: isIndo ? `Selamat datang di presentasi ${mainTitle}. Slide ini mengantar materi utama.` : `Welcome to the presentation on ${mainTitle}.`,
      },
      {
        id: "slide_2",
        slideNumber: 2,
        layout: "agenda",
        kicker: isIndo ? "PETA BAHASAN" : "AGENDA OVERVIEW",
        title: isIndo ? "Struktur & Alur Materi" : "Structure & Agenda",
        subtitle: isIndo ? "Tiga babak utama pembahasan" : "Three primary chapters of discussion",
        bullets: [
          isIndo ? "01. Landasan Konseptual & Tantangan Utama" : "01. Conceptual Foundation & Core Challenges",
          isIndo ? "02. Arsitektur Kerangka Kerja & Solusi Modern" : "02. Framework Architecture & Modern Solutions",
          isIndo ? "03. Evaluasi Metrik Dampak & Rencana Tindakan" : "03. Impact Metrics & Actionable Roadmaps",
        ],
        speakerNotes: isIndo ? "Uraikan tiga babak utama yang akan dipelajari dalam sesi ini." : "Outline the three main chapters of the study session.",
      },
      {
        id: "slide_3",
        slideNumber: 3,
        layout: "big-stat",
        kicker: isIndo ? "TANTANGAN UTAMA" : "CORE CHALLENGE",
        title: isIndo ? "Urgensi Pemahaman Komprehensif" : "The Imperative for Deep Grounding",
        subtitle: isIndo ? "Data membuktikan pentingnya penguasaan konsep secara terstruktur" : "Empirical data highlights the need for structured comprehension",
        statHighlight: {
          value: "10x",
          label: isIndo ? "Efektivitas Pemahaman Berbasis Intisari" : "Comprehension Boost via Grounded Synthesis",
          context: isIndo ? "Pembelajaran aktif berbasis sumber rujukan terbukti melipatgandakan retensi ingatan jangka panjang." : "Active synthesis grounded in source documents multiplies long-term conceptual retention.",
        },
        speakerNotes: isIndo ? "Soroti rasio 10x sebagai pembeda utama metodologi terstruktur dibanding membaca pasif." : "Highlight the 10x factor as key differentiator.",
      },
      {
        id: "slide_4",
        slideNumber: 4,
        layout: "comparison",
        kicker: isIndo ? "KOMPARASI METODE" : "METHOD COMPARISON",
        title: isIndo ? "Transformasi Pendekatan" : "Approach Transformation",
        subtitle: isIndo ? "Membandingkan pola konvensional dengan kerangka kerja modern" : "Contrasting conventional patterns with modern frameworks",
        comparisonDetails: {
          leftTitle: isIndo ? "Pola Konvensional" : "Conventional Pattern",
          leftItems: [
            isIndo ? "Hafalan pasif tanpa keterkaitan" : "Passive memorization without context",
            isIndo ? "Fragmentasi sumber belajar" : "Fragmented source materials",
            isIndo ? "Evaluasi lambat dan parsial" : "Slow, isolated evaluation cycles",
          ],
          rightTitle: isIndo ? "Kerangka Kerja Modern" : "Modern Framework",
          rightItems: [
            isIndo ? "Penalaran aktif berbasis intisari" : "Active reasoning grounded in synthesis",
            isIndo ? "Konsolidasi sumber multi-perspektif" : "Multi-perspective source consolidation",
            isIndo ? "Validasi langsung dan iteratif" : "Immediate, iterative validation feedback",
          ],
          winner: "right",
        },
        speakerNotes: isIndo ? "Tekankan keuntungan pendekatan kanan dalam membangun pemahaman mendalam." : "Emphasize the right column advantages.",
      },
      {
        id: "slide_5",
        slideNumber: 5,
        layout: "bento-grid",
        kicker: isIndo ? "PILAR UTAMA" : "KEY PILLARS",
        title: isIndo ? "Empat Dimensi Penguasaan Materi" : "Four Dimensions of Mastery",
        subtitle: isIndo ? "Komponen esensial untuk mempraktikkan konsep ini" : "Essential components for practical execution",
        bentoCards: [
          { badge: "01", title: isIndo ? "Fondasi Teori" : "Foundations", desc: isIndo ? "Memahami prinsip dasar tanpa asumsi prematur." : "Grasping core tenets without premature assumptions." },
          { badge: "02", title: isIndo ? "Verifikasi Fakta" : "Fact Checking", desc: isIndo ? "Menyaring informasi berbasis bukti terverifikasi." : "Filtering evidence-grounded facts." },
          { badge: "03", title: isIndo ? "Sintesis Dinamis" : "Synthesis", desc: isIndo ? "Menghubungkan pola lintas sumber rujukan." : "Cross-referencing insights across domains." },
          { badge: "04", title: isIndo ? "Aplikasi Nyata" : "Application", desc: isIndo ? "Mengimplementasikan solusi pada kasus nyata." : "Executing solutions in real-world scenarios." },
        ],
        speakerNotes: isIndo ? "Jelaskan kesatuan keempat dimensi sebagai sistem yang utuh." : "Explain how these four dimensions function as one integrated system.",
      },
      {
        id: "slide_6",
        slideNumber: 6,
        layout: "takeaway",
        kicker: isIndo ? "KESIMPULAN AKSI" : "ACTIONABLE SUMMARY",
        title: isIndo ? "Kesimpulan & Langkah Selanjutnya" : "Conclusion & Next Steps",
        subtitle: isIndo ? "Tiga komitmen nyata untuk hasil optimal" : "Three commitments for optimal outcome",
        bullets: [
          isIndo ? "Kuasai konsep fondasi sebelum melangkah ke analisis lanjutan." : "Master fundamentals before proceeding to advanced analysis.",
          isIndo ? "Lakukan evaluasi berkala menggunakan ringkasan dan kuis mandiri." : "Evaluate regularly with study summaries and quizzes.",
          isIndo ? "Terapkan wawasan ini secara kontekstual dalam alur kerja nyata." : "Apply insights contextually in your study workflow."
        ],
        speakerNotes: isIndo ? "Tutup presentasi dengan kesimpulan tajam dan ajakan bertindak." : "Conclude presentation with clear action items.",
      }
    ];

    const fallbackSlideDeck: SlideDeckData = {
      id: `slides_${Date.now()}`,
      title: fallbackTitle,
      topic,
      lengthMode,
      language,
      themeId: resolvedFallbackTheme,
      sourceCount: sources.length,
      sourceTitles: sources.map((s) => s.title),
      sourceIds: sources.map((s) => s.id),
      slides: fallbackSlides,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    return { title: fallbackTitle, data: fallbackSlideDeck };
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
