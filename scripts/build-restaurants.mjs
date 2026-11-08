#!/usr/bin/env node
/*
 * Builds src/lib/restaurantData.ts from the tables in scripts/restaurants/raw/.
 *
 * Each raw file is copied from one chain's own published nutrition information for Germany (the
 * file header says where from and when). This script only reshapes the numbers: it turns
 * per-serving values into per-100 g / 100 ml (keeping the serving, so the app shows the chain's
 * own figure for one serving), fixes the few column slips noted below, and leaves out every row
 * that fails the same plausibility rules the app uses for outside data (checkPer100 in
 * src/lib/labelScan.ts). A test checks the generated rows against checkPer100 itself.
 *
 *   node scripts/build-restaurants.mjs        # writes src/lib/restaurantData.ts, prints what it left out
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = join(root, 'scripts/restaurants/raw');
const read = (f) =>
  readFileSync(join(rawDir, f), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split('|').map((c) => c.trim()));

const num = (s) => {
  if (s === undefined || s === '') return null;
  const v = Number(String(s).replace(',', '.'));
  return Number.isFinite(v) ? v : null;
};

/** Every row ends up as { chain, name, unit, serving (g or ml, 0 = none), per serving or per 100 values }. */
const rows = [];
const notes = [];

function add(chain, name, unit, serving, basis, v) {
  rows.push({ chain, name, unit, serving: serving ?? 0, basis, v });
}

/* ---------- McDonald's: id|category|name|serving|kcal|protein|carbs|fat|fiber|sugar|satFat|salt, per serving ---------- */
const MCD_ML = /^(getraenke)$/;
const MCD_DRINK_NAME = /Café|Cappuccino|Latte|Tee|Kakao|Schorle|Wasser|Espresso|Capri-Sun|Chocolate Grande|Haferdrink|Milch$/;
for (const [, cat, name, g, kcal, p, c, f, fib, sug, sat, salt] of read('mcdonalds.txt')) {
  let serving = num(g);
  // Orange juice is given in litres on the site.
  if (serving !== null && serving < 1) serving = serving * 1000;
  const unit = MCD_ML.test(cat) || MCD_DRINK_NAME.test(name) ? 'ml' : 'g';
  add('mcd', name, unit, serving, 'serving', { kcal: num(kcal), protein: num(p), carbs: num(c), fat: num(f), fiber: num(fib), sugar: num(sug), satFat: num(sat), salt: num(salt) });
}

/* ---------- Burger King: name|serving|kcal|protein|carbs|fat|sugar|satFat|salt, per serving (no fibre) ---------- */
for (const [name, g, kcal, p, c, f, sug, sat, salt] of read('burgerking.txt')) {
  const unit = /\d,\d+ l\b|Cappuccino|Fuze|Monster|Lift|Fanta|Sprite|Cola/.test(name) ? 'ml' : 'g';
  add('bk', name, unit, num(g), 'serving', { kcal: num(kcal), protein: num(p), carbs: num(c), fat: num(f), fiber: null, sugar: num(sug), satFat: num(sat), salt: num(salt) });
}

