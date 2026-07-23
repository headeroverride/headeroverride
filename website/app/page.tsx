import ScreenshotSwiper from "./ScreenshotSwiper";
import InstallButton from "./InstallButton";
import WorkflowSwiper from "./WorkflowSwiper";

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
    title: "Supported browsers",
    body: "Use Header Override in Chrome, Edge, and Firefox."
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
    question: "Is Header Override an alternative to ModHeader?",
    answer:
      "Yes. Header Override is an open-source, lightweight ModHeader alternative for modifying request headers, response headers, request cookies, and response cookies with local browser rules."
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
  browserRequirements: "Chrome, Edge, and Firefox",
  url: "https://headeroverride.com",
  description:
    "Header Override is a browser extension to modify HTTP headers and cookies with local rules for API debugging, staging, and QA workflows.",
  image: "https://headeroverride.com/screenshots/marquee-1400x560.png",
  screenshot: [
    "https://headeroverride.com/screenshots/feature-headers-1280x800.png",
    "https://headeroverride.com/screenshots/feature-cookies-1280x800.png",
    "https://headeroverride.com/screenshots/feature-profiles-1280x800.png",
    "https://headeroverride.com/screenshots/feature-url-filters-1280x800.png",
    "https://headeroverride.com/screenshots/profile-dropdown-zoom.png",
    "https://headeroverride.com/screenshots/url-filter-syntax.png"
  ],
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD"
  },
  isAccessibleForFree: true,
  privacyPolicy: "https://headeroverride.com/privacy",
  softwareVersion: "1.0.4",
  featureList: [
    "Modify HTTP request headers",
    "Modify HTTP response headers",
    "Override HTTP request headers",
    "Override request cookies",
    "Override response Set-Cookie headers",
    "Create up to five local rule profiles",
    "Import and export selected profiles as JSON",
    "Use in Chrome, Edge, and Firefox",
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
  thumbnailUrl: "https://headeroverride.com/screenshots/feature-headers-1280x800.png",
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
              href="https://www.youtube.com/@HeaderOverrideExtension"
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
              An open-source browser extension to modify headers and cookies
              with switchable local profiles.
            </p>
            <div className="actions">
              <InstallButton />
            </div>
            <div className="trust-rows" aria-label="Extension facts">
              <div className="trust-row" aria-label="Supported browsers">
                <span>Chrome</span>
                <span>Edge</span>
                <span>Firefox</span>
              </div>
              <div className="trust-row-compact" aria-label="Product facts">
                <div>
                  <span>Request headers</span>
                  <span>Response headers</span>
                  <span>Request cookies</span>
                  <span>Response cookies</span>
                </div>
                <div>
                  <span>Import/export profiles</span>
                </div>
              </div>
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

      <section className="section overview-section">
        <div className="section-intro">
          <p className="eyebrow">Built for debugging</p>
          <h2>Open-source browser extension to modify headers and cookies.</h2>
          <p>
            Header Override keeps the workflow deliberately narrow: add a rule,
            choose request or response behavior, scope it where needed, and
            let the extension apply it. Profiles keep separate projects tidy
            when one browser needs several debugging setups.
          </p>
          <p>
            Use the Header Override extension in Chrome and other browsers to
            modify headers with local rules for API debugging, staging checks,
            and QA workflows.
          </p>
        </div>
        <ScreenshotSwiper />
      </section>

      <section className="section features-section">
        <div className="section-head">
          <p className="eyebrow">Feature set</p>
          <h2>Features</h2>
        </div>
        <div className="plain-feature-list">
          {features.map((feature) => (
            <article className="plain-feature" key={feature.title}>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section workflow">
        <div className="section-head">
          <p className="eyebrow">Real extension UI</p>
          <h2>A fast way to switch a test setup.</h2>
          <p>
            The profile dropdown and header rules are shown from actual
            extension captures, with the same popup layout users see in the
            browser.
          </p>
        </div>
        <WorkflowSwiper />
      </section>

      <section className="section alternative-section">
        <div className="section-head">
          <p className="eyebrow">ModHeader alternative</p>
          <h2>Open-source ModHeader alternative for local header and cookie overrides.</h2>
        </div>
        <p>
          Header Override is open source and keeps rules in local browser
          storage, making it a lightweight alternative to ModHeader for scoped
          request headers, response headers, and cookies.{" "}
          <a className="inline-link" href="/modheader-alternative">
            Compare Header Override as a ModHeader alternative
          </a>
          .
        </p>
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
