import { BACKUP_FORMAT_ID } from './appIdentity';
import { MAX_KCAL_PER_100G } from './ai';
import { normalizeGoalCheck, type GoalCheckPrefs } from './adaptiveGoal';
import { normalizeSchedule, planById, type FastingSchedule } from './fasting';
import { RECIPE_TAGS } from './recipes';
import { normalizeReminders, type ReminderPrefs } from './reminders';
import { normalizeMealSplit } from './mealSplit';
import { normalizeHidden, type HiddenFood } from './foodHistory';
import {
  MEALS,
  type Activity,
  type AISettings,
  type Appearance,
  type DiaryEntry,
  type FastingSession,
  type Food,
  type FoodSource,
  type LanguagePref,
  type LayoutPrefs,
  type MacroGrams,
  type Nutrients,
  type Profile,
  type Recipe,
  type RecipeTag,
  type SavedMeal,
  type SavedMealItem,
  type Serving,
  type WeightEntry,
} from './types';

/** Everything the export file carries. API keys are never part of it. */
export interface BackupData {
  profile: Profile | null;
  language: LanguagePref;
  entries: DiaryEntry[];
  customFoods: Food[];
  recentFoods: Food[];
  water: Record<string, number>;
  weights: WeightEntry[];
  fastingActive: FastingSession | null;
  fastingHistory: FastingSession[];
  /**
   * Exported for completeness. On import only model names and the confidence threshold are used
   * (see sanitizeImportedAI in ai.ts): a backup file can never change where API keys are sent.
   */
  ai?: Partial<AISettings>;
  /** Saved meals; missing in exports from older versions. */
  meals: SavedMeal[];
  /** Own recipes incl. their small photos; missing in older exports. */
  recipes: Recipe[];
  /** Look and layout; optional, normalised by the store on import. */
  appearance?: Partial<Appearance>;
  layout?: Partial<LayoutPrefs>;
  /** Meal reminder settings; optional, normalised on import. */
  reminders?: ReminderPrefs;
  /** Fixed eating window; optional, normalised on import. */
  fastingSchedule?: FastingSchedule;
  /** Weekly goal check-in settings and goal history; optional, normalised on import. */
  goalCheck?: GoalCheckPrefs;
  /** Foods removed from the history on the *Recent* tab; optional (older exports have none). */
  hiddenHistory?: HiddenFood[];
  /** Own foods hidden from *Not on Open Food Facts yet*; optional (older exports have none). */
  offHidden?: HiddenFood[];
}

const BACKUP_KEYS: (keyof BackupData)[] = [
  'profile',
  'language',
  'entries',
  'customFoods',
  'recentFoods',
  'water',
  'weights',
  'fastingActive',
  'fastingHistory',
  'ai',
  'meals',
  'recipes',
  'appearance',
  'layout',
  'reminders',
  'fastingSchedule',
  'goalCheck',
  'hiddenHistory',
  'offHidden',
];

/** Picks exactly the exported fields from the app state (which also holds functions and UI settings). */
export function pickBackup(state: BackupData): BackupData {
  const out: Partial<Record<keyof BackupData, unknown>> = {};
  for (const k of BACKUP_KEYS) out[k] = state[k];
  return out as unknown as BackupData;
}

export function buildBackup(data: BackupData, now = new Date()) {
  return { app: BACKUP_FORMAT_ID, exportedAt: now.toISOString(), ...pickBackup(data) };
}

/* ---------- Reading a backup ----------
 *
 * A backup file can come from anywhere (a friend, a forum, a stranger), so nothing in it is trusted.
 * Every row is rebuilt field by field from checked values: unknown fields are dropped, wrong types
 * and implausible numbers make the row invalid, text is length-limited, and images are only kept
 * when they are small embedded JPEG/PNG data (a link could be used to track who opens the app).
 */

/**
 * Largest backup file accepted for import, the same on iPhone, Android and the web. Real backups
 * stay far below it (years of diary entries plus recipe photos are a few MB); the cap only keeps a
 * wrongly picked file (a video, a disk image) from being read into memory and freezing the app.
 */
export const MAX_BACKUP_BYTES = 100 * 1024 * 1024;

/** Limits for imported values. */
export const BACKUP_LIMITS = {
  text: 200,
  stepText: 2000,
  steps: 100,
  items: 200,
  servings: 30,
  portionG: 10000,
  waterMl: 20000,
  /** Embedded recipe photo (data URI); app photos are well below 200 KB. */
  photoChars: 1_500_000,
  weightKg: [20, 400] as const,
  fastHours: 168,
};

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const inRange = (v: unknown, min: number, max: number): v is number => isNum(v) && v >= min && v <= max;
/** Non-empty trimmed text up to `max` characters, else undefined. */
const text = (v: unknown, max = BACKUP_LIMITS.text): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return s ? s.slice(0, max) : undefined;
};

