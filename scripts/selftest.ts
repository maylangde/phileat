// Einfache Plausibilitätsprüfung der Daten und Rechenfunktionen (npm test).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SEED_FOODS } from '../src/data/foods';
import { SEED_RECIPES } from '../src/data/recipes';
import { DICT } from '../src/i18n-dict';
import { calcTargets, per100From, recipeTotals, scale } from '../src/lib/nutrition';
import { planPhase } from '../src/lib/actions';
import { applyCooking, COOK_GROUPS, cookGroupOf } from '../src/lib/cooking';
import type { CookLevel, CookMethod } from '../src/types';

let failures = 0;
const check = (ok: boolean, msg: string) => {
  if (!ok) {
    failures++;
    console.error('FAIL  ' + msg);
  }
};

/* Lebensmittel */
const ids = new Set<string>();
for (const f of SEED_FOODS) {
  check(!ids.has(f.id), `doppelte ID ${f.id}`);
  ids.add(f.id);
  const n = f.per100;
  // Atwater-Plausibilität: Energie ≈ 4*E + 4*KH + 2*Ballaststoffe + 9*F (Bier ausgenommen: Alkohol)
  const calc = 4 * n.protein + 4 * (n.carbs - n.fiber) + 2 * n.fiber + 9 * n.fat;
  if (n.kcal > 20 && f.id !== 's-beer') {
    const dev = Math.abs(calc - n.kcal) / n.kcal;
    check(dev < 0.35, `${f.id}: kcal ${n.kcal} vs. berechnet ${calc.toFixed(0)} (Abweichung ${(dev * 100).toFixed(0)} %)`);
  }
  check(n.sugar <= n.carbs + 0.5, `${f.id}: Zucker ${n.sugar} > Kohlenhydrate ${n.carbs}`);
  check(n.satFat <= n.fat + 0.5, `${f.id}: ges. Fett ${n.satFat} > Fett ${n.fat}`);
  check(n.protein + n.carbs + n.fat <= 101, `${f.id}: Makros > 100 g`);
  check(f.name.en.length > 0, `${f.id}: Name fehlt`);
  check(f.ediblePct == null || (f.ediblePct >= 20 && f.ediblePct < 100), `${f.id}: ungültiger essbarer Anteil`);
  for (const u of f.units) check(u.grams > 0 && !!u.label, `${f.id}: ungültiges Maß`);
}
console.log(`${SEED_FOODS.length} Lebensmittel geprüft`);

/* Rezepte */
const foodMap = new Map(SEED_FOODS.map((f) => [f.id, f]));
for (const r of SEED_RECIPES) {
  for (const i of r.ingredients) check(foodMap.has(i.foodId), `Rezept ${r.id}: Zutat ${i.foodId} fehlt`);
  const { total, rawG, missing } = recipeTotals(r.ingredients, foodMap);
  check(missing === 0, `Rezept ${r.id}: fehlende Zutaten`);
  console.log(`  ${r.name}: ${Math.round(rawG)} g roh, ${Math.round(total.kcal)} kcal`);
}

/* Übersetzungen */
const used = new Set<string>();
const walk = (dir: string) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(f)) {
      const src = readFileSync(p, 'utf8');
      for (const m of src.matchAll(/\bt\('([a-zA-Z0-9_.]+)'/g)) used.add(m[1]);
    }
  }
};
walk(join(import.meta.dirname, '..', 'src'));
const dynamic = [
  ...['breakfast', 'lunch', 'dinner', 'snack'].map((k) => 'meal.' + k),
  ...['kcal', 'protein', 'carbs', 'fat', 'sugar', 'fiber', 'satFat', 'sodium', 'chol', 'water'].map((k) => 'nutrient.' + k),
  ...['sedentary', 'light', 'moderate', 'active'].map((k) => 'activity.' + k),
  ...['walk', 'run', 'bike', 'strength', 'swim'].map((k) => 'workout.' + k),
  ...['today', 'diary', 'cook', 'fasting', 'more'].map((k) => 'tab.' + k),
  'target.limit',
  'target.min',
  'fab.add',
  ...['boil', 'steam', 'grill', 'bake', 'panfry', 'deepfry', 'airfry', 'stew', 'microwave', 'short', 'normal', 'long'].map((k) => 'prep.' + k),
  ...['veg', 'coconut', 'palm', 'butter'].map((k) => 'prep.oil.' + k),
  ...['none', ...COOK_GROUPS].map((k) => 'group.' + k),
];
for (const f of SEED_FOODS) for (const u of f.units) dynamic.push('unit.' + u.label);
for (const k of [...used, ...dynamic]) {
  if (k.endsWith('.')) continue;
  check(k in DICT.de, `Übersetzung DE fehlt: ${k}`);
  check(k in DICT.en, `Übersetzung EN fehlt: ${k}`);
}
for (const k of Object.keys(DICT.de)) check(k in DICT.en, `nur in DE vorhanden: ${k}`);
for (const k of Object.keys(DICT.en)) check(k in DICT.de, `nur in EN vorhanden: ${k}`);
console.log(`${used.size} Schlüssel im Code, ${Object.keys(DICT.de).length} im Wörterbuch`);

