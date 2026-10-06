import { RailwayPoint, RailwayParcel } from '../types.ts';
import { parseKmToNumber } from './kmUtils.ts';

const EARTH_RADIUS_METERS = 6378137;

/**
 * Calculates geodesic distance in meters between two lat/lng points
 */
function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculates polygon area in square meters using spherical excess formula
 */
export function calculatePolygonAreaM2(coords: [number, number][]): number {
  if (coords.length < 3) return 0;
  let total = 0;
  const degToRad = Math.PI / 180;

  for (let i = 0; i < coords.length; i++) {
    const p1 = coords[i];
    const p2 = coords[(i + 1) % coords.length];
    const lat1 = p1[0] * degToRad;
    const lng1 = p1[1] * degToRad;
    const lat2 = p2[0] * degToRad;
    const lng2 = p2[1] * degToRad;

    total += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  const area = Math.abs((total * EARTH_RADIUS_METERS * EARTH_RADIUS_METERS) / 2.0);
  return Math.round(area);
}

/**
 * Generates an expropriation corridor polygon (İstimlak / Kamulaştırma Bandı)
 * around a sequence of centerline coordinates at specified total width (e.g. 30m = 15m left + 15m right).
 */
export function generateCorridorPolygon(
  centerline: Array<{ lat: number; lng: number }>,
  totalWidthMeters: number = 30
): [number, number][] {
  if (centerline.length < 2) return [];

  const halfWidth = totalWidthMeters / 2;
  const rightPoints: [number, number][] = [];
  const leftPoints: [number, number][] = [];

  for (let i = 0; i < centerline.length; i++) {
    const curr = centerline[i];
    let normalAngleRad = 0;

    if (i === 0) {
      const next = centerline[1];
      const bearing = Math.atan2(next.lng - curr.lng, next.lat - curr.lat);
      normalAngleRad = bearing + Math.PI / 2;
    } else if (i === centerline.length - 1) {
      const prev = centerline[i - 1];
      const bearing = Math.atan2(curr.lng - prev.lng, curr.lat - prev.lat);
      normalAngleRad = bearing + Math.PI / 2;
    } else {
      const prev = centerline[i - 1];
      const next = centerline[i + 1];
      const bearing = Math.atan2(next.lng - prev.lng, next.lat - prev.lat);
      normalAngleRad = bearing + Math.PI / 2;
    }

    const latRad = (curr.lat * Math.PI) / 180;
    const metersPerDegreeLat = 111132.954 - 559.822 * Math.cos(2 * latRad);
    const metersPerDegreeLng = 111412.84 * Math.cos(latRad);

    const dLat = (halfWidth * Math.cos(normalAngleRad)) / metersPerDegreeLat;
    const dLng = (halfWidth * Math.sin(normalAngleRad)) / metersPerDegreeLng;

    rightPoints.push([curr.lat + dLat, curr.lng + dLng]);
    leftPoints.push([curr.lat - dLat, curr.lng - dLng]);
  }

  // Combine into a closed polygon loop: right side forward, left side backward
  return [...rightPoints, ...leftPoints.reverse(), rightPoints[0]];
}

/**
 * Generates realistic TCDD railway cadastral parcels from sorted railway points.
 * Partitions the line into cadastral parcel strips (approx every 1-2 km or between main features)
 * matching TKGM parcel styling.
 */
export function generateRailwayParcelsFromPoints(
  points: RailwayPoint[],
  corridorWidthMeters: number = 30,
  defaultLineName: string = 'Eskişehir - Konya'
): RailwayParcel[] {
  if (!points || points.length < 2) return [];

  // Filter and sort points by ascending KM
  const sorted = [...points]
    .filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number' && !isNaN(p.lat) && !isNaN(p.lng))
    .sort((a, b) => {
      const kmA = parseKmToNumber(a.kmValue, a.title) ?? 0;
      const kmB = parseKmToNumber(b.kmValue, b.title) ?? 0;
      return kmA - kmB;
    });

  if (sorted.length < 2) return [];

  const parcels: RailwayParcel[] = [];
  const chunkSize = Math.max(2, Math.min(5, Math.ceil(sorted.length / 4))); // Partition line into parcel chunks

  let chunkStartIdx = 0;
  let parcelIndex = 1;

  while (chunkStartIdx < sorted.length - 1) {
    const chunkEndIdx = Math.min(chunkStartIdx + chunkSize, sorted.length - 1);
    const segmentPoints = sorted.slice(chunkStartIdx, chunkEndIdx + 1);

    if (segmentPoints.length >= 2) {
      const startPt = segmentPoints[0];
      const endPt = segmentPoints[segmentPoints.length - 1];

      const startKmVal = startPt.kmValue || startPt.title || `KM ${chunkStartIdx}`;
      const endKmVal = endPt.kmValue || endPt.title || `KM ${chunkEndIdx}`;
      const startKmNum = parseKmToNumber(startKmVal) ?? chunkStartIdx;
      const endKmNum = parseKmToNumber(endKmVal) ?? chunkEndIdx;

      // Extract line and location
      const lineName = startPt.lineName || defaultLineName;
      const locationDesc = startPt.locationDesc || endPt.locationDesc || '';

      // Infer province & district from line or descriptions
      let il = 'Eskişehir';
      let ilce = 'Sivrihisar';
      let mahalle = 'Dümrek';

      if (lineName.includes('Konya') || locationDesc.includes('Konya')) {
        il = 'Konya';
        ilce = 'Kadınhanı';
        mahalle = 'Kolukısa';
      } else if (lineName.includes('Afyon') || locationDesc.includes('Afyon')) {
        il = 'Afyonkarahisar';
        ilce = 'Sandıklı';
        mahalle = 'İstasyon';
      } else if (lineName.includes('Ankara') || locationDesc.includes('Ankara')) {
        il = 'Ankara';
        ilce = 'Polatlı';
        mahalle = 'Demiryolu';
      }

      const centerline = segmentPoints.map((p) => ({ lat: p.lat, lng: p.lng }));
      const polygonCoords = generateCorridorPolygon(centerline, corridorWidthMeters);
      const alanM2 = calculatePolygonAreaM2(polygonCoords);

      const adaNo = String(100 + parcelIndex);
      const parselNo = '1'; // Demiryolu hatları genelde Ada: X, Parsel: 1 olarak tescil edilir

      const midLat = (startPt.lat + endPt.lat) / 2;
      const midLng = (startPt.lng + endPt.lng) / 2;

      parcels.push({
        id: `parsel-tcdd-${parcelIndex}`,
        il,
        ilce,
        mahalleKoy: `${mahalle} Köyü`,
        adaNo,
        parselNo,
        nitelik: 'Demiryolu Güzergahı ve Müştemilatı',
        alanM2: Math.max(alanM2, 12500),
        paftaNo: `K28-d-${(parcelIndex % 20) + 1}-c`,
        malik: 'TCDD İşletmesi Genel Müdürlüğü',
        startKm: startKmVal,
        endKm: endKmVal,
        startKmNum,
        endKmNum,
        lineName,
        kamulastirmaGenisligiMetre: corridorWidthMeters,
        coordinates: polygonCoords,
        notes: `TCDD İstimlak Kamulaştırma Sınırı (${corridorWidthMeters}m koridor). ${startKmVal} - ${endKmVal} arası demiryolu mülkiyeti.`,
        tkgmUrl: `https://parselsorgu.tkgm.gov.tr/#ara/cografi/${midLat.toFixed(6)}/${midLng.toFixed(6)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      parcelIndex++;
    }

    chunkStartIdx = chunkEndIdx;
  }

  return parcels;
}

/**
 * Exports cadastral parcels as standard GeoJSON
 */
export function exportParcelsToGeoJson(parcels: RailwayParcel[]): string {
  const features = parcels.map((p) => ({
    type: 'Feature',
    id: p.id,
    properties: {
      il: p.il,
      ilce: p.ilce,
      mahalle: p.mahalleKoy,
      ada: p.adaNo,
      parsel: p.parselNo,
      nitelik: p.nitelik,
      alanM2: p.alanM2,
      malik: p.malik,
      kamulastirmaGenisligi: p.kamulastirmaGenisligiMetre,
      startKm: p.startKm,
      endKm: p.endKm,
      lineName: p.lineName,
      tkgmUrl: p.tkgmUrl,
      stroke: '#990033',
      strokeWidth: 3,
      fill: '#b91c1c',
      fillOpacity: 0.35,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [p.coordinates.map((c) => [c[1], c[0]])], // GeoJSON is [lng, lat]
    },
  }));

  return JSON.stringify(
    {
      type: 'FeatureCollection',
      name: 'TCDD_Demiryolu_Tapu_Kadastro_Parselleri',
      crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } },
      features,
    },
    null,
    2
  );
}

/**
 * Exports cadastral parcels as Google Earth / TKGM KML file
 */
export function exportParcelsToKml(parcels: RailwayParcel[]): string {
  const placemarks = parcels
    .map((p) => {
      const coordStr = p.coordinates.map((c) => `${c[1]},${c[0]},0`).join(' ');
      return `
    <Placemark>
      <name>Ada: ${p.adaNo} / Parsel: ${p.parselNo} - TCDD</name>
      <description><![CDATA[
        <h3>TCDD Demiryolu Kadastro Parseli</h3>
        <p><b>İl/İlçe:</b> ${p.il} / ${p.ilce}</p>
        <p><b>Mahalle/Köy:</b> ${p.mahalleKoy}</p>
        <p><b>Ada/Parsel:</b> ${p.adaNo} / ${p.parselNo}</p>
        <p><b>Nitelik:</b> ${p.nitelik}</p>
        <p><b>Alan:</b> ${p.alanM2.toLocaleString('tr-TR')} m²</p>
        <p><b>Malik:</b> ${p.malik}</p>
        <p><b>İstimlak Genişliği:</b> ${p.kamulastirmaGenisligiMetre || 30} m</p>
        <p><b>KM Aralığı:</b> ${p.startKm} ➔ ${p.endKm}</p>
      ]]></description>
      <Style>
        <LineStyle>
          <color>ff330099</color> <!-- AABBGGRR format: #990033 -->
          <width>3</width>
        </LineStyle>
        <PolyStyle>
          <color>551c1cb9</color> <!-- Semi-transparent red -->
        </PolyStyle>
      </Style>
      <Polygon>
        <extrude>1</extrude>
        <altitudeMode>clampToGround</altitudeMode>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${coordStr}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>TCDD Demiryolu Arazisi ve Tapu Kadastro Sınırları</name>
    <description>TCDD 712 Şefliği Demiryolu Kamulaştırma ve Mülkiyet Parselleri</description>
    ${placemarks}
  </Document>
</kml>`;
}
