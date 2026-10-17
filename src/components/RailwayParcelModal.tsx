import React, { useState, useMemo } from 'react';
import { RailwayParcel, RailwayPoint } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { DeleteConfirmModal } from './DeleteConfirmModal.tsx';
import {
  calculateParcelArea,
  calculateParcelCenter,
  formatAreaDisplay,
  parseKmlOrGeoJsonParcels,
  exportParcelsToKml,
  generateTkgmUrl,
} from '../utils/parcelUtils.ts';
import {
  Landmark,
  X,
  Search,
  Plus,
  MapPin,
  ExternalLink,
  Edit2,
  Trash2,
  Upload,
  Download,
  Check,
  Zap,
  Globe,
  FileCode,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  Square,
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
  onBulkDeleteParcels?: (ids: string[]) => Promise<void>;
  onClearAllParcels?: () => Promise<void>;
  onBatchImportParcels: (parcels: RailwayParcel[]) => Promise<void>;
  onFocusParcelOnMap: (parcel: RailwayParcel) => void;
}

export const RailwayParcelModal: React.FC<RailwayParcelModalProps> = ({
  isOpen,
  onClose,
  parcels = [],
  points = [],
  availableLines = [],
  onAddParcel,
  onUpdateParcel,
  onDeleteParcel,
  onBulkDeleteParcels,
  onClearAllParcels,
  onBatchImportParcels,
  onFocusParcelOnMap,
}) => {
  const { canEdit, canDelete } = useAuth();

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLineFilter, setSelectedLineFilter] = useState('all');

  // Modals for Add/Edit and Batch Import
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingParcel, setEditingParcel] = useState<RailwayParcel | null>(null);
  const [parcelToDelete, setParcelToDelete] = useState<RailwayParcel | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Bulk selection and deletion states
  const [selectedParcelIds, setSelectedParcelIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const listContainerRef = React.useRef<HTMLDivElement | null>(null);

  const handleScrollToTop = () => {
    listContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleScrollToBottom = () => {
    if (listContainerRef.current) {
      listContainerRef.current.scrollTo({ top: listContainerRef.current.scrollHeight, behavior: 'smooth' });
    }
  };

  // Batch Import Modal State
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchLineName, setBatchLineName] = useState('Enveriye - Konya Hattı');
  const [batchIl, setBatchIl] = useState('Eskişehir');
  const [batchIlce, setBatchIlce] = useState('Merkez');
  const [batchMahalle, setBatchMahalle] = useState('');
  const [batchAdaNo, setBatchAdaNo] = useState('101');
  const [batchParcelText, setBatchParcelText] = useState('146-1, 150-2, 160-3');
  const [batchAreaM2, setBatchAreaM2] = useState<number | string>('');
  const [batchKmlText, setBatchKmlText] = useState('');
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchMode, setBatchMode] = useState<'text' | 'kml'>('kml');
  const [batchFeedback, setBatchFeedback] = useState<string | null>(null);
  const [importNotification, setImportNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Hidden file input refs for direct KML import
  const globalKmlInputRef = React.useRef<HTMLInputElement | null>(null);
  const batchFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [isDraggingBatch, setIsDraggingBatch] = useState(false);
  const [targetImportLine, setTargetImportLine] = useState<string | null>(null);

  // Single Form State
  const [formData, setFormData] = useState<{
    lineName: string;
    adaNo: string;
    parselNo: string;
    il: string;
    ilce: string;
    mahalleKoy: string;
    alanM2: number | string;
    startKm: string;
    endKm: string;
    ownershipStatus: NonNullable<RailwayParcel['ownershipStatus']>;
    notes: string;
  }>({
    lineName: 'Enveriye - Konya Hattı',
    adaNo: '',
    parselNo: '',
    il: 'Eskişehir',
    ilce: 'Merkez',
    mahalleKoy: '',
    alanM2: '',
    startKm: '',
    endKm: '',
    ownershipStatus: 'tcdd',
    notes: '',
  });
  const [formCoordinates, setFormCoordinates] = useState<[number, number][]>([]);
  const [formAttachmentName, setFormAttachmentName] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // All known line names
  const allAvailableLines = useMemo(() => {
    const set = new Set<string>();
    ['Enveriye - Konya Hattı', 'Alayunt - Balıkesir', 'Eskişehir - Ankara YHT', 'Alayunt - Kütahya', 'Kütahya - Afyon', 'Bozüyük - Bilecik'].forEach((l) => set.add(l));
    availableLines.forEach((l) => { if (l) set.add(l); });
    parcels.forEach((p) => { if (p.lineName) set.add(p.lineName); });
    points.forEach((pt) => { if (pt.lineName) set.add(pt.lineName); });
    return Array.from(set);
  }, [availableLines, parcels, points]);

  // Filtered parcels
  const filteredParcels = useMemo(() => {
    return parcels.filter((p) => {
      if (selectedLineFilter !== 'all' && p.lineName !== selectedLineFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const adaParsel = `${p.adaNo}-${p.parselNo}`.toLowerCase();
        const adaParselSlash = `${p.adaNo}/${p.parselNo}`.toLowerCase();
        const matchNumber = adaParsel.includes(q) || adaParselSlash.includes(q) || p.parselNo.toLowerCase().includes(q) || p.adaNo.toLowerCase().includes(q);
        const matchText =
          (p.lineName || '').toLowerCase().includes(q) ||
          (p.mahalleKoy || '').toLowerCase().includes(q) ||
          (p.il || '').toLowerCase().includes(q) ||
          (p.ilce || '').toLowerCase().includes(q) ||
          (p.startKm || '').toLowerCase().includes(q);
        return matchNumber || matchText;
      }
      return true;
    });
  }, [parcels, selectedLineFilter, searchQuery]);

  // Grouped by Mıntıka / Hat
  const groupedParcels = useMemo(() => {
    const groups: Record<string, RailwayParcel[]> = {};
    for (const p of filteredParcels) {
      const key = p.lineName?.trim() || 'Genel Mıntıka / Hat';
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }

    // Sort parcels inside each group by Ada and Parsel number
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => {
        const numAdaA = parseInt((a.adaNo || '0').replace(/\D/g, ''), 10) || 0;
        const numAdaB = parseInt((b.adaNo || '0').replace(/\D/g, ''), 10) || 0;
        if (numAdaA !== numAdaB) return numAdaA - numAdaB;

        const numParselA = parseInt((a.parselNo || '0').replace(/\D/g, ''), 10) || 0;
        const numParselB = parseInt((b.parselNo || '0').replace(/\D/g, ''), 10) || 0;
        if (numParselA !== numParselB) return numParselA - numParselB;

        return (a.parselNo || '').localeCompare(b.parselNo || '');
      });
    });

    return groups;
  }, [filteredParcels]);

  // Total area and statistics
  const totalStats = useMemo(() => {
    const totalArea = parcels.reduce((sum, p) => sum + (p.alanM2 || 0), 0);
    return {
      count: parcels.length,
      areaFormatted: formatAreaDisplay(totalArea),
    };
  }, [parcels]);

  // Open Add Modal
  const handleOpenAdd = (defaultLine?: string) => {
    setEditingParcel(null);
    setFormData({
      lineName: defaultLine || (allAvailableLines[0] || 'Enveriye - Konya Hattı'),
      adaNo: '',
      parselNo: '',
      il: 'Eskişehir',
      ilce: 'Merkez',
      mahalleKoy: '',
      alanM2: '',
      startKm: '',
      endKm: '',
      ownershipStatus: 'tcdd',
      notes: '',
    });
    setFormCoordinates([]);
    setFormAttachmentName(null);
    setFormError(null);
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (parcel: RailwayParcel) => {
    setEditingParcel(parcel);
    setFormData({
      lineName: parcel.lineName || 'Enveriye - Konya Hattı',
      adaNo: parcel.adaNo || '',
      parselNo: parcel.parselNo || '',
      il: parcel.il || 'Eskişehir',
      ilce: parcel.ilce || 'Merkez',
      mahalleKoy: parcel.mahalleKoy || '',
      alanM2: parcel.alanM2 || '',
      startKm: parcel.startKm || '',
      endKm: parcel.endKm || '',
      ownershipStatus: parcel.ownershipStatus || 'tcdd',
      notes: parcel.notes || '',
    });
    setFormCoordinates(parcel.coordinates || []);
    setFormAttachmentName(parcel.coordinates && parcel.coordinates.length >= 3 ? 'KML Sınırları Mevcut' : null);
    setFormError(null);
    setIsFormModalOpen(true);
  };

  // Save Single Form
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.adaNo.trim() || !formData.parselNo.trim()) {
      setFormError('Lütfen Ada No ve Parsel No alanlarını doldurunuz.');
      return;
    }

    setIsSubmitting(true);
    try {
      const areaNum = Number(formData.alanM2) || 0;
      if (editingParcel) {
        await onUpdateParcel({
          ...editingParcel,
          lineName: formData.lineName.trim() || 'Enveriye - Konya Hattı',
          adaNo: formData.adaNo.trim(),
          parselNo: formData.parselNo.trim(),
          il: formData.il.trim(),
          ilce: formData.ilce.trim(),
          mahalleKoy: formData.mahalleKoy.trim(),
          alanM2: areaNum,
          startKm: formData.startKm.trim() || undefined,
          endKm: formData.endKm.trim() || undefined,
          ownershipStatus: formData.ownershipStatus,
          notes: formData.notes.trim() || undefined,
          coordinates: formCoordinates.length >= 3 ? formCoordinates : editingParcel.coordinates,
        });
      } else {
        await onAddParcel({
          lineName: formData.lineName.trim() || 'Enveriye - Konya Hattı',
          adaNo: formData.adaNo.trim(),
          parselNo: formData.parselNo.trim(),
          il: formData.il.trim() || 'Eskişehir',
          ilce: formData.ilce.trim() || 'Merkez',
          mahalleKoy: formData.mahalleKoy.trim(),
          alanM2: areaNum,
          startKm: formData.startKm.trim() || undefined,
          endKm: formData.endKm.trim() || undefined,
          ownershipStatus: formData.ownershipStatus,
          notes: formData.notes.trim() || undefined,
          malik: 'TCDD İşletmesi Genel Müdürlüğü',
          nitelik: 'Demiryolu Güzergahı',
          coordinates: formCoordinates,
        });
      }
      setIsFormModalOpen(false);
      setEditingParcel(null);
    } catch (err: any) {
      setFormError(err?.message || 'Parsel kaydedilirken bir hata oluştu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Attach KML to an existing parcel directly from row
  const handleAttachKmlToParcel = async (parcel: RailwayParcel, file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const parsed = parseKmlOrGeoJsonParcels(content);
      if (parsed.length === 0) {
        setImportNotification({
          type: 'error',
          message: `${parcel.adaNo}-${parcel.parselNo} için geçerli KML koordinatı bulunamadı.`,
        });
        return;
      }

      const first = parsed[0];
      const updated: RailwayParcel = {
        ...parcel,
        coordinates: first.coordinates && first.coordinates.length >= 3 ? first.coordinates : parcel.coordinates,
        alanM2: first.alanM2 || parcel.alanM2,
        il: (first.il && first.il !== 'Kütahya' ? first.il : (parcel.il || first.il)) || 'Eskişehir',
        ilce: (first.ilce && first.ilce !== 'Merkez' ? first.ilce : (parcel.ilce || first.ilce)) || 'Merkez',
        mahalleKoy: first.mahalleKoy || parcel.mahalleKoy,
        paftaNo: first.paftaNo || parcel.paftaNo,
        notes: parcel.notes ? `${parcel.notes} (KML: ${file.name})` : `TKGM KML: ${file.name}`,
      };

      await onUpdateParcel(updated);
      setImportNotification({
        type: 'success',
        message: `Ada ${parcel.adaNo} / Parsel ${parcel.parselNo} (${parcel.lineName}) için "${file.name}" KML koordinatları ve sınırları başarıyla eklendi!`,
      });
    };
    reader.readAsText(file);
  };

  // Form KML File Attachment Selector
  const handleFormKmlFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const parsed = parseKmlOrGeoJsonParcels(content);
      if (parsed.length > 0) {
        const p = parsed[0];
        setFormData((prev) => ({
          ...prev,
          adaNo: p.adaNo || prev.adaNo,
          parselNo: p.parselNo || prev.parselNo,
          il: p.il || prev.il,
          ilce: p.ilce || prev.ilce,
          mahalleKoy: p.mahalleKoy || prev.mahalleKoy,
          alanM2: p.alanM2 || prev.alanM2,
        }));
        if (p.coordinates && p.coordinates.length >= 3) {
          setFormCoordinates(p.coordinates);
        }
        setFormAttachmentName(file.name);
      }
    };
    reader.readAsText(file);
  };

  // Download Single Parcel KML
  const handleDownloadSingleKml = (parcel: RailwayParcel) => {
    const kmlContent = exportParcelsToKml([parcel]);
    const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${parcel.adaNo}-${parcel.parselNo}_${(parcel.lineName || 'Parsel').replace(/\s+/g, '_')}.kml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download Group KML
  const handleDownloadGroupKml = (lineName: string, items: RailwayParcel[]) => {
    const kmlContent = exportParcelsToKml(items);
    const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lineName.replace(/\s+/g, '_')}_Tum_Parseller.kml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // "Tümünü Göster" on Map for a Line or Global
  const handleShowAllOnMap = (items: RailwayParcel[]) => {
    if (!items || items.length === 0) return;
    const firstWithCoords = items.find((p) => p.coordinates && p.coordinates.length > 0) || items[0];
    onFocusParcelOnMap(firstWithCoords);
    onClose();
  };

  // Handle Batch Import / Quick Text Entry
  const handleSaveBatch = async () => {
    const line = batchLineName.trim() || 'Enveriye - Konya Hattı';
    setBatchFeedback(null);

    if (batchMode === 'kml') {
      // If multiple KML files were selected
      if (batchFiles.length > 0) {
        const allItems: RailwayParcel[] = [];
        for (let fIdx = 0; fIdx < batchFiles.length; fIdx++) {
          const file = batchFiles[fIdx];
          try {
            const content = await file.text();
            if (!content) continue;
            const parsed = parseKmlOrGeoJsonParcels(content);

            const nameMatch = file.name.match(/(\d+)[-_/](\d+)/);
            const nameAda = nameMatch ? nameMatch[1] : undefined;
            const nameParsel = nameMatch ? nameMatch[2] : undefined;

            parsed.forEach((p, idx) => {
              allItems.push({
                id: `parsel-${Date.now()}-${fIdx}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
                lineName: line,
                adaNo: p.adaNo && p.adaNo !== '101' ? p.adaNo : (nameAda || p.adaNo || batchAdaNo || '101'),
                parselNo: p.parselNo && p.parselNo !== '1' ? p.parselNo : (nameParsel || p.parselNo || String(fIdx + 1)),
                il: p.il || batchIl || 'Eskişehir',
                ilce: p.ilce || batchIlce || 'Merkez',
                mahalleKoy: p.mahalleKoy || batchMahalle || '',
                alanM2: p.alanM2 || (Number(batchAreaM2) || 25000),
                malik: p.malik || 'TCDD İşletmesi Genel Müdürlüğü',
                nitelik: p.nitelik || 'Demiryolu Güzergahı',
                ownershipStatus: 'tcdd',
                coordinates: p.coordinates || [],
                notes: `${line} KML Aktarımı (${file.name})`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            });
          } catch (err) {
            console.error('KML dosya okuma hatası:', file.name, err);
          }
        }

        if (allItems.length === 0) {
          setBatchFeedback('Seçilen dosyalarda geçerli parsel verisi bulunamadı.');
          return;
        }

        await onBatchImportParcels(allItems);
        setIsBatchModalOpen(false);
        setBatchFiles([]);
        setBatchKmlText('');
        setImportNotification({
          type: 'success',
          message: `${batchFiles.length} adet dosyadan toplam ${allItems.length} adet parsel "${line}" hattına başarıyla aktarıldı.`,
        });
        return;
      }

      if (!batchKmlText.trim()) {
        setBatchFeedback('Lütfen KML veya GeoJSON dosyası seçin veya metin içeriğini yapıştırın.');
        return;
      }
      const parsed = parseKmlOrGeoJsonParcels(batchKmlText);
      if (parsed.length === 0) {
        setBatchFeedback('Geçerli bir KML veya GeoJSON parsel verisi bulunamadı.');
        return;
      }
      const newItems: RailwayParcel[] = parsed.map((p, idx) => ({
        id: `parsel-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        lineName: line,
        adaNo: p.adaNo || batchAdaNo || '101',
        parselNo: p.parselNo || String(idx + 1),
        il: p.il || batchIl || 'Eskişehir',
        ilce: p.ilce || batchIlce || 'Merkez',
        mahalleKoy: p.mahalleKoy || batchMahalle || '',
        alanM2: p.alanM2 || (Number(batchAreaM2) || 25000),
        malik: p.malik || 'TCDD İşletmesi Genel Müdürlüğü',
        nitelik: p.nitelik || 'Demiryolu Güzergahı',
        ownershipStatus: 'tcdd',
        coordinates: p.coordinates || [],
        notes: `${line} KML Aktarımı`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      await onBatchImportParcels(newItems);
      setIsBatchModalOpen(false);
      setBatchKmlText('');
      setBatchFiles([]);
      return;
    }

    // Text Mode: e.g. "146-1, 150-2, 160-3" or "146/1 150/2" or range "1-20"
    const text = batchParcelText.trim();
    if (!text) {
      setBatchFeedback('Lütfen eklenecek parsel numaralarını giriniz (Örn: 146-1, 150-2, 160-3).');
      return;
    }

    const itemsToAdd: RailwayParcel[] = [];
    const tokens = text.split(/[\n,;]+/).map((t) => t.trim()).filter(Boolean);

    let counter = 1;
    for (const tok of tokens) {
      // Check for Ada-Parsel format: "146-1" or "146/1"
      const dashMatch = tok.match(/^(\d+)\s*[-/]\s*(\d+)$/);
      // Check for range: "1-20"
      const rangeMatch = tok.match(/^(\d+)\s*\.\.\s*(\d+)$/);

      if (dashMatch) {
        const ada = dashMatch[1];
        const parsel = dashMatch[2];
        itemsToAdd.push({
          id: `parsel-${Date.now()}-${counter++}-${Math.random().toString(36).substring(2, 6)}`,
          lineName: line,
          adaNo: ada,
          parselNo: parsel,
          il: batchIl.trim() || 'Eskişehir',
          ilce: batchIlce.trim() || 'Merkez',
          mahalleKoy: batchMahalle.trim() || '',
          alanM2: Number(batchAreaM2) || 0,
          malik: 'TCDD İşletmesi Genel Müdürlüğü',
          ownershipStatus: 'tcdd',
          nitelik: 'Demiryolu Güzergahı',
          coordinates: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = parseInt(rangeMatch[2], 10);
        const min = Math.min(start, end);
        const max = Math.max(start, end);
        for (let num = min; num <= max; num++) {
          itemsToAdd.push({
            id: `parsel-${Date.now()}-${counter++}-${Math.random().toString(36).substring(2, 6)}`,
            lineName: line,
            adaNo: batchAdaNo.trim() || '101',
            parselNo: String(num),
            il: batchIl.trim() || 'Eskişehir',
            ilce: batchIlce.trim() || 'Merkez',
            mahalleKoy: batchMahalle.trim() || '',
            alanM2: Number(batchAreaM2) || 0,
            malik: 'TCDD İşletmesi Genel Müdürlüğü',
            ownershipStatus: 'tcdd',
            nitelik: 'Demiryolu Güzergahı',
            coordinates: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      } else {
        // Just a parcel number like "1", "2"
        const cleanNo = tok.replace(/parsel\s*/i, '').trim();
        itemsToAdd.push({
          id: `parsel-${Date.now()}-${counter++}-${Math.random().toString(36).substring(2, 6)}`,
          lineName: line,
          adaNo: batchAdaNo.trim() || '101',
          parselNo: cleanNo || String(counter),
          il: batchIl.trim() || 'Eskişehir',
          ilce: batchIlce.trim() || 'Merkez',
          mahalleKoy: batchMahalle.trim() || '',
          alanM2: Number(batchAreaM2) || 0,
          malik: 'TCDD İşletmesi Genel Müdürlüğü',
          ownershipStatus: 'tcdd',
          nitelik: 'Demiryolu Güzergahı',
          coordinates: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    if (itemsToAdd.length === 0) {
      setBatchFeedback('Girilen metinden parsel oluşturulamadı. Örn: 146-1, 150-2, 160-3');
      return;
    }

    await onBatchImportParcels(itemsToAdd);
    setIsBatchModalOpen(false);
  };

  const handleKmlFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);

    setBatchFiles((prev) => {
      const existing = new Set(prev.map((f) => `${f.name}_${f.size}`));
      const newOnly = fileArray.filter((f) => !existing.has(`${f.name}_${f.size}`));
      const combined = [...prev, ...newOnly];
      setBatchFeedback(`✓ Toplam ${combined.length} adet KML/GeoJSON dosyası eklendi. Aşağıdaki "Mıntıkaya Kaydet" butonu ile aktarabilirsiniz.`);
      return combined;
    });
    setBatchMode('kml');

    if (fileArray.length === 1 && batchFiles.length === 0) {
      try {
        const text = await fileArray[0].text();
        setBatchKmlText(text);
      } catch {}
    }
    e.target.value = '';
  };

  const handleRemoveBatchFile = (index: number) => {
    setBatchFiles((prev) => {
      const updated = prev.filter((_, idx) => idx !== index);
      if (updated.length === 0) {
        setBatchFeedback(null);
      } else {
        setBatchFeedback(`✓ Kalan ${updated.length} adet dosya aktarıma hazır.`);
      }
      return updated;
    });
  };

  const handleClearBatchFiles = () => {
    setBatchFiles([]);
    setBatchKmlText('');
    setBatchFeedback(null);
  };

  // Direct 1-Click Multi-File KML Import (from TKGM Parsel Sorgu)
  const handleDirectKmlFileUpload = async (filesOrFile: FileList | File[] | File, targetLine?: string) => {
    if (!filesOrFile) return;
    const files: File[] =
      filesOrFile instanceof File
        ? [filesOrFile]
        : Array.from(filesOrFile);

    if (files.length === 0) return;

    const defaultLine = targetLine || (selectedLineFilter !== 'all' ? selectedLineFilter : 'Enveriye - Konya Hattı');
    const allItems: RailwayParcel[] = [];

    for (let fIdx = 0; fIdx < files.length; fIdx++) {
      const file = files[fIdx];
      try {
        const content = await file.text();
        if (!content) continue;
        const parsed = parseKmlOrGeoJsonParcels(content);

        const nameMatch = file.name.match(/(\d+)[-_/](\d+)/);
        const nameAda = nameMatch ? nameMatch[1] : undefined;
        const nameParsel = nameMatch ? nameMatch[2] : undefined;

        parsed.forEach((p, idx) => {
          allItems.push({
            id: `parsel-${Date.now()}-${fIdx}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
            lineName: defaultLine,
            adaNo: p.adaNo && p.adaNo !== '101' ? p.adaNo : (nameAda || p.adaNo || '101'),
            parselNo: p.parselNo && p.parselNo !== '1' ? p.parselNo : (nameParsel || p.parselNo || String(fIdx + 1)),
            il: p.il || 'Eskişehir',
            ilce: p.ilce || 'Merkez',
            mahalleKoy: p.mahalleKoy || '',
            alanM2: p.alanM2 || 0,
            malik: p.malik || 'TCDD İşletmesi Genel Müdürlüğü',
            nitelik: p.nitelik || 'Demiryolu Güzergahı',
            ownershipStatus: 'tcdd',
            coordinates: p.coordinates || [],
            notes: p.notes || `TKGM KML (${file.name})`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        });
      } catch (err) {
        console.error('KML okuma hatası:', file.name, err);
      }
    }

    if (allItems.length === 0) {
      setImportNotification({
        type: 'error',
        message: 'Seçilen dosyalarda geçerli parsel veya koordinat verisi bulunamadı.',
      });
      return;
    }

    await onBatchImportParcels(allItems);
    setImportNotification({
      type: 'success',
      message: `${files.length} adet dosyadan toplam ${allItems.length} adet parsel "${defaultLine}" hattına başarıyla aktarıldı.`,
    });
  };

  const triggerGlobalKmlSelect = (targetLine?: string) => {
    setTargetImportLine(targetLine || null);
    if (globalKmlInputRef.current) {
      globalKmlInputRef.current.value = '';
      globalKmlInputRef.current.click();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs select-none overflow-hidden">
      <div
        id="railway-parcel-modal"
        className="bg-white border border-slate-200 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col h-[88vh] max-h-[88vh] min-h-0 text-slate-800 animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
      >
        {/* Top Institutional Header */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 border border-indigo-400 flex items-center justify-center text-white shadow-xs">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>TCDD Tapu Kadastro Portalı</span>
                <span className="bg-indigo-500/30 text-indigo-200 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-400/30">
                  Demiryolu Kamulaştırma Sahası
                </span>
              </h2>
              <p className="text-[11px] text-slate-300">
                Mıntıka ve hat bazlı ada/parsel listesi, harita entegrasyonu ve KML aktarımı
              </p>
            </div>
          </div>

          <button
            id="close-parcel-modal-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Bar (Search, Line Filter & Action Buttons) */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between flex-wrap gap-2.5 shrink-0">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Ada-Parsel (Örn: 146-1) veya Mıntıka ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-8 py-1.5 text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Line Filter */}
          <select
            value={selectedLineFilter}
            onChange={(e) => setSelectedLineFilter(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="all">Tüm Mıntıkalar / Hatlar</option>
            {allAvailableLines.map((line) => (
              <option key={line} value={line}>
                {line}
              </option>
            ))}
          </select>

          {/* Action Buttons */}
          {canEdit && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => triggerGlobalKmlSelect()}
                className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xs transition-colors cursor-pointer"
                title="TKGM Parsel Sorgu'dan indirdiğiniz 1 veya birden fazla KML dosyasını (Ctrl+A ile çoklu) seçip tek seferde yükleyin"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>📂 KML İçe Aktar (Toplu Dosya Seç)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setBatchFeedback(null);
                  setBatchFiles([]);
                  setBatchMode('kml');
                  setIsBatchModalOpen(true);
                }}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xs transition-colors cursor-pointer"
                title="Tek seferde birden fazla parsel KML dosyasını (Ctrl+A ile çoklu) veya metin listesini toplu yükleyin"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>⚡ Toplu Yükle (KML / Metin)</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenAdd()}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Yeni Parsel Ekle</span>
              </button>
            </div>
          )}
        </div>

        {/* Hidden Global KML File Input (Supports Multiple File Selection with Ctrl+A) */}
        <input
          ref={globalKmlInputRef}
          type="file"
          multiple
          accept=".kml,.geojson,.json"
          onChange={(e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
              handleDirectKmlFileUpload(files, targetImportLine || undefined);
            }
          }}
          className="hidden"
        />

        {/* Notification Toast Banner */}
        {importNotification && (
          <div
            className={`px-5 py-2.5 flex items-center justify-between text-xs font-bold border-b ${
              importNotification.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {importNotification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{importNotification.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setImportNotification(null)}
              className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Bulk Action & Selection Toolbar */}
        {filteredParcels.length > 0 && canDelete && (
          <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex items-center justify-between flex-wrap gap-2 text-xs shrink-0">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filteredParcels.length > 0 && filteredParcels.every((p) => selectedParcelIds.has(p.id))}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    const next = new Set(selectedParcelIds);
                    if (checked) {
                      filteredParcels.forEach((p) => next.add(p.id));
                    } else {
                      filteredParcels.forEach((p) => next.delete(p.id));
                    }
                    setSelectedParcelIds(next);
                  }}
                  className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
                <span>Tümünü Seç ({filteredParcels.length})</span>
              </label>

              {selectedParcelIds.size > 0 && (
                <span className="bg-indigo-100 text-indigo-900 border border-indigo-200 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                  {selectedParcelIds.size} parsel seçildi
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {selectedParcelIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setIsBulkDeleteModalOpen(true)}
                  className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Seçilenleri Sil ({selectedParcelIds.size})</span>
                </button>
              )}

              {parcels.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsClearAllModalOpen(true)}
                  className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  title="Sistemdeki tüm kadastro parsellerini kalıcı olarak temizler"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Tüm Parselleri Temizle</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Main List Body: Clean Template with Prominent Draggable Scrollbar & Quick Controls */}
        <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
          <div
            ref={listContainerRef}
            className="flex-1 overflow-y-auto min-h-0 prominent-scrollbar p-3 sm:p-5 bg-slate-100/60 flex flex-col gap-4"
          >
          {Object.keys(groupedParcels).length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center shadow-xs">
              <Landmark className="w-12 h-12 text-slate-300 mb-3" />
              <h3 className="text-base font-bold text-slate-800">Kayıtlı Parsel Bulunamadı</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
                {searchQuery || selectedLineFilter !== 'all'
                  ? 'Arama kriterlerinize uygun parsel bulunamadı.'
                  : 'Sistemde henüz kayıtlı kadastro parseli yok. "KML İçe Aktar", "Yeni Parsel Ekle" veya "⚡ Toplu Yükle" butonlarıyla ekleyebilirsiniz.'}
              </p>
              {canEdit && (
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <button
                    type="button"
                    onClick={() => triggerGlobalKmlSelect()}
                    className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-xs transition-colors cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>📥 TKGM KML Dosyası Yükle</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenAdd()}
                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>İlk Parseli Ekle</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBatchFeedback(null);
                      setBatchFiles([]);
                      setBatchMode('kml');
                      setIsBatchModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-xs transition-colors cursor-pointer"
                  >
                    <Zap className="w-4 h-4" />
                    <span>⚡ Toplu Yükle (KML / Metin)</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            Object.entries(groupedParcels).map(([lineName, items]) => {
              return (
                <div
                  key={lineName}
                  className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col min-h-0"
                >
                  {/* Line Header (Örn: Enveriye - Konya Hattı) */}
                  <div className="bg-slate-50 px-4 sm:px-5 py-3 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2 sticky top-0 z-10 shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">🛤️</span>
                      <h3 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                        {lineName}
                      </h3>
                      <span className="bg-indigo-100 text-indigo-900 border border-indigo-200 text-[11px] font-bold px-2 py-0.5 rounded-full">
                        {items.length} Parsel
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => triggerGlobalKmlSelect(lineName)}
                          className="flex items-center gap-1 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-900 text-xs font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                          title="TKGM Parsel Sorgu'dan aldığınız KML dosyasını doğrudan bu hatta aktarın"
                        >
                          <Upload className="w-3.5 h-3.5 text-sky-600" />
                          <span>KML İçe Aktar</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDownloadGroupKml(lineName, items)}
                        className="flex items-center gap-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                        title="Bu hatta ait tüm parselleri KML olarak indir"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-600" />
                        <span>KML İndir</span>
                      </button>

                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => handleOpenAdd(lineName)}
                          className="flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 text-xs font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                          title="Bu hatta yeni parsel ekle"
                        >
                          <Plus className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Ekle</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Full List of Rows: 146-1 | Haritada Göster | Düzenle | KML Aktar */}
                  <div className="divide-y divide-slate-100">
                    {items.map((parcel) => {
                      const displayCode = `${parcel.adaNo}-${parcel.parselNo}`;
                      const hasDetails = parcel.mahalleKoy || parcel.ilce || parcel.alanM2;

                      return (
                        <div
                          key={parcel.id}
                          className="px-4 sm:px-5 py-3 hover:bg-slate-50/80 transition-colors flex items-center justify-between flex-wrap gap-3"
                        >
                          {/* Left: Checkbox + Ada-Parsel (146-1) */}
                          <div className="flex items-center gap-3">
                            {canDelete && (
                              <input
                                type="checkbox"
                                checked={selectedParcelIds.has(parcel.id)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  const next = new Set(selectedParcelIds);
                                  if (next.has(parcel.id)) next.delete(parcel.id);
                                  else next.add(parcel.id);
                                  setSelectedParcelIds(next);
                                }}
                                className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer shrink-0"
                                title="Bu parseli seç"
                              />
                            )}
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                                  {displayCode}
                                </span>
                                {parcel.coordinates && parcel.coordinates.length >= 3 && (
                                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-1.5 py-0.2 rounded-md">
                                    ✓ KML
                                  </span>
                                )}
                              </div>
                              {hasDetails && (
                                <span className="text-[11px] text-slate-500 font-medium">
                                  {[
                                    parcel.mahalleKoy || parcel.ilce ? `${parcel.mahalleKoy || ''} ${parcel.ilce ? '(' + parcel.ilce + ')' : ''}`.trim() : null,
                                    parcel.alanM2 ? `${parcel.alanM2.toLocaleString('tr-TR')} m²` : null,
                                    parcel.startKm ? `KM ${parcel.startKm}` : null,
                                  ]
                                    .filter(Boolean)
                                    .join(' • ')}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Right: Action Buttons */}
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            {/* Haritada Göster */}
                            <button
                              type="button"
                              onClick={() => {
                                onFocusParcelOnMap(parcel);
                                onClose();
                              }}
                              className="flex items-center gap-1.5 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                              title="Parseli haritada göster ve odaklan"
                            >
                              <MapPin className="w-3.5 h-3.5 text-sky-600" />
                              <span>Haritada Göster</span>
                            </button>

                            {/* Düzenle */}
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(parcel)}
                                className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                                title="Parsel bilgilerini düzenle"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                                <span>Düzenle</span>
                              </button>
                            )}

                            {/* KML İçe Aktar (Dosya Eki) */}
                            {canEdit && (
                              <label
                                className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer shadow-2xs"
                                title="Bu parsele TKGM Parsel Sorgu'dan aldığınız KML dosyasını ekleyin"
                              >
                                <Upload className="w-3.5 h-3.5 text-amber-700" />
                                <span>KML İçe Aktar</span>
                                <input
                                  type="file"
                                  accept=".kml,.geojson,.json"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      handleAttachKmlToParcel(parcel, file);
                                      e.target.value = '';
                                    }
                                  }}
                                  className="hidden"
                                />
                              </label>
                            )}

                            {/* KML Aktar (Dışa Aktar) */}
                            <button
                              type="button"
                              onClick={() => handleDownloadSingleKml(parcel)}
                              className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                              title="Bu parselin KML dosyasını indir"
                            >
                              <Download className="w-3.5 h-3.5 text-emerald-600" />
                              <span>KML Aktar</span>
                            </button>

                            {/* Delete (Authorized) */}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => setParcelToDelete(parcel)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Parseli Sil"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Group Footer: "Tümünü Göster" Button */}
                  <div className="bg-slate-50/95 backdrop-blur-xs px-4 py-2.5 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2 sticky bottom-0 z-10">
                    <span className="text-[11px] font-mono font-bold text-slate-500">
                      {items.length} parsel listeleniyor
                    </span>
                    <button
                      type="button"
                      onClick={() => handleShowAllOnMap(items)}
                      className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-950 border border-indigo-200 text-xs font-bold px-5 py-1.5 rounded-xl shadow-2xs transition-all cursor-pointer hover:shadow-xs"
                    >
                      <Globe className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{lineName} Tümünü Göster</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
          </div>

          {/* Hareket Çubuğu / Hızlı Kaydırma Butonları (Floating Up/Down Scroll Controls) */}
          <div
            className="absolute right-4 bottom-4 z-20 flex flex-col items-center bg-white/95 backdrop-blur-md border border-slate-300 shadow-xl rounded-2xl p-1 gap-1 text-slate-700 select-none"
            title="Aşağı / Yukarı Hızlı Hareket Çubuğu"
          >
            <button
              type="button"
              onClick={handleScrollToTop}
              className="p-2 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all cursor-pointer group flex items-center justify-center"
              title="En Başa Dön (Yukarı)"
            >
              <ArrowUp className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
            </button>
            <div className="w-4 h-[1px] bg-slate-200" />
            <button
              type="button"
              onClick={handleScrollToBottom}
              className="p-2 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all cursor-pointer group flex items-center justify-center"
              title="En Alta İn (Aşağı)"
            >
              <ArrowDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
            </button>
          </div>
        </div>

        {/* Bottom Status Bar */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-2.5 flex items-center justify-between text-xs text-slate-600 shrink-0">
          <div className="flex items-center gap-3">
            <span>
              Toplam Parsel: <strong className="text-slate-900">{totalStats.count}</strong>
            </span>
            <span className="hidden sm:inline text-slate-300">|</span>
            <span className="hidden sm:inline">
              Toplam Alan: <strong className="text-indigo-700">{totalStats.areaFormatted.m2Text}</strong> ({totalStats.areaFormatted.donumText})
            </span>
          </div>

          {filteredParcels.length > 0 && (
            <button
              type="button"
              onClick={() => handleShowAllOnMap(filteredParcels)}
              className="text-xs font-bold text-indigo-700 hover:text-indigo-900 hover:underline cursor-pointer"
            >
              🌐 Tümünü Haritada Gör
            </button>
          )}
        </div>
      </div>

      {/* MODAL: TEK PARSEL EKLE / DÜZENLE */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 bg-black/50 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-indigo-400" />
                <span>{editingParcel ? 'Parseli Düzenle' : 'Yeni Parsel Ekle'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="p-5 flex flex-col gap-3.5 text-xs text-slate-800">
              {formError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded-lg flex items-center gap-2 font-medium">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Mıntıka / Hat */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Mıntıka / Demiryolu Hattı Adı *
                </label>
                <input
                  type="text"
                  list="parcel-lines-datalist"
                  value={formData.lineName}
                  onChange={(e) => setFormData({ ...formData, lineName: e.target.value })}
                  placeholder="Örn: Enveriye - Konya Hattı"
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-bold text-indigo-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                />
                <datalist id="parcel-lines-datalist">
                  {allAvailableLines.map((l) => (
                    <option key={l} value={l} />
                  ))}
                </datalist>
              </div>

              {/* KML Dosyası Ekleme (Dosya Eki) */}
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-amber-700 shrink-0" />
                  <div>
                    <span className="text-[11px] font-bold text-amber-950 block">
                      TKGM KML Dosyası Ekle (Dosya Eki)
                    </span>
                    <span className="text-[10px] text-amber-800">
                      {formAttachmentName ? (
                        <span className="text-emerald-700 font-bold">✓ {formAttachmentName} yüklendi</span>
                      ) : (
                        'Parsel Sorgu KML dosyasını seçerek koordinat ve sınırları ekleyin.'
                      )}
                    </span>
                  </div>
                </div>

                <label className="cursor-pointer bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors shadow-2xs">
                  <span>{formAttachmentName ? 'Dosyayı Değiştir' : '📎 KML Dosyası Seç'}</span>
                  <input
                    type="file"
                    accept=".kml,.geojson,.json"
                    onChange={handleFormKmlFileSelect}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Ada & Parsel No */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-900 mb-1">
                    Ada No *
                  </label>
                  <input
                    type="text"
                    value={formData.adaNo}
                    onChange={(e) => setFormData({ ...formData, adaNo: e.target.value })}
                    placeholder="Örn: 146"
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-900 mb-1">
                    Parsel No *
                  </label>
                  <input
                    type="text"
                    value={formData.parselNo}
                    onChange={(e) => setFormData({ ...formData, parselNo: e.target.value })}
                    placeholder="Örn: 1"
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* İl, İlçe, Mahalle */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-1">İl</label>
                  <input
                    type="text"
                    value={formData.il}
                    onChange={(e) => setFormData({ ...formData, il: e.target.value })}
                    placeholder="İl"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-1">İlçe</label>
                  <input
                    type="text"
                    value={formData.ilce}
                    onChange={(e) => setFormData({ ...formData, ilce: e.target.value })}
                    placeholder="İlçe"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-1">Mahalle/Köy</label>
                  <input
                    type="text"
                    value={formData.mahalleKoy}
                    onChange={(e) => setFormData({ ...formData, mahalleKoy: e.target.value })}
                    placeholder="Mahalle"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                  />
                </div>
              </div>

              {/* Alan m² & KM */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Alan (m²)</label>
                  <input
                    type="number"
                    value={formData.alanM2}
                    onChange={(e) => setFormData({ ...formData, alanM2: e.target.value })}
                    placeholder="Örn: 28500"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">KM Bilgisi (Opsiyonel)</label>
                  <input
                    type="text"
                    value={formData.startKm}
                    onChange={(e) => setFormData({ ...formData, startKm: e.target.value })}
                    placeholder="Örn: 142+250"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-900"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingParcel ? 'Değişiklikleri Kaydet' : 'Parseli Kaydet'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TOPLU YÜKLE (KML / METİN) */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 bg-black/50 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-emerald-800 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-300" />
                <span>⚡ Toplu Parsel Yükleme ve Sıralama</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(false)}
                className="text-emerald-200 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 text-xs text-slate-800">
              {batchFeedback && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 p-2.5 rounded-lg flex items-center gap-2 font-medium">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{batchFeedback}</span>
                </div>
              )}

              {/* Mode Toggle */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setBatchMode('text')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    batchMode === 'text' ? 'bg-white text-emerald-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📝 Metin / Parsel Listesi (146-1, 150-2...)
                </button>
                <button
                  type="button"
                  onClick={() => setBatchMode('kml')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    batchMode === 'kml' ? 'bg-white text-emerald-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📁 KML / GeoJSON Dosyası
                </button>
              </div>

              {/* Line Name */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Mıntıka / Demiryolu Hattı Adı *
                </label>
                <input
                  type="text"
                  list="parcel-lines-datalist"
                  value={batchLineName}
                  onChange={(e) => setBatchLineName(e.target.value)}
                  placeholder="Örn: Enveriye - Konya Hattı"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-bold text-emerald-950 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {batchMode === 'text' ? (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-900 mb-1">
                      Parsel Numaraları (Virgülle veya Satır Satır) *
                    </label>
                    <textarea
                      rows={3}
                      value={batchParcelText}
                      onChange={(e) => setBatchParcelText(e.target.value)}
                      placeholder="Örn: 146-1, 150-2, 160-3 veya 1..20"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      💡 <strong>146-1, 150-2, 160-3</strong> şeklinde veya <strong>1..20</strong> aralığında yazabilirsiniz.
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 mb-1">Varsayılan Ada</label>
                      <input
                        type="text"
                        value={batchAdaNo}
                        onChange={(e) => setBatchAdaNo(e.target.value)}
                        placeholder="Örn: 101"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 mb-1">İl / İlçe</label>
                      <input
                        type="text"
                        value={`${batchIl} / ${batchIlce}`}
                        onChange={(e) => {
                          const parts = e.target.value.split('/');
                          setBatchIl(parts[0]?.trim() || '');
                          setBatchIlce(parts[1]?.trim() || '');
                        }}
                        placeholder="Eskişehir / Merkez"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 mb-1">Birim Alan (m²)</label>
                      <input
                        type="number"
                        value={batchAreaM2}
                        onChange={(e) => setBatchAreaM2(e.target.value)}
                        placeholder="Örn: 28500"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="block text-[11px] font-bold text-slate-800">
                        Toplu KML / GeoJSON Dosyaları Seç
                      </span>
                      <span className="text-[10px] text-slate-500">
                        TKGM Parsel Sorgu'dan indirdiğiniz birden fazla KML dosyasını tek seferde seçebilirsiniz.
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => batchFileInputRef.current?.click()}
                      className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs shrink-0"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Dosyaları Seç (Çoklu)</span>
                    </button>
                    <input
                      ref={batchFileInputRef}
                      type="file"
                      multiple
                      accept=".kml,.geojson,.json"
                      onChange={handleKmlFileUpload}
                      className="hidden"
                    />
                  </div>

                  {/* Drag and Drop Zone */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingBatch(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setIsDraggingBatch(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingBatch(false);
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        const droppedFiles = Array.from(e.dataTransfer.files).filter(
                          (f) => f.name.endsWith('.kml') || f.name.endsWith('.geojson') || f.name.endsWith('.json')
                        );
                        if (droppedFiles.length > 0) {
                          setBatchFiles((prev) => {
                            const existing = new Set(prev.map((f) => `${f.name}_${f.size}`));
                            const newOnly = droppedFiles.filter((f) => !existing.has(`${f.name}_${f.size}`));
                            const combined = [...prev, ...newOnly];
                            setBatchFeedback(`✓ ${droppedFiles.length} adet dosya sürüklendi. Toplam ${combined.length} dosya.`);
                            return combined;
                          });
                        }
                      }
                    }}
                    onClick={() => batchFileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                      isDraggingBatch
                        ? 'border-emerald-500 bg-emerald-50 scale-[1.01]'
                        : 'border-slate-300 hover:border-emerald-500 bg-slate-50/60 hover:bg-emerald-50/20'
                    }`}
                  >
                    <Upload className="w-7 h-7 mx-auto text-emerald-600 mb-1.5" />
                    <p className="text-xs font-bold text-slate-800">
                      KML / GeoJSON dosyalarını buraya sürükleyin veya tıklayarak çoklu seçin
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      💡 Dosya seçim penceresinde <strong>Ctrl + A</strong> tuşlarına basarak veya <strong>Shift</strong> ile tüm parselleri çoklu seçebilirsiniz.
                    </p>
                  </div>

                  {/* Selected Files List */}
                  {batchFiles.length > 0 && (
                    <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-emerald-950 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Seçilen Dosyalar ({batchFiles.length} adet KML)</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => batchFileInputRef.current?.click()}
                            className="text-[10px] text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer"
                          >
                            + Daha Fazla Ekle
                          </button>
                          <button
                            type="button"
                            onClick={handleClearBatchFiles}
                            className="text-[10px] text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer"
                          >
                            Temizle
                          </button>
                        </div>
                      </div>

                      <div className="max-h-36 overflow-y-auto space-y-1 prominent-scrollbar pr-1">
                        {batchFiles.map((f, fIdx) => (
                          <div
                            key={fIdx}
                            className="flex items-center justify-between bg-white px-2.5 py-1 rounded-lg border border-emerald-100 text-[11px]"
                          >
                            <span className="font-mono text-slate-700 truncate max-w-[360px]">
                              {f.name} ({(f.size / 1024).toFixed(1)} KB)
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveBatchFile(fIdx)}
                              className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                              title="Dosyayı kaldır"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Optional Manual KML Paste Accordion */}
                  <details className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <summary className="cursor-pointer font-semibold text-slate-700 select-none">
                      Metin yapıştırma seçeneği (KML içeriğini doğrudan yapıştırmak için tıklayın)
                    </summary>
                    <textarea
                      rows={3}
                      value={batchKmlText}
                      onChange={(e) => setBatchKmlText(e.target.value)}
                      placeholder="KML dosyasını kopyalayıp buraya yapıştırabilirsiniz..."
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono text-xs text-slate-800 focus:bg-white mt-2"
                    />
                  </details>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  onClick={handleSaveBatch}
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>"{batchLineName}" Mıntıkasına Kaydet</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL (SINGLE PARCEL) */}
      <DeleteConfirmModal
        isOpen={!!parcelToDelete}
        title="Parseli Sil"
        itemName={parcelToDelete ? `Ada ${parcelToDelete.adaNo} / Parsel ${parcelToDelete.parselNo} (${parcelToDelete.lineName || 'Demiryolu Parseli'})` : ''}
        description="Bu kamulaştırma parseli sistemden kalıcı olarak silinecektir."
        confirmText="Evet, Parseli Sil"
        cancelText="Vazgeç"
        isDeleting={isDeleting}
        onConfirm={async () => {
          if (!parcelToDelete) return;
          setIsDeleting(true);
          try {
            await onDeleteParcel(parcelToDelete.id);
            setParcelToDelete(null);
          } finally {
            setIsDeleting(false);
          }
        }}
        onClose={() => setParcelToDelete(null)}
      />

      {/* BULK DELETE CONFIRMATION MODAL */}
      <DeleteConfirmModal
        isOpen={isBulkDeleteModalOpen}
        title="Seçilen Parselleri Sil"
        itemName={`${selectedParcelIds.size} adet kadastro parseli`}
        description="Seçilen tüm kadastro parselleri kalıcı olarak silinecek ve kara listeye alınacaktır. Bu işlem geri alınamaz."
        confirmText="Evet, Seçilenleri Sil"
        cancelText="Vazgeç"
        isDeleting={isBulkDeleting}
        onConfirm={async () => {
          setIsBulkDeleting(true);
          try {
            const ids = Array.from(selectedParcelIds);
            if (onBulkDeleteParcels) {
              await onBulkDeleteParcels(ids);
            } else {
              for (const id of ids) {
                await onDeleteParcel(id);
              }
            }
            setSelectedParcelIds(new Set());
            setIsBulkDeleteModalOpen(false);
          } finally {
            setIsBulkDeleting(false);
          }
        }}
        onClose={() => setIsBulkDeleteModalOpen(false)}
      />

      {/* CLEAR ALL PARCELS CONFIRMATION MODAL */}
      <DeleteConfirmModal
        isOpen={isClearAllModalOpen}
        title="Tüm Parselleri Temizle"
        itemName="Tüm Kadastro Parselleri"
        description="Sistemdeki kayıtlı tüm kadastro parselleri kalıcı olarak silinecektir. Bu işlem geri alınamaz."
        confirmText="Evet, Tümünü Temizle"
        cancelText="Vazgeç"
        isDeleting={isBulkDeleting}
        onConfirm={async () => {
          setIsBulkDeleting(true);
          try {
            if (onClearAllParcels) {
              await onClearAllParcels();
            } else {
              const allIds = parcels.map((p) => p.id);
              if (onBulkDeleteParcels) {
                await onBulkDeleteParcels(allIds);
              }
            }
            setSelectedParcelIds(new Set());
            setIsClearAllModalOpen(false);
          } finally {
            setIsBulkDeleting(false);
          }
        }}
        onClose={() => setIsClearAllModalOpen(false)}
      />
    </div>
  );
};
