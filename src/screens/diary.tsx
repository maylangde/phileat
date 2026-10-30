import { useState } from 'preact/hooks';
import { profile } from '../store';
import { db } from '../db';
import { useDay } from '../lib/hooks';
import { sumEntries } from '../lib/nutrition';
import { addDays, dateStr, fmt, parseDate } from '../lib/util';
import { t, mealName } from '../i18n';
import { Bar, Card, Empty, Icon, Page, useConfirm } from '../components/ui';
import { AmountSheet, MacroLine } from '../components/food';
import { MEALS, type Entry } from '../types';
import { go, route } from '../router';
import { deleteEntry } from '../lib/foods';
import { updateEntryGrams } from '../lib/actions';
import { scale } from '../lib/nutrition';
import { WorkoutSheet } from './today';

export function Diary() {
  const p = profile.value!;
  const date = route.value.query.get('date') ?? dateStr();
  const day = useDay(p.id, date);
  const [edit, setEdit] = useState<Entry | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const { confirm, node } = useConfirm();

  const shift = (n: number) => go('/diary?date=' + addDays(date, n), true);
  const isToday = date === dateStr();
  const title = isToday
    ? t('diary.today')
    : parseDate(date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

  const total = day ? sumEntries(day.entries) : null;

  return (
    <Page title={t('diary.title')} back={false}>
      <div class="datebar">
        <button class="icon-btn" onClick={() => shift(-1)} aria-label="−1">
          <Icon name="back" />
        </button>
        <label class="date-pick">
          <span>{title}</span>
          <input type="date" value={date} max={dateStr()} onChange={(e) => go('/diary?date=' + (e.target as HTMLInputElement).value, true)} />
        </label>
        <button class="icon-btn flip" onClick={() => shift(1)} disabled={isToday} aria-label="+1">
          <Icon name="back" />
        </button>
      </div>

      {total && (
        <Card>
          <div class="row between">
            <b class="big">{fmt(total.kcal)} kcal</b>
            <span class="muted small">
              {t('today.goal')} {fmt(p.targets.kcal)}
            </span>
          </div>
          <Bar value={total.kcal} max={p.targets.kcal} color="var(--primary)" over={total.kcal > p.targets.kcal} />
          <div class="muted small mt">
            {t('short.protein')} {fmt(total.protein)} g · {t('short.carbs')} {fmt(total.carbs)} g · {t('short.fat')} {fmt(total.fat)} g · {t('nutrient.sodium')} {fmt(total.sodium)} mg
          </div>
        </Card>
      )}

      {day &&
        MEALS.map((m) => {
          const list = day.entries.filter((e) => e.meal === m);
          const kcal = list.reduce((s, e) => s + e.nutrients.kcal, 0);
          return (
            <Card key={m} title={mealName(m)} action={<span class="muted small">{list.length ? fmt(kcal) + ' kcal' : ''}</span>}>
              {list.map((e) => (
                <button class="entry" key={e.id} onClick={() => setEdit(e)}>
                  <div class="row-main">
                    <div class="row-title">
                      {e.kind === 'pot' && <Icon name="pot" size={15} />} {e.name}
                    </div>
                    <div class="row-sub">
                      {e.grams ? fmt(e.grams) + ' g · ' : ''}
                      <MacroLine n={e.nutrients} />
                    </div>
                  </div>
                </button>
              ))}
              <button class="add-line" onClick={() => go(`/add?meal=${m}&date=${date}`)}>
                <Icon name="plus" size={16} /> {t('diary.add')}
              </button>
            </Card>
          );
        })}

      {day && day.entries.length === 0 && <Empty icon="book" text={t('diary.empty')} />}

      <div class="row gap mt">
        <button class="btn grow" onClick={() => setMoveOpen(true)}>
          <Icon name="run" size={18} /> {t('workout.title')}
        </button>
      </div>

      <EntrySheet entry={edit} onClose={() => setEdit(null)} onDelete={(e) => confirm(t('diary.deleteAsk', { name: e.name }), async () => { await deleteEntry(e); setEdit(null); })} />
      <WorkoutSheet open={moveOpen} onClose={() => setMoveOpen(false)} date={date} />
      {node}
    </Page>
  );
}

function EntrySheet({ entry, onClose, onDelete }: { entry: Entry | null; onClose: () => void; onDelete: (e: Entry) => void }) {
  if (!entry) return null;
  const deleteBtn = (
    <button class="btn danger block mt" onClick={() => onDelete(entry)}>
      <Icon name="trash" size={18} /> {t('delete')}
    </button>
  );
  if (!entry.grams) {
    // Schnell-Eintrag: nur löschen
    return (
      <>
        <div class="sheet-wrap" onClick={onClose}>
          <div class="sheet" onClick={(ev) => ev.stopPropagation()}>
            <div class="sheet-grip" />
            <div class="sheet-head">
              <h2>{entry.name}</h2>
              <button class="icon-btn" onClick={onClose} aria-label={t('close')}>
                <Icon name="x" />
              </button>
            </div>
            <div class="sheet-body">
              <MacroLine n={entry.nutrients} />
              {deleteBtn}
            </div>
          </div>
        </div>
      </>
    );
  }
  const per100 = scale(entry.nutrients, 10000 / entry.grams);
  return (
    <AmountSheet
      target={{ key: entry.id, name: entry.name, per100, units: [] }}
      initialGrams={entry.grams}
      meal={entry.meal}
      onClose={onClose}
      confirmLabel={t('save')}
      onConfirm={async (grams, meal) => {
        await updateEntryGrams(entry, grams, meal);
        onClose();
      }}
      extra={deleteBtn}
    />
  );
}

export { db };
