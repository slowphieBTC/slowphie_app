import { motion } from 'framer-motion';

export function TokenCardSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="glass-card p-5 flex flex-col gap-4"
    >
      {/* Top row: icon + badge */}
      <div className="flex items-start justify-between">
        <div className="w-11 h-11 rounded-full bg-dark-700 animate-pulse" />
        <div className="w-16 h-6 rounded-md bg-dark-700 animate-pulse" />
      </div>

      {/* Name */}
      <div className="space-y-2">
        <div className="w-3/4 h-5 rounded bg-dark-700 animate-pulse" />
        <div className="w-1/2 h-3 rounded bg-dark-700 animate-pulse" />
      </div>

      {/* Route count */}
      <div className="w-20 h-5 rounded bg-dark-700 animate-pulse" />

      {/* Address */}
      <div className="w-full h-4 rounded bg-dark-700 animate-pulse mt-auto" />
    </motion.div>
  );
}

export function TokenGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <TokenCardSkeleton key={i} />
      ))}
    </div>
  );
}
