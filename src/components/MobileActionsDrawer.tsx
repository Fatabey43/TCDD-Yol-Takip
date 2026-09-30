import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  X,
  Upload,
  FileJson,
  RotateCw,
  Smartphone,
  Palette,
  Users,
  LogOut,
  Train,
  CheckCircle,
  RefreshCw,
  CloudUpload,
  FileText,
} from 'lucide-react';

interface MobileActionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  totalPoints: number;
  onOpenImportExport: () => void;
  onOpenMobileInstall: () => void;
  onOpenPalette: () => void;
  onOpenReports?: () => void;
  onRefresh: () => void;
  onExportJSON: () => void;
  onSyncPhotos: () => void;
  onOpenUserManagement?: () => void;
  isRefreshing?: boolean;
}

export const MobileActionsDrawer: React.FC<MobileActionsDrawerProps> = ({
  isOpen,
  onClose,
  totalPoints,
  onOpenImportExport,
  onOpenMobileInstall,
  onOpenPalette,
  onOpenReports,
  onRefresh,
  onExportJSON,
  onSyncPhotos,
  onOpenUserManagement,
  isRefreshing,
}) => {
  const { user, role, isAdmin, canManageUsers, logout } = useAuth();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-950/70 backdrop-blur-xs sm:hidden animate-in fade-in duration-200">
      {/* Backdrop tap to close */}
      <div className="flex-1" onClick={onClose} />

      {/* Drawer content */}
      <div className="bg-slate-900 border-t border-slate-800 rounded-t-3xl shadow-2xl p-4 max-h-[85vh] overflow-y-auto flex flex-col gap-3 text-white animate-in slide-in-from-bottom duration-250 pb-safe">
        {/* Drag handle & close */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl overflow-hidden border border-red-500/50 flex items-center justify-center shadow-md shrink-0">
              <img
                src="/pwa-192x192.png"
                alt="TCDD Lokomotif"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white tracking-tight">TCDD KM TAKİP</h3>
              <p className="text-[11px] text-red-300 font-semibold">712 Şefliği • {totalPoints} KM Kayıtlı</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Status Card */}
        <div className="p-3 bg-slate-800/80 rounded-2xl flex items-center justify-between border border-slate-700/60">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-sm ${
                isAdmin ? 'bg-purple-600' : role === 'editor' ? 'bg-sky-600' : 'bg-slate-600'
              }`}
            >
              {user ? user.name.slice(0, 2).toUpperCase() : '??'}
            </div>
            <div>
              <p className="text-xs font-bold text-white leading-tight">{user?.name || 'Giriş Yapılmadı'}</p>
              <p className="text-[10px] text-slate-400">{user?.email || '-'}</p>
            </div>
          </div>
          <span
            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${
              isAdmin
                ? 'bg-purple-950 text-purple-300 border border-purple-800'
                : role === 'editor'
                ? 'bg-sky-950 text-sky-300 border border-sky-800'
                : 'bg-slate-800 text-slate-300 border border-slate-700'
            }`}
          >
            {isAdmin ? '👑 Yönetici' : role === 'editor' ? '🛠️ Saha' : '👁️ Gözlemci'}
          </span>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Refresh / Sync Now */}
          <button
            onClick={() => {
              onRefresh();
              onClose();
            }}
            disabled={isRefreshing}
            className="flex items-center gap-2 p-3 bg-slate-800 hover:bg-slate-700/80 active:bg-slate-700 rounded-xl border border-slate-700/70 transition-all font-semibold text-slate-200"
          >
            <RotateCw className={`w-4 h-4 text-sky-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <div className="text-left leading-tight">
              <span className="block font-bold">Haritayı Yenile</span>
              <span className="text-[10px] text-slate-400">Verileri Güncelle</span>
            </div>
          </button>

          {/* Sync Photos */}
          <button
            onClick={() => {
              onSyncPhotos();
              onClose();
            }}
            className="flex items-center gap-2 p-3 bg-slate-800 hover:bg-slate-700/80 active:bg-slate-700 rounded-xl border border-slate-700/70 transition-all font-semibold text-slate-200"
          >
            <CloudUpload className="w-4 h-4 text-cyan-400" />
            <div className="text-left leading-tight">
              <span className="block font-bold">Fotoğraf Eşitle</span>
              <span className="text-[10px] text-slate-400">Buluta Gönder</span>
            </div>
          </button>

          {/* KML Import / Export */}
          <button
            onClick={() => {
              onOpenImportExport();
              onClose();
            }}
            className="flex items-center gap-2 p-3 bg-slate-800 hover:bg-slate-700/80 active:bg-slate-700 rounded-xl border border-slate-700/70 transition-all font-semibold text-slate-200"
          >
            <Upload className="w-4 h-4 text-emerald-400" />
            <div className="text-left leading-tight">
              <span className="block font-bold">KML &amp; Harita</span>
              <span className="text-[10px] text-slate-400">İçe / Dışa Aktar</span>
            </div>
          </button>

          {/* TCDD Resmi Raporlar */}
          {onOpenReports && (
            <button
              onClick={() => {
                onOpenReports();
                onClose();
              }}
              className="flex items-center gap-2 p-3 bg-sky-950/80 hover:bg-sky-900 active:bg-sky-850 rounded-xl border border-sky-500/50 transition-all font-semibold text-sky-200"
            >
              <FileText className="w-4 h-4 text-sky-400" />
              <div className="text-left leading-tight">
                <span className="block font-bold">Resmi Raporlar</span>
                <span className="text-[10px] text-sky-300/80">PDF &amp; Excel Çıktısı</span>
              </div>
            </button>
          )}

          {/* JSON Export */}
          <button
            onClick={() => {
              onExportJSON();
              onClose();
            }}
            className="flex items-center gap-2 p-3 bg-slate-800 hover:bg-slate-700/80 active:bg-slate-700 rounded-xl border border-slate-700/70 transition-all font-semibold text-slate-200"
          >
            <FileJson className="w-4 h-4 text-indigo-400" />
            <div className="text-left leading-tight">
              <span className="block font-bold">JSON İndir</span>
              <span className="text-[10px] text-slate-400">Tüm Verileri Kaydet</span>
            </div>
          </button>

          {/* Mobile Install */}
          <button
            onClick={() => {
              onOpenMobileInstall();
              onClose();
            }}
            className="flex items-center gap-2 p-3 bg-slate-800 hover:bg-slate-700/80 active:bg-slate-700 rounded-xl border border-slate-700/70 transition-all font-semibold text-slate-200"
          >
            <Smartphone className="w-4 h-4 text-teal-400" />
            <div className="text-left leading-tight">
              <span className="block font-bold">Telefona Yükle</span>
              <span className="text-[10px] text-slate-400">PWA Uygulama</span>
            </div>
          </button>

          {/* Color & Pin Palette */}
          <button
            onClick={() => {
              onOpenPalette();
              onClose();
            }}
            className="flex items-center gap-2 p-3 bg-slate-800 hover:bg-slate-700/80 active:bg-slate-700 rounded-xl border border-slate-700/70 transition-all font-semibold text-slate-200"
          >
            <Palette className="w-4 h-4 text-amber-400" />
            <div className="text-left leading-tight">
              <span className="block font-bold">Renk Paleti</span>
              <span className="text-[10px] text-slate-400">Kategori &amp; Pinler</span>
            </div>
          </button>
        </div>

        {/* Admin User Management Button */}
        {canManageUsers && onOpenUserManagement && (
          <button
            onClick={() => {
              onOpenUserManagement();
              onClose();
            }}
            className="w-full flex items-center justify-between p-3 bg-purple-950/40 hover:bg-purple-950/60 active:bg-purple-950 border border-purple-800/50 rounded-2xl text-purple-200 font-semibold text-xs transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Users className="w-4 h-4 text-purple-400" />
              <span>Kullanıcı &amp; Yetki Yönetim Paneli</span>
            </div>
            <span className="text-[10px] bg-purple-900/80 text-purple-300 px-2 py-0.5 rounded-md font-bold">
              Yönetici
            </span>
          </button>
        )}

        {/* Logout */}
        <button
          onClick={() => {
            logout();
            onClose();
          }}
          className="w-full flex items-center justify-center gap-2 p-3 bg-red-950/40 hover:bg-red-950/60 active:bg-red-950 border border-red-800/50 rounded-2xl text-red-300 font-semibold text-xs transition-colors mt-1 cursor-pointer"
        >
          <LogOut className="w-4 h-4 text-red-400" />
          <span>Oturumu Kapat</span>
        </button>
      </div>
    </div>
  );
};
