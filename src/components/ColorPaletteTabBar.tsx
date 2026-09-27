import React, { useState } from 'react';
import { RailwayPointCategory } from '../types.ts';
import {
  CategoryColorConfig,
  PRESET_COLOR_SWATCHES,
  DEFAULT_CATEGORY_COLORS,
} from '../utils/categoryColors.ts';
import {
  Palette,
  RotateCcw,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers,
  Map as MapIcon,
  List,
  SlidersHorizontal,
  X,
} from 'lucide-react';

interface ColorPaletteTabBarProps {
  categoryColors: Record<RailwayPointCategory, CategoryColorConfig>;
  onUpdateColor: (category: RailwayPointCategory, bg: string, border: string, text: string) => void;
  onResetColors: () => void;
  activeTab: 'map' | 'list' | 'palette';
  setActiveTab: (tab: 'map' | 'list' | 'palette') => void;
  pointCountsByCategory: Record<string, number>;
}

export const ColorPaletteTabBar: React.FC<ColorPaletteTabBarProps> = ({
  categoryColors,
  onUpdateColor,
  onResetColors,
  activeTab,
  setActiveTab,
  pointCountsByCategory,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<RailwayPointCategory>('switch');

  const categories = Object.keys(categoryColors) as RailwayPointCategory[];

  return (
    <div
      className={`bg-slate-900 border-b border-slate-800 shadow-md text-white select-none z-10 flex-shrink-0 ${
        activeTab === 'palette' ? 'block' : 'hidden'
      }`}
    >
      {/* Primary Palette Header with close button */}
      <div className="px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3 border-b border-slate-800/80 bg-slate-950/60">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-r from-amber-500 to-rose-500 flex items-center justify-center text-slate-950 font-bold shadow-sm">
            <Palette className="w-4 h-4 text-slate-950" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <span>Kategori &amp; Logo Renk Paleti</span>
              <span className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.2 rounded font-normal">
                Canlı Harita Önizleme
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Haritadaki nokta simgelerinin renklerini, arka planlarını ve kenarlıklarını özelleştirin
            </p>
          </div>
        </div>

        {/* Actions: Reset & Close */}
        <div className="flex items-center gap-2">
          <button
            id="reset-colors-btn"
            onClick={onResetColors}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors cursor-pointer"
            title="Varsayılan demiryolu renklerine sıfırla (Makaslar kırmızı, KM mavi, Geçitler sarı)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Varsayılana Sıfırla</span>
          </button>

          <button
            id="close-palette-tab-btn"
            onClick={() => setActiveTab('map')}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 px-3 py-1.5 rounded-lg shadow-sm transition-colors cursor-pointer"
            title="Paleti Kapat ve Haritaya Dön"
          >
            <X className="w-3.5 h-3.5" />
            <span>Kapat</span>
          </button>
        </div>
      </div>

      {/* Color Palette Interactive Control Bar */}
      {isExpanded && (
        <div className="bg-slate-950/90 p-3 sm:p-4 border-t border-slate-800 animate-fadeIn">
          <div className="max-w-7xl mx-auto space-y-3">
            {/* Top Info Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="font-semibold text-slate-200">
                  Logo ve Harita Pin Renklerini Seçin:
                </span>
                <span className="text-slate-400 text-[11px] hidden md:inline">
                  (Değişiklikler harita pinlerine, logolara ve listeye anında yansır)
                </span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-3">
                <span>🔴 Makaslar Kırmızı</span>
                <span>🔵 KM Mavi</span>
                <span>🟡 Geçitler Sarı</span>
              </div>
            </div>

            {/* Category Selector Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {categories.map((catKey) => {
                const conf = categoryColors[catKey];
                const isCurrent = selectedCategory === catKey;
                const count = pointCountsByCategory[catKey] || 0;

                return (
                  <button
                    key={catKey}
                    id={`palette-select-category-${catKey}`}
                    onClick={() => setSelectedCategory(catKey)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                      isCurrent
                        ? 'bg-slate-800 text-white border-amber-400 shadow-md ring-2 ring-amber-400/30'
                        : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    {/* Live Category Symbol Badge */}
                    <span
                      className="w-4 h-4 rounded-md border border-black/20 shadow-sm flex items-center justify-center p-0.5 flex-shrink-0"
                      style={{ backgroundColor: conf.bg, borderColor: conf.border, color: conf.text }}
                      dangerouslySetInnerHTML={{ __html: conf.svgIcon }}
                    />
                    <span>{conf.label}</span>
                    <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded-full">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Category Color Selector Box */}
            {selectedCategory && (
              <div className="bg-slate-900/90 rounded-2xl p-3 sm:p-4 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Active Category Details & Live Preview */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg border-2 p-2.5 transition-transform duration-200 hover:scale-105"
                    style={{
                      backgroundColor: categoryColors[selectedCategory].bg,
                      borderColor: categoryColors[selectedCategory].border,
                      color: categoryColors[selectedCategory].text,
                    }}
                    dangerouslySetInnerHTML={{ __html: categoryColors[selectedCategory].svgIcon }}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">
                        {categoryColors[selectedCategory].label}
                      </span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        {categoryColors[selectedCategory].shortLabel}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Şu anki renk: <span className="font-mono text-slate-200">{categoryColors[selectedCategory].bg}</span>
                    </div>
                  </div>
                </div>

                {/* Swatches & Color Picker */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-400 mr-1 hidden sm:inline">Hazır Renkler:</span>
                  {PRESET_COLOR_SWATCHES.map((swatch) => {
                    const isSelected = categoryColors[selectedCategory].bg.toLowerCase() === swatch.bg.toLowerCase();

                    return (
                      <button
                        key={swatch.name}
                        id={`swatch-${selectedCategory}-${swatch.name}`}
                        type="button"
                        onClick={() => onUpdateColor(selectedCategory, swatch.bg, swatch.border, swatch.text)}
                        title={`${swatch.name} (${swatch.bg})`}
                        className={`group relative w-8 h-8 rounded-xl transition-all flex items-center justify-center border-2 ${
                          isSelected
                            ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-slate-900 border-white'
                            : 'hover:scale-105 border-black/20 hover:border-white/60'
                        }`}
                        style={{ backgroundColor: swatch.bg }}
                      >
                        {isSelected && <Check className="w-4 h-4 text-white drop-shadow-md" />}
                      </button>
                    );
                  })}

                  {/* Custom HTML Color Picker */}
                  <div className="relative flex items-center gap-1.5 pl-2 border-l border-slate-800">
                    <label
                      htmlFor={`custom-color-input-${selectedCategory}`}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs cursor-pointer border border-slate-700 transition-colors shadow-sm"
                      title="Özel Renk Seç"
                    >
                      <input
                        id={`custom-color-input-${selectedCategory}`}
                        type="color"
                        value={categoryColors[selectedCategory].bg}
                        onChange={(e) => {
                          const hex = e.target.value;
                          onUpdateColor(selectedCategory, hex, hex, '#ffffff');
                        }}
                        className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
                      />
                      <span className="font-medium">Özel Renk</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
