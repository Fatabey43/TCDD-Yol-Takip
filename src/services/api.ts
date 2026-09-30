import { RailwayPoint, PointNote, PointPhoto } from '../types.ts';
import { DEFAULT_SAMPLE_IDS } from '../data/samplePoints.ts';
import { extractKmFromText } from '../utils/categoryColors.ts';
import { compressImage } from '../utils/imageCompressor.ts';
import { savePointsToIDB, getPointsFromIDB, clearPointsFromIDB } from '../utils/dbStorage.ts';
import { sortPointsByKm } from '../utils/kmUtils.ts';

const LOCAL_STORAGE_KEY = 'demiryolu_km_points_cache';
const LOCAL_BACKUP_KEY = 'demiryolu_km_points_backup_v2';
const USER_CUSTOM_KEY = 'demiryolu_km_user_custom_points';
const DELETED_POINTS_KEY = 'demiryolu_km_deleted_ids';
const CLEARED_AT_KEY = 'demiryolu_km_last_cleared_at';
const PENDING_SYNC_KEY = 'demiryolu_km_pending_sync_queue_v1';

export interface PendingSyncItem {
  id: string;
  type: 'upsert' | 'delete';
  point?: RailwayPoint;
  timestamp: number;
}

export function getPendingSyncQueue(): PendingSyncItem[] {
  try {
    const raw = localStorage.getItem(PENDING_SYNC_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    }
  } catch {}
  return [];
}

export function addPendingSyncItem(item: PendingSyncItem) {
  try {
    const queue = getPendingSyncQueue().filter((q) => q.id !== item.id);
    queue.push(item);
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(queue));
  } catch {}
}

export function removePendingSyncItem(id: string) {
  try {
    const queue = getPendingSyncQueue().filter((q) => q.id !== id);
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(queue));
  } catch {}
}

export async function flushPendingSyncQueue(): Promise<void> {
  const queue = getPendingSyncQueue();
  if (queue.length === 0) return;

  const remaining: PendingSyncItem[] = [];
  for (const item of queue) {
    try {
      if (item.type === 'delete') {
        const res = await fetch(`/api/points/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
        if (!res.ok && res.status !== 404) {
          remaining.push(item);
        }
      } else if (item.type === 'upsert' && item.point) {
        const res = await fetch(`/api/points/${encodeURIComponent(item.id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.point),
        });
        if (!res.ok) {
          remaining.push(item);
        }
      }
    } catch {
      remaining.push(item);
    }
  }
  try {
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(remaining));
  } catch {}
}

// Check if an ID belongs to a default demo/sample point that must never reappear
export function isDefaultSamplePoint(id?: string): boolean {
  if (!id) return false;
  return (
    id.startsWith('pt-tcdd-') ||
    id.startsWith('tcdd-') ||
    DEFAULT_SAMPLE_IDS.includes(id)
  );
}

// Track deleted IDs so deleted points aren't resurrected
export function getDeletedIds(): Set<string> {
  const set = new Set<string>();
  // Permanently blacklist default sample points
  DEFAULT_SAMPLE_IDS.forEach((id) => set.add(id));

  try {
    const raw = localStorage.getItem(DELETED_POINTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((id) => {
          if (typeof id === 'string') set.add(id);
        });
      }
    }
  } catch {
    // ignore
  }
  return set;
}

