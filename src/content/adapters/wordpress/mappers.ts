import type {
  Image,
  Menu,
  MenuItem,
  MenuLocation,
  Page,
  Post,
  PostSummary,
  SeoFields,
  SiteSettings,
} from "@/content/types";
import { sanitizeHtml } from "@/lib/html";

/** The slug the rest of the app uses for the site's front page (WordPress serves it at "/"). */
export const HOME_SLUG = "home";

export type WpImage = {
  sourceUrl: string | null;
  altText: string | null;
  mediaDetails: { width: number | null; height: number | null } | null;
} | null;

export type WpSeo = {
  title: string | null;
  metaDesc: string | null;
  canonical: string | null;
  metaRobotsNoindex: string | null;
  opengraphImage: WpImage;
} | null;

/** Fields shared by the page and post fragments in queries.ts. `seo` exists only when Yoast is installed. */
type WpContentNode = {
  id: string;
  title: string;
  content?: string | null;
  date: string;
  dateGmt?: string | null;
  modified: string;
  modifiedGmt?: string | null;
  featuredImage?: { node: WpImage } | null;
  seo?: WpSeo;
};

/** Pages have no `excerpt` field in WPGraphQL, so the excerpt is derived from the content. */
export type WpPageNode = WpContentNode & { uri: string };

export type WpPostNode = WpContentNode & {
  slug: string;
  excerpt?: string | null;
  author?: { node: { name: string | null } | null } | null;
};

export type WpMenuNode = {
  id: string;
  parentId: string | null;
  label: string;
  url: string;
  target: string | null;
};

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  ndash: String.fromCharCode(0x2013),
  mdash: String.fromCharCode(0x2014),
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
};

/** WPGraphQL returns "rendered" fields HTML-escaped. Single pass, so `&amp;lt;` becomes `&lt;`. */
export function decodeEntities(s: string): string {
  return s.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (match, dec, hex, name) => {
    if (dec || hex) {
      const code = dec ? Number.parseInt(dec, 10) : Number.parseInt(hex, 16);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[String(name).toLowerCase()] ?? match;
  });
}

/** Plain text from an HTML fragment: block ends become spaces, entities are decoded. */
function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<\/(?:p|div|li|h[1-6]|blockquote|figcaption|tr)>|<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function excerptFrom(
  excerptHtml: string | null | undefined,
  contentHtml: string | null | undefined,
) {
  const text = htmlToText(excerptHtml ?? "") || htmlToText(contentHtml ?? "");
  return text.slice(0, 160).trimEnd();
}

/**
 * WPGraphQL's plain `date` and `modified` are in the site's timezone with no offset, so they are
 * ambiguous. The GMT variants are unambiguous and are read as UTC; the local ones are a last resort.
 */
function parseWpDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(s);
  const d = new Date(hasZone ? s : `${s}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function mapDates(n: WpContentNode) {
  const published = parseWpDate(n.dateGmt) ?? parseWpDate(n.date) ?? new Date(0);
  const updated = parseWpDate(n.modifiedGmt) ?? parseWpDate(n.modified) ?? published;
  return { publishedAt: published.toISOString(), updatedAt: updated.toISOString() };
}

export function mapImage(i: WpImage | undefined): Image | null {
  if (!i?.sourceUrl) return null;
  return {
    src: i.sourceUrl,
    alt: i.altText ?? "",
    width: i.mediaDetails?.width ?? 1200,
    height: i.mediaDetails?.height ?? 800,
  };
}

export type MapOptions = {
  /**
   * Origin of the WordPress install. A Yoast canonical on this origin points at the CMS, not at
   * the public site, so it is dropped and the site builds its own canonical from the path.
   */
  cmsOrigin?: string;
};

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function mapSeo(
  seo: WpSeo | undefined,
  fallback: { title: string; excerpt: string; image: Image | null },
  opts: MapOptions = {},
): SeoFields {
  const canonicalRaw = seo?.canonical?.trim() || null;
  const canonical =
    canonicalRaw && opts.cmsOrigin && originOf(canonicalRaw) === originOf(opts.cmsOrigin)
      ? null
      : canonicalRaw;
  // A Yoast title is a full document title that already carries the site name.
  const seoTitle = decodeEntities(seo?.title?.trim() ?? "");
  return {
    title: seoTitle || fallback.title,
    absoluteTitle: seoTitle !== "",
    description: decodeEntities(seo?.metaDesc?.trim() ?? "") || fallback.excerpt,
    canonical,
    noindex: seo?.metaRobotsNoindex === "noindex",
    ogImage: mapImage(seo?.opengraphImage ?? null) ?? fallback.image,
  };
}

/** "/about/team/" becomes ["about", "team"]. WordPress serves the front page at "/", the app calls it "home". */
export function slugFromUri(uri: string): string[] {
  const parts = uri.split("/").filter(Boolean);
  return parts.length ? parts : [HOME_SLUG];
}

export function mapPage(n: WpPageNode, opts: MapOptions = {}): Page {
  const image = mapImage(n.featuredImage?.node ?? null);
  const slug = slugFromUri(n.uri);
  const title = decodeEntities(n.title);
  const excerpt = excerptFrom(null, n.content);
  return {
    id: n.id,
    slug,
    path: "/" + slug.join("/"),
    title,
    html: sanitizeHtml(n.content ?? ""),
    excerpt,
    ...mapDates(n),
    featuredImage: image,
    seo: mapSeo(n.seo, { title, excerpt, image }, opts),
  };
}

export function mapPost(n: WpPostNode, opts: MapOptions = {}): Post {
  const image = mapImage(n.featuredImage?.node ?? null);
  const title = decodeEntities(n.title);
  const excerpt = excerptFrom(n.excerpt, n.content);
  return {
    id: n.id,
    slug: n.slug,
    path: "/blog/" + n.slug,
    title,
    html: sanitizeHtml(n.content ?? ""),
    excerpt,
    ...mapDates(n),
    featuredImage: image,
    author: n.author?.node?.name ?? null,
    seo: mapSeo(n.seo, { title, excerpt, image }, opts),
  };
}

export function mapPostSummary(n: WpPostNode, opts: MapOptions = {}): PostSummary {
  const { html, ...rest } = mapPost(n, opts);
  void html;
  return rest;
}

function trimTrailingSlashes(s: string) {
  return s.replace(/\/+$/, "");
}

/** The site-relative href for `url` when it lives under one of `bases`, else null. */
function internalHref(url: string, bases: string[]): string | null {
  for (const base of bases) {
    if (!url.startsWith(base)) continue;
    const rest = url.slice(base.length);
    if (rest !== "" && !/^[/?#]/.test(rest)) continue; // lookalike host such as example.com.evil.net
    const suffixAt = rest.search(/[?#]/);
    const path = suffixAt === -1 ? rest : rest.slice(0, suffixAt);
    const suffix = suffixAt === -1 ? "" : rest.slice(suffixAt);
    return (trimTrailingSlashes(path) || "/") + suffix;
  }
  return null;
}

/**
 * `siteUrl` is the base(s) that menu item urls are written against: WordPress writes them with its
 * own home url, so pass that (and the public site url too, when the two can differ).
 */
export function mapMenu(
  location: MenuLocation,
  nodes: WpMenuNode[],
  siteUrl: string | readonly string[],
): Menu {
  const bases = (Array.isArray(siteUrl) ? siteUrl : [siteUrl as string])
    .map(trimTrailingSlashes)
    .filter(Boolean);
  const toItem = (n: WpMenuNode): MenuItem => {
    const internal = internalHref(n.url, bases);
    const external = internal === null && /^https?:\/\//i.test(n.url);
    return {
      label: decodeEntities(n.label),
      href: internal ?? n.url,
      external,
      children: nodes.filter((c) => c.parentId === n.id).map(toItem),
    };
  };
  return { location, items: nodes.filter((n) => !n.parentId).map(toItem) };
}

export function mapSettings(
  g: { title: string; description: string; url: string },
  siteUrl: string,
): SiteSettings {
  return {
    name: decodeEntities(g.title),
    description: decodeEntities(g.description),
    url: siteUrl,
    logo: null,
  };
}
