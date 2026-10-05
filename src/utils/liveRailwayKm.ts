import { RailwayPoint } from '../types.ts';
import { parseKmToNumber } from './kmUtils.ts';

export interface NearestKmResult {
  chainageKm: string; // e.g. "63+420"
  decimalKm: number; // e.g. 63.42
  distanceToRailMeters: number; // Distance in meters from the estimated track
  nearestPointTitle: string; // e.g. "KM 63+000"
  nearestPointDistance: number; // Meters away from the nearest point
  lineName: string;
  isOffTrack: boolean; // True if user is > 200m away from the railway line
}

function getHaversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Projects point P onto line segment AB on the Earth's surface using
 * equirectangular projection (converting lat/lng to metric coordinates centered at A),
 * and returns the closest projected point, distance in meters, and interpolation parameter t (0..1).
 */
function projectPointOnSegment(
  pLat: number,
  pLng: number,
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): { lat: number; lng: number; t: number; distMeters: number } {
  const R = 6371e3; // Earth radius in meters
  const meanLatRad = (((aLat + bLat + pLat) / 3) * Math.PI) / 180;
  const cosMeanLat = Math.cos(meanLatRad);

  // Convert A, B, and P to local Cartesian meters relative to A (x = east, y = north)
  const degToRad = Math.PI / 180;
  const xB = (bLng - aLng) * degToRad * R * cosMeanLat;
  const yB = (bLat - aLat) * degToRad * R;

  const xP = (pLng - aLng) * degToRad * R * cosMeanLat;
  const yP = (pLat - aLat) * degToRad * R;

  const lenSq = xB * xB + yB * yB;

  let t = 0;
  if (lenSq > 0) {
    t = (xP * xB + yP * yB) / lenSq;
    t = Math.max(0, Math.min(1, t));
  }

  const projLat = aLat + t * (bLat - aLat);
  const projLng = aLng + t * (bLng - aLng);
  const distMeters = getHaversineDistanceMeters(pLat, pLng, projLat, projLng);

  return { lat: projLat, lng: projLng, t, distMeters };
}

/**
 * Given a user's current GPS location and the railway points dataset,
 * calculates the exact railway KM chainage (e.g. "54+320") by finding the nearest
 * track segment formed by consecutive KM markers or points.
 */
export function calculateLiveRailwayKm(
  userLat: number,
  userLng: number,
  points: RailwayPoint[]
): NearestKmResult | null {
  if (!points || points.length === 0) return null;

  // Filter valid points with KM values
  const pointsWithKm: { point: RailwayPoint; kmNum: number }[] = [];
  for (const p of points) {
    const kmNum = parseKmToNumber(p.kmValue, p.title);
    if (kmNum !== null && !isNaN(p.lat) && !isNaN(p.lng) && p.lat !== 0) {
      pointsWithKm.push({ point: p, kmNum });
    }
  }

  if (pointsWithKm.length === 0) return null;

  // Sort ascending by KM
  pointsWithKm.sort((a, b) => a.kmNum - b.kmNum);

  // Group by line
  const linesMap = new Map<string, typeof pointsWithKm>();
  for (const item of pointsWithKm) {
    const lineKey = item.point.lineName || 'Varsayılan Hat';
    if (!linesMap.has(lineKey)) linesMap.set(lineKey, []);
    linesMap.get(lineKey)!.push(item);
  }

  let bestSegmentMatch: {
    calculatedKm: number;
    distToSegment: number;
    nearestPoint: RailwayPoint;
    nearestPointDist: number;
    lineName: string;
  } | null = null;

  for (const [lineName, linePts] of linesMap.entries()) {
    // Check segments between consecutive points along the line
    for (let i = 0; i < linePts.length - 1; i++) {
      const pA = linePts[i];
      const pB = linePts[i + 1];

      // Avoid huge gaps if points are too far in chainage (> 5km apart)
      if (Math.abs(pB.kmNum - pA.kmNum) > 6) continue;

      const proj = projectPointOnSegment(userLat, userLng, pA.point.lat, pA.point.lng, pB.point.lat, pB.point.lng);
      const calculatedKm = pA.kmNum + proj.t * (pB.kmNum - pA.kmNum);

      const distA = getHaversineDistanceMeters(userLat, userLng, pA.point.lat, pA.point.lng);
      const distB = getHaversineDistanceMeters(userLat, userLng, pB.point.lat, pB.point.lng);
      const nearestPt = distA < distB ? pA.point : pB.point;
      const nearestPtDist = Math.min(distA, distB);

      if (!bestSegmentMatch || proj.distMeters < bestSegmentMatch.distToSegment) {
        bestSegmentMatch = {
          calculatedKm,
          distToSegment: proj.distMeters,
          nearestPoint: nearestPt,
          nearestPointDist: nearestPtDist,
          lineName,
        };
      }
    }
  }

  // Fallback to single nearest point if no segment matched closely
  if (!bestSegmentMatch || bestSegmentMatch.distToSegment > 1000) {
    let nearest = pointsWithKm[0];
    let minDist = getHaversineDistanceMeters(userLat, userLng, nearest.point.lat, nearest.point.lng);

    for (let i = 1; i < pointsWithKm.length; i++) {
      const d = getHaversineDistanceMeters(userLat, userLng, pointsWithKm[i].point.lat, pointsWithKm[i].point.lng);
      if (d < minDist) {
        minDist = d;
        nearest = pointsWithKm[i];
      }
    }

    const kmFloor = Math.floor(nearest.kmNum);
    const mRem = Math.round((nearest.kmNum - kmFloor) * 1000);
    const chainage = `${kmFloor}+${String(mRem).padStart(3, '0')}`;

    return {
      chainageKm: chainage,
      decimalKm: nearest.kmNum,
      distanceToRailMeters: Math.round(minDist),
      nearestPointTitle: nearest.point.title,
      nearestPointDistance: Math.round(minDist),
      lineName: nearest.point.lineName || 'Eskişehir - Konya',
      isOffTrack: minDist > 300,
    };
  }

  const kmVal = bestSegmentMatch.calculatedKm;
  const kmPart = Math.floor(kmVal);
  const mPart = Math.round((kmVal - kmPart) * 1000);
  const formattedChainage = `${kmPart}+${String(mPart).padStart(3, '0')}`;

  return {
    chainageKm: formattedChainage,
    decimalKm: kmVal,
    distanceToRailMeters: Math.round(bestSegmentMatch.distToSegment),
    nearestPointTitle: bestSegmentMatch.nearestPoint.title,
    nearestPointDistance: Math.round(bestSegmentMatch.nearestPointDist),
    lineName: bestSegmentMatch.lineName,
    isOffTrack: bestSegmentMatch.distToSegment > 200,
  };
}
