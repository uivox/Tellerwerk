import type { RestaurantRow } from './restaurantData';
import type { Food } from './types';

/**
 * Menu items of fast-food chains and bakery chains in Germany, bundled with the app (scripts/build-restaurants.mjs).
 * Every value comes from the chain's own published nutrition information; nothing is estimated
 * except the Five Guys burgers, which add up the published parts (named "ohne Toppings").
 *
 * Like the BLS, the rows are loaded the first time they're needed (`loadRestaurants`), not with the
 * app itself, and searching them never sends anything anywhere.
 */

export interface RestaurantChain {
  id: string;
  name: string;
  /** Where the values come from, as shown on the food screen. */
  source: { de: string; en: string };
  url: string;
  /** When the values were read (YYYY-MM-DD). */
  asOf: string;
}

/** Ids match the first column of RESTAURANT_ROWS. Small, so the food screen can name the source without loading the rows. */
export const RESTAURANT_CHAINS: RestaurantChain[] = [
  {
    id: 'mcd',
    name: 'McDonald’s',
    source: { de: 'Produktseiten auf mcdonalds.com/de', en: 'product pages on mcdonalds.com/de' },
    url: 'https://www.mcdonalds.com/de/de-de/produkte/alle-produkte.html',
    asOf: '2026-11-04',
  },
  {
    id: 'bk',
    name: 'Burger King',
    source: { de: 'Produktseiten auf burgerking.de', en: 'product pages on burgerking.de' },
    url: 'https://www.burgerking.de/menu',
    asOf: '2026-11-04',
  },
  {
    id: 'kfc',
    name: 'KFC',
    source: { de: 'Produktinformationen „September 2026“', en: 'product information “September 2026”' },
    url: 'https://static.kfc.de/pdf/ALLERGENE.pdf',
    asOf: '2026-11-04',
  },
  {
    id: 'subway',
    name: 'Subway',
    source: { de: 'Nährwertinformationen März 2026', en: 'nutrition information March 2026' },
    url: 'https://www.subway.com/v1v2/assets/de-at/nutrition/documents/germany-nutritional-information-full-menu-c2-march-2026-german.pdf',
    asOf: '2026-11-04',
  },
  {
    id: 'fiveguys',
    name: 'Five Guys',
    source: { de: 'Allergen- und Nährwertinfo vom 15.06.2026', en: 'allergen and nutrition info of 15 June 2026' },
    url: 'https://www.fiveguys.de/wp-content/uploads/sites/33/2026/06/Allergen-and-Nutrition-Info.pdf',
    asOf: '2026-11-04',
  },
  {
    id: 'nordsee',
    name: 'NORDSEE',
    source: { de: 'Produktseiten auf nordsee.com', en: 'product pages on nordsee.com' },
    url: 'https://www.nordsee.com/de/produkte',
    asOf: '2026-11-04',
  },
  {
    id: 'starbucks',
    name: 'Starbucks',
    source: { de: 'Nährwerte Getränke, Frühjahr 2026', en: 'drinks nutrition, spring 2026' },
    url: 'https://www.starbucks.de/',
    asOf: '2026-11-04',
  },
  {
    id: 'dominos',
    name: 'Domino’s',
    source: { de: 'Pflichtinformationen zu vorverpackten Produkten', en: 'information on pre-packed products' },
    url: 'https://www.dominos.de/produkte/pflichtinformationen/',
    asOf: '2026-11-04',
  },  {
    id: 'ditsch',
    name: 'Ditsch',
    source: { de: 'Produktseiten auf ditsch.de', en: 'product pages on ditsch.de' },
    url: 'https://www.ditsch.de/de/shops/produktwelt',
    asOf: '2026-11-08',
  },
  {
    id: 'kamps',
    name: 'Kamps',
    source: { de: 'Produktseiten auf kamps.de', en: 'product pages on kamps.de' },
    url: 'https://kamps.de/produkte',
    asOf: '2026-11-08',
  },
  {
    id: 'hofpfisterei',
    name: 'Hofpfisterei',
    source: { de: 'Sortiments-PDFs auf hofpfisterei.de', en: 'range PDFs on hofpfisterei.de' },
    url: 'https://www.hofpfisterei.de/download/Hofpfisterei-Sortiment-Feinbackwaren_0525.pdf',
    asOf: '2026-11-08',
  },
  {
    id: 'coffeefellows',
    name: 'Coffee Fellows',
    source: { de: 'Produktdatenbank auf coffee-fellows.com', en: 'product database on coffee-fellows.com' },
    url: 'https://products.coffee-fellows.com/de/print',
    asOf: '2026-11-08',
  },
];