/* Rechenfunktionen */
const rice = foodMap.get('s-rice-white-cooked')!;
check(Math.abs(scale(rice.per100, 200).kcal - 260) < 0.001, 'scale(): 200 g Reis = 260 kcal');
const t1 = calcTargets({ sex: 'm', heightCm: 180, birthDate: '1990-06-15', activity: 'light', goal: 'lose', weeklyRateKg: 0.5, weightKg: 90 });
check(t1.kcal > 1800 && t1.kcal < 2500, `Ziel kcal plausibel (${t1.kcal})`);
check(t1.protein === 162, `Eiweiß 1,8 g/kg (${t1.protein})`);
const t2 = calcTargets({ sex: 'f', heightCm: 150, birthDate: '2000-01-01', activity: 'sedentary', goal: 'lose', weeklyRateKg: 0.75, weightKg: 45 });
check(t2.kcal >= 1200, `Mindestkalorien Frau (${t2.kcal})`);
const pot = recipeTotals(SEED_RECIPES[0].ingredients, foodMap);
const per100 = per100From(pot.total, 900);
check(Math.abs(per100.kcal * 9 - pot.total.kcal) < 0.01, 'per100From(): Topf 900 g');

/* Garmodell: Vorhersage gegen die gegarten Einträge der Datenbank (Energie und Eiweiß je 100 g gegart) */
const cal: [string, string, CookMethod][] = [
  ['chicken-breast-raw', 'chicken-breast-cooked', 'bake'],
  ['chicken-breast-skin-raw', 'chicken-breast-skin-cooked', 'bake'],
  ['chicken-thigh-skin-raw', 'chicken-thigh-skin-cooked', 'bake'],
  ['chicken-thigh-raw', 'chicken-thigh-cooked', 'bake'],
  ['chicken-drumstick-skin-raw', 'chicken-drumstick-skin-cooked', 'bake'],
  ['chicken-drumstick-raw', 'chicken-drumstick-cooked', 'bake'],
  ['chicken-wings-raw', 'chicken-wings-cooked', 'bake'],
  ['chicken-liver-raw', 'chicken-liver-cooked', 'boil'],
  ['rice-white-raw', 'rice-white-cooked', 'boil'],
  ['rice-brown-raw', 'rice-brown-cooked', 'boil'],
  ['pasta-raw', 'pasta-cooked', 'boil'],
  ['mung-dry', 'mung-cooked', 'boil'],
  ['egg-raw', 'egg-fried', 'panfry'],
  ['potato-raw', 'potato-boiled', 'boil'],
  ['kamote-raw', 'kamote-boiled', 'boil'],
];
for (const [rawId, cookedId, method] of cal) {
  const raw = foodMap.get('s-' + rawId)!;
  const cooked = foodMap.get('s-' + cookedId)!;
  const group = cookGroupOf(raw);
  check(group !== 'none', `${rawId}: keine Garegruppe`);
  const r = applyCooking(raw.per100, group, 100, { method, level: 'normal', basis: 'raw', oil: 'veg' });
  check(r != null, `${rawId}: Garart ${method} fehlt`);
  if (!r) continue;
  const kcal100 = (r.nutrients.kcal / r.cookedG) * 100;
  const prot100 = (r.nutrients.protein / r.cookedG) * 100;
  const dk = Math.abs(kcal100 - cooked.per100.kcal) / cooked.per100.kcal;
  const dp = Math.abs(prot100 - cooked.per100.protein) / cooked.per100.protein;
  check(dk < 0.15, `Gar ${rawId}→${cookedId}: kcal ${kcal100.toFixed(0)} vs. ${cooked.per100.kcal} (${(dk * 100).toFixed(0)} %)`);
  check(dp < 0.2, `Gar ${rawId}→${cookedId}: Eiweiß ${prot100.toFixed(1)} vs. ${cooked.per100.protein} (${(dp * 100).toFixed(0)} %)`);
}
// Invarianten: längeres Garen = weniger Ausbeute, Fett-Verlust nie negativ, Rückrechnung gegart → roh stimmt
{
  const thigh = foodMap.get('s-chicken-thigh-skin-raw')!;
  const g = cookGroupOf(thigh);
  const mk = (level: CookLevel) => applyCooking(thigh.per100, g, 200, { method: 'grill', level, basis: 'raw', oil: 'veg' })!;
  check(mk('short').cookedG > mk('normal').cookedG && mk('normal').cookedG > mk('long').cookedG, 'Gar: Länge verändert Ausbeute');
  check(mk('long').nutrients.fat < mk('short').nutrients.fat, 'Gar: langes Grillen = weniger Fett');
  const a = mk('normal');
  const back = applyCooking(thigh.per100, g, a.cookedG, { method: 'grill', level: 'normal', basis: 'cooked', oil: 'veg' })!;
  check(Math.abs(back.rawG - 200) < 0.01, `Gar: Rückrechnung ${back.rawG.toFixed(2)} g`);
  check(Math.abs(back.nutrients.kcal - a.nutrients.kcal) < 0.01, 'Gar: gleiche kcal bei Roh- und Gar-Gewicht');
  // Mit Öl (Pfanne) und Rückrechnung
  const f = applyCooking(thigh.per100, g, 200, { method: 'panfry', level: 'normal', basis: 'raw', oil: 'coconut' })!;
  const fb = applyCooking(thigh.per100, g, f.cookedG, { method: 'panfry', level: 'normal', basis: 'cooked', oil: 'coconut' })!;
  check(Math.abs(fb.rawG - 200) < 0.01, `Gar mit Öl: Rückrechnung ${fb.rawG.toFixed(2)} g`);
  check(f.nutrients.satFat > 0 && f.oilG > 0, 'Gar: Öl wird addiert');
  const veg = foodMap.get('s-kangkong')!;
  const boiled = applyCooking(veg.per100, cookGroupOf(veg), 100, { method: 'boil', level: 'normal', basis: 'raw', oil: 'veg' })!;
  check(boiled.nutrients.sodium < veg.per100.sodium, 'Gar: Natrium sinkt beim Kochen von Blattgemüse');
}
// Gruppenzuordnung
const groupOf = (slug: string) => cookGroupOf(foodMap.get('s-' + slug)!);
check(groupOf('pork-belly-raw') === 'pork-fatty', 'Gruppe Schweinebauch');
check(groupOf('pork-loin-raw') === 'pork-lean', 'Gruppe Schweinelende');
check(groupOf('bangus-raw') === 'fish-fatty', 'Gruppe Bangus');
check(groupOf('tilapia-raw') === 'fish-lean', 'Gruppe Tilapia');
check(groupOf('chicken-breast-cooked') === 'none', 'Gegartes Hähnchen nicht erneut garen');
check(groupOf('d-chicken-adobo') === 'none', 'Gerichte nicht garen');
check(groupOf('rice-white-raw') === 'rice', 'Gruppe Reis');
console.log(`${SEED_FOODS.filter((f) => cookGroupOf(f) !== 'none').length} Lebensmittel mit Garoptionen`);

/* Fastenfenster: Essfenster 12:00–20:00 bei 16:8 */
const plan = { protocol: '16:8', fastHours: 16, eatStart: '12:00' };
const at = (h: number, m = 0) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
};
check(planPhase(plan, at(13))?.phase === 'eating', 'Plan: 13:00 Essfenster');
check(planPhase(plan, at(21))?.phase === 'fasting', 'Plan: 21:00 Fasten');
check(planPhase(plan, at(8))?.phase === 'fasting', 'Plan: 08:00 Fasten');

if (failures) {
  console.error(`\n${failures} Prüfung(en) fehlgeschlagen`);
  process.exit(1);
}
console.log('\nAlle Prüfungen bestanden');
