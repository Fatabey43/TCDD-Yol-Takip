import React, { useState, useRef } from 'react';
import { RailwayPoint, RailwayPointCategory, RailwayParcel } from '../types.ts';
import {
  parseKML,
  parseGeoJSON,
  parseCSV,
  parseNativeJSON,
  parseExcelBuffer,
  exportToGeoJSON,
  exportToKML,
  exportToJSON,
  exportToExcel,
} from '../utils/kmlParser.ts';
import { parseKmlOrGeoJsonParcels } from '../utils/parcelUtils.ts';
import { mergeExcelIntoExistingCrossings, ExcelExtractionResult } from '../utils/excelCrossingProcessor.ts';
import { parseCulvertExcelRows, mergeCulvertsIntoExistingPoints } from '../utils/excelCulvertProcessor.ts';
import * as XLSX from 'xlsx';
import { DeleteConfirmModal } from './DeleteConfirmModal.tsx';
import {
  X,
  Upload,
  Download,
  FileText,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
  Table,
  Image as ImageIcon,
  Layers,
  Sparkles,
  ChevronDown,
  Landmark,
} from 'lucide-react';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  points: RailwayPoint[];
  onImportSuccess: (importedPoints: Partial<RailwayPoint>[], replaceAll: boolean) => Promise<void>;
  onImportParcels?: (importedParcels: RailwayParcel[]) => Promise<void>;
  onResetSample: () => Promise<void>;
}

export type ExtendedImportCategory = RailwayPointCategory | 'parcel' | 'auto';

