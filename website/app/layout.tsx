import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

const siteUrl = "https://headeroverride.com";
const siteDescription =
  "Modify HTTP headers and cookies with local rules. Header Override is a browser extension for API debugging and staging environments.";
const socialImage = {
  url: "/screenshots/marquee-1400x560.png",
  width: 1400,
  height: 560,
  alt: "Header Override browser extension interface for modifying HTTP headers and cookies"
};

export const metadata: Metadata = {
  title: {
    default: "Header Override - Modify HTTP Headers And Cookies",
    template: "%s | Header Override"
  },
  description: siteDescription,
  metadataBase: new URL(siteUrl),
  applicationName: "Header Override",
  authors: [{ name: "Header Override" }],
  creator: "Header Override",
  publisher: "Header Override",
  category: "Developer Tools",
  keywords: [
    "Header Override",
    "request header extension",
    "modify header",
    "modify headers",
    "HTTP header modifier",
    "modify request headers",
    "override request headers",
    "modify response headers",
    "request cookie extension",
    "response cookie extension",
    "header cookie modifier",
    "browser extension",
    "developer tools",
    "API debugging",
    "staging API testing",
    "QA browser extension",
    "browser header extension",
    "URL based rules"
  ],
  alternates: {
    canonical: "/",
    types: {
      "text/markdown": "/index.md"
    }
  },
  icons: {
    icon: "/icons/icon-128.png",
    apple: "/icons/icon-128.png"
  },
  manifest: "/manifest.webmanifest",
  referrer: "origin-when-cross-origin",
  formatDetection: {
    email: false,
    address: false,
    telephone: false
  },
  openGraph: {
    title: "Header Override - Modify HTTP Headers And Cookies",
    description: siteDescription,
    url: siteUrl,
    siteName: "Header Override",
    type: "website",
    locale: "en_US",
    images: [socialImage]
  },
  twitter: {
    card: "summary_large_image",
    title: "Header Override - Modify HTTP Headers And Cookies",
    description: siteDescription,
    images: [socialImage]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
