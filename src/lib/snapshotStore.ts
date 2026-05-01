/**
 * IndexedDB wrapper for portfolio snapshots.
 *
 * DB: 'slowphie-portfolio'  version: 1
 *
 * Object stores:
 *   snapshots    — keyPath: ts (Uint32 unix seconds), value: { ts, d: Uint8Array }
 *   wallet_index — keyPath: address, value: { address, index, label }
 *   token_index  — keyPath: address, value: { address, index, symbol }
 */

const DB_NAME    = 'slowphie-portfolio';
const DB_VERSION = 1;

export interface WalletIndexEntry {
  address: string;  // full bc1q… address
  index:   number;  // Uint8 (0–254)
  label:   string;
}

export interface TokenIndexEntry {
  address: string;  // full 0x… contract address
  index:   number;  // Uint8 (0–254)
  symbol:  string;
}

export interface SnapshotRecord {
  ts: number;       // Uint32 unix seconds (keyPath)
  d:  Uint8Array;   // raw binary blob
}

// ── DB init ──────────────────────────────────────────────────────────────────

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('snapshots')) {
        const snap = db.createObjectStore('snapshots', { keyPath: 'ts' });
        snap.createIndex('by_ts', 'ts', { unique: true });
      }
      if (!db.objectStoreNames.contains('wallet_index')) {
        db.createObjectStore('wallet_index', { keyPath: 'address' });
      }
      if (!db.objectStoreNames.contains('token_index')) {
        db.createObjectStore('token_index', { keyPath: 'address' });
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(req.result); };
    req.onerror  = () => reject(req.error);
  });
}

// ── Generic helpers ───────────────────────────────────────────────────────────

function idbGet<T>(store: IDBObjectStore, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror   = () => reject(req.error);
  });
}

function idbPut(store: IDBObjectStore, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = store.put(value);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

function idbCount(store: IDBObjectStore): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// ── Wallet index ──────────────────────────────────────────────────────────────

/**
 * Returns the Uint8 index for a wallet address, creating one if new.
 * Max 254 wallets (index 255 reserved).
 */
export async function resolveWalletIndex(
  address: string,
  label: string,
): Promise<number> {
  const db = await openDB();
  const tx    = db.transaction('wallet_index', 'readwrite');
  const store = tx.objectStore('wallet_index');
  const existing = await idbGet<WalletIndexEntry>(store, address);
  if (existing) {
    // update label if changed
    if (existing.label !== label) await idbPut(store, { ...existing, label });
    return existing.index;
  }
  const count = await idbCount(store);
  const index = count; // next available (0-based)
  await idbPut(store, { address, index, label });
  return index;
}

export async function getAllWalletIndices(): Promise<WalletIndexEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('wallet_index', 'readonly');
    const req = tx.objectStore('wallet_index').getAll();
    req.onsuccess = () => resolve(req.result as WalletIndexEntry[]);
    req.onerror   = () => reject(req.error);
  });
}

// ── Token index ───────────────────────────────────────────────────────────────

/**
 * Returns the Uint8 index for a token contract address, creating one if new.
 */
export async function resolveTokenIndex(
  address: string,
  symbol: string,
): Promise<number> {
  const db = await openDB();
  const tx    = db.transaction('token_index', 'readwrite');
  const store = tx.objectStore('token_index');
  const existing = await idbGet<TokenIndexEntry>(store, address);
  if (existing) return existing.index;
  const count = await idbCount(store);
  const index = count;
  await idbPut(store, { address, index, symbol });
  return index;
}

export async function getAllTokenIndices(): Promise<TokenIndexEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('token_index', 'readonly');
    const req = tx.objectStore('token_index').getAll();
    req.onsuccess = () => resolve(req.result as TokenIndexEntry[]);
    req.onerror   = () => reject(req.error);
  });
}

// ── Snapshots ─────────────────────────────────────────────────────────────────

/** Save a binary snapshot. Overwrites if same ts already exists. */
export async function saveSnapshot(ts: number, data: Uint8Array): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction('snapshots', 'readwrite');
    const store = tx.objectStore('snapshots');
    const req   = store.put({ ts, d: data });
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

/** Load all snapshots in [fromTs, toTs] range (unix seconds). */
export async function getSnapshotsInRange(
  fromTs: number,
  toTs: number,
): Promise<SnapshotRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction('snapshots', 'readonly');
    const store = tx.objectStore('snapshots');
    const range = IDBKeyRange.bound(fromTs, toTs);
    const req   = store.index('by_ts').openCursor(range);
    const results: SnapshotRecord[] = [];
    req.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        results.push(cursor.value as SnapshotRecord);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/** Return total snapshot count and estimated storage bytes. */
export async function getSnapshotStats(): Promise<{ count: number; estimatedBytes: number }> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction('snapshots', 'readonly');
    const store = tx.objectStore('snapshots');
    const req   = store.count();
    req.onsuccess = () => resolve({ count: req.result, estimatedBytes: req.result * 260 });
    req.onerror   = () => reject(req.error);
  });
}

/** Delete all snapshots older than cutoffTs (unix seconds). */
export async function pruneSnapshotsBefore(cutoffTs: number): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction('snapshots', 'readwrite');
    const store = tx.objectStore('snapshots');
    const range = IDBKeyRange.upperBound(cutoffTs, true);
    const req   = store.index('by_ts').openCursor(range);
    let deleted = 0;
    req.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        cursor.delete();
        deleted++;
        cursor.continue();
      } else {
        resolve(deleted);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/** Delete all snapshots and reset index stores. */
export async function clearAllSnapshots(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['snapshots', 'wallet_index', 'token_index'], 'readwrite');
    tx.objectStore('snapshots').clear();
    tx.objectStore('wallet_index').clear();
    tx.objectStore('token_index').clear();
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

/**
 * Downsample an array to at most maxPoints entries
 * using uniform step sampling (fast, good enough for long periods).
 */
export function downsample<T>(items: T[], maxPoints: number): T[] {
  if (items.length <= maxPoints) return items;
  const step = Math.ceil(items.length / maxPoints);
  return items.filter((_, i) => i % step === 0);
}
