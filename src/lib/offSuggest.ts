import { changesFor, roundFor, servingText, type OffField, type OffSnapshot } from './offWrite';
import type { HiddenFood } from './foodHistory';
import type { Food, Nutrients } from './types';

/**
 * Profile → Open Food Facts → *Not on Open Food Facts yet*: the user's own foods that Open Food Facts
 * doesn't have, or has with other values, to send one at a time. Pure: no React Native imports.
 *
 * - Own foods with a barcode (or the code Open Food Facts gave a food sent without one) can be
 *   checked. Nothing is looked up until the user taps *Check with Open Food Facts*; until then they
 *   show as "not checked".
 * - Own foods without any code (bakery, market, home-made) are listed as new products; sending them
 *   uses `code=new` (offWrite.ts).
 * - A check result belongs to the food's values when it was checked (`foodSignature`). Editing the
 *   food makes it "not checked" again; a food that is the same as on Open Food Facts is left out.
 * - *Don't suggest this* hides a food (`offHidden` in the store, part of backups); it can be undone.
 * - Check results are per device (`offChecks` in the store), not in backups.
 */

export type CheckResult = 'missing' | 'differs' | 'same';

export interface OffCheck {
  foodId: string;
  /** `foodSignature` of the food when it was checked. */
  sig: string;
  at: number;
  result: CheckResult;
  /** For `differs`: what would be sent. */
  fields?: OffField[];
}

export type SuggestStatus = 'missing' | 'differs' | 'no_code' | 'unchecked';

export interface Suggestion {
  food: Food;
  status: SuggestStatus;
  /** For `differs`: the values that differ or are missing on Open Food Facts. */
  fields: OffField[];
  /** When the shown result was checked (missing for `no_code` and `unchecked`). */
  checkedAt?: number;
}

export interface SuggestList {
  items: Suggestion[];
  /** Foods hidden with *Don't suggest this*, newest first. */
  hidden: Suggestion[];
  /** Own foods Open Food Facts already has with the same values. */
  same: number;
  /** Foods in `items` that a check would look up. */
  checkable: number;
}

/** Check results kept at most (oldest dropped). */
const MAX_CHECKS = 2000;
/** Pause between two lookups: at most 60 a minute, well inside Open Food Facts' 100 product reads a minute. */
export const LOOKUP_GAP_MS = 1000;

/** The code to look the food up with: its barcode, or the code Open Food Facts gave it. Null: none, or not a code the product API takes. */
export function lookupCode(food: Food): string | null {
  const code = (food.barcode ?? food.offCode ?? '').replace(/\s/g, '');
  return /^\d{6,14}$/.test(code) ? code : null;
}

/** Everything a check result depends on; a changed food has to be checked again. */
export function foodSignature(food: Food): string {
  const per: Partial<Record<keyof Nutrients, number>> = {};
  for (const k of ['kcal', 'carbs', 'protein', 'fat', 'sugar', 'fiber', 'satFat', 'salt'] as const) {
    const v = food.per100[k];
    if (v !== undefined && Number.isFinite(v)) per[k] = roundFor(k, v);
  }
  return JSON.stringify([food.name.trim(), food.brand?.trim() ?? '', servingText(food) ?? '', food.unit ?? 'g', lookupCode(food) ?? '', per]);
}

/** Compares the food with the product as Open Food Facts has it (`off` null: not there). */
export function compareWithOff(food: Food, off: OffSnapshot | null, now: number): OffCheck {
  const base = { foodId: food.id, sig: foodSignature(food), at: now };
  if (!off) return { ...base, result: 'missing' };
  const fields = changesFor(food, off).map((c) => c.field);
  return fields.length ? { ...base, result: 'differs', fields } : { ...base, result: 'same' };
}

/** A check result for the food as it is now, or undefined when it was never checked or changed since. */
export function currentCheck(food: Food, checks: readonly OffCheck[]): OffCheck | undefined {
  const c = checks.find((x) => x.foodId === food.id);
  return c && c.sig === foodSignature(food) ? c : undefined;
}

const ORDER: Record<SuggestStatus, number> = { missing: 0, differs: 1, no_code: 2, unchecked: 3 };

export function suggestionFor(food: Food, checks: readonly OffCheck[]): Suggestion | null {
  if (!lookupCode(food)) return { food, status: 'no_code', fields: [] };
  const c = currentCheck(food, checks);
  if (!c) return { food, status: 'unchecked', fields: [] };
  if (c.result === 'same') return null;
  return { food, status: c.result, fields: c.result === 'differs' ? (c.fields ?? []) : [], checkedAt: c.at };
}

