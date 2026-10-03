/**
 * First path segments the app's own routes own (`/blog/...` and `/api/...`). A CMS page under one
 * of them could never be served by the catch-all page route, so adapters leave it out of
 * `getPageSlugs` and it is not prerendered or listed in the sitemap.
 */
export const RESERVED_PAGE_SEGMENTS: readonly string[] = ["blog", "api"];

export function isReservedPageSlug(slug: readonly string[]): boolean {
  return slug.length > 0 && RESERVED_PAGE_SEGMENTS.includes(slug[0]);
}
