// Builds the signed offline product pack for Germany from Open Food Facts' CSV export.
//
// Usage (in .github/workflows/offline-pack.yml; the logic modules must be compiled first with
// `npx tsc -p tests/tsconfig.json`):
//   curl -fsSL https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz | gzip -dc \
//     | OFFLINE_PACK_PRIVATE_KEY="$(cat key.pem)" node scripts/build-offline-pack.mjs out
//
// Reads the tab-separated export from stdin, keeps products sold in Germany whose barcode, name and
// nutrition pass the same checks the app uses (src/lib/offlinePack.ts → packRow), orders them by how
// often they are scanned, and makes two packs:
//   all     every such product (as before the choice existed);
//   german  only those with a German name that look really sold here (offlinePack.ts → germanOnlyReason).
// It writes:
//   out/de/products-<sha512 prefix>.txt   each pack's products, one per line
//   out/de/packs.json                     both packs (format 2), signed: what the app reads
//   out/de/manifest.json                  the `all` pack alone (format 1), signed: what older app versions read
//   out/README.md                         licence and attribution (ODbL)
//   <report>/report.md                    the numbers and samples of kept and removed products (not published)
// Before writing, it checks the result exactly as the app will: signature against the public key in
// the app, size, hash, every line. A key that doesn't match the app's stops the build.
//
// `--dry-run` (or OFFLINE_PACK_DRY_RUN=1) needs no key: it builds both packs and the report but writes
// nothing to `out`. The workflow's *dry run* uses it on a branch, where the signing key isn't available.
import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || process.env.OFFLINE_PACK_DRY_RUN === '1';
const out = args.find((a) => !a.startsWith('--')) ?? 'out';
const reportDir = process.env.OFFLINE_PACK_REPORT ?? 'pack-report';
const lib = await import(pathToFileURL(join(process.cwd(), '.test-build/src/lib/offlinePack.js')).href);
const {
  packRow, germanOnlyReason, readEnvelope, readCatalog, PackIndex, PACK_PUBLIC_KEY, PACK_FORMAT, PACK_CATALOG_FORMAT, PACK_COUNTRY,
  MAX_PACK_BYTES, MAX_PACK_ROWS, GERMAN_MIN_SCANS, FOREIGN_MIN_SCANS, foodFromPackLine,
} = lib;

/** Stay well below the app's hard limits. */
const TARGET_BYTES = Math.min(MAX_PACK_BYTES - 4 * 1024 * 1024, 32 * 1024 * 1024);
const TARGET_ROWS = Math.min(MAX_PACK_ROWS - 50_000, 500_000);
/** Fewer products than this means the export or the filter broke; don't publish a nearly empty pack. */
const MIN_ROWS = 20_000;
/** The `german` pack is left out (only `all` is published) when it would have fewer products than this. */
const MIN_GERMAN_ROWS = 100_000;

let privateKey = null;
let publicKey = '';
if (!dryRun) {
  const pem = process.env.OFFLINE_PACK_PRIVATE_KEY ?? '';
  if (!pem.trim()) {
    console.error('OFFLINE_PACK_PRIVATE_KEY is not set (see docs/CONTRIBUTING.md → Offline product pack).');
    process.exit(1);
  }
  privateKey = createPrivateKey(pem);
  publicKey = createPublicKey(privateKey).export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64');
  if (publicKey !== PACK_PUBLIC_KEY) {
    console.error(`The signing key doesn't belong to the app. PACK_PUBLIC_KEY in src/lib/offlinePack.ts must be: ${publicKey}`);
    process.exit(1);
  }
}

const COLUMNS = [
  'code', 'product_name', 'product_name_de', 'generic_name', 'generic_name_de', 'brands', 'brands_en', 'brands_tags', 'stores', 'quantity',
  'serving_size', 'serving_quantity', 'countries_tags', 'unique_scans_n', 'lang', 'lc',
  'energy-kcal_100g', 'energy-kj_100g', 'energy_100g', 'proteins_100g', 'carbohydrates_100g', 'fat_100g',
  'sugars_100g', 'fiber_100g', 'saturated-fat_100g', 'salt_100g', 'sodium_100g',
];

