import { RailwayPoint } from '../types.ts';

const DB_NAME = 'DemiryoluKM_DB';
const DB_VERSION = 1;
const STORE_NAME = 'points';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function getDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          console.warn('IndexedDB açılamadı, localStorage kullanılacak');
          resolve(null);
        };
      } catch (err) {
        console.warn('IndexedDB başlatma hatası:', err);
        resolve(null);
      }
    });
  }
  return dbPromise;
}

/**
 * Save all points to IndexedDB for large-capacity persistence (photos, attachments)
 */
export async function savePointsToIDB(points: RailwayPoint[]): Promise<void> {
  try {
    const db = await getDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        for (const p of points) {
          store.put(p);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch (err) {
    console.warn('IDB kayıt uyarısı:', err);
  }
}

/**
 * Read all points from IndexedDB
 */
export async function getPointsFromIDB(): Promise<RailwayPoint[]> {
  try {
    const db = await getDB();
    if (!db) return [];

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          const results = req.result;
          if (Array.isArray(results)) {
            resolve(results);
          } else {
            resolve([]);
          }
        };
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  } catch {
    return [];
  }
}

/**
 * Clear all points completely from IndexedDB
 */
export async function clearPointsFromIDB(): Promise<void> {
  try {
    const db = await getDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch (err) {
    console.warn('IDB temizleme uyarısı:', err);
  }
}
