import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { RailwayPoint, LevelCrossingDetails, PointPhoto } from '../types.ts';

export interface ExcelExtractionResult {
  matchedCrossingsCount: number;
  extractedPhotosCount: number;
  details: {
    pointId: string;
    km: string;
    title: string;
    fieldsUpdated: string[];
    photosAdded: number;
  }[];
  unmatchedRows: any[];
}

/**
 * Standardize KM strings like "54+635", "54 + 635", "54.635", "54-635", "KM 54+635"
 */
export function normalizeKmString(kmText?: string | number | null): string {
  if (kmText === undefined || kmText === null) return '';
  const str = String(kmText).trim();
  const plusMatch = str.match(/(\d{1,4})\s*[\+\-]\s*(\d{1,4})/);
  if (plusMatch) {
    return `${parseInt(plusMatch[1], 10)}+${plusMatch[2].padStart(3, '0')}`;
  }
  const dotMatch = str.match(/(\d{1,4})[.,](\d{3})/);
  if (dotMatch) {
    return `${parseInt(dotMatch[1], 10)}+${dotMatch[2]}`;
  }
  const num = parseFloat(str.replace(',', '.'));
  if (!isNaN(num) && num > 0) {
    const km = Math.floor(num);
    const m = Math.round((num - km) * 1000);
    return `${km}+${String(m).padStart(3, '0')}`;
  }
  return str.replace(/^(?:km\s*[:.-]?\s*)/i, '').trim();
}

/**
 * Parse KM numeric float for comparison
 */
export function parseKmNumeric(kmStr?: string | null): number | null {
  if (!kmStr) return null;
  const match = String(kmStr).match(/(\d{1,4})\s*[\+\-]\s*(\d{1,4})/);
  if (match) {
    return parseInt(match[1], 10) + parseInt(match[2], 10) / 1000;
  }
  const num = parseFloat(String(kmStr).replace(',', '.'));
  return isNaN(num) ? null : num;
}

/**
 * Checks if two KM values refer to the same location
 */
export function isSameKm(kmA?: string | null, kmB?: string | null): boolean {
  if (!kmA || !kmB) return false;
  const normA = normalizeKmString(kmA);
  const normB = normalizeKmString(kmB);
  if (normA && normB && normA.toLowerCase() === normB.toLowerCase()) return true;

  const numA = parseKmNumeric(kmA);
  const numB = parseKmNumeric(kmB);
  if (numA !== null && numB !== null) {
    return Math.abs(numA - numB) < 0.005; // Within 5 meters
  }
  return false;
}

/**
 * Extracts all drawings and image relationships from xl/drawings/ and xl/worksheets/_rels/
 * Maps sheet index or sheet name to its embedded photos!
 */
export async function extractPhotosPerSheet(zip: JSZip): Promise<Map<string, string[]>> {
  const sheetPhotosMap = new Map<string, string[]>(); // sheet_1 -> dataUrls

  try {
    // 1. First, load all media files into memory
    const mediaFiles = new Map<string, string>(); // 'image1.png' -> 'data:image/png;base64,...'
    for (const [path, file] of Object.entries(zip.files)) {
      if (path.startsWith('xl/media/') && !file.dir) {
        const ext = path.split('.').pop()?.toLowerCase() || 'jpeg';
        const mime = ext === 'png' ? 'image/png' : (ext === 'webp' ? 'image/webp' : 'image/jpeg');
        const b64 = await file.async('base64');
        const dataUrl = `data:${mime};base64,${b64}`;
        const fileName = path.split('/').pop() || path;
        mediaFiles.set(fileName, dataUrl);
        mediaFiles.set(path, dataUrl);
      }
    }

    // 2. Read drawings rels: xl/drawings/_rels/drawing1.xml.rels
    const drawingRels = new Map<string, string[]>(); // 'drawing1.xml' -> [mediaDataUrls]
    for (const [path, file] of Object.entries(zip.files)) {
      if (path.startsWith('xl/drawings/_rels/drawing') && path.endsWith('.xml.rels')) {
        const drawingName = path.replace('xl/drawings/_rels/', '').replace('.rels', '');
        const relsText = await file.async('text');
        const urls: string[] = [];

        const matches = Array.from(relsText.matchAll(/Target=["'](?:\.\.\/media\/|media\/)([^"']+)["']/g));
        for (const m of matches) {
          const imgName = m[1];
          const dataUrl = mediaFiles.get(imgName);
          if (dataUrl) {
            urls.push(dataUrl);
          }
        }
        if (urls.length > 0) {
          drawingRels.set(drawingName, urls);
        }
      }
    }

    // 3. Associate sheets to drawings: xl/worksheets/_rels/sheetX.xml.rels
    for (const [path, file] of Object.entries(zip.files)) {
      if (path.startsWith('xl/worksheets/_rels/sheet') && path.endsWith('.xml.rels')) {
        const sheetFileNum = path.replace('xl/worksheets/_rels/sheet', '').replace('.xml.rels', '');
        const relsText = await file.async('text');

        const drawingMatches = Array.from(relsText.matchAll(/Target=["'](?:\.\.\/drawings\/|drawings\/)([^"']+)["']/g));
        const sheetUrls: string[] = [];
        for (const dm of drawingMatches) {
          const dName = dm[1];
          const dUrls = drawingRels.get(dName);
          if (dUrls) {
            sheetUrls.push(...dUrls);
          }
        }

        const mediaMatches = Array.from(relsText.matchAll(/Target=["'](?:\.\.\/media\/|media\/)([^"']+)["']/g));
        for (const mm of mediaMatches) {
          const mName = mm[1];
          const dataUrl = mediaFiles.get(mName);
          if (dataUrl) sheetUrls.push(dataUrl);
        }

        if (sheetUrls.length > 0) {
          sheetPhotosMap.set(`sheet_${sheetFileNum}`, sheetUrls);
        }
      }
    }
  } catch (err) {
    console.warn('Excel çizim ve resim ilişkileri taranırken hata:', err);
  }

  return sheetPhotosMap;
}

