import { signal } from '@preact/signals';

export type MenuPos = 'left' | 'center' | 'right';

const KEY = 'menuPos';

const read = (): MenuPos => {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'left' || v === 'center' || v === 'right') return v;
  } catch {
    /* Speicher nicht verfügbar */
  }
  return 'right';
};

/** Wo das runde Menü unten sitzt. */
export const menuPos = signal<MenuPos>(read());

export function setMenuPos(p: MenuPos) {
  menuPos.value = p;
  try {
    localStorage.setItem(KEY, p);
  } catch {
    /* Speicher nicht verfügbar */
  }
}

export type ThemePref = 'light' | 'dark' | 'system';

const THEME_KEY = 'theme';

const readTheme = (): ThemePref => {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* Speicher nicht verfügbar */
  }
  return 'light';
};

/** Darstellung: Standard ist hell, unabhängig vom Dunkelmodus des Handys. */
export const themePref = signal<ThemePref>(readTheme());

const dark = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

/** Setzt das Thema am <html>-Element und die Farbe der Systemleiste. */
export function applyTheme() {
  const isDark = themePref.value === 'dark' || (themePref.value === 'system' && !!dark?.matches);
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', isDark ? '#14161d' : '#ffffff');
}

export function setTheme(p: ThemePref) {
  themePref.value = p;
  try {
    localStorage.setItem(THEME_KEY, p);
  } catch {
    /* Speicher nicht verfügbar */
  }
  applyTheme();
}

export function initTheme() {
  applyTheme();
  dark?.addEventListener('change', () => themePref.value === 'system' && applyTheme());
}
