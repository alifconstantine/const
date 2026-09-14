import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Language = "en" | "id";

export interface LanguageOption {
  code: Language;
  label: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "en", label: "English" },
  { code: "id", label: "Bahasa Indonesia" },
];

export const translations = {
  en: {
    // Common / General
    appName: "Const Learn",
    settings: "Settings",
    theme: "Theme",
    themeSystem: "System",
    themeLight: "Light",
    themeDark: "Dark",
    language: "Language",
    switchAccount: "Switch account",
    logout: "Log out",
    search: "Search",
    cancel: "Cancel",
    save: "Save",
    delete: "Delete",
    create: "Create",
    back: "Back",
    backToHome: "Back to Home",
    browse: "Browse...",
    default: "Default",
    untitledNotebook: "Untitled Notebook",
    clickToRename: "Click to rename",
    openLearn: "Open Learn",
    manageCollections: "Manage Collections",
    editLearn: "Edit Name & Emoji",
    editCollection: "Edit Collection",
    moreOptions: "More options",
    saving: "Saving...",
    update: "Update",

    // Sidebar & Navigation
    createNew: "Create New",
    learns: "Learns",
    sources: "Sources",
    chat: "Chat",
    collections: "Collections",
    artifacts: "Artifacts",
    learningSources: "Learning Sources",
    addFirstSource: "Add first source",
    filesCount: "{count} files",
    filesCountSingle: "1 file",

    // Home Page
    searchLearns: "Search learns...",
    searchCollections: "Search collections...",
    newLearn: "New Learn",
    newCollection: "New Collection",
    recentlyViewed: "Recently Viewed",
    allLearns: "All Learns",
    noLearnsFound: "No learns found",
    noLearnsDescription: "Start by creating a new learn or exploring your workspace.",
    sourcesCount: "{count} sources",
    sourcesCountSingle: "1 source",
    sourcesCountNone: "0 sources",
    learnCountText: "{count} learns",
    learnCountTextSingle: "1 learn",
    collectionsCountText: "{count} collections",
    backToAllCollections: "Back to all collections",
    searchResultsFor: "Search results for \"{query}\"",
    noLearnsMatchSearch: "No learns match \"{query}\".",
    noLearnsInCollection: "No learns in this collection yet.",
    noArtifactsTitle: "No artifacts yet",
    noArtifactsDesc: "Presentation slides, diagrams, and interactive modules created while studying with the agent will automatically appear here.",
    createCardLearn: "Create new learn",
    createCardCollection: "Create new collection",
    relativeJustNow: "Just now",
    relativeMinutesAgo: "{minutes}m ago",
    relativeHoursAgo: "{hours}h ago",
    relativeYesterday: "Yesterday",
    relativeDaysAgo: "{days}d ago",
    updated: "Updated {time}",
    deleteLearnTitle: "Delete Learn \"{title}\"?",
    deleteLearnConfirm: "This action cannot be undone. All research notes and conversations will be deleted.",
    deleteCollectionTitle: "Delete Collection \"{name}\"?",
    deleteCollectionConfirm: "Learns in this collection will not be deleted, only unlinked.",

    // Workspace: Sources Panel
    sourcesPanelTitle: "Sources",
    addSource: "Add source",
    searchWebSources: "Search new sources on the web...",
    webScopeWeb: "Web",
    webScopeJournal: "Journal",
    speedFast: "Fast Research",
    speedDeep: "Deep Research",
    carriedSourcesHeader: "Carried: {carried}/{total}",
    selectAll: "Select All",
    deselectAll: "Deselect All",
    emptySourcesTitle: "Saved sources will appear here",
    emptySourcesDescription: "Add files, websites, or copied text. Then ask questions or generate study tools based on them.",
    dropFilesHere: "Drop files here or",
    addSourceAction: "add source",
    removeSource: "Remove source",
    openSourcesPanel: "Open Sources Panel",
    hidePanel: "Hide Panel",

    // Workspace: Add Source Dialog
    addSourceDialogTitle: "Create Audio & Video Summaries from",
    addSourceDialogHighlight: "sources",
    orDropFiles: "or drop your files here",
    supportedFormats: "pdf, images, documents, audio, and more",
    uploadFile: "Upload file",
    website: "Website",
    drive: "Drive",
    playBooks: "Play Books",
    copiedText: "Copied text",
    enterUrlPrompt: "Enter source website URL:",
    copiedQuote: "Quote: {snippet}...",

    // Workspace: Chat Panel
    newChat: "New Chat",
    chatHistory: "Chat History",
    historySubtitle: "Discussion sessions in this notebook",
    searchHistory: "Search topics or conversation history...",
    noHistoryTitle: "No chat history yet",
    noHistoryDesc: "Start a new conversation with AI to save your study sessions.",
    noHistorySearchTitle: "No sessions matched",
    noHistorySearchDesc: "Keyword \"{query}\" was not found.",
    today: "Today",
    yesterday: "Yesterday",
    last7Days: "Last 7 Days",
    older: "Older",
    carriedSourcesPill: "{count} sources",
    carriedSourcesPillSingle: "1 source",
    manageCarriedSources: "Manage Carried Sources",
    carriedSourcesTitle: "Carried Sources ({carried}/{total})",
    noSourcesInChat: "No sources added yet",
    noSourcesInChatDesc: "Add files or web links to notebook to reference in chat",
    inputPlaceholder: "Ask anything or type a prompt...",
    inputStreamingPlaceholder: "Processing assistant response...",
    sendMessage: "Send message",
    stopGenerating: "Stop generating",
    initialSessionTitle: "Main Session",
    newSessionTitle: "New Conversation",
    selectAiModel: "Select AI Model",
    welcomeNotebookTitle: "Let's start building a notebook...",
    welcomeNotebookDesc: "With this notebook, you can explore, create, or build something new. You can ask for my assistance to begin or attach your own sources.",
    welcomeNotebookPrompt: "What would you like to do with this notebook?",
    chipLearnNewTopic: "Learn a new topic",
    chipCreateContent: "Create new content",
    chipContinueProject: "Continue project",
    processingResponse: "Processing assistant response...",
    copyMessage: "Copy message",
    copied: "Copied",
    voiceInput: "Voice Input",
    attachFileMedia: "Attach files or media",

    // Workspace: Studio Panel
    studioTitle: "Studio",
    studioTools: "Studio Tools",
    notes: "Notes",
    addNote: "Add note",
    openStudioPanel: "Open Studio Panel",
    toolsAudioSummary: "Audio Overview",
    toolsSlides: "Presentation Slides",
    toolsVideo: "Video Summary",
    toolsMindMap: "Mind Map",
    toolsReport: "Report",
    toolsBrowser: "Browser",
    toolsQuiz: "Quiz",
    toolsInfographic: "Infographic",
    toolsTerminal: "Terminal",
    badgeNew: "New!",
    toolsFlashcards: "Flashcards",
    toolsDataTable: "Data Table",
    notesPlaceholder: "Write notes or study summaries here...",
    noNotesTitle: "No notes yet",
    noNotesDesc: "Save key insights or notes directly to this notebook.",
    studioEmptyTitle: "Studio output will be saved here",
    studioEmptyDesc: "After adding sources, click to add Audio Overviews, Study Guides, Mind Maps, and more.",
    sessionsSavedCount: "{count} sessions saved",
    done: "Done",
    deleteSession: "Delete session",
    close: "Close",
    tabAll: "All",
    viewAll: "View all",
    openInExplorer: "Open in File Explorer:\n{path}",
    defaultWorkspace: "Default Workspace",
    startConversationNew: "Start a new conversation",
    clearConversation: "Clear conversation",
    share: "Share",
    download: "Download",
    deleteArtifact: "Delete artifact",
    noArtifactsSaved: "No artifacts or files saved yet",
    noArtifactsSavedDesc: "Any files produced in learning sessions will appear here and can be downloaded directly.",
    sourcesEmptyWorkspaceTitle: "No sources in this notebook",
    sourcesEmptyWorkspaceDesc: "Upload documents or search the web to empower the AI with your material.",
    askModel: "Ask {model}...",
    waitingResponse: "Waiting for response...",
    addMediaOrDoc: "Add media or document",
    removeAttachment: "Remove attachment",
    maxAttachmentsReached: "Maximum {count} media reached",
    addMediaWithCount: "Add media ({count}/{max})",
    contextUsed: "of context used",
    tutorInstructions: "Socratic Tutor",
    currentInput: "Current Input",
    availableContext: "Available Context",
    sessionTelemetry: "Session telemetry metrics",
    searchModels: "Search models...",
    noModelsFound: "No models found",
    clickToPreview: "Click to preview",
    noResponseReceived: "No response received from assistant.",
    analyzeAttachedMediaPrompt: "Please analyze the attached media/file(s).",
    openWorkspaceFolder: "Open Workspace Folder",
    sort: "Sort",
    sortRecent: "Recent",
    sortOldest: "Oldest",
    sortTitleAsc: "A-Z",
    sortTitleDesc: "Z-A",
    edit: "Edit",
    editMessage: "Edit message & restore input",
    undoTurn: "Undo turn",
    clearSearch: "Clear search",
    searchNotebooks: "Search notebooks...",
    searchSources: "Search sources...",
    searchArtifacts: "Search artifacts...",
    searchNotebooksAndCollections: "Search notebooks, collections...",

    // Dialogs: Create / Edit Learn
    createLearnDialogTitle: "Create New Learn",
    editLearnDialogTitle: "Edit Learn Details",
    pickIconEmoji: "Choose Icon / Emoji",
    learnTitleLabel: "Learn Title",
    learnTitlePlaceholder: "e.g. Modern Web Architecture",
    workspacePathLabel: "Project Folder (Workspace)",
    workspacePathPlaceholder: "Default (~/.const/learn/workspaces/...)",
    resetDefault: "Reset Default",
    selectFolder: "Browse Folder",
    agentWorkspaceNotice: "Agent operates directly inside this project folder.",
    defaultWorkspaceNotice: "Default isolated folder in ~/.const/learn/workspaces/.",
    collectionCategoryOptional: "Collection Category (Optional)",
    noCollection: "No Collection",

    // Dialogs: Create / Edit Collection
    createCollectionDialogTitle: "Create Collection",
    editCollectionDialogTitle: "Edit Collection",
    collectionNameLabel: "Collection Name",
    collectionNamePlaceholder: "e.g. Computer Science",
    collectionIcon: "Collection Icon",
    collectionDescOptional: "Description (Optional)",
    collectionDescPlaceholder: "Category for related study materials",

    // Dialogs: Manage Collection
    manageCollectionsDialogTitle: "Manage Collections",
    manageCollectionsFor: "Notebook: {title}",
    noCollectionsYet: "No collections created yet.",

    // Sources View
    sourcesViewTitle: "Sources",
    sourcesViewSubtitle: "Collection of your documents, web research links, and study references.",
    searchSourcesPlaceholder: "Search reference sources...",
    addSourceBtn: "Add Source",
    noSavedSourcesTitle: "No saved sources yet",
    noSavedSourcesDesc: "Link web articles, PDF files, markdown documents, or research notes to your notebook to start evidence-based reasoning with AI agents.",
    openSidebar: "Open sidebar",
    openSidebarKeyboard: "Open sidebar (Ctrl+B)",
    closeSidebar: "Close sidebar",
    closeSidebarKeyboard: "Close sidebar (Ctrl+B)",
    open: "Open",
    newCollectionDefaultName: "New Collection",

    // Auth & App
    reopenLoginTab: "Reopen Login Tab",
    reopenLoginPage: "Reopen Login Page",
    signInConstLearn: "Sign in to Const Learn",
    signInSubtitle: "Sign in to start researching and learning with native AI agents — no complex setup required.",

    // Settings
    backToLearns: "Back to Learns",
    preferences: "Preferences",
    generalSettings: "General Settings",
    generalSettingsSubtitle: "Manage user profile, study session status, and system runtime environment.",
    appearanceSubtitle: "Customize user interface theme for visual comfort.",
    connectedAccount: "Connected Account",
    systemRuntime: "System & Runtime",
    application: "Application",
    localDatabase: "Local Database",
    authenticatedSso: "Authenticated (Const Hub SSO)",
    interfaceTheme: "Interface Theme",
    themeSystemDesc: "Match OS theme",
    themeLightDesc: "Canvas #f8f8f8",
    themeDarkDesc: "Canvas #161616 (Studio)",
    aiModelsSubtitle: "Choose default AI model or manage the reasoning router used during learning.",
    activeModelChanged: "Active model changed to {modelId}",

    // Tools & Execution Trace
    socraticQuestion: "Socratic Question",
    inquiry: "Inquiry",
    answered: "Answered",
    waitingForChoice: "Waiting for Your Choice",
    waitingForChoiceShort: "Waiting for Choice",
    choiceLabel: "Choice:",
    answerLabel: "Answer:",
    customAnswerPlaceholder: "Or type your own thoughts / answer...",
    sendCustomAnswer: "Send Custom Answer",
    calculation: "Calculation",
    calculating: "Calculating...",
    running: "Running...",
    completed: "Completed",
    failed: "Failed",
    details: "Details",
    closeDetail: "Close",
    output: "Output",
    view: "View",
    generatedChart: "Generated Chart:",
    chart: "Chart:",
    openFile: "Open File",
    pythonCodeExecuted: "Executed Python Code:",
    commandLabel: "Command:",
    stdoutOutput: "Output (stdout):",
    noOutput: "No output",
    inputParams: "Input Parameters:",
    executionResult: "Execution Result:",
    studyRoadmap: "Study Roadmap",
    studyRoadmapAndTasks: "Study Plan & Tasks",
    tasksCompleted: "{completed}/{total} Completed",
    viewRoadmap: "View Roadmap",
    taskItem: "Task {number}",
    sourceFileFallback: "Source File",
    fileActionEdit: "Edit",
    fileActionCreate: "Create",
    howToProceedFallback: "How would you like to proceed?",

    // Markdown & Code Blocks
    copyCode: "Copy Code",
    copy: "Copy",
    copiedBadge: "Copied",
    copyTsv: "Copy Table (TSV)",
    copyTsvShort: "Copy TSV",
    downloadCsv: "Download CSV",
    expandView: "Expand View",
    tableCopied: "Table Copied",
    dataTable: "Data Table",
    tableRowsCols: "({rows} rows, {cols} columns)",
  },
  id: {
    // Common / General
    appName: "Const Learn",
    settings: "Settings",
    theme: "Tema Tampilan",
    themeSystem: "Sistem",
    themeLight: "Terang",
    themeDark: "Gelap",
    language: "Bahasa",
    switchAccount: "Ganti akun",
    logout: "Keluar",
    search: "Cari",
    cancel: "Batal",
    save: "Simpan",
    delete: "Hapus",
    create: "Buat",
    back: "Kembali",
    backToHome: "Kembali ke Beranda",
    browse: "Pilih Folder...",
    default: "Default",
    untitledNotebook: "Notebook tanpa judul",
    clickToRename: "Klik untuk mengubah judul",
    openLearn: "Buka Learn",
    manageCollections: "Kelola Koleksi",
    editLearn: "Ubah Nama & Emoji",
    editCollection: "Ubah Koleksi",
    moreOptions: "Opsi lainnya",
    saving: "Menyimpan...",
    update: "Perbarui",

    // Sidebar & Navigation
    createNew: "Buat Baru",
    learns: "Learns",
    sources: "Sumber",
    chat: "Obrolan",
    collections: "Koleksi",
    artifacts: "Artefak",
    learningSources: "Sumber Pembelajaran",
    addFirstSource: "Tambah sumber pertama",
    filesCount: "{count} file",
    filesCountSingle: "1 file",

    // Home Page
    searchLearns: "Cari topik belajar...",
    searchCollections: "Cari koleksi...",
    newLearn: "Learn Baru",
    newCollection: "Koleksi Baru",
    recentlyViewed: "Baru Dilihat",
    allLearns: "Semua Learn",
    noLearnsFound: "Belum ada catatan belajar",
    noLearnsDescription: "Mulai dengan membuat pembelajaran baru atau jelajahi workspace Anda.",
    sourcesCount: "{count} sumber",
    sourcesCountSingle: "1 sumber",
    sourcesCountNone: "0 sumber",
    learnCountText: "{count} learn",
    learnCountTextSingle: "1 learn",
    collectionsCountText: "{count} koleksi",
    backToAllCollections: "Kembali ke semua koleksi",
    searchResultsFor: "Hasil pencarian untuk \"{query}\"",
    noLearnsMatchSearch: "Tidak ada learn yang cocok dengan \"{query}\".",
    noLearnsInCollection: "Belum ada learn dalam koleksi ini.",
    noArtifactsTitle: "Belum ada artifact",
    noArtifactsDesc: "Slide presentasi, visualisasi diagram, dan modul interaktif yang dihasilkan saat Anda belajar dengan agen akan otomatis tersimpan di sini.",
    createCardLearn: "Buat notebook baru",
    createCardCollection: "Buat koleksi baru",
    relativeJustNow: "Baru saja",
    relativeMinutesAgo: "{minutes}m lalu",
    relativeHoursAgo: "{hours}j lalu",
    relativeYesterday: "Kemarin",
    relativeDaysAgo: "{days}h lalu",
    updated: "Diperbarui {time}",
    deleteLearnTitle: "Hapus Learn \"{title}\"?",
    deleteLearnConfirm: "Tindakan ini tidak dapat dibatalkan. Seluruh catatan riset dan percakapan akan dihapus.",
    deleteCollectionTitle: "Hapus Koleksi \"{name}\"?",
    deleteCollectionConfirm: "Materi learn di dalam koleksi ini tidak akan dihapus, hanya tautan kategorinya yang dilepaskan.",

    // Workspace: Sources Panel
    sourcesPanelTitle: "Sumber",
    addSource: "Tambahkan sumber",
    searchWebSources: "Telusuri sumber baru di web...",
    webScopeWeb: "Web",
    webScopeJournal: "Jurnal",
    speedFast: "Riset Cepat",
    speedDeep: "Riset Mendalam",
    carriedSourcesHeader: "Dibawa: {carried}/{total}",
    selectAll: "Pilih Semua",
    deselectAll: "Batal Semua",
    emptySourcesTitle: "Sumber yang telah disimpan akan muncul di sini",
    emptySourcesDescription: "Tambahkan file, situs, atau teks yang disalin. Kemudian, ajukan pertanyaan atau buat sesuatu berdasarkan sumber ini.",
    dropFilesHere: "Lepaskan file di sini atau",
    addSourceAction: "tambahkan sumber",
    removeSource: "Hapus sumber",
    openSourcesPanel: "Buka Panel Sumber",
    hidePanel: "Sembunyikan Panel",

    // Workspace: Add Source Dialog
    addSourceDialogTitle: "Buat Ringkasan Audio dan Video dari",
    addSourceDialogHighlight: "situs",
    orDropFiles: "atau lepaskan file Anda",
    supportedFormats: "pdf, gambar, dokumen, audio, dan banyak lagi",
    uploadFile: "Upload file",
    website: "Situs",
    drive: "Drive",
    playBooks: "Play Buku",
    copiedText: "Teks yang disalin",
    enterUrlPrompt: "Masukkan URL / tautan web sumber:",
    copiedQuote: "Kutipan: {snippet}...",

    // Workspace: Chat Panel
    newChat: "New Chat",
    chatHistory: "Riwayat Chat",
    historySubtitle: "Sesi diskusi di notebook ini",
    searchHistory: "Cari topik atau riwayat percakapan...",
    noHistoryTitle: "Belum ada riwayat chat",
    noHistoryDesc: "Mulai pertanyaan baru dengan AI untuk menyimpan sesi belajar Anda.",
    noHistorySearchTitle: "Tidak ada sesi yang cocok",
    noHistorySearchDesc: "Kata kunci \"{query}\" tidak ditemukan.",
    today: "Hari Ini",
    yesterday: "Kemarin",
    last7Days: "7 Hari Terakhir",
    older: "Lebih Lama",
    carriedSourcesPill: "{count} sumber",
    carriedSourcesPillSingle: "1 sumber",
    manageCarriedSources: "Kelola Sumber yang Dibawa",
    carriedSourcesTitle: "Sumber Dibawa ({carried}/{total})",
    noSourcesInChat: "Belum ada sumber",
    noSourcesInChatDesc: "Tambahkan berkas atau tautan web ke notebook untuk dibawa ke obrolan",
    inputPlaceholder: "Tanyakan apa saja atau ketik pesan...",
    inputStreamingPlaceholder: "Sedang memproses respons asisten...",
    sendMessage: "Kirim pesan",
    stopGenerating: "Hentikan respons",
    initialSessionTitle: "Sesi Utama",
    newSessionTitle: "Percakapan Baru",
    selectAiModel: "Pilih Model Cerdas",
    welcomeNotebookTitle: "Mari mulai membuat notebook...",
    welcomeNotebookDesc: "Dengan notebook ini, Anda dapat mulai memahami, membuat, atau mengembangkan hal baru. Anda dapat meminta bantuan saya untuk memulai atau langsung menambahkan sumber Anda sendiri.",
    welcomeNotebookPrompt: "Apa yang ingin Anda lakukan dengan notebook ini?",
    chipLearnNewTopic: "Pelajari topik baru",
    chipCreateContent: "Buat konten baru",
    chipContinueProject: "Lanjutkan project",
    processingResponse: "Sedang memproses respons...",
    copyMessage: "Salin pesan",
    copied: "Disalin",
    voiceInput: "Input Suara",
    attachFileMedia: "Lampirkan File atau Media",

    // Workspace: Studio Panel
    studioTitle: "Studio",
    studioTools: "Alat Studio",
    notes: "Catatan",
    addNote: "Tambah catatan",
    openStudioPanel: "Buka Panel Studio",
    toolsAudioSummary: "Ringkasan Audio",
    toolsSlides: "Slide Presentasi",
    toolsVideo: "Ringkasan Video",
    toolsMindMap: "Peta Pikiran",
    toolsReport: "Laporan",
    toolsBrowser: "Browser",
    toolsQuiz: "Kuis",
    toolsInfographic: "Infografis",
    toolsTerminal: "Terminal",
    badgeNew: "Baru!",
    toolsFlashcards: "Kartu Kilas",
    toolsDataTable: "Tabel Data",
    notesPlaceholder: "Tulis catatan atau rangkuman belajar di sini...",
    noNotesTitle: "Belum ada catatan",
    noNotesDesc: "Simpan intisari atau catatan penting langsung di notebook ini.",
    studioEmptyTitle: "Output studio akan disimpan di sini",
    studioEmptyDesc: "Setelah menambahkan sumber, klik untuk menambahkan Ringkasan Audio, Panduan Belajar, Peta Konsep, dan banyak lagi.",
    sessionsSavedCount: "{count} sesi tersimpan",
    done: "Selesai",
    deleteSession: "Hapus sesi",
    close: "Tutup",
    tabAll: "Semua",
    viewAll: "Lihat semua",
    openInExplorer: "Buka di File Explorer:\n{path}",
    defaultWorkspace: "Workspace Default",
    startConversationNew: "Mulai percakapan baru",
    clearConversation: "Hapus percakapan",
    share: "Bagikan",
    download: "Unduh",
    deleteArtifact: "Hapus artifact",
    noArtifactsSaved: "Belum ada artifact atau berkas tersimpan",
    noArtifactsSavedDesc: "Berkas apa pun yang dibuat dalam sesi belajar akan muncul di sini dan dapat diunduh langsung.",
    sourcesEmptyWorkspaceTitle: "Belum ada sumber di notebook ini",
    sourcesEmptyWorkspaceDesc: "Unggah dokumen atau telusuri web untuk memperkaya AI dengan materi Anda.",
    askModel: "Tanya {model}...",
    waitingResponse: "Menunggu respons...",
    addMediaOrDoc: "Tambah media atau dokumen",
    removeAttachment: "Hapus lampiran",
    maxAttachmentsReached: "Maksimal {count} media telah tercapai",
    addMediaWithCount: "Tambah media ({count}/{max})",
    contextUsed: "konteks terpakai",
    tutorInstructions: "Tutor Socrates",
    currentInput: "Input Saat Ini",
    availableContext: "Kapasitas Tersisa",
    sessionTelemetry: "Metrik telemetri sesi",
    searchModels: "Cari model...",
    noModelsFound: "Tidak ada model ditemukan",
    clickToPreview: "Klik untuk pratinjau",
    noResponseReceived: "Tidak ada respons yang diterima dari asisten.",
    analyzeAttachedMediaPrompt: "Mohon analisa media / lampiran ini.",
    openWorkspaceFolder: "Buka Folder Workspace",
    sort: "Urutkan",
    sortRecent: "Terbaru",
    sortOldest: "Terlama",
    sortTitleAsc: "A-Z",
    sortTitleDesc: "Z-A",
    edit: "Ubah",
    editMessage: "Edit pesan & kembalikan input",
    undoTurn: "Batalkan giliran",
    clearSearch: "Hapus pencarian",
    searchNotebooks: "Cari notebook...",
    searchSources: "Cari sumber...",
    searchArtifacts: "Cari artifact...",
    searchNotebooksAndCollections: "Cari notebook, koleksi...",

    // Dialogs: Create / Edit Learn
    createLearnDialogTitle: "Buat Learn Baru",
    editLearnDialogTitle: "Ubah Detail Learn",
    pickIconEmoji: "Pilih Ikon / Emoji",
    learnTitleLabel: "Judul Learn",
    learnTitlePlaceholder: "contoh: Arsitektur Web Modern",
    workspacePathLabel: "Folder Proyek (Workspace)",
    workspacePathPlaceholder: "Default (~/.const/learn/workspaces/...)",
    resetDefault: "Reset Default",
    selectFolder: "Pilih Folder",
    agentWorkspaceNotice: "Agent beroperasi langsung di dalam folder proyek ini.",
    defaultWorkspaceNotice: "Default folder terisolasi di ~/.const/learn/workspaces/.",
    collectionCategoryOptional: "Kategori Koleksi (Opsional)",
    noCollection: "Tanpa Koleksi",

    // Dialogs: Create / Edit Collection
    createCollectionDialogTitle: "Buat Koleksi Baru",
    editCollectionDialogTitle: "Ubah Koleksi",
    collectionNameLabel: "Nama Koleksi",
    collectionNamePlaceholder: "contoh: Ilmu Komputer, Riset AI",
    collectionIcon: "Ikon Koleksi",
    collectionDescOptional: "Deskripsi (Opsional)",
    collectionDescPlaceholder: "Kategori materi untuk topik tertentu",

    // Dialogs: Manage Collection
    manageCollectionsDialogTitle: "Kelola Koleksi",
    manageCollectionsFor: "Materi: {title}",
    noCollectionsYet: "Belum ada koleksi yang dibuat.",

    // Sources View
    sourcesViewTitle: "Sumber",
    sourcesViewSubtitle: "Kumpulan dokumen, tautan riset web, dan referensi belajar Anda.",
    searchSourcesPlaceholder: "Cari sumber referensi...",
    addSourceBtn: "Tambah Sumber",
    noSavedSourcesTitle: "Belum ada sumber tersimpan",
    noSavedSourcesDesc: "Tautkan artikel web, berkas PDF, dokumen markdown, atau catatan riset ke dalam notebook belajar Anda untuk mulai melakukan penalaran berbasis bukti dengan agen AI.",
    openSidebar: "Buka sidebar",
    openSidebarKeyboard: "Buka sidebar (Ctrl+B)",
    closeSidebar: "Tutup sidebar",
    closeSidebarKeyboard: "Tutup sidebar (Ctrl+B)",
    open: "Buka",
    newCollectionDefaultName: "Koleksi Baru",

    // Auth & App
    reopenLoginTab: "Buka Kembali Tab Login",
    reopenLoginPage: "Buka Kembali Halaman Masuk",
    signInConstLearn: "Masuk ke Const Learn",
    signInSubtitle: "Masuk untuk mulai meriset dan belajar dengan AI agent native — tanpa konfigurasi rumit.",

    // Settings
    backToLearns: "Kembali ke Learns",
    preferences: "Preferensi",
    generalSettings: "Pengaturan Umum",
    generalSettingsSubtitle: "Kelola profil pengguna, status sesi belajar, dan konfigurasi lingkungan sistem.",
    appearanceSubtitle: "Sesuaikan tema tampilan antarmuka sesuai dengan kenyamanan visual Anda.",
    connectedAccount: "Akun Terhubung",
    systemRuntime: "Sistem & Runtime",
    application: "Aplikasi",
    localDatabase: "Database Lokal",
    authenticatedSso: "Terautentikasi (Const Hub SSO)",
    interfaceTheme: "Tema Antarmuka",
    themeSystemDesc: "Ikuti tema OS",
    themeLightDesc: "Kanvas #f8f8f8",
    themeDarkDesc: "Kanvas #161616 (Studio)",
    aiModelsSubtitle: "Pilih model AI bawaan atau atur router penalaran yang digunakan selama proses belajar.",
    activeModelChanged: "Model aktif diubah menjadi {modelId}",

    // Tools & Execution Trace
    socraticQuestion: "Pertanyaan Socrates",
    inquiry: "Inkuiri",
    answered: "Terjawab",
    waitingForChoice: "Menunggu Pilihan Anda",
    waitingForChoiceShort: "Menunggu Pilihan",
    choiceLabel: "Pilihan:",
    answerLabel: "Jawaban:",
    customAnswerPlaceholder: "Atau ketik pemikiran / jawaban Anda sendiri...",
    sendCustomAnswer: "Kirim Jawaban Kustom",
    calculation: "Perhitungan",
    calculating: "Menghitung...",
    running: "Menjalankan...",
    completed: "Selesai",
    failed: "Gagal",
    details: "Detail",
    closeDetail: "Tutup",
    output: "Output",
    view: "Lihat",
    generatedChart: "Grafik Dihasilkan:",
    chart: "Grafik:",
    openFile: "Buka Berkas",
    pythonCodeExecuted: "Kode Python Dieksekusi:",
    commandLabel: "Perintah:",
    stdoutOutput: "Keluaran (stdout):",
    noOutput: "Tidak ada keluaran",
    inputParams: "Parameter Input:",
    executionResult: "Hasil Eksekusi:",
    studyRoadmap: "Roadmap Belajar",
    studyRoadmapAndTasks: "Rencana Belajar & Tugas",
    tasksCompleted: "{completed}/{total} Selesai",
    viewRoadmap: "Lihat Roadmap",
    taskItem: "Tugas {number}",
    sourceFileFallback: "Berkas Sumber",
    fileActionEdit: "Ubah",
    fileActionCreate: "Buat",
    howToProceedFallback: "Bagaimana Anda ingin melanjutkan?",

    // Markdown & Code Blocks
    copyCode: "Salin Kode",
    copy: "Salin",
    copiedBadge: "Tersalin",
    copyTsv: "Salin Tabel (TSV)",
    copyTsvShort: "Salin TSV",
    downloadCsv: "Unduh CSV",
    expandView: "Perbesar Tampilan",
    tableCopied: "Tabel Disalin",
    dataTable: "Tabel Data",
    tableRowsCols: "({rows} baris, {cols} kolom)",
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

const STORAGE_KEY = "const_learn_language";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "id" || saved === "en") return saved;
    } catch {}
    return "en"; // English by default
  });

  const setLanguage = (newLang: Language) => {
    setLanguageState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
      window.dispatchEvent(new CustomEvent("const-language-change", { detail: newLang }));
    } catch {}
  };

  useEffect(() => {
    const handleCustomChange = (e: Event) => {
      const customEvent = e as CustomEvent<Language>;
      if (customEvent.detail && (customEvent.detail === "en" || customEvent.detail === "id")) {
        setLanguageState(customEvent.detail);
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === "en" || e.newValue === "id")) {
        setLanguageState(e.newValue);
      }
    };

    window.addEventListener("const-language-change", handleCustomChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("const-language-change", handleCustomChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    const dict = translations[language] || translations.en;
    let text: string = (dict as any)[key] || (translations.en as any)[key] || key;

    if (params) {
      for (const [paramKey, paramVal] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(paramVal));
      }
    }

    return text;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);
  if (!context) {
    return {
      language: "en",
      setLanguage: () => {},
      t: (key: TranslationKey, params?: Record<string, string | number>) => {
        let text: string = (translations.en as any)[key] || key;
        if (params) {
          for (const [pKey, pVal] of Object.entries(params)) {
            text = text.replace(new RegExp(`\\{${pKey}\\}`, "g"), String(pVal));
          }
        }
        return text;
      },
    };
  }
  return context;
}
