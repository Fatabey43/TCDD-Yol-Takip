import React from 'react';
import { RailwayPoint } from '../types.ts';

interface PhotoWatermarkBadgeProps {
  point: RailwayPoint;
  dateStr?: string;
  isCompact?: boolean;
}

export const PhotoWatermarkBadge: React.FC<PhotoWatermarkBadgeProps> = ({
  point,
  dateStr,
  isCompact = false,
}) => {
  const org = 'TCDD 712 YOL BAKIM ŞEFLİĞİ';
  const line = point.lineName ? `Hat: ${point.lineName}` : 'Hat: Eskişehir - Konya';
  const kmText = point.kmValue ? `KM: ${point.kmValue}` : (point.title || '');

  // Format crossing & culvert technical details
  let extraDetails = '';
  let categoryLabel = '';
  if (point.category === 'crossing') {
    categoryLabel = '🚧 HEMZEMİN GEÇİT';
    if (point.levelCrossing) {
      const parts = [
        point.levelCrossing.crossingType ? `Tip: ${point.levelCrossing.crossingType}` : '',
        point.levelCrossing.surfaceType ? `Kaplama: ${point.levelCrossing.surfaceType}` : '',
        point.levelCrossing.nereleriBagladigi ? `Güzergah: ${point.levelCrossing.nereleriBagladigi}` : '',
      ].filter(Boolean);
      extraDetails = parts.join(' | ');
    }
  } else if (point.category === 'culvert') {
    categoryLabel = '🧱 MENFEZ';
    if (point.culvert) {
      const parts = [
        point.culvert.cinsi ? `Cins: ${point.culvert.cinsi}` : '',
        point.culvert.aciklikSerbest ? `Açıklık: ${point.culvert.aciklikSerbest}m` : '',
        point.culvert.debuseYuksekligi ? `Debuşe: ${point.culvert.debuseYuksekligi}m` : '',
        point.culvert.yapimYili ? `Yıl: ${point.culvert.yapimYili}` : '',
      ].filter(Boolean);
      extraDetails = parts.join(' | ');
    }
  } else if (point.category === 'switch') {
    categoryLabel = '🔀 MAKAS';
  } else {
    categoryLabel = '📍 TCDD DEMİRYOLU';
  }

  const now = dateStr || new Date().toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const coordText = point.lat && point.lng ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` : '';

  if (isCompact) {
    return (
      <div className="absolute inset-x-0 bottom-0 pointer-events-none bg-gradient-to-t from-slate-950/95 via-slate-950/75 to-transparent pt-4 pb-1 px-2 border-b-2 border-amber-400">
        <div className="text-[10px] font-bold text-sky-300 leading-tight truncate">
          {org}
        </div>
        <div className="text-[10px] font-extrabold text-white leading-tight truncate">
          {point.title} — {kmText}
        </div>
        {extraDetails && (
          <div className="text-[9px] font-semibold text-amber-300 truncate">
            {extraDetails}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="absolute inset-x-0 bottom-0 pointer-events-none bg-gradient-to-t from-slate-950/98 via-slate-950/85 to-transparent pt-8 pb-3 px-4 text-left border-t border-amber-400/80 shadow-2xl">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between text-xs font-bold text-sky-400">
          <span className="flex items-center gap-1.5">
            <span>📍</span>
            <span>{org}</span>
          </span>
          <span className="text-[11px] font-mono text-slate-300">
            {coordText && `GPS: ${coordText}`}
          </span>
        </div>

        <div className="text-sm font-black text-white flex items-center gap-2 flex-wrap drop-shadow-md">
          <span className="text-amber-400">{categoryLabel}:</span>
          <span>{point.title}</span>
          <span className="text-slate-400 font-normal">|</span>
          <span className="text-emerald-300 font-mono">{line}</span>
          <span className="text-slate-400 font-normal">|</span>
          <span className="text-amber-300 font-mono font-bold">{kmText}</span>
        </div>

        {extraDetails && (
          <div className="text-xs font-semibold text-amber-200/90 flex items-center gap-1 drop-shadow-sm">
            <span>⚙️</span>
            <span>{extraDetails}</span>
          </div>
        )}

        <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between pt-0.5 border-t border-slate-700/60 mt-0.5">
          <span>📅 Çekim &amp; Saha Kaydı: {now}</span>
          <span className="text-sky-300/80 text-[10px]">TCDD 7. BÖLGE MÜDÜRLÜĞÜ</span>
        </div>
      </div>
    </div>
  );
};
