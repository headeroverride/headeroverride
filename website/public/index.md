# Header Override

Header Override is a lightweight browser extension for modifying HTTP headers and cookies with local rules.

## Overview

Header Override helps developers, QA engineers, support engineers, and technical users test APIs, staging environments, feature flags, cookies, and request-specific behavior without changing application code.

Rules are stored locally in the user's browser and applied only to matching requests. Header Override does not use analytics, tracking, advertising, remote code, external servers, or third-party data sharing.

## Key Features

- Add or replace HTTP request and response headers from the extension popup.
- Override request Cookie headers.
- Override response Set-Cookie headers.
- Configure response cookie Domain, Path, SameSite, Lifetime, Max-Age, and Secure attributes.
- Create up to five local profiles for different projects, accounts, or test setups.
- Import and export selected profiles as local JSON files.
- Scope matching rules with browser-supported URL filter patterns.
- Enable, disable, delete, and annotate rules with comments.
- Store rules locally in browser extension storage.
- Use Manifest V3 browser extension APIs.

## Common Use Cases

- Send debug headers to staging APIs without changing application code.
- Reproduce customer-specific headers or cookies with scoped local rules.
- Toggle backend flags while testing UI flows in your browser.
- Switch between client, environment, or test-account setups with profiles.
- Document temporary rules before removing them.

## FAQ

### What is Header Override used for?

Header Override helps developers, QA teams, and support engineers modify HTTP headers and cookies from the browser for scoped debugging and testing workflows.

### Are rules sent to a server?

No. Rules are stored locally in browser extension storage and are used only to apply the header or cookie changes you configure.

### Can rules target specific URLs?

Yes. Header and cookie rules can be scoped with browser-supported URL filter patterns, so changes apply only to matching requests.

### Why does Header Override request access to websites?

Header Override needs host access so browser-supported rules can apply to the URL patterns you create. The extension does not send your rules or browsing activity to the developer or third parties.

## Links

- Website: https://headeroverride.com/
- Privacy policy: https://headeroverride.com/privacy
- Contact: https://headeroverride.com/contact
- GitHub repository: https://github.com/headeroverride/headeroverride
- YouTube demo: https://www.youtube.com/watch?v=3nKLDLxxrcI
- Sitemap: https://headeroverride.com/sitemap.xml
- Robots policy: https://headeroverride.com/robots.txt
- LLM index: https://headeroverride.com/llms.txt
- Full LLM content: https://headeroverride.com/llms-full.txt
