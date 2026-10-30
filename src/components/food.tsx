import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { CookGroup, CookLevel, CookMethod, Food, MealType, Nutrients, OilType, Prep, Unit } from '../types';
import { MEALS } from '../types';
import { foodAlt, foodName, mealName, t, unitName } from '../i18n';
import { scale } from '../lib/nutrition';
import { applyCooking, cookGroupOf, methodsFor } from '../lib/cooking';
import { PrepPanel } from './prep-panel';
import { fmt, num } from '../lib/util';
import { frequentFoods, searchFoods } from '../lib/foods';
import { useLive } from '../db';
import { profile } from '../store';
import { Chips, Icon, NumInput, Sheet, useDebounced } from './ui';
import { go } from '../router';

export interface AmountTarget {
  key: string;
  name: string;
  per100: Nutrients;
  units: Unit[];
  /** Essbarer Anteil in %, wenn mit Knochen gewogen */
  ediblePct?: number;
  /** Garverhalten; 'none' oder leer = keine Zubereitung wählbar */
  cookGroup?: CookGroup;
}

export const targetFromFood = (f: Food): AmountTarget => ({
  key: f.id,
  name: foodName(f),
  per100: f.per100,
  units: f.units,
  ediblePct: f.ediblePct,
  cookGroup: cookGroupOf(f),
});

/** Ergebnis einer Zubereitung, die zusammen mit der Menge bestätigt wird. */
export interface ConfirmExtra {
  nutrients: Nutrients;
  /** Kurzbezeichnung der Garart für Tagebuch und Rezept */
  label: string;
  prep: Prep;
}

/** Kompakte Nährwertzeile: kcal, E, KH, F */
export function MacroLine({ n }: { n: Nutrients }) {
  return (
    <span class="macro-line">
      <b>{fmt(n.kcal)}</b> kcal · {t('short.protein')} {fmt(n.protein, 1)} · {t('short.carbs')} {fmt(n.carbs, 1)} · {t('short.fat')} {fmt(n.fat, 1)}
    </span>
  );
}

/** Menge wählen (Gramm oder Haushaltsmaß) mit Live-Vorschau. */
export function AmountSheet({
  target,
  onClose,
  onConfirm,
  confirmLabel,
  initialGrams,
  showMeal = true,
  meal: initialMeal,
  maxGrams,
  extra,
  initialPrep,
  recipeMode = false,
}: {
  target: AmountTarget | null;
  onClose: () => void;
  onConfirm: (grams: number, meal: MealType, extra?: ConfirmExtra) => void;
  confirmLabel: string;
  initialGrams?: number;
  showMeal?: boolean;
  meal?: MealType;
  maxGrams?: number;
  extra?: ComponentChildren;
  /** Bereits gewählte Zubereitung (beim Bearbeiten einer Zutat) */
  initialPrep?: Prep;
  /** Zutat in einem Rezept: Gewicht ist immer roh, Öl wird als eigene Zutat erfasst */
  recipeMode?: boolean;
}) {
  const [unitIdx, setUnitIdx] = useState(0);
  const [qty, setQty] = useState('100');
  const [meal, setMeal] = useState<MealType>(initialMeal ?? 'lunch');
  const [withBone, setWithBone] = useState(false);
  const [method, setMethod] = useState<CookMethod | null>(null);
  const [level, setLevel] = useState<CookLevel>('normal');
  const [basis, setBasis] = useState<'raw' | 'cooked'>('raw');
  const [oilStr, setOilStr] = useState<string | null>(null);
  const [oilType, setOilType] = useState<OilType>('veg');

  useEffect(() => {
    if (!target) return;
    setWithBone(false);
    setMethod(initialPrep?.method ?? null);
    setLevel(initialPrep?.level ?? 'normal');
    setBasis(initialPrep?.basis ?? 'raw');
    setOilStr(initialPrep ? (initialPrep.oilG != null ? String(initialPrep.oilG) : null) : recipeMode ? '0' : null);
    setOilType(initialPrep?.oil ?? 'veg');
    if (initialGrams != null) {
      setUnitIdx(0);
      setQty(String(Math.round(initialGrams * 10) / 10));
    } else if (target.units.length) {
      setUnitIdx(1);
      setQty('1');
    } else {
      setUnitIdx(0);
      setQty('100');
    }
    if (initialMeal) setMeal(initialMeal);
  }, [target?.key]);

  if (!target) return null;
  const units: Unit[] = [{ label: 'g', grams: 1 }, ...target.units];
  const unit = units[Math.min(unitIdx, units.length - 1)];
  // Mit Knochen gewogen: nur der essbare Anteil zählt (nur bei Eingabe in Gramm)
  const boneOption = !!target.ediblePct && unit.label === 'g' && initialGrams == null;
  const edible = boneOption && withBone ? target.ediblePct! / 100 : 1;
  const grams = num(qty) * unit.grams * edible;

  // Zubereitung: Gramm beziehen sich je nach Auswahl auf rohes oder gegartes Gewicht
  const group = target.cookGroup ?? 'none';
  const methods = methodsFor(group);
  const prep: Prep | null =
    method && methods.includes(method)
      ? {
          method,
          level,
          basis: recipeMode ? 'raw' : basis,
          oilG: oilStr === null || oilStr.trim() === '' ? undefined : num(oilStr),
          oil: oilType,
        }
      : null;
  const cook = prep ? applyCooking(target.per100, group, grams, prep) : null;
  const n = cook ? cook.nutrients : scale(target.per100, grams);
  const per100Cooked = cook && cook.cookedG > 0 ? (cook.nutrients.kcal / cook.cookedG) * 100 : null;

  return (
    <Sheet open onClose={onClose} title={target.name}>
      <div class="amount">
        <div class="amount-input">
          <NumInput value={qty} onInput={(e) => setQty((e.target as HTMLInputElement).value)} aria-label={t('amount')} autofocus />
          <span class="amount-unit">{unit.label === 'g' ? 'g' : unitName(unit.label)}</span>
        </div>
        {units.length > 1 && (
          <Chips
            value={unitIdx}
            onChange={(v) => {
              // Menge beim Wechsel sinnvoll vorbelegen
              setUnitIdx(v);
              setQty(v === 0 ? String(Math.round(grams) || 100) : '1');
            }}
            options={units.map((u, i) => ({
              value: i,
              label: u.label === 'g' ? 'g' : `${unitName(u.label)} (${u.grams} g)`,
            }))}
          />
        )}
        {boneOption && (
          <button type="button" class={'chip bone' + (withBone ? ' on' : '')} onClick={() => setWithBone(!withBone)}>
            🦴 {t('amount.withBone', { p: target.ediblePct! })}
          </button>
        )}
        <div class="amount-total">{grams > 0 && (unit.label !== 'g' || edible !== 1) ? `= ${fmt(grams, 1)} g${edible !== 1 ? ' ' + t('amount.edible') : ''}` : ''}</div>
        {methods.length > 0 && (
          <PrepPanel
            methods={methods}
            method={prep ? prep.method : null}
            onMethod={setMethod}
            level={level}
            onLevel={setLevel}
            basis={basis}
            onBasis={setBasis}
            allowBasis={!recipeMode}
            oilStr={oilStr}
            onOil={setOilStr}
            oilType={oilType}
            onOilType={setOilType}
            cook={cook}
            per100Cooked={per100Cooked}
          />
        )}
        <div class="amount-preview">
          <div>
            <b>{fmt(n.kcal)}</b>
            <span>kcal</span>
          </div>
          <div>
            <b>{fmt(n.protein, 1)}</b>
            <span>{t('short.protein')}</span>
          </div>
          <div>
            <b>{fmt(n.carbs, 1)}</b>
            <span>{t('short.carbs')}</span>
          </div>
          <div>
            <b>{fmt(n.fat, 1)}</b>
            <span>{t('short.fat')}</span>
          </div>
        </div>
        <div class="amount-sub">
          {t('nutrient.sodium')} {fmt(n.sodium)} mg · {t('nutrient.sugar')} {fmt(n.sugar, 1)} g · {t('nutrient.fiber')} {fmt(n.fiber, 1)} g
        </div>
        {maxGrams != null && grams > maxGrams && <div class="note warn">{t('pot.over', { g: fmt(maxGrams) })}</div>}
        {showMeal && (
          <Chips value={meal} onChange={setMeal} options={MEALS.map((m) => ({ value: m, label: mealName(m) }))} />
        )}
        <button
          class="btn primary block"
          disabled={!(grams > 0)}
          onClick={() => onConfirm(grams, meal, cook && prep ? { nutrients: cook.nutrients, label: t('prep.' + prep.method), prep } : undefined)}
        >
          {confirmLabel}
        </button>
        {extra}
      </div>
    </Sheet>
  );
}

