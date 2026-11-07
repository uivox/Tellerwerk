import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_AI_SETTINGS, sanitizeImportedAI } from './ai';
import { snoozeEnd } from './backupReminder';
import type { BackupData } from './backup';
import { newId } from './id';
import { DEFAULT_SCHEDULE, normalizeSchedule, type FastingSchedule, type SyncResult } from './fasting';
import { DEFAULT_INSIGHTS, normalizeInsights, type InsightPrefs } from './insights';
import { hideFromHistory, normalizeHidden, type HiddenFood } from './foodHistory';
import { DEFAULT_LAYOUT, normalizeLayout } from './layout';
import { normalizePending, type OffPending } from './offWrite';
import { addCheck, normalizeChecks, pruneChecks, type OffCheck } from './offSuggest';
import { isPackId, type PackId } from './packIds';
import { entriesForMeal, removeFoodFromMeals, replaceFoodInMeals } from './meals';
import { migrateState, STORE_VERSION } from './migrations';
import { DEFAULT_REMINDERS, normalizeReminders, type ReminderPrefs } from './reminders';
import { DEFAULT_GOAL_CHECK, normalizeGoalCheck, type GoalCheckPrefs } from './adaptiveGoal';
import { addRecord, normalizeLog, type ConnectionRecord } from './connectionLog';
import { createShardedStorage } from './persistStorage';
import { DEFAULT_SECURITY, normalizeSecurity, type SecurityPrefs } from './security';
import { kvStore } from './storage';
import { DEFAULT_APPEARANCE, normalizeAppearance } from './themes';
import type {
  AIProviderConfig,
  Appearance,
  LayoutPrefs,
  AIProviderId,
  AISettings,
  DiaryEntry,
  FastingSession,
  Food,
  LanguagePref,
  MealType,
  Profile,
  Recipe,
  SavedMeal,
  WeightEntry,
} from './types';

const MAX_RECENT = 40;

interface State {
  profile: Profile | null;
  language: LanguagePref;
  entries: DiaryEntry[];
  customFoods: Food[];
  recentFoods: Food[];
  /** Foods removed from the history on the *Recent* tab (foodHistory.ts); the diary keeps them. Part of backups. */
  hiddenHistory: HiddenFood[];
  water: Record<string, number>;
  weights: WeightEntry[];
  fastingActive: FastingSession | null;
  fastingHistory: FastingSession[];
  /** Fixed eating window (fasting.ts); part of backups. */
  fastingSchedule: FastingSchedule;
  ai: AISettings;
  meals: SavedMeal[];
  /** Own recipes (community ones are bundled, see communityRecipes.ts). */
  recipes: Recipe[];
  appearance: Appearance;
  layout: LayoutPrefs;
  /** Meal reminders (reminders.ts); part of backups. */
  reminders: ReminderPrefs;
  /** Last choice on the statistics screens (grouping, range). Per device, not part of backups. */
  insights: InsightPrefs;
  /** Sends to Open Food Facts kept for later (Profile → Open Food Facts). Per device, not in backups. */
  offPending: OffPending[];
  /** Results of *Check with Open Food Facts* (offSuggest.ts). Per device, not in backups. */
  offChecks: OffCheck[];
  /** Own foods hidden with *Don't suggest this* on *Not on Open Food Facts yet*. Part of backups. */
  offHidden: HiddenFood[];
  /** Which offline pack the user chose (Profile → Offline product data); null until they choose. Part of backups. */
  packChoice: PackId | null;
  /** Weekly goal check-in: settings, left-out days, answered check-ins and the goal history (adaptiveGoal.ts). Part of backups. */
  goalCheck: GoalCheckPrefs;
  /** App lock, encrypted backups, connection log (security.ts). Per device, never in backups. */
  security: SecurityPrefs;
  /** The last 7 days of connections to outside servers (connectionLog.ts). Per device, never in backups. */
  connections: ConnectionRecord[];
  /** Last export (or import of a backup file) on this device, ms. Not part of backups. */
  lastBackupAt: number | null;
  /** The backup reminder stays hidden until then, ms. */
  backupSnoozedUntil: number | null;