const best = new Map(); // code → { line, scans, why }  (why: 'keep' or the rule that keeps it out of the `german` pack)
let header = null;
let idx = {};
let total = 0;
let germany = 0;
let skippedBroken = 0;
let withNameDe = 0;
let withLangDe = 0;

/** One line of the export. Returns false to stop (format changed). */
function handleLine(raw) {
  if (!header) {
    header = raw.split('\t');
    for (const c of COLUMNS) idx[c] = header.indexOf(c);
    // A dry run lists the columns the filter could use, so a rule change can be checked against the real export.
    if (dryRun) console.log(`Columns about names, languages, shops and scans: ${header.filter((h) => /name|lang|lc$|^lc|store|scan|countr|origin|manufactur/i.test(h)).join(', ')}`);
    for (const required of ['code', 'product_name', 'countries_tags', 'proteins_100g', 'carbohydrates_100g', 'fat_100g']) {
      if (idx[required] === -1) {
        console.error(`The export has no "${required}" column; its format changed.`);
        process.exit(1);
      }
    }
    return;
  }
  total++;
  // Cheap pre-check before splitting ~200 columns: most products aren't sold in Germany.
  if (!raw.includes('en:germany')) return;
  const f = raw.split('\t');
  if (f.length !== header.length) {
    skippedBroken++;
    return;
  }
  if (!f[idx.countries_tags].split(',').includes('en:germany')) return;
  germany++;
  const rec = {};
  for (const c of COLUMNS) if (idx[c] !== -1) rec[c] = f[idx[c]];
  const row = packRow(rec);
  if (!row) return;
  if ((rec.product_name_de ?? '').trim()) withNameDe++;
  if ((rec.lang || rec.lc || '').trim() === 'de') withLangDe++;
  const why = germanOnlyReason(rec, row.scans);
  // Keyed by number: `row.code` is a slice of the 64 KB chunk it came from, and keeping it would keep
  // that whole chunk in memory (V8 sliced strings), so the export would pile up. Barcodes have at most
  // 14 digits, well within exact integers. `row.line` is a fresh string (joined).
  const key = Number(row.code);
  const prev = best.get(key);
  if (!prev || row.scans > prev.scans) best.set(key, { line: row.line, scans: row.scans, why });
}

// The unpacked export is about 10 GB. Reading stdin chunk by chunk with `for await` keeps the pipe's
// backpressure: the next chunk is only read once this one is processed, so memory stays flat.
// (readline's async iterator buffers lines without limit when the input is faster than the loop; that
// ran out of memory in CI.) A line is never kept beyond MAX_LINE characters.
const MAX_LINE = 4 * 1024 * 1024;
const decoder = new TextDecoder('utf-8');
let rest = '';
let tooLong = false;
for await (const chunk of process.stdin) {
  const text = rest + decoder.decode(chunk, { stream: true });
  let start = 0;
  for (let nl = text.indexOf('\n', start); nl !== -1; nl = text.indexOf('\n', start)) {
    const line = text.charCodeAt(nl - 1) === 13 ? text.slice(start, nl - 1) : text.slice(start, nl);
    if (tooLong) {
      tooLong = false;
      skippedBroken++;
    } else handleLine(line);
    start = nl + 1;
  }
  rest = text.slice(start);
  if (rest.length > MAX_LINE) {
    rest = '';
    tooLong = true;
  }
}
rest += decoder.decode();
if (rest && !tooLong) handleLine(rest);

const rows = [...best.entries()].sort((a, b) => b[1].scans - a[1].scans || a[0] - b[0]);

/** The most scanned rows that fit the size limits, hashed. */
function makePack(source) {
  const lines = [];
  let bytes = 0;
  let cut = 0;
  for (const r of source) {
    const size = Buffer.byteLength(r.line) + 1;
    if (bytes + size > TARGET_BYTES || lines.length >= TARGET_ROWS) {
      cut++;
      continue;
    }
    lines.push(r.line);
    bytes += size;
  }
  const text = lines.length ? `${lines.join('\n')}\n` : '';
  const body = Buffer.from(text, 'utf8');
  const sha512 = createHash('sha512').update(body).digest('hex');
  return { lines, text, body, sha512, file: `${PACK_COUNTRY}/products-${sha512.slice(0, 16)}.txt`, cut };
}

