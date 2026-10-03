import { describe, it, expect } from "vitest";
import pageWithSeo from "./__fixtures__/page-with-seo.json";
import pageWithoutSeo from "./__fixtures__/page-without-seo.json";
import pageNoindexHome from "./__fixtures__/page-noindex-home.json";
import postWithImage from "./__fixtures__/post-with-image.json";
import postWithoutImage from "./__fixtures__/post-without-image.json";
import menuNested from "./__fixtures__/menu-nested.json";
import menuFooter from "./__fixtures__/menu-footer.json";
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

// Most fixtures are recordings (scripts/record-wp-fixtures.mjs) from a real WordPress with
// WPGraphQL and no SEO plugin. page-with-seo.json and page-noindex-home.json need Yoast, so they
// are hand-written. Cases that no ordinary install produces (script tags, foreign iframes,
// lookalike hosts) are built inline from the recordings.

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
    // Hand-written: the recorded site runs in UTC, so its local and GMT dates are the same.
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

  it("maps a recorded page without an SEO plugin", () => {
    const page = mapPage(pageWithoutSeo.data.page);
    expect(page.id).toBe("cG9zdDo2");
    expect(page.slug).toEqual(["about", "team"]);
    expect(page.path).toBe("/about/team");
    expect(page.title).toBe("Team");
    expect(page.publishedAt).toBe("2026-10-03T14:07:09.000Z");
    expect(page.updatedAt).toBe("2026-10-03T14:07:09.000Z");
    expect(page.featuredImage).toBeNull();
    expect(page.html).toContain('<p class="wp-block-paragraph">Two people, one studio.</p>');
    expect(page.html).toContain("<blockquote");
  });

  it("falls back to title, derived excerpt and featured image when SEO is absent", () => {
    const page = mapPage(pageWithoutSeo.data.page);
    expect(page.excerpt).toBe("Two people, one studio. Build less, finish more.");
    expect(page.seo).toEqual({
      title: "Team",
      absoluteTitle: false,
      description: "Two people, one studio. Build less, finish more.",
      canonical: null,
      noindex: false,
      ogImage: null,
    });
  });

  it("decodes entities and strips markup in a derived excerpt", () => {
    const page = mapPage({
      ...pageWithoutSeo.data.page,
      content:
        "<p>We collect as little as we can. Read the <strong>full policy</strong> below.</p>\n<p>It&#8217;s short &amp; plain.</p>",
    });
    expect(page.excerpt).toBe(
      "We collect as little as we can. Read the full policy below. It’s short & plain.",
    );
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
  it("maps a recorded post with a featured image and an author", () => {
    const post = mapPost(postWithImage.data.post);
    expect(post.id).toBe("cG9zdDo4");
    expect(post.slug).toBe("hello-from-wordpress");
    expect(post.path).toBe("/blog/hello-from-wordpress");
    expect(post.title).toBe("Hello from WordPress");
    expect(post.author).toBe("admin");
    expect(post.excerpt).toBe("First post with a featured image.");
    expect(post.publishedAt).toBe("2026-03-01T09:00:00.000Z");
    expect(post.updatedAt).toBe("2026-03-01T09:00:00.000Z");
    expect(post.featuredImage).toEqual({
      src: "http://localhost:8881/wp-content/uploads/2026/10/post-1.jpg",
      alt: "A flat colour placeholder",
      width: 1200,
      height: 800,
    });
  });

  it("falls back to the featured image for the Open Graph image without an SEO plugin", () => {
    const post = mapPost(postWithImage.data.post);
    expect(post.seo).toEqual({
      title: "Hello from WordPress",
      absoluteTitle: false,
      description: "First post with a featured image.",
      canonical: null,
      noindex: false,
      ogImage: post.featuredImage,
    });
  });

  it("makes external links safe", () => {
    const { html } = mapPost(postWithImage.data.post);
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("maps a post with Yoast data", () => {
    const post = mapPost({
      ...postWithImage.data.post,
      seo: {
        title: "Hello from WordPress | Northfield WP",
        metaDesc: "A week-long launch, step by step.",
        canonical: "http://localhost:8881/hello-from-wordpress/",
        metaRobotsNoindex: "index",
        opengraphImage: null,
      },
    });
    expect(post.seo).toMatchObject({
      title: "Hello from WordPress | Northfield WP",
      absoluteTitle: true,
      description: "A week-long launch, step by step.",
      canonical: "http://localhost:8881/hello-from-wordpress/",
      noindex: false,
    });
  });

  it("decodes entities in a derived excerpt", () => {
    const post = mapPost({
      ...postWithImage.data.post,
      excerpt:
        "<p>Here is how we did it, with every decision &hellip; and every shortcut we refused.</p>\n",
    });
    expect(post.excerpt).toBe(
      "Here is how we did it, with every decision … and every shortcut we refused.",
    );
  });

  it("keeps allowed embeds and drops disallowed ones", () => {
    const { html } = mapPost({
      ...postWithImage.data.post,
      content:
        '<p>Here is how we did it.</p>\n<iframe src="https://www.youtube.com/embed/abc" width="560" height="315"></iframe>\n<iframe src="https://evil.example/embed"></iframe>',
    });
    expect(html).toContain("youtube.com/embed/abc");
    expect(html).not.toContain("evil.example");
  });

  it("maps a recorded post with no featured image", () => {
    const post = mapPost(postWithoutImage.data.post);
    expect(post.id).toBe("cG9zdDoxMA==");
    expect(post.slug).toBe("third-and-newest");
    expect(post.author).toBe("admin");
    expect(post.featuredImage).toBeNull();
    expect(post.seo.ogImage).toBeNull();
    expect(post.seo.title).toBe("Third and newest EDITED");
    expect(post.seo.description).toBe("Newest post.");
    expect(post.publishedAt).toBe("2026-08-20T09:00:00.000Z");
    expect(post.updatedAt).toBe("2026-10-03T14:13:01.000Z");
    expect(post.html).toContain("<pre");
    expect(post.html).toContain("npm run dev");
  });

  it("maps a post with no author", () => {
    expect(mapPost({ ...postWithoutImage.data.post, author: null }).author).toBeNull();
    expect(mapPost({ ...postWithoutImage.data.post, author: { node: null } }).author).toBeNull();
  });

  it("maps summaries without html", () => {
    const summaries = postsPage1.data.posts.nodes.map((n) => mapPostSummary(n));
    expect(summaries.map((s) => s.slug)).toEqual([
      "hello-world",
      "third-and-newest",
      "hello-from-wordpress",
    ]);
    for (const summary of summaries) expect(summary).not.toHaveProperty("html");
    expect(summaries[0].title).toBe("Hello world!");
    expect(summaries[0].excerpt).toBe(
      "Welcome to WordPress. This is your first post. Edit or delete it, then start writing!",
    );
    expect(summaries[1].featuredImage).toBeNull();
    expect(summaries[2].featuredImage).toMatchObject({
      src: "http://localhost:8881/wp-content/uploads/2026/10/post-1.jpg",
      width: 1200,
      height: 800,
    });
  });
});

describe("mapMenu", () => {
  const WP = "http://localhost:8881";
  const nodes = menuNested.data.menus.nodes[0].menuItems.nodes;
  const menu = mapMenu("primary", nodes, menuNested.data.generalSettings.url);

  it("nests children under their parent", () => {
    expect(menu.location).toBe("primary");
    expect(menu.items.map((i) => i.label)).toEqual(["About", "Blog"]);
    expect(menu.items[0].children).toEqual([
      { label: "Team", href: "/about/team", external: false, children: [] },
    ]);
  });

  it("makes same-site urls relative", () => {
    const byLabel = Object.fromEntries(menu.items.map((i) => [i.label, i]));
    expect(byLabel.About).toMatchObject({ href: "/about", external: false });
    expect(byLabel.Blog).toMatchObject({ href: "/blog", external: false });
  });

  it("flags the external url in the recorded footer menu", () => {
    const footer = mapMenu(
      "footer",
      menuFooter.data.menus.nodes[0].menuItems.nodes,
      menuFooter.data.generalSettings.url,
    );
    expect(footer.items).toEqual([
      { label: "Privacy", href: "/privacy", external: false, children: [] },
      { label: "WordPress", href: "https://wordpress.org/", external: true, children: [] },
    ]);
  });

  describe("edge cases no ordinary menu produces", () => {
    const item = (id: string, label: string, url: string) => ({
      id,
      parentId: null,
      label,
      url,
      target: null,
    });
    const edge = mapMenu(
      "primary",
      [
        item("a", "Q&amp;A", `${WP}.evil.example/qa`),
        item("b", "Home", WP),
        item("c", "Jump", "#contact"),
      ],
      WP,
    );

    it("does not treat a lookalike host as internal", () => {
      expect(edge.items.find((i) => i.label === "Q&A")).toMatchObject({
        href: `${WP}.evil.example/qa`,
        external: true,
      });
    });

    it("maps the site root to / and leaves fragments alone", () => {
      expect(edge.items.find((i) => i.label === "Home")).toMatchObject({
        href: "/",
        external: false,
      });
      expect(edge.items.find((i) => i.label === "Jump")).toMatchObject({
        href: "#contact",
        external: false,
      });
    });
  });

  it("accepts several internal bases", () => {
    const m = mapMenu(
      "footer",
      [{ id: "a", parentId: null, label: "X", url: "https://site.example/x/", target: null }],
      [WP, "https://site.example"],
    );
    expect(m.items[0]).toMatchObject({ href: "/x", external: false });
  });
});

describe("mapSettings", () => {
  it("uses the supplied site url, never the WordPress url", () => {
    const s = mapSettings(siteSettings.data.generalSettings, "https://next.example.com");
    expect(s).toEqual({
      name: "Northfield WP",
      description: "A local WordPress for the headless starter.",
      url: "https://next.example.com",
      logo: null,
    });
  });

  it("decodes entities in the name and description", () => {
    const s = mapSettings(
      {
        ...siteSettings.data.generalSettings,
        description: "Fast, plain-spoken websites &amp; care",
      },
      "https://next.example.com",
    );
    expect(s.description).toBe("Fast, plain-spoken websites & care");
  });
});
