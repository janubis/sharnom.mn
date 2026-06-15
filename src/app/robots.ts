/**
 * robots.txt — allow public discovery, keep privileged & API surfaces out of
 * the index, and point crawlers at the sitemap.
 */
import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/utils";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/owner", "/api", "/login"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
