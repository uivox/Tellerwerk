# Working on Tellerwerk

This page is for people who want to change the code, add recipes or run their own copy. To use the app, see the [README](../README.md).

- **Recipes:** community recipes are added through pull requests, see [RECIPES.md](RECIPES.md).
- **Design:** palette, type, the plate and the sprout, see [DESIGN.md](DESIGN.md).
- **Security problems:** please report them privately, see [SECURITY.md](../.github/SECURITY.md).
- **Working with an AI coding assistant:** [CLAUDE.md](../CLAUDE.md) holds the project rules (texts in English and German, colours from the theme, pure logic with tests, the same features on every platform).

## Develop on your PC

Live-reload while changing the code, using the Expo Go app:

```powershell
npm install
npx expo install --fix
npx expo start
```

Scan the QR code with the phone camera. `npm run web` opens the web version on the PC; `npm run build:web` writes the installable build to `dist/`, for the root of a site (set `WEB_BASE_URL=/folder` only when it is served from a sub-folder). The project uses Expo **SDK 58** (React Native 0.88); Expo Go on the phone must support the same SDK (shown in Expo Go → Settings). If the Expo Go in the store doesn't support SDK 58 yet, work in the web version or install the apps that CI builds.

Dependencies are locked in `package-lock.json` (CI installs with `npm ci`). Add packages with `npx expo install <package>` so the version fits the SDK, and commit the updated lockfile. `overrides` in `package.json` forces a fixed version of one build-time package with a security advisory (uuid, used by the iOS project generator); keep it until an Expo upgrade makes it unnecessary.

## Checks

`npm run check` (TypeScript) and `npm test` (logic tests). Pull requests and branches also run `.github/workflows/check.yml`: type check, tests, an Android prebuild, a web build and `scripts/web-smoke.mjs`, which clicks through the web app in a headless browser (light and dark), including an export, a hostile backup import and the Content Security Policy. It never publishes anything. `main` is protected: changes go through a pull request, and this check must pass before it can be merged.

## Releases

Every push to `main` is a release:

