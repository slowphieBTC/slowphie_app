import { Link, useLocation } from 'react-router-dom'
import { WalletButton } from './WalletButton'

export default function AppBar() {
  const location = useLocation()
  const isMinter = location.pathname === '/minter'

  return (
    <header className="appbar-glass sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-3 group">
          <img
            src="/SlowphieLogo.png"
            alt="Slowphie Logo"
            className="h-12 w-12 object-contain"
          />
          <span className="text-xl font-bold tracking-tight text-white group-hover:text-gradient transition-all duration-200">
            Slowphie
          </span>
          <span style={{ fontSize: '0.55rem', fontWeight: 700, color: '#475569', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '0.1rem 0.35rem', letterSpacing: '0.08em', textTransform: 'uppercase', alignSelf: 'center' }}>Beta</span>
        </Link>

        {isMinter && <WalletButton />}
      </div>
    </header>
  )
}
