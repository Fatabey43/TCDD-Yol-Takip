import React, { useState, useRef } from 'react';
import { RailwayPoint } from '../types.ts';
import { parseKML, parseGeoJSON, parseCSV, parseNativeJSON, exportToGeoJSON, exportToKML, exportToJSON } from '../utils/kmlParser.ts';
import { DeleteConfirmModal } from './DeleteConfirmModal.tsx';
import { X, Upload, Download, FileText, CheckCircle2, AlertCircle, RefreshCw, Copy, Check } from 'lucide-react';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  points: RailwayPoint[];
  onImportSuccess: (importedPoints: Partial<RailwayPoint>[], replaceAll: boolean) => Promise<void>;
  onResetSample: () => Promise<void>;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  onClose,
  points,
  onImportSuccess,
  onResetSample,
}) => {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [targetLine, setTargetLine] = useState<string>('Kayıtlı Demiryolu Hattı');
  const [parsedPreview, setParsedPreview] = useState<Partial<RailwayPoint>[]>([]);
  const [replaceAll, setReplaceAll] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [rawText, setRawText] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const processFileContent = (content: string, fileName: string) => {
    setStatusMessage(null);
    let detected: Partial<RailwayPoint>[] = [];

    const lowerName = fileName.toLowerCase();
    const trimmed = content.trim();

    if (lowerName.endsWith('.json') || trimmed.startsWith('[') || trimmed.startsWith('{')) {
      detected = parseNativeJSON(content);
      if (detected.length === 0) {
        detected = parseGeoJSON(content, targetLine);
      }
    } else if (lowerName.endsWith('.kml') || content.includes('<kml')) {
      detected = parseKML(content, targetLine);
    } else if (lowerName.endsWith('.geojson')) {
      detected = parseGeoJSON(content, targetLine);
    } else if (lowerName.endsWith('.csv')) {
      detected = parseCSV(content, targetLine);
    } else {
      // Auto-detect by content
      if (content.includes('<kml') || content.includes('<Placemark')) {
        detected = parseKML(content, targetLine);
      } else if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        detected = parseNativeJSON(content);
        if (detected.length === 0) {
          detected = parseGeoJSON(content, targetLine);
        }
      } else {
        detected = parseCSV(content, targetLine);
      }
    }

    if (detected.length === 0) {
      setStatusMessage({
        type: 'error',
        text: 'Dosya içeriğinde geçerli koordinat ve KM noktası tespit edilemedi. Lütfen KML, GeoJSON veya CSV formatında bir dosya yükleyin.',
      });
      setParsedPreview([]);
    } else {
      setParsedPreview(detected);
      setStatusMessage({
        type: 'success',
        text: `${detected.length} adet demiryolu KM noktası başarıyla ayrıştırıldı.`,
      });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
    if (parsedPreview.length === 0) return;
    setIsProcessing(true);
    try {
      await onImportSuccess(parsedPreview, replaceAll);
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
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-sky-400" />
            <h3 className="font-bold text-base">Google Haritalar &amp; KM Veri Yönetimi</h3>
          </div>
          <button
            id="close-import-export-btn"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200">
          <button
            id="tab-import-btn"
            onClick={() => setActiveTab('import')}
            className={`flex-1 py-3 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'import'
                ? 'border-b-2 border-sky-600 text-sky-700 bg-sky-50/50'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Google Haritalar'dan İçe Aktar (KML/CSV)</span>
          </button>
          <button
            id="tab-export-btn"
            onClick={() => setActiveTab('export')}
            className={`flex-1 py-3 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'export'
                ? 'border-b-2 border-sky-600 text-sky-700 bg-sky-50/50'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Dışa Aktar &amp; Yedekle</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {activeTab === 'import' ? (
            <div className="space-y-4">
              <div className="bg-sky-50/70 p-3 rounded-xl border border-sky-200/80 text-xs text-sky-900 leading-relaxed">
                <strong>Google Haritalar (My Maps) Verilerinizi Aktarın:</strong> Google Haritalarım'da (Google My Maps) kaydettiğiniz demiryolu KM noktalarını "KML / KMZ olarak dışa aktar" seçeneğiyle indirip buraya yükleyebilirsiniz. Veriler anında tüm cihazlarınıza senkronize edilir.
              </div>

              {/* Line designation */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Varsayılan Hat Adı
                </label>
                <input
                  id="import-target-line-input"
                  type="text"
                  value={targetLine}
                  onChange={(e) => setTargetLine(e.target.value)}
                  placeholder="Örn: Ankara - İstanbul Hızlı Tren Hattı"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              {/* File Dropzone */}
              <div
                className="border-2 border-dashed border-slate-300 hover:border-sky-500 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-slate-50 hover:bg-sky-50/30"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".kml,.geojson,.json,.csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-import-input"
                />
                <FileText className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">
                  KML, GeoJSON veya CSV dosyasını buraya sürükleyin ya da seçin
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Google Haritalar KML dışa aktarımı tam uyumludur
                </p>
              </div>

              {/* Or paste text */}
              <details className="text-xs text-slate-600">
                <summary className="cursor-pointer font-semibold hover:text-slate-900 py-1">
                  veya KML / GeoJSON / CSV kodunu buraya yapıştırın
                </summary>
                <div className="mt-2 space-y-2">
                  <textarea
                    id="raw-import-textarea"
                    rows={4}
                    placeholder="<kml>...</kml> veya lat,lng,name..."
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                  <button
                    id="parse-raw-text-btn"
                    type="button"
                    onClick={handleParseRawText}
                    className="bg-slate-800 hover:bg-slate-900 text-white text-xs px-3 py-1.5 rounded-lg font-medium"
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

              {/* Preview & Import button */}
              {parsedPreview.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">
                      Tespit Edilen Noktalar ({parsedPreview.length})
                    </span>
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 select-none">
                      <input
                        id="replace-all-checkbox"
                        type="checkbox"
                        checked={replaceAll}
                        onChange={(e) => setReplaceAll(e.target.checked)}
                        className="rounded text-sky-600"
                      />
                      <span>Mevcut kayıtları sil, sıfırdan yükle</span>
                    </label>
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2 bg-slate-50 text-xs">
                    {parsedPreview.slice(0, 15).map((p, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
                        <span className="font-bold text-slate-800">{p.title}</span>
                        <span className="font-mono text-[11px] text-slate-500">
                          {p.lat?.toFixed(4)}, {p.lng?.toFixed(4)}
                        </span>
                      </div>
                    ))}
                    {parsedPreview.length > 15 && (
                      <div className="text-center text-slate-500 text-[11px] pt-1">
                        ...ve {parsedPreview.length - 15} nokta daha
                      </div>
                    )}
                  </div>

                  <button
                    id="apply-import-btn"
                    onClick={handleApplyImport}
                    disabled={isProcessing}
                    className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition-colors flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>
                      {isProcessing ? 'Senkronize Ediliyor...' : `${parsedPreview.length} Noktayı Tüm Cihazlara Yükle`}
                    </span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Export Tab */
            <div className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Uygulamadaki tüm demiryolu KM noktalarını, notları ve saha verilerini Google Earth, Google My Maps veya CBS (GIS) yazılımlarında açabileceğiniz standart formatlarda indirebilirsiniz.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  id="export-json-btn"
                  onClick={() => exportToJSON(points)}
                  className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl transition-all group"
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
                  className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-violet-50 border border-slate-200 hover:border-violet-300 rounded-2xl transition-all group"
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
                  className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 rounded-2xl transition-all group"
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
                  className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-2xl transition-all group"
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
