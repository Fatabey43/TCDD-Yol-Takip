import { RailwayPoint, RailwayPointCategory } from '../types.ts';
import { getPointsFromIDB } from './dbStorage.ts';

/**
 * Extracts KM value from text like "KM 142+250", "Km 14+300", "142.500", "KM 120"
 */
export function extractKmValue(text: string): string {
  if (!text) return '';
  const match = text.match(/(?:KM|Km|km)\s*[:.-]?\s*(\d+(?:\+\d+|\.\d+)?)/i);
  if (match && match[1]) {
    return match[1];
  }
  const plusMatch = text.match(/\b\d+\+\d+\b/);
  if (plusMatch) {
    return plusMatch[0];
  }
  return '';
}

/**
 * Categorize point based on title or description
 */
export function guessCategory(text: string): RailwayPointCategory {
  const lower = (text || '').toLowerCase();
  if (lower.includes('makas') || lower.includes('switch')) return 'switch';
  if (lower.includes('geçit') || lower.includes('hemzemin') || lower.includes('crossing')) return 'crossing';
  if (lower.includes('köprü') || lower.includes('viyadük') || lower.includes('bridge') || lower.includes('viaduct')) return 'bridge';
  if (lower.includes('menfez') || lower.includes('culvert')) return 'culvert';
  if (lower.includes('istasyon') || lower.includes('gar') || lower.includes('durak') || lower.includes('station')) return 'station';
  if (lower.includes('sinyal') || lower.includes('trafo') || lower.includes('pano') || lower.includes('signal')) return 'signal';
  return 'km_marker';
}

/**
 * Parses KML XML text string into RailwayPoint objects
 */