export const restaurantChain = (id: string): RestaurantChain | undefined => RESTAURANT_CHAINS.find((c) => c.id === id);

/** The chain of a food made by `restaurantFood` (id `rest:<chain>:<slug>`). */
export function chainOfFood(food: Pick<Food, 'id' | 'source'>): RestaurantChain | undefined {
  if (food.source !== 'restaurant') return undefined;
  return restaurantChain(food.id.split(':')[1] ?? '');
}

let loaded: RestaurantRow[] | null = null;
let loading: Promise<RestaurantRow[]> | null = null;

/** Loads the rows once; later calls get the same promise. */
export function loadRestaurants(): Promise<RestaurantRow[]> {
  if (!loading)
    loading = import('./restaurantData').then(
      (m) => (loaded = m.RESTAURANT_ROWS),
      (e) => {
        loading = null;
        throw e;
      },
    );
  return loading;
}

/** The rows when loaded, else null. */
export const restaurantRows = (): RestaurantRow[] | null => loaded;

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[’'®™]/g, '');

const slug = (s: string) =>
  fold(s)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function restaurantFood(row: RestaurantRow, lang: 'de' | 'en'): Food {
  const [chain, name, unit, serving, kcal, protein, carbs, fat, fiber, sugar, satFat, salt] = row;
  const opt = (v: number | null) => (v === null ? undefined : v);
  return {
    id: `rest:${chain}:${slug(name)}`,
    source: 'restaurant',
    name,
    brand: restaurantChain(chain)?.name,
    per100: { kcal, protein, carbs, fat, fiber: opt(fiber), sugar: opt(sugar), satFat: opt(satFat), salt: opt(salt) },
    servings: serving > 0 ? [{ label: lang === 'de' ? '1 Portion' : '1 serving', grams: serving }] : [],
    unit,
  };
}

interface Indexed {
  row: RestaurantRow;
  name: string;
  words: string[];
  brand: string[];
}
let index: Indexed[] | null = null;

function getIndex(rows: RestaurantRow[]): Indexed[] {
  if (index && rows === loaded) return index;
  const built = rows.map((row) => {
    const name = fold(row[1]);
    const chain = restaurantChain(row[0]);
    return {
      row,
      name,
      words: name.split(/[\s,()/&–-]+/).filter(Boolean),
      // "mcdonalds", "mcd", "burger king", "bk" … all find the chain; with a name of several words
      // each word counts on its own ("coffee fellows latte" = coffee + fellows + latte)
      brand: [fold(chain?.name ?? ''), row[0]].flatMap((b) => [b, b.replace(/\s+/g, ''), ...b.split(/\s+/).filter((w) => w.length >= 3)]),
    };
  });
  if (rows === loaded) index = built;
  return built;
}

/**
 * Every word of the query has to start a word of the item's name, or name the chain
 * ("whopper", "mc big mac", "kfc wings", "burger king pommes"). A name that starts with the
 * query ranks first; a query that only names a chain lists that chain's items.
 */
export function searchRestaurants(query: string, lang: 'de' | 'en', limit = 8, rows: RestaurantRow[] | null = loaded): Food[] {
  if (!rows) return [];
  const q = fold(query.trim());
  if (q.length < 2) return [];
  const terms = q.split(/[\s,]+/).filter(Boolean);
  const hits: { row: RestaurantRow; score: number }[] = [];
  for (const it of getIndex(rows)) {
    let score = 0;
    let nameTerms = 0;
    const ok = terms.every((t) => {
      if (it.words.some((w) => w.startsWith(t))) {
        nameTerms++;
        return true;
      }
      // a chain name, also spelt without spaces or apostrophe ("burgerking", "mcdonalds")
      return it.brand.some((b) => b && (b.startsWith(t) || (t.length >= 4 && t.startsWith(b))));
    });
    if (!ok) {
      // whole query inside a compound name ("pommes" → "King Pommes"; "nuggets" → "McNuggets")
      if (q.length >= 4 && it.name.includes(q)) score = 1;
      else continue;
    } else {
      score = 2 + nameTerms;
      if (it.name === q) score += 4;
      else if (it.name.startsWith(q)) score += 3;
    }
    hits.push({ row: it.row, score: score - it.name.length / 1000 });
  }
  return hits
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((h) => restaurantFood(h.row, lang));
}
