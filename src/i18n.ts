import { signal } from '@preact/signals';
import type { Food, Lang, MealType } from './types';
import { DICT } from './i18n-dict';

export const lang = signal<Lang>(
  (typeof localStorage !== 'undefined' && (localStorage.getItem('lang') as Lang)) ||
    (typeof navigator !== 'undefined' && navigator.language?.startsWith('en') ? 'en' : 'de'),
);

export function setLang(l: Lang) {
  lang.value = l;
  try {
    localStorage.setItem('lang', l);
  } catch {
    /* Speicher nicht verfügbar */
  }
  document.documentElement.lang = l;
}

/** Übersetzt einen Schlüssel. `{name}`-Platzhalter werden aus `vars` ersetzt. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const dict = DICT[lang.value];
  let s = dict[key] ?? DICT.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export const foodName = (f: Pick<Food, 'name'>): string => {
  if (lang.value === 'de') return f.name.de ?? f.name.en;
  return f.name.en;
};

/** Zweitname (Filipino) als Zusatz, falls abweichend. */
export const foodAlt = (f: Pick<Food, 'name'>): string => {
  const main = foodName(f);
  const alt = f.name.fil && f.name.fil !== main ? f.name.fil : '';
  return alt;
};

export const mealName = (m: MealType) => t('meal.' + m);

export const unitName = (label: string): string => {
  const key = 'unit.' + label;
  const dict = DICT[lang.value];
  return dict[key] ?? DICT.en[key] ?? label;
};
