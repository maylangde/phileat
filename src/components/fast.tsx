import { db, useLive } from '../db';
import { profile } from '../store';
import { t } from '../i18n';
import { planPhase, startFast, stopFast } from '../lib/actions';
import { fmtClock, fmtDuration } from '../lib/util';
import { Bar, Icon, useNow } from './ui';
import { go } from '../router';
import type { Fast } from '../types';

export function useActiveFast(): Fast | undefined | null {
  const p = profile.value;
  return useLive(async () => {
    if (!p) return null;
    const list = await db.fasts.where('profileId').equals(p.id).filter((f) => !f.end).toArray();
    return list[0] ?? null;
  }, [p?.id]);
}

export function FastCard() {
  const p = profile.value!;
  const active = useActiveFast();
  const now = useNow(30000);
  if (p.fasting.protocol === 'off') return null;
  const phase = planPhase(p.fasting, now);

  return (
    <section class="card tappable" onClick={() => go('/fasting')}>
      <div class="card-head">
        <h2>
          <Icon name="timer" size={18} /> {t('fasting.title')}
        </h2>
        <span class="tag">{p.fasting.protocol}</span>
      </div>
      {active ? (
        <>
          <div class="fast-line">
            <b>{fmtDuration(now - active.start)}</b>
            <span>
              / {active.targetHours} h {now - active.start >= active.targetHours * 3600000 && '✓'}
            </span>
          </div>
          <Bar value={now - active.start} max={active.targetHours * 3600000} color="var(--primary)" />
          <div class="row between mt">
            <span class="muted small">{t('fasting.since', { time: fmtClock(active.start) })}</span>
            <button
              class="btn small"
              onClick={(e) => {
                e.stopPropagation();
                stopFast(active);
              }}
            >
              {t('fasting.stop')}
            </button>
          </div>
        </>
      ) : (
        <div class="row between">
          <span class="muted">
            {phase
              ? phase.phase === 'eating'
                ? t('fasting.eatingUntil', { time: fmtClock(phase.until) })
                : t('fasting.fastingUntil', { time: fmtClock(phase.until) })
              : t('fasting.noActive')}
          </span>
          <button
            class="btn primary small"
            onClick={(e) => {
              e.stopPropagation();
              startFast(p);
            }}
          >
            {t('fasting.start')}
          </button>
        </div>
      )}
    </section>
  );
}
