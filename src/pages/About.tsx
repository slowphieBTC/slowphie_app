import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchStatus } from '../api/slowphie';

interface TracksStats {
  tokenCount: number; poolCount: number; farmCount: number;
  farmNames: string[]; lastUpdated: Date | null; nextScan: Date | null;
}

function useTracksStats(): TracksStats {
  const [stats, setStats] = useState<TracksStats>({ tokenCount: 0, poolCount: 0, farmCount: 0, farmNames: [], lastUpdated: null, nextScan: null });
  useEffect(() => {
    let alive = true;
    fetchStatus().then(s => {
      if (!alive) return;
      setStats({ tokenCount: s.scanner.uniqueTokens, poolCount: s.scanner.lpTokens, farmCount: s.farms.total, farmNames: s.farms.list.map((f: any) => f.name), lastUpdated: new Date(s.fetchedAt), nextScan: new Date(s.nextScanAt) });
    }).catch((err) => { console.error('[About] fetchStatus failed:', err); });
    return () => { alive = false; };
  }, []);
  return stats;
}

function fmtTime(d: Date | null): string {
  if (!d) return '\u2014';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function TechTable({ rows, accent }: { rows: [string, string][]; accent: string }) {
  return (
    <div style={{ overflowX: 'auto', marginTop: '1.25rem' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <td style={{ padding: '0.5rem 0.75rem 0.5rem 0', color: accent, fontWeight: 700, whiteSpace: 'nowrap', width: '40%' }}>{label}</td>
              <td style={{ padding: '0.5rem 0', color: '#94a3b8', lineHeight: 1.5 }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LiveBadge({ lastUpdated, nextScan, liveLabel, updatedLabel, nextScanLabel }: { lastUpdated: Date | null; nextScan: Date | null; liveLabel: string; updatedLabel: string; nextScanLabel: string }) {
  if (!lastUpdated) return null;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '999px', padding: '0.2rem 0.65rem', marginBottom: '0.75rem' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 5px #22c55e' }} />
      <span style={{ fontSize: '0.68rem', color: '#22c55e', fontWeight: 700 }}>{liveLabel}</span>
      <span style={{ fontSize: '0.65rem', color: '#64748b' }}>
        {updatedLabel.replace('{{time}}', fmtTime(lastUpdated))}
        {nextScan && <> {nextScanLabel.replace('{{time}}', fmtTime(nextScan))}</>}
      </span>
    </div>
  );
}

export function About() {
  const stats = useTracksStats();
  const { t } = useTranslation();

  const ld = t('about.loading');

  const SECTIONS = [
    {
      id: 'tracks',
      image: '/OpStrat.png',
      route: '/tracks',
      label: t('about.sections.tracks.label'),
      accent: '#f7931a',
      icon: '\uD83D\uDCCA',
      tagline: t('about.sections.tracks.tagline'),
      description: t('about.sections.tracks.description'),
      features: [
        { title: t('about.sections.tracks.features.multiWallet.title'),    desc: t('about.sections.tracks.features.multiWallet.desc') },
        { title: t('about.sections.tracks.features.livePrice.title'),      desc: t('about.sections.tracks.features.livePrice.desc') },
        { title: t('about.sections.tracks.features.aggregation.title'),    desc: t('about.sections.tracks.features.aggregation.desc') },
        { title: t('about.sections.tracks.features.mchad.title'),          desc: t('about.sections.tracks.features.mchad.desc'), custom: true },
        { title: t('about.sections.tracks.features.lpComposition.title'),  desc: t('about.sections.tracks.features.lpComposition.desc') },
        { title: t('about.sections.tracks.features.tokenTotals.title'),    desc: t('about.sections.tracks.features.tokenTotals.desc') },
        { title: t('about.sections.tracks.features.refresh.title'),        desc: t('about.sections.tracks.features.refresh.desc') },
      ],
      getTechSpec: (s: TracksStats): [string, string][] => [
        [t('about.sections.tracks.spec.dataSource'),       'OPNet Mainnet RPC + BlockFeed REST & WebSocket'],
        [t('about.sections.tracks.spec.trackedTokens'),    s.tokenCount > 0 ? `${s.tokenCount} tokens` : ld],
        [t('about.sections.tracks.spec.trackedLpPools'),   s.poolCount  > 0 ? `${s.poolCount} pools`   : ld],
        [t('about.sections.tracks.spec.farmsTracked'),     s.farmCount  > 0 ? s.farmNames.join(', ')   : ld],
        [t('about.sections.tracks.spec.supportedPositions'), 'Stake, BTC Farm, LP Farm, Token Wallet, MCHAD Custom, MCHAD/MOTO LP'],
        [t('about.sections.tracks.spec.customProtocol'),   'MotoCHAD \u2014 MCHAD staking & LP staking with lock multipliers'],
        [t('about.sections.tracks.spec.cacheStrategy'),    'Zustand store \u2014 instant on return navigation'],
        [t('about.sections.tracks.spec.custody'),          'None \u2014 read-only, no wallet connection required'],
        [t('about.sections.tracks.spec.lastServerScan'),   s.lastUpdated ? fmtTime(s.lastUpdated) : ld],
      ],
    },
    {
      id: 'minter',
      image: '/OpMinter.png',
      route: '/minter',
      label: t('about.sections.minter.label'),
      accent: '#ff6b35',
      icon: '\uD83E\uDE99',
      tagline: t('about.sections.minter.tagline'),
      description: t('about.sections.minter.description'),
      features: [
        { title: t('about.sections.minter.features.hiddenGem.title'),     desc: t('about.sections.minter.features.hiddenGem.desc') },
        { title: t('about.sections.minter.features.oneClick.title'),      desc: t('about.sections.minter.features.oneClick.desc') },
        { title: t('about.sections.minter.features.supplyBar.title'),     desc: t('about.sections.minter.features.supplyBar.desc') },
        { title: t('about.sections.minter.features.walletBalance.title'), desc: t('about.sections.minter.features.walletBalance.desc') },
        { title: t('about.sections.minter.features.mintStatus.title'),    desc: t('about.sections.minter.features.mintStatus.desc') },
      ],
      getTechSpec: (): [string, string][] => [
        [t('about.sections.minter.spec.protocol'),        'OP-20 standard on OPNet \u2014 Bitcoin L1 smart contracts'],
        [t('about.sections.minter.spec.wallet'),          'OP_WALLET browser extension (required)'],
        [t('about.sections.minter.spec.tokensAvailable'), '$MONEY, $BIP110, $SWAP, $TESTICLE'],
        [t('about.sections.minter.spec.platformFee'),     '1,000 sats (~$0.67) per mint transaction'],
        [t('about.sections.minter.spec.settlement'),      'Direct Bitcoin L1 \u2014 no bridge, no sidechain'],
      ],
      note: { text: t('about.sections.minter.feeNote'), color: '#ff6b35' },
    },
    {
      id: 'school',
      image: '/OpSchool.png',
      route: '/school',
      label: t('about.sections.school.label'),
      accent: '#b75be3',
      icon: '\uD83C\uDF93',
      tagline: t('about.sections.school.tagline'),
      description: t('about.sections.school.description'),
      features: [
        { title: t('about.sections.school.features.modules.title'),   desc: t('about.sections.school.features.modules.desc') },
        { title: t('about.sections.school.features.quiz.title'),      desc: t('about.sections.school.features.quiz.desc') },
        { title: t('about.sections.school.features.glossary.title'),  desc: t('about.sections.school.features.glossary.desc') },
        { title: t('about.sections.school.features.exercises.title'), desc: t('about.sections.school.features.exercises.desc') },
        { title: t('about.sections.school.features.progress.title'),  desc: t('about.sections.school.features.progress.desc') },
      ],
      getTechSpec: (): [string, string][] => [
        [t('about.sections.school.spec.modules'),       '7 \u2014 Beginner to Advanced'],
        [t('about.sections.school.spec.topics'),        'UTXO, ACS, OPNet architecture, NativeSwap, quantum, CEX vs DEX'],
        [t('about.sections.school.spec.quizThreshold'), '50%+ to unlock next module'],
        [t('about.sections.school.spec.storage'),       'localStorage \u2014 no account needed'],
        [t('about.sections.school.spec.estimatedTime'), '~7 hours total across all modules'],
      ],
      whyFirst: true,
    },
  ] as const;

  return (
    <div className="min-h-[calc(100vh-4rem)] pb-20 px-4 pt-8">
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }} className="text-center mb-14">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
            {t('about.heroTitle')}{' '}<span className="text-gradient">{t('about.heroGradient')}</span>
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto text-sm leading-relaxed">{t('about.heroSubtitle')}</p>
          <Link to="/" style={{ display: 'inline-block', marginTop: '1.25rem', fontSize: '0.78rem', color: '#f7931a', textDecoration: 'none', fontWeight: 600 }}>
            {t('about.backToHome')}
          </Link>
        </motion.div>

        {SECTIONS.map((sec, idx) => (
          <motion.div key={sec.id} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 * (idx + 1) }}
            style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${sec.accent}22`, borderRadius: '22px', marginBottom: '2.5rem', overflow: 'hidden' }}>
            <div style={{ height: '3px', background: `linear-gradient(90deg, ${sec.accent}, ${sec.accent}55)` }} />
            <div className="flex flex-col md:flex-row">
              <div style={{ flexShrink: 0, padding: '2rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', background: `radial-gradient(circle at center, ${sec.accent}08 0%, transparent 70%)` }}>
                <img src={sec.image} alt={sec.label} style={{ width: '130px', height: 'auto', objectFit: 'contain', filter: `drop-shadow(0 4px 16px ${sec.accent}33)` }} draggable={false} title="" />
              </div>
              <div style={{ flex: 1, padding: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0, background: sec.accent + '15', border: `1px solid ${sec.accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>{sec.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '999px', background: sec.accent + '15', color: sec.accent, border: `1px solid ${sec.accent}30`, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{sec.label}</span>
                      <Link to={sec.route} style={{ fontSize: '0.65rem', color: sec.accent, textDecoration: 'none', fontWeight: 600, opacity: 0.8 }}>{t('about.openArrow')}</Link>
                    </div>
                    <h2 style={{ color: '#f0f0f0', fontWeight: 900, fontSize: '1.2rem', margin: 0 }}>{sec.tagline}</h2>
                  </div>
                </div>
                <p style={{ color: '#94a3b8', fontSize: '0.875rem', lineHeight: 1.75, margin: '0 0 0.75rem' }}>{sec.description}</p>

                {sec.id === 'tracks' && (
                  <LiveBadge
                    lastUpdated={stats.lastUpdated} nextScan={stats.nextScan}
                    liveLabel={t('about.liveData')}
                    updatedLabel={t('about.updatedAt')}
                    nextScanLabel={t('about.nextScan')}
                  />
                )}

                {sec.id === 'tracks' && stats.tokenCount > 0 && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                    {[
                      { label: t('about.statsTokens'), value: stats.tokenCount, color: '#f7931a' },
                      { label: t('about.statsLpPools'), value: stats.poolCount, color: '#38bdf8' },
                      { label: t('about.statsFarms'), value: stats.farmCount, color: '#22c55e' },
                    ].map(chip => (
                      <div key={chip.label} style={{ background: chip.color + '10', border: `1px solid ${chip.color}25`, borderRadius: '8px', padding: '0.3rem 0.7rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 800, color: chip.color }}>{chip.value}</span>
                        <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600 }}>{chip.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                {'whyFirst' in sec && sec.whyFirst && (
                  <div style={{ background: `${sec.accent}08`, border: `1px solid ${sec.accent}25`, borderRadius: '10px', padding: '0.875rem 1rem', marginBottom: '1.25rem' }}>
                    <p style={{ color: sec.accent, fontSize: '0.8rem', fontWeight: 700, margin: '0 0 0.25rem' }}>{t('about.startHereTitle')}</p>
                    <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0, lineHeight: 1.6 }}>{t('about.startHereBody')}</p>
                  </div>
                )}

                {'note' in sec && sec.note && (
                  <div style={{ background: `${sec.note.color}08`, border: `1px solid ${sec.note.color}20`, borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1.25rem' }}>
                    <p style={{ color: '#64748b', fontSize: '0.75rem', margin: 0, lineHeight: 1.6 }}>&#8505;&#65039; {sec.note.text}</p>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.625rem', marginBottom: '1.25rem' }}>
                  {sec.features.map((f: any) => (
                    <div key={f.title} style={{ background: f.custom ? `${sec.accent}08` : 'rgba(255,255,255,0.02)', border: f.custom ? `1px solid ${sec.accent}30` : '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '0.75rem 0.875rem', position: 'relative' }}>
                      {f.custom && <span style={{ position: 'absolute', top: '0.4rem', right: '0.5rem', fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.08em', padding: '0.1rem 0.4rem', borderRadius: '999px', background: sec.accent + '20', color: sec.accent, border: `1px solid ${sec.accent}30`, textTransform: 'uppercase' }}>{t('common.custom')}</span>}
                      <div style={{ color: sec.accent, fontWeight: 700, fontSize: '0.78rem', marginBottom: '0.25rem', paddingRight: f.custom ? '2.5rem' : 0 }}>{f.title}</div>
                      <div style={{ color: '#64748b', fontSize: '0.75rem', lineHeight: 1.55 }}>{f.desc}</div>
                    </div>
                  ))}
                </div>

                <details style={{ cursor: 'pointer' }}>
                  <summary style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 700, userSelect: 'none', listStyle: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.6rem', color: sec.accent }}>&#9658;</span> {t('about.techSpecs')}
                  </summary>
                  <TechTable rows={(sec as any).getTechSpec(stats)} accent={sec.accent} />
                </details>
              </div>
            </div>
          </motion.div>
        ))}

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="text-center mt-4 pb-4">
          <p style={{ color: '#475569', fontSize: '0.8rem', marginBottom: '1rem' }}>{t('about.footerText')}</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link to="/tracks" style={{ padding: '0.6rem 1.25rem', borderRadius: '10px', background: 'rgba(247,147,26,0.1)', color: '#f7931a', border: '1px solid rgba(247,147,26,0.2)', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 700 }}>{t('about.tracksBtn')}</Link>
            <Link to="/minter" style={{ padding: '0.6rem 1.25rem', borderRadius: '10px', background: 'rgba(255,107,53,0.1)', color: '#ff6b35', border: '1px solid rgba(255,107,53,0.2)', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 700 }}>{t('about.minterBtn')}</Link>
            <Link to="/school" style={{ padding: '0.6rem 1.25rem', borderRadius: '10px', background: 'rgba(183,91,227,0.1)', color: '#b75be3', border: '1px solid rgba(183,91,227,0.2)', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 700 }}>{t('about.schoolBtn')}</Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
