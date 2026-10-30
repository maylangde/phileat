import type { CookLevel, CookMethod, OilType } from '../types';
import { t } from '../i18n';
import type { CookResult } from '../lib/cooking';
import { fmt } from '../lib/util';
import { Chips, NumInput } from './ui';

const LEVELS: CookLevel[] = ['short', 'normal', 'long'];
const OIL_TYPES: OilType[] = ['veg', 'coconut', 'palm', 'butter'];
const OIL_METHODS: CookMethod[] = ['panfry', 'deepfry', 'airfry'];

/** Auswahl der Zubereitung (Garart, Länge, Gewichtsbezug, Öl) mit Ergebnis. */
export function PrepPanel({
  methods,
  method,
  onMethod,
  level,
  onLevel,
  basis,
  onBasis,
  allowBasis,
  oilStr,
  onOil,
  oilType,
  onOilType,
  cook,
  per100Cooked,
}: {
  methods: CookMethod[];
  method: CookMethod | null;
  onMethod: (m: CookMethod | null) => void;
  level: CookLevel;
  onLevel: (l: CookLevel) => void;
  basis: 'raw' | 'cooked';
  onBasis: (b: 'raw' | 'cooked') => void;
  allowBasis: boolean;
  oilStr: string | null;
  onOil: (v: string | null) => void;
  oilType: OilType;
  onOilType: (o: OilType) => void;
  cook: CookResult | null;
  per100Cooked: number | null;
}) {
  return (
    <div class="prep">
      <div class="prep-title">{t('prep.title')}</div>
      <Chips
        value={method ?? 'none'}
        onChange={(v) => onMethod(v === 'none' ? null : (v as CookMethod))}
        options={[{ value: 'none', label: t('prep.none') }, ...methods.map((m) => ({ value: m as string, label: t('prep.' + m) }))]}
      />
      {method && (
        <>
          {allowBasis && (
            <div class="prep-row">
              <span>{t('prep.basis')}</span>
              <Chips
                value={basis}
                onChange={onBasis}
                options={[
                  { value: 'raw', label: t('prep.basisRaw') },
                  { value: 'cooked', label: t('prep.basisCooked') },
                ]}
              />
            </div>
          )}
          <div class="prep-row">
            <span>{t('prep.length')}</span>
            <Chips value={level} onChange={onLevel} options={LEVELS.map((l) => ({ value: l, label: t('prep.' + l) }))} />
            <small>{t('prep.levelHint')}</small>
          </div>
          {OIL_METHODS.includes(method) && (
            <div class="prep-row">
              <span>{t('prep.oil')}</span>
              <div class="prep-oil">
                <NumInput
                  value={oilStr ?? ''}
                  placeholder={cook ? fmt(cook.oilG, 1) : '0'}
                  onInput={(e) => {
                    const v = (e.target as HTMLInputElement).value;
                    onOil(v.trim() === '' ? null : v);
                  }}
                />
                <small>g</small>
              </div>
              <Chips value={oilType} onChange={onOilType} options={OIL_TYPES.map((o) => ({ value: o, label: t('prep.oil.' + o) }))} />
              <small>{t('prep.oilHint')}</small>
            </div>
          )}
          {cook && (
            <div class="prep-result">
              <div>{t('prep.result', { raw: fmt(cook.rawG), cooked: fmt(cook.cookedG) })}</div>
              {per100Cooked != null && <div>{t('prep.per100', { kcal: fmt(per100Cooked) })}</div>}
              {(cook.fatLostG > 0.5 || cook.oilG > 0.5) && (
                <div>
                  {cook.fatLostG > 0.5 && t('prep.fatLost', { g: fmt(cook.fatLostG, 1) })}
                  {cook.fatLostG > 0.5 && cook.oilG > 0.5 && ' · '}
                  {cook.oilG > 0.5 && t('prep.oilAdded', { g: fmt(cook.oilG, 1) })}
                </div>
              )}
              <small>{t('prep.note')}</small>
            </div>
          )}
        </>
      )}
    </div>
  );
}
