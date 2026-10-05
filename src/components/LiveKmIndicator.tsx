import React from 'react';
import { Navigation2, MapPin, AlertCircle, Compass, ListFilter, Crosshair, Check, X } from 'lucide-react';
import { NearestKmResult } from '../utils/liveRailwayKm.ts';

interface LiveKmIndicatorProps {
  gpsLocation: { lat: number; lng: number; accuracy?: number } | null;
  nearestKm: NearestKmResult | null;
  isLocating: boolean;
  onRefreshGps: () => void;
  onPanToMyLocation: () => void;
  onOpenSelectPoint?: () => void;
  onClose?: () => void;
  isManualPointMode?: boolean;
  selectedPointTitle?: string | null;
}

export const LiveKmIndicator: React.FC<LiveKmIndicatorProps> = ({
  gpsLocation,
  nearestKm,
  isLocating,
  onRefreshGps,
  onPanToMyLocation,
  onOpenSelectPoint,
  onClose,
  isManualPointMode = false,
  selectedPointTitle,
}) => {
  if (!gpsLocation && !isLocating) {
    return (
      <div className="fixed top-20 left-4 z-20 flex items-center gap-1.5 flex-wrap">
        <button
          onClick={onRefreshGps}
          className="bg-slate-900/90 hover:bg-slate-900 border border-slate-700/80 text-white px-3 py-2 rounded-xl shadow-xl flex items-center gap-2 text-xs font-semibold backdrop-blur-md transition-all active:scale-95 cursor-pointer group"
          title="Canlı Saha KM Göstergesini Başlat (GPS)"
        >
          <div className="w-6 h-6 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Navigation2 className="w-3.5 h-3.5 stroke-[2.5]" />
          </div>
          <span>Canlı Saha KM Aç</span>
        </button>

        {onOpenSelectPoint && (
          <button
            onClick={onOpenSelectPoint}
            className="bg-sky-950/90 hover:bg-sky-900 border border-sky-500/50 text-sky-200 hover:text-white px-3 py-2 rounded-xl shadow-xl flex items-center gap-1.5 text-xs font-bold backdrop-blur-md transition-all active:scale-95 cursor-pointer"
            title="Kayıtlı noktalardan canlı referans noktası seç"
          >
            <ListFilter className="w-3.5 h-3.5 text-sky-400" />
            <span>Nokta Seç</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      id="live-km-indicator"
      className="fixed top-20 left-4 z-20 bg-slate-900/95 border border-sky-500/40 rounded-2xl shadow-2xl p-3 text-white backdrop-blur-md transition-all max-w-[290px] sm:max-w-xs animate-in fade-in slide-in-from-top-4 duration-200"
    >
      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className={`w-2.5 h-2.5 rounded-full ${isManualPointMode ? 'bg-amber-400' : 'bg-emerald-400'} animate-ping absolute`} />
            <div className={`w-2.5 h-2.5 rounded-full ${isManualPointMode ? 'bg-amber-500' : 'bg-emerald-500'} relative`} />
          </div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-400 flex items-center gap-1">
            <Compass className="w-3.5 h-3.5" />
            <span>{isManualPointMode ? 'Seçili Saha KM' : 'Canlı Saha KM'}</span>
          </span>
        </div>

        <div className="flex items-center gap-1">
          {onOpenSelectPoint && (
            <button
              onClick={onOpenSelectPoint}
              className="p-1 text-sky-400 hover:text-white rounded hover:bg-sky-900/50 transition-colors flex items-center gap-0.5 text-[10px] font-bold px-1.5 bg-sky-950 border border-sky-500/40"
              title="Noktayı Değiştir / Listeden veya Haritadan Seç"
            >
              <ListFilter className="w-3 h-3" />
              <span>Nokta Seç</span>
            </button>
          )}

          <button
            onClick={onPanToMyLocation}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
            title="Haritada Bu Konuma Git"
          >
            <MapPin className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRefreshGps}
            className={`p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors ${
              isLocating ? 'animate-spin text-sky-400' : ''
            }`}
            title="Canlı GPS Konumunu Yenile"
          >
            <Navigation2 className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors ml-0.5"
              title="Canlı KM Göstergesini Kapat"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="pt-2">
        {nearestKm ? (
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] text-slate-400">
                {isManualPointMode ? 'Seçilen Ray KM:' : 'Bulunduğunuz Ray KM:'}
              </span>
              <span className="text-lg font-black text-amber-300 font-mono tracking-wide">
                KM {nearestKm.chainageKm}
              </span>
            </div>

            <div className="mt-1 space-y-0.5 text-[11px]">
              <div className="flex items-center justify-between text-slate-300">
                <span>Raya Uzaklık:</span>
                <span className={`font-bold ${nearestKm.isOffTrack ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {nearestKm.distanceToRailMeters} metre
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400 truncate">
                <span>En Yakın Nokta:</span>
                <span className="font-semibold text-slate-200 truncate ml-2">
                  {nearestKm.nearestPointTitle} ({nearestKm.nearestPointDistance}m)
                </span>
              </div>
              {selectedPointTitle && (
                <div className="text-[10px] text-sky-300/80 truncate pt-0.5 border-t border-slate-800/80">
                  Referans: {selectedPointTitle}
                </div>
              )}
            </div>

            {nearestKm.isOffTrack && !isManualPointMode && (
              <div className="mt-2 text-[10px] bg-amber-500/15 border border-amber-500/30 text-amber-300 px-2 py-1 rounded-lg flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Ray ekseninden 200m+ uzaktasınız.</span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-slate-400 py-1">
            {isLocating ? 'Demiryolu KM zinciri hesaplanıyor...' : 'GPS sinyali bekleniyor...'}
          </div>
        )}
      </div>
    </div>
  );
};
