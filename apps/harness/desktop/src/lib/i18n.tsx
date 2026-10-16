import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { translations, DEFAULT_LANGUAGE, type SupportedLanguage, type TranslationDictionary } from "../locales";

export type { SupportedLanguage, TranslationDictionary };

export const LANGUAGE_STORAGE_KEY = "const_app_language";

export type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`;
}[keyof ObjectType & (string | number)];

export type TranslationKey = NestedKeyOf<TranslationDictionary>;

let currentGlobalLanguage: SupportedLanguage = (() => {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) as SupportedLanguage | null;
  if (saved && (saved === "en" || saved === "id" || saved === "ja" || saved === "zh" || saved === "es")) {
    return saved;
  }
  return DEFAULT_LANGUAGE;
})();

export function getGlobalLanguage(): SupportedLanguage {
  return currentGlobalLanguage;
}

export function setGlobalLanguage(lang: SupportedLanguage): void {
  currentGlobalLanguage = lang;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
      window.dispatchEvent(new CustomEvent("const-language-changed", { detail: lang }));
    } catch {}
  }
}

function resolveTranslation(
  dict: TranslationDictionary,
  path: string
): string | undefined {
  const parts = path.split(".");
  let current: any = dict;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return typeof current === "string" ? current : undefined;
}

export function translate(
  key: TranslationKey | (string & {}),
  params?: Record<string, string | number>,
  lang: SupportedLanguage = currentGlobalLanguage
): string {
  const activeDict = translations[lang] || translations[DEFAULT_LANGUAGE];
  const fallbackDict = translations[DEFAULT_LANGUAGE];

  let text = resolveTranslation(activeDict, key) ?? resolveTranslation(fallbackDict, key) ?? key;

  if (params && typeof text === "string") {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }

  return text;
}

export const t = translate;

export interface I18nContextValue {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: TranslationKey | (string & {}), params?: Record<string, string | number>) => string;
  dictionary: TranslationDictionary;
}

const I18nContext = createContext<I18nContextValue>({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  t: translate,
  dictionary: translations[DEFAULT_LANGUAGE],
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    if (typeof window === "undefined") return DEFAULT_LANGUAGE;
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) as SupportedLanguage | null;
    if (saved && (saved === "en" || saved === "id" || saved === "ja" || saved === "zh" || saved === "es")) {
      return saved;
    }
    return DEFAULT_LANGUAGE;
  });

  const setLanguage = useCallback((newLang: SupportedLanguage) => {
    setLanguageState(newLang);
    setGlobalLanguage(newLang);
  }, []);

  useEffect(() => {
    const handleCustomChange = (e: Event) => {
      const customEvent = e as CustomEvent<SupportedLanguage>;
      if (customEvent.detail && customEvent.detail !== language) {
        setLanguageState(customEvent.detail);
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === LANGUAGE_STORAGE_KEY && e.newValue) {
        const next = e.newValue as SupportedLanguage;
        if (next === "en" || next === "id" || next === "ja" || next === "zh" || next === "es") {
          setLanguageState(next);
          currentGlobalLanguage = next;
        }
      }
    };

    window.addEventListener("const-language-changed", handleCustomChange);
    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("const-language-changed", handleCustomChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [language]);

  const dictionary = useMemo(() => {
    return translations[language] || translations[DEFAULT_LANGUAGE];
  }, [language]);

  const tBound = useCallback(
    (key: TranslationKey | (string & {}), params?: Record<string, string | number>) => {
      return translate(key, params, language);
    },
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: tBound,
      dictionary,
    }),
    [language, setLanguage, tBound, dictionary]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  return useContext(I18nContext);
}

export const useI18n = useTranslation;