const CATEGORY_DEFINITIONS: {
  value: ExtendedImportCategory;
  label: string;
  shortLabel: string;
  icon: string;
  badgeClass: string;
  btnActiveClass: string;
}[] = [
  {
    value: 'auto',
    label: 'Otomatik Tanı (İsim / İçerikten)',
    shortLabel: 'Otomatik',
    icon: '🤖',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    btnActiveClass: 'bg-slate-800 text-white border-slate-900 shadow-xs',
  },
  {
    value: 'parcel',
    label: 'Arazi & Kadastro Parseli (TKGM)',
    shortLabel: 'Kadastro',
    icon: '🏛️',
    badgeClass: 'bg-purple-100 text-purple-950 border-purple-300 font-bold',
    btnActiveClass: 'bg-purple-800 text-white border-purple-900 shadow-xs',
  },
  {
    value: 'culvert',
    label: 'Menfez (Culvert)',
    shortLabel: 'Menfez',
    icon: '🕳️',
    badgeClass: 'bg-teal-100 text-teal-900 border-teal-200 font-bold',
    btnActiveClass: 'bg-teal-700 text-white border-teal-800 shadow-xs',
  },
  {
    value: 'switch',
    label: 'Makas (Demiryolu Makası)',
    shortLabel: 'Makas',
    icon: '🔀',
    badgeClass: 'bg-rose-100 text-rose-900 border-rose-200 font-bold',
    btnActiveClass: 'bg-rose-600 text-white border-rose-700 shadow-xs',
  },
  {
    value: 'bridge',
    label: 'Köprü / Viyadük',
    shortLabel: 'Köprü',
    icon: '🌉',
    badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-200 font-bold',
    btnActiveClass: 'bg-indigo-600 text-white border-indigo-700 shadow-xs',
  },
  {
    value: 'crossing',
    label: 'Hemzemin Geçit',
    shortLabel: 'Geçit',
    icon: '🚧',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-200 font-bold',
    btnActiveClass: 'bg-amber-600 text-white border-amber-700 shadow-xs',
  },
  {
    value: 'station',
    label: 'İstasyon / Gar',
    shortLabel: 'İstasyon',
    icon: '🚉',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-200 font-bold',
    btnActiveClass: 'bg-emerald-600 text-white border-emerald-700 shadow-xs',
  },
  {
    value: 'km_marker',
    label: 'KM Taşı / Metraj',
    shortLabel: 'KM Taşı',
    icon: '📍',
    badgeClass: 'bg-blue-100 text-blue-900 border-blue-200 font-bold',
    btnActiveClass: 'bg-blue-600 text-white border-blue-700 shadow-xs',
  },
  {
    value: 'signal',
    label: 'Sinyal / Trafo',
    shortLabel: 'Sinyal',
    icon: '🚦',
    badgeClass: 'bg-purple-100 text-purple-900 border-purple-200 font-bold',
    btnActiveClass: 'bg-purple-600 text-white border-purple-700 shadow-xs',
  },
];

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  onClose,
  points,
  onImportSuccess,
  onImportParcels,
  onResetSample,
}) => {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [targetLine, setTargetLine] = useState<string>('Enveriye - Konya Hattı');
  const [importCategory, setImportCategory] = useState<ExtendedImportCategory>('auto');
  const [parsedPreview, setParsedPreview] = useState<Partial<RailwayPoint>[]>([]);
  const [parsedParcelsPreview, setParsedParcelsPreview] = useState<Partial<RailwayParcel>[]>([]);
  const [replaceAll, setReplaceAll] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [rawText, setRawText] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [excelMergeStats, setExcelMergeStats] = useState<ExcelExtractionResult | null>(null);
  const [mergedFullPoints, setMergedFullPoints] = useState<RailwayPoint[] | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const applyCategoryToPoint = (
    p: Partial<RailwayPoint>,
    newCat: RailwayPointCategory,
    lineName: string
  ): Partial<RailwayPoint> => {
    const updated: Partial<RailwayPoint> = {
      ...p,
      category: newCat,
    };
    if (newCat === 'culvert') {
      updated.culvert = p.culvert || {
        hatti: p.lineName || lineName,
        mihverKlm: p.kmValue || p.title || '',
      };
    }
    return updated;
  };

  const handleCategorySelection = (newCat: ExtendedImportCategory) => {
    setImportCategory(newCat);
    if (newCat !== 'parcel' && parsedPreview.length > 0 && newCat !== 'auto') {
      setParsedPreview((prev) =>
        prev.map((p) => applyCategoryToPoint(p, newCat as RailwayPointCategory, targetLine))
      );
    }
  };

  const handleRowCategoryChange = (index: number, newCat: RailwayPointCategory) => {
    setParsedPreview((prev) => {
      const copy = [...prev];
      if (copy[index]) {
        copy[index] = applyCategoryToPoint(copy[index], newCat, targetLine);
      }
      return copy;
    });
  };

  const handleBulkChangeAllPreview = (newCat: RailwayPointCategory) => {
    setParsedPreview((prev) =>
      prev.map((p) => applyCategoryToPoint(p, newCat, targetLine))
    );
  };

  const processFileContent = (content: string, fileName: string) => {
    setStatusMessage(null);
    setParsedParcelsPreview([]);
    setParsedPreview([]);

    const lowerName = fileName.toLowerCase();
    const trimmed = content.trim();

    // Check if user selected 'parcel' OR if file contains TKGM Cadastre Polygons
    if (
      importCategory === 'parcel' ||
      content.includes('<Polygon>') ||
      content.includes('<LinearRing>') ||
      content.includes('tkgm-parsel') ||
      content.includes('Parsel Sorgu')
    ) {
      const parcelsFound = parseKmlOrGeoJsonParcels(content);
      if (parcelsFound.length > 0) {
        setParsedParcelsPreview(parcelsFound);
        setImportCategory('parcel');
        setStatusMessage({
          type: 'success',
          text: `${parcelsFound.length} adet Tapu Kadastro ve Kamulaştırma Parseli tespit edildi.`,
        });
        return;
      }
    }

    let detected: Partial<RailwayPoint>[] = [];
    const forcedPointCat: RailwayPointCategory | 'auto' =
      importCategory === 'parcel' ? 'auto' : importCategory;

    if (lowerName.endsWith('.json') || trimmed.startsWith('[') || trimmed.startsWith('{')) {
      detected = parseNativeJSON(content);
      if (detected.length === 0) {
        detected = parseGeoJSON(content, targetLine, forcedPointCat);
      }
    } else if (lowerName.endsWith('.kml') || content.includes('<kml')) {
      detected = parseKML(content, targetLine, forcedPointCat);
    } else if (lowerName.endsWith('.geojson')) {
      detected = parseGeoJSON(content, targetLine, forcedPointCat);
    } else if (lowerName.endsWith('.csv')) {
      detected = parseCSV(content, targetLine, forcedPointCat);
    } else {
      // Auto-detect by content
      if (content.includes('<kml') || content.includes('<Placemark')) {
        detected = parseKML(content, targetLine, forcedPointCat);
      } else if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        detected = parseNativeJSON(content);
        if (detected.length === 0) {
          detected = parseGeoJSON(content, targetLine, forcedPointCat);
        }
      } else {
        detected = parseCSV(content, targetLine, forcedPointCat);
      }
    }

    if (detected.length === 0) {
      setStatusMessage({
        type: 'error',
        text: 'Dosya içeriğinde geçerli nokta veya kadastro parseli tespit edilemedi. Lütfen geçerli bir KML, Excel veya CBS dosyası yükleyin.',
      });
      setParsedPreview([]);
    } else {
      if (forcedPointCat !== 'auto') {
        detected = detected.map((p) => applyCategoryToPoint(p, forcedPointCat, targetLine));
      }
      setParsedPreview(detected);
      const catDef = CATEGORY_DEFINITIONS.find((c) => c.value === importCategory);
      setStatusMessage({
        type: 'success',
        text: `${detected.length} adet nokta başarıyla okundu ${importCategory !== 'auto' ? `(${catDef?.label} olarak işaretlendi)` : ''}.`,
      });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();

    // If Excel binary file (.xlsx, .xls)
    if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const buffer = event.target?.result as ArrayBuffer;
        if (buffer) {
          setStatusMessage(null);
          setExcelMergeStats(null);
          setMergedFullPoints(null);
          setParsedParcelsPreview([]);

          // If auto or crossing, try smart merge
          if (importCategory === 'auto' || importCategory === 'crossing') {
            try {
              const { updatedPoints, stats } = await mergeExcelIntoExistingCrossings(buffer, points);
              if (stats.matchedCrossingsCount > 0) {
                setMergedFullPoints(updatedPoints);
                setExcelMergeStats(stats);
                setParsedPreview(
                  updatedPoints.filter((p) =>
                    stats.details.some((d) => d.pointId === p.id)
                  )
                );
                setStatusMessage({
                  type: 'success',
                  text: `Mevcut noktalar içindeki ${stats.matchedCrossingsCount} adet hemzemin geçit KM numarasına göre eşleşti! ${stats.extractedPhotosCount > 0 ? `(${stats.extractedPhotosCount} adet fotoğraf Excel'den çıkarıldı)` : ''}`,
                });
                return;
              }
            } catch (excelErr) {
              console.warn('Excel akıllı birleştirme denemesi:', excelErr);
            }
          }

          // Check if this is a Culvert (Menfez) Excel sheet
          if (importCategory === 'auto' || importCategory === 'culvert') {
            try {
              const wb = XLSX.read(buffer, { type: 'array' });
              let allCulvertRecords: any[] = [];
              for (const sName of wb.SheetNames) {
                const ws = wb.Sheets[sName];
                if (ws) {
                  const sheetCulverts = parseCulvertExcelRows(ws);
                  if (sheetCulverts.length > 0) {
                    allCulvertRecords = allCulvertRecords.concat(sheetCulverts);
                  }
                }
              }

              if (allCulvertRecords.length > 0) {
                const { updatedPoints, stats } = mergeCulvertsIntoExistingPoints(allCulvertRecords, points);
                if (stats.matchedCulvertsCount > 0) {
                  setMergedFullPoints(updatedPoints);
                  setParsedPreview(
                    updatedPoints.filter((p) =>
                      stats.details.some((d) => d.matched && (d.km === p.kmValue || d.km === p.culvert?.mihverKlm))
                    )
                  );
                  setStatusMessage({
                    type: 'success',
                    text: `Menfez listesindeki ${stats.matchedCulvertsCount} adet menfez KM bazında başarıyla eşleşti!`,
                  });
                  return;
                }
              }
            } catch (culvertErr) {
              console.warn('Menfez Excel ayrıştırma denemesi:', culvertErr);
            }
          }

          // Standard Excel parsing
          const forcedCat = importCategory === 'parcel' ? 'auto' : importCategory;
          const detected = parseExcelBuffer(buffer, targetLine, forcedCat);
          if (detected.length === 0) {
            setStatusMessage({
              type: 'error',
              text: 'Excel dosyasında geçerli satır veya KM bilgisi tespit edilemedi.',
            });
            setParsedPreview([]);
          } else {
            setParsedPreview(detected);
            setStatusMessage({
              type: 'success',
              text: `Excel tablosundan ${detected.length} adet nokta okundu.`,
            });
          }
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        processFileContent(content, file.name);
      }
    };
    reader.readAsText(file);
  };

  const handleParseRawText = () => {
    if (!rawText.trim()) return;
    processFileContent(rawText, 'pasted.kml');
  };

  const handleApplyImport = async () => {
    // If we have parcel previews
    if (parsedParcelsPreview.length > 0 && onImportParcels) {
      setIsProcessing(true);
      try {
        const fullParcels: RailwayParcel[] = parsedParcelsPreview.map((p, idx) => ({
          id: p.id || `parsel-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          adaNo: String(p.adaNo || '101'),
          parselNo: String(p.parselNo || (idx + 1)),
          lineName: p.lineName || targetLine || 'Enveriye - Konya Hattı',
          alanM2: typeof p.alanM2 === 'number' ? p.alanM2 : Number(p.alanM2) || 0,
          il: p.il || 'Eskişehir',
          ilce: p.ilce || 'Merkez',
          mahalleKoy: p.mahalleKoy || '',
          malik: p.malik || 'TCDD İşletmesi Genel Müdürlüğü',
          nitelik: p.nitelik || 'Demiryolu Güzergahı',
          ownershipStatus: p.ownershipStatus || 'tcdd',
          coordinates: Array.isArray(p.coordinates) ? p.coordinates : [],
          notes: p.notes || 'TKGM KML İçe Aktarımı',
          createdAt: p.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));
        await onImportParcels(fullParcels);
        onClose();
      } catch (err: any) {
        setStatusMessage({
          type: 'error',
          text: 'Kadastro parselleri aktarılırken hata oluştu: ' + (err.message || 'Hata'),
        });
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    if (parsedPreview.length === 0) return;
    setIsProcessing(true);
    try {
      if (mergedFullPoints && excelMergeStats && excelMergeStats.matchedCrossingsCount > 0) {
        const updatedOnly = mergedFullPoints.filter((p) =>
          excelMergeStats.details.some((d) => d.pointId === p.id)
        );
        await onImportSuccess(updatedOnly, false);
      } else {
        await onImportSuccess(parsedPreview, replaceAll);
      }
      onClose();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: 'İçe aktarma sırasında bir sorun oluştu: ' + (err.message || 'Hata'),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      id="import-export-modal"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-sky-400" />
            <h3 className="font-bold text-base">KML / Excel / CBS Veri Yönetimi</h3>
          </div>
          <button
            id="close-import-export-btn"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200">
          <button
            id="tab-import-btn"
            onClick={() => setActiveTab('import')}
            className={`flex-1 py-3 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'import'
                ? 'border-b-2 border-sky-600 text-sky-700 bg-sky-50/50'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>KML / Excel / Kadastro İçe Aktar</span>
          </button>
          <button
            id="tab-export-btn"
            onClick={() => setActiveTab('export')}
            className={`flex-1 py-3 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'export'
                ? 'border-b-2 border-sky-600 text-sky-700 bg-sky-50/50'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel / KML Dışa Aktar</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
          {activeTab === 'import' ? (
            <div className="space-y-4">
              {/* Category Selector Banner & Quick Buttons */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-sky-600" />
                    <span>İçe Aktarılacak Kategori:</span>
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Menfez, Kadastro veya Makas seçebilirsiniz
                  </span>
                </div>

                {/* Category Quick Chips */}
                <div className="grid grid-cols-3 sm:grid-cols-3 gap-1.5">
                  {CATEGORY_DEFINITIONS.map((cat) => {
                    const isSelected = importCategory === cat.value;
                    return (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => handleCategorySelection(cat.value)}
                        className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-xl text-[11px] font-semibold transition-all border cursor-pointer ${
                          isSelected
                            ? cat.btnActiveClass
                            : 'bg-white text-slate-700 border-slate-200 hover:border-sky-300 hover:bg-sky-50/50'
                        }`}
                      >
                        <span>{cat.icon}</span>
                        <span className="truncate">{cat.shortLabel}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Target Line name */}
                <div className="pt-2 border-t border-slate-200/70">
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-bold text-slate-700 whitespace-nowrap">
                      Hat / Mıntıka:
                    </label>
                    <input
                      id="import-target-line-input"
                      type="text"
                      value={targetLine}
                      onChange={(e) => setTargetLine(e.target.value)}
                      placeholder="Örn: Enveriye - Konya Hattı"
                      className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* File Dropzone */}
              <div
                className="border-2 border-dashed border-slate-300 hover:border-sky-500 rounded-2xl p-5 text-center cursor-pointer transition-colors bg-white hover:bg-sky-50/30"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".kml,.geojson,.json,.csv,.xlsx,.xls,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-import-input"
                />
                <div className="flex items-center justify-center gap-2 mb-1.5">
                  <Upload className="w-6 h-6 text-sky-600" />
                  <span className="text-xl">
                    {importCategory === 'parcel'
                      ? '🏛️'
                      : importCategory === 'culvert'
                      ? '🕳️'
                      : importCategory === 'switch'
                      ? '🔀'
                      : importCategory === 'bridge'
                      ? '🌉'
                      : importCategory === 'crossing'
                      ? '🚧'
                      : '🗺️'}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-800">
                  KML, Excel (.xlsx), GeoJSON veya CSV dosyasını seçin ya da sürükleyin
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {importCategory === 'parcel'
                    ? 'TKGM Parsel Sorgu KML / GeoJSON dosyaları otomatik olarak tapu parsellerine aktarılır'
                    : importCategory === 'auto'
                    ? 'Nokta türleri dosyadaki isimlerden (Makas, Menfez, Parsel vb.) otomatik tespit edilir'
                    : `Yüklenen tüm noktalar "${CATEGORY_DEFINITIONS.find((c) => c.value === importCategory)?.label}" olarak aktarılacaktır.`}
                </p>
              </div>

              {/* Paste Raw Text Details */}
              <details className="text-xs text-slate-600">
                <summary className="cursor-pointer font-semibold hover:text-slate-900 py-1">
                  veya KML / GeoJSON / CSV metnini buraya yapıştırın
                </summary>
                <div className="mt-2 space-y-2">
                  <textarea
                    id="raw-import-textarea"
                    rows={3}
                    placeholder="<kml>...</kml> veya lat,lng,name..."
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                  <button
                    id="parse-raw-text-btn"
                    type="button"
                    onClick={handleParseRawText}
                    className="bg-slate-800 hover:bg-slate-900 text-white text-xs px-3 py-1.5 rounded-lg font-medium cursor-pointer"
                  >
                    Metni Çözümle
                  </button>
                </div>
              </details>

              {/* Status Message */}
              {statusMessage && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                    statusMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  {statusMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  )}
                  <span>{statusMessage.text}</span>
                </div>
              )}

              {/* Parcels Preview Section */}
              {parsedParcelsPreview.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-purple-900 flex items-center gap-1.5">
                      <Landmark className="w-4 h-4 text-purple-600" />
                      <span>Aktarılacak Kadastro Parselleri ({parsedParcelsPreview.length})</span>
                    </span>
                    <span className="text-[11px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                      {targetLine}
                    </span>
                  </div>

                  <div className="max-h-56 overflow-y-auto space-y-1.5 border border-purple-200 rounded-xl p-2 bg-purple-50/40 text-xs">
                    {parsedParcelsPreview.slice(0, 50).map((p, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center bg-white p-2 rounded-lg border border-purple-100 shadow-2xs"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-[10px] bg-purple-600 text-white font-black px-1.5 py-0.5 rounded font-mono">
                            {p.adaNo}-{p.parselNo}
                          </span>
                          <span className="font-semibold text-slate-800 truncate">
                            {p.mahalleKoy || p.ilce || 'Kadastro Sahası'} ({p.il})
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {p.alanM2 ? (
                            <span className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                              {Number(p.alanM2).toLocaleString('tr-TR')} m²
                            </span>
                          ) : null}
                          <span className="text-[9px] text-slate-500 font-mono">
                            {p.coordinates?.length || 0} köşe
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleApplyImport}
                    disabled={isProcessing}
                    className="w-full bg-purple-700 hover:bg-purple-800 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Landmark className="w-4 h-4" />
                    <span>
                      {isProcessing
                        ? 'Parseller Aktarılıyor...'
                        : `${parsedParcelsPreview.length} Kadastro Parselini Sisteme Kaydet`}
                    </span>
                  </button>
                </div>
              )}

              {/* Point Preview & Import button */}
              {parsedPreview.length > 0 && parsedParcelsPreview.length === 0 && (
                <div className="space-y-3 pt-2 border-t border-slate-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">
                        {excelMergeStats
                          ? `Eşleşen Geçitler (${parsedPreview.length})`
                          : `Aktarılacak Noktalar (${parsedPreview.length})`}
                      </span>
                    </div>

                    {/* Bulk category switcher */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500 font-medium">Tümünü Değiştir:</span>
                      <select
                        aria-label="Tüm noktaların kategorisini değiştir"
                        onChange={(e) => {
                          const val = e.target.value as RailwayPointCategory;
                          if (val) handleBulkChangeAllPreview(val);
                        }}
                        className="text-[11px] font-semibold bg-slate-100 border border-slate-300 rounded-lg px-2 py-1 focus:ring-1 focus:ring-sky-500"
                        defaultValue=""
                      >
                        <option value="" disabled>
                          Kategori Seç...
                        </option>
                        <option value="culvert">🕳️ Menfez</option>
                        <option value="switch">🔀 Makas</option>
                        <option value="bridge">🌉 Köprü / Viyadük</option>
                        <option value="crossing">🚧 Hemzemin Geçit</option>
                        <option value="station">🚉 İstasyon</option>
                        <option value="km_marker">📍 KM Taşı</option>
                        <option value="signal">🚦 Sinyal</option>
                        <option value="other">📦 Diğer</option>
                      </select>
                    </div>
                  </div>

                  {!excelMergeStats && (
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 text-xs select-none">
                      <input
                        id="replace-all-checkbox"
                        type="checkbox"
                        checked={replaceAll}
                        onChange={(e) => setReplaceAll(e.target.checked)}
                        className="rounded text-sky-600"
                      />
                      <span>Mevcut kayıtları sil, sıfırdan yükle</span>
                    </label>
                  )}

                  {/* Item List with category badge / dropdown per row */}
                  <div className="max-h-56 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2 bg-slate-50 text-xs">
                    {parsedPreview.slice(0, 50).map((p, idx) => {
                      const cat = p.category || 'km_marker';
                      const catDef = CATEGORY_DEFINITIONS.find((c) => c.value === cat) || CATEGORY_DEFINITIONS[2];

                      return (
                        <div
                          key={idx}
                          className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200/80 shadow-2xs hover:border-slate-300"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                            {/* Per-item category selector dropdown */}
                            <select
                              value={cat}
                              onChange={(e) =>
                                handleRowCategoryChange(idx, e.target.value as RailwayPointCategory)
                              }
                              aria-label={`${p.title || `Nokta ${idx + 1}`} kategorisi`}
                              className={`text-[10px] font-bold px-1.5 py-1 rounded-md border cursor-pointer ${catDef.badgeClass}`}
                            >
                              <option value="culvert">🕳️ Menfez</option>
                              <option value="switch">🔀 Makas</option>
                              <option value="bridge">🌉 Köprü</option>
                              <option value="crossing">🚧 Geçit</option>
                              <option value="station">🚉 İstasyon</option>
                              <option value="km_marker">📍 KM Taşı</option>
                              <option value="signal">🚦 Sinyal</option>
                              <option value="other">📦 Diğer</option>
                            </select>

                            <span className="font-bold text-slate-800 truncate" title={p.title}>
                              {p.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {p.kmValue && (
                              <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                                KM {p.kmValue}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {parsedPreview.length > 50 && (
                      <div className="text-center text-slate-500 text-[11px] pt-1">
                        ...ve {parsedPreview.length - 50} nokta daha
                      </div>
                    )}
                  </div>

                  <button
                    id="apply-import-btn"
                    onClick={handleApplyImport}
                    disabled={isProcessing}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>
                      {isProcessing
                        ? 'Senkronize Ediliyor...'
                        : `${parsedPreview.length} Noktayı Sisteme Aktar`}
                    </span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Export Tab */
            <div className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Uygulamadaki tüm demiryolu KM noktalarını, menfezleri, makasları, geçitleri ve fotoğrafları Google Earth, Google My Maps veya CBS (GIS) yazılımlarında açabileceğiniz standart formatlarda indirebilirsiniz.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  id="export-excel-btn"
                  onClick={() => exportToExcel(points)}
                  className="flex flex-col items-center justify-center p-4 bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-200 hover:border-emerald-300 rounded-2xl transition-all group col-span-1 sm:col-span-2 shadow-xs cursor-pointer"
                >
                  <Table className="w-6 h-6 text-emerald-700 mb-1.5 group-hover:scale-110 transition-transform" />
                  <span className="font-bold text-xs text-emerald-950">Excel (.xlsx) Tablosu Olarak İndir</span>
                  <span className="text-[11px] text-emerald-800 text-center mt-0.5">
                    Tüm KM noktaları, menfezler, makaslar, geçitler ve teknik parametreler
                  </span>
                </button>

                <button
                  id="export-json-btn"
                  onClick={() => exportToJSON(points)}
                  className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl transition-all group cursor-pointer"
                >
                  <Download className="w-6 h-6 text-indigo-600 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="font-bold text-xs text-slate-800">JSON Olarak İndir (Tam Yedek)</span>
                  <span className="text-[11px] text-slate-500 text-center mt-0.5">
                    Tüm fotoğraflar, notlar ve KM verileri
                  </span>
                </button>

                <button
                  id="copy-json-btn"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(JSON.stringify(points, null, 2));
                      setIsCopied(true);
                      setTimeout(() => setIsCopied(false), 2500);
                    } catch (e) {
                      console.warn('Panoya kopyalanamadı:', e);
                    }
                  }}
                  className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-violet-50 border border-slate-200 hover:border-violet-300 rounded-2xl transition-all group cursor-pointer"
                >
                  {isCopied ? (
                    <Check className="w-6 h-6 text-emerald-600 mb-2 group-hover:scale-110 transition-transform" />
                  ) : (
                    <Copy className="w-6 h-6 text-violet-600 mb-2 group-hover:scale-110 transition-transform" />
                  )}
                  <span className="font-bold text-xs text-slate-800">
                    {isCopied ? 'Panoya Kopyalandı!' : 'JSON Listeyi Kopyala'}
                  </span>
                  <span className="text-[11px] text-slate-500 text-center mt-0.5">
                    {isCopied ? 'Metin panoya alındı' : 'Doğrudan sohbete veya dosyaya yapıştır'}
                  </span>
                </button>

                <button
                  id="export-kml-btn"
                  onClick={() => exportToKML(points)}
                  className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 rounded-2xl transition-all group cursor-pointer"
                >
                  <Download className="w-6 h-6 text-sky-600 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="font-bold text-xs text-slate-800">KML Olarak İndir</span>
                  <span className="text-[11px] text-slate-500 text-center mt-0.5">
                    Google Earth &amp; My Maps uyumlu
                  </span>
                </button>

                <button
                  id="export-geojson-btn"
                  onClick={() => exportToGeoJSON(points)}
                  className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-2xl transition-all group cursor-pointer"
                >
                  <Download className="w-6 h-6 text-emerald-600 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="font-bold text-xs text-slate-800">GeoJSON Olarak İndir</span>
                  <span className="text-[11px] text-slate-500 text-center mt-0.5">
                    Modern CBS &amp; Harita standartı
                  </span>
                </button>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-800">Tüm Noktaları Temizle</div>
                    <div className="text-[11px] text-slate-500">
                      Haritadaki tüm demiryolu KM noktalarını ve kayıtları tamamen temizler.
                    </div>
                  </div>
                  <button
                    id="reset-sample-btn"
                    onClick={() => setShowResetConfirm(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Tümünü Temizle</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <DeleteConfirmModal
        isOpen={showResetConfirm}
        title="Tüm Noktaları Temizle"
        description="Haritadaki tüm demiryolu KM noktaları tamamen silinecektir. Varsayılan örnek noktalar geri yüklenmeyecektir."
        confirmText="Evet, Temizle"
        cancelText="Vazgeç"
        isDeleting={isResetting}
        onConfirm={async () => {
          setIsResetting(true);
          try {
            await onResetSample();
            setShowResetConfirm(false);
            onClose();
          } finally {
            setIsResetting(false);
          }
        }}
        onClose={() => setShowResetConfirm(false)}
      />
    </div>
  );
};
