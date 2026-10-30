export type NutrientKey =
  | 'kcal'
  | 'protein'
  | 'carbs'
  | 'fat'
  | 'sugar'
  | 'fiber'
  | 'satFat'
  | 'sodium'
  | 'chol';

export type Nutrients = Record<NutrientKey, number>;

export const NUTRIENT_KEYS: NutrientKey[] = [
  'kcal',
  'protein',
  'carbs',
  'fat',
  'sugar',
  'fiber',
  'satFat',
  'sodium',
  'chol',
];

export type Lang = 'de' | 'en';

/** Gruppen mit ähnlichem Garverhalten (Wasser-/Fettverlust). 'none' = nicht kochbar oder schon fertig. */
export type CookGroup =
  | 'none'
  | 'poultry-lean'
  | 'poultry-skin'
  | 'offal'
  | 'pork-lean'
  | 'pork-fatty'
  | 'beef-lean'
  | 'beef-fatty'
  | 'fish-lean'
  | 'fish-fatty'
  | 'seafood'
  | 'egg'
  | 'veg-leafy'
  | 'veg-firm'
  | 'starch-tuber'
  | 'rice'
  | 'pasta'
  | 'legume-dry'
  | 'tofu';

export type CookMethod = 'boil' | 'steam' | 'grill' | 'bake' | 'panfry' | 'deepfry' | 'airfry' | 'stew' | 'microwave';
export type CookLevel = 'short' | 'normal' | 'long';
export type OilType = 'veg' | 'coconut' | 'palm' | 'butter';

/** Zubereitung eines Lebensmittels. */
export interface Prep {
  method: CookMethod;
  level: CookLevel;
  /** Auf was sich die Gramm-Angabe bezieht: Gewicht vor oder nach dem Garen */
  basis: 'raw' | 'cooked';
  /** Vom Essen aufgenommenes Öl/Fett in g; ohne Angabe schätzt die App */
  oilG?: number;
  oil: OilType;
}

/** Haushaltsmaß. `label` ist ein Schlüssel aus i18n (`unit.<label>`) oder ein freier Text. */
export interface Unit {
  label: string;
  grams: number;
}

export interface Food {
  id: string;
  name: { en: string; fil?: string; de?: string };
  brand?: string;
  category: string;
  /** Nährwerte pro 100 g (Natrium und Cholesterin in mg) */
  per100: Nutrients;
  units: Unit[];
  /** Essbarer Anteil in %, wenn das Lebensmittel mit Knochen gewogen wird (z. B. Hähnchenschenkel) */
  ediblePct?: number;
  /** Garverhalten. Ohne Angabe wird es bei Start-Lebensmitteln aus Name und Kategorie abgeleitet. */
  cookGroup?: CookGroup;
  source: 'seed' | 'user' | 'off';
  /** true = Richtwert/Schätzung, nicht anhand einer Verpackung oder Tabelle geprüft */
  estimate: boolean;
  barcode?: string;
  createdAt: number;
  updatedAt: number;
}

export type Sex = 'f' | 'm';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active';
export type Goal = 'lose' | 'maintain' | 'gain';

export interface Targets {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
  fiber: number;
  satFat: number;
  sodium: number;
  chol: number;
  waterMl: number;
}

export interface FastingPlan {
  /** z. B. "16:8" oder "custom" */
  protocol: string;
  fastHours: number;
  /** Beginn des Essfensters, "HH:MM" */
  eatStart: string;
}

export interface Profile {
  id: string;
  name: string;
  sex: Sex;
  birthDate: string;
  heightCm: number;
  startWeightKg: number;
  goalWeightKg?: number;
  activity: Activity;
  goal: Goal;
  weeklyRateKg: number;
  targets: Targets;
  fasting: FastingPlan;
  lang: Lang;
  createdAt: number;
  updatedAt: number;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export interface Entry {
  id: string;
  profileId: string;
  /** Lokales Datum YYYY-MM-DD */
  date: string;
  meal: MealType;
  ts: number;
  kind: 'food' | 'pot' | 'quick';
  refId?: string;
  takeId?: string;
  name: string;
  grams?: number;
  /** Nährwerte für genau diesen Eintrag (Momentaufnahme) */
  nutrients: Nutrients;
  updatedAt: number;
}

export interface RecipeIngredient {
  foodId: string;
  /** Rohgewicht in g */
  grams: number;
  prep?: Prep;
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: RecipeIngredient[];
  notes?: string;
  /** Richtwert für das Gewicht nach dem Kochen */
  defaultCookedG?: number;
  seed?: boolean;
  updatedAt: number;
}

export interface Pot {
  id: string;
  recipeId?: string;
  name: string;
  cookedAt: number;
  cookedWeightG: number;
  rawWeightG: number;
  /** Gesamt-Nährwerte des ganzen Topfes */
  total: Nutrients;
  closed?: boolean;
  updatedAt: number;
}

export interface PotTake {
  id: string;
  potId: string;
  /** null = jemand anderes (z. B. Partner/in), nicht in diesem Tagebuch */
  profileId: string | null;
  grams: number;
  ts: number;
}

export interface Fast {
  id: string;
  profileId: string;
  start: number;
  end?: number;
  targetHours: number;
}

export interface WeightEntry {
  id: string;
  profileId: string;
  date: string;
  kg: number;
}

export interface WaterEntry {
  id: string;
  profileId: string;
  date: string;
  ml: number;
  ts: number;
}

export interface Workout {
  id: string;
  profileId: string;
  date: string;
  name: string;
  kcal: number;
  ts: number;
}

export interface MetaRow {
  key: string;
  value: unknown;
}
