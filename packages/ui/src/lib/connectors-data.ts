/**
 * Connectors metadata and configuration for Const Learn & Platform.
 * Supports official Composio integrations for Canva MCP, Google Workspace, YouTube, and Cloud Sandbox.
 */

export interface ConnectorMetadata {
  id: string;
  name: string;
  toolkitSlug: string;
  category: "Featured" | "Productivity" | "Creativity" | "Education" | "Developer";
  tagline: string;
  description: string;
  authType: "OAuth2" | "DCR OAuth" | "Managed" | "No Auth";
  toolCount: number;
  skills: string[];
  tryPrompts: string[];
  info: {
    developer: string;
    website: string;
    version: string;
    privacyPolicy: string;
    termsOfService: string;
  };
  isBuiltin?: boolean;
}

export const AVAILABLE_CONNECTORS: ConnectorMetadata[] = [
  {
    id: "cloud-sandbox",
    name: "Cloud Sandbox",
    toolkitSlug: "codeinterpreter",
    category: "Developer",
    tagline: "Isolated Python 3 execution container & scientific plots",
    description:
      "Cloud Python sandbox to run scripts, calculate algebra/calculus, simulate algorithms, process data, generate charts, and render mathematical equations.",
    authType: "No Auth",
    toolCount: 5,
    isBuiltin: true,
    skills: [
      "Execute Python 3 Code",
      "Plot Mathematical Graphs",
      "Solve Calculus & Algebra",
      "Process Datasets & Tables",
      "Render Algorithms & Logic",
    ],
    info: {
      developer: "Const Core Team / Composio",
      website: "https://const.web.id",
      version: "3.2.0",
      privacyPolicy: "https://const.web.id/privacy",
      termsOfService: "https://const.web.id/terms",
    },
    tryPrompts: [
      "@Cloud Sandbox, hitung turunan dan integral dari f(x) = x^3 - 4x + 2.",
      "@Cloud Sandbox, plot grafik fungsi trigonometri sin(x) dan cos(x).",
      "@Cloud Sandbox, simulasikan distribusi probabilitas binomial 100 percobaan.",
    ],
  },
  {
    id: "canva_mcp",
    name: "Canva MCP",
    toolkitSlug: "canva_mcp",
    category: "Creativity",
    tagline: "Model Context Protocol integration for Canva design suite",
    description:
      "Create, edit, and search visual learning materials, presentation slides, educational infographics, and posters directly within conversation using Canva MCP provider.",
    authType: "DCR OAuth",
    toolCount: 33,
    skills: [
      "Generate Presentation Slides",
      "Search Educational Templates",
      "Create Study Infographics",
      "Edit Visual Elements",
      "Export PDF & PNG Designs",
      "Resize for Mobile & Desktop",
    ],
    info: {
      developer: "Canva Pty Ltd.",
      website: "https://canva.com",
      version: "2.1.0",
      privacyPolicy: "https://canva.com/policies/privacy-policy",
      termsOfService: "https://canva.com/policies/terms-of-service",
    },
    tryPrompts: [
      "@Canva MCP, buatkan slide presentasi 5 halaman tentang Struktur Sel Biologi.",
      "@Canva MCP, carikan template infografis bertema Revolusi Industri 4.0.",
      "@Canva MCP, buatkan poster pengumuman lomba debat sains sekolah.",
    ],
  },
  {
    id: "google-sheets",
    name: "Google Sheets",
    toolkitSlug: "googlesheets",
    category: "Productivity",
    tagline: "Manage spreadsheets, calculate formulas, and format table rows",
    description:
      "Organize scientific experiments, manage study schedules, calculate grading rubrics, insert rows, query cell ranges, and automate spreadsheet workflows.",
    authType: "OAuth2",
    toolCount: 18,
    skills: [
      "Create Spreadsheet",
      "Add & Append Rows",
      "Get Cell Range Values",
      "Update Formula Values",
      "Format Sheets & Tables",
      "Clear Specific Ranges",
    ],
    info: {
      developer: "Google LLC",
      website: "https://google.com/sheets",
      version: "2.2.0",
      privacyPolicy: "https://policies.google.com/privacy",
      termsOfService: "https://policies.google.com/terms",
    },
    tryPrompts: [
      "@Google Sheets, buatkan tabel anggaran praktikum fisika dengan kolom Nama, Jumlah, dan Harga.",
      "@Google Sheets, baca nilai dari sel A1 hingga D20 di spreadsheet tugas saya.",
      "@Google Sheets, tambahkan baris baru untuk rekap nilai kuis matematika hari ini.",
    ],
  },
  {
    id: "google-docs",
    name: "Google Docs",
    toolkitSlug: "googledocs",
    category: "Productivity",
    tagline: "Create educational essays, research reports, and formatted modules",
    description:
      "Draft research papers, append study notes, create collaborative learning docs, outline chapters, and organize academic manuscripts directly from your study chat.",
    authType: "OAuth2",
    toolCount: 14,
    skills: [
      "Create Document",
      "Batch Update Document Text",
      "Get Document Content",
      "Insert Paragraphs & Headers",
      "Format Academic Outlines",
    ],
    info: {
      developer: "Google LLC",
      website: "https://google.com/docs",
      version: "1.9.0",
      privacyPolicy: "https://policies.google.com/privacy",
      termsOfService: "https://policies.google.com/terms",
    },
    tryPrompts: [
      "@Google Docs, buatkan dokumen baru berjudul 'Laporan Praktikum Kimia Organik'.",
      "@Google Docs, tambahkan rangkuman kesimpulan belajar ke bagian akhir dokumen saya.",
      "@Google Docs, baca teks dari dokumen skripsi bab 1 untuk direview.",
    ],
  },
  {
    id: "google-slides",
    name: "Google Slides",
    toolkitSlug: "googleslides",
    category: "Creativity",
    tagline: "Generate lecture decks, chapter summaries, and interactive slides",
    description:
      "Transform notebook takeaways into presentation decks. Add slides with titles, bullet points, update shapes, replace placeholders, and format lecture presentations.",
    authType: "OAuth2",
    toolCount: 16,
    skills: [
      "Create Presentation Deck",
      "Add New Slides",
      "Update Slide Text & Shapes",
      "Replace Placeholders",
      "Format Slide Layouts",
    ],
    info: {
      developer: "Google LLC",
      website: "https://google.com/slides",
      version: "1.5.0",
      privacyPolicy: "https://policies.google.com/privacy",
      termsOfService: "https://policies.google.com/terms",
    },
    tryPrompts: [
      "@Google Slides, buatkan presentasi 6 slide tentang 'Siklus Krebs dan Respirasi Sel'.",
      "@Google Slides, tambahkan slide penutup dengan daftar referensi buku.",
    ],
  },
  {
    id: "google-drive",
    name: "Google Drive",
    toolkitSlug: "googledrive",
    category: "Featured",
    tagline: "Search, organize, and manage academic resources in the cloud",
    description:
      "Access PDFs, textbooks, research papers, and assignments stored in your Google Drive. Search files, create folders, and upload generated study guides.",
    authType: "OAuth2",
    toolCount: 22,
    skills: [
      "Search Drive Files",
      "Upload Study Materials",
      "Create Folders",
      "Get File Metadata & Sharing",
      "Download Documents",
    ],
    info: {
      developer: "Google LLC",
      website: "https://google.com/drive",
      version: "3.1.0",
      privacyPolicy: "https://policies.google.com/privacy",
      termsOfService: "https://policies.google.com/terms",
    },
    tryPrompts: [
      "@Google Drive, cari file materi kuliah kalkulus berformat PDF di Drive saya.",
      "@Google Drive, buatkan folder baru bernama 'Const Learn - Semester 2'.",
    ],
  },
  {
    id: "google-tasks",
    name: "Google Tasks",
    toolkitSlug: "googletasks",
    category: "Productivity",
    tagline: "Track study milestones, homework assignments, and exam prep",
    description:
      "Synchronize your daily study agenda. Create study checklists, schedule homework deadlines, check off finished chapters, and maintain exam preparation tasks.",
    authType: "OAuth2",
    toolCount: 12,
    skills: [
      "Create Task",
      "List Active Tasks",
      "Update Task Status",
      "Set Due Dates",
      "Delete Completed Task",
    ],
    info: {
      developer: "Google LLC",
      website: "https://tasks.google.com",
      version: "1.0.0",
      privacyPolicy: "https://policies.google.com/privacy",
      termsOfService: "https://policies.google.com/terms",
    },
    tryPrompts: [
      "@Google Tasks, tambahkan tugas 'Review Bab 4 Termodinamika' deadline besok sore.",
      "@Google Tasks, tampilkan semua daftar tugas belajar aktif saya.",
    ],
  },
  {
    id: "google-classroom",
    name: "Google Classroom",
    toolkitSlug: "googleclassroom",
    category: "Education",
    tagline: "Access class announcements, course materials, and submissions",
    description:
      "Connect your Google Classroom courses directly. Browse enrolled classes, view coursework announcements, retrieve teacher assignment instructions, and check grades.",
    authType: "OAuth2",
    toolCount: 20,
    skills: [
      "List Enrolled Courses",
      "Get Coursework Details",
      "List Class Announcements",
      "View Student Submissions",
      "Check Course Teachers",
    ],
    info: {
      developer: "Google LLC",
      website: "https://classroom.google.com",
      version: "1.4.0",
      privacyPolicy: "https://policies.google.com/privacy",
      termsOfService: "https://policies.google.com/terms",
    },
    tryPrompts: [
      "@Google Classroom, periksa tugas apa saja yang belum dikumpulkan di kelas Fisika.",
      "@Google Classroom, tampilkan pengumuman terbaru dari dosen mata kuliah Algoritma.",
    ],
  },
  {
    id: "google-forms",
    name: "Google Forms",
    toolkitSlug: "googleforms",
    category: "Education",
    tagline: "Build quiz questionnaires, surveys, and collect student feedback",
    description:
      "Create dynamic practice quizzes, mini-surveys for student research, generate multiple-choice evaluations, and read aggregate student quiz responses.",
    authType: "OAuth2",
    toolCount: 15,
    skills: [
      "Create Quiz & Survey Form",
      "Add Multiple-Choice Questions",
      "Read Form Responses",
      "Get Form Summary Statistics",
    ],
    info: {
      developer: "Google LLC",
      website: "https://google.com/forms",
      version: "1.2.0",
      privacyPolicy: "https://policies.google.com/privacy",
      termsOfService: "https://policies.google.com/terms",
    },
    tryPrompts: [
      "@Google Forms, buatkan kuis latihan 5 soal pilihan ganda tentang Hukum Newton.",
      "@Google Forms, baca rekap jawaban kuis pemahaman materi biologi kemarin.",
    ],
  },
  {
    id: "youtube",
    name: "YouTube",
    toolkitSlug: "youtube",
    category: "Education",
    tagline: "Search educational video lectures, extract transcripts, and analyze tutorials",
    description:
      "Find video explanations from Khan Academy, MIT OpenCourseWare, CrashCourse, and academic creators. Extract video transcripts to synthesize instant study notes.",
    authType: "OAuth2",
    toolCount: 14,
    skills: [
      "Search Educational Videos",
      "Get Video Metadata & Details",
      "Extract Video Transcripts",
      "List Playlist Lectures",
    ],
    info: {
      developer: "Google LLC",
      website: "https://youtube.com",
      version: "1.3.0",
      privacyPolicy: "https://policies.google.com/privacy",
      termsOfService: "https://policies.google.com/terms",
    },
    tryPrompts: [
      "@YouTube, carikan video tutorial animasi tentang Mekanisme Replikasi DNA.",
      "@YouTube, ambil transkrip dari video kuliah fisika kuantum ini untuk dirangkum.",
    ],
  },
];

