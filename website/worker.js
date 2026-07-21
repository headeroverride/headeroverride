export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname === "www.headeroverride.com") {
      url.hostname = "headeroverride.com";
      return Response.redirect(url.toString(), 301);
    }

    const markdownPath = getMarkdownPath(request, url);
    const response = markdownPath
      ? await fetchMarkdownAsset(request, env, url, markdownPath)
      : await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);

    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "origin-when-cross-origin");
    headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    headers.append("Vary", "Accept");
    headers.append("Link", '</llms.txt>; rel="llms-txt"');
    headers.append("Link", '</llms-full.txt>; rel="llms-full-txt"');
    headers.append("Link", '</sitemap.xml>; rel="sitemap"; type="application/xml"');
    headers.set("X-Llms-Txt", "/llms.txt");

    const htmlPath = normalizePath(url.pathname);
    const alternateMarkdownPath = markdownRoutes.get(htmlPath);

    if (!markdownPath && alternateMarkdownPath) {
      headers.append(
        "Link",
        `<${alternateMarkdownPath}>; rel="alternate"; type="text/markdown"`
      );
    }

    if (markdownPath) {
      headers.set("Content-Type", "text/markdown; charset=utf-8");
      headers.set("X-Robots-Tag", "noindex, nofollow");
    }

    if (url.pathname.startsWith("/_next/static/")) {
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
    } else if (
      url.pathname === "/robots.txt" ||
      url.pathname === "/sitemap.xml" ||
      url.pathname === "/manifest.webmanifest" ||
      url.pathname === "/llms.txt" ||
      url.pathname === "/llms-full.txt" ||
      markdownPath
    ) {
      headers.set("Cache-Control", "public, max-age=3600");
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};

const markdownRoutes = new Map([
  ["/", "/index.md"],
  ["/privacy", "/privacy.md"],
  ["/support", "/support.md"]
]);

function getMarkdownPath(request, url) {
  if (url.searchParams.get("format") === "md") {
    return markdownRoutes.get(normalizePath(url.pathname));
  }

  const accept = request.headers.get("Accept") || "";

  if (!accept.toLowerCase().includes("text/markdown")) {
    return undefined;
  }

  return markdownRoutes.get(normalizePath(url.pathname));
}

function normalizePath(pathname) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

async function fetchMarkdownAsset(request, env, url, markdownPath) {
  const assetUrl = new URL(url);
  assetUrl.pathname = markdownPath;
  assetUrl.search = "";

  return env.ASSETS.fetch(new Request(assetUrl, request));
}
