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
      className="fixed bottom-0 left-0 right-0 z-20 sm:hidden bg-white border-t border-slate-200 text-slate-600 select-none pb-safe shadow-md"
    >
      <div className="flex items-center justify-around h-14 px-2">
        {/* Map Tab */}
        <button
          onClick={() => setViewMode('map')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            viewMode === 'map' ? 'text-red-600 font-bold' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <div className={`p-1 rounded-lg ${viewMode === 'map' ? 'bg-red-50' : ''}`}>
            <MapIcon className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5">Harita</span>
        </button>

        {/* List Tab */}
        <button
          onClick={() => setViewMode('list')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors relative ${
            viewMode === 'list' ? 'text-red-600 font-bold' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <div className={`p-1 rounded-lg ${viewMode === 'list' ? 'bg-red-50' : ''}`}>
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
            className="flex flex-col items-center justify-center -mt-4 flex-none px-2 group cursor-pointer"
          >
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md group-active:scale-95 transition-all border-2 border-white ${
                isAddMode
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-red-600 text-white'
              }`}
            >
              <Plus className="w-6 h-6 stroke-[2.5]" />
            </div>
            <span
              className={`text-[10px] font-bold mt-1 ${
                isAddMode ? 'text-amber-600' : 'text-red-700'
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
            isSearchActive ? 'text-red-600 font-bold' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <div className={`p-1 rounded-lg relative ${isSearchActive ? 'bg-red-50' : ''}`}>
            <Search className="w-5 h-5" />
            {isSearchActive && (
              <span className="w-2 h-2 rounded-full bg-red-600 absolute top-0.5 right-0.5 ring-2 ring-white" />
            )}
          </div>
          <span className="text-[10px] mt-0.5">Filtrele</span>
        </button>

        {/* Actions Menu */}
        <button
          onClick={onOpenMenu}
          className="flex flex-col items-center justify-center flex-1 py-1 text-slate-500 hover:text-slate-900 transition-colors"
        >
          <div className="p-1 rounded-lg">
            <MoreHorizontal className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5">Menü</span>
        </button>
      </div>
    </nav>
  );
};
