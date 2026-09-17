import type { LocalSource } from "../../db";
import { PRESENTATION_THEMES } from "./themes";

export interface BuildPresentationPromptOptions {
  topic?: string;
  lengthMode?: "short" | "medium" | "long" | "auto";
  count?: number;
  sources: LocalSource[];
  language?: "id" | "en";
  themeId?: string;
}

export function buildPresentationPrompt(options: BuildPresentationPromptOptions): {
  systemPrompt: string;
  userPrompt: string;
  resolvedThemeId: string;
} {
  const {
    topic,
    lengthMode = "auto",
    count = 8,
    sources,
    language = "id",
    themeId = "auto",
  } = options;

  const isIndo = language === "id";

  const targetSlideCount =
    lengthMode === "short"
      ? 5
      : lengthMode === "long"
      ? 12
      : lengthMode === "medium"
      ? 8
      : Math.max(5, Math.min(16, count || 8));

  // Determine theme or let AI choose if 'auto'
  let resolvedThemeId = themeId;
  if (resolvedThemeId === "auto" || !resolvedThemeId) {
    resolvedThemeId = "const-dark";
  }

  // Aggregate source texts
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

  const themesCatalog = PRESENTATION_THEMES.map(
    (t) => `- "${t.id}": ${t.name} (${t.description})`
  ).join("\n");

  const systemPrompt = isIndo
    ? `Anda adalah arsitek dek presentasi (PPT) kelas dunia untuk Const Learn, berstandar "Anti-AI-Slop" (terinspirasi dari Guizang Editorial, Swiss International Grid, dan Humanize PPT).
Tugas Anda adalah merangkum materi studi menjadi dek presentasi profesional yang memukau, berirama visual dinamis, dan memiliki alur naratif yang kuat.

DOKTRIN DESAIN & ATURAN MUTLAK (ANTI-AI-SLOP):
1. ALUR NARATIF PERSUASIF (6-Role Narrative Arc):
   Dek slide TIDAK BOLEH menjadi kumpulan daftar poin monoton! Dek harus memiliki ritme dramatis:
   - Slide 1: Cover / "hero" (Tajuk menohok, kicker kategori, subtitel ringkas).
   - Slide 2: Agenda / "agenda" atau Konteks Latar Belakang (3-4 pilar bahasan bernomor 01, 02, 03).
   - Slide 3: Masalah / "big-stat" (1 angka metrik/fakta mencengangkan sebagai pembuka urgensi masalah).
   - Slide 4: Perbandingan / "comparison" (Before vs After, Konsep Konvensional vs Modern, atau Dilema).
   - Slide 5: Arsitektur / "bento-grid" (4 kartu kuadran modular solusi inti dengan badge A, B, C, D atau 01-04).
   - Slide 6: Penerapan / "timeline" (3-4 langkah proses bertahap linear bernomor).
   - Slide 7: Prinsip Kunci / "quote" (Kutipan pernyataan inti atau tesis utama materi dengan atribusi jelas).
   - Slide 8: Kesimpulan Aksi / "takeaway" (Rangkuman eksekutif dan rekomendasi tindakan nyata).
   (Sesuaikan alur jika jumlah slide ${targetSlideCount} slide, pastikan ada variasi layout dan tidak ada 2 slide berurutan dengan layout sama).

2. RAGAM LAYOUT YANG WAJIB DIGUNAKAN (Gunakan properti spesifik per layout):
   - "hero": Judul besar, "kicker" (kategori uppercase), "subtitle", "accentTag".
   - "agenda": Poin agenda bernomor rapi ("bullets": ["01. ...", "02. ...", "03. ..."]).
   - "big-stat": "statHighlight": { "value": "Angka/Persen", "label": "Label Singkat", "context": "Penjelasan konteks 1 kalimat" }.
   - "bento-grid": "bentoCards": 4 item [{ "badge": "01", "title": "Nama Kartu", "desc": "Deskripsi ringkas" }].
   - "comparison": "comparisonDetails": { "leftTitle": "Sebelum / Lama", "leftItems": [...], "rightTitle": "Sesudah / Solusi", "rightItems": [...], "winner": "right" }.
   - "timeline": "timelineSteps": 3-4 item [{ "step": "01", "title": "Fase", "desc": "Penjelasan langkah" }].
   - "quote": "quote": { "text": "Kutipan kuat dan bermakna", "author": "Nama / Tokoh / Sumber", "context": "Konteks kutipan" }.
   - "takeaway": "bullets" berisi 3-4 rekomendasi aksi nyata.

3. KICKER & TITLES:
   - Setiap slide WAJIB memiliki "kicker" (1-3 kata huruf kapital, penanda kategori di atas judul, misal: "LANDSKAP RISET", "DILEMA UTAMA", "KERANGKA KERJA"). Kicker TIDAK BOLEH mengulang kata pada judul!
4. SPEAKER NOTES:
   - Setiap slide WAJIB memiliki "speakerNotes" (catatan narasi pembicara 1-2 kalimat pemandu presentasi).
5. PEMILIHAN TEMA VISUAL:
   Jika preferensi tema adalah "auto", pilih ID tema yang paling selaras dengan materi dari daftar berikut:
${themesCatalog}
   Tulis tema yang dipilih pada properti "themeId" di root JSON.
6. OUTPUT STRICT:
   Hasilkan TEPAT ${targetSlideCount} slide dalam format JSON murni tanpa markdown pembungkus atau teks pengantar.`
    : `You are a world-class presentation deck architect for Const Learn, built on strict anti-AI-slop design standards (inspired by Guizang Editorial, Swiss International Grid, and Humanize PPT).
Your task is to synthesize the provided study material into an impactful, visually rhythmic, and compelling presentation deck.

CORE DESIGN DOCTRINE & RULES (ANTI-AI-SLOP):
1. PERSUASIVE NARRATIVE ARC:
   The slide deck MUST NOT be a repetitive list of bullet points. It must follow a dynamic dramatic rhythm:
   - Slide 1: Cover / "hero" (Punchy headline, category kicker, concise subtitle).
   - Slide 2: Table of Contents / "agenda" (3-4 pillars numbered 01, 02, 03).
   - Slide 3: Tension / "big-stat" (1 protagonist hero metric or shocking stat defining the problem).
   - Slide 4: Comparison / "comparison" (Before vs After, Legacy vs Modern, or Method comparison).
   - Slide 5: Solution Framework / "bento-grid" (4 modular quadrant cards with badges).
   - Slide 6: Implementation / "timeline" (3-4 linear sequenced process steps).
   - Slide 7: Core Principle / "quote" (Striking statement or quote with clear attribution).
   - Slide 8: Actionable Summary / "takeaway" (Executive summary with concrete next steps).
   (Adapt proportionally if target slide count is ${targetSlideCount}; NEVER repeat the same layout twice in a row).

2. LAYOUT VOCABULARY & FIELDS:
   - "hero": Large title, "kicker" (uppercase category), "subtitle", "accentTag".
   - "agenda": Numbered agenda items ("bullets": ["01. ...", "02. ...", "03. ..."]).
   - "big-stat": "statHighlight": { "value": "Stat/Number", "label": "Short label", "context": "1-sentence context" }.
   - "bento-grid": "bentoCards": 4 items [{ "badge": "01", "title": "Card Name", "desc": "Short description" }].
   - "comparison": "comparisonDetails": { "leftTitle": "Traditional", "leftItems": [...], "rightTitle": "Modern / Solution", "rightItems": [...], "winner": "right" }.
   - "timeline": "timelineSteps": 3-4 items [{ "step": "01", "title": "Milestone", "desc": "Step description" }].
   - "quote": "quote": { "text": "Compelling core quote", "author": "Author / Source", "context": "Context" }.
   - "takeaway": "bullets" with 3-4 concrete actionable takeaways.

3. KICKER & TITLES:
   - Every slide MUST have a "kicker" (1-3 uppercase words category tag above title, e.g. "RESEARCH LANDSCAPE", "CORE TENSION", "FRAMEWORK").
4. SPEAKER NOTES:
   - Every slide MUST include "speakerNotes" (1-2 sentences of presenter talking points).
5. THEME SELECTION:
   If theme preference is "auto", select the best theme from:
${themesCatalog}
   Set selected theme id in "themeId" root property.
6. OUTPUT STRICT:
   Output EXACTLY ${targetSlideCount} slides in pure valid JSON without markdown fences or extraneous text.`;

  const userPrompt = isIndo
    ? `Materi Rujukan Belajar:\n${sourceSnippets || "Topik: " + (topic || "Pengetahuan Umum")}\n\n` +
      (topic ? `Fokus Topik / Instruksi Pengguna: ${topic}\n\n` : "") +
      `Silakan hasilkan dek slide presentasi ${targetSlideCount} slide dalam format JSON persis sesuai struktur berikut:\n` +
      JSON.stringify(
        {
          title: `Presentasi: ${topic || sources[0]?.title || "Materi Belajar"}`,
          themeId: themeId === "auto" ? "const-dark" : themeId,
          slides: [
            {
              id: "slide_1",
              slideNumber: 1,
              layout: "hero",
              kicker: "RINGKASAN EKSEKUTIF",
              title: "Judul Presentasi Yang Kuat",
              subtitle: "Subjudul penjelasan materi secara lugas dan terarah",
              accentTag: "Penting",
              speakerNotes: "Catatan panduan narasi pembicara untuk slide pertama."
            },
            {
              id: "slide_2",
              slideNumber: 2,
              layout: "agenda",
              kicker: "ALUR BAHASAN",
              title: "Peta Bahasan Materi",
              subtitle: "Tiga topik sentral yang dikaji dalam sesi ini",
              bullets: [
                "01. Konteks Landasan & Latar Belakang Masalah",
                "02. Solusi Arsitektur & Kerangka Kerja Terpilih",
                "03. Metrik Dampak & Rekomendasi Aksi Nyata"
              ],
              speakerNotes: "Jelaskan bahwa materi akan dibagi ke dalam tiga tahap bahasan terukur."
            },
            {
              id: "slide_3",
              slideNumber: 3,
              layout: "big-stat",
              kicker: "TANTANGAN UTAMA",
              title: "Tantangan Kunci di Lapangan",
              subtitle: "Metrik esensial yang mendasari pentingnya perubahan pendekatan",
              statHighlight: {
                value: "78%",
                label: "Tingkat Friksi Konvensional",
                context: "Riset membuktikan pendekatan lama menghasilkan beban inefisiensi yang signifikan."
              },
              speakerNotes: "Soroti angka 78% sebagai dorongan utama perlunya paradigma baru."
            },
            {
              id: "slide_4",
              slideNumber: 4,
              layout: "comparison",
              kicker: "KOMPARASI PENDEKATAN",
              title: "Transformasi Cara Kerja",
              subtitle: "Membandingkan metode tradisional dengan arsitektur modern",
              comparisonDetails: {
                leftTitle: "Pendekatan Tradisional",
                leftItems: ["Struktur kaku dan lambat", "Ketergantungan manual tinggi", "Skalabilitas terbatas"],
                rightTitle: "Pendekatan Modern (Solusi)",
                rightItems: ["Otomasi terintegrasi end-to-end", "Keandalan sistem tinggi", "Skalabilitas dinamis"],
                winner: "right"
              },
              speakerNotes: "Tekankan lompatan keunggulan dari pendekatan kanan."
            },
            {
              id: "slide_5",
              slideNumber: 5,
              layout: "bento-grid",
              kicker: "PILAR ARSITEKTUR",
              title: "Empat Pilar Keberhasilan",
              subtitle: "Komponen integral pembangun ekosistem",
              bentoCards: [
                { badge: "01", title: "Fondasi Data", desc: "Konsolidasi sumber informasi terpercaya." },
                { badge: "02", title: "Mesin Analisis", desc: "Pemrosesan cerdas adaptif real-time." },
                { badge: "03", title: "Antarmuka Studio", desc: "Visualisasi bersih tanpa distraksi." },
                { badge: "04", title: "Distribusi Multi-Kanal", desc: "Ekspor langsung ke beragam format." }
              ],
              speakerNotes: "Uraikan sinergi keempat pilar yang bekerja secara harmonis."
            },
            {
              id: "slide_6",
              slideNumber: 6,
              layout: "timeline",
              kicker: "PETA JALAN",
              title: "Langkah Eksekusi Bertahap",
              subtitle: "Tahapan implementasi terukur menuju target",
              timelineSteps: [
                { step: "Fase 1", title: "Audit & Penyelarasan", desc: "Identifikasi kebutuhan dan pemetaan aset awal." },
                { step: "Fase 2", title: "Integrasi Komponen", desc: "Penyusunan modul dan penghubungan sistem." },
                { step: "Fase 3", title: "Validasi & Peluncuran", desc: "Uji menyeluruh dan distribusi ke pengguna." }
              ],
              speakerNotes: "Jelaskan urutan linier dan ekspektasi capaian di tiap fase."
            },
            {
              id: "slide_7",
              slideNumber: 7,
              layout: "quote",
              kicker: "PRINSIP FILOSOFIS",
              title: "Intisari Pembelajaran",
              quote: {
                text: "Keunggulan bukan tentang menambahkan hal berlebih, melainkan tentang menyempurnakan hal esensial tanpa menyisakan ruang bagi distorsi.",
                author: "Arsitek Sistem",
                context: "Prinsip desain fungsional modern"
              },
              speakerNotes: "Berikan jeda sejenak agar audiens meresapi kutipan filosofis ini."
            },
            {
              id: "slide_8",
              slideNumber: 8,
              layout: "takeaway",
              kicker: "REKOMENDASI AKSI",
              title: "Kesimpulan & Tindakan Selanjutnya",
              subtitle: "Tiga komitmen utama untuk memastikan dampak berkelanjutan",
              bullets: [
                "Terapkan audit berkala pada alur kerja utama setiap akhir siklus.",
                "Standardisasi format komunikasi dengan dokumentasi terbuka.",
                "Tingkatkan literasi tim melalui sesi studi kolaboratif berkala."
              ],
              speakerNotes: "Tutup presentasi dengan ajakan aksi nyata yang jelas dan optimis."
            }
          ]
        },
        null,
        2
      )
    : `Reference Study Materials:\n${sourceSnippets || "Topic: " + (topic || "General Knowledge")}\n\n` +
      (topic ? `Specific Topic Focus / User Instructions: ${topic}\n\n` : "") +
      `Please generate the ${targetSlideCount}-slide presentation deck in JSON format strictly matching this schema:\n` +
      JSON.stringify(
        {
          title: `Presentation: ${topic || sources[0]?.title || "Study Material"}`,
          themeId: themeId === "auto" ? "const-dark" : themeId,
          slides: [
            {
              id: "slide_1",
              slideNumber: 1,
              layout: "hero",
              kicker: "EXECUTIVE BRIEF",
              title: "A Compelling Presentation Title",
              subtitle: "Concise, focused overview of the presentation's core premise",
              accentTag: "Essential",
              speakerNotes: "Presenter talking points for the opening slide."
            }
          ]
        },
        null,
        2
      );

  return {
    systemPrompt,
    userPrompt,
    resolvedThemeId,
  };
}
