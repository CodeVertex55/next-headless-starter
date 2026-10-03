import type { Metadata } from "next";
import type { Page, SeoFields, SiteSettings, Image } from "@/content/types";

export function absoluteUrl(path: string, base: string) {
  return (
    new URL(path, base.endsWith("/") ? base : base + "/").toString().replace(/\/$/, "") || base
  );
}

export function buildMetadata({
  seo,
  path,
  settings,
}: {
  seo: SeoFields;
  path: string;
  settings: SiteSettings;
}): Metadata {
  const canonical = seo.canonical ?? absoluteUrl(path, settings.url);
  const images = seo.ogImage
    ? [
        {
          url: seo.ogImage.src,
          width: seo.ogImage.width,
          height: seo.ogImage.height,
          alt: seo.ogImage.alt,
        },
      ]
    : [
        {
          url: absoluteUrl("/opengraph-image", settings.url),
          width: 1200,
          height: 630,
          alt: settings.name,
        },
      ];
  return {
    title: seo.absoluteTitle ? { absolute: seo.title } : seo.title,
    description: seo.description,
    alternates: { canonical },
    robots: seo.noindex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: canonical,
      siteName: settings.name,
      type: "website",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
    },
  };
}

/**
 * The document title for the front page. The root route shares a segment with the layout, so the
 * layout's title template does not apply to it. Without an SEO plugin the title is just the page
 * title (often "Home"), so the site name stands in for it. A plugin title is already complete, and
 * a custom title keeps going through the template.
 */
export function homeTitle(
  page: Pick<Page, "title" | "seo">,
  settings: Pick<SiteSettings, "name">,
): Exclude<Metadata["title"], null | undefined> {
  if (page.seo.absoluteTitle) return { absolute: page.seo.title };
  if (page.seo.title === page.title) return { absolute: settings.name };
  return page.seo.title;
}

export function websiteJsonLd(s: SiteSettings) {
  return { "@context": "https://schema.org", "@type": "WebSite", name: s.name, url: s.url };
}
export function organizationJsonLd(s: SiteSettings) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: s.name,
    url: s.url,
    ...(s.logo ? { logo: absoluteUrl(s.logo.src, s.url) } : {}),
  };
}
export function articleJsonLd(
  p: {
    title: string;
    path: string;
    publishedAt: string;
    updatedAt: string;
    author: string | null;
    featuredImage: Image | null;
  },
  s: SiteSettings,
) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: p.title,
    mainEntityOfPage: absoluteUrl(p.path, s.url),
    datePublished: p.publishedAt,
    dateModified: p.updatedAt,
    ...(p.author ? { author: { "@type": "Person", name: p.author } } : {}),
    ...(p.featuredImage ? { image: [absoluteUrl(p.featuredImage.src, s.url)] } : {}),
    publisher: { "@type": "Organization", name: s.name },
  };
}
export function breadcrumbJsonLd(crumbs: { name: string; path: string }[], s: SiteSettings) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path, s.url),
    })),
  };
}
