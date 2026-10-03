import { unstable_rethrow } from "next/navigation";
import { ContentError } from "@/content/errors";
import { isReservedPageSlug } from "@/content/reserved";
import type { ContentSource } from "@/content/source";
import type { MenuLocation, PostSummary } from "@/content/types";
import type { getEnv } from "@/lib/env";
import { SITE_URL } from "@/lib/site";
import { createClient } from "./client";
import {
  HOME_SLUG,
  mapMenu,
  mapPage,
  mapPost,
  mapPostSummary,
  mapSettings,
  slugFromUri,
  type MapOptions,
  type WpMenuNode,
  type WpPageNode,
  type WpPostNode,
} from "./mappers";
import {
  MENU,
  PAGE_BY_URI,
  PAGE_PREVIEW,
  PAGE_SIZE,
  PAGE_URIS,
  POSTS,
  POSTS_TOTAL,
  POST_BY_SLUG,
  POST_PREVIEW,
  POST_SLUGS,
  SEO_PROBE,
  SITE_SETTINGS,
} from "./queries";

type Env = ReturnType<typeof getEnv>;
type Connection<T> = { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: T[] };

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** Tags are part of the public contract: the revalidate webhook uses these exact names. */
const tag = {
  site: "site",
  menus: "menus",
  pages: "pages",
  page: (slug: string[]) => `page:${slug.join("/")}`,
  posts: "posts",
  post: (slug: string) => `post:${slug}`,
};

function pageUri(slug: string[]) {
  return slug.length ? `/${slug.join("/")}/` : "/";
}

