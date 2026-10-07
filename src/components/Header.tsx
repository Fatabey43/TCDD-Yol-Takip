import React, { useState } from 'react';
import { RailwayPointCategory, FilterOptions, UserRole } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Train,
  Plus,
  Upload,
  Search,
  Wifi,
  Filter,
  Layers,
  Map as MapIcon,
  List,
  Smartphone,
  Palette,
  RotateCw,
  FileJson,
  CloudUpload,
  User as UserIcon,
  Users,
  Shield,
  ChevronDown,
  LogOut,
  Lock,
  FileText,
  WifiOff,
  Gauge,
  Compass,
  Landmark,
} from 'lucide-react';

interface HeaderProps {
  filters: FilterOptions;
  setFilters: React.Dispatch<React.SetStateAction<FilterOptions>>;
  availableLines: string[];
  totalPoints: number;
  filteredCount: number;
  isOnline?: boolean;
  activeTakyidatCount?: number;
  totalParcelsCount?: number;
  onOpenTakyidat?: () => void;
  onOpenParcels?: () => void;
  onOpenSelectPoint?: () => void;
  onOpenAddModal: () => void;
  onOpenImportExport: () => void;
  onOpenMobileInstall: () => void;
  onOpenReports?: () => void;
  onToggleAddMode: () => void;
  onOpenPalette?: () => void;
  isPaletteActive?: boolean;
  onRefresh?: () => void;
  onExportJSON?: () => void;
  onSyncPhotos?: () => void;
  onOpenLogin?: () => void;
  onOpenUserManagement?: () => void;
  onOpenMobileActions?: () => void;
  isRefreshing?: boolean;
  isAddMode: boolean;
  viewMode: 'map' | 'list';
  setViewMode: (mode: 'map' | 'list') => void;
  isMobileSearchOpen?: boolean;
  setIsMobileSearchOpen?: React.Dispatch<React.SetStateAction<boolean>>;
}

const CATEGORY_LABELS: Record<string, string> = {
  all: 'Tüm Kategoriler',
  km_marker: 'KM Taşları',
  switch: 'Makaslar',
  crossing: 'Hemzemin Geçitler',
  bridge: 'Köprü & Viyadükler',
  culvert: 'Menfezler',
  station: 'İstasyon & Garlar',
  signal: 'Sinyaller',
  other: 'Diğer',
};