  setProfile: (p: Profile) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  setLanguage: (l: LanguagePref) => void;
  /** Returns the new entry's id. */
  addEntry: (e: Omit<DiaryEntry, 'id' | 'createdAt'>) => string;
  updateEntry: (id: string, patch: Partial<Pick<DiaryEntry, 'grams' | 'meal' | 'date'>>) => void;
  removeEntry: (id: string) => void;
  copyMeal: (fromDate: string, toDate: string, meal: MealType) => number;
  saveCustomFood: (f: Food) => void;
  /** Saves an edited own food and updates its copies in saved meals and the recent list (not the diary). */
  updateCustomFood: (f: Food) => void;
  /** Deletes an own food; it also leaves every saved meal (a meal left empty goes too). The diary keeps it. */
  removeCustomFood: (id: string) => void;
  /** Hides a food from the history on the *Recent* tab; logging it again brings it back. */
  hideFromHistory: (foodId: string) => void;
  saveMeal: (m: SavedMeal) => void;
  removeMeal: (id: string) => void;
  /** Adds every item of a saved meal as its own diary entry; returns how many were added. */
  logMeal: (id: string, date: string, meal: MealType, factor?: number) => number;
  saveRecipe: (r: Recipe) => void;
  removeRecipe: (id: string) => void;
  addWater: (date: string, ml: number) => void;
  logWeight: (date: string, kg: number) => void;
  removeWeight: (date: string) => void;
  startFast: (s: Omit<FastingSession, 'id'>) => void;
  updateActiveFast: (patch: Partial<FastingSession>) => void;
  endFast: (end: number) => void;
  removeFast: (id: string) => void;
  /** Drops the running fast without recording it (*Skip today's fast*). */
  discardActiveFast: () => void;
  setFastingSchedule: (patch: Partial<FastingSchedule>) => void;
  /** Applies what syncSchedule worked out (running fast, history, handled-until). */
  applyScheduleSync: (r: SyncResult) => void;
  setAI: (patch: Partial<AISettings>) => void;
  setAppearance: (patch: Partial<Appearance>) => void;
  setLayout: (patch: Partial<LayoutPrefs>) => void;
  setInsights: (patch: Partial<InsightPrefs>) => void;
  keepOffForLater: (foodId: string) => void;
  dropOffPending: (foodId: string) => void;
  noteOffCheck: (c: OffCheck) => void;
  hideOffSuggestion: (foodId: string) => void;
  unhideOffSuggestion: (foodId: string) => void;
  setPackChoice: (id: PackId) => void;
  setReminders: (patch: Partial<ReminderPrefs>) => void;
  setProviderConfig: (id: AIProviderId, patch: Partial<AIProviderConfig>) => void;
  setGoalCheck: (patch: Partial<GoalCheckPrefs>) => void;
  setSecurity: (patch: Partial<SecurityPrefs>) => void;
  addConnection: (r: ConnectionRecord) => void;
  clearConnections: () => void;
  markBackedUp: () => void;
  snoozeBackupReminder: () => void;
  resetAll: () => void;
  /** Replaces all data with an imported backup (see backup.ts). */
  importBackup: (d: BackupData) => void;
}

/** What is saved on the device (and what `partialize` picks). */
type Persisted = Pick<
  State,
  | 'profile'
  | 'language'
  | 'entries'
  | 'customFoods'
  | 'recentFoods'
  | 'hiddenHistory'
  | 'water'
  | 'weights'
  | 'fastingActive'
  | 'fastingHistory'
  | 'fastingSchedule'
  | 'ai'
  | 'meals'
  | 'recipes'
  | 'appearance'
  | 'layout'
  | 'reminders'
  | 'insights'
  | 'offPending'
  | 'offChecks'
  | 'offHidden'
  | 'packChoice'
  | 'goalCheck'
  | 'security'
  | 'connections'
  | 'lastBackupAt'
  | 'backupSnoozedUntil'
>;

