/**
 * The offline packs to choose from (kept apart from offlinePack.ts so the store and backups can name
 * them without loading the pack code): `german`, only products with a German name that look really
 * sold here; `all`, every product sold in Germany that passes the checks.
 */
export const PACK_IDS = ['german', 'all'] as const;
export type PackId = (typeof PACK_IDS)[number];
export const isPackId = (v: unknown): v is PackId => PACK_IDS.includes(v as PackId);