/**
 * Filter out TCDD logo image (usually small or identical across all sheets)
 */
function filterOutCommonLogo(photos: string[], allSheetPhotos: string[][]): string[] {
  if (photos.length <= 1) return photos;
  if (allSheetPhotos.length > 2) {
    return photos.filter((p) => {
      let occurrenceCount = 0;
      for (const list of allSheetPhotos) {
        if (list.includes(p)) occurrenceCount++;
      }
      return occurrenceCount < allSheetPhotos.length * 0.7;
    });
  }
  return photos;
}

/**
 * Extracts form field data from a TCDD Hemzemin Geçit sheet
 * Specifically handles the fixed layout of "712 geçit listesi.xlsx"
 */
export function extractDataFromTcddSheet(sheet: XLSX.WorkSheet, sheetName: string): {
  detectedKm: string;
  lineName?: string;
  subeSefligi?: string;
  bulunduguIl?: string;
  nereleriBagladigi?: string;
  roadBelonging?: string;
  details: LevelCrossingDetails;
} {
  const cellStrings: { row: number; col: number; text: string; raw: any }[] = [];
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:BZ70');

  // Also build quick coordinate lookup
  const cellMap = new Map<string, string>(); // "R,C" -> text

  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = sheet[cellAddress];
      if (cell && cell.v !== undefined && cell.v !== null) {
        const strVal = String(cell.v).trim();
        if (strVal !== '') {
          cellStrings.push({
            row: R,
            col: C,
            text: strVal,
            raw: cell.v,
          });
          cellMap.set(`${R},${C}`, strVal);
        }
      }
    }
  }

  // 1. KM: Either from Sheet Name (e.g. "54+635") or from "Km : 54+635" cell
  let detectedKm = '';
  const kmFromSheetName = sheetName.match(/\b\d{1,4}\s*[\+\-]\s*\d{1,4}\b/)?.[0] || '';
  if (kmFromSheetName) {
    detectedKm = normalizeKmString(kmFromSheetName);
  }

  if (!detectedKm) {
    const kmCell = cellStrings.find((c) => /km\s*[:.-]?\s*\d{1,4}\s*[\+\-]\s*\d{1,4}/i.test(c.text));
    if (kmCell) {
      const m = kmCell.text.match(/\d{1,4}\s*[\+\-]\s*\d{1,4}/);
      if (m) detectedKm = normalizeKmString(m[0]);
    }
  }

  if (!detectedKm) {
    const plusCell = cellStrings.find((c) => /^\d{1,4}\s*[\+\-]\s*\d{1,4}$/.test(c.text));
    if (plusCell) detectedKm = normalizeKmString(plusCell.text);
  }

  // 2. Hat Adı
  let lineName = '';
  const hattiHeader = cellStrings.find(
    (c) => c.col < 20 && c.row < 10 && c.text.toUpperCase() === 'HATTI'
  );
  if (hattiHeader) {
    // Cell above or below "HATTI"
    const valAbove = cellMap.get(`${hattiHeader.row - 1},${hattiHeader.col}`);
    const valBelow = cellMap.get(`${hattiHeader.row + 1},${hattiHeader.col}`);
    lineName = valAbove || valBelow || '';
  }
  if (!lineName) {
    const directLine = cellStrings.find(
      (c) =>
        c.col < 25 &&
        c.row < 12 &&
        (c.text.toUpperCase().includes('ENVERİYE') ||
          c.text.toUpperCase().includes('ALAYUNT') ||
          c.text.toUpperCase().includes('KONYA'))
    );
    if (directLine) lineName = directLine.text;
  }

  // 3. Bulunduğu İl & Nereleri Bağladığı
  let bulunduguIl = '';
  let nereleriBagladigi = '';

  const ilLabel = cellStrings.find((c) => c.text.toUpperCase().includes('BULUNDUĞU İL'));
  if (ilLabel) {
    // Look to the right of "BULUNDUĞU İL" in row ilLabel.row or ilLabel.row + 1
    const candidate = cellStrings.filter(
      (c) => c.row >= ilLabel.row && c.row <= ilLabel.row + 1 && c.col > ilLabel.col && c.col <= ilLabel.col + 15
    );
    const textVals = candidate
      .map((c) => c.text.replace(/^[:\s-]+/, '').trim())
      .filter((t) => t && t !== ':');
    if (textVals.length > 0) bulunduguIl = textVals[0];
  }

  const nereleriLabel = cellStrings.find((c) => c.text.toUpperCase().includes('NERELERİ BAĞLADIĞI'));
  if (nereleriLabel) {
    const candidate = cellStrings.filter(
      (c) =>
        c.row >= nereleriLabel.row &&
        c.row <= nereleriLabel.row + 2 &&
        c.col > nereleriLabel.col &&
        c.col <= nereleriLabel.col + 15
    );
    const textVals = candidate
      .map((c) => c.text.replace(/^[:\s-]+/, '').trim())
      .filter((t) => t && t !== ':');
    if (textVals.length > 0) nereleriBagladigi = textVals.join(' ');
  }

  // 4. Şube Şefliği
  let subeSefligi = '';
  const subeHeader = cellStrings.find((c) => c.text.toUpperCase().includes('ŞUBE') && c.text.toUpperCase().includes('ŞEFLİĞİ') && c.col < 25);
  if (subeHeader) {
    const valNearby = cellStrings.find(
      (c) =>
        c !== subeHeader &&
        Math.abs(c.row - subeHeader.row) <= 1 &&
        c.col > subeHeader.col &&
        c.col <= subeHeader.col + 6 &&
        /^\d+$/.test(c.text.trim())
    );
    if (valNearby) subeSefligi = valNearby.text;
  }

  // 5. Hemzemin Geçit Genel Bilgileri (col ~ 10..45, row < 25)
  // "HEMZEMİN GEÇİT GENEL BİLGİLERİ" başlığı altındaki GEÇİT TİPİ ve KAPLAMA CİNSİ değerleri
  let crossingType = '';

  // 1. Locate explicit crossing type mentions first (since standard forms use well-known phrases)
  const explicitTypeMatch = cellStrings.find((c) => {
    if (c.row >= 28 || c.col > 45) return false;
    const up = c.text.toUpperCase();
    if (up.includes('KAPLAMA') || up.includes('TOPRAK') || up.includes('KAUÇUK') || up.includes('BALAST')) return false;
    return (
      up.includes('SERBEST(ÇAPRAZ') ||
      up.includes('SERBEST (ÇAPRAZ') ||
      up.includes('SERBEST(CAPRAZ') ||
      up.includes('SERBEST ÇAPRAZ') ||
      up.includes('SERBEST CAPRAZ') ||
      up === 'SERBEST' ||
      up.includes('FLAŞÖRLÜ') ||
      up.includes('FLAŞERLİ') ||
      up.includes('OTOMATİK BARİYER') ||
      up.includes('OTOMTK. BARİYER') ||
      up.includes('OTOMATIK BARIYER') ||
      up.includes('BEKÇİLİ BARİYER') ||
      up.includes('MEKANİK BARİYER') ||
      up.includes('KORUMASIZ') ||
      up.includes('YAYA GEÇİDİ')
    );
  });

  if (explicitTypeMatch) {
    let t = explicitTypeMatch.text.replace(/^[:\s-]+/, '').trim();
    const up = t.toUpperCase();
    if (up.includes('SERBEST')) {
      crossingType = 'SERBEST(ÇAPRAZ İŞARETLİ)';
    } else if (up.includes('FLAŞÖRLÜ') || up.includes('FLAŞERLİ') || up.includes('OTOMATİK') || up.includes('OTOMTK')) {
      crossingType = 'FLAŞÖRLÜ+ÇANLI OTOMTK. BARİYERLİ';
    } else if (up.includes('BEKÇİLİ')) {
      crossingType = 'BEKÇİLİ BARİYERLİ';
    } else if (up.includes('MEKANİK')) {
      crossingType = 'MEKANİK BARİYERLİ';
    } else {
      crossingType = t;
    }
  }

  // 2. If not found by explicit keyword, search right beside/below 'GEÇİT TİPİ'
  if (!crossingType) {
    const gecitTipiHeader = cellStrings.find(
      (c) =>
        c.row < 22 &&
        c.col >= 10 &&
        c.col <= 45 &&
        (c.text.toUpperCase() === 'GEÇİT TİPİ' || c.text.toUpperCase() === 'GECIT TIPI' || c.text.toUpperCase().startsWith('GEÇİT TİPİ:'))
    ) || cellStrings.find(
      (c) => c.row < 25 && c.text.toUpperCase().includes('GEÇİT TİPİ') && !c.text.toUpperCase().includes('HEMZEMİN')
    );

    if (gecitTipiHeader) {
      if (gecitTipiHeader.text.includes(':')) {
        const parts = gecitTipiHeader.text.split(':');
        if (parts.length > 1 && parts[1].trim()) {
          const valPart = parts[1].trim();
          crossingType = valPart.toUpperCase().includes('SERBEST') ? 'SERBEST(ÇAPRAZ İŞARETLİ)' : valPart;
        }
      }

      if (!crossingType) {
        const nearbyCells = cellStrings.filter(
          (c) =>
            c !== gecitTipiHeader &&
            c.row >= gecitTipiHeader.row &&
            c.row <= gecitTipiHeader.row + 3 &&
            c.col > gecitTipiHeader.col &&
            c.col <= gecitTipiHeader.col + 15
        );

        nearbyCells.sort((a, b) => {
          const da = Math.abs(a.row - gecitTipiHeader.row) * 3 + Math.abs(a.col - gecitTipiHeader.col);
          const db = Math.abs(b.row - gecitTipiHeader.row) * 3 + Math.abs(b.col - gecitTipiHeader.col);
          return da - db;
        });

        for (const cand of nearbyCells) {
          let t = cand.text.replace(/^[:\s-]+/, '').trim();
          const up = t.toUpperCase();
          if (
            t &&
            t !== ':' &&
            !up.includes('GEÇİT TİPİ') &&
            !up.includes('KAPLAMA') &&
            !up.includes('24 SAAT') &&
            !up.includes('TAŞIT') &&
            !up.includes('TREN') &&
            !up.includes('LASTİK') &&
            !up.includes('KAUÇUK') &&
            !up.includes('TOPRAK') &&
            !up.includes('BALAST') &&
            !up.includes('ASFALT') &&
            !up.includes('TAVŞANLI') &&
            !up.includes('SÜTLAÇ')
          ) {
            if (up.includes('SERBEST')) {
              crossingType = 'SERBEST(ÇAPRAZ İŞARETLİ)';
            } else {
              crossingType = t;
            }
            break;
          }
        }
      }
    }
  }

  // Kaplama Cinsi: Focus EXCLUSIVELY on actual material (toprak, balast, kauçuk, lastik, asfalt, beton, ahşap)
  // Completely ignore and discard line names ("TAVŞANLI-TUNÇBİLEK", "SÜTLAÇ-ÇİVRİL", "KÜTAHYA-SEYİTÖMER" etc.)
  let surfaceType = '';
  const kaplamaHeader = cellStrings.find(
    (c) =>
      c.text.toUpperCase().includes('KAPLAMA CİNSİ') &&
      c.col >= 15 &&
      c.col <= 42 &&
      c.row < 22
  );

  if (kaplamaHeader) {
    const valCandidates = cellStrings.filter(
      (c) =>
        c !== kaplamaHeader &&
        c.row >= kaplamaHeader.row &&
        c.row <= kaplamaHeader.row + 2 &&
        c.col > kaplamaHeader.col &&
        c.col <= kaplamaHeader.col + 15
    );
    for (const cand of valCandidates) {
      let t = cand.text.replace(/^[:\s-]+/, '').trim();
      t = t.replace(/TAVŞANLI.*$/i, '').replace(/SÜTLAÇ.*$/i, '').replace(/KÜTAHYA-SEYİTÖMER.*$/i, '').trim();
      const up = t.toUpperCase();
      if (up.includes('KAUÇUK') || up.includes('LASTİK') || up.includes('BODAN') || up.includes('STRAIL')) {
        surfaceType = 'Lastik (Kauçuk)';
        break;
      } else if (up.includes('TOPRAK') || up.includes('BALAST')) {
        surfaceType = 'Toprak / Balast';
        break;
      } else if (up.includes('ASFALT')) {
        surfaceType = 'Asfalt';
        break;
      } else if (up.includes('BETON') || up.includes('PARKE') || up.includes('KOMPOZİT')) {
        surfaceType = 'Kompozit / Beton Parke';
        break;
      } else if (up.includes('AHŞAP')) {
        surfaceType = 'Ahşap';
        break;
      } else if (t && !up.includes('24 SAAT') && !up.includes('TAŞIT') && !up.includes('HATTI') && !up.includes('GEÇİT')) {
        surfaceType = t;
      }
    }
  }

  // Fallback: search anywhere in top general section for explicit material keywords
  if (!surfaceType || surfaceType.toUpperCase().includes('TAVŞANLI') || surfaceType.toUpperCase().includes('KÜTAHYA')) {
    const materialCell = cellStrings.find((c) =>
      c.col >= 15 && c.col <= 45 && c.row < 22 &&
      (c.text.toUpperCase().includes('LASTİK') ||
       c.text.toUpperCase().includes('KAUÇUK') ||
       c.text.toUpperCase().includes('TOPRAK') ||
       c.text.toUpperCase().includes('BALAST') ||
       c.text.toUpperCase().includes('STRAIL') ||
       c.text.toUpperCase().includes('BODAN'))
    );
    if (materialCell) {
      const up = materialCell.text.toUpperCase();
      if (up.includes('KAUÇUK') || up.includes('LASTİK') || up.includes('STRAIL') || up.includes('BODAN')) {
        surfaceType = 'Lastik (Kauçuk)';
      } else if (up.includes('TOPRAK') || up.includes('BALAST')) {
        surfaceType = 'Toprak / Balast';
      }
    }
  }

  // 24 Saatte Geçen Taşıt & Tren Adedi
  let dailyVehicleCount = '';
  let dailyTrainCount = '';
  const tasitHeader = cellStrings.find(
    (c) => (c.text.toLowerCase().includes('taşıt adedi') || c.text.toLowerCase().includes('tasit adedi')) && c.row < 16
  );
  if (tasitHeader) {
    const valCell = cellStrings.find(
      (c) => Math.abs(c.col - tasitHeader.col) <= 3 && c.row > tasitHeader.row && c.row <= tasitHeader.row + 4 && /^\d+$/.test(c.text.trim())
    );
    if (valCell) dailyVehicleCount = valCell.text;
  }
  const trenHeader = cellStrings.find(
    (c) => c.text.toLowerCase().includes('tren adedi') && c.row < 16
  );
  if (trenHeader) {
    const valCell = cellStrings.find(
      (c) => Math.abs(c.col - trenHeader.col) <= 3 && c.row > trenHeader.row && c.row <= trenHeader.row + 4 && /^\d+$/.test(c.text.trim())
    );
    if (valCell) dailyTrainCount = valCell.text;
  }

  // Karayolunun Ait Olduğu Kuruluş
  let roadBelonging = '';
  const karayoluHeader = cellStrings.find(
    (c) => c.text.toUpperCase().includes('KARAYOLUNUN AİT OLDUĞU KURULUŞ') || c.text.toUpperCase().includes('KARAYOLUNUN AIT OLDUGU')
  );
  if (karayoluHeader) {
    const valCandidates = cellStrings.filter(
      (c) =>
        c !== karayoluHeader &&
        c.row > karayoluHeader.row &&
        c.row <= karayoluHeader.row + 3 &&
        Math.abs(c.col - karayoluHeader.col) <= 15
    );
    if (valCandidates.length > 0) {
      roadBelonging = valCandidates[0].text;
    }
  }

  // 6. Sol Alt Blok: HEMZEMİN GEÇİT BİLGİLERİ (row > 30, col < 25)
  // Karayolu Araç 5 m'den Min. Görüş Mesafesi
  let minSightDistance = '';
  const gorusHeader = cellStrings.find(
    (c) =>
      c.row >= 30 &&
      c.col < 25 &&
      (c.text.toUpperCase().includes('GÖR. MES') || c.text.toUpperCase().includes('GÖRÜŞ MESAFESİ'))
  );
  if (gorusHeader) {
    const valCell = cellStrings.find(
      (c) => c.row >= gorusHeader.row && c.row <= gorusHeader.row + 1 && c.col > gorusHeader.col && c.col <= gorusHeader.col + 10 && /^\d+$/.test(c.text.trim())
    );
    if (valCell) minSightDistance = valCell.text;
  }

  // Açıklığı (m)
  let clearanceWidth = '';
  const aciklikHeader = cellStrings.find(
    (c) => c.row >= 30 && c.col < 25 && c.text.toUpperCase().includes('AÇIKLIĞI')
  );
  if (aciklikHeader) {
    const valCell = cellStrings.find(
      (c) =>
        c.row >= aciklikHeader.row &&
        c.row <= aciklikHeader.row + 1 &&
        c.col > aciklikHeader.col &&
        c.col <= aciklikHeader.col + 10 &&
        /^\d+(?:[.,]\d+)?$/.test(c.text.trim())
    );
    if (valCell) clearanceWidth = valCell.text;
  }

  // Verevlik Açısı (Derece)
  let skewAngle = '';
  const verevlikHeader = cellStrings.find(
    (c) => c.row >= 30 && c.col < 25 && c.text.toUpperCase().includes('VEREVLİK')
  );
  if (verevlikHeader) {
    const valCell = cellStrings.find(
      (c) =>
        c.row >= verevlikHeader.row &&
        c.row <= verevlikHeader.row + 1 &&
        c.col > verevlikHeader.col &&
        c.col <= verevlikHeader.col + 10 &&
        /^\d+$/.test(c.text.trim())
    );
    if (valCell) skewAngle = valCell.text;
  }

  // Kestiği Hat Adedi
  let intersectedTrackCount = '';
  const kestigiHatHeader = cellStrings.find(
    (c) => c.row >= 30 && c.col < 25 && c.text.toUpperCase().includes('KESTİĞİ HAT')
  );
  if (kestigiHatHeader) {
    const valCell = cellStrings.find(
      (c) =>
        c.row >= kestigiHatHeader.row &&
        c.row <= kestigiHatHeader.row + 1 &&
        c.col > kestigiHatHeader.col &&
        c.col <= kestigiHatHeader.col + 10 &&
        /^\d+$/.test(c.text.trim())
    );
    if (valCell) intersectedTrackCount = valCell.text;
  }

  // Demiryolunun Eğimi (Binde)
  let railwayGradient = '';
  const egimHeader = cellStrings.find(
    (c) => c.row >= 30 && c.col < 25 && (c.text.toUpperCase().includes('EĞİMİ') || c.text.toUpperCase().includes('EGIMI'))
  );
  if (egimHeader) {
    const valCell = cellStrings.find(
      (c) =>
        c.row >= egimHeader.row &&
        c.row <= egimHeader.row + 1 &&
        c.col > egimHeader.col &&
        c.col <= egimHeader.col + 10 &&
        /^-?\d+(?:[.,]\d+)?$/.test(c.text.trim())
    );
    if (valCell) railwayGradient = valCell.text;
  }

  // Kurp Bilgileri
  let curveInfo = '';
  const kurpHeader = cellStrings.find(
    (c) => c.row >= 30 && c.col < 25 && c.text.toUpperCase().includes('KURP BİLGİLERİ')
  );
  if (kurpHeader) {
    const valCandidates = cellStrings.filter(
      (c) =>
        c !== kurpHeader &&
        c.row >= kurpHeader.row &&
        c.row <= kurpHeader.row + 1 &&
        c.col > kurpHeader.col &&
        c.col <= kurpHeader.col + 10
    );
    const textVals = valCandidates
      .map((c) => c.text.replace(/^[:\s-]+/, '').trim())
      .filter((t) => t && t !== ':');
    if (textVals.length > 0) curveInfo = textVals.join(' ');
  }

  return {
    detectedKm,
    lineName,
    subeSefligi,
    bulunduguIl,
    nereleriBagladigi,
    roadBelonging,
    details: {
      crossingType: crossingType || undefined,
      surfaceType: surfaceType || undefined,
      dailyVehicleCount: dailyVehicleCount || undefined,
      dailyTrainCount: dailyTrainCount || undefined,
      clearanceWidth: clearanceWidth || undefined,
      skewAngle: skewAngle || undefined,
      intersectedTrackCount: intersectedTrackCount || undefined,
      minSightDistance: minSightDistance || undefined,
      railwayGradient: railwayGradient || undefined,
      curveInfo: curveInfo || undefined,
      subeSefligi: subeSefligi || undefined,
      roadBelonging: roadBelonging || undefined,
      nereleriBagladigi: nereleriBagladigi || undefined,
      bulunduguIl: bulunduguIl || undefined,
    },
  };
}

