import { RailwayPointCategory } from '../types.ts';

export interface CategoryColorConfig {
  bg: string;
  border: string;
  text: string;
  label: string;
  shortLabel: string;
  svgIcon: string;
}

export const PRESET_COLOR_SWATCHES = [
  { name: 'Kırmızı', bg: '#ef4444', border: '#b91c1c', text: '#ffffff' },
  { name: 'Mavi', bg: '#2563eb', border: '#1d4ed8', text: '#ffffff' },
  { name: 'Sarı', bg: '#eab308', border: '#ca8a04', text: '#78350f' },
  { name: 'Yeşil', bg: '#16a34a', border: '#15803d', text: '#ffffff' },
  { name: 'Turuncu', bg: '#f97316', border: '#c2410c', text: '#ffffff' },
  { name: 'Mor', bg: '#8b5cf6', border: '#6d28d9', text: '#ffffff' },
  { name: 'Pembe', bg: '#ec4899', border: '#be185d', text: '#ffffff' },
  { name: 'Camgöbeği', bg: '#06b6d4', border: '#0891b2', text: '#ffffff' },
  { name: 'Koyu Lacivert', bg: '#1e3a8a', border: '#172554', text: '#ffffff' },
  { name: 'Slate Gri', bg: '#64748b', border: '#334155', text: '#ffffff' },
];

export const DEFAULT_CATEGORY_COLORS: Record<RailwayPointCategory, CategoryColorConfig> = {
  switch: {
    bg: '#ef4444', // Kırmızı (Kullanıcı isteği: Makaslar kırmızı)
    border: '#b91c1c',
    text: '#ffffff',
    label: 'Demiryolu Makasları',
    shortLabel: 'MKS',
    // Gerçek Demiryolu Makası (Çatal hat, makas dili ve traversler)
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="21" x2="5" y2="3"/><line x1="11" y1="21" x2="11" y2="3"/><path d="M5 14c3.5 0 9-3 14-8"/><line x1="3" y1="19" x2="13" y2="19"/><line x1="3" y1="13" x2="15" y2="13"/><line x1="3" y1="7" x2="13" y2="7"/><polyline points="15 3 20 3 20 8"/></svg>`,
  },
  km_marker: {
    bg: '#2563eb', // Mavi (Kullanıcı isteği: KM'ler mavi)
    border: '#1d4ed8',
    text: '#ffffff',
    label: 'KM Taşları & Metraj',
    shortLabel: 'KM',
    // Gerçek Demiryolu Kilometre Taşı (Taş kitabe, KM yazısı ve taban)
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V9a7 7 0 0 1 14 0v12Z"/><line x1="3" y1="21" x2="21" y2="21"/><path d="M7.5 10.5v3.5M7.5 12l2.5-1.5M7.5 12l2.5 1.5"/><path d="M12.5 14v-3.5l1.5 2 1.5-2v3.5"/><line x1="7" y1="17.5" x2="17" y2="17.5"/></svg>`,
  },
  crossing: {
    bg: '#eab308', // Sarı (Kullanıcı isteği: Geçitler sarı)
    border: '#ca8a04',
    text: '#78350f',
    label: 'Hemzemin Geçitler',
    shortLabel: 'GEÇİT',
    // Resmi Hemzemin Geçit Sembolü (Andre Haçı, Bariyer ve Flaşör Lambalar)
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="4" x2="20" y2="20"/><line x1="20" y1="4" x2="4" y2="20"/><line x1="2" y1="12" x2="22" y2="12"/><circle cx="12" cy="7" r="2.2" fill="currentColor"/><circle cx="12" cy="17" r="2.2" fill="currentColor"/></svg>`,
  },
  station: {
    bg: '#16a34a', // Yeşil
    border: '#15803d',
    text: '#ffffff',
    label: 'İstasyon & Garlar',
    shortLabel: 'GAR',
    // Demiryolu Gar Terminali (İstasyon Çatı Saati, Kemerli Giriş ve Peron)
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11L12 4L21 11V21H3V11Z"/><circle cx="12" cy="10" r="2.5"/><polyline points="12 9 12 10 13 10"/><path d="M9 21v-4a3 3 0 0 1 6 0v4"/><line x1="1" y1="21" x2="23" y2="21"/></svg>`,
  },
  bridge: {
    bg: '#8b5cf6', // Mor
    border: '#6d28d9',
    text: '#ffffff',
    label: 'Köprü & Viyadükler',
    shortLabel: 'KPR',
    // Demiryolu Viyadüğü (Üst ray tabliyesi ve kemerli viyadük ayakları)
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="5" x2="22" y2="5"/><line x1="2" y1="8" x2="22" y2="8"/><line x1="5" y1="3" x2="5" y2="5"/><line x1="12" y1="3" x2="12" y2="5"/><line x1="19" y1="3" x2="19" y2="5"/><path d="M2 21V12a4 4 0 0 1 8 0v9"/><path d="M12 21V12a4 4 0 0 1 8 0v9"/><line x1="22" y1="21" x2="2" y2="21"/></svg>`,
  },
  culvert: {
    bg: '#06b6d4', // Camgöbeği
    border: '#0891b2',
    text: '#ffffff',
    label: 'Menfez & Drenaj',
    shortLabel: 'MNF',
    // Demiryolu Kutu Menfezi (Hat dolgusu altı betonarme açıklık, su dalgası ve kanat duvarları)
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="4" x2="22" y2="4"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="18" y1="2" x2="18" y2="4"/><rect x="5" y="8" width="14" height="12" rx="1.5"/><path d="M8 13c1.2-.8 2.4-.8 3.5 0s2.3.8 3.5 0"/><path d="M8 17c1.2-.8 2.4-.8 3.5 0s2.3.8 3.5 0"/><path d="M5 10L2 15v5h3"/><path d="M19 10l3 5v5h-3"/></svg>`,
  },
  signal: {
    bg: '#f97316', // Turuncu
    border: '#c2410c',
    text: '#ffffff',
    label: 'Sinyaller & Elektrifikasyon',
    shortLabel: 'SNY',
    // Demiryolu Sinyal Direği (Sinyal fenerliği, 3 renk lamba ve konsol)
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="21" x2="17" y2="21"/><line x1="12" y1="21" x2="12" y2="3"/><rect x="13.5" y="3" width="7" height="13" rx="3.5" fill="none"/><circle cx="17" cy="5.5" r="1.5" fill="currentColor"/><circle cx="17" cy="9.5" r="1.5" fill="currentColor"/><circle cx="17" cy="13.5" r="1.5" fill="currentColor"/><line x1="12" y1="7" x2="13.5" y2="7"/></svg>`,
  },
  other: {
    bg: '#64748b', // Slate
    border: '#334155',
    text: '#ffffff',
    label: 'Diğer Hat & Ray Noktaları',
    shortLabel: 'RAY',
    // Gerçek Demiryolu Hattı (Çift ray ve traversler)
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="2" x2="6" y2="22"/><line x1="18" y1="2" x2="18" y2="22"/><line x1="3" y1="5" x2="21" y2="5"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="3" y1="20" x2="21" y2="20"/></svg>`,
  },
};

