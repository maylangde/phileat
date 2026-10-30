import { db } from '../db';
import type { Entry, Food, MealType, Nutrients, Profile } from '../types';
import { foodName } from '../i18n';
import { normalize, uid } from './util';
import { scale } from './nutrition';

/** Sucht in allen Namen (Englisch, Filipino, Deutsch) und in der Marke. */
export function searchFoods(all: Food[], query: string, limit = 60): Food[] {
  const q = normalize(query.trim());
  if (!q) return [];
  const tokens = q.split(/\s+/).filter(Boolean);
  const scored: [number, Food][] = [];
  for (const f of all) {
    const names = [f.name.en, f.name.fil, f.name.de, f.brand].filter(Boolean).map((s) => normalize(s as string));
    const hay = names.join(' | ');
    if (!tokens.every((tk) => hay.includes(tk))) continue;
    let score = 0;
    for (const n of names) {
      if (n === q) score = Math.max(score, 100);
      else if (n.startsWith(q)) score = Math.max(score, 80);
      else if (n.split(/[\s,(]+/).some((w) => w.startsWith(q))) score = Math.max(score, 60);
      else score = Math.max(score, 30);
    }
    if (f.source !== 'seed') score += 15;
    // Bei gleicher Trefferqualität bleibt die Reihenfolge der Datenbank (Teile nach Tier gruppiert)
    scored.push([score, f]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  return scored.slice(0, limit).map((s) => s[1]);
}

/** Häufig und zuletzt gegessene Lebensmittel (letzte 60 Tage). */
export async function frequentFoods(profileId: string, all: Map<string, Food>, limit = 25): Promise<Food[]> {
  const since = Date.now() - 60 * 86400000;
  const entries = await db.entries.where('profileId').equals(profileId).filter((e) => e.kind === 'food' && e.ts > since).toArray();
  const stats = new Map<string, { n: number; last: number }>();
  for (const e of entries) {
    if (!e.refId) continue;
    const s = stats.get(e.refId) ?? { n: 0, last: 0 };
    s.n++;
    s.last = Math.max(s.last, e.ts);
    stats.set(e.refId, s);
  }
  return [...stats.entries()]
    .sort((a, b) => b[1].n * 2 + b[1].last / 1e12 - (a[1].n * 2 + a[1].last / 1e12))
    .map(([id]) => all.get(id))
    .filter((f): f is Food => !!f)
    .slice(0, limit);
}

export async function logFood(
  p: Profile,
  food: Pick<Food, 'id' | 'per100'> & { name: Food['name'] },
  grams: number,
  meal: MealType,
  date: string,
  /** Ergebnis der Zubereitung (Nährwerte nach dem Garen) statt Tabellenwert */
  cooked?: { nutrients: Nutrients; label: string },
): Promise<Entry> {
  const now = Date.now();
  const e: Entry = {
    id: uid(),
    profileId: p.id,
    date,
    meal,
    ts: now,
    kind: 'food',
    refId: food.id,
    // „…, roh“ entfällt, wenn eine Garart gewählt wurde
    name: cooked ? `${foodName(food).replace(/,\s*(roh|raw|trocken|dry)$/i, '')} · ${cooked.label}` : foodName(food),
    grams,
    nutrients: cooked ? cooked.nutrients : scale(food.per100, grams),
    updatedAt: now,
  };
  await db.entries.put(e);
  return e;
}

export async function logQuick(p: Profile, name: string, nutrients: Nutrients, meal: MealType, date: string) {
  const now = Date.now();
  const e: Entry = { id: uid(), profileId: p.id, date, meal, ts: now, kind: 'quick', name, nutrients, updatedAt: now };
  await db.entries.put(e);
  return e;
}

/** Löscht einen Tagebucheintrag; Entnahmen aus einem Topf werden mit zurückgegeben. */
export async function deleteEntry(e: Entry) {
  await db.transaction('rw', db.entries, db.potTakes, async () => {
    if (e.takeId) await db.potTakes.delete(e.takeId);
    await db.entries.delete(e.id);
  });
}

export function newFood(partial: Partial<Food> = {}): Food {
  const now = Date.now();
  return {
    id: 'u-' + uid(),
    name: { en: '' },
    category: 'custom',
    per100: { kcal: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, fiber: 0, satFat: 0, sodium: 0, chol: 0 },
    units: [],
    source: 'user',
    estimate: false,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}
