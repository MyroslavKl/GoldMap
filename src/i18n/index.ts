import { getLocales } from 'expo-localization';
import i18n, { changeLanguage } from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';

import { setSetting } from '@/db';
import { dbContext } from '@/db/client';

import en from './en.json';
import uk from './uk.json';

export const SUPPORTED_LANGUAGES = ['uk', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

const FALLBACK: Language = 'en';

function isSupported(code: string | null | undefined): code is Language {
  return !!code && (SUPPORTED_LANGUAGES as readonly string[]).includes(code);
}

/** Перша підтримувана мова з налаштувань системи, інакше англійська. */
export function getDeviceLanguage(): Language {
  for (const locale of getLocales()) {
    if (isSupported(locale.languageCode)) return locale.languageCode;
  }
  return FALLBACK;
}

export const resources = {
  en: { translation: en },
  uk: { translation: uk },
} as const;

// eslint-disable-next-line import/no-named-as-default-member -- i18next інстанс-API
void i18n.use(initReactI18next).init({
  resources,
  lng: getDeviceLanguage(),
  fallbackLng: FALLBACK,
  supportedLngs: SUPPORTED_LANGUAGES,
  interpolation: { escapeValue: false },
  returnNull: false,
});

/** Застосувати мову без збереження (наприклад, збережену при старті). */
export function applyLanguage(lang: Language): Promise<unknown> {
  return changeLanguage(lang);
}

/** Змінити мову інтерфейсу і зберегти вибір у таблиці `settings`. */
export async function setLanguage(lang: Language): Promise<void> {
  await applyLanguage(lang);
  await setSetting(dbContext, 'language', lang);
}

export default i18n;

/** Поточна мова інтерфейсу як тип Language (для назв країн name.uk / name.en). */
export function useLanguage(): Language {
  const { i18n: instance } = useTranslation();
  const lang = instance.resolvedLanguage;
  return lang === 'uk' || lang === 'en' ? lang : FALLBACK;
}
