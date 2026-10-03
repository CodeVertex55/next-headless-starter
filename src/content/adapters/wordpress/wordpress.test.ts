import { describe, it, expect } from "vitest";
import pageWithSeo from "./__fixtures__/page-with-seo.json";
import pageWithoutSeo from "./__fixtures__/page-without-seo.json";
import pageNoindexHome from "./__fixtures__/page-noindex-home.json";
import postWithImage from "./__fixtures__/post-with-image.json";
import postWithoutImage from "./__fixtures__/post-without-image.json";
import menuNested from "./__fixtures__/menu-nested.json";
import postsPage1 from "./__fixtures__/posts-page-1.json";
import siteSettings from "./__fixtures__/site-settings.json";
import {
  decodeEntities,
  mapImage,
  mapMenu,
  mapPage,
  mapPost,
  mapPostSummary,
  mapSeo,
  mapSettings,
} from "./mappers";

describe("mapImage", () => {
  it("returns null without a source url", () => {
    expect(mapImage(null)).toBeNull();
    expect(mapImage({ sourceUrl: "", altText: null, mediaDetails: null })).toBeNull();
  });
  it("falls back to empty alt and default dimensions", () => {
    expect(mapImage({ sourceUrl: "http://x/a.jpg", altText: null, mediaDetails: null })).toEqual({
      src: "http://x/a.jpg",
      alt: "",
      width: 1200,
      height: 800,
    });
  });
});

describe("decodeEntities", () => {
  it("decodes named and numeric entities in a single pass", () => {
    expect(decodeEntities("Fell &amp; Furrow &#8217;s &#x2014; &hellip;")).toBe(
      `Fell & Furrow ’s ${String.fromCharCode(0x2014)} …`,
    );
    expect(decodeEntities("&amp;lt;")).toBe("&lt;");
  });
});

