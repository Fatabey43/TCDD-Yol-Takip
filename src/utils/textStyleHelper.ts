import { TextStyleConfig } from '../types.ts';

export const TEXT_COLOR_SWATCHES = [
  { name: 'Koyu Kömür', hex: '#0f172a' },
  { name: 'Demiryolu Mavisi', hex: '#1d4ed8' },
  { name: 'Kırmızı', hex: '#dc2626' },
  { name: 'Zümrüt Yeşili', hex: '#15803d' },
  { name: 'Kehribar / Turuncu', hex: '#d97706' },
  { name: 'Mor', hex: '#7e22ce' },
  { name: 'Slate Gri', hex: '#475569' },
];

export const FONT_FAMILY_OPTIONS = [
  { id: 'sans', label: 'Standart (Sans)', cssFont: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  { id: 'mono', label: 'Teknik Demiryolu (Mono)', cssFont: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace' },
  { id: 'serif', label: 'Klasik / Rapor (Serif)', cssFont: 'Georgia, Cambria, "Times New Roman", Times, serif' },
  { id: 'rounded', label: 'Yuvarlak / Rahat', cssFont: '"Nunito", "Quicksand", system-ui, sans-serif' },
] as const;

export const DEFAULT_TEXT_STYLE: TextStyleConfig = {
  color: '#0f172a',
  fontFamily: 'sans',
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
  lineHeight: 'normal',
  textAlign: 'left',
  fontSize: 'sm',
};

/**
 * Returns React inline style object corresponding to the TextStyleConfig
 */
export function getTextStyleInline(style?: TextStyleConfig): React.CSSProperties {
  if (!style) return {};

  const fontOption = FONT_FAMILY_OPTIONS.find((f) => f.id === style.fontFamily);

  const lineHeights = {
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.75',
  };

  const fontSizes = {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
  };

  return {
    color: style.color || undefined,
    fontFamily: fontOption ? fontOption.cssFont : undefined,
    fontWeight: style.fontWeight === 'bold' ? 700 : 400,
    fontStyle: style.fontStyle === 'italic' ? 'italic' : 'normal',
    textDecoration: style.textDecoration === 'underline' ? 'underline' : 'none',
    lineHeight: style.lineHeight ? lineHeights[style.lineHeight] : '1.5',
    textAlign: style.textAlign || 'left',
    fontSize: style.fontSize ? fontSizes[style.fontSize] : undefined,
  };
}
