// Gemeinsame IndexedDB des Turniermanagers (eigene Töne, Musik).
// Version 2: Stores für Musik hinzugekommen; „sounds“ bleibt unverändert erhalten.

const DB = 'turniermanager';
const VERSION = 2;
export type StoreName = 'sounds' | 'musicFiles' | 'musicMeta';

let opening: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      for (const name of ['sounds', 'musicFiles', 'musicMeta'] as const) {
        if (!d.objectStoreNames.contains(name)) d.createObjectStore(name);
      }
    };
    req.onsuccess = () => {
      const d = req.result;
      d.onversionchange = () => { d.close(); opening = null; };
      resolve(d);
    };
    req.onerror = () => { opening = null; reject(req.error); };
    req.onblocked = () => console.warn('IndexedDB-Upgrade wartet auf andere Tabs');
  });
  return opening;
}

async function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error ?? req.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaktion abgebrochen'));
  });
}

export const idbGet = <T>(store: StoreName, key: string) => run<T | undefined>(store, 'readonly', s => s.get(key));
export const idbPut = (store: StoreName, key: string, value: unknown) => run(store, 'readwrite', s => s.put(value, key));
export const idbDelete = (store: StoreName, key: string) => run(store, 'readwrite', s => s.delete(key));
export const idbKeys = (store: StoreName) => run<IDBValidKey[]>(store, 'readonly', s => s.getAllKeys());
