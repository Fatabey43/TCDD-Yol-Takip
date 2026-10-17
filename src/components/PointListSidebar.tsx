import React, { useState, useMemo, useRef } from 'react';
import { RailwayPoint, RailwayPointCategory } from '../types.ts';
import { CategoryColorConfig, DEFAULT_CATEGORY_COLORS, formatKmDisplay } from '../utils/categoryColors.ts';
import { getTextStyleInline } from '../utils/textStyleHelper.ts';
import { sortPointsByKm } from '../utils/kmUtils.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { DeleteConfirmModal } from './DeleteConfirmModal.tsx';
import {
  Navigation,
  MessageSquare,
  Image,
  Train,
  ChevronRight,
  Trash2,
  Globe,
  X,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  Square,
  CheckCheck,
} from 'lucide-react';

interface PointListSidebarProps {
  points: RailwayPoint[];
  selectedPoint: RailwayPoint | null;
  onSelectPoint: (point: RailwayPoint) => void;
  isOpen: boolean;
  onToggle: () => void;
  categoryColors?: Record<RailwayPointCategory, CategoryColorConfig>;
  onDeletePoint?: (point: RailwayPoint) => void;
  onBulkDeletePoints?: (ids: string[]) => Promise<void>;
}

export const PointListSidebar: React.FC<PointListSidebarProps> = ({
  points,
  selectedPoint,
  onSelectPoint,
  isOpen,
  onToggle,
  categoryColors = DEFAULT_CATEGORY_COLORS,
  onDeletePoint,
  onBulkDeletePoints,
}) => {
  const { canDelete } = useAuth();
  const sortedPoints = useMemo(() => sortPointsByKm(points), [points]);

  // Selection & Bulk Delete State
  const [isSelectMode, setIsSelectMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState<boolean>(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState<boolean>(false);
  const [singlePointToDelete, setSinglePointToDelete] = useState<RailwayPoint | null>(null);

  // Scroll Container Ref for Up/Down Movement Bar
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleScrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleScrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  const toggleSelectPoint = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === sortedPoints.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedPoints.map((p) => p.id)));
    }
  };

  const handleConfirmBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setIsBulkDeleting(true);
    try {
      if (onBulkDeletePoints) {
        await onBulkDeletePoints(ids);
      } else if (onDeletePoint) {
        for (const p of sortedPoints.filter((pt) => selectedIds.has(pt.id))) {
          await onDeletePoint(p);
        }
      }
      setSelectedIds(new Set());
      setIsBulkDeleteModalOpen(false);
      setIsSelectMode(false);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  return (
    <aside
      id="point-list-sidebar"
      className={`bg-white border-r border-slate-200 flex flex-col h-full z-10 transition-all duration-300 relative ${
        isOpen ? 'w-full sm:w-80 md:w-96' : 'w-0 hidden'
      }`}
    >
      {/* Sidebar Header */}
      <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Train className="w-4 h-4 text-sky-600" />
          <span className="text-xs font-bold text-slate-800">
            Kayıtlı Noktalar ({sortedPoints.length})
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {canDelete && sortedPoints.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setIsSelectMode((prev) => !prev);
                if (isSelectMode) setSelectedIds(new Set());
              }}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors flex items-center gap-1 cursor-pointer ${
                isSelectMode
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
              title="Toplu silme ve seçim modunu aç/kapat"
            >
              {isSelectMode ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
              <span>{isSelectMode ? 'Seçimi Bitir' : 'Toplu Seçim'}</span>
            </button>
          )}

          <span
            className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs"
            title="KM chainage değerlerine göre sıralı"
          >
            <span>KM</span>
            <span className="text-[10px] text-blue-600 font-bold">↑</span>
          </span>
          <button
            id="close-sidebar-btn"
            type="button"
            onClick={onToggle}
            className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            title="Listeyi Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bulk Action Bar (when in select mode or items selected) */}
      {isSelectMode && canDelete && sortedPoints.length > 0 && (
        <div className="bg-indigo-50/90 border-b border-indigo-200 px-3 py-2 flex items-center justify-between gap-2 flex-wrap text-xs shrink-0 animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="flex items-center gap-1.5 text-indigo-900 font-bold hover:text-indigo-950 cursor-pointer"
            >
              {selectedIds.size === sortedPoints.length ? (
                <CheckSquare className="w-4 h-4 text-indigo-600" />
              ) : (
                <Square className="w-4 h-4 text-indigo-600" />
              )}
              <span>Tümünü Seç ({sortedPoints.length})</span>
            </button>
            {selectedIds.size > 0 && (
              <span className="bg-indigo-200 text-indigo-900 font-bold px-2 py-0.2 rounded-full text-[10px]">
                {selectedIds.size} seçildi
              </span>
            )}
          </div>

          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white font-bold px-2.5 py-1 rounded-lg text-xs shadow-xs transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Seçilenleri Sil ({selectedIds.size})</span>
            </button>
          )}
        </div>
      )}

      {/* Points Scroll Area with Prominent Scrollbar & Height Constraint */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto divide-y divide-slate-100 prominent-scrollbar relative min-h-0"
      >
        {sortedPoints.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Filtreye uygun demiryolu noktası bulunamadı.
          </div>
        ) : (
          sortedPoints.map((point) => {
            const isSelected = selectedPoint?.id === point.id;
            const isChecked = selectedIds.has(point.id);
            const conf = categoryColors[point.category] || categoryColors.km_marker || DEFAULT_CATEGORY_COLORS.km_marker;
            const cleanKm = formatKmDisplay(point.kmValue, point.title);

            return (
              <div
                key={point.id}
                id={`point-item-${point.id}`}
                onClick={(e) => {
                  if (isSelectMode) {
                    toggleSelectPoint(point.id, e);
                  } else {
                    onSelectPoint(point);
                  }
                }}
                className={`p-3.5 cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                  isChecked
                    ? 'bg-indigo-50/70 border-l-4 border-indigo-600'
                    : isSelected
                    ? 'bg-sky-50/80 border-l-4 border-sky-600'
                    : 'hover:bg-slate-50'
                }`}
              >
                {/* Left: Checkbox if select mode is active */}
                {isSelectMode && canDelete && (
                  <div
                    onClick={(e) => toggleSelectPoint(point.id, e)}
                    className="pr-1 cursor-pointer shrink-0"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}} // handled by click
                      className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer pointer-events-none"
                    />
                  </div>
                )}

                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {cleanKm && (
                      <span
                        className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-blue-600 text-white shadow-xs notranslate"
                        translate="no"
                      >
                        KM {cleanKm}
                      </span>
                    )}
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs notranslate"
                      translate="no"
                      style={{
                        backgroundColor: conf.bg,
                        color: conf.text || '#ffffff',
                        borderColor: conf.border,
                      }}
                    >
                      <span className="w-3 h-3 flex items-center justify-center flex-shrink-0" dangerouslySetInnerHTML={{ __html: conf.svgIcon }} />
                      <span>{conf.shortLabel || conf.label}</span>
                    </span>
                    <span
                      className="text-xs font-bold text-slate-900 truncate notranslate"
                      translate="no"
                      style={point.titleTextStyle ? getTextStyleInline(point.titleTextStyle) : undefined}
                    >
                      {point.title}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 truncate">
                    {point.lineName}
                    {point.locationDesc ? ` • ${point.locationDesc}` : ''}
                  </div>

                  {/* Badges: notes count, photos count, navigation shortcut */}
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                    {cleanKm && (
                      <span className="font-mono text-slate-700 font-bold text-[10px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 notranslate" translate="no">
                        KM {cleanKm}
                      </span>
                    )}
                    {point.notes && point.notes.length > 0 && (
                      <span className="flex items-center gap-1 text-slate-600">
                        <MessageSquare className="w-3 h-3 text-sky-500" />
                        <span>{point.notes.length}</span>
                      </span>
                    )}
                    {point.photos && point.photos.length > 0 && (
                      <span className="flex items-center gap-1 text-slate-600">
                        <Image className="w-3 h-3 text-emerald-500" />
                        <span>{point.photos.length}</span>
                      </span>
                    )}
                    {point.category === 'crossing' && point.levelCrossing && Object.values(point.levelCrossing).some(Boolean) && (
                      <span className="flex items-center gap-0.5 text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200 text-[10px] font-bold">
                        <span>Geçit Verisi</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {/* Direct navigation shortcut */}
                  <button
                    id={`quick-nav-${point.id}-btn`}
                    onClick={(e) => {
                      e.stopPropagation();
                      const lat = Number(point.lat);
                      const lng = Number(point.lng);
                      if (!isNaN(lat) && !isNaN(lng)) {
                        window.open(
                          `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
                          '_blank',
                          'noopener,noreferrer'
                        );
                      }
                    }}
                    title="Google Haritalar'da Yol Tarifi Al"
                    className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors cursor-pointer"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                  </button>

                  {/* Google Earth shortcut */}
                  <a
                    id={`quick-earth-${point.id}-btn`}
                    href={
                      !isNaN(Number(point.lat)) && !isNaN(Number(point.lng))
                        ? `https://earth.google.com/web/search/${Number(point.lat).toFixed(7)},${Number(point.lng).toFixed(7)}`
                        : '#'
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      e.stopPropagation();
                      const lat = Number(point.lat);
                      const lng = Number(point.lng);
                      if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
                        e.preventDefault();
                      } else if (navigator.clipboard) {
                        navigator.clipboard.writeText(`${lat.toFixed(6)}, ${lng.toFixed(6)}`).catch(() => {});
                      }
                    }}
                    title="Google Earth Web'de bu koordinatı ara ve aç"
                    className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                  >
                    <Globe className="w-3.5 h-3.5" />
                  </a>

                  {/* Delete button (Only for admin) */}
                  {onDeletePoint && canDelete && !isSelectMode && (
                    <button
                      id={`quick-delete-${point.id}-btn`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSinglePointToDelete(point);
                      }}
                      title="Noktayı Sil (Yalnızca Yönetici)"
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {!isSelectMode && <ChevronRight className="w-4 h-4 text-slate-300" />}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Hareket Çubuğu / Hızlı Aşağı Yukarı Kaydırma Butonları (Floating Up/Down Movement Bar) */}
      {sortedPoints.length > 5 && (
        <div
          className="absolute right-3 bottom-4 z-20 flex flex-col items-center bg-white/95 backdrop-blur-md border border-slate-300 shadow-xl rounded-2xl p-1 gap-1 text-slate-700 select-none animate-in fade-in"
          title="Aşağı / Yukarı Hızlı Hareket Çubuğu"
        >
          <button
            type="button"
            onClick={handleScrollToTop}
            className="p-2 hover:bg-sky-50 hover:text-sky-600 rounded-xl transition-all cursor-pointer group flex items-center justify-center"
            title="En Başa Dön (Yukarı)"
          >
            <ArrowUp className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
          </button>
          <div className="w-3 h-[1px] bg-slate-200" />
          <button
            type="button"
            onClick={handleScrollToBottom}
            className="p-2 hover:bg-sky-50 hover:text-sky-600 rounded-xl transition-all cursor-pointer group flex items-center justify-center"
            title="En Alta İn (Aşağı)"
          >
            <ArrowDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
          </button>
        </div>
      )}

      {/* SINGLE POINT DELETE CONFIRMATION MODAL */}
      <DeleteConfirmModal
        isOpen={!!singlePointToDelete}
        title="Demiryolu Noktasını Sil"
        itemName={singlePointToDelete?.title}
        description="Bu demiryolu noktası sistemden ve haritadan kalıcı olarak silinecektir."
        confirmText="Evet, Noktayı Sil"
        cancelText="Vazgeç"
        isDeleting={isBulkDeleting}
        onConfirm={async () => {
          if (!singlePointToDelete) return;
          setIsBulkDeleting(true);
          try {
            if (onDeletePoint) {
              await onDeletePoint(singlePointToDelete);
            }
            setSinglePointToDelete(null);
          } finally {
            setIsBulkDeleting(false);
          }
        }}
        onClose={() => setSinglePointToDelete(null)}
      />

      {/* BULK DELETE CONFIRMATION MODAL */}
      <DeleteConfirmModal
        isOpen={isBulkDeleteModalOpen}
        title="Seçilen Noktaları Sil"
        itemName={`${selectedIds.size} adet demiryolu noktası`}
        description="Seçilen tüm demiryolu noktaları sistemden ve haritadan kalıcı olarak silinecektir. Bu işlem geri alınamaz."
        confirmText="Evet, Seçilenleri Sil"
        cancelText="Vazgeç"
        isDeleting={isBulkDeleting}
        onConfirm={handleConfirmBulkDelete}
        onClose={() => setIsBulkDeleteModalOpen(false)}
      />
    </aside>
  );
};
