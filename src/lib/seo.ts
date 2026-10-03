import type { Metadata } from "next";
import type { SeoFields, SiteSettings, Image } from "@/content/types";

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
    : undefined;
  return {
    title: seo.title,
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
      card: images ? "summary_large_image" : "summary",
      title: seo.title,
      description: seo.description,
    },
  };
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
    ...(s.logo ? { logo: s.logo.src } : {}),
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
    ...(p.featuredImage ? { image: [p.featuredImage.src] } : {}),
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
