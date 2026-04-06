import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

interface Feature { title: string; desc: string; }
interface Section {
  id: string; image: string; route: string; label: string;
  accent: string; icon: string; tagline: string; description: string;
  features: Feature[];
  techSpec: [string, string][];
  note?: { text: string; color: string };
  whyFirst?: boolean;
}

const SECTIONS: Section[] = [
  {
    id: 'tracks',
    image: '/OpStrat.png',
    route: '/tracks',
    label: 'Tracks',
    accent: '#f7931a',
    icon: '\u{1F4CA}',
    tagline: 'Track your MotoSwap Positions',
    description: "Tracks gives you a real-time overview of all your MotoSwap DeFi positions across multiple Bitcoin wallets \u2014 without any login or custody.",
    features: [
      { title: 'Multi-wallet tracking', desc: 'Monitor staking, farming, and LP positions across all your addresses simultaneously.' },
      { title: 'Live BTC price & block data', desc: 'Powered by BlockFeed WebSocket stream \u2014 prices and block height update in real time.' },
      { title: 'Position aggregation', desc: 'MOTO staking, BTC farms (PILL, SAT, SWAP), LP SWAP/MOTO \u2014 all in one view.' },
      { title: 'Token totals card', desc: 'Aggregate token holdings across every tracked wallet for a complete portfolio snapshot.' },
      { title: '30s background refresh', desc: 'Data refreshes silently every 30 seconds. Navigate away and come back \u2014 no reload needed.' },
    ],
    techSpec: [
      ['Data source', 'OPNet Mainnet RPC + BlockFeed REST & WebSocket'],
      ['Supported positions', 'Stake, BTC Farm, LP Farm, Token Wallet'],
      ['Farms tracked', "PILL Farm, Satoshi's Farm, SWAP Farm"],
      ['Cache strategy', 'Zustand store \u2014 instant on return navigation'],
      ['Custody', 'None \u2014 read-only, no wallet connection required'],
    ],
  },
  {
    id: 'minter',
    image: '/OpMinter.png',
    route: '/minter',
    label: 'Minter',
    accent: '#ff6b35',
    icon: '\u{1FA99}',
    tagline: 'Discover & Mint Hidden OP-20 Tokens',
    description: "Minter helps you find and mint free OP-20 tokens directly on Bitcoin's L1 smart contract platform. Some tokens are hard to discover on MotoSwap \u2014 Minter surfaces them for you.",
    features: [
      { title: 'Hidden gem detection', desc: "Some mintable tokens are not visible in MotoSwap's standard interface. Minter finds them." },
      { title: 'One-click mint', desc: 'Connect your OP_WALLET browser extension and mint with a single click per token.' },
      { title: 'Supply progress bar', desc: 'See total supply vs circulating supply before minting \u2014 know how scarce a token is.' },
      { title: 'Wallet balance display', desc: 'Your current holding for each token shown in real time after connecting.' },
      { title: 'Mint status feedback', desc: 'Clear transaction states: idle \u2192 pending \u2192 confirmed, with error handling.' },
    ],
    techSpec: [
      ['Protocol', 'OP-20 standard on OPNet \u2014 Bitcoin L1 smart contracts'],
      ['Wallet', 'OP_WALLET browser extension (required)'],
      ['Tokens available', '$MONEY, $BIP110, $SWAP, $TESTICLE'],
      ['Platform fee', '1,000 sats (~$0.67) per mint transaction'],
      ['Settlement', 'Direct Bitcoin L1 \u2014 no bridge, no sidechain'],
    ],
    note: {
      text: 'A small platform fee of 1,000 sats is included in each mint transaction to support Slowphie infrastructure.',
      color: '#ff6b35',
    },
  },
  {
    id: 'school',
    image: '/OpSchool.png',
    route: '/school',
    label: 'School',
    accent: '#b75be3',
    icon: '\u{1F393}',
    tagline: 'Learn Bitcoin & OPNet \u2014 Before You DeFi',
    description: 'School is the essential first step before using Tracks or Minter. Bitcoin DeFi is technically complex \u2014 understanding the fundamentals protects your funds and sharpens your decisions.',
    features: [
      { title: '7 progressive modules', desc: 'From Bitcoin basics to quantum cryptography \u2014 each module unlocks after passing the previous quiz.' },
      { title: '35 quiz questions', desc: 'Real multiple-choice questions with explanations. Score 50%+ to unlock the next module.' },
      { title: '40+ glossary terms', desc: 'Searchable glossary of all Bitcoin DeFi terms, defined in plain English.' },
      { title: 'Practical exercises', desc: 'Each module includes hands-on exercises with auto-saving answer fields, stored locally.' },
      { title: 'Progress saved locally', desc: 'Quiz scores and exercise answers persist in your browser \u2014 continue across multiple sessions.' },
    ],
    techSpec: [
      ['Modules', '7 \u2014 Beginner to Advanced'],
      ['Topics', 'UTXO, ACS, OPNet architecture, NativeSwap, quantum, CEX vs DEX'],
      ['Quiz threshold', '50%+ to unlock next module'],
      ['Storage', 'localStorage \u2014 no account needed'],
      ['Estimated time', '~7 hours total across all modules'],
    ],
    whyFirst: true,
  },
];

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

