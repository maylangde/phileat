import { useEffect, useMemo, useState } from 'preact/hooks';
import { go, route } from '../router';
import { t } from '../i18n';
import type { MenuPos } from '../prefs';
import { Icon } from './ui';

export interface DialItem {
  to: string;
  icon: string;
  label: string;
  /** Hervorgehobene Aktion (z. B. Essen hinzufügen) statt einer Seite */
  accent?: boolean;
  match: (path: string) => boolean;
}

const ITEM = 60;

/** Winkel (Grad, 0 = rechts, 90 = oben) von erstem bis letztem Eintrag je Position. */
const ARC: Record<MenuPos, [number, number]> = {
  center: [160, 20],
  right: [178, 92],
  left: [88, 2],
};

/** Abstand so, dass sich benachbarte Einträge nicht berühren. */
function layout(pos: MenuPos, n: number) {
  const [start, end] = ARC[pos];
  const step = (start - end) / Math.max(1, n - 1);
  const radius = Math.max(112, (ITEM + 6) / (2 * Math.sin((step * Math.PI) / 360)));
  return Array.from({ length: n }, (_, i) => {
    const a = ((start - step * i) * Math.PI) / 180;
    return { dx: Math.cos(a) * radius, dy: -Math.sin(a) * radius };
  });
}

/**
 * Rundes Menü: ein Drehknopf unten, der sich beim Tippen zu einem Fächer aus Einträgen öffnet.
 * Sitzt links, mittig oder rechts, damit der Daumen es gut erreicht.
 * Angelehnt an „Futuristic Dial Button“ von LukyVJ (https://codepen.io/LukyVj/pen/xxyEYMJ).
 */
export function Dial({ items, pos }: { items: DialItem[]; pos: MenuPos }) {
  const [open, setOpen] = useState(false);
  const path = route.value.path;
  const spots = useMemo(() => layout(pos, items.length), [pos, items.length]);

  // Beim Seitenwechsel schließen
  useEffect(() => setOpen(false), [path]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const pages = items.filter((i) => !i.accent);
  const pageIdx = Math.max(0, pages.findIndex((i) => i.match(path)));
  const current = pages[pageIdx] ?? pages[0];
  const tick = pages.length > 1 ? -120 + (240 / (pages.length - 1)) * pageIdx : 0;

  const toggle = () => {
    navigator.vibrate?.(8);
    setOpen(!open);
  };

  return (
    <>
      {open && <div class="dial-scrim" onClick={() => setOpen(false)} />}
      <div class={`dial pos-${pos}` + (open ? ' open' : '')} role="menu" aria-label={t('menu.title')}>
        {items.map((it, i) => (
          <button
            key={it.to}
            role="menuitem"
            class={'dial-item' + (it.accent ? ' accent' : '') + (!it.accent && it.match(path) ? ' on' : '')}
            style={{ '--dx': spots[i].dx.toFixed(1) + 'px', '--dy': spots[i].dy.toFixed(1) + 'px', '--i': i }}
            aria-current={!it.accent && it.match(path) ? 'page' : undefined}
            tabIndex={open ? 0 : -1}
            onClick={() => {
              navigator.vibrate?.(8);
              setOpen(false);
              go(it.to);
            }}
          >
            <Icon name={it.icon} size={22} />
            <span>{t(it.label)}</span>
          </button>
        ))}
        <button class="dial-knob" onClick={toggle} aria-expanded={open} aria-haspopup="menu" aria-label={open ? t('menu.close') : t('menu.open')}>
          <span class="dial-tick" style={{ '--tick': tick + 'deg' }} />
          <Icon name={open ? 'x' : current.icon} size={24} />
        </button>
      </div>
    </>
  );
}
