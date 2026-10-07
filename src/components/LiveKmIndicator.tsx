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
    return null;
  }

  return (
    <div
      id="live-km-indicator"
      className="absolute bottom-4 left-4 z-20 bg-white border border-slate-200 rounded-xl shadow-xl p-3 text-slate-800 max-w-[290px] sm:max-w-xs"
    >
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
            <Compass className="w-3.5 h-3.5 text-sky-600" />
            <span>{isManualPointMode ? 'Seçili Saha KM' : 'Canlı Saha KM'}</span>
          </span>
        </div>

        <div className="flex items-center gap-1">
          {onOpenSelectPoint && (
            <button
              onClick={onOpenSelectPoint}
              className="p-1 text-slate-700 hover:text-sky-700 hover:bg-slate-100 rounded transition-colors flex items-center gap-0.5 text-[10px] font-bold px-1.5 bg-slate-50 border border-slate-200 cursor-pointer"
              title="Noktayı Değiştir / Listeden Seç"
            >
              <ListFilter className="w-3 h-3" />
              <span>Nokta Seç</span>
            </button>
          )}

          <button
            onClick={onPanToMyLocation}
            className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
            title="Haritada Bu Konuma Git"
          >
            <MapPin className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRefreshGps}
            className={`p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer ${
              isLocating ? 'animate-spin text-sky-600' : ''
            }`}
            title="Canlı GPS Konumunu Yenile"
          >
            <Navigation2 className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors ml-0.5 cursor-pointer"
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
              <span className="text-[11px] text-slate-500 font-medium">
                {isManualPointMode ? 'Seçilen Ray KM:' : 'Bulunduğunuz KM:'}
              </span>
              <span className="text-base sm:text-lg font-black text-sky-700 font-mono tracking-tight">
                KM {nearestKm.chainageKm}
              </span>
            </div>

            <div className="mt-1 space-y-0.5 text-[11px]">
              <div className="flex items-center justify-between text-slate-600">
                <span>Raya Uzaklık:</span>
                <span className={`font-bold ${nearestKm.isOffTrack ? 'text-amber-600' : 'text-emerald-700'}`}>
                  {nearestKm.distanceToRailMeters} m
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-500 truncate">
                <span>En Yakın:</span>
                <span className="font-semibold text-slate-700 truncate ml-2">
                  {nearestKm.nearestPointTitle} ({nearestKm.nearestPointDistance}m)
                </span>
              </div>
              {selectedPointTitle && (
                <div className="text-[10px] text-slate-500 truncate pt-1 border-t border-slate-100 mt-1">
                  Referans: {selectedPointTitle}
                </div>
              )}
            </div>

            {nearestKm.isOffTrack && !isManualPointMode && (
              <div className="mt-1.5 text-[10px] bg-amber-50 border border-amber-200 text-amber-800 px-2 py-1 rounded-lg flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                <span>Ray ekseninden 200m+ uzaktasınız.</span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-slate-500 py-1">
            {isLocating ? 'Demiryolu KM zinciri hesaplanıyor...' : 'GPS sinyali bekleniyor...'}
          </div>
        )}
      </div>
    </div>
  );
};

