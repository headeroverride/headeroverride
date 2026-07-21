import ScreenshotSwiper from "./ScreenshotSwiper";
import InstallButton from "./InstallButton";

const features = [
  {
    title: "Split request and response",
    body: "Add request headers, response headers, request cookies, and response cookies in focused tabs."
  },
  {
    title: "Target URL patterns",
    body: "Scope matching rules with browser-supported URL filter patterns."
  },
  {
    title: "Control cookie attributes",
    body: "Set response cookie Domain, Path, SameSite, Lifetime, Max-Age, and Secure attributes."
  },
  {
    title: "Use profiles",
    body: "Keep up to five local rule profiles for different projects, accounts, or test setups."
  },
  {
    title: "Import and export",
    body: "Move selected profiles between browsers with local JSON import and export."
  },
  {
    title: "Keep rules tidy",
    body: "Enable, disable, delete, and annotate rules with comments."
  },
  {
    title: "Stay local",
    body: "Rules are saved locally in your browser and never sent to a server."
  }
];

const useCases = [
  "Send debug headers to staging APIs without touching application code.",
  "Reproduce customer-specific headers or cookies with scoped local rules.",
  "Toggle backend flags while testing UI flows in your browser.",
  "Switch between client, environment, or test-account setups with profiles.",
  "Document temporary QA rules before removing them."
];

const faqs = [
  {
    question: "What is Header Override used for?",
    answer:
      "Header Override helps developers, QA teams, and support engineers modify HTTP headers and cookies from the browser for scoped debugging and testing workflows."
  },
  {
    question: "Are rules sent to a server?",
    answer:
      "No. Rules are stored locally in browser extension storage and are used only to apply the header or cookie changes you configure."
  },
  {
    question: "Can rules target specific URLs?",
    answer:
      "Yes. Header and cookie rules can be scoped with browser-supported URL filter patterns, so changes apply only to matching requests."
  },
  {
    question: "Why does Header Override request access to websites?",
    answer:
      "Header Override needs host access so browser-supported rules can apply to the URL patterns you create. The extension does not send your rules or browsing activity to the developer or third parties."
  }
];

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Header Override",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Modern desktop browsers",
  url: "https://headeroverride.com",
  description:
    "Header Override is a browser extension to modify HTTP headers and cookies with local rules for API debugging, staging, and QA workflows.",
  image: "https://headeroverride.com/screenshots/marquee-1400x560.png",
  screenshot: [
    "https://headeroverride.com/screenshots/screenshot-1280x800.png",
    "https://headeroverride.com/screenshots/url-filter-syntax.png"
  ],
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD"
  },
  isAccessibleForFree: true,
  privacyPolicy: "https://headeroverride.com/privacy",
  softwareVersion: "1.0.3",
  featureList: [
    "Modify HTTP request headers",
    "Modify HTTP response headers",
    "Override HTTP request headers",
    "Override request cookies",
    "Override response Set-Cookie headers",
    "Create up to five local rule profiles",
    "Import and export selected profiles as JSON",
    "Scope rules with URL filter patterns",
    "Enable, disable, add, and delete rules",
    "Store rules locally in the browser"
  ]
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Header Override",
  url: "https://headeroverride.com",
  description:
    "The official website for Header Override, a browser extension for modifying HTTP headers and cookies with local rules."
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Header Override",
  url: "https://headeroverride.com",
  logo: "https://headeroverride.com/icons/icon-128.png"
};

