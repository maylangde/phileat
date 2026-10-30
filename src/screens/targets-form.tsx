import type { Targets } from '../types';
import { t } from '../i18n';
import { NumInput } from '../components/ui';
import { num } from '../lib/util';

const ROWS: { key: keyof Targets; unit: string; label: string }[] = [
  { key: 'kcal', unit: 'kcal', label: 'nutrient.kcal' },
  { key: 'protein', unit: 'g', label: 'nutrient.protein' },
  { key: 'carbs', unit: 'g', label: 'nutrient.carbs' },
  { key: 'fat', unit: 'g', label: 'nutrient.fat' },
  { key: 'sodium', unit: 'mg', label: 'nutrient.sodium' },
  { key: 'sugar', unit: 'g', label: 'nutrient.sugar' },
  { key: 'satFat', unit: 'g', label: 'nutrient.satFat' },
  { key: 'chol', unit: 'mg', label: 'nutrient.chol' },
  { key: 'fiber', unit: 'g', label: 'nutrient.fiber' },
  { key: 'waterMl', unit: 'ml', label: 'nutrient.water' },
];

const KIND: Partial<Record<keyof Targets, string>> = {
  sodium: 'target.limit',
  sugar: 'target.limit',
  satFat: 'target.limit',
  chol: 'target.limit',
  protein: 'target.min',
  fiber: 'target.min',
  waterMl: 'target.min',
};

export function TargetsForm({ value, onChange }: { value: Targets; onChange: (t: Targets) => void }) {
  return (
    <div class="targets-grid">
      {ROWS.map((r) => (
        <label class="target-row" key={r.key}>
          <span>
            {t(r.label)}
            {KIND[r.key] && <em> {t(KIND[r.key]!)}</em>}
          </span>
          <span class="target-input">
            <NumInput value={String(value[r.key])} onInput={(e) => onChange({ ...value, [r.key]: num((e.target as HTMLInputElement).value) })} />
            <small>{r.unit}</small>
          </span>
        </label>
      ))}
    </div>
  );
}
