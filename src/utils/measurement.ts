/**
 * Railway distance and meter measurement utilities
 */

export interface LatLngPoint {
  lat: number;
  lng: number;
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
