import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContentError } from "@/content/errors";
import { SITE_URL } from "@/lib/site";
import pageWithSeo from "./__fixtures__/page-with-seo.json";
import pageNoindexHome from "./__fixtures__/page-noindex-home.json";
import postWithImage from "./__fixtures__/post-with-image.json";
import menuNested from "./__fixtures__/menu-nested.json";
import postsPage1 from "./__fixtures__/posts-page-1.json";
import siteSettings from "./__fixtures__/site-settings.json";
import { createWordPressSource } from "./index";

type Call = { query: string; variables: Record<string, unknown>; init: RequestInit };
type Handler = (call: Call) => unknown;

/** Replaces global fetch with a GraphQL stub. A handler returns the `data` object or a Response. */
function stubWordPress(handler: Handler) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as {
        query: string;
        variables: Record<string, unknown>;
      };
      const call = { ...body, init };
      calls.push(call);
      const out = handler(call);
      if (out instanceof Response) return out;
      return Response.json(out);
    }),
  );
  return calls;
}

const env = {
  source: "wordpress" as const,
  siteUrl: SITE_URL,
  wpUrl: "http://localhost/graphql",
  wpAppUser: "editor",
  wpAppPassword: "abcd efgh",
  previewSecret: undefined,
  revalidateSecret: undefined,
};

const withSeo = (c: Call) =>
  c.query.includes("__type") && { data: { __type: { name: "PostTypeSEO" } } };
const noSeo = (c: Call) => c.query.includes("__type") && { data: { __type: null } };
const nextOf = (c: Call) => (c.init as RequestInit & { next?: { tags: string[] } }).next;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("site settings and menus", () => {
  it("tags settings with site and uses SITE_URL, not the WordPress url", async () => {
    const calls = stubWordPress(() => siteSettings);
    const s = await createWordPressSource(env).getSiteSettings();
    expect(s.url).toBe(SITE_URL);
    expect(s.url.endsWith("/")).toBe(false);
    expect(nextOf(calls[0])?.tags).toEqual(["site"]);
  });

  it("tags menus, asks for the upper-case location and maps hrefs", async () => {
    const calls = stubWordPress(() => menuNested);
    const menu = await createWordPressSource(env).getMenu("primary");
    expect(calls[0].variables).toEqual({ location: "PRIMARY" });
    expect(nextOf(calls[0])?.tags).toEqual(["menus"]);
    expect(menu.items[0]).toMatchObject({ label: "About", href: "/about", external: false });
  });

  it("returns an empty menu when WordPress has none for the location", async () => {
    stubWordPress(() => ({
      data: { generalSettings: { url: "http://localhost" }, menus: { nodes: [] } },
    }));
    expect((await createWordPressSource(env).getMenu("footer")).items).toEqual([]);
  });
});

describe("pages", () => {
  it("probes for SEO once, queries by uri and tags with pages and page:<slug>", async () => {
    const calls = stubWordPress((c) => withSeo(c) || pageWithSeo);
    const src = createWordPressSource(env);
    const page = await src.getPage(["about", "team"]);
    await src.getPage(["about", "team"]);
    expect(page?.path).toBe("/about/team");
    expect(calls.filter((c) => c.query.includes("__type"))).toHaveLength(1);
    const pageCalls = calls.filter((c) => c.query.includes("PageByUri"));
    expect(pageCalls[0].variables).toEqual({ uri: "/about/team/" });
    expect(nextOf(pageCalls[0])?.tags).toEqual(["pages", "page:about/team"]);
    expect(pageCalls[0].query).toContain("metaRobotsNoindex");
    expect(pageCalls[0].init.headers).not.toHaveProperty("authorization");
  });

  it("drops the seo selection when the schema has no Yoast type", async () => {
    const calls = stubWordPress((c) => noSeo(c) || pageWithSeo);
    await createWordPressSource(env).getPage(["about"]);
    expect(calls.find((c) => c.query.includes("PageByUri"))?.query).not.toContain("metaDesc");
  });

  it("returns null for a missing page", async () => {
    stubWordPress((c) => withSeo(c) || { data: { page: null } });
    expect(await createWordPressSource(env).getPage(["nope"])).toBeNull();
  });

  it("serves the home slug from the front page, falling back to /home/", async () => {
    const calls = stubWordPress(
      (c) => withSeo(c) || (c.variables.uri === "/" ? { data: { page: null } } : pageNoindexHome),
    );
    const page = await createWordPressSource(env).getPage(["home"]);
    expect(page?.slug).toEqual(["home"]);
    const uris = calls.filter((c) => c.query.includes("PageByUri")).map((c) => c.variables.uri);
    expect(uris).toEqual(["/", "/home/"]);
    expect(nextOf(calls[2])?.tags).toEqual(["pages", "page:home"]);
  });

  it("lists page slugs across cursor pages, mapping / to home", async () => {
    const calls = stubWordPress((c) =>
      c.variables.after === null
        ? {
            data: {
              pages: {
                pageInfo: { hasNextPage: true, endCursor: "c1" },
                nodes: [{ uri: "/" }, { uri: "/about/" }],
              },
            },
          }
        : {
            data: {
              pages: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [{ uri: "/about/team/" }, { uri: null }],
              },
            },
          },
    );
    const slugs = await createWordPressSource(env).getPageSlugs();
    expect(slugs).toEqual([["home"], ["about"], ["about", "team"]]);
    expect(calls).toHaveLength(2);
    expect(calls[0].variables).toEqual({ first: 100, after: null });
    expect(nextOf(calls[0])?.tags).toEqual(["pages"]);
  });
});

