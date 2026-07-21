import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Header Override",
    short_name: "Header Override",
    description:
      "Modify HTTP headers and cookies with local rules for API debugging, staging, and QA workflows.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f6f8fb",
    theme_color: "#0b7a75",
    categories: ["developer tools", "productivity", "utilities"],
    icons: [
      {
        src: "/icons/icon-128.png",
        sizes: "128x128",
        type: "image/png"
      }
    ]
  };
}
