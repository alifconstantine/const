/** Release profiles verified against the upstream tagged CLI parsers, not marketing pages. */
export const ARTCRAFT_APPS = {
  photocraft: {
    keywords: "Raster image photo editing layers PSD PNG JPEG",
    name: "PhotoCraft",
    version: "0.16.0",
    roots: true,
  },
  vectorcraft: {
    keywords: "Vector illustration SVG paths logos and icons",
    name: "VectorCraft",
    version: "0.17.0",
    roots: true,
  },
  filmcraft: {
    keywords: "Video editing film timeline sequences and media",
    name: "FilmCraft",
    version: "0.13.0",
    roots: false,
  },
  lightcraft: {
    keywords: "Photo library RAW development exposure and image export",
    name: "LightCraft",
    version: "0.14.0",
    roots: false,
  },
  pdfcraft: {
    keywords: "PDF documents pages text merge split and export",
    name: "PdfCraft",
    version: "0.14.0",
    roots: true,
  },
  effectcraft: {
    keywords: "Motion graphics animation compositions VFX rendering",
    name: "EffectCraft",
    version: "0.17.0",
    roots: true,
  },
  designcraft: {
    keywords: "Page layout publishing magazines text frames and documents",
    name: "DesignCraft",
    version: "0.13.0",
    roots: true,
  },
  figcraft: {
    keywords: "UI interface design prototypes frames components and SVG",
    name: "FigCraft",
    version: "0.11.2",
    roots: true,
  },
  wordcraft: {
    keywords: "Word processing formatted documents DOCX and PDF",
    name: "WordCraft",
    version: "0.11.0",
    roots: true,
  },
  soundcraft: {
    keywords: "Audio music DAW tracks mixing WAV AIFF FLAC",
    name: "SoundCraft",
    version: "0.13.1",
    roots: true,
  },
  deckcraft: {
    keywords: "Presentations slides decks PPTX PDF and PNG",
    name: "DeckCraft",
    version: "0.11.1",
    roots: true,
  },
  cadcraft: {
    keywords: "CAD drafting geometry drawings DXF and DWG",
    name: "CADCraft",
    version: "0.13.0",
    roots: false,
  },
  gridcraft: {
    keywords: "Spreadsheets Excel XLSX CSV sheets cells formulas and charts",
    name: "GridCraft",
    version: "0.12.1",
    roots: false,
  },
} as const;
export type ArtCraftApp = keyof typeof ARTCRAFT_APPS;
export const ARTCRAFT_IDS = Object.keys(ARTCRAFT_APPS) as ArtCraftApp[];
export function isArtCraftApp(value: unknown): value is ArtCraftApp {
  return typeof value === "string" && Object.hasOwn(ARTCRAFT_APPS, value);
}
