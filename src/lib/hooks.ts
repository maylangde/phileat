import { useMemo } from 'preact/hooks';
import { db, useLive } from '../db';
import type { Entry, Food, Pot, PotTake, WaterEntry, Workout } from '../types';

export function useFoods(): Food[] {
  return useLive(() => db.foods.toArray(), []) ?? [];
}

export function useFoodMap(): Map<string, Food> {
  const foods = useFoods();
  return useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
}

export interface DayData {
  entries: Entry[];
  water: WaterEntry[];
  workouts: Workout[];
}

export function useDay(profileId: string | undefined, date: string): DayData | undefined {
  return useLive(async () => {
    if (!profileId) return { entries: [], water: [], workouts: [] };
    const key = [profileId, date];
    const [entries, water, workouts] = await Promise.all([
      db.entries.where('[profileId+date]').equals(key).sortBy('ts'),
      db.water.where('[profileId+date]').equals(key).sortBy('ts'),
      db.workouts.where('[profileId+date]').equals(key).sortBy('ts'),
    ]);
    return { entries, water, workouts };
  }, [profileId, date]);
}

export interface PotInfo {
  pot: Pot;
  takes: PotTake[];
  takenG: number;
  remainingG: number;
}

export function potInfo(pot: Pot, takes: PotTake[]): PotInfo {
  const takenG = takes.reduce((s, t) => s + t.grams, 0);
  return { pot, takes, takenG, remainingG: Math.max(0, pot.cookedWeightG - takenG) };
}

export function usePots(): PotInfo[] {
  return (
    useLive(async () => {
      const [pots, takes] = await Promise.all([db.pots.orderBy('cookedAt').reverse().toArray(), db.potTakes.toArray()]);
      return pots.map((p) =>
        potInfo(
          p,
          takes.filter((t) => t.potId === p.id),
        ),
      );
    }, []) ?? []
  );
}
