import { en } from "./en";
import { id } from "./id";
import { ja } from "./ja";
import { zh } from "./zh";
import { es } from "./es";
import type { TranslationDictionary, SupportedLanguage } from "./types";

export * from "./types";

export const translations: Record<SupportedLanguage, TranslationDictionary> = {
  en,
  id,
  ja,
  zh,
  es,
};

export const DEFAULT_LANGUAGE: SupportedLanguage = "en";
