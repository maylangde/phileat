import { useEffect, useState } from 'preact/hooks';
import { db } from '../db';
import { go, back, route } from '../router';
import { t, foodName } from '../i18n';
import { Card, Field, Icon, NumInput, Page, Segmented, toast, useConfirm } from '../components/ui';
import { NUTRIENT_KEYS, type CookGroup, type Food, type NutrientKey } from '../types';
import { COOK_GROUPS, cookGroupOf } from '../lib/cooking';
import { newFood } from '../lib/foods';
import { fmt, num, uid } from '../lib/util';

const UNIT: Record<NutrientKey, string> = {
  kcal: 'kcal',
  protein: 'g',
  carbs: 'g',
  fat: 'g',
  sugar: 'g',
  fiber: 'g',
  satFat: 'g',
  sodium: 'mg',
  chol: 'mg',
};

export function FoodForm({ id }: { id?: string }) {
  const q = route.value.query;
  const [food, setFood] = useState<Food | null>(null);
  const [vals, setVals] = useState<Record<NutrientKey, string>>({} as Record<NutrientKey, string>);
  const [basis, setBasis] = useState<'100' | 'serving'>('100');
  const [servingG, setServingG] = useState('');
  const [units, setUnits] = useState<{ label: string; grams: string }[]>([]);
  const { confirm, node } = useConfirm();

  useEffect(() => {
    (async () => {
      const f = id ? await db.foods.get(id) : newFood({ name: { en: q.get('name') ?? '' }, barcode: q.get('barcode') ?? undefined });
      if (!f) return back('/');
      setFood(f);
      setVals(Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, f.per100[k] ? String(Math.round(f.per100[k] * 100) / 100) : ''])) as Record<NutrientKey, string>);
      setUnits(f.units.map((u) => ({ label: u.label, grams: String(u.grams) })));
    })();
  }, [id]);

  if (!food) return <Page title="…">{null}</Page>;
  const readOnly = food.source !== 'user';

  const set = (patch: Partial<Food>) => setFood({ ...food, ...patch });

  const save = async () => {
    const factor = basis === 'serving' && num(servingG) > 0 ? 100 / num(servingG) : 1;
    const per100 = Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, num(vals[k]) * factor])) as Food['per100'];
    const cleaned = units
      .map((u) => ({ label: u.label.trim(), grams: num(u.grams) }))
      .filter((u) => u.label && u.grams > 0);
    // Wenn Packungsangabe pro Portion: die Portion auch als Haushaltsmaß ablegen
    if (basis === 'serving' && num(servingG) > 0 && !cleaned.some((u) => u.grams === num(servingG))) {
      cleaned.unshift({ label: 'serving', grams: num(servingG) });
    }
    await db.foods.put({ ...food, per100, units: cleaned, updatedAt: Date.now() });
    toast(t('saved'));
    back('/');
  };

  const copyAsOwn = async () => {
    const copy = newFood({
      name: { ...food.name },
      brand: food.brand,
      category: food.category,
      per100: { ...food.per100 },
      units: food.units.map((u) => ({ ...u })),
      ediblePct: food.ediblePct,
      cookGroup: cookGroupOf(food),
      estimate: false,
    });
    await db.foods.put(copy);
    go('/food/' + copy.id, true);
  };

  const remove = () =>
    confirm(t('food.deleteAsk', { name: foodName(food) }), async () => {
      await db.foods.delete(food.id);
      back('/');
    });

  const nameOk = food.name.en.trim().length > 0 || (food.name.de ?? '').trim().length > 0;
  const kcalOk = num(vals.kcal) >= 0 && vals.kcal !== '';

  return (
    <Page title={id ? foodName(food) : t('food.create')} noNav>
      {readOnly && (
        <div class="note">
          {food.estimate && <p>{t('food.estimateHint')}</p>}
          {food.ediblePct && <p>🦴 {t('amount.withBone', { p: food.ediblePct })}</p>}
          <button class="btn block" onClick={copyAsOwn}>
            <Icon name="copy" size={18} /> {t('food.copyOwn')}
          </button>
        </div>
      )}
      <Card>
        <Field label={t('food.nameEn')}>
          <input disabled={readOnly} value={food.name.en} onInput={(e) => set({ name: { ...food.name, en: (e.target as HTMLInputElement).value } })} />
        </Field>
        <Field label={t('food.nameDe')}>
          <input disabled={readOnly} value={food.name.de ?? ''} onInput={(e) => set({ name: { ...food.name, de: (e.target as HTMLInputElement).value || undefined } })} />
        </Field>
        <Field label={t('food.nameFil')}>
          <input disabled={readOnly} value={food.name.fil ?? ''} onInput={(e) => set({ name: { ...food.name, fil: (e.target as HTMLInputElement).value || undefined } })} />
        </Field>
        <Field label={t('food.brand')}>
          <input disabled={readOnly} value={food.brand ?? ''} onInput={(e) => set({ brand: (e.target as HTMLInputElement).value || undefined })} />
        </Field>
        <Field label={t('food.barcode')}>
          <NumInput disabled={readOnly} value={food.barcode ?? ''} onInput={(e) => set({ barcode: (e.target as HTMLInputElement).value.replace(/\D/g, '') || undefined })} />
        </Field>
      </Card>

      <Card title={t('food.nutrition')}>
        {!readOnly && (
          <>
            <Segmented
              value={basis}
              onChange={setBasis}
              options={[
                { value: '100', label: t('food.per100') },
                { value: 'serving', label: t('food.perServing') },
              ]}
            />
            {basis === 'serving' && (
              <Field label={t('food.servingG')} hint={t('food.servingHint')}>
                <NumInput value={servingG} onInput={(e) => setServingG((e.target as HTMLInputElement).value)} />
              </Field>
            )}
          </>
        )}
        <div class="targets-grid">
          {NUTRIENT_KEYS.map((k) => (
            <label class="target-row" key={k}>
              <span>{t('nutrient.' + k)}</span>
              <span class="target-input">
                <NumInput
                  disabled={readOnly}
                  value={vals[k] ?? ''}
                  onInput={(e) => setVals({ ...vals, [k]: (e.target as HTMLInputElement).value })}
                />
                <small>{UNIT[k]}</small>
              </span>
            </label>
          ))}
        </div>
        {readOnly && <p class="muted small">{t('food.per100')}</p>}
      </Card>

      <Card title={t('food.units')}>
        {units.map((u, i) => (
          <div class="unit-row" key={i}>
            <input
              disabled={readOnly}
              placeholder={t('food.unitName')}
              value={u.label.startsWith('unit.') ? u.label : isKnownUnit(u.label) ? t('unit.' + u.label) : u.label}
              onInput={(e) => setUnits(units.map((x, j) => (j === i ? { ...x, label: (e.target as HTMLInputElement).value } : x)))}
            />
            <NumInput
              disabled={readOnly}
              placeholder="g"
              value={u.grams}
              onInput={(e) => setUnits(units.map((x, j) => (j === i ? { ...x, grams: (e.target as HTMLInputElement).value } : x)))}
            />
            <small>g</small>
            {!readOnly && (
              <button class="icon-btn" onClick={() => setUnits(units.filter((_, j) => j !== i))} aria-label={t('delete')}>
                <Icon name="x" size={18} />
              </button>
            )}
          </div>
        ))}
        {!readOnly && (
          <button class="btn ghost" onClick={() => setUnits([...units, { label: '', grams: '' }])}>
            <Icon name="plus" size={16} /> {t('food.addUnit')}
          </button>
        )}
      </Card>

      {!readOnly && (
        <Card title={t('food.cookGroup')}>
          <p class="muted small">{t('food.cookGroupHint')}</p>
          <select
            value={food.cookGroup ?? 'none'}
            onChange={(e) => set({ cookGroup: (e.target as HTMLSelectElement).value as CookGroup })}
          >
            <option value="none">{t('group.none')}</option>
            {COOK_GROUPS.map((g) => (
              <option value={g} key={g}>
                {t('group.' + g)}
              </option>
            ))}
          </select>
        </Card>
      )}

      {!readOnly && (
        <div class="row gap">
          {id && (
            <button class="btn danger" onClick={remove}>
              <Icon name="trash" size={18} />
            </button>
          )}
          <button class="btn primary grow" disabled={!nameOk || !kcalOk} onClick={save}>
            {t('save')}
          </button>
        </div>
      )}
      {node}
    </Page>
  );
}

const KNOWN = ['cup', 'pc', 'tbsp', 'tsp', 'slice', 'pack', 'serving', 'stick', 'sachet', 'can', 'glass', 'bottle', 'scoop', 'bowl', 'handful'];
const isKnownUnit = (l: string) => KNOWN.includes(l);

export { fmt, uid };
