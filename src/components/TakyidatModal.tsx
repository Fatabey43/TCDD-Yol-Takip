import React, { useState, useMemo, useEffect } from 'react';
import { RailwayPoint, TakyidatSpeedRestriction } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { formatKmDisplay } from '../utils/categoryColors.ts';
import { sortPointsByKm } from '../utils/kmUtils.ts';
import {
  Gauge,
  Plus,
  AlertTriangle,
  Trash2,
  Edit2,
  Calendar,
  X,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ArrowRight,
  MapPin,
  FileText,
  Filter,
  Crosshair,
  Search,
  Train,
  ListFilter,
  Navigation,
  BarChart2,
} from 'lucide-react';
import { TakyidatAnalyticsView } from './TakyidatAnalyticsView.tsx';

export interface TakyidatFormDraft {
  startKm: string;
  endKm: string;
  speedLimit: number;
  normalSpeed: number;
  lineName: string;
  reason: string;
  status: 'active' | 'planned' | 'lifted';
  trackType: 'single' | 'line1' | 'line2' | 'both';
  noticeNo: string;
  issuedBy: string;
  notes: string;
  editingId?: string | null;
}

interface TakyidatModalProps {
  isOpen: boolean;
  onClose: () => void;
  restrictions: TakyidatSpeedRestriction[];
  points?: RailwayPoint[];
  onAddRestriction: (entry: Omit<TakyidatSpeedRestriction, 'id' | 'createdAt' | 'updatedAt' | 'startKmNum' | 'endKmNum'>) => Promise<void>;
  onUpdateRestriction: (entry: TakyidatSpeedRestriction) => Promise<void>;
  onDeleteRestriction: (id: string) => Promise<void>;
  onFocusSegment?: (startKmNum: number, endKmNum: number) => void;
  availableLines?: string[];
  onStartPickOnMap?: (target: 'start' | 'end' | 'both', currentDraft: TakyidatFormDraft) => void;
  initialDraft?: TakyidatFormDraft | null;
  onDraftConsumed?: () => void;
}

