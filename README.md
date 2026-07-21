# Header Override

Header Override is a small browser extension for overriding request headers, response headers, request cookies, and response cookies with configurable local rules.

## Repository layout

```text
extension/      Browser extension source and manifest
website/        Public website for headeroverride.com
assets/         Generated screenshot output
docs/           Publishing notes and privacy policy source
scripts/        Generated screenshot helper
dist/           Ignored local release packages
```

## Load the extension for local testing

1. Open your browser's extensions page.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `extension/` folder.

## Use

Open the extension popup, choose a tab, and add a rule:

- **Request Headers** and **Response Headers** override HTTP headers for matching URL filters.
- **Request Cookies** overrides outgoing `Cookie` headers.
- **Response Cookies** overrides response `Set-Cookie` headers.
- **URL filter** is used for header and cookie rules with declarative request-rule matching syntax. `|http*` matches HTTP and HTTPS requests.
- **Comment** is an optional note for labeling or documenting a rule.

Rules are saved automatically and synced into the browser's dynamic request rules.

## Website

The `website/` folder contains the public site for `headeroverride.com`, including the landing page and `/privacy` route.
