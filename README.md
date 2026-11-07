<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/readme-icon-dark.png">
  <img src="docs/images/readme-icon-light.png" width="120" height="120" alt="">
</picture>

# Tellerwerk

**A free, open-source calorie tracker for iPhone, Android and the browser.**<br>
No account. Your data stays on your device.

[![Latest release](https://img.shields.io/github/v/release/uivox/Tellerwerk?label=release&color=9C2F62)](https://github.com/uivox/Tellerwerk/releases/latest)
[![Check](https://github.com/uivox/Tellerwerk/actions/workflows/check.yml/badge.svg)](https://github.com/uivox/Tellerwerk/actions/workflows/check.yml)
[![MIT licence](https://img.shields.io/badge/licence-MIT-5E9A3B)](LICENSE)

[**▶ Try it in your browser**](https://tellerwerk-app.github.io/) &nbsp;·&nbsp;
[**Android**](#android) &nbsp;·&nbsp;
[**iPhone**](#iphone-or-any-phone-in-the-browser-no-install-tools-needed)

<sub>English and German · light and dark mode · <i>formerly OpenPlate</i> (<a href="#moving-from-openplate">moving from OpenPlate</a>)</sub>

</div>

---

## Why Tellerwerk

- 🔒 **No account, no server, no tracking.** Everything is stored on your phone or in your browser and only leaves it when you start it.
- 📴 **Works offline.** The German nutrient database (BLS), fast-food menus and, if you like, the products sold in Germany are on your device.
- 🔎 **Finds German food.** Barcode scanner, millions of products from Open Food Facts, supermarket brands first.
- 📸 **AI photo logging, if you want it,** with your own key (Gemini has a free tier) or a model on your own PC.
- ⏱️ **More than counting:** intermittent fasting with a fixed eating window, meal reminders, recipes and statistics.
- 🔍 **Nothing is hidden.** Every number can show how it was calculated, and a connection log shows every server the app talked to.

## Features

### Logging food

- **Food diary** for breakfast, lunch, dinner and snacks, with a calorie ring, macro bars and per-meal targets.
- **Food search** in about 100 basics, the **German nutrient database BLS 4.0**, about 660 **fast-food** items and millions of **Open Food Facts** products.
- **Barcode scanner** on the phone and in the browser; you can also type the number in.
- **AI photo logging** with your own AI: Claude, OpenAI, Google Gemini, or Ollama / LM Studio on your PC.
- **Quick add, your own foods, your full food history, saved meals** and *copy from yesterday*.
- **Recipes:** your own and community recipes, scaled to any number of servings.

<details>
<summary><b>More about logging food</b></summary>

- **Meal split:** Profile → *Meal split* sets how your calories are shared between meals (presets like 20/40/40, or your own values in percent or kcal; a meal can get 0 %), and can show protein, carbs and fat targets per meal too.
- **Food search:** the BLS 4.0 has 7,140 foods and dishes in German and English and works offline. The fast-food items (McDonald’s, Burger King, KFC, Subway, Five Guys, NORDSEE, Starbucks, Domino’s) use each chain’s own published values, work offline and can be switched off under Profile → Layout. Products sold in Germany come first; start with a supermarket ("Lidl Skyr", "Aldi Joghurt") to see its products and house brands first. Every part of the results has *Show more*; *Load more* fetches the next page from Open Food Facts, only when you tap it.
- **Food history:** the *Recent* tab lists every food you’ve ever logged, newest first, with how often and when last. A filter field appears once the list is long; long-press removes a food from the list, never from the diary. The search looks through all of it too.
- **Barcode scanner** (EAN-13, EAN-8, UPC-A, UPC-E, GTIN-14) with Open Food Facts lookup. You can type the number in the scanner (also without camera access) or straight into the food search. The check digit is checked first, so a mistyped or misread number is reported as *not a valid barcode* and can be corrected, instead of being looked up. Without a connection the scanner says so and offers to type the values in, which works offline. When a product is missing or has no nutrition there:
  - values that Open Food Facts' photo AI ([Robotoff](https://github.com/openfoodfacts/robotoff)) already read off a package photo are offered as a suggestion, no account or key needed;
  - **photograph the nutrition table** and your own AI copies the printed values (it doesn't estimate);
  - or type the values in. Every value is checked for plausibility and shown next to the photo before you save it.
- **AI photo logging:** primary + fallback provider; the fallback is asked when the first fails or is unsure, and the more confident answer wins. Every item and portion can be corrected before saving. Set-up: [Set up the AI photo feature](#set-up-the-ai-photo-feature).
- **Your own foods** can be edited later; saved meals with them pick up the change, while the diary keeps what you logged. Profile → *My foods & meals* lists your foods, meals and recipes in one place.
- **My meals:** save the foods you always eat together (e.g. your breakfast) and log them with one tap, at any portion size. Build them from search, recent foods and the barcode scanner, or save a meal straight from the diary.
- **Your usual meal:** when today's breakfast (or any meal) is still empty and you logged the same foods for it on at least 3 of the last 14 days, one tap adds them with your usual amounts. The "i" next to it shows which days it's based on; Layout → *Suggest your usual meals* turns it off.
- **Diary:** swipe sideways to the previous or next day (also with the mouse in the web version), plan days ahead, and fold meals down to one line.
- **Recipes tab:** your own recipes (photo, servings, steps, ingredients from the food search; nutrition calculated from the ingredients) and community recipes added through pull requests and marked as tested once someone else has cooked them ([how to add one](docs/RECIPES.md)). Log a serving with one tap.
- **Send your foods to Open Food Facts** (Profile → *Open Food Facts*): sign in with your own Open Food Facts account, then *Send to Open Food Facts* on any of your own foods. You see exactly what would be sent first: for a product Open Food Facts already has, only the values that differ (old → new; its name and brand are never overwritten), plus an optional photo of the nutrition table. Bakery or market items without a barcode work too; add the shop as the brand and Open Food Facts gives them their own code. Without a connection you can keep a send for later and send it yourself when you're back online.
- **Not on Open Food Facts yet** (Profile → *Open Food Facts*): a list of your own foods that others can't find there yet. *Check with Open Food Facts* looks up their barcodes (only when you tap it, one a second) and shows which are missing there and which values differ. Open one to send it through the same preview; *Don't suggest this* (the eye) hides home-made foods, and you can undo it on the same screen.

</details>

### Goals and progress

- **Personal plan** from a short onboarding, or set every number yourself.
- **Weekly goal check-in** that suggests a goal from what you ate and how your weight moved. Nothing changes unless you say so.
- **Streak and calendar** whose colours follow your goal (losing, keeping or gaining weight).
- **Statistics** for energy, macros, water, weight, steps, fasting and other nutrients.
- **Water tracker, weight log** and **steps** (iPhone motion sensor or Health Connect on Android).

<details>
<summary><b>More about goals and progress</b></summary>

- **Personal plan:** Mifflin-St Jeor + activity level + weekly pace. Or set it exactly: your own daily kcal, any weekly pace (e.g. +0.4 kg), your own activity factor or maintenance calories, macros as presets, custom percentages or grams.
- **Weekly goal check-in** (Profile → *Weekly goal check-in*, on Sundays by default): from the last 4 weeks, Tellerwerk estimates your real energy use and suggests a goal from it. Nothing changes unless you tap *Use new goal*; *Show calculation* shows every step and the days used (leave out any day, e.g. a holiday you didn't log fully), and every change can be undone. The usual safety rules always apply (no deficit under 18 or at a BMI of 18.5 or below, never below the daily minimum).
- **Streak colours:** when **losing**, up to 10 % under and 5 % over counts as hit and clearly over is red (eating far less is never a hit, but never red either); when **keeping** your weight, within 5 % is a hit, 5–15 % off is shown calmly and more than 15 % above or below in red; when **gaining**, every day from 5 % under the goal upwards counts, more than 20 % over in a calm colour. The diary's number, the plate's ring and the weight change follow the same rules. The first entry of the day makes the streak counter roll up (with a little flame burst on *Lively*, bigger on milestones); Appearance → *Celebrate the first entry of the day* turns it off.
- **Statistics** (Progress tab): each by day, week or month over 7 days, 30 days, 3 months, a year or your own dates. Averages only count days you logged and leave out today until it's over; macros are shown as shares of the energy. Tap a day to open it in the diary; each screen explains how its numbers are calculated.
- **Water** with tappable glasses; **weight** with a chart and progress towards the target.
- **Steps** can be added to the calorie budget (not in the web version, see [Differences between platforms](#differences-between-platforms)).

</details>

### Fasting and reminders

- **Intermittent fasting:** 12:12 to 23:1 timers, 5:2 and 6:1, and a **fixed eating window** that starts and ends your fasts by itself.
- **Meal reminders** if a meal is still empty a while after its time. Off until you switch them on; everything runs on your device.

<details>
<summary><b>More about fasting and reminders</b></summary>

- **Fasting plans:** 12:12, 14:10, 16:8, 18:6, 20:4, 23:1 timers with phases, adjustable start time and a notification when you reach the goal; 5:2 and 6:1 with chosen fasting days that lower the calorie goal automatically.
- **Fixed eating window** (daily plans, e.g. 16:8 with eating from 12:00 to 20:00): your fasts start and end by themselves, also while the app is closed; for today only you can end early, extend or skip. Logging food during a fast asks first (*Log anyway* or *End fast & log*; strict mode only allows the latter), an optional notice tells you before the window closes, and meal reminders inside the fast are held back.
- **Meal reminders** (Profile → *Meal reminders*): if breakfast, lunch, dinner or snacks are still empty a while after their time (15, 30, 60 or 90 minutes, you choose), you get a notification. Logging the meal cancels it, a running fast holds it back, and a tap opens that meal's add screen. Breakfast and lunch reminders show the meal's planned calories, dinner and snacks what's left of the day. Set each time exactly, or take the app's suggestion from when you usually log that meal. No server is involved.

</details>

### Your data and your look

- **Your data** screen: what is stored, every server the app can talk to, and a connection log of the last 7 days.
- **App lock** (Face ID, fingerprint, PIN or passkey) and **encrypted backups**.
- **Export and import** as a file, and a **CSV export** for spreadsheets.
- **Offline product data:** the products sold in Germany, downloaded once, so barcodes and search work without a connection.
- **Make it yours:** seven themes in light and dark, your own colours, animation levels, tab order and the app icon.
- **Web version** that installs on the home screen and works offline.

<details>
<summary><b>More about your data and your look</b></summary>

- **Your data** (Profile → *Your data*): the **connection log** says when, which server, why, and whether a photo went along; never what was sent. Also an optional **app lock** (a passkey in the browser), **encrypted backups** with a password you choose each time, a **CSV export** (one zip with a table each for diary, weights, water, fasts and your own foods, for any period) and *Delete all data*.
- **Export and import** all data as a JSON file, on the phone and in the web version (moving between them works too). Your data only lives on your device, so the diary reminds you to save a copy two weeks after you start and then once a month ("Later" hides it for a week).
- **Offline product data** (Profile → *Offline product data*): choose *German products only* (a German barcode, shop or own brand, made in Germany, or often scanned; the default for a first download) or *All products sold in Germany*. *How this is chosen* lists the rules and how many products each one removed. The size is shown before you download; switching keeps the old data until the new one is downloaded and checked. Updated weekly; the app only downloads when you tap *Download* or *Update*, and every download is checked against Tellerwerk's signature before it is used.
- **Make it yours:** seven themes in light and dark (including a glowing Neon one), your own button and macro colours, three animation levels, tab order and visibility, add button left/centre/right, diary section order, and the app icon on the home screen in four faces and six colours (in the apps).
- **Web version:** keeps everything in the browser on your device.

</details>

---

## Install on your phone

New versions of the apps are published under **[Releases](https://github.com/uivox/Tellerwerk/releases/latest)**; the web version updates itself.

| | How | Effort |
|---|---|---|
| **Any phone, in the browser** | open <https://tellerwerk-app.github.io/> and add it to the home screen | 1 minute |
| **Android** | download **Tellerwerk.apk** from the latest release | 2 minutes |
| **iPhone app** | install through SideStore with a free Apple ID | one-time setup with a PC |

### iPhone or any phone, in the browser (no install tools needed)

The web version runs in Safari and can be added to the home screen, where it opens full-screen like an app and works offline.

1. On the iPhone, open **<https://tellerwerk-app.github.io/>** in **Safari**.
2. Tap the **Share** button → **Add to Home Screen** → **Add**.
3. Open Tellerwerk from the home screen icon.

> [!NOTE]
> Your data is stored only in that home-screen app on this phone (IndexedDB). It does not sync and is separate from Safari tabs and from the SideStore app. Use *Profile → Export data* now and then as a backup; *Import data* restores an export, including one from the native app.

The web version has the same features as the apps, apart from the few things browsers can't do; see [Differences between platforms](#differences-between-platforms).

### Android

1. On the phone (Android 8 or newer), open the [latest release](https://github.com/uivox/Tellerwerk/releases/latest) and download **Tellerwerk.apk**.
2. Open it and allow *Install unknown apps* for your browser when asked.
3. Updates: download the newer APK and install it over the old one. Your data stays.

### iPhone (free, with SideStore)

Apple only lets apps signed with a free Apple ID run for 7 days. **SideStore** renews the signature on the phone itself, so after a one-time setup with your PC you don't need to do anything.

<details>
<summary><b>One-time setup on Windows</b></summary>

1. Install **iTunes** from apple.com (the download from apple.com, not the Microsoft Store version) so Windows can talk to the iPhone.
2. Install **iloader** (the `.msi` from <https://github.com/nab138/iloader/releases>).
3. On the iPhone, install **LocalDevVPN** from the App Store, open it and tap *Connect*.
4. Plug the iPhone into the PC, tap *Trust*. In iloader, sign in with your normal Apple ID and click **SideStore (Stable)**.
5. On the iPhone: *Settings → General → VPN & Device Management* → trust your Apple ID. Then *Settings → Privacy & Security → Developer Mode* → on (the phone restarts).
6. Open SideStore and sign in with the same Apple ID.

</details>

**Add Tellerwerk**

1. In SideStore → *Sources* → **+**, add:
   `https://github.com/uivox/Tellerwerk/releases/latest/download/source.json`
2. Tap **Get** next to Tellerwerk.
3. New versions show up in SideStore with an **Update** button. Your data stays.

Keep LocalDevVPN installed; SideStore uses it to renew apps in the background. If Tellerwerk ever stops opening, open SideStore and tap *Refresh All*.
Limits set by Apple for free Apple IDs: 3 sideloaded apps at once (SideStore counts as one) and 10 installs per week.

## Moving from OpenPlate

OpenPlate is now called Tellerwerk. Tellerwerk is a new app (new app id, new web address), so your data moves with a backup file:

1. In OpenPlate: Profile → *Export data*. Keep the file (and its password, if you encrypt backups).
2. Install Tellerwerk (above), or open the web version at <https://tellerwerk-app.github.io/>.
3. In Tellerwerk: Profile → *Import data* (or *Coming from OpenPlate?* on the first screen) and pick the file.
4. Set up again what backups never contain: your AI key, Open Food Facts login, app lock and offline product data. Reminders need notifications allowed for Tellerwerk.
5. Delete OpenPlate.

The last OpenPlate version (on the releases page and in the SideStore source) and the web version at the old address `openplate-app.github.io` show these steps, with buttons to export and to turn off OpenPlate’s reminders, so you don’t get every reminder twice while both are installed.

## Differences between platforms

The iPhone app, the Android app and the web version have the same features. Where one lacks something, it is because the platform doesn't allow it, and the app says so where it matters. Everything else works the same everywhere: barcode scanner (camera or typed number), offline product data, label and meal photos, export and import (up to 100 MB), recipes, fasting plans, themes and layout, swiping between days.

<details>
<summary><b>The table</b></summary>

| | iPhone | Android | Web version |
|---|---|---|---|
| Steps | from the motion sensor (*Motion & Fitness* must be allowed); the iPhone keeps about 7 days | from Health Connect (reading steps must be allowed; built into Android 14+, from the Play Store on Android 9–13). Shows the steps that apps or the phone write there (e.g. Google Fit, Samsung Health, Fitbit), the same total as the Health Connect app. Older days: back to 30 days before the permission was first given | not available: browsers can't read the step counter |
| Fasting notifications (fast done, eating window closes soon) | also when the app is closed | also when the app is closed | only while the app is open (browsers can't schedule notifications without a push server; on the iPhone it needs the home-screen app, iOS 16.4+). The eating window's fasts themselves still start and end on time and are filled in when you open the app again |
| Meal reminders | also when the app is closed; the next 14 days are scheduled and topped up whenever you open the app | also when the app is closed (may come a few minutes late, as the app doesn't ask for exact alarms) | only while the app is open, for the same reason; in Safari on the iPhone only in the home-screen app (the option is greyed out in a normal tab) |
| API keys and Open Food Facts login | iOS Keychain | Android Keystore | this browser's storage for this site |
| Local AI server (Ollama / LM Studio) | `http` in your own network | `http` in your own network | must be `https`: browsers block plain `http` from an `https` page |
| Camera permission after saying no | *Allow camera* opens the settings | *Allow camera* opens the settings | only in the browser's site settings; *Try camera again* asks once more |
| Haptic feedback | yes | yes | no (Safari has no vibration support) |
| App icon face and colour | yes; iOS confirms the switch with a short message | yes; on some phones the app closes once while switching | not available: browsers can't change an installed web app's icon |
| App lock | Face ID or the device passcode | fingerprint, face or the device PIN | a passkey on the device (Face ID, fingerprint, Windows Hello); greyed out where the browser has none |
| Apple Health / Health Connect | not available: HealthKit needs a paid Apple developer account, SideStore installs with a free Apple ID | reads steps only; nothing is written back (see *Not included yet*) | not available |

</details>

## Set up the AI photo feature

In the app: **Profile → AI settings**. Choose a primary and (optionally) a fallback AI.

| Provider | Cost | What you need |
|---|---|---|
| Google Gemini | free tier | Key from <https://aistudio.google.com/apikey>. On the free tier Google may use requests to improve its products. |
| Ollama (your PC) | free | See below |
| LM Studio (your PC) | free | Load a vision model, Developer tab → start server, enable *Serve on Local Network*. Address `http://<PC-IP>:1234/v1` |
| Claude | pay per use | Key from <https://console.anthropic.com> |
| OpenAI | pay per use | Key from <https://platform.openai.com/api-keys> |

Model names are editable in the app; defaults are `gemini-3.8-flash`, `claude-sonnet-5-5`, `gpt-6-luna`, `qwen2.5vl:7b`. Providers rename models from time to time, so if a test fails with "model not found", check the provider's model list.

<details>
<summary><b>Ollama on Windows (free, private)</b></summary>

1. Install from <https://ollama.com/download>.
2. Download a vision model: `ollama pull qwen2.5vl:7b` (about 6 GB; smaller alternative: `gemma3:4b`).
3. Let the iPhone reach it: Windows Settings → *Edit environment variables for your account* → new variable `OLLAMA_HOST` = `0.0.0.0` → quit Ollama from the tray and start it again. Allow it through the firewall on private networks.
4. Find your PC's address with `ipconfig` (IPv4 address, e.g. `192.168.178.20`).
5. In the app, set *Server address* to `http://192.168.178.20:11434/v1` and tap **Test connection**. Plain `http` is only accepted for addresses in your own network (192.168.x.x, 10.x.x.x, *.local, Tailscale); anything else needs `https`, so photos and keys never travel unencrypted over the internet.

A local 7B model on a normal PC takes roughly 10–60 seconds per photo and is less accurate than the cloud models; using it as primary with Gemini as fallback works well.

</details>

The same AI also reads nutrition labels (**Scan → Read nutrition label**, or **Complete from the label** on a product with missing values). There it only copies printed numbers; the app checks them (kJ vs kcal, calories vs macros, sugar vs carbs, nothing above 100 g per 100 g) and you compare them with the photo before saving.

API keys are stored in the phone's secure storage (expo-secure-store: iOS Keychain, Android Keystore) and only ever sent to the provider they belong to. Backups never contain keys, and importing a backup never changes AI server addresses or providers. The same goes for your Open Food Facts login: it stays in that storage, is only sent to Open Food Facts, and is never in a backup.

**AI answer log (optional, off by default):** in *AI settings → AI answer log* you can let the app keep every AI answer, the photo it saw and what you saved, so you can check later whether the AI or its instructions can do better. Meal photos and label readings get an optional *Rate this answer* card (quick tags, a note, and “I weighed it” for meals). The log stays on your device, is never part of a backup, keeps at most 300 answers or 100 MB (the oldest go first) and only leaves the device when you export it. *Delete log* removes it.

## Safety

Tellerwerk counts calories, which can do harm to people who are still growing or who struggle with eating. So:

- Weight-loss goals and fasting plans are for adults (18+). Under 18 the goal is what keeps your weight.
- No weight loss is planned at a BMI of 18.5 or below, and targets below a BMI of 18.5 can't be set.
- Automatic goals never go below 1,200 kcal (women) / 1,500 kcal (men), or below maintenance when that is lower. Adults can type a lower exact goal, down to 800 kcal, and get a clear warning.
- Streaks never reward eating far less than the goal.
- Nutrition from outside (Open Food Facts, its photo AI, your label photos, backups) goes through the same plausibility checks; values from photos are never logged without you checking them first.
- Backup files are checked row by row: implausible values, remote images (which could track who opens the app) and anything the app wouldn't create itself are left out.

## Privacy and security

- **No Tellerwerk accounts, no Tellerwerk server, no analytics.** Diary, weights, recipes and settings are stored only on your device (app storage; IndexedDB in the browser) and only leave it when you export them. The same goes for the optional AI answer log (with its meal and label photos), which is kept apart from backups.
- **See it for yourself:** Profile → *Your data* lists what is stored and every server below, with the last connection to each. The connection log keeps the last 7 days of connections (time, server, purpose, whether a photo went along, whether it worked; never search words, barcodes or contents). It stays on your device, is never part of a backup and can be switched off, which deletes it.
- **What goes over the network:** food searches and barcodes go to Open Food Facts (and its Robotoff service); product pictures are loaded from Open Food Facts' image servers when shown; meal and label photos go only to the AI provider you set up, with your own key. When you send a food to Open Food Facts, its values (and the photo you chose) go there with your Open Food Facts login and are published under your name there. When you download the offline product data, GitHub (which hosts it, and the web version) sees that request; searches in that data and barcodes found in it stay on your device. These services and GitHub see your IP address. Nothing is sent to the Tellerwerk project.
- **Web version:** served from a site of its own, so no other website shares its storage. A Content Security Policy only lets the app's own code run there, and no referrer is sent to other servers. API keys and the Open Food Facts login are stored in that site's browser storage on your device.
- **Backups are the only copy outside your device.** Deleting the app (or, for the web version, its home-screen icon) deletes the data, so the diary reminds you to save a copy now and then. On the iPhone, the home-screen web app has its own storage, separate from Safari.
- **App lock** (off by default): asks for Face ID, a fingerprint or the device PIN when the app opens and after the time you choose in the background (immediately, 1, 5 or 15 minutes). While it's on, the app switcher shows a cover instead of your diary and meal reminders leave out calories (unless you choose to see them). In the browser it uses a passkey on your device; nothing goes to a server. The lock keeps out someone holding your unlocked phone; the data on the device is protected by the device's own encryption.
- **Encrypted backups** (off by default, suggested when you turn on the lock): each backup asks for a password, which is never saved. The file is encrypted on your device (scrypt and XChaCha20-Poly1305, from the audited [@noble](https://paulmillr.com/noble/) libraries); without the password nobody can open it, including Tellerwerk. Older backups without a password still import.
- **CSV export:** text that a spreadsheet would run as a formula (starting with `=`, `+`, `-` or `@`, e.g. a product name from Open Food Facts) gets a leading `'`, so opening the file can't run anything.
- **The project itself:** `main` only changes through pull requests that pass the checks; GitHub scans the code (CodeQL), secrets and dependencies (Dependabot). Any dependency alerts still open are in build tools that never reach your device and have no fixed version yet.
- Found a security problem? Please report it privately, see [SECURITY.md](.github/SECURITY.md).

## Not included yet

On the list for later:

- **Apple Health / Health Connect sync.** Steps already come from the iPhone's motion sensor and from Health Connect on Android. Writing meals, water and weight to Health Connect is not done yet.
- Meal plans, watch apps, cloud sync / accounts.
- App Store / Play Store listings.

## How this app is built

Tellerwerk is written with Claude, Anthropic's AI, as a coding assistant. Every change goes through a pull request that passes the type check, the tests and a click-through of the web app, is tested by hand on the phones, and is checked against three priorities: you can change or turn off every automatic behaviour, every number shows how it was worked out, and your data only leaves your device when you start it.

## Contributing

Recipes, fixes and ideas are welcome. Setting up the code, the project layout and how releases are built: [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).

## Credits and licence

- Code: MIT, see `LICENSE`.
- Product data: © Open Food Facts contributors, [Open Database License](https://opendatacommons.org/licenses/odbl/1-0/). The app shows this attribution wherever their data appears.
- Built-in basic foods: approximate averages compiled from public references such as USDA FoodData Central.
- Restaurant items: copied from each chain’s own published nutrition information for Germany (product pages and nutrition PDFs, read in November 2026; the food screen names the source and date). The chains publish these values for their customers; Tellerwerk isn’t affiliated with any of them, and the names are their trademarks. Domino’s and Pizza Hut publish no nutrition values for their pizzas, so only Domino’s pre-packed items are included.
- Bundeslebensmittelschlüssel (BLS) 4.0: Max Rubner-Institut, Karlsruhe, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), <https://doi.org/10.25826/Data20251217-134202-0>. Bundled with the app (energy, macros, fibre, sugar, saturated fat, salt), from the download at <https://blsdb.de>.

Tellerwerk is an independent project and is not affiliated with any commercial nutrition app. It is not medical advice.
