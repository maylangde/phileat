import { db } from '../db';
import type { Entry, Fast, FastingPlan, MealType, Pot, PotTake, Profile, Recipe } from '../types';
import { per100From, recipeTotals, scale } from './nutrition';
import { uid } from './util';
import type { Food } from '../types';

/* ---------- Fasten ---------- */

export async function startFast(p: Profile, start = Date.now()): Promise<Fast> {
  const f: Fast = { id: uid(), profileId: p.id, start, targetHours: p.fasting.fastHours || 16 };
  await db.fasts.put(f);
  return f;
}

export async function stopFast(f: Fast, end = Date.now()) {
  await db.fasts.put({ ...f, end });
}

export type Phase = { phase: 'eating' | 'fasting'; until: number; from: number };

/** Geplantes Essfenster für einen Tag laut Plan (nur Anzeige). */
export function planPhase(plan: FastingPlan, now = Date.now()): Phase | null {
  if (plan.protocol === 'off' || !plan.fastHours) return null;
  const [h, m] = plan.eatStart.split(':').map(Number);
  const eatMs = (24 - plan.fastHours) * 3600000;
  const d = new Date(now);
  const today = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).getTime();
  // Fenster von gestern, heute und morgen prüfen
  for (const offset of [-1, 0, 1]) {
    const start = today + offset * 86400000;
    const end = start + eatMs;
    if (now >= start && now < end) return { phase: 'eating', from: start, until: end };
    if (now >= end && now < start + 86400000) return { phase: 'fasting', from: end, until: start + 86400000 };
  }
  return null;
}

/* ---------- Töpfe ---------- */

export async function createPot(
  recipe: Recipe,
  foods: Map<string, Food>,
  cookedWeightG: number,
  name?: string,
): Promise<Pot> {
  const { total, rawG } = recipeTotals(recipe.ingredients, foods);
  const now = Date.now();
  const pot: Pot = {
    id: uid(),
    recipeId: recipe.id,
    name: name?.trim() || recipe.name,
    cookedAt: now,
    cookedWeightG,
    rawWeightG: rawG,
    total,
    updatedAt: now,
  };
  await db.pots.put(pot);
  return pot;
}

export const potPer100 = (pot: Pot) => per100From(pot.total, pot.cookedWeightG);

/** Eigene Portion aus dem Topf: legt Entnahme und Tagebucheintrag an. */
export async function takeFromPot(p: Profile, pot: Pot, grams: number, meal: MealType, date: string) {
  const now = Date.now();
  const take: PotTake = { id: uid(), potId: pot.id, profileId: p.id, grams, ts: now };
  const entry: Entry = {
    id: uid(),
    profileId: p.id,
    date,
    meal,
    ts: now,
    kind: 'pot',
    refId: pot.id,
    takeId: take.id,
    name: pot.name,
    grams,
    nutrients: scale(potPer100(pot), grams),
    updatedAt: now,
  };
  await db.transaction('rw', db.potTakes, db.entries, async () => {
    await db.potTakes.put(take);
    await db.entries.put(entry);
  });
}

/** Portion für jemand anderen (zählt nur gegen den Topf, nicht ins Tagebuch). */
export async function takeForOther(pot: Pot, grams: number) {
  await db.potTakes.put({ id: uid(), potId: pot.id, profileId: null, grams, ts: Date.now() });
}

export async function deleteTake(take: PotTake) {
  await db.transaction('rw', db.potTakes, db.entries, async () => {
    await db.entries.where('takeId').equals(take.id).delete();
    await db.potTakes.delete(take.id);
  });
}

export async function deletePot(pot: Pot) {
  await db.transaction('rw', db.pots, db.potTakes, db.entries, async () => {
    const takes = await db.potTakes.where('potId').equals(pot.id).toArray();
    for (const t of takes) await db.entries.filter((e) => e.takeId === t.id).delete();
    await db.potTakes.where('potId').equals(pot.id).delete();
    await db.pots.delete(pot.id);
  });
}

/** Eintrag im Tagebuch auf neue Grammzahl umrechnen. */
export async function updateEntryGrams(e: Entry, grams: number, meal: MealType) {
  if (!e.grams || e.grams <= 0) return;
  const factor = grams / e.grams;
  const nutrients = { ...e.nutrients };
  for (const k of Object.keys(nutrients) as (keyof typeof nutrients)[]) nutrients[k] = nutrients[k] * factor;
  await db.transaction('rw', db.entries, db.potTakes, async () => {
    await db.entries.put({ ...e, grams, meal, nutrients, updatedAt: Date.now() });
    if (e.takeId) await db.potTakes.update(e.takeId, { grams });
  });
}
