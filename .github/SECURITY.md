# Security policy

Tellerwerk has no server and no accounts of its own: your diary, weights, recipes, settings, AI keys and (if you sign in) your Open Food Facts login stay on your device. The things worth protecting are that data, the API keys and the Open Food Facts password you enter, and the code that reaches you through the apps and the web version.

## Reporting a problem

Please report security problems **privately**, not in a public issue:

- On GitHub: [Security → Report a vulnerability](https://github.com/uivox/Tellerwerk/security/advisories/new) (private vulnerability reporting).

Useful to include: what you found, how to reproduce it, which version (app release number or the web version's date) and platform. You'll get an answer as soon as possible; this is a one-person project, so please allow a few days.

## In scope

- The apps and the web version at <https://tellerwerk-app.github.io/>.
- Anything that could expose data stored by the app, send it somewhere it shouldn't go, or leak an API key or the Open Food Facts password (which must only ever go to Open Food Facts): for example script injection in the web version, a crafted backup file or product data that does more than add food, or a way around the checks on AI server addresses.
- The build and release workflows in this repository.

## Out of scope

- Someone with your unlocked phone or computer opening the app while the app lock is off (it is off by default; Profile → *App lock*).
- What Open Food Facts or your chosen AI provider do with requests you send them; see their own policies.
- Dependency alerts for build tools that never run on your device. Known open ones are tracked in the repository's Security tab.

## Supported versions

Only the latest release and the current web version get fixes. Updating is free: the web version updates itself, Android and iPhone builds are on the [Releases](https://github.com/uivox/Tellerwerk/releases/latest) page.