export const TakyidatModal: React.FC<TakyidatModalProps> = ({
  isOpen,
  onClose,
  restrictions,
  points = [],
  onAddRestriction,
  onUpdateRestriction,
  onDeleteRestriction,
  onFocusSegment,
  availableLines = ['Eskişehir-Konya'],
  onStartPickOnMap,
  initialDraft = null,
  onDraftConsumed,
}) => {
  const { canAddPoint, canDelete } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TakyidatSpeedRestriction | null>(null);

  // Form states
  const [startKm, setStartKm] = useState('54+000');
  const [endKm, setEndKm] = useState('55+000');
  const [speedLimit, setSpeedLimit] = useState<number | string>(30);
  const [normalSpeed, setNormalSpeed] = useState<number | string>(120);
  const [lineName, setLineName] = useState<string>(availableLines[0] || 'Eskişehir-Konya');
  const [reason, setReason] = useState('Yol bakım ve balast takviyesi çalışması');
  const [status, setStatus] = useState<'active' | 'planned' | 'lifted'>('active');
  const [trackType, setTrackType] = useState<'single' | 'line1' | 'line2' | 'both'>('both');
  const [noticeNo, setNoticeNo] = useState(`YOL EMRİ ${new Date().getFullYear()}/14`);
  const [issuedBy, setIssuedBy] = useState('712 Yol Bakım Şefliği');
  const [notes, setNotes] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'planned' | 'lifted'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mainTab, setMainTab] = useState<'list' | 'analytics'>('list');

  // Manuel Seçme (Kayıtlı Noktalardan Seçim Modalı) State
  const [manualPickTarget, setManualPickTarget] = useState<'start' | 'end' | null>(null);
  const [pointSearchQuery, setPointSearchQuery] = useState('');
  const [pointLineFilter, setPointLineFilter] = useState('all');

  // Sorted registered points by ascending KM
  const sortedPoints = useMemo(() => sortPointsByKm(points), [points]);

  // Filtered registered points for the manual picker sub-modal
  const filteredPickerPoints = useMemo(() => {
    const q = pointSearchQuery.trim().toLowerCase();
    return sortedPoints.filter((p) => {
      const matchLine = pointLineFilter === 'all' || p.lineName === pointLineFilter;
      if (!matchLine) return false;
      if (!q) return true;
      const titleMatch = (p.title || '').toLowerCase().includes(q);
      const kmMatch = (p.kmValue || '').toLowerCase().includes(q);
      const descMatch = (p.locationDesc || '').toLowerCase().includes(q);
      const lineMatch = (p.lineName || '').toLowerCase().includes(q);
      return titleMatch || kmMatch || descMatch || lineMatch;
    });
  }, [sortedPoints, pointSearchQuery, pointLineFilter]);

  // Synchronize when draft is returned (e.g. from map pick)
  useEffect(() => {
    if (initialDraft && isOpen) {
      if (initialDraft.startKm) setStartKm(initialDraft.startKm);
      if (initialDraft.endKm) setEndKm(initialDraft.endKm);
      if (initialDraft.speedLimit) setSpeedLimit(initialDraft.speedLimit);
      if (initialDraft.normalSpeed) setNormalSpeed(initialDraft.normalSpeed);
      if (initialDraft.lineName) setLineName(initialDraft.lineName);
      if (initialDraft.reason) setReason(initialDraft.reason);
      if (initialDraft.status) setStatus(initialDraft.status);
      if (initialDraft.trackType) setTrackType(initialDraft.trackType);
      if (initialDraft.noticeNo) setNoticeNo(initialDraft.noticeNo);
      if (initialDraft.issuedBy) setIssuedBy(initialDraft.issuedBy);
      if (initialDraft.notes) setNotes(initialDraft.notes);
      if (initialDraft.editingId) {
        const item = restrictions.find((r) => r.id === initialDraft.editingId);
        if (item) setEditingItem(item);
      }
      setIsFormOpen(true);
      if (onDraftConsumed) onDraftConsumed();
    }
  }, [initialDraft, isOpen, restrictions, onDraftConsumed]);

  if (!isOpen) return null;

  const getCurrentDraft = (): TakyidatFormDraft => ({
    startKm,
    endKm,
    speedLimit: Number(speedLimit) || 30,
    normalSpeed: Number(normalSpeed) || 120,
    lineName,
    reason,
    status,
    trackType,
    noticeNo,
    issuedBy,
    notes,
    editingId: editingItem?.id || null,
  });

  const handleTriggerMapPick = (target: 'start' | 'end' | 'both') => {
    if (!onStartPickOnMap) return;
    onStartPickOnMap(target, getCurrentDraft());
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setStartKm('54+000');
    setEndKm('55+000');
    setSpeedLimit(30);
    setNormalSpeed(120);
    setReason('Yol bakım / balast takviyesi');
    setStatus('active');
    setTrackType('both');
    setNoticeNo(`YOL EMRİ ${new Date().getFullYear()}/${Math.floor(Math.random() * 80 + 10)}`);
    setIssuedBy('712 Yol Bakım Şefliği');
    setNotes('');
    setIsFormOpen(true);
  };

  const handleOpenAddWithManualPicker = () => {
    handleOpenAdd();
    setManualPickTarget('start');
    setPointSearchQuery('');
  };

  const handleOpenEdit = (item: TakyidatSpeedRestriction) => {
    setEditingItem(item);
    setStartKm(item.startKm);
    setEndKm(item.endKm);
    setSpeedLimit(item.speedLimit);
    setNormalSpeed(item.normalSpeed || 120);
    setLineName(item.lineName || availableLines[0] || 'Eskişehir-Konya');
    setReason(item.reason);
    setStatus(item.status);
    setTrackType(item.trackType || 'both');
    setNoticeNo(item.noticeNo || '');
    setIssuedBy(item.issuedBy || '712 Yol Bakım Şefliği');
    setNotes(item.notes || '');
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startKm || !endKm || !speedLimit) return;
    setIsSubmitting(true);
    try {
      if (editingItem) {
        await onUpdateRestriction({
          ...editingItem,
          startKm: startKm.trim(),
          endKm: endKm.trim(),
          speedLimit: Number(speedLimit),
          normalSpeed: Number(normalSpeed),
          lineName,
          reason,
          status,
          trackType,
          noticeNo,
          issuedBy,
          notes,
        });
      } else {
        await onAddRestriction({
          startKm: startKm.trim(),
          endKm: endKm.trim(),
          speedLimit: Number(speedLimit),
          normalSpeed: Number(normalSpeed),
          lineName,
          reason,
          status,
          trackType,
          noticeNo,
          issuedBy,
          notes,
          startDate: new Date().toISOString(),
        });
      }
      setIsFormOpen(false);
      setEditingItem(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredList = restrictions.filter((r) => {
    if (filterStatus === 'all') return true;
    return r.status === filterStatus;
  });

  return (
    <div
      id="takyidat-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[90vh] relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-red-950 via-slate-900 to-slate-900 text-white border-b border-red-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-red-600 flex items-center justify-center shadow-lg text-white shrink-0">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base tracking-tight text-white">
                  TCDD TAKYİDAT &amp; HIZ KISITLAMALARI
                </h3>
                <span className="text-[10px] bg-red-500/20 text-red-300 border border-red-500/40 px-2 py-0.5 rounded-full font-mono font-bold">
                  {restrictions.filter((r) => r.status === 'active').length} Aktif Hız Tahdidi
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Demiryolu hat kesimleri geçici &amp; kalıcı hız sınırları, yol emirleri ve harita görünümü
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs: Tahdit Listesi vs Hız Tahditleri Analizi */}
        <div className="bg-slate-900 px-6 pt-1.5 flex items-center gap-2 border-b border-slate-800 flex-shrink-0">
          <button
            type="button"
            id="tab-takyidat-list"
            onClick={() => setMainTab('list')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              mainTab === 'list'
                ? 'border-red-500 text-white bg-slate-800/90 rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 rounded-t-xl'
            }`}
          >
            <Gauge className="w-4 h-4 text-red-500" />
            <span>Tahdit Listesi &amp; Düzenleme</span>
            <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded-full text-slate-300 font-mono">
              {restrictions.length}
            </span>
          </button>

          <button
            type="button"
            id="tab-takyidat-analytics"
            onClick={() => setMainTab('analytics')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              mainTab === 'analytics'
                ? 'border-amber-500 text-white bg-slate-800/90 rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 rounded-t-xl'
            }`}
          >
            <BarChart2 className="w-4 h-4 text-amber-500" />
            <span>Hız Tahditleri Analizi</span>
            <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded-full font-mono font-bold">
              Çizelge &amp; Profil
            </span>
          </button>
        </div>

        {mainTab === 'analytics' ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <TakyidatAnalyticsView
              restrictions={restrictions}
              points={points}
              availableLines={availableLines}
              onFocusSegment={(startKmNum, endKmNum) => {
                onFocusSegment?.(startKmNum, endKmNum);
                onClose();
              }}
              onOpenEdit={(item) => {
                setMainTab('list');
                handleOpenEdit(item);
              }}
              onOpenAdd={() => {
                setMainTab('list');
                handleOpenAdd();
              }}
            />
          </div>
        ) : (
          <>
            {/* Action Toolbar */}
        <div className="bg-slate-100 px-6 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-slate-600 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Filtrele:</span>
            </span>
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              Tümü ({restrictions.length})
            </button>
            <button
              onClick={() => setFilterStatus('active')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'active'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-white text-red-700 hover:bg-red-50 border border-red-200'
              }`}
            >
              Aktif Hız Tahditleri ({restrictions.filter((r) => r.status === 'active').length})
            </button>
            <button
              onClick={() => setFilterStatus('lifted')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'lifted'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
              }`}
            >
              Kaldırılanlar ({restrictions.filter((r) => r.status === 'lifted').length})
            </button>
          </div>

          {canAddPoint && !isFormOpen && (
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              {onStartPickOnMap && (
                <button
                  type="button"
                  id="takyidat-pick-map-btn"
                  onClick={() => handleTriggerMapPick('both')}
                  className="flex items-center gap-1.5 bg-gradient-to-r from-sky-700 to-blue-700 hover:from-sky-600 hover:to-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                  title="Harita üzerinden dokunarak başlangıç ve bitiş KM seçip ekle"
                >
                  <Crosshair className="w-3.5 h-3.5 text-sky-200" />
                  <span>Haritadan Seçerek Ekle</span>
                </button>
              )}

              {points.length > 0 && (
                <button
                  type="button"
                  id="takyidat-pick-points-btn"
                  onClick={handleOpenAddWithManualPicker}
                  className="flex items-center gap-1.5 bg-sky-950 hover:bg-sky-900 border border-sky-600 text-sky-200 hover:text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                  title="Kayıtlı demiryolu noktalarından manuel seçerek ekle"
                >
                  <ListFilter className="w-3.5 h-3.5 text-sky-400" />
                  <span>Manuel Nokta Seç</span>
                </button>
              )}

              <button
                id="takyidat-open-add-btn"
                onClick={handleOpenAdd}
                className="flex items-center gap-1.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Yeni Takyidat Ekle</span>
              </button>
            </div>
          )}
        </div>

        {/* Main Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Add / Edit Form Card */}
          {isFormOpen && (
            <form
              onSubmit={handleSubmit}
              className="bg-amber-50/70 border-2 border-amber-400/90 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm animate-in fade-in duration-200"
            >
              <div className="flex items-center justify-between border-b border-amber-300 pb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                  <h4 className="font-extrabold text-sm text-amber-950">
                    {editingItem ? 'Takyidat / Hız Kısıtlamasını Güncelle' : 'Yeni Takyidat & Hız Kısıtlaması Tanımla'}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="text-xs text-amber-800 hover:text-amber-950 font-bold p-1 cursor-pointer"
                >
                  Vazgeç
                </button>
              </div>

              {/* Quick Manual Point Selector Row */}
              {points.length > 0 && (
                <div className="bg-white/90 border border-amber-300 rounded-xl p-3 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                    <span className="font-bold text-amber-950 flex items-center gap-1.5">
                      <ListFilter className="w-4 h-4 text-amber-700" />
                      <span>Kayıtlı Noktalardan Hızlı Manuel Seçim</span>
                    </span>
                    {onStartPickOnMap && (
                      <button
                        type="button"
                        onClick={() => handleTriggerMapPick('both')}
                        className="flex items-center gap-1.5 bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-white font-bold text-[11px] px-2.5 py-1 rounded-lg shadow-2xs transition-all active:scale-95 cursor-pointer"
                        title="Haritada başlangıç ve bitiş noktalarını art arda tıklayarak belirleyin"
                      >
                        <Crosshair className="w-3.5 h-3.5" />
                        <span>Haritada 2 Tıklamayla Belirle</span>
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        Başlangıç Noktası (Listeden):
                      </label>
                      <select
                        onChange={(e) => {
                          const pt = points.find((p) => p.id === e.target.value);
                          if (pt) {
                            const km = formatKmDisplay(pt.kmValue, pt.title) || pt.kmValue || '';
                            setStartKm(km);
                            if (pt.lineName) setLineName(pt.lineName);
                          }
                        }}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                        defaultValue=""
                      >
                        <option value="" disabled>
                          Başlangıç noktasını listeden seçin...
                        </option>
                        {sortedPoints.map((p) => {
                          const cleanKm = formatKmDisplay(p.kmValue, p.title) || p.kmValue || '';
                          return (
                            <option key={p.id} value={p.id}>
                              KM {cleanKm} - {p.title} ({p.lineName})
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        Bitiş Noktası (Listeden):
                      </label>
                      <select
                        onChange={(e) => {
                          const pt = points.find((p) => p.id === e.target.value);
                          if (pt) {
                            const km = formatKmDisplay(pt.kmValue, pt.title) || pt.kmValue || '';
                            setEndKm(km);
                          }
                        }}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                        defaultValue=""
                      >
                        <option value="" disabled>
                          Bitiş noktasını listeden seçin...
                        </option>
                        {sortedPoints.map((p) => {
                          const cleanKm = formatKmDisplay(p.kmValue, p.title) || p.kmValue || '';
                          return (
                            <option key={p.id} value={p.id}>
                              KM {cleanKm} - {p.title} ({p.lineName})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* KM Range Fields with Dedicated Manuel & Map Pick Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* START KM */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-slate-800">
                      Başlangıç Kilometresi (KM)*
                    </label>
                    <span className="text-[10px] text-slate-500">Örn: 54+000</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={startKm}
                    onChange={(e) => setStartKm(e.target.value)}
                    placeholder="Örn: 54+000 veya 54"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-hidden shadow-2xs"
                  />
                  <div className="flex items-center gap-1.5">
                    {points.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setManualPickTarget('start');
                          setPointSearchQuery('');
                        }}
                        className="flex-1 flex items-center justify-center gap-1 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 text-[11px] font-bold py-1 px-2 rounded-lg transition-colors cursor-pointer"
                        title="Kayıtlı noktalardan manuel seç"
                      >
                        <ListFilter className="w-3 h-3 text-sky-600" />
                        <span>Noktadan Seç</span>
                      </button>
                    )}
                    {onStartPickOnMap && (
                      <button
                        type="button"
                        onClick={() => handleTriggerMapPick('start')}
                        className="flex-1 flex items-center justify-center gap-1 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 text-[11px] font-bold py-1 px-2 rounded-lg transition-colors cursor-pointer"
                        title="Haritada dokunarak Başlangıç KM al"
                      >
                        <Crosshair className="w-3 h-3 text-amber-700" />
                        <span>Haritadan Seç</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* END KM */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-slate-800">
                      Bitiş Kilometresi (KM)*
                    </label>
                    <span className="text-[10px] text-slate-500">Örn: 55+000</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={endKm}
                    onChange={(e) => setEndKm(e.target.value)}
                    placeholder="Örn: 55+000 veya 55"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-hidden shadow-2xs"
                  />
                  <div className="flex items-center gap-1.5">
                    {points.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setManualPickTarget('end');
                          setPointSearchQuery('');
                        }}
                        className="flex-1 flex items-center justify-center gap-1 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 text-[11px] font-bold py-1 px-2 rounded-lg transition-colors cursor-pointer"
                        title="Kayıtlı noktalardan manuel seç"
                      >
                        <ListFilter className="w-3 h-3 text-sky-600" />
                        <span>Noktadan Seç</span>
                      </button>
                    )}
                    {onStartPickOnMap && (
                      <button
                        type="button"
                        onClick={() => handleTriggerMapPick('end')}
                        className="flex-1 flex items-center justify-center gap-1 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 text-[11px] font-bold py-1 px-2 rounded-lg transition-colors cursor-pointer"
                        title="Haritada dokunarak Bitiş KM al"
                      >
                        <Crosshair className="w-3 h-3 text-amber-700" />
                        <span>Haritadan Seç</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* LINE NAME */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-slate-700">
                      Demiryolu Hattı
                    </label>
                  </div>
                  <select
                    value={lineName}
                    onChange={(e) => setLineName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-hidden shadow-2xs"
                  >
                    {availableLines.map((line) => (
                      <option key={line} value={line}>
                        {line}
                      </option>
                    ))}
                    <option value="Tüm Hatlar">Tüm Hatlar</option>
                  </select>
                  <p className="text-[10px] text-slate-500 pt-1">
                    Hız kısıtlamasının geçerli olduğu hat kesimi
                  </p>
                </div>
              </div>

              {/* Speed Limits & Track */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-red-700 mb-1">
                    ⚠️ Tahditli Hız Sınırı (km/s)*
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min={5}
                      max={250}
                      step={5}
                      value={speedLimit}
                      onChange={(e) => setSpeedLimit(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-red-50 border-2 border-red-400 rounded-xl px-3 py-2 text-sm font-black font-mono text-red-950 focus:ring-2 focus:ring-red-500 focus:outline-hidden shadow-2xs"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-red-700">km/s</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Normal Hat Hızı (km/s)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={20}
                      max={300}
                      step={5}
                      value={normalSpeed}
                      onChange={(e) => setNormalSpeed(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-hidden shadow-2xs"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">km/s</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Durum
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-hidden shadow-2xs"
                  >
                    <option value="active">🔴 Yürürlükte (Aktif Tahdit)</option>
                    <option value="planned">🟡 Planlanan (Gelecek Yol Emri)</option>
                    <option value="lifted">🟢 Kaldırıldı (Normal Hıza Dönüldü)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Hat Yolu
                  </label>
                  <select
                    value={trackType}
                    onChange={(e) => setTrackType(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-hidden shadow-2xs"
                  >
                    <option value="both">Tüm Hatlar (Tek / Çift Yol)</option>
                    <option value="line1">Hat 1 (İniş Yolu)</option>
                    <option value="line2">Hat 2 (Çıkış Yolu)</option>
                  </select>
                </div>
              </div>

              {/* Reason & Notice Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Hız Kısıtlaması Nedeni &amp; Saha Açıklaması*
                  </label>
                  <input
                    type="text"
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Örn: Balast boşaltımı, ray yenileme, menfez onarımı, heyelan riski"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-hidden shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Yol Emri No / Belge
                  </label>
                  <input
                    type="text"
                    value={noticeNo}
                    onChange={(e) => setNoticeNo(e.target.value)}
                    placeholder="Örn: YOL EMRİ 2026/14"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-hidden shadow-2xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {editingItem ? 'Takyidatı Güncelle' : 'Takyidatı Kaydet & Haritaya İşle'}
                </button>
              </div>
            </form>
          )}

          {/* Restrictions List */}
          {filteredList.length === 0 ? (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-400 mx-auto flex items-center justify-center">
                <Gauge className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-700">Kayıtlı Takyidat Bulunamadı</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Demiryolu hattında belirli kilometreler arasında (örneğin KM 54+000 ile 55+000 arası) hız sınırlarını girmek için yukarıdaki butonları veya haritadan seçimi kullanabilirsiniz.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredList.map((item) => {
                const isActive = item.status === 'active';
                const isPlanned = item.status === 'planned';

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-4 transition-all shadow-xs hover:shadow-md ${
                      isActive
                        ? 'bg-gradient-to-r from-red-50/70 via-white to-amber-50/40 border-red-300'
                        : isPlanned
                        ? 'bg-amber-50/50 border-amber-300'
                        : 'bg-slate-50/80 border-slate-200 opacity-80'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
                      <div className="flex items-center gap-3">
                        {/* Speed Circle Badge (TCDD Style) */}
                        <div
                          className={`w-14 h-14 rounded-full flex flex-col items-center justify-center border-4 shadow-md flex-shrink-0 ${
                            isActive
                              ? 'bg-white border-red-600 text-red-950 ring-2 ring-red-300/60'
                              : isPlanned
                              ? 'bg-amber-50 border-amber-500 text-amber-950'
                              : 'bg-emerald-50 border-emerald-500 text-emerald-950'
                          }`}
                          title={`Hız Tahdidi: ${item.speedLimit} km/s`}
                        >
                          <span className="text-[9px] font-black uppercase text-red-600 leading-none">TAHDİT</span>
                          <span className="text-lg font-black font-mono leading-none">{item.speedLimit}</span>
                          <span className="text-[8px] font-bold text-slate-500 leading-none">KM/S</span>
                        </div>

                        {/* KM Range & Details */}
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-black font-mono text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-300 shadow-2xs">
                              KM {item.startKm}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-sm font-black font-mono text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-300 shadow-2xs">
                              KM {item.endKm}
                            </span>
                            <span
                              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                                isActive
                                  ? 'bg-red-500/10 text-red-700 border-red-300 animate-pulse'
                                  : isPlanned
                                  ? 'bg-amber-500/10 text-amber-700 border-amber-300'
                                  : 'bg-emerald-500/10 text-emerald-700 border-emerald-300'
                              }`}
                            >
                              {isActive ? '🔴 YÜRÜRLÜKTE' : isPlanned ? '🟡 PLANLANAN' : '🟢 KALDIRILDI'}
                            </span>
                          </div>

                          <div className="text-xs font-bold text-slate-800 mt-1">
                            {item.reason}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>Hat: {item.lineName}</span>
                            <span>•</span>
                            <span>Normal Hız: {item.normalSpeed || 120} km/s</span>
                            {item.noticeNo && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-slate-700">{item.noticeNo}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 self-end sm:self-center">
                        {onFocusSegment && (
                          <button
                            type="button"
                            onClick={() => {
                              onFocusSegment(item.startKmNum, item.endKmNum);
                              onClose();
                            }}
                            className="flex items-center gap-1 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl shadow-xs transition-colors cursor-pointer"
                            title="Haritada bu kesime git"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            <span>Haritada Göster</span>
                          </button>
                        )}

                        {canAddPoint && (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer"
                            title="Düzenle"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteRestriction(item.id);
                            }}
                            className="p-1.5 text-rose-600 hover:text-rose-900 bg-white hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                            title="Sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Bottom Info Bar */}
                    <div className="mt-2.5 pt-2 flex flex-wrap items-center justify-between text-[11px] text-slate-500">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>Yetkili: {item.issuedBy || '712 Yol Bakım Şefliği'}</span>
                        </span>
                        {item.trackType && (
                          <span>
                            Hat: {item.trackType === 'both' ? 'Tüm Hatlar' : item.trackType === 'line1' ? 'Hat 1' : 'Hat 2'}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[10px]">
                        Kesim Uzunluğu: {Math.abs(item.endKmNum - item.startKmNum).toFixed(3)} KM ({(Math.abs(item.endKmNum - item.startKmNum) * 1000).toFixed(0)} m)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        </>
        )}

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-900 text-slate-300 text-xs flex items-center justify-between border-t border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[11px]">Tüm takyidat hız sınırları harita üzerinde sarı-kırmızı çizgiler ve hız rozetleri olarak canlı gösterilir.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors cursor-pointer text-xs"
          >
            Kapat
          </button>
        </div>

        {/* ============================================================ */}
        {/* SUB-MODAL: Manuel Kayıtlı Noktadan KM Seçme Diyaloğu          */}
        {/* ============================================================ */}
        {manualPickTarget && (
          <div
            id="takyidat-point-picker-submodal"
            className="absolute inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
            onClick={() => setManualPickTarget(null)}
          >
            <div
              className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white flex items-center justify-between border-b border-sky-500/30">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold">
                    <ListFilter className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-white">
                      {manualPickTarget === 'start'
                        ? 'Başlangıç KM İçin Kayıtlı Nokta Seç'
                        : 'Bitiş KM İçin Kayıtlı Nokta Seç'}
                    </h4>
                    <p className="text-[11px] text-slate-300">
                      Tıkladığınız noktanın demiryolu kilometresi forma aktarılacaktır
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setManualPickTarget(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Quick switch to map pick if user changes mind */}
              {onStartPickOnMap && (
                <div className="p-2.5 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-2 text-xs">
                  <span className="text-[11px] font-bold text-amber-950 flex items-center gap-1">
                    <Crosshair className="w-3.5 h-3.5 text-amber-700" />
                    <span>Nokta listede yoksa haritadan serbestçe dokunabilirsiniz:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const tgt = manualPickTarget;
                      setManualPickTarget(null);
                      handleTriggerMapPick(tgt);
                    }}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold rounded-lg shadow-2xs whitespace-nowrap cursor-pointer transition-all active:scale-95"
                  >
                    Haritadan Seç ➔
                  </button>
                </div>
              )}

              {/* Search & Filter */}
              <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={pointSearchQuery}
                    onChange={(e) => setPointSearchQuery(e.target.value)}
                    placeholder="KM ara (örn: 54, 54+250), nokta adı veya hat..."
                    className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                    autoFocus
                  />
                  {pointSearchQuery && (
                    <button
                      onClick={() => setPointSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {availableLines.length > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setPointLineFilter('all')}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                        pointLineFilter === 'all'
                          ? 'bg-slate-900 text-white'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Tüm Hatlar ({points.length})
                    </button>
                    {availableLines.map((line) => (
                      <button
                        key={line}
                        type="button"
                        onClick={() => setPointLineFilter(line)}
                        className={`px-2.5 py-1 rounded-lg font-bold text-[11px] whitespace-nowrap transition-colors cursor-pointer ${
                          pointLineFilter === line
                            ? 'bg-sky-700 text-white'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {line}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Point List */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
                {filteredPickerPoints.length === 0 ? (
                  <div className="p-8 text-center space-y-2">
                    <MapPin className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs font-bold text-slate-600">Aradığınız kriterde nokta bulunamadı</p>
                    <p className="text-[11px] text-slate-400">
                      Arama terimini değiştirebilir veya haritadan doğrudan seçebilirsiniz.
                    </p>
                  </div>
                ) : (
                  filteredPickerPoints.map((p) => {
                    const cleanKm = formatKmDisplay(p.kmValue, p.title) || p.kmValue || '';
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          if (manualPickTarget === 'start') {
                            setStartKm(cleanKm);
                            if (p.lineName) setLineName(p.lineName);
                          } else {
                            setEndKm(cleanKm);
                          }
                          setManualPickTarget(null);
                        }}
                        className="w-full p-2.5 rounded-xl text-left flex items-center justify-between gap-3 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center font-bold text-xs shrink-0 group-hover:scale-105 transition-transform">
                            <Train className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-900 truncate">
                                {p.title}
                              </span>
                              {cleanKm && (
                                <span className="bg-blue-50 text-blue-800 font-mono font-black text-[10px] px-1.5 py-0.2 rounded border border-blue-200 shrink-0">
                                  KM {cleanKm}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate mt-0.5">
                              {p.lineName}{p.locationDesc ? ` • ${p.locationDesc}` : ''}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-1.5 text-sky-600 text-xs font-bold bg-sky-50 px-2 py-1 rounded-lg border border-sky-200 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                          <span>Seç</span>
                          <Navigation className="w-3 h-3 rotate-90" />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Sub-Modal Footer */}
              <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-500 text-[11px]">
                  {filteredPickerPoints.length} nokta listeleniyor
                </span>
                <button
                  type="button"
                  onClick={() => setManualPickTarget(null)}
                  className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition-colors cursor-pointer text-xs"
                >
                  Vazgeç
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
