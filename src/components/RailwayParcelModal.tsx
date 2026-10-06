import React, { useState, useMemo } from 'react';
import { RailwayParcel, RailwayPoint } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { DeleteConfirmModal } from './DeleteConfirmModal.tsx';
import {
  generateTkgmUrl,
  calculateParcelArea,
  calculateParcelCenter,
  formatAreaDisplay,
  generateCorridorPolygonFromRailway,
  parseKmlOrGeoJsonParcels,
  exportParcelsToKml,
} from '../utils/parcelUtils.ts';
import {
  Landmark,
  X,
  Search,
  Plus,
  Layers,
  MapPin,
  ExternalLink,
  Edit2,
  Trash2,
  Upload,
  Download,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  FileText,
  BarChart3,
  Sparkles,
  Map,
  CornerDownRight,
  Filter,
  Check,
  Copy,
  Eye,
  Info,
  Globe,
  FileCode,
} from 'lucide-react';

interface RailwayParcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  parcels: RailwayParcel[];
  points: RailwayPoint[];
  availableLines: string[];
  onAddParcel: (parcel: Omit<RailwayParcel, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateParcel: (parcel: RailwayParcel) => Promise<void>;
  onDeleteParcel: (id: string) => Promise<void>;
  onBatchImportParcels: (parcels: RailwayParcel[]) => Promise<void>;
  onFocusParcelOnMap: (parcel: RailwayParcel) => void;
  onStartPickParcelOnMap?: (onComplete: (coords: [number, number][]) => void) => void;
}

type TabType = 'list' | 'add' | 'import_export' | 'analytics';

