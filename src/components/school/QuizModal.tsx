import { useState, useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { QuizQuestion } from '../../types';
import { MODULES } from '../../data/modules';

interface Props {
  moduleId: number;
  moduleTitle: string;
  questions: QuizQuestion[];
  onClose: () => void;
  onComplete: (score: number) => void;
  previousScore: number | null;
}

export function QuizModal({ moduleId, moduleTitle, questions, onClose, onComplete, previousScore }: Props) {
  const [cur, setCur] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [answers, setAnswers] = useState<(number | null)[]>(Array(questions.length).fill(null));
  const [phase, setPhase] = useState<'quiz' | 'results'>('quiz');
  const [finalScore, setFinalScore] = useState(0);
  const [finalAns, setFinalAns] = useState<(number | null)[]>([]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const total = questions.length;
  const q = questions[cur];
  const nextMod = MODULES.find(m => m.id === moduleId + 1);
  const passed = finalScore >= 50;
  const LABELS = ['A', 'B', 'C', 'D', 'E'];

  const confirm = () => { if (sel === null) return; setConfirmed(true); };

  const goNext = () => {
    const upd = [...answers];
    upd[cur] = sel;
    if (cur < total - 1) {
      setAnswers(upd); setCur(c => c + 1); setSel(null); setConfirmed(false);
    } else {
      const correct = upd.filter((a, i) => a === questions[i].correctIndex).length;
      const pct = Math.round((correct / total) * 100);
      setFinalScore(pct); setFinalAns(upd); setPhase('results'); onComplete(pct);
    }
  };

  const retake = () => {
    setCur(0); setSel(null); setConfirmed(false);
    setAnswers(Array(questions.length).fill(null));
    setPhase('quiz'); setFinalScore(0);
  };

  const oBg = (i: number) => !confirmed
    ? (sel === i ? 'rgba(247,147,26,0.10)' : 'rgba(255,255,255,0.03)')
    : i === q.correctIndex ? 'rgba(16,185,129,0.12)' : i === sel ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.03)';
  const oBd = (i: number) => !confirmed
    ? (sel === i ? '1px solid rgba(247,147,26,0.45)' : '1px solid rgba(255,255,255,0.07)')
    : i === q.correctIndex ? '1px solid rgba(16,185,129,0.4)' : i === sel ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.07)';
  const oC = (i: number) => !confirmed
    ? (sel === i ? '#F7931A' : '#94a3b8')
    : i === q.correctIndex ? '#10B981' : i === sel ? '#EF4444' : '#475569';

  const ovl: ReactNode = (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)', padding: '1rem'
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: '#0a0a14', border: '1px solid rgba(247,147,26,0.15)',
        borderRadius: '22px', width: '100%', maxWidth: '600px',
        maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.8)'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          position: 'sticky', top: 0, background: '#0a0a14', zIndex: 10, borderRadius: '22px 22px 0 0'
        }}>
          <div>
            <h2 style={{ color: '#f0f0f0', fontWeight: 900, fontSize: '1rem', margin: 0 }}>Quiz: {moduleTitle}</h2>
            {phase === 'quiz' && <p style={{ color: '#475569', fontSize: '0.72rem', margin: '3px 0 0' }}>Question {cur + 1} of {total} · Score 50%+ to unlock next</p>}
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#64748b', cursor: 'pointer', padding: '0.3rem 0.7rem', fontSize: '1.1rem', lineHeight: 1 }}>&times;</button>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {phase === 'quiz' ? (
            <>
              {/* Progress bar */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden', marginBottom: '10px' }}>
                  <div style={{ height: '100%', width: `${((cur + (confirmed ? 1 : 0)) / total) * 100}%`, background: 'linear-gradient(90deg,#F7931A,#b75be3)', transition: 'width 0.4s', borderRadius: '99px' }} />
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {questions.map((_, i) => <div key={i} style={{ flex: 1, height: '6px', borderRadius: '3px', background: i < cur ? '#10B981' : i === cur ? '#F7931A' : 'rgba(255,255,255,0.08)', transition: 'background 0.3s' }} />)}
                </div>
              </div>
              {/* Question */}
              <div style={{ background: 'linear-gradient(135deg,rgba(247,147,26,0.06),rgba(183,91,227,0.04))', border: '1px solid rgba(247,147,26,0.12)', borderRadius: '14px', padding: '1.25rem', marginBottom: '1.25rem' }}>
                <p style={{ color: '#f0f0f0', fontWeight: 700, fontSize: '0.975rem', margin: 0, lineHeight: 1.55 }}>{q.question}</p>
              </div>
              {/* Options */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginBottom: '1.25rem' }}>
                {q.options.map((opt, i) => (
                  <button key={i} onClick={() => { if (!confirmed) setSel(i); }}
                    style={{ background: oBg(i), border: oBd(i), borderRadius: '11px', padding: '0.75rem 1rem', textAlign: 'left', cursor: confirmed ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', transition: 'all 0.18s', width: '100%' }}
                  >
                    <span style={{ width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, color: oC(i), border: oBd(i) }}>{LABELS[i]}</span>
                    <span style={{ fontSize: '0.875rem', color: oC(i), fontWeight: (sel === i || (confirmed && i === q.correctIndex)) ? 600 : 400, lineHeight: 1.45 }}>{opt}</span>
                    {confirmed && i === q.correctIndex && <span style={{ marginLeft: 'auto', color: '#10B981', fontWeight: 900 }}>✓</span>}
                    {confirmed && i === sel && i !== q.correctIndex && <span style={{ marginLeft: 'auto', color: '#EF4444', fontWeight: 900 }}>✗</span>}
                  </button>
                ))}
              </div>
              {/* Explanation */}
              {confirmed && (
                <div style={{ background: sel === q.correctIndex ? 'rgba(16,185,129,0.06)' : 'rgba(183,91,227,0.06)', border: `1px solid ${sel === q.correctIndex ? 'rgba(16,185,129,0.18)' : 'rgba(183,91,227,0.18)'}`, borderRadius: '11px', padding: '0.875rem 1rem', marginBottom: '1.25rem' }}>
                  <p style={{ fontSize: '0.78rem', color: sel === q.correctIndex ? '#10B981' : '#b75be3', fontWeight: 700, margin: '0 0 0.25rem' }}>
                    {sel === q.correctIndex ? '✓ Correct!' : `Correct: ${q.options[q.correctIndex]}`}
                  </p>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0, lineHeight: 1.55 }}>{q.explanation}</p>
                </div>
              )}
              {/* Action */}
              {!confirmed
                ? <button onClick={confirm} disabled={sel === null} style={{ width: '100%', padding: '0.75rem', borderRadius: '11px', border: 'none', background: sel !== null ? 'linear-gradient(135deg,#F7931A,#f59e0b)' : 'rgba(255,255,255,0.05)', color: sel !== null ? '#000' : '#334155', fontWeight: 900, fontSize: '0.9rem', cursor: sel !== null ? 'pointer' : 'not-allowed', boxShadow: sel !== null ? '0 4px 14px rgba(247,147,26,0.3)' : 'none' }}>Confirm Answer</button>
                : <button onClick={goNext} style={{ width: '100%', padding: '0.75rem', borderRadius: '11px', border: 'none', background: 'linear-gradient(135deg,#F7931A,#f59e0b)', color: '#000', fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(247,147,26,0.3)' }}>{cur < total - 1 ? 'Next Question →' : 'See Results'}</button>
              }
            </>
          ) : (
            <div style={{ textAlign: 'center' }}>
              {/* Score circle */}
              <div style={{ position: 'relative', width: '110px', height: '110px', margin: '0 auto 1.5rem' }}>
                <svg viewBox="0 0 36 36" style={{ width: '110px', height: '110px', transform: 'rotate(-90deg)' }}>
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke={passed ? '#10B981' : '#EF4444'} strokeWidth="2.5"
                    strokeDasharray={`${finalScore} ${100 - finalScore}`} strokeLinecap="round" />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '1.6rem', fontWeight: 900, color: passed ? '#10B981' : '#EF4444', lineHeight: 1 }}>{finalScore}%</span>
                  <span style={{ fontSize: '0.58rem', color: '#475569', fontWeight: 600 }}>SCORE</span>
                </div>
              </div>
              <h3 style={{ color: '#f0f0f0', fontWeight: 900, fontSize: '1.1rem', margin: '0 0 0.4rem' }}>{passed ? 'Excellent Work!' : 'Keep Learning'}</h3>
              <p style={{ color: '#475569', fontSize: '0.83rem', margin: '0 0 0.5rem' }}>
                {Math.round(finalScore * total / 100)} of {total} correct.
                {passed && nextMod ? ` Module ${moduleId + 1} is now unlocked!` : passed ? ' Course complete!' : ' Score 50%+ to unlock next module.'}
              </p>
              {previousScore !== null && <p style={{ color: '#334155', fontSize: '0.72rem', marginBottom: '1.25rem' }}>Previous best: {previousScore}%</p>}
              {/* Answer review */}
              <div style={{ textAlign: 'left', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {questions.map((question, i) => {
                  const ua = finalAns[i];
                  const ok = ua === question.correctIndex;
                  return (
                    <div key={i} style={{ background: ok ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)', border: `1px solid ${ok ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}`, borderRadius: '9px', padding: '0.625rem 0.875rem' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <span style={{ color: ok ? '#10B981' : '#EF4444', fontWeight: 900, fontSize: '0.8rem', flexShrink: 0 }}>{ok ? '✓' : '✗'}</span>
                        <div>
                          <p style={{ color: '#94a3b8', fontSize: '0.78rem', fontWeight: 600, margin: '0 0 0.2rem', lineHeight: 1.4 }}>{question.question}</p>
                          {!ok && <p style={{ color: '#10B981', fontSize: '0.72rem', margin: 0 }}>✓ {question.options[question.correctIndex]}</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button onClick={retake} style={{ flex: 1, padding: '0.75rem', borderRadius: '11px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#94a3b8', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', minWidth: '120px' }}>Retake Quiz</button>
                {passed && nextMod
                  ? <Link to={`/school/module/${nextMod.slug}`} onClick={onClose} style={{ flex: 1, padding: '0.75rem', borderRadius: '11px', border: 'none', background: 'linear-gradient(135deg,#F7931A,#f59e0b)', color: '#000', fontWeight: 900, fontSize: '0.875rem', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(247,147,26,0.3)', minWidth: '120px' }}>Module {moduleId + 1} →</Link>
                  : passed
                  ? <button onClick={onClose} style={{ flex: 1, padding: '0.75rem', borderRadius: '11px', border: 'none', background: 'linear-gradient(135deg,#10B981,#059669)', color: '#fff', fontWeight: 900, fontSize: '0.875rem', cursor: 'pointer', minWidth: '120px' }}>Course Complete! 🎓</button>
                  : <button onClick={onClose} style={{ flex: 1, padding: '0.75rem', borderRadius: '11px', border: 'none', background: 'linear-gradient(135deg,#b75be3,#7C3AED)', color: '#fff', fontWeight: 900, fontSize: '0.875rem', cursor: 'pointer', minWidth: '120px' }}>Review Module</button>
                }
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
  return ovl;
}
