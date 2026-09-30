import * as XLSX from 'xlsx';
import { CulvertDetails, RailwayPoint } from '../types';

export interface CulvertExtractionResult {
  matchedCulvertsCount: number;
  details: {
    km: string;
    culvert: CulvertDetails;
    matched: boolean;
  }[];
}

/**
 * Standardizes KM format (e.g., "54+673", "54 + 673" -> "54+673")
 */
function normalizeKm(raw: any): string {
  if (raw === undefined || raw === null) return '';
  const s = String(raw).trim().replace(/\s+/g, '');
  const match = s.match(/(\d{1,4})[+\-](\d{1,4})/);
  if (match) {
    return `${match[1]}+${match[2].padStart(3, '0')}`;
  }
  return s;
}

function isSameKm(kmA: string, kmB: string): boolean {
  if (!kmA || !kmB) return false;
  const nA = normalizeKm(kmA);
  const nB = normalizeKm(kmB);
  if (nA === nB && nA !== '') return true;

  const getClean = (k: string) => {
    const m = k.match(/(\d{1,4})[+\-](\d{1,4})/);
    if (m) return parseInt(m[1], 10) * 1000 + parseInt(m[2], 10);
    return null;
  };
  const valA = getClean(kmA);
  const valB = getClean(kmB);
  if (valA !== null && valB !== null && valA === valB) return true;
  return false;
}

/**
 * Parses a TCDD Yol Bakım Şefliği Culvert (Menfez) list Excel sheet.
 * Can handle both vertical forms and table lists like "712 YOL BAKIM ŞEFLİĞİ MENFEZ LİSTESİ"
 */
export function parseCulvertExcelRows(worksheet: XLSX.WorkSheet): CulvertDetails[] {
  const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  const results: CulvertDetails[] = [];

  let headerRowIdx = -1;
  let colMap = {
    siraNo: -1,
    hatti: -1,
    mihverKlm: -1,
    aciklikSerbest: -1,
    aciklikMesnet: -1,
    debuseYuksekligi: -1,
    yapimYili: -1,
    dingilBasinci: -1,
    cinsi: -1,
  };

  // Find header row
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const row = rows[r] || [];
    const rowText = row.map((cell) => String(cell).toUpperCase()).join(' ');
    if (
      rowText.includes('MİHVER') ||
      rowText.includes('MIHVER') ||
      rowText.includes('KLM') ||
      rowText.includes('AÇIKLIĞI') ||
      rowText.includes('ACIKLIGI') ||
      rowText.includes('DEBUŞE') ||
      rowText.includes('DEBUSE') ||
      rowText.includes('CİNSİ') ||
      rowText.includes('CINSI')
    ) {
      headerRowIdx = r;
      break;
    }
  }

  if (headerRowIdx !== -1) {
    // Map columns from header row and next row (if subheaders like Serbest / Mesnet)
    const headerRow = rows[headerRowIdx] || [];
    const subRow = rows[headerRowIdx + 1] || [];

    headerRow.forEach((cell, cIdx) => {
      const txt = String(cell).toUpperCase().trim();
      const subTxt = String(subRow[cIdx] || '').toUpperCase().trim();

      if (txt.includes('SIRA')) colMap.siraNo = cIdx;
      else if (txt.includes('HATTI') || txt.includes('HAT')) colMap.hatti = cIdx;
      else if (txt.includes('MİHVER') || txt.includes('MIHVER') || txt.includes('KLM')) colMap.mihverKlm = cIdx;
      else if (txt.includes('AÇIKLIĞI') || txt.includes('ACIKLIGI')) {
        if (subTxt.includes('MESNET')) {
          colMap.aciklikMesnet = cIdx;
        } else {
          colMap.aciklikSerbest = cIdx;
        }
      } else if (txt.includes('SERBEST')) {
        colMap.aciklikSerbest = cIdx;
      } else if (txt.includes('MESNET')) {
        colMap.aciklikMesnet = cIdx;
      } else if (txt.includes('DEBUŞE') || txt.includes('DEBUSE') || txt.includes('YÜKSEKLİĞİ')) {
        colMap.debuseYuksekligi = cIdx;
      } else if (txt.includes('YAPIM') || txt.includes('YILI')) {
        colMap.yapimYili = cIdx;
      } else if (txt.includes('DİNGİL') || txt.includes('DINGIL') || txt.includes('BASINCI')) {
        colMap.dingilBasinci = cIdx;
      } else if (txt.includes('CİNSİ') || txt.includes('CINSI') || txt.includes('TİPİ')) {
        colMap.cinsi = cIdx;
      }
    });

    // Check subrow for missing subheaders
    subRow.forEach((cell, cIdx) => {
      const subTxt = String(cell).toUpperCase().trim();
      if (subTxt.includes('SERBEST') && colMap.aciklikSerbest === -1) colMap.aciklikSerbest = cIdx;
      if (subTxt.includes('MESNET') && colMap.aciklikMesnet === -1) colMap.aciklikMesnet = cIdx;
      if (subTxt.includes('DEBUŞE') && colMap.debuseYuksekligi === -1) colMap.debuseYuksekligi = cIdx;
    });

    // Start parsing data rows after headers
    const startDataRow = (colMap.aciklikMesnet !== -1 && headerRowIdx + 1 < rows.length) ? headerRowIdx + 2 : headerRowIdx + 1;

    for (let r = startDataRow; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;

      let rawKm = colMap.mihverKlm !== -1 ? row[colMap.mihverKlm] : '';
      if (!rawKm) {
        // Look for any cell with KM pattern
        const kmMatchCell = row.find((cell) => /\b\d{1,4}\s*[\+\-]\s*\d{1,4}\b/.test(String(cell)));
        if (kmMatchCell) rawKm = kmMatchCell;
      }

      const kmStr = normalizeKm(rawKm);
      if (!kmStr) continue;

      const culvert: CulvertDetails = {
        siraNo: colMap.siraNo !== -1 ? row[colMap.siraNo] : undefined,
        hatti: colMap.hatti !== -1 ? String(row[colMap.hatti]).trim() : 'Esk.-Konya',
        mihverKlm: kmStr,
        aciklikSerbest: colMap.aciklikSerbest !== -1 ? row[colMap.aciklikSerbest] : '',
        aciklikMesnet: colMap.aciklikMesnet !== -1 ? row[colMap.aciklikMesnet] : '',
        debuseYuksekligi: colMap.debuseYuksekligi !== -1 ? row[colMap.debuseYuksekligi] : '',
        yapimYili: colMap.yapimYili !== -1 ? row[colMap.yapimYili] : '1894',
        dingilBasinci: colMap.dingilBasinci !== -1 ? row[colMap.dingilBasinci] : '22,5',
        cinsi: colMap.cinsi !== -1 ? String(row[colMap.cinsi]).trim() : '',
        bakimSefligi: '712 YOL BAKIM ŞEFLİĞİ',
      };

      results.push(culvert);
    }
  }

  return results;
}