/** The list for the screen: what to send, what is hidden, and how many are already the same. */
export function suggestions(ownFoods: readonly Food[], checks: readonly OffCheck[], hidden: readonly HiddenFood[]): SuggestList {
  const hiddenAt = new Map(hidden.map((h) => [h.id, h.at]));
  const items: Suggestion[] = [];
  const hiddenItems: { s: Suggestion; at: number }[] = [];
  let same = 0;
  for (const food of ownFoods) {
    const s = suggestionFor(food, checks);
    if (!s) {
      same++;
      continue;
    }
    const at = hiddenAt.get(food.id);
    if (at !== undefined) hiddenItems.push({ s, at });
    else items.push(s);
  }
  items.sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.food.name.localeCompare(b.food.name));
  return {
    items,
    hidden: hiddenItems.sort((a, b) => b.at - a.at).map((h) => h.s),
    same,
    checkable: items.filter((s) => lookupCode(s.food)).length,
  };
}

/** The foods a check looks up, in the order of the list: every listed food with a code (hidden ones are skipped). */
export function foodsToCheck(ownFoods: readonly Food[], checks: readonly OffCheck[], hidden: readonly HiddenFood[]): Food[] {
  return suggestions(ownFoods, checks, hidden)
    .items.filter((s) => lookupCode(s.food))
    .map((s) => s.food);
}

/** Puts a result in, replacing the food's earlier one. */
export function addCheck(checks: readonly OffCheck[], c: OffCheck): OffCheck[] {
  return [c, ...checks.filter((x) => x.foodId !== c.foodId)].slice(0, MAX_CHECKS);
}

/** Check results only for foods that still exist. */
export function pruneChecks(checks: readonly OffCheck[], ownFoods: readonly Food[]): OffCheck[] {
  const ids = new Set(ownFoods.map((f) => f.id));
  return checks.filter((c) => ids.has(c.foodId));
}

const FIELDS: OffField[] = ['name', 'brand', 'serving', 'kcal', 'carbs', 'protein', 'fat', 'sugar', 'fiber', 'satFat', 'salt'];

/** Checks stored results: unknown shapes are dropped, one row per food. */
export function normalizeChecks(v: unknown): OffCheck[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: OffCheck[] = [];
  for (const x of v) {
    if (!x || typeof x !== 'object') continue;
    const { foodId, sig, at, result, fields } = x as Record<string, unknown>;
    if (typeof foodId !== 'string' || !foodId || seen.has(foodId) || typeof sig !== 'string') continue;
    if (result !== 'missing' && result !== 'differs' && result !== 'same') continue;
    seen.add(foodId);
    const c: OffCheck = { foodId, sig, at: typeof at === 'number' && Number.isFinite(at) ? at : 0, result };
    if (result === 'differs') c.fields = Array.isArray(fields) ? FIELDS.filter((f) => fields.includes(f)) : [];
    out.push(c);
  }
  return out.slice(0, MAX_CHECKS);
}

/* ---------- Checking ---------- */

/** Why a check stopped before the end. */
export type CheckStop = 'rate_limited' | 'offline' | 'server' | 'cancelled';

export interface CheckRun {
  checked: number;
  /** Foods the run didn't get to (stopped) . */
  left: number;
  stopped?: CheckStop;
}

/**
 * Looks the foods up one after another, `gapMs` apart, and reports each result as it comes (so a
 * stopped run keeps what it found). `lookup` answers the product, or null for "not on Open Food
 * Facts" (the product API's 404); it throws like `fetchProductForEdit`, and `failure` sorts the
 * error (`lookupFailure`). A rate limit (429, or the pause it started) and a missing connection
 * stop the run; so does a server error, to stay polite. A barcode the API refuses is skipped.
 */
export async function checkFoods(
  foods: readonly Food[],
  lookup: (code: string) => Promise<OffSnapshot | null>,
  failure: (e: unknown) => 'invalid' | 'rate_limited' | 'server' | 'offline',
  onResult: (c: OffCheck, done: number) => void,
  opts: { now?: () => number; sleep?: (ms: number) => Promise<void>; gapMs?: number; cancelled?: () => boolean } = {},
): Promise<CheckRun> {
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const gap = opts.gapMs ?? LOOKUP_GAP_MS;
  let checked = 0;
  for (let i = 0; i < foods.length; i++) {
    if (opts.cancelled?.()) return { checked, left: foods.length - i, stopped: 'cancelled' };
    if (i > 0) {
      await sleep(gap);
      if (opts.cancelled?.()) return { checked, left: foods.length - i, stopped: 'cancelled' };
    }
    const food = foods[i];
    const code = lookupCode(food);
    if (!code) continue;
    let off: OffSnapshot | null;
    try {
      off = await lookup(code);
    } catch (e) {
      const f = failure(e);
      if (f === 'invalid') continue;
      return { checked, left: foods.length - i, stopped: f };
    }
    checked++;
    onResult(compareWithOff(food, off, now()), i + 1);
  }
  return { checked, left: 0 };
}
