import Dexie, { liveQuery, type Table } from 'dexie';
import { useEffect, useState } from 'preact/hooks';
import type {
  Entry,
  Fast,
  Food,
  MetaRow,
  Pot,
  PotTake,
  Profile,
  Recipe,
  WaterEntry,
  WeightEntry,
  Workout,
} from './types';

class PhilEatDB extends Dexie {
  profiles!: Table<Profile, string>;
  foods!: Table<Food, string>;
  recipes!: Table<Recipe, string>;
  pots!: Table<Pot, string>;
  potTakes!: Table<PotTake, string>;
  entries!: Table<Entry, string>;
  fasts!: Table<Fast, string>;
  weights!: Table<WeightEntry, string>;
  water!: Table<WaterEntry, string>;
  workouts!: Table<Workout, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super('phileat');
    this.version(1).stores({
      profiles: 'id',
      foods: 'id,source,barcode',
      recipes: 'id,updatedAt',
      pots: 'id,cookedAt',
      potTakes: 'id,potId',
      entries: 'id,profileId,date,[profileId+date]',
      fasts: 'id,profileId,start',
      weights: 'id,profileId,date',
      water: 'id,profileId,date,[profileId+date]',
      workouts: 'id,profileId,date,[profileId+date]',
      meta: 'key',
    });
  }
}

export const db = new PhilEatDB();

/** Live-Abfrage: aktualisiert sich automatisch bei Änderungen in der Datenbank. */
export function useLive<T>(query: () => T | Promise<T>, deps: unknown[] = []): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);
  useEffect(() => {
    const sub = liveQuery(query).subscribe({
      next: (v) => setValue(v as T),
      error: (e) => console.error('liveQuery', e),
    });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await db.meta.get(key);
  return row?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown) {
  await db.meta.put({ key, value });
}

/* ---------- Sicherung ---------- */

const TABLES = [
  'profiles',
  'foods',
  'recipes',
  'pots',
  'potTakes',
  'entries',
  'fasts',
  'weights',
  'water',
  'workouts',
  'meta',
] as const;

export async function exportAll(): Promise<string> {
  const data: Record<string, unknown[]> = {};
  for (const name of TABLES) {
    data[name] = await (db[name] as Table).toArray();
  }
  return JSON.stringify({ app: 'phileat', version: 1, exportedAt: new Date().toISOString(), data });
}

export async function importAll(json: string): Promise<void> {
  const parsed = JSON.parse(json);
  if (parsed?.app !== 'phileat' || !parsed.data) throw new Error('Keine PhilEat-Sicherung');
  await db.transaction('rw', TABLES.map((n) => db[n] as Table), async () => {
    for (const name of TABLES) {
      const t = db[name] as Table;
      await t.clear();
      const rows = parsed.data[name];
      if (Array.isArray(rows) && rows.length) await t.bulkPut(rows);
    }
  });
}

/** Nur geteilbare Daten (Rezepte, eigene Lebensmittel) – für den manuellen Austausch. */
export async function exportShareable(): Promise<string> {
  const foods = await db.foods.where('source').notEqual('seed').toArray();
  const recipes = await db.recipes.toArray();
  return JSON.stringify({
    app: 'phileat-share',
    version: 1,
    exportedAt: new Date().toISOString(),
    foods,
    recipes: recipes.filter((r) => !r.seed),
  });
}

export async function importShareable(json: string): Promise<{ foods: number; recipes: number }> {
  const parsed = JSON.parse(json);
  if (parsed?.app !== 'phileat-share') throw new Error('Keine PhilEat-Austauschdatei');
  const foods: Food[] = (parsed.foods ?? []).filter((f: Food) => f?.id && f?.per100);
  const recipes: Recipe[] = (parsed.recipes ?? []).filter((r: Recipe) => r?.id && Array.isArray(r.ingredients));
  await db.transaction('rw', db.foods, db.recipes, async () => {
    // Bestehende Einträge mit neuerem Stand behalten
    for (const f of foods) {
      const old = await db.foods.get(f.id);
      if (!old || old.updatedAt < f.updatedAt) await db.foods.put(f);
    }
    for (const r of recipes) {
      const old = await db.recipes.get(r.id);
      if (!old || old.updatedAt < r.updatedAt) await db.recipes.put(r);
    }
  });
  return { foods: foods.length, recipes: recipes.length };
}

export async function resetAll() {
  await db.delete();
  location.reload();
}