/* ---------- Per-100 tables: name|serving|unit|kcal|protein|carbs|fat|fiber|sugar|satFat|salt ---------- */
const titleCase = (s) =>
  s === s.toUpperCase()
    ? s
        .toLowerCase()
        .replace(/(^|[\s(/&-])([a-zäöü])/g, (_, a, b) => a + b.toUpperCase())
        .replace(/\bKfc\b/g, 'KFC')
        .replace(/\bBbq\b/g, 'BBQ')
        .replace(/ L$/, ' l')
        .replace(/\bMit\b/g, 'mit')
        .replace(/\bOhne\b/g, 'ohne')
        .replace(/\bUnd\b/g, 'und')
    : s;
for (const [chain, file] of [
  ['kfc', 'kfc.txt'],
  ['dominos', 'dominos.txt'],
  ['fiveguys', 'fiveguys.txt'],
  ['nordsee', 'nordsee.txt'],
  ['ditsch', 'ditsch.txt'],
  ['kamps', 'kamps.txt'],
  ['hofpfisterei', 'hofpfisterei.txt'],
  ['coffeefellows', 'coffeefellows.txt'],
]) {
  for (const [name, g, unit, kcal, p, c, f, fib, sug, sat, salt] of read(file)) {
    add(chain, titleCase(name), unit === 'ml' ? 'ml' : 'g', num(g), '100', {
      kcal: num(kcal),
      protein: num(p),
      carbs: num(c),
      fat: num(f),
      fiber: num(fib),
      sugar: num(sug),
      satFat: num(sat),
      salt: num(salt),
    });
  }
}

/* ---------- Subway: section|name|serving|kJ|kcal|fat|satFat|carbs|sugar|fiber|protein|salt, per serving ---------- */
const SUBWAY_PREFIX = { Sandwich: 'Sandwich', Wrap: 'Wrap', Salad: 'Salat', Panini: 'Panini', Bread: 'Brot' };
for (const [sec, name, g, , kcal, f, sat, c, sug, fib, p, salt] of read('subway.txt')) {
  let v = { kcal: num(kcal), protein: num(p), carbs: num(c), fat: num(f), fiber: num(fib), sugar: num(sug), satFat: num(sat), salt: num(salt) };
  // In the drinks table of the PDF the carbohydrate and sugar figures sit two columns to the left
  // (in the fat columns) whenever a drink has no fat: drinks have no fat, so move them back.
  if (sec === 'Drink' && v.fat > 0 && !v.carbs) {
    notes.push(`subway: "${name}" carbs/sugar moved out of the fat columns`);
    v = { ...v, carbs: v.fat, sugar: v.satFat, fat: 0, satFat: 0 };
  }
  const prefix = SUBWAY_PREFIX[sec];
  const full = prefix ? `${prefix} ${name}${sec === 'Sandwich' ? ' (15 cm)' : ''}` : name;
  add('subway', full, sec === 'Drink' ? 'ml' : 'g', num(g), 'serving', v);
}

/* ---------- Starbucks: name|size|kcal|fat|satFat|carbs|sugar|fiber|protein|salt, per cup ---------- */
const CUP_ML = { Tall: 350, Grande: 470 };
for (const [name, size, kcal, f, sat, c, sug, fib, p, salt] of read('starbucks.txt')) {
  add('starbucks', `${name} ${size}`, 'ml', CUP_ML[size], 'serving', { kcal: num(kcal), protein: num(p), carbs: num(c), fat: num(f), fiber: num(fib), sugar: num(sug), satFat: num(sat), salt: num(salt) });
}

/* ---------- Five Guys burgers, put together from the published parts (bun, patties, cheese, bacon) ---------- */
const fg = (n) => rows.find((r) => r.chain === 'fiveguys' && r.name === n);
const PARTS = { bun: fg('Burger-Brötchen'), patty: fg('Rindfleisch-Burgerpatty'), cheese: fg('Käse (Scheibe)'), bacon: fg('Bacon') };
const COMPOSED = [
  ['Hamburger (ohne Toppings)', { bun: 1, patty: 2 }],
  ['Cheeseburger (ohne Toppings)', { bun: 1, patty: 2, cheese: 2 }],
  ['Bacon Burger (ohne Toppings)', { bun: 1, patty: 2, bacon: 2 }],
  ['Bacon Cheeseburger (ohne Toppings)', { bun: 1, patty: 2, cheese: 2, bacon: 2 }],
  ['Little Hamburger (ohne Toppings)', { bun: 1, patty: 1 }],
  ['Little Cheeseburger (ohne Toppings)', { bun: 1, patty: 1, cheese: 1 }],
];
for (const [name, parts] of COMPOSED) {
  const sum = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, satFat: 0, salt: 0 };
  let grams = 0;
  for (const [part, count] of Object.entries(parts)) {
    const r = PARTS[part];
    grams += r.serving * count;
    for (const k of Object.keys(sum)) sum[k] += ((r.v[k] ?? 0) * r.serving * count) / 100;
  }
  add('fiveguys', name, 'g', grams, 'serving', sum);
  notes.push(`fiveguys: "${name}" = ${Object.entries(parts).map(([p, n]) => `${n}× ${PARTS[p].name}`).join(' + ')}`);
}

