'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Locale = 'en' | 'id';

export interface Translations {
  nav: {
    download: string;
    toggleTheme: string;
  };
  hero: {
    headline: string;
    lead: string;
    subheadings: string[];
    ctaDownload: string;
    ctaExplore: string;
    playIntro: string;
  };
  brief: {
    tag: string;
    statement: string;
  };
  features: {
    badge: string;
    title: string;
    subtitle: string;
    items: {
      tag: string;
      title: string;
      desc: string;
      mediaType: 'image' | 'video';
      mediaSrc: string;
    }[];
  };
  cta: {
    title: string;
    subtitle: string;
    btnWin: string;
    btnArm: string;
    btnOther: string;
    note: string;
  };
  faq: {
    tag: string;
    title: string;
    subtitle: string;
    items: {
      index: string;
      q: string;
      a: string;
    }[];
  };
  footer: {
    colProduct: string;
    colPlatform: string;
    colCapabilities: string;
    colEcosystem: string;
    colResources: string;
    colCompany: string;
    copyright: string;
    privacy: string;
    terms: string;
    langLabel: string;
  };
  downloadPage: {
    badge: string;
    title: string;
    subtitle: string;
    tabDesktop: string;
    tabMobile: string;
    detectedBadge: string;
    winTitle: string;
    winDesc: string;
    winReq: string;
    macTitle: string;
    macDesc: string;
    macReq: string;
    linuxTitle: string;
    linuxDesc: string;
    linuxReq: string;
    androidTitle: string;
    androidDesc: string;
    androidReq: string;
    iosTitle: string;
    iosDesc: string;
    iosReq: string;
    btnDownload: string;
    btnDirectApk: string;
    btnPlayStore: string;
    btnAppStore: string;
    btnTestFlight: string;
    checksumLabel: string;
    releaseNotesLabel: string;
    modalTitle: string;
    modalSubtitle: string;
    modalStep1: string;
    modalStep2: string;
    modalStep3: string;
    modalSha: string;
    modalClose: string;
    modalTrouble: string;
    modalGithub: string;
  };
}

