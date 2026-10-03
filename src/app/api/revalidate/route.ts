import { timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";

// Underscores are allowed because WordPress renames a trashed post's slug to "<slug>__trashed".
const SLUG_CHARS = /^[a-z0-9_/-]*$/i;
const SITEMAP_PATH = "/sitemap.xml";
const UNKNOWN_TYPE = "type must be one of post, page, menu, site, all";

/** Tags for a given webhook type. `slug` is already normalised (no edge slashes) or undefined. */
const TYPES: Record<string, (slug?: string) => string[]> = {
  post: (s) => ["posts", ...(s ? [`post:${s}`] : [])],
  // The WordPress front page is cached under the tag `page:home`.
  page: (s) => ["pages", ...(s === undefined ? [] : [`page:${s === "" ? "home" : s}`])],
  menu: () => ["menus"],
  site: () => ["site"],
  all: () => ["site", "menus", "pages", "posts"],
};

function bearerMatches(header: string | null, expected: string): boolean {
  if (header === null) return false;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return false;
  const given = match[1];
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const expected = getEnv().revalidateSecret;
  if (!expected || !bearerMatches(request.headers.get("authorization"), expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { type, slug: rawSlug } = body as { type?: unknown; slug?: unknown };

  const build = typeof type === "string" && Object.hasOwn(TYPES, type) ? TYPES[type] : undefined;
  if (!build) return NextResponse.json({ error: UNKNOWN_TYPE }, { status: 400 });

  let slug: string | undefined;
  if (rawSlug !== undefined) {
    if (typeof rawSlug !== "string") {
      return NextResponse.json({ error: "slug must be a string" }, { status: 400 });
    }
    // WordPress sends URIs such as "/about/team/" or "/" for the front page.
    slug = rawSlug.replace(/^\/+|\/+$/g, "");
    const emptySegment = slug !== "" && slug.split("/").some((seg) => seg === "");
    // Post slugs are single segments; page slugs may nest but never contain empty segments.
    if (!SLUG_CHARS.test(slug) || emptySegment || (type === "post" && slug.includes("/"))) {
      return NextResponse.json({ error: "invalid slug" }, { status: 400 });
    }
  }

  const tags = build(slug);
  // A webhook means the content changed now, so expire immediately rather than serve stale data
  // while revalidating: the next request for a tagged entry waits for fresh content.
  for (const tag of tags) revalidateTag(tag, { expire: 0 });

  // Content lists feed the sitemap, so refresh it whenever pages or posts change.
  const paths = tags.some((t) => t === "pages" || t === "posts") ? [SITEMAP_PATH] : [];
  for (const path of paths) revalidatePath(path);

  return NextResponse.json({ revalidated: tags, paths });
}
