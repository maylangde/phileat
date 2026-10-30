import { useState } from 'preact/hooks';
import { profile } from '../store';
import { db } from '../db';
import { useFoods, usePots } from '../lib/hooks';
import { dateStr, fmt, mealForNow, num } from '../lib/util';
import { t } from '../i18n';
import { Card, Chips, Empty, Field, Icon, NumInput, Page, Segmented, toast } from '../components/ui';
import { AmountSheet, FoodSearch, targetFromFood, type AmountTarget } from '../components/food';
import { BarcodeScanner, lookupOpenFoodFacts } from '../components/scanner';
import { MEALS, type Food, type MealType, type Pot } from '../types';
import { back, go, route } from '../router';
import { logFood, logQuick } from '../lib/foods';
import { potPer100, takeFromPot } from '../lib/actions';
import { mealName } from '../i18n';

type Tab = 'search' | 'pots' | 'quick' | 'scan';

export function AddFood() {
  const p = profile.value!;
  const q = route.value.query;
  const date = q.get('date') ?? dateStr();
  const [meal, setMeal] = useState<MealType>((q.get('meal') as MealType) || mealForNow());
  const [tab, setTab] = useState<Tab>('search');
  const foods = useFoods();
  const pots = usePots().filter((x) => !x.pot.closed && x.remainingG > 0);

  const [pick, setPick] = useState<{ target: AmountTarget; food?: Food; pot?: Pot; max?: number } | null>(null);

  const afterAdd = () => {
    setPick(null);
    toast(t('added'));
  };

  return (
    <Page title={t('add.title')} noNav right={<button class="link" onClick={() => back('/')}>{t('done')}</button>}>
      <Chips value={meal} onChange={setMeal} options={MEALS.map((m) => ({ value: m, label: mealName(m) }))} />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'search', label: t('add.search') },
          { value: 'pots', label: t('add.pots') },
          { value: 'quick', label: t('add.quick') },
          { value: 'scan', label: t('add.scan') },
        ]}
      />

      {tab === 'search' && <FoodSearch foods={foods} onPick={(f) => setPick({ target: targetFromFood(f), food: f })} />}

      {tab === 'pots' &&
        (pots.length === 0 ? (
          <Empty icon="pot" text={t('add.noPots')} />
        ) : (
          <div class="list">
            {pots.map(({ pot, remainingG }) => (
              <button
                class="row-item"
                key={pot.id}
                onClick={() =>
                  setPick({
                    pot,
                    max: remainingG,
                    target: { key: pot.id, name: pot.name, per100: potPer100(pot), units: [{ label: 'serving', grams: 200 }] },
                  })
                }
              >
                <div class="row-main">
                  <div class="row-title">{pot.name}</div>
                  <div class="row-sub">
                    {t('pot.left', { g: fmt(remainingG) })} · {fmt(potPer100(pot).kcal)} kcal / 100 g
                  </div>
                </div>
                <Icon name="plus" size={20} />
              </button>
            ))}
          </div>
        ))}

      {tab === 'quick' && <QuickAdd meal={meal} date={date} onDone={() => toast(t('added'))} />}

      {tab === 'scan' && <ScanTab onFound={(f) => setPick({ target: targetFromFood(f), food: f })} />}

      <AmountSheet
        target={pick?.target ?? null}
        meal={meal}
        maxGrams={pick?.max}
        confirmLabel={t('add.confirm')}
        onClose={() => setPick(null)}
        onConfirm={async (grams, m, cooked) => {
          setMeal(m);
          if (pick?.pot) await takeFromPot(p, pick.pot, grams, m, date);
          else if (pick?.food) await logFood(p, pick.food, grams, m, date, cooked);
          afterAdd();
        }}
      />
    </Page>
  );
}

function QuickAdd({ meal, date, onDone }: { meal: MealType; date: string; onDone: () => void }) {
  const p = profile.value!;
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [prot, setProt] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const save = async () => {
    await logQuick(
      p,
      name.trim() || t('quick.default'),
      { kcal: num(kcal), protein: num(prot), carbs: num(carbs), fat: num(fat), sugar: 0, fiber: 0, satFat: 0, sodium: 0, chol: 0 },
      meal,
      date,
    );
    setName('');
    setKcal('');
    setProt('');
    setCarbs('');
    setFat('');
    onDone();
  };
  return (
    <Card>
      <p class="muted small">{t('quick.hint')}</p>
      <Field label={t('quick.name')}>
        <input value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
      </Field>
      <Field label="kcal">
        <NumInput value={kcal} onInput={(e) => setKcal((e.target as HTMLInputElement).value)} />
      </Field>
      <div class="three">
        <Field label={t('nutrient.protein') + ' (g)'}>
          <NumInput value={prot} onInput={(e) => setProt((e.target as HTMLInputElement).value)} />
        </Field>
        <Field label={t('nutrient.carbs') + ' (g)'}>
          <NumInput value={carbs} onInput={(e) => setCarbs((e.target as HTMLInputElement).value)} />
        </Field>
        <Field label={t('nutrient.fat') + ' (g)'}>
          <NumInput value={fat} onInput={(e) => setFat((e.target as HTMLInputElement).value)} />
        </Field>
      </div>
      <button class="btn primary block" disabled={num(kcal) <= 0} onClick={save}>
        {t('add.confirm')}
      </button>
    </Card>
  );
}

function ScanTab({ onFound }: { onFound: (f: Food) => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [key, setKey] = useState(0);

  const handle = async (code: string) => {
    setBusy(true);
    setMsg('');
    try {
      const local = await db.foods.where('barcode').equals(code).first();
      if (local) return onFound(local);
      const f = await lookupOpenFoodFacts(code);
      if (f) {
        await db.foods.put(f);
        return onFound(f);
      }
      setMsg(t('scan.notFound', { code }));
      go('/food/new?barcode=' + code);
    } catch {
      setMsg(t('scan.offline'));
    } finally {
      setBusy(false);
      setKey((k) => k + 1);
    }
  };

  return (
    <div>
      {busy ? <p class="center muted">{t('scan.looking')}</p> : <BarcodeScanner key={key} onCode={handle} />}
      {msg && <p class="note warn">{msg}</p>}
      <p class="muted small center">{t('scan.hint')}</p>
    </div>
  );
}
