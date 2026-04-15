import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'

const modules = [
  {
    id: 'opstrat',
    title: 'Tracks',
    label: 'Tracks',
    description: 'Track your MotoSwap positions',
    image: '/OpStrat.png',
    route: '/tracks',
    accent: '#f7931a'
  },
  {
    id: 'opminter',
    title: 'Minter',
    label: 'Minter',
    description: 'Easy access to free mint early',
    image: '/OpMinter.png',
    route: '/minter',
    accent: '#ff6b35'
  },
  {
    id: 'opschool',
    title: 'School',
    label: 'Learn',
    description: 'Learn Bitcoin and OP_NET Layer1 protocol',
    image: '/OpSchool.png',
    route: '/school',
    accent: '#b75be3'
  }
]

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12
    }
  }
}

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.4, 0, 0.2, 1] }
  }
}

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-grid flex flex-col items-center justify-center px-6 py-16 overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-[#f7931a]/5 blur-[120px] pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-[#f7931a]/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[300px] rounded-full bg-[#b75be3]/4 blur-[100px] pointer-events-none" />

      {/* About + Social links — top right, Home only */}
      <div style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', zIndex: 10 }}>
        {/* X (Twitter) */}
        <a href="https://x.com/Slowphieonbtc" target="_blank" rel="noopener noreferrer"
          style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#94a3b8', backdropFilter: 'blur(8px)', transition: 'color 0.2s, border-color 0.2s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#fff'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.3)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#94a3b8'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.1)'; }}
          title="@Slowphieonbtc on X"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
        </a>
        {/* GitHub */}
        <a href="https://github.com/slowphieBTC/slowphie_app" target="_blank" rel="noopener noreferrer"
          style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#94a3b8', backdropFilter: 'blur(8px)', transition: 'color 0.2s, border-color 0.2s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#fff'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.3)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#94a3b8'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.1)'; }}
          title="GitHub — slowphie_app"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/></svg>
        </a>
        {/* Telegram */}
        <a href="https://t.me/SlowphieChat" target="_blank" rel="noopener noreferrer"
          style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#94a3b8', backdropFilter: 'blur(8px)', transition: 'color 0.2s, border-color 0.2s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#29b6f6'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(41,182,246,0.3)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#94a3b8'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.1)'; }}
          title="Slowphie on Telegram"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
        </a>
        {/* About */}
        <Link
          to="/about"
          style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textDecoration: 'none', padding: '0.35rem 0.875rem', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(8px)', transition: 'color 0.2s, border-color 0.2s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#f7931a'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(247,147,26,0.3)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#94a3b8'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.1)'; }}
        >
          About
        </Link>
      </div>

      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="text-center mb-16"
      >
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-3">
          Welcome to{' '}
          <span className="text-gradient">Slowphie</span>
        </h1>
        <p className="text-slate-400 text-lg max-w-md mx-auto">
          Your OP_NET powered DeFi dashboard
        </p>
      </motion.div>

      {/* Cards Grid */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {modules.map((mod) => (
          <motion.div
            key={mod.id}
            variants={cardVariants}
            className="glass-card cursor-pointer group p-0"
            onClick={() => navigate(mod.route)}
            style={{ '--accent': mod.accent } as React.CSSProperties}
          >
            {/* Card image area */}
            <div className="relative overflow-hidden rounded-t-3xl">
              <img
                src={mod.image}
                alt={mod.title}
                title=""
                draggable={false}
                className="w-[60%] mx-auto block h-auto -mt-[28px] -mb-[50px] transition-transform duration-500 group-hover:scale-105"
              />
              {/* Glossy shine overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-350 pointer-events-none" />
              {/* Bottom fade */}
              <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#060a14]/80 to-transparent" />
            </div>

            {/* Card content */}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white group-hover:text-gradient transition-all duration-300">
                    {mod.title}
                  </h2>
                  <p className="text-slate-400 text-sm mt-0.5">{mod.description}</p>
                </div>
                <span
                  className="text-xs font-semibold px-3 py-1.5 rounded-full border transition-all duration-300 whitespace-nowrap ml-3"
                  style={{
                    color: mod.accent,
                    borderColor: `${mod.accent}44`,
                    background: `${mod.accent}11`
                  }}
                >
                  {mod.label}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
