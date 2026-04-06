interface Props { percent: number; label?: string; }
export function ProgressBar({ percent, label }: Props) {
  return (
    <div style={{ width: '100%' }}>
      {label && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span style={{ fontSize: '0.75rem', color: '#475569' }}>{label}</span><span style={{ fontSize: '0.75rem', color: '#F7931A', fontWeight: 700 }}>{percent}%</span></div>}
      <div style={{ height: '6px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '9999px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, percent)}%`, background: 'linear-gradient(90deg, #F7931A, #8B5CF6)', borderRadius: '9999px', transition: 'width 0.6s ease', boxShadow: percent > 0 ? '0 0 10px rgba(247,147,26,0.4)' : 'none' }} />
      </div>
    </div>
  );
}
