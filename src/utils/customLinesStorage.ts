// Demiryolu Hat Yönetimi Servisi (Kalıcı Özel Hatlar)
// Kullanıcı tarafından eklenen ve kayıtlı noktalardan otomatik toplanan hatlar

const SAVED_LINES_KEY = 'demiryolu_saved_custom_lines_v1';

export const DEFAULT_LINES_PRESET: string[] = [
  'Eskişehir-Konya',
];

export function getStoredLines(): string[] {
  try {
    const raw = localStorage.getItem(SAVED_LINES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((l) => typeof l === 'string' && l.trim().length > 0);
      }
    }
  } catch {}
  return [...DEFAULT_LINES_PRESET];
}

export function saveStoredLines(lines: string[]) {
  try {
    const cleanLines = Array.from(new Set(lines.map((l) => l.trim()).filter(Boolean)));
    localStorage.setItem(SAVED_LINES_KEY, JSON.stringify(cleanLines));
    try {
      window.dispatchEvent(new CustomEvent('demiryolu_lines_updated', { detail: cleanLines }));
    } catch {}
  } catch {}
}

export function addCustomLine(newLineName: string): string[] {
  const trimmed = newLineName.trim();
  if (!trimmed) return getStoredLines();
  const current = getStoredLines();
  if (!current.some((l) => l.toLowerCase() === trimmed.toLowerCase())) {
    current.push(trimmed);
    saveStoredLines(current);
  }
  return current;
}

export function removeCustomLine(lineToRemove: string): string[] {
  const current = getStoredLines().filter((l) => l.toLowerCase() !== lineToRemove.trim().toLowerCase());
  saveStoredLines(current);
  return current;
}
