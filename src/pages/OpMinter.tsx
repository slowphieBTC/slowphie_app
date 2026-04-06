import { motion } from 'framer-motion'
import { TokenCard } from '../components/TokenCard'
import { TOKENS } from '../config/tokens'

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } }
}

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] } }
}

export default function OpMinter() {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-grid pb-16 overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full bg-[#f7931a]/4 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] rounded-full bg-[#b75be3]/4 blur-[120px] pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 pt-12">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center mb-10 space-y-4"
        >
          <h1 className="text-4xl md:text-5xl font-extrabold text-white">
            Mint on{' '}
            <span className="text-gradient">Bitcoin</span>
          </h1>

          <p className="text-gray-400 max-w-md mx-auto text-sm">
            Connect your OP_WALLET and mint OP-20 tokens directly on Bitcoin's L1
            smart contract platform.
          </p>
        </motion.div>

        {/* Token Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {TOKENS.map((token) => (
            <motion.div key={token.id} variants={cardVariants}>
              <TokenCard token={token} />
            </motion.div>
          ))}
        </motion.div>

        {/* Footer links */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-10 flex flex-wrap justify-center gap-6 text-xs text-gray-600"
        >
          <a
            href="https://opnet.org"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-400 transition-colors"
          >
            opnet.org ↗
          </a>
          <a
            href="https://mainnet.opnet.org"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-400 transition-colors"
          >
            Explorer ↗
          </a>
        </motion.div>
      </div>
    </div>
  )
}
