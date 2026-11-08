import type { DiaryEntry } from './types';

/** What the home-screen widget shows. Plain values only: widget code can't import anything. */
export interface KcalWidgetProps {
  /** kcal left today (negative = over); null before onboarding. */
  left: number | null;
  /** "kcal left" / "kcal over" in the app's language. */
  label: string;
  /** "No profile yet" etc. when `left` is null. */
  empty: string;
}

/** kcal left today from the day's goal and today's diary entries, rounded like the diary's number. */
export function kcalLeftToday(goalKcal: number, entries: Pick<DiaryEntry, 'date' | 'food' | 'grams'>[], today: string): number {
  let eaten = 0;
  for (const e of entries) if (e.date === today) eaten += (e.food.per100.kcal * e.grams) / 100;
  return Math.round(goalKcal - eaten);
}
