import fs from 'fs';
import path from 'path';

interface CulvertInput {
  s: number;
  line: string;
  km: string;
  aciklikSerbest: string;
  aciklikMesnet: string;
  debuse: string;
  yil: string;
  basinc: string;
  cinsi: string;
}

const culvertsData: CulvertInput[] = [
  { s: 1, line: 'Esk.-Konya', km: '54+223', aciklikSerbest: '4,00', aciklikMesnet: '1', debuse: '0,70', yil: '1894', basinc: '22,5', cinsi: 'Ferbeton-Betonarme' },
  { s: 2, line: 'Esk.-Konya', km: '54+673', aciklikSerbest: '0,60', aciklikMesnet: '1', debuse: '0,60', yil: '1894', basinc: '22,5', cinsi: 'Taş Kapak' },
  { s: 3, line: 'Esk.-Konya', km: '54+692', aciklikSerbest: '0,60', aciklikMesnet: '1', debuse: '0,60', yil: '1894', basinc: '22,5', cinsi: 'Demir Boru' },
  { s: 4, line: 'Esk.-Konya', km: '55+428', aciklikSerbest: '2,00', aciklikMesnet: '1', debuse: '1,00', yil: '1894', basinc: '22,5', cinsi: 'Ferbeton' },
  { s: 5, line: 'Esk.-Konya', km: '55+895', aciklikSerbest: '1,00', aciklikMesnet: '1', debuse: '0,50', yil: '1894', basinc: '22,5', cinsi: 'Ferbeton' },
  { s: 6, line: 'Esk.-Konya', km: '56+522', aciklikSerbest: '3,00', aciklikMesnet: '1', debuse: '1,45', yil: '1894', basinc: '22,5', cinsi: 'Ferbeton' },
  { s: 7, line: 'Esk.-Konya', km: '56+876', aciklikSerbest: '0,60', aciklikMesnet: '1', debuse: '0,80', yil: '1894', basinc: '22,5', cinsi: 'Taş Kapak' },
  { s: 8, line: 'Esk.-Konya', km: '57+411', aciklikSerbest: '1,00', aciklikMesnet: '1', debuse: '0,60', yil: '1894', basinc: '22,5', cinsi: 'Ferbeton' },
  { s: 9, line: 'Esk.-Konya', km: '57+536', aciklikSerbest: '2,00', aciklikMesnet: '1', debuse: '0,60', yil: '1894', basinc: '22,5', cinsi: 'Taş Kemer' },
  { s: 10, line: 'Esk.-Konya', km: '57+818', aciklikSerbest: '0,60', aciklikMesnet: '1', debuse: '0,50', yil: '1894', basinc: '22,5', cinsi: 'Taş Kemer' },
  { s: 11, line: 'Esk.-Konya', km: '57+995', aciklikSerbest: '2,00', aciklikMesnet: '1', debuse: '0,70', yil: '1894', basinc: '22,5', cinsi: 'Ferbeton' },
  { s: 12, line: 'Esk.-Konya', km: '58+005', aciklikSerbest: '2,25', aciklikMesnet: '5*0,45', debuse: '1,00', yil: '1894', basinc: '22,5', cinsi: 'B.A.Açık Menfez' },
  { s: 13, line: 'Esk.-Konya', km: '58+290', aciklikSerbest: '0,60', aciklikMesnet: '1', debuse: '0,60', yil: '1894', basinc: '22,5', cinsi: 'Taş Kemer' },
  { s: 14, line: 'Esk.-Konya', km: '58+928', aciklikSerbest: '0,60', aciklikMesnet: '1', debuse: '0,60', yil: '1894', basinc: '22,5', cinsi: 'Taş Kapak' },
  { s: 15, line: 'Esk.-Konya', km: '59+270', aciklikSerbest: '0,60', aciklikMesnet: '1', debuse: '0,60', yil: '1894', basinc: '22,5', cinsi: 'Taş Kapak' },
  { s: 16, line: 'Esk.-Konya', km: '59+578', aciklikSerbest: '0,60', aciklikMesnet: '1', debuse: '0,60', yil: '1894', basinc: '22,5', cinsi: 'Taş Kapak' },
  { s: 17, line: 'Esk.-Konya', km: '59+803', aciklikSerbest: '0,60', aciklikMesnet: '1', debuse: '0,60', yil: '1894', basinc: '22,5', cinsi: 'Taş Kapak' },
  { s: 18, line: 'Esk.-Konya', km: '59+870', aciklikSerbest: '0,60', aciklikMesnet: '1', debuse: '0,60', yil: '1894', basinc: '22,5', cinsi: 'Taş Kapak' },
  { s: 19, line: 'Esk.-Konya', km: '59+988', aciklikSerbest: '0,60', aciklikMesnet: '1', debuse: '0,60', yil: '1894', basinc: '22,5', cinsi: 'Taş Kapak' },
  { s: 20, line: 'Esk.-Konya', km: '60+046', aciklikSerbest: '0,40', aciklikMesnet: '1', debuse: '0,30', yil: '1894', basinc: '22,5', cinsi: 'Taş Kapak' },
  { s: 21, line: 'Esk.-Konya', km: '60+138', aciklikSerbest: '0,60', aciklikMesnet: '1', debuse: '0,60', yil: '1894', basinc: '22,5', cinsi: 'Taş Kemer' },
  { s: 22, line: 'Esk.-Konya', km: '60+375', aciklikSerbest: '0,60', aciklikMesnet: '1', debuse: '0,60', yil: '1894', basinc: '22,5', cinsi: 'Taş Kemer' },
  { s: 23, line: 'Esk.-Konya', km: '60+584', aciklikSerbest: '0,60', aciklikMesnet: '1', debuse: '0,60', yil: '1894', basinc: '22,5', cinsi: 'Taş Kemer' },
  { s: 24, line: 'Esk.-Konya', km: '60+690', aciklikSerbest: '0,60', aciklikMesnet: '1', debuse: '0,60', yil: '1894', basinc: '22,5', cinsi: 'Taş Kemer' },
  { s: 25, line: 'Esk.-Konya', km: '61+026', aciklikSerbest: '0,60', aciklikMesnet: '1', debuse: '0,60', yil: '1894', basinc: '22,5', cinsi: 'Taş Kemer' },
  { s: 26, line: 'Esk.-Konya', km: '61+091', aciklikSerbest: '0,60', aciklikMesnet: '1', debuse: '0,60', yil: '1894', basinc: '22,5', cinsi: 'Taş Kemer' },
  { s: 27, line: 'Esk.-Konya', km: '61+246', aciklikSerbest: '0,60', aciklikMesnet: '1', debuse: '0,60', yil: '1894', basinc: '22,5', cinsi: 'Taş Kemer' },
  { s: 28, line: 'Esk.-Konya', km: '61+565', aciklikSerbest: '0,60', aciklikMesnet: '1', debuse: '0,60', yil: '1894', basinc: '22,5', cinsi: 'Taş Kemer' },
  { s: 29, line: 'Esk.-Konya', km: '61+805', aciklikSerbest: '3,00', aciklikMesnet: '1', debuse: '2,00', yil: '1894', basinc: '22,5', cinsi: 'Taş Kemer' },
  { s: 30, line: 'Esk.-Konya', km: '62+330', aciklikSerbest: '0,60', aciklikMesnet: '1', debuse: '0,60', yil: '1894', basinc: '22,5', cinsi: 'Demir Boru' },
  { s: 31, line: 'Esk.-Konya', km: '63+120', aciklikSerbest: '0,60', aciklikMesnet: '1', debuse: '0,60', yil: '1894', basinc: '22,5', cinsi: 'Demir Boru' },
  { s: 32, line: 'Esk.-Konya', km: '64+420', aciklikSerbest: '0,60', aciklikMesnet: '1', debuse: '0,60', yil: '1894', basinc: '22,5', cinsi: 'Demir Boru' },
  { s: 33, line: 'Esk.-Konya', km: '65+657', aciklikSerbest: '5,80', aciklikMesnet: '2,80+3,00', debuse: '1,55', yil: '1894', basinc: '22,5', cinsi: 'Ferbeton' },
  { s: 34, line: 'Esk.-Konya', km: '66+368', aciklikSerbest: '0,50', aciklikMesnet: '1', debuse: '0,50', yil: '1963', basinc: '22,5', cinsi: 'BÜZ' },
  { s: 35, line: 'Esk.-Konya', km: '66+372', aciklikSerbest: '0,50', aciklikMesnet: '1', debuse: '0,50', yil: '1963', basinc: '22,5', cinsi: 'BÜZ' },
  { s: 36, line: 'Esk.-Konya', km: '67+476', aciklikSerbest: '3,00', aciklikMesnet: '1', debuse: '1,50', yil: '1895', basinc: '22,5', cinsi: 'Ferbeton' },
  { s: 37, line: 'Esk.-Konya', km: '67+658', aciklikSerbest: '3,00', aciklikMesnet: '1', debuse: '1,00', yil: '1895', basinc: '22,5', cinsi: 'Ferbeton' },
  { s: 38, line: 'Esk.-Konya', km: '70+190', aciklikSerbest: '4,00', aciklikMesnet: '1', debuse: '0,60', yil: '1895', basinc: '22,5', cinsi: 'Ferbeton' },
  { s: 39, line: 'Esk.-Konya', km: '71+482', aciklikSerbest: '1,00', aciklikMesnet: '1', debuse: '0,90', yil: '1895', basinc: '22,5', cinsi: 'Ferbeton' },
  { s: 40, line: 'Esk.-Konya', km: '72+453', aciklikSerbest: '1,00', aciklikMesnet: '1', debuse: '1,00', yil: '1895', basinc: '22,5', cinsi: 'Ferbeton' },
  { s: 41, line: 'Esk.-Konya', km: '74+905', aciklikSerbest: '1,00', aciklikMesnet: '1', debuse: '0,70', yil: '1895', basinc: '22,5', cinsi: 'Ferbeton' },
  { s: 42, line: 'Esk.-Konya', km: '79+609', aciklikSerbest: '1,00', aciklikMesnet: '1', debuse: '0,25', yil: '1895', basinc: '22,5', cinsi: 'Ferbeton' },
  { s: 43, line: 'Esk.-Konya', km: '80+558', aciklikSerbest: '4,00', aciklikMesnet: '1', debuse: '0,60', yil: '1895', basinc: '22,5', cinsi: 'Ferbeton' },
  { s: 44, line: 'Esk.-Konya', km: '80+860', aciklikSerbest: '0,60', aciklikMesnet: '1', debuse: '0,60', yil: '1895', basinc: '22,5', cinsi: 'Taş Kapak' },
  { s: 45, line: 'Esk.-Konya', km: '81+252', aciklikSerbest: '6,00', aciklikMesnet: '3*2,00', debuse: '3,00', yil: '2005', basinc: '22,5', cinsi: 'KutuM.fez' },
  { s: 46, line: 'Esk.-Konya', km: '81+876', aciklikSerbest: '0,60', aciklikMesnet: '1', debuse: '0,60', yil: '1895', basinc: '22,5', cinsi: 'Demir Boru' },
  { s: 47, line: 'Esk.-Konya', km: '82+451', aciklikSerbest: '1,00', aciklikMesnet: '1', debuse: '0,80', yil: '1895', basinc: '22,5', cinsi: 'Ferbeton' },
  { s: 48, line: 'Esk.-Konya', km: '82+912', aciklikSerbest: '6,00', aciklikMesnet: '3*2,00', debuse: '3,00', yil: '2005', basinc: '22,5', cinsi: 'KutuM.fez' },
  { s: 49, line: 'Esk.-Konya', km: '83+093', aciklikSerbest: '1,00', aciklikMesnet: '1', debuse: '1,00', yil: '1895', basinc: '22,5', cinsi: 'Ferbeton' },
  { s: 50, line: 'Esk.-Konya', km: '83+169', aciklikSerbest: '2,00', aciklikMesnet: '1', debuse: '1,00', yil: '1895', basinc: '22,5', cinsi: 'Ferbeton' },
  { s: 51, line: 'Esk.-Konya', km: '83+357', aciklikSerbest: '1,00', aciklikMesnet: '1', debuse: '1,70', yil: '1895', basinc: '22,5', cinsi: 'Taş Kemer' },
  { s: 52, line: 'Esk.-Konya', km: '83+698', aciklikSerbest: '0,60', aciklikMesnet: '1', debuse: '0,60', yil: '1895', basinc: '22,5', cinsi: 'Taş Kemer' },
  { s: 53, line: 'Esk.-Konya', km: '83+940', aciklikSerbest: '0,60', aciklikMesnet: '1', debuse: '0,60', yil: '1895', basinc: '22,5', cinsi: 'Taş Kapak' },
  { s: 54, line: 'Esk.-Konya', km: '84+367', aciklikSerbest: '1,00', aciklikMesnet: '1', debuse: '0,60', yil: '1895', basinc: '22,5', cinsi: 'Taş Kemer' },
  { s: 55, line: 'Esk.-Konya', km: '84+851', aciklikSerbest: '1,00', aciklikMesnet: '1', debuse: '0,50', yil: '1895', basinc: '22,5', cinsi: 'Taş Kemer' },
  { s: 56, line: 'Esk.-Konya', km: '85+152', aciklikSerbest: '1,00', aciklikMesnet: '1', debuse: '0,60', yil: '1895', basinc: '22,5', cinsi: 'Taş Kemer' },
  { s: 57, line: 'Esk.-Konya', km: '85+311', aciklikSerbest: '1,00', aciklikMesnet: '1', debuse: '0,60', yil: '1895', basinc: '22,5', cinsi: 'Taş Kemer' },
  { s: 58, line: 'Esk.-Konya', km: '85+723', aciklikSerbest: '2,00', aciklikMesnet: '', debuse: '2,30', yil: '1986', basinc: '22,5', cinsi: 'Betonarme' },
  { s: 59, line: 'Esk.-Konya', km: '86+011', aciklikSerbest: '6,00', aciklikMesnet: '3 *2,00', debuse: '3,00', yil: '2005', basinc: '22,5', cinsi: 'K. Menfez' },
  { s: 60, line: 'Esk.-Konya', km: '86+033', aciklikSerbest: '1,00', aciklikMesnet: '2*0,50', debuse: '0,50', yil: '1895', basinc: '22,5', cinsi: 'BÜZ' },
  { s: 61, line: 'Esk.-Konya', km: '86+909', aciklikSerbest: '0,60', aciklikMesnet: '', debuse: '0,60', yil: '1983', basinc: '22,5', cinsi: 'Demir Boru' },
  { s: 62, line: 'Esk.-Konya', km: '87+351', aciklikSerbest: '1,00', aciklikMesnet: '', debuse: '0,60', yil: '1895', basinc: '22,5', cinsi: 'Ferbeton' },
  { s: 63, line: 'Esk.-Konya', km: '88+215', aciklikSerbest: '4,00', aciklikMesnet: '2*2,00', debuse: '0,90', yil: '1895', basinc: '22,5', cinsi: 'Ferbeton' },
  { s: 64, line: 'Esk.-Konya', km: '89+126', aciklikSerbest: '0,60', aciklikMesnet: '', debuse: '0,60', yil: '1895', basinc: '22,5', cinsi: 'Demir Boru' },
  { s: 65, line: 'Esk.-Konya', km: '90+210', aciklikSerbest: '1,00', aciklikMesnet: '', debuse: '1,00', yil: '1895', basinc: '22,5', cinsi: 'Ferbeton' },
  { s: 66, line: 'Esk.-Konya', km: '90+771', aciklikSerbest: '1,00', aciklikMesnet: '', debuse: '0,60', yil: '1895', basinc: '22,5', cinsi: 'Ferbeton' },
  { s: 67, line: 'Esk.-Konya', km: '91+386', aciklikSerbest: '2,00', aciklikMesnet: '', debuse: '0,90', yil: '1895', basinc: '22,5', cinsi: 'Taş Kemer' },
  { s: 68, line: 'Esk.-Konya', km: '91+856', aciklikSerbest: '1,00', aciklikMesnet: '', debuse: '0,70', yil: '1895', basinc: '22,5', cinsi: 'Taş Kemer' },
  { s: 69, line: 'Esk.-Konya', km: '92+044', aciklikSerbest: '2,00', aciklikMesnet: '', debuse: '1,40', yil: '1895', basinc: '22,5', cinsi: 'Taş Kemer' },
  { s: 70, line: 'Esk.-Konya', km: '92+263', aciklikSerbest: '1,00', aciklikMesnet: '', debuse: '1,00', yil: '1895', basinc: '22,5', cinsi: 'Taş Kemer' },
  { s: 71, line: 'Esk.-Konya', km: '92+478', aciklikSerbest: '6,50', aciklikMesnet: '', debuse: '4,00', yil: '1895', basinc: '22,5', cinsi: 'Taş Kemer' },
  { s: 72, line: 'Esk.-Konya', km: '92+829', aciklikSerbest: '6,50', aciklikMesnet: '', debuse: '3,70', yil: '1895', basinc: '22,5', cinsi: 'Taş Kemer' },
  { s: 73, line: 'Esk.-Konya', km: '93+090', aciklikSerbest: '6,50', aciklikMesnet: '', debuse: '4,00', yil: '1895', basinc: '22,5', cinsi: 'Taş Kemer' },
  { s: 74, line: 'Esk.-Konya', km: '93+254', aciklikSerbest: '1,00', aciklikMesnet: '', debuse: '0,70', yil: '1895', basinc: '22,5', cinsi: 'Taş Kemer' },
  { s: 75, line: 'Esk.-Konya', km: '93+590', aciklikSerbest: '6,50', aciklikMesnet: '', debuse: '4,00', yil: '1895', basinc: '22,5', cinsi: 'Taş Kemer' },
  { s: 76, line: 'Esk.-Konya', km: '93+858', aciklikSerbest: '6,50', aciklikMesnet: '', debuse: '4,00', yil: '1895', basinc: '22,5', cinsi: 'Taş Kemer' },
  { s: 77, line: 'Esk.-Konya', km: '94+074', aciklikSerbest: '6,50', aciklikMesnet: '1', debuse: '4,00', yil: '1895', basinc: '22,5', cinsi: 'Taş Kemer' },
  { s: 78, line: 'Esk.-Konya', km: '94+289', aciklikSerbest: '6,50', aciklikMesnet: '1', debuse: '4,00', yil: '1895', basinc: '22,5', cinsi: 'Taş Kemer' },
  { s: 79, line: 'Esk.-Konya', km: '94+660', aciklikSerbest: '3,00', aciklikMesnet: '1', debuse: '2,10', yil: '1895', basinc: '22,5', cinsi: 'Ferbeton' },
  { s: 80, line: 'Esk.-Konya', km: '95+102', aciklikSerbest: '1,00', aciklikMesnet: '1', debuse: '1,00', yil: '1895', basinc: '22,5', cinsi: 'Ferbeton' },
  { s: 81, line: 'Esk.-Konya', km: '95+450', aciklikSerbest: '1,00', aciklikMesnet: '1', debuse: '0,60', yil: '1895', basinc: '22,5', cinsi: 'Taş Kemer' },
  { s: 82, line: 'Esk.-Konya', km: '96+839', aciklikSerbest: '1,00', aciklikMesnet: '1', debuse: '0,60', yil: '1895', basinc: '22,5', cinsi: 'Ferbeton' },
  { s: 83, line: 'Esk.-Konya', km: '97+354', aciklikSerbest: '1,00', aciklikMesnet: '1', debuse: '1,10', yil: '1895', basinc: '22,5', cinsi: 'Ferbeton' },
  { s: 84, line: 'Esk.-Konya', km: '98+108', aciklikSerbest: '5,00', aciklikMesnet: '1', debuse: '2,00', yil: '1895', basinc: '22,5', cinsi: 'Ferbeton' },
  { s: 85, line: 'Esk.-Konya', km: '99+561', aciklikSerbest: '0,60', aciklikMesnet: '1', debuse: '0,60', yil: '1895', basinc: '22,5', cinsi: 'Demir Boru' },
  { s: 86, line: 'Alayunt Müselles', km: '0+700', aciklikSerbest: '3,00', aciklikMesnet: '', debuse: '0,80', yil: '1894', basinc: '22,5', cinsi: 'Ferbeton' },
  { s: 87, line: 'Alayunt Müselles', km: '0+700', aciklikSerbest: '3,00', aciklikMesnet: '', debuse: '2,00', yil: '1987', basinc: '22,5', cinsi: 'Betonarme' }
];

