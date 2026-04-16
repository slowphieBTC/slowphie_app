import { useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { GLOSSARY_TERMS } from '../../data/glossary';
import type { GlossaryTerm } from '../../types';

function Hl({ text, q }: { text: string; q: string }) {
  if (!q.trim()) return <>{text}</>;
  const esc = q.replace(/[.*+?^${}()|[\\]]/g, '\\$&');
  const rx = new RegExp('(' + esc + ')', 'gi');
  const parts = text.split(rx);
  return <>{parts.map((p, i) => rx.test(p)
    ? <mark key={i} style={{ background: 'rgba(247,147,26,0.22)', color: '#F7931A', borderRadius: '2px', padding: '0 1px' }}>{p}</mark>
    : <span key={i}>{p}</span>
  )}</>;
}

export function SchoolGlossary() {
  const { t, i18n } = useTranslation();
  const getDefinition = (term: GlossaryTerm): string => {
    const lang = i18n.language;
    if (lang === 'fr' && term.definition_fr) return term.definition_fr;
    if (lang === 'zh' && term.definition_zh) return term.definition_zh;
    if (lang === 'es' && term.definition_es) return term.definition_es;
    return term.definition;
  };
  const [search, setSearch] = useState('');
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const secRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const allLetters = useMemo(() => [...new Set(GLOSSARY_TERMS.map(t => t.letter))].sort(), []);
  const filtered = useMemo<GlossaryTerm[]>(() => {
    const q = search.trim().toLowerCase();
    if (q) return GLOSSARY_TERMS.filter(t => t.term.toLowerCase().includes(q) || getDefinition(t).toLowerCase().includes(q));
    if (activeLetter) return GLOSSARY_TERMS.filter(t => t.letter === activeLetter);
    return GLOSSARY_TERMS;
  }, [search, activeLetter]);
  const activeL = useMemo(() => new Set(filtered.map(t => t.letter)), [filtered]);
  const grouped = useMemo(() => {
    const g: Record<string, GlossaryTerm[]> = {};
    filtered.forEach(t => { (g[t.letter] = g[t.letter] ?? []).push(t); });
    return g;
  }, [filtered]);

  const jump = (l: string) => {
    if (!activeL.has(l)) return;
    setActiveLetter(l); setSearch('');
    setTimeout(() => secRefs.current[l]?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] pb-16 px-4 pt-8">
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <Link to="/school" style={{ fontSize: '0.8rem', color: '#F7931A', textDecoration: 'none', fontWeight: 600 }}>{t('glossary.backToSchool')}</Link>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white" style={{ margin: 0 }}><span className="text-gradient">{t('glossary.title')}</span></h1>
          </div>
          <p style={{ color: '#475569', margin: 0, fontSize: '0.88rem' }}>{t('glossary.subtitle')}</p>
        </motion.div>

        <div style={{ position: 'relative', marginBottom: '0.625rem' }}>
          <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1rem', pointerEvents: 'none', color: '#475569' }}>\uD83D\uDD0D</span>
          <input ref={inputRef} type="text" value={search} onChange={e => { setSearch(e.target.value); setActiveLetter(null); }}
            placeholder={t('glossary.searchPlaceholder')}
            style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '3rem', paddingRight: '2.5rem', paddingTop: '0.875rem', paddingBottom: '0.875rem', borderRadius: '12px', border: search ? '1px solid rgba(247,147,26,0.4)' : '1px solid rgba(255,255,255,0.08)', backgroundColor: '#0a0a14', color: '#f0f0f0', fontSize: '0.9rem', outline: 'none', transition: 'border 0.2s' }} />
          {search && <button onClick={() => { setSearch(''); inputRef.current?.focus(); }} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1, padding: 0 }}>&times;</button>}
        </div>

        <p style={{ color: '#334155', fontSize: '0.78rem', marginBottom: '1.5rem' }}>
          {t('glossary.showing')} <span style={{ color: '#F7931A', fontWeight: 700 }}>{filtered.length}</span> {t('glossary.of')} {GLOSSARY_TERMS.length} {t('glossary.termsLabel')}
          {search && <> {t('glossary.matching')} <em style={{ color: '#F7931A' }}>&ldquo;{search}&rdquo;</em></>}
          {(search || activeLetter) && <button onClick={() => { setSearch(''); setActiveLetter(null); }} style={{ marginLeft: '0.5rem', background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, padding: 0 }}>{t('glossary.clearBtn')}</button>}
        </p>

        <div style={{ display: 'flex', gap: '1.75rem', alignItems: 'flex-start' }}>
          <div style={{ flexShrink: 0, width: '40px' }}>
            <div style={{ position: 'sticky', top: '6rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {allLetters.map(l => (
                <button key={l} onClick={() => jump(l)} style={{ width: '38px', height: '28px', borderRadius: '7px', border: (activeLetter === l && !search) ? '1px solid rgba(247,147,26,0.4)' : '1px solid transparent', background: (activeLetter === l && !search) ? 'rgba(247,147,26,0.12)' : activeL.has(l) ? 'rgba(255,255,255,0.03)' : 'transparent', color: (activeLetter === l && !search) ? '#F7931A' : activeL.has(l) ? '#475569' : '#1e293b', fontWeight: 700, fontSize: '0.66rem', cursor: activeL.has(l) ? 'pointer' : 'default', transition: 'all 0.15s' }}>{l}</button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.875rem' }}>\uD83D\uDD0D</div>
                <h3 style={{ color: '#4a5568', margin: '0 0 0.5rem' }}>{t('glossary.noTermsFound')}</h3>
                <p style={{ color: '#334155', fontSize: '0.85rem' }}>{t('glossary.tryDifferent')}</p>
              </div>
            ) : Object.entries(grouped).sort(([a],[b]) => a.localeCompare(b)).map(([ltr, items]) => (
              <div key={ltr} ref={el => { secRefs.current[ltr] = el; }} style={{ marginBottom: '2.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '0.875rem' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0, background: 'linear-gradient(135deg,rgba(247,147,26,0.1),rgba(183,91,227,0.1))', border: '1px solid rgba(247,147,26,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F7931A', fontWeight: 900, fontSize: '0.9rem' }}>{ltr}</div>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
                  <span style={{ fontSize: '0.62rem', color: '#1e293b' }}>{items.length === 1 ? t('glossary.termCount_one', { count: 1 }) : t('glossary.termCount_other', { count: items.length })}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {items.map(term => (
                    <div key={term.term} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1rem 1.25rem', transition: 'border-color 0.2s' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(247,147,26,0.18)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}>
                      <h3 style={{ color: '#f0f0f0', fontWeight: 700, fontSize: '0.93rem', margin: '0 0 0.4rem' }}><Hl text={term.term} q={search} /></h3>
                      <p style={{ color: '#4a5568', fontSize: '0.84rem', lineHeight: 1.7, margin: 0 }}><Hl text={getDefinition(term)} q={search} /></p>
                      {term.relatedTerms && term.relatedTerms.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.625rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.62rem', color: '#334155' }}>{t('common.seeAlso')}</span>
                          {term.relatedTerms.map(r => <button key={r} onClick={() => { setSearch(r); setActiveLetter(null); }} style={{ fontSize: '0.62rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(247,147,26,0.06)', color: '#F7931A', border: '1px solid rgba(247,147,26,0.15)', cursor: 'pointer' }}>{r}</button>)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