const initial = {
  profile: null,
  language: 'system' as LanguagePref,
  entries: [],
  customFoods: [],
  recentFoods: [],
  hiddenHistory: [] as HiddenFood[],
  water: {},
  weights: [],
  fastingActive: null,
  fastingHistory: [],
  fastingSchedule: DEFAULT_SCHEDULE,
  ai: DEFAULT_AI_SETTINGS,
  meals: [] as SavedMeal[],
  recipes: [] as Recipe[],
  appearance: DEFAULT_APPEARANCE,
  layout: DEFAULT_LAYOUT,
  reminders: DEFAULT_REMINDERS,
  insights: DEFAULT_INSIGHTS,
  offPending: [] as OffPending[],
  offChecks: [] as OffCheck[],
  offHidden: [] as HiddenFood[],
  packChoice: null as PackId | null,
  goalCheck: DEFAULT_GOAL_CHECK,
  security: DEFAULT_SECURITY,
  connections: [] as ConnectionRecord[],
  lastBackupAt: null as number | null,
  backupSnoozedUntil: null as number | null,
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...initial,

      setProfile: (p) => set({ profile: p }),
      updateProfile: (patch) => set((s) => (s.profile ? { profile: { ...s.profile, ...patch } } : {})),
      setLanguage: (language) => set({ language }),

      addEntry: (e) => {
        const id = newId();
        set((s) => {
          // Future days can be planned ahead; streaks and statistics only count days up to today.
          const entry: DiaryEntry = { ...e, id, createdAt: Date.now() };
          const recent =
            e.food.source === 'quick'
              ? s.recentFoods
              : [e.food, ...s.recentFoods.filter((f) => f.id !== e.food.id)].slice(0, MAX_RECENT);
          return { entries: [...s.entries, entry], recentFoods: recent };
        });
        return id;
      },
      updateEntry: (id, patch) => set((s) => ({ entries: s.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
      removeEntry: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
      copyMeal: (fromDate, toDate, meal) => {
        const source = get().entries.filter((e) => e.date === fromDate && e.meal === meal);
        const now = Date.now();
        const copies = source.map((e, i) => ({ ...e, id: newId(), date: toDate, createdAt: now + i }));
        set((s) => ({ entries: [...s.entries, ...copies] }));
        return copies.length;
      },

      saveCustomFood: (f) => set((s) => ({ customFoods: [f, ...s.customFoods.filter((x) => x.id !== f.id)] })),
      updateCustomFood: (f) =>
        set((s) => ({
          customFoods: s.customFoods.map((x) => (x.id === f.id ? f : x)),
          meals: replaceFoodInMeals(s.meals, f),
          recentFoods: s.recentFoods.map((x) => (x.id === f.id ? f : x)),
        })),
      removeCustomFood: (id) =>
        set((s) => ({
          customFoods: s.customFoods.filter((f) => f.id !== id),
          meals: removeFoodFromMeals(s.meals, id),
          // Lock, backup encryption and the connection log belong to this device: a file can't change them.
          security: s.security,
          connections: s.connections,
          offPending: s.offPending.filter((p) => p.foodId !== id),
          offChecks: s.offChecks.filter((c) => c.foodId !== id),
          offHidden: s.offHidden.filter((h) => h.id !== id),
          recentFoods: s.recentFoods.filter((f) => f.id !== id),
        })),

      hideFromHistory: (foodId) => set((s) => ({ hiddenHistory: hideFromHistory(s.hiddenHistory, foodId, Date.now()) })),

      saveMeal: (m) => set((s) => ({ meals: [m, ...s.meals.filter((x) => x.id !== m.id)] })),
      removeMeal: (id) => set((s) => ({ meals: s.meals.filter((m) => m.id !== id) })),
      saveRecipe: (r) => set((s) => ({ recipes: [r, ...s.recipes.filter((x) => x.id !== r.id)] })),
      removeRecipe: (id) => set((s) => ({ recipes: s.recipes.filter((r) => r.id !== id) })),
      logMeal: (id, date, slot, factor = 1) => {
        const m = get().meals.find((x) => x.id === id);
        if (!m) return 0;
        const now = Date.now();
        const added = entriesForMeal(m, date, slot, factor).map((e, i) => ({ ...e, id: newId(), createdAt: now + i }));
        set((s) => {
          let recent = s.recentFoods;
          for (const e of [...added].reverse()) {
            if (e.food.source !== 'quick') recent = [e.food, ...recent.filter((f) => f.id !== e.food.id)];
          }
          return {
            entries: [...s.entries, ...added],
            recentFoods: recent.slice(0, MAX_RECENT),
            meals: s.meals.map((x) => (x.id === id ? { ...x, lastUsed: now } : x)),
          };
        });
        return added.length;
      },

      addWater: (date, ml) => set((s) => ({ water: { ...s.water, [date]: Math.max(0, (s.water[date] ?? 0) + ml) } })),

      logWeight: (date, kg) =>
        set((s) => ({
          weights: [...s.weights.filter((w) => w.date !== date), { date, kg }].sort((a, b) => a.date.localeCompare(b.date)),
        })),
      removeWeight: (date) => set((s) => ({ weights: s.weights.filter((w) => w.date !== date) })),

      startFast: (f) => set({ fastingActive: { ...f, id: newId() } }),
      updateActiveFast: (patch) => set((s) => (s.fastingActive ? { fastingActive: { ...s.fastingActive, ...patch } } : {})),
      endFast: (end) =>
        set((s) =>
          s.fastingActive
            ? { fastingActive: null, fastingHistory: [{ ...s.fastingActive, end }, ...s.fastingHistory].slice(0, 200) }
            : {},
        ),
      removeFast: (id) => set((s) => ({ fastingHistory: s.fastingHistory.filter((f) => f.id !== id) })),
      discardActiveFast: () =>
        set((s) => ({
          fastingActive: null,
          // A skipped scheduled fast must not be started again by the next sync.
          fastingSchedule: s.fastingActive
            ? { ...s.fastingSchedule, handledUntil: Math.max(s.fastingSchedule.handledUntil, s.fastingActive.start + 1) }
            : s.fastingSchedule,
        })),
      setFastingSchedule: (patch) => set((s) => ({ fastingSchedule: normalizeSchedule({ ...s.fastingSchedule, ...patch }) })),
      applyScheduleSync: (r) =>
        set((s) => ({
          fastingActive: r.active,
          fastingHistory: r.history,
          fastingSchedule: { ...s.fastingSchedule, handledUntil: r.handledUntil },
        })),

      setAI: (patch) => set((s) => ({ ai: { ...s.ai, ...patch } })),
      setAppearance: (patch) => set((s) => ({ appearance: normalizeAppearance({ ...s.appearance, ...patch }) })),
      setLayout: (patch) => set((s) => ({ layout: normalizeLayout({ ...s.layout, ...patch }) })),
      setInsights: (patch) => set((s) => ({ insights: normalizeInsights({ ...s.insights, ...patch }) })),
      keepOffForLater: (foodId) => set((s) => ({ offPending: [{ foodId, savedAt: Date.now() }, ...s.offPending.filter((p) => p.foodId !== foodId)] })),
      dropOffPending: (foodId) => set((s) => ({ offPending: s.offPending.filter((p) => p.foodId !== foodId) })),
      noteOffCheck: (c) => set((s) => ({ offChecks: addCheck(s.offChecks, c) })),
      hideOffSuggestion: (foodId) => set((s) => ({ offHidden: hideFromHistory(s.offHidden, foodId, Date.now()) })),
      unhideOffSuggestion: (foodId) => set((s) => ({ offHidden: s.offHidden.filter((h) => h.id !== foodId) })),
      setPackChoice: (id) => set({ packChoice: id }),
      setReminders: (patch) => set((s) => ({ reminders: normalizeReminders({ ...s.reminders, ...patch }) })),
      setProviderConfig: (id, patch) =>
        set((s) => ({ ai: { ...s.ai, providers: { ...s.ai.providers, [id]: { ...s.ai.providers[id], ...patch } } } })),

      setGoalCheck: (patch) => set((s) => ({ goalCheck: normalizeGoalCheck({ ...s.goalCheck, ...patch }) })),
      setSecurity: (patch) => set((s) => ({ security: normalizeSecurity({ ...s.security, ...patch }) })),
      addConnection: (r) => set((s) => ({ connections: addRecord(s.connections, r, Date.now()) })),
      clearConnections: () => set({ connections: [] }),

      markBackedUp: () => set({ lastBackupAt: Date.now(), backupSnoozedUntil: null }),
      snoozeBackupReminder: () => set({ backupSnoozedUntil: snoozeEnd(Date.now()) }),

      resetAll: () => set({ ...initial }),
      importBackup: (d) =>
        set((s) => ({
          ...initial,
          ...d,
          // older exports have no look/layout: keep the current one
          appearance: d.appearance ? normalizeAppearance(d.appearance) : s.appearance,
          layout: d.layout ? normalizeLayout(d.layout) : s.layout,
          // Reminder settings come with the backup; scheduling is rebuilt from them (mealReminders.ts).
          reminders: d.reminders ? normalizeReminders(d.reminders) : s.reminders,
          fastingSchedule: d.fastingSchedule ? normalizeSchedule(d.fastingSchedule) : s.fastingSchedule,
          goalCheck: d.goalCheck ? normalizeGoalCheck(d.goalCheck) : s.goalCheck,
          hiddenHistory: normalizeHidden(d.hiddenHistory),
          insights: s.insights, // a choice on this device, not in backups
          offPending: s.offPending.filter((p) => (d.customFoods ?? []).some((f) => f.id === p.foodId)),
          // results stay valid only for imported foods with the same values (offSuggest.foodSignature)
          offChecks: pruneChecks(s.offChecks, d.customFoods ?? []),
          offHidden: normalizeHidden(d.offHidden),
          // a backup without a choice keeps this device's
          packChoice: isPackId(d.packChoice) ? d.packChoice : s.packChoice,
          // Only model names come from the file; providers and server addresses stay as set on this
          // device, so a backup can never redirect a saved API key (see sanitizeImportedAI).
          ai: sanitizeImportedAI(d.ai, s.ai),
          // The data now matches a file the user has, so that file counts as a backup.
          lastBackupAt: Date.now(),
          backupSnoozedUntil: null,
        })),
    }),
    {
      // The key keeps its old name so existing data is found; the layout is versioned below.
      name: 'openplate-v1',
      version: STORE_VERSION,
      migrate: (persisted, version) => migrateState(persisted, version) as unknown as Persisted,
      storage: createShardedStorage<Persisted>(kvStore),
      onRehydrateStorage: () => (_state, error) => {
        if (error) setHydrationError(error);
      },
      partialize: (s): Persisted => ({
        profile: s.profile,
        language: s.language,
        entries: s.entries,
        customFoods: s.customFoods,
        recentFoods: s.recentFoods,
        hiddenHistory: s.hiddenHistory,
        water: s.water,
        weights: s.weights,
        fastingActive: s.fastingActive,
        fastingHistory: s.fastingHistory,
        fastingSchedule: s.fastingSchedule,
        ai: s.ai,
        meals: s.meals,
        recipes: s.recipes,
        appearance: s.appearance,
        layout: s.layout,
        reminders: s.reminders,
        insights: s.insights,
        offPending: s.offPending,
        offChecks: s.offChecks,
        offHidden: s.offHidden,
        packChoice: s.packChoice,
        goalCheck: s.goalCheck,
        security: s.security,
        connections: s.connections,
        lastBackupAt: s.lastBackupAt,
        backupSnoozedUntil: s.backupSnoozedUntil,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        return {
          ...current,
          ...p,
          ai: {
            ...current.ai,
            ...(p.ai ?? {}),
            providers: { ...current.ai.providers, ...(p.ai?.providers ?? {}) },
          },
          appearance: normalizeAppearance(p.appearance),
          layout: normalizeLayout(p.layout),
          reminders: normalizeReminders(p.reminders),
          fastingSchedule: normalizeSchedule(p.fastingSchedule),
          insights: normalizeInsights(p.insights),
          offPending: normalizePending(p.offPending),
          offChecks: normalizeChecks(p.offChecks),
          offHidden: normalizeHidden(p.offHidden),
          packChoice: isPackId(p.packChoice) ? p.packChoice : null,
          goalCheck: normalizeGoalCheck(p.goalCheck),
          hiddenHistory: normalizeHidden(p.hiddenHistory),
          security: normalizeSecurity(p.security),
          connections: normalizeLog(p.connections, Date.now()),
          lastBackupAt: typeof p.lastBackupAt === 'number' ? p.lastBackupAt : null,
          backupSnoozedUntil: typeof p.backupSnoozedUntil === 'number' ? p.backupSnoozedUntil : null,
        };
      },
    },
  ),
);

/* ---------- Hydration status ---------- */

let hydrationError: unknown = null;
const errorListeners = new Set<() => void>();
function setHydrationError(e: unknown) {
  hydrationError = e;
  errorListeners.forEach((l) => l());
}

export type HydrationStatus = 'loading' | 'ready' | 'error';

/**
 * 'error' when the stored data could not be read. The app then shows a message with a retry button
 * instead of a blank screen, and nothing is saved meanwhile (persistStorage.ts), so the data on the
 * device stays untouched.
 */
export function useHydration(): { status: HydrationStatus; error: unknown; retry: () => void } {
  const read = (): HydrationStatus => (useStore.persist.hasHydrated() ? 'ready' : hydrationError ? 'error' : 'loading');
  const [status, setStatus] = useState<HydrationStatus>(read);
  useEffect(() => {
    const update = () => setStatus(read());
    const unsub = useStore.persist.onFinishHydration(update);
    errorListeners.add(update);
    update();
    return () => {
      unsub();
      errorListeners.delete(update);
    };
  }, []);
  const retry = () => {
    hydrationError = null;
    setStatus('loading');
    void useStore.persist.rehydrate();
  };
  return { status, error: hydrationError, retry };
}

/** Re-exported for older imports; lives in the pure goals module now. */
export { weightOn } from './goals';
