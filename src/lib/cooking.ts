import type { CookGroup, CookLevel, CookMethod, Food, Nutrients, OilType, Prep } from '../types';

/**
 * Einfaches Garmodell. Alle Werte sind Schätzungen aus typischen Garverlusten
 * (Größenordnung USDA „Table of Cooking Yields“ und „Nutrient Retention Factors“).
 *
 * Je Gruppe und Garart:
 *   [Ausbeute, Fett-Verbleib, Natrium-Verbleib, Öl-Aufnahme in g je 100 g roh]
 *   Ausbeute        gegartes Gewicht / rohes Gewicht (ohne aufgenommenes Öl); über 1 bei Reis, Nudeln, Bohnen
 *   Fett-Verbleib   Anteil des Fetts, der im Essen bleibt (Rest tropft aus oder bleibt in der Pfanne)
 *   Natrium-Verbleib Anteil des Natriums, der im Essen bleibt (Rest geht ins weggegossene Kochwasser)
 *
 * Nicht erfasst: Panade und Teig (bitte das fertige Gericht wählen), Vitamine.
 */
type Row = [number, number, number, number];
type Table = Partial<Record<CookMethod, Row>>;

const TABLE: Record<Exclude<CookGroup, 'none'>, Table> = {
  'poultry-lean': {
    boil: [0.76, 0.9, 0.85, 0],
    steam: [0.8, 0.95, 1, 0],
    grill: [0.7, 0.9, 1, 0],
    bake: [0.73, 0.95, 1, 0],
    panfry: [0.72, 1, 1, 3],
    deepfry: [0.72, 1, 1, 6],
    airfry: [0.68, 0.92, 1, 1],
    stew: [0.78, 1, 1, 0],
    microwave: [0.78, 1, 1, 0],
  },
  'poultry-skin': {
    boil: [0.72, 0.7, 0.85, 0],
    steam: [0.76, 0.75, 1, 0],
    grill: [0.66, 0.65, 1, 0],
    bake: [0.68, 0.7, 1, 0],
    panfry: [0.68, 0.8, 1, 1],
    deepfry: [0.7, 0.95, 1, 5],
    airfry: [0.62, 0.55, 1, 0],
    stew: [0.75, 0.9, 1, 0],
    microwave: [0.72, 0.8, 1, 0],
  },
  offal: {
    boil: [0.7, 1, 0.85, 0],
    grill: [0.68, 0.9, 1, 0],
    panfry: [0.7, 1, 1, 3],
    deepfry: [0.7, 1, 1, 6],
    stew: [0.75, 1, 1, 0],
  },
  'pork-lean': {
    boil: [0.7, 0.9, 0.85, 0],
    grill: [0.68, 0.9, 1, 0],
    bake: [0.72, 0.95, 1, 0],
    panfry: [0.7, 1, 1, 3],
    deepfry: [0.72, 1, 1, 6],
    airfry: [0.66, 0.9, 1, 1],
    stew: [0.72, 1, 1, 0],
  },
  'pork-fatty': {
    boil: [0.62, 0.75, 0.85, 0],
    grill: [0.58, 0.65, 1, 0],
    bake: [0.62, 0.7, 1, 0],
    panfry: [0.6, 0.7, 1, 0],
    deepfry: [0.62, 0.85, 1, 4],
    airfry: [0.55, 0.55, 1, 0],
    stew: [0.7, 0.9, 1, 0],
  },
  'beef-lean': {
    boil: [0.62, 0.9, 0.85, 0],
    grill: [0.68, 0.92, 1, 0],
    bake: [0.7, 0.95, 1, 0],
    panfry: [0.68, 1, 1, 2],
    deepfry: [0.7, 1, 1, 5],
    airfry: [0.65, 0.9, 1, 0],
    stew: [0.66, 1, 1, 0],
  },
  'beef-fatty': {
    boil: [0.58, 0.75, 0.85, 0],
    grill: [0.64, 0.72, 1, 0],
    bake: [0.66, 0.8, 1, 0],
    panfry: [0.65, 0.8, 1, 0],
    airfry: [0.6, 0.7, 1, 0],
    stew: [0.62, 0.9, 1, 0],
  },
  'fish-lean': {
    boil: [0.85, 1, 0.85, 0],
    steam: [0.88, 1, 1, 0],
    grill: [0.78, 0.95, 1, 0],
    bake: [0.8, 1, 1, 0],
    panfry: [0.8, 1, 1, 4],
    deepfry: [0.8, 1, 1, 8],
    airfry: [0.76, 0.95, 1, 1],
    stew: [0.85, 1, 1, 0],
    microwave: [0.85, 1, 1, 0],
  },
  'fish-fatty': {
    boil: [0.85, 0.9, 0.85, 0],
    steam: [0.88, 0.95, 1, 0],
    grill: [0.78, 0.85, 1, 0],
    bake: [0.8, 0.92, 1, 0],
    panfry: [0.78, 0.95, 1, 2],
    deepfry: [0.78, 1, 1, 6],
    airfry: [0.74, 0.85, 1, 0],
    stew: [0.85, 1, 1, 0],
    microwave: [0.85, 0.95, 1, 0],
  },
  seafood: {
    boil: [0.82, 1, 0.8, 0],
    steam: [0.85, 1, 1, 0],
    grill: [0.75, 1, 1, 0],
    panfry: [0.78, 1, 1, 3],
    deepfry: [0.8, 1, 1, 7],
    stew: [0.85, 1, 1, 0],
  },
  egg: {
    boil: [1, 1, 1, 0],
    steam: [1, 1, 1, 0],
    panfry: [0.92, 1, 1, 4],
    bake: [0.95, 1, 1, 0],
    microwave: [0.95, 1, 1, 0],
  },
  'veg-leafy': {
    boil: [0.65, 1, 0.6, 0],
    steam: [0.75, 1, 0.9, 0],
    panfry: [0.6, 1, 1, 4],
    stew: [0.7, 1, 1, 0],
    microwave: [0.75, 1, 0.95, 0],
  },
  'veg-firm': {
    boil: [0.92, 1, 0.75, 0],
    steam: [0.95, 1, 0.95, 0],
    grill: [0.8, 1, 1, 0],
    bake: [0.8, 1, 1, 0],
    panfry: [0.78, 1, 1, 5],
    deepfry: [0.85, 1, 1, 12],
    airfry: [0.7, 1, 1, 1],
    stew: [0.88, 1, 1, 0],
    microwave: [0.92, 1, 0.95, 0],
  },
  'starch-tuber': {
    boil: [1, 1, 0.9, 0],
    steam: [1, 1, 1, 0],
    grill: [0.85, 1, 1, 0],
    bake: [0.85, 1, 1, 0],
    panfry: [0.75, 1, 1, 6],
    deepfry: [0.55, 1, 1, 13],
    airfry: [0.6, 1, 1, 2],
    stew: [1, 1, 1, 0],
    microwave: [0.9, 1, 0.95, 0],
  },
  rice: {
    boil: [2.8, 1, 1, 0],
    steam: [2.8, 1, 1, 0],
    microwave: [2.7, 1, 1, 0],
  },
  pasta: {
    boil: [2.3, 1, 1, 0],
    microwave: [2.2, 1, 1, 0],
  },
  'legume-dry': {
    boil: [3.2, 1, 0.9, 0],
    stew: [3.2, 1, 1, 0],
  },
  tofu: {
    boil: [1, 1, 1, 0],
    steam: [1, 1, 1, 0],
    bake: [0.85, 1, 1, 0],
    panfry: [0.85, 1, 1, 5],
    deepfry: [0.75, 1, 1, 10],
    airfry: [0.8, 1, 1, 1],
    stew: [1, 1, 1, 0],
  },
};

