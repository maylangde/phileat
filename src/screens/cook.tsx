import { useMemo, useState } from 'preact/hooks';
import { db, useLive } from '../db';
import { profile } from '../store';
import { useFoodMap, usePots, useFoods } from '../lib/hooks';
import { recipeTotals, per100From, scale } from '../lib/nutrition';
import { dateStr, fmt, fmtClock, mealForNow, num, uid } from '../lib/util';
import { t, foodName, mealName } from '../i18n';
import { Bar, Card, Chips, Empty, Field, Icon, NumInput, Page, Segmented, Sheet, toast, useConfirm } from '../components/ui';
import { AmountSheet, FoodSearch, MacroLine, targetFromFood } from '../components/food';
import { go, back } from '../router';
import { createPot, deletePot, deleteTake, potPer100, takeForOther, takeFromPot } from '../lib/actions';
import { MEALS, type Food, type MealType, type Recipe, type RecipeIngredient } from '../types';
import { normalize } from '../lib/util';

/* ---------- Übersicht: Töpfe & Rezepte ---------- */

export function Cook() {
  const [tab, setTab] = useState<'pots' | 'recipes'>('pots');
  const pots = usePots();
  const recipes = useLive(() => db.recipes.toArray(), []) ?? [];
  const foods = useFoodMap();
  const [q, setQ] = useState('');

  const active = pots.filter((x) => !x.pot.closed && x.remainingG > 0);
  const old = pots.filter((x) => x.pot.closed || x.remainingG <= 0);
  const filtered = recipes
    .filter((r) => !q.trim() || normalize(r.name).includes(normalize(q)))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Page
      title={t('cook.title')}
      back={false}
      right={
        <button class="icon-btn" onClick={() => go('/recipe/new')} aria-label={t('recipe.new')}>
          <Icon name="plus" />
        </button>
      }
    >
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'pots', label: t('cook.pots') },
          { value: 'recipes', label: t('cook.recipes') },
        ]}
      />
      {tab === 'pots' && (
        <>
          {active.length === 0 && <Empty icon="pot" text={t('cook.noPots')} />}
          {active.map(({ pot, remainingG }) => (
            <Card key={pot.id} class="tappable" onClick={() => go('/pot/' + pot.id)}>
              <div class="row between">
                <b>{pot.name}</b>
                <span class="muted small">{new Date(pot.cookedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
              </div>
              <Bar value={remainingG} max={pot.cookedWeightG} color="var(--c-pot)" />
              <div class="row between mt small muted">
                <span>{t('pot.left', { g: fmt(remainingG) })}</span>
                <span>{fmt(potPer100(pot).kcal)} kcal / 100 g</span>
              </div>
            </Card>
          ))}
          {old.length > 0 && (
            <>
              <h3 class="list-title">{t('cook.finished')}</h3>
              <div class="list">
                {old.slice(0, 8).map(({ pot }) => (
                  <button class="row-item" key={pot.id} onClick={() => go('/pot/' + pot.id)}>
                    <div class="row-main">
                      <div class="row-title">{pot.name}</div>
                      <div class="row-sub">{new Date(pot.cookedAt).toLocaleDateString()}</div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
      {tab === 'recipes' && (
        <>
          <div class="search">
            <Icon name="search" size={20} />
            <input type="search" value={q} placeholder={t('recipe.search')} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
          </div>
          <div class="list">
            {filtered.map((r) => {
              const { total, rawG } = recipeTotals(r.ingredients, foods);
              return (
                <button class="row-item" key={r.id} onClick={() => go('/recipe/' + r.id)}>
                  <div class="row-main">
                    <div class="row-title">{r.name}</div>
                    <div class="row-sub">
                      {r.ingredients.length} {t('recipe.ingredients')} · {fmt(rawG)} g {t('recipe.raw')} · {fmt(total.kcal)} kcal
                    </div>
                  </div>
                  <Icon name="pot" size={20} />
                </button>
              );
            })}
          </div>
          <button class="btn block ghost" onClick={() => go('/recipe/new')}>
            <Icon name="plus" size={18} /> {t('recipe.new')}
          </button>
        </>
      )}
    </Page>
  );
}

/* ---------- Rezept-Editor ---------- */

export function RecipeEditor({ id }: { id?: string }) {
  const foods = useFoods();
  const foodMap = useFoodMap();
  const existing = useLive(() => (id ? db.recipes.get(id) : undefined), [id]);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [ings, setIngs] = useState<RecipeIngredient[]>([]);
  const [loaded, setLoaded] = useState(!id);
  const [addOpen, setAddOpen] = useState(false);
  const [pending, setPending] = useState<Food | null>(null);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [cookOpen, setCookOpen] = useState(false);
  const { confirm, node } = useConfirm();

  if (id && existing && !loaded) {
    setName(existing.name);
    setNotes(existing.notes ?? '');
    setIngs(existing.ingredients);
    setLoaded(true);
  }
  if (id && existing === undefined && !loaded) return <Page title="…">{null}</Page>;

  const { total, rawG } = recipeTotals(ings, foodMap);
  const raw100 = per100From(total, rawG);
  const valid = name.trim().length > 0 && ings.length > 0;

  const buildRecipe = (): Recipe => ({
    id: existing?.id ?? uid(),
    name: name.trim(),
    notes: notes.trim() || undefined,
    ingredients: ings,
    defaultCookedG: existing?.defaultCookedG,
    seed: existing?.seed,
    updatedAt: Date.now(),
  });

  const save = async (): Promise<Recipe> => {
    const r = buildRecipe();
    await db.recipes.put(r);
    return r;
  };

  return (
    <Page title={id ? name || t('recipe.edit') : t('recipe.new')} noNav>
      <Card>
        <Field label={t('recipe.name')}>
          <input value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
        </Field>
      </Card>

      <Card title={t('recipe.ingredients')} action={<span class="muted small">{fmt(rawG)} g {t('recipe.raw')}</span>}>
        {ings.length === 0 && <p class="muted small">{t('recipe.noIngredients')}</p>}
        {ings.map((ing, i) => {
          const f = foodMap.get(ing.foodId);
          return (
            <button class="entry" key={i} onClick={() => setEditIdx(i)}>
              <div class="row-main">
                <div class="row-title">{f ? foodName(f) : t('recipe.missing')}</div>
                <div class="row-sub">
                  {fmt(ing.grams)} g {ing.prep ? '· ' + t('prep.' + ing.prep.method) + ' ' : ''}
                  {f ? '· ' + fmt(recipeTotals([ing], foodMap).total.kcal) + ' kcal' : ''}
                </div>
              </div>
            </button>
          );
        })}
        <button class="add-line" onClick={() => setAddOpen(true)}>
          <Icon name="plus" size={16} /> {t('recipe.addIngredient')}
        </button>
      </Card>

      {ings.length > 0 && (
        <Card title={t('recipe.nutrition')}>
          <div class="muted small">{t('recipe.total')}</div>
          <MacroLine n={total} />
          <div class="muted small mt">{t('recipe.per100raw')}</div>
          <MacroLine n={raw100} />
          <p class="muted small mt">{t('recipe.cookHint')}</p>
        </Card>
      )}

      <Card>
        <Field label={t('recipe.notes')}>
          <textarea rows={3} value={notes} onInput={(e) => setNotes((e.target as HTMLTextAreaElement).value)} />
        </Field>
      </Card>

      <div class="row gap wrap">
        {id && (
          <button
            class="btn danger"
            onClick={() =>
              confirm(t('recipe.deleteAsk', { name }), async () => {
                await db.recipes.delete(id);
                back('/cook');
              })
            }
            aria-label={t('delete')}
          >
            <Icon name="trash" size={18} />
          </button>
        )}
        <button
          class="btn grow"
          disabled={!valid}
          onClick={async () => {
            await save();
            toast(t('saved'));
            back('/cook');
          }}
        >
          {t('save')}
        </button>
        <button class="btn primary grow" disabled={!valid} onClick={() => setCookOpen(true)}>
          <Icon name="pot" size={18} /> {t('recipe.cook')}
        </button>
      </div>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title={t('recipe.addIngredient')}>
        <FoodSearch
          foods={foods}
          createQuery={false}
          onPick={(f) => {
            setAddOpen(false);
            setPending(f);
          }}
        />
      </Sheet>
      <AmountSheet
        target={pending ? targetFromFood(pending) : null}
        showMeal={false}
        recipeMode
        confirmLabel={t('recipe.addIngredient')}
        onClose={() => setPending(null)}
        onConfirm={(grams, _meal, cooked) => {
          if (pending) setIngs([...ings, { foodId: pending.id, grams: Math.round(grams * 10) / 10, prep: cooked?.prep }]);
          setPending(null);
        }}
      />
      {editIdx != null && ings[editIdx] && foodMap.get(ings[editIdx].foodId) && (
        <AmountSheet
          target={targetFromFood(foodMap.get(ings[editIdx].foodId)!)}
          showMeal={false}
          recipeMode
          initialGrams={ings[editIdx].grams}
          initialPrep={ings[editIdx].prep}
          confirmLabel={t('save')}
          onClose={() => setEditIdx(null)}
          onConfirm={(grams, _meal, cooked) => {
            setIngs(ings.map((x, j) => (j === editIdx ? { ...x, grams: Math.round(grams * 10) / 10, prep: cooked?.prep } : x)));
            setEditIdx(null);
          }}
          extra={
            <button
              class="btn danger block mt"
              onClick={() => {
                setIngs(ings.filter((_, j) => j !== editIdx));
                setEditIdx(null);
              }}
            >
              <Icon name="trash" size={18} /> {t('delete')}
            </button>
          }
        />
      )}
      <CookSheet
        open={cookOpen}
        onClose={() => setCookOpen(false)}
        rawG={rawG}
        defaultG={existing?.defaultCookedG}
        defaultName={name}
        onCook={async (weight, potName) => {
          const r = await save();
          const pot = await createPot(r, foodMap, weight, potName);
          setCookOpen(false);
          go('/pot/' + pot.id, true);
        }}
      />
      {node}
    </Page>
  );
}

function CookSheet({
  open,
  onClose,
  rawG,
  defaultG,
  defaultName,
  onCook,
}: {
  open: boolean;
  onClose: () => void;
  rawG: number;
  defaultG?: number;
  defaultName: string;
  onCook: (weight: number, name: string) => void;
}) {
  const [w, setW] = useState(defaultG ? String(defaultG) : '');
  const [n, setN] = useState('');
  const weight = num(w);
  return (
    <Sheet open={open} onClose={onClose} title={t('recipe.cook')}>
      <p class="muted small">{t('cook.weighHint', { raw: fmt(rawG) })}</p>
      <Field label={t('cook.cookedWeight')}>
        <NumInput value={w} onInput={(e) => setW((e.target as HTMLInputElement).value)} placeholder={String(Math.round(rawG))} autofocus />
      </Field>
      <Field label={t('cook.potName')}>
        <input value={n} placeholder={defaultName} onInput={(e) => setN((e.target as HTMLInputElement).value)} />
      </Field>
      {weight > 0 && weight < rawG * 0.4 && <div class="note warn">{t('cook.lowWeight')}</div>}
      <button class="btn primary block" disabled={!(weight > 0)} onClick={() => onCook(weight, n || defaultName)}>
        {t('cook.start')}
      </button>
    </Sheet>
  );
}

/* ---------- Topf ---------- */

export function PotPage({ id }: { id: string }) {
  const p = profile.value!;
  const pots = usePots();
  const info = pots.find((x) => x.pot.id === id);
  const [takeOpen, setTakeOpen] = useState(false);
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherG, setOtherG] = useState('');
  const { confirm, node } = useConfirm();
  const date = dateStr();

  const per100 = useMemo(() => (info ? potPer100(info.pot) : null), [info?.pot.id, info?.pot.cookedWeightG]);
  if (!info || !per100) return <Page title="…">{null}</Page>;
  const { pot, takes, remainingG } = info;
  const mine = takes.filter((x) => x.profileId === p.id).reduce((s, x) => s + x.grams, 0);
  const others = takes.filter((x) => x.profileId === null).reduce((s, x) => s + x.grams, 0);

  return (
    <Page title={pot.name} noNav>
      <Card>
        <div class="row between">
          <span class="muted">{t('pot.cooked', { time: new Date(pot.cookedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' ' + fmtClock(pot.cookedAt) })}</span>
          {pot.closed && <span class="tag">{t('pot.closed')}</span>}
        </div>
        <div class="pot-left">
          <b>{fmt(remainingG)}</b> g
          <span> / {fmt(pot.cookedWeightG)} g</span>
        </div>
        <Bar value={remainingG} max={pot.cookedWeightG} color="var(--c-pot)" />
        <div class="muted small mt">{t('pot.per100')}</div>
        <MacroLine n={per100} />
        <div class="muted small">
          {t('nutrient.sodium')} {fmt(per100.sodium)} mg · {t('nutrient.sugar')} {fmt(per100.sugar, 1)} g · {t('nutrient.fiber')} {fmt(per100.fiber, 1)} g
        </div>
      </Card>

      {!pot.closed && remainingG > 0 && (
        <div class="row gap">
          <button class="btn primary grow" onClick={() => setTakeOpen(true)}>
            {t('pot.takeMine')}
          </button>
          <button class="btn grow" onClick={() => setOtherOpen(true)}>
            {t('pot.takeOther')}
          </button>
        </div>
      )}

      <Card title={t('pot.takes')}>
        {takes.length === 0 && <p class="muted small">{t('pot.noTakes')}</p>}
        {[...takes].reverse().map((tk) => (
          <div class="entry static" key={tk.id}>
            <div class="row-main">
              <div class="row-title">{tk.profileId ? p.name : t('pot.other')}</div>
              <div class="row-sub">
                {fmt(tk.grams)} g · {fmt(scale(per100, tk.grams).kcal)} kcal · {fmtClock(tk.ts)}
              </div>
            </div>
            <button
              class="icon-btn"
              onClick={() => confirm(t('pot.deleteTake'), () => deleteTake(tk))}
              aria-label={t('delete')}
            >
              <Icon name="trash" size={18} />
            </button>
          </div>
        ))}
        {takes.length > 0 && (
          <div class="muted small mt">
            {p.name}: {fmt(mine)} g · {t('pot.other')}: {fmt(others)} g
          </div>
        )}
      </Card>

      <Card>
        <p class="muted small">{t('pot.householdHint')}</p>
      </Card>

      <div class="row gap">
        <button
          class="btn grow"
          onClick={() => db.pots.put({ ...pot, closed: !pot.closed, updatedAt: Date.now() })}
        >
          {pot.closed ? t('pot.reopen') : t('pot.close')}
        </button>
        <button
          class="btn danger"
          onClick={() =>
            confirm(t('pot.deleteAsk', { name: pot.name }), async () => {
              await deletePot(pot);
              back('/cook');
            })
          }
          aria-label={t('delete')}
        >
          <Icon name="trash" size={18} />
        </button>
      </div>

      <AmountSheet
        target={takeOpen ? { key: pot.id, name: pot.name, per100, units: [{ label: 'serving', grams: 200 }] } : null}
        meal={mealForNow()}
        maxGrams={remainingG}
        confirmLabel={t('add.confirm')}
        onClose={() => setTakeOpen(false)}
        onConfirm={async (grams, meal) => {
          await takeFromPot(p, pot, grams, meal as MealType, date);
          setTakeOpen(false);
          toast(t('added'));
        }}
      />
      <Sheet open={otherOpen} onClose={() => setOtherOpen(false)} title={t('pot.takeOther')}>
        <p class="muted small">{t('pot.otherHint')}</p>
        <Field label={t('amount') + ' (g)'}>
          <NumInput value={otherG} onInput={(e) => setOtherG((e.target as HTMLInputElement).value)} autofocus />
        </Field>
        <button
          class="btn primary block"
          disabled={!(num(otherG) > 0)}
          onClick={async () => {
            await takeForOther(pot, num(otherG));
            setOtherG('');
            setOtherOpen(false);
          }}
        >
          {t('save')}
        </button>
      </Sheet>
      {node}
    </Page>
  );
}

export { Chips, MEALS, mealName };