const SOURCES: FoodSource[] = ['generic', 'bls', 'restaurant', 'off', 'custom', 'ai', 'quick', 'recipe'];
const ACTIVITIES: Activity[] = ['sedentary', 'light', 'moderate', 'active', 'very_active'];

/** Product images may only come from Open Food Facts (where the app itself gets them). */
const IMAGE_URL = /^https:\/\/(images|static)\.openfoodfacts\.(org|net)\/[\w\-./%]+$/;
/** Embedded photo as the app creates it. */
const DATA_IMAGE = /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+=*$/;

function nutrients(v: unknown): Nutrients | null {
  if (!isObj(v)) return null;
  const macro = (x: unknown) => inRange(x, 0, 100);
  if (!inRange(v.kcal, 0, MAX_KCAL_PER_100G) || !macro(v.protein) || !macro(v.carbs) || !macro(v.fat)) return null;
  const n: Nutrients = { kcal: v.kcal, protein: v.protein as number, carbs: v.carbs as number, fat: v.fat as number };
  for (const k of ['sugar', 'fiber', 'satFat', 'salt'] as const) if (macro(v[k])) n[k] = v[k] as number;
  return n;
}

export function sanitizeFood(v: unknown): Food | null {
  if (!isObj(v)) return null;
  const id = text(v.id);
  const name = text(v.name);
  const per100 = nutrients(v.per100);
  if (!id || !name || !per100) return null;
  const servings: Serving[] = [];
  for (const s of list(v.servings).slice(0, BACKUP_LIMITS.servings)) {
    const label = isObj(s) ? text(s.label, 60) : undefined;
    if (label && isObj(s) && inRange(s.grams, 0.1, BACKUP_LIMITS.portionG)) servings.push({ label, grams: s.grams });
  }
  const food: Food = {
    id,
    source: SOURCES.includes(v.source as FoodSource) ? (v.source as FoodSource) : 'custom',
    name,
    per100,
    servings,
  };
  const brand = text(v.brand, 100);
  if (brand) food.brand = brand;
  if (typeof v.barcode === 'string' && /^\d{6,14}$/.test(v.barcode)) food.barcode = v.barcode;
  if (typeof v.imageUrl === 'string' && IMAGE_URL.test(v.imageUrl)) food.imageUrl = v.imageUrl;
  if (v.unit === 'g' || v.unit === 'ml') food.unit = v.unit;
  if (v.dataFrom === 'label' || v.dataFrom === 'robotoff') food.dataFrom = v.dataFrom;
  if (typeof v.offCode === 'string' && /^\d{6,14}$/.test(v.offCode)) food.offCode = v.offCode;
  return food;
}

function sanitizeItems(v: unknown): SavedMealItem[] | null {
  if (!Array.isArray(v) || v.length > BACKUP_LIMITS.items) return null;
  const items: SavedMealItem[] = [];
  for (const it of v) {
    const food = isObj(it) ? sanitizeFood(it.food) : null;
    if (!food || !isObj(it) || !inRange(it.grams, 0.1, BACKUP_LIMITS.portionG)) return null;
    items.push({ food, grams: it.grams });
  }
  return items;
}

function sanitizeEntry(v: unknown): DiaryEntry | null {
  if (!isObj(v)) return null;
  const id = text(v.id);
  const food = sanitizeFood(v.food);
  if (!id || !food || !isDay(v.date) || !MEALS.includes(v.meal as DiaryEntry['meal'])) return null;
  if (!inRange(v.grams, 0.1, BACKUP_LIMITS.portionG)) return null;
  return { id, date: v.date, meal: v.meal as DiaryEntry['meal'], food, grams: v.grams, createdAt: isNum(v.createdAt) ? v.createdAt : 0 };
}

function sanitizeMeal(v: unknown): SavedMeal | null {
  if (!isObj(v)) return null;
  const id = text(v.id);
  const name = text(v.name);
  const items = sanitizeItems(v.items);
  if (!id || !name || !items) return null;
  return { id, name, items, createdAt: isNum(v.createdAt) ? v.createdAt : 0, lastUsed: isNum(v.lastUsed) ? v.lastUsed : 0 };
}

