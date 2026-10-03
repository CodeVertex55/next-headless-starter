import { ContentError } from "@/content/errors";

const SOURCES = ["fixture", "wordpress"] as const;
export type ContentSourceName = (typeof SOURCES)[number];

function read(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
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
    siteUrl: read("SITE_URL") ?? "http://localhost:3000",
    wpUrl,
    wpAppUser: read("WP_APP_USER"),
    wpAppPassword: read("WP_APP_PASSWORD"),
    previewSecret: read("PREVIEW_SECRET"),
    revalidateSecret: read("REVALIDATE_SECRET"),
  };
}
