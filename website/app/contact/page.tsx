import type { Metadata } from "next";

const githubUrl = "https://github.com/headeroverride/headeroverride";
const linkedInUrl =
  "https://www.linkedin.com/in/orest-kreminskyi-33852065/";
const youtubeUrl = "https://www.youtube.com/@HeaderOverrideExtension";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact Orest Kreminskyi about Header Override, view the GitHub repository, and send concise support or enhancement requests.",
  alternates: {
    canonical: "/contact",
    types: {
      "text/markdown": "/contact.md"
    }
  },
  openGraph: {
    title: "Contact | Header Override",
    description:
      "Contact Orest Kreminskyi about Header Override, view the GitHub repository, and send concise support or enhancement requests.",
    url: "https://headeroverride.com/contact",
    images: ["/screenshots/marquee-1400x560.png"]
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact | Header Override",
    description:
      "Contact Orest Kreminskyi about Header Override, view the GitHub repository, and send concise support or enhancement requests.",
    images: ["/screenshots/marquee-1400x560.png"]
  }
};

const contactJsonLd = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  name: "Contact Header Override",
  url: "https://headeroverride.com/contact",
  isPartOf: {
    "@type": "WebSite",
    name: "Header Override",
    url: "https://headeroverride.com"
  },
  mainEntity: {
    "@type": "Person",
    name: "Orest Kreminskyi",
    url: linkedInUrl,
    sameAs: [linkedInUrl, githubUrl]
  },
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: "support@headeroverride.com",
    availableLanguage: "English"
  },
  description:
    "Contact page for Header Override, a browser extension for modifying HTTP headers and cookies with local rules."
};

export default function ContactPage() {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactJsonLd) }}
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
              href={githubUrl}
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            <a
              className="nav-link"
              href={youtubeUrl}
              target="_blank"
              rel="noreferrer"
            >
              YouTube
            </a>
          </div>
        </nav>

        <p className="eyebrow">Contact</p>
        <h1 className="support-title">Contact Header Override</h1>
        <p className="support-contact-copy">
          Header Override is developed and maintained by{" "}
          <strong>Orest Kreminskyi</strong>.{" "}
          You can find me on{" "}
          <a href={linkedInUrl} target="_blank" rel="noreferrer">
            LinkedIn
          </a>
          .
          <br />
          For support or enhancement requests, email{" "}
          <a href="mailto:support@headeroverride.com">
            support@headeroverride.com
          </a>
          .
        </p>

        <div className="legal-content">
          <section>
            <h2>GitHub repository</h2>
            <p>
              Review the source code, follow changes, or open an issue in the{" "}
              <a href={githubUrl} target="_blank" rel="noreferrer">
                headeroverride/headeroverride
              </a>{" "}
              repository.
            </p>
          </section>

          <section>
            <h2>YouTube channel</h2>
            <p>
              Follow Header Override updates on{" "}
              <a href={youtubeUrl} target="_blank" rel="noreferrer">
                YouTube
              </a>
              .
            </p>
          </section>

          <section>
            <h2>Support and enhancements</h2>
            <p>
              For support requests, include your browser, the rule type, the
              URL filter you expected to match, and what happened instead.
            </p>
            <p>
              For enhancement ideas, keep the request short and include the
              workflow you want to improve. Do not send passwords, access
              tokens, cookies, private header values, or other sensitive data.
            </p>
          </section>

          <section>
            <h2>Privacy questions</h2>
            <p>
              Header Override stores rules locally in your browser and does not
              use analytics, tracking, advertising, remote code, or external
              servers. For details, read the{" "}
              <a href="/privacy">Privacy Policy</a>.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
