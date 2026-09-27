import React, { useMemo } from 'react';
import { RailwayPoint, RailwayPointCategory } from '../types.ts';
import { CategoryColorConfig, DEFAULT_CATEGORY_COLORS, formatKmDisplay } from '../utils/categoryColors.ts';
import { getTextStyleInline } from '../utils/textStyleHelper.ts';
import { sortPointsByKm } from '../utils/kmUtils.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { Navigation, MessageSquare, Image, Train, ChevronRight, MapPin, Trash2, Globe } from 'lucide-react';

interface PointListSidebarProps {
  points: RailwayPoint[];
  selectedPoint: RailwayPoint | null;
  onSelectPoint: (point: RailwayPoint) => void;
  isOpen: boolean;
  onToggle: () => void;
  categoryColors?: Record<RailwayPointCategory, CategoryColorConfig>;
  onDeletePoint?: (point: RailwayPoint) => void;
}

export const PointListSidebar: React.FC<PointListSidebarProps> = ({
  points,
  selectedPoint,
  onSelectPoint,
  isOpen,
  onToggle,
  categoryColors = DEFAULT_CATEGORY_COLORS,
  onDeletePoint,
}) => {
  const { canDelete } = useAuth();
  const sortedPoints = useMemo(() => sortPointsByKm(points), [points]);

  return (
    <aside
      id="point-list-sidebar"
      className={`bg-white border-r border-slate-200 flex flex-col h-full z-10 transition-all duration-300 ${
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
        <span
          className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs"
          title="KM chainage değerlerine göre düşükten yukarıya doğru sıralanmıştır"
        >
          <span>KM Sıralı</span>
          <span className="text-[10px] text-blue-600 font-bold">↑</span>
        </span>
      </div>

      {/* Points Scroll Area */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {sortedPoints.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Filtreye uygun demiryolu noktası bulunamadı.
          </div>
        ) : (
          sortedPoints.map((point) => {
            const isSelected = selectedPoint?.id === point.id;
            const conf = categoryColors[point.category] || categoryColors.km_marker || DEFAULT_CATEGORY_COLORS.km_marker;
            const cleanKm = formatKmDisplay(point.kmValue, point.title);

            return (
              <div
                key={point.id}
                id={`point-item-${point.id}`}
                onClick={() => onSelectPoint(point)}
                className={`p-3.5 cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-sky-50/80 border-l-4 border-sky-600'
                    : 'hover:bg-slate-50'
                }`}
              >
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
                        ? `https://earth.google.com/web/@${Number(point.lat).toFixed(7)},${Number(point.lng).toFixed(7)},350a,750d,35y,0h,45t,0r`
                        : '#'
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      e.stopPropagation();
                      const lat = Number(point.lat);
                      const lng = Number(point.lng);
                      if (isNaN(lat) || isNaN(lng)) {
                        e.preventDefault();
                        return;
                      }
                      window.open(
                        `https://earth.google.com/web/@${lat.toFixed(7)},${lng.toFixed(7)},350a,750d,35y,0h,45t,0r`,
                        '_blank',
                        'noopener,noreferrer'
                      );
                    }}
                    title="3D Google Earth'te Doğrudan Konuma Uç"
                    className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                  >
                    <Globe className="w-3.5 h-3.5" />
                  </a>

                  {/* Delete button (Only for admin) */}
                  {onDeletePoint && canDelete && (
                    <button
                      id={`quick-delete-${point.id}-btn`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeletePoint(point);
                      }}
                      title="Noktayı Sil (Yalnızca Yönetici)"
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