export function saveDeletedIds(set: Set<string>) {
  try {
    localStorage.setItem(DELETED_POINTS_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

export function addDeletedId(id: string) {
  if (!id) return;
  try {
    const set = getDeletedIds();
    set.add(id);
    saveDeletedIds(set);
  } catch {
    // ignore
  }
}

// Helper to get explicitly modified/added points by user
function getUserCustomPoints(): Record<string, RailwayPoint> {
  try {
    const raw = localStorage.getItem(USER_CUSTOM_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    // ignore
  }
  return {};
}

function recordUserCustomPoint(point: RailwayPoint) {
  if (!point || !point.id || isDefaultSamplePoint(point.id)) return;
  try {
    const map = getUserCustomPoints();
    map[point.id] = {
      ...point,
      updatedAt: point.updatedAt || new Date().toISOString(),
    };
    try {
      localStorage.setItem(USER_CUSTOM_KEY, JSON.stringify(map));
    } catch (quotaErr) {
      // If quota exceeded, store lightweight version in localStorage (IndexedDB has full data)
      const lightweightMap: Record<string, any> = {};
      for (const [k, v] of Object.entries(map)) {
        lightweightMap[k] = {
          ...v,
          photos: (v.photos || []).map((ph) => ({
            ...ph,
            dataUrl: ph.dataUrl && ph.dataUrl.length > 5000 ? ph.dataUrl.slice(0, 80) + '...[idb]' : ph.dataUrl,
          })),
        };
      }
      localStorage.setItem(USER_CUSTOM_KEY, JSON.stringify(lightweightMap));
    }
  } catch (err) {
    console.warn('Kullanıcı nokta kaydı uyarısı:', err);
  }
}

function removeUserCustomPoint(id: string) {
  try {
    const map = getUserCustomPoints();
    if (map[id]) {
      delete map[id];
      localStorage.setItem(USER_CUSTOM_KEY, JSON.stringify(map));
    }
  } catch {
    // ignore
  }
}

// Purge any lingering default sample points or deleted IDs from all localStorage caches
export function purgeDeletedAndDefaultPoints(): void {
  try {
    const deletedIds = getDeletedIds();

    // 1. Clean user custom points
    const userMap = getUserCustomPoints();
    let userChanged = false;
    for (const key of Object.keys(userMap)) {
      if (isDefaultSamplePoint(key) || deletedIds.has(key)) {
        delete userMap[key];
        userChanged = true;
      }
    }
    if (userChanged) {
      localStorage.setItem(USER_CUSTOM_KEY, JSON.stringify(userMap));
    }

    // 2. Clean known cache keys
    [LOCAL_STORAGE_KEY, LOCAL_BACKUP_KEY].forEach((key) => {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) {
            const clean = arr.filter(
              (p: any) => p && p.id && !deletedIds.has(p.id) && !isDefaultSamplePoint(p.id)
            );
            localStorage.setItem(key, JSON.stringify(clean));
          }
        } catch {
          // ignore
        }
      }
    });
  } catch (err) {
    console.warn('Önbellek temizleme uyarısı:', err);
  }
}

// Run cleanup immediately upon module evaluation
purgeDeletedAndDefaultPoints();

/**
 * Ensures KM information is extracted and never empty if present in title
 * Also normalizes legacy line name "Kayıtlı Demiryolu Hattı" to "Eskişehir-Konya"
 */
function normalizePoint(p: RailwayPoint): RailwayPoint {
  const km = (p.kmValue && p.kmValue.trim())
    ? p.kmValue.trim()
    : extractKmFromText(p.title);

  let lineName = p.lineName;
  let description = p.description || '';

  if (lineName === 'Kayıtlı Demiryolu Hattı') {
    lineName = 'Eskişehir-Konya';
  }
  if (description.includes('Kayıtlı Demiryolu Hattı')) {
    description = description
      .replace(/Hat:\s*Kayıtlı Demiryolu Hattı/g, 'Hat: Eskişehir-Konya')
      .replace(/Kayıtlı Demiryolu Hattı/g, 'Eskişehir-Konya');
  }

  return {
    ...p,
    lineName,
    description,
    kmValue: km,
    levelCrossing: p.levelCrossing || (p as any).level_crossing || undefined,
    notes: Array.isArray(p.notes) ? p.notes : [],
    photos: Array.isArray(p.photos) ? p.photos : [],
  };
}

// Helper to read local points from storage
export function getLocalCachedPoints(): RailwayPoint[] {
  const recoveredMap = new Map<string, RailwayPoint>();
  const deletedIds = getDeletedIds();

  // 1. Recover from user custom map first
  const userMap = getUserCustomPoints();
  Object.values(userMap).forEach((p) => {
    if (
      p &&
      p.id &&
      !deletedIds.has(p.id) &&
      !isDefaultSamplePoint(p.id) &&
      typeof p.lat === 'number' &&
      typeof p.lng === 'number'
    ) {
      recoveredMap.set(p.id, normalizePoint(p));
    }
  });

  // 2. Read from primary cache
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY) || localStorage.getItem(LOCAL_BACKUP_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (
            item &&
            item.id &&
            !deletedIds.has(item.id) &&
            !isDefaultSamplePoint(item.id) &&
            typeof item.lat === 'number' &&
            typeof item.lng === 'number'
          ) {
            const norm = normalizePoint(item);
            const existing = recoveredMap.get(norm.id);
            if (!existing) {
              recoveredMap.set(norm.id, norm);
            } else {
              // Merge photos so none are lost
              const photoMap = new Map<string, PointPhoto>();
              (existing.photos || []).forEach((ph) => photoMap.set(ph.id, ph));
              (norm.photos || []).forEach((ph) => photoMap.set(ph.id, ph));

              // Merge notes
              const noteMap = new Map<string, PointNote>();
              (existing.notes || []).forEach((n) => noteMap.set(n.id, n));
              (norm.notes || []).forEach((n) => noteMap.set(n.id, n));

              recoveredMap.set(norm.id, {
                ...norm,
                levelCrossing: (norm.levelCrossing && Object.keys(norm.levelCrossing).length > 0)
                  ? norm.levelCrossing
                  : (existing.levelCrossing || norm.levelCrossing),
                photos: Array.from(photoMap.values()),
                notes: Array.from(noteMap.values()),
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('Yerel önbellek okunamadı:', err);
  }

  return Array.from(recoveredMap.values());
}

// Deep scanner alias
export const recoverAllStoredPoints = getLocalCachedPoints;

// Helper to save local points safely into caches and IndexedDB
export function saveLocalCachedPoints(points: RailwayPoint[]) {
  try {
    const deletedIds = getDeletedIds();
    const cleanPoints = (points || []).filter(
      (p) => p && p.id && !deletedIds.has(p.id) && !isDefaultSamplePoint(p.id)
    );

    const sanitized = sortPointsByKm(cleanPoints.map(normalizePoint));

    // 1. Save full data with all high-resolution photos and notes to IndexedDB (GB capacity)
    savePointsToIDB(sanitized).catch(() => {});

    // 2. Save lightweight version to localStorage so quota is never exceeded
    const hasHeavyPhotos = sanitized.some(
      (p) => p.photos && p.photos.some((ph) => ph.dataUrl && ph.dataUrl.length > 500)
    );

    const storagePayload = hasHeavyPhotos
      ? sanitized.map((p) => ({
          ...p,
          photos: (p.photos || []).map((ph) => ({
            ...ph,
            dataUrl: ph.dataUrl && ph.dataUrl.length > 500 ? ph.dataUrl.slice(0, 100) + '...[idb]' : ph.dataUrl,
          })),
        }))
      : sanitized;

    try {
      const json = JSON.stringify(storagePayload);
      localStorage.setItem(LOCAL_STORAGE_KEY, json);
      localStorage.setItem(LOCAL_BACKUP_KEY, json);
    } catch {
      // If even lightweight exceeds quota, store purely essential point data silently
      try {
        const minimal = storagePayload.map((p) => ({
          id: p.id,
          title: p.title,
          kmValue: p.kmValue,
          lat: p.lat,
          lng: p.lng,
          category: p.category,
          lineName: p.lineName,
        }));
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(minimal));
      } catch {
        // Silent fallback: IndexedDB already has the full data safely stored
      }
    }
  } catch (err) {
    // Silent safety
  }
}

export async function fetchRailwayPoints(): Promise<RailwayPoint[]> {
  purgeDeletedAndDefaultPoints();
  const deletedIds = getDeletedIds();

  // 0. Push any pending offline actions to server if online
  try {
    await flushPendingSyncQueue();
  } catch {}

  const pendingQueue = getPendingSyncQueue();
  const pendingUpsertMap = new Map<string, RailwayPoint>();
  pendingQueue.forEach((item) => {
    if (item.type === 'upsert' && item.point && !deletedIds.has(item.id) && !isDefaultSamplePoint(item.id)) {
      pendingUpsertMap.set(item.id, normalizePoint(item.point));
    }
  });

  try {
    const timestamp = Date.now();
    const [res, stateRes, delRes] = await Promise.all([
      fetch(`/api/points?_t=${timestamp}`, { cache: 'no-store' }),
      fetch(`/api/database-state?_t=${timestamp}`, { cache: 'no-store' }).catch(() => null),
      fetch(`/api/deleted-ids?_t=${timestamp}`, { cache: 'no-store' }).catch(() => null),
    ]);

    // 1. Sync deleted IDs from server
    if (delRes && delRes.ok) {
      try {
        const serverDeleted = await delRes.json();
        if (Array.isArray(serverDeleted)) {
          serverDeleted.forEach((id: string) => {
            if (typeof id === 'string') deletedIds.add(id);
          });
          saveDeletedIds(deletedIds);
          purgeDeletedAndDefaultPoints();
        }
      } catch {
        // ignore
      }
    }

    // 2. Check if database was wiped on server
    if (stateRes && stateRes.ok) {
      try {
        const dbState = await stateRes.json();
        const serverClearedAt = Number(dbState.clearedAt || 0);
        const localClearedAt = Number(localStorage.getItem(CLEARED_AT_KEY) || 0);
        if (serverClearedAt > localClearedAt) {
          localStorage.removeItem(LOCAL_STORAGE_KEY);
          localStorage.removeItem(LOCAL_BACKUP_KEY);
          localStorage.removeItem(USER_CUSTOM_KEY);
          await clearPointsFromIDB();
          localStorage.setItem(CLEARED_AT_KEY, String(serverClearedAt));
        }
      } catch {
        // ignore
      }
    }

    if (!res.ok) {
      console.warn(`Sunucu bağlantı durumu: HTTP ${res.status}`);
      const localPoints = getLocalCachedPoints();
      return localPoints.filter((p) => !deletedIds.has(p.id) && !isDefaultSamplePoint(p.id)).map(normalizePoint);
    }
    const serverPoints = await res.json();

    if (Array.isArray(serverPoints)) {
      // 1. Any point present on server is active and definitely not deleted!
      let deletedModified = false;
      serverPoints.forEach((sp: RailwayPoint) => {
        if (sp && sp.id && deletedIds.has(sp.id)) {
          deletedIds.delete(sp.id);
          deletedModified = true;
        }
      });
      if (deletedModified) {
        saveDeletedIds(deletedIds);
      }

      // 2. Valid server points (authoritative source)
      const validServerPoints: RailwayPoint[] = serverPoints
        .filter((p: RailwayPoint) => p && p.id && !isDefaultSamplePoint(p.id))
        .map(normalizePoint);

      // If server is empty and no pending offline adds, wipe local caches completely
      if (validServerPoints.length === 0 && pendingUpsertMap.size === 0) {
        saveLocalCachedPoints([]);
        await clearPointsFromIDB();
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        localStorage.removeItem(LOCAL_BACKUP_KEY);
        localStorage.removeItem(USER_CUSTOM_KEY);
        return [];
      }

      // Read local points and also check IndexedDB for any cached photos
      const localPoints = getLocalCachedPoints();
      const idbPoints = await getPointsFromIDB().catch(() => [] as RailwayPoint[]);

      const localMap = new Map<string, RailwayPoint>();
      localPoints.forEach((p) => localMap.set(p.id, p));

      idbPoints.forEach((ip) => {
        if (!ip || !ip.id || deletedIds.has(ip.id) || isDefaultSamplePoint(ip.id)) return;
        const existing = localMap.get(ip.id);
        if (!existing) {
          localMap.set(ip.id, normalizePoint(ip));
        } else {
          const photoMap = new Map<string, PointPhoto>();
          (existing.photos || []).forEach((ph) => {
            if (!ph.dataUrl?.includes('[idb]')) photoMap.set(ph.id, ph);
          });
          (ip.photos || []).forEach((ph) => {
            if (!ph.dataUrl?.includes('[idb]')) photoMap.set(ph.id, ph);
          });

          const noteMap = new Map<string, PointNote>();
          (existing.notes || []).forEach((n) => noteMap.set(n.id, n));
          (ip.notes || []).forEach((n) => noteMap.set(n.id, n));

          localMap.set(ip.id, {
            ...existing,
            photos: Array.from(photoMap.values()),
            notes: Array.from(noteMap.values()),
          });
        }
      });

      const mergedMap = new Map<string, RailwayPoint>();

      // 1. Authoritative server points (with preserved local photos/notes)
      validServerPoints.forEach((sp) => {
        const lp = localMap.get(sp.id);
        if (lp) {
          const photoMap = new Map<string, PointPhoto>();
          (sp.photos || []).forEach((ph) => {
            if (!ph.dataUrl?.includes('[idb]')) photoMap.set(ph.id, ph);
          });
          (lp.photos || []).forEach((ph) => {
            if (!ph.dataUrl?.includes('[idb]')) photoMap.set(ph.id, ph);
          });

          const noteMap = new Map<string, PointNote>();
          (sp.notes || []).forEach((n) => noteMap.set(n.id, n));
          (lp.notes || []).forEach((n) => noteMap.set(n.id, n));

          const localUpdated = lp.updatedAt || '';
          const serverUpdated = sp.updatedAt || '';
          const basePoint = localUpdated > serverUpdated ? lp : sp;

          const localCrossing = lp.levelCrossing;
          const serverCrossing = sp.levelCrossing;
          const finalCrossing = (localCrossing && Object.keys(localCrossing).length > 0)
            ? localCrossing
            : (serverCrossing || localCrossing || undefined);

          mergedMap.set(sp.id, {
            ...basePoint,
            id: sp.id,
            levelCrossing: finalCrossing,
            photos: Array.from(photoMap.values()),
            notes: Array.from(noteMap.values()),
          });
        } else {
          mergedMap.set(sp.id, sp);
        }
      });

      // 2. Pending offline created points (ONLY items with pending offline sync, not stale cache!)
      pendingUpsertMap.forEach((pendingPt, pendingId) => {
        if (!mergedMap.has(pendingId) && !deletedIds.has(pendingId)) {
          mergedMap.set(pendingId, pendingPt);
        }
      });

      // 3. Clean userCustomMap so that ghost/deleted points are not kept
      const userCustom = getUserCustomPoints();
      let customChanged = false;
      for (const k of Object.keys(userCustom)) {
        if (!mergedMap.has(k)) {
          delete userCustom[k];
          customChanged = true;
        }
      }
      if (customChanged) {
        localStorage.setItem(USER_CUSTOM_KEY, JSON.stringify(userCustom));
      }

      const finalPoints = sortPointsByKm(Array.from(mergedMap.values()));

      // Save clean list locally and in IndexedDB
      saveLocalCachedPoints(finalPoints);

      return finalPoints;
    }
  } catch (err) {
    console.warn('Sunucuya erişilemedi, çevrimdışı yerel veriler kullanılıyor:', err);
  }

  const fallbackLocal = getLocalCachedPoints();
  return sortPointsByKm(fallbackLocal.filter((p) => !deletedIds.has(p.id) && !isDefaultSamplePoint(p.id)).map(normalizePoint));
}

/**
 * Manually or automatically gathers all local/IndexedDB photos and pushes them directly to server
 */
export async function syncAllPhotosToServer(): Promise<{ syncedCount: number; photoCount: number; success: boolean }> {
  try {
    const deletedIds = getDeletedIds();
    const idbPoints = await getPointsFromIDB().catch(() => [] as RailwayPoint[]);
    const localPoints = getLocalCachedPoints();
    const map = new Map<string, RailwayPoint>();

    localPoints.forEach((p) => {
      if (p && p.id && !deletedIds.has(p.id) && !isDefaultSamplePoint(p.id)) map.set(p.id, p);
    });

    idbPoints.forEach((ip) => {
      if (!ip || !ip.id || deletedIds.has(ip.id) || isDefaultSamplePoint(ip.id)) return;
      const existing = map.get(ip.id);
      if (!existing) {
        map.set(ip.id, ip);
      } else {
        const photoMap = new Map<string, PointPhoto>();
        (existing.photos || []).forEach((ph) => {
          if (!ph.dataUrl?.includes('[idb]')) photoMap.set(ph.id, ph);
        });
        (ip.photos || []).forEach((ph) => {
          if (!ph.dataUrl?.includes('[idb]')) photoMap.set(ph.id, ph);
        });

        const noteMap = new Map<string, PointNote>();
        (existing.notes || []).forEach((n) => noteMap.set(n.id, n));
        (ip.notes || []).forEach((n) => noteMap.set(n.id, n));

        map.set(ip.id, {
          ...existing,
          ...ip,
          photos: Array.from(photoMap.values()),
          notes: Array.from(noteMap.values()),
        });
      }
    });

    const allLocalWithData = Array.from(map.values()).filter(
      (p) =>
        !deletedIds.has(p.id) &&
        !isDefaultSamplePoint(p.id) &&
        ((p.photos && p.photos.length > 0) || (p.notes && p.notes.length > 0))
    );

    let photoTotal = 0;
    allLocalWithData.forEach((p) => {
      photoTotal += (p.photos || []).filter((ph) => !ph.dataUrl?.includes('[idb]')).length;
    });

    if (allLocalWithData.length === 0) {
      return { syncedCount: 0, photoCount: 0, success: true };
    }

    const res = await fetch('/api/points/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points: allLocalWithData, replaceAll: false }),
    });

    if (res.ok) {
      return { syncedCount: allLocalWithData.length, photoCount: photoTotal, success: true };
    }
    return { syncedCount: 0, photoCount: 0, success: false };
  } catch (err) {
    console.warn('Fotoğraflar senkronize edilemedi:', err);
    return { syncedCount: 0, photoCount: 0, success: false };
  }
}

export async function saveNewPoint(
  pointData: Omit<RailwayPoint, 'id' | 'notes' | 'photos' | 'createdAt' | 'updatedAt'>
): Promise<RailwayPoint> {
  const localPoints = getLocalCachedPoints();
  const tempId = `pt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const resolvedKm = (pointData.kmValue && pointData.kmValue.trim())
    ? pointData.kmValue.trim()
    : extractKmFromText(pointData.title);

  const newPoint: RailwayPoint = {
    ...pointData,
    id: tempId,
    kmValue: resolvedKm,
    notes: [],
    photos: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 1. Immediately store in user custom registry and local caches
  recordUserCustomPoint(newPoint);
  saveLocalCachedPoints([newPoint, ...localPoints.filter((p) => p.id !== newPoint.id)]);

  // 2. Persist to server
  try {
    const res = await fetch('/api/points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPoint),
    });
    if (res.ok) {
      removePendingSyncItem(tempId);
      const createdPoint: RailwayPoint = await res.json();
      removePendingSyncItem(createdPoint.id);
      const finalPoint = normalizePoint(createdPoint);
      recordUserCustomPoint(finalPoint);
      saveLocalCachedPoints([finalPoint, ...localPoints.filter((p) => p.id !== tempId && p.id !== finalPoint.id)]);
      return finalPoint;
    } else {
      addPendingSyncItem({ id: newPoint.id, type: 'upsert', point: newPoint, timestamp: Date.now() });
    }
  } catch (err) {
    addPendingSyncItem({ id: newPoint.id, type: 'upsert', point: newPoint, timestamp: Date.now() });
  }

  return newPoint;
}

export async function updateExistingPoint(point: RailwayPoint): Promise<RailwayPoint> {
  const localPoints = getLocalCachedPoints();
  const existingLocal = localPoints.find((p) => p.id === point.id);

  // Preserve photos and notes if incoming is missing or empty
  let preservedPhotos = point.photos || [];
  if ((!preservedPhotos || preservedPhotos.length === 0) && existingLocal && (existingLocal.photos || []).length > 0) {
    preservedPhotos = existingLocal.photos;
  }

  let preservedNotes = point.notes || [];
  if ((!preservedNotes || preservedNotes.length === 0) && existingLocal && (existingLocal.notes || []).length > 0) {
    preservedNotes = existingLocal.notes;
  }

  // Preserve levelCrossing if existing point had it and incoming is undefined
  let preservedCrossing = point.levelCrossing;
  if ((!preservedCrossing || Object.keys(preservedCrossing).length === 0) && existingLocal && existingLocal.levelCrossing && Object.keys(existingLocal.levelCrossing).length > 0) {
    preservedCrossing = existingLocal.levelCrossing;
  }

  const resolvedKm = (point.kmValue && point.kmValue.trim())
    ? point.kmValue.trim()
    : extractKmFromText(point.title);

  const updatedPoint: RailwayPoint = {
    ...point,
    kmValue: resolvedKm,
    levelCrossing: preservedCrossing,
    photos: preservedPhotos,
    notes: preservedNotes,
    updatedAt: new Date().toISOString(),
  };

  // 1. Record in user custom points immediately
  recordUserCustomPoint(updatedPoint);

  // 2. Update local storage immediately
  const updatedLocal = localPoints.map((p) => (p.id === point.id ? updatedPoint : p));
  if (!updatedLocal.some((p) => p.id === point.id)) {
    updatedLocal.unshift(updatedPoint);
  }
  saveLocalCachedPoints(updatedLocal);

  // 3. Update server
  try {
    const res = await fetch(`/api/points/${encodeURIComponent(point.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedPoint),
    });
    if (res.ok) {
      removePendingSyncItem(point.id);
      const serverUpdated = await res.json();
      const finalPoint = normalizePoint(serverUpdated);
      recordUserCustomPoint(finalPoint);
      const finalUpdated = localPoints.map((p) => (p.id === finalPoint.id ? finalPoint : p));
      saveLocalCachedPoints(finalUpdated);
      return finalPoint;
    } else {
      addPendingSyncItem({ id: updatedPoint.id, type: 'upsert', point: updatedPoint, timestamp: Date.now() });
    }
  } catch (err) {
    addPendingSyncItem({ id: updatedPoint.id, type: 'upsert', point: updatedPoint, timestamp: Date.now() });
  }

  return updatedPoint;
}

