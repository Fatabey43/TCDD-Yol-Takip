import React, { useState, useRef, useEffect, useMemo } from 'react';
import { RailwayPoint, RailwayPointCategory, PointNote, PointPhoto, TextStyleConfig, TakyidatSpeedRestriction, RailwayParcel } from '../types.ts';
import { CategoryColorConfig, DEFAULT_CATEGORY_COLORS, formatKmDisplay } from '../utils/categoryColors.ts';
import { getTextStyleInline, DEFAULT_TEXT_STYLE } from '../utils/textStyleHelper.ts';
import { compressImage } from '../utils/imageCompressor.ts';
import { StampedPhotoView } from './StampedPhotoView.tsx';
import { getWatermarkOptionsForPoint } from '../utils/watermarkHelper.ts';
import { TextFormattingToolbar } from './TextFormattingToolbar.tsx';
import { DeleteConfirmModal } from './DeleteConfirmModal.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { exportSinglePointKML } from '../utils/kmlParser.ts';
import { parseKmToNumber } from '../utils/kmUtils.ts';
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
  ShieldAlert,
  Sliders,
  Car,
  Eye,
  CornerUpRight,
  Percent,
  Wrench,
  Gauge,
  AlertTriangle,
  Compass,
  Landmark,
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
  onOpenWorkLogs?: (point: RailwayPoint) => void;
  takyidatRestrictions?: TakyidatSpeedRestriction[];
  onOpenTakyidat?: () => void;
  railwayParcels?: RailwayParcel[];
  onOpenParcels?: () => void;
  onSelectLiveLocation?: (point: RailwayPoint) => void;
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
  onOpenWorkLogs,
  takyidatRestrictions = [],
  onOpenTakyidat,
  railwayParcels = [],
  onOpenParcels,
  onSelectLiveLocation,
}) => {
  const { user, isAdmin, canAddNote, canAddPhoto, canDelete } = useAuth();

  const matchingParcel = useMemo(() => {
    if (!point || !railwayParcels || railwayParcels.length === 0) return null;
    const ptKm = parseKmToNumber(point.kmValue, point.title);
    if (ptKm === null) return null;

    return railwayParcels.find((p) => {
      const matchLine = !p.lineName || p.lineName === 'all' || p.lineName === point.lineName;
      if (!matchLine) return false;
      const sKm = p.startKmNum !== undefined ? p.startKmNum : parseKmToNumber(p.startKm);
      const eKm = p.endKmNum !== undefined ? p.endKmNum : parseKmToNumber(p.endKm);
      if (sKm !== null && eKm !== null && sKm !== undefined && eKm !== undefined) {
        return ptKm >= Math.min(sKm, eKm) - 0.05 && ptKm <= Math.max(sKm, eKm) + 0.05;
      }
      return false;
    });
  }, [point, railwayParcels]);
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
  const [activeTab, setActiveTab] = useState<'info' | 'crossing' | 'culvert' | 'notes' | 'photos'>('info');

  // If point is crossing or culvert, automatically default active tab so the user immediately sees all specifications
  useEffect(() => {
    if (point?.category === 'crossing') {
      setActiveTab('crossing');
    } else if (point?.category === 'culvert') {
      setActiveTab('culvert');
    } else {
      setActiveTab('info');
    }
  }, [point?.id, point?.category]);

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
      // Build specific extra details for crossings and culverts
      let extraDetails = '';
      if (point.category === 'crossing' && point.levelCrossing) {
        const parts = [
          point.levelCrossing.crossingType ? `Tip: ${point.levelCrossing.crossingType}` : '',
          point.levelCrossing.surfaceType ? `Kaplama: ${point.levelCrossing.surfaceType}` : '',
          point.levelCrossing.nereleriBagladigi ? `Güzergah: ${point.levelCrossing.nereleriBagladigi}` : '',
        ].filter(Boolean);
        extraDetails = parts.join(' | ');
      } else if (point.category === 'culvert' && point.culvert) {
        const parts = [
          point.culvert.cinsi ? `Cins: ${point.culvert.cinsi}` : '',
          point.culvert.aciklikSerbest ? `Açıklık: ${point.culvert.aciklikSerbest}m` : '',
          point.culvert.debuseYuksekligi ? `Debuşe: ${point.culvert.debuseYuksekligi}m` : '',
          point.culvert.yapimYili ? `Yıl: ${point.culvert.yapimYili}` : '',
        ].filter(Boolean);
        extraDetails = parts.join(' | ');
      }

      const watermarkData = {
        title: point.title,
        kmValue: point.kmValue || point.title,
        lineName: point.lineName,
        category: point.category,
        organization: 'TCDD 712 YOL BAKIM ŞEFLİĞİ',
        coords: { lat: point.lat, lng: point.lng },
        extraDetails: extraDetails || undefined,
      };
      const compressedDataUrl = await compressImage(file, 1280, 1280, 0.82, watermarkData);
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
        {/* Drawer Drag/Header Handle - Official TCDD Institutional Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 bg-slate-50 text-slate-800 border-b border-slate-200 md:rounded-t-2xl">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 ring-2 ring-emerald-200 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-700 leading-none">
                TCDD 712 ŞEFLİĞİ • SAHA BİLGİ SİSTEMİ
              </span>
              <span className="text-xs font-bold text-slate-900 truncate">
                Demiryolu Nokta Detayı
              </span>
            </div>
            <span
              className="text-xs font-mono px-2.5 py-0.5 rounded-md font-bold notranslate shadow-xs shrink-0"
              translate="no"
              style={{ backgroundColor: conf.bg, color: conf.text || '#ffffff' }}
            >
              {cleanKm ? `KM ${cleanKm}` : conf.label}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              id="drawer-toggle-expand-btn"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              title={isExpanded ? 'Detayları Küçült' : 'Detayları Genişlet'}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
            <button
              id="drawer-close-btn"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
              title="Kapat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Top Summary & Actions - Nested Boxes Architecture */}
        <div className="px-3 sm:px-4 py-2.5 border-b border-slate-200/90 space-y-2 bg-gradient-to-b from-slate-50 to-white">
          {/* İç Kutu 1: Nokta Başlığı ve Kimlik Bilgileri */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <h2
                  className="text-base sm:text-lg font-black text-slate-900 leading-snug truncate notranslate"
                  translate="no"
                  style={point.titleTextStyle ? getTextStyleInline(point.titleTextStyle) : undefined}
                >
                  {point.title}
                </h2>
                <span
                  className="text-[11px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-xs flex-shrink-0 notranslate tracking-wide"
                  translate="no"
                  style={{ backgroundColor: conf.bg, color: conf.text || '#ffffff' }}
                >
                  {conf.svgIcon && (
                    <span
                      className="w-3.5 h-3.5 flex items-center justify-center"
                      dangerouslySetInnerHTML={{ __html: conf.svgIcon }}
                    />
                  )}
                  <span>{conf.label}</span>
                </span>
                {cleanKm && (
                  <span className="text-[11px] font-mono font-black bg-blue-50 text-blue-900 px-2.5 py-0.5 rounded-lg border border-blue-200/80 flex-shrink-0 shadow-2xs">
                    KM {cleanKm}
                  </span>
                )}
              </div>
            </div>

            <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap pt-0.5 border-t border-slate-100">
              <span className="font-bold text-slate-800 flex items-center gap-1">
                <Train className="w-3 h-3 text-sky-600" />
                {point.lineName}
              </span>
              {point.locationDesc && <span className="text-slate-600">• {point.locationDesc}</span>}
              {hasValidCoords && (
                <span className="font-mono text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md text-[10px] font-bold">
                  📍 {latNum.toFixed(5)}, {lngNum.toFixed(5)}
                </span>
              )}
            </div>

            {/* Demiryolu Arazisi & Tapu Kadastro Bilgisi Kartı */}
            {matchingParcel && (
              <div className="mt-1 pt-1.5 border-t border-slate-100 flex items-center justify-between gap-1 text-[11px] bg-indigo-50/80 p-1.5 rounded-lg border border-indigo-200/70">
                <div className="flex items-center gap-1.5 text-indigo-950 font-bold truncate">
                  <Landmark className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="truncate">
                    TCDD Arazisi: Ada {matchingParcel.adaNo} / Parsel {matchingParcel.parselNo} ({matchingParcel.mahalleKoy})
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {matchingParcel.tkgmUrl && (
                    <a
                      href={matchingParcel.tkgmUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold px-2 py-0.5 rounded transition-colors"
                      title="Resmi TKGM Parsel Sorgu'da Aç"
                    >
                      TKGM
                    </a>
                  )}
                  {onOpenParcels && (
                    <button
                      onClick={onOpenParcels}
                      className="text-indigo-700 hover:text-indigo-950 font-bold text-[10px] underline"
                    >
                      Detay
                    </button>
                  )}
                </div>
              </div>
            )}
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

              {/* İKİ NOKTA ARASI RAY BOYU MESAFE CETVELİ & KM HESAPLAYICI (ÖNE ÇIKAN BUTON) */}
              {onStartMeasure && (
                <button
                  id="drawer-start-measure-btn"
                  onClick={() => onStartMeasure(point)}
                  title="Bu KM noktasından itibaren ray boyunca mesafe ölç ve canlı KM hesapla"
                  className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 px-3 py-1.5 rounded-lg font-black text-xs shadow-sm transition-all active:scale-[0.98] cursor-pointer ring-1 ring-amber-400/50"
                >
                  <Ruler className="w-4 h-4 stroke-[2.5]" />
                  <span>Buradan Mesafe Ölç (KM Cetveli)</span>
                </button>
              )}

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

              {/* Bu Noktayı Canlı Konum / Referans Olarak Seç Butonu */}
              {onSelectLiveLocation && (
                <button
                  id="drawer-set-live-location-btn"
                  onClick={() => onSelectLiveLocation(point)}
                  title="Bu Noktayı Canlı Konum Olarak Seç ve Canlı KM Cetvelinde Göster"
                  className="flex items-center gap-1 px-2 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-300 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
                >
                  <Compass className="w-3.5 h-3.5 text-sky-600" />
                  <span className="hidden sm:inline">Canlı Konum Yap</span>
                </button>
              )}

              {/* Yapılan İşler & Bakım Defteri Butonu */}
              {onOpenWorkLogs && (
                <button
                  id="drawer-open-worklogs-btn"
                  onClick={() => onOpenWorkLogs(point)}
                  title="Saha İşleri & Bakım Defterini Aç"
                  className="flex items-center gap-1 px-2 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
                >
                  <Wrench className="w-3.5 h-3.5 text-amber-700" />
                  <span className="hidden sm:inline">İşler</span>
                  {point.workLogs && point.workLogs.length > 0 && (
                    <span className="bg-amber-500 text-slate-950 px-1 py-0.2 rounded-full text-[10px] font-black">
                      {point.workLogs.length}
                    </span>
                  )}
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
            {/* Tabs for Organization - Modern Segmented Control */}
            <div className="bg-slate-100/90 p-1.5 rounded-2xl flex items-center gap-1 border border-slate-200 shadow-inner">
              <button
                id="tab-info-btn"
                onClick={() => setActiveTab('info')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'info'
                    ? 'bg-slate-900 text-white shadow-sm ring-1 ring-slate-800'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <Train className="w-3.5 h-3.5 text-sky-400" />
                <span>Bilgiler</span>
              </button>

              {/* Hemzemin Geçitler için Özel Sekme */}
              {point.category === 'crossing' && (
                <button
                  id="tab-crossing-btn"
                  onClick={() => setActiveTab('crossing')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    activeTab === 'crossing'
                      ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400/50'
                      : 'text-amber-800 hover:bg-amber-100/80 hover:text-amber-950'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
                  <span>Geçit Föyü</span>
                  {point.levelCrossing && Object.values(point.levelCrossing).some(Boolean) && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white"></span>
                  )}
                </button>
              )}

              {/* Menfezler için Özel Sekme */}
              {point.category === 'culvert' && (
                <button
                  id="tab-culvert-btn"
                  onClick={() => setActiveTab('culvert')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    activeTab === 'culvert'
                      ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400/50'
                      : 'text-indigo-800 hover:bg-indigo-100/80 hover:text-indigo-950'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5 text-indigo-300" />
                  <span>Menfez Föyü</span>
                  {point.culvert && Object.values(point.culvert).some(Boolean) && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-white"></span>
                  )}
                </button>
              )}

              <button
                id="tab-notes-btn"
                onClick={() => setActiveTab('notes')}
                className={`flex-1 flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'notes'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                <span>Notlar</span>
                <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-800 ml-0.5">
                  {notesList.length}
                </span>
              </button>

              <button
                id="tab-photos-btn"
                onClick={() => setActiveTab('photos')}
                className={`flex-1 flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'photos'
                    ? 'bg-slate-900 text-white shadow-sm ring-1 ring-slate-800'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                <span>Fotoğraflar</span>
                <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-950 ml-0.5">
                  {photosList.length}
                </span>
              </button>
            </div>

            {/* Tab 1: Info & Description */}
            {activeTab === 'info' && (
              <div className="space-y-3">
                {/* Takyidat Hız Tahdidi Uyarısı (Eğer bu noktanın KM'si bir takyidat aralığına denk geliyorsa) */}
                {(() => {
                  const pointKmNum = parseKmToNumber(point.kmValue, point.title);
                  if (pointKmNum === null) return null;

                  const matchingTakyidat = takyidatRestrictions.filter((r) => {
                    const lineMatch = !r.lineName || r.lineName === 'Tüm Hatlar' || r.lineName === point.lineName;
                    return lineMatch && pointKmNum >= r.startKmNum && pointKmNum <= r.endKmNum;
                  });

                  if (matchingTakyidat.length === 0) return null;

                  return (
                    <div className="space-y-2">
                      {matchingTakyidat.map((tak) => {
                        const isLifted = tak.status === 'lifted';
                        return (
                          <div
                            key={tak.id}
                            className={`p-3 rounded-xl border flex items-center justify-between gap-3 shadow-xs ${
                              isLifted
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                                : 'bg-red-50 border-red-300 text-red-950'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-10 h-10 rounded-full flex flex-col items-center justify-center border-2 flex-shrink-0 ${
                                  isLifted
                                    ? 'bg-white border-emerald-600 text-emerald-900'
                                    : 'bg-white border-red-600 text-red-950'
                                }`}
                              >
                                <span className="text-[6px] font-black uppercase text-red-600 leading-none">TAHDİT</span>
                                <span className="text-xs font-black font-mono leading-none">{tak.speedLimit}</span>
                                <span className="text-[6px] font-bold text-slate-500 leading-none">KM/S</span>
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-black text-red-700">
                                    ⚠️ TAKYİDAT BÖLGESİNDE (KM {tak.startKm} - {tak.endKm})
                                  </span>
                                  <span className="text-[10px] bg-red-100 text-red-800 px-1.5 py-0.2 rounded font-bold">
                                    Azami {tak.speedLimit} km/s
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-700 font-medium mt-0.5">
                                  {tak.reason}
                                </p>
                              </div>
                            </div>
                            {onOpenTakyidat && (
                              <button
                                type="button"
                                onClick={onOpenTakyidat}
                                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-lg border border-slate-300 shadow-2xs cursor-pointer flex-shrink-0"
                              >
                                İncele
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

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

            {/* Tab: Hemzemin Geçit Özellikleri (crossing) */}
            {activeTab === 'crossing' && point.category === 'crossing' && (
              <div className="space-y-3 animate-in fade-in duration-150">
                {/* Geçit Başlık Kartı */}
                <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent p-3.5 rounded-2xl border border-amber-300/80 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-xs">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Hemzemin Geçit Özellikleri</h4>
                      <p className="text-[11px] text-slate-600">Teknik standartlar, taşıt/tren yoğunluğu ve geometri</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => onEdit(point)}
                      className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1 transition-all active:scale-95 cursor-pointer shrink-0"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Düzenle</span>
                    </button>
                  )}
                </div>

                {/* Grid of the 10 Specific Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* 1. Geçit Tipi */}
                  <div className="bg-slate-50 hover:bg-amber-50/40 transition-colors p-3 rounded-xl border border-slate-200/80 space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px]">
                      <Sliders className="w-3.5 h-3.5 text-amber-600" />
                      <span>Geçit Tipi</span>
                    </div>
                    <div className="text-xs font-bold text-slate-900">
                      {point.levelCrossing?.crossingType || <span className="text-slate-400 font-normal">Belirtilmemiş</span>}
                    </div>
                  </div>

                  {/* 2. Kaplama Cinsi */}
                  <div className="bg-slate-50 hover:bg-amber-50/40 transition-colors p-3 rounded-xl border border-slate-200/80 space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px]">
                      <Sliders className="w-3.5 h-3.5 text-amber-600" />
                      <span>Kaplama Cinsi</span>
                    </div>
                    <div className="text-xs font-bold text-slate-900">
                      {point.levelCrossing?.surfaceType || <span className="text-slate-400 font-normal">Belirtilmemiş</span>}
                    </div>
                  </div>

                  {/* 3. 24 Saatte Geçen Ortalama Taşıt Adedi */}
                  <div className="bg-sky-50/60 hover:bg-sky-50 transition-colors p-3 rounded-xl border border-sky-200/80 space-y-1">
                    <div className="flex items-center gap-1.5 text-sky-700 font-semibold text-[11px]">
                      <Car className="w-3.5 h-3.5 text-sky-600" />
                      <span>24 Saatte Geçen Ort. Taşıt Adedi</span>
                    </div>
                    <div className="text-xs font-mono font-extrabold text-sky-950">
                      {point.levelCrossing?.dailyVehicleCount !== undefined && String(point.levelCrossing?.dailyVehicleCount).trim() !== ''
                        ? `${point.levelCrossing.dailyVehicleCount}`
                        : <span className="text-slate-400 font-normal font-sans">Belirtilmemiş</span>}
                    </div>
                  </div>

                  {/* 4. 24 Saatte Geçen Ortalama Tren Adedi */}
                  <div className="bg-emerald-50/60 hover:bg-emerald-50 transition-colors p-3 rounded-xl border border-emerald-200/80 space-y-1">
                    <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-[11px]">
                      <Train className="w-3.5 h-3.5 text-emerald-600" />
                      <span>24 Saatte Geçen Ort. Tren Adedi</span>
                    </div>
                    <div className="text-xs font-mono font-extrabold text-emerald-950">
                      {point.levelCrossing?.dailyTrainCount !== undefined && String(point.levelCrossing?.dailyTrainCount).trim() !== ''
                        ? `${point.levelCrossing.dailyTrainCount}`
                        : <span className="text-slate-400 font-normal font-sans">Belirtilmemiş</span>}
                    </div>
                  </div>

                  {/* 5. Geçit Açıklığı */}
                  <div className="bg-slate-50 hover:bg-amber-50/40 transition-colors p-3 rounded-xl border border-slate-200/80 space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px]">
                      <span>📏</span>
                      <span>Geçit Açıklığı (Genişlik)</span>
                    </div>
                    <div className="text-xs font-bold text-slate-900">
                      {point.levelCrossing?.clearanceWidth || <span className="text-slate-400 font-normal">Belirtilmemiş</span>}
                    </div>
                  </div>

                  {/* 6. Verevlik Açısı */}
                  <div className="bg-slate-50 hover:bg-amber-50/40 transition-colors p-3 rounded-xl border border-slate-200/80 space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px]">
                      <CornerUpRight className="w-3.5 h-3.5 text-purple-600" />
                      <span>Verevlik Açısı</span>
                    </div>
                    <div className="text-xs font-bold text-slate-900">
                      {point.levelCrossing?.skewAngle || <span className="text-slate-400 font-normal">Belirtilmemiş</span>}
                    </div>
                  </div>

                  {/* 7. Kestiği Hat Adedi */}
                  <div className="bg-slate-50 hover:bg-amber-50/40 transition-colors p-3 rounded-xl border border-slate-200/80 space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px]">
                      <Train className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Kestiği Hat Adedi</span>
                    </div>
                    <div className="text-xs font-bold text-slate-900">
                      {point.levelCrossing?.intersectedTrackCount !== undefined && String(point.levelCrossing?.intersectedTrackCount).trim() !== ''
                        ? `${point.levelCrossing.intersectedTrackCount}`
                        : <span className="text-slate-400 font-normal">Belirtilmemiş</span>}
                    </div>
                  </div>

                  {/* 8. Trenin Min. Görüş Mesafesi */}
                  <div className="bg-slate-50 hover:bg-amber-50/40 transition-colors p-3 rounded-xl border border-slate-200/80 space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px]">
                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                      <span>Trenin Min. Görüş Mesafesi</span>
                    </div>
                    <div className="text-xs font-bold text-slate-900">
                      {point.levelCrossing?.minSightDistance || <span className="text-slate-400 font-normal">Belirtilmemiş</span>}
                    </div>
                  </div>

                  {/* 9. Demiryolunun Eğimi (Binde) */}
                  <div className="bg-rose-50/50 hover:bg-rose-50 transition-colors p-3 rounded-xl border border-rose-200/80 space-y-1">
                    <div className="flex items-center gap-1.5 text-rose-700 font-semibold text-[11px]">
                      <Percent className="w-3.5 h-3.5 text-rose-600" />
                      <span>Demiryolunun Eğimi (Binde - ‰)</span>
                    </div>
                    <div className="text-xs font-bold text-rose-950 font-mono">
                      {point.levelCrossing?.railwayGradient || <span className="text-slate-400 font-normal font-sans">Belirtilmemiş</span>}
                    </div>
                  </div>

                  {/* 10. Kurp Bilgileri */}
                  <div className="bg-slate-50 hover:bg-amber-50/40 transition-colors p-3 rounded-xl border border-slate-200/80 space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px]">
                      <span>🔄</span>
                      <span>Kurp Bilgileri</span>
                    </div>
                    <div className="text-xs font-bold text-slate-900">
                      {point.levelCrossing?.curveInfo || <span className="text-slate-400 font-normal">Belirtilmemiş</span>}
                    </div>
                  </div>

                  {/* 11. Karayolunun Ait Olduğu Kuruluş */}
                  {point.levelCrossing?.roadBelonging && (
                    <div className="bg-slate-50 hover:bg-amber-50/40 transition-colors p-3 rounded-xl border border-slate-200/80 space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px]">
                        <span>🏛️</span>
                        <span>Karayolunun Ait Olduğu Kuruluş</span>
                      </div>
                      <div className="text-xs font-bold text-slate-900">
                        {point.levelCrossing.roadBelonging}
                      </div>
                    </div>
                  )}

                  {/* 12. Şube Şefliği & Güzergah */}
                  {(point.levelCrossing?.subeSefligi || point.levelCrossing?.nereleriBagladigi) && (
                    <div className="bg-slate-50 hover:bg-amber-50/40 transition-colors p-3 rounded-xl border border-slate-200/80 space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px]">
                        <span>📍</span>
                        <span>Şube &amp; Güzergah Bağlantısı</span>
                      </div>
                      <div className="text-xs font-bold text-slate-900">
                        {[
                          point.levelCrossing.subeSefligi ? `${point.levelCrossing.subeSefligi}. Şube Şefliği` : '',
                          point.levelCrossing.nereleriBagladigi || ''
                        ].filter(Boolean).join(' - ')}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bilgilendirme / Düzenleme Butonu (Eğer henüz veri girilmemişse) */}
                {(!point.levelCrossing || !Object.values(point.levelCrossing).some(Boolean)) && (
                  <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-xl text-center space-y-2">
                    <p className="text-xs text-amber-900">
                      Bu hemzemin geçit için henüz teknik parametre girilmedi.
                    </p>
                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={() => onEdit(point)}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition-all inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Şimdi Parametreleri Gir</span>
                      </button>
                    ) : (
                      <p className="text-[11px] text-slate-500">Parametreleri yalnızca yöneticiler güncelleyebilir.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Menfezler için Özel Sekme İçeriği */}
            {activeTab === 'culvert' && (
              <div className="space-y-3 animate-in fade-in duration-150">
                {/* Menfez Başlık Kartı */}
                <div className="bg-gradient-to-r from-indigo-500/15 via-indigo-500/10 to-transparent p-3.5 rounded-2xl border border-indigo-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
                      <Sliders className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        {point.culvert?.bakimSefligi || '712 YOL BAKIM ŞEFLİĞİ'} MENFEZ BİLGİLERİ
                      </h4>
                      <p className="text-[11px] text-slate-600">Açıklık, debuşe yüksekliği, yapım yılı ve cinsi</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => onEdit(point)}
                      className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1 transition-all active:scale-95 cursor-pointer shrink-0"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Düzenle</span>
                    </button>
                  )}
                </div>

                {/* Grid of Menfez Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* Cinsi */}
                  <div className="bg-slate-50 hover:bg-indigo-50/40 transition-colors p-3 rounded-xl border border-slate-200/80 space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px]">
                      <span>🧱</span>
                      <span>Menfez Cinsi</span>
                    </div>
                    <div className="text-xs font-bold text-indigo-950">
                      {point.culvert?.cinsi || <span className="text-slate-400 font-normal">Belirtilmemiş</span>}
                    </div>
                  </div>

                  {/* Hattı */}
                  <div className="bg-slate-50 hover:bg-indigo-50/40 transition-colors p-3 rounded-xl border border-slate-200/80 space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px]">
                      <Train className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Demiryolu Hattı</span>
                    </div>
                    <div className="text-xs font-bold text-slate-900">
                      {point.culvert?.hatti || point.lineName || <span className="text-slate-400 font-normal">Belirtilmemiş</span>}
                    </div>
                  </div>

                  {/* Mihver Klm.si */}
                  <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200/90 space-y-1">
                    <div className="flex items-center gap-1.5 text-blue-700 font-semibold text-[11px]">
                      <MapPin className="w-3.5 h-3.5 text-blue-600" />
                      <span>Mihver Klm.si</span>
                    </div>
                    <div className="text-xs font-extrabold text-blue-950 font-mono">
                      {point.culvert?.mihverKlm || point.kmValue || <span className="text-slate-400 font-normal">Belirtilmemiş</span>}
                    </div>
                  </div>

                  {/* Açıklığı - Serbest (m) */}
                  <div className="bg-slate-50 hover:bg-indigo-50/40 transition-colors p-3 rounded-xl border border-slate-200/80 space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px]">
                      <span>📏</span>
                      <span>Açıklığı (Serbest)</span>
                    </div>
                    <div className="text-xs font-bold text-slate-900 font-mono">
                      {point.culvert?.aciklikSerbest !== undefined && String(point.culvert.aciklikSerbest) !== ''
                        ? `${point.culvert.aciklikSerbest} m`
                        : <span className="text-slate-400 font-normal">Belirtilmemiş</span>}
                    </div>
                  </div>

                  {/* Açıklığı - Mesnet (Adet/Göz) */}
                  <div className="bg-slate-50 hover:bg-indigo-50/40 transition-colors p-3 rounded-xl border border-slate-200/80 space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px]">
                      <span>📐</span>
                      <span>Açıklığı (Mesnet Adedi)</span>
                    </div>
                    <div className="text-xs font-bold text-slate-900 font-mono">
                      {point.culvert?.aciklikMesnet !== undefined && String(point.culvert.aciklikMesnet) !== ''
                        ? `${point.culvert.aciklikMesnet} Adet`
                        : <span className="text-slate-400 font-normal">Belirtilmemiş</span>}
                    </div>
                  </div>

                  {/* Debuşe Yüksekliği (m) */}
                  <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200/90 space-y-1">
                    <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-[11px]">
                      <CornerUpRight className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Debuşe Yüksekliği</span>
                    </div>
                    <div className="text-xs font-extrabold text-emerald-950 font-mono">
                      {point.culvert?.debuseYuksekligi !== undefined && String(point.culvert.debuseYuksekligi) !== ''
                        ? `${point.culvert.debuseYuksekligi} m`
                        : <span className="text-slate-400 font-normal">Belirtilmemiş</span>}
                    </div>
                  </div>

                  {/* Yapım Yılı */}
                  <div className="bg-slate-50 hover:bg-indigo-50/40 transition-colors p-3 rounded-xl border border-slate-200/80 space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px]">
                      <span>📅</span>
                      <span>Yapım Yılı</span>
                    </div>
                    <div className="text-xs font-bold text-slate-900 font-mono">
                      {point.culvert?.yapimYili || <span className="text-slate-400 font-normal">Belirtilmemiş</span>}
                    </div>
                  </div>

                  {/* Dingil Basıncı */}
                  <div className="bg-slate-50 hover:bg-indigo-50/40 transition-colors p-3 rounded-xl border border-slate-200/80 space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px]">
                      <span>⚖️</span>
                      <span>Dingil Basıncı</span>
                    </div>
                    <div className="text-xs font-bold text-slate-900 font-mono">
                      {point.culvert?.dingilBasinci !== undefined && String(point.culvert.dingilBasinci) !== ''
                        ? `${point.culvert.dingilBasinci} Ton`
                        : <span className="text-slate-400 font-normal">Belirtilmemiş</span>}
                    </div>
                  </div>
                </div>

                {/* Bilgilendirme / Düzenleme Butonu (Eğer henüz veri girilmemişse) */}
                {(!point.culvert || !Object.values(point.culvert).some(Boolean)) && (
                  <div className="bg-indigo-50/80 border border-indigo-200 p-3 rounded-xl text-center space-y-2">
                    <p className="text-xs text-indigo-900">
                      Bu menfez için henüz teknik tablo parametresi girilmedi.
                    </p>
                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={() => onEdit(point)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-all inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Şimdi Parametreleri Gir</span>
                      </button>
                    ) : (
                      <p className="text-[11px] text-slate-500">Parametreleri yalnızca yöneticiler güncelleyebilir.</p>
                    )}
                  </div>
                )}
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

                {canAddPhoto && (
                  <div className="text-[11px] text-sky-700 bg-sky-50/80 border border-sky-200 px-3 py-1.5 rounded-lg flex items-center justify-between">
                    <span>🛡️ <strong>Otomatik TCDD Damgası:</strong> Fotoğraflara Şeflik, Hat, KM, Geçit/Menfez Tipi, Tarih-Saat ve Koordinat silinmez olarak işlenir.</span>
                  </div>
                )}

                {/* Photo Grid */}
                {photosList.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs border-2 border-dashed border-slate-200 rounded-xl p-4">
                    <Camera className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    Henüz fotoğraf eklenmemiş. Sahadaki ray, makas, menfez veya tabela fotoğraflarını ekleyebilirsiniz.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {photosList.map((photo) => (
                      <div
                        key={photo.id}
                        className="relative group rounded-xl overflow-hidden border border-slate-700/80 shadow-md aspect-video bg-slate-900 cursor-pointer"
                        onClick={() => setPreviewPhoto(photo)}
                      >
                        <StampedPhotoView
                          dataUrl={photo.dataUrl}
                          alt={photo.caption || 'KM Fotoğrafı'}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          watermark={getWatermarkOptionsForPoint(point, photo.takenAt)}
                          compact={true}
                        />

                        {/* Top-right Action Buttons */}
                        <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-90 group-hover:opacity-100 z-10">
                          {isAdmin && (
                            <button
                              id={`delete-photo-${photo.id}-btn`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setPhotoToDelete(photo);
                              }}
                              className="p-1.5 bg-red-600/90 hover:bg-red-700 text-white rounded-lg transition-colors cursor-pointer shadow-md"
                              title="Fotoğrafı Sil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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

      {/* Full Size Photo Lightbox Modal with Official TCDD Watermark */}
      {previewPhoto && (
        <div
          id="photo-lightbox-modal"
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="relative max-w-5xl w-full bg-slate-900 rounded-3xl overflow-hidden border border-slate-700 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3.5 bg-slate-950/80 border-b border-slate-800 text-white">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                <span className="text-xs sm:text-sm font-bold text-slate-200 truncate">
                  {previewPhoto.caption || `${point.title} Resmi Saha Fotoğrafı`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewPhoto.dataUrl}
                  download={`TCDD_${point.kmValue || point.title}_${photoCaption || 'foto'}.jpg`}
                  className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs font-semibold"
                  title="Fotoğrafı İndir"
                >
                  <Download className="w-4 h-4 text-sky-400" />
                  <span className="hidden sm:inline">İndir</span>
                </a>
                <button
                  id="close-lightbox-btn"
                  onClick={() => setPreviewPhoto(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="relative min-h-[300px] max-h-[75vh] flex items-center justify-center bg-black overflow-hidden">
              <StampedPhotoView
                dataUrl={previewPhoto.dataUrl}
                alt={previewPhoto.caption || 'KM Fotoğrafı'}
                className="max-h-[75vh] w-auto max-w-full object-contain mx-auto"
                watermark={getWatermarkOptionsForPoint(point, previewPhoto.takenAt)}
                compact={false}
              />
            </div>

            <div className="p-3 bg-slate-950 border-t border-slate-800 text-xs text-slate-400 flex justify-between items-center">
              <span className="text-slate-300 font-medium">{previewPhoto.caption || 'Resmi TCDD Saha Kaydı'}</span>
              <span className="font-mono text-slate-400">{formatDateTimeSafe(previewPhoto.takenAt)}</span>
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