export function FoodRow({ f, onClick }: { f: Food; onClick: () => void }) {
  const alt = foodAlt(f);
  return (
    <button class="row-item" onClick={onClick}>
      <div class="row-main">
        <div class="row-title">
          {foodName(f)}
          {f.source === 'user' && <span class="tag">{t('tag.own')}</span>}
          {f.source === 'off' && <span class="tag">OFF</span>}
        </div>
        <div class="row-sub">
          {alt && <span>{alt} · </span>}
          {f.brand && <span>{f.brand} · </span>}
          {fmt(f.per100.kcal)} kcal / 100 g
          {f.estimate && f.source === 'seed' ? ' ≈' : ''}
        </div>
      </div>
      <Icon name="plus" size={20} />
    </button>
  );
}

/** Suche mit Häufig-Liste. */
export function FoodSearch({
  foods,
  onPick,
  autoFocus = true,
  createQuery = true,
}: {
  foods: Food[];
  onPick: (f: Food) => void;
  autoFocus?: boolean;
  createQuery?: boolean;
}) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const byId = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  const p = profile.value;
  const frequent = useLive(() => (p ? frequentFoods(p.id, byId) : []), [p?.id, byId.size]) ?? [];
  const results = useMemo(() => searchFoods(foods, dq), [foods, dq]);

  return (
    <div>
      <div class="search">
        <Icon name="search" size={20} />
        <input
          type="search"
          value={q}
          placeholder={t('search.placeholder')}
          onInput={(e) => setQ((e.target as HTMLInputElement).value)}
          autofocus={autoFocus}
          enterkeyhint="search"
        />
      </div>
      {!dq.trim() && frequent.length > 0 && <h3 class="list-title">{t('search.frequent')}</h3>}
      {!dq.trim() && frequent.length === 0 && <p class="muted center">{t('search.hint')}</p>}
      <div class="list">
        {(dq.trim() ? results : frequent).map((f) => (
          <FoodRow key={f.id} f={f} onClick={() => onPick(f)} />
        ))}
      </div>
      {dq.trim() && results.length === 0 && <p class="muted center">{t('search.none')}</p>}
      {createQuery && (
        <button class="btn block ghost" onClick={() => go('/food/new' + (dq.trim() ? '?name=' + encodeURIComponent(dq.trim()) : ''))}>
          <Icon name="plus" size={18} /> {t('food.create')}
        </button>
      )}
    </div>
  );
}
