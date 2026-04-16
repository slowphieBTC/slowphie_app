import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export interface ModuleTranslation {
  card: {
    title: string;
    subtitle: string;
    description: string;
    difficulty: string;
    keyTopics: string[];
  };
  quiz: Array<{
    question: string;
    options: string[];
    explanation: string;
  }>;
  content: string;
}

export function useModuleTranslation(moduleId: number): ModuleTranslation | null {
  const { i18n } = useTranslation();
  const [data, setData] = useState<ModuleTranslation | null>(null);

  useEffect(() => {
    const lang = ['en', 'fr', 'zh', 'es'].includes(i18n.language) ? i18n.language : 'en';
    import(`../i18n/school/${lang}/module${moduleId}.json`)
      .catch(() => import(`../i18n/school/en/module${moduleId}.json`))
      .then(m => setData(m.default as ModuleTranslation))
      .catch(() => setData(null));
  }, [moduleId, i18n.language]);

  return data;
}