export const COOK_METHODS: CookMethod[] = ['boil', 'steam', 'grill', 'bake', 'panfry', 'deepfry', 'airfry', 'stew', 'microwave'];
export const COOK_GROUPS = Object.keys(TABLE) as Exclude<CookGroup, 'none'>[];

/** Garzeit: verändert Wasser- und Fettverlust gegenüber „normal“. */
const LEVEL: Record<CookLevel, number> = { short: 0.8, normal: 1, long: 1.25 };

/** Öl und Fette: Energie, Fett, ges. Fett, Cholesterin, Natrium je 100 g. */
export const OILS: Record<OilType, { kcal: number; fat: number; sat: number; chol: number; sodium: number }> = {
  veg: { kcal: 884, fat: 100, sat: 12, chol: 0, sodium: 0 },
  coconut: { kcal: 892, fat: 99.1, sat: 82.5, chol: 0, sodium: 0 },
  palm: { kcal: 884, fat: 100, sat: 49, chol: 0, sodium: 0 },
  butter: { kcal: 717, fat: 81, sat: 51, chol: 215, sodium: 11 },
};

/* ---------- Gruppenzuordnung ---------- */

const LEAFY = new Set(['kangkong', 'pechay', 'spinach', 'malunggay', 'lettuce', 'spring-onion', 'talbos-kamote', 'togue']);
const NOT_COOKED_VEG = new Set(['garlic', 'ginger', 'sili']);
const TUBERS = new Set(['kamote-raw', 'potato-raw', 'cassava', 'saba-banana']);