/**
 * Merges parsed culvert records into existing RailwayPoint array.
 */
export function mergeCulvertsIntoExistingPoints(
  culvertRecords: CulvertDetails[],
  existingPoints: RailwayPoint[]
): { updatedPoints: RailwayPoint[]; stats: CulvertExtractionResult } {
  const updatedPoints: RailwayPoint[] = JSON.parse(JSON.stringify(existingPoints));
  let matchedCount = 0;
  const details: CulvertExtractionResult['details'] = [];

  for (const culvert of culvertRecords) {
    if (!culvert.mihverKlm) continue;

    // Find culvert point matching KM
    const matchedPoint = updatedPoints.find((p) => {
      if (p.category === 'culvert') {
        if (isSameKm(p.kmValue, culvert.mihverKlm!)) return true;
        if (isSameKm(p.title, culvert.mihverKlm!)) return true;
      }
      return false;
    }) || updatedPoints.find((p) => {
      // If not yet categorized as culvert, but title has KM
      if (isSameKm(p.kmValue, culvert.mihverKlm!) || isSameKm(p.title, culvert.mihverKlm!)) return true;
      return false;
    });

    if (matchedPoint) {
      matchedPoint.category = 'culvert';
      matchedPoint.culvert = {
        ...(matchedPoint.culvert || {}),
        ...culvert,
      };
      if (culvert.hatti && !matchedPoint.lineName) {
        matchedPoint.lineName = culvert.hatti;
      }
      matchedCount++;
      details.push({
        km: culvert.mihverKlm,
        culvert,
        matched: true,
      });
    } else {
      details.push({
        km: culvert.mihverKlm,
        culvert,
        matched: false,
      });
    }
  }

  return {
    updatedPoints,
    stats: {
      matchedCulvertsCount: matchedCount,
      details,
    },
  };
}
