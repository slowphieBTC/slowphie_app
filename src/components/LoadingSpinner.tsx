import { motion } from 'framer-motion';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export function LoadingSpinner({ size = 'md', label }: Props) {
  const sizes = { sm: 'w-5 h-5', md: 'w-8 h-8', lg: 'w-12 h-12' };
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <motion.div className={`${sizes[size]} rounded-full border-2 border-dark-600 border-t-brand-500`} animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
      {label && <p className="text-sm text-gray-500">{label}</p>}
    </div>
  );
}