describe("posts", () => {
  it("tags a post with posts and post:<slug>", async () => {
    const calls = stubWordPress((c) => withSeo(c) || postWithImage);
    const post = await createWordPressSource(env).getPost("launching-a-site-in-a-week");
    expect(post?.author).toBe("Ada Okafor");
    const call = calls.find((c) => c.query.includes("PostBySlug"));
    expect(call?.variables).toEqual({ slug: "launching-a-site-in-a-week" });
    expect(nextOf(call!)?.tags).toEqual(["posts", "post:launching-a-site-in-a-week"]);
  });

  it("returns null for a missing post", async () => {
    stubWordPress((c) => withSeo(c) || { data: { post: null } });
    expect(await createWordPressSource(env).getPost("nope")).toBeNull();
  });

  it("lists post slugs", async () => {
    stubWordPress(() => ({
      data: {
        posts: {
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [{ slug: "a" }, { slug: "b" }],
        },
      },
    }));
    expect(await createWordPressSource(env).getPostSlugs()).toEqual(["a", "b"]);
  });

  const node = (i: number) => ({
    ...postsPage1.data.posts.nodes[0],
    id: `id${i}`,
    slug: `post-${i}`,
  });
  const connection = (nodes: unknown[], hasNextPage: boolean) => ({
    data: { posts: { pageInfo: { hasNextPage, endCursor: hasNextPage ? "cur" : null }, nodes } },
  });

  it("takes the total from the list when the walk reaches the end", async () => {
    const calls = stubWordPress(
      (c) => withSeo(c) || connection([node(1), node(2), node(3)], false),
    );
    const result = await createWordPressSource(env).getPosts({ page: 1, perPage: 10 });
    expect(result).toMatchObject({ page: 1, perPage: 10, total: 3, totalPages: 1 });
    expect(result.items).toHaveLength(3);
    expect(result.items[0]).not.toHaveProperty("html");
    expect(calls.filter((c) => c.query.includes("Posts("))).toHaveLength(1);
  });

  it("fetches perPage * page from the start and keeps the last perPage", async () => {
    const calls = stubWordPress((c) => {
      if (c.query.includes("__type")) return { data: { __type: null } };
      if (c.query.includes("offsetPagination"))
        return { data: { posts: { pageInfo: { offsetPagination: { total: 7 } } } } };
      return connection([node(1), node(2), node(3), node(4)], true);
    });
    const result = await createWordPressSource(env).getPosts({ page: 2, perPage: 2 });
    const list = calls.find((c) => c.query.includes("Posts("));
    expect(list?.variables).toEqual({ first: 4, after: null });
    expect(result.items.map((i) => i.slug)).toEqual(["post-3", "post-4"]);
    expect(result).toMatchObject({ total: 7, totalPages: 4 });
  });

  it("falls back to counting slugs when offset pagination is not installed", async () => {
    const calls = stubWordPress((c) => {
      if (c.query.includes("__type")) return { data: { __type: null } };
      if (c.query.includes("offsetPagination")) {
        return {
          errors: [
            {
              message:
                'Field "offsetPagination" is not defined by type "RootQueryToPostConnectionWhereArgs".',
            },
          ],
        };
      }
      if (c.query.includes("PostSlugs")) {
        return connection(
          [{ slug: "a" }, { slug: "b" }, { slug: "c" }, { slug: "d" }, { slug: "e" }],
          false,
        );
      }
      return connection([node(1), node(2)], true);
    });
    const src = createWordPressSource(env);
    const first = await src.getPosts({ page: 1, perPage: 2 });
    expect(first).toMatchObject({ total: 5, totalPages: 3 });
    await src.getPosts({ page: 1, perPage: 2 });
    // The extension is only probed once; the second call goes straight to counting slugs.
    expect(calls.filter((c) => c.query.includes("PostsTotal"))).toHaveLength(1);
  });

  it("walks the cursor in batches of 100 for deep pages", async () => {
    const calls = stubWordPress((c) => {
      if (c.query.includes("__type")) return { data: { __type: null } };
      if (c.query.includes("offsetPagination"))
        return { data: { posts: { pageInfo: { offsetPagination: { total: 300 } } } } };
      const n = c.variables.first as number;
      return connection(
        Array.from({ length: n }, (_, i) => node(i)),
        true,
      );
    });
    await createWordPressSource(env).getPosts({ page: 3, perPage: 50 });
    const firsts = calls.filter((c) => c.query.includes("Posts(")).map((c) => c.variables.first);
    expect(firsts).toEqual([100, 50]);
  });
});