/* ---------- Normalise and check ---------- */
const MAX_KCAL_PER_100G = 950;
const round1 = (v) => Math.round(v * 10) / 10;

/** The hard limits and the energy-vs-macros rule of checkPer100 (src/lib/labelScan.ts). */
function problem(n) {
  const vals = Object.values(n).filter((x) => x !== null);
  if (vals.some((x) => !Number.isFinite(x) || x < 0)) return 'negative or not a number';
  if (n.kcal > MAX_KCAL_PER_100G) return 'more energy than pure fat';
  if ([n.protein, n.carbs, n.fat, n.sugar ?? 0, n.fiber ?? 0, n.satFat ?? 0, n.salt ?? 0].some((x) => x > 100)) return 'over 100 g of one nutrient';
  if (n.protein + n.carbs + n.fat > 100.5) return 'macros over 100 g';
  if (n.sugar !== null && n.sugar > n.carbs + 0.5) return 'more sugar than carbohydrates';
  if (n.satFat !== null && n.satFat > n.fat + 0.5) return 'more saturated fat than fat';
  const fromMacros = n.protein * 4 + n.carbs * 4 + n.fat * 9 + (n.fiber ?? 0) * 2;
  if ((n.kcal > 40 || fromMacros > 40) && (fromMacros > n.kcal * 1.3 + 10 || n.kcal > fromMacros + 300)) return 'calories don’t fit protein, carbs and fat';
  return null;
}

const out = [];
const left = [];
const seen = new Set();
for (const r of rows) {
  const { kcal, protein, carbs, fat } = r.v;
  if ([kcal, protein, carbs, fat].some((x) => x === null)) {
    left.push(`${r.chain}: "${r.name}" has no complete table`);
    continue;
  }
  if (kcal === 0 && protein === 0 && carbs === 0 && fat === 0 && !/Wasser|Espresso|Crema|Tee|Coffee|Café|Zero|light|Americano/i.test(r.name)) {
    left.push(`${r.chain}: "${r.name}" lists only zeros`);
    continue;
  }
  if (r.basis === 'serving' && !(r.serving > 0)) {
    left.push(`${r.chain}: "${r.name}" has values per serving but no serving size`);
    continue;
  }
  const f = r.basis === 'serving' ? 100 / r.serving : 1;
  const per100 = {};
  for (const [k, x] of Object.entries(r.v)) per100[k] = x === null ? null : round1(x * f);
  const why = problem(per100);
  if (why) {
    left.push(`${r.chain}: "${r.name}" — ${why}`);
    continue;
  }
  const key = `${r.chain}:${r.name.toLowerCase()}`;
  if (seen.has(key)) continue;
  seen.add(key);
  out.push([r.chain, r.name, r.unit, round1(r.serving), per100.kcal, per100.protein, per100.carbs, per100.fat, per100.fiber, per100.sugar, per100.satFat, per100.salt]);
}

const byChain = {};
for (const r of out) byChain[r[0]] = (byChain[r[0]] ?? 0) + 1;

const header = `/* Generated by scripts/build-restaurants.mjs from scripts/restaurants/raw/. Do not edit by hand.
 * Menu items of fast-food chains in Germany, from each chain's own published nutrition information
 * (sources and dates: RESTAURANT_CHAINS in restaurants.ts and the headers of the raw files).
 * Row: chain, name, unit, serving (g or ml, 0 = none), kcal, protein, carbs, fat, fiber, sugar, satFat, salt
 * (per 100 g / 100 ml; null = not published).
 */
export type RestaurantRow = [string, string, 'g' | 'ml', number, number, number, number, number, number | null, number | null, number | null, number | null];

export const RESTAURANT_ROWS: RestaurantRow[] = [
`;
writeFileSync(join(root, 'src/lib/restaurantData.ts'), header + out.map((r) => JSON.stringify(r)).join(',\n') + ',\n];\n');

console.log(`wrote ${out.length} items: ${Object.entries(byChain).map(([k, n]) => `${k} ${n}`).join(', ')}`);
if (notes.length) console.log(`\nadjusted:\n  ${notes.join('\n  ')}`);
if (left.length) console.log(`\nleft out (${left.length}):\n  ${left.join('\n  ')}`);
