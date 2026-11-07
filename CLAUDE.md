# Tellerwerk: notes for working on the code

Tellerwerk (called OpenPlate until the rename in autumn 2026) is a calorie tracker built with Expo (SDK 58, React Native 0.88) that runs as an iPhone app, an Android app and a web app (PWA). README.md is for people using the app (features, install, platform differences, safety, privacy); docs/CONTRIBUTING.md has the dev setup, project layout, releases and web hosting; docs/DESIGN.md the palette, type and motion; docs/RECIPES.md the community recipe format; .github/SECURITY.md the security policy. Keep the README about using the app: anything only people working on the code need goes into docs/CONTRIBUTING.md.

## Priorities

Every change is checked against these three, and every pull request description has a short **priorities check** with one line per priority.

1. **Customizability.** Every new automatic behaviour, animation or suggestion has a setting, including off. Defaults stay calm.
2. **Transparency.** Every number the app works out can be opened to show how it was calculated and from which days. Nothing changes the user's data without them seeing it first.
3. **Security.** No accounts, no analytics or tracking libraries, no new servers unless the user starts the connection. Data only leaves the device when the user starts it. As few permissions as possible; a pull request that adds one says why.

## How to work on this project

- Every change goes on its own branch and into a pull request against `main`. Never push to `main` (it is protected anyway). Start each pull request from the current `main`; no stacked pull requests.
- Before calling anything done: `npm run check && npm test`. For changes the web app can see, also build it and click through it:
  `WEB_BASE_URL='' npm run build:web`, then `npm i --no-save playwright@1 && npx playwright install chromium && node scripts/web-smoke.mjs dist`.
- Check every feature on native and web: the same flow must work in the iPhone app, the Android app and the browser. Cover it in `scripts/web-smoke.mjs` where the browser can run it, and list what to check by hand on the phones for native-only code.
- When a pull request is ready: summarise what changed and give a short checklist of what to test by hand on the iPhone (and Android, for native-only code).

## Rules for changes

- **Texts:** every text the user sees lives in `src/lib/i18n.ts`, in English and German. `de` is typed as `Record<TKey, string>`, so a missing German text fails the type check. Use typographic quotes and apostrophes as the existing texts do (’ “ ” in English, „ “ in German).
- **Colours:** screens never hard-code colours; they read `useColors()` (theme tokens, see docs/DESIGN.md). The only exception is white text and frames drawn over the camera picture.
- **Logic:** anything that can be decided without React Native goes into a module in `src/lib/` without React Native imports, with tests in `tests/logic.test.ts` (node:test, run by `npm test`). Network code takes a `fetchImpl` parameter so tests can fake the server.
- **Outside data** (Open Food Facts, Robotoff, AI answers, label photos, backups) goes through the plausibility checks in `labelScan.ts` / `openFoodFacts.ts` and is shown to the user before it is saved.
- **Open Food Facts fair use:** search only when the user submits, at most 8 searches a minute, no second search endpoint after a 4xx answer. A 429 pauses searches and barcode lookups for at least a minute (`notePause`). A 404 for an unknown product is a normal answer ("not found"), never a failure and never a reason to pause.
- **Network:** every request goes through the global `fetch` (or a `fetchImpl` that defaults to it), which the connection log wraps at start. A connection that can't use fetch (a native download, an image view) calls `noteUrl` / `noteRemoteImage`; a test fails on `XMLHttpRequest`, WebSockets and new native downloads. A new server also needs a purpose in `connectionLog.ts` (`purposeFor`, `SERVERS`) and a line on the *Your data* screen.
- **No personal names:** code, tests, docs, commit messages and pull requests never name a person. Write neutrally (“the maintainer”, “decided in review”) and use placeholders in test data (`test-user`, `user@example.org`).
- **Route params:** pass on only the params a screen actually has (`meal`, `date`, `pick`, `barcode`), never empty strings; `flowParams` in `barcodeFlow.ts` does that.

### Web version

