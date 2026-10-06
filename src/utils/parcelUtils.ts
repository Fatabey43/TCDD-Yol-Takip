import { RailwayPoint, RailwayParcel } from '../types.ts';
import { parseKmToNumber } from './kmUtils.ts';

/**
 * Resmi TKGM (Tapu ve Kadastro Genel Müdürlüğü) Parsel Sorgu Linki Üretici
 * Not: TKGM web uygulaması `#ara/idari/` altında metin isimleri verildiğinde JavaScript hatası
 * verip donduğundan, koordinat yoksa temiz güvenli ana sayfayı (parselsorgu.tkgm.gov.tr) açar.
 */
export function generateTkgmUrl(
  il?: string,
  ilce?: string,
  mahalle?: string,
  ada?: string,
  parsel?: string,
  centerLat?: number,
  centerLng?: number
): string {
  if (typeof centerLat === 'number' && typeof centerLng === 'number' && !isNaN(centerLat) && !isNaN(centerLng) && centerLat !== 0) {
    return `https://parselsorgu.tkgm.gov.tr/#ara/cografi/${centerLat.toFixed(6)}/${centerLng.toFixed(6)}`;
  }

  // Güvenli temiz URL (donmayı önler)
  return 'https://parselsorgu.tkgm.gov.tr/';
}

/**
 * Poligonun ağırlık merkezini (Centroid) hesaplar
 */
export function calculateParcelCenter(coords: [number, number][]): [number, number] {
  if (!coords || coords.length === 0) return [39.7767, 30.5206]; // default Eskişehir
  let sumLat = 0;
  let sumLng = 0;
  for (const [lat, lng] of coords) {
    sumLat += lat;
    sumLng += lng;
  }
  return [sumLat / coords.length, sumLng / coords.length];
}

/**
 * Geodezik Shoelace formülü ile poligon alanını yaklaşık m² cinsinden hesaplar
 */
export function calculateParcelArea(coords: [number, number][]): number {
  if (!coords || coords.length < 3) return 0;

  const R = 6378137; // Dünya yarıçapı (metre)
  let area = 0;

  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length;
    const p1 = coords[i];
    const p2 = coords[j];

    const lat1Rad = (p1[0] * Math.PI) / 180;
    const lat2Rad = (p2[0] * Math.PI) / 180;
    const dLngRad = ((p2[1] - p1[1]) * Math.PI) / 180;

    area += dLngRad * (2 + Math.sin(lat1Rad) + Math.sin(lat2Rad));
  }

  area = Math.abs((area * R * R) / 4);
  return Math.round(area);
}

/**
 * m² değerini Dönüm (Dekar) ve Hektar olarak formatlar
 */
export function formatAreaDisplay(m2: number): { m2Text: string; donumText: string; hectareText: string } {
  const m2Formatted = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(m2);
  const donum = m2 / 1000;
  const donumFormatted = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(donum);
  const hectare = m2 / 10000;
  const hectareFormatted = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(hectare);

  return {
    m2Text: `${m2Formatted} m²`,
    donumText: `${donumFormatted} Dönüm`,
    hectareText: `${hectareFormatted} Hektar`,
  };
}

/**
 * Verilen demiryolu hattı ve KM aralığından otomatik kamulaştırma emniyet koridoru poligonu üretir
 * (Hat ekseninden sol ve sağ ofset hesaplaması)
 */
export function generateCorridorPolygonFromRailway(
  points: RailwayPoint[],
  startKmNum: number,
  endKmNum: number,
  widthMeters: number = 30,
  lineName?: string
): [number, number][] {
  const minKm = Math.min(startKmNum, endKmNum);
  const maxKm = Math.max(startKmNum, endKmNum);

  // Filtrele ve sırala
  const matchingPoints = points
    .filter((p) => {
      const matchLine = !lineName || lineName === 'all' || p.lineName === lineName;
      if (!matchLine) return false;
      const km = parseKmToNumber(p.kmValue, p.title);
      return km !== null && km >= minKm - 0.1 && km <= maxKm + 0.1;
    })
    .sort((a, b) => {
      const kmA = parseKmToNumber(a.kmValue, a.title) || 0;
      const kmB = parseKmToNumber(b.kmValue, b.title) || 0;
      return kmA - kmB;
    });

  if (matchingPoints.length < 2) {
    return [];
  }

  const halfWidth = widthMeters / 2;
  const leftSide: [number, number][] = [];
  const rightSide: [number, number][] = [];

  for (let i = 0; i < matchingPoints.length; i++) {
    const cur = matchingPoints[i];
    let angleRad = 0;

    if (i < matchingPoints.length - 1) {
      const next = matchingPoints[i + 1];
      const dLat = next.lat - cur.lat;
      const dLng = next.lng - cur.lng;
      angleRad = Math.atan2(dLat, dLng);
    } else {
      const prev = matchingPoints[i - 1];
      const dLat = cur.lat - prev.lat;
      const dLng = cur.lng - prev.lng;
      angleRad = Math.atan2(dLat, dLng);
    }

    // Dik açı (normal vektör)
    const normalAngle = angleRad + Math.PI / 2;

    // Metreyi yaklaşık dereceye çevirme (enlem için ~111,000 m/derece, boylam için enleme göre cos)
    const metersPerLatDegree = 111132;
    const metersPerLngDegree = 111132 * Math.cos((cur.lat * Math.PI) / 180);

    const offsetLat = (halfWidth * Math.sin(normalAngle)) / metersPerLatDegree;
    const offsetLng = (halfWidth * Math.cos(normalAngle)) / metersPerLngDegree;

    leftSide.push([cur.lat + offsetLat, cur.lng + offsetLng]);
    rightSide.push([cur.lat - offsetLat, cur.lng - offsetLng]);
  }

  // Sol tarafı ileri, sağ tarafı geri birleştirerek kapalı poligon oluştur
  rightSide.reverse();
  return [...leftSide, ...rightSide];
}

