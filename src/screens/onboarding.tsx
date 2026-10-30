import { useState } from 'preact/hooks';
import type { Activity, Goal, Profile, Sex, Targets } from '../types';
import { setLang, t, lang } from '../i18n';
import { calcTargets, weeksToGoal } from '../lib/nutrition';
import { Chips, Field, NumInput, Segmented } from '../components/ui';
import { dateStr, num, uid } from '../lib/util';
import { saveProfile } from '../store';
import { db } from '../db';
import { go } from '../router';
import { TargetsForm } from './targets-form';

const PROTOCOLS = [
  { value: '12:12', fast: 12 },
  { value: '14:10', fast: 14 },
  { value: '16:8', fast: 16 },
  { value: '18:6', fast: 18 },
  { value: '20:4', fast: 20 },
  { value: 'off', fast: 0 },
];

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [sex, setSex] = useState<Sex>('m');
  const [birth, setBirth] = useState('1990-01-01');
  const [height, setHeight] = useState('175');
  const [weight, setWeight] = useState('80');
  const [goal, setGoal] = useState<Goal>('lose');
  const [goalWeight, setGoalWeight] = useState('');
  const [activity, setActivity] = useState<Activity>('light');
  const [rate, setRate] = useState(0.5);
  const [protocol, setProtocol] = useState('16:8');
  const [eatStart, setEatStart] = useState('12:00');
  const [targets, setTargets] = useState<Targets | null>(null);

  const valid0 = name.trim().length > 0 && num(height) > 100 && num(weight) > 30 && birth.length === 10;

  const compute = () =>
    calcTargets({ sex, heightCm: num(height), birthDate: birth, activity, goal, weeklyRateKg: rate, weightKg: num(weight) });

  const next = () => {
    if (step === 2) setTargets(compute());
    setStep(step + 1);
  };

  const finish = async () => {
    const now = Date.now();
    const proto = PROTOCOLS.find((p) => p.value === protocol)!;
    const p: Profile = {
      id: uid(),
      name: name.trim(),
      sex,
      birthDate: birth,
      heightCm: num(height),
      startWeightKg: num(weight),
      goalWeightKg: num(goalWeight) || undefined,
      activity,
      goal,
      weeklyRateKg: rate,
      targets: targets ?? compute(),
      fasting: { protocol, fastHours: proto.fast, eatStart },
      lang: lang.value,
      createdAt: now,
      updatedAt: now,
    };
    await saveProfile(p);
    await db.weights.put({ id: uid(), profileId: p.id, date: dateStr(), kg: p.startWeightKg });
    go('/', true);
  };

  const weeks = goalWeight && goal !== 'maintain' ? weeksToGoal(num(weight), num(goalWeight), rate) : null;

  return (
    <div class="page no-nav onboarding">
      <div class="onb-head">
        <div class="logo">PhilEat</div>
        <div class="steps">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} class={i <= step ? 'on' : ''} />
          ))}
        </div>
      </div>
      <main class="content">
        {step === 0 && (
          <>
            <h1>{t('onb.welcome')}</h1>
            <p class="muted">{t('onb.intro')}</p>
            <Segmented
              value={lang.value}
              onChange={(l) => setLang(l)}
              options={[
                { value: 'de', label: 'Deutsch' },
                { value: 'en', label: 'English' },
              ]}
            />
            <Field label={t('profile.name')}>
              <input value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} autocomplete="given-name" />
            </Field>
            <Field label={t('profile.sex')}>
              <Segmented
                value={sex}
                onChange={setSex}
                options={[
                  { value: 'f', label: t('sex.f') },
                  { value: 'm', label: t('sex.m') },
                ]}
              />
            </Field>
            <Field label={t('profile.birth')}>
              <input type="date" value={birth} max={dateStr()} onInput={(e) => setBirth((e.target as HTMLInputElement).value)} />
            </Field>
            <div class="two">
              <Field label={t('profile.height')}>
                <NumInput value={height} onInput={(e) => setHeight((e.target as HTMLInputElement).value)} />
              </Field>
              <Field label={t('profile.weight')}>
                <NumInput value={weight} onInput={(e) => setWeight((e.target as HTMLInputElement).value)} />
              </Field>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h1>{t('onb.goal')}</h1>
            <Chips
              value={goal}
              onChange={setGoal}
              options={[
                { value: 'lose', label: t('goal.lose') },
                { value: 'maintain', label: t('goal.maintain') },
                { value: 'gain', label: t('goal.gain') },
              ]}
            />
            {goal !== 'maintain' && (
              <Field label={t('profile.goalWeight')} hint={weeks ? t('onb.weeks', { w: weeks }) : undefined}>
                <NumInput value={goalWeight} onInput={(e) => setGoalWeight((e.target as HTMLInputElement).value)} />
              </Field>
            )}
            {goal === 'lose' && (
              <Field label={t('profile.rate')} hint={t('profile.rateHint')}>
                <Chips
                  value={rate}
                  onChange={setRate}
                  options={[0.25, 0.5, 0.75].map((v) => ({ value: v, label: `${v} kg / ${t('week')}` }))}
                />
              </Field>
            )}
            <Field label={t('profile.activity')}>
              <select value={activity} onChange={(e) => setActivity((e.target as HTMLSelectElement).value as Activity)}>
                {(['sedentary', 'light', 'moderate', 'active'] as Activity[]).map((a) => (
                  <option value={a} key={a}>
                    {t('activity.' + a)}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <h1>{t('onb.fasting')}</h1>
            <p class="muted">{t('onb.fastingHint')}</p>
            <Chips
              value={protocol}
              onChange={setProtocol}
              options={PROTOCOLS.map((p) => ({ value: p.value, label: p.value === 'off' ? t('fasting.off') : p.value }))}
            />
            {protocol !== 'off' && (
              <Field label={t('fasting.eatStart')} hint={t('fasting.eatStartHint')}>
                <input type="time" value={eatStart} onInput={(e) => setEatStart((e.target as HTMLInputElement).value)} />
              </Field>
            )}
          </>
        )}

        {step === 3 && targets && (
          <>
            <h1>{t('onb.targets')}</h1>
            <p class="muted">{t('onb.targetsHint')}</p>
            <TargetsForm value={targets} onChange={setTargets} />
            <p class="note">{t('disclaimer')}</p>
          </>
        )}
      </main>
      <footer class="onb-foot">
        {step > 0 && (
          <button class="btn" onClick={() => setStep(step - 1)}>
            {t('back')}
          </button>
        )}
        {step < 3 ? (
          <button class="btn primary grow" disabled={step === 0 && !valid0} onClick={next}>
            {t('next')}
          </button>
        ) : (
          <button class="btn primary grow" onClick={finish}>
            {t('onb.start')}
          </button>
        )}
      </footer>
    </div>
  );
}
