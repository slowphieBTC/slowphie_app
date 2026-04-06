import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, Wallet, PencilLine, Check } from 'lucide-react';
import { useAppStore } from '../store';

function isValidAddress(addr: string) {
  if (!addr) return false;
  if (addr.startsWith('bc1') && addr.length >= 42) return true;
  if (addr.startsWith('0x') && addr.length === 66) return true;
  // also accept bare 64-char hex
  if (/^[0-9a-fA-F]{64}$/.test(addr)) return true;
  return false;
}

export function SettingsModal() {
  const open = useAppStore((s) => s.settingsOpen);
  const setOpen = useAppStore((s) => s.setSettingsOpen);
  const addresses = useAppStore((s) => s.addresses);
  const addAddress = useAppStore((s) => s.addAddress);
  const removeAddress = useAppStore((s) => s.removeAddress);
  const updateAddress = useAppStore((s) => s.updateAddress);

  const [inputAddr, setInputAddr] = useState('');
  const [inputLabel, setInputLabel] = useState('');
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) { setInputAddr(''); setInputLabel(''); setError(''); }
  }, [open]);

  function handleAdd() {
    const addr = inputAddr.trim();
    const label = inputLabel.trim() || 'My Wallet';
    if (!isValidAddress(addr)) {
      setError('Invalid address. Use BTC taproot (bc1p...) or OPNet (0x + 64 hex).');
      return;
    }
    if (addresses.find((a) => a.address === addr)) {
      setError('Address already added.');
      return;
    }
    addAddress(label, addr);
    setInputAddr('');
    setInputLabel('');
    setError('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleAdd();
    if (e.key === 'Escape') setOpen(false);
  }

  function startEdit(id: string, label: string) {
    setEditingId(id);
    setEditLabel(label);
  }

  function saveEdit(id: string) {
    if (editLabel.trim()) updateAddress(id, editLabel.trim());
    setEditingId(null);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            ref={overlayRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="glass rounded-2xl w-full max-w-lg p-6 shadow-2xl pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white">Settings</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Manage your tracked addresses</p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-dark-700 text-gray-500 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Add address form */}
              <div className="space-y-3 mb-6">
                <div>
                  <label className="stat-label block mb-1.5">Label (optional)</label>
                  <input
                    type="text"
                    value={inputLabel}
                    onChange={(e) => setInputLabel(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="e.g. My Main Wallet"
                    className="w-full bg-[#0a0a14] border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="stat-label block mb-1.5">Address</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inputAddr}
                      onChange={(e) => { setInputAddr(e.target.value); setError(''); }}
                      onKeyDown={handleKeyDown}
                      placeholder="bc1p... or 0x..."
                      className="flex-1 bg-[#0a0a14] border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-brand-500/50 transition-colors"
                    />
                    <button onClick={handleAdd} className="btn-primary flex items-center gap-1.5">
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </div>
                  {error && <p className="text-xs text-red-400 mt-1.5">{error}</p>}
                </div>
              </div>

              {/* Address list */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                <AnimatePresence mode="popLayout">
                  {addresses.length === 0 && (
                    <div className="text-center py-8 text-gray-600">
                      <Wallet className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No addresses added yet</p>
                    </div>
                  )}
                  {addresses.map((addr) => (
                    <motion.div
                      key={addr.id}
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="flex items-center gap-3 bg-dark-700/40 border border-dark-600/50 rounded-xl px-3.5 py-3"
                    >
                      <div className="w-7 h-7 bg-brand-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Wallet className="w-3.5 h-3.5 text-brand-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {editingId === addr.id ? (
                          <input
                            autoFocus
                            type="text"
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(addr.id); if (e.key === 'Escape') setEditingId(null); }}
                            className="w-full bg-[#0a0a14] border border-gray-700 rounded-lg px-2 py-0.5 text-sm text-white focus:outline-none border border-brand-500/40"
                          />
                        ) : (
                          <div className="text-sm font-medium text-white truncate">{addr.label}</div>
                        )}
                        <div className="text-xs font-mono text-gray-500 truncate mt-0.5">
                          {addr.address.slice(0, 10)}...{addr.address.slice(-8)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {editingId === addr.id ? (
                          <button onClick={() => saveEdit(addr.id)} className="p-1.5 hover:text-green-400 text-gray-500 transition-colors">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button onClick={() => startEdit(addr.id, addr.label)} className="p-1.5 hover:text-brand-400 text-gray-600 transition-colors">
                            <PencilLine className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => removeAddress(addr.id)} className="p-1.5 hover:text-red-400 text-gray-600 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div className="mt-4 pt-4 border-t border-dark-600/50">
                <p className="text-xs text-gray-600 text-center">Addresses are stored locally in your browser only</p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
