import React from 'react';
import { Navigation2, MapPin, AlertCircle, Compass } from 'lucide-react';
import { NearestKmResult } from '../utils/liveRailwayKm.ts';

interface LiveKmIndicatorProps {
  gpsLocation: { lat: number; lng: number; accuracy?: number } | null;
  nearestKm: NearestKmResult | null;
  isLocating: boolean;
  onRefreshGps: () => void;
  onPanToMyLocation: () => void;
}

export const LiveKmIndicator: React.FC<LiveKmIndicatorProps> = ({
  gpsLocation,
  nearestKm,
  isLocating,
  onRefreshGps,
  onPanToMyLocation,
}) => {
  if (!gpsLocation && !isLocating) {
    return (
      <button
        onClick={onRefreshGps}
        className="fixed top-20 left-4 z-20 bg-slate-900/90 hover:bg-slate-900 border border-slate-700/80 text-white px-3 py-2 rounded-xl shadow-xl flex items-center gap-2 text-xs font-semibold backdrop-blur-md transition-all active:scale-95 cursor-pointer group"
        title="Canlı Saha KM Göstergesini Başlat"
      >
        <div className="w-6 h-6 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center group-hover:scale-110 transition-transform">
          <Navigation2 className="w-3.5 h-3.5 stroke-[2.5]" />
        </div>
        <span>Canlı Saha KM Aç</span>
      </button>
    );
  }

  return (
    <div
      id="live-km-indicator"
      className="fixed top-20 left-4 z-20 bg-slate-900/95 border border-sky-500/40 rounded-2xl shadow-2xl p-3 text-white backdrop-blur-md transition-all max-w-[280px] sm:max-w-xs animate-in fade-in slide-in-from-top-4 duration-200"
    >
      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping absolute" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 relative" />
          </div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-400 flex items-center gap-1">
            <Compass className="w-3.5 h-3.5" /> Canlı Saha KM
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onPanToMyLocation}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
            title="Haritada Konumuma Git"
          >
            <MapPin className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRefreshGps}
            className={`p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors ${
              isLocating ? 'animate-spin text-sky-400' : ''
            }`}
            title="GPS Konumunu Güncelle"
          >
            <Navigation2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="pt-2">
        {nearestKm ? (
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] text-slate-400">Bulunduğunuz Ray KM:</span>
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
            </div>

            {nearestKm.isOffTrack && (
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