function sanitizeRecipe(v: unknown): Recipe | null {
  if (!isObj(v)) return null;
  const id = text(v.id);
  const name = text(v.name);
  const items = sanitizeItems(v.items);
  if (!id || !name || !items || !inRange(v.servings, 1, 100) || !Array.isArray(v.steps)) return null;
  const steps = v.steps
    .map((s) => text(s, BACKUP_LIMITS.stepText))
    .filter((s): s is string => !!s)
    .slice(0, BACKUP_LIMITS.steps);
  const tags = list(v.tags).filter((t): t is RecipeTag => RECIPE_TAGS.includes(t as RecipeTag));
  const recipe: Recipe = {
    // Imported recipes are always the user's own; "community" and tester names can't be faked in.
    id: id.startsWith('community:') ? `own-${id.slice(10)}` : id,
    name,
    items,
    servings: Math.round(v.servings),
    steps,
    tags: [...new Set(tags)],
    source: 'own',
    createdAt: isNum(v.createdAt) ? v.createdAt : 0,
  };
  if (inRange(v.minutes, 1, 24 * 60)) recipe.minutes = Math.round(v.minutes);
  if (typeof v.photo === 'string' && v.photo.length <= BACKUP_LIMITS.photoChars && DATA_IMAGE.test(v.photo)) recipe.photo = v.photo;
  return recipe;
}

function sanitizeFast(v: unknown): FastingSession | null {
  if (!isObj(v)) return null;
  const id = text(v.id);
  if (!id || !inRange(v.start, 0, 8.64e15) || !inRange(v.targetHours, 1, BACKUP_LIMITS.fastHours)) return null;
  const s: FastingSession = { id, start: v.start, targetHours: v.targetHours, planId: planById(String(v.planId ?? '')).id };
  if (v.end !== undefined) {
    if (!isNum(v.end) || v.end < v.start) return null;
    s.end = v.end;
  }
  if (isDay(v.scheduledFor)) s.scheduledFor = v.scheduledFor;
  return s;
}

function macroGramsOf(v: unknown): MacroGrams | undefined {
  if (!isObj(v)) return undefined;
  const ok = (x: unknown) => inRange(x, 0, 1000);
  return ok(v.carbs) && ok(v.protein) && ok(v.fat) ? { carbs: v.carbs as number, protein: v.protein as number, fat: v.fat as number } : undefined;
}

/**
 * Profile from a backup. Body data must be valid, otherwise the profile is dropped and the user
 * sets it up again; settings that are missing or out of range get the usual defaults. Safety rules
 * (adults only for weight loss, healthy target weights) are applied when goals are calculated.
 */
export function sanitizeProfile(v: unknown, now = new Date()): Profile | null {
  if (!isObj(v)) return null;
  const year = now.getFullYear();
  const [minKg, maxKg] = BACKUP_LIMITS.weightKg;
  if (v.sex !== 'female' && v.sex !== 'male') return null;
  if (!inRange(v.birthYear, year - 110, year - 13) || !inRange(v.heightCm, 100, 250) || !inRange(v.startWeightKg, minKg, maxKg)) return null;
  const goal = v.goal === 'lose' || v.goal === 'gain' ? v.goal : 'maintain';
  const split = isObj(v.macroSplit) ? v.macroSplit : {};
  const splitOk =
    inRange(split.carbs, 0, 100) && inRange(split.protein, 0, 100) && inRange(split.fat, 0, 100) &&
    Math.round((split.carbs as number) + (split.protein as number) + (split.fat as number)) === 100;
  const p: Profile = {
    sex: v.sex,
    birthYear: Math.round(v.birthYear),
    heightCm: v.heightCm,
    startWeightKg: v.startWeightKg,
    targetWeightKg: inRange(v.targetWeightKg, minKg, maxKg) ? v.targetWeightKg : v.startWeightKg,
    activity: ACTIVITIES.includes(v.activity as Activity) ? (v.activity as Activity) : 'light',
    goal,
    paceKgPerWeek: inRange(v.paceKgPerWeek, 0, 2) ? v.paceKgPerWeek : 0.5,
    macroSplit: splitOk ? { carbs: split.carbs as number, protein: split.protein as number, fat: split.fat as number } : { carbs: 50, protein: 20, fat: 30 },
    waterGoalMl: inRange(v.waterGoalMl, 250, 10000) ? v.waterGoalMl : 2000,
    glassMl: inRange(v.glassMl, 50, 2000) ? v.glassMl : 250,
    stepGoal: inRange(v.stepGoal, 0, 100000) ? v.stepGoal : 8000,
    addActivityCalories: v.addActivityCalories === true,
    fastingPlanId: planById(String(v.fastingPlanId ?? '')).id,
    fastingDays: [...new Set(list(v.fastingDays).filter((d): d is number => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6))],
    createdAt: isNum(v.createdAt) ? v.createdAt : 0,
  };
  const name = text(v.name, 40);
  if (name) p.name = name;
  if (v.goalMode === 'custom' && inRange(v.customKcal, 500, 8000)) {
    p.goalMode = 'custom';
    p.customKcal = Math.round(v.customKcal);
  } else if (inRange(v.customKcal, 500, 8000)) p.customKcal = Math.round(v.customKcal);
  if (inRange(v.customActivityFactor, 1, 3)) p.customActivityFactor = v.customActivityFactor;
  if (inRange(v.customMaintenanceKcal, 800, 8000)) p.customMaintenanceKcal = Math.round(v.customMaintenanceKcal);
  const grams = macroGramsOf(v.macroGramsTarget);
  if (grams) p.macroGramsTarget = grams;
  if (v.macroMode === 'grams' && grams) p.macroMode = 'grams';
  else if (v.macroMode === 'percent') p.macroMode = 'percent';
  const mealSplit = normalizeMealSplit(v.mealSplit);
  if (mealSplit) p.mealSplit = mealSplit;
  if (v.mealMacros === true) p.mealMacros = true;
  return p;
}