const all = makePack(rows.map(([, r]) => r));
if (all.lines.length < MIN_ROWS) {
  console.error(`Only ${all.lines.length} products passed (of ${germany} sold in Germany, ${total} in total). Not publishing.`);
  process.exit(1);
}
const removed = { no_german_name: 0, not_seen_here: 0 };
for (const [, r] of rows) if (r.why !== 'keep') removed[r.why]++;
const german = makePack(rows.filter(([, r]) => r.why === 'keep').map(([, r]) => r));
const germanOk = german.lines.length >= MIN_GERMAN_ROWS;
if (!germanOk) {
  console.log(`::warning title=Offline pack::The German-products pack would have only ${german.lines.length} products (minimum ${MIN_GERMAN_ROWS}); only the full pack is published.`);
}

const created = new Date().toISOString();
const packs = [{ id: 'all', p: all }, ...(germanOk ? [{ id: 'german', p: german }] : [])];
const manifest = {
  format: PACK_FORMAT,
  country: PACK_COUNTRY,
  created,
  rows: all.lines.length,
  bytes: all.body.length,
  sha512: all.sha512,
  file: all.file,
  source: 'Open Food Facts',
  license: 'ODbL 1.0',
};
const catalog = {
  format: PACK_CATALOG_FORMAT,
  country: PACK_COUNTRY,
  created,
  source: 'Open Food Facts',
  license: 'ODbL 1.0',
  passed: best.size,
  packs: packs.map(({ id, p }) => ({
    id,
    rows: p.lines.length,
    bytes: p.body.length,
    sha512: p.sha512,
    file: p.file,
    cut: p.cut,
    ...(id === 'german' ? { removed } : {}),
  })),
};

/** Checks one pack the way the app will. */
function checkPack(p, m) {
  if (m.sha512 !== p.sha512 || m.rows !== p.lines.length || m.bytes !== p.body.length || m.file !== p.file) throw new Error('manifest check failed');
  const index = new PackIndex(p.text);
  if (index.size !== p.lines.length) throw new Error('index check failed');
  let unreadable = 0;
  for (const l of p.lines) if (!foodFromPackLine(l)) unreadable++;
  if (unreadable) throw new Error(`${unreadable} lines the app can't read`);
  if (!index.lookup(p.lines[0].split('\t')[0])) throw new Error('lookup check failed');
}

if (!dryRun) {
  const envelopeOf = (m) => {
    const signed = JSON.stringify(m);
    const signature = sign(null, Buffer.from(signed, 'utf8'), privateKey).toString('base64');
    return `${JSON.stringify({ signed, signature, key: publicKey })}\n`;
  };
  const envelope = envelopeOf(manifest);
  const catalogEnvelope = envelopeOf(catalog);
  // Check the result the way the app will (and older versions, for manifest.json), before anything is written.
  checkPack(all, readEnvelope(JSON.parse(envelope), PACK_PUBLIC_KEY));
  const read = readCatalog(JSON.parse(catalogEnvelope), PACK_PUBLIC_KEY);
  if (read.packs.length !== packs.length) throw new Error('catalog check failed');
  for (const { id, p } of packs) checkPack(p, read.packs.find((x) => x.id === id));

  mkdirSync(join(out, PACK_COUNTRY), { recursive: true });
  for (const { p } of packs) writeFileSync(join(out, p.file), p.body);
  writeFileSync(join(out, PACK_COUNTRY, 'manifest.json'), envelope);
  writeFileSync(join(out, PACK_COUNTRY, 'packs.json'), catalogEnvelope);
  writeFileSync(
    join(out, 'README.md'),
    [
      '# Tellerwerk offline product pack',
      '',
      `Built ${created} by the "Offline product pack" workflow of Tellerwerk. Products sold in Germany with complete,`,
      'plausible nutrition, most scanned first, in two packs: all of them, and only those with a German name that',
      'look really sold here. The Tellerwerk app downloads these files on request and checks the Ed25519 signature',
      'in `de/packs.json` (older versions: `de/manifest.json`) before using them.',
      '',
      'Data: © Open Food Facts contributors, https://world.openfoodfacts.org, available under the',
      'Open Database License (ODbL) 1.0: https://opendatacommons.org/licenses/odbl/1-0/.',
      'This pack is a derived database and is made available under the same licence. Individual contents of the',
      'database are under the Database Contents License: https://opendatacommons.org/licenses/dbcl/1-0/.',
      '',
    ].join('\n'),
  );
} else {
  checkPack(all, { sha512: all.sha512, rows: all.lines.length, bytes: all.body.length, file: all.file });
  if (german.lines.length) checkPack(german, { sha512: german.sha512, rows: german.lines.length, bytes: german.body.length, file: german.file });
}

