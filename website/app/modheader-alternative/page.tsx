import type { Metadata } from "next";
import InstallButton from "../InstallButton";

const pageUrl = "https://headeroverride.com/modheader-alternative";
const pageDescription =
  "Header Override is an open-source, privacy-first ModHeader alternative for modifying HTTP request headers, response headers, and cookies with local browser rules.";

const comparisonRows = [
  {
    feature: "Request headers",
    detail:
      "Add or replace outgoing HTTP request headers for matching URL patterns."
  },
  {
    feature: "Response headers",
    detail:
      "Apply response header changes from the same focused browser extension popup."
  },
  {
    feature: "Cookies",
    detail:
      "Override request cookies and response Set-Cookie values, including common response cookie attributes."
  },
  {
    feature: "Profiles",
    detail:
      "Keep separate local setups for projects, clients, environments, and test accounts."
  },
  {
    feature: "Local storage",
    detail:
      "Rules stay in browser extension storage and are not sent to a developer server."
  },
  {
    feature: "No tracking",
    detail:
      "No analytics, advertising, tracking, remote code, or external service dependency."
  },
  {
    feature: "Open source",
    detail:
      "The extension source is public on GitHub for review, issue reports, and contributions."
  }
];

const faqs = [
  {
    question: "Is Header Override an alternative to ModHeader?",
    answer:
      "Yes. Header Override is a browser extension for users who need to modify HTTP headers and cookies with scoped local rules. It focuses on a small, privacy-first workflow rather than a broad debugging platform."
  },
  {
    question: "Can Header Override modify request and response headers?",
    answer:
      "Yes. Header Override supports request header rules and response header rules, and each rule can be scoped to browser-supported URL filter patterns."
  },
  {
    question: "Does Header Override store rules on a server?",
    answer:
      "No. Header Override stores rules locally in browser extension storage and does not transmit your rules, browsing activity, or website content to the developer or third parties."
  }
];

export const metadata: Metadata = {
  title: "ModHeader Alternative",
  description: pageDescription,
  alternates: {
    canonical: "/modheader-alternative",
    types: {
      "text/markdown": "/modheader-alternative.md"
    }
  },
  openGraph: {
    title: "Header Override - ModHeader Alternative",
    description: pageDescription,
    url: pageUrl,
    siteName: "Header Override",
    type: "website",
    images: [
      {
        url: "/screenshots/marquee-1400x560.png",
        width: 1400,
        height: 560,
        alt: "Header Override browser extension interface"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Header Override - ModHeader Alternative",
    description: pageDescription,
    images: ["/screenshots/marquee-1400x560.png"]
  }
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer
    }
  }))
};

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Header Override",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Modern desktop browsers",
  browserRequirements: "Chrome, Edge, and Firefox",
  url: "https://headeroverride.com",
  description: pageDescription,
  isAccessibleForFree: true,
  privacyPolicy: "https://headeroverride.com/privacy",
  featureList: comparisonRows.map((row) => row.detail)
};

export default function ModHeaderAlternativePage() {
  return (
    <main className="legal-page comparison-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([softwareJsonLd, faqJsonLd])
        }}
      />
      <nav className="nav" aria-label="Primary">
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
            href="https://www.youtube.com/@HeaderOverrideExtension"
            target="_blank"
            rel="noreferrer"
          >
            YouTube
          </a>
        </div>
      </nav>

      <section className="comparison-hero shell">
        <div>
          <p className="eyebrow">ModHeader alternative</p>
          <h1>ModHeader alternative</h1>
          <p className="legal-lede">
            Header Override is an open-source, lightweight browser extension for
            developers, QA engineers, and support teams who need a focused
            alternative to ModHeader for scoped request headers, response
            headers, and cookies.
          </p>
          <div className="actions">
            <InstallButton />
          </div>
        </div>
        <div className="product-preview comparison-preview">
          <div className="preview-bar">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <img
            src="/screenshots/feature-headers-1280x800.png"
            alt="Header Override popup showing request and response header rules"
          />
        </div>
      </section>

      <section className="section comparison-copy">
        <div className="section-head">
          <p className="eyebrow">Why switch</p>
          <h2>A local header modifier without accounts or tracking.</h2>
          <p>
            Header Override keeps the workflow small: create a rule, choose the
            request or response behavior, scope it to matching URLs, and keep
            profiles for the setups you reuse. Rules are saved locally in your
            browser and are not sent to the developer. The project source is
            public on GitHub so the extension can be reviewed directly.
          </p>
        </div>
        <div className="comparison-grid">
          {comparisonRows.map((row) => (
            <article className="mini-card" key={row.feature}>
              <h3>{row.feature}</h3>
              <p>{row.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section comparison-copy">
        <div className="section-head">
          <p className="eyebrow">Search intent</p>
          <h2>A focused modify header browser extension with local rules.</h2>
          <p>
            If you need to modify HTTP headers in Chrome, Edge, or Firefox,
            Header Override gives you request header, response header, request
            cookie, and response cookie rules in one local extension.
          </p>
          <p>
            It keeps ModHeader alternative comparisons focused on a smaller
            local workflow.
          </p>
        </div>
        <div className="faq-list">
          {faqs.map((faq) => (
            <article className="faq-item" key={faq.question}>
              <h3>{faq.question}</h3>
              <p>{faq.answer}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
