import React, { useState, useEffect } from 'react';
import { RailwayPoint, RailwayPointCategory, TextStyleConfig } from '../types.ts';
import { DEFAULT_TEXT_STYLE, getTextStyleInline } from '../utils/textStyleHelper.ts';
import { extractKmFromText, DEFAULT_CATEGORY_COLORS } from '../utils/categoryColors.ts';
import { getStoredLines, addCustomLine, removeCustomLine } from '../utils/customLinesStorage.ts';
import { TextFormattingToolbar } from './TextFormattingToolbar.tsx';
import { DeleteConfirmModal } from './DeleteConfirmModal.tsx';
import { X, Locate, Train, Save, Trash2, MapPin, Crosshair, Plus, Check } from 'lucide-react';

interface PointFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  editingPoint: RailwayPoint | null;
  initialCoords?: { lat: number; lng: number } | null;
  onDelete?: (pointId: string) => void;
  onPickOnMap?: () => void;
  allExistingLines?: string[];
}

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
  onPickOnMap,
  allExistingLines = [],
}) => {
  const [title, setTitle] = useState('');
  const [kmValue, setKmValue] = useState('');
  const [lineName, setLineName] = useState('');
  const [savedLines, setSavedLines] = useState<string[]>([]);
  const [isAddingNewLine, setIsAddingNewLine] = useState(false);
  const [newLineInput, setNewLineInput] = useState('');
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

  // Load and refresh available custom lines list
  const refreshLinesList = () => {
    const fromStorage = getStoredLines();
    const merged = Array.from(new Set([...allExistingLines, ...fromStorage].map((l) => l.trim()).filter(Boolean))).sort();
    setSavedLines(merged);
    return merged;
  };

  useEffect(() => {
    if (!isOpen) return;

    const currentAvailable = refreshLinesList();

    if (editingPoint) {
      setTitle(editingPoint.title);
      const initialKm = editingPoint.kmValue || extractKmFromText(editingPoint.title);
      setKmValue(initialKm);
      setLineName(editingPoint.lineName || '');
      setCategory(editingPoint.category);
      setLocationDesc(editingPoint.locationDesc || '');
      setLat(editingPoint.lat.toString());
      setLng(editingPoint.lng.toString());
      setDescription(editingPoint.description);
      setTextStyle(editingPoint.textStyle || DEFAULT_TEXT_STYLE);
      setTitleTextStyle(editingPoint.titleTextStyle || { ...DEFAULT_TEXT_STYLE, fontWeight: 'bold' });
    } else {
      // If we have saved lines, default to the first one or leave empty for user to type
      if (!lineName && currentAvailable.length > 0) {
        setLineName(currentAvailable[0]);
      }
      // If we just got initialCoords (e.g. from map click), update lat/lng without erasing what user already typed!
      if (initialCoords) {
        setLat(initialCoords.lat.toFixed(6));
        setLng(initialCoords.lng.toFixed(6));
      }
    }
    setFormError('');
    setIsAddingNewLine(false);
    setNewLineInput('');
  }, [editingPoint, initialCoords, isOpen, allExistingLines]);

  const handleAddNewLine = () => {
    const trimmed = newLineInput.trim();
    if (!trimmed) return;
    addCustomLine(trimmed);
    const updated = refreshLinesList();
    setLineName(trimmed);
    setNewLineInput('');
    setIsAddingNewLine(false);
  };

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

    const finalLine = lineName.trim() || 'Genel Demiryolu Hattı';
    const resolvedKm = (kmValue && kmValue.trim()) ? kmValue.trim() : extractKmFromText(title.trim());

    // Save line to saved lines if new
    if (finalLine && finalLine !== 'Genel Demiryolu Hattı') {
      addCustomLine(finalLine);
    }

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

  const handleModalClose = () => {
    if (!editingPoint) {
      setTitle('');
      setKmValue('');
      setLocationDesc('');
      setDescription('');
      setLat('');
      setLng('');
      setIsAddingNewLine(false);
      setNewLineInput('');
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      id="point-form-modal"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={handleModalClose}
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
            onClick={handleModalClose}
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

          {/* Prominent Haritadan Seç & Otomatik Konum Al Option */}
          {onPickOnMap && (
            <div className="bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-amber-500/5 border-2 border-amber-400/80 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 shadow-sm">
                  <Crosshair className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-extrabold text-xs sm:text-sm text-amber-950">Haritadan Seç &amp; Konum Al</span>
                    <span className="text-[10px] font-bold bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded">Tavsiye Edilen</span>
                  </div>
                  <p className="text-[11px] text-slate-600 truncate">
                    Haritada hatta dokunarak koordinatı otomatik alabilirsiniz
                  </p>
                </div>
              </div>
              <button
                id="form-top-pick-map-btn"
                type="button"
                onClick={onPickOnMap}
                className="shrink-0 bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 text-xs font-extrabold px-3 py-2 rounded-xl border border-amber-500 shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>Haritadan Seç</span>
              </button>
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

          {/* Line Selection & Hat Ekle Bölümü */}
          <div className="bg-slate-50/70 p-3 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Train className="w-3.5 h-3.5 text-sky-600" />
                <span>Demiryolu Hattı</span>
              </label>

              {!isAddingNewLine ? (
                <button
                  type="button"
                  id="form-add-line-btn"
                  onClick={() => setIsAddingNewLine(true)}
                  className="text-[11px] font-bold text-sky-700 hover:text-sky-900 bg-sky-100/80 hover:bg-sky-200/80 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                  title="Yeni demiryolu hattı tanımla"
                >
                  <Plus className="w-3 h-3" />
                  <span>+ Hat Ekle</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingNewLine(false)}
                  className="text-[11px] text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  Vazgeç
                </button>
              )}
            </div>

            {/* Yeni Hat Ekleme Girişi */}
            {isAddingNewLine ? (
              <div className="flex items-center gap-1.5 mb-2 animate-in fade-in duration-150">
                <input
                  id="form-new-line-input"
                  type="text"
                  autoFocus
                  placeholder="İstediğiniz Hat Adını Yazın (Örn: Konya - Karaman Hattı)"
                  value={newLineInput}
                  onChange={(e) => setNewLineInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddNewLine();
                    }
                  }}
                  className="flex-1 px-3 py-2 border-2 border-sky-400 bg-white rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none font-medium"
                />
                <button
                  type="button"
                  id="form-confirm-add-line-btn"
                  onClick={handleAddNewLine}
                  disabled={!newLineInput.trim()}
                  className="bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 transition-colors cursor-pointer shrink-0 shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Kaydet</span>
                </button>
              </div>
            ) : null}

            {/* Hat Seçimi / Girişi */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  id="form-line-text-input"
                  type="text"
                  list="existing-lines-datalist"
                  placeholder="Hat adını yazın veya listeden seçin..."
                  value={lineName}
                  onChange={(e) => setLineName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white font-medium text-slate-800 focus:ring-2 focus:ring-sky-500 focus:outline-none shadow-xs"
                />
                <datalist id="existing-lines-datalist">
                  {savedLines.map((line) => (
                    <option key={line} value={line} />
                  ))}
                </datalist>

                {lineName && savedLines.includes(lineName) && (
                  <button
                    type="button"
                    onClick={() => {
                      removeCustomLine(lineName);
                      refreshLinesList();
                      setLineName('');
                    }}
                    title="Bu hattı listeden kaldır"
                    className="p-2 text-slate-400 hover:text-red-600 rounded-xl hover:bg-red-50 border border-slate-200 transition-colors cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Hızlı Seçim Hapları (Varsa) */}
              {savedLines.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[10px] text-slate-400 font-semibold">Kayıtlı Hatlar:</span>
                  {savedLines.slice(0, 5).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLineName(l)}
                      className={`text-[11px] px-2 py-0.5 rounded-lg border transition-all cursor-pointer truncate max-w-[180px] ${
                        lineName === l
                          ? 'bg-sky-600 text-white border-sky-600 font-bold shadow-xs'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
          <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-sky-600" />
                <span>Harita Koordinatları *</span>
              </span>
              <div className="flex items-center gap-1.5">
                {onPickOnMap && (
                  <button
                    id="form-pick-on-map-btn"
                    type="button"
                    onClick={onPickOnMap}
                    className="text-xs text-amber-950 font-bold flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 active:scale-95 px-2.5 py-1.5 rounded-lg border border-amber-500 shadow-sm transition-all cursor-pointer"
                    title="Modalı kapatıp haritada istediğiniz yere tıklayarak koordinatı otomatik alın"
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                    <span>Haritadan Seç</span>
                  </button>
                )}
                <button
                  id="form-get-gps-btn"
                  type="button"
                  onClick={handleGetGps}
                  disabled={isGettingGps}
                  className="text-xs text-sky-700 hover:text-sky-900 font-medium flex items-center gap-1 bg-white hover:bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-xs transition-colors cursor-pointer"
                  title="Cihazınızın mevcut canlı GPS konumunu alır"
                >
                  <Locate className="w-3.5 h-3.5" />
                  <span>{isGettingGps ? 'Alınıyor...' : 'Canlı GPS'}</span>
                </button>
              </div>
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
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-sky-500 focus:outline-none"
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
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>
            </div>
            {lat && lng && (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200/80">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Konum koordinatları başarıyla alındı: {lat}, {lng}</span>
              </div>
            )}
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
                onClick={handleModalClose}
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
