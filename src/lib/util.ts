import type { MealType } from '../types';

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

const pad = (n: number) => String(n).padStart(2, '0');

/** Lokales Datum als YYYY-MM-DD (nicht UTC). */
export const dateStr = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseDate = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (s: string, n: number): string => {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return dateStr(d);
};

export const mealForNow = (d: Date = new Date()): MealType => {
  const h = d.getHours();
  if (h < 10) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 18) return 'snack';
  return 'dinner';
};

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const round = (v: number, digits = 0) => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};

export const fmt = (v: number, digits = 0): string =>
  (Number.isFinite(v) ? round(v, digits) : 0).toLocaleString('de-DE', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });

export const ageFromBirth = (birthDate: string, now: Date = new Date()): number => {
  const b = parseDate(birthDate);
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a;
};

/** Dauer in ms → "13 h 05 min" */
export const fmtDuration = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h} h ${pad(m)} min`;
};

export const fmtClock = (ts: number): string => {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Eingabe mit Komma oder Punkt in Zahl umwandeln. */
export const num = (v: string | number | undefined | null, fallback = 0): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  if (v == null) return fallback;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
};

export const normalize = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss');

export function downloadText(filename: string, text: string, type = 'application/json') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Teilt eine Datei über das Android-Teilen-Menü, sonst Download. */
export async function shareOrDownload(filename: string, text: string) {
  try {
    const file = new File([text], filename, { type: 'application/json' });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare && nav.canShare({ files: [file] })) {
      await nav.share({ files: [file], title: filename });
      return;
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return;
  }
  downloadText(filename, text);
}