- **Same features everywhere.** iPhone, Android and the web app have the same features and behaviour. A platform may only lack a feature when the platform makes it impossible (no step counter in browsers, notifications only while the web app is open, no HealthKit with a free Apple ID). Every such gap is listed in README → *Differences between platforms* and explained in the app where the user meets it.
- A `*.web.ts(x)` file replaces its twin in the web build (`device`, `storage`, `secure`, `aiLogStore`, `BarcodeScanner`). Both files must export the same names with the same signatures; a test in `tests/logic.test.ts` compares the exported names. Platform facts the screens need (`stepSource`, `notifiesWhenClosed`, `notificationAccess`, `canPickFiles`, `canChangeAppIcon`, `appIconNote`, `lockAutoPrompt`) are exported from both `device` files instead of checking `Platform.OS` in screens.
- The Content Security Policy is written by `scripts/web-pwa.mjs`; a new server the app talks to has to be added there.
- `scripts/web-smoke.mjs` clicks through the built web app in CI. Extend it when a flow changes that the browser can run; fake outside servers with `page.route`.

## Expo SDK

- Upgrading: `npx expo install expo@latest`, then `npx expo install --fix` and `npx expo-doctor@latest`; read the release notes of every SDK in between (expo.dev/changelog). Besides the checks above, have CI compile the APK and the iPhone app once before merging: the type check and the web build don't cover native code.
- The iPhone app is built on the `macos-26` runner (`build.yml`): SDK 56+ needs Xcode 26.4 or newer.
- Release APKs are built without R8 (`enableMinifyInReleaseBuilds: false` in app.json). Turning it on can need keep rules for libraries that use reflection, so test every native feature on an APK built that way first.
- The custom tab bar (`TabBar.tsx`) takes expo-router's `BottomTabBarProps` (`emitter`, `navigateToTab`); keep it typed, so a router change shows up in the type check rather than as tabs that do nothing.
- expo-file-system: `File.write()` returns a promise; await it (or use `writeSync`).
- React Native's strict TypeScript API is on: no deep imports from `react-native/Libraries/*`.
- The web build is split per route (expo-router's async routes); `scripts/web-pwa.mjs` precaches every file in `dist/`, so the installed web app still works offline.

## Web start (keep it fast)

- `scripts/web-pwa.mjs` adds a start screen to `index.html` (the Sprout bowl and a loading bar, CSS only, still with Reduce Motion or Motion → Off), `splash.js` (the last theme's colours from `localStorage`, before the first paint) and preloads for the root/tab layouts, the diary and the fonts. `startScreenDone` (both `device` files) fades it out once the first `Screen` has mounted and the fonts are loaded (`src/components/startScreen.ts`); the browser renders behind it meanwhile (`rendersBehindStartScreen`).
- The service worker answers app starts from its cache straight away (never waits for the network); a new version installs in the background and is used from the next start. The previous version's cache is kept, so a page that started with it can still load its later chunks.
- Keep the start bundle small: import icons as `import Ionicons from '@expo/vector-icons/Ionicons'` (the package root pulls in every icon set and its font); load big data or rarely used code with a dynamic `import()` (the BLS database: `loadBls` in `bls.ts`, loaded on the add screen or 3 s after start; the @noble code in `backupCrypto.ts`). A test fails on a static import of `BLS_ROWS`.

## Where things are (barcodes)

- `app/scan.tsx`: the barcode scanner screen. Every scanned or typed code goes to `resolveBarcode`, and the screen shows one outcome:
  - product found (one of the user's own foods first) → `/food`;
  - Open Food Facts' photo AI (Robotoff) has values → `/custom-food` with them filled in, to check;
  - unknown product, or known without nutrition → choice: read nutrition label / type in / scan again;
  - invalid barcode (letters, wrong length, wrong check digit; nothing is sent) → "This isn't a valid barcode" with *Correct the number* (puts it into the type-in field) / scan again;
  - no connection or a server error → type in (works offline) / try again / scan again; too many lookups → type in / scan again.
- `src/components/BarcodeScanner.tsx` (expo-camera) and `BarcodeScanner.web.tsx` (getUserMedia + ZXing): the camera picture plus the same type-in field and camera-off view from `ScannerParts.tsx`. Same props on both: `onScan`, `paused`, `manualCode`, `onManualCodeChange`, `children`. A scanned UPC-E is written out as UPC-A (`scannedBarcode`).
- `app/add-food.tsx`: text in the search box that is only digits and as long as a barcode is looked up as a barcode, with the same outcomes shown inline.
- `src/lib/barcode.ts`: the pure check (EAN-8, UPC-E, UPC-A, EAN-13, GTIN-14, check digit, spaces ignored).
- `src/lib/barcodeFlow.ts`: `resolveBarcode` (own foods → Open Food Facts → Robotoff), `flowParams`.
- `src/lib/openFoodFacts.ts`: barcode lookup, search, Robotoff, fair-use limits, and `lookupFailure`, which sorts errors into invalid / rate limited / server / offline.

## Where things are (food search and history)

- `app/add-food.tsx`: while typing, one card per section (own foods and history, basics, restaurants, BLS, offline pack), each with *Show more* (+10, local only); each search asks for one item more than it shows, so the button only appears when there is another. Open Food Facts only on submit, then *Load more* fetches the next page (`searchOFFPage`, counts toward the 8 searches a minute like any search). The *Recent* tab is the full history.
- `src/lib/foodHistory.ts` (pure): `foodHistory` (every logged food from the diary entries, newest first, count and last day; own foods as they are now, others as last logged; quick add left out), `hideFromHistory` / `normalizeHidden` (`hiddenHistory` in the store, part of backups; a food logged again after being hidden comes back), `matchesFood`, `shownCount` / `sectionPage` / `appendPage`. `recentFoods` (40) stays for older code paths and backups.

## Where things are (meal reminders)

- `src/lib/reminders.ts` (pure): settings and `normalizeReminders`, suggested times (`suggestTime`: median first log of the day over 21 days, ≥ 5 days, same-day entries only), `planReminders` (time + delay, only empty meals, not inside a running fast or a coming fast of the fixed eating window, 14 days ahead), `reminderFigure` / `reminderText` (meal share for breakfast and lunch, optionally adjusted; what's left for dinner and snacks), `reminderDiff`.
- `src/lib/device.ts` / `device.web.ts`: `notificationAccess`, `askNotifications`, `openNotificationSettings`, `syncReminders` (expo-notifications with ids `meal-reminder:<date>:<meal>`; timers in the browser), `onReminderOpened`. Permission is only asked from the reminders switch, never by the sync.
- `src/components/MealReminderSync.tsx`: rendered once in `app/_layout.tsx`; reschedules after store changes (entries, reminders, profile, weights, fasting, language), when the app comes to the front and hourly; a tap opens `/add-food` with `meal` and `date`. The service worker (`scripts/web-pwa.mjs`) passes web taps on as a `openplate-reminder` message.
- `app/reminders.tsx` (Profile → *Meal reminders*) and the one-time card in the diary (`hintCardMeal`). Settings are part of backups.

## Where things are (fasting window and meal split)

- `src/lib/fasting.ts` (pure): the fixed eating window. `FastingSchedule` + `normalizeSchedule`, `scheduledFast` (a fast is named after the day whose window ends it; windows may cross midnight, times follow the wall clock across daylight saving), `syncSchedule` (finishes, starts and fills in scheduled fasts, at most 30 days back; never replaces a running fast; dedupes by `FastingSession.scheduledFor`), `fastCheck` (logging food to today during a running fast), `planFastNotices` (ids `fast-notice:close|done:<day>`), `upcomingFasts` (held-back meal reminders), `minutesInsideFast`.
- `src/components/FastingSync.tsx`: rendered once in `app/_layout.tsx`; runs `syncSchedule` on start, every minute, on app focus and after changes, and keeps the notices scheduled (`syncFastNotices` in both `device` files).
- `src/components/fastGuard.ts`: `confirmLogging(date, proceed)`. Every place that adds diary entries (`food.tsx`, `meal.tsx`, `add-food.tsx` quick log, `custom-food.tsx` quick add, `photo.tsx`, copy from yesterday in the diary) goes through it; a new one must too.
- `src/lib/mealSplit.ts` (pure): `Profile.mealSplit` (whole percent per meal, exactly 100; the default 25/35/30/10 when missing), presets, `mealTarget`, `mealMacroTargets` (`Profile.mealMacros`), editing helpers, `moveShares`. Used by the diary cards and the reminder figures. Editor: `app/meal-split.tsx` (Profile → *Meal split*).
- The window settings (`fastingSchedule` in the store) and the split are part of backups.

## Where things are (sending to Open Food Facts)

- `src/lib/offWrite.ts` (pure): `checkOffLogin` (`/cgi/auth.pl`), `snapshotFromOff` + `changesFor` (only what differs; name, brand and serving only when missing; empty values never sent), `checkForSending` (impossible values, no name, no shop without barcode), `codeFor` (barcode → `Food.offCode` → `new`), `writeFields`, `sendToOff` (`/cgi/product_jqm2.pl`; HTML/403 means a wrong login), `uploadOffPhoto`, `OffPending`. `OFF_SERVER` is the test server when built with `EXPO_PUBLIC_OFF_STAGING=1`.
- `src/lib/openFoodFacts.ts`: `fetchProductForEdit` (the product as it is now; counts for the fair-use pause).
- `src/lib/secure.ts` / `secure.web.ts`: `getOffLogin` / `setOffLogin` (Keychain / Keystore; localStorage on the web). Never in the store or a backup; `clearAllKeys` removes it. `src/components/offLogin.ts` shares it between screens.
- `app/off-account.tsx` (Profile → *Open Food Facts*: sign in/out, "Waiting to send"), `app/off-send.tsx` (preview, photo, send, save for later), the *Send to Open Food Facts* button on `app/food.tsx` for own foods. `offPending` in the store is per device and not in backups; nothing is ever sent without the user tapping *Send*.
- `appendPhoto` in both `device` files puts the photo into the upload form.
- `src/lib/offSuggest.ts` (pure): *Not on Open Food Facts yet*. `suggestions` (own foods with a barcode or `offCode`: not checked / not on OFF / differs, which fields; without any code: new product; same as OFF left out and counted; hidden listed apart), `compareWithOff` (through `changesFor`), `foodSignature` (a result only counts for the values it was checked with), `checkFoods` (one lookup a second through `fetchProductForEdit`; a 429 or its pause, no connection or a server error stop the run and keep what was found; a refused barcode is skipped), `normalizeChecks`. `offChecks` in the store is per device, not in backups; `offHidden` (*Don't suggest this*) is part of backups. A send from `off-send.tsx` notes the food as the same as OFF. Screen: `app/off-suggest.tsx`, from Profile → *Open Food Facts*; nothing is looked up until *Check with Open Food Facts*.

## Where things are (your data, app lock, encrypted backups)

- `src/lib/security.ts` (pure): `SecurityPrefs` (`lock`, `lockAfter`, `lockShowNumbers`, `webCredentialId`, `encryptBackups`, `logConnections`), `lockDue`, `hideNotificationNumbers`. `security` and `connections` in the store are per device: `importBackup` keeps the current ones and `pickBackup` never exports them; *Delete all data* resets both.
- `src/lib/connectionLog.ts` (pure): `purposeFor` (server + path → purpose; relative, data: and blob: addresses are never logged), `bodyHasPhoto`, `recordingFetch`, `noteUrl`, `noteRemoteImage`, `pruneLog` (7 days, at most 2000), `SERVERS`. Only host, purpose, photo yes/no, status: never paths, queries or bodies. `src/components/connectionLogSetup.ts` wraps the global fetch; it is the first import of `app/_layout.tsx`.
- App lock: `lockAvailability`, `enableLock`, `unlockApp`, `lockAutoPrompt` in both `device` files (expo-local-authentication on phones; a WebAuthn platform passkey in the browser, its id in `security.webCredentialId`, nothing sent anywhere). `src/components/AppLock.tsx` covers everything (rendered in the root layout): locked at start and after `lockAfter` in the background, a cover while in the background/app switcher, *Can't unlock? Delete all data* as the way out. Meal reminder texts drop their figures while it's on (`reminderText(…, hideNumbers)`). Settings: `app/app-lock.tsx`.
- `src/lib/backupCrypto.ts` (pure): `encryptBackup` / `decryptBackup` (scrypt N=2^16 r=8 p=1 → XChaCha20-Poly1305 from @noble, header as associated data, N accepted only from 2^14 to 2^20), `isEncryptedBackup`, `passwordProblem`, own UTF-8 and base64 (Hermes has no TextDecoder). Random bytes come from `randomBytes` in the `device` files. `app/backup-password.tsx` asks for the password (export: encrypt, then share from a second tap for Safari; import: `importBackup.ts` hands the file over in memory, never in route params).
- `src/lib/csvExport.ts` (pure): `buildCsvTables`, `csvCell` (formula-safe, `;` and decimal comma in German), `zipTables` (fflate, UTF-8 BOM). `shareExport` in both `device` files takes text or bytes and a MIME type.
- `app/your-data.tsx` (Profile → *Your data*), `app/connections.tsx`, the privacy step in `app/onboarding.tsx`, `src/components/deleteEverything.ts` (shared by Profile, Your data and the lock screen).
- Tests compile to CommonJS (`tests/tsconfig.json`: `module: commonjs`, `moduleResolution: node10`), so dynamic `import()`s become `require` calls; Node 22 can `require` the ESM-only @noble packages. Metro needs extensionless relative imports, which `nodenext` would refuse.

## Where things are (goal colours, streak animation, usual meal, goal check-in)

- `src/lib/streaks.ts` (pure): `judgeDay` (lose / maintain / gain bands → `hit`, `well_above`, `off`, `over`, `too_low`, `under`), `countsAsHit`, `judgementTone` / `todayOverTone` / `weightChangeTone` (good / calm / bad), `legendFor`, `streakCelebration`. Colours: `toneColor` in `theme.ts` (leaf / protein / coral; the calendar keeps water blue for "under"). Used by the calendar (`app/streak.tsx`), the diary's number and plate ring (`PlateRing` `overColor`), and the weight screen. Red only where the goal clearly wasn't kept; eating little while losing is never red.
- `src/components/StreakBadge.tsx`: the diary's streak counter and its animation (rolling number; flame burst and haptic tap on *Lively*, bigger on milestones). `Appearance.celebrate` (missing = on) is the switch, on the Appearance screen.
- `src/lib/usualMeal.ts` (pure): `usualMeal` (same food set on ≥ 3 of the last 14 days, median amounts). Shown in `MealBody` in `app/(tabs)/index.tsx` for today's empty meals, through `confirmLogging`; `LayoutPrefs.usualMeal` (missing = on) on the Layout screen.
- `src/lib/adaptiveGoal.ts` (pure): `checkIn` (28 days, ≥ 14 logged days of ≥ 800 kcal, ≥ 4 weigh-ins, least-squares weight trend, energy use = intake − trend × 7,700 / 7, the goal through `goalDetails` with that maintenance, ≥ 100 kcal to suggest; `step_calories` when step calories are added to the budget), `applySuggestion` (auto goal → `customMaintenanceKcal`; exact goal → `customKcal`), `undoPatch`, `dueCheckIn`, `normalizeGoalCheck`. `goalCheck` in the store (settings, left-out days, answered day, history) is part of backups. `src/components/goalCheck.ts` (hooks and actions), `GoalCheckCard.tsx` (diary), `app/goal-check.tsx` (calculation, days, history with undo, settings; also from Profile and Progress → Energy).

## Where things are (steps)

- `src/lib/device.ts`: `stepsForDay` reads the iPhone motion sensor (expo-sensors) or Health Connect on Android (`react-native-health-connect`) and returns the steps or a status. Health Connect's permission sheet is shown once; after that the button under the steps card opens Health Connect. `device.web.ts` always answers "not available".
- `src/lib/steps.ts`: the pure part: Health Connect's SDK status, the permission check, the day's range and total, and which text and button go with each status (open the settings, open Health Connect, get it from the Play Store).
- `src/lib/hooks.ts`: `useSteps` (reloads on focus, when the app comes back to the front and every minute for today), `canReadSteps`.
- `app.json`: `android.permission.health.READ_STEPS`, the `react-native-health-connect` config plugin (adds the permission-rationale activity Health Connect requires) and `minSdkVersion` 26. `check.yml` greps the generated manifest for them.

## Where things are (offline product pack)

- `src/lib/offlinePack.ts` (pure): row format, `packRow` (used by the builder, so pack and app share one set of checks), `foodFromPackLine`, `PackIndex` (barcode lookup, search), `readEnvelope` (Ed25519 signature + manifest checks), `installPack`, `PACK_PUBLIC_KEY`. `src/lib/ed25519.ts`: verification and SHA-512, tested against Node.
- `src/lib/packStore.ts` / `packStore.web.ts`: download, hash (native `File.digest`, `crypto.subtle` on the web) and keep the files; never in the zustand store or backups. `src/lib/packRuntime.ts`: the loaded pack (`usePack`, `currentPack`), read 1.5 s after start.
- Two packs (`PackId` in `src/lib/packIds.ts`: `german`, `all`): `germanOnlyReason` / `hasGermanBarcode` / `hasGermanStore` / `hasGermanBrand` / `madeInGermany` (the `german` rules, used by the builder; the CSV export has no language field, so names aren't used), `readCatalog` (format 2 `de/packs.json` listing both, or a format-1 manifest as `all` alone), `fetchRemoteCatalog` (packs.json, falling back to manifest.json on 404), `remotePack` (stores `{ pack, envelope }`; `openInstalled` still opens the old bare envelope), `packChoice` (the user's choice; before one, the installed pack's kind, else `german`). `packChoice` in the store is part of backups. The builder keeps writing `de/manifest.json` (the `all` pack, format 1) for older app versions.
- Uses: `resolveBarcode(…, offline)` asks the pack after the user's own foods and before Open Food Facts; `add-food.tsx` searches it while typing (250 ms pause); `app/offline-data.tsx` downloads, updates, deletes. *Delete all data* deletes it too.
- `.github/workflows/offline-pack.yml` + `scripts/build-offline-pack.mjs`: weekly build from the Open Food Facts export, signed, force-pushed to the `offline-pack` branch. *Run workflow* with *dry run* (any branch, no key) builds both packs and only writes the report (summary and `pack-report` artifact). Setup and key handling: docs/CONTRIBUTING.md → *Offline product pack*. Never put the private key anywhere but the `offline-pack` environment secret.

## Where things are (restaurant items)

- `scripts/restaurants/raw/*.txt`: one table per chain, copied from the chain's own published nutrition information for Germany (source and date in each header). `scripts/build-restaurants.mjs` turns them into `src/lib/restaurantData.ts` (generated; per 100 g / ml plus the chain's serving) and leaves out rows that fail the `checkPer100` rules.
- `src/lib/restaurants.ts` (pure): `RESTAURANT_CHAINS` (name, source, link, date), `loadRestaurants` (dynamic import, like the BLS), `searchRestaurants` (name words or the chain's name), `restaurantFood` (id `rest:<chain>:<slug>`, source `restaurant`, brand = chain), `chainOfFood`.
- `app/add-food.tsx` shows them after the built-in basics while typing (`LayoutPrefs.restaurantFoods`, missing = on, switch on the Layout screen); `app/food.tsx` names the chain's source and date (`restaurant_source`).

## Where things are (AI answer log)

- `src/lib/aiLog.ts`: the pure part: record types, `PROMPT_VERSION` (bump it with every change to `buildMealPrompt` or `buildLabelPrompt`), `recordingCall` (wraps the provider call to record every attempt), the size limit and the export format. Tests in `tests/logic.test.ts`.
- `src/lib/aiLogStore.ts` (a folder per record in the documents directory) and `aiLogStore.web.ts` (its own IndexedDB database): never part of the store or a backup.
- `src/components/aiLogging.ts` (writes never block or break logging food; export is prepare, then share from a tap for Safari), `AIRatingCard.tsx`; used by `app/photo.tsx`, `app/label.tsx` → `app/custom-food.tsx` (the record travels in the food draft) and `app/ai-settings.tsx`. Off by default (`ai.logAnswers`), per device. *Delete all data* deletes it too.
- `scripts/ai-log-unpack.mjs` and `.claude/skills/ai-eval/SKILL.md`: the evaluation, with data in the git-ignored `eval/`.

## Where things are (the move from OpenPlate)

- `src/lib/appIdentity.ts` (pure): the name, repo and web addresses, both app ids, `BACKUP_FORMAT_ID` (stays 'OpenPlate' for good: OpenPlate backups must import), `isOldApp`. `oldAppCopy` in both `device` files: the old app id (native) or the old host (web).
- `src/components/MoveNotice.tsx`: shown at the top of the diary only in the old copy: export, get Tellerwerk, turn off reminders here (`cancelAllNotifications` in both `device` files).
- `app.config.js` `APP_VARIANT=openplate` builds the old copy; `build.yml` builds both, `make-source.mjs` lists both, `web.yml` publishes to both sites. docs/CONTRIBUTING.md → *The move from OpenPlate* says what to remove afterwards.
- Storage keys and database names still start with `openplate`: they are invisible, and the old copy must find OpenPlate's data under them. Don't rename them. A test fails if “OpenPlate” appears in the code or docs outside its allow list.
