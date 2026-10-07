import { RailwayPoint, RailwayParcel } from '../types.ts';
import { parseKmToNumber } from './kmUtils.ts';

/**
 * Resmi TKGM (Tapu ve Kadastro Genel Müdürlüğü) Parsel Sorgu Linki Üretici
 * Koordinat varsa veya İl/İlçe biliniyorsa doğrudan TKGM haritasını o noktaya odaklayarak açar (#ara/cografi/lat/lng).
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
  // 1. Doğrudan verilen koordinat
  if (
    typeof centerLat === 'number' &&
    typeof centerLng === 'number' &&
    !isNaN(centerLat) &&
    !isNaN(centerLng) &&
    centerLat !== 0 &&
    centerLng !== 0
  ) {
    return `https://parselsorgu.tkgm.gov.tr/#ara/cografi/${centerLat.toFixed(6)}/${centerLng.toFixed(6)}`;
  }

  // 2. İl / İlçe Yaklaşık Koordinat Eşleştirmesi (TKGM harita odağını doğru şehre açar)
  const queryText = `${il || ''} ${ilce || ''} ${mahalle || ''}`.toLowerCase();
  
  if (queryText.includes('alayunt') || (queryText.includes('kütahya') && queryText.includes('merkez'))) {
    return `https://parselsorgu.tkgm.gov.tr/#ara/cografi/39.421523/29.985641`;
  }
  if (queryText.includes('tavşanlı') || queryText.includes('tavsanli')) {
    return `https://parselsorgu.tkgm.gov.tr/#ara/cografi/39.544200/29.493100`;
  }
  if (queryText.includes('sivrihisar') || queryText.includes('dümrek') || queryText.includes('dumrek')) {
    return `https://parselsorgu.tkgm.gov.tr/#ara/cografi/39.450000/31.530000`;
  }
  if (queryText.includes('eskişehir') || queryText.includes('eskisehir') || queryText.includes('tepebaşı') || queryText.includes('odunpazarı')) {
    return `https://parselsorgu.tkgm.gov.tr/#ara/cografi/39.776700/30.520600`;
  }
  if (queryText.includes('bozüyük') || queryText.includes('bozuyuk') || queryText.includes('bilecik')) {
    return `https://parselsorgu.tkgm.gov.tr/#ara/cografi/39.742400/30.040200`;
  }
  if (queryText.includes('afyon') || queryText.includes('çetinkaya') || queryText.includes('cetinkaya')) {
    return `https://parselsorgu.tkgm.gov.tr/#ara/cografi/38.756900/30.538700`;
  }
  if (queryText.includes('polatlı') || queryText.includes('polatli') || queryText.includes('ankara')) {
    return `https://parselsorgu.tkgm.gov.tr/#ara/cografi/39.583300/32.133300`;
  }
  if (queryText.includes('balıkesir') || queryText.includes('balikesir')) {
    return `https://parselsorgu.tkgm.gov.tr/#ara/cografi/39.648400/27.882600`;
  }
  if (queryText.includes('konya') || queryText.includes('akşehir') || queryText.includes('aksehir')) {
    return `https://parselsorgu.tkgm.gov.tr/#ara/cografi/38.358600/31.416400`;
  }

  // Varsayılan: Demiryolu bölgesi (Kütahya / Alayunt ekseni)
  return 'https://parselsorgu.tkgm.gov.tr/#ara/cografi/39.421523/29.985641';
}

/**
 * TKGM ve Tapu Arama İçin Tek Satırlık ve Çok Satırlık Formatlı Metin Üretici
 */
export function generateTkgmClipboardSummary(
  il: string = '',
  ilce: string = '',
  mahalle: string = '',
  ada: string = '',
  parsel: string = ''
): { singleLine: string; multiLine: string } {
  const singleLine = `${il || 'İl'} / ${ilce || 'İlçe'} / ${mahalle || 'Mahalle'} | Ada: ${ada || '-'} | Parsel: ${parsel || '-'}`;
  const multiLine = `İl: ${il}\nİlçe: ${ilce}\nMahalle: ${mahalle}\nAda: ${ada}\nParsel: ${parsel}`;
  return { singleLine, multiLine };
}

