import { RailwayPoint, RailwayPointCategory } from '../types.ts';
import { getPointsFromIDB } from './dbStorage.ts';
import * as XLSX from 'xlsx';

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
export function parseKML(
  kmlText: string,
  defaultLine: string = 'Kayıtlı Demiryolu Hattı',
  forcedCategory?: RailwayPointCategory | 'auto'
): Partial<RailwayPoint>[] {
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
        const autoCat = guessCategory(fullText);
        const category: RailwayPointCategory =
          forcedCategory && forcedCategory !== 'auto' ? forcedCategory : autoCat;

        let parsedCrossing: any = undefined;
        let parsedCulvert: any = undefined;

        if (category === 'culvert') {
          parsedCulvert = {
            hatti: defaultLine,
            mihverKlm: kmVal || title,
          };
        }

        if (category === 'crossing' || description.includes('Geçit') || description.includes('Bariyer') || description.includes('Kaplama')) {
          const mType = description.match(/(?:Geçit Tipi|crossingType)\s*[:=]?\s*([^\n\r<•]+)/i);
          const mSurf = description.match(/(?:Kaplama Cinsi|surfaceType)\s*[:=]?\s*([^\n\r<•]+)/i);
          const mVehicle = description.match(/(?:24s? Ort\.? Taşıt|Taşıt Sayısı|Taşıt Adedi|dailyVehicleCount)\s*[:=]?\s*([^\n\r<•]+)/i);
          const mTrain = description.match(/(?:24s? Ort\.? Tren|Tren Sayısı|Tren Adedi|dailyTrainCount)\s*[:=]?\s*([^\n\r<•]+)/i);
          const mClear = description.match(/(?:Açıklık|Geçit Açıklığı|clearanceWidth)\s*[:=]?\s*([^\n\r<•]+)/i);
          const mSkew = description.match(/(?:Verevlik Açısı|Verevlik|skewAngle)\s*[:=]?\s*([^\n\r<•]+)/i);
          const mTrack = description.match(/(?:Kestiği Hat|intersectedTrackCount)\s*[:=]?\s*([^\n\r<•]+)/i);
          const mSight = description.match(/(?:Min\.? Görüş|Görüş Mesafesi|minSightDistance)\s*[:=]?\s*([^\n\r<•]+)/i);
          const mGrad = description.match(/(?:Eğim|railwayGradient)\s*[:=]?\s*([^\n\r<•]+)/i);
          const mCurve = description.match(/(?:Kurp|curveInfo)\s*[:=]?\s*([^\n\r<•]+)/i);

          if (mType || mSurf || mVehicle || mTrain || mClear || mSkew || mTrack || mSight || mGrad || mCurve) {
            parsedCrossing = {
              crossingType: mType ? mType[1].trim() : undefined,
              surfaceType: mSurf ? mSurf[1].trim() : undefined,
              dailyVehicleCount: mVehicle ? mVehicle[1].trim() : undefined,
              dailyTrainCount: mTrain ? mTrain[1].trim() : undefined,
              clearanceWidth: mClear ? mClear[1].trim() : undefined,
              skewAngle: mSkew ? mSkew[1].trim() : undefined,
              intersectedTrackCount: mTrack ? mTrack[1].trim() : undefined,
              minSightDistance: mSight ? mSight[1].trim() : undefined,
              railwayGradient: mGrad ? mGrad[1].trim() : undefined,
              curveInfo: mCurve ? mCurve[1].trim() : undefined,
            };
          }
        }

        results.push({
          id: `kml-${Date.now()}-${i}`,
          title,
          kmValue: kmVal,
          lineName: defaultLine,
          locationDesc: description.slice(0, 80),
          category,
          lat,
          lng,
          description,
          levelCrossing: parsedCrossing,
          culvert: parsedCulvert,
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
export function parseGeoJSON(
  jsonText: string,
  defaultLine: string = 'Kayıtlı Demiryolu Hattı',
  forcedCategory?: RailwayPointCategory | 'auto'
): Partial<RailwayPoint>[] {
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
          const autoCat = props.category || guessCategory(`${title} ${description}`);
          const category: RailwayPointCategory =
            forcedCategory && forcedCategory !== 'auto' ? forcedCategory : autoCat;

          results.push({
            id: `geojson-${Date.now()}-${i}`,
            title,
            kmValue: kmVal,
            lineName: props.line || props.lineName || defaultLine,
            locationDesc: props.location || props.mevki || '',
            category,
            lat: Number(lat),
            lng: Number(lng),
            description,
            textStyle: props.textStyle || null,
            titleTextStyle: props.titleTextStyle || null,
            levelCrossing: props.levelCrossing || props.level_crossing || undefined,
            culvert:
              category === 'culvert'
                ? props.culvert || { hatti: props.line || defaultLine, mihverKlm: kmVal || title }
                : undefined,
            notes: Array.isArray(props.notes) ? props.notes : [],
            photos: Array.isArray(props.photos) ? props.photos : [],
            createdAt: props.createdAt || new Date().toISOString(),
            updatedAt: props.updatedAt || new Date().toISOString(),
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
 * Parses generic key-value row (from Excel sheet or CSV) into Partial<RailwayPoint>
 */
export function parseRowObject(
  row: Record<string, any>,
  index: number,
  defaultLine: string = 'Kayıtlı Demiryolu Hattı',
  forcedCategory?: RailwayPointCategory | 'auto'
): Partial<RailwayPoint> | null {
  const normKeys: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      const cleanKey = k.trim().toLowerCase().replace(/[\s_.-]/g, '');
      normKeys[cleanKey] = v;
    }
  }

  // 1. Coordinates
  const latVal = normKeys['lat'] ?? normKeys['enlem'] ?? normKeys['latitude'] ?? normKeys['y'] ?? normKeys['kordinatlat'] ?? normKeys['noktaenlem'];
  const lngVal = normKeys['lng'] ?? normKeys['boylam'] ?? normKeys['longitude'] ?? normKeys['lon'] ?? normKeys['x'] ?? normKeys['kordinatlng'] ?? normKeys['noktaboylam'];

  const lat = parseFloat(String(latVal).replace(',', '.'));
  const lng = parseFloat(String(lngVal).replace(',', '.'));

  // 2. Title & KM
  const rawTitle = normKeys['title'] ?? normKeys['name'] ?? normKeys['baslik'] ?? normKeys['başlık'] ?? normKeys['ad'] ?? normKeys['gecitadi'] ?? normKeys['geçitadı'] ?? normKeys['noktaadı'] ?? normKeys['noktaadi'] ?? '';
  const rawKm = normKeys['km'] ?? normKeys['kmvalue'] ?? normKeys['kilometre'] ?? normKeys['zincir'] ?? '';

  const title = String(rawTitle).trim() || (rawKm ? `KM ${rawKm}` : `KM Noktası ${index + 1}`);
  const kmValue = String(rawKm).trim() || extractKmValue(title);

  const lineName = String(normKeys['line'] ?? normKeys['linename'] ?? normKeys['hat'] ?? normKeys['hatadi'] ?? normKeys['hatadı'] ?? defaultLine).trim();
  const locationDesc = String(normKeys['location'] ?? normKeys['locationdesc'] ?? normKeys['mevki'] ?? normKeys['yer'] ?? normKeys['konum'] ?? '').trim();
  const description = String(normKeys['description'] ?? normKeys['desc'] ?? normKeys['aciklama'] ?? normKeys['açıklama'] ?? normKeys['not'] ?? normKeys['notlar'] ?? '').trim();

  // 3. Category detection
  const rawCat = String(normKeys['category'] ?? normKeys['kategori'] ?? normKeys['tur'] ?? normKeys['tür'] ?? '').trim().toLowerCase();
  let autoCategory: RailwayPointCategory = 'km_marker';
  if (rawCat.includes('gecit') || rawCat.includes('geçit') || rawCat.includes('crossing') || rawCat.includes('hemzemin')) {
    autoCategory = 'crossing';
  } else if (rawCat.includes('makas') || rawCat.includes('switch')) {
    autoCategory = 'switch';
  } else if (rawCat.includes('kopru') || rawCat.includes('köprü') || rawCat.includes('viyaduk') || rawCat.includes('viyadük') || rawCat.includes('bridge')) {
    autoCategory = 'bridge';
  } else if (rawCat.includes('menfez') || rawCat.includes('culvert')) {
    autoCategory = 'culvert';
  } else if (rawCat.includes('istasyon') || rawCat.includes('gar') || rawCat.includes('durak') || rawCat.includes('station')) {
    autoCategory = 'station';
  } else if (rawCat.includes('sinyal') || rawCat.includes('signal')) {
    autoCategory = 'signal';
  } else {
    autoCategory = guessCategory(`${title} ${description} ${locationDesc}`);
  }

  const category: RailwayPointCategory =
    forcedCategory && forcedCategory !== 'auto' ? forcedCategory : autoCategory;

  // 4. Level crossing fields (Hemzemin Geçit Özellikleri)
  let levelCrossing: any = undefined;
  const crossingType = normKeys['crossingtype'] ?? normKeys['gecittipi'] ?? normKeys['geçittipi'] ?? normKeys['tip'] ?? normKeys['bariyertipi'] ?? normKeys['bariyer'];
  const surfaceType = normKeys['surfacetype'] ?? normKeys['kaplamacinsi'] ?? normKeys['kaplama'] ?? normKeys['kaplamatipi'] ?? normKeys['zemin'];
  const dailyVehicle = normKeys['dailyvehiclecount'] ?? normKeys['tasitsayisi'] ?? normKeys['taşıtsayısı'] ?? normKeys['24saattasit'] ?? normKeys['24saattaşıt'] ?? normKeys['aracsayisi'] ?? normKeys['araçsayısı'];
  const dailyTrain = normKeys['dailytraincount'] ?? normKeys['trensayisi'] ?? normKeys['trensayısı'] ?? normKeys['24saattren'] ?? normKeys['gunluktren'] ?? normKeys['günlüktren'];
  const clearance = normKeys['clearancewidth'] ?? normKeys['gecitacikligi'] ?? normKeys['geçitaçıklığı'] ?? normKeys['aciklik'] ?? normKeys['açıklık'] ?? normKeys['yolgenisligi'] ?? normKeys['yolgenişliği'];
  const skewAngle = normKeys['skewangle'] ?? normKeys['verevlik'] ?? normKeys['verevlikacisi'] ?? normKeys['verevlikaçısı'] ?? normKeys['aci'] ?? normKeys['açı'];
  const intersectedTrack = normKeys['intersectedtrackcount'] ?? normKeys['kestigihatadedi'] ?? normKeys['kestiğihatadedi'] ?? normKeys['hatsayisi'] ?? normKeys['hatsayısı'] ?? normKeys['kestigihat'] ?? normKeys['kestiğihat'];
  const minSight = normKeys['minsightdistance'] ?? normKeys['gorusmesafesi'] ?? normKeys['görüşmesafesi'] ?? normKeys['mingorus'] ?? normKeys['mingörüş'];
  const railwayGradient = normKeys['railwaygradient'] ?? normKeys['egim'] ?? normKeys['eğim'] ?? normKeys['demiryoluegimi'] ?? normKeys['demiryolueğimi'] ?? normKeys['meyil'];
  const curveInfo = normKeys['curveinfo'] ?? normKeys['kurp'] ?? normKeys['kurpbilgisi'] ?? normKeys['kurpbilgileri'] ?? normKeys['yaricap'] ?? normKeys['yarıçap'];

  if (category === 'crossing' || crossingType || surfaceType || dailyVehicle || dailyTrain || clearance || skewAngle || intersectedTrack || minSight || railwayGradient || curveInfo) {
    levelCrossing = {
      crossingType: crossingType ? String(crossingType).trim() : undefined,
      surfaceType: surfaceType ? String(surfaceType).trim() : undefined,
      dailyVehicleCount: dailyVehicle ? String(dailyVehicle).trim() : undefined,
      dailyTrainCount: dailyTrain ? String(dailyTrain).trim() : undefined,
      clearanceWidth: clearance ? String(clearance).trim() : undefined,
      skewAngle: skewAngle ? String(skewAngle).trim() : undefined,
      intersectedTrackCount: intersectedTrack ? String(intersectedTrack).trim() : undefined,
      minSightDistance: minSight ? String(minSight).trim() : undefined,
      railwayGradient: railwayGradient ? String(railwayGradient).trim() : undefined,
      curveInfo: curveInfo ? String(curveInfo).trim() : undefined,
    };
  }

  let culvertDetails: any = undefined;
  if (category === 'culvert') {
    culvertDetails = {
      hatti: lineName || defaultLine,
      mihverKlm: kmValue || title,
      aciklikSerbest: normKeys['aciklikserbest'] ?? normKeys['aciklik'] ?? normKeys['açıklık'] ?? undefined,
      debuseYuksekligi: normKeys['debuseyuksekligi'] ?? normKeys['debuse'] ?? normKeys['debuşe'] ?? undefined,
      cinsi: normKeys['cinsi'] ?? normKeys['cins'] ?? normKeys['tur'] ?? undefined,
      bakimSefligi: normKeys['bakimsefligi'] ?? normKeys['seflik'] ?? undefined,
    };
  }

  return {
    id: `imp-${Date.now()}-${index}`,
    title,
    kmValue,
    lineName,
    locationDesc,
    category,
    lat: !isNaN(lat) ? lat : 0,
    lng: !isNaN(lng) ? lng : 0,
    description,
    levelCrossing,
    culvert: culvertDetails,
    notes: [],
    photos: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Parses binary Excel file (ArrayBuffer / Uint8Array) into Partial<RailwayPoint>[]
 */
export function parseExcelBuffer(
  buffer: ArrayBuffer | Uint8Array,
  defaultLine: string = 'Kayıtlı Demiryolu Hattı',
  forcedCategory?: RailwayPointCategory | 'auto'
): Partial<RailwayPoint>[] {
  try {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const allResults: Partial<RailwayPoint>[] = [];

    // Scan all sheets in workbook
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) continue;

      // Try reading as array of arrays to find header row (in case row 1 is a merged title like "TCDD HEMZEMİN GEÇİT LİSTESİ")
      const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' });
      if (!Array.isArray(rawData) || rawData.length === 0) continue;

      // Find which row has headers
      let headerRowIndex = 0;
      for (let r = 0; r < Math.min(rawData.length, 10); r++) {
        const row = rawData[r];
        if (!Array.isArray(row)) continue;
        const joined = row.map((c) => String(c || '').toLowerCase().replace(/[\s_.-]/g, '')).join(' ');
        if (
          joined.includes('km') ||
          joined.includes('gecit') ||
          joined.includes('geçit') ||
          joined.includes('enlem') ||
          joined.includes('lat') ||
          joined.includes('ad') ||
          joined.includes('baslik') ||
          joined.includes('başlık') ||
          joined.includes('kaplama') ||
          joined.includes('bariyer') ||
          joined.includes('menfez')
        ) {
          headerRowIndex = r;
          break;
        }
      }

      // Convert from detected header row
      const headers = (rawData[headerRowIndex] || []).map((h: any) => String(h || '').trim());
      for (let r = headerRowIndex + 1; r < rawData.length; r++) {
        const rowArr = rawData[r];
        if (!Array.isArray(rowArr) || rowArr.every((c) => c === '' || c === undefined || c === null)) continue;

        const rowObj: Record<string, any> = {};
        headers.forEach((h, colIdx) => {
          if (h) {
            rowObj[h] = rowArr[colIdx] ?? '';
          } else {
            rowObj[`col_${colIdx}`] = rowArr[colIdx] ?? '';
          }
        });

        const parsed = parseRowObject(rowObj, allResults.length, defaultLine, forcedCategory);
        if (parsed && (parsed.kmValue || parsed.title || parsed.lat !== 0 || parsed.lng !== 0)) {
          allResults.push(parsed);
        }
      }
    }

    return allResults;
  } catch (err) {
    console.error('Excel parse error:', err);
    return [];
  }
}

/**
 * Parses CSV text with headers (lat, lng, name/km, etc.)
 */
export function parseCSV(
  csvText: string,
  defaultLine: string = 'Kayıtlı Demiryolu Hattı',
  forcedCategory?: RailwayPointCategory | 'auto'
): Partial<RailwayPoint>[] {
  try {
    const workbook = XLSX.read(csvText, { type: 'string' });
    const firstSheetName = workbook.SheetNames[0];
    if (firstSheetName) {
      const worksheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
      if (Array.isArray(rows) && rows.length > 0) {
        const results: Partial<RailwayPoint>[] = [];
        rows.forEach((row, idx) => {
          const parsed = parseRowObject(row, idx, defaultLine, forcedCategory);
          if (parsed && (parsed.lat !== 0 || parsed.lng !== 0 || parsed.title)) {
            results.push(parsed);
          }
        });
        if (results.length > 0) return results;
      }
    }
  } catch {}

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
      const autoCat = guessCategory(`${title} ${description}`);
      const category: RailwayPointCategory =
        forcedCategory && forcedCategory !== 'auto' ? forcedCategory : autoCat;

      results.push({
        id: `csv-${Date.now()}-${i}`,
        title,
        kmValue,
        lineName,
        category,
        lat,
        lng,
        description,
        culvert:
          category === 'culvert'
            ? { hatti: lineName, mihverKlm: kmValue || title }
            : undefined,
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
        levelCrossing: p.levelCrossing || p.level_crossing || undefined,
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
        levelCrossing: p.levelCrossing || null,
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
  const placemarks = points.map((p) => {
    let crossingInfo = '';
    if (p.category === 'crossing' && p.levelCrossing) {
      const lc = p.levelCrossing;
      crossingInfo = `\n--- Hemzemin Geçit Özellikleri ---\nGeçit Tipi: ${lc.crossingType || '-'}\nKaplama Cinsi: ${lc.surfaceType || '-'}\n24s Ort. Taşıt: ${lc.dailyVehicleCount || '-'}\n24s Ort. Tren: ${lc.dailyTrainCount || '-'}\nAçıklık: ${lc.clearanceWidth || '-'}\nVerevlik Açısı: ${lc.skewAngle || '-'}\nKestiği Hat Adedi: ${lc.intersectedTrackCount || '-'}\nMin Görüş: ${lc.minSightDistance || '-'}\nEğim: ${lc.railwayGradient || '-'}\nKurp: ${lc.curveInfo || '-'}`;
    }
    return `
    <Placemark>
      <name><![CDATA[${p.title}]]></name>
      <description><![CDATA[Hat: ${p.lineName}\nKM: ${p.kmValue}\nMevki: ${p.locationDesc || '-'}\nAçıklama: ${p.description}${crossingInfo}\nNot Sayısı: ${p.notes?.length || 0}]]></description>
      <Point>
        <coordinates>${p.lng},${p.lat},0</coordinates>
      </Point>
    </Placemark>`;
  }).join('');

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
  let crossingHtml = '';
  if (point.category === 'crossing' && point.levelCrossing) {
    const lc = point.levelCrossing;
    crossingHtml = `<br/><br/><b>[Hemzemin Geçit Özellikleri]</b><br/>• <b>Geçit Tipi:</b> ${lc.crossingType || '-'}<br/>• <b>Kaplama Cinsi:</b> ${lc.surfaceType || '-'}<br/>• <b>24 Saat Taşıt Sayısı:</b> ${lc.dailyVehicleCount || '-'}<br/>• <b>24 Saat Tren Sayısı:</b> ${lc.dailyTrainCount || '-'}<br/>• <b>Açıklık:</b> ${lc.clearanceWidth || '-'}<br/>• <b>Verevlik Açısı:</b> ${lc.skewAngle || '-'}<br/>• <b>Kestiği Hat Adedi:</b> ${lc.intersectedTrackCount || '-'}<br/>• <b>Min. Görüş:</b> ${lc.minSightDistance || '-'}<br/>• <b>Eğim:</b> ${lc.railwayGradient || '-'}<br/>• <b>Kurp Bilgisi:</b> ${lc.curveInfo || '-'}`;
  }

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
      <description><![CDATA[<b>Hat:</b> ${point.lineName || '-'}<br/><b>KM:</b> ${point.kmValue || '-'}<br/><b>Mevki:</b> ${point.locationDesc || '-'}<br/><b>Açıklama:</b> ${point.description || '-'}${crossingHtml}<br/><b>Koordinat:</b> ${point.lat}, ${point.lng}]]></description>
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

/**
 * Exports railway points to Excel (.xlsx) file download
 */
export function exportToExcel(points: RailwayPoint[]) {
  const rows = points.map((p) => {
    const lc = p.levelCrossing || {};
    return {
      'Başlık': p.title,
      'KM': p.kmValue,
      'Hat Adı': p.lineName,
      'Mevki': p.locationDesc || '',
      'Kategori': p.category,
      'Enlem (Lat)': p.lat,
      'Boylam (Lng)': p.lng,
      'Açıklama': p.description || '',
      'Geçit Tipi': lc.crossingType || '',
      'Kaplama Cinsi': lc.surfaceType || '',
      '24 Saat Taşıt Sayısı': lc.dailyVehicleCount ?? '',
      '24 Saat Tren Sayısı': lc.dailyTrainCount ?? '',
      'Geçit Açıklığı (Genişlik)': lc.clearanceWidth || '',
      'Verevlik Açısı': lc.skewAngle || '',
      'Kestiği Hat Adedi': lc.intersectedTrackCount ?? '',
      'Min Görüş Mesafesi': lc.minSightDistance || '',
      'Demiryolu Eğimi (Binde)': lc.railwayGradient || '',
      'Kurp Bilgileri': lc.curveInfo || '',
      'Not Sayısı': p.notes?.length || 0,
      'Fotoğraf Sayısı': p.photos?.length || 0,
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Demiryolu Noktaları');

  XLSX.writeFile(workbook, `demiryolu_noktalar_${new Date().toISOString().slice(0, 10)}.xlsx`);
}


