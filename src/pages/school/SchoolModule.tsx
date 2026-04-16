import { useState, useEffect, type ReactNode } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MODULES } from '../../data/modules';
import { QUIZZES } from '../../data/quizzes';
import { MODULE_CONTENT } from '../../data/moduleContent';
import { useProgress } from '../../hooks/useProgress';
import { useModuleTranslation } from '../../hooks/useModuleTranslation';
import { QuizModal } from '../../components/school/QuizModal';
import { ExerciseEditor } from '../../components/school/ExerciseEditor';

let _k = 0;
const nk = () => `mk${_k++}`;

function fmt(text: string): ReactNode[] {
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  const parts = text.split(re);
  return parts.map((p, i) => {
    if (p.startsWith('`') && p.endsWith('`') && p.length > 2)
      return <code key={i} style={{ fontFamily: 'monospace', fontSize: '0.82em', background: 'rgba(247,147,26,0.1)', color: '#F7931A', padding: '0.1em 0.35em', borderRadius: '4px' }}>{p.slice(1,-1)}</code>;
    if (p.startsWith('**') && p.endsWith('**') && p.length > 4)
      return <strong key={i} style={{ color: '#e2e8f0', fontWeight: 700 }}>{p.slice(2,-2)}</strong>;
    if (p.startsWith('*') && p.endsWith('*') && p.length > 2 && !p.startsWith('**'))
      return <em key={i} style={{ color: '#a0aec0' }}>{p.slice(1,-1)}</em>;
    return p;
  });
}

