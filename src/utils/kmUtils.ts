import { RailwayPoint } from '../types.ts';

/**
 * Parses any railway KM chainage string (e.g. "142+500", "0+050", "KM 94", "48.200")
 * into a standard floating-point kilometer number (e.g. 142.5, 0.05, 94.0, 48.2).
 * Returns null if no valid kilometer value could be parsed.
 */
export function parseKmToNumber(kmValue?: string | null, fallbackText?: string | null): number | null {
  const combined = [kmValue, fallbackText].filter(Boolean).join(' ');
  if (!combined.trim()) return null;

  // 1. Standard chainage format with plus: e.g. "142+500", "0+050", "KM 94+000", "28+750"
  const plusMatch = combined.match(/(\d{1,4})\s*\+\s*(\d{1,4})/);
  if (plusMatch) {
    const km = parseInt(plusMatch[1], 10);
    const mStr = plusMatch[2];
    const meters = parseInt(mStr, 10);
    return km + meters / 1000;
  }

  // 2. Chainage with dash: e.g. "0-813", "142-500", "KM 54-200"
  const dashMatch = combined.match(/(?:KM\s*[:.-]?\s*)?(\d{1,4})\s*[-]\s*(\d{3})\b/i);
  if (dashMatch) {
    const km = parseInt(dashMatch[1], 10);
    const meters = parseInt(dashMatch[2], 10);
    return km + meters / 1000;
  }

  // 3. KM followed by numbers with dot/dash/comma: e.g. "KM 142.500", "km 94,200", "KM: 55"
  const kmWordMatch = combined.match(/\bKM\s*[:.-]?\s*(\d{1,4}(?:[.,]\d+)?)\b/i);
  if (kmWordMatch) {
    const num = parseFloat(kmWordMatch[1].replace(',', '.'));
    if (!isNaN(num)) return num;
  }

  // 4. Raw number if kmValue itself is numeric or decimal: "142", "142.5", "142,500"
  if (kmValue) {
    const cleaned = String(kmValue).replace(/^(?:km\s*[:.-]?\s*)/i, '').trim().replace(',', '.');
    const num = parseFloat(cleaned);
    if (!isNaN(num)) return num;
  }

  return null;
}

/**
 * Standard comparator to sort railway points in ascending KM order (düşükten yukarıya doğru).
 * - Lowest KM comes first (e.g. KM 0+050, KM 14+200, KM 94+000, KM 142+500).
 * - Points with valid KM always precede points without KM.
 * - Same KM points are sub-sorted alphabetically by lineName, then title.
 */
export function compareRailwayPointsByKm<T extends { kmValue?: string | null; title?: string | null; lineName?: string | null }>(
  a: T,
  b: T
): number {
  const kmA = parseKmToNumber(a.kmValue, a.title);
  const kmB = parseKmToNumber(b.kmValue, b.title);

  // Both have valid KM
  if (kmA !== null && kmB !== null) {
    if (Math.abs(kmA - kmB) > 0.00001) {
      return kmA - kmB; // Ascending order (düşükten yukarıya)
    }
  } else if (kmA !== null) {
    return -1; // Valid KM comes before non-KM
  } else if (kmB !== null) {
    return 1;
  }

  // Secondary tie-breaker: Line Name (A-Z)
  const lineA = a.lineName || '';
  const lineB = b.lineName || '';
  const lineComp = lineA.localeCompare(lineB, 'tr', { sensitivity: 'base' });
  if (lineComp !== 0) return lineComp;

  // Tertiary tie-breaker: Title (A-Z)
  const titleA = a.title || '';
  const titleB = b.title || '';
  return titleA.localeCompare(titleB, 'tr', { sensitivity: 'base' });
}

/**
 * Returns a new array sorted strictly by ascending KM chainage (düşükten yukarıya doğru).
 */
export function sortPointsByKm<T extends { kmValue?: string | null; title?: string | null; lineName?: string | null }>(
  points: T[]
): T[] {
  if (!Array.isArray(points) || points.length <= 1) return points ? [...points] : [];
  return [...points].sort(compareRailwayPointsByKm);
}

/**
 * Inserts or updates a point in an existing list while strictly preserving ascending KM order.
 */
export function upsertPointInKmOrder<T extends { id: string; kmValue?: string | null; title?: string | null; lineName?: string | null }>(
  points: T[],
  item: T
): T[] {
  const filtered = (points || []).filter((p) => p.id !== item.id);
  filtered.push(item);
  return sortPointsByKm(filtered);
}
