import { en, type Copy, type CopyKey } from "./en";
import { id } from "./id";
import { ja } from "./ja";
import { zh } from "./zh";
import { es } from "./es";

export type Locale = "en" | "id" | "ja" | "zh" | "es";

export const LOCALES: { code: Locale; label: string }[] = [
  { code: "en", label: "English" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "中文" },
  { code: "es", label: "Español" },
];

export const DICTIONARIES: Record<Locale, Copy> = { en, id, ja, zh, es };

export const DEFAULT_LOCALE: Locale = "en";

export const STORAGE_KEY = "const_harness_locale";

export type { Copy, CopyKey };