function renderMd(md: string): ReactNode[] {
  const ls = md.split('\n');
  const nodes: ReactNode[] = [];
  let i = 0;
  while (i < ls.length) {
    const raw = ls[i]; i++;
    const t = raw.trim();
    if (!t) continue;
    if (t.startsWith('# '))   { nodes.push(<h1 key={nk()} style={{ color:'#f0f0f0', fontWeight:900, fontSize:'1.75rem', margin:'2rem 0 1rem', borderBottom:'1px solid rgba(255,255,255,0.06)', paddingBottom:'0.6rem', lineHeight:1.25 }}>{fmt(t.slice(2))}</h1>); continue; }
    if (t.startsWith('## '))  { nodes.push(<h2 key={nk()} style={{ color:'#e2e8f0', fontWeight:800, fontSize:'1.25rem', margin:'2rem 0 0.75rem', lineHeight:1.3 }}>{fmt(t.slice(3))}</h2>); continue; }
    if (t.startsWith('### ')) { nodes.push(<h3 key={nk()} style={{ color:'#cbd5e1', fontWeight:700, fontSize:'1.05rem', margin:'1.5rem 0 0.5rem' }}>{fmt(t.slice(4))}</h3>); continue; }
    if (t.startsWith('#### ')){ nodes.push(<h4 key={nk()} style={{ color:'#94a3b8', fontWeight:700, fontSize:'0.95rem', margin:'1.25rem 0 0.4rem' }}>{fmt(t.slice(5))}</h4>); continue; }
    if (t === '---') { nodes.push(<hr key={nk()} style={{ border:'none', borderTop:'1px solid rgba(255,255,255,0.07)', margin:'1.5rem 0' }} />); continue; }
    if (t.startsWith('> ')) {
      const bq = [t.slice(2)];
      while (i < ls.length && ls[i].trim().startsWith('> ')){ bq.push(ls[i].trim().slice(2)); i++; }
      nodes.push(<blockquote key={nk()} style={{ borderLeft:'3px solid rgba(247,147,26,0.4)', paddingLeft:'1rem', margin:'1rem 0', color:'#64748b', fontStyle:'italic', fontSize:'0.9rem', lineHeight:1.7 }}>{bq.map((l,li)=><p key={li} style={{ margin:'0.25rem 0' }}>{fmt(l)}</p>)}</blockquote>);
      continue;
    }
    if (t.startsWith('```')) {
      const code: string[] = [];
      while (i < ls.length && !ls[i].trim().startsWith('```')){ code.push(ls[i]); i++; }
      if (i < ls.length) i++;
      nodes.push(<pre key={nk()} style={{ background:'rgba(0,0,0,0.4)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'10px', padding:'1rem 1.25rem', overflowX:'auto', margin:'1rem 0', fontSize:'0.78rem', lineHeight:1.65 }}><code style={{ color:'#94a3b8', fontFamily:'monospace' }}>{code.join('\n')}</code></pre>);
      continue;
    }
    if (t.startsWith('|')) {
      const pr = (l: string) => l.split('|').slice(1,-1).map(c=>c.trim());
      const rows: string[][] = [pr(t)];
      while (i < ls.length && ls[i].trim().startsWith('|')) {
        const r = ls[i].trim(); i++;
        if (/^[|:\-\s]+$/.test(r)) continue;
        rows.push(pr(r));
      }
      const [hdr, ...data] = rows;
      nodes.push(
        <div key={nk()} style={{ overflowX:'auto', margin:'1rem 0' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.82rem' }}>
            <thead><tr style={{ borderBottom:'1px solid rgba(247,147,26,0.2)' }}>
              {(hdr??[]).map((h,hi)=><th key={hi} style={{ padding:'0.5rem 0.875rem', textAlign:'left', color:'#F7931A', fontWeight:700, whiteSpace:'nowrap' }}>{h}</th>)}
            </tr></thead>
            <tbody>{data.map((row,ri)=><tr key={ri} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)', background:ri%2===0?'transparent':'rgba(255,255,255,0.012)' }}>{row.map((cell,ci)=><td key={ci} style={{ padding:'0.45rem 0.875rem', color:'#94a3b8' }}>{fmt(cell)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
      continue;
    }
    if (/^[-*+] /.test(t)) {
      const items = [t.replace(/^[-*+] /,'')];
      while (i < ls.length && /^[-*+] /.test(ls[i].trim())){ items.push(ls[i].trim().replace(/^[-*+] /,'')); i++; }
      nodes.push(<ul key={nk()} style={{ paddingLeft:'1.25rem', margin:'0.6rem 0', lineHeight:1.8 }}>{items.map((it,ii)=><li key={ii} style={{ color:'#94a3b8', fontSize:'0.9rem', marginBottom:'0.15rem' }}>{fmt(it)}</li>)}</ul>);
      continue;
    }
    if (/^\d+\.\s/.test(t)) {
      const items = [t.replace(/^\d+\.\s/,'')];
      while (i < ls.length && /^\d+\.\s/.test(ls[i].trim())){ items.push(ls[i].trim().replace(/^\d+\.\s/,'')); i++; }
      nodes.push(<ol key={nk()} style={{ paddingLeft:'1.5rem', margin:'0.6rem 0', lineHeight:1.8 }}>{items.map((it,ii)=><li key={ii} style={{ color:'#94a3b8', fontSize:'0.9rem', marginBottom:'0.25rem' }}>{fmt(it)}</li>)}</ol>);
      continue;
    }
    const para = [t];
    while (i < ls.length) {
      const nx = ls[i].trim();
      if (!nx||nx.startsWith('#')||nx.startsWith('```')||nx.startsWith('|')||/^[-*+] /.test(nx)||/^\d+\./.test(nx)||nx==='---'||nx.startsWith('>')) break;
      para.push(nx); i++;
    }
    nodes.push(<p key={nk()} style={{ color:'#94a3b8', lineHeight:1.85, fontSize:'0.925rem', margin:'0 0 0.875rem' }}>{fmt(para.join(' '))}</p>);
  }
  return nodes;
}

export function SchoolModule() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isModuleUnlocked, isModuleCompleted, saveQuizScore, getQuizScore } = useProgress();
  const [showQuiz, setShowQuiz] = useState(false);
  const mod = MODULES.find(m => m.slug === slug);
  const prev = mod ? MODULES.find(m => m.id === mod.id - 1) : null;
  const next = mod ? MODULES.find(m => m.id === mod.id + 1) : null;

  // must be called unconditionally — guard happens after
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const moduleTranslation = useModuleTranslation(mod?.id ?? 0);

  useEffect(() => { window.scrollTo(0, 0); _k = 0; }, [slug]);

  if (!mod) return (
    <div style={{ textAlign: 'center', padding: '4rem' }}>
      <p style={{ color: '#4a5568' }}>{t('school.moduleNotFound')}</p>
      <Link to="/school" style={{ color: '#F7931A' }}>{t('school.backToSchool')}</Link>
    </div>
  );
  if (!isModuleUnlocked(mod.id)) { navigate('/school'); return null; }

  const raw = moduleTranslation?.content ?? MODULE_CONTENT[mod.id] ?? '';
  const completed = isModuleCompleted(mod.id);
  const score = getQuizScore(mod.id);
  _k = 0;

  const buildContent = (): ReactNode[] => {
    const stripped = raw
      .replace(/## ✅[^\n]*[\s\S]*?(?=\n## |$)/g, '');
    const EX_RE = /(## 🔨[^\n]*)/;
    const parts = stripped.split(EX_RE);
    const result: ReactNode[] = [];
    let exIdx = 0;
    let si = 0;
    while (si < parts.length) {
      const sec = parts[si];
      if (EX_RE.test(sec) && !sec.includes('\n')) {
        const rawBody = parts[si + 1] ?? '';
        // Split off the Connection section (🔗 common across all languages) so it renders OUTSIDE the exercise box
        const connSplit = rawBody.split(/(## 🔗[^\n]*)/);
        const body        = connSplit[0];
        const connHeading = connSplit[1] ?? '';
        const connBody    = connSplit[2] ?? '';
        const subRe = /(\.?\*\*(?:Exercise|Exercice|Ejercicio|练习)[^\n]*)/;
        const subParts = body.split(subRe);
        result.push(
          <div key={'ex' + exIdx} style={{ background: 'rgba(183,91,227,0.04)', border: '1px solid rgba(183,91,227,0.15)', borderRadius: '14px', padding: '1.5rem', margin: '2rem 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
              <span style={{ fontSize: '1.25rem' }}>🔨</span>
              <h3 style={{ color: '#b75be3', fontWeight: 800, fontSize: '1rem', margin: 0 }}>{t('school.practicalExercises')}</h3>
            </div>
            {subParts.length <= 1 ? (
              <>
                <div>{renderMd(body)}</div>
                <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(183,91,227,0.1)' }}>
                  <ExerciseEditor moduleId={mod.id} exerciseId={`ex${exIdx}_0`} />
                </div>
              </>
            ) : (
              (() => {
                const items: ReactNode[] = [];
                if (subParts[0].trim()) items.push(<div key="intro">{renderMd(subParts[0])}</div>);
                let subIdx = 0;
                for (let j = 1; j < subParts.length; j += 2) {
                  const heading = subParts[j];
                  const content = subParts[j + 1] ?? '';
                  items.push(
                    <div key={`sub${subIdx}`} style={{ marginTop: subIdx > 0 ? '1.5rem' : '0.5rem', paddingTop: subIdx > 0 ? '1.5rem' : '0', borderTop: subIdx > 0 ? '1px solid rgba(183,91,227,0.1)' : 'none' }}>
                      <div>{renderMd(heading + content)}</div>
                      <div style={{ marginTop: '0.875rem' }}><ExerciseEditor moduleId={mod.id} exerciseId={`ex${exIdx}_${subIdx}`} /></div>
                    </div>
                  );
                  subIdx++;
                }
                return <>{items}</>;
              })()
            )}
          </div>
        );
        // Render Connection section OUTSIDE the exercise box
        if (connHeading) {
          result.push(<div key={'conn' + exIdx}>{renderMd(connHeading + '\n' + connBody)}</div>);
        }
        si += 2; exIdx++;
      } else {
        if (sec.trim()) result.push(<div key={'s' + si}>{renderMd(sec)}</div>);
        si++;
      }
    }
    return result;
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] pb-16 px-4 pt-8">
      <div style={{ maxWidth: '820px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', marginBottom: '1.25rem', color: '#334155', flexWrap: 'wrap' }}>
          <Link to="/school" style={{ color: '#F7931A', textDecoration: 'none', fontWeight: 600 }}>{t('school.backToSchool').replace('\u2190 ', '')}</Link>
          <span>\u203A</span>
          <span>{t('school.breadcrumbModule', { id: mod.id, title: moduleTranslation?.card.title ?? mod.title })}</span>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${mod.difficultyColor}20`, borderRadius: '18px', padding: '1.5rem', marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '60px', height: '60px', flexShrink: 0, borderRadius: '16px', background: mod.difficultyColor + '10', border: '1px solid ' + mod.difficultyColor + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem' }}>{mod.icon}</div>
            <div style={{ flex: 1, minWidth: '180px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
                <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '999px', background: mod.difficultyColor + '10', color: mod.difficultyColor, border: '1px solid ' + mod.difficultyColor + '22' }}>{moduleTranslation?.card.difficulty ?? mod.difficulty}</span>
                <span style={{ fontSize: '0.68rem', color: '#334155' }}>{mod.estimatedTime}</span>
                {completed && <span style={{ fontSize: '0.62rem', padding: '0.15rem 0.5rem', borderRadius: '999px', background: 'rgba(16,185,129,0.08)', color: '#10B981', border: '1px solid rgba(16,185,129,0.18)' }}>{t('school.moduleCompleted')}</span>}
              </div>
              <h1 style={{ color: '#f0f0f0', fontWeight: 900, fontSize: '1.4rem', margin: 0 }}>{moduleTranslation?.card.title ?? mod.title}</h1>
              <p style={{ color: '#475569', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>{moduleTranslation?.card.subtitle ?? mod.subtitle}</p>
            </div>
            {score !== null && (
              <div style={{ textAlign: 'center', padding: '0.625rem 1.25rem', background: score >= 50 ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)', borderRadius: '12px', border: `1px solid ${score >= 50 ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)'}` }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: score >= 50 ? '#10B981' : '#EF4444' }}>{score}%</div>
                <div style={{ fontSize: '0.6rem', color: '#334155' }}>{t('school.quizScore')}</div>
              </div>
            )}
          </div>
        </div>

        <div>{buildContent()}</div>

        <div style={{ position: 'sticky', bottom: '1rem', marginTop: '2.5rem', zIndex: 50 }}>
          <div style={{ background: 'rgba(6,10,20,0.97)', border: '1px solid rgba(247,147,26,0.2)', backdropFilter: 'blur(20px)', borderRadius: '14px', padding: '0.875rem 1.25rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', boxShadow: '0 8px 40px rgba(0,0,0,0.7)' }}>
            <div>
              <p style={{ fontWeight: 800, fontSize: '0.875rem', color: '#f0f0f0', margin: 0 }}>{completed ? t('school.moduleCompleteRetake') : t('school.readyToTest')}</p>
              <p style={{ fontSize: '0.7rem', color: '#475569', margin: 0 }}>{t('school.questionsUnlock', { count: QUIZZES[mod.id]?.length ?? 5 })}</p>
            </div>
            <button onClick={() => setShowQuiz(true)} style={{ padding: '0.625rem 1.25rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#F7931A,#f59e0b)', color: '#000', fontWeight: 900, fontSize: '0.875rem', cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(247,147,26,0.3)' }}>
              {completed ? t('school.retakeQuiz') : t('school.takeQuiz')}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.25rem', paddingBottom: '3rem' }}>
          {prev
            ? <Link to={`/school/module/${prev.slug}`} style={{ padding: '0.5rem 1rem', borderRadius: '8px', textDecoration: 'none', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#475569', fontSize: '0.8rem', fontWeight: 600 }}>{t('school.moduleNavPrev', { id: prev.id })}</Link>
            : <Link to="/school" style={{ padding: '0.5rem 1rem', borderRadius: '8px', textDecoration: 'none', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#475569', fontSize: '0.8rem', fontWeight: 600 }}>{t('school.allModules')}</Link>
          }
          {next && isModuleUnlocked(next.id)
            ? <Link to={`/school/module/${next.slug}`} style={{ padding: '0.5rem 1rem', borderRadius: '8px', textDecoration: 'none', background: 'linear-gradient(135deg,#F7931A,#f59e0b)', color: '#000', fontSize: '0.8rem', fontWeight: 900 }}>{t('school.moduleNavNext', { id: next.id })}</Link>
            : next
            ? <div style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', color: '#2d3748', fontSize: '0.8rem' }}>{t('school.moduleLockedBtn', { id: next.id })}</div>
            : null
          }
        </div>

        {showQuiz && QUIZZES[mod.id] && (
          <QuizModal
            moduleId={mod.id}
            moduleTitle={moduleTranslation?.card.title ?? mod.title}
            questions={
              moduleTranslation?.quiz
                ? moduleTranslation.quiz.map((q, i) => ({
                    ...QUIZZES[mod.id][i],
                    question: q.question,
                    options: q.options,
                    explanation: q.explanation,
                  }))
                : QUIZZES[mod.id]
            }
            onClose={() => setShowQuiz(false)}
            onComplete={s => saveQuizScore(mod.id, s)}
            previousScore={score}
          />
        )}
      </div>
    </div>
  );
}
