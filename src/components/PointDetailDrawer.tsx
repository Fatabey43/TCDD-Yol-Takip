import React, { useState, useRef, useEffect } from 'react';
import { RailwayPoint, RailwayPointCategory, PointNote, PointPhoto, TextStyleConfig } from '../types.ts';
import { CategoryColorConfig, DEFAULT_CATEGORY_COLORS, formatKmDisplay } from '../utils/categoryColors.ts';
import { getTextStyleInline, DEFAULT_TEXT_STYLE } from '../utils/textStyleHelper.ts';
import { compressImage } from '../utils/imageCompressor.ts';
import { TextFormattingToolbar } from './TextFormattingToolbar.tsx';
import { DeleteConfirmModal } from './DeleteConfirmModal.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { exportSinglePointKML } from '../utils/kmlParser.ts';
import {
  Navigation,
  Copy,
  Check,
  Edit,
  Trash2,
  X,
  Camera,
  Plus,
  MessageSquare,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  MapPin,
  ExternalLink,
  Train,
  Image as ImageIcon,
  Ruler,
  Globe,
  Download,
} from 'lucide-react';

interface PointDetailDrawerProps {
  point: RailwayPoint | null;
  onClose: () => void;
  onEdit: (point: RailwayPoint) => void;
  onDelete: (pointId: string) => void;
  onAddNote: (pointId: string, text: string, author: string) => Promise<void>;
  onDeleteNote: (pointId: string, noteId: string) => Promise<void>;
  onAddPhoto: (pointId: string, dataUrl: string, caption: string) => Promise<void>;
  onDeletePhoto: (pointId: string, photoId: string) => Promise<void>;
  categoryColors?: Record<RailwayPointCategory, CategoryColorConfig>;
  onStartMeasure?: (point: RailwayPoint) => void;
  onPanToPoint?: (point: RailwayPoint) => void;
}

const CATEGORY_NAMES: Record<string, string> = {
  km_marker: 'Kilometre Taşı',
  switch: 'Demiryolu Makası',
  crossing: 'Hemzemin Geçit',
  bridge: 'Köprü / Viyadük',
  culvert: 'Menfez / Drenaj',
  station: 'İstasyon / Gar',
  signal: 'Sinyal / Elektrifikasyon',
  other: 'Diğer Demiryolu Noktası',
};

const QUICK_NOTE_CHIPS = [
  'Makas Yağlama & Test Yapıldı',
  'Ray Çatlak Kontrolü Tamamlandı',
  'Balast Takviyesi Yapıldı',
  'Hemzemin Geçit Bariyer Kontrolü',
  'Menfez & Drenaj Temizlendi',
  'Sinyal Lambaları Test Edildi',
  'Hız Tahdidi Uygulandı',
];

function formatDateSafe(dateStr?: string | null): string {
  if (!dateStr) return 'Belirtilmemiş';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Belirtilmemiş';
    return d.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return 'Belirtilmemiş';
  }
}