function parseKmVal(str: string): number | null {
  if (!str) return null;
  const m = str.match(/(\d{1,4})[+\-](\d{1,4})/);
  if (m) {
    return parseInt(m[1], 10) * 1000 + parseInt(m[2], 10);
  }
  return null;
}

const pointsFilePath = path.join(process.cwd(), 'data', 'railway_points.json');
const currentPoints: any[] = JSON.parse(fs.readFileSync(pointsFilePath, 'utf-8'));

// Extract Esk.-Konya track reference points
const eskControls: { m: number; lat: number; lng: number; title: string }[] = [];
currentPoints.forEach((p) => {
  const m = parseKmVal(p.kmValue || p.title);
  if (m !== null && m >= 53000) {
    eskControls.push({ m, lat: p.lat, lng: p.lng, title: p.title });
  }
});
eskControls.sort((a, b) => a.m - b.m);

// Dedup exact meter values
const controls: { m: number; lat: number; lng: number }[] = [];
eskControls.forEach((c) => {
  if (controls.length === 0 || controls[controls.length - 1].m !== c.m) {
    controls.push(c);
  }
});

function interpolateEskKonya(mTarget: number): { lat: number; lng: number } {
  // Check exact
  const exact = controls.find((c) => c.m === mTarget);
  if (exact) return { lat: exact.lat, lng: exact.lng };

  let lower: { m: number; lat: number; lng: number } | null = null;
  let upper: { m: number; lat: number; lng: number } | null = null;

  for (let i = 0; i < controls.length; i++) {
    if (controls[i].m <= mTarget) lower = controls[i];
    if (controls[i].m >= mTarget && !upper) {
      upper = controls[i];
      break;
    }
  }

  if (lower && upper) {
    const ratio = (mTarget - lower.m) / (upper.m - lower.m);
    const lat = lower.lat + (upper.lat - lower.lat) * ratio;
    const lng = lower.lng + (upper.lng - lower.lng) * ratio;
    return { lat, lng };
  }
  if (lower) return { lat: lower.lat, lng: lower.lng };
  if (upper) return { lat: upper.lat, lng: upper.lng };
  return { lat: 39.484315, lng: 30.155717 };
}

