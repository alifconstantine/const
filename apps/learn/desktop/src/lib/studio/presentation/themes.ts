export interface PresentationTheme {
  id: string;
  name: string;
  nameId: string;
  description: string;
  descriptionId: string;
  fontDisplay: string;
  fontBody: string;
  fontMono: string;
  colors: {
    bg: string;
    surface: string;
    surfaceElevated: string;
    fg: string;
    fgMuted: string;
    border: string;
    accent: string;
    accentForeground: string;
    cardBg: string;
  };
  borderRadius: string; // e.g. "0px", "8px", "16px"
  isLight?: boolean;
}

export const PRESENTATION_THEMES: PresentationTheme[] = [
  {
    id: "const-dark",
    name: "Const Dark Studio",
    nameId: "Const Dark Studio",
    description: "Signature dark studio palette with crisp sky blue accents and refined rounded cards.",
    descriptionId: "Palet studio gelap khas Const dengan aksen biru langit dan kartu membulat elegan.",
    fontDisplay: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontBody: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontMono: '"JetBrains Mono", ui-monospace, Menlo, monospace',
    colors: {
      bg: "#161616",
      surface: "#222222",
      surfaceElevated: "#2b2b2b",
      fg: "#ffffff",
      fgMuted: "#969696",
      border: "#383838",
      accent: "#38bdf8",
      accentForeground: "#0a0a0a",
      cardBg: "#222222",
    },
    borderRadius: "12px",
    isLight: false,
  },
  {
    id: "swiss",
    name: "Swiss International",
    nameId: "Swiss International",
    description: "Rational 16-column grid with strict 0px radius, 1px hairline borders, and Klein Blue IKB.",
    descriptionId: "Kisi 16-kolom rasional, sudut siku 0px mutlak, garis hairline 1px, dan aksen Klein Blue.",
    fontDisplay: '"Inter Tight", Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    fontBody: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    fontMono: '"JetBrains Mono", monospace',
    colors: {
      bg: "#fafaf8",
      surface: "#ffffff",
      surfaceElevated: "#f2f0e9",
      fg: "#0a0a0a",
      fgMuted: "#666666",
      border: "#0a0a0a",
      accent: "#002FA7",
      accentForeground: "#ffffff",
      cardBg: "#ffffff",
    },
    borderRadius: "0px",
    isLight: true,
  },
  {
    id: "editorial",
    name: "Editorial E-Ink",
    nameId: "Editorial E-Ink (Majalah)",
    description: "Warm ivory paper, monocle ink, Playfair Display serif headlines, and quiet magazine elegance.",
    descriptionId: "Kertas gading hangat, tinta hitam pekat, tajuk serif Playfair, dan estetika majalah kurasi.",
    fontDisplay: '"Playfair Display", Georgia, "Times New Roman", serif',
    fontBody: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontMono: '"IBM Plex Mono", "JetBrains Mono", monospace',
    colors: {
      bg: "#f5f2eb",
      surface: "#faf7f2",
      surfaceElevated: "#ece7dc",
      fg: "#0a0a0b",
      fgMuted: "#726d64",
      border: "#dcd6c8",
      accent: "#0a0a0b",
      accentForeground: "#ffffff",
      cardBg: "#faf7f2",
    },
    borderRadius: "4px",
    isLight: true,
  },
  {
    id: "linear",
    name: "Linear Modern Dark",
    nameId: "Linear Modern Dark",
    description: "High-tech minimalist dark slate canvas with indigo accents and ultra-subtle hairline borders.",
    descriptionId: "Kanvas slate gelap minimalis teknologi tinggi dengan aksen indigo dan border hairline halus.",
    fontDisplay: '"Inter Tight", Inter, sans-serif',
    fontBody: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    fontMono: '"JetBrains Mono", monospace',
    colors: {
      bg: "#08090a",
      surface: "#121316",
      surfaceElevated: "#181a1f",
      fg: "#f2f4f8",
      fgMuted: "#8b949e",
      border: "#262930",
      accent: "#5e6ad2",
      accentForeground: "#ffffff",
      cardBg: "#121316",
    },
    borderRadius: "8px",
    isLight: false,
  },
  {
    id: "botanical",
    name: "Dark Botanical",
    nameId: "Dark Botanical (Sains)",
    description: "Deep forest sanctuary with emerald mint highlights, suited for science, nature, and research.",
    descriptionId: "Nuansa hutan malam yang tenang dengan aksen mint zamrud, ideal untuk sains dan riset mendalam.",
    fontDisplay: '"Playfair Display", Georgia, serif',
    fontBody: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    fontMono: '"JetBrains Mono", monospace',
    colors: {
      bg: "#0c1510",
      surface: "#14221a",
      surfaceElevated: "#1a2c22",
      fg: "#ecfdf5",
      fgMuted: "#86efac",
      border: "#234031",
      accent: "#10b981",
      accentForeground: "#062818",
      cardBg: "#14221a",
    },
    borderRadius: "14px",
    isLight: false,
  },
];

export function getTheme(id?: string): PresentationTheme {
  if (!id || id === "auto") {
    return PRESENTATION_THEMES[0]!;
  }
  const found = PRESENTATION_THEMES.find((t) => t.id === id);
  return found || PRESENTATION_THEMES[0]!;
}