export const RailwayParcelModal: React.FC<RailwayParcelModalProps> = ({
  isOpen,
  onClose,
  parcels = [],
  points = [],
  availableLines = [],
  onAddParcel,
  onUpdateParcel,
  onDeleteParcel,
  onBatchImportParcels,
  onFocusParcelOnMap,
}) => {
  const { canEdit, canDelete } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('list');
  const [editingParcel, setEditingParcel] = useState<RailwayParcel | null>(null);
  const [parcelToDelete, setParcelToDelete] = useState<RailwayParcel | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLineFilter, setSelectedLineFilter] = useState('all');
  const [ownershipFilter, setOwnershipFilter] = useState('all');
  const [encroachmentFilter, setEncroachmentFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'km' | 'area' | 'ada'>('km');

  // Form States
  const [il, setIl] = useState('Eskişehir');
  const [ilce, setIlce] = useState('Sivrihisar');
  const [mahalleKoy, setMahalleKoy] = useState('Dümrek');
  const [adaNo, setAdaNo] = useState('');
  const [parselNo, setParselNo] = useState('');
  const [paftaNo, setPaftaNo] = useState('');
  const [nitelik, setNitelik] = useState('Demiryolu Güzergahı ve Müştemilatı');
  const [alanM2, setAlanM2] = useState<number | string>(30000);
  const [malik, setMalik] = useState('TCDD İşletmesi Genel Müdürlüğü');
  const [ownershipStatus, setOwnershipStatus] = useState<RailwayParcel['ownershipStatus']>('tcdd');
  const [lineName, setLineName] = useState(availableLines[0] || 'Eskişehir-Konya');
  const [startKm, setStartKm] = useState('');
  const [endKm, setEndKm] = useState('');
  const [kamulastirmaGenisligiMetre, setKamulastirmaGenisligiMetre] = useState<number | string>(30);
  const [coordinates, setCoordinates] = useState<[number, number][]>([]);
  const [encroachmentStatus, setEncroachmentStatus] = useState<'none' | 'suspected' | 'verified'>('none');
  const [encroachmentNote, setEncroachmentNote] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [protocolNo, setProtocolNo] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Import / Export State
  const [importText, setImportText] = useState('');
  const [parsedImportList, setParsedImportList] = useState<Partial<RailwayParcel>[]>([]);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  // TKGM Hızlı KML Sorgulama & Bağlantı Üretici State
  const [tkgmQueryIl, setTkgmQueryIl] = useState('Eskişehir');
  const [tkgmQueryIlce, setTkgmQueryIlce] = useState('Sivrihisar');
  const [tkgmQueryMahalle, setTkgmQueryMahalle] = useState('Dümrek');
  const [tkgmQueryAda, setTkgmQueryAda] = useState('104');
  const [tkgmQueryParsel, setTkgmQueryParsel] = useState('1');
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyTkgmInfo = () => {
    const text = `${tkgmQueryIl} ${tkgmQueryIlce} ${tkgmQueryMahalle} Ada: ${tkgmQueryAda} Parsel: ${tkgmQueryParsel}`;
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const resetForm = () => {
    setEditingParcel(null);
    setIl('Eskişehir');
    setIlce('Sivrihisar');
    setMahalleKoy('Dümrek');
    setAdaNo('');
    setParselNo('');
    setPaftaNo('');
    setNitelik('Demiryolu Güzergahı ve Müştemilatı');
    setAlanM2(30000);
    setMalik('TCDD İşletmesi Genel Müdürlüğü');
    setOwnershipStatus('tcdd');
    setLineName(availableLines[0] || 'Eskişehir-Konya');
    setStartKm('');
    setEndKm('');
    setKamulastirmaGenisligiMetre(30);
    setCoordinates([]);
    setEncroachmentStatus('none');
    setEncroachmentNote('');
    setContactPerson('');
    setProtocolNo('');
    setNotes('');
    setFormError(null);
  };

  const handleStartEdit = (parcel: RailwayParcel) => {
    setEditingParcel(parcel);
    setIl(parcel.il || 'Eskişehir');
    setIlce(parcel.ilce || 'Sivrihisar');
    setMahalleKoy(parcel.mahalleKoy || 'Dümrek');
    setAdaNo(parcel.adaNo || '');
    setParselNo(parcel.parselNo || '');
    setPaftaNo(parcel.paftaNo || '');
    setNitelik(parcel.nitelik || 'Demiryolu Güzergahı ve Müştemilatı');
    setAlanM2(parcel.alanM2 || 0);
    setMalik(parcel.malik || 'TCDD İşletmesi Genel Müdürlüğü');
    setOwnershipStatus(parcel.ownershipStatus || 'tcdd');
    setLineName(parcel.lineName || availableLines[0] || 'Eskişehir-Konya');
    setStartKm(parcel.startKm || '');
    setEndKm(parcel.endKm || '');
    setKamulastirmaGenisligiMetre(parcel.kamulastirmaGenisligiMetre || 30);
    setCoordinates(parcel.coordinates || []);
    setEncroachmentStatus(parcel.encroachmentStatus || 'none');
    setEncroachmentNote(parcel.encroachmentNote || '');
    setContactPerson(parcel.contactPerson || '');
    setProtocolNo(parcel.protocolNo || '');
    setNotes(parcel.notes || '');
    setFormError(null);
    setActiveTab('add');
  };

  // Otomatik Koridor Üretici (Sistemdeki Demiryolu Noktalarından Eksen Ofseti Hesaplar)
  const handleGenerateCorridorFromKm = () => {
    const sNum = parseFloat(startKm.replace(',', '.'));
    const eNum = parseFloat(endKm.replace(',', '.'));

    if (isNaN(sNum) || isNaN(eNum)) {
      setFormError('Otomatik koridor için lütfen geçerli Başlangıç KM ve Bitiş KM giriniz (Örn: 54 ve 55).');
      return;
    }

    const corridor = generateCorridorPolygonFromRailway(
      points,
      sNum,
      eNum,
      Number(kamulastirmaGenisligiMetre) || 30,
      lineName
    );

    if (corridor.length >= 3) {
      setCoordinates(corridor);
      const calculatedM2 = calculateParcelArea(corridor);
      if (calculatedM2 > 0) {
        setAlanM2(calculatedM2);
      }
      setFormError(null);
    } else {
      setFormError(
        'Bu KM aralığında koordinat koridoru oluşturacak yeterli demiryolu noktası bulunamadı. Lütfen koordinatları haritadan seçin veya manuel ekleyin.'
      );
    }
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adaNo.trim() || !parselNo.trim()) {
      setFormError('Ada No ve Parsel No alanları zorunludur.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const center = calculateParcelCenter(coordinates);
      const tkgmLink = generateTkgmUrl(il, ilce, mahalleKoy, adaNo, parselNo, center[0], center[1]);

      const parcelData = {
        il: il.trim(),
        ilce: ilce.trim(),
        mahalleKoy: mahalleKoy.trim(),
        adaNo: adaNo.trim(),
        parselNo: parselNo.trim(),
        paftaNo: paftaNo.trim() || undefined,
        nitelik: nitelik.trim(),
        alanM2: Number(alanM2) || 0,
        malik: malik.trim(),
        ownershipStatus,
        lineName,
        startKm: startKm.trim() || undefined,
        endKm: endKm.trim() || undefined,
        kamulastirmaGenisligiMetre: Number(kamulastirmaGenisligiMetre) || 30,
        coordinates,
        encroachmentStatus,
        encroachmentNote: encroachmentNote.trim() || undefined,
        contactPerson: contactPerson.trim() || undefined,
        protocolNo: protocolNo.trim() || undefined,
        notes: notes.trim() || undefined,
        tkgmUrl: tkgmLink,
      };

      if (editingParcel) {
        await onUpdateParcel({
          ...editingParcel,
          ...parcelData,
        });
      } else {
        await onAddParcel(parcelData);
      }

      resetForm();
      setActiveTab('list');
    } catch (err: any) {
      setFormError(err.message || 'Kayıt sırasında bir hata oluştu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // KML / GeoJSON dosya okuma
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (content) {
        setImportText(content);
        const parsed = parseKmlOrGeoJsonParcels(content);
        setParsedImportList(parsed);
        setImportMessage(`${parsed.length} adet kadastro parseli tespit edildi.`);
      }
    };
    reader.readAsText(file);
  };

  const handleProcessImport = async () => {
    if (parsedImportList.length === 0) {
      const parsed = parseKmlOrGeoJsonParcels(importText);
      if (parsed.length === 0) {
        setImportMessage('Geçerli bir KML veya GeoJSON parsel verisi bulunamadı.');
        return;
      }
      setParsedImportList(parsed);
    }

    const completeParcels: RailwayParcel[] = parsedImportList.map((p, idx) => ({
      id: `parsel-imp-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`,
      il: p.il || 'Eskişehir',
      ilce: p.ilce || 'Sivrihisar',
      mahalleKoy: p.mahalleKoy || 'Dümrek',
      adaNo: p.adaNo || '101',
      parselNo: p.parselNo || String(idx + 1),
      paftaNo: p.paftaNo || '',
      nitelik: p.nitelik || 'Demiryolu Güzergahı',
      alanM2: p.alanM2 || 25000,
      malik: p.malik || 'TCDD İşletmesi Genel Müdürlüğü',
      ownershipStatus: 'tcdd',
      lineName: availableLines[0] || 'Eskişehir-Konya',
      coordinates: p.coordinates || [],
      notes: p.notes || 'KML/GeoJSON İçe Aktarımı',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    await onBatchImportParcels(completeParcels);
    setImportMessage(`${completeParcels.length} adet parsel sisteme başarıyla aktarıldı.`);
    setParsedImportList([]);
    setImportText('');
    setActiveTab('list');
  };

  // Dışa aktarma GeoJSON
  const handleExportGeoJson = () => {
    const geojson = {
      type: 'FeatureCollection',
      features: parcels.map((p) => {
        const ring = (p.coordinates || []).map(([lat, lng]) => [lng, lat]);
        // Poligonu kapat
        if (ring.length > 0 && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) {
          ring.push([...ring[0]]);
        }
        return {
          type: 'Feature',
          properties: {
            id: p.id,
            ada: p.adaNo,
            parsel: p.parselNo,
            il: p.il,
            ilce: p.ilce,
            mahalle: p.mahalleKoy,
            nitelik: p.nitelik,
            alanM2: p.alanM2,
            malik: p.malik,
            ownershipStatus: p.ownershipStatus,
            startKm: p.startKm,
            endKm: p.endKm,
            lineName: p.lineName,
            encroachmentStatus: p.encroachmentStatus,
          },
          geometry: {
            type: 'Polygon',
            coordinates: [ring],
          },
        };
      }),
    };

    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tcdd_demiryolu_arazileri_${new Date().toISOString().slice(0, 10)}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Dışa aktarma KML (Google Earth & CBS uyumlu)
  const handleExportKml = () => {
    const kmlContent = exportParcelsToKml(parcels);
    const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tcdd_demiryolu_kadastro_${new Date().toISOString().slice(0, 10)}.kml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtrelenmiş Parseller
  const filteredParcels = useMemo(() => {
    return parcels.filter((p) => {
      // Hat filtresi
      if (selectedLineFilter !== 'all' && p.lineName !== selectedLineFilter) return false;
      // Mülkiyet filtresi
      if (ownershipFilter !== 'all' && p.ownershipStatus !== ownershipFilter) return false;
      // İşgal filtresi
      if (encroachmentFilter !== 'all') {
        if (encroachmentFilter === 'encroached' && (!p.encroachmentStatus || p.encroachmentStatus === 'none')) {
          return false;
        }
        if (encroachmentFilter === 'clean' && p.encroachmentStatus && p.encroachmentStatus !== 'none') {
          return false;
        }
      }
      // Arama metni
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchAda = p.adaNo.toLowerCase().includes(q);
        const matchParsel = p.parselNo.toLowerCase().includes(q);
        const matchCombined = `${p.adaNo}/${p.parselNo}`.includes(q);
        const matchMahalle = p.mahalleKoy?.toLowerCase().includes(q);
        const matchIlce = p.ilce?.toLowerCase().includes(q);
        const matchIl = p.il?.toLowerCase().includes(q);
        const matchMalik = p.malik?.toLowerCase().includes(q);
        const matchKm = (p.startKm && p.startKm.toLowerCase().includes(q)) || (p.endKm && p.endKm.toLowerCase().includes(q));
        const matchNotes = p.notes?.toLowerCase().includes(q);
        return matchAda || matchParsel || matchCombined || matchMahalle || matchIlce || matchIl || matchMalik || matchKm || matchNotes;
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === 'area') {
        return (b.alanM2 || 0) - (a.alanM2 || 0);
      }
      if (sortBy === 'ada') {
        const adaDiff = parseInt(a.adaNo) - parseInt(b.adaNo);
        if (!isNaN(adaDiff) && adaDiff !== 0) return adaDiff;
        return parseInt(a.parselNo) - parseInt(b.parselNo);
      }
      // default: km
      return (a.startKmNum || 0) - (b.startKmNum || 0);
    });
  }, [parcels, selectedLineFilter, ownershipFilter, encroachmentFilter, searchQuery, sortBy]);

  // İstatistikler
  const stats = useMemo(() => {
    let totalM2 = 0;
    let tcddCount = 0;
    let treasuryCount = 0;
    let expropriatingCount = 0;
    let encroachmentCount = 0;

    for (const p of parcels) {
      totalM2 += p.alanM2 || 0;
      if (p.ownershipStatus === 'tcdd' || !p.ownershipStatus) tcddCount++;
      if (p.ownershipStatus === 'treasury') treasuryCount++;
      if (p.ownershipStatus === 'expropriating') expropriatingCount++;
      if (p.encroachmentStatus === 'suspected' || p.encroachmentStatus === 'verified') {
        encroachmentCount++;
      }
    }

    return {
      totalCount: parcels.length,
      totalM2,
      tcddCount,
      treasuryCount,
      expropriatingCount,
      encroachmentCount,
      areaFormatted: formatAreaDisplay(totalM2),
    };
  }, [parcels]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-white">
        
        {/* Header Bar */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 border-b border-indigo-900/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                  <span>Demiryolu Arazisi &amp; Tapu Kadastro</span>
                </h2>
                <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  TCDD İstimlak &amp; Emlak
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Demiryolu kamulaştırma sahaları, parsel sınırları, mülkiyet ve tecavüz takibi
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Kapat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between px-5 bg-slate-900/90 border-b border-slate-800 flex-wrap gap-2">
          <div className="flex items-center gap-1 py-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('list')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'list'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Arazi &amp; Parsel Listesi</span>
              <span className="bg-slate-800 text-slate-300 text-[10px] font-black px-1.5 py-0.2 rounded-full ml-1">
                {parcels.length}
              </span>
            </button>

            {canEdit && (
              <button
                onClick={() => {
                  resetForm();
                  setActiveTab('add');
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'add'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{editingParcel ? 'Parseli Düzenle' : 'Yeni Arazi / Parsel Ekle'}</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('import_export')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'import_export'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>KML / GeoJSON İçe-Dışa Aktar</span>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'analytics'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Kamulaştırma Raporu</span>
            </button>
          </div>

          {/* Quick Stats Pill */}
          <div className="hidden lg:flex items-center gap-2 text-xs py-2 text-slate-400 font-mono">
            <span className="text-indigo-400 font-bold">Toplam Arazi:</span>
            <span>{stats.areaFormatted.m2Text}</span>
            <span>({stats.areaFormatted.donumText})</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950/50">
          
          {/* TAB 1: LIST VIEW */}
          {activeTab === 'list' && (
            <div className="flex flex-col gap-4">
              
              {/* Filter and Search Bar */}
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl flex flex-col md:flex-row items-center gap-3">
                {/* Search input */}
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Ada, Parsel (örn: 104/1), Mahalle, Malik veya KM ara..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filters dropdowns */}
                <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
                  {/* Line filter */}
                  <select
                    value={selectedLineFilter}
                    onChange={(e) => setSelectedLineFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-700/80 rounded-xl px-2.5 py-2 text-xs text-slate-300 focus:outline-none"
                  >
                    <option value="all">Tüm Hatlar</option>
                    {availableLines.map((line) => (
                      <option key={line} value={line}>
                        {line}
                      </option>
                    ))}
                  </select>

                  {/* Ownership filter */}
                  <select
                    value={ownershipFilter}
                    onChange={(e) => setOwnershipFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-700/80 rounded-xl px-2.5 py-2 text-xs text-slate-300 focus:outline-none"
                  >
                    <option value="all">Tüm Mülkiyetler</option>
                    <option value="tcdd">TCDD Tescilli</option>
                    <option value="treasury">Maliye Hazinesi</option>
                    <option value="expropriating">Kamulaştırma Sürüyor</option>
                    <option value="disputed">Dava / İhtilaflı</option>
                  </select>

                  {/* Encroachment filter */}
                  <select
                    value={encroachmentFilter}
                    onChange={(e) => setEncroachmentFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-700/80 rounded-xl px-2.5 py-2 text-xs text-slate-300 focus:outline-none"
                  >
                    <option value="all">Tüm Durumlar</option>
                    <option value="clean">Sorunsuz / İşgal Yok</option>
                    <option value="encroached">⚠️ İşgal / Tecavüzlü</option>
                  </select>

                  {/* Sort */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-slate-950 border border-slate-700/80 rounded-xl px-2.5 py-2 text-xs text-slate-300 focus:outline-none"
                  >
                    <option value="km">KM Sırasına Göre</option>
                    <option value="area">Alana Göre (Büyükten Küçüğe)</option>
                    <option value="ada">Ada/Parsel No Sırasına Göre</option>
                  </select>
                </div>
              </div>

              {/* Parsel Grid List */}
              {filteredParcels.length === 0 ? (
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
                  <Landmark className="w-12 h-12 text-slate-600 mb-3" />
                  <h3 className="text-base font-bold text-slate-300">Demiryolu Arazisi / Parseli Bulunamadı</h3>
                  <p className="text-xs text-slate-500 max-w-md mt-1 mb-4">
                    {searchQuery || selectedLineFilter !== 'all' || ownershipFilter !== 'all'
                      ? 'Belirlenen filtre kriterlerine uygun parsel bulunamadı. Filtreleri sıfırlayabilirsiniz.'
                      : 'Henüz kayıtlı demiryolu taşınmazı veya kadastro parseli yok. "Yeni Arazi Ekle" butonuna basarak ilk parselinizi ekleyebilir veya KML/GeoJSON yükleyebilirsiniz.'}
                  </p>
                  {canEdit && (
                    <button
                      onClick={() => {
                        resetForm();
                        setActiveTab('add');
                      }}
                      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>İlk Demiryolu Parselini Ekle</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredParcels.map((parcel) => {
                    const areaInfo = formatAreaDisplay(parcel.alanM2 || 0);
                    const isEncroached = parcel.encroachmentStatus === 'suspected' || parcel.encroachmentStatus === 'verified';
                    const hasCoordinates = parcel.coordinates && parcel.coordinates.length >= 3;

                    return (
                      <div
                        key={parcel.id}
                        className={`bg-slate-900 border rounded-2xl p-4 flex flex-col justify-between transition-all hover:border-indigo-500/50 shadow-md ${
                          isEncroached ? 'border-amber-500/40 bg-amber-950/10' : 'border-slate-800'
                        }`}
                      >
                        <div>
                          {/* Card Top: Ada / Parsel Badge & Ownership Badge */}
                          <div className="flex items-center justify-between gap-2 mb-2.5">
                            <div className="flex items-center gap-2">
                              <span className="bg-indigo-600 text-white text-xs font-black font-mono px-2.5 py-1 rounded-lg shadow-xs">
                                Ada {parcel.adaNo} / Parsel {parcel.parselNo}
                              </span>
                              {parcel.paftaNo && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  Pafta: {parcel.paftaNo}
                                </span>
                              )}
                            </div>

                            {/* Ownership Status Badge */}
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                parcel.ownershipStatus === 'tcdd' || !parcel.ownershipStatus
                                  ? 'bg-purple-900/60 text-purple-300 border border-purple-500/40'
                                  : parcel.ownershipStatus === 'treasury'
                                  ? 'bg-sky-900/60 text-sky-300 border border-sky-500/40'
                                  : parcel.ownershipStatus === 'expropriating'
                                  ? 'bg-amber-900/60 text-amber-300 border border-amber-500/40'
                                  : 'bg-red-900/60 text-red-300 border border-red-500/40'
                              }`}
                            >
                              {parcel.ownershipStatus === 'tcdd' || !parcel.ownershipStatus
                                ? 'TCDD Mülkiyeti'
                                : parcel.ownershipStatus === 'treasury'
                                ? 'Maliye Hazinesi'
                                : parcel.ownershipStatus === 'expropriating'
                                ? 'Kamulaştırma Sürüyor'
                                : 'İhtilaflı / Dava'}
                            </span>
                          </div>

                          {/* Location details */}
                          <h4 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span>
                              {parcel.mahalleKoy}, {parcel.ilce} / {parcel.il}
                            </span>
                          </h4>

                          {/* Nitelik & Malik */}
                          <div className="text-xs text-slate-300 mt-1 font-medium">
                            <span className="text-slate-400">Nitelik:</span> {parcel.nitelik}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5 truncate">
                            <span className="text-slate-500">Malik:</span> {parcel.malik}
                          </div>

                          {/* KM and Line Alignment */}
                          <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
                            <div className="flex flex-col">
                              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Demiryolu KM</span>
                              <span className="font-mono font-bold text-amber-400">
                                {parcel.startKm ? `KM ${parcel.startKm}` : '-'}
                                {parcel.endKm ? ` ➔ ${parcel.endKm}` : ''}
                              </span>
                            </div>

                            <div className="flex flex-col text-right">
                              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Yüzölçümü</span>
                              <span className="font-mono font-bold text-emerald-400">
                                {areaInfo.m2Text}
                              </span>
                            </div>
                          </div>

                          {/* Encroachment Alert if any */}
                          {isEncroached && (
                            <div className="mt-2.5 bg-amber-950/40 border border-amber-500/40 rounded-xl p-2 flex items-start gap-2 text-xs text-amber-300">
                              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <span className="font-bold">
                                  {parcel.encroachmentStatus === 'verified' ? 'Tecavüz / İşgal Tespit Edildi' : 'Şüpheli Müdahale Var'}
                                </span>
                                {parcel.encroachmentNote && (
                                  <p className="text-[11px] text-amber-200/80 mt-0.5">{parcel.encroachmentNote}</p>
                                )}
                              </div>
                            </div>
                          )}

                          {parcel.notes && !isEncroached && (
                            <p className="text-[11px] text-slate-400 mt-2 bg-slate-950/60 p-2 rounded-lg border border-slate-800/50">
                              {parcel.notes}
                            </p>
                          )}
                        </div>

                        {/* Card Actions */}
                        <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between gap-1.5">
                          {/* Left: Map & TKGM Links */}
                          <div className="flex items-center gap-1.5">
                            {hasCoordinates && (
                              <button
                                onClick={() => {
                                  onFocusParcelOnMap(parcel);
                                  onClose();
                                }}
                                className="flex items-center gap-1 bg-indigo-950 hover:bg-indigo-900 border border-indigo-700/50 text-indigo-300 hover:text-white text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                                title="Haritada Odaklan ve Poligonu Gör"
                              >
                                <Map className="w-3.5 h-3.5" />
                                <span>Haritada Gör</span>
                              </button>
                            )}

                            {parcel.tkgmUrl && (
                              <a
                                href={parcel.tkgmUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-sky-300 hover:text-sky-200 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                                title="Resmi TKGM Parsel Sorgu Sisteminde Aç"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>TKGM</span>
                              </a>
                            )}
                          </div>

                          {/* Right: Edit & Delete buttons */}
                          {canEdit && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleStartEdit(parcel)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors cursor-pointer"
                                title="Parseli Düzenle"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {canDelete && (
                                <button
                                  onClick={() => setParcelToDelete(parcel)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors cursor-pointer"
                                  title="Parseli Sil"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ADD / EDIT PARCEL FORM */}
          {activeTab === 'add' && (
            <form onSubmit={handleSaveForm} className="max-w-4xl mx-auto flex flex-col gap-5">
              
              {/* Top info alert */}
              <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-2xl p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Landmark className="w-6 h-6 text-indigo-400 shrink-0" />
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {editingParcel ? `Ada ${editingParcel.adaNo} / Parsel ${editingParcel.parselNo} Düzenleniyor` : 'Yeni Demiryolu Taşınmazı & Kadastro Parseli'}
                    </h3>
                    <p className="text-xs text-slate-300">
                      Tapu kadastro kayıtları, demiryolu emlak ve kamulaştırma emniyet koridoru bilgilerini doldurunuz.
                    </p>
                  </div>
                </div>

                {editingParcel && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-xs text-slate-400 hover:text-white bg-slate-800 px-3 py-1.5 rounded-lg"
                  >
                    Yeni Kayda Dön
                  </button>
                )}
              </div>

              {formError && (
                <div className="bg-red-950/60 border border-red-500/50 rounded-xl p-3 text-xs text-red-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Group 1: Tapu ve Konum Bilgileri */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
                <h4 className="text-xs font-black uppercase text-indigo-400 tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>1. Tapu &amp; Kadastro İdari Bilgileri</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">İl</label>
                    <input
                      type="text"
                      required
                      value={il}
                      onChange={(e) => setIl(e.target.value)}
                      placeholder="Örn: Eskişehir"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">İlçe</label>
                    <input
                      type="text"
                      required
                      value={ilce}
                      onChange={(e) => setIlce(e.target.value)}
                      placeholder="Örn: Sivrihisar"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Mahalle / Köy</label>
                    <input
                      type="text"
                      required
                      value={mahalleKoy}
                      onChange={(e) => setMahalleKoy(e.target.value)}
                      placeholder="Örn: Dümrek"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-amber-400 mb-1">Ada No *</label>
                    <input
                      type="text"
                      required
                      value={adaNo}
                      onChange={(e) => setAdaNo(e.target.value)}
                      placeholder="Örn: 104"
                      className="w-full bg-slate-950 border border-amber-500/40 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-amber-400 mb-1">Parsel No *</label>
                    <input
                      type="text"
                      required
                      value={parselNo}
                      onChange={(e) => setParselNo(e.target.value)}
                      placeholder="Örn: 1"
                      className="w-full bg-slate-950 border border-amber-500/40 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Pafta No</label>
                    <input
                      type="text"
                      value={paftaNo}
                      onChange={(e) => setPaftaNo(e.target.value)}
                      placeholder="Örn: K28-d-04-c"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Nitelik (Cinsi)</label>
                    <input
                      type="text"
                      value={nitelik}
                      onChange={(e) => setNitelik(e.target.value)}
                      placeholder="Örn: Demiryolu Güzergahı ve Müştemilatı"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Yüzölçümü (m²)</label>
                    <input
                      type="number"
                      value={alanM2}
                      onChange={(e) => setAlanM2(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Örn: 30000"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Group 2: Mülkiyet & Malik Bilgileri */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
                <h4 className="text-xs font-black uppercase text-purple-400 tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>2. Mülkiyet &amp; İstimlak Durumu</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Malik (Kayıtlı Sahip)</label>
                    <input
                      type="text"
                      value={malik}
                      onChange={(e) => setMalik(e.target.value)}
                      placeholder="Örn: TCDD İşletmesi Genel Müdürlüğü"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Mülkiyet Durumu</label>
                    <select
                      value={ownershipStatus}
                      onChange={(e) => setOwnershipStatus(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      <option value="tcdd">TCDD Tescilli Mülkiyet</option>
                      <option value="treasury">Maliye Hazinesi (Tahsisli)</option>
                      <option value="expropriating">Kamulaştırma Devam Eden</option>
                      <option value="easement">İrtifak / Geçit Hakkı</option>
                      <option value="disputed">Dava / İhtilaflı Mülkiyet</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">İstimlak / Protokol Dosya No</label>
                    <input
                      type="text"
                      value={protocolNo}
                      onChange={(e) => setProtocolNo(e.target.value)}
                      placeholder="Örn: 2026/İST-442"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Sorumlu Emlak / Harita Şefi</label>
                    <input
                      type="text"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      placeholder="Örn: 712 Şefliği / Emlak Servisi"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Group 3: Demiryolu Güzergah & KM Koridoru */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                    <Map className="w-3.5 h-3.5" />
                    <span>3. Demiryolu Güzergahı &amp; Kamulaştırma Koridoru</span>
                  </h4>

                  <button
                    type="button"
                    onClick={handleGenerateCorridorFromKm}
                    className="flex items-center gap-1.5 bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-md cursor-pointer transition-all active:scale-95"
                    title="Mevcut demiryolu hattı noktalarından otomatik 30m koridor poligonu hesaplar"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Hattan Otomatik Koridor Üret</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Demiryolu Hattı</label>
                    <select
                      value={lineName}
                      onChange={(e) => setLineName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      {availableLines.map((line) => (
                        <option key={line} value={line}>
                          {line}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Başlangıç KM</label>
                    <input
                      type="text"
                      value={startKm}
                      onChange={(e) => setStartKm(e.target.value)}
                      placeholder="Örn: 54+000 veya 54"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Bitiş KM</label>
                    <input
                      type="text"
                      value={endKm}
                      onChange={(e) => setEndKm(e.target.value)}
                      placeholder="Örn: 55+200 veya 55.2"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Kamulaştırma Genişliği (m)</label>
                    <input
                      type="number"
                      value={kamulastirmaGenisligiMetre}
                      onChange={(e) => setKamulastirmaGenisligiMetre(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Örn: 30"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
                    />
                  </div>
                </div>

                {/* Coordinates status badge */}
                <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${coordinates.length >= 3 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                    <span className="text-slate-300 font-medium">
                      {coordinates.length >= 3
                        ? `Poligon Sınır Koordinatları: ${coordinates.length} köşe noktası tanımlı`
                        : 'Henüz köşe koordinatı yok ("Hattan Otomatik Koridor Üret"e basabilir veya KML aktarabilirsiniz)'}
                    </span>
                  </div>

                  {coordinates.length >= 3 && (
                    <button
                      type="button"
                      onClick={() => setCoordinates([])}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Koordinatları Temizle
                    </button>
                  )}
                </div>
              </div>

              {/* Group 4: İşgal & Tecavüz Takibi */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
                <h4 className="text-xs font-black uppercase text-red-400 tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>4. İşgal &amp; Tecavüz Takibi</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">İşgal / Tecavüz Durumu</label>
                    <select
                      value={encroachmentStatus}
                      onChange={(e) => setEncroachmentStatus(e.target.value as any)}
                      className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-xs font-bold ${
                        encroachmentStatus !== 'none'
                          ? 'border-amber-500 text-amber-300'
                          : 'border-slate-700 text-emerald-400'
                      }`}
                    >
                      <option value="none">Sorun Yok / Temiz</option>
                      <option value="suspected">Şüpheli İşgal / İnceleme Aşamasında</option>
                      <option value="verified">Tecavüz / İşgal Tespit Edildi</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">İşgal / Tecavüz Detay Notu</label>
                    <input
                      type="text"
                      value={encroachmentNote}
                      onChange={(e) => setEncroachmentNote(e.target.value)}
                      placeholder="Örn: Komşu tarla sahibi tarafından hat ekseninden 8m içeriye tarımsal ekim yapılmış"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Genel Notlar ve Açıklama</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Saha tespitleri, tel örgü durumu, menfez/geçit bağlantısı vb..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white"
                  />
                </div>
              </div>

              {/* Form Bottom Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Vazgeç
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingParcel ? 'Değişiklikleri Kaydet' : 'Parseli Sisteme Kaydet'}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: IMPORT & EXPORT */}
          {activeTab === 'import_export' && (
            <div className="max-w-4xl mx-auto flex flex-col gap-6">
              
              {/* TKGM'den KML İndirme Adımları & Hızlı Parsel Sorgu Kartı */}
              <div className="bg-gradient-to-r from-sky-950/80 via-indigo-950/70 to-slate-900 border border-sky-500/40 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 shrink-0">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                      <span>Tapu Kadastro (TKGM) Parsel Sorgu'dan KML Nasıl Alınır?</span>
                      <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Ücretsiz &amp; Anlık
                      </span>
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Resmi TKGM sisteminden demiryolu arazilerini KML olarak indirip tek tıkla buraya aktarabilirsiniz.
                    </p>
                  </div>
                </div>

                {/* 3 Step Visual Guide */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl flex flex-col justify-between">
                    <div className="flex items-center gap-2 text-sky-400 font-bold text-xs mb-1.5">
                      <span className="w-5 h-5 rounded-full bg-sky-500/20 flex items-center justify-center font-mono text-[11px]">1</span>
                      <span>Parseli Sorgulayın</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Resmi <strong>parselsorgu.tkgm.gov.tr</strong> sitesine girin veya aşağıdaki hızlı kutudan İl/İlçe/Mahalle/Ada/Parsel girip <em>"TKGM'de Aç"</em>a basın.
                    </p>
                  </div>

                  <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl flex flex-col justify-between">
                    <div className="flex items-center gap-2 text-amber-400 font-bold text-xs mb-1.5">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center font-mono text-[11px]">2</span>
                      <span>KML Olarak İndirin</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Açılan ekranda parsel seçildiğinde sağ alttaki veya özet kartındaki <strong>"İndir"</strong> simgesine tıklayıp <strong>"KML"</strong> seçeneğini seçin.
                    </p>
                  </div>

                  <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl flex flex-col justify-between">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs mb-1.5">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center font-mono text-[11px]">3</span>
                      <span>Buraya Yükleyin</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      İnen <code>.kml</code> dosyasını aşağıdaki kutucuğa sürükleyin. Sınırlar, köşe koordinatları ve $m^2$ anında haritanıza işlenecektir.
                    </p>
                  </div>
                </div>

                {/* Quick TKGM Link Builder Box */}
                <div className="bg-slate-950/70 border border-sky-600/30 p-4 rounded-2xl flex flex-col gap-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                      <Search className="w-3.5 h-3.5" />
                      <span>Resmi TKGM Parsel Sorgu Bağlantısı</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyTkgmInfo}
                        className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                          isCopied
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                        }`}
                        title="Ada ve Parsel bilgilerini kopyalayın"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-200" /> : <Copy className="w-3.5 h-3.5 text-slate-300" />}
                        <span>{isCopied ? 'Bilgiler Kopyalandı!' : 'Bilgileri Kopyala'}</span>
                      </button>

                      <a
                        href="https://parselsorgu.tkgm.gov.tr/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
                        title="TKGM Parsel Sorgu resmi sitesini yeni sekmede güvenle açar"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>TKGM Resmi Sitesini Aç ➔</span>
                      </a>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">İl</label>
                      <input
                        type="text"
                        value={tkgmQueryIl}
                        onChange={(e) => setTkgmQueryIl(e.target.value)}
                        placeholder="İl"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        title="İl"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">İlçe</label>
                      <input
                        type="text"
                        value={tkgmQueryIlce}
                        onChange={(e) => setTkgmQueryIlce(e.target.value)}
                        placeholder="İlçe"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        title="İlçe"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Mahalle / Köy</label>
                      <input
                        type="text"
                        value={tkgmQueryMahalle}
                        onChange={(e) => setTkgmQueryMahalle(e.target.value)}
                        placeholder="Mahalle"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        title="Mahalle/Köy"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-amber-300 block mb-0.5 font-bold">Ada No</label>
                      <input
                        type="text"
                        value={tkgmQueryAda}
                        onChange={(e) => setTkgmQueryAda(e.target.value)}
                        placeholder="Ada No"
                        className="w-full bg-slate-900 border border-amber-500/40 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-amber-300"
                        title="Ada No"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-amber-300 block mb-0.5 font-bold">Parsel No</label>
                      <input
                        type="text"
                        value={tkgmQueryParsel}
                        onChange={(e) => setTkgmQueryParsel(e.target.value)}
                        placeholder="Parsel No"
                        className="w-full bg-slate-900 border border-amber-500/40 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-amber-300"
                        title="Parsel No"
                      />
                    </div>
                  </div>

                  {/* TKGM Freeze & Usage Guidance Notice */}
                  <div className="bg-sky-950/40 border border-sky-500/20 rounded-xl p-3 text-[11px] text-slate-300 flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    <div className="leading-relaxed">
                      <strong className="text-white">TKGM Sitesinin Donmasını Önleme İpucu:</strong> TKGM Parsel Sorgu sistemi harici linkten doğrudan derin parametreyle açıldığında veya ilk girişteki <em>"Kullanım Koşulları"</em> sözleşmesi nedeniyle web tarayıcısında donup kalabilmektedir. <strong>En hızlı çözüm:</strong> Yukarıdaki <strong>"Bilgileri Kopyala"</strong> butonuna basın, ardından <strong>"TKGM Resmi Sitesini Aç"</strong> butonuna tıklayın. Açılan temiz sayfada soldaki arama kutusuna yapıştırarak parselinizi anında bulun ve <strong>"İndir &gt; KML"</strong> diyerek aşağıdaki alana yükleyin.
                    </div>
                  </div>
                </div>
              </div>

              {/* File upload box */}
              <div className="bg-slate-900 border-2 border-dashed border-indigo-500/40 hover:border-indigo-400 rounded-3xl p-8 text-center flex flex-col items-center justify-center transition-colors">
                <div className="w-14 h-14 rounded-2xl bg-indigo-950 flex items-center justify-center text-indigo-400 mb-3 shadow-lg">
                  <Upload className="w-7 h-7" />
                </div>
                <h3 className="text-base font-extrabold text-white">
                  İndirdiğiniz KML veya GeoJSON Parsel Dosyasını Yükleyin
                </h3>
                <p className="text-xs text-slate-400 max-w-md mt-1 mb-4">
                  TKGM Parsel Sorgu'dan, Netcad'den, AutoCAD'den veya Google Earth'ten aldığınız <strong>.kml</strong> veya <strong>.geojson</strong> dosyasını buraya sürükleyin.
                </p>

                <label className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-5 py-3 rounded-xl shadow-lg shadow-indigo-600/30 cursor-pointer transition-all">
                  <Upload className="w-4 h-4" />
                  <span>KML / GeoJSON Dosyası Seçin (.kml, .geojson, .json)</span>
                  <input
                    type="file"
                    accept=".kml,.geojson,.json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Paste Textarea */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3">
                <h4 className="text-xs font-black uppercase text-slate-300 tracking-wider">
                  Veya KML / GeoJSON Metnini Buraya Yapıştırın
                </h4>
                <textarea
                  rows={6}
                  value={importText}
                  onChange={(e) => {
                    setImportText(e.target.value);
                    const parsed = parseKmlOrGeoJsonParcels(e.target.value);
                    setParsedImportList(parsed);
                    setImportMessage(`${parsed.length} adet parsel tespit edildi.`);
                  }}
                  placeholder="<kml>...</kml> veya { &quot;type&quot;: &quot;FeatureCollection&quot;, ... }"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none"
                />

                {importMessage && (
                  <div className="bg-indigo-950/50 border border-indigo-500/30 p-3 rounded-xl text-xs text-indigo-200 flex items-center justify-between">
                    <span>{importMessage}</span>
                    {parsedImportList.length > 0 && (
                      <button
                        onClick={handleProcessImport}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        {parsedImportList.length} Parseli İçe Aktar
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Export Section */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-white">Parsel Verilerini Dışa Aktar</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Sistemdeki tüm TCDD arazilerini Google Earth (KML) veya Netcad/CBS uyumlu (GeoJSON) formatında indirin.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleExportKml}
                    disabled={parcels.length === 0}
                    className="flex items-center gap-2 bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-600 hover:to-emerald-600 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded-xl border border-teal-500/40 transition-colors cursor-pointer shrink-0 shadow-md"
                    title="Google Earth KML Formatında İndir"
                  >
                    <Globe className="w-4 h-4 text-emerald-300" />
                    <span>Google Earth KML</span>
                  </button>

                  <button
                    onClick={handleExportGeoJson}
                    disabled={parcels.length === 0}
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-700 transition-colors cursor-pointer shrink-0"
                    title="CBS / Netcad GeoJSON Formatında İndir"
                  >
                    <Download className="w-4 h-4 text-emerald-400" />
                    <span>GeoJSON İndir</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ANALYTICS & SUMMARY */}
          {activeTab === 'analytics' && (
            <div className="max-w-4xl mx-auto flex flex-col gap-6">
              
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
                  <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Toplam Parsel</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-black font-mono text-white">{stats.totalCount}</span>
                    <span className="text-xs text-slate-500">Adet</span>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
                  <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Toplam Alan</span>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-2xl font-black font-mono text-emerald-400">{stats.areaFormatted.donumText}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono mt-1">{stats.areaFormatted.m2Text}</span>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
                  <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">TCDD Tescilli</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-black font-mono text-purple-400">{stats.tcddCount}</span>
                    <span className="text-xs text-slate-500">Parsel</span>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
                  <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">İşgal / Tecavüz</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className={`text-3xl font-black font-mono ${stats.encroachmentCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                      {stats.encroachmentCount}
                    </span>
                    <span className="text-xs text-slate-500">Kayıt</span>
                  </div>
                </div>
              </div>

              {/* Ownership Breakdown */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4">
                <h4 className="text-xs font-black uppercase text-indigo-400 tracking-wider">
                  Mülkiyet ve Hukuki Durum Dağılımı
                </h4>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-bold text-slate-300">TCDD İşletmesi Tescilli Mülk</span>
                      <span className="font-mono text-purple-400 font-bold">{stats.tcddCount} parsel</span>
                    </div>
                    <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500"
                        style={{ width: `${stats.totalCount > 0 ? (stats.tcddCount / stats.totalCount) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-bold text-slate-300">Maliye Hazinesi (Tahsisli)</span>
                      <span className="font-mono text-sky-400 font-bold">{stats.treasuryCount} parsel</span>
                    </div>
                    <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-sky-500"
                        style={{ width: `${stats.totalCount > 0 ? (stats.treasuryCount / stats.totalCount) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-bold text-slate-300">Kamulaştırma Devam Eden / İhtilaflı</span>
                      <span className="font-mono text-amber-400 font-bold">{stats.expropriatingCount} parsel</span>
                    </div>
                    <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500"
                        style={{ width: `${stats.totalCount > 0 ? (stats.expropriatingCount / stats.totalCount) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal for Parcels */}
        {parcelToDelete && (
          <DeleteConfirmModal
            isOpen={!!parcelToDelete}
            title="Demiryolu Parselini Sil"
            itemName={`Ada ${parcelToDelete.adaNo} / Parsel ${parcelToDelete.parselNo} (${parcelToDelete.mahalleKoy})`}
            description="Bu parsel kaydı demiryolu mülkiyet ve kadastro sisteminden kalıcı olarak silinecektir."
            confirmText="Evet, Parseli Sil"
            cancelText="Vazgeç"
            onConfirm={async () => {
              if (parcelToDelete) {
                await onDeleteParcel(parcelToDelete.id);
                setParcelToDelete(null);
              }
            }}
            onClose={() => setParcelToDelete(null)}
          />
        )}
      </div>
    </div>
  );
};