export async function deletePointById(id: string): Promise<boolean> {
  if (!id) return true;

  // 1. Permanently blacklist this ID in deleted tracker
  addDeletedId(id);
  removeUserCustomPoint(id);
  removePendingSyncItem(id);

  // 2. Remove from local caches
  const localPoints = getLocalCachedPoints();
  const updatedLocal = localPoints.filter((p) => p.id !== id);
  saveLocalCachedPoints(updatedLocal);

  // 3. Purge from storage
  purgeDeletedAndDefaultPoints();

  // 4. Send delete request to server
  try {
    const res = await fetch(`/api/points/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      addPendingSyncItem({ id, type: 'delete', timestamp: Date.now() });
    }
  } catch (err) {
    addPendingSyncItem({ id, type: 'delete', timestamp: Date.now() });
  }

  return true;
}

export async function addPointNote(pointId: string, text: string, author: string): Promise<PointNote | null> {
  const fallbackNote: PointNote = {
    id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    text: text.trim(),
    author: (author || 'Saha Personeli').trim(),
    createdAt: new Date().toISOString(),
  };

  try {
    const res = await fetch(`/api/points/${encodeURIComponent(pointId)}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, author }),
    });

    let newNote = fallbackNote;
    if (res.ok) {
      newNote = await res.json();
    }

    // Update local cache & custom registry
    const local = getLocalCachedPoints();
    const target = local.find((p) => p.id === pointId);
    if (target) {
      if (!Array.isArray(target.notes)) target.notes = [];
      target.notes.unshift(newNote);
      target.updatedAt = new Date().toISOString();
      recordUserCustomPoint(target);
      saveLocalCachedPoints(local);
    }

    return newNote;
  } catch (err) {
    console.warn('Sunucu not kaydı hatası, yerel olarak kaydedildi:', err);
    const local = getLocalCachedPoints();
    const target = local.find((p) => p.id === pointId);
    if (target) {
      if (!Array.isArray(target.notes)) target.notes = [];
      target.notes.unshift(fallbackNote);
      target.updatedAt = new Date().toISOString();
      recordUserCustomPoint(target);
      saveLocalCachedPoints(local);
    }
    return fallbackNote;
  }
}