/** Keeps the first row per id (ids must be unique for editing and deleting to work). */
function uniqueById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}

/** Rows that were present but invalid and therefore left out. */
function keep<T>(raw: unknown, fn: (v: unknown) => T | null, counter: { skipped: number }): T[] {
  const out: T[] = [];
  for (const v of list(raw)) {
    const r = fn(v);
    if (r) out.push(r);
    else counter.skipped++;
  }
  return out;
}

export interface BackupReport {
  data: BackupData;
  /** Rows that were in the file but invalid, and therefore not imported. */
  skipped: number;
}

/**
 * Reads a Tellerwerk or OpenPlate export (from the app or the web version). Invalid rows are dropped rather
 * than failing the whole import. Throws `INVALID_BACKUP` when the text is not an export at all.
 */
export function parseBackupReport(input: string, now = new Date()): BackupReport {
  let raw: unknown;
  try {
    raw = JSON.parse(input.trim());
  } catch {
    throw new Error('INVALID_BACKUP');
  }
  if (!isObj(raw) || raw.app !== BACKUP_FORMAT_ID) throw new Error('INVALID_BACKUP');
  const counter = { skipped: 0 };

  const water: Record<string, number> = {};
  if (isObj(raw.water)) {
    for (const [k, v] of Object.entries(raw.water)) {
      if (isDay(k) && inRange(v, 0, BACKUP_LIMITS.waterMl)) water[k] = v;
      else counter.skipped++;
    }
  }

  const [minKg, maxKg] = BACKUP_LIMITS.weightKg;
  const weights = keep(raw.weights, (w) => (isObj(w) && isDay(w.date) && inRange(w.kg, minKg, maxKg) ? { date: w.date, kg: w.kg } : null), counter);
  const byDay = new Map(weights.map((w) => [w.date, w]));

  const data: BackupData = {
    profile: sanitizeProfile(raw.profile, now),
    language: raw.language === 'de' || raw.language === 'en' ? raw.language : 'system',
    entries: uniqueById(keep(raw.entries, sanitizeEntry, counter)),
    customFoods: uniqueById(keep(raw.customFoods, sanitizeFood, counter)),
    recentFoods: uniqueById(keep(raw.recentFoods, sanitizeFood, counter)).slice(0, 40),
    water,
    weights: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)),
    fastingActive: sanitizeFast(raw.fastingActive),
    fastingHistory: uniqueById(keep(raw.fastingHistory, sanitizeFast, counter)),
    ai: isObj(raw.ai) ? (raw.ai as Partial<AISettings>) : undefined,
    appearance: isObj(raw.appearance) ? (raw.appearance as Partial<Appearance>) : undefined,
    layout: isObj(raw.layout) ? (raw.layout as Partial<LayoutPrefs>) : undefined,
    reminders: isObj(raw.reminders) ? normalizeReminders(raw.reminders) : undefined,
    fastingSchedule: isObj(raw.fastingSchedule) ? normalizeSchedule(raw.fastingSchedule) : undefined,
    goalCheck: isObj(raw.goalCheck) ? normalizeGoalCheck(raw.goalCheck) : undefined,
    hiddenHistory: Array.isArray(raw.hiddenHistory) ? normalizeHidden(raw.hiddenHistory) : undefined,
    offHidden: Array.isArray(raw.offHidden) ? normalizeHidden(raw.offHidden) : undefined,
    recipes: uniqueById(keep(raw.recipes, sanitizeRecipe, counter)),
    meals: uniqueById(keep(raw.meals, sanitizeMeal, counter)),
  };
  if (data.fastingActive?.end !== undefined) data.fastingActive = null;
  return { data, skipped: counter.skipped };
}

export function parseBackup(input: string, now = new Date()): BackupData {
  return parseBackupReport(input, now).data;
}