- `build.yml` builds both apps (about 30 minutes) and publishes them under [Releases](https://github.com/uivox/Tellerwerk/releases/latest), with the SideStore source for the iPhone app. Android APKs are signed with the project key.
- `web.yml` rebuilds the web version (a few minutes) and publishes it to its own site, see *Web version hosting* below.

### The move from OpenPlate (temporary)

The app was called OpenPlate until the rename (plan and reasons: `claude/RENAME.md` in the project docs). Tellerwerk has a new app id and a new web address, so users move their data with a backup file. For the move period:

- `build.yml` builds every release twice (a matrix): Tellerwerk, and the last OpenPlate with `APP_VARIANT=openplate` (`app.config.js`: old app id and name). Both are published; `source.json` lists both apps.
- `web.yml` publishes the same web build to the new site and, when `WEB_OLD_SITE_REPO` and the environment secret `WEB_OLD_DEPLOY_KEY` are set, to OpenPlate's old site.
- The app knows it is the old copy by its app id or host name (`isOldApp` in `src/lib/appIdentity.ts`, `oldAppCopy` in both `device` files) and shows `MoveNotice` at the top of the diary.
- What stays `openplate` on purpose: the backup format id (`BACKUP_FORMAT_ID`, so OpenPlate backups import), storage and database keys, the service worker's cache names, the SideStore source id, the signing environment variables. A test fails if “OpenPlate” shows up anywhere else.
- After the move period (at least six months): drop the OpenPlate matrix entry and the old-site step. Leave the last build on the old site; never replace it with an empty page, since only the app at that address can read the data people's browsers keep there. Never delete the `openplate-app` organisation.

## Project layout

```
app/                    screens (expo-router, file-based)
  (tabs)/index.tsx      diary
  (tabs)/fasting.tsx    fasting timer and plans
  (tabs)/progress.tsx   weight and weekly charts
  (tabs)/profile.tsx    settings, export
  onboarding.tsx        first-run plan setup
  add-food.tsx          search, recent, my foods
  food.tsx              portion picker / edit entry
  scan.tsx              barcode scanner (camera or typed number) and what a barcode leads to
  photo.tsx             AI photo flow
  custom-food.tsx       create food / quick add / check values from a label or Open Food Facts
  label.tsx             read a nutrition table from a photo
  meal.tsx, meal-edit.tsx  saved meals: log / build
  (tabs)/recipes.tsx, recipe.tsx, recipe-edit.tsx  recipes: list / view / edit
  streak.tsx            streak and calendar
  appearance.tsx        themes, colours, animations
  layout-settings.tsx   tab and diary order
  ai-settings.tsx       bring-your-own-AI setup
  offline-data.tsx      download, update and delete the offline product pack
src/lib/
  ai.ts                 providers, prompt, JSON parsing, fallback logic
  aiLog.ts              AI answer log: records, prompt versions, size limit, export format (aiLogStore(.web).ts keeps it)
  nutrition.ts          BMR/TDEE, goals, macros
  goals.ts              the goal for a given day (weight on that day, fasting days)
  streaks.ts            streaks, goal-hit days, calendar grid
  meals.ts              saved meals
  recipes.ts            recipes (nutrition, scaling, community format and checks)
  communityRecipes.ts   community recipes (see RECIPES.md)
  themes.ts, layout.ts  colour themes and tab/diary layout
  openFoodFacts.ts      barcode lookup and search, Robotoff suggestions, fair-use limits, link to add products
  barcode.ts            barcode check (EAN-8, UPC-E, UPC-A, EAN-13, GTIN-14, check digit)
  barcodeFlow.ts        what a barcode leads to, shared by the scanner and the food search
  labelScan.ts          nutrition label prompt and parser, plausibility checks for outside nutrition data
  genericFoods.ts       built-in basic foods
  bls.ts, blsData.ts    German nutrient database (BLS 4.0) search and data
  restaurants.ts, restaurantData.ts   fast-food chains' menu items: chains, search and data
  offlinePack.ts        offline product pack: row format, signature and manifest checks, barcode index and search
  ed25519.ts            Ed25519 signature check and SHA-512 (for the offline pack)
  packStore(.web).ts    where the offline pack is kept (app documents folder / its own IndexedDB)
  packRuntime.ts        the loaded pack shared by scanner, search and settings
  fasting.ts            plans and phases
  i18n.ts               German and English texts
  store.ts              persisted state (zustand + AsyncStorage; IndexedDB on the web)
  backup.ts             export / import format
  backupReminder.ts     when the diary reminds you to save a copy
  *.web.ts(x)           browser versions of device, storage, secure, aiLogStore, BarcodeScanner
src/components/         shared UI (ui.tsx primitives, plate ring, charts, tab bar, export/import flows, ScannerParts.tsx for both scanners)
public/icons/           home-screen icons for the web version
plugins/                Expo config plugins: release signing, storage size on Android, Health Connect and links on the app-icon aliases
scripts/web-pwa.mjs     turns the web export into an installable, offline web app (with a Content Security Policy)
scripts/web-smoke.mjs   clicks through the built web app in a headless browser
scripts/make-app-icons.mjs renders every app icon PNG (assets/, assets/app-icons/, public/icons/) from the SVGs in src/lib/appIcon.ts and writes the icon list into app.json (Playwright)
scripts/build-offline-pack.mjs, pack-key.mjs  build and sign the offline product pack; create its key
scripts/ai-log-unpack.mjs  unpacks AI answer log exports into eval/ (git-ignored) with a summary
.claude/skills/ai-eval/ how Claude evaluates the AI answer log and proposes prompt or model changes
tests/logic.test.ts     tests for the logic modules (npm test)
docs/                   this page, design notes, recipe format
```

## Evaluating the AI answers

With *AI settings → AI answer log* switched on, every meal photo and label reading is logged with the photos, each provider call (raw reply, time, errors, fallback), what was saved and the user's optional rating. *Export log* writes `tellerwerk-ai-log-YYYY-MM-DD.json`. Put exports into `eval/inbox/` and run `node scripts/ai-log-unpack.mjs`: it merges them into `eval/data/` (one folder per answer, `cases.jsonl`, `summary.md`). `eval/` is git-ignored because it holds personal meal photos. A Claude session in this folder can then run the evaluation with the `ai-eval` skill (`.claude/skills/ai-eval/SKILL.md`).

When you change `buildMealPrompt` (ai.ts) or `buildLabelPrompt` (labelScan.ts), bump the matching `PROMPT_VERSION` in `aiLog.ts`, so answers before and after the change can be compared.

## German nutrient database (BLS 4.0)

`src/lib/blsData.ts` is generated, don't edit it by hand. Download the data from <https://blsdb.de> and run `python3 scripts/import_bls.py BLS_4_0_Daten_2025_DE.xlsx` (needs `openpyxl`).

## Restaurant items (fast-food chains)

`src/lib/restaurantData.ts` is generated, don't edit it by hand. The source tables are in `scripts/restaurants/raw/`, one file per chain, each copied from that chain's own published nutrition information for Germany; the header of each file says where from, when, and in which columns. Run `node scripts/build-restaurants.mjs` after changing them: it turns per-serving values into per 100 g / 100 ml (keeping the serving), fixes the column slips it lists, adds up the Five Guys burgers from their parts, and leaves out every row that fails the app's plausibility check, printing why. A test checks every bundled row against `checkPer100` again.

To update a chain: read its current values (the links are in `RESTAURANT_CHAINS` in `src/lib/restaurants.ts`), replace its raw file, update `asOf` (and `source` if the document changed), rebuild, and look through what the builder left out. Only the chain's own published values go in, never another app's database.

## Offline product pack

Products sold in Germany from Open Food Facts, which the app downloads on request so barcodes and product search work without a connection. `.github/workflows/offline-pack.yml` builds it every Monday (and on *Run workflow*): it streams Open Food Facts' export (about 1 GB), keeps products whose barcode and nutrition pass the app's own checks (`packRow` in `src/lib/offlinePack.ts`), most scanned first and at most about 32 MB, signs a manifest with an Ed25519 key and force-pushes the result as one commit to the `offline-pack` branch. The app reads it from `raw.githubusercontent.com` and uses it only if the signature matches the public key built into the app and the file's size and SHA-512 match the manifest; it also refuses a pack older than the one it has. The pack is never part of backups and is deleted with *Delete all data*. Data licence: ODbL, like Open Food Facts; the branch carries a README with the attribution.

There are two packs to choose from, built from the same products: *All products sold in Germany* (`all`) and *German products only* (`german`: a GS1 Germany barcode 400–440, a German shop or supermarket house brand, Germany as origin or place of manufacture, or at least 20 scans; `germanOnlyReason` in `src/lib/offlinePack.ts`). The CSV export has no language field and only each product's main-language name, so names aren't used. `de/packs.json` (format 2) lists both, signed, with how many products each sign kept and how many were removed; the app reads it first. A dry run also lists the export's name, language, shop and origin columns, so a rule change can be checked against what the export really has. `de/manifest.json` (format 1) stays the `all` pack alone, because app versions before the choice read only that file; keep writing it as long as those versions are around. The `german` pack is left out (only `all` is published) when it would have fewer than 100,000 products.

**Trying a filter change:** *Run workflow* from the branch with *dry run* ticked. It builds both packs without the signing key (the `offline-pack` environment only allows `main`) and publishes nothing; the counts and samples of removed and kept products are in the run's summary and its `pack-report` artifact.

One-time setup (until it's done, the app shows *Not available yet* and the workflow stops at its first step):

1. Create the key on your computer, in Git Bash (or any shell with OpenSSL 3):
   `openssl genpkey -algorithm ed25519 -out pack-key.pem`
   and print the public half: `openssl pkey -in pack-key.pem -pubout -outform DER | tail -c 32 | base64`
   (or, with Node installed: `node scripts/pack-key.mjs`, which prints both).
2. *Settings → Environments → New environment* `offline-pack`; *Deployment branches and tags*: *Selected branches*, add `main`. Add the environment secret `OFFLINE_PACK_PRIVATE_KEY` with the whole content of `pack-key.pem` (including the `BEGIN`/`END` lines).
3. Put the public key (44 characters ending in `=`) into `PACK_PUBLIC_KEY` in `src/lib/offlinePack.ts` through a pull request. It is public; the workflow refuses to sign with a key that doesn't match it.
4. Delete `pack-key.pem` from your computer once the secret is saved (a new key only means a new app release with the new public key).
5. *Actions → Offline product pack → Run workflow* (takes about 20–40 minutes). If a branch ruleset covers all branches, allow GitHub Actions to create and force-push `offline-pack`.

Never merge or base work on `offline-pack`; it holds only generated data. Check ignores it.

## Sending foods to Open Food Facts

Users sign in with their own Open Food Facts account (Profile → *Open Food Facts*); the app never ships a shared password. How it talks to Open Food Facts is described at the top of `src/lib/offWrite.ts`: sign-in is checked with `/cgi/auth.pl`, writes go to `/cgi/product_jqm2.pl` with the user's name and password on each request (plus `no_log=1`, so no extra login session is opened), photos to `/cgi/product_image_upload.pl`. Products without a barcode are created with `code=new`; Open Food Facts answers with its own code (starting with 2), which the app keeps as `Food.offCode`.

**Testing without touching the real database:** build or run with `EXPO_PUBLIC_OFF_STAGING=1` (for example `EXPO_PUBLIC_OFF_STAGING=1 npx expo start`). Sign-in, product lookups for edits and sends then go to Open Food Facts' test server `world.openfoodfacts.net`, and the screens show a "Test build" banner. Accounts there are separate: create one at <https://world.openfoodfacts.net/cgi/user.pl> (the site first asks for its basic-auth login, `off` / `off`). Release builds never set the variable.

**API usage form:** Open Food Facts asks every app that writes to the database to describe its use in their form <https://docs.google.com/forms/d/e/1FAIpQLSdIE3D8qvjC_zRJw1W8OmuHhsWJ_NSckiiniAHlfaVwUZCziQ/viewform>. Answers to give (adapt as needed):

- App name: Tellerwerk. Website: <https://github.com/uivox/Tellerwerk>; web version <https://tellerwerk-app.github.io/>. Contact: the maintainer's email.
- What it is: a free, open-source (MIT) calorie tracker for iPhone, Android and the web, without accounts or a server of its own.
- Reads: barcode lookups (`/api/v2/product`), search when the user submits (search-a-licious, fallback `/cgi/search.pl`, at most 8 a minute, pause after 429), Robotoff nutrient insights, and a weekly build from the data export for an offline pack.
- Writes: only when a user taps *Send to Open Food Facts* on one of their own foods and confirms a preview. Each user signs in with their own Open Food Facts account; the app sends `app_name=Tellerwerk`, `app_version` and a random per-install `app_uuid`. It only fills in name, brand and serving size when the product has none, sends nutrition values per 100 g/ml that differ from the product, and optionally one nutrition-table photo. Products without a barcode (bakery, market) are created with `code=new` and need the shop as brand.
- Expected volume: low; a handful of edits per active user per month.
- User-Agent: `Tellerwerk/1.0 (open-source calorie tracker; https://github.com/uivox/Tellerwerk)` from the apps; browsers don't allow setting it, so the web version is identified by `app_name`.

## Web version hosting

The web app keeps everything in its site's browser storage, and every GitHub Pages site of one account or organisation shares that storage (one origin). So the web version is published to the Pages site of a separate organisation that hosts nothing else, not to this repository's own Pages.

1. Create a GitHub organisation used only for this, e.g. `tellerwerk-app`. **Never host another Pages site in it**: any site there could read the app's data.
2. In it, create the public repository `tellerwerk-app.github.io` (it is served at `https://tellerwerk-app.github.io/`).
3. Create a deploy key on your computer: `ssh-keygen -t ed25519 -N "" -C "Tellerwerk web deploy" -f tellerwerk-web`. In the site repository: *Settings → Deploy keys → Add deploy key*, paste `tellerwerk-web.pub`, tick *Allow write access*.
4. In this repository:
   - *Settings → Environments → New environment* `web`; *Deployment branches and tags*: *Selected branches*, add `main`. Add the environment secret `WEB_DEPLOY_KEY` with the content of the private key file `tellerwerk-web`. Then delete both key files.
   - *Settings → Secrets and variables → Actions → Variables*: `WEB_SITE_REPO` = `tellerwerk-app/tellerwerk-app.github.io`, `WEB_SITE_URL` = `https://tellerwerk-app.github.io/`.
5. *Actions → Web app → Run workflow*. When it's done, in the site repository: *Settings → Pages → Deploy from a branch → main / (root)*, and tick *Enforce HTTPS*.

Each run replaces the site repository's content with one fresh commit. The key can only write to that one repository, and only workflows on `main` can use it.

Keep GitHub Pages turned off in this repository. The web version used to live at the Pages site of the account that first hosted this repository, which shares its storage with every other Pages site of that account; that site is unpublished. A browser that opened it may still show the old copy from its offline cache until the site's data is cleared in the browser settings.
