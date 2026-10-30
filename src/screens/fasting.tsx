import { useState } from 'preact/hooks';
import { db, useLive } from '../db';
import { profile, saveProfile } from '../store';
import { useActiveFast } from '../components/fast';
import { planPhase, startFast, stopFast } from '../lib/actions';
import { fmt, fmtClock, fmtDuration } from '../lib/util';
import { t } from '../i18n';
import { Card, Chips, Empty, Field, Icon, Page, Ring, Sheet, toast, useConfirm, useNow } from '../components/ui';
import type { Fast } from '../types';

const PROTOCOLS = [
  { value: '12:12', fast: 12 },
  { value: '14:10', fast: 14 },
  { value: '16:8', fast: 16 },
  { value: '18:6', fast: 18 },
  { value: '20:4', fast: 20 },
  { value: 'off', fast: 0 },
];

const toLocalInput = (ts: number) => {
  const d = new Date(ts - new Date(ts).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};

export function FastingPage() {
  const p = profile.value!;
  const active = useActiveFast();
  const now = useNow(1000);
  const history = useLive(() => db.fasts.where('profileId').equals(p.id).filter((f) => !!f.end).reverse().sortBy('start'), [p.id]) ?? [];
  const [planOpen, setPlanOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustVal, setAdjustVal] = useState('');
  const { confirm, node } = useConfirm();

  const phase = planPhase(p.fasting, now);
  const elapsed = active ? now - active.start : 0;
  const target = (active?.targetHours ?? p.fasting.fastHours ?? 16) * 3600000;
  const reached = active && elapsed >= target;

  const last7 = history.filter((f) => f.end! > now - 7 * 86400000);
  const avg = last7.length ? last7.reduce((s, f) => s + (f.end! - f.start), 0) / last7.length : 0;
  const hits = last7.filter((f) => f.end! - f.start >= f.targetHours * 3600000).length;

  return (
    <Page
      title={t('fasting.title')}
      back={false}
      right={
        <button class="icon-btn" onClick={() => setPlanOpen(true)} aria-label={t('fasting.plan')}>
          <Icon name="settings" />
        </button>
      }
    >
      <Card class="fast-hero">
        <Ring value={elapsed} max={target} size={220} stroke={18} color={reached ? 'var(--good)' : 'var(--primary)'}>
          {active ? (
            <>
              <div class="ring-num">{fmtDuration(elapsed).replace(' min', '')}</div>
              <div class="ring-label">
                {reached ? t('fasting.reached') : t('fasting.remaining', { time: fmtDuration(target - elapsed) })}
              </div>
            </>
          ) : (
            <>
              <div class="ring-num">{p.fasting.protocol === 'off' ? '–' : p.fasting.protocol}</div>
              <div class="ring-label">{t('fasting.noActive')}</div>
            </>
          )}
        </Ring>
        {active ? (
          <>
            <p class="muted center">
              {t('fasting.since', { time: fmtClock(active.start) })} · {t('fasting.goalAt', { time: fmtClock(active.start + target) })}
            </p>
            <div class="row gap">
              <button
                class="btn grow"
                onClick={() => {
                  setAdjustVal(toLocalInput(active.start));
                  setAdjustOpen(true);
                }}
              >
                {t('fasting.adjust')}
              </button>
              <button class="btn primary grow" onClick={() => stopFast(active)}>
                {t('fasting.stop')}
              </button>
            </div>
          </>
        ) : (
          <>
            {phase && (
              <p class="muted center">
                {phase.phase === 'eating'
                  ? t('fasting.eatingUntil', { time: fmtClock(phase.until) })
                  : t('fasting.fastingUntil', { time: fmtClock(phase.until) })}
              </p>
            )}
            <button className="btn primary block" onClick={() => startFast(p)}>
              {t('fasting.start')}
            </button>
          </>
        )}
      </Card>

      <Card title={t('fasting.week')}>
        <div class="stats3">
          <div>
            <b>{last7.length}</b>
            <span>{t('fasting.count')}</span>
          </div>
          <div>
            <b>{hits}</b>
            <span>{t('fasting.hits')}</span>
          </div>
          <div>
            <b>{fmt(avg / 3600000, 1)} h</b>
            <span>{t('fasting.avg')}</span>
          </div>
        </div>
      </Card>

      <Card title={t('fasting.history')}>
        {history.length === 0 && <Empty icon="timer" text={t('fasting.noHistory')} />}
        {history.slice(0, 30).map((f) => (
          <HistoryRow key={f.id} f={f} onDelete={() => confirm(t('fasting.deleteAsk'), () => db.fasts.delete(f.id))} />
        ))}
      </Card>

      <PlanSheet open={planOpen} onClose={() => setPlanOpen(false)} />
      <Sheet open={adjustOpen} onClose={() => setAdjustOpen(false)} title={t('fasting.adjust')}>
        <Field label={t('fasting.startTime')} hint={t('fasting.adjustHint')}>
          <input type="datetime-local" value={adjustVal} max={toLocalInput(Date.now())} onInput={(e) => setAdjustVal((e.target as HTMLInputElement).value)} />
        </Field>
        <button
          class="btn primary block"
          onClick={async () => {
            const ts = new Date(adjustVal).getTime();
            if (active && ts && ts <= Date.now()) await db.fasts.put({ ...active, start: ts });
            setAdjustOpen(false);
          }}
        >
          {t('save')}
        </button>
      </Sheet>
      {node}
    </Page>
  );
}

function HistoryRow({ f, onDelete }: { f: Fast; onDelete: () => void }) {
  const dur = f.end! - f.start;
  const ok = dur >= f.targetHours * 3600000;
  return (
    <div class="entry static">
      <div class="row-main">
        <div class="row-title">
          {new Date(f.start).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
          <span class={'tag ' + (ok ? 'good' : '')}>{ok ? '✓' : f.targetHours + ' h'}</span>
        </div>
        <div class="row-sub">
          {fmtClock(f.start)} → {fmtClock(f.end!)} · {fmtDuration(dur)}
        </div>
      </div>
      <button class="icon-btn" onClick={onDelete} aria-label={t('delete')}>
        <Icon name="trash" size={18} />
      </button>
    </div>
  );
}

function PlanSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const p = profile.value!;
  const [protocol, setProtocol] = useState(p.fasting.protocol);
  const [eatStart, setEatStart] = useState(p.fasting.eatStart);
  return (
    <Sheet open={open} onClose={onClose} title={t('fasting.plan')}>
      <Chips
        value={protocol}
        onChange={setProtocol}
        options={PROTOCOLS.map((x) => ({ value: x.value, label: x.value === 'off' ? t('fasting.off') : x.value }))}
      />
      {protocol !== 'off' && (
        <Field label={t('fasting.eatStart')} hint={t('fasting.eatStartHint')}>
          <input type="time" value={eatStart} onInput={(e) => setEatStart((e.target as HTMLInputElement).value)} />
        </Field>
      )}
      <button
        class="btn primary block"
        onClick={async () => {
          const proto = PROTOCOLS.find((x) => x.value === protocol)!;
          await saveProfile({ ...p, fasting: { protocol, fastHours: proto.fast, eatStart } });
          toast(t('saved'));
          onClose();
        }}
      >
        {t('save')}
      </button>
    </Sheet>
  );
}