const videoJsonLd = {
  "@context": "https://schema.org",
  "@type": "VideoObject",
  name: "Header Override demo",
  description:
    "A short demo showing how to modify headers with Header Override and verify request headers in the browser Network tab.",
  thumbnailUrl: "https://headeroverride.com/screenshots/screenshot-1280x800.png",
  uploadDate: "2026-07-17T00:00:00Z",
  duration: "PT28S",
  contentUrl: "https://headeroverride.com/video/header-override-demo.mp4",
  embedUrl: "https://headeroverride.com"
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

export default function Home() {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            softwareJsonLd,
            websiteJsonLd,
            organizationJsonLd,
            videoJsonLd,
            faqJsonLd
          ])
        }}
      />
      <section className="hero">
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
              href="https://www.youtube.com/watch?v=3nKLDLxxrcI"
              target="_blank"
              rel="noreferrer"
            >
              YouTube
            </a>
          </div>
        </nav>

        <div className="hero-grid shell">
          <div className="hero-copy">
            <h1>Header Override</h1>
            <p className="lede">
              An easy-to-use, lightweight browser extension to modify headers
              and cookies with local rules.
            </p>
            <div className="actions">
              <InstallButton />
            </div>
            <div className="trust-row" aria-label="Extension facts">
              <span>Local rules</span>
              <span>Profiles</span>
              <span>No tracking</span>
              <span>Manifest V3</span>
            </div>
          </div>

          <div className="product-preview" aria-label="Header Override popup preview">
            <div className="preview-bar">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <video
              src="/video/header-override-demo.mp4"
              poster="/screenshots/screenshot-1280x800.png"
              controls
              muted
              playsInline
              preload="metadata"
              aria-label="Demo of Header Override modifying request headers and verifying them in the Network tab"
            />
          </div>
        </div>
      </section>

      <section className="section feature-section">
        <div className="section-intro">
          <p className="eyebrow">Built for debugging</p>
          <h2>One small tool for header and cookie changes.</h2>
          <p>
            Header Override keeps the workflow deliberately narrow: add a rule,
            choose request or response behavior, scope it where needed, and
            let the extension apply it. Profiles keep separate projects tidy
            when one browser needs several debugging setups.
          </p>
        </div>
        <div className="list-grid">
          {features.map((feature) => (
            <article className="mini-card" key={feature.title}>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section screenshots-section">
        <div className="section-head">
          <p className="eyebrow">Screenshots</p>
          <h2>See the extension where the work happens.</h2>
        </div>
        <ScreenshotSwiper />
      </section>

      <section className="section workflow">
        <div className="section-head">
          <p className="eyebrow">Example rule</p>
          <h2>A fast way to switch a test setup.</h2>
        </div>
        <div className="extension-rule-card" aria-label="Example Header Override rule">
          <div className="extension-rule-top">
            <div className="extension-brand">
              <img src="/icons/icon-128.png" alt="" width="22" height="22" />
              <strong>Header Override</strong>
            </div>
            <div className="extension-profile-chip" aria-hidden="true">
              <span>Staging QA</span>
              <span>2 rules</span>
            </div>
          </div>
          <div className="extension-tabs" aria-hidden="true">
            <span className="is-active">Headers <strong>1</strong></span>
            <span>Cookies <strong>1</strong></span>
          </div>
          <div className="extension-section-label">Request</div>
          <div className="extension-rule-head">
            <span>On</span>
            <span>Header</span>
            <span>Value</span>
            <span>URL</span>
            <span>Comment</span>
            <span></span>
          </div>
          <div className="extension-rule-row">
            <span className="checkmark" aria-hidden="true">
              ✓
            </span>
            <span className="field">X-Debug-Mode</span>
            <span className="field">true</span>
            <span className="field">|https://api.example.com/*</span>
            <span className="field comment-field">Staging API checks</span>
            <span className="delete-mark" aria-hidden="true">
              x
            </span>
          </div>
          <div className="extension-section-label response-label">Response</div>
          <div className="extension-rule-row">
            <span className="checkmark" aria-hidden="true">
              ✓
            </span>
            <span className="field">Set-Cookie</span>
            <span className="field">qa_mode=true; Secure</span>
            <span className="field">|https://app.example.com/*</span>
            <span className="field comment-field">Browser flag</span>
            <span className="delete-mark" aria-hidden="true">
              x
            </span>
          </div>
        </div>
      </section>

      <section className="section use-section">
        <div className="section-head">
          <p className="eyebrow">Common uses</p>
          <h2>When a local rule would answer the question faster.</h2>
        </div>
        <ol className="use-list">
          {useCases.map((useCase) => (
            <li key={useCase}>{useCase}</li>
          ))}
        </ol>
      </section>

      <section className="section faq-section">
        <div className="section-head">
          <p className="eyebrow">FAQ</p>
          <h2>Answers for searchers and reviewers.</h2>
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

      <section className="section trust shell">
        <div className="section-intro">
          <p className="eyebrow">Local by design</p>
          <h2>No analytics. No tracking. No external servers.</h2>
        </div>
        <p>
          Rules are saved in your browser&apos;s local extension storage and used
          only to apply the header and cookie changes you configure. Header
          Override does not transmit your rules, browsing activity, or website
          content to the developer or third parties.
        </p>
      </section>

    </main>
  );
}
