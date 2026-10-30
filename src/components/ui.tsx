import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import { back } from '../router';
import { t } from '../i18n';
import { clamp } from '../lib/util';

/* ---------- Icons ---------- */

const P: Record<string, string> = {
  home: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19a2 2 0 0 1 2-2h13',
  pot: 'M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM2 10h20M8 6c0-1.5 1-1.5 1-3M13 6c0-1.5 1-1.5 1-3',
  timer: 'M12 8v5l3 2M9 2h6M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  plus: 'M12 5v14M5 12h14',
  back: 'M15 5l-7 7 7 7',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5',
  scan: 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  check: 'M5 12l5 5 9-10',
  x: 'M6 6l12 12M18 6L6 18',
  drop: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  flame: 'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z',
  scale: 'M4 5h16v14H4zM8 9a4 4 0 0 1 8 0l-2 2h-4z',
  users: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 11a3 3 0 1 0-1-5.8M21 20a6 6 0 0 0-4-5.6',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.2 3H9.8l-.4 2.7a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.4 2.7h4.4l.4-2.7a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z',
  chart: 'M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-8',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  run: 'M13 4a2 2 0 1 0 0 .01M6 21l4-6 3 2 3-6-3-2-3 3-3-1M16 11l3 1',
  info: 'M12 8h.01M11 12h1v5h1M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  share: 'M12 3v12M8 7l4-4 4 4M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7',
  download: 'M12 4v11M8 11l4 4 4-4M5 20h14',
  upload: 'M12 16V5M8 9l4-4 4 4M5 20h14',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  bolt: 'M13 3L5 14h6l-1 7 8-11h-6z',
  warn: 'M12 4l9 16H3zM12 10v4M12 17h.01',
};

export function Icon({ name, size = 22 }: { name: keyof typeof P | string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.9"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d={P[name] ?? ''} />
    </svg>
  );
}

/* ---------- Seiten-Gerüst ---------- */

export function Page({
  title,
  back: showBack = true,
  right,
  children,
  noNav,
}: {
  title: string;
  back?: boolean | string;
  right?: ComponentChildren;
  children: ComponentChildren;
  noNav?: boolean;
}) {
  return (
    <div class={'page' + (noNav ? ' no-nav' : '')}>
      <header class="topbar">
        {showBack ? (
          <button class="icon-btn" onClick={() => back(typeof showBack === 'string' ? showBack : '/')} aria-label={t('back')}>
            <Icon name="back" />
          </button>
        ) : (
          <span class="icon-btn-spacer" />
        )}
        <h1>{title}</h1>
        <div class="topbar-right">{right}</div>
      </header>
      <main class="content">{children}</main>
    </div>
  );
}

export function Card({
  children,
  class: cls,
  onClick,
  title,
  action,
}: {
  children: ComponentChildren;
  class?: string;
  onClick?: () => void;
  title?: string;
  action?: ComponentChildren;
}) {
  return (
    <section class={'card ' + (cls ?? '') + (onClick ? ' tappable' : '')} onClick={onClick}>
      {title && (
        <div class="card-head">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Empty({ icon = 'info', text }: { icon?: string; text: string }) {
  return (
    <div class="empty">
      <Icon name={icon} size={30} />
      <p>{text}</p>
    </div>
  );
}

/* ---------- Diagramme ---------- */

export function Ring({
  value,
  max,
  size = 150,
  stroke = 14,
  color = 'var(--primary)',
  children,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ComponentChildren;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = max > 0 ? clamp(value / max, 0, 1) : 0;
  return (
    <div class="ring" style={{ width: size + 'px', height: size + 'px' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" stroke-width={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          stroke-width={stroke}
          stroke-linecap="round"
          stroke-dasharray={`${c * frac} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray .5s ease' }}
        />
      </svg>
      <div class="ring-center">{children}</div>
    </div>
  );
}

export function Bar({ value, max, color, over = false }: { value: number; max: number; color: string; over?: boolean }) {
  const w = max > 0 ? clamp((value / max) * 100, 0, 100) : 0;
  return (
    <div class="bar">
      <div class="bar-fill" style={{ width: w + '%', background: over ? 'var(--bad)' : color }} />
    </div>
  );
}

/* ---------- Formularelemente ---------- */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ComponentChildren;
}) {
  return (
    <label class="field">
      <span class="field-label">{label}</span>
      {children}
      {hint && <span class="field-hint">{hint}</span>}
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div class="segmented" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          class={o.value === value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chips<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div class="chips">
      {options.map((o) => (
        <button key={String(o.value)} type="button" class={'chip' + (o.value === value ? ' on' : '')} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

type InputProps = {
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  autofocus?: boolean;
  class?: string;
  'aria-label'?: string;
  onInput?: (e: Event) => void;
};
export function NumInput(props: InputProps) {
  return <input {...props} type="text" inputMode="decimal" autocomplete="off" />;
}

/* ---------- Bottom-Sheet ---------- */

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ComponentChildren;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
  if (!open) return null;
  return (
    <div class="sheet-wrap" onClick={onClose}>
      <div class="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div class="sheet-grip" />
        <div class="sheet-head">
          <h2>{title}</h2>
          <button class="icon-btn" onClick={onClose} aria-label={t('close')}>
            <Icon name="x" />
          </button>
        </div>
        <div class="sheet-body">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Toast & Bestätigung ---------- */

const toastMsg = signal<string>('');
let toastTimer: number | undefined;
export function toast(msg: string) {
  toastMsg.value = msg;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toastMsg.value = ''), 2200);
}

export function ToastHost() {
  if (!toastMsg.value) return null;
  return (
    <div class="toast" role="status">
      {toastMsg.value}
    </div>
  );
}

export function useConfirm() {
  const [ask, setAsk] = useState<{ msg: string; ok: () => void } | null>(null);
  const node = ask ? (
    <Sheet open onClose={() => setAsk(null)} title={t('confirm')}>
      <p style="margin:0 0 16px">{ask.msg}</p>
      <div class="row gap">
        <button class="btn" onClick={() => setAsk(null)}>
          {t('cancel')}
        </button>
        <button
          class="btn danger"
          onClick={() => {
            const f = ask.ok;
            setAsk(null);
            f();
          }}
        >
          {t('delete')}
        </button>
      </div>
    </Sheet>
  ) : null;
  return { confirm: (msg: string, ok: () => void) => setAsk({ msg, ok }), node };
}

/** Aktuelle Zeit, aktualisiert sich im Intervall (für Timer). */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useDebounced<T>(value: T, ms = 120): T {
  const [v, setV] = useState(value);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}
