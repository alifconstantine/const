import type { LocalSource, QuizData, FlashcardData, MindMapData, MindMapNode } from "../db";
import { getRouterBaseUrl } from "../ai-stream";

export interface GenerateStudioArtifactOptions {
  type: "quiz" | "flashcard" | "mind_map";
  learnId: string;
  topic?: string;
  difficulty?: "easy" | "medium" | "hard";
  count?: number;
  sources: LocalSource[];
  language?: "id" | "en";
}

function extractJson(text: string): any {
  if (!text) return null;
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
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
  sources,
  language = "id",
}: GenerateStudioArtifactOptions): Promise<{
  title: string;
  data: QuizData | FlashcardData | MindMapData;
}> {
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
  } else {
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
   - Label simpul ringkas dan padat (2 sampai 6 kata).
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
2. Hierarchy Guidelines:
   - Root has 4 to 6 main Level 1 branches.
   - Each Level 1 branch has 2 to 4 Level 2 children.
   - Concise node labels (2 to 6 words max).
   - Unique alphanumeric IDs for each node.
3. Language: English.
4. STRICT: Pure JSON only without markdown or introductory text.`;

    userPrompt = `Materi Sumber Belajar:\n${sourceSnippets || "Topik: " + (topic || "Pengetahuan Umum")}\n\n` +
      (topic ? `Fokus Topik Spesifik / Instruksi: ${topic}\n\n` : "") +
      `Silakan buatkan Peta Pikiran hierarkis dalam format JSON yang valid.`;
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
    const timeoutId = setTimeout(() => controller.abort(), 35000);

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
          }
        }
      }
    }
  } catch (err) {
    console.warn("API call to Const Router failed in mobile, using fallback:", err);
  }

  // Graceful offline/fallback generator
  const fallbackTitle = topic
    ? (type === "quiz" ? `AI Kuis: ${topic}` : type === "flashcard" ? `Flashcard: ${topic}` : `Peta Pikiran: ${topic}`)
    : sources.length > 0
    ? (type === "quiz" ? `AI Kuis: ${sources[0]!.title}` : type === "flashcard" ? `Flashcard: ${sources[0]!.title}` : `Peta Pikiran: ${sources[0]!.title}`)
    : type === "quiz" ? "AI Kuis Mandiri" : type === "flashcard" ? "Flashcard Mandiri" : "Peta Pikiran Mandiri";

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
  } else {
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
