import { useTranslation } from 'react-i18next';

export default function OpSchool() {
  const { t } = useTranslation();
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
      <p className="text-slate-400 text-lg">OpSchool — {t('common.loading')}</p>
    </div>
  );
}
