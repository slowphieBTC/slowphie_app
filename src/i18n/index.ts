import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en/translation.json';
import fr from './locales/fr/translation.json';
import zh from './locales/zh/translation.json';
import es from './locales/es/translation.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, fr: { translation: fr }, zh: { translation: zh }, es: { translation: es } },
    fallbackLng: 'en',
    defaultNS: 'translation',
    supportedLngs: ['en', 'fr', 'zh', 'es'],
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    } as object,
    interpolation: { escapeValue: false },
  });

export default i18n;
