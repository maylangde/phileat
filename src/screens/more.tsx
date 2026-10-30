import { useRef, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import { currentWeight, profile, saveProfile } from '../store';
import { db, exportAll, exportShareable, getMeta, importAll, importShareable, resetAll, setMeta, useLive } from '../db';
import { setLang, t, lang } from '../i18n';
import { calcTargets } from '../lib/nutrition';
import { dateStr, num, shareOrDownload } from '../lib/util';
import { Card, Chips, Field, Icon, NumInput, Page, Segmented, toast, useConfirm } from '../components/ui';
import { go } from '../router';
import { menuPos, setMenuPos, setTheme, themePref, type MenuPos, type ThemePref } from '../prefs';
import { TargetsForm } from './targets-form';
import type { Activity, Goal, Lang, Profile, Sex } from '../types';

export const installEvent = signal<Event | null>(null);

export function More() {
  const items = [
    { to: '/progress', icon: 'chart', label: t('more.progress') },
    { to: '/household', icon: 'users', label: t('more.household') },
    { to: '/profile', icon: 'scale', label: t('more.profile') },
    { to: '/settings', icon: 'settings', label: t('more.settings') },
  ];
  return (
    <Page title={t('more.title')} back={false}>
      <div class="list">
        {items.map((i) => (
          <button class="row-item big" key={i.to} onClick={() => go(i.to)}>
            <Icon name={i.icon} />
            <div class="row-main">
              <div class="row-title">{i.label}</div>
            </div>
            <Icon name="back" size={18} />
          </button>
        ))}
      </div>
    </Page>
  );
}

/* ---------- Profil & Ziele ---------- */

export function ProfilePage() {
  const p = profile.value!;
  const [d, setD] = useState<Profile>(p);
  const [height, setHeight] = useState(String(p.heightCm));
  const [goalW, setGoalW] = useState(p.goalWeightKg ? String(p.goalWeightKg) : '');

  const recalc = async () => {
    const weightKg = await currentWeight(p);
    const targets = calcTargets({
      sex: d.sex,
      heightCm: num(height),
      birthDate: d.birthDate,
      activity: d.activity,
      goal: d.goal,
      weeklyRateKg: d.weeklyRateKg,
      weightKg,
    });
    setD({ ...d, targets });
    toast(t('profile.recalculated'));
  };

  const save = async () => {
    await saveProfile({ ...d, heightCm: num(height) || d.heightCm, goalWeightKg: num(goalW) || undefined });
    toast(t('saved'));
  };

  return (
    <Page title={t('more.profile')}>
      <Card>
        <Field label={t('profile.name')}>
          <input value={d.name} onInput={(e) => setD({ ...d, name: (e.target as HTMLInputElement).value })} />
        </Field>
        <Field label={t('profile.sex')}>
          <Segmented
            value={d.sex}
            onChange={(v: Sex) => setD({ ...d, sex: v })}
            options={[
              { value: 'f', label: t('sex.f') },
              { value: 'm', label: t('sex.m') },
            ]}
          />
        </Field>
        <Field label={t('profile.birth')}>
          <input type="date" value={d.birthDate} max={dateStr()} onInput={(e) => setD({ ...d, birthDate: (e.target as HTMLInputElement).value })} />
        </Field>
        <div class="two">
          <Field label={t('profile.height')}>
            <NumInput value={height} onInput={(e) => setHeight((e.target as HTMLInputElement).value)} />
          </Field>
          <Field label={t('profile.goalWeight')}>
            <NumInput value={goalW} onInput={(e) => setGoalW((e.target as HTMLInputElement).value)} />
          </Field>
        </div>
        <Field label={t('onb.goal')}>
          <Chips
            value={d.goal}
            onChange={(v: Goal) => setD({ ...d, goal: v })}
            options={[
              { value: 'lose', label: t('goal.lose') },
              { value: 'maintain', label: t('goal.maintain') },
              { value: 'gain', label: t('goal.gain') },
            ]}
          />
        </Field>
        {d.goal === 'lose' && (
          <Field label={t('profile.rate')} hint={t('profile.rateHint')}>
            <Chips
              value={d.weeklyRateKg}
              onChange={(v) => setD({ ...d, weeklyRateKg: v })}
              options={[0.25, 0.5, 0.75].map((v) => ({ value: v, label: `${v} kg / ${t('week')}` }))}
            />
          </Field>
        )}
        <Field label={t('profile.activity')}>
          <select value={d.activity} onChange={(e) => setD({ ...d, activity: (e.target as HTMLSelectElement).value as Activity })}>
            {(['sedentary', 'light', 'moderate', 'active'] as Activity[]).map((a) => (
              <option value={a} key={a}>
                {t('activity.' + a)}
              </option>
            ))}
          </select>
        </Field>
      </Card>

      <Card title={t('profile.targets')}>
        <button class="btn block ghost" onClick={recalc}>
          <Icon name="bolt" size={18} /> {t('profile.recalc')}
        </button>
        <TargetsForm value={d.targets} onChange={(targets) => setD({ ...d, targets })} />
        <p class="note">{t('disclaimer')}</p>
      </Card>
      <button class="btn primary block" onClick={save}>
        {t('save')}
      </button>
    </Page>
  );
}

/* ---------- Einstellungen ---------- */

export function Settings() {
  const p = profile.value!;
  const fileRef = useRef<HTMLInputElement>(null);
  const { confirm, node } = useConfirm();
  const [busy, setBusy] = useState(false);

  const exportBackup = async () => {
    const json = await exportAll();
    await shareOrDownload(`phileat-backup-${dateStr()}.json`, json);
    await setMeta('lastBackup', Date.now());
  };
  const lastBackup = useLive(() => getMeta<number>('lastBackup'), []);

  const onImport = async (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = '';
    if (!f) return;
    const text = await f.text();
    confirm(t('settings.importAsk'), async () => {
      try {
        setBusy(true);
        await importAll(text);
        location.hash = '/';
        location.reload();
      } catch {
        toast(t('settings.importError'));
      } finally {
        setBusy(false);
      }
    });
  };

  return (
    <Page title={t('more.settings')}>
      <Card title={t('settings.language')}>
        <Segmented
          value={lang.value}
          onChange={async (l: Lang) => {
            setLang(l);
            await saveProfile({ ...p, lang: l });
          }}
          options={[
            { value: 'de', label: 'Deutsch' },
            { value: 'en', label: 'English' },
          ]}
        />
      </Card>

      <Card title={t('settings.theme')}>
        <Segmented
          value={themePref.value}
          onChange={(v: ThemePref) => setTheme(v)}
          options={[
            { value: 'light', label: t('theme.light') },
            { value: 'dark', label: t('theme.dark') },
            { value: 'system', label: t('theme.system') },
          ]}
        />
      </Card>

      <Card title={t('settings.menu')}>
        <p class="muted small">{t('settings.menuHint')}</p>
        <Segmented
          value={menuPos.value}
          onChange={(v: MenuPos) => setMenuPos(v)}
          options={[
            { value: 'left', label: t('menu.left') },
            { value: 'center', label: t('menu.center') },
            { value: 'right', label: t('menu.right') },
          ]}
        />
      </Card>

      {installEvent.value && (
        <Card title={t('settings.install')}>
          <p class="muted small">{t('settings.installHint')}</p>
          <button
            class="btn primary block"
            onClick={async () => {
              const ev = installEvent.value as Event & { prompt: () => Promise<void> };
              await ev.prompt();
              installEvent.value = null;
            }}
          >
            <Icon name="download" size={18} /> {t('settings.installBtn')}
          </button>
        </Card>
      )}

      <Card title={t('settings.backup')}>
        <p class="muted small">{t('settings.backupHint')}</p>
        {lastBackup ? (
          <p class="small">{t('settings.lastBackup', { date: new Date(lastBackup).toLocaleDateString() })}</p>
        ) : (
          <p class="note warn">{t('settings.noBackup')}</p>
        )}
        <div class="row gap">
          <button class="btn grow" onClick={exportBackup}>
            <Icon name="share" size={18} /> {t('settings.export')}
          </button>
          <button class="btn grow" disabled={busy} onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={18} /> {t('settings.import')}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onImport} />
      </Card>

      <Card title={t('settings.data')}>
        <p class="muted small">{t('settings.dataHint')}</p>
        <button class="btn danger block" onClick={() => confirm(t('settings.resetAsk'), resetAll)}>
          <Icon name="trash" size={18} /> {t('settings.reset')}
        </button>
      </Card>

      <Card title={t('settings.about')}>
        <p class="small">{t('settings.aboutText')}</p>
        <p class="note">{t('disclaimer')}</p>
      </Card>
      {node}
    </Page>
  );
}