export async function deletePointNote(pointId: string, noteId: string): Promise<boolean> {
  try {
    fetch(`/api/points/${encodeURIComponent(pointId)}/notes/${encodeURIComponent(noteId)}`, {
      method: 'DELETE',
    }).catch(() => {});

    const local = getLocalCachedPoints();
    const target = local.find((p) => p.id === pointId);
    if (target && Array.isArray(target.notes)) {
      target.notes = target.notes.filter((n) => n.id !== noteId);
      target.updatedAt = new Date().toISOString();
      recordUserCustomPoint(target);
      saveLocalCachedPoints(local);
    }
    return true;
  } catch {
    return true;
  }
}

export async function addPointPhoto(pointId: string, dataUrl: string, caption: string): Promise<PointPhoto | null> {
  // Compress photo so it never overflows storage quotas
  const compressed = await compressImage(dataUrl).catch(() => dataUrl);

  const local = getLocalCachedPoints();
  const target = local.find((p) => p.id === pointId);

  const fallbackPhoto: PointPhoto = {
    id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    dataUrl: compressed,
    caption: (caption || '').trim(),
    takenAt: new Date().toISOString(),
  };

  let finalPhoto = fallbackPhoto;

  // 1. Immediately store in local cache & custom registry with updated timestamp
  if (target) {
    if (!Array.isArray(target.photos)) target.photos = [];
    target.photos.unshift(fallbackPhoto);
    target.updatedAt = new Date().toISOString();
    recordUserCustomPoint(target);
    saveLocalCachedPoints(local);
  }

  // 2. Persist to server (passing point coordinates and title to guarantee resilient upsert)
  try {
    const res = await fetch(`/api/points/${encodeURIComponent(pointId)}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataUrl: compressed,
        caption,
        pointTitle: target?.title || 'Demiryolu Noktası',
        lat: target?.lat,
        lng: target?.lng,
      }),
    });

    if (res.ok) {
      const serverPhoto = await res.json();
      finalPhoto = serverPhoto;
      if (target && serverPhoto.id && serverPhoto.id !== fallbackPhoto.id) {
        target.photos = target.photos.map((ph) => (ph.id === fallbackPhoto.id ? serverPhoto : ph));
        recordUserCustomPoint(target);
        saveLocalCachedPoints(local);
      }
    } else {
      console.warn(`Sunucu fotoğraf kayıt yanıtı: HTTP ${res.status}. Fotoğraf yerel bellekte güvenle saklandı.`);
    }
  } catch (err) {
    console.warn('Sunucuya erişilemedi, fotoğraf yerel bellekte korundu:', err);
  }

  return finalPhoto;
}

export async function deletePointPhoto(pointId: string, photoId: string): Promise<boolean> {
  // 1. Remove from local caches immediately
  const local = getLocalCachedPoints();
  const target = local.find((p) => p.id === pointId);
  if (target && Array.isArray(target.photos)) {
    target.photos = target.photos.filter((ph) => ph.id !== photoId);
    target.updatedAt = new Date().toISOString();
    recordUserCustomPoint(target);
    saveLocalCachedPoints(local);
  }

  // 2. Delete from server
  try {
    await fetch(`/api/points/${encodeURIComponent(pointId)}/photos/${encodeURIComponent(photoId)}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('Sunucu fotoğraf silme uyarısı:', err);
  }
  return true;
}

export async function importRailwayPoints(
  points: (Partial<RailwayPoint> & { lat?: number; lng?: number; title?: string })[],
  replaceAll: boolean = false
): Promise<RailwayPoint[]> {
  const currentLocal = getLocalCachedPoints();
  const deletedIds = getDeletedIds();

  const normalizedImported: RailwayPoint[] = points
    .filter((p) => p && !isDefaultSamplePoint(p.id))
    .map((p, idx) => {
      const pTitle = (p.title || `KM Noktası ${idx + 1}`).trim();
      const pKm = (p.kmValue && p.kmValue.trim()) ? p.kmValue.trim() : extractKmFromText(pTitle);
      const pId = p.id || `pt-imp-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
      deletedIds.delete(pId);

      return normalizePoint({
        id: pId,
        title: pTitle,
        kmValue: pKm,
        lineName: p.lineName || 'İçe Aktarılan Hat',
        locationDesc: p.locationDesc || '',
        category: p.category || 'km_marker',
        lat: Number(p.lat) || 0,
        lng: Number(p.lng) || 0,
        description: p.description || '',
        textStyle: p.textStyle || undefined,
        titleTextStyle: p.titleTextStyle || undefined,
        levelCrossing: p.levelCrossing || (p as any).level_crossing || undefined,
        notes: Array.isArray(p.notes) ? p.notes : [],
        photos: Array.isArray(p.photos) ? p.photos : [],
        createdAt: p.createdAt || new Date().toISOString(),
        updatedAt: p.updatedAt || new Date().toISOString(),
      });
    })
    .filter((p) => (!isNaN(p.lat) && !isNaN(p.lng)) || Boolean(p.kmValue));

  saveDeletedIds(deletedIds);

  try {
    await fetch('/api/points/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points: normalizedImported, replaceAll }),
    });
  } catch (err) {
    console.warn('Sunucu içe aktarma uyarısı, yerel önbelleğe aktarılıyor:', err);
  }

  let newPoints: RailwayPoint[];
  if (replaceAll) {
    newPoints = sortPointsByKm(normalizedImported);
  } else {
    // Merge into current local list
    const currentList = [...currentLocal];
    normalizedImported.forEach((p) => {
      const cleanKm = (p.kmValue || '').trim().toLowerCase();
      const cleanTitle = (p.title || '').trim().toLowerCase();
      const pLat = Number(p.lat);
      const pLng = Number(p.lng);

      // Try to find matching existing point by ID, or by identical coordinates, or by KM + title/crossing match
      const existingIdx = currentList.findIndex((cp) => {
        if (cp.id === p.id) return true;
        const cpKm = (cp.kmValue || '').trim().toLowerCase();
        const cpTitle = (cp.title || '').trim().toLowerCase();

        // If coordinates match
        if (pLat !== 0 && pLng !== 0 && cp.lat !== 0 && cp.lng !== 0) {
          const dLat = Math.abs(cp.lat - pLat);
          const dLng = Math.abs(cp.lng - pLng);
          if (dLat < 0.0001 && dLng < 0.0001) return true;
        }

        // If both have KM and KM matches (e.g. 54+635 === 54+635)
        if (cleanKm && cpKm && cleanKm === cpKm) {
          // If either is a crossing, merge parameters!
          if (cp.category === 'crossing' || p.category === 'crossing') return true;
          if (cleanTitle === cpTitle || cleanTitle.includes(cpTitle) || cpTitle.includes(cleanTitle)) return true;
        }

        // Title match
        if (cleanTitle && cpTitle && (cleanTitle === cpTitle)) return true;

        return false;
      });

      if (existingIdx >= 0) {
        const existing = currentList[existingIdx];
        // Merge photos & notes
        const photoMap = new Map();
        (existing.photos || []).forEach((ph: any) => photoMap.set(ph.id, ph));
        (p.photos || []).forEach((ph: any) => photoMap.set(ph.id, ph));

        const noteMap = new Map();
        (existing.notes || []).forEach((n: any) => noteMap.set(n.id, n));
        (p.notes || []).forEach((n: any) => noteMap.set(n.id, n));

        // Merge levelCrossing
        const mergedLc = {
          ...(existing.levelCrossing || {}),
          ...(p.levelCrossing || {}),
        };
        const hasLc = Object.values(mergedLc).some(Boolean);

        const merged: RailwayPoint = {
          ...existing,
          ...p,
          id: existing.id,
          lat: p.lat !== 0 ? p.lat : existing.lat,
          lng: p.lng !== 0 ? p.lng : existing.lng,
          category: (p.category === 'crossing' || existing.category === 'crossing' || hasLc) ? 'crossing' : (p.category || existing.category),
          levelCrossing: hasLc ? mergedLc : undefined,
          photos: Array.from(photoMap.values()),
          notes: Array.from(noteMap.values()),
          updatedAt: new Date().toISOString(),
        };

        currentList[existingIdx] = merged;
        recordUserCustomPoint(merged);
      } else {
        currentList.push(p);
        recordUserCustomPoint(p);
      }
    });
    newPoints = sortPointsByKm(currentList);
  }

  saveLocalCachedPoints(newPoints);
  return newPoints;
}

// Reset data completely: clears points and keeps default points blacklisted
export async function resetToDefaultRailwayPoints(): Promise<RailwayPoint[]> {
  try {
    await fetch('/api/points/reset-sample', { method: 'POST' });
  } catch (err) {
    console.warn('Sunucu sıfırlanamadı:', err);
  }

  // Blacklist all current local points and sample IDs so they can never be resurrected
  const deletedSet = getDeletedIds();
  const currentPoints = getLocalCachedPoints();
  currentPoints.forEach((p) => {
    if (p && p.id) deletedSet.add(p.id);
  });
  DEFAULT_SAMPLE_IDS.forEach((id) => deletedSet.add(id));
  localStorage.setItem(DELETED_POINTS_KEY, JSON.stringify(Array.from(deletedSet)));

  localStorage.removeItem(LOCAL_STORAGE_KEY);
  localStorage.removeItem(LOCAL_BACKUP_KEY);
  localStorage.removeItem(USER_CUSTOM_KEY);

  saveLocalCachedPoints([]);
  return [];
}

// Aliases for compatibility
export const batchImportPoints = importRailwayPoints;
export const resetToSamplePoints = resetToDefaultRailwayPoints;
