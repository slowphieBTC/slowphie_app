import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Module } from '../../types';

interface Props {
  module: Module;
  isUnlocked: boolean;
  isCompleted: boolean;
  score: number | null;
  index: number;
}

export function ModuleCard({ module: mod, isUnlocked, isCompleted, score, index }: Props) {
  const navigate = useNavigate();
  const [shaking, setShaking] = useState(false);

  const handleClick = () => {
    if (!isUnlocked) {
      setShaking(true);
      setTimeout(() => setShaking(false), 600);
      return;
    }
    navigate(`/school/module/${mod.slug}`);
  };

  const glowColor = isCompleted ? '#10B981' : isUnlocked ? mod.difficultyColor : 'transparent';

  return (
    <div
      onClick={handleClick}
      style={{
        position: 'relative',
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${isCompleted ? 'rgba(16,185,129,0.25)' : isUnlocked ? mod.difficultyColor + '22' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: '18px',
        padding: '1.5rem',
        cursor: isUnlocked ? 'pointer' : 'not-allowed',
        transition: 'transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease',
        opacity: isUnlocked ? 1 : 0.5,
        boxShadow: isUnlocked ? `0 0 ${isCompleted ? '20px' : '12px'} ${glowColor}18` : 'none',
        animation: shaking ? 'shake 0.5s ease' : 'none',
        overflow: 'hidden',
        backdropFilter: 'none',
        willChange: 'transform',
        isolation: 'isolate',
      }}
      onMouseEnter={e => {
        if (isUnlocked) {
          e.currentTarget.style.transform = 'translateY(-3px)';
          e.currentTarget.style.boxShadow = `0 8px 30px ${glowColor}25`;
          e.currentTarget.style.borderColor = isCompleted ? 'rgba(16,185,129,0.4)' : mod.difficultyColor + '44';
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = isUnlocked ? `0 0 12px ${glowColor}18` : 'none';
        e.currentTarget.style.borderColor = isCompleted ? 'rgba(16,185,129,0.25)' : isUnlocked ? mod.difficultyColor + '22' : 'rgba(255,255,255,0.06)';
      }}
    >
      {/* Top gradient bar */}
      {isUnlocked && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
          background: isCompleted
            ? 'linear-gradient(90deg,#10B981,#059669)'
            : `linear-gradient(90deg,${mod.difficultyColor},${mod.difficultyColor}88)`,
          borderRadius: '18px 18px 0 0',
        }} />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '14px', flexShrink: 0,
            background: isUnlocked ? mod.difficultyColor + '12' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${isUnlocked ? mod.difficultyColor + '22' : 'rgba(255,255,255,0.06)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem',
            filter: isUnlocked ? 'none' : 'grayscale(1)',
          }}>{mod.icon}</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
              <span style={{ fontSize: '0.58rem', fontWeight: 700, padding: '0.12rem 0.4rem', borderRadius: '999px', background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}>MODULE {String(mod.id).padStart(2,'0')}</span>
              <span style={{ fontSize: '0.58rem', fontWeight: 700, padding: '0.12rem 0.45rem', borderRadius: '999px', background: mod.difficultyColor + '12', color: mod.difficultyColor, border: `1px solid ${mod.difficultyColor}22` }}>{mod.difficulty}</span>
            </div>
            <h3 style={{ color: isUnlocked ? '#f0f0f0' : '#4a5568', fontWeight: 800, fontSize: '0.95rem', margin: 0, lineHeight: 1.3 }}>{mod.title}</h3>
          </div>
        </div>
        <div style={{ flexShrink: 0 }}>
          {isCompleted ? (
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', color: '#10B981' }}>✓</div>
          ) : !isUnlocked ? (
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>🔒</div>
          ) : (
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: mod.difficultyColor + '10', border: `1px solid ${mod.difficultyColor}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: mod.difficultyColor, fontWeight: 700 }}>{index + 1}</div>
          )}
        </div>
      </div>

      {/* Description */}
      <p style={{ color: '#94a3b8', fontSize: '0.82rem', lineHeight: 1.65, margin: '0 0 1rem' }}>
        {isUnlocked ? mod.description : 'Complete the previous module quiz (50%+) to unlock this module.'}
      </p>


      {/* Topics — always visible */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '1rem' }}>
        {mod.keyTopics.map(t => (
          <span key={t} style={{ fontSize: '0.6rem', padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.12)' }}>{t}</span>
        ))}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#64748b', fontSize: '0.72rem' }}>
          <span>⏱</span>
          <span>{mod.estimatedTime}</span>
          {score !== null && (
            <span style={{ marginLeft: '0.4rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: score >= 50 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', color: score >= 50 ? '#10B981' : '#EF4444', fontWeight: 700, fontSize: '0.65rem', border: `1px solid ${score >= 50 ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)'}` }}>Quiz: {score}%</span>
          )}
        </div>
        {isUnlocked && (
          <div style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.3rem 0.875rem', borderRadius: '8px', background: isCompleted ? 'rgba(16,185,129,0.1)' : `linear-gradient(135deg,${mod.difficultyColor}18,${mod.difficultyColor}08)`, color: isCompleted ? '#10B981' : mod.difficultyColor, border: `1px solid ${isCompleted ? 'rgba(16,185,129,0.2)' : mod.difficultyColor + '22'}` }}>
            {isCompleted ? '✓ Review' : score !== null ? 'Continue' : 'Start'} →
          </div>
        )}
      </div>
    </div>
  );
}
