import type { Activity, Entry, Food, Goal, Nutrients, NutrientKey, Profile, RecipeIngredient, Sex, Targets } from '../types';
import { NUTRIENT_KEYS } from '../types';
import { ageFromBirth, clamp, round } from './util';
import { applyCooking, cookGroupOf } from './cooking';

export const zero = (): Nutrients => ({
  kcal: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  sugar: 0,
  fiber: 0,
  satFat: 0,
  sodium: 0,
  chol: 0,
});

export const add = (a: Nutrients, b: Nutrients): Nutrients => {
  const r = zero();
  for (const k of NUTRIENT_KEYS) r[k] = a[k] + b[k];
  return r;
};

/** Nährwerte pro 100 g auf eine Menge in Gramm umrechnen. */
export const scale = (per100: Nutrients, grams: number): Nutrients => {
  const r = zero();
  for (const k of NUTRIENT_KEYS) r[k] = (per100[k] * grams) / 100;
  return r;
};

export const sumEntries = (entries: Entry[]): Nutrients =>
  entries.reduce((acc, e) => add(acc, e.nutrients), zero());

export const per100From = (total: Nutrients, grams: number): Nutrients => {
  if (grams <= 0) return zero();
  return scale(total, 10000 / grams);
};

export function recipeTotals(
  ingredients: RecipeIngredient[],
  foods: Map<string, Food>,
): { total: Nutrients; rawG: number; missing: number } {
  let total = zero();
  let rawG = 0;
  let missing = 0;
  for (const ing of ingredients) {
    const f = foods.get(ing.foodId);
    if (!f) {
      missing++;
      continue;
    }
    // Zubereitung der Zutat (Fett-/Natriumverlust, Öl); das Endgewicht des Topfes wird später gewogen
    const cooked = ing.prep ? applyCooking(f.per100, cookGroupOf(f), ing.grams, { ...ing.prep, basis: 'raw' }) : null;
    total = add(total, cooked ? cooked.nutrients : scale(f.per100, ing.grams));
    rawG += ing.grams;
  }
  return { total, rawG, missing };
}

/* ---------- Zielberechnung ---------- */

const ACTIVITY_FACTOR: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};

/** Grundumsatz nach Mifflin-St Jeor (kcal/Tag). */
export const bmr = (sex: Sex, weightKg: number, heightCm: number, age: number): number =>
  10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'm' ? 5 : -161);

export const tdee = (p: Pick<Profile, 'sex' | 'heightCm' | 'birthDate' | 'activity'>, weightKg: number) =>
  bmr(p.sex, weightKg, p.heightCm, ageFromBirth(p.birthDate)) * ACTIVITY_FACTOR[p.activity];

export interface TargetInput {
  sex: Sex;
  heightCm: number;
  birthDate: string;
  activity: Activity;
  goal: Goal;
  weeklyRateKg: number;
  weightKg: number;
}

/**
 * Tagesziele. Richtwerte (WHO/DGE-orientiert), keine medizinische Beratung:
 * - Defizit: 7700 kcal je kg, höchstens 25 % des Gesamtumsatzes, Untergrenze 1200 (w) / 1500 (m)
 * - Eiweiß: 1,8 g/kg beim Abnehmen und Aufbau, sonst 1,2 g/kg
 * - Fett 30 % der Energie, Rest Kohlenhydrate
 * - Natrium 2000 mg, gesättigte Fette < 10 % der Energie, Cholesterin 300 mg
 */
export function calcTargets(i: TargetInput): Targets {
  const maintenance = tdee(i, i.weightKg);
  let kcal = maintenance;
  if (i.goal === 'lose') {
    const deficit = Math.min((i.weeklyRateKg * 7700) / 7, maintenance * 0.25);
    kcal = maintenance - deficit;
  } else if (i.goal === 'gain') {
    kcal = maintenance + 300;
  }
  kcal = Math.max(kcal, i.sex === 'm' ? 1500 : 1200);
  kcal = Math.round(kcal / 10) * 10;

  const proteinPerKg = i.goal === 'maintain' ? 1.2 : 1.8;
  const protein = Math.round(proteinPerKg * i.weightKg);
  const fat = Math.round((kcal * 0.3) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));

  return {
    kcal,
    protein,
    carbs,
    fat,
    sugar: Math.round((kcal * 0.1) / 4),
    fiber: i.sex === 'm' ? 30 : 25,
    satFat: Math.round((kcal * 0.1) / 9),
    sodium: 2000,
    chol: 300,
    waterMl: Math.round((i.weightKg * 35) / 50) * 50,
  };
}

/** Voraussichtliche Wochen bis zum Zielgewicht. */
export function weeksToGoal(current: number, goal: number, rate: number): number | null {
  if (!rate || rate <= 0) return null;
  const diff = Math.abs(current - goal);
  return Math.ceil(diff / rate);
}

/* ---------- Anzeige-Metriken ---------- */

export type MetricKind = 'budget' | 'goal' | 'limit';

export interface Metric {
  key: NutrientKey;
  kind: MetricKind;
  unit: string;
  color: string;
}

export const MACROS: Metric[] = [
  { key: 'protein', kind: 'goal', unit: 'g', color: 'var(--c-protein)' },
  { key: 'carbs', kind: 'budget', unit: 'g', color: 'var(--c-carbs)' },
  { key: 'fat', kind: 'budget', unit: 'g', color: 'var(--c-fat)' },
];

export const WATCH: Metric[] = [
  { key: 'sodium', kind: 'limit', unit: 'mg', color: 'var(--c-limit)' },
  { key: 'sugar', kind: 'limit', unit: 'g', color: 'var(--c-limit)' },
  { key: 'satFat', kind: 'limit', unit: 'g', color: 'var(--c-limit)' },
  { key: 'chol', kind: 'limit', unit: 'mg', color: 'var(--c-limit)' },
  { key: 'fiber', kind: 'goal', unit: 'g', color: 'var(--c-fiber)' },
];

/** Status einer Kennzahl für Farbgebung. */
export function statusOf(kind: MetricKind, value: number, target: number): 'ok' | 'warn' | 'over' {
  if (target <= 0) return 'ok';
  const r = value / target;
  if (kind === 'goal') return 'ok';
  if (r > 1) return 'over';
  if (r > 0.85) return 'warn';
  return 'ok';
}

export const pct = (value: number, target: number) =>
  target > 0 ? clamp(round((value / target) * 100), 0, 999) : 0;