describe("mapPage", () => {
  it("maps a page with SEO present", () => {
    const page = mapPage(pageWithSeo.data.page);
    expect(page.id).toBe("cGFnZToxMg==");
    expect(page.slug).toEqual(["about", "team"]);
    expect(page.path).toBe("/about/team");
    expect(page.title).toBe("Meet the team & our values");
    expect(page.seo).toEqual({
      title: "Meet the team | Northfield Studio",
      absoluteTitle: true,
      description: "Four people who design and build small-business websites.",
      canonical: "http://localhost/about/team/",
      noindex: false,
      ogImage: {
        src: "http://localhost/wp-content/uploads/team-og.jpg",
        alt: "Team Open Graph card",
        width: 1200,
        height: 630,
      },
    });
    expect(page.featuredImage).toEqual({
      src: "http://localhost/wp-content/uploads/team.jpg",
      alt: "The whole team on the studio steps",
      width: 1600,
      height: 900,
    });
  });

  it("emits ISO 8601 dates, reading GMT fields as UTC", () => {
    const page = mapPage(pageWithSeo.data.page);
    expect(page.publishedAt).toBe("2026-02-10T08:00:00.000Z");
    expect(page.updatedAt).toBe("2026-09-01T11:30:00.000Z");
  });

  it("sanitises HTML", () => {
    const { html } = mapPage(pageWithSeo.data.page);
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/onerror/i);
    expect(html).toContain("<h2>Who we are</h2>");
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("falls back to title, derived excerpt and featured image when SEO is absent", () => {
    const page = mapPage(pageWithoutSeo.data.page);
    expect(page.slug).toEqual(["privacy"]);
    expect(page.excerpt).toBe(
      "We collect as little as we can. Read the full policy below. It’s short & plain.",
    );
    expect(page.seo).toEqual({
      title: "Privacy",
      absoluteTitle: false,
      description: page.excerpt,
      canonical: null,
      noindex: false,
      ogImage: null,
    });
    expect(page.featuredImage).toBeNull();
  });

  it("maps the WordPress front page to the home slug, with the og image falling back", () => {
    const page = mapPage(pageNoindexHome.data.page);
    expect(page.slug).toEqual(["home"]);
    expect(page.path).toBe("/home");
    expect(page.seo.noindex).toBe(true);
    expect(page.seo.title).toBe("Northfield Studio");
    expect(page.seo.canonical).toBeNull();
    expect(page.seo.ogImage).toEqual({
      src: "http://localhost/wp-content/uploads/studio.jpg",
      alt: "",
      width: 1200,
      height: 800,
    });
  });

  it("drops a canonical that points at the CMS origin", () => {
    const page = mapPage(pageWithSeo.data.page, { cmsOrigin: "http://localhost" });
    expect(page.seo.canonical).toBeNull();
    const kept = mapPage(pageWithSeo.data.page, { cmsOrigin: "https://cms.example.com" });
    expect(kept.seo.canonical).toBe("http://localhost/about/team/");
  });

  it("limits a derived excerpt to 160 characters", () => {
    const page = mapPage({ ...pageWithoutSeo.data.page, content: `<p>${"word ".repeat(100)}</p>` });
    expect(page.excerpt.length).toBeLessThanOrEqual(160);
  });
});

describe("mapSeo", () => {
  const fallback = { title: "T", excerpt: "E", image: null };
  it("uses fallbacks for blank values", () => {
    const blank = {
      title: " ",
      metaDesc: null,
      canonical: null,
      metaRobotsNoindex: null,
      opengraphImage: null,
    };
    expect(mapSeo(blank, fallback)).toEqual({
      title: "T",
      absoluteTitle: false,
      description: "E",
      canonical: null,
      noindex: false,
      ogImage: null,
    });
  });
  it("handles a missing seo object", () => {
    expect(mapSeo(undefined, fallback).title).toBe("T");
    expect(mapSeo(undefined, fallback).absoluteTitle).toBe(false);
    expect(mapSeo(null, fallback).noindex).toBe(false);
  });
  it("marks a title from the SEO plugin as absolute, after decoding entities", () => {
    const seo = {
      title: "Q&amp;A | Site",
      metaDesc: null,
      canonical: null,
      metaRobotsNoindex: null,
      opengraphImage: null,
    };
    expect(mapSeo(seo, fallback)).toMatchObject({ title: "Q&A | Site", absoluteTitle: true });
  });
});

describe("mapPost", () => {
  it("maps a post with image, author and Yoast data", () => {
    const post = mapPost(postWithImage.data.post);
    expect(post.slug).toBe("launching-a-site-in-a-week");
    expect(post.path).toBe("/blog/launching-a-site-in-a-week");
    expect(post.author).toBe("Ada Okafor");
    expect(post.excerpt).toBe(
      "Here is how we did it, with every decision … and every shortcut we refused.",
    );
    expect(post.publishedAt).toBe("2026-08-20T13:00:00.000Z");
    expect(post.updatedAt).toBe("2026-08-21T07:00:00.000Z");
    expect(post.featuredImage?.width).toBe(1280);
    expect(post.seo.description).toBe("A week-long launch, step by step.");
  });

  it("keeps allowed embeds and drops disallowed ones", () => {
    const { html } = mapPost(postWithImage.data.post);
    expect(html).toContain("youtube.com/embed/abc");
    expect(html).not.toContain("evil.example");
  });

  it("handles no image, no author and no SEO", () => {
    const post = mapPost(postWithoutImage.data.post);
    expect(post.author).toBeNull();
    expect(post.featuredImage).toBeNull();
    expect(post.seo.ogImage).toBeNull();
    expect(post.seo.title).toBe("Choosing a headless CMS");
    expect(post.seo.description).toBe("Pick the one your editors can use.");
  });

  it("maps summaries without html", () => {
    const summaries = postsPage1.data.posts.nodes.map((n) => mapPostSummary(n));
    expect(summaries).toHaveLength(2);
    expect(summaries[0]).not.toHaveProperty("html");
    expect(summaries[0].slug).toBe("launching-a-site-in-a-week");
  });
});

describe("mapMenu", () => {
  const nodes = menuNested.data.menus.nodes[0].menuItems.nodes;
  const menu = mapMenu("primary", nodes, "http://localhost");

  it("nests children under their parent", () => {
    expect(menu.location).toBe("primary");
    expect(menu.items.map((i) => i.label)).toEqual([
      "About",
      "Blog",
      "GitHub",
      "Q&A",
      "Home",
      "Jump",
    ]);
    expect(menu.items[0].children).toEqual([
      { label: "Team", href: "/about/team", external: false, children: [] },
    ]);
  });

  it("makes same-site urls relative and flags external ones", () => {
    const byLabel = Object.fromEntries(menu.items.map((i) => [i.label, i]));
    expect(byLabel.About.href).toBe("/about");
    expect(byLabel.About.external).toBe(false);
    expect(byLabel.GitHub).toMatchObject({
      href: "https://github.com/talha55/next-headless-starter",
      external: true,
    });
  });

  it("does not treat a lookalike host as internal", () => {
    const qa = menu.items.find((i) => i.label === "Q&A");
    expect(qa).toMatchObject({ href: "http://localhost.evil.example/qa", external: true });
  });

  it("maps the site root to / and leaves fragments alone", () => {
    expect(menu.items.find((i) => i.label === "Home")).toMatchObject({
      href: "/",
      external: false,
    });
    expect(menu.items.find((i) => i.label === "Jump")).toMatchObject({
      href: "#contact",
      external: false,
    });
  });

  it("accepts several internal bases", () => {
    const m = mapMenu(
      "footer",
      [{ id: "a", parentId: null, label: "X", url: "https://site.example/x/", target: null }],
      ["http://localhost", "https://site.example"],
    );
    expect(m.items[0]).toMatchObject({ href: "/x", external: false });
  });
});

describe("mapSettings", () => {
  it("uses the supplied site url, never the WordPress url", () => {
    const s = mapSettings(siteSettings.data.generalSettings, "https://next.example.com");
    expect(s).toEqual({
      name: "Northfield Studio",
      description: "Fast, plain-spoken websites & care plans",
      url: "https://next.example.com",
      logo: null,
    });
  });
});
