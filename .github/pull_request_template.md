## What changed

<!-- What a user notices, in plain words. Link the issue if there is one. -->

## Priorities check

<!-- One line each; see CLAUDE.md → Priorities. -->

- **Customizability:** <!-- new automatic behaviour, animation or suggestion has a setting, including off; defaults stay calm -->
- **Transparency:** <!-- any number the app works out can be opened to show how; nothing changes the user's data without them seeing it -->
- **Security:** <!-- no accounts, analytics or new servers; data only leaves the device when the user starts it; new permissions say why -->

## Checklist

- [ ] `npm run check && npm test` pass
- [ ] Every new text is in `src/lib/i18n.ts`, in English and German
- [ ] Colours come from `useColors()`; logic that doesn't need React Native is in `src/lib/` with tests
- [ ] Works the same on iPhone, Android and the web, or the gap is in README → *Differences between platforms*
- [ ] `scripts/web-smoke.mjs` covers the flow, where the browser can run it
- [ ] A line in `CHANGELOG.md` under *Unreleased*, for changes users notice

## Test by hand

<!-- What to try on the iPhone (and Android, for native code). -->

- [ ] iPhone:
- [ ] Android:
