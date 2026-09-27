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
} from 'lucide-react';

interface HeaderProps {
  filters: FilterOptions;
  setFilters: React.Dispatch<React.SetStateAction<FilterOptions>>;
  availableLines: string[];
  totalPoints: number;
  filteredCount: number;
  onOpenAddModal: () => void;
  onOpenImportExport: () => void;
  onOpenMobileInstall: () => void;
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
  onOpenAddModal,
  onOpenImportExport,
  onOpenMobileInstall,
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
    <header className="bg-slate-900 text-white border-b border-slate-800 shadow-md flex-shrink-0 z-20">
      {/* Top Navbar Row */}
      <div className="px-3 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-2">
        {/* Logo & Canlı Senkronizasyon Kutusu (Kutucuk yapısı) */}
        <div className="bg-slate-800/60 border border-slate-700/60 px-2 sm:px-3 py-1.5 rounded-xl flex items-center gap-2 sm:gap-3 min-w-0 shadow-xs">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 border border-red-500/50 shadow-md">
            <img
              src="/pwa-192x192.png"
              alt="TCDD Lokomotif"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="flex flex-col">
                <span className="text-[9px] font-bold uppercase tracking-wider text-red-400 leading-none">
                  712 Şefliği
                </span>
                <h1 className="text-xs sm:text-base font-extrabold tracking-tight text-white truncate">
                  TCDD KM TAKİP
                </h1>
              </div>
              {/* Live Multi-Device Sync Indicator */}
              <div
                id="cloud-sync-status-badge"
                title="Tüm cihazlarınızla (telefon, tablet, bilgisayar) anlık canlı senkronize edilir"
                className="flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-1"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="hidden md:inline">Canlı • </span>
                <span>{totalPoints} KM</span>
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
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
            }`}
            title="Arama ve Filtreleri Aç/Kapat"
          >
            <Search className="w-4 h-4" />
          </button>

          {onOpenMobileActions && (
            <button
              onClick={onOpenMobileActions}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:text-white transition-colors"
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

        {/* Action Buttons (Desktop & Tablet: Grouped into logical boxes) */}
        <div className="hidden sm:flex items-center gap-2 flex-wrap">

          {/* Kutu 1: Veri ve Aktarım İşlemleri */}
          <div
            id="header-data-box"
            className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-1 flex items-center gap-1 shadow-xs"
            title="Veri İçe/Dışa Aktarma & Yedekleme"
          >
            {/* Import / Export from Google Maps KML */}
            <button
              id="open-import-export-btn"
              onClick={onOpenImportExport}
              className="flex items-center gap-1.5 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
              title="Google Haritalar'dan KML İçe Aktar veya Yedek Al"
            >
              <Upload className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden lg:inline">KML / Harita Aktar</span>
              <span className="lg:hidden">KML</span>
            </button>

            {/* JSON Olarak İndir */}
            {onExportJSON && (
              <button
                id="header-export-json-btn"
                onClick={onExportJSON}
                className="flex items-center gap-1.5 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                title="Tüm saha fotoğraflarını ve notları JSON olarak indir"
              >
                <FileJson className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden lg:inline">JSON İndir</span>
                <span className="lg:hidden">JSON</span>
              </button>
            )}

            {/* Otomatik Eşitle */}
            {onSyncPhotos && (
              <button
                id="header-sync-photos-btn"
                onClick={onSyncPhotos}
                className="flex items-center gap-1.5 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                title="Saha fotoğraflarını ana sunucuya otomatik aktar"
              >
                <CloudUpload className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden xl:inline">Eşitle</span>
              </button>
            )}
          </div>

          {/* Kutu 2: Harita & Görünüm Araçları */}
          <div
            id="header-tools-box"
            className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-1 flex items-center gap-1 shadow-xs"
            title="Harita Araçları ve Görünüm"
          >
            {/* Refresh / Yenile Butonu */}
            {onRefresh && (
              <button
                id="header-refresh-btn"
                onClick={onRefresh}
                disabled={isRefreshing}
                className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer disabled:opacity-60 ${
                  isRefreshing
                    ? 'bg-sky-950 text-sky-300 ring-1 ring-sky-500/50'
                    : 'hover:bg-slate-700 text-slate-200'
                }`}
                title="Haritayı ve noktaları anında güncelle"
              >
                <RotateCw className={`w-3.5 h-3.5 text-sky-400 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="hidden lg:inline">Yenile</span>
              </button>
            )}

            {/* Color Palette Toggle in Header */}
            {onOpenPalette && (
              <button
                id="header-toggle-palette-btn"
                onClick={onOpenPalette}
                className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  isPaletteActive
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'hover:bg-slate-700 text-slate-200'
                }`}
                title="Kategori & Logo Renk Paletini Aç/Kapat"
              >
                <Palette className="w-3.5 h-3.5 text-purple-400" />
                <span className="hidden lg:inline">Renkler</span>
              </button>
            )}

            {/* Direct Mobile / Desktop Install & Share Button */}
            <button
              id="header-install-app-btn"
              onClick={onOpenMobileInstall}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg shadow-sm transition-all active:scale-[0.98] cursor-pointer"
              title="Uygulamayı Telefona, Tablete veya Masaüstüne İndir / Paylaş"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-100" />
              <span className="hidden md:inline">Uygulamayı İndir</span>
              <span className="md:hidden">İndir</span>
            </button>

            {/* Add New Point Button (Yalnızca Yönetici) */}
            {canAddPoint ? (
              <button
                id="header-add-point-btn"
                onClick={onOpenAddModal}
                className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition-all active:scale-[0.98] cursor-pointer ml-0.5"
                title="Yeni Demiryolu Noktası Ekle"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nokta Ekle</span>
              </button>
            ) : null}
          </div>

          {/* User Account / Role Pill with dropdown */}
          <div className="relative">
            <button
              id="user-profile-menu-btn"
              onClick={() => setIsUserMenuOpen((prev) => !prev)}
              className="flex items-center gap-1.5 bg-slate-800/90 hover:bg-slate-700 text-white text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-700 transition-all shadow-sm"
              title="Kullanıcı & Yetki Durumu"
            >
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shadow-sm ${
                  isAdmin ? 'bg-purple-600' : role === 'editor' ? 'bg-sky-600' : 'bg-slate-600'
                }`}
              >
                {user ? user.name.slice(0, 2).toUpperCase() : '??'}
              </div>
              <div className="flex flex-col text-left leading-tight hidden lg:block">
                <span className="text-[11px] font-bold text-slate-200 truncate max-w-[90px]">
                  {user ? user.name.split(' ')[0] : 'Giriş Yap'}
                </span>
                <span
                  className={`text-[9px] font-bold ${
                    isAdmin ? 'text-purple-400' : role === 'editor' ? 'text-sky-400' : 'text-slate-400'
                  }`}
                >
                  {isAdmin ? '👑 Yönetici' : role === 'editor' ? '🛠️ Saha' : '👁️ Gözlemci'}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
            </button>

            {/* Dropdown Menu */}
            {isUserMenuOpen && (
              <div
                id="user-profile-dropdown"
                className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2.5 z-50 text-white animate-in fade-in zoom-in-95 duration-150"
              >
                {/* Current user summary */}
                <div className="px-2.5 py-2 bg-slate-800/70 rounded-xl mb-2">
                  <p className="text-xs font-bold text-white truncate">{user?.name || 'Giriş Yapılmadı'}</p>
                  <p className="text-[11px] text-slate-400 truncate">{user?.email || '-'}</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        isAdmin
                          ? 'bg-purple-950 text-purple-300 border border-purple-800'
                          : role === 'editor'
                          ? 'bg-sky-950 text-sky-300 border border-sky-800'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
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
                  className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 rounded-xl transition-colors text-left cursor-pointer"
                >
                  <Smartphone className="w-4 h-4 text-emerald-400" />
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
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 rounded-xl transition-colors text-left cursor-pointer"
                  >
                    <Users className="w-4 h-4 text-purple-400" />
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
                  className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-red-400 hover:bg-red-950/40 rounded-xl transition-colors text-left border-t border-slate-800 mt-1 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Oturumu Kapat</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar Row (Kutucuk içinde kutucuk yapısı) */}
      <div
        className={`px-3 sm:px-6 py-2 bg-slate-950/90 border-t border-slate-800/80 ${
          showMobileSearch || hasActiveFilters ? 'flex flex-col sm:flex-row' : 'hidden sm:flex'
        } items-stretch sm:items-center gap-2`}
      >
        {/* Unified Search & Filters Nested Container */}
        <div className="w-full bg-slate-900/90 border border-slate-800 rounded-xl p-1.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shadow-inner">
          {/* Inner Search Box */}
          <div className="relative flex-1 bg-slate-950/80 rounded-lg border border-slate-800/80 flex items-center px-2.5 py-1">
            <Search className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" />
            <input
              id="search-points-input"
              type="text"
              placeholder="KM ara (Örn: 142, Makas, Polatlı, Arifiye, teknik notlar...)"
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
            />
            {filters.search && (
              <button
                onClick={() => setFilters((prev) => ({ ...prev, search: '' }))}
                className="text-slate-400 hover:text-white text-xs p-0.5 cursor-pointer ml-1"
                title="Aramayı Temizle"
              >
                ✕
              </button>
            )}
          </div>

          {/* Inner Filters Group (Hat & Kategori Dropdowns) */}
          <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
            <div className="bg-slate-950/80 rounded-lg border border-slate-800/80 px-2.5 py-1 flex items-center gap-1.5 flex-1 sm:flex-none">
              <span className="text-[11px] text-slate-400 font-medium">Hat:</span>
              <select
                id="filter-line-select"
                value={filters.selectedLine}
                onChange={(e) => setFilters((prev) => ({ ...prev, selectedLine: e.target.value }))}
                className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="all">Tüm Hatlar ({totalPoints})</option>
                {availableLines.map((line) => (
                  <option key={line} value={line} className="bg-slate-900 text-white">
                    {line}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-slate-950/80 rounded-lg border border-slate-800/80 px-2.5 py-1 flex items-center gap-1.5 flex-1 sm:flex-none">
              <span className="text-[11px] text-slate-400 font-medium">Kategori:</span>
              <select
                id="filter-category-select"
                value={filters.category}
                onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
                className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
              >
                {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                  <option key={val} value={val} className="bg-slate-900 text-white">
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
                className="px-2.5 py-1 text-xs font-semibold text-amber-300 hover:text-amber-200 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                ✕ Temizle ({filteredCount})
              </button>
            )}

            {/* Close mobile search bar */}
            <button
              onClick={() => setShowMobileSearch(false)}
              className="sm:hidden text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-950 border border-slate-800 cursor-pointer"
              title="Kapat"
            >
              ✕ Kapat
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