/**
 * Akıllı Metin ve TKGM Bağlantı Ayrıştırıcı:
 * - TKGM URL'lerini (örn: https://parselsorgu.tkgm.gov.tr/#ara/cografi/39.4215/29.9856)
 * - TKGM detay tablosunu
 * - Serbest metinleri (örn: "Kütahya Merkez Alayunt Ada 104 Parsel 1 30000 m2")
 * - 104/1 veya 104-1 yazımlarını
 * - Dönüm / Hektar / m² alanlarını
 * - Koordinat çiftlerini (39.4215, 29.9856)
 * - Demiryolu KM ve Malik bilgilerini
 * otomatik olarak ayrıştırıp form alanlarına uygun şekilde doldurur.
 */
export function parseRawParcelText(text: string): Partial<RailwayParcel> & { detectedLat?: number; detectedLng?: number } {
  if (!text || typeof text !== 'string') return {};
  const trimmed = text.trim();
  const cleaned = trimmed.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ');
  const result: Partial<RailwayParcel> & { detectedLat?: number; detectedLng?: number } = {};

  // 1. TKGM Cografi URL Ayrıştırması (#ara/cografi/lat/lng)
  const tkgmGeoUrlMatch = trimmed.match(/parselsorgu\.tkgm\.gov\.tr\/#ara\/cografi\/([0-9.]+)\/([0-9.]+)/i) ||
                          trimmed.match(/#ara\/cografi\/([0-9.]+)\/([0-9.]+)/i);
  if (tkgmGeoUrlMatch) {
    const lat = parseFloat(tkgmGeoUrlMatch[1]);
    const lng = parseFloat(tkgmGeoUrlMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      result.detectedLat = lat;
      result.detectedLng = lng;
      result.coordinates = [[lat, lng]];
    }
  }

  // Koordinat çifti çıkarımı (Örn: "39.421523, 29.985641" veya "39.421523 29.985641")
  if (!result.detectedLat) {
    const coordPairMatch = cleaned.match(/\b(3[6-9]\.[0-9]{4,8}|4[0-2]\.[0-9]{4,8})[\s,;]+(2[6-9]\.[0-9]{4,8}|3[0-9]\.[0-9]{4,8}|4[0-5]\.[0-9]{4,8})\b/);
    if (coordPairMatch) {
      const lat = parseFloat(coordPairMatch[1]);
      const lng = parseFloat(coordPairMatch[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        result.detectedLat = lat;
        result.detectedLng = lng;
        result.coordinates = [[lat, lng]];
      }
    }
  }

  // 2. Ada ve Parsel Çıkarımı
  // Örn: "Ada: 104 Parsel: 1", "104 Ada 1 Parsel", "Ada 104 Parsel 1", "104/1", "104 - 1", "Ada/Parsel: 104/1"
  const adaParselColonMatch = cleaned.match(/ada[\s:]*([0-9]+)[\s,;|/]+parsel[\s:]*([0-9]+)/i) ||
                              cleaned.match(/([0-9]+)\s*ada[\s,;|/]+([0-9]+)\s*parsel/i);
  if (adaParselColonMatch) {
    result.adaNo = adaParselColonMatch[1];
    result.parselNo = adaParselColonMatch[2];
  } else {
    // 104/1 veya 104 / 1 veya Ada/Parsel: 104/1
    const slashMatch = cleaned.match(/(?:ada\/parsel|ada\s*-\s*parsel)?\s*[:\s]*\b([0-9]{1,6})\s*[\/|\-]\s*([0-9]{1,6})\b/i);
    if (slashMatch) {
      result.adaNo = slashMatch[1];
      result.parselNo = slashMatch[2];
    } else {
      const singleAdaMatch = cleaned.match(/(?:ada\s*no|ada)[\s:]*([0-9]+)/i);
      if (singleAdaMatch) result.adaNo = singleAdaMatch[1];

      const singleParselMatch = cleaned.match(/(?:parsel\s*no|parsel)[\s:]*([0-9]+)/i);
      if (singleParselMatch) result.parselNo = singleParselMatch[1];
    }
  }

  // 3. Yüzölçümü / Alan (m² / Dönüm / Hektar) Çıkarımı
  // Örn: "30.000 m2", "30000,50 m²", "Alan: 30000", "Yüzölçümü: 35.120 m2", "15 dönüm", "2.5 hektar"
  const donumMatch = cleaned.match(/([0-9]+(?:[.,][0-9]+)?)\s*(?:dönüm|donum|dekar)\b/i);
  const hektarMatch = cleaned.match(/([0-9]+(?:[.,][0-9]+)?)\s*(?:hektar|ha)\b/i);
  const m2Match = cleaned.match(/(?:yüzölçüm[ü]?|yuzolcumu|alan|m2|m²)[\s:]*([0-9]{1,3}(?:\.[0-9]{3})+(?:,[0-9]+)?|[0-9]{2,9}(?:[.,][0-9]+)?)\s*(?:m2|m²)?/i) ||
                  cleaned.match(/([0-9]{1,3}(?:\.[0-9]{3})+(?:,[0-9]+)?|[0-9]{2,9}(?:[.,][0-9]+)?)\s*(?:m2|m²)/i);

  if (donumMatch) {
    const dVal = parseFloat(donumMatch[1].replace(',', '.'));
    if (!isNaN(dVal) && dVal > 0) result.alanM2 = Math.round(dVal * 1000);
  } else if (hektarMatch) {
    const hVal = parseFloat(hektarMatch[1].replace(',', '.'));
    if (!isNaN(hVal) && hVal > 0) result.alanM2 = Math.round(hVal * 10000);
  } else if (m2Match) {
    const rawNum = m2Match[1].replace(/\./g, '').replace(',', '.');
    const parsedArea = parseFloat(rawNum);
    if (!isNaN(parsedArea) && parsedArea > 0) {
      result.alanM2 = Math.round(parsedArea);
    }
  }

  // 4. Pafta No Çıkarımı (Örn: "Pafta: K28-d-04-c" veya "Pafta No: 14" veya "K28d04c")
  const paftaMatch = cleaned.match(/pafta[\s:no]*([A-Za-z0-9\-_]+)/i);
  if (paftaMatch && !/^(ve|ile|no)$/i.test(paftaMatch[1])) {
    result.paftaNo = paftaMatch[1];
  }

  // 5. İl ve İlçe Tespiti
  const cityDistrictMap: { city: string; districts: string[] }[] = [
    { city: 'Kütahya', districts: ['Merkez', 'Alayunt', 'Tavşanlı', 'Gediz', 'Simav', 'Emet', 'Altıntaş', 'Dumlupınar', 'Hisarcık', 'Aslanapa', 'Çavdarhisar', 'Pazarlar', 'Şaphane'] },
    { city: 'Eskişehir', districts: ['Tepebaşı', 'Odunpazarı', 'Sivrihisar', 'İnönü', 'Seyitgazi', 'Çifteler', 'Mahmudiye', 'Alpu', 'Beylikova', 'Mihalıççık', 'Sarıcakaya', 'Günyüzü', 'Han', 'Mihalgazi'] },
    { city: 'Afyonkarahisar', districts: ['Merkez', 'Sandıklı', 'Dinar', 'Bolvadin', 'Emirdağ', 'Çay', 'İhsaniye', 'Şuhut', 'Sinanpaşa', 'Döğer', 'Bayat', 'Çobanlar', 'Evciler', 'Hocalar', 'Kızılören', 'Sultandağı'] },
    { city: 'Bilecik', districts: ['Merkez', 'Bozüyük', 'Osmaneli', 'Söğüt', 'Pazaryeri', 'Gölpazarı', 'İnhisar', 'Yenipazar'] },
    { city: 'Balıkesir', districts: ['Merkez', 'Altıeylül', 'Karesi', 'Bandırma', 'Edremit', 'Gönen', 'Ayvalık', 'Burhaniye', 'Bigadiç', 'Dursunbey', 'Susurluk', 'Sındırgı', 'İvrindi', 'Havran', 'Kepsut', 'Manyas', 'Savaştepe', 'Balya', 'Gömeç', 'Marmara'] },
    { city: 'Manisa', districts: ['Merkez', 'Yunusemre', 'Şehzadeler', 'Akhisar', 'Turgutlu', 'Salihli', 'Soma', 'Alaşehir', 'Saruhanlı', 'Kula', 'Demirci', 'Kırkağaç', 'Gördes', 'Sarıgöl', 'Selendi', 'Ahmetli', 'Gölmarmara', 'Köprübaşı'] },
    { city: 'İzmir', districts: ['Konak', 'Karşıyaka', 'Bornova', 'Buca', 'Çiğli', 'Gaziemir', 'Menemen', 'Torbalı', 'Aliağa', 'Ödemiş', 'Kemalpaşa', 'Bergama', 'Tire', 'Bayındır', 'Selçuk', 'Menderes'] },
    { city: 'Ankara', districts: ['Çankaya', 'Keçiören', 'Yenimahalle', 'Mamak', 'Etimesgut', 'Sincan', 'Altındağ', 'Pursaklar', 'Gölbaşı', 'Polatlı', 'Çubuk', 'Kahramankazan', 'Beypazarı', 'Elmadağ', 'Nallıhan', 'Haymana', 'Kızılcahamam'] },
    { city: 'Konya', districts: ['Selçuklu', 'Meram', 'Karatay', 'Ereğli', 'Akşehir', 'Beyşehir', 'Çumra', 'Seydişehir', 'Ilgın', 'Cihanbeyli', 'Kulu', 'Karapınar', 'Kadınhanı', 'Sarayönü', 'Bozkır', 'Yunak', 'Doğanhisar', 'Hüyük'] },
    { city: 'Uşak', districts: ['Merkez', 'Banaz', 'Eşme', 'Sivaslı', 'Ulubey', 'Karahallı'] },
    { city: 'İstanbul', districts: ['Kadıköy', 'Üsküdar', 'Bakırköy', 'Tuzla', 'Pendik', 'Kartal', 'Maltepe', 'Küçükçekmece', 'Büyükçekmece', 'Başakşehir', 'Silivri', 'Çatalca'] },
    { city: 'Kocaeli', districts: ['İzmit', 'Gebze', 'Darıca', 'Körfez', 'Gölcük', 'Derince', 'Çayırova', 'Kartepe', 'Başiskele', 'Karamürsel', 'Kandıra', 'Dilovası'] },
    { city: 'Sakarya', districts: ['Adapazarı', 'Serdivan', 'Erenler', 'Arifiye', 'Akyazı', 'Hendek', 'Karasu', 'Geyve', 'Pamukova', 'Sapanca', 'Kocaali', 'Ferizli', 'Kaynarca', 'Söğütlü', 'Karapürçek', 'Taraklı'] },
  ];

  // İl Tespiti
  for (const item of cityDistrictMap) {
    const cityRegex = new RegExp(`\\b(${item.city}|${item.city.toLowerCase()})\\b`, 'i');
    if (cityRegex.test(cleaned)) {
      result.il = item.city;
      break;
    }
  }

  // İlçe Tespiti
  for (const item of cityDistrictMap) {
    for (const dist of item.districts) {
      const distRegex = new RegExp(`\\b${dist}\\b`, 'i');
      if (distRegex.test(cleaned)) {
        result.ilce = dist;
        if (!result.il) result.il = item.city;
        break;
      }
    }
    if (result.ilce) break;
  }

  // 6. Mahalle / Köy Tespiti
  const mahalleExplicit = cleaned.match(/(?:mahalle(?:si)?|mah\.|köy(?:ü)?|koyu)[\s:]*([A-Za-zÇĞİÖŞÜçğıöşü0-9\s]+?)(?:ada|parsel|alan|pafta|cilt|\d{3,}|$)/i) ||
                          cleaned.match(/([A-Za-zÇĞİÖŞÜçğıöşü\s]{3,35})\s*(?:mahallesi|mah\.|köyü|koyu)/i);
  if (mahalleExplicit) {
    const mName = mahalleExplicit[1].trim();
    if (mName && mName.length > 1 && !/^(ada|parsel|alan|pafta|tcdd|malik)$/i.test(mName)) {
      result.mahalleKoy = mName;
    }
  }

  // 7. Demiryolu Hattı ve KM Tespiti
  const kmMatch = cleaned.match(/(?:km|kilometre)[\s:]*([0-9]+(?:[\+\.][0-9]+)?)/i) ||
                  cleaned.match(/\b([0-9]{1,3}\+[0-9]{3})\b/);
  if (kmMatch) {
    const rawKm = kmMatch[1].replace('+', '.');
    result.startKm = kmMatch[1];
    result.endKm = kmMatch[1];
  }

  // 8. Nitelik / Cins Tespiti
  const nitelikMatch = cleaned.match(/(?:nitelik|cinsi|cins)[\s:]*([A-Za-zÇĞİÖŞÜçğıöşü0-9\s]+?)(?:malik|sahibi|alan|pafta|ada|$)/i);
  if (nitelikMatch) {
    result.nitelik = nitelikMatch[1].trim();
  } else if (/demiryolu|istasyon|hat\s*boyu|müştemilat|makas/i.test(cleaned)) {
    result.nitelik = 'Demiryolu Güzergahı ve Müştemilatı';
  } else if (/tarla/i.test(cleaned)) {
    result.nitelik = 'Tarla';
  } else if (/arsa/i.test(cleaned)) {
    result.nitelik = 'Arsa';
  }

  // 9. Malik / Mülkiyet Sahibi Tespiti
  const malikMatch = cleaned.match(/(?:malik|sahibi|mülkiyet)[\s:]*([A-Za-zÇĞİÖŞÜçğıöşü0-9\.\s]+?)(?:nitelik|cinsi|alan|pafta|ada|$)/i);
  if (malikMatch) {
    result.malik = malikMatch[1].trim();
  } else if (/tcdd|devlet\s*demiryollar/i.test(cleaned)) {
    result.malik = 'TCDD İşletmesi Genel Müdürlüğü';
    result.ownershipStatus = 'tcdd';
  } else if (/maliye|hazine/i.test(cleaned)) {
    result.malik = 'Maliye Hazinesi (TCDD Tahsisli)';
    result.ownershipStatus = 'treasury';
  }

  return result;
}

/**
 * Verilen koordinata (Lat, Lng) en yakın demiryolu noktasını bularak
 * Hat, KM ve otomatik idari konum (İl/İlçe/Mahalle) bilgilerini türetir
 */
export function findNearestRailwayInfoForCoords(
  lat: number,
  lng: number,
  points: RailwayPoint[]
): {
  nearestPoint?: RailwayPoint;
  distanceMeters: number;
  chainageKm?: string;
  lineName?: string;
  il: string;
  ilce: string;
  mahalleKoy: string;
} {
  let defaultIl = 'Kütahya';
  let defaultIlce = 'Merkez';
  let defaultMahalle = 'Alayunt';
  let defaultLine = 'Alayunt - Kütahya';

  if (!points || points.length === 0) {
    return {
      distanceMeters: 0,
      il: defaultIl,
      ilce: defaultIlce,
      mahalleKoy: defaultMahalle,
      lineName: defaultLine,
    };
  }

  let minDistance = Infinity;
  let closestPt: RailwayPoint | undefined;

  for (const pt of points) {
    const dLat = (pt.lat - lat) * 111132;
    const dLng = (pt.lng - lng) * 111132 * Math.cos((lat * Math.PI) / 180);
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    if (dist < minDistance) {
      minDistance = dist;
      closestPt = pt;
    }
  }

  if (closestPt) {
    const loc = extractLocationFromPoint(closestPt);
    return {
      nearestPoint: closestPt,
      distanceMeters: Math.round(minDistance),
      chainageKm: closestPt.kmValue || (closestPt.title.match(/KM\s*([0-9+.]+)/i)?.[1] ?? undefined),
      lineName: closestPt.lineName || defaultLine,
      il: loc.il,
      ilce: loc.ilce,
      mahalleKoy: loc.mahalleKoy,
    };
  }

  return {
    distanceMeters: 0,
    il: defaultIl,
    ilce: defaultIlce,
    mahalleKoy: defaultMahalle,
    lineName: defaultLine,
  };
}

/**
 * Demiryolu noktasından il, ilçe ve mahalle bilgilerini ayıklar
 */
export function extractLocationFromPoint(point: RailwayPoint): {
  il: string;
  ilce: string;
  mahalleKoy: string;
} {
  let il = 'Kütahya';
  let ilce = 'Merkez';
  let mahalleKoy = 'Alayunt';

  const fullText = `${point.lineName || ''} ${point.title || ''} ${point.description || ''}`;

  if (/eskişehir|eskisehir/i.test(fullText)) {
    il = 'Eskişehir';
    ilce = 'Sivrihisar';
    mahalleKoy = 'Dümrek';
  } else if (/afyon/i.test(fullText)) {
    il = 'Afyonkarahisar';
    ilce = 'Merkez';
    mahalleKoy = 'Ali Çetinkaya';
  } else if (/bilecik|bozüyük|bozuyuk/i.test(fullText)) {
    il = 'Bilecik';
    ilce = 'Bozüyük';
    mahalleKoy = 'Merkez';
  } else if (/balıkesir|balikesir/i.test(fullText)) {
    il = 'Balıkesir';
    ilce = 'Merkez';
    mahalleKoy = 'Gündoğan';
  } else if (/ankara|sincan|polatlı|polatli/i.test(fullText)) {
    il = 'Ankara';
    ilce = 'Polatlı';
    mahalleKoy = 'İstasyon';
  } else if (/tavşanlı|tavsanli/i.test(fullText)) {
    il = 'Kütahya';
    ilce = 'Tavşanlı';
    mahalleKoy = 'İstasyon';
  }

  // Başlıkta istasyon adı veya mahalle adı varsa
  if (point.title) {
    const cleanTitle = point.title.replace(/^KM\s*[\d+.]+\s*[-–]?\s*/i, '').trim();
    if (cleanTitle && cleanTitle.length > 2 && !cleanTitle.startsWith('KM')) {
      mahalleKoy = cleanTitle;
    }
  }

  return { il, ilce, mahalleKoy };
}

/**
 * Poligonun ağırlık merkezini (Centroid) hesaplar
 */
export function calculateParcelCenter(coords: [number, number][]): [number, number] {
  if (!coords || coords.length === 0) return [39.4215, 29.9856]; // default Alayunt/Kütahya
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
export function parseKmlOrGeoJsonParcels(fileContent: string): Partial<RailwayParcel>[] {
  if (!fileContent || typeof fileContent !== 'string') return [];
  const trimmed = fileContent.trim();
  const results: Partial<RailwayParcel>[] = [];

  // A. GeoJSON Taraması
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsedJson = JSON.parse(trimmed);
      const features = parsedJson.type === 'FeatureCollection' ? parsedJson.features : [parsedJson];

      for (const feat of features) {
        if (!feat || !feat.geometry) continue;
        const geom = feat.geometry;
        const props = feat.properties || {};

        let coords: [number, number][] = [];
        if (geom.type === 'Polygon' && Array.isArray(geom.coordinates?.[0])) {
          coords = geom.coordinates[0].map((c: any) => [c[1], c[0]]);
        } else if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates?.[0]?.[0])) {
          coords = geom.coordinates[0][0].map((c: any) => [c[1], c[0]]);
        }

        if (coords.length >= 3) {
          const area = calculateParcelArea(coords);
          results.push({
            adaNo: String(props.ada || props.adaNo || props.ADA || '101'),
            parselNo: String(props.parsel || props.parselNo || props.PARSEL || '1'),
            il: props.il || 'Kütahya',
            ilce: props.ilce || 'Merkez',
            mahalleKoy: props.mahalle || props.mahalleKoy || props.MAHALLE || 'Alayunt',
            paftaNo: props.pafta || props.paftaNo || '',
            nitelik: props.nitelik || 'Demiryolu Güzergahı',
            alanM2: props.alanM2 || area || 25000,
            malik: props.malik || 'TCDD İşletmesi Genel Müdürlüğü',
            ownershipStatus: 'tcdd',
            coordinates: coords,
            notes: props.notes || 'GeoJSON İçe Aktarımı',
          });
        }
      }

      if (results.length > 0) return results;
    } catch {
      // GeoJSON parse olmadı, KML ile devam et
    }
  }

  // B. KML XML Taraması (TKGM KML formatı ve standart KML)
  try {
    const placemarkMatches = trimmed.match(/<Placemark[\s\S]*?<\/Placemark>/gi);
    if (placemarkMatches && placemarkMatches.length > 0) {
      for (let i = 0; i < placemarkMatches.length; i++) {
        const pm = placemarkMatches[i];
        const nameMatch = pm.match(/<name>([\s\S]*?)<\/name>/i);
        const name = nameMatch ? nameMatch[1].trim() : `Parsel ${i + 1}`;

        // ExtendedData & SimpleData & HTML Table (TKGM resmi formatı)
        const getSimpleData = (keyName: string) => {
          const reg = new RegExp(`<SimpleData\\s+name=["']${keyName}["']>([\\s\\S]*?)<\\/SimpleData>`, 'i');
          const m = pm.match(reg);
          return m ? m[1].trim() : null;
        };

        const getDescField = (label: string) => {
          // 1. Table format: <td>Ada</td><td>146</td> or <th>Ada</th><td>146</td>
          const tableReg = new RegExp(`<(?:td|th)[^>]*>[\\s]*${label}[^<]*<\\/(?:td|th)>[\\s]*<td[^>]*>([\\s\\S]*?)<\\/td>`, 'i');
          const tableMatch = pm.match(tableReg);
          if (tableMatch) {
            return tableMatch[1].replace(/<[^>]+>/g, '').trim();
          }

          // 2. Bold/colon format: <b>Ada:</b> 146 or Ada : 146
          const reg = new RegExp(`${label}[\\s:]*<[a-z]+[^>]*>([\\s\\S]*?)<\\/[a-z]+>|${label}[\\s:]*([^<\\n,;]+)`, 'i');
          const m = pm.match(reg);
          return m ? (m[1] || m[2] || '').replace(/<[^>]+>/g, '').trim() : null;
        };

        // Koordinatları çek
        const coordMatch = pm.match(/<coordinates>([\s\S]*?)<\/coordinates>/i);
        if (coordMatch) {
          const rawCoordText = coordMatch[1].trim();
          const tupleStrings = rawCoordText.split(/\s+/);
          const coords: [number, number][] = [];

          for (const tuple of tupleStrings) {
            const parts = tuple.split(',');
            if (parts.length >= 2) {
              const lng = parseFloat(parts[0]);
              const lat = parseFloat(parts[1]);
              if (!isNaN(lat) && !isNaN(lng) && lat !== 0) {
                coords.push([lat, lng]);
              }
            }
          }

          if (coords.length >= 3) {
            const area = calculateParcelArea(coords);

            // Ada ve Parsel no tespiti
            let ada = getSimpleData('ADA') || getSimpleData('ada') || getDescField('Ada') || '';
            let parsel = getSimpleData('PARSEL') || getSimpleData('parsel') || getDescField('Parsel') || '';

            if (!ada || !parsel) {
              const adaParselMatch = name.match(/Ada[:\s]*(\d+)[^\d]+Parsel[:\s]*(\d+)/i) ||
                                     name.match(/(\d+)\s*ada\s*(\d+)\s*parsel/i) ||
                                     name.match(/(\d+)\s*[\/|\-]\s*(\d+)/);
              if (adaParselMatch) {
                if (!ada) ada = adaParselMatch[1];
                if (!parsel) parsel = adaParselMatch[2];
              }
            }

            if (!ada) ada = '101';
            if (!parsel) parsel = String(i + 1);

            const il = getSimpleData('IL') || getSimpleData('il') || getDescField('İl') || 'Kütahya';
            const ilce = getSimpleData('ILCE') || getSimpleData('ilce') || getDescField('İlçe') || 'Merkez';
            const mahalle = getSimpleData('MAHALLE') || getSimpleData('mahalle') || getDescField('Mahalle') || getDescField('Köy') || 'Alayunt';
            const pafta = getSimpleData('PAFTA') || getSimpleData('pafta') || getDescField('Pafta') || '';
            const nitelik = getSimpleData('NITELIK') || getSimpleData('nitelik') || getDescField('Nitelik') || 'Demiryolu Güzergahı';
            const alanRaw = getSimpleData('ALAN') || getSimpleData('alan') || getDescField('Alan') || '';
            const malik = getSimpleData('MALIK') || getSimpleData('malik') || getDescField('Malik') || 'TCDD İşletmesi Genel Müdürlüğü';

            let alanM2 = area;
            if (alanRaw) {
              const num = parseFloat(alanRaw.replace(/\./g, '').replace(',', '.'));
              if (!isNaN(num) && num > 0) alanM2 = Math.round(num);
            }

            results.push({
              adaNo: ada,
              parselNo: parsel,
              il,
              ilce,
              mahalleKoy: mahalle,
              paftaNo: pafta,
              nitelik,
              alanM2: alanM2 || 25000,
              malik,
              ownershipStatus: 'tcdd',
              coordinates: coords,
              notes: name !== `${ada}/${parsel}` ? `${name} (TKGM KML)` : 'TKGM KML İçe Aktarımı',
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn('KML parse hatası:', err);
  }

  return results;
}

/**
 * Demiryolu parsellerini Google Earth / Netcad / CBS uyumlu KML formatına çevirir
 */
export function exportParcelsToKml(parcels: RailwayParcel[]): string {
  const placemarks = parcels
    .map((p) => {
      const coords = p.coordinates || [];
      const hasPolygon = coords.length >= 3;

      let geometryKml = '';
      if (hasPolygon) {
        const coordString = coords
          .map(([lat, lng]) => `${lng.toFixed(6)},${lat.toFixed(6)},0`)
          .join(' ');

        geometryKml = `
      <Polygon>
        <extrude>1</extrude>
        <altitudeMode>clampToGround</altitudeMode>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${coordString}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>`;
      } else {
        const center = calculateParcelCenter(coords);
        geometryKml = `
      <Point>
        <coordinates>${center[1].toFixed(6)},${center[0].toFixed(6)},0</coordinates>
      </Point>`;
      }

      return `
    <Placemark>
      <name>Ada ${p.adaNo} / Parsel ${p.parselNo} - ${p.mahalleKoy || p.lineName || 'Demiryolu Arazisi'}</name>
      <description><![CDATA[
        <b>İl/İlçe:</b> ${p.il || '-'} / ${p.ilce || '-'}<br/>
        <b>Mahalle/Köy:</b> ${p.mahalleKoy || '-'}<br/>
        <b>Ada/Parsel:</b> ${p.adaNo}/${p.parselNo}<br/>
        <b>Alan:</b> ${p.alanM2 ? p.alanM2.toLocaleString('tr-TR') + ' m²' : '-'}<br/>
        <b>Malik:</b> ${p.malik || 'TCDD'}<br/>
        <b>Mülkiyet:</b> ${p.ownershipStatus === 'tcdd' ? 'TCDD Tescilli' : p.ownershipStatus === 'treasury' ? 'Maliye Hazinesi' : 'Kamulaştırma'}<br/>
        <b>KM Aralığı:</b> ${p.startKm || '-'} - ${p.endKm || '-'}<br/>
        <b>Hat:</b> ${p.lineName || '-'}<br/>
        <b>Notlar:</b> ${p.notes || '-'}
      ]]></description>
      <Style>
        <LineStyle>
          <color>${p.ownershipStatus === 'tcdd' ? 'ffb82e93' : p.ownershipStatus === 'treasury' ? 'ff0284c7' : 'ff059669'}</color>
          <width>2.5</width>
        </LineStyle>
        <PolyStyle>
          <color>${p.ownershipStatus === 'tcdd' ? '40b82e93' : p.ownershipStatus === 'treasury' ? '400284c7' : '40059669'}</color>
        </PolyStyle>
      </Style>
      ${geometryKml}
    </Placemark>`;
    })
    .filter(Boolean)
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

