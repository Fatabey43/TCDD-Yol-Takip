import React from 'react';
import { Map as MapIcon, List, Plus, Search, MoreHorizontal, Palette } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

interface MobileBottomNavProps {
  viewMode: 'map' | 'list';
  setViewMode: (mode: 'map' | 'list') => void;
  pointCount: number;
  onOpenAddModal: () => void;
  onToggleSearch: () => void;
  isSearchActive: boolean;
  onOpenMenu: () => void;
  isAddMode?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  viewMode,
  setViewMode,
  pointCount,
  onOpenAddModal,
  onToggleSearch,
  isSearchActive,
  onOpenMenu,
  isAddMode,
}) => {
  const { canAddPoint } = useAuth();

  return (
    <nav
      id="mobile-bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-20 sm:hidden bg-slate-900/95 backdrop-blur-md border-t border-slate-800 text-slate-400 select-none pb-safe shadow-2xl"
    >
      <div className="flex items-center justify-around h-14 px-2">
        {/* Map Tab */}
        <button
          onClick={() => setViewMode('map')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            viewMode === 'map' ? 'text-sky-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className={`p-1 rounded-xl ${viewMode === 'map' ? 'bg-sky-500/20' : ''}`}>
            <MapIcon className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5">Harita</span>
        </button>

        {/* List Tab */}
        <button
          onClick={() => setViewMode('list')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors relative ${
            viewMode === 'list' ? 'text-sky-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className={`p-1 rounded-xl ${viewMode === 'list' ? 'bg-sky-500/20' : ''}`}>
            <List className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5">
            Liste <span className="text-[9px] opacity-75">({pointCount})</span>
          </span>
        </button>

        {/* Center Primary Action: Add Point (if authorized) */}
        {canAddPoint && (
          <button
            onClick={onOpenAddModal}
            className="flex flex-col items-center justify-center -mt-4 flex-none px-2 group"
          >
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg group-active:scale-95 transition-all border-2 border-slate-900 ${
                isAddMode
                  ? 'bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 shadow-amber-500/50 ring-2 ring-amber-300 animate-pulse'
                  : 'bg-gradient-to-tr from-sky-600 to-blue-500 text-white shadow-sky-500/40'
              }`}
            >
              <Plus className="w-6 h-6 stroke-[2.5]" />
            </div>
            <span
              className={`text-[10px] font-bold mt-1 ${
                isAddMode ? 'text-amber-400' : 'text-sky-400'
              }`}
            >
              {isAddMode ? 'İşaretle' : 'Ekle'}
            </span>
          </button>
        )}

        {/* Search & Filter Toggle */}
        <button
          onClick={onToggleSearch}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            isSearchActive ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className={`p-1 rounded-xl relative ${isSearchActive ? 'bg-amber-500/20' : ''}`}>
            <Search className="w-5 h-5" />
            {isSearchActive && (
              <span className="w-2 h-2 rounded-full bg-amber-400 absolute top-0.5 right-0.5 ring-2 ring-slate-900" />
            )}
          </div>
          <span className="text-[10px] mt-0.5">Filtrele</span>
        </button>

        {/* Actions Menu */}
        <button
          onClick={onOpenMenu}
          className="flex flex-col items-center justify-center flex-1 py-1 text-slate-400 hover:text-slate-200 active:text-white transition-colors"
        >
          <div className="p-1 rounded-xl">
            <MoreHorizontal className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5">Menü</span>
        </button>
      </div>
    </nav>
  );
};
