import React from 'react';
import { Crosshair, Edit3, Locate, X, Sparkles, MapPin } from 'lucide-react';

interface PointAddChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPickOnMap: () => void;
  onOpenManualForm: () => void;
  onUseGpsDirect: () => void;
}

export const PointAddChoiceModal: React.FC<PointAddChoiceModalProps> = ({
  isOpen,
  onClose,
  onPickOnMap,
  onOpenManualForm,
  onUseGpsDirect,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="point-add-choice-modal"
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700/80 w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl p-5 text-white overflow-hidden animate-in slide-in-from-bottom-8 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar on mobile */}
        <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-4 sm:hidden" />

        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Nokta Ekleme Yöntemi</h3>
              <p className="text-[11px] text-slate-400">Konum belirleme şeklini seçin</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options */}
        <div className="py-4 space-y-2.5">
          {/* OPTION 1: Haritadan Seç & Otomatik Konum Al (Recommended) */}
          <button
            id="choice-pick-on-map-btn"
            type="button"
            onClick={() => {
              onClose();
              onPickOnMap();
            }}
            className="w-full flex items-center gap-3.5 p-3.5 bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-transparent hover:from-amber-500/25 active:scale-[0.98] border-2 border-amber-500/60 hover:border-amber-400 rounded-2xl transition-all text-left cursor-pointer group"
          >
            <div className="w-11 h-11 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/30 group-hover:scale-105 transition-transform shrink-0">
              <Crosshair className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-amber-300">Haritadan Seç &amp; İşaretle</span>
                <span className="text-[9px] font-bold bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                  <Sparkles className="w-2.5 h-2.5" /> En Kolay
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-snug mt-0.5">
                Haritada istediğiniz hatta dokunun, koordinatlar ve konum otomatik kaydedilsin.
              </p>
            </div>
          </button>

          {/* OPTION 2: Canlı GPS Konumumu Kullan */}
          <button
            id="choice-use-gps-btn"
            type="button"
            onClick={() => {
              onClose();
              onUseGpsDirect();
            }}
            className="w-full flex items-center gap-3.5 p-3.5 bg-slate-800/80 hover:bg-slate-800 active:scale-[0.98] border border-slate-700 hover:border-sky-500/50 rounded-2xl transition-all text-left cursor-pointer group"
          >
            <div className="w-11 h-11 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
              <Locate className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-bold text-sm text-slate-100 block">Bulunduğum Canlı GPS Konumunu Al</span>
              <p className="text-xs text-slate-400 leading-snug mt-0.5">
                Şu an sahada bulunduğunuz koordinatı cihazınızın GPS'inden otomatik çeker.
              </p>
            </div>
          </button>

          {/* OPTION 3: Formu Açıp Manuel Koordinat Gir */}
          <button
            id="choice-manual-form-btn"
            type="button"
            onClick={() => {
              onClose();
              onOpenManualForm();
            }}
            className="w-full flex items-center gap-3.5 p-3 bg-slate-800/50 hover:bg-slate-800 active:scale-[0.98] border border-slate-700/60 rounded-2xl transition-all text-left cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-700/60 text-slate-300 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
              <Edit3 className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-xs text-slate-200 block">Formu Doğrudan Aç (Manuel Yaz)</span>
              <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                Enlem ve boylamı klavyeden elle yazmak veya kopyalayıp yapıştırmak için.
              </p>
            </div>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
        >
          Kapat
        </button>
      </div>
    </div>
  );
};