export function About() {
  return (
    <div className="min-h-[calc(100vh-4rem)] pb-20 px-4 pt-8">
      <div className="max-w-4xl mx-auto">

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center mb-14"
        >
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
            About{' '}<span className="text-gradient">Slowphie</span>
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto text-sm leading-relaxed">
            Slowphie is a Bitcoin DeFi companion app built on OP_NET &#8212; the only smart contract
            platform that runs natively on Bitcoin L1 without bridges or sidechains.
            Three modules, one mission: track, mint, and learn.
          </p>
          <Link
            to="/"
            style={{ display: 'inline-block', marginTop: '1.25rem', fontSize: '0.78rem', color: '#f7931a', textDecoration: 'none', fontWeight: 600 }}
          >
            &#8592; Back to Home
          </Link>
        </motion.div>

        {/* Sections */}
        {SECTIONS.map((sec, idx) => (
          <motion.div
            key={sec.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 * (idx + 1) }}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${sec.accent}22`,
              borderRadius: '22px',
              marginBottom: '2.5rem',
              overflow: 'hidden',
            }}
          >
            {/* Colored top bar */}
            <div style={{ height: '3px', background: `linear-gradient(90deg, ${sec.accent}, ${sec.accent}55)` }} />

            <div className="flex flex-col md:flex-row">
              {/* Image */}
              <div style={{
                flexShrink: 0,
                padding: '2rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                background: `radial-gradient(circle at center, ${sec.accent}08 0%, transparent 70%)`,
              }}>
                <img
                  src={sec.image}
                  alt={sec.label}
                  style={{ width: '130px', height: 'auto', objectFit: 'contain', filter: `drop-shadow(0 4px 16px ${sec.accent}33)` }}
                  draggable={false}
                  title=""
                />
              </div>

              {/* Content */}
              <div style={{ flex: 1, padding: '2rem' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0, background: sec.accent + '15', border: `1px solid ${sec.accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>{sec.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '999px', background: sec.accent + '15', color: sec.accent, border: `1px solid ${sec.accent}30`, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{sec.label}</span>
                      <Link to={sec.route} style={{ fontSize: '0.65rem', color: sec.accent, textDecoration: 'none', fontWeight: 600, opacity: 0.8 }}>Open &#8594;</Link>
                    </div>
                    <h2 style={{ color: '#f0f0f0', fontWeight: 900, fontSize: '1.2rem', margin: 0 }}>{sec.tagline}</h2>
                  </div>
                </div>

                <p style={{ color: '#94a3b8', fontSize: '0.875rem', lineHeight: 1.75, margin: '0 0 1.25rem' }}>{sec.description}</p>

                {/* Why first note for School */}
                {sec.whyFirst && (
                  <div style={{ background: `${sec.accent}08`, border: `1px solid ${sec.accent}25`, borderRadius: '10px', padding: '0.875rem 1rem', marginBottom: '1.25rem' }}>
                    <p style={{ color: sec.accent, fontSize: '0.8rem', fontWeight: 700, margin: '0 0 0.25rem' }}>&#128161; Start here first</p>
                    <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0, lineHeight: 1.6 }}>Bitcoin DeFi is genuinely complex. Before staking, farming, or minting, take a few days to go through the modules. The technology rewards those who understand it &#8212; and punishes those who don&#39;t.</p>
                  </div>
                )}

                {/* Platform fee note */}
                {sec.note && (
                  <div style={{ background: `${sec.note.color}08`, border: `1px solid ${sec.note.color}20`, borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1.25rem' }}>
                    <p style={{ color: '#64748b', fontSize: '0.75rem', margin: 0, lineHeight: 1.6 }}>&#8505;&#65039; {sec.note.text}</p>
                  </div>
                )}

                {/* Features */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.625rem', marginBottom: '1.25rem' }}>
                  {sec.features.map(f => (
                    <div key={f.title} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '0.75rem 0.875rem' }}>
                      <div style={{ color: sec.accent, fontWeight: 700, fontSize: '0.78rem', marginBottom: '0.25rem' }}>{f.title}</div>
                      <div style={{ color: '#64748b', fontSize: '0.75rem', lineHeight: 1.55 }}>{f.desc}</div>
                    </div>
                  ))}
                </div>

                {/* Tech spec table */}
                <details style={{ cursor: 'pointer' }}>
                  <summary style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 700, userSelect: 'none', listStyle: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.6rem', color: sec.accent }}>&#9658;</span> Technical Specs
                  </summary>
                  <TechTable rows={sec.techSpec} accent={sec.accent} />
                </details>
              </div>
            </div>
          </motion.div>
        ))}

        {/* Footer CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center mt-4 pb-4"
        >
          <p style={{ color: '#475569', fontSize: '0.8rem', marginBottom: '1rem' }}>Built on OPNet &#183; Bitcoin Mainnet &#183; No bridges &#183; No custody</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link to="/tracks" style={{ padding: '0.6rem 1.25rem', borderRadius: '10px', background: 'rgba(247,147,26,0.1)', color: '#f7931a', border: '1px solid rgba(247,147,26,0.2)', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 700 }}>&#128202; Tracks</Link>
            <Link to="/minter" style={{ padding: '0.6rem 1.25rem', borderRadius: '10px', background: 'rgba(255,107,53,0.1)', color: '#ff6b35', border: '1px solid rgba(255,107,53,0.2)', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 700 }}>&#129689; Minter</Link>
            <Link to="/school" style={{ padding: '0.6rem 1.25rem', borderRadius: '10px', background: 'rgba(183,91,227,0.1)', color: '#b75be3', border: '1px solid rgba(183,91,227,0.2)', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 700 }}>&#127891; School</Link>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
