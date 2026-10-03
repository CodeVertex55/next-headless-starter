import type { MetadataRoute } from "next";
import { getContentSource } from "@/content/source";
import { absoluteUrl } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const src = await getContentSource();
  const [settings, pageSlugs, postSlugs] = await Promise.all([
    src.getSiteSettings(),
    src.getPageSlugs(),
    src.getPostSlugs(),
  ]);
  const pages = await Promise.all(pageSlugs.map((s) => src.getPage(s)));
  const posts = await Promise.all(postSlugs.map((s) => src.getPost(s)));
  const entries: MetadataRoute.Sitemap = [
    { url: settings.url, lastModified: new Date() },
    { url: absoluteUrl("/blog", settings.url), lastModified: new Date() },
  ];
  for (const p of pages) {
    if (p && p.slug.join("/") !== "home" && !p.seo.noindex) {
      entries.push({ url: absoluteUrl(p.path, settings.url), lastModified: new Date(p.updatedAt) });
    }
  }
  for (const p of posts) {
    if (p && !p.seo.noindex) {
      entries.push({ url: absoluteUrl(p.path, settings.url), lastModified: new Date(p.updatedAt) });
    }
  }
  return entries;
}