export const Header: React.FC<HeaderProps> = ({
  filters,
  setFilters,
  availableLines,
  totalPoints,
  filteredCount,
  isOnline = true,
  activeTakyidatCount = 0,
  totalParcelsCount = 0,
  onOpenTakyidat,
  onOpenParcels,
  onOpenSelectPoint,
  onOpenAddModal,
  onOpenImportExport,
  onOpenMobileInstall,
  onOpenReports,
  onToggleAddMode,
  onOpenPalette,
  isPaletteActive,
  onRefresh,
  onExportJSON,
  onSyncPhotos,
  onOpenLogin,
  onOpenUserManagement,
  onOpenMobileActions,
  isRefreshing,
  isAddMode,
  viewMode,
  setViewMode,
  isMobileSearchOpen,
  setIsMobileSearchOpen,
}) => {
  const { user, role, isAdmin, canAddPoint, canManageUsers, logout } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [localMobileSearch, setLocalMobileSearch] = useState(false);

  const showMobileSearch = isMobileSearchOpen !== undefined ? isMobileSearchOpen : localMobileSearch;
  const setShowMobileSearch = setIsMobileSearchOpen || setLocalMobileSearch;

  const hasActiveFilters = Boolean(
    filters.search || filters.selectedLine !== 'all' || filters.category !== 'all'
  );

  return (
    <header className="bg-white text-slate-800 border-b border-slate-200 shadow-xs flex-shrink-0 z-20">
      {/* Top Navbar Row */}
      <div className="px-3 sm:px-6 py-2 flex items-center justify-between gap-2">
        {/* Logo & Canlı Senkronizasyon Kutusu (TCDD Resmi Saha Merkezi) */}
        <div className="bg-slate-50 border border-slate-200/90 px-2.5 sm:px-3.5 py-1.5 rounded-xl flex items-center gap-2.5 sm:gap-3 min-w-0 shadow-xs">
          <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-slate-300 shadow-xs relative bg-white">
            <img
              src="/tcdd_logo_badge.svg"
              alt="TCDD Takip 712 Kısım Şefliği Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase tracking-wider text-red-700 leading-none flex items-center gap-1">
                  <span>TCDD 712 ŞEFLİĞİ</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-sky-700">SAHA MERKEZİ</span>
                </span>
                <h1 className="text-xs sm:text-base font-black tracking-tight text-slate-900 truncate">
                  KM &amp; SAHA TAKİP
                </h1>
              </div>
              {/* Live Multi-Device Sync & Offline Status Indicator */}
              <div
                id="cloud-sync-status-badge"
                title={
                  isOnline
                    ? 'Tüm cihazlarınızla anlık canlı senkronize edilir'
                    : 'Çevrimdışı (Offline) mod: Sahadaki tüm verileriniz telefonunuzun yerel hafızasında korunur'
                }
                className={`flex items-center gap-1.5 text-[10px] sm:text-[11px] px-2.5 py-0.5 rounded-full font-bold flex-shrink-0 ml-1 border ${
                  isOnline
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-amber-50 border-amber-300 text-amber-800'
                }`}
              >
                {isOnline ? (
                  <>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                    <span className="hidden md:inline">Canlı: </span>
                    <span className="font-mono font-black">{totalPoints} Nokta</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3 text-amber-600" />
                    <span>Çevrimdışı</span>
                    <span className="font-mono font-black hidden sm:inline">({totalPoints} Nokta)</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Quick Action Buttons (Search + Actions Menu) */}
        <div className="flex sm:hidden items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => setShowMobileSearch(!showMobileSearch)}
            className={`p-2 rounded-xl border transition-colors ${
              hasActiveFilters || showMobileSearch
                ? 'bg-red-50 text-red-700 border-red-300'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:text-slate-900'
            }`}
            title="Arama ve Filtreleri Aç/Kapat"
          >
            <Search className="w-4 h-4" />
          </button>

          {onOpenMobileActions && (
            <button
              onClick={onOpenMobileActions}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
              title="Menüyü Aç"
            >
              <div className="w-4 h-4 flex flex-col justify-around py-0.5">
                <span className="w-full h-0.5 bg-current rounded-full" />
                <span className="w-full h-0.5 bg-current rounded-full" />
                <span className="w-full h-0.5 bg-current rounded-full" />
              </div>
            </button>
          )}
        </div>

        {/* Action Buttons (Desktop & Tablet: Clean White Institutional Toolbar) */}
        <div className="hidden sm:flex items-center gap-1.5 flex-wrap">
          {/* TCDD Resmi Raporlar (PDF / Excel) */}
          {onOpenReports && (
            <button
              id="header-open-reports-btn"
              onClick={onOpenReports}
              className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-all shadow-xs cursor-pointer"
              title="TCDD Menfez, Geçit ve Yapılan Saha İşleri Resmi Raporları (PDF / Excel)"
            >
              <FileText className="w-3.5 h-3.5 text-red-600" />
              <span className="hidden sm:inline">Resmi Raporlar</span>
              <span className="sm:hidden">Rapor</span>
            </button>
          )}

          {/* Import / Export from Google Maps KML */}
          {onOpenImportExport && (
            <button
              id="open-import-export-btn"
              onClick={onOpenImportExport}
              className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
              title="Google Haritalar'dan KML İçe Aktar veya Yedek Al"
            >
              <Upload className="w-3.5 h-3.5 text-sky-600" />
              <span className="hidden lg:inline">KML / Aktar</span>
              <span className="lg:hidden">KML</span>
            </button>
          )}

          {/* Takyidat Hız Sınırları & Yol Emirleri Butonu */}
          {onOpenTakyidat && (
            <button
              id="header-open-takyidat-btn"
              onClick={onOpenTakyidat}
              className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer relative shadow-xs ${
                activeTakyidatCount > 0
                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-300 ring-1 ring-rose-300'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
              title="TCDD Takyidat & Hız Kısıtlamaları Paneli (Örn: KM 54-55 arası hız tahditleri)"
            >
              <Gauge className="w-3.5 h-3.5 text-rose-600" />
              <span className="hidden md:inline">Takyidat</span>
              <span className="md:hidden">Hız</span>
              {activeTakyidatCount > 0 && (
                <span className="bg-rose-600 text-white px-1.5 py-0.2 rounded-full text-[10px] font-black">
                  {activeTakyidatCount}
                </span>
              )}
            </button>
          )}

          {/* Demiryolu Arazisi & Tapu Kadastro Butonu */}
          {onOpenParcels && (
            <button
              id="header-open-parcels-btn"
              onClick={onOpenParcels}
              className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer shadow-xs"
              title="TCDD Demiryolu Arazisi & Tapu Kadastro Portalı (Kamulaştırma, Emlak ve Mülkiyet Takibi)"
            >
              <Landmark className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden md:inline">Arazi &amp; Kadastro</span>
              <span className="md:hidden">Arazi</span>
              {totalParcelsCount > 0 && (
                <span className="bg-indigo-600 text-white px-1.5 py-0.2 rounded-full text-[10px] font-black">
                  {totalParcelsCount}
                </span>
              )}
            </button>
          )}

          {/* Refresh / Yenile Butonu */}
          {onRefresh && (
            <button
              id="header-refresh-btn"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer disabled:opacity-60"
              title="Haritayı ve noktaları anında güncelle"
            >
              <RotateCw className={`w-3.5 h-3.5 text-sky-600 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden xl:inline">Yenile</span>
            </button>
          )}

          {/* Color Palette Toggle in Header */}
          {onOpenPalette && (
            <button
              id="header-toggle-palette-btn"
              onClick={onOpenPalette}
              className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer border ${
                isPaletteActive
                  ? 'bg-purple-50 text-purple-900 border-purple-300 shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
              title="Kategori & Logo Renk Paletini Aç/Kapat"
            >
              <Palette className="w-3.5 h-3.5 text-purple-600" />
              <span className="hidden lg:inline">Renkler</span>
            </button>
          )}

          {/* Add New Point Button (Yalnızca Yönetici) */}
          {canAddPoint ? (
            <button
              id="header-add-point-btn"
              onClick={onOpenAddModal}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg shadow-xs transition-all active:scale-[0.98] cursor-pointer ml-1 ${
                isAddMode
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
              title="Haritadan tıkla & yeni demiryolu noktası ekle"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAddMode ? 'Haritaya Tıklayın' : 'Nokta Ekle'}</span>
            </button>
          ) : null}

          {/* User Account / Role Pill with dropdown */}
          <div className="relative ml-1">
            <button
              id="user-profile-menu-btn"
              onClick={() => setIsUserMenuOpen((prev) => !prev)}
              className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 transition-all shadow-xs"
              title="Kullanıcı & Yetki Durumu"
            >
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shadow-xs ${
                  isAdmin ? 'bg-purple-600' : role === 'editor' ? 'bg-sky-600' : 'bg-slate-600'
                }`}
              >
                {user ? user.name.slice(0, 2).toUpperCase() : '??'}
              </div>
              <div className="flex flex-col text-left leading-tight hidden lg:block">
                <span className="text-[11px] font-bold text-slate-800 truncate max-w-[90px]">
                  {user ? user.name.split(' ')[0] : 'Giriş Yap'}
                </span>
                <span
                  className={`text-[9px] font-bold ${
                    isAdmin ? 'text-purple-700' : role === 'editor' ? 'text-sky-700' : 'text-slate-600'
                  }`}
                >
                  {isAdmin ? '👑 Yönetici' : role === 'editor' ? '🛠️ Saha' : '👁️ Gözlemci'}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 ml-0.5" />
            </button>

            {/* Dropdown Menu */}
            {isUserMenuOpen && (
              <div
                id="user-profile-dropdown"
                className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-2.5 z-50 text-slate-800 animate-in fade-in zoom-in-95 duration-150"
              >
                {/* Current user summary */}
                <div className="px-2.5 py-2 bg-slate-50 border border-slate-200/80 rounded-xl mb-2">
                  <p className="text-xs font-bold text-slate-900 truncate">{user?.name || 'Giriş Yapılmadı'}</p>
                  <p className="text-[11px] text-slate-500 truncate">{user?.email || '-'}</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        isAdmin
                          ? 'bg-purple-50 text-purple-800 border border-purple-200'
                          : role === 'editor'
                          ? 'bg-sky-50 text-sky-800 border border-sky-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {isAdmin
                        ? '👑 Yönetici Yetkisi'
                        : role === 'editor'
                        ? '🛠️ Saha Personeli Yetkisi'
                        : '👁️ Gözlemci (Salt Okunur)'}
                    </span>
                  </div>
                </div>

                {/* Mobile / Tablet Install Option */}
                <button
                  id="dropdown-mobile-install-btn"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onOpenMobileInstall();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors text-left cursor-pointer"
                >
                  <Smartphone className="w-4 h-4 text-emerald-600" />
                  <span>Telefona / Tablete Yükle (PWA)</span>
                </button>

                {/* Admin User Management Button */}
                {canManageUsers && onOpenUserManagement && (
                  <button
                    id="dropdown-user-mgmt-btn"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onOpenUserManagement();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors text-left cursor-pointer"
                  >
                    <Users className="w-4 h-4 text-purple-600" />
                    <span>Kullanıcı &amp; Yetki Yönetimi</span>
                  </button>
                )}

                {/* Logout Button */}
                <button
                  id="dropdown-logout-btn"
                  onClick={() => {
                    logout();
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-colors text-left border-t border-slate-100 mt-1 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Oturumu Kapat</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar Row (Clean Single Row) */}
      <div
        className={`px-3 sm:px-6 py-2 bg-slate-50/90 border-t border-slate-200 ${
          showMobileSearch || hasActiveFilters ? 'flex flex-col sm:flex-row' : 'hidden sm:flex'
        } items-stretch sm:items-center gap-2`}
      >
        {/* Search Box */}
        <div className="relative flex-1 bg-white rounded-lg border border-slate-200 flex items-center px-2.5 py-1 shadow-2xs">
          <Search className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" />
          <input
            id="search-points-input"
            type="text"
            placeholder="KM veya lokasyon ara (Örn: 142, Makas, Menfez, Balıkesir, Kütahya...)"
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            className="w-full bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-none"
          />
          {filters.search && (
            <button
              onClick={() => setFilters((prev) => ({ ...prev, search: '' }))}
              className="text-slate-400 hover:text-slate-800 text-xs p-0.5 cursor-pointer ml-1"
              title="Aramayı Temizle"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filters Group (Hat & Kategori Dropdowns) */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="bg-white rounded-lg border border-slate-200 px-2.5 py-1 flex items-center gap-1.5 shadow-2xs">
            <span className="text-[11px] text-slate-500 font-medium">Hat:</span>
            <select
              id="filter-line-select"
              value={filters.selectedLine}
              onChange={(e) => setFilters((prev) => ({ ...prev, selectedLine: e.target.value }))}
              className="bg-transparent text-xs text-slate-800 font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">Tüm Hatlar ({totalPoints})</option>
              {availableLines.map((line) => (
                <option key={line} value={line} className="text-slate-900">
                  {line}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 px-2.5 py-1 flex items-center gap-1.5 shadow-2xs">
            <span className="text-[11px] text-slate-500 font-medium">Kategori:</span>
            <select
              id="filter-category-select"
              value={filters.category}
              onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
              className="bg-transparent text-xs text-slate-800 font-medium focus:outline-none cursor-pointer"
            >
              {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                <option key={val} value={val} className="text-slate-900">
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters if active */}
          {hasActiveFilters && (
            <button
              id="clear-filters-btn"
              onClick={() => setFilters({ search: '', selectedLine: 'all', category: 'all' })}
              className="px-2.5 py-1 text-xs font-semibold text-red-700 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer shadow-2xs"
            >
              ✕ Temizle ({filteredCount})
            </button>
          )}

          {/* Close mobile search bar */}
          <button
            onClick={() => setShowMobileSearch(false)}
            className="sm:hidden text-slate-600 hover:text-slate-900 text-xs px-2 py-1 rounded bg-slate-100 border border-slate-200 cursor-pointer"
            title="Kapat"
          >
            ✕ Kapat
          </button>
        </div>
      </div>
    </header>
  );
};