/**
 * Resolves connector metadata for a given tool name or slug.
 */
export function getConnectorForTool(toolName: string): ConnectorMetadata | null {
  if (!toolName) return null;
  const norm = toolName.toLowerCase().replace(/[-_]/g, "");

  if (norm.includes("canva")) {
    return (
      AVAILABLE_CONNECTORS.find(
        (c) => c.id === "canva_mcp" || c.toolkitSlug === "canva_mcp" || c.id === "canva"
      ) || null
    );
  }
  if (norm.includes("sheet")) {
    return (
      AVAILABLE_CONNECTORS.find(
        (c) => c.id === "google-sheets" || c.toolkitSlug === "googlesheets"
      ) || null
    );
  }
  if (norm.includes("doc")) {
    return (
      AVAILABLE_CONNECTORS.find(
        (c) => c.id === "google-docs" || c.toolkitSlug === "googledocs"
      ) || null
    );
  }
  if (norm.includes("slide")) {
    return (
      AVAILABLE_CONNECTORS.find(
        (c) => c.id === "google-slides" || c.toolkitSlug === "googleslides"
      ) || null
    );
  }
  if (norm.includes("drive")) {
    return (
      AVAILABLE_CONNECTORS.find(
        (c) => c.id === "google-drive" || c.toolkitSlug === "googledrive"
      ) || null
    );
  }
  if (norm.includes("task")) {
    return (
      AVAILABLE_CONNECTORS.find(
        (c) => c.id === "google-tasks" || c.toolkitSlug === "googletasks"
      ) || null
    );
  }
  if (norm.includes("classroom")) {
    return (
      AVAILABLE_CONNECTORS.find(
        (c) => c.id === "google-classroom" || c.toolkitSlug === "googleclassroom"
      ) || null
    );
  }
  if (norm.includes("form")) {
    return (
      AVAILABLE_CONNECTORS.find(
        (c) => c.id === "google-forms" || c.toolkitSlug === "googleforms"
      ) || null
    );
  }
  if (norm.includes("youtube")) {
    return (
      AVAILABLE_CONNECTORS.find(
        (c) => c.id === "youtube" || c.toolkitSlug === "youtube"
      ) || null
    );
  }
  if (
    norm.includes("codeinterpreter") ||
    norm.includes("cloudsandbox")
  ) {
    return AVAILABLE_CONNECTORS.find((c) => c.id === "cloud-sandbox") || null;
  }

  return null;
}
