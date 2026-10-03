import { ContentError } from "@/content/errors";

const SOURCES = ["fixture", "wordpress"] as const;
export type ContentSourceName = (typeof SOURCES)[number];

function read(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

const LOCALHOST_URL = "http://localhost:3000";
let warnedLocalhost = false;

/**
 * The public URL of this site: SITE_URL, else the Vercel production domain, else localhost. A
 * missing value never throws, so `npm run build` works out of the box, but a production process
 * that falls back to localhost warns once, because canonical URLs, the sitemap and robots would
 * point at localhost. A malformed value is a configuration error.
 */
function resolveSiteUrl(): string {
  const vercel = read("VERCEL_PROJECT_PRODUCTION_URL");
  const value = read("SITE_URL") ?? (vercel ? `https://${vercel}` : undefined);
  if (!value) {
    if (process.env.NODE_ENV === "production" && !warnedLocalhost) {
      warnedLocalhost = true;
      console.warn(
        `SITE_URL is not set; canonical URLs, sitemap and robots will point at ${LOCALHOST_URL}. Set SITE_URL for production deployments.`,
      );
    }
    return LOCALHOST_URL;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ContentError("config", `SITE_URL must be an absolute URL, got "${value}"`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ContentError("config", `SITE_URL must use http or https, got "${value}"`);
  }
  return value;
}

/** Test-only: let the next production fallback warn again. */
export function __resetSiteUrlWarning() {
  warnedLocalhost = false;
}

export function getEnv() {
  const source = (read("CONTENT_SOURCE") ?? "fixture") as string;
  if (!SOURCES.includes(source as ContentSourceName)) {
    throw new ContentError(
      "config",
      `CONTENT_SOURCE must be one of ${SOURCES.join(", ")}, got "${source}"`,
    );
  }
  const wpUrl = read("WP_GRAPHQL_URL");
  if (source === "wordpress" && !wpUrl) {
    throw new ContentError("config", "WP_GRAPHQL_URL is required when CONTENT_SOURCE=wordpress");
  }
  return {
    source: source as ContentSourceName,
    siteUrl: resolveSiteUrl(),
    wpUrl,
    wpAppUser: read("WP_APP_USER"),
    wpAppPassword: read("WP_APP_PASSWORD"),
    previewSecret: read("PREVIEW_SECRET"),
    revalidateSecret: read("REVALIDATE_SECRET"),
  };
}
