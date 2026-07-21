"use client";

import { useEffect, useMemo, useState } from "react";

type BrowserKey = "chrome" | "edge" | "firefox";

type StoreLink = {
  key: BrowserKey;
  label: string;
  url: string;
  reviewLabel?: string;
};

const storeLinks: StoreLink[] = [
  {
    key: "chrome",
    label: "Chrome",
    url: process.env.NEXT_PUBLIC_CHROME_EXTENSION_URL ?? ""
  },
  {
    key: "edge",
    label: "Edge",
    reviewLabel: "Edge Add-ons",
    url: process.env.NEXT_PUBLIC_EDGE_EXTENSION_URL ?? ""
  },
  {
    key: "firefox",
    label: "Firefox",
    reviewLabel: "Firefox Add-ons",
    url: process.env.NEXT_PUBLIC_FIREFOX_EXTENSION_URL ?? ""
  }
];

function getDetectedBrowser(userAgent: string): BrowserKey | null {
  if (/firefox|fxios/i.test(userAgent)) {
    return "firefox";
  }

  if (/edg\//i.test(userAgent) || /edgios/i.test(userAgent)) {
    return "edge";
  }

  if (/chrome|crios|chromium/i.test(userAgent)) {
    return "chrome";
  }

  return null;
}

function withWebsiteUtm(url: string) {
  try {
    const storeUrl = new URL(url);
    storeUrl.searchParams.set("utm_source", "website");
    return storeUrl.toString();
  } catch {
    return url;
  }
}

export default function InstallButton() {
  const [detectedBrowser, setDetectedBrowser] = useState<BrowserKey | null>(null);
  const [isDetected, setIsDetected] = useState(false);
  const fallbackStore = storeLinks.find((store) => store.key === "chrome" && store.url);
  const detectedStore = storeLinks.find((store) => store.key === detectedBrowser);

  useEffect(() => {
    setDetectedBrowser(getDetectedBrowser(window.navigator.userAgent));
    setIsDetected(true);
  }, []);

  const selectedStore = useMemo(() => {
    if (!isDetected || !detectedBrowser) {
      return null;
    }

    return storeLinks.find((store) => store.key === detectedBrowser && store.url) ?? null;
  }, [detectedBrowser, isDetected]);

  if (isDetected && detectedStore && !detectedStore.url && detectedStore.reviewLabel) {
    return (
      <p className="install-status" role="status">
        {detectedStore.label} support is in progress and currently under {detectedStore.reviewLabel} review.
      </p>
    );
  }

  if (!selectedStore && !fallbackStore) {
    return null;
  }

  if (!selectedStore) {
    const store = fallbackStore;

    if (!store) {
      return null;
    }

    return (
      <a
        className="button primary"
        href={withWebsiteUtm(store.url)}
        target="_blank"
        rel="noreferrer"
      >
        Get the extension
      </a>
    );
  }

  return (
    <a
      className="button primary"
      href={withWebsiteUtm(selectedStore.url)}
      target="_blank"
      rel="noreferrer"
    >
      Get {selectedStore.label} Extension
    </a>
  );
}
