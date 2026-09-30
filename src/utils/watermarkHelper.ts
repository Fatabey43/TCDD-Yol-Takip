import { RailwayPoint } from './types.ts';
import { RailwayWatermarkOptions } from './utils/imageCompressor.ts';

export function getWatermarkOptionsForPoint(point: RailwayPoint, takenAt?: string): RailwayWatermarkOptions {
  let extraDetails = '';
  if (point.category === 'crossing' && point.levelCrossing) {
    const parts = [
      point.levelCrossing.crossingType ? `Tip: ${point.levelCrossing.crossingType}` : '',
      point.levelCrossing.surfaceType ? `Kaplama: ${point.levelCrossing.surfaceType}` : '',
      point.levelCrossing.nereleriBagladigi ? `Güzergah: ${point.levelCrossing.nereleriBagladigi}` : '',
    ].filter(Boolean);
    extraDetails = parts.join(' | ');
  } else if (point.category === 'culvert' && point.culvert) {
    const parts = [
      point.culvert.cinsi ? `Cins: ${point.culvert.cinsi}` : '',
      point.culvert.aciklikSerbest ? `Açıklık: ${point.culvert.aciklikSerbest}m` : '',
      point.culvert.debuseYuksekligi ? `Debuşe: ${point.culvert.debuseYuksekligi}m` : '',
      point.culvert.yapimYili ? `Yıl: ${point.culvert.yapimYili}` : '',
    ].filter(Boolean);
    extraDetails = parts.join(' | ');
  }

  let formattedDate = '';
  if (takenAt) {
    try {
      const d = new Date(takenAt);
      if (!isNaN(d.getTime())) {
        formattedDate = d.toLocaleString('tr-TR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
    } catch {}
  }

  return {
    title: point.title,
    kmValue: point.kmValue || point.title,
    lineName: point.lineName,
    category: point.category,
    organization: 'TCDD 712 YOL BAKIM ŞEFLİĞİ',
    dateTime: formattedDate || undefined,
    coords: { lat: point.lat, lng: point.lng },
    extraDetails: extraDetails || undefined,
  };
}
