import { signal } from '@preact/signals';
import { db, getMeta, setMeta } from './db';
import { SEED_FOODS, SEED_VERSION } from './data/foods';
import { SEED_RECIPES } from './data/recipes';
import type { Profile } from './types';
import { setLang } from './i18n';

export const profile = signal<Profile | null>(null);
export const ready = signal(false);

/** Beim Start: Start-Datenbank einspielen und das Profil laden. */
export async function boot() {
  await seedIfNeeded();
  const p = await db.profiles.toCollection().first();
  profile.value = p ?? null;
  if (p) setLang(p.lang);
  ready.value = true;
}

async function seedIfNeeded() {
  const seen = await getMeta<number>('seedVersion');
  if (seen !== SEED_VERSION) {
    await db.foods.bulkPut(SEED_FOODS);
    await setMeta('seedVersion', SEED_VERSION);
  }
  const recipesDone = await getMeta<boolean>('seedRecipes');
  if (!recipesDone) {
    const now = Date.now();
    await db.recipes.bulkPut(SEED_RECIPES.map((r) => ({ ...r, updatedAt: now })));
    await setMeta('seedRecipes', true);
  }
}

export async function saveProfile(p: Profile) {
  p.updatedAt = Date.now();
  await db.profiles.put(p);
  profile.value = p;
  setLang(p.lang);
}

/** Aktuelles Gewicht: letzter Wert aus dem Gewichtsverlauf, sonst Startgewicht. */
export async function currentWeight(p: Profile): Promise<number> {
  const last = await db.weights.where('profileId').equals(p.id).sortBy('date');
  return last.length ? last[last.length - 1].kg : p.startWeightKg;
}