/* ---------- Haushalt (Platzhalter) ---------- */

export function Household() {
  const p = profile.value!;
  const fileRef = useRef<HTMLInputElement>(null);
  const hh = useLive(() => getMeta<string>('householdName'), []);
  const [name, setName] = useState<string | null>(null);

  const exportShare = async () => {
    await shareOrDownload(`phileat-austausch-${dateStr()}.json`, await exportShareable());
  };
  const onImport = async (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = '';
    if (!f) return;
    try {
      const r = await importShareable(await f.text());
      toast(t('household.imported', { foods: r.foods, recipes: r.recipes }));
    } catch {
      toast(t('settings.importError'));
    }
  };

  return (
    <Page title={t('more.household')}>
      <Card>
        <div class="soon">
          <Icon name="users" size={28} />
          <h2>{t('household.soonTitle')}</h2>
          <p class="muted">{t('household.soonText')}</p>
        </div>
        <ul class="plain">
          <li>{t('household.f1')}</li>
          <li>{t('household.f2')}</li>
          <li>{t('household.f3')}</li>
          <li>{t('household.f4')}</li>
        </ul>
        <button class="btn block" disabled>
          <Icon name="link" size={18} /> {t('household.connect')}
        </button>
      </Card>

      <Card title={t('household.nameTitle')}>
        <Field label={t('household.name')}>
          <input
            value={name ?? hh ?? ''}
            placeholder={p.name + ' & …'}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            onBlur={() => name != null && setMeta('householdName', name.trim())}
          />
        </Field>
      </Card>

      <Card title={t('household.exchange')}>
        <p class="muted small">{t('household.exchangeHint')}</p>
        <div class="row gap">
          <button class="btn grow" onClick={exportShare}>
            <Icon name="share" size={18} /> {t('household.send')}
          </button>
          <button class="btn grow" onClick={() => fileRef.current?.click()}>
            <Icon name="download" size={18} /> {t('household.receive')}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onImport} />
      </Card>
    </Page>
  );
}

export { db };
