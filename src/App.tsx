import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { RailwayPoint, RailwayPointCategory, FilterOptions } from './types.ts';
import {
  fetchRailwayPoints,
  saveNewPoint,
  updateExistingPoint,
  deletePointById,
  addPointNote,
  deletePointNote,
  addPointPhoto,
  deletePointPhoto,
  batchImportPoints,
  resetToSamplePoints,
  syncAllPhotosToServer,
} from './services/api.ts';
import { exportToJSON } from './utils/kmlParser.ts';
import { RailwayMap } from './components/RailwayMap.tsx';
import { PointDetailDrawer } from './components/PointDetailDrawer.tsx';
import { PointFormModal } from './components/PointFormModal.tsx';
import { PointAddChoiceModal } from './components/PointAddChoiceModal.tsx';
import { ImportExportModal } from './components/ImportExportModal.tsx';
import { MobileInstallModal } from './components/MobileInstallModal.tsx';
import { ReportModal } from './components/ReportModal.tsx';
import { WorkLogModal } from './components/WorkLogModal.tsx';
import { LiveKmIndicator } from './components/LiveKmIndicator.tsx';
import { calculateLiveRailwayKm, NearestKmResult } from './utils/liveRailwayKm.ts';
import { WorkLog } from './types.ts';
import { Header } from './components/Header.tsx';
import { PointListSidebar } from './components/PointListSidebar.tsx';
import { ColorPaletteTabBar } from './components/ColorPaletteTabBar.tsx';
import { DeleteConfirmModal } from './components/DeleteConfirmModal.tsx';
import { LoginModal } from './components/LoginModal.tsx';
import { LoginScreen } from './components/LoginScreen.tsx';
import { UserManagementModal } from './components/UserManagementModal.tsx';
import { MobileActionsDrawer } from './components/MobileActionsDrawer.tsx';
import { MobileBottomNav } from './components/MobileBottomNav.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { useAuth } from './context/AuthContext.tsx';
import {
  CategoryColorConfig,
  loadCategoryColors,
  saveCategoryColors,
  DEFAULT_CATEGORY_COLORS,
} from './utils/categoryColors.ts';
import { sortPointsByKm, upsertPointInKmOrder } from './utils/kmUtils.ts';
import { getStoredLines } from './utils/customLinesStorage.ts';
import { List, Map as MapIcon, Loader2, Plus, Wifi, Smartphone, X } from 'lucide-react';
import { TrainLoadingAnimation } from './components/TrainLoadingAnimation.tsx';
import { TrainTransitionOverlay } from './components/TrainTransitionOverlay.tsx';

