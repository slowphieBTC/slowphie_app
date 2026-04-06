import { useState, useEffect, useRef } from 'react';
import { useExercises } from '../../hooks/useExercises';
interface Props { moduleId: number; exerciseId: string; }
export function ExerciseEditor({ moduleId, exerciseId }: Props) {
  const { getExercise, saveExercise } = useExercises();
  const [text, setText] = useState(() => getExercise(moduleId, exerciseId));
  const [saved, setSaved] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setText(getExercise(moduleId, exerciseId)); }, [moduleId, exerciseId, getExercise]);
  const handle = (val: string) => {
    setText(val); setSaved(false);
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => { saveExercise(moduleId, exerciseId, val); setSaved(true); setTimeout(() => setSaved(false), 2000); }, 600);
  };
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8B5CF6' }}>✏️ Your Notes & Exercise Work</label>
        <span style={{ fontSize: '0.65rem', color: saved ? '#10B981' : '#475569', transition: 'color 0.3s', fontWeight: 600 }}>{saved ? '✓ Saved' : text.length > 0 ? 'Auto-saving...' : 'Start writing...'}</span>
      </div>
      <textarea value={text} onChange={e => handle(e.target.value)}
        placeholder="Write your answers, thoughts, or notes here. Auto-saved to your browser."
        style={{ width: '100%', minHeight: '140px', boxSizing: 'border-box', padding: '0.875rem', backgroundColor: 'rgba(10,10,15,0.9)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '10px', color: '#e2e8f0', fontSize: '0.85rem', lineHeight: '1.6', resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
        onFocus={e => (e.target.style.borderColor = 'rgba(139,92,246,0.5)')}
        onBlur={e => (e.target.style.borderColor = 'rgba(139,92,246,0.2)')}
      />
      <div style={{ fontSize: '0.65rem', color: '#334155', marginTop: '0.25rem', textAlign: 'right' }}>{text.length} characters • auto-saved locally</div>
    </div>
  );
}
