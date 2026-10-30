import { useState } from 'preact/hooks';
import { db, useLive } from '../db';
import { profile, saveProfile } from '../store';
import { addDays, dateStr, fmt, num, parseDate, uid } from '../lib/util';
import { sumEntries, weeksToGoal } from '../lib/nutrition';
import { t } from '../i18n';
import { Card, Empty, Field, Icon, NumInput, Page, Segmented, Sheet, toast } from '../components/ui';
import { BarChart, LineChart } from '../components/charts';

export function Progress() {
  const p = profile.value!;
  const [range, setRange] = useState<'30' | '90' | 'all'>('90');
  const [open, setOpen] = useState(false);
  const [kg, setKg] = useState('');

  const weights = useLive(() => db.weights.where('profileId').equals(p.id).sortBy('date'), [p.id]) ?? [];
  const week = useLive(async () => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(dateStr(), i - 6));
    const entries = await db.entries.where('profileId').equals(p.id).filter((e) => e.date >= days[0]).toArray();
    return days.map((d) => ({
      day: d,
      label: parseDate(d).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2),
      n: sumEntries(entries.filter((e) => e.date === d)),
      has: entries.some((e) => e.date === d),
    }));
  }, [p.id]);

  const cutoff = range === 'all' ? '' : addDays(dateStr(), -Number(range));
  const shown = weights.filter((w) => w.date >= cutoff);
  const latest = weights[weights.length - 1];
  const first = weights[0];
  const current = latest?.kg ?? p.startWeightKg;
  const diff = first && latest ? latest.kg - first.kg : 0;
  const weeks = p.goalWeightKg && p.goal !== 'maintain' ? weeksToGoal(current, p.goalWeightKg, p.weeklyRateKg) : null;
  const bmi = current / (p.heightCm / 100) ** 2;

  const logged = week?.filter((d) => d.has) ?? [];
  const avgKcal = logged.length ? logged.reduce((s, d) => s + d.n.kcal, 0) / logged.length : 0;
  const avgProt = logged.length ? logged.reduce((s, d) => s + d.n.protein, 0) / logged.length : 0;
  const avgNa = logged.length ? logged.reduce((s, d) => s + d.n.sodium, 0) / logged.length : 0;

  const save = async () => {
    const v = num(kg);
    if (v < 25 || v > 400) return;
    const today = dateStr();
    const same = weights.find((w) => w.date === today);
    await db.weights.put({ id: same?.id ?? uid(), profileId: p.id, date: today, kg: v });
    setOpen(false);
    setKg('');
    toast(t('saved'));
  };

  return (
    <Page
      title={t('progress.title')}
      right={
        <button class="icon-btn" onClick={() => { setKg(String(current)); setOpen(true); }} aria-label={t('progress.logWeight')}>
          <Icon name="plus" />
        </button>
      }
    >
      <Card title={t('progress.weight')} action={<span class="muted small">{fmt(current, 1)} kg</span>}>
        <Segmented
          value={range}
          onChange={setRange}
          options={[
            { value: '30', label: '30 ' + t('days') },
            { value: '90', label: '90 ' + t('days') },
            { value: 'all', label: t('all') },
          ]}
        />
        {shown.length > 0 ? (
          <LineChart points={shown.map((w) => ({ x: parseDate(w.date).getTime(), y: w.kg }))} goal={p.goalWeightKg} unit="kg" />
        ) : (
          <Empty icon="scale" text={t('progress.noWeight')} />
        )}
        <div class="stats3">
          <div>
            <b>{diff > 0 ? '+' : ''}{fmt(diff, 1)} kg</b>
            <span>{t('progress.sinceStart')}</span>
          </div>
          <div>
            <b>{fmt(bmi, 1)}</b>
            <span>BMI</span>
          </div>
          <div>
            <b>{weeks ? weeks + ' ' + t('week.short') : '–'}</b>
            <span>{t('progress.toGoal')}</span>
          </div>
        </div>
      </Card>

      <Card title={t('progress.week')}>
        {week && <BarChart data={week.map((d) => ({ label: d.label, value: Math.round(d.n.kcal) }))} target={p.targets.kcal} />}
        <div class="stats3">
          <div>
            <b>{fmt(avgKcal)}</b>
            <span>kcal Ø</span>
          </div>
          <div>
            <b>{fmt(avgProt)} g</b>
            <span>{t('nutrient.protein')} Ø</span>
          </div>
          <div>
            <b>{fmt(avgNa)}</b>
            <span>{t('nutrient.sodium')} Ø mg</span>
          </div>
        </div>
      </Card>

      <Card title={t('progress.history')}>
        {[...weights].reverse().slice(0, 14).map((w) => (
          <div class="entry static" key={w.id}>
            <div class="row-main">
              <div class="row-title">{fmt(w.kg, 1)} kg</div>
              <div class="row-sub">{parseDate(w.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            </div>
            <button class="icon-btn" onClick={() => db.weights.delete(w.id)} aria-label={t('delete')}>
              <Icon name="trash" size={18} />
            </button>
          </div>
        ))}
      </Card>

      <Sheet open={open} onClose={() => setOpen(false)} title={t('progress.logWeight')}>
        <Field label={t('profile.weight')}>
          <NumInput value={kg} onInput={(e) => setKg((e.target as HTMLInputElement).value)} autofocus />
        </Field>
        <p class="muted small">{t('progress.recalcHint')}</p>
        <button class="btn primary block" disabled={!(num(kg) > 25)} onClick={save}>
          {t('save')}
        </button>
      </Sheet>
    </Page>
  );
}

export { saveProfile };
