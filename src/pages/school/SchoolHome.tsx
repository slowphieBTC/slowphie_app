import { motion } from 'framer-motion';
import { useProgress } from '../../hooks/useProgress';
import { MODULES } from '../../data/modules';
import { ModuleCard } from '../../components/school/ModuleCard';
import { Link } from 'react-router-dom';

export function SchoolHome() {
  const { isModuleUnlocked, isModuleCompleted, getQuizScore, getOverallProgress } = useProgress();
  const pct = getOverallProgress();
  const doneCount = MODULES.filter(m => isModuleCompleted(m.id)).length;

  return (
    <div className="min-h-[calc(100vh-4rem)] pb-16 px-4 pt-8">
      <div className="max-w-5xl mx-auto">

        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center space-y-4 pb-8"
        >
          <h1 className="text-4xl md:text-5xl font-extrabold text-white">
            Learn{' '}
            <span className="text-gradient">Bitcoin</span>
          </h1>
          <p className="text-gray-400 max-w-lg mx-auto text-sm">
            From Bitcoin's fundamental rules to quantum cryptography. 7 modules, real exercises, zero fluff.
          </p>

          {/* Stats pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.75rem', marginTop: '1rem' }}>
            {([['7', 'Modules'], ['35', 'Questions'], ['40+', 'Terms'], ['Beginner→Adv', 'Level']] as [string, string][]).map(([val, lab]) => (
              <div key={lab} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '0.625rem 1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1rem', fontWeight: 900, color: '#F7931A' }}>{val}</div>
                <div style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{lab}</div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          {pct > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ maxWidth: '420px', margin: '1.5rem auto 0', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '1rem 1.5rem' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f0f0f0' }}>Your Progress</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#F7931A' }}>{doneCount}/7 modules</span>
              </div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: pct + '%', background: 'linear-gradient(90deg,#F7931A,#b75be3)', borderRadius: '99px', transition: 'width 0.6s', boxShadow: '0 0 10px rgba(247,147,26,0.4)' }} />
              </div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.35rem', textAlign: 'right' }}>{pct}% complete</div>
            </motion.div>
          )}
        </motion.div>

        {/* Section header */}
        <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ color: '#f0f0f0', fontWeight: 900, fontSize: '1.1rem', margin: 0 }}>Course Modules</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {([['#10B981', 'Completed'], ['#F7931A', 'Available'], ['#334155', 'Locked']] as [string, string][]).map(([c, l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.68rem', color: '#475569' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: c }} />{l}
              </div>
            ))}
            <Link to="/school/glossary" style={{ marginLeft: '0.5rem', fontSize: '0.72rem', padding: '0.25rem 0.7rem', borderRadius: '7px', background: 'rgba(183,91,227,0.08)', color: '#b75be3', border: '1px solid rgba(183,91,227,0.2)', textDecoration: 'none', fontWeight: 700 }}>Glossary →</Link>
          </div>
        </div>

        {/* Module grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-5 pb-12"
        >
          {MODULES.map((mod, idx) => (
            <ModuleCard
              key={mod.id}
              module={mod}
              isUnlocked={isModuleUnlocked(mod.id)}
              isCompleted={isModuleCompleted(mod.id)}
              score={getQuizScore(mod.id)}
              index={idx}
            />
          ))}
        </motion.div>
      </div>
    </div>
  );
}