/** Leitet die Gruppe der Start-Lebensmittel aus ID, Kategorie und Fettgehalt ab. */
function deriveGroup(f: Food): CookGroup {
  const id = f.id.replace(/^s-/, '');
  const raw = id.endsWith('-raw') || id.endsWith('-dry');
  const fat = f.per100.fat;
  switch (f.category) {
    case 'meat': {
      if (!raw) return 'none';
      if (/liver|gizzard|feet|tripe/.test(id)) return 'offal';
      if (id.startsWith('chicken') || id.startsWith('duck')) return fat > 8 ? 'poultry-skin' : 'poultry-lean';
      if (id.startsWith('pork')) return fat > 12 ? 'pork-fatty' : 'pork-lean';
      if (id.startsWith('beef') || id.startsWith('goat')) return fat > 10 ? 'beef-fatty' : 'beef-lean';
      return 'none';
    }
    case 'fish':
      if (!raw) return 'none';
      if (id.startsWith('shrimp') || id.startsWith('squid')) return 'seafood';
      return fat > 5 ? 'fish-fatty' : 'fish-lean';
    case 'egg':
      return id === 'egg-raw' ? 'egg' : 'none';
    case 'veg':
      if (NOT_COOKED_VEG.has(id)) return 'none';
      return LEAFY.has(id) ? 'veg-leafy' : 'veg-firm';
    case 'starch':
      return TUBERS.has(id) ? 'starch-tuber' : 'none';
    case 'grain':
      if (/^rice-.*-raw$/.test(id)) return 'rice';
      if (['pasta-raw', 'bihon-raw', 'sotanghon-raw', 'pancit-canton-raw'].includes(id)) return 'pasta';
      return 'none';
    case 'legume':
      if (id === 'mung-dry') return 'legume-dry';
      return id === 'tofu-firm' ? 'tofu' : 'none';
    default:
      return 'none';
  }
}

export function cookGroupOf(f: Food): CookGroup {
  if (f.cookGroup) return f.cookGroup;
  return f.source === 'seed' ? deriveGroup(f) : 'none';
}

/** Gararten, die für die Gruppe sinnvoll sind. */
export function methodsFor(group: CookGroup): CookMethod[] {
  if (group === 'none') return [];
  const t = TABLE[group];
  return COOK_METHODS.filter((m) => t[m]);
}

/* ---------- Berechnung ---------- */

const adjYield = (y: number, k: number) => {
  if (y < 1) return Math.max(0.2, 1 - (1 - y) * k);
  // Quellen (Reis, Nudeln, Bohnen): längeres Garen nimmt etwas mehr Wasser auf
  return 1 + (y - 1) * (k < 1 ? 0.92 : k > 1 ? 1.08 : 1);
};
const adjRetention = (r: number, k: number) => Math.min(1, Math.max(0, 1 - (1 - r) * k));

export interface CookResult {
  nutrients: Nutrients;
  /** Rohgewicht in g */
  rawG: number;
  /** Gegartes Gewicht inkl. aufgenommenem Öl in g */
  cookedG: number;
  /** Ausfall von Fett durch Austritt in g */
  fatLostG: number;
  /** Aufgenommenes Öl/Fett in g */
  oilG: number;
}

/** Standard-Ölaufnahme in g je 100 g roh. */
export function defaultOilPer100(group: CookGroup, method: CookMethod): number {
  if (group === 'none') return 0;
  return TABLE[group][method]?.[3] ?? 0;
}

/**
 * Nährwerte einer Portion nach dem Garen.
 * `weighedG` ist je nach `prep.basis` das Roh- oder das Gar-Gewicht. Gibt null zurück,
 * wenn für die Gruppe und Garart nichts hinterlegt ist.
 */
export function applyCooking(per100: Nutrients, group: CookGroup, weighedG: number, prep: Prep): CookResult | null {
  if (group === 'none') return null;
  const row = TABLE[group][prep.method];
  if (!row) return null;
  const k = LEVEL[prep.level];
  const y = adjYield(row[0], k);
  const fatRet = adjRetention(row[1], k);
  const naRet = adjRetention(row[2], k);
  const oilPer100 = row[3];

  // Rohgewicht bestimmen. Beim gegarten Gewicht steckt aufgenommenes Öl bereits im Gewicht.
  let rawG = weighedG;
  if (prep.basis === 'cooked') {
    rawG = prep.oilG != null ? (weighedG - prep.oilG) / y : weighedG / (y + oilPer100 / 100);
  }
  rawG = Math.max(0, rawG);
  const oilG = prep.oilG != null ? Math.max(0, prep.oilG) : (oilPer100 * rawG) / 100;

  const f = rawG / 100;
  const fatLost = per100.fat * f * (1 - fatRet);
  const n: Nutrients = {
    kcal: per100.kcal * f - fatLost * 9,
    protein: per100.protein * f,
    carbs: per100.carbs * f,
    fat: per100.fat * f - fatLost,
    sugar: per100.sugar * f,
    fiber: per100.fiber * f,
    satFat: per100.satFat * f - per100.satFat * f * (1 - fatRet),
    sodium: per100.sodium * f * naRet,
    // Cholesterin geht nur zum Teil mit dem Fett verloren
    chol: per100.chol * f * (1 - (1 - fatRet) * 0.3),
  };
  if (oilG > 0) {
    const o = OILS[prep.oil];
    n.kcal += (oilG * o.kcal) / 100;
    n.fat += (oilG * o.fat) / 100;
    n.satFat += (oilG * o.sat) / 100;
    n.chol += (oilG * o.chol) / 100;
    n.sodium += (oilG * o.sodium) / 100;
  }
  return { nutrients: n, rawG, cookedG: rawG * y + oilG, fatLostG: fatLost, oilG };
}