const translations: Record<Locale, Translations> = {
  en: {
    nav: {
      download: 'Download',
      toggleTheme: 'Toggle theme',
    },
    hero: {
      headline: 'Understand Anything',
      lead: 'The active AI research and interactive learning studio for students, researchers, and developers.',
      subheadings: [
        'Turn raw text into AI video summaries',
        'Convert complex notes into presentation slides',
        'Transform documents into interactive simulations',
        'Think deeper with Socratic AI dialogue',
        'Visualize mathematical models and live code',
      ],
      ctaDownload: 'Download Const Learn',
      ctaExplore: 'Explore features',
      playIntro: 'Play video demo',
    },
    brief: {
      tag: 'THE ACTIONABLE LEARNING PLATFORM',
      statement:
        'Const Learn is an adaptive AI research and interactive learning hub, designed to help students, developers, and researchers master any concept with native agent tools and living canvases.',
    },
    features: {
      badge: 'Core Capabilities',
      title: 'Architected for deep, actionable comprehension',
      subtitle:
        'From raw sources to living interactive canvases, Const Learn bridges the gap between passive reading and active mastery.',
      items: [
        {
          tag: 'SOURCE AGNOSTIC',
          title: 'Learn From Any Source',
          desc: 'Ingest knowledge seamlessly from PDFs, DOCX, web URLs, YouTube video transcripts, live web search, or raw clipboard text. Const Learn parses and structures citations automatically.',
          mediaType: 'image',
          mediaSrc: '/assets/image/product/new-chat.png',
        },
        {
          tag: 'NATIVE AGENT',
          title: 'Single Native Agent Core',
          desc: 'Equipped with a built-in terminal runner, local Python uv sandbox, ripgrep semantic codebase search, and an approval gate. Real execution for real learning.',
          mediaType: 'image',
          mediaSrc: '/assets/image/landing/interactive-terminal.png',
        },
        {
          tag: 'STUDIO CANVAS',
          title: 'Living Visual Hyperframe Studio',
          desc: 'Generate interactive D3 charts, responsive HTML slide decks, runnable math visualizers, and export to industry-standard PowerPoint presentations instantly.',
          mediaType: 'video',
          mediaSrc: '/assets/video/landing/an-ai-ide-core.mp4',
        },
        {
          tag: 'EXTENSIBILITY',
          title: 'Extensible MCP Ecosystem & Cloud Sandbox',
          desc: 'Seamlessly connect external skills, Composio Cloud Code Interpreter for mobile companion execution, and custom developer MCP tools without recompilation.',
          mediaType: 'image',
          mediaSrc: '/assets/image/landing/feature-3.jpg',
        },
        {
          tag: 'INTELLIGENCE FREEDOM',
          title: 'Zero-Config AI + Bring Your Own Key',
          desc: 'Start instantly with high-speed Google Gemini 2.5 Flash via Const Router without credit cards, or plug in your personal OpenAI, Claude 3.7 Sonnet, DeepSeek, or local Ollama endpoints.',
          mediaType: 'image',
          mediaSrc: '/assets/image/landing/landing-thumbnail-fullstack.jpg',
        },
      ],
    },
    cta: {
      title: 'Experience liftoff with Const Learn',
      subtitle: 'The modern agentic research and learning hub. Ready for your workflow.',
      btnWin: 'Download for x64',
      btnArm: 'Download for ARM64',
      btnOther: 'All platforms',
      note: 'Free to start · No credit card required · Open Architecture',
    },
    faq: {
      tag: 'FREQUENTLY ASKED QUESTIONS',
      title: 'Common questions, transparent answers',
      subtitle:
        'Everything you need to know about Const Learn, its native agent engine, and educational capabilities.',
      items: [
        {
          index: '01',
          q: 'What is Const Learn?',
          a: 'Const Learn is an Actionable AI Research, Native Learning Agent, & Interactive Learning Hub. Unlike passive chatbots, it pairs multi-document adaptive research with an active Socratic tutor, local tool execution, and the Hyperframe living canvas.',
        },
        {
          index: '02',
          q: 'Is Const Learn free to use?',
          a: 'Yes! Every learner receives free daily access to Google Gemini 2.5 Flash through our managed Const Router without needing a credit card or your own API key.',
        },
        {
          index: '03',
          q: 'How does the Dual-Tier Desktop vs Mobile execution work?',
          a: 'On Desktop, Const Learn runs with full native local execution (terminal runner, local Python uv sandbox, ripgrep). On Mobile, it seamlessly shifts to a secure Composio Cloud Sandbox container to run code and files in the cloud.',
        },
        {
          index: '04',
          q: 'What is BYOK (Bring Your Own Key)?',
          a: 'Power users can bring their personal API keys from OpenAI, Anthropic (Claude 3.7 Sonnet), DeepSeek, or connect to private local models via Ollama. BYOK requests bypass the free daily quota and route directly.',
        },
        {
          index: '05',
          q: 'What tools and capabilities does the native agent have?',
          a: 'The agent can run shell commands, execute Python data analysis scripts, search local files with ripgrep, build interactive D3 visualizations, format slide decks, and invoke external MCP tools with user approval gates.',
        },
        {
          index: '06',
          q: 'How is my system protected during code execution?',
          a: 'Const Learn features a strict Approval Gate (Trust Manager). Every terminal command or filesystem mutation requires explicit user confirmation before execution.',
        },
      ],
    },
    footer: {
      colProduct: 'Product',
      colPlatform: 'Platform',
      colCapabilities: 'Capabilities',
      colEcosystem: 'Ecosystem',
      colResources: 'Resources',
      colCompany: 'Company',
      copyright: '© 2026 Const Platform, Inc. · Apache-2.0',
      privacy: 'Privacy Policy',
      terms: 'Terms of Service',
      langLabel: 'English',
    },
    downloadPage: {
      badge: 'OFFICIAL BUILDS',
      title: 'Download Const Learn',
      subtitle: 'Native active research and interactive learning hub on your local machine and mobile device.',
      tabDesktop: 'Desktop Powerhouse',
      tabMobile: 'Mobile Companion',
      detectedBadge: 'Recommended for your device',
      winTitle: 'Windows',
      winDesc: '64-bit installer with native uv Python sandbox, ripgrep engine, and hardware-accelerated WebGL studio.',
      winReq: 'Windows 10/11 (64-bit) · 4GB RAM · 500MB disk',
      macTitle: 'macOS',
      macDesc: 'Universal binary optimized for Apple Silicon (M1/M2/M3/M4) and Intel with Metal hardware acceleration.',
      macReq: 'macOS 12.0 Monterey or later · Apple Silicon / Intel',
      linuxTitle: 'Linux',
      linuxDesc: 'AppImage and Debian package with full offline agent capabilities and system terminal bridge.',
      linuxReq: 'glibc 2.31+ (Ubuntu 20.04+, Debian 11+, Fedora 36+)',
      androidTitle: 'Android',
      androidDesc: 'Standalone APK build with local model cache, interactive lesson sync, and voice dialogue.',
      androidReq: 'Android 10.0 (API 29) or higher · ARM64-v8a',
      iosTitle: 'iOS & iPadOS',
      iosDesc: 'Optimized touch interface for iPad split-screen learning and iPhone pocket study buddy.',
      iosReq: 'iOS 15.0 or iPadOS 15.0 or higher',
      btnDownload: 'Download',
      btnDirectApk: 'Download APK (.apk)',
      btnPlayStore: 'Google Play Store',
      btnAppStore: 'App Store (Coming Soon)',
      btnTestFlight: 'Join TestFlight Beta',
      checksumLabel: 'SHA-256 Checksum',
      releaseNotesLabel: 'Release Notes (v0.1.0)',
      modalTitle: 'Thank you for downloading Const Learn!',
      modalSubtitle: 'Your download should begin automatically. Follow the steps below to finish installation.',
      modalStep1: 'Open the downloaded installer from your browser or Downloads folder.',
      modalStep2: 'Follow the on-screen setup wizard to install Const Learn on your system.',
      modalStep3: 'Launch Const Learn and start mastering concepts with native agent intelligence.',
      modalSha: 'Verified SHA-256 checksum:',
      modalClose: 'Close',
      modalTrouble: 'Trouble with the download?',
      modalGithub: 'Visit GitHub Releases',
    },
  },
  id: {
    nav: {
      download: 'Unduh',
      toggleTheme: 'Ganti tema',
    },
    hero: {
      headline: 'Understand Anything',
      lead: 'Studio riset AI aktif dan pembelajaran interaktif untuk pelajar, peneliti, dan pengembang.',
      subheadings: [
        'Ubah teks Anda jadi ringkasan video',
        'Ubah catatan kompleks jadi slide presentasi',
        'Ubah dokumen Anda jadi simulasi interaktif',
        'Asah pemahaman dengan dialog Socrates AI',
        'Visualisasikan model matematika & kode interaktif',
      ],
      ctaDownload: 'Unduh Const Learn',
      ctaExplore: 'Jelajahi fitur',
      playIntro: 'Putar video demo',
    },
    brief: {
      tag: 'PLATFORM RISET & EDUKASI NATIVE',
      statement:
        'Const Learn adalah hub riset AI adaptif dan pembelajaran interaktif, dirancang untuk membantu pelajar, pengembang, dan peneliti menguasai konsep apa pun melalui alat agen native dan kanvas interaktif.',
    },
    features: {
      badge: 'Kapabilitas Utama',
      title: 'Dirancang untuk pemahaman nyata yang mendalam',
      subtitle:
        'Dari dokumen mentah hingga kanvas interaktif hidup, Const Learn menghubungkan riset pasif menuju penguasaan aktif.',
      items: [
        {
          tag: 'SUMBER APAPUN',
          title: 'Pelajari dari Sumber Mana Saja',
          desc: 'Impor materi belajar dengan mudah dari dokumen PDF, DOCX, tautan web, transkrip video YouTube, pencarian web langsung, hingga tempel teks bebas. Const Learn mengekstrak dan menstrukturkan sitasi secara otomatis.',
          mediaType: 'image',
          mediaSrc: '/assets/image/product/new-chat.png',
        },
        {
          tag: 'AGEN NATIVE',
          title: 'Inti Agen Native Berkemampuan Nyata',
          desc: 'Ditenagai terminal runner bawaan, runtime Python uv lokal, pencarian semantik ripgrep, dan gerbang persetujuan keamanan. Eksekusi nyata untuk pemahaman nyata.',
          mediaType: 'image',
          mediaSrc: '/assets/image/landing/interactive-terminal.png',
        },
        {
          tag: 'STUDIO KANVAS',
          title: 'Studio Kanvas Interaktif Hyperframe',
          desc: 'Hasilkan diagram interaktif D3, slide presentasi HTML responsif, simulator matematika yang dapat dijalankan, dan ekspor materi ke PowerPoint standar industri.',
          mediaType: 'video',
          mediaSrc: '/assets/video/landing/an-ai-ide-core.mp4',
        },
        {
          tag: 'EKSTENSIBILITAS',
          title: 'Ekosistem MCP Terbuka & Cloud Sandbox',
          desc: 'Hubungkan skill modular, eksekusi container awan via Composio Sandbox untuk mobile, serta integrasikan tool MCP kustom tanpa perlu mengompilasi ulang.',
          mediaType: 'image',
          mediaSrc: '/assets/image/landing/feature-3.jpg',
        },
        {
          tag: 'KEBEBASAN MODEL',
          title: 'AI Gratis Siap Pakai & BYOK',
          desc: 'Mulai belajar seketika dengan Google Gemini 2.5 Flash berkecepatan tinggi via Const Router tanpa kartu kredit, atau gunakan API Key pribadi untuk Claude 3.7 Sonnet, GPT-4o, DeepSeek, hingga Ollama lokal.',
          mediaType: 'image',
          mediaSrc: '/assets/image/landing/landing-thumbnail-fullstack.jpg',
        },
      ],
    },
    cta: {
      title: 'Mulai perjalanan belajar dengan Const Learn',
      subtitle: 'Platform riset dan agen edukasi modern. Siap mendukung cara belajar Anda.',
      btnWin: 'Unduh untuk x64',
      btnArm: 'Unduh untuk ARM64',
      btnOther: 'Semua platform',
      note: 'Gratis untuk memulai · Tanpa kartu kredit · Arsitektur Terbuka',
    },
    faq: {
      tag: 'PERTANYAAN UMUM',
      title: 'Pertanyaan umum, jawaban transparan',
      subtitle:
        'Segala hal yang perlu Anda ketahui tentang Const Learn, mesin agen native, dan kapabilitas belajarnya.',
      items: [
        {
          index: '01',
          q: 'Apa itu Const Learn?',
          a: 'Const Learn adalah platform Actionable AI Research, Native Learning Agent, dan Interactive Learning Hub. Menggabungkan riset multi-dokumen adaptif dengan bimbingan tutor interaktif Socrates, eksekusi alat nyata, dan kanvas hidup Hyperframe.',
        },
        {
          index: '02',
          q: 'Apakah Const Learn gratis digunakan?',
          a: 'Ya! Setiap pengguna langsung mendapatkan kuota harian gratis untuk model cerdas Google Gemini 2.5 Flash melalui Const Router tanpa perlu memiliki kartu kredit atau API key sendiri.',
        },
        {
          index: '03',
          q: 'Bagaimana cara kerja eksekusi Desktop vs Mobile?',
          a: 'Di Desktop, Const Learn berjalan dengan eksekusi lokal penuh (terminal runner, Python uv lokal, ripgrep). Di smartphone/mobile, sistem beralih otomatis ke container awan Composio Sandbox yang aman.',
        },
        {
          index: '04',
          q: 'Apa itu fitur BYOK (Bring Your Own Key)?',
          a: 'Pengguna tingkat lanjut dapat memasukkan API Key pribadi (OpenAI GPT-4o, Claude 3.7 Sonnet, DeepSeek V3) atau menghubungkan model lokal pribadi via Ollama tanpa memotong kuota harian platform.',
        },
        {
          index: '05',
          q: 'Alat dan kapabilitas apa saja yang dimiliki agen?',
          a: 'Agen dapat menjalankan perintah shell, mengeksekusi skrip analisis data Python, mencari berkas dengan ripgrep, merender visualisasi matematika interaktif D3, menyusun slide presentasi, dan memanggil tools MCP.',
        },
        {
          index: '06',
          q: 'Bagaimana keamanan sistem saya terlindungi?',
          a: 'Const Learn menerapkan Approval Gate ketat. Setiap perintah terminal atau modifikasi berkas di sistem lokal memerlukan persetujuan eksplisit dari Anda sebelum dieksekusi.',
        },
      ],
    },
    footer: {
      colProduct: 'Produk',
      colPlatform: 'Platform',
      colCapabilities: 'Kemampuan',
      colEcosystem: 'Ekosistem',
      colResources: 'Sumber Daya',
      colCompany: 'Perusahaan',
      copyright: '© 2026 Const Platform, Inc. · Apache-2.0',
      privacy: 'Kebijakan Privasi',
      terms: 'Syarat & Ketentuan',
      langLabel: 'Indonesia',
    },
    downloadPage: {
      badge: 'RILIS RESMI',
      title: 'Unduh Const Learn',
      subtitle: 'Hub riset aktif dan pembelajaran adaptif interaktif langsung di komputer dan gawai Anda.',
      tabDesktop: 'Desktop Powerhouse',
      tabMobile: 'Mobile Companion',
      detectedBadge: 'Rekomendasi untuk perangkat Anda',
      winTitle: 'Windows',
      winDesc: 'Installer 64-bit dilengkapi runtime Python uv lokal, mesin ripgrep, dan studio visual WebGL terakselerasi.',
      winReq: 'Windows 10/11 (64-bit) · RAM 4GB · Ruang disk 500MB',
      macTitle: 'macOS',
      macDesc: 'Universal binary teroptimasi untuk Apple Silicon (M1/M2/M3/M4) dan Intel dengan akselerasi Metal.',
      macReq: 'macOS 12.0 Monterey atau lebih baru · Apple Silicon / Intel',
      linuxTitle: 'Linux',
      linuxDesc: 'Paket AppImage dan Debian dengan kapabilitas agen offline penuh serta jembatan terminal sistem.',
      linuxReq: 'glibc 2.31+ (Ubuntu 20.04+, Debian 11+, Fedora 36+)',
      androidTitle: 'Android',
      androidDesc: 'Berkas APK langsung dengan cache model lokal, sinkronisasi materi interaktif, dan dialog suara.',
      androidReq: 'Android 10.0 (API 29) atau lebih tinggi · ARM64-v8a',
      iosTitle: 'iOS & iPadOS',
      iosDesc: 'Antarmuka sentuh adaptif untuk split-screen iPad dan partner belajar saku di iPhone Anda.',
      iosReq: 'iOS 15.0 atau iPadOS 15.0 atau lebih baru',
      btnDownload: 'Unduh',
      btnDirectApk: 'Unduh APK (.apk)',
      btnPlayStore: 'Google Play Store',
      btnAppStore: 'App Store (Segera Hadir)',
      btnTestFlight: 'Gabung TestFlight Beta',
      checksumLabel: 'Checksum SHA-256',
      releaseNotesLabel: 'Catatan Rilis (v0.1.0)',
      modalTitle: 'Terima kasih telah mengunduh Const Learn!',
      modalSubtitle: 'Unduhan Anda akan dimulai secara otomatis. Ikuti panduan singkat berikut untuk pemasangan.',
      modalStep1: 'Buka installer yang telah diunduh dari browser atau folder Downloads Anda.',
      modalStep2: 'Ikuti panduan instalasi di layar untuk memasang Const Learn di sistem Anda.',
      modalStep3: 'Buka Const Learn dan mulailah belajar mendalam bersama kecerdasan agen native.',
      modalSha: 'Checksum SHA-256 terverifikasi:',
      modalClose: 'Tutup',
      modalTrouble: 'Mengalami kendala saat mengunduh?',
      modalGithub: 'Kunjungi GitHub Releases',
    },
  },
};

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    const saved = localStorage.getItem('const_learn_locale') as Locale | null;
    if (saved && (saved === 'en' || saved === 'id')) {
      setLocaleState(saved);
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('const_learn_locale', newLocale);
  };

  const toggleLocale = () => {
    const next = locale === 'en' ? 'id' : 'en';
    setLocale(next);
  };

  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        toggleLocale,
        t: translations[locale],
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