/**
 * KML veya GeoJSON dosya içeriğinden parsel koordinatlarını ve niteliklerini ayıklar
 */
export function parseKmlOrGeoJsonParcels(content: string): Partial<RailwayParcel>[] {
  const results: Partial<RailwayParcel>[] = [];
  const trimmed = content.trim();

  // 1. GeoJSON formatı dene
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      const features = Array.isArray(parsed)
        ? parsed
        : parsed.type === 'FeatureCollection'
        ? parsed.features || []
        : parsed.type === 'Feature'
        ? [parsed]
        : [];

      for (const feat of features) {
        const props = feat.properties || {};
        let coords: [number, number][] = [];

        if (feat.geometry) {
          if (feat.geometry.type === 'Polygon' && Array.isArray(feat.geometry.coordinates)) {
            const rawRing = feat.geometry.coordinates[0] || [];
            coords = rawRing.map((c: any) => [c[1], c[0]]); // [lng, lat] -> [lat, lng]
          } else if (feat.geometry.type === 'MultiPolygon' && Array.isArray(feat.geometry.coordinates)) {
            const firstPoly = feat.geometry.coordinates[0] || [];
            const rawRing = firstPoly[0] || [];
            coords = rawRing.map((c: any) => [c[1], c[0]]);
          }
        }

        if (coords.length >= 3) {
          const area = calculateParcelArea(coords);
          results.push({
            adaNo: String(props.ada || props.adaNo || props.ADA || '101'),
            parselNo: String(props.parsel || props.parselNo || props.PARSEL || '1'),
            il: props.il || props.IL || 'Eskişehir',
            ilce: props.ilce || props.ILCE || 'Sivrihisar',
            mahalleKoy: props.mahalle || props.mahalleKoy || props.MAHALLE || 'Dümrek',
            nitelik: props.nitelik || props.NITELIK || 'Demiryolu Güzergahı',
            malik: props.malik || props.MALIK || 'TCDD İşletmesi Genel Müdürlüğü',
            alanM2: Number(props.alan || props.alanM2 || props.ALAN) || area,
            coordinates: coords,
            notes: props.aciklama || props.notes || '',
          });
        }
      }

      if (results.length > 0) return results;
    } catch {}
  }

  // 2. KML formatı dene
  if (trimmed.includes('<kml') || trimmed.includes('<Placemark')) {
    try {
      const placemarks = trimmed.split(/<Placemark[\s>]/i);
      for (let i = 1; i < placemarks.length; i++) {
        const block = placemarks[i];
        const nameMatch = block.match(/<name>(.*?)<\/name>/i);
        const name = nameMatch ? nameMatch[1].trim() : `Parsel ${i}`;

        // ExtendedData & SimpleData (TKGM resmi formatı)
        const getSimpleData = (key: string): string | undefined => {
          const regex = new RegExp(`<SimpleData\\s+name=["']${key}["']>([^<]+)<\\/SimpleData>`, 'i');
          const m = block.match(regex);
          if (m) return m[1].trim();
          const regexData = new RegExp(`<Data\\s+name=["']${key}["']>\\s*<value>([^<]+)<\\/value>`, 'i');
          const m2 = block.match(regexData);
          if (m2) return m2[1].trim();
          return undefined;
        };

        // Description içinden nitelik ayıklama (HTML tablo veya düz metin)
        const descMatch = block.match(/<description>([\s\S]*?)<\/description>/i);
        const desc = descMatch ? descMatch[1] : '';
        const getDescField = (key: string): string | undefined => {
          const regex = new RegExp(`(?:${key})\\s*[:=]\\s*<[^>]+>\\s*([^<]+)|(?:${key})\\s*[:=]\\s*([^<\\n\\r]+)`, 'i');
          const m = desc.match(regex);
          if (m) return (m[1] || m[2] || '').trim();
          return undefined;
        };

        const coordMatch = block.match(/<coordinates>([\s\S]*?)<\/coordinates>/i);
        if (coordMatch) {
          const rawCoords = coordMatch[1].trim().split(/\s+/);
          const coords: [number, number][] = [];
          for (const item of rawCoords) {
            const parts = item.split(',');
            if (parts.length >= 2) {
              const lng = parseFloat(parts[0]);
              const lat = parseFloat(parts[1]);
              if (!isNaN(lat) && !isNaN(lng)) {
                coords.push([lat, lng]);
              }
            }
          }

          if (coords.length >= 3) {
            // Ada ve Parsel no tespiti
            let ada = getSimpleData('ADA') || getSimpleData('ada') || getDescField('Ada') || '';
            let parsel = getSimpleData('PARSEL') || getSimpleData('parsel') || getDescField('Parsel') || '';

            if (!ada || !parsel) {
              const adaParselMatch = name.match(/Ada[:\s]*(\d+)[^\d]+Parsel[:\s]*(\d+)/i) ||
                                     name.match(/(\d+)\s*ada\s*(\d+)\s*parsel/i) ||
                                     name.match(/(\d+)\s*\/\s*(\d+)/);
              if (adaParselMatch) {
                if (!ada) ada = adaParselMatch[1];
                if (!parsel) parsel = adaParselMatch[2];
              }
            }

            if (!ada) ada = '101';
            if (!parsel) parsel = String(i);

            const il = getSimpleData('IL') || getSimpleData('il') || getDescField('İl') || getDescField('Il') || 'Eskişehir';
            const ilce = getSimpleData('ILCE') || getSimpleData('ilce') || getDescField('İlçe') || getDescField('Ilce') || 'Sivrihisar';
            const mahalle = getSimpleData('MAHALLE') || getSimpleData('mahalle') || getDescField('Mahalle') || getDescField('Köy') || 'Demiryolu Hattı';
            const nitelik = getSimpleData('NITELIK') || getSimpleData('nitelik') || getDescField('Nitelik') || 'Demiryolu Güzergahı';
            const malik = getSimpleData('MALIK') || getSimpleData('malik') || getDescField('Malik') || 'TCDD İşletmesi Genel Müdürlüğü';
            const pafta = getSimpleData('PAFTA') || getSimpleData('pafta') || getDescField('Pafta') || '';

            const areaCalculated = calculateParcelArea(coords);
            const alanStr = getSimpleData('ALAN') || getSimpleData('alan') || getDescField('Alan');
            const parsedAlan = alanStr ? parseFloat(alanStr.replace(/\./g, '').replace(',', '.')) : 0;
            const alanM2 = parsedAlan > 0 ? parsedAlan : areaCalculated;

            results.push({
              adaNo: ada,
              parselNo: parsel,
              il,
              ilce,
              mahalleKoy: mahalle,
              paftaNo: pafta,
              nitelik,
              malik,
              alanM2,
              coordinates: coords,
              notes: name !== `${ada}/${parsel}` ? `${name} (TKGM KML)` : 'TKGM KML İçe Aktarımı',
            });
          }
        }
      }
    } catch {}
  }

  return results;
}