function formatDateTimeSafe(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('tr-TR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export const PointDetailDrawer: React.FC<PointDetailDrawerProps> = ({
  point,
  onClose,
  onEdit,
  onDelete,
  onAddNote,
  onDeleteNote,
  onAddPhoto,
  onDeletePhoto,
  categoryColors = DEFAULT_CATEGORY_COLORS,
  onStartMeasure,
  onPanToPoint,
}) => {
  const { user, isAdmin, canAddNote, canAddPhoto, canDelete } = useAuth();
  // On mobile screens, start in compact mode so map remains visible and screen isn't crowded!
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return true;
  });
  const [copied, setCopied] = useState<boolean>(false);
  const [newNoteText, setNewNoteText] = useState<string>('');
  const [noteAuthor, setNoteAuthor] = useState<string>(user?.name || 'Saha Ekibi');
  const [noteTextStyle, setNoteTextStyle] = useState<TextStyleConfig>(DEFAULT_TEXT_STYLE);

  useEffect(() => {
    // When switching points on mobile screens, maintain compact view so map is not obscured
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsExpanded(false);
    }
  }, [point?.id]);

  useEffect(() => {
    if (user?.name) {
      setNoteAuthor(user.name);
    }
  }, [user]);

  const [isAddingNote, setIsAddingNote] = useState<boolean>(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);
  const [previewPhoto, setPreviewPhoto] = useState<PointPhoto | null>(null);
  const [photoCaption, setPhotoCaption] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'info' | 'notes' | 'photos'>('info');

  // Custom modal delete states
  const [showPointDeleteConfirm, setShowPointDeleteConfirm] = useState<boolean>(false);
  const [photoToDelete, setPhotoToDelete] = useState<PointPhoto | null>(null);
  const [isDeletingPoint, setIsDeletingPoint] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!point) return null;

  // Safe category color lookup
  const conf =
    (categoryColors && categoryColors[point.category]) ||
    DEFAULT_CATEGORY_COLORS[point.category] ||
    DEFAULT_CATEGORY_COLORS.km_marker || {
      bg: '#2563eb',
      border: '#1d4ed8',
      text: '#ffffff',
      label: 'KM Noktası',
      shortLabel: 'KM',
      svgIcon: '',
    };

  const cleanKm = formatKmDisplay(point.kmValue, point.title);

  // Numerical coords safe parsing
  const latNum = typeof point.lat === 'number' ? point.lat : parseFloat(String(point.lat));
  const lngNum = typeof point.lng === 'number' ? point.lng : parseFloat(String(point.lng));
  const hasValidCoords = !isNaN(latNum) && !isNaN(lngNum) && latNum !== 0 && lngNum !== 0;

  // Google Earth Direct Search URL (Search endpoint reliably pins and zooms to exact coordinates without session/cache override)
  const googleEarthSearchUrl = hasValidCoords
    ? `https://earth.google.com/web/search/${latNum.toFixed(7)},${lngNum.toFixed(7)}`
    : '';

  // Google Earth 3D Direct Fly URL (alternative deep-link)
  const googleEarthFlyUrl = hasValidCoords
    ? `https://earth.google.com/web/@${latNum.toFixed(7)},${lngNum.toFixed(7)},250a,600d,35y,0h,45t,0r/data=KAI`
    : '';

  // Preferred Earth URL: Search endpoint is 100% reliable for pinpointing exact coordinates
  const primaryEarthUrl = googleEarthSearchUrl || googleEarthFlyUrl;

  // Google Maps Satellite view with forced satellite imagery mode & distinct RED PIN marker (&t=k)
  const mapsSatellitePinUrl = hasValidCoords
    ? `https://www.google.com/maps?q=${latNum.toFixed(7)},${lngNum.toFixed(7)}&t=k`
    : '';

  // Google Maps Directions
  const navigationUrl = hasValidCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${latNum.toFixed(7)},${lngNum.toFixed(7)}`
    : '';

  // Auto copy coords to clipboard when opening Earth so user can paste into Earth search if Earth web cache acts up
  const handleOpenEarthClick = () => {
    if (hasValidCoords && navigator.clipboard) {
      navigator.clipboard.writeText(`${latNum.toFixed(6)}, ${lngNum.toFixed(6)}`).catch(() => {});
    }
  };

  // Export single point KML for instant Google Earth Desktop / Mobile App opening
  const handleDownloadKML = () => {
    if (!point || !hasValidCoords) return;
    exportSinglePointKML(point);
  };

  // Copy coordinates
  const handleCopyCoords = () => {
    if (!hasValidCoords) return;
    const text = `${latNum.toFixed(6)}, ${lngNum.toFixed(6)}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Pan to point in Leaflet Map
  const handlePanToMap = () => {
    if (point && onPanToPoint) {
      onPanToPoint(point);
    }
  };

  // Submit new note
  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;

    setIsAddingNote(true);
    try {
      await onAddNote(point.id, newNoteText.trim(), noteAuthor.trim() || 'Saha Ekibi');
      setNewNoteText('');
    } finally {
      setIsAddingNote(false);
    }
  };

  // Add quick chip note
  const handleChipClick = (chip: string) => {
    setNewNoteText((prev) => (prev ? `${prev} - ${chip}` : chip));
  };

  // File upload for photos
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    try {
      const compressedDataUrl = await compressImage(file, 1280, 1280, 0.82);
      if (compressedDataUrl) {
        await onAddPhoto(
          point.id,
          compressedDataUrl,
          photoCaption.trim() || `${point.title} saha fotoğrafı`
        );
        setPhotoCaption('');
      }
    } catch (err) {
      console.warn('Fotoğraf işleme hatası:', err);
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const notesList = Array.isArray(point.notes) ? point.notes : [];
  const photosList = Array.isArray(point.photos) ? point.photos : [];

  return (
    <>
      <div
        id="point-detail-drawer"
        className={`fixed z-30 bg-white/95 backdrop-blur-md shadow-2xl transition-all duration-300 flex flex-col
          /* Mobil: Alt sayfa çekmecesi */
          bottom-0 left-0 right-0 border-t border-slate-200/90 max-h-[85vh]
          /* Tablet ve PC: Haritayı engellemeyen sağ alt yüzen kutucuk paneli */
          md:bottom-4 md:right-4 md:left-auto md:w-[480px] lg:w-[530px] md:max-h-[calc(100vh-100px)] md:rounded-2xl md:border md:border-slate-200/90
        `}
      >
        {/* Drawer Drag/Header Handle */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 bg-slate-50/90 border-b border-slate-200/80 md:rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Demiryolu Nokta Detayı
            </span>
            <span
              className="text-xs font-mono px-2 py-0.5 rounded-md font-bold notranslate shadow-xs"
              translate="no"
              style={{ backgroundColor: conf.bg, color: conf.text || '#ffffff' }}
            >
              {cleanKm ? `KM ${cleanKm}` : conf.label}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              id="drawer-toggle-expand-btn"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
              title={isExpanded ? 'Detayları Küçült' : 'Detayları Genişlet'}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
            <button
              id="drawer-close-btn"
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
              title="Kapat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Top Summary & Actions - Nested Boxes Architecture */}
        <div className="px-3 sm:px-4 py-2.5 border-b border-slate-100 space-y-2 bg-white">
          {/* İç Kutu 1: Nokta Başlığı ve Kimlik Bilgileri */}
          <div className="bg-slate-50/90 p-2.5 rounded-xl border border-slate-200/70 flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <h2
                  className="text-base sm:text-lg font-bold text-slate-900 leading-snug truncate notranslate"
                  translate="no"
                  style={point.titleTextStyle ? getTextStyleInline(point.titleTextStyle) : undefined}
                >
                  {point.title}
                </h2>
                <span
                  className="text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs flex-shrink-0 notranslate"
                  translate="no"
                  style={{ backgroundColor: conf.bg, color: conf.text || '#ffffff' }}
                >
                  {conf.svgIcon && (
                    <span
                      className="w-3 h-3 flex items-center justify-center"
                      dangerouslySetInnerHTML={{ __html: conf.svgIcon }}
                    />
                  )}
                  <span>{conf.label}</span>
                </span>
                {cleanKm && (
                  <span className="text-[11px] font-mono font-bold bg-blue-100 text-blue-900 px-2 py-0.5 rounded-md border border-blue-200 flex-shrink-0">
                    KM {cleanKm}
                  </span>
                )}
              </div>
            </div>

            <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap pt-0.5">
              <span className="font-semibold text-slate-700">{point.lineName}</span>
              {point.locationDesc && <span>• {point.locationDesc}</span>}
              {hasValidCoords && (
                <span className="font-mono text-slate-600 bg-slate-200/60 px-1.5 py-0.2 rounded text-[10px]">
                  {latNum.toFixed(5)}, {lngNum.toFixed(5)}
                </span>
              )}
            </div>
          </div>

          {/* İç Kutu 2: Hızlı Eylemler Çubuğu (Kutucuk içinde kutucuk) */}
          <div className="bg-slate-100/90 p-1.5 rounded-xl border border-slate-200/80 flex items-center justify-between gap-1.5 flex-wrap">
            {/* Navigasyon & Konum Eylemleri */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Haritada Konuma Git Butonu */}
              <button
                id="drawer-pan-to-map-btn"
                onClick={handlePanToMap}
                className="flex items-center justify-center gap-1 bg-sky-600 hover:bg-sky-500 text-white px-2.5 py-1.5 rounded-lg font-semibold text-xs shadow-sm transition-all active:scale-[0.98] cursor-pointer"
                title="Haritada bu noktaya odaklan"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Haritada Git</span>
              </button>

              {/* Google Maps Yol Tarifi */}
              <a
                id="open-google-maps-directions-btn"
                href={navigationUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-2.5 py-1.5 rounded-lg font-semibold text-xs shadow-sm transition-all active:scale-[0.98] cursor-pointer"
                title="Google Haritalar Canlı Yol Tarifi"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Yol Tarifi</span>
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>

              {/* Google Earth 3D Görünüm (Doğrudan 3D uçuş URL'si ile tam koordinata gider) */}
              <a
                id="open-google-earth-drawer-btn"
                href={primaryEarthUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleOpenEarthClick}
                className="flex items-center justify-center gap-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-2.5 py-1.5 rounded-lg font-bold text-xs shadow-sm transition-all active:scale-[0.98] cursor-pointer"
                title="Google Earth 3D'de doğrudan bu koordinata uç (Koordinat panoya da kopyalanır)"
              >
                <Globe className="w-3.5 h-3.5 text-white" />
                <span>Earth 3D</span>
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>

              {/* Google Maps Pimli Uydu Görünümü */}
              <a
                id="open-maps-satellite-drawer-btn"
                href={mapsSatellitePinUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-100 px-2 py-1.5 rounded-lg font-medium text-xs border border-slate-700 transition-all cursor-pointer"
                title="Kırmızı işaretçi pinli Google Uydu haritasını aç"
              >
                <MapPin className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden sm:inline">Pimli Uydu</span>
              </a>
            </div>

            {/* İkincil Araçlar ve Yönetici Butonları */}
            <div className="flex items-center gap-1 flex-wrap">
              {/* Koordinat Kopyala */}
              <button
                id="copy-coords-btn"
                onClick={handleCopyCoords}
                title="Koordinatları Kopyala"
                className="p-1.5 bg-white hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-colors flex items-center justify-center text-xs cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              {/* Mesafe / Metre Ölçümü Başlat */}
              {onStartMeasure && (
                <button
                  id="drawer-start-measure-btn"
                  onClick={() => onStartMeasure(point)}
                  title="Bu Noktadan Mesafe Ölç"
                  className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                >
                  <Ruler className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Düzenle Butonu (Yalnızca Yönetici) */}
              {isAdmin && (
                <button
                  id="edit-point-btn"
                  onClick={() => onEdit(point)}
                  title="Noktayı Düzenle (Yönetici)"
                  className="p-1.5 bg-white hover:bg-amber-100 text-slate-700 hover:text-amber-800 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Sil Butonu (Yalnızca Yönetici) */}
              {canDelete && (
                <button
                  id="delete-point-btn"
                  onClick={() => setShowPointDeleteConfirm(true)}
                  title="Noktayı Sil (Yalnızca Yönetici)"
                  className="p-1.5 bg-white hover:bg-red-100 text-slate-700 hover:text-red-700 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                </button>
              )}

              {/* Açıklama & Notları Genişlet / Küçült Butonu */}
              <button
                id="drawer-toggle-details-btn"
                onClick={() => setIsExpanded(!isExpanded)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer border ${
                  isExpanded
                    ? 'bg-slate-200 text-slate-800 border-slate-300'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 shadow-xs'
                }`}
                title={isExpanded ? 'Detayları Küçült' : 'Açıklama, Notlar ve Fotoğrafları Göster'}
              >
                {isExpanded ? (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Küçült</span>
                  </>
                ) : (
                  <>
                    <ChevronUp className="w-3.5 h-3.5 text-amber-700" />
                    <span>Detay &amp; Notlar ({notesList.length + photosList.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Expandable Content Area */}
        {isExpanded && (
          <div className="overflow-y-auto px-3 sm:px-4 py-3 flex-1 space-y-3">
            {/* Tabs for Organization - Nested Tab Bar */}
            <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200/80">
              <button
                id="tab-info-btn"
                onClick={() => setActiveTab('info')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'info'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <Train className="w-3.5 h-3.5" />
                <span>Açıklama &amp; Bilgiler</span>
              </button>

              <button
                id="tab-notes-btn"
                onClick={() => setActiveTab('notes')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'notes'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Notlar ({notesList.length})</span>
              </button>

              <button
                id="tab-photos-btn"
                onClick={() => setActiveTab('photos')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'photos'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Fotoğraflar ({photosList.length})</span>
              </button>
            </div>

            {/* Tab 1: Info & Description */}
            {activeTab === 'info' && (
              <div className="space-y-3">
                {/* İç Kutu 1: Teknik Değerler Grid Kutusu */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-blue-50 p-2.5 rounded-xl border border-blue-200/90 notranslate shadow-2xs" translate="no">
                    <span className="text-blue-700 font-bold block text-[11px]">Kilometre (KM)</span>
                    <span className="font-extrabold text-blue-950 text-sm font-mono">{cleanKm ? `KM ${cleanKm}` : 'Girilmemiş'}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                    <span className="text-slate-400 block text-[11px]">Kategori</span>
                    <span className="font-semibold text-slate-800">{CATEGORY_NAMES[point.category] || point.category}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                    <span className="text-slate-400 block text-[11px]">Mevki</span>
                    <span className="font-semibold text-slate-800">{point.locationDesc || '-'}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                    <span className="text-slate-400 block text-[11px]">Son Güncelleme</span>
                    <span className="font-semibold text-slate-800 text-[11px]">
                      {formatDateSafe(point.updatedAt)}
                    </span>
                  </div>
                </div>

                {/* İç Kutu 2: Nokta Açıklaması & Notlar */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Nokta Açıklaması &amp; Teknik Notlar
                    </div>
                    {point.textStyle && (
                      <span className="text-[10px] bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded font-mono">
                        Biçimlendirilmiş
                      </span>
                    )}
                  </div>
                  <div
                    className="text-sm whitespace-pre-wrap rounded-lg p-3 bg-white border border-slate-200/70 shadow-xs"
                    style={getTextStyleInline(point.textStyle)}
                  >
                    {point.description || 'Bu nokta için henüz özel bir açıklama girilmemiş.'}
                  </div>
                </div>

                {/* İç Kutu 3: Google Earth 3D & Canlı Uydu Görünümü Bölümü (Tam onarılmış, doğrudan koordinat arama & pimli harita) */}
                <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 text-white p-3.5 rounded-xl shadow-md border border-slate-700/80 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 flex-shrink-0">
                        <Globe className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>Google Earth 3D &amp; Uydu Görünümü</span>
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-mono">
                            Canlı Konum
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-300">
                          Resmi 3D Google Earth veya kırmızı işaretçili Google Harita uydusunda görüntüleyin
                        </p>
                      </div>
                    </div>
                    {hasValidCoords && (
                      <span className="text-[11px] font-mono text-emerald-300 bg-emerald-950/70 px-2.5 py-1 rounded-md border border-emerald-800/60">
                        {latNum.toFixed(6)}, {lngNum.toFixed(6)}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
                    {/* Google Earth'e Git Butonu - Doğrudan arama & koordinat sabitleme */}
                    <a
                      id="drawer-info-open-google-earth-btn"
                      href={primaryEarthUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={handleOpenEarthClick}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-3.5 py-2 rounded-xl font-bold text-xs shadow-md transition-all active:scale-[0.98] cursor-pointer"
                      title="Google Earth 3D Web uygulamasında bu noktayı ara ve görüntüle (Koordinat panoya da kopyalanır)"
                    >
                      <Globe className="w-4 h-4 text-white" />
                      <span>Google Earth Web'de Aç</span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                    </a>

                    {/* Google Earth 3D Uçuş Bağlantısı */}
                    {googleEarthFlyUrl && (
                      <a
                        id="drawer-info-open-earth-fly-btn"
                        href={googleEarthFlyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-emerald-950/90 hover:bg-emerald-900 text-emerald-300 hover:text-white px-3 py-2 rounded-xl font-semibold text-xs border border-emerald-700/60 transition-all active:scale-[0.98] cursor-pointer shadow-xs"
                        title="3D Uçuş Modunda Aç (@lat,lng kamera açısı)"
                      >
                        <Navigation className="w-3.5 h-3.5 text-emerald-400 rotate-45" />
                        <span>3D Uçuş</span>
                      </a>
                    )}

                    {/* Google Earth KML İndir / Earth Desktop-Mobil'de Aç */}
                    <button
                      type="button"
                      id="drawer-info-kml-download-btn"
                      onClick={handleDownloadKML}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-3 py-2 rounded-xl font-semibold text-xs border border-slate-700 transition-all active:scale-[0.98] cursor-pointer shadow-xs"
                      title="Bu noktanın KML dosyasını indirip doğrudan Google Earth Pro / Masaüstü uygulamasında tam nokta olarak açın"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                      <span>KML İndir (Earth Pro)</span>
                    </button>

                    {/* Google Maps Kırmızı Pimli Uydu Görünümü */}
                    <a
                      id="drawer-info-open-maps-satellite-btn"
                      href={mapsSatellitePinUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-3 py-2 rounded-xl font-semibold text-xs border border-slate-700 transition-all active:scale-[0.98] cursor-pointer"
                      title="Google Haritalar Uydu Katmanında Kırmızı İşaretçi ile Aç"
                    >
                      <MapPin className="w-3.5 h-3.5 text-sky-400" />
                      <span>Pimli Uydu Haritası</span>
                      <ExternalLink className="w-3 h-3 opacity-70" />
                    </a>

                    {/* Koordinat Kopyala Butonu */}
                    <button
                      type="button"
                      onClick={handleCopyCoords}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer ml-auto"
                      title="Koordinatları Kopyala"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-300">Kopyalandı</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Kopyala</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Notes Section */}
            {activeTab === 'notes' && (
              <div className="space-y-4">
                {/* Add Note Form - For Saha Personeli and Yönetici */}
                {canAddNote ? (
                  <form onSubmit={handleCreateNote} className="space-y-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700">Yeni Saha Notu Ekle</span>
                      <span className="text-[11px] text-slate-400">Yazı rengi ve stili seçilebilir</span>
                    </div>

                    {/* Quick Maintenance Chips */}
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_NOTE_CHIPS.map((chip, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleChipClick(chip)}
                          className="text-[11px] bg-white hover:bg-sky-50 text-slate-700 hover:text-sky-800 border border-slate-200 px-2 py-0.5 rounded-full transition-colors cursor-pointer"
                        >
                          + {chip}
                        </button>
                      ))}
                    </div>

                    {/* Text Formatting Toolbar for Note */}
                    <TextFormattingToolbar
                      value={noteTextStyle}
                      onChange={setNoteTextStyle}
                      showAlignment={false}
                      showLineHeight={false}
                    />

                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        id="note-author-input"
                        type="text"
                        placeholder="Not Ekleyen (Örn: Saha Ekibi)"
                        value={noteAuthor}
                        onChange={(e) => setNoteAuthor(e.target.value)}
                        className="text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white sm:w-1/3 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                      />
                      <input
                        id="note-text-input"
                        type="text"
                        placeholder="Demiryolu notu veya bakım bilgisi yazın..."
                        value={newNoteText}
                        onChange={(e) => setNewNoteText(e.target.value)}
                        style={getTextStyleInline(noteTextStyle)}
                        className="text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white flex-1 focus:ring-2 focus:ring-sky-500 focus:outline-none transition-all shadow-inner"
                      />
                      <button
                        id="submit-note-btn"
                        type="submit"
                        disabled={isAddingNote || !newNoteText.trim()}
                        className="bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isAddingNote ? 'Ekleniyor...' : 'Not Ekle'}</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                    👁️ Gözlemci modundasınız (Salt Okunur). Not eklemek veya düzenlemek için Saha Personeli ya da Yönetici girişi yapınız.
                  </div>
                )}

                {/* Notes List */}
                <div className="space-y-2">
                  {notesList.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs">
                      Bu KM noktasına henüz not eklenmemiş. Yukarıdaki form ile ilk saha notunu kaydedebilirsiniz.
                    </div>
                  ) : (
                    notesList.map((note) => (
                      <div
                        key={note.id}
                        className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-sm flex items-start justify-between gap-3 group"
                      >
                        <div className="space-y-1">
                          <p className="text-xs text-slate-800 font-medium leading-relaxed">
                            {note.text}
                          </p>
                          <div className="flex items-center gap-3 text-[11px] text-slate-500">
                            <span className="flex items-center gap-1 font-semibold text-slate-700">
                              <User className="w-3 h-3 text-sky-600" />
                              {note.author}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDateTimeSafe(note.createdAt)}
                            </span>
                          </div>
                        </div>

                        {isAdmin && (
                          <button
                            id={`delete-note-${note.id}-btn`}
                            onClick={() => onDeleteNote(point.id, note.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 rounded transition-opacity cursor-pointer"
                            title="Notu Sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: Photos Section */}
            {activeTab === 'photos' && (
              <div className="space-y-4">
                {/* Photo Upload Area */}
                {canAddPhoto ? (
                  <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileChange}
                      className="hidden"
                      id="photo-file-upload-input"
                    />

                    <button
                      id="upload-photo-btn"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingPhoto}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>{isUploadingPhoto ? 'Yükleniyor...' : 'Kamera / Fotoğraf Yükle'}</span>
                    </button>

                    <input
                      id="photo-caption-input"
                      type="text"
                      placeholder="Fotoğraf açıklaması (Örn: Makas ray durumu, travers çatlağı...)"
                      value={photoCaption}
                      onChange={(e) => setPhotoCaption(e.target.value)}
                      className="text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white flex-1 w-full focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                    👁️ Gözlemci modundasınız. Saha fotoğrafı yüklemek için Saha Personeli veya Yönetici girişi yapınız.
                  </div>
                )}

                {/* Photo Grid */}
                {photosList.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs border-2 border-dashed border-slate-200 rounded-xl p-4">
                    <Camera className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    Henüz fotoğraf eklenmemiş. Sahadaki ray, makas, menfez veya tabela fotoğraflarını ekleyebilirsiniz.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {photosList.map((photo) => (
                      <div
                        key={photo.id}
                        className="relative group rounded-xl overflow-hidden border border-slate-200 shadow-sm aspect-video bg-slate-100 cursor-pointer"
                        onClick={() => setPreviewPhoto(photo)}
                      >
                        <img
                          src={photo.dataUrl}
                          alt={photo.caption || 'KM Fotoğrafı'}
                          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-between">
                          {isAdmin ? (
                            <button
                              id={`delete-photo-${photo.id}-btn`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setPhotoToDelete(photo);
                              }}
                              className="self-end p-1 bg-red-600/80 hover:bg-red-700 text-white rounded-md transition-colors cursor-pointer"
                              title="Fotoğrafı Sil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <div />
                          )}
                          <p className="text-[11px] text-white font-medium truncate">
                            {photo.caption || 'Fotoğraf'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full Size Photo Lightbox Modal */}
      {previewPhoto && (
        <div
          id="photo-lightbox-modal"
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-slate-800 text-white">
              <span className="text-xs font-semibold text-slate-300">
                {previewPhoto.caption || 'Fotoğraf Görüntüleyici'}
              </span>
              <button
                id="close-lightbox-btn"
                onClick={() => setPreviewPhoto(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[70vh] flex items-center justify-center bg-black/50 p-2">
              <img
                src={previewPhoto.dataUrl}
                alt={previewPhoto.caption}
                className="max-h-[65vh] w-auto max-w-full object-contain rounded-lg"
              />
            </div>
            <div className="p-3 bg-slate-900 text-xs text-slate-400 flex justify-between items-center">
              <span>{previewPhoto.caption || 'Açıklama belirtilmemiş'}</span>
              <span>{formatDateTimeSafe(previewPhoto.takenAt)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Delete Point Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showPointDeleteConfirm}
        title="Demiryolu Noktasını Sil"
        itemName={point.title}
        description="Bu demiryolu noktası ve ilişkili tüm notlar/fotoğraflar kalıcı olarak silinecektir."
        confirmText="Evet, Noktayı Sil"
        cancelText="Vazgeç"
        isDeleting={isDeletingPoint}
        onConfirm={async () => {
          setIsDeletingPoint(true);
          try {
            await onDelete(point.id);
            setShowPointDeleteConfirm(false);
          } finally {
            setIsDeletingPoint(false);
          }
        }}
        onClose={() => setShowPointDeleteConfirm(false)}
      />

      {/* Delete Photo Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!photoToDelete}
        title="Fotoğrafı Sil"
        itemName={photoToDelete?.caption || 'Saha Fotoğrafı'}
        description="Bu fotoğraf noktadan kalıcı olarak kaldırılacaktır."
        confirmText="Evet, Fotoğrafı Sil"
        cancelText="Vazgeç"
        onConfirm={async () => {
          const target = photoToDelete;
          setPhotoToDelete(null);
          if (target) {
            await onDeletePhoto(point.id, target.id);
          }
        }}
        onClose={() => setPhotoToDelete(null)}
      />
    </>
  );
};
