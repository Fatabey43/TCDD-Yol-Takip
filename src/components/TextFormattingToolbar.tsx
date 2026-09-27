import React from 'react';
import { TextStyleConfig, FontFamilyType, LineHeightType, TextAlignType } from '../types.ts';
import { TEXT_COLOR_SWATCHES, FONT_FAMILY_OPTIONS } from '../utils/textStyleHelper.ts';
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
  Palette,
  AlignJustify,
} from 'lucide-react';

interface TextFormattingToolbarProps {
  style?: TextStyleConfig;
  value?: TextStyleConfig;
  onChange: (newStyle: TextStyleConfig) => void;
  className?: string;
  compact?: boolean;
  showAlignment?: boolean;
  showLineHeight?: boolean;
}

export const TextFormattingToolbar: React.FC<TextFormattingToolbarProps> = ({
  style,
  value,
  onChange,
  className = '',
  compact = false,
  showAlignment = true,
  showLineHeight = true,
}) => {
  const currentStyle: TextStyleConfig = value || style || {
    fontFamily: 'sans',
    fontWeight: 'normal',
    fontStyle: 'normal',
    textDecoration: 'none',
    color: '#0f172a',
    lineHeight: 'normal',
    textAlign: 'left',
  };

  const handleToggleBold = () => {
    onChange({
      ...currentStyle,
      fontWeight: currentStyle.fontWeight === 'bold' ? 'normal' : 'bold',
    });
  };

  const handleToggleItalic = () => {
    onChange({
      ...currentStyle,
      fontStyle: currentStyle.fontStyle === 'italic' ? 'normal' : 'italic',
    });
  };

  const handleToggleUnderline = () => {
    onChange({
      ...currentStyle,
      textDecoration: currentStyle.textDecoration === 'underline' ? 'none' : 'underline',
    });
  };

  const handleFontFamily = (family: FontFamilyType) => {
    onChange({
      ...currentStyle,
      fontFamily: family,
    });
  };

  const handleColor = (colorHex: string) => {
    onChange({
      ...currentStyle,
      color: colorHex,
    });
  };

  const handleLineHeight = (lh: LineHeightType) => {
    onChange({
      ...currentStyle,
      lineHeight: lh,
    });
  };

  const handleTextAlign = (align: TextAlignType) => {
    onChange({
      ...currentStyle,
      textAlign: align,
    });
  };

  return (
    <div
      className={`bg-slate-50 border border-slate-200/90 rounded-xl p-2 flex flex-wrap items-center gap-2 text-slate-700 shadow-2xs ${className}`}
    >
      {/* 1. Font Family Selector */}
      <div className="flex items-center gap-1">
        <Type className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
        <select
          id="text-font-family-select"
          value={currentStyle.fontFamily || 'sans'}
          onChange={(e) => handleFontFamily(e.target.value as FontFamilyType)}
          className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 font-medium focus:ring-1 focus:ring-sky-500 focus:outline-none cursor-pointer"
          title="Yazı Tipi / Font Seçin"
        >
          {FONT_FAMILY_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="h-4 w-px bg-slate-200" />

      {/* 2. Bold, Italic, Underline */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          id="btn-format-bold"
          onClick={handleToggleBold}
          className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
            currentStyle.fontWeight === 'bold'
              ? 'bg-sky-600 text-white shadow-xs font-bold'
              : 'hover:bg-slate-200 text-slate-700'
          }`}
          title="Kalın (Bold)"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          id="btn-format-italic"
          onClick={handleToggleItalic}
          className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
            currentStyle.fontStyle === 'italic'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'hover:bg-slate-200 text-slate-700'
          }`}
          title="İtalik (Eğik)"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          id="btn-format-underline"
          onClick={handleToggleUnderline}
          className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
            currentStyle.textDecoration === 'underline'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'hover:bg-slate-200 text-slate-700'
          }`}
          title="Altı Çizili"
        >
          <Underline className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="h-4 w-px bg-slate-200" />

      {/* 3. Text Color Selector & Swatches */}
      <div className="flex items-center gap-1.5">
        <Palette className="w-3.5 h-3.5 text-slate-400" />
        <div className="flex items-center gap-1">
          {TEXT_COLOR_SWATCHES.map((swatch) => {
            const isSelected = currentStyle.color?.toLowerCase() === swatch.hex.toLowerCase();
            return (
              <button
                key={swatch.name}
                type="button"
                onClick={() => handleColor(swatch.hex)}
                className={`w-4 h-4 rounded-full transition-transform border cursor-pointer ${
                  isSelected
                    ? 'scale-125 ring-2 ring-sky-500 ring-offset-1 border-white shadow-xs'
                    : 'border-slate-300 hover:scale-110'
                }`}
                style={{ backgroundColor: swatch.hex }}
                title={swatch.name}
              />
            );
          })}

          {/* HTML Color Picker */}
          <label
            className="w-4 h-4 rounded-full overflow-hidden cursor-pointer border border-slate-300 relative ml-0.5"
            title="Özel Yazı Rengi Seç"
          >
            <input
              type="color"
              value={currentStyle.color || '#0f172a'}
              onChange={(e) => handleColor(e.target.value)}
              className="absolute -top-2 -left-2 w-8 h-8 cursor-pointer opacity-0"
            />
            <div
              className="w-full h-full"
              style={{ backgroundColor: currentStyle.color || '#0f172a' }}
            />
          </label>
        </div>
      </div>

      {/* 4. Satır Şekli & Hizalama */}
      {showAlignment && (
        <>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleTextAlign('left')}
              className={`p-1 rounded text-xs transition-colors cursor-pointer ${
                currentStyle.textAlign === 'left' || !currentStyle.textAlign
                  ? 'bg-slate-200 text-sky-700 font-bold'
                  : 'hover:bg-slate-200 text-slate-600'
              }`}
              title="Sola Hizala"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => handleTextAlign('center')}
              className={`p-1 rounded text-xs transition-colors cursor-pointer ${
                currentStyle.textAlign === 'center'
                  ? 'bg-slate-200 text-sky-700 font-bold'
                  : 'hover:bg-slate-200 text-slate-600'
              }`}
              title="Ortala"
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => handleTextAlign('right')}
              className={`p-1 rounded text-xs transition-colors cursor-pointer ${
                currentStyle.textAlign === 'right'
                  ? 'bg-slate-200 text-sky-700 font-bold'
                  : 'hover:bg-slate-200 text-slate-600'
              }`}
              title="Sağa Hizala"
            >
              <AlignRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </>
      )}

      {/* Satır Aralığı (Line Height) */}
      {showLineHeight && !compact && (
        <select
          id="text-line-spacing-select"
          value={currentStyle.lineHeight || 'normal'}
          onChange={(e) => handleLineHeight(e.target.value as LineHeightType)}
          className="text-[11px] bg-white border border-slate-200 rounded px-1.5 py-1 text-slate-700 focus:ring-1 focus:ring-sky-500 focus:outline-none cursor-pointer"
          title="Satır Şekli / Satır Aralığı"
        >
          <option value="tight">Sıkışık Satır</option>
          <option value="normal">Normal Satır</option>
          <option value="relaxed">Geniş Satır</option>
        </select>
      )}
    </div>
  );
};