export function createWordPressSource(env: Env): ContentSource {
  if (!env.wpUrl) {
    throw new ContentError("config", "WP_GRAPHQL_URL is required when CONTENT_SOURCE=wordpress");
  }
  const request = createClient({
    url: env.wpUrl,
    appUser: env.wpAppUser,
    appPassword: env.wpAppPassword,
  });

  // A Yoast canonical on the CMS origin points at WordPress, not the public site, so mappers drop
  // it. When WordPress is configured with the public url as its home, there is nothing to drop.
  const cmsOrigin = originOf(env.wpUrl);
  const mapOpts: MapOptions = cmsOrigin && cmsOrigin !== originOf(SITE_URL) ? { cmsOrigin } : {};

  // Does the schema have the Yoast addon? An ordinary query answers it (introspection is off by
  // default in WPGraphQL). It selects `metaDesc`, a field only the Yoast addon has; other SEO
  // plugins can expose a `seo` field too, and selecting the full Yoast shape against them would
  // fail every content query. Only a definite answer is remembered for the process: success means
  // present, any GraphQL error (the schema rejected the Yoast fields) means absent. A network
  // failure is not remembered, so the next call asks again; that call runs without SEO, and the
  // first such failure is logged once. The probe is cached like any content request, so it does
  // not make a prerendered route dynamic.
  let seoProbe: Promise<boolean> | null = null;
  let warnedProbe = false;
  function hasSeo(): Promise<boolean> {
    seoProbe ??= request<unknown>(SEO_PROBE, {}, { tags: [tag.site] })
      .then(() => true)
      .catch((e: unknown) => {
        const absent = e instanceof ContentError && e.code === "graphql";
        // Not a definite answer, so ask again next time. Cleared before the rethrow below, so a
        // Next.js internal error is not remembered either.
        if (!absent) seoProbe = null;
        unstable_rethrow(e);
        if (absent) return false;
        if (!warnedProbe) {
          warnedProbe = true;
          const message = e instanceof Error ? e.message : String(e);
          console.warn(
            `WPGraphQL SEO probe inconclusive, running without Yoast fields: ${message}`,
          );
        }
        return false;
      });
    return seoProbe;
  }

  // Walks a cursor connection until `limit` nodes are collected or the connection ends. A page that
  // says there is more but returns no nodes, or a cursor that does not advance, ends the walk
  // instead of looping forever.
  async function collect<T>(
    fetchPage: (first: number, after: string | null) => Promise<Connection<T>>,
    limit = Infinity,
  ): Promise<{ nodes: T[]; hasNextPage: boolean }> {
    const nodes: T[] = [];
    let after: string | null = null;
    let hasNextPage = true;
    while (hasNextPage && nodes.length < limit) {
      const conn: Connection<T> = await fetchPage(Math.min(PAGE_SIZE, limit - nodes.length), after);
      nodes.push(...conn.nodes);
      const next = conn.pageInfo.endCursor;
      const stalled = conn.nodes.length === 0 || next === after;
      after = next;
      hasNextPage = conn.pageInfo.hasNextPage && after !== null && !stalled;
    }
    return { nodes, hasNextPage };
  }

  // `undefined` until the first attempt; false once WordPress rejected `offsetPagination`.
  let offsetSupported: boolean | undefined;

  async function countPosts(): Promise<number> {
    if (offsetSupported !== false) {
      try {
        const d = await request<{
          posts: { pageInfo: { offsetPagination: { total: number | null } | null } };
        }>(POSTS_TOTAL, {}, { tags: [tag.posts] });
        const total = d.posts.pageInfo.offsetPagination?.total;
        if (typeof total === "number") {
          offsetSupported = true;
          return total;
        }
        offsetSupported = false;
      } catch (e) {
        unstable_rethrow(e);
        const unsupported =
          e instanceof ContentError && e.code === "graphql" && /offsetPagination/.test(e.message);
        if (!unsupported) throw e;
        offsetSupported = false;
      }
    }
    const { nodes } = await collect((first, after) =>
      request<{ posts: Connection<{ slug: string }> }>(
        POST_SLUGS,
        { first, after },
        { tags: [tag.posts] },
      ).then((d) => d.posts),
    );
    return nodes.length;
  }

  return {
    async getSiteSettings() {
      const d = await request<{
        generalSettings: { title: string; description: string; url: string } | null;
      }>(SITE_SETTINGS, {}, { tags: [tag.site] });
      if (!d.generalSettings) throw new ContentError("graphql", "WPGraphQL returned no settings");
      // The public url is the Next site, never the WordPress origin.
      return mapSettings(d.generalSettings, SITE_URL);
    },

    async getMenu(location: MenuLocation) {
      const d = await request<{
        generalSettings: { url: string } | null;
        menus: { nodes: { menuItems: { nodes: WpMenuNode[] } | null }[] } | null;
      }>(MENU, { location: location.toUpperCase() }, { tags: [tag.menus] });
      const nodes = d.menus?.nodes[0]?.menuItems?.nodes ?? [];
      const bases = [SITE_URL, ...(d.generalSettings?.url ? [d.generalSettings.url] : [])];
      return mapMenu(location, nodes, bases);
    },

    async getPage(slug, opts) {
      const seo = await hasSeo();
      const id = opts?.preview?.id;
      if (id) {
        const d = await request<{ page: WpPageNode | null }>(
          PAGE_PREVIEW(seo),
          { id },
          { tags: [], auth: true },
        );
        // A draft has a uri like "/?page_id=N", so keep the path the caller asked for.
        return d.page ? mapPage({ ...d.page, uri: pageUri(slug) }, mapOpts) : null;
      }
      // WordPress serves the front page at "/" and the app calls it "home". A page literally
      // slugged "home" that is not the front page lives at "/home/".
      const isHome = slug.length === 0 || (slug.length === 1 && slug[0] === HOME_SLUG);
      const uris = isHome ? ["/", pageUri([HOME_SLUG])] : [pageUri(slug)];
      for (const uri of uris) {
        const d = await request<{ page: WpPageNode | null }>(
          PAGE_BY_URI(seo),
          { uri },
          { tags: [tag.pages, tag.page(isHome ? [HOME_SLUG] : slug)] },
        );
        if (d.page) return mapPage(d.page, mapOpts);
      }
      return null;
    },

    async getPageSlugs() {
      const { nodes } = await collect((first, after) =>
        request<{ pages: Connection<{ uri: string | null }> }>(
          PAGE_URIS,
          { first, after },
          { tags: [tag.pages] },
        ).then((d) => d.pages),
      );
      const seen = new Set<string>();
      const slugs: string[][] = [];
      for (const n of nodes) {
        if (!n.uri) continue;
        const slug = slugFromUri(n.uri);
        const key = slug.join("/");
        if (seen.has(key) || isReservedPageSlug(slug)) continue;
        seen.add(key);
        slugs.push(slug);
      }
      return slugs;
    },

    async getPost(slug, opts) {
      const seo = await hasSeo();
      const id = opts?.preview?.id;
      if (id) {
        const d = await request<{ post: WpPostNode | null }>(
          POST_PREVIEW(seo),
          { id },
          { tags: [], auth: true },
        );
        // An unsaved draft can have an empty slug; keep the one the caller asked for.
        return d.post ? mapPost({ ...d.post, slug: d.post.slug || slug }, mapOpts) : null;
      }
      const d = await request<{ post: WpPostNode | null }>(
        POST_BY_SLUG(seo),
        { slug },
        { tags: [tag.posts, tag.post(slug)] },
      );
      return d.post ? mapPost(d.post, mapOpts) : null;
    },

    // Known v1 trade-off: WPGraphQL paginates by cursor, not by page number. To serve page N this
    // fetches the first perPage * N posts from the start and keeps the last perPage, so deep pages
    // cost more (and walk the cursor in batches of 100 because WPGraphQL caps `first`). That is
    // fine for the page counts a small site has; swap in offset pagination or stored cursors for
    // big ones. `total` is exact for free when the walk reaches the end of the posts, otherwise it
    // comes from offsetPagination.total (needs the wp-graphql-offset-pagination extension) or,
    // failing that, from counting every published slug.
    async getPosts({ page, perPage }) {
      const seo = await hasSeo();
      const { nodes, hasNextPage } = await collect(
        (first, after) =>
          request<{ posts: Connection<WpPostNode> }>(
            POSTS(seo),
            { first, after },
            { tags: [tag.posts] },
          ).then((d) => d.posts),
        perPage * page,
      );
      const total = hasNextPage ? await countPosts() : nodes.length;
      const start = (page - 1) * perPage;
      const items: PostSummary[] = nodes
        .slice(start, start + perPage)
        .map((n) => mapPostSummary(n, mapOpts));
      return { items, page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) };
    },

    async getPostSlugs() {
      const { nodes } = await collect((first, after) =>
        request<{ posts: Connection<{ slug: string }> }>(
          POST_SLUGS,
          { first, after },
          { tags: [tag.posts] },
        ).then((d) => d.posts),
      );
      return nodes.map((n) => n.slug);
    },
  };
}
