import React from 'react';
import { RailwayWatermarkOptions } from '../utils/imageCompressor.ts';

interface StampedPhotoViewProps {
  dataUrl: string;
  alt?: string;
  className?: string;
  watermark: RailwayWatermarkOptions;
  compact?: boolean;
}

export const StampedPhotoView: React.FC<StampedPhotoViewProps> = ({
  dataUrl,
  alt = 'Saha Fotoğrafı',
  className = 'w-full h-full object-cover',
  watermark,
  compact = false,
}) => {
  const org = watermark.organization || 'TCDD 712 YOL BAKIM ŞEFLİĞİ';
  const line = watermark.lineName ? `Hat: ${watermark.lineName}` : 'Hat: Eskişehir - Konya';
  const kmText = watermark.kmValue ? `KM: ${watermark.kmValue}` : '';

  let categoryBadge = 'TCDD DEMİRYOLU';
  let badgeIcon = '📍';
  let accentColor = '#38bdf8'; // Sky blue

  if (watermark.category === 'crossing') {
    categoryBadge = 'HEMZEMİN GEÇİT';
    badgeIcon = '🚧';
    accentColor = '#f59e0b'; // Warning Amber
  } else if (watermark.category === 'culvert') {
    categoryBadge = 'MENFEZ / KÖPRÜ';
    badgeIcon = '🧱';
    accentColor = '#10b981'; // Emerald
  } else if (watermark.category === 'switch') {
    categoryBadge = 'MAKAS BÖLGESİ';
    badgeIcon = '🔀';
    accentColor = '#a855f7'; // Purple
  }

  const dateStr = watermark.dateTime || new Date().toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const coordStr = watermark.coords ? `${watermark.coords.lat.toFixed(5)}°K, ${watermark.coords.lng.toFixed(5)}°D` : '';

  return (
    <div className="relative w-full h-full overflow-hidden group select-none bg-slate-950 font-sans">
      <img
        src={dataUrl}
        alt={alt}
        className={className}
        loading="lazy"
      />

      {/* Official TCDD HUD Stamped Watermark Overlay */}
      <div className="absolute inset-x-0 bottom-0 pointer-events-none bg-gradient-to-t from-slate-950 via-slate-950/85 to-transparent pt-8 pb-2.5 px-3 text-white">
        {/* Reflective Hazard Warning Stripe */}
        <div
          className="h-[3px] w-full mb-2 rounded-full shadow-lg"
          style={{
            background: watermark.category === 'crossing'
              ? 'repeating-linear-gradient(45deg, #f59e0b, #f59e0b 10px, #0f172a 10px, #0f172a 20px)'
              : 'linear-gradient(90deg, #38bdf8, #818cf8, #38bdf8)',
          }}
        />

        {compact ? (
          /* Thumbnail / Compact View */
          <div className="space-y-0.5 text-left">
            <div className="flex items-center justify-between text-[9px] font-bold">
              <span className="text-sky-300 tracking-wider truncate flex items-center gap-1">
                <span>{badgeIcon}</span>
                <span>{org}</span>
              </span>
              <span
                className="px-1.5 py-0.2 rounded-full text-[8px] font-black uppercase tracking-wider shrink-0 text-slate-950"
                style={{ backgroundColor: accentColor }}
              >
                {categoryBadge}
              </span>
            </div>

            <div className="text-[11px] font-black text-white truncate drop-shadow-md">
              {watermark.title} {kmText ? `• ${kmText}` : ''}
            </div>

            {watermark.extraDetails && (
              <div className="text-[9px] text-amber-300 font-semibold truncate flex items-center gap-1">
                <span className="opacity-80">⚙️</span>
                <span>{watermark.extraDetails}</span>
              </div>
            )}
          </div>
        ) : (
          /* Full Lightbox View (Official High-Tech Engineering Layout) */
          <div className="space-y-1.5 text-left">
            {/* Top Bar: Organization & Category Ribbon & Coordinates */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-md bg-sky-500/20 text-sky-400 border border-sky-400/30 text-xs">
                  {badgeIcon}
                </span>
                <span className="text-xs font-extrabold text-sky-300 tracking-wider uppercase">
                  {org}
                </span>
                <span
                  className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider text-slate-950 shadow-sm"
                  style={{ backgroundColor: accentColor }}
                >
                  {categoryBadge}
                </span>
              </div>

              {coordStr && (
                <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 px-2 py-0.5 rounded-md text-[10px] font-mono text-emerald-300 font-bold shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>GPS: {coordStr}</span>
                </div>
              )}
            </div>

            {/* Middle Bar: Title, Line, Kilometer */}
            <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/60 p-2 rounded-xl flex items-center justify-between gap-3 flex-wrap shadow-inner">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm sm:text-base font-black text-white tracking-wide drop-shadow-sm">
                  {watermark.title}
                </span>
                <span className="text-slate-500 font-bold">•</span>
                <span className="text-xs font-semibold text-sky-300 bg-sky-950/60 border border-sky-800/60 px-2 py-0.5 rounded-lg">
                  {line}
                </span>
                {kmText && (
                  <span className="text-xs font-mono font-black text-amber-300 bg-amber-950/60 border border-amber-700/60 px-2 py-0.5 rounded-lg">
                    {kmText}
                  </span>
                )}
              </div>

              {/* Extra Details Badge (Crossing Type, Surface, Culvert Dimensions) */}
              {watermark.extraDetails && (
                <div className="text-xs font-bold text-amber-200 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-xs">
                  <span className="text-amber-400">⚙️</span>
                  <span>{watermark.extraDetails}</span>
                </div>
              )}
            </div>

            {/* Bottom Footer: Official Verification & Timestamp */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5 border-t border-slate-800/80">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-300">📅 Saha Tespit &amp; Çekim:</span>
                <span className="text-white font-mono font-bold">{dateStr}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-[10px] hidden sm:inline">DİJİTAL SAHA DOĞRULAMA SİSTEMİ</span>
                <span className="text-sky-400 font-bold text-[10px] bg-sky-900/40 border border-sky-700/50 px-2 py-0.5 rounded-full">
                  TCDD 7. BÖLGE MÜDÜRLÜĞÜ
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