export default function App() {
  const { user, isLoading: authLoading, canEdit, canDelete, isAdmin, canAddPoint } = useAuth();
  const [points, setPoints] = useState<RailwayPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedPoint, setSelectedPoint] = useState<RailwayPoint | null>(null);
  const [pointToDelete, setPointToDelete] = useState<RailwayPoint | null>(null);
  const [isDeletingPoint, setIsDeletingPoint] = useState<boolean>(false);

  // Category Colors Palette State (Makaslar kırmızı, KM mavi, Geçitler sarı, etc.)
  const [categoryColors, setCategoryColors] = useState<Record<RailwayPointCategory, CategoryColorConfig>>(loadCategoryColors);
  const [activeTab, setActiveTab] = useState<'map' | 'list' | 'palette'>('map');

  // Modals state
  const [isAddChoiceOpen, setIsAddChoiceOpen] = useState<boolean>(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [isUserMgmtOpen, setIsUserMgmtOpen] = useState<boolean>(false);
  const [editingPoint, setEditingPoint] = useState<RailwayPoint | null>(null);
  const [clickCoords, setClickCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [measureInitialPoint, setMeasureInitialPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [prevUser, setPrevUser] = useState<any>(user);
  const [isImportExportOpen, setIsImportExportOpen] = useState<boolean>(false);
  const [isMobileInstallOpen, setIsMobileInstallOpen] = useState<boolean>(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [workLogPoint, setWorkLogPoint] = useState<RailwayPoint | null>(null);
  
  // Live GPS KM State
  const [liveGpsCoords, setLiveGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [nearestRailwayKm, setNearestRailwayKm] = useState<NearestKmResult | null>(null);
  const [isLiveGpsActive, setIsLiveGpsActive] = useState<boolean>(false);
  const [isGpsLocating, setIsGpsLocating] = useState<boolean>(false);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallBannerDismissed, setIsInstallBannerDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('tcdd_install_banner_dismissed') === 'true';
    } catch {
      return false;
    }
  });

  // Map interaction mode
  const [isAddMode, setIsAddMode] = useState<boolean>(false);

  // Sidebar and mobile view
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState<boolean>(false);

  // Filters
  const [filters, setFilters] = useState<FilterOptions>({
    search: '',
    selectedLine: 'all',
    category: 'all',
  });

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Start measurement from a point
  const handleStartMeasure = (point: RailwayPoint) => {
    setMeasureInitialPoint({ lat: point.lat, lng: point.lng });
    setIsAddMode(false);
    if (viewMode === 'list') {
      setViewMode('map');
      setActiveTab('map');
    }
    showToast(`"${point.title}" üzerinden mesafe/metre ölçümü başlatıldı.`);
  };

  const lastRevisionRef = useRef<number>(0);
  const currentPointCountRef = useRef<number>(0);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Load points on mount
  const loadPoints = useCallback(async () => {
    try {
      const data = await fetchRailwayPoints();
      const sorted = sortPointsByKm(data);
      setPoints(sorted);
      currentPointCountRef.current = sorted.length;
      // If a point was selected, refresh its data reference
      setSelectedPoint((curr) => (curr ? sorted.find((p) => p.id === curr.id) || null : null));
    } catch (err) {
      console.error('Noktalar yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Manual refresh that keeps zoom, position, filters, and local data 100% intact
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      lastRevisionRef.current = 0;
      currentPointCountRef.current = -1;
      const data = await fetchRailwayPoints();
      const sorted = sortPointsByKm(data);
      setPoints(sorted);
      currentPointCountRef.current = sorted.length;
      setSelectedPoint((curr) => (curr ? sorted.find((p) => p.id === curr.id) || null : null));
      showToast(`Harita ve demiryolu noktaları güncellendi (${sorted.length} nokta KM sırasına göre hazır).`);
    } catch (err) {
      console.error('Yenileme hatası:', err);
      showToast('Güncelleme sırasında bir sorun oluştu, çevrimdışı veriler korunuyor.');
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  }, []);

  // Helper to notify other open tabs on this device immediately
  const broadcastLocalChange = useCallback(() => {
    try {
      broadcastChannelRef.current?.postMessage({ action: 'points_changed', timestamp: Date.now() });
    } catch {}
  }, []);

  useEffect(() => {
    if (!prevUser && user) {
      // Trigger cinematic diagonal train pass when entering the portal
      setIsTransitioning(true);
    }
    setPrevUser(user);
  }, [user, prevUser]);

  useEffect(() => {
    if (!user) return;
    loadPoints();

    // 1. Same-device multi-tab synchronization via BroadcastChannel
    try {
      const bc = new BroadcastChannel('tcdd_railway_points_channel');
      broadcastChannelRef.current = bc;
      bc.onmessage = () => {
        loadPoints();
      };
    } catch {
      // BroadcastChannel not supported in older browsers
    }

    // 2. Real-Time Server-Sent Events (SSE) Stream with Auto-Reconnect
    // Pushes updates from server to all connected devices in <100ms
    let eventSource: EventSource | null = null;
    let sseRetryTimer: any = null;

    const setupSSE = () => {
      try {
        if (eventSource) {
          eventSource.close();
        }
        eventSource = new EventSource('/api/points/stream');

        eventSource.addEventListener('points_changed', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            if (data && typeof data.revision === 'number') {
              if (data.revision !== lastRevisionRef.current) {
                lastRevisionRef.current = data.revision;
                loadPoints();
              }
            } else {
              loadPoints();
            }
          } catch {
            loadPoints();
          }
        });

        eventSource.addEventListener('connected', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            if (data && typeof data.revision === 'number') {
              lastRevisionRef.current = data.revision;
            }
          } catch {}
        });

        eventSource.onerror = () => {
          if (eventSource) eventSource.close();
          eventSource = null;
          clearTimeout(sseRetryTimer);
          sseRetryTimer = setTimeout(() => {
            setupSSE();
          }, 3000);
        };
      } catch (err) {
        clearTimeout(sseRetryTimer);
        sseRetryTimer = setTimeout(() => setupSSE(), 5000);
      }
    };

    setupSSE();

    // 3. Device lifecycle listeners (phone lock/unlock, tab switch, coming back online)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        lastRevisionRef.current = 0;
        currentPointCountRef.current = -1;
        setupSSE();
        loadPoints();
      }
    };
    const handleFocus = () => {
      loadPoints();
    };
    const handleOnline = () => {
      lastRevisionRef.current = 0;
      currentPointCountRef.current = -1;
      setupSSE();
      loadPoints();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);

    // 4. Fast lightweight version & count poll fallback (checks revision & point count every 3 seconds)
    // Ensures if any device has extra or missing points, it automatically synchronizes immediately!
    const versionPollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/points/version?_t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const info = await res.json();
          const serverRev = typeof info.revision === 'number' ? info.revision : 0;
          const serverCount = typeof info.count === 'number' ? info.count : -1;
          const revisionChanged = serverRev > 0 && serverRev !== lastRevisionRef.current;
          const countMismatch = serverCount >= 0 && serverCount !== currentPointCountRef.current;

          if (revisionChanged || countMismatch) {
            lastRevisionRef.current = serverRev;
            await loadPoints();
          }
        }
      } catch {
        // silent
      }
    }, 3000);

    // In background, automatically scan local database and sync photos to cloud server
    const autoSyncTimer = setTimeout(async () => {
      try {
        const syncRes = await syncAllPhotosToServer();
        if (syncRes.success && syncRes.photoCount > 0) {
          showToast(`☁️ ${syncRes.photoCount} adet saha fotoğrafı ana sunucuyla otomatik eşitlendi.`);
          loadPoints();
        }
      } catch {
        // silent
      }
    }, 2500);

    // Capture PWA install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      clearTimeout(autoSyncTimer);
      clearInterval(versionPollInterval);
      if (eventSource) eventSource.close();
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
        broadcastChannelRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [user, loadPoints]);

  // One-click JSON backup download (All photos, notes, KM coordinates)
  const handleExportJSON = async () => {
    try {
      await exportToJSON(points);
      showToast('Tüm fotoğraflar ve geçitler eksiksiz JSON dosyası olarak indirildi.');
    } catch {
      showToast('JSON indirme başlatıldı.');
    }
  };

  // One-click manual cloud sync
  const handleSyncPhotos = async () => {
    setIsRefreshing(true);
    showToast('Bilgisayarınızdaki fotoğraflar taranıyor ve sunucuya eşitleniyor...');
    try {
      const res = await syncAllPhotosToServer();
      if (res.success) {
        if (res.photoCount > 0) {
          showToast(`Başarılı! ${res.photoCount} adet fotoğraf ana sunucuya aktarıldı ve kalıcı olarak kaydedildi.`);
        } else {
          showToast('Fotoğraflarınız zaten ana sunucuyla tam eşitlenmiş durumda.');
        }
        await loadPoints();
      } else {
        showToast('Eşitleme tamamlandı.');
      }
    } catch {
      showToast('Eşitleme sırasında bir sorun oluştu.');
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleTriggerInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      showToast('Uygulama telefonunuza yükleniyor...');
    }
    setDeferredPrompt(null);
  };

  // Extract distinct lines for filter (combining points lines and user-added custom lines)
  const [customStoredLines, setCustomStoredLines] = useState<string[]>(() => getStoredLines());

  useEffect(() => {
    const handleLinesUpdate = () => {
      setCustomStoredLines(getStoredLines());
    };
    window.addEventListener('demiryolu_lines_updated', handleLinesUpdate);
    return () => window.removeEventListener('demiryolu_lines_updated', handleLinesUpdate);
  }, []);

  const availableLines = useMemo(() => {
    const lines = new Set<string>();
    points.forEach((p) => {
      if (p.lineName) lines.add(p.lineName);
    });
    customStoredLines.forEach((l) => {
      if (l) lines.add(l);
    });
    return Array.from(lines).sort();
  }, [points, customStoredLines]);

  // Point count per category for tab bar badges
  const pointCountsByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    points.forEach((p) => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    return counts;
  }, [points]);

  // Color Palette Handlers
  const handleUpdateCategoryColor = (category: RailwayPointCategory, bg: string, border: string, text: string) => {
    setCategoryColors((prev) => {
      const updated = {
        ...prev,
        [category]: {
          ...prev[category],
          bg,
          border,
          text,
        },
      };
      saveCategoryColors(updated);
      return updated;
    });
    const label = DEFAULT_CATEGORY_COLORS[category]?.label || category;
    showToast(`${label} rengi başarıyla güncellendi.`);
  };

  const handleResetColors = () => {
    setCategoryColors(DEFAULT_CATEGORY_COLORS);
    saveCategoryColors(DEFAULT_CATEGORY_COLORS);
    showToast('Tüm renkler varsayılan demiryolu renklerine sıfırlandı (Makaslar kırmızı, KM mavi, Geçitler sarı).');
  };

  // Sync tab bar selection
  const handleTabChange = (tab: 'map' | 'list' | 'palette') => {
    setActiveTab(tab);
    if (tab === 'map') {
      setViewMode('map');
    } else if (tab === 'list') {
      setViewMode('list');
    }
  };

  // Filtered points (sorted in ascending KM order)
  const filteredPoints = useMemo(() => {
    const list = points.filter((p) => {
      // Line filter
      if (filters.selectedLine !== 'all' && p.lineName !== filters.selectedLine) {
        return false;
      }
      // Category filter
      if (filters.category !== 'all' && p.category !== filters.category) {
        return false;
      }
      // Search filter
      if (filters.search.trim()) {
        const query = filters.search.toLowerCase().trim();
        const inTitle = p.title.toLowerCase().includes(query);
        const inKm = p.kmValue.toLowerCase().includes(query);
        const inLine = p.lineName.toLowerCase().includes(query);
        const inLocation = (p.locationDesc || '').toLowerCase().includes(query);
        const inDesc = p.description.toLowerCase().includes(query);
        const inNotes = p.notes?.some((n) => n.text.toLowerCase().includes(query) || n.author.toLowerCase().includes(query));

        if (!inTitle && !inKm && !inLine && !inLocation && !inDesc && !inNotes) {
          return false;
        }
      }
      return true;
    });
    return sortPointsByKm(list);
  }, [points, filters]);

  // Handle Map click to add
  const handleMapClickAdd = (lat: number, lng: number) => {
    if (!canAddPoint) {
      showToast('Haritaya yeni nokta ekleme yetkisi yalnızca Sistem Yöneticisine aittir.');
      return;
    }
    setEditingPoint(null);
    setClickCoords({ lat, lng });
    setIsAddMode(false);
    setIsFormModalOpen(true);
    showToast(`📍 Haritadan konum alındı (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
  };

  // Open add point choices modal (Allows choosing 'Haritadan Seç', 'GPS Konumunu Al', or 'Formu Aç')
  const handleOpenAddModal = () => {
    if (!canAddPoint) {
      showToast('Yeni nokta ekleme yetkisi yalnızca Sistem Yöneticisine aittir. Saha personeli nokta ekleyemez.');
      return;
    }
    setIsAddChoiceOpen(true);
  };

  // Choice 1: Haritadan Seç ve Otomatik Konum Al
  const handleStartMapPick = () => {
    setIsAddChoiceOpen(false);
    setIsFormModalOpen(false);
    setEditingPoint(null);
    if (viewMode === 'list') {
      setViewMode('map');
      setActiveTab('map');
    }
    setIsAddMode(true);
    showToast('📍 Haritada eklemek istediğiniz demiryolu konumuna dokunun.');
  };

  // Choice 2: Canlı GPS Konumunu Al ve Formu Aç
  const handleUseGpsDirect = () => {
    setIsAddChoiceOpen(false);
    if (!navigator.geolocation) {
      showToast('Cihazınızda GPS konum servisi bulunamadı.');
      handleOpenAddModalDirect();
      return;
    }
    showToast('📡 Canlı GPS koordinatları alınıyor...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setEditingPoint(null);
        setClickCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setIsAddMode(false);
        setIsFormModalOpen(true);
        showToast('📍 Mevcut GPS konumunuz forma otomatik aktarıldı.');
      },
      (err) => {
        showToast('GPS konumu alınamadı: ' + err.message);
        handleOpenAddModalDirect();
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Choice 3: Formu doğrudan aç (Manuel giriş için)
  const handleOpenAddModalDirect = () => {
    if (!canAddPoint) {
      showToast('Yeni nokta ekleme yetkisi yalnızca Sistem Yöneticisine aittir.');
      return;
    }
    setIsAddChoiceOpen(false);
    setEditingPoint(null);
    setClickCoords(null);
    setIsFormModalOpen(true);
  };

  // Open edit modal
  const handleOpenEdit = (point: RailwayPoint) => {
    if (!isAdmin) {
      showToast('Nokta bilgilerini düzenleme yetkisi yalnızca Sistem Yöneticisine aittir.');
      return;
    }
    setEditingPoint(point);
    setClickCoords(null);
    setIsFormModalOpen(true);
  };

  // Save point (create or edit) - automatically slots into exact KM ascending position
  const handleSavePoint = async (data: any) => {
    if (!canAddPoint) {
      showToast('Nokta ekleme ve düzenleme yetkisi yalnızca Sistem Yöneticisine aittir.');
      return;
    }
    if (editingPoint) {
      const updated = await updateExistingPoint(data);
      setPoints((prev) => upsertPointInKmOrder(prev, updated));
      setSelectedPoint(updated);
      broadcastLocalChange();
      showToast('Nokta güncellendi ve KM sırasına yerleştirildi.');
    } else {
      const created = await saveNewPoint(data);
      setPoints((prev) => upsertPointInKmOrder(prev, created));
      setSelectedPoint(created);
      broadcastLocalChange();
      showToast('Yeni nokta eklendi ve KM sırasına yerleştirildi.');
    }
  };

  // Delete point
  const handleDeletePoint = async (pointId: string) => {
    if (!canDelete) {
      showToast('Demiryolu noktası silme yetkisi sadece Yöneticidedir.');
      return;
    }
    const success = await deletePointById(pointId);
    if (success) {
      setPoints((prev) => prev.filter((p) => p.id !== pointId));
      if (selectedPoint?.id === pointId) {
        setSelectedPoint(null);
      }
      broadcastLocalChange();
      showToast('Demiryolu noktası başarıyla silindi.');
    }
  };

  // Add Note
  const handleAddNote = async (pointId: string, text: string, author: string) => {
    const newNote = await addPointNote(pointId, text, author);
    if (newNote) {
      setPoints((prev) =>
        prev.map((p) => {
          if (p.id === pointId) {
            const updatedNotes = [newNote, ...(p.notes || [])];
            return { ...p, notes: updatedNotes, updatedAt: new Date().toISOString() };
          }
          return p;
        })
      );
      setSelectedPoint((prev) => {
        if (prev && prev.id === pointId) {
          return { ...prev, notes: [newNote, ...(prev.notes || [])] };
        }
        return prev;
      });
      showToast('Saha notu kaydedildi.');
    }
  };

  // Delete Note
  const handleDeleteNote = async (pointId: string, noteId: string) => {
    const success = await deletePointNote(pointId, noteId);
    if (success) {
      setPoints((prev) =>
        prev.map((p) => {
          if (p.id === pointId) {
            return {
              ...p,
              notes: (p.notes || []).filter((n) => n.id !== noteId),
            };
          }
          return p;
        })
      );
      setSelectedPoint((prev) => {
        if (prev && prev.id === pointId) {
          return {
            ...prev,
            notes: (prev.notes || []).filter((n) => n.id !== noteId),
          };
        }
        return prev;
      });
      showToast('Not silindi.');
    }
  };

  // Add Photo
  const handleAddPhoto = async (pointId: string, dataUrl: string, caption: string) => {
    const newPhoto = await addPointPhoto(pointId, dataUrl, caption);
    if (newPhoto) {
      setPoints((prev) =>
        prev.map((p) => {
          if (p.id === pointId) {
            const existingPhotos = (p.photos || []).filter((ph) => ph.id !== newPhoto.id);
            const updatedPhotos = [newPhoto, ...existingPhotos];
            return { ...p, photos: updatedPhotos, updatedAt: new Date().toISOString() };
          }
          return p;
        })
      );
      setSelectedPoint((prev) => {
        if (prev && prev.id === pointId) {
          const existingPhotos = (prev.photos || []).filter((ph) => ph.id !== newPhoto.id);
          return { ...prev, photos: [newPhoto, ...existingPhotos] };
        }
        return prev;
      });
      showToast('Fotoğraf başarıyla kaydedildi.');
    }
  };

  // Delete Photo
  const handleDeletePhoto = async (pointId: string, photoId: string) => {
    const success = await deletePointPhoto(pointId, photoId);
    if (success) {
      setPoints((prev) =>
        prev.map((p) => {
          if (p.id === pointId) {
            return {
              ...p,
              photos: (p.photos || []).filter((ph) => ph.id !== photoId),
              updatedAt: new Date().toISOString(),
            };
          }
          return p;
        })
      );
      setSelectedPoint((prev) => {
        if (prev && prev.id === pointId) {
          return {
            ...prev,
            photos: (prev.photos || []).filter((ph) => ph.id !== photoId),
            updatedAt: new Date().toISOString(),
          };
        }
        return prev;
      });
      showToast('Fotoğraf silindi.');
    }
  };

  // Add / Update WorkLog for a point
  const handleSaveWorkLog = async (pointId: string, newLog: WorkLog) => {
    const pt = points.find((p) => p.id === pointId);
    if (!pt) return;
    const currentLogs = pt.workLogs || [];
    const updatedLogs = [newLog, ...currentLogs.filter((l) => l.id !== newLog.id)];
    const updatedPoint: RailwayPoint = {
      ...pt,
      workLogs: updatedLogs,
      updatedAt: new Date().toISOString(),
    };
    await updateExistingPoint(updatedPoint);
    setPoints((prev) => prev.map((p) => (p.id === pointId ? updatedPoint : p)));
    if (selectedPoint?.id === pointId) {
      setSelectedPoint(updatedPoint);
    }
    if (workLogPoint?.id === pointId) {
      setWorkLogPoint(updatedPoint);
    }
    broadcastLocalChange();
    showToast('Saha iş / bakım kaydı eklendi.');
  };

  // Delete WorkLog from a point
  const handleDeleteWorkLog = async (pointId: string, logId: string) => {
    const pt = points.find((p) => p.id === pointId);
    if (!pt) return;
    const updatedLogs = (pt.workLogs || []).filter((l) => l.id !== logId);
    const updatedPoint: RailwayPoint = {
      ...pt,
      workLogs: updatedLogs,
      updatedAt: new Date().toISOString(),
    };
    await updateExistingPoint(updatedPoint);
    setPoints((prev) => prev.map((p) => (p.id === pointId ? updatedPoint : p)));
    if (selectedPoint?.id === pointId) {
      setSelectedPoint(updatedPoint);
    }
    if (workLogPoint?.id === pointId) {
      setWorkLogPoint(updatedPoint);
    }
    broadcastLocalChange();
    showToast('İş kaydı silindi.');
  };

  // Live GPS KM Tracking Handler
  const handleRefreshGps = useCallback(() => {
    if (!navigator.geolocation) {
      showToast('Cihazınızda GPS / Konum servisi desteklenmiyor.');
      return;
    }

    setIsGpsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsGpsLocating(false);
        setIsLiveGpsActive(true);
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLiveGpsCoords(coords);
        const kmResult = calculateLiveRailwayKm(coords.lat, coords.lng, points);
        setNearestRailwayKm(kmResult);
        if (kmResult) {
          showToast(`Canlı Konum: KM ${kmResult.chainageKm} (${kmResult.distanceToRailMeters}m mesafe)`);
        }
      },
      (err) => {
        setIsGpsLocating(false);
        console.warn('GPS hatası:', err);
        showToast('Canlı GPS konumu alınamadı. Lütfen konum iznini kontrol edin.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  }, [points]);

  // Pan map to live GPS location
  const handlePanToMyGps = () => {
    if (liveGpsCoords) {
      // Temporarily create a synthetic point or pan map
      setSelectedPoint({
        id: 'live-gps-position',
        title: `Bulunduğunuz Konum (KM ${nearestRailwayKm?.chainageKm || '?'})`,
        kmValue: nearestRailwayKm?.chainageKm || '',
        lineName: nearestRailwayKm?.lineName || 'Eskişehir - Konya',
        category: 'other',
        lat: liveGpsCoords.lat,
        lng: liveGpsCoords.lng,
        description: `Canlı GPS Konumu: En yakın nokta ${nearestRailwayKm?.nearestPointTitle || '-'}`,
        notes: [],
        photos: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      if (viewMode === 'list') {
        setViewMode('map');
        setActiveTab('map');
      }
    } else {
      handleRefreshGps();
    }
  };

  // Batch import
  const handleImportSuccess = async (importedPoints: Partial<RailwayPoint>[], replaceAll: boolean) => {
    await batchImportPoints(importedPoints, replaceAll);
    await loadPoints();
    broadcastLocalChange();
    showToast(`${importedPoints.length} nokta KM sırasına göre tüm cihazlara aktarıldı.`);
  };

  // Reset / Clear All Points
  const handleResetSample = async () => {
    await resetToSamplePoints();
    await loadPoints();
    broadcastLocalChange();
    showToast('Tüm KM bilgileri ve noktalar başarıyla silindi.');
  };

  // If verifying session
  if (authLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-white flex-col font-sans">
        <TrainLoadingAnimation
          message="TCDD KM TAKİP Yükleniyor..."
          subMessage="712 Şefliği Saha Koordinasyon Portalı"
        />
      </div>
    );
  }

  // If not logged in, render the dedicated Login Gatekeeper screen
  if (!user) {
    return (
      <>
        <LoginScreen onSuccessToast={showToast} />
        {toastMessage && (
          <div
            id="toast-notification"
            className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-bottom-5 duration-200"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{toastMessage}</span>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 font-sans select-none">
      {/* Cinematic Diagonal Speed Train Transition Overlay */}
      <TrainTransitionOverlay
        isActive={isTransitioning}
        onAnimationComplete={() => setIsTransitioning(false)}
      />

      {/* Top Navigation & Filter Bar */}
      <Header
        filters={filters}
        setFilters={setFilters}
        availableLines={availableLines}
        totalPoints={points.length}
        filteredCount={filteredPoints.length}
        onOpenAddModal={handleOpenAddModal}
        onOpenImportExport={() => setIsImportExportOpen(true)}
        onOpenMobileInstall={() => setIsMobileInstallOpen(true)}
        onOpenReports={() => setIsReportModalOpen(true)}
        onToggleAddMode={() => setIsAddMode((prev) => !prev)}
        onOpenPalette={() => setActiveTab('palette')}
        isPaletteActive={activeTab === 'palette'}
        onRefresh={handleRefresh}
        onExportJSON={handleExportJSON}
        onSyncPhotos={handleSyncPhotos}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onOpenUserManagement={() => setIsUserMgmtOpen(true)}
        onOpenMobileActions={() => setIsMobileMenuOpen(true)}
        isMobileSearchOpen={isMobileSearchOpen}
        setIsMobileSearchOpen={setIsMobileSearchOpen}
        isRefreshing={isRefreshing}
        isAddMode={isAddMode}
        viewMode={viewMode}
        setViewMode={(mode) => {
          setViewMode(mode);
          setActiveTab(mode);
        }}
      />

      {/* Automatic Tab Bar with Color Palette & Categories (Makaslar: Kırmızı, KM: Mavi, Geçit: Sarı vb.) */}
      <ColorPaletteTabBar
        categoryColors={categoryColors}
        onUpdateColor={handleUpdateCategoryColor}
        onResetColors={handleResetColors}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        pointCountsByCategory={pointCountsByCategory}
      />

      {/* Main Content Area */}
      <main className="flex-1 relative flex overflow-hidden pb-14 sm:pb-0">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-slate-900 text-white">
            <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
            <p className="text-sm font-medium">Demiryolu KM Verileri Yükleniyor...</p>
          </div>
        ) : (
          <>
            {/* Sidebar with Point List (Desktop or Mobile List View) */}
            <div
              className={`${
                viewMode === 'list' ? 'flex flex-1' : 'hidden sm:flex'
              } h-full z-10`}
            >
              <PointListSidebar
                points={filteredPoints}
                selectedPoint={selectedPoint}
                categoryColors={categoryColors}
                onSelectPoint={(point) => {
                  setSelectedPoint(point);
                  if (viewMode === 'list') {
                    setViewMode('map');
                    setActiveTab('map');
                  }
                }}
                isOpen={isSidebarOpen}
                onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
                onDeletePoint={(point) => setPointToDelete(point)}
              />
            </div>

            {/* Map Container */}
            <div
              className={`flex-1 relative h-full ${
                viewMode === 'list' ? 'hidden sm:block' : 'block'
              }`}
            >
              <RailwayMap
                points={filteredPoints}
                selectedPoint={selectedPoint}
                categoryColors={categoryColors}
                onSelectPoint={(point) => setSelectedPoint(point)}
                onMapClickAdd={handleMapClickAdd}
                isAddMode={isAddMode}
                setIsAddMode={setIsAddMode}
                initialMeasurePoint={measureInitialPoint}
                onRefresh={handleRefresh}
                isRefreshing={isRefreshing}
              />

              {/* Toggle Sidebar Button for Desktop */}
              <button
                id="toggle-sidebar-btn"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                title={isSidebarOpen ? 'Listeyi Gizle' : 'Listeyi Göster'}
                className="hidden sm:flex absolute top-4 left-4 z-20 bg-white/95 backdrop-blur-sm text-slate-700 hover:text-slate-950 p-2.5 rounded-xl shadow-md border border-slate-200/80 transition-colors"
                style={{ left: isSidebarOpen ? 'calc(1rem + 2px)' : '1rem' }}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </>
        )}

        {/* Selected Point Bottom Drawer with ErrorBoundary protection */}
        <ErrorBoundary
          fallbackTitle="Nokta Detayı Yüklenemedi"
          onReset={() => setSelectedPoint(null)}
        >
          <PointDetailDrawer
            point={selectedPoint}
            categoryColors={categoryColors}
            onClose={() => setSelectedPoint(null)}
            onEdit={handleOpenEdit}
            onDelete={handleDeletePoint}
            onAddNote={handleAddNote}
            onDeleteNote={handleDeleteNote}
            onAddPhoto={handleAddPhoto}
            onDeletePhoto={handleDeletePhoto}
            onStartMeasure={handleStartMeasure}
            onOpenWorkLogs={(pt) => setWorkLogPoint(pt)}
            onPanToPoint={(pt) => {
              setSelectedPoint(pt);
              if (viewMode === 'list') {
                setViewMode('map');
                setActiveTab('map');
              }
            }}
          />
        </ErrorBoundary>
      </main>

      {/* Live Railway GPS KM Chainage Indicator */}
      <LiveKmIndicator
        gpsLocation={liveGpsCoords}
        nearestKm={nearestRailwayKm}
        isLocating={isGpsLocating}
        onRefreshGps={handleRefreshGps}
        onPanToMyLocation={handlePanToMyGps}
      />

      {/* Point Add Method Choice Modal */}
      <PointAddChoiceModal
        isOpen={isAddChoiceOpen}
        onClose={() => setIsAddChoiceOpen(false)}
        onPickOnMap={handleStartMapPick}
        onOpenManualForm={handleOpenAddModalDirect}
        onUseGpsDirect={handleUseGpsDirect}
      />

      {/* Add / Edit Point Modal */}
      <PointFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSave={handleSavePoint}
        editingPoint={editingPoint}
        initialCoords={clickCoords}
        onDelete={handleDeletePoint}
        allExistingLines={availableLines}
        onPickOnMap={() => {
          setIsFormModalOpen(false);
          if (viewMode === 'list') {
            setViewMode('map');
            setActiveTab('map');
          }
          setIsAddMode(true);
          showToast('📍 Haritada istediğiniz konuma dokunun, koordinatlar otomatik forma doldurulacaktır.');
        }}
      />

      {/* Import / Export from Google Maps Modal */}
      <ImportExportModal
        isOpen={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
        points={points}
        onImportSuccess={handleImportSuccess}
        onResetSample={handleResetSample}
      />

      {/* Global Delete Confirmation for Sidebar list or other triggers */}
      <DeleteConfirmModal
        isOpen={!!pointToDelete}
        title="Demiryolu Noktasını Sil"
        itemName={pointToDelete?.title}
        description="Bu demiryolu noktası sistemden ve haritadan kalıcı olarak silinecektir."
        confirmText="Evet, Noktayı Sil"
        cancelText="Vazgeç"
        isDeleting={isDeletingPoint}
        onConfirm={async () => {
          if (!pointToDelete) return;
          setIsDeletingPoint(true);
          try {
            await handleDeletePoint(pointToDelete.id);
            setPointToDelete(null);
          } finally {
            setIsDeletingPoint(false);
          }
        }}
        onClose={() => setPointToDelete(null)}
      />

      {/* Mobile Install & QR Code Modal */}
      <MobileInstallModal
        isOpen={isMobileInstallOpen}
        onClose={() => setIsMobileInstallOpen(false)}
        deferredPrompt={deferredPrompt}
        onTriggerInstall={handleTriggerInstall}
      />

      {/* Login / Switch Account Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccessToast={showToast}
      />

      {/* Admin User and Role Management Modal */}
      <UserManagementModal
        isOpen={isUserMgmtOpen}
        onClose={() => setIsUserMgmtOpen(false)}
        onSuccessToast={showToast}
      />

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        viewMode={viewMode}
        setViewMode={(mode) => {
          setViewMode(mode);
          setActiveTab(mode);
        }}
        pointCount={filteredPoints.length}
        onOpenAddModal={handleOpenAddModal}
        onToggleSearch={() => setIsMobileSearchOpen((prev) => !prev)}
        isSearchActive={Boolean(filters.search || filters.selectedLine !== 'all' || filters.category !== 'all')}
        onOpenMenu={() => setIsMobileMenuOpen(true)}
        isAddMode={isAddMode}
      />

      {/* Mobile Actions Drawer Menu */}
      <MobileActionsDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        totalPoints={points.length}
        onOpenImportExport={() => setIsImportExportOpen(true)}
        onOpenMobileInstall={() => setIsMobileInstallOpen(true)}
        onOpenPalette={() => setActiveTab('palette')}
        onOpenReports={() => setIsReportModalOpen(true)}
        onRefresh={handleRefresh}
        onExportJSON={handleExportJSON}
        onSyncPhotos={handleSyncPhotos}
        onOpenUserManagement={isAdmin ? () => setIsUserMgmtOpen(true) : undefined}
        isRefreshing={isRefreshing}
      />

      {/* TCDD Resmi Raporlar Modalı (Menfez, Geçit, Yapılan İşler) */}
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        points={points}
      />

      {/* Yapılan Saha İşleri & Bakım Defteri Modalı */}
      {workLogPoint && (
        <WorkLogModal
          isOpen={!!workLogPoint}
          onClose={() => setWorkLogPoint(null)}
          point={workLogPoint}
          onSaveWorkLog={handleSaveWorkLog}
          onDeleteWorkLog={handleDeleteWorkLog}
        />
      )}

      {/* Floating Install Prompt Banner (Telefona / Masaüstüne Yükle) */}
      {!isInstallBannerDismissed && (
        <div
          id="floating-install-banner"
          className="fixed bottom-16 sm:bottom-6 left-3 sm:left-6 z-30 bg-slate-900/95 backdrop-blur-md text-white border border-slate-700/80 rounded-2xl p-3 sm:p-3.5 shadow-2xl max-w-sm flex items-center justify-between gap-3 animate-in slide-in-from-bottom-6 duration-300"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-md">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">Uygulama Olarak İndir</p>
              <p className="text-[11px] text-slate-300 leading-tight">Telefona veya masaüstüne simge ekleyin</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              id="banner-install-open-btn"
              onClick={() => {
                if (deferredPrompt) {
                  handleTriggerInstall();
                } else {
                  setIsMobileInstallOpen(true);
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Yükle
            </button>
            <button
              id="banner-dismiss-btn"
              onClick={() => {
                setIsInstallBannerDismissed(true);
                try {
                  localStorage.setItem('tcdd_install_banner_dismissed', 'true');
                } catch {}
              }}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Kapat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification Notification Pill */}
      {toastMessage && (
        <div
          id="toast-notification"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white px-4 py-2.5 rounded-full shadow-2xl border border-slate-700 text-xs font-semibold flex items-center gap-2 animate-bounce"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
