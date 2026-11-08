/**
 * Profile → Your data: how much each kind of data takes on this device.
 *
 * Sizes are the UTF-8 bytes of the JSON the store saves (the same values `partialize` picks), so
 * umlauts and recipe photos count with their real size, not as characters. Each part is measured
 * on its own and everything the parts don't cover is "other", so the rows always add up to the
 * total. The storage engine adds a little on top (key names, its own bookkeeping), which is why the
 * screen says "about". The offline pack and the AI answer log live outside the store and are added
 * by the screen from their own sizes.
 */

/** UTF-8 length of a string without encoding it (Hermes has no TextEncoder in every build). */
export function utf8Bytes(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const next = s.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        n += 4;
        i++;
      } else n += 3;
    } else n += 3;
  }
  return n;
}

const jsonBytes = (v: unknown) => (v === undefined ? 0 : utf8Bytes(JSON.stringify(v)));

/** The parts of the saved state that get a row of their own. */
export const SIZE_PARTS = {
  diary: ['entries'],
  foods: ['customFoods'],
  mealsRecipes: ['meals', 'recipes'],
  weights: ['weights'],
  water: ['water'],
  fasts: ['fastingHistory', 'fastingActive'],
  connections: ['connections'],
} as const;

export type SizePart = keyof typeof SIZE_PARTS | 'other';

export interface StoreSizes {
  parts: Record<SizePart, number>;
  /** Sum of all parts: everything the store saves. */
  store: number;
}

/** Bytes per part of the saved state; `saved` is what `partialize` returns. */
export function storeSizes(saved: Record<string, unknown>): StoreSizes {
  const covered = new Set<string>();
  const parts = { other: 0 } as Record<SizePart, number>;
  for (const [part, keys] of Object.entries(SIZE_PARTS) as [keyof typeof SIZE_PARTS, readonly string[]][]) {
    parts[part] = keys.reduce((sum, k) => sum + jsonBytes(saved[k]), 0);
    for (const k of keys) covered.add(k);
  }
  const rest: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(saved)) if (!covered.has(k)) rest[k] = v;
  parts.other = jsonBytes(rest);
  const store = Object.values(parts).reduce((a, b) => a + b, 0);
  return { parts, store };
}

/** Total for the top row: the store plus the files kept beside it. */
export function totalBytes(sizes: StoreSizes, packBytes: number, aiLogBytes: number): number {
  return sizes.store + Math.max(0, packBytes) + Math.max(0, aiLogBytes);
}