// Alayunt Müselles reference coords:
// 0+813 M28: 39.3913552, 30.0981949
// 0+813 M24: 39.3913063, 30.0984277
// 0+903 M32: 39.3913371, 30.0973819
function getAlayuntCoords(kmMeters: number): { lat: number; lng: number } {
  // 0+700 is 113 meters before 0+813 towards station
  // M24 (0+813) is 39.3913063, 30.0984277
  // Alayunt İstasyon (KM 66+874) is 39.395401, 30.105404
  const m24 = { lat: 39.3913063, lng: 30.0984277, m: 813 };
  const station = { lat: 39.395401, lng: 30.105404, m: 0 };
  const ratio = (813 - kmMeters) / 813;
  return {
    lat: m24.lat + (station.lat - m24.lat) * ratio,
    lng: m24.lng + (station.lng - m24.lng) * ratio,
  };
}

const now = new Date().toISOString();
let addedCount = 0;
let updatedCount = 0;

culvertsData.forEach((item) => {
  const m = parseKmVal(item.km);
  if (!m) return;

  // Check if already exists in currentPoints (like KM 54+673 or KM 54+692)
  const existingIdx = currentPoints.findIndex(
    (p) => (p.category === 'culvert' || p.category === 'km_marker') && (p.kmValue === item.km || p.title === `KM ${item.km}`)
  );

  let coords: { lat: number; lng: number };
  if (item.line.includes('Alayunt')) {
    coords = getAlayuntCoords(m);
  } else {
    coords = interpolateEskKonya(m);
  }

  const culvertDetails = {
    siraNo: item.s,
    hatti: item.line,
    mihverKlm: item.km,
    aciklikSerbest: item.aciklikSerbest,
    aciklikMesnet: item.aciklikMesnet,
    debuseYuksekligi: item.debuse,
    yapimYili: item.yil,
    dingilBasinci: item.basinc,
    cinsi: item.cinsi,
    bakimSefligi: '712 YOL BAKIM ŞEFLİĞİ',
  };

  const desc = `712 Yol Bakım Şefliği Menfez Kaydı\n` +
    `Sıra No: ${item.s}\n` +
    `Hattı: ${item.line}\n` +
    `Mihver Km: ${item.km}\n` +
    `Cinsi: ${item.cinsi}\n` +
    `Açıklık (Serbest): ${item.aciklikSerbest} m | Mesnet: ${item.aciklikMesnet || '-'}\n` +
    `Debuşe Yüksekliği: ${item.debuse} m\n` +
    `Yapım Yılı: ${item.yil} | Dingil Basıncı: ${item.basinc} Ton`;

  if (existingIdx !== -1) {
    // Update existing culvert point
    currentPoints[existingIdx].category = 'culvert';
    currentPoints[existingIdx].culvert = { ...currentPoints[existingIdx].culvert, ...culvertDetails };
    currentPoints[existingIdx].description = desc;
    currentPoints[existingIdx].updatedAt = now;
    updatedCount++;
  } else {
    // Create new culvert point
    const newPoint = {
      id: `pt-culvert-${item.km.replace('+', '-')}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: `KM ${item.km}`,
      kmValue: item.km,
      lineName: item.line === 'Alayunt Müselles' ? 'Alayunt Müselles' : 'Eskişehir-Konya',
      locationDesc: `712 YOL BAKIM ŞEFLİĞİ - ${item.cinsi} Menfez`,
      category: 'culvert',
      lat: Number(coords.lat.toFixed(7)),
      lng: Number(coords.lng.toFixed(7)),
      description: desc,
      textStyle: {
        color: '#0f172a',
        fontFamily: 'sans',
        fontWeight: 'normal',
        fontStyle: 'normal',
        textDecoration: 'none',
        lineHeight: 'normal',
        textAlign: 'left',
        fontSize: 'sm',
      },
      titleTextStyle: {
        color: '#4338ca',
        fontFamily: 'sans',
        fontWeight: 'bold',
        fontStyle: 'normal',
        textDecoration: 'none',
        lineHeight: 'normal',
        textAlign: 'left',
        fontSize: 'sm',
      },
      culvert: culvertDetails,
      notes: [],
      photos: [],
      createdAt: now,
      updatedAt: now,
    };
    currentPoints.push(newPoint);
    addedCount++;
  }
});

// Write to railway_points.json
fs.writeFileSync(pointsFilePath, JSON.stringify(currentPoints, null, 2), 'utf-8');

console.log(`Process Complete! Added: ${addedCount}, Updated: ${updatedCount}, Total Points in DB: ${currentPoints.length}`);
