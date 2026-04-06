import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center gap-4 py-16 text-center"
    >
      <div className="w-16 h-16 bg-dark-800 border border-dark-600 rounded-2xl flex items-center justify-center">
        <Icon className="w-8 h-8 text-gray-600" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-gray-300">{title}</h3>
        <p className="text-sm text-gray-500 mt-1 max-w-sm">{description}</p>
      </div>
      {action && <div className="mt-2">{action}</div>}
    </motion.div>
  );
}
