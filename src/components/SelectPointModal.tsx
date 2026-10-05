import React, { useState, useMemo } from 'react';
import { RailwayPoint } from '../types.ts';
import { formatKmDisplay } from '../utils/categoryColors.ts';
import { sortPointsByKm } from '../utils/kmUtils.ts';
import {
  MapPin,
  Search,
  X,
  Crosshair,
  Compass,
  Train,
  CheckCircle2,
  Navigation,
} from 'lucide-react';

interface SelectPointModalProps {
  isOpen: boolean;
  onClose: () => void;
  points: RailwayPoint[];
  onSelectPointAsLive: (point: RailwayPoint) => void;
  onStartPickOnMap: () => void;
  currentLiveKm?: string | null;
}

export const SelectPointModal: React.FC<SelectPointModalProps> = ({
  isOpen,
  onClose,
  points,
  onSelectPointAsLive,
  onStartPickOnMap,
  currentLiveKm,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLine, setSelectedLine] = useState<string>('all');

  const availableLines = useMemo(() => {
    const set = new Set<string>();
    points.forEach((p) => {
      if (p.lineName) set.add(p.lineName);
    });
    return Array.from(set);
  }, [points]);

  const sortedPoints = useMemo(() => sortPointsByKm(points), [points]);

  const filteredPoints = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return sortedPoints.filter((p) => {
      const matchLine = selectedLine === 'all' || p.lineName === selectedLine;
      if (!matchLine) return false;
      if (!q) return true;

      const titleMatch = (p.title || '').toLowerCase().includes(q);
      const kmMatch = (p.kmValue || '').toLowerCase().includes(q);
      const descMatch = (p.locationDesc || '').toLowerCase().includes(q);
      const lineMatchText = (p.lineName || '').toLowerCase().includes(q);
      return titleMatch || kmMatch || descMatch || lineMatchText;
    });
  }, [sortedPoints, searchTerm, selectedLine]);

  if (!isOpen) return null;

  return (
    <div
      id="select-live-point-modal"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white border-b border-sky-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center shadow-lg text-white">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base tracking-tight text-white flex items-center gap-2">
                <span>Canlı Konum Noktası Seç</span>
              </h3>
              <p className="text-[11px] text-slate-300">
                Kayıtlı noktalardan birini veya haritadan serbest bir yeri canlı konum olarak belirleyin
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Map Pick Action Banner */}
        <div className="p-3 bg-sky-50 border-b border-sky-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-sky-700 shrink-0" />
            <span className="text-xs font-bold text-sky-950 leading-tight">
              Listede yoksa haritadan herhangi bir noktaya dokunarak seçebilirsiniz:
            </span>
          </div>
          <button
            type="button"
            id="modal-pick-on-map-direct-btn"
            onClick={() => {
              onClose();
              onStartPickOnMap();
            }}
            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap"
          >
            Haritada Tıkla
          </button>
        </div>

        {/* Search & Filter Controls */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="KM ara (örn: 54, 54+200, makas, istasyon)..."
              className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              autoFocus
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {availableLines.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={() => setSelectedLine('all')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                  selectedLine === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Tüm Hatlar ({points.length})
              </button>
              {availableLines.map((line) => (
                <button
                  key={line}
                  type="button"
                  onClick={() => setSelectedLine(line)}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] whitespace-nowrap transition-colors cursor-pointer ${
                    selectedLine === line
                      ? 'bg-sky-700 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {line}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Points List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
          {filteredPoints.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <MapPin className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-600">Aradığınız kriterde nokta bulunamadı</p>
              <p className="text-[11px] text-slate-400">
                Arama terimini değiştirebilir veya haritadan doğrudan serbestçe nokta seçebilirsiniz.
              </p>
            </div>
          ) : (
            filteredPoints.map((p) => {
              const cleanKm = formatKmDisplay(p.kmValue, p.title);
              const isCurrent = currentLiveKm && cleanKm && currentLiveKm.includes(cleanKm);

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelectPointAsLive(p);
                    onClose();
                  }}
                  className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between gap-3 transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-sky-50 border border-sky-300'
                      : 'hover:bg-slate-100 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                      <Train className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 truncate">
                          {p.title}
                        </span>
                        {cleanKm && (
                          <span className="bg-blue-50 text-blue-800 font-mono font-black text-[10px] px-1.5 py-0.2 rounded border border-blue-200 shrink-0">
                            KM {cleanKm}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        {p.lineName}{p.locationDesc ? ` • ${p.locationDesc}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-1.5 text-sky-600 text-xs font-bold">
                    <span>Seç</span>
                    <Navigation className="w-3 h-3 rotate-90" />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-500 text-[11px]">
            {filteredPoints.length} nokta listeleniyor
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition-colors cursor-pointer"
          >
            Vazgeç
          </button>
        </div>
      </div>
    </div>
  );
};
