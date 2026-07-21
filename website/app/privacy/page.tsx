import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Header Override stores header and cookie rules locally in your browser and does not use analytics, tracking, advertising, remote code, or external servers.",
  alternates: {
    canonical: "/privacy",
    types: {
      "text/markdown": "/privacy.md"
    }
  },
  openGraph: {
    title: "Privacy Policy | Header Override",
    description:
      "Header Override stores header and cookie rules locally in your browser and does not use analytics, tracking, advertising, remote code, or external servers.",
    url: "https://headeroverride.com/privacy",
    images: ["/screenshots/marquee-1400x560.png"]
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy | Header Override",
    description:
      "Header Override stores header and cookie rules locally in your browser and does not use analytics, tracking, advertising, remote code, or external servers.",
    images: ["/screenshots/marquee-1400x560.png"]
  }
};

const privacyJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Privacy Policy",
  url: "https://headeroverride.com/privacy",
  isPartOf: {
    "@type": "WebSite",
    name: "Header Override",
    url: "https://headeroverride.com"
  },
  dateModified: "2026-07-20",
  description:
    "Header Override stores user-created header and cookie rules locally in browser extension storage and does not transmit personal data to the developer or third parties."
};

export default function PrivacyPage() {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(privacyJsonLd) }}
      />
      <section className="legal-page shell">
        <nav className="legal-nav" aria-label="Primary">
          <a className="brand" href="/">
            <img src="/icons/icon-128.png" alt="" width="32" height="32" />
            <span>Header Override</span>
          </a>
          <div className="nav-actions">
            <a className="nav-link" href="/">
              Home
            </a>
            <a className="nav-link" href="/privacy">
              Privacy
            </a>
            <a className="nav-link" href="/contact">
              Contact
            </a>
            <a
              className="nav-link"
              href="https://github.com/headeroverride/headeroverride"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            <a
              className="nav-link"
              href="https://www.youtube.com/watch?v=3nKLDLxxrcI"
              target="_blank"
              rel="noreferrer"
            >
              YouTube
            </a>
          </div>
        </nav>

        <p className="eyebrow">Last updated July 20, 2026</p>
        <h1>Privacy Policy</h1>
        <p className="legal-lede">
          Header Override lets users create local rules that override HTTP
          headers and cookies for URLs they choose.
        </p>

        <div className="legal-content">
          <section>
            <h2>Data the extension handles</h2>
            <p>
              Header Override stores the rules you create in your browser&apos;s
              local extension storage. This data may include profile names,
              header names, header values, cookie names, cookie values, cookie
              attributes, cookie domains, paths, URL filter patterns, comments,
              and whether each rule is enabled.
            </p>
            <p>
              The extension uses these rules only to configure the browser&apos;s
              request rules API, write request cookies you configured, and
              apply the header or cookie changes you requested.
            </p>
          </section>

          <section>
            <h2>Data collection and sharing</h2>
            <p>
              Header Override does not send your rules, browsing activity,
              website content, or any other personal data to the developer or to
              any third party. The extension does not use analytics, advertising,
              tracking, remote code, or external servers.
            </p>
          </section>

          <section>
            <h2>Data storage and deletion</h2>
            <p>
              Rules are stored locally in your browser using extension storage.
              You can edit or delete rules from the extension popup.
              Uninstalling the extension removes the locally stored extension
              data according to the browser&apos;s normal extension storage
              behavior.
            </p>
          </section>

          <section>
            <h2>Permissions</h2>
            <p>
              Header Override requests access to all URLs so that user-created
              rules can apply to the websites and requests selected by the
              user&apos;s URL filters. It requests storage permission so rules can
              be saved locally.
            </p>
          </section>

          <section>
            <h2>Contact</h2>
            <p>
              For privacy questions, email{" "}
              <a href="mailto:support@headeroverride.com">
                support@headeroverride.com
              </a>
              . You can also use the support or request option on the official
              browser extension store listing when it is available.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
