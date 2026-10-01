/**
 * Railway distance and meter measurement utilities with KM chainage calculator
 */

export interface LatLngPoint {
  lat: number;
  lng: number;
  label?: string;
  baseKm?: number; // base kilometer in pure meters (e.g. 56000 for KM 56+000)
}

/**
 * Calculates geodesic distance between two points on Earth in meters using Haversine formula
 */
export function getDistanceMeters(p1: LatLngPoint, p2: LatLngPoint): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Formats meter distance in Turkish standard:
 * < 1000m => "245 m" or "245 Metre"
 * >= 1000m => "1.450 m (1,45 km)"
 */
export function formatMeterDistance(meters: number): {
  shortText: string;
  fullText: string;
  metersOnly: string;
  kmOnly: string;
} {
  const roundedMeters = Math.round(meters);
  const formattedM = new Intl.NumberFormat('tr-TR').format(roundedMeters);

  if (roundedMeters < 1000) {
    return {
      shortText: `${formattedM} m`,
      fullText: `${formattedM} Metre`,
      metersOnly: `${formattedM} m`,
      kmOnly: `${(meters / 1000).toFixed(2).replace('.', ',')} km`,
    };
  }

  const kmVal = (meters / 1000).toFixed(2).replace('.', ',');
  return {
    shortText: `${formattedM} m (${kmVal} km)`,
    fullText: `${formattedM} Metre (${kmVal} km)`,
    metersOnly: `${formattedM} m`,
    kmOnly: `${kmVal} km`,
  };
}

/**
 * Parses any railway KM string (e.g., "56+000", "56.000", "KM 142+450", "345") into absolute meters.
 * Returns null if not parseable.
 */
export function parseRailwayKmToMeters(kmStr?: string | null): number | null {
  if (!kmStr) return null;
  const cleaned = kmStr
    .toUpperCase()
    .replace(/^KM\s*/i, '')
    .trim();

  // Pattern 1: 56+450 or 56+45
  if (cleaned.includes('+')) {
    const parts = cleaned.split('+');
    const km = parseFloat(parts[0].replace(/[^0-9.]/g, ''));
    let meters = parseFloat(parts[1].replace(/[^0-9.]/g, ''));
    if (!isNaN(km) && !isNaN(meters)) {
      // If meters was written as "45" meaning 450, or "4" meaning 400? Let's check length:
      // If 1 digit => x100, if 2 digits => x10? Usually 3 digits. We keep exact value.
      return Math.round(km * 1000 + meters);
    }
  }

  // Pattern 2: 56.450 or 56,450 or 56000
  const numCleaned = cleaned.replace(',', '.');
  const val = parseFloat(numCleaned);
  if (!isNaN(val)) {
    // If value is small like 56.450, it is km => 56450m
    if (val < 2000) {
      return Math.round(val * 1000);
    }
    // If value is > 2000, e.g. 56000, it is already meters
    return Math.round(val);
  }

  return null;
}

/**
 * Formats absolute meters into railway KM standard (e.g. 56428 => "KM 56+428")
 */
export function formatMetersToRailwayKm(totalMeters: number): string {
  const km = Math.floor(Math.abs(totalMeters) / 1000);
  const m = Math.round(Math.abs(totalMeters) % 1000);
  const mStr = String(m).padStart(3, '0');
  return `KM ${km}+${mStr}`;
}

/**
 * Calculates live railway chainage display:
 * Example: Base is KM 56+000, measured 428m => "56+000 + 428m = KM 56+428"
 */
export function calculateLiveChainage(
  baseKmStr: string | null | undefined,
  measuredMeters: number
): {
  baseKmFormatted: string;
  forwardKmFormatted: string;
  backwardKmFormatted: string;
  formulaForward: string;
  formulaBackward: string;
} | null {
  const baseMeters = parseRailwayKmToMeters(baseKmStr);
  if (baseMeters === null) return null;

  const baseFormatted = formatMetersToRailwayKm(baseMeters);
  const roundedM = Math.round(measuredMeters);

  const forwardMeters = baseMeters + roundedM;
  const backwardMeters = Math.max(0, baseMeters - roundedM);

  const forwardKm = formatMetersToRailwayKm(forwardMeters);
  const backwardKm = formatMetersToRailwayKm(backwardMeters);

  return {
    baseKmFormatted: baseFormatted,
    forwardKmFormatted: forwardKm,
    backwardKmFormatted: backwardKm,
    formulaForward: `${baseFormatted.replace('KM ', '')} + ${roundedM}m 👉 ${forwardKm}`,
    formulaBackward: `${baseFormatted.replace('KM ', '')} - ${roundedM}m 👉 ${backwardKm}`,
  };
}

/**
 * Calculates cumulative distances for an array of points
 */
export function calculatePolylineMeasurements(points: LatLngPoint[]): {
  totalMeters: number;
  segmentMeters: number[];
  formatted: string;
} {
  if (points.length < 2) {
    return {
      totalMeters: 0,
      segmentMeters: [],
      formatted: '0 Metre',
    };
  }

  let total = 0;
  const segments: number[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const d = getDistanceMeters(points[i], points[i + 1]);
    segments.push(d);
    total += d;
  }

  return {
    totalMeters: total,
    segmentMeters: segments,
    formatted: formatMeterDistance(total).fullText,
  };
}