// The export's columns change now and then (`brands` became `brands_en`); say so when a field goes empty.
const share = (col) => all.lines.filter((l) => l.split('\t')[col] !== '').length / all.lines.length;
const brandShare = share(2);
const storeShare = share(3);
for (const [name, v] of [['brand', brandShare], ['store', storeShare]]) {
  if (v < 0.05) console.log(`::warning title=Offline pack::Only ${(v * 100).toFixed(1)} % of products have a ${name}; the export's columns may have changed.`);
}

const n = (x) => x.toLocaleString('en');
const mb = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`;
const summary = [
  `Offline packs${dryRun ? ' (dry run: nothing signed or published)' : ''}, built ${created}`,
  `All products sold in Germany: ${n(all.lines.length)} products, ${mb(all.body.length)}${all.cut ? `, ${n(all.cut)} left out for size` : ''}`,
  `German products only: ${n(german.lines.length)} products, ${mb(german.body.length)}${german.cut ? `, ${n(german.cut)} left out for size` : ''}${germanOk ? '' : ` (below ${n(MIN_GERMAN_ROWS)}: not published)`}`,
  `  removed, no German name and fewer than ${FOREIGN_MIN_SCANS} scans: ${n(removed.no_german_name)}`,
  `  removed, German name but fewer than ${GERMAN_MIN_SCANS} scans and no German shop: ${n(removed.not_seen_here)}`,
  `(export rows ${n(total)}, sold in Germany ${n(germany)}, passed the checks ${n(best.size)}, broken lines ${skippedBroken})`,
  `German-name signals among products that passed: product_name_de ${n(withNameDe)}, language column "de" ${n(withLangDe)}${idx.lang === -1 && idx.lc === -1 ? ' (the export has no lang/lc column)' : ''}`,
  `With brand ${(brandShare * 100).toFixed(0)} %, with store ${(storeShare * 100).toFixed(0)} %`,
  ...packs.map(({ id, p }) => `File ${id}: ${p.file}`),
].join('\n');
console.log(summary);

// Samples for checking the rules by eye: the most scanned products each rule removed, the kept
// products with the fewest scans (the edge of the rules), and an even spread of kept ones.
const cols = (l) => l.split('\t');
const rowText = (r) => {
  const f = cols(r.line);
  const esc = (x) => (x || '–').replace(/\|/g, '/');
  return `| ${f[0]} | ${esc(f[1])} | ${esc(f[2])} | ${esc(f[3])} | ${n(r.scans)} |`;
};
const table = (title, list) => [`### ${title}`, '', '| Barcode | Name | Brand | Stores | Scans |', '|---|---|---|---|---|', ...list.map(rowText), ''];
const keptRows = rows.filter(([, r]) => r.why === 'keep').map(([, r]) => r);
const spread = (list, k) => (list.length <= k ? list : Array.from({ length: k }, (_, i) => list[Math.floor((i * list.length) / k)]));
const report = [
  '# Offline packs: build report',
  '',
  ...summary.split('\n').map((l) => `${l}  `),
  '',
  ...table(`Removed: no German name, fewer than ${FOREIGN_MIN_SCANS} scans (most scanned first)`, rows.filter(([, r]) => r.why === 'no_german_name').slice(0, 30).map(([, r]) => r)),
  ...table(`Removed: German name, fewer than ${GERMAN_MIN_SCANS} scans, no German shop (most scanned first)`, rows.filter(([, r]) => r.why === 'not_seen_here').slice(0, 30).map(([, r]) => r)),
  ...table('Kept in “German products only”: the 30 with the fewest scans', keptRows.slice(-30)),
  ...table('Kept in “German products only”: 30 spread across the pack', spread(keptRows, 30)),
];
mkdirSync(reportDir, { recursive: true });
writeFileSync(join(reportDir, 'report.md'), `${report.join('\n')}\n`);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report.join('\n')}\n`);
if (dryRun) console.log(report.join('\n'));
