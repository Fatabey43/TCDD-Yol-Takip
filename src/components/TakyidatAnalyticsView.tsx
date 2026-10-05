import React, { useState, useMemo } from 'react';
import { TakyidatSpeedRestriction, RailwayPoint } from '../types.ts';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Gauge,
  TrendingDown,
  Activity,
  Clock,
  ArrowRight,
  AlertTriangle,
  MapPin,
  ShieldAlert,
  Layers,
  Filter,
  Sparkles,
  CheckCircle2,
  BarChart2,
  Train,
} from 'lucide-react';

interface TakyidatAnalyticsViewProps {
  restrictions: TakyidatSpeedRestriction[];
  points?: RailwayPoint[];
  availableLines?: string[];
  onFocusSegment?: (startKmNum: number, endKmNum: number) => void;
  onOpenEdit?: (item: TakyidatSpeedRestriction) => void;
  onOpenAdd?: () => void;
}

const SEVERITY_COLORS = {
  critical: '#ef4444', // Red (0-30 km/s)
  high: '#f97316',     // Orange (31-50 km/s)
  medium: '#eab308',   // Yellow/Amber (51-80 km/s)
  low: '#3b82f6',      // Blue (81+ km/s)
};

export const TakyidatAnalyticsView: React.FC<TakyidatAnalyticsViewProps> = ({
  restrictions,
  points = [],
  availableLines = ['Eskişehir-Konya'],
  onFocusSegment,
  onOpenEdit,
  onOpenAdd,
}) => {
  const [selectedLineFilter, setSelectedLineFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'active' | 'planned' | 'lifted'>('all');
  const [activeChartType, setActiveChartType] = useState<'speedProfile' | 'segmentComparison' | 'distribution'>('speedProfile');

  // Filtered restrictions based on line & status selection
  const filteredRestrictions = useMemo(() => {
    return restrictions.filter((r) => {
      const matchLine = selectedLineFilter === 'all' || r.lineName === selectedLineFilter;
      const matchStatus = selectedStatusFilter === 'all' || r.status === selectedStatusFilter;
      return matchLine && matchStatus;
    });
  }, [restrictions, selectedLineFilter, selectedStatusFilter]);

  // Overall KPIs calculation
  const stats = useMemo(() => {
    if (restrictions.length === 0) {
      return {
        totalCount: 0,
        activeCount: 0,
        plannedCount: 0,
        liftedCount: 0,
        totalLengthKm: 0,
        activeLengthKm: 0,
        minSpeed: 0,
        avgSpeed: 0,
        estimatedTotalDelayMinutes: 0,
      };
    }

    const activeList = restrictions.filter((r) => r.status === 'active');
    const plannedList = restrictions.filter((r) => r.status === 'planned');
    const liftedList = restrictions.filter((r) => r.status === 'lifted');

    let totalLength = 0;
    let activeLength = 0;
    let minSpd = 999;
    let speedSum = 0;
    let totalDelayMinutes = 0;

    restrictions.forEach((r) => {
      const len = Math.abs((r.endKmNum || 0) - (r.startKmNum || 0));
      totalLength += len;
      if (r.status === 'active') {
        activeLength += len;
      }
      if (r.speedLimit < minSpd) {
        minSpd = r.speedLimit;
      }
      speedSum += r.speedLimit;

      // Estimate train delay in minutes: (Length / RestrictedSpeed - Length / NormalSpeed) * 60
      const normalSpd = r.normalSpeed && r.normalSpeed > 0 ? r.normalSpeed : 120;
      if (r.speedLimit > 0 && r.status === 'active') {
        const timeRestrictedHours = len / r.speedLimit;
        const timeNormalHours = len / normalSpd;
        const delayMins = Math.max(0, (timeRestrictedHours - timeNormalHours) * 60);
        totalDelayMinutes += delayMins;
      }
    });

    return {
      totalCount: restrictions.length,
      activeCount: activeList.length,
      plannedCount: plannedList.length,
      liftedCount: liftedList.length,
      totalLengthKm: totalLength,
      activeLengthKm: activeLength,
      minSpeed: minSpd === 999 ? 0 : minSpd,
      avgSpeed: Math.round(speedSum / restrictions.length),
      estimatedTotalDelayMinutes: Math.round(totalDelayMinutes * 10) / 10,
    };
  }, [restrictions]);

  // 1. Hat Boyunca Hız Profili Çizelgesi Verisi (KM vs Hız)
  const speedProfileData = useMemo(() => {
    if (filteredRestrictions.length === 0) return [];

    // Sort restrictions along the railway track by start KM
    const sorted = [...filteredRestrictions].sort((a, b) => a.startKmNum - b.startKmNum);

    // Find overall KM span
    const minKm = Math.floor(Math.min(...sorted.map((r) => r.startKmNum)) - 1);
    const maxKm = Math.ceil(Math.max(...sorted.map((r) => r.endKmNum)) + 1);

    const dataPoints: Array<{
      kmNum: number;
      kmDisplay: string;
      restrictedSpeed: number;
      normalSpeed: number;
      speedDrop: number;
      reason?: string;
      status?: string;
      noticeNo?: string;
    }> = [];

    // Base point before first restriction
    dataPoints.push({
      kmNum: minKm,
      kmDisplay: `KM ${minKm}+000`,
      restrictedSpeed: 120,
      normalSpeed: 120,
      speedDrop: 0,
      reason: 'Normal Hat Hızı',
      status: 'normal',
    });

    sorted.forEach((r, idx) => {
      const normal = r.normalSpeed || 120;
      const prevPt = dataPoints[dataPoints.length - 1];

      // If gap exists between previous end and this start, add intermediate normal point
      if (r.startKmNum > prevPt.kmNum + 0.1) {
        dataPoints.push({
          kmNum: r.startKmNum - 0.05,
          kmDisplay: `KM ${(r.startKmNum - 0.05).toFixed(1)}`,
          restrictedSpeed: normal,
          normalSpeed: normal,
          speedDrop: 0,
          reason: 'Normal Hat Hızı',
          status: 'normal',
        });
      }

      // Start of restriction
      dataPoints.push({
        kmNum: r.startKmNum,
        kmDisplay: `KM ${r.startKm}`,
        restrictedSpeed: r.speedLimit,
        normalSpeed: normal,
        speedDrop: normal - r.speedLimit,
        reason: r.reason,
        status: r.status,
        noticeNo: r.noticeNo,
      });

      // Midpoint of restriction for smooth line
      const mid = (r.startKmNum + r.endKmNum) / 2;
      dataPoints.push({
        kmNum: mid,
        kmDisplay: `KM ${mid.toFixed(2)}`,
        restrictedSpeed: r.speedLimit,
        normalSpeed: normal,
        speedDrop: normal - r.speedLimit,
        reason: r.reason,
        status: r.status,
        noticeNo: r.noticeNo,
      });

      // End of restriction
      dataPoints.push({
        kmNum: r.endKmNum,
        kmDisplay: `KM ${r.endKm}`,
        restrictedSpeed: r.speedLimit,
        normalSpeed: normal,
        speedDrop: normal - r.speedLimit,
        reason: r.reason,
        status: r.status,
        noticeNo: r.noticeNo,
      });

      // Right after restriction end
      if (idx === sorted.length - 1 || sorted[idx + 1].startKmNum > r.endKmNum + 0.1) {
        dataPoints.push({
          kmNum: r.endKmNum + 0.05,
          kmDisplay: `KM ${(r.endKmNum + 0.05).toFixed(1)}`,
          restrictedSpeed: normal,
          normalSpeed: normal,
          speedDrop: 0,
          reason: 'Normal Hat Hızı',
          status: 'normal',
        });
      }
    });

    // End boundary point
    dataPoints.push({
      kmNum: maxKm,
      kmDisplay: `KM ${maxKm}+000`,
      restrictedSpeed: 120,
      normalSpeed: 120,
      speedDrop: 0,
      reason: 'Normal Hat Hızı',
      status: 'normal',
    });

    return dataPoints;
  }, [filteredRestrictions]);

  // 2. Kesim Bazında Karşılaştırma Grafiği Verisi (BarChart)
  const segmentComparisonData = useMemo(() => {
    return filteredRestrictions.map((r, i) => {
      const lengthKm = Math.abs(r.endKmNum - r.startKmNum);
      const normal = r.normalSpeed || 120;
      return {
        id: r.id,
        segmentLabel: `KM ${r.startKm}-${r.endKm}`,
        shortLabel: `${r.startKm}➔${r.endKm}`,
        speedLimit: r.speedLimit,
        normalSpeed: normal,
        speedDrop: normal - r.speedLimit,
        lengthKm: Math.round(lengthKm * 1000) / 1000,
        lengthMeters: Math.round(lengthKm * 1000),
        reason: r.reason,
        status: r.status,
        noticeNo: r.noticeNo || 'Yol Emri',
        lineName: r.lineName,
      };
    });
  }, [filteredRestrictions]);

  // 3. Hız Dağılımı ve Ciddiyet Grupları (Pie / Bar Data)
  const distributionData = useMemo(() => {
    let critical = 0; // <= 30 km/s
    let high = 0;     // 31 - 50 km/s
    let medium = 0;   // 51 - 80 km/s
    let low = 0;      // 81+ km/s

    let criticalLen = 0;
    let highLen = 0;
    let mediumLen = 0;
    let lowLen = 0;

    filteredRestrictions.forEach((r) => {
      const len = Math.abs(r.endKmNum - r.startKmNum);
      if (r.speedLimit <= 30) {
        critical++;
        criticalLen += len;
      } else if (r.speedLimit <= 50) {
        high++;
        highLen += len;
      } else if (r.speedLimit <= 80) {
        medium++;
        mediumLen += len;
      } else {
        low++;
        lowLen += len;
      }
    });

    return [
      {
        name: '0-30 km/s (Kritik Tahdit)',
        shortName: '0-30 km/s',
        count: critical,
        lengthKm: Math.round(criticalLen * 10) / 10,
        color: SEVERITY_COLORS.critical,
        description: 'Ağır balast boşaltımı, yol tamiratı, acil hız düşümü',
      },
      {
        name: '31-50 km/s (Yüksek Tahdit)',
        shortName: '31-50 km/s',
        count: high,
        lengthKm: Math.round(highLen * 10) / 10,
        color: SEVERITY_COLORS.high,
        description: 'Makas değişimi, menfez onarımı, ray yenileme',
      },
      {
        name: '51-80 km/s (Orta Tahdit)',
        shortName: '51-80 km/s',
        count: medium,
        lengthKm: Math.round(mediumLen * 10) / 10,
        color: SEVERITY_COLORS.medium,
        description: 'Geometrik kusurlar, ray sıcaklığı, altyapı iyileştirme',
      },
      {
        name: '81+ km/s (Hafif Tahdit)',
        shortName: '81+ km/s',
        count: low,
        lengthKm: Math.round(lowLen * 10) / 10,
        color: SEVERITY_COLORS.low,
        description: 'Geçici kontrol, test sürüşü ve planlı bakım',
      },
    ].filter((item) => item.count > 0 || restrictions.length === 0);
  }, [filteredRestrictions, restrictions.length]);

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Analytics KPI Header Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Card 1: Aktif Tahditler */}
        <div className="bg-gradient-to-br from-red-50 to-red-100/70 border border-red-200 rounded-2xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-red-900 uppercase tracking-tight">Aktif Tahdit</span>
            <div className="w-7 h-7 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-xs">
              <Gauge className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-red-950">{stats.activeCount}</span>
            <span className="text-xs font-semibold text-red-700">/ {stats.totalCount} toplam</span>
          </div>
          <p className="text-[10px] text-red-800/80 font-medium mt-1">
            Yürürlükte olan demiryolu hız kısıtlamaları
          </p>
        </div>

        {/* Card 2: En Düşük Hız Sınırı */}
        <div className="bg-gradient-to-br from-amber-50 to-amber-100/70 border border-amber-200 rounded-2xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-900 uppercase tracking-tight">Min Hız Sınırı</span>
            <div className="w-7 h-7 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
              <TrendingDown className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-amber-950">
              {stats.minSpeed > 0 ? stats.minSpeed : '-'}
            </span>
            <span className="text-xs font-bold text-amber-800">KM/S</span>
          </div>
          <p className="text-[10px] text-amber-800/80 font-medium mt-1">
            Hattaki en kritik yavaşlatma noktası
          </p>
        </div>

        {/* Card 3: Toplam Tahditli Hat Uzunluğu */}
        <div className="bg-gradient-to-br from-sky-50 to-blue-100/70 border border-sky-200 rounded-2xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-sky-900 uppercase tracking-tight">Tahditli Kesim</span>
            <div className="w-7 h-7 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-sky-950">
              {stats.activeLengthKm.toFixed(2)}
            </span>
            <span className="text-xs font-bold text-sky-800">KM</span>
          </div>
          <p className="text-[10px] text-sky-800/80 font-medium mt-1">
            {(stats.activeLengthKm * 1000).toFixed(0)} metre hat yavaş seyirde
          </p>
        </div>

        {/* Card 4: Tahmini Tren Rötarları / Gecikme Kaybı */}
        <div className="bg-gradient-to-br from-purple-50 to-indigo-100/70 border border-purple-200 rounded-2xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-900 uppercase tracking-tight">Tahmini Gecikme</span>
            <div className="w-7 h-7 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-purple-950">
              +{stats.estimatedTotalDelayMinutes}
            </span>
            <span className="text-xs font-bold text-purple-800">DK / TREN</span>
          </div>
          <p className="text-[10px] text-purple-800/80 font-medium mt-1">
            Normal hatta göre ortalama sefer zaman kaybı
          </p>
        </div>
      </div>

      {/* Filter and Chart Mode Controls */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3">
        {/* Chart Mode Buttons */}
        <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveChartType('speedProfile')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeChartType === 'speedProfile'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-red-600" />
            <span>Hat Hız Profili Çizelgesi</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveChartType('segmentComparison')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeChartType === 'segmentComparison'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5 text-sky-600" />
            <span>Kesim Karşılaştırma Grafiği</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveChartType('distribution')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeChartType === 'distribution'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PieChart className="w-3.5 h-3.5 text-amber-600" />
            <span>Hız Dağılımı</span>
          </button>
        </div>

        {/* Dropdown Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500 font-semibold text-[11px]">Hat:</span>
            <select
              value={selectedLineFilter}
              onChange={(e) => setSelectedLineFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-red-500 focus:outline-hidden"
            >
              <option value="all">Tüm Hatlar ({restrictions.length})</option>
              {availableLines.map((line) => (
                <option key={line} value={line}>
                  {line}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500 font-semibold text-[11px]">Durum:</span>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-red-500 focus:outline-hidden"
            >
              <option value="all">Tüm Durumlar</option>
              <option value="active">🔴 Aktif Tahditler</option>
              <option value="planned">🟡 Planlananlar</option>
              <option value="lifted">🟢 Kaldırılanlar</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Chart Container */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
        {restrictions.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Gauge className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-700">Analiz edilecek takyidat kaydı bulunamadı</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Hız tahditleri eklendiğinde hat boyunca hız profili, hız kayıpları ve istatistiki grafikler burada çizilecektir.
            </p>
            {onOpenAdd && (
              <button
                type="button"
                onClick={onOpenAdd}
                className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
              >
                Yeni Hız Tahdidi Ekle
              </button>
            )}
          </div>
        ) : filteredRestrictions.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <Filter className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-600">Seçilen filtre kriterlerine uygun tahdit bulunamadı</p>
            <button
              type="button"
              onClick={() => {
                setSelectedLineFilter('all');
                setSelectedStatusFilter('all');
              }}
              className="text-xs font-bold text-red-600 hover:underline"
            >
              Filtreleri Temizle
            </button>
          </div>
        ) : (
          <>
            {/* ============================================================ */}
            {/* CHART 1: Hat Hız Profili Çizelgesi (KM vs Hız)               */}
            {/* ============================================================ */}
            {activeChartType === 'speedProfile' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <span>Demiryolu Hat Hız Profili (Hız Tahdidi Çizelgesi)</span>
                      <span className="text-[10px] bg-red-100 text-red-800 font-mono font-bold px-2 py-0.5 rounded-full">
                        KM ➔ km/s
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Hat boyunca kilometre zincirine göre normal hat hızı ve kısıtlanan azami seyir hızları
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-600"></div>
                      <span className="text-[11px] font-semibold text-slate-700">Tahditli Hız (km/s)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-1 bg-emerald-500 rounded-full"></div>
                      <span className="text-[11px] font-semibold text-slate-700">Normal Hat Hızı</span>
                    </div>
                  </div>
                </div>

                <div className="h-72 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={speedProfileData}
                      margin={{ top: 10, right: 20, left: -10, bottom: 20 }}
                    >
                      <defs>
                        <linearGradient id="speedGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis
                        dataKey="kmDisplay"
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        tickLine={{ stroke: '#cbd5e1' }}
                        interval="preserveStartEnd"
                        angle={-25}
                        textAnchor="end"
                        height={40}
                      />
                      <YAxis
                        domain={[0, (dataMax: number) => Math.max(140, Math.ceil(dataMax / 20) * 20)]}
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        tickLine={{ stroke: '#cbd5e1' }}
                        unit=" km/s"
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-slate-950/95 border border-slate-700 p-3 rounded-xl shadow-2xl text-white text-xs max-w-xs backdrop-blur-md">
                                <div className="font-extrabold text-amber-400 font-mono border-b border-slate-800 pb-1 flex items-center justify-between">
                                  <span>{data.kmDisplay}</span>
                                  {data.status && data.status !== 'normal' && (
                                    <span
                                      className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                                        data.status === 'active'
                                          ? 'bg-red-500/30 text-red-300'
                                          : data.status === 'planned'
                                          ? 'bg-amber-500/30 text-amber-300'
                                          : 'bg-emerald-500/30 text-emerald-300'
                                      }`}
                                    >
                                      {data.status}
                                    </span>
                                  )}
                                </div>
                                <div className="mt-2 space-y-1">
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400">Azami Hız Sınırı:</span>
                                    <span className="font-black font-mono text-red-400 text-sm">
                                      {data.restrictedSpeed} km/s
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400">Normal Hat Hızı:</span>
                                    <span className="font-bold font-mono text-emerald-400">
                                      {data.normalSpeed} km/s
                                    </span>
                                  </div>
                                  {data.speedDrop > 0 && (
                                    <div className="flex justify-between items-center text-xs">
                                      <span className="text-slate-400">Hız Kaybı:</span>
                                      <span className="font-bold font-mono text-rose-300">
                                        -{data.speedDrop} km/s
                                      </span>
                                    </div>
                                  )}
                                  {data.reason && (
                                    <div className="text-[11px] text-slate-300 pt-1 border-t border-slate-800/80">
                                      <span className="text-slate-400">Neden: </span>
                                      {data.reason}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area
                        type="stepAfter"
                        dataKey="restrictedSpeed"
                        stroke="#ef4444"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#speedGradient)"
                        name="İzin Verilen Hız"
                      />
                      <Line
                        type="stepAfter"
                        dataKey="normalSpeed"
                        stroke="#10b981"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={false}
                        name="Normal Hat Hızı"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* CHART 2: Kesim Bazında Karşılaştırma Grafiği (BarChart)      */}
            {/* ============================================================ */}
            {activeChartType === 'segmentComparison' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <span>Kesim Bazında Hız Düşüşleri ve Tahdit Karşılaştırması</span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Her takyidat kesimi için normal hız ve uygulanan kısıtlı hız farkı
                    </p>
                  </div>
                </div>

                <div className="h-72 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={segmentComparisonData}
                      margin={{ top: 10, right: 20, left: -10, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis
                        dataKey="shortLabel"
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        angle={-20}
                        textAnchor="end"
                        height={40}
                      />
                      <YAxis
                        unit=" km/s"
                        tick={{ fontSize: 10, fill: '#64748b' }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-slate-950/95 border border-slate-700 p-3 rounded-xl shadow-2xl text-white text-xs max-w-xs">
                                <div className="font-extrabold text-amber-400 font-mono border-b border-slate-800 pb-1">
                                  {data.segmentLabel}
                                </div>
                                <div className="mt-2 space-y-1">
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400">Tahdit Hızı:</span>
                                    <span className="font-black font-mono text-red-400">
                                      {data.speedLimit} km/s
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400">Normal Hız:</span>
                                    <span className="font-bold font-mono text-emerald-400">
                                      {data.normalSpeed} km/s
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400">Kesim Uzunluğu:</span>
                                    <span className="font-mono text-sky-300">
                                      {data.lengthKm} KM ({data.lengthMeters} m)
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-300 pt-1 border-t border-slate-800">
                                    {data.reason}
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      <Bar
                        dataKey="speedLimit"
                        fill="#ef4444"
                        name="Tahditli Hız (km/s)"
                        radius={[6, 6, 0, 0]}
                      />
                      <Bar
                        dataKey="normalSpeed"
                        fill="#94a3b8"
                        name="Normal Hız (km/s)"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* CHART 3: Hız Aralıklarına Göre Dağılım Grafiği (Pie & Stats) */}
            {/* ============================================================ */}
            {activeChartType === 'distribution' && (
              <div className="space-y-4">
                <div className="pb-2 border-b border-slate-100">
                  <h4 className="text-sm font-extrabold text-slate-900">
                    Hız Sınırı Ciddiyet &amp; Aralık Dağılımı
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Tahditlerin hız büyüklüklerine göre gruplandırılmış dağılımı
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  {/* Pie Chart */}
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={distributionData}
                          dataKey="count"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          innerRadius={45}
                          paddingAngle={3}
                          label={(entry: any) => `${entry.shortName || entry.name || ''}: ${entry.count ?? entry.value ?? ''}`}
                        >
                          {distributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const d = payload[0].payload;
                              return (
                                <div className="bg-slate-950/95 border border-slate-700 p-2.5 rounded-xl shadow-xl text-white text-xs">
                                  <div className="font-extrabold" style={{ color: d.color }}>
                                    {d.name}
                                  </div>
                                  <div className="mt-1 space-y-0.5 text-[11px]">
                                    <div>Adet: <span className="font-mono font-bold">{d.count} kesim</span></div>
                                    <div>Toplam Hat: <span className="font-mono font-bold">{d.lengthKm} KM</span></div>
                                    <div className="text-slate-400 text-[10px]">{d.description}</div>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Distribution Group List */}
                  <div className="space-y-2">
                    {distributionData.map((group) => (
                      <div
                        key={group.name}
                        className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-3.5 h-3.5 rounded-md shrink-0 shadow-2xs"
                            style={{ backgroundColor: group.color }}
                          />
                          <div className="min-w-0">
                            <span className="font-bold text-slate-800 block truncate">
                              {group.name}
                            </span>
                            <span className="text-[10px] text-slate-500 block truncate">
                              {group.description}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-black font-mono text-slate-900">
                            {group.count} adet
                          </div>
                          <div className="text-[10px] font-mono text-slate-500">
                            {group.lengthKm} KM
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Interactive Segment Summary List with Focus on Map Button */}
      {filteredRestrictions.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-extrabold text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
              <Train className="w-3.5 h-3.5 text-red-600" />
              <span>Hattaki Takyidat Kesimleri Çizelge Özeti ({filteredRestrictions.length})</span>
            </h5>
            <span className="text-[10px] text-slate-500 font-medium">
              Haritada görmek istediğiniz kesime tıklayabilirsiniz
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {filteredRestrictions.map((item) => {
              const lengthKm = Math.abs(item.endKmNum - item.startKmNum);
              const isActive = item.status === 'active';
              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border transition-all text-xs flex flex-col justify-between gap-2 shadow-2xs ${
                    isActive
                      ? 'bg-white border-red-200 hover:border-red-400'
                      : 'bg-white/80 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                      KM {item.startKm} ➔ {item.endKm}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono font-black text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.2 rounded text-[11px]">
                        {item.speedLimit} km/s
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-700 font-medium line-clamp-2">
                    {item.reason}
                  </p>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-500">
                    <span>Uzunluk: {lengthKm.toFixed(2)} KM</span>
                    {onFocusSegment && (
                      <button
                        type="button"
                        onClick={() => onFocusSegment(item.startKmNum, item.endKmNum)}
                        className="text-sky-600 hover:text-sky-800 font-bold flex items-center gap-0.5 cursor-pointer"
                      >
                        <MapPin className="w-3 h-3" />
                        <span>Haritada Göster</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
