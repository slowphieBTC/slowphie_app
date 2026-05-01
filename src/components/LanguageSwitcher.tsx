import { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'en', label: 'EN', flag: '🇬🇧' },
  { code: 'fr', label: 'FR', flag: '🇫🇷' },
  { code: 'zh', label: '中',  flag: '🇨🇳' },
  { code: 'es', label: 'ES', flag: '🇪🇸' },
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language?.slice(0, 2) ?? 'en';
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const activeLang = LANGUAGES.find(l => l.code === current) ?? LANGUAGES[0];

  const select = (code: string) => {
    i18n.changeLanguage(code);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative', userSelect: 'none' }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.3rem',
          fontSize: '0.72rem', fontWeight: 700,
          padding: '0.3rem 0.55rem',
          borderRadius: '8px',
          border: open ? '1px solid rgba(247,147,26,0.4)' : '1px solid rgba(255,255,255,0.1)',
          background: open ? 'rgba(247,147,26,0.08)' : 'rgba(255,255,255,0.04)',
          color: '#f7931a',
          cursor: 'pointer',
          outline: 'none',
          transition: 'all 0.15s',
          backdropFilter: 'blur(8px)',
          whiteSpace: 'nowrap',
        }}
      >
        <span>{activeLang.flag}</span>
        <span>{activeLang.label}</span>
        <svg
          width="8" height="5" viewBox="0 0 8 5" fill="none"
          style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}
        >
          <path d="M1 1l3 3 3-3" stroke="#f7931a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: '110px',
            background: '#0d1117',
            border: '1px solid rgba(247,147,26,0.25)',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(247,147,26,0.08)',
            overflow: 'hidden',
            zIndex: 9999,
            padding: '4px',
          }}
        >
          {LANGUAGES.map(({ code, label, flag }) => {
            const isActive = current === code;
            return (
              <button
                key={code}
                role="option"
                aria-selected={isActive}
                onClick={() => select(code)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  width: '100%', padding: '0.45rem 0.75rem',
                  borderRadius: '8px', border: 'none',
                  background: isActive ? 'rgba(247,147,26,0.12)' : 'transparent',
                  color: isActive ? '#f7931a' : '#94a3b8',
                  fontSize: '0.78rem', fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'background 0.12s, color 0.12s',
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
                    (e.currentTarget as HTMLButtonElement).style.color = '#e2e8f0';
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8';
                  }
                }}
              >
                <span style={{ fontSize: '1rem' }}>{flag}</span>
                <span>{label}</span>
                {isActive && (
                  <span style={{ marginLeft: 'auto', color: '#f7931a', fontSize: '0.65rem' }}>✓</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
