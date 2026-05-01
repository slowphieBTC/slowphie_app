import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, SlidersHorizontal, X, SortAsc, SortDesc, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface FilterState {
  search: string;
  trust: 'all' | 'OK' | 'warning';
  sort: string;
}

const SORT_OPTIONS = [
  { value: 'deployedAt_desc', label: 'Newest First', icon: SortDesc },
  { value: 'deployedAt_asc', label: 'Oldest First', icon: SortAsc },
  { value: 'marketCap_desc', label: 'Market Cap', icon: SortDesc },
  { value: 'price_desc', label: 'Highest Price', icon: SortDesc },
  { value: 'routeCount_desc', label: 'Most Routes', icon: SortDesc },
  { value: 'symbol_asc', label: 'Symbol A-Z', icon: SortAsc },
  { value: 'firstSeenAt_desc', label: 'Recently Seen', icon: SortDesc },
];

interface Props {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  totalCount: number;
  showingCount: number;
}

export default function SearchFilterBar({ filters, onChange, totalCount, showingCount }: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [localSearch, setLocalSearch] = useState(filters.search);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Debounce search input
  const handleSearchChange = useCallback((value: string) => {
    setLocalSearch(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      onChange({ ...filters, search: value });
    }, 300);
  }, [filters, onChange]);

  const clearSearch = () => {
    setLocalSearch('');
    onChange({ ...filters, search: '' });
  };

  const hasActiveFilters = filters.search || filters.trust !== 'all';

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      {/* Search row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t('router.searchPlaceholder', 'Search tokens...')}
            className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-dark-800/60 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all"
          />
          {localSearch && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all ${
            expanded || hasActiveFilters
              ? 'bg-white/10 border-white/20 text-white'
              : 'bg-dark-800/60 border-white/10 text-gray-400 hover:text-white'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="hidden sm:inline">{t('router.filters', 'Filters')}</span>
          {hasActiveFilters && (
            <span className="w-2 h-2 rounded-full bg-green-400" />
          )}
        </button>
      </div>

      {/* Expanded filters */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-dark-800/40 border border-white/5">
              {/* Trust filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Trust:</span>
                <div className="flex rounded-lg bg-dark-900/60 p-0.5">
                  {(['all', 'OK', 'warning'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => onChange({ ...filters, trust: t })}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                        filters.trust === t
                          ? 'bg-white/10 text-white'
                          : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {t === 'OK' && <ShieldCheck className="w-3 h-3 text-green-400" />}
                      {t === 'warning' && <AlertTriangle className="w-3 h-3 text-yellow-400" />}
                      {t === 'all' ? 'All' : t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Sort:</span>
                <select
                  value={filters.sort}
                  onChange={(e) => onChange({ ...filters, sort: e.target.value })}
                  className="bg-dark-900/60 border border-white/10 rounded-lg px-3 py-1 text-xs text-white focus:outline-none focus:border-white/20"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Clear all */}
              {hasActiveFilters && (
                <button
                  onClick={() => {
                    setLocalSearch('');
                    onChange({ search: '', trust: 'all', sort: 'deployedAt_desc' });
                  }}
                  className="ml-auto text-xs text-gray-500 hover:text-red-400 transition-colors flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Clear all
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results count */}
      <div className="text-xs text-gray-500 px-1">
        Showing <span className="text-white font-medium">{showingCount}</span> of{' '}
        <span className="text-white font-medium">{totalCount}</span> tokens
      </div>
    </motion.div>
  );
}