describe("preview", () => {
  it("uses the preview query with Basic auth and no-store when an id is present", async () => {
    const calls = stubWordPress((c) => withSeo(c) || pageWithSeo);
    await createWordPressSource(env).getPage(["about", "team"], {
      preview: { secretVerified: true, id: "12" },
    });
    const call = calls.find((c) => c.query.includes("PagePreview"))!;
    expect(call.query).toContain("asPreview: true");
    expect(call.variables).toEqual({ id: "12" });
    expect(call.init.cache).toBe("no-store");
    expect(nextOf(call)).toBeUndefined();
    const expected = "Basic " + Buffer.from("editor:abcd efgh").toString("base64");
    expect((call.init.headers as Record<string, string>).authorization).toBe(expected);
  });

  it("previews posts the same way", async () => {
    const calls = stubWordPress((c) => withSeo(c) || postWithImage);
    await createWordPressSource(env).getPost("x", { preview: { secretVerified: true, id: "101" } });
    const call = calls.find((c) => c.query.includes("PostPreview"))!;
    expect(call.init.cache).toBe("no-store");
    expect(call.init.headers).toHaveProperty("authorization");
  });

  it("falls back to the published query when the preview has no id", async () => {
    const calls = stubWordPress((c) => withSeo(c) || pageWithSeo);
    await createWordPressSource(env).getPage(["about", "team"], {
      preview: { secretVerified: true },
    });
    expect(calls.some((c) => c.query.includes("PagePreview"))).toBe(false);
    const call = calls.find((c) => c.query.includes("PageByUri"))!;
    expect(call.init.headers).not.toHaveProperty("authorization");
    expect(nextOf(call)).toBeDefined();
  });

  it("throws a config error when application credentials are missing", async () => {
    stubWordPress((c) => withSeo(c) || pageWithSeo);
    const src = createWordPressSource({ ...env, wpAppUser: undefined, wpAppPassword: undefined });
    await expect(
      src.getPage(["about"], { preview: { secretVerified: true, id: "12" } }),
    ).rejects.toMatchObject({ code: "config" });
  });
});

describe("errors and the SEO probe", () => {
  it("propagates a network failure from the probe and retries on the next call", async () => {
    let attempt = 0;
    const calls = stubWordPress((c) => {
      if (c.query.includes("__type") && attempt++ === 0)
        return new Response("nope", { status: 503 });
      return withSeo(c) || pageWithSeo;
    });
    const src = createWordPressSource(env);
    await expect(src.getPage(["about"])).rejects.toMatchObject({ code: "network" });
    expect((await src.getPage(["about"]))?.title).toContain("Meet the team");
    expect(calls.filter((c) => c.query.includes("__type"))).toHaveLength(2);
  });

  it("treats a probe that fails in GraphQL (introspection off) as no SEO and warns", async () => {
    const calls = stubWordPress((c) =>
      c.query.includes("__type")
        ? { errors: [{ message: "GraphQL introspection is not allowed" }] }
        : pageWithSeo,
    );
    await createWordPressSource(env).getPage(["about"]);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(calls.find((c) => c.query.includes("PageByUri"))?.query).not.toContain("metaDesc");
  });

  it("maps HTTP errors, GraphQL errors and fetch failures to ContentError codes", async () => {
    stubWordPress(() => new Response("x", { status: 500 }));
    await expect(createWordPressSource(env).getSiteSettings()).rejects.toMatchObject({
      code: "network",
    });
    stubWordPress(() => ({ errors: [{ message: "boom" }, { message: "bang" }] }));
    await expect(createWordPressSource(env).getSiteSettings()).rejects.toThrow("boom; bang");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("offline");
      }),
    );
    const err = await createWordPressSource(env)
      .getSiteSettings()
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ContentError);
    expect(err).toMatchObject({ code: "network" });
  });

  it("requires WP_GRAPHQL_URL", () => {
    expect(() => createWordPressSource({ ...env, wpUrl: undefined })).toThrow(/WP_GRAPHQL_URL/);
  });
});