const STORAGE_KEY = 'railway_category_custom_colors';

export function loadCategoryColors(): Record<RailwayPointCategory, CategoryColorConfig> {
  if (typeof window === 'undefined') return DEFAULT_CATEGORY_COLORS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_CATEGORY_COLORS;
    const parsed = JSON.parse(stored);
    
    // Always preserve updated canonical svgIcon, label, and shortLabel
    const result: Record<RailwayPointCategory, CategoryColorConfig> = { ...DEFAULT_CATEGORY_COLORS };
    for (const key of Object.keys(DEFAULT_CATEGORY_COLORS) as RailwayPointCategory[]) {
      if (parsed && parsed[key]) {
        result[key] = {
          ...DEFAULT_CATEGORY_COLORS[key],
          bg: parsed[key].bg || DEFAULT_CATEGORY_COLORS[key].bg,
          border: parsed[key].border || DEFAULT_CATEGORY_COLORS[key].border,
          text: parsed[key].text || DEFAULT_CATEGORY_COLORS[key].text,
        };
      }
    }
    return result;
  } catch (err) {
    console.warn('Failed to load category colors from storage:', err);
    return DEFAULT_CATEGORY_COLORS;
  }
}

export function saveCategoryColors(colors: Record<RailwayPointCategory, CategoryColorConfig>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
  } catch (err) {
    console.warn('Failed to save category colors to storage:', err);
  }
}

/**
 * Extracts railway kilometer chainage from any free-form text
 * Matches patterns like "KM 142+250", "km: 94+000", "142+250", "KM 94", "km 120.400"
 */
export function extractKmFromText(text?: string | null): string {
  if (!text) return '';
  const trimmed = text.trim();

  // Pattern 1: Standard chainage with plus, e.g. "142+250" or "KM 142+250" or "028+750"
  const plusMatch = trimmed.match(/(?:KM\s*[:.-]?\s*)?(\d{1,4}\s*\+\s*\d{1,3})/i);
  if (plusMatch && plusMatch[1]) {
    return plusMatch[1].replace(/\s+/g, '');
  }

  // Pattern 2: KM followed by numbers with dot or dash, e.g. "KM 142.250" or "KM 142-250"
  const dotDashMatch = trimmed.match(/(?:KM\s*[:.-]?\s*)(\d{1,4})[.-](\d{3})\b/i);
  if (dotDashMatch && dotDashMatch[1] && dotDashMatch[2]) {
    return `${dotDashMatch[1]}+${dotDashMatch[2]}`;
  }

  // Pattern 3: Simple KM number, e.g. "KM 142" or "KM: 94"
  const simpleKmMatch = trimmed.match(/\bKM\s*[:.-]?\s*(\d{1,4})\b/i);
  if (simpleKmMatch && simpleKmMatch[1]) {
    return simpleKmMatch[1];
  }

  return '';
}

/**
 * Normalizes and formats railway kilometer chainage (e.g. "94+000", "142+250")
 * Can optionally fall back to extracting KM from title if kmValue is empty.
 * Prevents browser translation bugs where "94+" gets translated as "94 den fazla".
 */
export function formatKmDisplay(kmValue?: string | null, fallbackText?: string | null): string {
  if (kmValue && kmValue.trim()) {
    // Strip leading "KM", "Km", "km", ":", "-"
    const cleaned = kmValue.trim().replace(/^(?:km|km\.|km:)\s*/i, '').trim();
    if (cleaned) return cleaned;
  }

  if (fallbackText) {
    const extracted = extractKmFromText(fallbackText);
    if (extracted) return extracted;
  }

  return '';
}

/**
 * Returns clean badge text for map pins without cutting off into "94+.."
 */
export function getCleanBadgeText(kmValue?: string | null, fallbackLabel: string = 'KM', fallbackText?: string | null): string {
  const formatted = formatKmDisplay(kmValue, fallbackText);
  if (formatted) {
    return formatted.toLowerCase().startsWith('km') ? formatted : `KM ${formatted}`;
  }
  return fallbackLabel;
}
