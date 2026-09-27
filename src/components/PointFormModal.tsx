import React, { useState, useEffect } from 'react';
import { RailwayPoint, RailwayPointCategory, TextStyleConfig } from '../types.ts';
import { DEFAULT_TEXT_STYLE, getTextStyleInline } from '../utils/textStyleHelper.ts';
import { extractKmFromText, DEFAULT_CATEGORY_COLORS } from '../utils/categoryColors.ts';
import { TextFormattingToolbar } from './TextFormattingToolbar.tsx';
import { DeleteConfirmModal } from './DeleteConfirmModal.tsx';
import { X, Locate, Train, Save, Trash2 } from 'lucide-react';

interface PointFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  editingPoint: RailwayPoint | null;
  initialCoords?: { lat: number; lng: number } | null;
  onDelete?: (pointId: string) => void;
}

const COMMON_LINES = [
  'Ankara - Eskişehir YHT Hattı',
  'Ankara - İstanbul YHT Hattı',
  'Ankara - Konya YHT Hattı',
  'Ankara - Sivas YHT Hattı',
  'Haydarpaşa - Ankara Ana Hattı',
  'İzmir - Menemen - Aliağa (İZBAN)',
  'İzmir - Aydın - Denizli Hattı',
  'Adana - Mersin Hızlı Tren Hattı',
  'Irmak - Karabük - Zonguldak Hattı',
  'Eskişehir - Afyonkarahisar - Konya Hattı',
  'Sivas - Erzincan - Kars Hattı',
];

const CATEGORIES: { id: RailwayPointCategory; label: string }[] = [
  { id: 'km_marker', label: 'Demiryolu Kilometre Taşı' },
  { id: 'switch', label: 'Demiryolu Makası' },
  { id: 'crossing', label: 'Hemzemin Geçit' },
  { id: 'bridge', label: 'Köprü / Viyadük' },
  { id: 'culvert', label: 'Menfez / Drenaj' },
  { id: 'station', label: 'İstasyon / Gar / Durak' },
  { id: 'signal', label: 'Sinyal / Elektrifikasyon' },
  { id: 'other', label: 'Diğer Hat Noktası' },
];

