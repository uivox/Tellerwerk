/**
 * The offline product pack while the app runs: loaded once from storage, shared by the scanner,
 * the food search and the settings screen. Checking and parsing are in offlinePack.ts (pure).
 */
import { useSyncExternalStore } from 'react';
import {
  fetchRemoteCatalog,
  installPack,
  openInstalled,
  PACK_PUBLIC_KEY,
  PackError,
  remotePack,
  type PackId,
  type PackIndex,
  type PackManifest,
  type RemoteCatalog,
} from './offlinePack';
import { deleteInstalledPack, downloadPack, loadInstalledPack } from './packStore';

export type PackState =
  | { status: 'unknown' | 'loading' | 'none' }
  | { status: 'ready'; manifest: PackManifest; index: PackIndex };

let state: PackState = { status: 'unknown' };
const listeners = new Set<() => void>();
const set = (s: PackState) => {
  state = s;
  listeners.forEach((l) => l());
};

/** Whether this build can use a pack at all (the signing key is set up). */
export const packAvailable = PACK_PUBLIC_KEY !== '';

/** The loaded pack's index, if any (for barcode lookups outside React). */
export const currentPack = (): PackIndex | undefined => (state.status === 'ready' ? state.index : undefined);

let loading: Promise<void> | null = null;

/** Loads the installed pack into memory once. A pack that no longer checks out is deleted. */
export function ensurePackLoaded(): Promise<void> {
  if (!packAvailable) {
    if (state.status === 'unknown') set({ status: 'none' });
    return Promise.resolve();
  }
  if (state.status !== 'unknown') return loading ?? Promise.resolve();
  set({ status: 'loading' });
  loading = (async () => {
    const stored = await loadInstalledPack();
    if (!stored) return set({ status: 'none' });
    try {
      const { manifest, index } = openInstalled(stored.envelopeJson, stored.text, PACK_PUBLIC_KEY);
      set({ status: 'ready', manifest, index });
    } catch {
      await deleteInstalledPack();
      set({ status: 'none' });
    }
  })().finally(() => {
    loading = null;
  });
  return loading;
}

/** The newest packs on the server (signature checked). */
export const checkRemotePacks = (): Promise<RemoteCatalog> => fetchRemoteCatalog(PACK_PUBLIC_KEY, fetch);

/**
 * Downloads and installs pack `id` of `remote`, or says the installed pack is already the same. The
 * pack on the device stays in use until the new one is downloaded and checked (`installPack`).
 */
export async function installRemotePack(
  remote: RemoteCatalog,
  id: PackId,
  onProgress: (received: number) => void,
  signal?: AbortSignal,
): Promise<'installed' | 'up_to_date'> {
  await ensurePackLoaded();
  const pack = remotePack(remote, id);
  if (!pack) throw new PackError('not_configured', `no ${id} pack`);
  const installed = state.status === 'ready' ? state.manifest : null;
  if (installed && installed.id === id && installed.sha512 === pack.manifest.sha512) return 'up_to_date';
  const { manifest, index } = await installPack(pack, installed, downloadPack, onProgress, signal);
  set({ status: 'ready', manifest, index });
  return 'installed';
}

export async function removePack(): Promise<void> {
  await deleteInstalledPack();
  set({ status: 'none' });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function usePack(): PackState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export { PackError };
