# Header Override

Header Override is a small browser extension for overriding request headers, response headers, request cookies, and response cookies with configurable local rules.

- Chrome Web Store: https://chromewebstore.google.com/detail/gkobmjeklkiepibofnghbkcjiphjacfm
- Microsoft Edge Add-ons: https://microsoftedge.microsoft.com/addons/detail/albhpnnccbkfkloddpaecdmhpnmnldhn
- Firefox Add-ons: https://addons.mozilla.org/en-US/firefox/addon/headeroverride

- Website: https://headeroverride.com
- Website source: https://github.com/headeroverride/headeroverride.com

## Repository layout

```text
extension/      Browser extension manifests, icons, and modular source
  src/shared/   Pure rules, profiles, storage schema, and DNR compilation
  src/platform/ Browser API adapters
  src/background/ Background synchronization and badge entry point
  src/popup/    Popup state, persistence, profile transfer, and views
tests/unit/     Fast tests for pure model and state modules
tests/e2e/      Playwright browser-extension tests
assets/         Store and product assets
docs/           Publishing notes and privacy policy source
scripts/        Release packaging and screenshot helpers
dist/           Ignored local release packages
```

The public website is maintained in a separate repository so this repository can stay focused on the browser extension.

## Load the extension for local testing

1. Run `npm run build`.
2. Open your browser's extensions page.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the `extension/` folder.

The generated `extension/build/` directory contains browser-compatible bundles and is intentionally ignored by Git. Edit files under `extension/src/`, then rebuild.

## Use

Open the extension popup, choose a tab, and add a rule:

- **Request Headers** and **Response Headers** override HTTP headers for matching URL filters.
- **Request Cookies** overrides outgoing `Cookie` headers.
- **Response Cookies** overrides response `Set-Cookie` headers.
- **URL filter** is used for header and cookie rules with declarative request-rule matching syntax. `|http*` matches HTTP and HTTPS requests.
- **Comment** is an optional note for labeling or documenting a rule.

Rules are saved automatically and synced into the browser's dynamic request rules.

## Development

Install dependencies:

```sh
npm ci
```

Run the end-to-end test suite:

```sh
npm run test:e2e
```

Run the unit and end-to-end suites together:

```sh
npm test
```

Run tests in headed mode:

```sh
npm run test:e2e:headed
```

## Packaging

Create release packages for Chrome, Edge, and Firefox:

```sh
npm run package:extension
```

Create a package for one browser:

```sh
npm run package:extension:chrome
npm run package:extension:edge
npm run package:extension:firefox
```

Packages are written to the ignored `dist/` directory.

## Store Assets

Generate screenshots and promotional assets from the real extension UI:

```sh
npm run screenshots:generated
```