/**
 * Demiryolu parsellerini Google Earth / Netcad / CBS uyumlu KML formatına çevirir
 */
export function exportParcelsToKml(parcels: RailwayParcel[]): string {
  const placemarks = parcels
    .filter((p) => p.coordinates && p.coordinates.length >= 3)
    .map((p) => {
      const ring = [...p.coordinates];
      if (
        ring[0][0] !== ring[ring.length - 1][0] ||
        ring[0][1] !== ring[ring.length - 1][1]
      ) {
        ring.push([...ring[0]]);
      }
      const coordStr = ring.map(([lat, lng]) => `${lng},${lat},0`).join(' ');

      return `
    <Placemark>
      <name>Ada ${p.adaNo} / Parsel ${p.parselNo} - ${p.mahalleKoy}</name>
      <description><![CDATA[
        <b>TCDD Demiryolu Arazisi</b><br/>
        <b>İl/İlçe/Mahalle:</b> ${p.il} / ${p.ilce} / ${p.mahalleKoy}<br/>
        <b>Ada/Parsel:</b> ${p.adaNo}/${p.parselNo}<br/>
        <b>Nitelik:</b> ${p.nitelik || 'Demiryolu'}<br/>
        <b>Malik:</b> ${p.malik || 'TCDD'}<br/>
        <b>Yüzölçümü:</b> ${p.alanM2?.toLocaleString('tr-TR')} m²<br/>
        <b>KM Aralığı:</b> ${p.startKm || '-'} - ${p.endKm || '-'}<br/>
        ${p.encroachmentNote ? `<b>İşgal/Tecavüz:</b> ${p.encroachmentNote}<br/>` : ''}
      ]]></description>
      <Style>
        <LineStyle>
          <color>${p.encroachmentStatus && p.encroachmentStatus !== 'none' ? 'ff0000ff' : 'ffff00aa'}</color>
          <width>2.5</width>
        </LineStyle>
        <PolyStyle>
          <color>${p.encroachmentStatus && p.encroachmentStatus !== 'none' ? '440000ff' : '44ff00aa'}</color>
        </PolyStyle>
      </Style>
      <Polygon>
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
    <name>TCDD Demiryolu Arazileri ve Kadastro Parselleri</name>
    <description>TCDD 712 Şefliği Demiryolu Kamulaştırma Sahası ve Parsel Sınırları</description>
    ${placemarks}
  </Document>
</kml>`;
}

