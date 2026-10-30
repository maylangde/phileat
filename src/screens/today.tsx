import { useState } from 'preact/hooks';
import { profile } from '../store';
import { db } from '../db';
import { useDay } from '../lib/hooks';
import { MACROS, WATCH, pct, statusOf, sumEntries } from '../lib/nutrition';
import { dateStr, fmt, num, uid } from '../lib/util';
import { t, mealName } from '../i18n';
import { Bar, Card, Chips, Field, Icon, NumInput, Ring, Sheet, toast } from '../components/ui';
import { FastCard } from '../components/fast';
import { go } from '../router';
import { MEALS } from '../types';

/** Konservativ: verbrannte Kalorien zählen nur zur Hälfte zum Budget. */
export const WORKOUT_CREDIT = 0.5;

export function Today() {
  const p = profile.value!;
  const date = dateStr();
  const day = useDay(p.id, date);
  const [moveOpen, setMoveOpen] = useState(false);
  if (!day) return <div class="page" />;

  const eaten = sumEntries(day.entries);
  const burned = day.workouts.reduce((s, w) => s + w.kcal, 0);
  const budget = p.targets.kcal + burned * WORKOUT_CREDIT;
  const remaining = budget - eaten.kcal;
  const waterMl = day.water.reduce((s, w) => s + w.ml, 0);
  const hour = new Date().getHours();
  const greeting = hour < 11 ? t('greet.morning') : hour < 18 ? t('greet.day') : t('greet.evening');

  const addWater = async (ml: number) => {
    await db.water.put({ id: uid(), profileId: p.id, date, ml, ts: Date.now() });
  };
  const undoWater = async () => {
    const last = day.water[day.water.length - 1];
    if (last) await db.water.delete(last.id);
  };

  return (
    <div class="page">
      <header class="topbar home">
        <div>
          <div class="muted small">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1>
            {greeting}, {p.name}
          </h1>
        </div>
      </header>
      <main class="content">
        <Card class="hero">
          <div class="hero-grid">
            <Ring value={eaten.kcal} max={budget} size={156} stroke={15} color={remaining < 0 ? 'var(--bad)' : 'var(--primary)'}>
              <div class="ring-num">{fmt(Math.abs(remaining))}</div>
              <div class="ring-label">{remaining >= 0 ? t('today.left') : t('today.over')}</div>
            </Ring>
            <div class="hero-side">
              <div class="stat">
                <span>{t('today.eaten')}</span>
                <b>{fmt(eaten.kcal)}</b>
              </div>
              <div class="stat">
                <span>{t('today.goal')}</span>
                <b>{fmt(p.targets.kcal)}</b>
              </div>
              <div class="stat" onClick={() => setMoveOpen(true)} role="button">
                <span>
                  <Icon name="run" size={14} /> {t('today.active')}
                </span>
                <b>+{fmt(burned)}</b>
              </div>
            </div>
          </div>
          <div class="macros">
            {MACROS.map((m) => {
              const v = eaten[m.key];
              const target = p.targets[m.key as 'protein' | 'carbs' | 'fat'];
              return (
                <div class="macro" key={m.key}>
                  <div class="macro-top">
                    <span>{t('nutrient.' + m.key)}</span>
                    <b>
                      {fmt(v)} / {fmt(target)} g
                    </b>
                  </div>
                  <Bar value={v} max={target} color={m.color} over={m.kind === 'budget' && v > target * 1.1} />
                </div>
              );
            })}
          </div>
        </Card>

        <FastCard />

        <Card title={t('today.watch')}>
          <div class="watch">
            {WATCH.map((m) => {
              const v = eaten[m.key];
              const target = p.targets[m.key as 'sodium' | 'sugar' | 'satFat' | 'chol' | 'fiber'];
              const st = statusOf(m.kind, v, target);
              return (
                <div class="watch-row" key={m.key}>
                  <span class="watch-name">
                    {t('nutrient.' + m.key)}
                    <em> {m.kind === 'limit' ? t('target.limitShort') : t('target.minShort')}</em>
                  </span>
                  <div class="watch-bar">
                    <Bar value={v} max={target} color={st === 'warn' && m.kind === 'limit' ? 'var(--warn)' : m.color} over={st === 'over'} />
                  </div>
                  <span class={'watch-val ' + st}>
                    {fmt(v, m.unit === 'mg' ? 0 : 1)}
                    <small>/{fmt(target)} {m.unit}</small>
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card
          title={t('today.water')}
          action={
            <span class="muted small">
              {fmt(waterMl)} / {fmt(p.targets.waterMl)} ml
            </span>
          }
        >
          <Bar value={waterMl} max={p.targets.waterMl} color="var(--c-water)" />
          <div class="row gap mt wrap">
            {[150, 250, 500].map((ml) => (
              <button key={ml} class="btn small" onClick={() => addWater(ml)}>
                <Icon name="drop" size={16} /> +{ml}
              </button>
            ))}
            {day.water.length > 0 && (
              <button class="btn small ghost" onClick={undoWater}>
                {t('undo')}
              </button>
            )}
          </div>
        </Card>

        <Card title={t('today.meals')} action={<button class="link" onClick={() => go('/diary')}>{t('today.diary')}</button>}>
          {MEALS.map((m) => {
            const list = day.entries.filter((e) => e.meal === m);
            const kcal = list.reduce((s, e) => s + e.nutrients.kcal, 0);
            return (
              <button class="meal-line" key={m} onClick={() => go(`/add?meal=${m}&date=${date}`)}>
                <span>
                  <b>{mealName(m)}</b>
                  <small>{list.length ? list.map((e) => e.name).join(', ') : t('today.nothing')}</small>
                </span>
                <span class="meal-kcal">{list.length ? fmt(kcal) + ' kcal' : ''}</span>
                <Icon name="plus" size={18} />
              </button>
            );
          })}
        </Card>
      </main>
      <WorkoutSheet open={moveOpen} onClose={() => setMoveOpen(false)} date={date} />
    </div>
  );
}

const PRESETS = [
  { key: 'walk', kcal: 100 },
  { key: 'run', kcal: 300 },
  { key: 'bike', kcal: 200 },
  { key: 'strength', kcal: 200 },
  { key: 'swim', kcal: 250 },
];

export function WorkoutSheet({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const p = profile.value!;
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const day = useDay(p.id, date);
  const save = async () => {
    if (num(kcal) <= 0) return;
    await db.workouts.put({ id: uid(), profileId: p.id, date, name: name || t('workout.default'), kcal: num(kcal), ts: Date.now() });
    setName('');
    setKcal('');
    toast(t('saved'));
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={t('workout.title')}>
      <p class="muted small">{t('workout.hint')}</p>
      <Chips
        value={name}
        onChange={(v) => {
          const pr = PRESETS.find((x) => t('workout.' + x.key) === v)!;
          setName(v);
          setKcal(String(pr.kcal));
        }}
        options={PRESETS.map((pr) => ({ value: t('workout.' + pr.key), label: t('workout.' + pr.key) }))}
      />
      <Field label={t('workout.name')}>
        <input value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
      </Field>
      <Field label={t('workout.kcal')}>
        <NumInput value={kcal} onInput={(e) => setKcal((e.target as HTMLInputElement).value)} />
      </Field>
      <button class="btn primary block" disabled={num(kcal) <= 0} onClick={save}>
        {t('save')}
      </button>
      {day && day.workouts.length > 0 && (
        <div class="list mt">
          {day.workouts.map((w) => (
            <div class="row-item static" key={w.id}>
              <div class="row-main">
                <div class="row-title">{w.name}</div>
                <div class="row-sub">{fmt(w.kcal)} kcal</div>
              </div>
              <button class="icon-btn" onClick={() => db.workouts.delete(w.id)} aria-label={t('delete')}>
                <Icon name="trash" size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}

export { pct };
