import { describe, it, expect } from "vitest";
import {
  buildMetadata,
  articleJsonLd,
  breadcrumbJsonLd,
  absoluteUrl,
  organizationJsonLd,
  homeTitle,
} from "./seo";

const seo = {
  title: "T",
  absoluteTitle: false,
  description: "D",
  canonical: null,
  noindex: false,
  ogImage: null,
};
const settings = { name: "Site", description: "SD", url: "https://example.com", logo: null };

describe("seo", () => {
  it("builds absolute urls", () =>
    expect(absoluteUrl("/a", settings.url)).toBe("https://example.com/a"));
  it("builds metadata with canonical from path", () => {
    const m = buildMetadata({ seo, path: "/about", settings });
    expect(m.title).toBe("T");
    expect(m.alternates?.canonical).toBe("https://example.com/about");
    expect(m.robots).toEqual({ index: true, follow: true });
  });
  it("emits an absolute title when the title is already complete", () => {
    const m = buildMetadata({
      seo: { ...seo, title: "About | Site", absoluteTitle: true },
      path: "/about",
      settings,
    });
    expect(m.title).toEqual({ absolute: "About | Site" });
    expect(m.openGraph?.title).toBe("About | Site");
  });
  it("honours noindex and explicit canonical", () => {
    const m = buildMetadata({
      seo: { ...seo, noindex: true, canonical: "https://x.com/y" },
      path: "/about",
      settings,
    });
    expect(m.robots).toEqual({ index: false, follow: false });
    expect(m.alternates?.canonical).toBe("https://x.com/y");
  });
  it("falls back to the default Open Graph image when ogImage is null", () => {
    const m = buildMetadata({ seo, path: "/about", settings });
    const images = m.openGraph?.images as { url: string }[];
    expect(images[0].url.endsWith("/opengraph-image")).toBe(true);
    expect((m.twitter as { card?: string }).card).toBe("summary_large_image");
  });
  it("uses the explicit ogImage when provided", () => {
    const ogImage = { src: "https://cdn.example.com/x.png", width: 800, height: 400, alt: "X" };
    const m = buildMetadata({ seo: { ...seo, ogImage }, path: "/about", settings });
    const images = m.openGraph?.images as { url: string }[];
    expect(images[0].url).toBe(ogImage.src);
  });
  it("produces Article json-ld", () => {
    const ld = articleJsonLd(
      {
        title: "P",
        path: "/blog/p",
        publishedAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
        author: "A",
        featuredImage: null,
      },
      settings,
    );
    expect(ld["@type"]).toBe("Article");
    expect(ld.mainEntityOfPage).toBe("https://example.com/blog/p");
  });
  const post = {
    title: "P",
    path: "/blog/p",
    publishedAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-02T00:00:00Z",
    author: null,
  };
  const image = (src: string) => ({ src, alt: "", width: 10, height: 10 });
  it("makes a relative Article image absolute and keeps an absolute one", () => {
    const rel = articleJsonLd({ ...post, featuredImage: image("/fixture/post-1.jpg") }, settings);
    expect(rel.image).toEqual(["https://example.com/fixture/post-1.jpg"]);
    const abs = articleJsonLd(
      { ...post, featuredImage: image("https://cdn.example.com/a.jpg") },
      settings,
    );
    expect(abs.image).toEqual(["https://cdn.example.com/a.jpg"]);
  });
  it("makes a relative Organization logo absolute and keeps an absolute one", () => {
    const rel = organizationJsonLd({ ...settings, logo: image("/logo.png") });
    expect(rel.logo).toBe("https://example.com/logo.png");
    const abs = organizationJsonLd({ ...settings, logo: image("https://cdn.example.com/l.png") });
    expect(abs.logo).toBe("https://cdn.example.com/l.png");
    expect(organizationJsonLd(settings)).not.toHaveProperty("logo");
  });
  it("produces BreadcrumbList with positions", () => {
    const ld = breadcrumbJsonLd(
      [
        { name: "Home", path: "/" },
        { name: "About", path: "/about" },
      ],
      settings,
    );
    expect(ld.itemListElement[1]).toMatchObject({ position: 2, item: "https://example.com/about" });
  });
});

describe("homeTitle", () => {
  const page = { title: "Home", seo };

  it("keeps a title from the SEO plugin as an absolute title", () => {
    const withPlugin = {
      ...page,
      seo: { ...seo, title: "Northfield | Websites", absoluteTitle: true },
    };
    expect(homeTitle(withPlugin, settings)).toEqual({ absolute: "Northfield | Websites" });
  });

  it("keeps a custom title so the title template applies to it", () => {
    const custom = { ...page, seo: { ...seo, title: "Websites that are finished" } };
    expect(homeTitle(custom, settings)).toBe("Websites that are finished");
  });

  it("uses the site name, without the template, when the title is just the page title", () => {
    const bare = { ...page, seo: { ...seo, title: "Home" } };
    expect(homeTitle(bare, settings)).toEqual({ absolute: "Site" });
  });
});
