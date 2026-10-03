import { describe, it, expect } from "vitest";
import { buildMetadata, articleJsonLd, breadcrumbJsonLd, absoluteUrl } from "./seo";

const seo = { title: "T", description: "D", canonical: null, noindex: false, ogImage: null };
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
  it("honours noindex and explicit canonical", () => {
    const m = buildMetadata({
      seo: { ...seo, noindex: true, canonical: "https://x.com/y" },
      path: "/about",
      settings,
    });
    expect(m.robots).toEqual({ index: false, follow: false });
    expect(m.alternates?.canonical).toBe("https://x.com/y");
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
