import React, { useState } from 'react';
import { Wrench, Calendar, User, CheckCircle2, Clock, Plus, Trash2, X, FileText } from 'lucide-react';
import { RailwayPoint, WorkLog } from '../types.ts';

interface WorkLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  point: RailwayPoint;
  onSaveWorkLog: (pointId: string, log: WorkLog) => Promise<void>;
  onDeleteWorkLog: (pointId: string, logId: string) => Promise<void>;
}

export const WorkLogModal: React.FC<WorkLogModalProps> = ({
  isOpen,
  onClose,
  point,
  onSaveWorkLog,
  onDeleteWorkLog,
}) => {
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('');
  const [workType, setWorkType] = useState<WorkLog['workType']>('bakim');
  const [performedAt, setPerformedAt] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [performedBy, setPerformedBy] = useState<string>('712 Yol Bakım Ekibi');
  const [description, setDescription] = useState<string>('');
  const [crewCount, setCrewCount] = useState<string>('4');
  const [materialsUsed, setMaterialsUsed] = useState<string>('');
  const [status, setStatus] = useState<WorkLog['status']>('tamamlandi');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const logs = point.workLogs || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setIsSubmitting(true);
    try {
      const newLog: WorkLog = {
        id: `work-${Date.now()}`,
        title: title.trim(),
        workType,
        performedAt,
        performedBy: performedBy.trim(),
        description: description.trim(),
        crewCount: crewCount.trim(),
        materialsUsed: materialsUsed.trim(),
        status,
      };

      await onSaveWorkLog(point.id, newLog);
      setTitle('');
      setDescription('');
      setMaterialsUsed('');
      setIsAddingNew(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-xl rounded-2xl shadow-2xl text-white overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Saha İşleri &amp; Bakım Defteri</h3>
              <p className="text-xs text-slate-400">{point.title} {point.kmValue ? `(${point.kmValue})` : ''}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {!isAddingNew ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">
                  Kayıtlı Faaliyetler ({logs.length})
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingNew(true)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Yeni İş Kaydı Ekle
                </button>
              </div>

              {logs.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl text-slate-400 text-xs">
                  <FileText className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                  Bu noktada henüz kayıtlı bir bakım veya onarım işi bulunmuyor.
                  <div className="mt-2">
                    <button
                      onClick={() => setIsAddingNew(true)}
                      className="text-amber-400 hover:underline font-semibold"
                    >
                      İlk iş kaydını oluşturun
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-3.5 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-sm text-white flex items-center gap-2">
                            {log.title}
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                              log.status === 'tamamlandi'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}>
                              {log.status === 'tamamlandi' ? 'Tamamlandı' : log.status === 'devam_ediyor' ? 'Devam Ediyor' : 'Planlandı'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-500" /> {log.performedAt}
                            </span>
                            <span className="flex items-center gap-1">
                              <User className="w-3.5 h-3.5 text-slate-500" /> {log.performedBy}
                            </span>
                            {log.crewCount && (
                              <span>👥 {log.crewCount} Personel</span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onDeleteWorkLog(point.id, log.id)}
                          className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-700/50 transition-colors"
                          title="İş Kaydını Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <p className="text-xs text-slate-200 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 whitespace-pre-wrap">
                        {log.description}
                      </p>

                      {log.materialsUsed && (
                        <div className="text-[11px] text-amber-300/90 font-medium">
                          🛠️ Kullanılan Malzemeler: {log.materialsUsed}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-amber-400">Yeni Saha İşi / Bakım Kaydı Formu</span>
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Listeye Dön
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Yapılan İş Başlığı *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Balast Takviyesi, Menfez Ağzı Temizliği, Travers Değişimi"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">İş Türü</label>
                  <select
                    value={workType}
                    onChange={(e: any) => setWorkType(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="bakim">Rutin Bakım</option>
                    <option value="onarim">Onarım / Tamirat</option>
                    <option value="yenileme">Yenileme</option>
                    <option value="temizlik">Temizlik &amp; Açma</option>
                    <option value="muayene">Ölçüm &amp; Muayene</option>
                    <option value="diger">Diğer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Tarih</label>
                  <input
                    type="date"
                    value={performedAt}
                    onChange={(e) => setPerformedAt(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Durum</label>
                  <select
                    value={status}
                    onChange={(e: any) => setStatus(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="tamamlandi">Tamamlandı</option>
                    <option value="devam_ediyor">Devam Ediyor</option>
                    <option value="planlandi">Planlandı</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">İşi Yapan Ekip / Personel</label>
                  <input
                    type="text"
                    placeholder="Örn: 712 Yol Bakım Ekibi"
                    value={performedBy}
                    onChange={(e) => setPerformedBy(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Personel Sayısı</label>
                  <input
                    type="text"
                    placeholder="Örn: 4 Personel + 1 Makine"
                    value={crewCount}
                    onChange={(e) => setCrewCount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Kullanılan Malzeme &amp; Ekipman
                </label>
                <input
                  type="text"
                  placeholder="Örn: 4 adet B70 travers, 3 ton balast, 2 torba çimento"
                  value={materialsUsed}
                  onChange={(e) => setMaterialsUsed(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Yapılan İşin Detayı ve Saha Notu *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Yapılan işlemler, karşılaşılan durumlar, alınan önlemler..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-all cursor-pointer shadow-md shadow-amber-500/20"
                >
                  {isSubmitting ? 'Kaydediliyor...' : 'İş Kaydını Kaydet'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