export function parseKML(kmlText: string, defaultLine: string = 'Kayıtlı Demiryolu Hattı'): Partial<RailwayPoint>[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(kmlText, 'text/xml');
  const placemarks = xmlDoc.getElementsByTagName('Placemark');
  const results: Partial<RailwayPoint>[] = [];

  for (let i = 0; i < placemarks.length; i++) {
    const pm = placemarks[i];
    const nameEl = pm.getElementsByTagName('name')[0];
    const descEl = pm.getElementsByTagName('description')[0];
    const coordsEl = pm.getElementsByTagName('coordinates')[0];

    const title = nameEl ? nameEl.textContent?.trim() || `KM Noktası ${i + 1}` : `KM Noktası ${i + 1}`;
    const description = descEl ? descEl.textContent?.trim() || '' : '';

    if (!coordsEl || !coordsEl.textContent) continue;

    // KML format is longitude,latitude[,altitude]
    const rawCoords = coordsEl.textContent.trim().split(/\s+/)[0];
    const parts = rawCoords.split(',');
    if (parts.length >= 2) {
      const lng = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);

      if (!isNaN(lat) && !isNaN(lng)) {
        const fullText = `${title} ${description}`;
        const kmVal = extractKmValue(fullText) || (title.startsWith('KM') ? title : '');

        results.push({
          id: `kml-${Date.now()}-${i}`,
          title,
          kmValue: kmVal,
          lineName: defaultLine,
          locationDesc: description.slice(0, 80),
          category: guessCategory(fullText),
          lat,
          lng,
          description,
          notes: [],
          photos: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  return results;
}

/**
 * Parses GeoJSON string
 */
export function parseGeoJSON(jsonText: string, defaultLine: string = 'Kayıtlı Demiryolu Hattı'): Partial<RailwayPoint>[] {
  try {
    const geojson = JSON.parse(jsonText);
    const features = geojson.type === 'FeatureCollection' ? geojson.features : [geojson];
    const results: Partial<RailwayPoint>[] = [];

    features.forEach((feat: any, i: number) => {
      if (feat.geometry && feat.geometry.type === 'Point') {
        const [lng, lat] = feat.geometry.coordinates;
        if (!isNaN(lat) && !isNaN(lng)) {
          const props = feat.properties || {};
          const title = props.name || props.title || `KM Noktası ${i + 1}`;
          const description = props.description || props.desc || '';
          const kmVal = props.km || props.kmValue || extractKmValue(`${title} ${description}`);

          results.push({
            id: `geojson-${Date.now()}-${i}`,
            title,
            kmValue: kmVal,
            lineName: props.line || props.lineName || defaultLine,
            locationDesc: props.location || props.mevki || '',
            category: props.category || guessCategory(`${title} ${description}`),
            lat: Number(lat),
            lng: Number(lng),
            description,
            notes: [],
            photos: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }
    });

    return results;
  } catch (err) {
    console.error('GeoJSON parse error:', err);
    return [];
  }
}

/**
 * Parses CSV text with headers (lat, lng, name/km, etc.)
 */
export function parseCSV(csvText: string, defaultLine: string = 'Kayıtlı Demiryolu Hattı'): Partial<RailwayPoint>[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(/[,;\t]/).map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
  const latIdx = headers.findIndex((h) => h.includes('lat') || h.includes('enlem') || h === 'y');
  const lngIdx = headers.findIndex((h) => h.includes('lng') || h.includes('lon') || h.includes('boylam') || h === 'x');
  const nameIdx = headers.findIndex((h) => h.includes('name') || h.includes('başlık') || h.includes('baslik') || h.includes('isim') || h.includes('nokta'));
  const kmIdx = headers.findIndex((h) => h.includes('km') || h.includes('kilometre'));
  const lineIdx = headers.findIndex((h) => h.includes('line') || h.includes('hat'));
  const descIdx = headers.findIndex((h) => h.includes('desc') || h.includes('açıklama') || h.includes('aciklama') || h.includes('not'));

  const results: Partial<RailwayPoint>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(/[,;\t]/).map((c) => c.trim().replace(/^["']|["']$/g, ''));
    if (row.length <= Math.max(latIdx, lngIdx)) continue;

    const lat = parseFloat(row[latIdx]);
    const lng = parseFloat(row[lngIdx]);

    if (!isNaN(lat) && !isNaN(lng)) {
      const title = nameIdx >= 0 && row[nameIdx] ? row[nameIdx] : `KM Noktası ${i}`;
      const kmValue = kmIdx >= 0 && row[kmIdx] ? row[kmIdx] : extractKmValue(title);
      const lineName = lineIdx >= 0 && row[lineIdx] ? row[lineIdx] : defaultLine;
      const description = descIdx >= 0 && row[descIdx] ? row[descIdx] : '';

      results.push({
        id: `csv-${Date.now()}-${i}`,
        title,
        kmValue,
        lineName,
        category: guessCategory(`${title} ${description}`),
        lat,
        lng,
        description,
        notes: [],
        photos: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return results;
}

/**
 * Parses native RailwayPoint array JSON
 */
export function parseNativeJSON(jsonText: string): Partial<RailwayPoint>[] {
  try {
    const data = JSON.parse(jsonText);
    const array = Array.isArray(data) ? data : (Array.isArray(data.points) ? data.points : null);
    if (!array) return [];

    return array
      .filter((p: any) => p && !isNaN(Number(p.lat)) && !isNaN(Number(p.lng)))
      .map((p: any, idx: number) => ({
        id: p.id || `json-${Date.now()}-${idx}`,
        title: p.title || `KM Noktası ${idx + 1}`,
        kmValue: p.kmValue || extractKmValue(p.title || ''),
        lineName: p.lineName || 'Genel Demiryolu Hattı',
        locationDesc: p.locationDesc || '',
        category: p.category || guessCategory(p.title || ''),
        lat: Number(p.lat),
        lng: Number(p.lng),
        description: p.description || '',
        textStyle: p.textStyle || null,
        titleTextStyle: p.titleTextStyle || null,
        notes: Array.isArray(p.notes) ? p.notes : [],
        photos: Array.isArray(p.photos) ? p.photos : [],
        createdAt: p.createdAt || new Date().toISOString(),
        updatedAt: p.updatedAt || new Date().toISOString(),
      }));
  } catch (err) {
    return [];
  }
}

/**
 * Exports points to JSON file download (Full raw backup)
 */
export async function exportToJSON(points: RailwayPoint[]) {
  let exportPoints = [...points];

  // Try to retrieve full photos from IndexedDB in case localStorage held lightweight placeholders
  try {
    const idbPoints = await getPointsFromIDB();
    if (Array.isArray(idbPoints) && idbPoints.length > 0) {
      const idbMap = new Map(idbPoints.map((p) => [p.id, p]));
      exportPoints = exportPoints.map((p) => {
        const idbP = idbMap.get(p.id);
        if (!idbP) return p;

        // Restore photos from IDB if present
        const fullPhotos = (idbP.photos || []).filter((ph) => !ph.dataUrl?.includes('[idb]'));
        if (fullPhotos.length > 0) {
          return {
            ...p,
            photos: fullPhotos,
            notes: (idbP.notes && idbP.notes.length > (p.notes?.length || 0)) ? idbP.notes : p.notes,
          };
        }
        return p;
      });
    }
  } catch (err) {
    console.warn('IDB okuma uyarısı:', err);
  }

  const blob = new Blob([JSON.stringify(exportPoints, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `demiryolu_kmler_tam_yedek_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Exports points to GeoJSON file download
 */
export function exportToGeoJSON(points: RailwayPoint[]) {
  const geojson = {
    type: 'FeatureCollection',
    features: points.map((p) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [p.lng, p.lat],
      },
      properties: {
        title: p.title,
        kmValue: p.kmValue,
        lineName: p.lineName,
        locationDesc: p.locationDesc,
        category: p.category,
        description: p.description,
        notesCount: p.notes?.length || 0,
        photosCount: p.photos?.length || 0,
        updatedAt: p.updatedAt,
      },
    })),
  };

  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `demiryolu_kmler_${new Date().toISOString().slice(0, 10)}.geojson`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Exports points to KML file download (compatible with Google Earth and Google My Maps)
 */
export function exportToKML(points: RailwayPoint[]) {
  const placemarks = points.map((p) => `
    <Placemark>
      <name><![CDATA[${p.title}]]></name>
      <description><![CDATA[Hat: ${p.lineName}\nKM: ${p.kmValue}\nMevki: ${p.locationDesc || '-'}\nAçıklama: ${p.description}\nNot Sayısı: ${p.notes?.length || 0}]]></description>
      <Point>
        <coordinates>${p.lng},${p.lat},0</coordinates>
      </Point>
    </Placemark>`).join('');

  const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Demiryolu KM Noktaları</name>
    <description>Demiryolu KM Takip Uygulaması Kayıtları</description>
    ${placemarks}
  </Document>
</kml>`;

  const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `demiryolu_kmler_${new Date().toISOString().slice(0, 10)}.kml`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Exports a single point to KML file and triggers download
 * Opens immediately in Google Earth Pro / Google Earth Desktop or Mobile app
 */
export function exportSinglePointKML(point: RailwayPoint) {
  const cleanTitle = (point.title || 'Nokta').replace(/[^\w\s\u00C0-\u017F+-]/gi, '_');
  const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${point.title}</name>
    <description>Demiryolu KM Noktası - ${point.lineName || ''}</description>
    <Style id="railwayPointIcon">
      <IconStyle>
        <scale>1.3</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/shapes/rail.png</href>
        </Icon>
      </IconStyle>
    </Style>
    <Placemark>
      <name><![CDATA[${point.title}]]></name>
      <description><![CDATA[<b>Hat:</b> ${point.lineName || '-'}<br/><b>KM:</b> ${point.kmValue || '-'}<br/><b>Mevki:</b> ${point.locationDesc || '-'}<br/><b>Açıklama:</b> ${point.description || '-'}<br/><b>Koordinat:</b> ${point.lat}, ${point.lng}]]></description>
      <styleUrl>#railwayPointIcon</styleUrl>
      <Point>
        <coordinates>${point.lng},${point.lat},0</coordinates>
      </Point>
    </Placemark>
  </Document>
</kml>`;

  const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${cleanTitle}.kml`;
  a.click();
  URL.revokeObjectURL(url);
}