export const PointFormModal: React.FC<PointFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingPoint,
  initialCoords,
  onDelete,
}) => {
  const [title, setTitle] = useState('');
  const [kmValue, setKmValue] = useState('');
  const [lineName, setLineName] = useState('Ankara - Eskişehir YHT Hattı');
  const [customLine, setCustomLine] = useState('');
  const [category, setCategory] = useState<RailwayPointCategory>('km_marker');
  const [locationDesc, setLocationDesc] = useState('');
  const [lat, setLat] = useState<string>('');
  const [lng, setLng] = useState<string>('');
  const [description, setDescription] = useState('');
  const [textStyle, setTextStyle] = useState<TextStyleConfig>(DEFAULT_TEXT_STYLE);
  const [titleTextStyle, setTitleTextStyle] = useState<TextStyleConfig>({ ...DEFAULT_TEXT_STYLE, fontWeight: 'bold' });
  const [isSaving, setIsSaving] = useState(false);
  const [isGettingGps, setIsGettingGps] = useState(false);
  const [formError, setFormError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (editingPoint) {
      setTitle(editingPoint.title);
      const initialKm = editingPoint.kmValue || extractKmFromText(editingPoint.title);
      setKmValue(initialKm);
      if (COMMON_LINES.includes(editingPoint.lineName)) {
        setLineName(editingPoint.lineName);
        setCustomLine('');
      } else {
        setLineName('other');
        setCustomLine(editingPoint.lineName);
      }
      setCategory(editingPoint.category);
      setLocationDesc(editingPoint.locationDesc || '');
      setLat(editingPoint.lat.toString());
      setLng(editingPoint.lng.toString());
      setDescription(editingPoint.description);
      setTextStyle(editingPoint.textStyle || DEFAULT_TEXT_STYLE);
      setTitleTextStyle(editingPoint.titleTextStyle || { ...DEFAULT_TEXT_STYLE, fontWeight: 'bold' });
    } else {
      // New point
      setTitle('');
      setKmValue('');
      setLineName(COMMON_LINES[0]);
      setCustomLine('');
      setCategory('km_marker');
      setLocationDesc('');
      setDescription('');
      setTextStyle(DEFAULT_TEXT_STYLE);
      setTitleTextStyle({ ...DEFAULT_TEXT_STYLE, fontWeight: 'bold' });
      if (initialCoords) {
        setLat(initialCoords.lat.toFixed(6));
        setLng(initialCoords.lng.toFixed(6));
      } else {
        setLat('');
        setLng('');
      }
    }
    setFormError('');
  }, [editingPoint, initialCoords, isOpen]);

  // Auto-fill title if empty when typing KM, or extract KM if user types title
  const handleKmChange = (val: string) => {
    setKmValue(val);
    if (!editingPoint && (!title || title.startsWith('KM '))) {
      setTitle(val ? `KM ${val}` : '');
    }
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    // If kmValue is empty, auto-detect KM from title
    if (!kmValue.trim()) {
      const detected = extractKmFromText(val);
      if (detected) {
        setKmValue(detected);
      }
    }
  };

  // Get current GPS
  const handleGetGps = () => {
    if (!navigator.geolocation) {
      setFormError('Cihazınızda konum servisi desteklenmiyor.');
      return;
    }
    setIsGettingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsGettingGps(false);
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
      },
      (err) => {
        setIsGettingGps(false);
        setFormError('Konum alınamadı: ' + err.message);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    if (!title.trim()) {
      setFormError('Lütfen bir başlık veya KM adı giriniz.');
      return;
    }

    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      setFormError('Lütfen geçerli enlem ve boylam koordinatları giriniz.');
      return;
    }

    const finalLine = lineName === 'other' ? (customLine.trim() || 'Özel Demiryolu Hattı') : lineName;
    const resolvedKm = (kmValue && kmValue.trim()) ? kmValue.trim() : extractKmFromText(title.trim());

    setIsSaving(true);
    try {
      if (editingPoint) {
        await onSave({
          ...editingPoint,
          title: title.trim(),
          kmValue: resolvedKm,
          lineName: finalLine,
          category,
          locationDesc: locationDesc.trim(),
          lat: parsedLat,
          lng: parsedLng,
          description: description.trim(),
          textStyle,
          titleTextStyle,
        });
      } else {
        await onSave({
          title: title.trim(),
          kmValue: resolvedKm,
          lineName: finalLine,
          category,
          locationDesc: locationDesc.trim(),
          lat: parsedLat,
          lng: parsedLng,
          description: description.trim(),
          textStyle,
          titleTextStyle,
        });
      }
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Kayıt sırasında bir hata oluştu');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="point-form-modal"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <Train className="w-5 h-5 text-sky-400" />
            <h3 className="font-bold text-base">
              {editingPoint ? 'Demiryolu Noktasını Düzenle' : 'Yeni Demiryolu KM Noktası Ekle'}
            </h3>
          </div>
          <button
            id="modal-close-btn"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              {formError}
            </div>
          )}

          {/* KM Value & Title with Color Palette and Text Styling */}
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kilometre (KM)
                </label>
                <input
                  id="form-km-input"
                  type="text"
                  placeholder="Örn: 142+250"
                  value={kmValue}
                  onChange={(e) => handleKmChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Nokta Başlığı *
                  </label>
                  <span className="text-[11px] text-slate-400">Başlık rengi, font &amp; stil</span>
                </div>

                {/* Title Text Formatting / Color Palette Toolbar */}
                <div className="mb-2">
                  <TextFormattingToolbar
                    value={titleTextStyle}
                    onChange={setTitleTextStyle}
                    showAlignment={true}
                    showLineHeight={false}
                  />
                </div>

                <input
                  id="form-title-input"
                  type="text"
                  placeholder="Örn: KM 142+250 - Polatlı Makas"
                  required
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  style={getTextStyleInline(titleTextStyle)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none shadow-xs transition-all"
                />
              </div>
            </div>
          </div>

          {/* Line Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Demiryolu Hattı
            </label>
            <select
              id="form-line-select"
              value={lineName}
              onChange={(e) => setLineName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
            >
              {COMMON_LINES.map((line) => (
                <option key={line} value={line}>
                  {line}
                </option>
              ))}
              <option value="other">Diğer (Özel Hat Yazın)...</option>
            </select>
            {lineName === 'other' && (
              <input
                id="form-custom-line-input"
                type="text"
                placeholder="Hat Adını Yazınız"
                value={customLine}
                onChange={(e) => setCustomLine(e.target.value)}
                className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            )}
          </div>

          {/* Category & Location Description */}
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kategori / Tesis Tipi
                </label>
                <select
                  id="form-category-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as RailwayPointCategory)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mevkii / Bölge
                </label>
                <input
                  id="form-location-input"
                  type="text"
                  placeholder="Örn: Polatlı Batı Girişi"
                  value={locationDesc}
                  onChange={(e) => setLocationDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Quick Visual Category Chips with Authentic Railway Symbols */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
              {CATEGORIES.map((cat) => {
                const conf = DEFAULT_CATEGORY_COLORS[cat.id];
                const isSelected = category === cat.id;
                return (
                  <button
                    type="button"
                    key={cat.id}
                    id={`form-cat-chip-${cat.id}`}
                    onClick={() => setCategory(cat.id)}
                    className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-left ${
                      isSelected
                        ? 'border-sky-500 bg-sky-50/90 text-sky-950 shadow-sm ring-2 ring-sky-500/25'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded-md flex items-center justify-center p-0.5 shrink-0 shadow-xs"
                      style={{ backgroundColor: conf.bg, color: conf.text }}
                      dangerouslySetInnerHTML={{ __html: conf.svgIcon }}
                    />
                    <span className="truncate">{conf.shortLabel || cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Coordinates */}
          <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                Harita Koordinatları *
              </span>
              <button
                id="form-get-gps-btn"
                type="button"
                onClick={handleGetGps}
                disabled={isGettingGps}
                className="text-xs text-sky-700 hover:text-sky-900 font-medium flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm"
              >
                <Locate className="w-3.5 h-3.5" />
                <span>{isGettingGps ? 'GPS Alınıyor...' : 'Mevcut GPS Konumumu Al'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-slate-500 mb-0.5">Enlem (Latitude)</label>
                <input
                  id="form-lat-input"
                  type="text"
                  placeholder="39.585200"
                  required
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-0.5">Boylam (Longitude)</label>
                <input
                  id="form-lng-input"
                  type="text"
                  placeholder="32.138400"
                  required
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Description & Text Formatting (Color, Font, Style, Line Shape) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">
                Açıklama / Teknik Bilgiler
              </label>
              <span className="text-[11px] text-slate-400">Yazı rengi, font, stil ve satır aralığı</span>
            </div>

            {/* Reusable formatting toolbar */}
            <TextFormattingToolbar
              value={textStyle}
              onChange={setTextStyle}
              showAlignment={true}
              showLineHeight={true}
            />

            <textarea
              id="form-desc-textarea"
              rows={4}
              placeholder="Hat altyapısı, travers tipi, bakım notu, yaklaşım yolları veya özel talimatlar..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={getTextStyleInline(textStyle)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none resize-none transition-all shadow-inner"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <div>
              {editingPoint && onDelete && (
                <button
                  id="form-delete-point-btn"
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Noktayı Sil</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                id="form-cancel-btn"
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                id="form-submit-btn"
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-md transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Kaydediliyor...' : editingPoint ? 'Değişiklikleri Kaydet' : 'Noktayı Kaydet'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Delete Confirmation Modal */}
      {editingPoint && onDelete && (
        <DeleteConfirmModal
          isOpen={showDeleteConfirm}
          title="Demiryolu Noktasını Sil"
          itemName={editingPoint.title}
          description="Bu demiryolu noktası sistemden ve haritadan kalıcı olarak silinecektir."
          confirmText="Evet, Noktayı Sil"
          cancelText="Vazgeç"
          isDeleting={isDeleting}
          onConfirm={async () => {
            setIsDeleting(true);
            try {
              await onDelete(editingPoint.id);
              setShowDeleteConfirm(false);
              onClose();
            } finally {
              setIsDeleting(false);
            }
          }}
          onClose={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
};