/**
 * Main function: Inspects multi-tab TCDD Excel workbook (like "712 geçit listesi.xlsx"),
 * parses each sheet ("54+635", "55+407", etc.), extracts photos and technical form data,
 * and updates ONLY matching existing 92 points!
 */
export async function mergeExcelIntoExistingCrossings(
  buffer: ArrayBuffer,
  existingPoints: RailwayPoint[]
): Promise<{ updatedPoints: RailwayPoint[]; stats: ExcelExtractionResult }> {
  const zip = await JSZip.loadAsync(buffer);
  const sheetPhotosMap = await extractPhotosPerSheet(zip);
  const allSheetPhotosList = Array.from(sheetPhotosMap.values());

  const workbook = XLSX.read(buffer, { type: 'array' });
  const updatedPoints: RailwayPoint[] = JSON.parse(JSON.stringify(existingPoints));

  const stats: ExcelExtractionResult = {
    matchedCrossingsCount: 0,
    extractedPhotosCount: 0,
    details: [],
    unmatchedRows: [],
  };

  let sheetIndex = 0;
  for (const sheetName of workbook.SheetNames) {
    sheetIndex++;
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const sheetData = extractDataFromTcddSheet(worksheet, sheetName);
    const sheetKm = sheetData.detectedKm || normalizeKmString(sheetName);

    if (!sheetKm) {
      continue;
    }

    const matchedPoint = updatedPoints.find((ep) => {
      if (isSameKm(ep.kmValue, sheetKm)) return true;
      if (isSameKm(ep.title, sheetKm)) return true;
      return false;
    });

    if (!matchedPoint) {
      stats.unmatchedRows.push({ sheetName, sheetKm, sheetData });
      continue;
    }

    matchedPoint.category = 'crossing';
    const fieldsUpdated: string[] = [];

    const currLc = matchedPoint.levelCrossing || {};
    const newLc: LevelCrossingDetails = { ...currLc };

    if (sheetData.details.crossingType) {
      newLc.crossingType = sheetData.details.crossingType;
      fieldsUpdated.push(`Geçit Tipi (${sheetData.details.crossingType})`);
    }
    if (sheetData.details.surfaceType) {
      newLc.surfaceType = sheetData.details.surfaceType;
      fieldsUpdated.push(`Kaplama (${sheetData.details.surfaceType})`);
    }
    if (sheetData.details.dailyVehicleCount) {
      newLc.dailyVehicleCount = sheetData.details.dailyVehicleCount;
      fieldsUpdated.push(`Taşıt (${sheetData.details.dailyVehicleCount})`);
    }
    if (sheetData.details.dailyTrainCount) {
      newLc.dailyTrainCount = sheetData.details.dailyTrainCount;
      fieldsUpdated.push(`Tren (${sheetData.details.dailyTrainCount})`);
    }
    if (sheetData.details.clearanceWidth) {
      newLc.clearanceWidth = sheetData.details.clearanceWidth;
      fieldsUpdated.push(`Açıklık (${sheetData.details.clearanceWidth}m)`);
    }
    if (sheetData.details.skewAngle) {
      newLc.skewAngle = sheetData.details.skewAngle;
      fieldsUpdated.push(`Verevlik (${sheetData.details.skewAngle}°)`);
    }
    if (sheetData.details.intersectedTrackCount) {
      newLc.intersectedTrackCount = sheetData.details.intersectedTrackCount;
      fieldsUpdated.push(`Hat Adedi (${sheetData.details.intersectedTrackCount})`);
    }
    if (sheetData.details.minSightDistance) {
      newLc.minSightDistance = sheetData.details.minSightDistance;
      fieldsUpdated.push(`Görüş (${sheetData.details.minSightDistance}m)`);
    }
    if (sheetData.details.railwayGradient) {
      newLc.railwayGradient = sheetData.details.railwayGradient;
      fieldsUpdated.push(`Eğim (‰${sheetData.details.railwayGradient})`);
    }
    if (sheetData.details.curveInfo) {
      newLc.curveInfo = sheetData.details.curveInfo;
      fieldsUpdated.push(`Kurp (${sheetData.details.curveInfo})`);
    }
    if (sheetData.details.subeSefligi) {
      newLc.subeSefligi = sheetData.details.subeSefligi;
      fieldsUpdated.push(`Şube Şefliği (${sheetData.details.subeSefligi})`);
    }
    if (sheetData.details.roadBelonging) {
      newLc.roadBelonging = sheetData.details.roadBelonging;
      fieldsUpdated.push(`Karayolu (${sheetData.details.roadBelonging})`);
    }
    if (sheetData.details.nereleriBagladigi) {
      newLc.nereleriBagladigi = sheetData.details.nereleriBagladigi;
      fieldsUpdated.push(`Bağlantı (${sheetData.details.nereleriBagladigi})`);
    }
    if (sheetData.details.bulunduguIl) {
      newLc.bulunduguIl = sheetData.details.bulunduguIl;
      fieldsUpdated.push(`İl (${sheetData.details.bulunduguIl})`);
    }

    matchedPoint.levelCrossing = newLc;

    // Hat Adı ve Konum Açıklaması
    if (sheetData.lineName && !matchedPoint.lineName.includes(sheetData.lineName)) {
      matchedPoint.lineName = sheetData.lineName;
      fieldsUpdated.push(`Hat: ${sheetData.lineName}`);
    }

    if (sheetData.nereleriBagladigi || sheetData.bulunduguIl) {
      const locText = [
        sheetData.bulunduguIl ? `İl: ${sheetData.bulunduguIl}` : '',
        sheetData.nereleriBagladigi ? `Güzergah: ${sheetData.nereleriBagladigi}` : '',
      ].filter(Boolean).join(' | ');

      if (locText && (!matchedPoint.locationDesc || !matchedPoint.locationDesc.includes(locText))) {
        matchedPoint.locationDesc = matchedPoint.locationDesc ? `${matchedPoint.locationDesc} (${locText})` : locText;
      }
    }

    // Attach photos for this sheet
    let photosAddedForPoint = 0;
    const rawPhotos = sheetPhotosMap.get(`sheet_${sheetIndex}`) || [];
    const filteredPhotos = filterOutCommonLogo(rawPhotos, allSheetPhotosList);

    if (filteredPhotos.length > 0) {
      const existingPhotoUrls = new Set((matchedPoint.photos || []).map((ph) => ph.dataUrl));
      const newPhotos: PointPhoto[] = [];

      filteredPhotos.forEach((dataUrl, pIdx) => {
        if (!existingPhotoUrls.has(dataUrl)) {
          newPhotos.push({
            id: `photo-sheet-${matchedPoint.id}-${Date.now()}-${pIdx}`,
            dataUrl,
            caption: `${matchedPoint.title} - Saha Görseli #${pIdx + 1}`,
            takenAt: new Date().toISOString(),
          });
        }
      });

      if (newPhotos.length > 0) {
        matchedPoint.photos = [...(matchedPoint.photos || []), ...newPhotos];
        photosAddedForPoint = newPhotos.length;
        stats.extractedPhotosCount += newPhotos.length;
        fieldsUpdated.push(`${newPhotos.length} Adet Saha Fotoğrafı`);
      }
    }

    matchedPoint.updatedAt = new Date().toISOString();
    stats.matchedCrossingsCount++;
    stats.details.push({
      pointId: matchedPoint.id,
      km: matchedPoint.kmValue,
      title: matchedPoint.title,
      fieldsUpdated,
      photosAdded: photosAddedForPoint,
    });
  }

  return { updatedPoints, stats };
}
