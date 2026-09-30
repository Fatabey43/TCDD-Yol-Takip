import React, { useState } from 'react';
import { FileText, Download, Printer, X, CheckSquare, Wrench, ShieldAlert, Layers } from 'lucide-react';
import { RailwayPoint } from '../types.ts';
import { exportRailwayReportToExcel, openPrintableRailwayReport, ReportFilterOptions } from '../utils/reportGenerator.ts';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  points: RailwayPoint[];
}

export const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, points }) => {
  const [reportType, setReportType] = useState<'culvert' | 'crossing' | 'workLog' | 'all'>('workLog');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  if (!isOpen) return null;

  const totalCulverts = points.filter(p => p.category === 'culvert' || p.culvert).length;
  const totalCrossings = points.filter(p => p.category === 'crossing' || p.levelCrossing).length;
  let totalWorkLogs = 0;
  points.forEach(p => {
    totalWorkLogs += (p.workLogs?.length || 0);
  });

  const handleExportExcel = () => {
    setIsExporting(true);
    try {
      exportRailwayReportToExcel(points, { reportType });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrintPdf = () => {
    openPrintableRailwayReport(points, { reportType });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-lg rounded-2xl shadow-2xl text-white overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">TCDD Resmi Saha Raporları</h3>
              <p className="text-xs text-slate-400">712. Yol Bakım Şefliği Teftiş &amp; Faaliyet Çıktısı</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-300">
            Aşağıdan almak istediğiniz resmi rapor tipini seçin. Raporu doğrudan <strong>Excel (XLSX)</strong> tablosu olarak indirebilir veya <strong>Resmi Yazdır / PDF</strong> formatında görüntüleyebilirsiniz:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* 1. Yapılan İşler Raporu */}
            <button
              type="button"
              onClick={() => setReportType('workLog')}
              className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                reportType === 'workLog'
                  ? 'bg-amber-500/15 border-amber-500 ring-2 ring-amber-500/30 text-white'
                  : 'bg-slate-800/60 border-slate-700 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <Wrench className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-sm text-white">Yapılan Saha İşleri</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Bakım, onarım ve malzeme kayıtları</div>
                <div className="text-[10px] text-amber-400 font-semibold mt-1">{totalWorkLogs} Kayıt</div>
              </div>
            </button>

            {/* 2. Menfez Raporu */}
            <button
              type="button"
              onClick={() => setReportType('culvert')}
              className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                reportType === 'culvert'
                  ? 'bg-indigo-500/15 border-indigo-500 ring-2 ring-indigo-500/30 text-white'
                  : 'bg-slate-800/60 border-slate-700 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-sm text-white">Menfez Envanteri</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Açıklık, debuşe, yapım yılı ve cins</div>
                <div className="text-[10px] text-indigo-400 font-semibold mt-1">{totalCulverts} Menfez</div>
              </div>
            </button>

            {/* 3. Hemzemin Geçit Raporu */}
            <button
              type="button"
              onClick={() => setReportType('crossing')}
              className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                reportType === 'crossing'
                  ? 'bg-emerald-500/15 border-emerald-500 ring-2 ring-emerald-500/30 text-white'
                  : 'bg-slate-800/60 border-slate-700 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-sm text-white">Hemzemin Geçitler</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Tip, kaplama, trafik ve güvenlik föyü</div>
                <div className="text-[10px] text-emerald-400 font-semibold mt-1">{totalCrossings} Geçit</div>
              </div>
            </button>

            {/* 4. Tüm Hat Envanteri */}
            <button
              type="button"
              onClick={() => setReportType('all')}
              className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                reportType === 'all'
                  ? 'bg-sky-500/15 border-sky-500 ring-2 ring-sky-500/30 text-white'
                  : 'bg-slate-800/60 border-slate-700 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                <CheckSquare className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-sm text-white">Genel Hat Raporu</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Tüm kategori ve noktaların dökümü</div>
                <div className="text-[10px] text-sky-400 font-semibold mt-1">{points.length} Toplam Nokta</div>
              </div>
            </button>
          </div>

          <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Rapor Çıktı Standardı:</span>
            <span className="font-bold text-slate-200">TCDD 712. Yol Bakım Şefliği</span>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handlePrintPdf}
            className="px-4 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-md"
          >
            <Printer className="w-4 h-4 text-sky-400" />
            Yazdır / PDF
          </button>
          <button
            type="button"
            disabled={isExporting}
            onClick={handleExportExcel}
            className="px-4 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:brightness-110 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-500/20"
          >
            <Download className="w-4 h-4 stroke-[2.5]" />
            Excel İndir (.xlsx)
          </button>
        </div>
      </div>
    </div>
  );
};
