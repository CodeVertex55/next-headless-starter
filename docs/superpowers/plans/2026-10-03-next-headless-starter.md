# next-headless-starter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship version 1.0.0 of `talha55/next-headless-starter`: a Next.js 16 headless-WordPress starter with a CMS-neutral content layer, fixture and WPGraphQL adapters, preview, revalidation, SEO, tests, CI with a Lighthouse budget, and a public Vercel demo.

**Architecture:** One `ContentSource` interface under `src/content/` with two adapters selected by `CONTENT_SOURCE`. App Router routes only ever call the interface. SEO and sanitising live in `src/lib/`. Tests are Vitest; the WordPress adapter is unit-tested on recorded responses and contract-tested against a real WordPress only when `WP_GRAPHQL_URL` is set.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Tailwind v4, Vitest, MSW, sanitize-html, ESLint, Prettier, GitHub Actions, Lighthouse CI, Vercel.

**Spec:** `docs/superpowers/specs/2026-10-03-next-headless-starter-design.md`

## Global Constraints

- Next.js 16 APIs differ from older training data. Before writing any route, `draftMode`, `revalidateTag`, `generateMetadata` or `params` code, read the matching guide in `node_modules/next/dist/docs/` and follow it. `params`, `searchParams`, `cookies()` and `draftMode()` are async. `revalidateTag` takes a cache profile as its second argument in Next 16; use the form the installed docs show.
- Routes never import an adapter directly. They call `getContentSource()` only.
- All CMS HTML passes through `sanitizeHtml` from `src/lib/html.ts` inside the adapters, before it reaches a component.
- No secrets in the repo. `.env.example` has empty values with comments.
- Writing rules for README and docs: no em dashes or en dashes, no exclamation marks, no badges except the licence line as plain text.
- Every task ends with its tests green and a commit. Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Working directory: `C:\Users\talha\Desktop\Development\next-headless-starter`. The repo already exists locally with the spec committed.
- Node 22+. Use `npm`.

---

### Task 1: Scaffold the app and the test toolchain

**Files:**
- Create: everything `create-next-app` generates, plus `vitest.config.ts`, `src/test/setup.ts`, `.prettierrc`, `.editorconfig`
- Modify: `package.json` scripts

- [ ] **Step 1: Scaffold in place**

Run from the parent folder so the existing `docs/` and `.gitignore` survive:

```bash
cd C:/Users/talha/Desktop/Development/next-headless-starter
npx --yes create-next-app@latest . --ts --tailwind --eslint --app --src-dir --turbopack --import-alias "@/*" --use-npm --yes
```
If it refuses because the directory is not empty, run it into `../_scaffold`, then copy everything except `.git` and `docs` over, and delete `../_scaffold`.

- [ ] **Step 2: Install test and tooling deps**

```bash
npm i sanitize-html
npm i -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom msw @types/sanitize-html prettier prettier-plugin-tailwindcss @lhci/cli
```

- [ ] **Step 3: Vitest config**

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: { provider: "v8", reporter: ["text"] },
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

`src/test/setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Scripts and formatting**

In `package.json` scripts, set:
```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint .",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "lhci": "lhci autorun"
}
```

`.prettierrc`:
```json
{ "plugins": ["prettier-plugin-tailwindcss"], "semi": true, "singleQuote": false, "printWidth": 100 }
```

- [ ] **Step 5: Smoke test**

`src/test/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";
describe("toolchain", () => {
  it("runs", () => expect(1 + 1).toBe(2));
});
```
Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all green, build lists `/`.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Scaffold Next.js 16 app with Vitest, Prettier and sanitize-html

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Content types, interface, env and factory

**Files:**
- Create: `src/content/types.ts`, `src/content/source.ts`, `src/content/errors.ts`, `src/lib/env.ts`
- Test: `src/content/source.test.ts`, `src/lib/env.test.ts`

**Interfaces:** Produces every type the rest of the plan uses. Later tasks import `ContentSource`, `Page`, `Post`, `PostSummary`, `Menu`, `MenuItem`, `Image`, `SeoFields`, `SiteSettings`, `Paginated`, `PreviewContext`, `ContentError`, `getContentSource`, `env`.

- [ ] **Step 1: Types**

`src/content/types.ts`:
```ts
export type Image = { src: string; alt: string; width: number; height: number };

export type SeoFields = {
  title: string;
  description: string;
  canonical: string | null;
  noindex: boolean;
  ogImage: Image | null;
};

type ContentBase = {
  id: string;
  title: string;
  html: string;
  excerpt: string;
  publishedAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  featuredImage: Image | null;
  seo: SeoFields;
};

export type Page = ContentBase & { slug: string[]; path: string };
export type Post = ContentBase & { slug: string; path: string; author: string | null };
export type PostSummary = Omit<Post, "html">;

export type MenuItem = { label: string; href: string; external: boolean; children: MenuItem[] };
export type Menu = { location: MenuLocation; items: MenuItem[] };
export type MenuLocation = "primary" | "footer";

export type SiteSettings = { name: string; description: string; url: string; logo: Image | null };

export type Paginated<T> = { items: T[]; page: number; perPage: number; total: number; totalPages: number };

export type PreviewContext = { secretVerified: true; id?: string };
```

- [ ] **Step 2: Errors**

`src/content/errors.ts`:
```ts
export type ContentErrorCode = "network" | "graphql" | "not_found" | "config";
export class ContentError extends Error {
  constructor(public code: ContentErrorCode, message: string, public cause?: unknown) {
    super(message);
    this.name = "ContentError";
  }
}
```

- [ ] **Step 3: Env**

`src/lib/env.ts`:
```ts
import { ContentError } from "@/content/errors";

const SOURCES = ["fixture", "wordpress"] as const;
export type ContentSourceName = (typeof SOURCES)[number];

function read(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export function getEnv() {
  const source = (read("CONTENT_SOURCE") ?? "fixture") as string;
  if (!SOURCES.includes(source as ContentSourceName)) {
    throw new ContentError("config", `CONTENT_SOURCE must be one of ${SOURCES.join(", ")}, got "${source}"`);
  }
  const wpUrl = read("WP_GRAPHQL_URL");
  if (source === "wordpress" && !wpUrl) {
    throw new ContentError("config", "WP_GRAPHQL_URL is required when CONTENT_SOURCE=wordpress");
  }
  return {
    source: source as ContentSourceName,
    siteUrl: read("SITE_URL") ?? "http://localhost:3000",
    wpUrl,
    wpAppUser: read("WP_APP_USER"),
    wpAppPassword: read("WP_APP_PASSWORD"),
    previewSecret: read("PREVIEW_SECRET"),
    revalidateSecret: read("REVALIDATE_SECRET"),
  };
}
```

- [ ] **Step 4: Interface and factory**

`src/content/source.ts`:
```ts
import type { Menu, MenuLocation, Page, Paginated, Post, PostSummary, PreviewContext, SiteSettings } from "./types";
import { getEnv } from "@/lib/env";

export interface ContentSource {
  getSiteSettings(): Promise<SiteSettings>;
  getMenu(location: MenuLocation): Promise<Menu>;
  getPage(slug: string[], opts?: { preview?: PreviewContext }): Promise<Page | null>;
  getPageSlugs(): Promise<string[][]>;
  getPost(slug: string, opts?: { preview?: PreviewContext }): Promise<Post | null>;
  getPosts(params: { page: number; perPage: number }): Promise<Paginated<PostSummary>>;
  getPostSlugs(): Promise<string[]>;
}

let instance: ContentSource | null = null;

export async function getContentSource(): Promise<ContentSource> {
  if (instance) return instance;
  const env = getEnv();
  if (env.source === "wordpress") {
    const { createWordPressSource } = await import("./adapters/wordpress");
    instance = createWordPressSource(env);
  } else {
    const { createFixtureSource } = await import("./adapters/fixture");
    instance = createFixtureSource();
  }
  return instance;
}

/** Test-only: drop the cached instance. */
export function __resetContentSource() {
  instance = null;
}
```

- [ ] **Step 5: Tests**

`src/lib/env.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getEnv } from "./env";

const saved = { ...process.env };
beforeEach(() => { process.env = { ...saved }; delete process.env.CONTENT_SOURCE; delete process.env.WP_GRAPHQL_URL; });
afterEach(() => { process.env = saved; });

describe("getEnv", () => {
  it("defaults to fixture", () => expect(getEnv().source).toBe("fixture"));
  it("rejects unknown source", () => {
    process.env.CONTENT_SOURCE = "contentful";
    expect(() => getEnv()).toThrow(/CONTENT_SOURCE must be one of/);
  });
  it("requires WP_GRAPHQL_URL for wordpress", () => {
    process.env.CONTENT_SOURCE = "wordpress";
    expect(() => getEnv()).toThrow(/WP_GRAPHQL_URL is required/);
  });
  it("accepts wordpress with a url", () => {
    process.env.CONTENT_SOURCE = "wordpress";
    process.env.WP_GRAPHQL_URL = "https://example.com/graphql";
    expect(getEnv().wpUrl).toBe("https://example.com/graphql");
  });
});
```

`src/content/source.test.ts` (adapters do not exist yet, so this test only asserts the config error path; Task 3 adds the fixture path):
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { getContentSource, __resetContentSource } from "./source";

describe("getContentSource", () => {
  beforeEach(() => { __resetContentSource(); });
  it("throws a config error for an unknown source", async () => {
    process.env.CONTENT_SOURCE = "nope";
    await expect(getContentSource()).rejects.toMatchObject({ code: "config" });
    delete process.env.CONTENT_SOURCE;
  });
});
```

Run: `npm test`
Expected: env tests pass; the factory test passes (the dynamic import is never reached).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Add content types, ContentSource interface, env validation and factory

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: HTML sanitiser

**Files:**
- Create: `src/lib/html.ts`
- Test: `src/lib/html.test.ts`

**Interfaces:** Produces `sanitizeHtml(html: string): string`. Both adapters call it.

- [ ] **Step 1: Failing tests**

`src/lib/html.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "./html";

describe("sanitizeHtml", () => {
  it("strips scripts and event handlers", () => {
    const out = sanitizeHtml(`<p onclick="x()">hi</p><script>alert(1)</script>`);
    expect(out).toBe("<p>hi</p>");
  });
  it("keeps WordPress block markup", () => {
    const input = `<figure class="wp-block-image"><img src="/a.jpg" alt="A" width="10" height="5"></figure><blockquote><p>q</p></blockquote><table><tr><td>1</td></tr></table>`;
    const out = sanitizeHtml(input);
    expect(out).toContain('<figure class="wp-block-image">');
    expect(out).toContain("<blockquote><p>q</p></blockquote>");
    expect(out).toContain("<table>");
  });
  it("forces lazy loading on images", () => {
    expect(sanitizeHtml(`<img src="/a.jpg" alt="">`)).toContain('loading="lazy"');
  });
  it("allows iframes only from embed hosts", () => {
    expect(sanitizeHtml(`<iframe src="https://www.youtube.com/embed/x"></iframe>`)).toContain("<iframe");
    expect(sanitizeHtml(`<iframe src="https://evil.example/x"></iframe>`)).not.toContain("<iframe");
  });
  it("drops javascript: links", () => {
    expect(sanitizeHtml(`<a href="javascript:alert(1)">x</a>`)).toBe("<a>x</a>");
  });
});
```

Run: `npm test -- html`
Expected: FAIL, module not found.

- [ ] **Step 2: Implementation**

`src/lib/html.ts`:
```ts
import sanitize from "sanitize-html";

const EMBED_HOSTS = ["www.youtube.com", "youtube.com", "player.vimeo.com", "open.spotify.com"];

const options: sanitize.IOptions = {
  allowedTags: [
    ...sanitize.defaults.allowedTags,
    "img", "figure", "figcaption", "iframe", "video", "source", "audio", "picture", "h1", "h2",
  ],
  allowedAttributes: {
    "*": ["class", "id"],
    a: ["href", "name", "target", "rel", "title"],
    img: ["src", "srcset", "sizes", "alt", "width", "height", "loading", "decoding"],
    iframe: ["src", "width", "height", "allow", "allowfullscreen", "title", "loading"],
    video: ["src", "poster", "controls", "autoplay", "muted", "loop", "playsinline", "width", "height"],
    source: ["src", "type", "srcset", "media"],
    audio: ["src", "controls"],
    td: ["colspan", "rowspan"],
    th: ["colspan", "rowspan", "scope"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedIframeHostnames: EMBED_HOSTS,
  transformTags: {
    img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy", decoding: "async" } }),
    a: (tagName, attribs) => {
      const external = /^https?:\/\//.test(attribs.href ?? "");
      return { tagName, attribs: external ? { ...attribs, rel: "noopener noreferrer" } : attribs };
    },
  },
};

export function sanitizeHtml(html: string): string {
  return sanitize(html, options);
}
```

Run: `npm test -- html`
Expected: PASS. If the `javascript:` test produces `<a>x</a>` with different whitespace, adjust the assertion to `not.toContain("javascript:")`.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "Add WordPress-aware HTML sanitiser

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Fixture adapter, data and the contract test suite

**Files:**
- Create: `src/content/adapters/fixture/index.ts`, `src/content/adapters/fixture/data/site.json`, `menus.json`, `pages/*.json` (home, about, about/team, services, services/web-design, contact), `posts/*.json` (eight posts), `public/fixture/*.jpg` (six placeholder images, generated)
- Create: `src/content/source.contract.ts` (shared assertions), `src/content/adapters/fixture/fixture.test.ts`
- Modify: `src/content/source.test.ts` (add the fixture path)

**Interfaces:** Produces `createFixtureSource(): ContentSource` and `runContractTests(name, factory)`.

- [ ] **Step 1: Contract suite**

`src/content/source.contract.ts`:
```ts
import { describe, it, expect } from "vitest";
import type { ContentSource } from "./source";

export function runContractTests(name: string, make: () => Promise<ContentSource>) {
  describe(`${name} contract`, () => {
    it("returns site settings", async () => {
      const s = await (await make()).getSiteSettings();
      expect(s.name).toBeTruthy();
      expect(s.url).toMatch(/^https?:\/\//);
    });
    it("returns a primary menu with at least one item", async () => {
      const m = await (await make()).getMenu("primary");
      expect(m.location).toBe("primary");
      expect(m.items.length).toBeGreaterThan(0);
      for (const i of m.items) { expect(i.href).toBeTruthy(); expect(Array.isArray(i.children)).toBe(true); }
    });
    it("lists page slugs and resolves each", async () => {
      const src = await make();
      const slugs = await src.getPageSlugs();
      expect(slugs.length).toBeGreaterThan(0);
      const page = await src.getPage(slugs[0]);
      expect(page?.path).toBe("/" + slugs[0].join("/"));
      expect(page?.html).not.toMatch(/<script/i);
      expect(page?.seo.title).toBeTruthy();
    });
    it("returns null for a missing page", async () => {
      expect(await (await make()).getPage(["definitely", "missing"])).toBeNull();
    });
    it("paginates posts", async () => {
      const src = await make();
      const p1 = await src.getPosts({ page: 1, perPage: 3 });
      expect(p1.items.length).toBeLessThanOrEqual(3);
      expect(p1.totalPages).toBeGreaterThanOrEqual(1);
      expect(p1.total).toBeGreaterThanOrEqual(p1.items.length);
      if (p1.totalPages > 1) {
        const p2 = await src.getPosts({ page: 2, perPage: 3 });
        expect(p2.items[0]?.slug).not.toBe(p1.items[0]?.slug);
      }
    });
    it("resolves a post by slug with ISO dates", async () => {
      const src = await make();
      const [slug] = await src.getPostSlugs();
      const post = await src.getPost(slug);
      expect(post?.slug).toBe(slug);
      expect(new Date(post!.publishedAt).toString()).not.toBe("Invalid Date");
    });
    it("returns null for a missing post", async () => {
      expect(await (await make()).getPost("definitely-missing")).toBeNull();
    });
  });
}
```

- [ ] **Step 2: Fixture test (fails until the adapter exists)**

`src/content/adapters/fixture/fixture.test.ts`:
```ts
import { runContractTests } from "@/content/source.contract";
import { createFixtureSource } from "./index";
runContractTests("fixture", async () => createFixtureSource());
```
Run: `npm test -- fixture` Expected: FAIL, module not found.

- [ ] **Step 3: Fixture data**

Create the JSON files. Shape for `site.json`:
```json
{ "name": "Northfield Studio", "description": "A small design and build studio.", "url": "https://example.com", "logo": null }
```
`menus.json`:
```json
{
  "primary": [
    { "label": "About", "href": "/about", "external": false, "children": [{ "label": "Team", "href": "/about/team", "external": false, "children": [] }] },
    { "label": "Services", "href": "/services", "external": false, "children": [] },
    { "label": "Blog", "href": "/blog", "external": false, "children": [] },
    { "label": "Contact", "href": "/contact", "external": false, "children": [] }
  ],
  "footer": [
    { "label": "Privacy", "href": "/privacy", "external": false, "children": [] },
    { "label": "GitHub", "href": "https://github.com/talha55/next-headless-starter", "external": true, "children": [] }
  ]
}
```
Each page file, for example `pages/about.json`:
```json
{
  "id": "page-about",
  "slug": ["about"],
  "title": "About",
  "excerpt": "Who we are and how we work.",
  "html": "<h2>Who we are</h2><p>Northfield Studio is a two-person design and build studio.</p><figure class=\"wp-block-image\"><img src=\"/fixture/studio.jpg\" alt=\"The studio\" width=\"1200\" height=\"800\"></figure><blockquote><p>Build less, finish more.</p></blockquote><ul><li>Design</li><li>Build</li><li>Maintain</li></ul>",
  "publishedAt": "2026-01-10T09:00:00Z",
  "updatedAt": "2026-02-01T09:00:00Z",
  "featuredImage": { "src": "/fixture/studio.jpg", "alt": "The studio", "width": 1200, "height": 800 },
  "seo": { "title": "About Northfield Studio", "description": "Who we are and how we work.", "canonical": null, "noindex": false, "ogImage": null }
}
```
`pages/home.json` has slug `["home"]`. Posts follow the same shape with `"slug": "launching-a-site-in-a-week"`, an `author` string, and publish dates spread across 2026 so ordering is testable. Include one post with `featuredImage: null` and one with a `<table>` and a `<pre><code>` block in `html`. Exactly eight posts.

Images: generate six 1200x800 JPEGs under `public/fixture/` with a script using `sharp` from `node_modules` (a flat colour with the file name drawn as text is enough):
```bash
node -e "const sharp=require('sharp');['studio','team','web','post-1','post-2','post-3'].forEach((n,i)=>sharp({create:{width:1200,height:800,channels:3,background:{r:40+i*30,g:60,b:90}}}).jpeg({quality:70}).toFile('public/fixture/'+n+'.jpg'))"
```
(`sharp` is a transitive dependency of Next; if `require` fails, `npm i -D sharp`.)

- [ ] **Step 4: Adapter**

`src/content/adapters/fixture/index.ts`:
```ts
import type { ContentSource } from "@/content/source";
import type { Menu, MenuItem, MenuLocation, Page, Post, PostSummary, SiteSettings } from "@/content/types";
import { sanitizeHtml } from "@/lib/html";
import site from "./data/site.json";
import menus from "./data/menus.json";

const pageModules = import.meta.glob<Page>("./data/pages/**/*.json", { eager: true, import: "default" });
const postModules = import.meta.glob<Post>("./data/posts/*.json", { eager: true, import: "default" });

function withPath<T extends { html: string }>(items: T[], path: (t: T) => string) {
  return items.map((i) => ({ ...i, path: path(i), html: sanitizeHtml(i.html) }));
}

export function createFixtureSource(): ContentSource {
  const pages: Page[] = withPath(Object.values(pageModules), (p) => "/" + p.slug.join("/"));
  const posts: Post[] = withPath(Object.values(postModules), (p) => "/blog/" + p.slug).sort(
    (a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt),
  );
  return {
    async getSiteSettings(): Promise<SiteSettings> { return site as SiteSettings; },
    async getMenu(location: MenuLocation): Promise<Menu> {
      return { location, items: (menus as Record<MenuLocation, MenuItem[]>)[location] ?? [] };
    },
    async getPage(slug) { return pages.find((p) => p.slug.join("/") === slug.join("/")) ?? null; },
    async getPageSlugs() { return pages.map((p) => p.slug); },
    async getPost(slug) { return posts.find((p) => p.slug === slug) ?? null; },
    async getPosts({ page, perPage }) {
      const total = posts.length;
      const start = (page - 1) * perPage;
      const items: PostSummary[] = posts.slice(start, start + perPage).map(({ html: _h, ...rest }) => rest);
      return { items, page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) };
    },
    async getPostSlugs() { return posts.map((p) => p.slug); },
  };
}
```
If `import.meta.glob` is unavailable under Next's bundler, replace it with explicit imports of each JSON file (there are fourteen) assembled into two arrays. Keep `resolveJsonModule: true` in `tsconfig.json`.

- [ ] **Step 5: Factory test addition**

Append to `src/content/source.test.ts`:
```ts
it("returns the fixture source by default", async () => {
  delete process.env.CONTENT_SOURCE;
  const src = await getContentSource();
  expect((await src.getSiteSettings()).name).toBeTruthy();
});
```

Run: `npm test` Expected: contract suite passes for fixture, factory test passes.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Add fixture adapter with sample content and the ContentSource contract suite

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Site constants and SEO builders

**Files:**
- Create: `src/lib/site.ts`, `src/lib/seo.ts`
- Test: `src/lib/seo.test.ts`

**Interfaces:** Produces `buildMetadata(input)`, `websiteJsonLd(settings)`, `organizationJsonLd(settings)`, `articleJsonLd(post, settings)`, `breadcrumbJsonLd(crumbs, settings)`, `absoluteUrl(path)`.

- [ ] **Step 1: Failing tests**

`src/lib/seo.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildMetadata, articleJsonLd, breadcrumbJsonLd, absoluteUrl } from "./seo";

const seo = { title: "T", description: "D", canonical: null, noindex: false, ogImage: null };
const settings = { name: "Site", description: "SD", url: "https://example.com", logo: null };

describe("seo", () => {
  it("builds absolute urls", () => expect(absoluteUrl("/a", settings.url)).toBe("https://example.com/a"));
  it("builds metadata with canonical from path", () => {
    const m = buildMetadata({ seo, path: "/about", settings });
    expect(m.title).toBe("T");
    expect(m.alternates?.canonical).toBe("https://example.com/about");
    expect(m.robots).toEqual({ index: true, follow: true });
  });
  it("honours noindex and explicit canonical", () => {
    const m = buildMetadata({ seo: { ...seo, noindex: true, canonical: "https://x.com/y" }, path: "/about", settings });
    expect(m.robots).toEqual({ index: false, follow: false });
    expect(m.alternates?.canonical).toBe("https://x.com/y");
  });
  it("produces Article json-ld", () => {
    const ld = articleJsonLd({ title: "P", path: "/blog/p", publishedAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-02T00:00:00Z", author: "A", featuredImage: null }, settings);
    expect(ld["@type"]).toBe("Article");
    expect(ld.mainEntityOfPage).toBe("https://example.com/blog/p");
  });
  it("produces BreadcrumbList with positions", () => {
    const ld = breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "About", path: "/about" }], settings);
    expect(ld.itemListElement[1]).toMatchObject({ position: 2, item: "https://example.com/about" });
  });
});
```
Run: `npm test -- seo` Expected: FAIL.

- [ ] **Step 2: Implementation**

`src/lib/site.ts`:
```ts
import { getEnv } from "./env";
/** Base URL for canonical, sitemap, robots and schema. One place, on purpose. */
export const SITE_URL = getEnv().siteUrl.replace(/\/$/, "");
export const POSTS_PER_PAGE = 10;
```

`src/lib/seo.ts`:
```ts
import type { Metadata } from "next";
import type { SeoFields, SiteSettings, Image } from "@/content/types";

export function absoluteUrl(path: string, base: string) {
  return new URL(path, base.endsWith("/") ? base : base + "/").toString().replace(/\/$/, "") || base;
}

export function buildMetadata({ seo, path, settings }: { seo: SeoFields; path: string; settings: SiteSettings }): Metadata {
  const canonical = seo.canonical ?? absoluteUrl(path, settings.url);
  const images = seo.ogImage ? [{ url: seo.ogImage.src, width: seo.ogImage.width, height: seo.ogImage.height, alt: seo.ogImage.alt }] : undefined;
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical },
    robots: seo.noindex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: { title: seo.title, description: seo.description, url: canonical, siteName: settings.name, type: "website", images },
    twitter: { card: images ? "summary_large_image" : "summary", title: seo.title, description: seo.description },
  };
}

export function websiteJsonLd(s: SiteSettings) {
  return { "@context": "https://schema.org", "@type": "WebSite", name: s.name, url: s.url };
}
export function organizationJsonLd(s: SiteSettings) {
  return { "@context": "https://schema.org", "@type": "Organization", name: s.name, url: s.url, ...(s.logo ? { logo: s.logo.src } : {}) };
}
export function articleJsonLd(
  p: { title: string; path: string; publishedAt: string; updatedAt: string; author: string | null; featuredImage: Image | null },
  s: SiteSettings,
) {
  return {
    "@context": "https://schema.org", "@type": "Article", headline: p.title,
    mainEntityOfPage: absoluteUrl(p.path, s.url), datePublished: p.publishedAt, dateModified: p.updatedAt,
    ...(p.author ? { author: { "@type": "Person", name: p.author } } : {}),
    ...(p.featuredImage ? { image: [p.featuredImage.src] } : {}),
    publisher: { "@type": "Organization", name: s.name },
  };
}
export function breadcrumbJsonLd(crumbs: { name: string; path: string }[], s: SiteSettings) {
  return {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: absoluteUrl(c.path, s.url) })),
  };
}
```
Run: `npm test -- seo` Expected: PASS. Note `absoluteUrl("/", base)` must return the base without a trailing slash; adjust the implementation if the breadcrumb test's first item disagrees.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "Add site constants and SEO metadata and JSON-LD builders

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Layout and shared components

**Files:**
- Create: `src/components/Nav.tsx`, `Footer.tsx`, `Prose.tsx`, `JsonLd.tsx`, `Breadcrumbs.tsx`, `PostCard.tsx`, `Pagination.tsx`, `PreviewBar.tsx`
- Modify: `src/app/layout.tsx`, `src/app/globals.css`
- Test: `src/components/Pagination.test.tsx`, `src/components/Nav.test.tsx`

- [ ] **Step 1: Failing component tests**

`src/components/Pagination.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Pagination } from "./Pagination";

describe("Pagination", () => {
  it("renders nothing for one page", () => {
    const { container } = render(<Pagination page={1} totalPages={1} basePath="/blog" />);
    expect(container).toBeEmptyDOMElement();
  });
  it("links previous and next with /blog and /blog/page/n", () => {
    render(<Pagination page={2} totalPages={3} basePath="/blog" />);
    expect(screen.getByRole("link", { name: /previous/i })).toHaveAttribute("href", "/blog");
    expect(screen.getByRole("link", { name: /next/i })).toHaveAttribute("href", "/blog/page/3");
  });
});
```
`src/components/Nav.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Nav } from "./Nav";

describe("Nav", () => {
  it("renders items and nested children", () => {
    render(<Nav siteName="S" items={[{ label: "About", href: "/about", external: false, children: [{ label: "Team", href: "/about/team", external: false, children: [] }] }]} />);
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
    expect(screen.getByRole("link", { name: "Team" })).toHaveAttribute("href", "/about/team");
  });
  it("marks external links", () => {
    render(<Nav siteName="S" items={[{ label: "GH", href: "https://x.y", external: true, children: [] }]} />);
    expect(screen.getByRole("link", { name: "GH" })).toHaveAttribute("rel", "noopener noreferrer");
  });
});
```
Run: `npm test -- components` Expected: FAIL.

- [ ] **Step 2: Components**

`src/components/Pagination.tsx`:
```tsx
import Link from "next/link";
export function Pagination({ page, totalPages, basePath }: { page: number; totalPages: number; basePath: string }) {
  if (totalPages <= 1) return null;
  const href = (n: number) => (n === 1 ? basePath : `${basePath}/page/${n}`);
  return (
    <nav aria-label="Pagination" className="mt-12 flex items-center justify-between text-sm">
      {page > 1 ? <Link href={href(page - 1)}>Previous</Link> : <span />}
      <span>Page {page} of {totalPages}</span>
      {page < totalPages ? <Link href={href(page + 1)}>Next</Link> : <span />}
    </nav>
  );
}
```
`src/components/Nav.tsx` (server component, plain nested lists, no JS menu):
```tsx
import Link from "next/link";
import type { MenuItem } from "@/content/types";

function Item({ item }: { item: MenuItem }) {
  const props = item.external ? { target: "_blank", rel: "noopener noreferrer" } : {};
  return (
    <li className="relative">
      <Link href={item.href} {...props} className="px-3 py-2 hover:underline">{item.label}</Link>
      {item.children.length > 0 && (
        <ul className="ml-4 flex flex-col text-sm md:ml-0">
          {item.children.map((c) => <Item key={c.href} item={c} />)}
        </ul>
      )}
    </li>
  );
}
export function Nav({ siteName, items }: { siteName: string; items: MenuItem[] }) {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="font-semibold">{siteName}</Link>
        <nav aria-label="Primary"><ul className="flex flex-wrap gap-1">{items.map((i) => <Item key={i.href} item={i} />)}</ul></nav>
      </div>
    </header>
  );
}
```
`Footer.tsx` renders the footer menu the same way plus a copyright line. `Prose.tsx`:
```tsx
export function Prose({ html }: { html: string }) {
  return <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: html }} />;
}
```
with `.prose` styles written by hand in `globals.css` (headings, paragraphs, lists, figure, blockquote, table, pre) rather than a typography plugin, so the starter has no hidden style dependency. `JsonLd.tsx`:
```tsx
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
```
`Breadcrumbs.tsx` renders an ordered list of links from `{ name, path }[]`. `PostCard.tsx` renders title, date, excerpt and an optional `next/image` featured image. `PreviewBar.tsx` is a fixed bar with "Preview mode" and a link to `/api/preview/exit`.

- [ ] **Step 3: Root layout**

`src/app/layout.tsx`: async server component. Reads `getContentSource()`, loads site settings and both menus, sets `metadataBase: new URL(SITE_URL)` and default title template `%s | ${site.name}` in `generateMetadata`, renders `JsonLd` for website and organisation, `Nav`, `{children}`, `Footer`, and `PreviewBar` when `(await draftMode()).isEnabled`. Read `node_modules/next/dist/docs/` for the `draftMode` guide first.

Run: `npm test && npm run typecheck && npm run build` Expected: green; build still only has `/` (the scaffold page), which Task 7 replaces.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Add layout, navigation, prose, pagination and JSON-LD components

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Content routes

**Files:**
- Create: `src/app/page.tsx`, `src/app/[...slug]/page.tsx`, `src/app/blog/page.tsx`, `src/app/blog/page/[n]/page.tsx`, `src/app/blog/[slug]/page.tsx`, `src/app/not-found.tsx`, `src/app/_lib/loaders.ts`
- Delete: scaffold page content

**Interfaces:** Produces `loadPage(slug)`, `loadPost(slug)`, `loadPosts(page)` in `_lib/loaders.ts`, each taking draft mode into account.

- [ ] **Step 1: Loaders**

`src/app/_lib/loaders.ts`:
```ts
import { draftMode } from "next/headers";
import { notFound } from "next/navigation";
import { getContentSource } from "@/content/source";
import { POSTS_PER_PAGE } from "@/lib/site";

async function preview() {
  const dm = await draftMode();
  return dm.isEnabled ? { secretVerified: true as const } : undefined;
}
export async function loadPage(slug: string[]) {
  const page = await (await getContentSource()).getPage(slug, { preview: await preview() });
  if (!page) notFound();
  return page;
}
export async function loadPost(slug: string) {
  const post = await (await getContentSource()).getPost(slug, { preview: await preview() });
  if (!post) notFound();
  return post;
}
export async function loadPosts(page: number) {
  if (!Number.isInteger(page) || page < 1) notFound();
  const result = await (await getContentSource()).getPosts({ page, perPage: POSTS_PER_PAGE });
  if (page > result.totalPages) notFound();
  return result;
}
```

- [ ] **Step 2: Pages**

`src/app/[...slug]/page.tsx`:
```tsx
import type { Metadata } from "next";
import { getContentSource } from "@/content/source";
import { loadPage } from "@/app/_lib/loaders";
import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { Prose } from "@/components/Prose";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";

type Props = { params: Promise<{ slug: string[] }> };

export async function generateStaticParams() {
  const slugs = await (await getContentSource()).getPageSlugs();
  return slugs.filter((s) => s.join("/") !== "home").map((slug) => ({ slug }));
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [page, settings] = await Promise.all([loadPage(slug), (await getContentSource()).getSiteSettings()]);
  return buildMetadata({ seo: page.seo, path: page.path, settings });
}
export default async function Page({ params }: Props) {
  const { slug } = await params;
  const [page, settings] = await Promise.all([loadPage(slug), (await getContentSource()).getSiteSettings()]);
  const crumbs = [{ name: "Home", path: "/" }, ...slug.map((_, i) => ({ name: i === slug.length - 1 ? page.title : slug[i], path: "/" + slug.slice(0, i + 1).join("/") }))];
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <JsonLd data={breadcrumbJsonLd(crumbs, settings)} />
      <Breadcrumbs items={crumbs} />
      <h1 className="mb-8 text-4xl font-semibold">{page.title}</h1>
      <Prose html={page.html} />
    </main>
  );
}
```
`src/app/page.tsx` loads `["home"]` through `loadPage` and renders the same way without breadcrumbs. `src/app/blog/page.tsx` renders page 1; `src/app/blog/page/[n]/page.tsx` parses `n` and renders the same list component with `Pagination`; `generateStaticParams` for `[n]` returns pages 2..totalPages. `src/app/blog/[slug]/page.tsx` mirrors the page route with `articleJsonLd` and breadcrumbs Home, Blog, title. `not-found.tsx` is a simple styled 404 with a link home.

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run build`
Expected: build lists `/`, `/[...slug]` with the fixture pages prerendered, `/blog`, `/blog/page/[n]`, `/blog/[slug]` with eight posts. Then `npm run dev` and open `/about/team`, `/blog`, `/blog/page/2` (404 expected with 8 posts at 10 per page), a post, and a missing page.

Use the browser pane for this check (`preview_start` with a `next-headless-starter` entry in `.claude/launch.json` on port 3400). Confirm the nav shows nested Team, the prose styles apply, and the 404 renders.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Add page, blog index, pagination and post routes

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Sitemap, robots, Open Graph image

**Files:**
- Create: `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/opengraph-image.tsx`
- Test: `src/app/sitemap.test.ts`

- [ ] **Step 1: Failing test**

`src/app/sitemap.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import sitemap from "./sitemap";
describe("sitemap", () => {
  it("includes home, every page, blog and every post", async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls.some((u) => u.endsWith("/about/team"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/blog"))).toBe(true);
    expect(urls.filter((u) => u.includes("/blog/")).length).toBeGreaterThanOrEqual(8);
    expect(urls.some((u) => u.endsWith("/home"))).toBe(false);
  });
});
```

- [ ] **Step 2: Implementation**

`src/app/sitemap.ts`:
```ts
import type { MetadataRoute } from "next";
import { getContentSource } from "@/content/source";
import { absoluteUrl } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const src = await getContentSource();
  const [settings, pageSlugs, postSlugs] = await Promise.all([src.getSiteSettings(), src.getPageSlugs(), src.getPostSlugs()]);
  const pages = await Promise.all(pageSlugs.map((s) => src.getPage(s)));
  const posts = await Promise.all(postSlugs.map((s) => src.getPost(s)));
  const entries: MetadataRoute.Sitemap = [{ url: settings.url, lastModified: new Date() }, { url: absoluteUrl("/blog", settings.url), lastModified: new Date() }];
  for (const p of pages) if (p && p.slug.join("/") !== "home" && !p.seo.noindex) entries.push({ url: absoluteUrl(p.path, settings.url), lastModified: new Date(p.updatedAt) });
  for (const p of posts) if (p && !p.seo.noindex) entries.push({ url: absoluteUrl(p.path, settings.url), lastModified: new Date(p.updatedAt) });
  return entries;
}
```
`src/app/robots.ts`:
```ts
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }], sitemap: `${SITE_URL}/sitemap.xml` };
}
```
`src/app/opengraph-image.tsx`: `ImageResponse` 1200x630 with the site name and description on a dark background; read the installed docs for the exact export shape.

Run: `npm test -- sitemap && npm run build` Expected: PASS; build lists `/sitemap.xml`, `/robots.txt`, `/opengraph-image`.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "Add sitemap, robots and default Open Graph image

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: WordPress adapter

**Files:**
- Create: `src/content/adapters/wordpress/index.ts`, `client.ts`, `queries.ts`, `mappers.ts`, `__fixtures__/*.json` (recorded responses), `wordpress.test.ts`, `wordpress.contract.test.ts`
- Modify: `next.config.ts` (remotePatterns)

**Interfaces:** Consumes `ContentSource`, types, `sanitizeHtml`, `getEnv` output. Produces `createWordPressSource(env)`.

- [ ] **Step 1: Client**

`src/content/adapters/wordpress/client.ts`:
```ts
import { ContentError } from "@/content/errors";

export type WpClientOptions = { url: string; appUser?: string; appPassword?: string };

export function gql(strings: TemplateStringsArray, ...values: unknown[]) {
  return strings.reduce((acc, s, i) => acc + s + (values[i] ?? ""), "");
}

export function createClient(opts: WpClientOptions) {
  return async function request<T>(query: string, variables: Record<string, unknown>, { tags, auth = false }: { tags: string[]; auth?: boolean }): Promise<T> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (auth) {
      if (!opts.appUser || !opts.appPassword) throw new ContentError("config", "WP_APP_USER and WP_APP_PASSWORD are required for preview");
      headers.authorization = "Basic " + Buffer.from(`${opts.appUser}:${opts.appPassword}`).toString("base64");
    }
    let res: Response;
    try {
      res = await fetch(opts.url, {
        method: "POST", headers, body: JSON.stringify({ query, variables }),
        ...(auth ? { cache: "no-store" as const } : { next: { revalidate: 3600, tags } }),
      });
    } catch (e) { throw new ContentError("network", `WPGraphQL request failed: ${(e as Error).message}`, e); }
    if (!res.ok) throw new ContentError("network", `WPGraphQL responded ${res.status}`);
    const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
    if (json.errors?.length) throw new ContentError("graphql", json.errors.map((e) => e.message).join("; "));
    if (!json.data) throw new ContentError("graphql", "WPGraphQL returned no data");
    return json.data;
  };
}
```

- [ ] **Step 2: Queries**

`src/content/adapters/wordpress/queries.ts` defines, with the `gql` tag: `SITE_SETTINGS` (`generalSettings { title description url }`), `MENU` (`menus(where: { location: $location }) { nodes { menuItems(first: 100) { nodes { id parentId label url target } } } }`), `PAGE_BY_URI` (`page(id: $uri, idType: URI) { ...PageFields }`), `PAGE_PREVIEW` (`page(id: $id, idType: DATABASE_ID, asPreview: true) { ...PageFields }`), `PAGE_URIS` (`pages(first: 500, where: { status: PUBLISH }) { nodes { uri } }`), `POST_BY_SLUG`, `POST_PREVIEW`, `POSTS` (`posts(first: $first, after: $after, where: { status: PUBLISH }) { pageInfo { hasNextPage endCursor } nodes { ...PostSummaryFields } }`), `POST_SLUGS`. Two versions of the page and post field fragments: one with `seo { title metaDesc canonical metaRobotsNoindex opengraphImage { sourceUrl altText mediaDetails { width height } } }` (Yoast shape) and one without. Export `SEO_PROBE = gql\`{ __type(name: "PostTypeSEO") { name } }\``.

Pagination: WPGraphQL is cursor-based. `getPosts({ page, perPage })` fetches `first: perPage * page` from the start with no cursor and slices the last `perPage` for simplicity, and reads `total` from `posts { pageInfo { offsetPagination { total } } }` when the WPGraphQL offset-pagination extension is present, else falls back to counting `POST_SLUGS`. Document this in the README as the known trade-off for version 1.

- [ ] **Step 3: Mappers and recorded fixtures**

Record real responses once from the local XAMPP WordPress (Task 14) or, until it exists, hand-write JSON in the exact WPGraphQL shape for: `page-with-seo.json`, `page-without-seo.json`, `post-with-image.json`, `post-without-image.json`, `menu-nested.json`, `posts-page-1.json`, `site-settings.json`.

`src/content/adapters/wordpress/mappers.ts`:
```ts
import type { Image, Menu, MenuItem, MenuLocation, Page, Post, PostSummary, SeoFields, SiteSettings } from "@/content/types";
import { sanitizeHtml } from "@/lib/html";

type WpImage = { sourceUrl: string; altText: string | null; mediaDetails: { width: number; height: number } | null } | null;
type WpSeo = { title: string | null; metaDesc: string | null; canonical: string | null; metaRobotsNoindex: string | null; opengraphImage: WpImage } | null;

export function mapImage(i: WpImage): Image | null {
  if (!i?.sourceUrl) return null;
  return { src: i.sourceUrl, alt: i.altText ?? "", width: i.mediaDetails?.width ?? 1200, height: i.mediaDetails?.height ?? 800 };
}
export function mapSeo(seo: WpSeo | undefined, fallback: { title: string; excerpt: string; image: Image | null }): SeoFields {
  return {
    title: seo?.title?.trim() || fallback.title,
    description: seo?.metaDesc?.trim() || fallback.excerpt,
    canonical: seo?.canonical || null,
    noindex: seo?.metaRobotsNoindex === "noindex",
    ogImage: mapImage(seo?.opengraphImage ?? null) ?? fallback.image,
  };
}
function stripTags(s: string) { return s.replace(/<[^>]+>/g, "").trim(); }

export function mapPage(n: WpPageNode): Page {
  const image = mapImage(n.featuredImage?.node ?? null);
  const slug = n.uri.split("/").filter(Boolean);
  const excerpt = stripTags(n.excerpt ?? "").slice(0, 160);
  return {
    id: n.id, slug, path: "/" + slug.join("/"), title: n.title, html: sanitizeHtml(n.content ?? ""), excerpt,
    publishedAt: new Date(n.date).toISOString(), updatedAt: new Date(n.modified).toISOString(),
    featuredImage: image, seo: mapSeo(n.seo, { title: n.title, excerpt, image }),
  };
}
export function mapPost(n: WpPostNode): Post { /* same as mapPage, slug is n.slug, path "/blog/"+slug, author n.author?.node?.name ?? null */ }
export function mapPostSummary(n: WpPostNode): PostSummary { const { html: _h, ...rest } = mapPost(n); return rest; }

export function mapMenu(location: MenuLocation, nodes: { id: string; parentId: string | null; label: string; url: string; target: string | null }[], siteUrl: string): Menu {
  const toItem = (n: (typeof nodes)[number]): MenuItem => {
    const external = /^https?:\/\//.test(n.url) && !n.url.startsWith(siteUrl);
    const href = external ? n.url : n.url.replace(siteUrl, "") || "/";
    return { label: n.label, href, external, children: nodes.filter((c) => c.parentId === n.id).map(toItem) };
  };
  return { location, items: nodes.filter((n) => !n.parentId).map(toItem) };
}
export function mapSettings(g: { title: string; description: string; url: string }, siteUrl: string): SiteSettings {
  return { name: g.title, description: g.description, url: siteUrl, logo: null };
}
```
Define `WpPageNode` and `WpPostNode` types matching the fragments. Note `url` in settings comes from `SITE_URL` (the Next site), never the WordPress origin.

`wordpress.test.ts` loads each fixture and asserts the mapped output: SEO present and absent, noindex, image fallback, nested menu, internal versus external hrefs, ISO dates, sanitised HTML.

- [ ] **Step 4: Adapter**

`src/content/adapters/wordpress/index.ts` creates the client, runs the SEO probe lazily once (cached promise), picks the fragment set, and implements every `ContentSource` method with the correct tags: `site`, `menus`, `pages` + `page:<slug>`, `posts` + `post:<slug>`. Preview calls use the `*_PREVIEW` queries with `auth: true` when `opts.preview` is present, and require `opts.preview.id`; without an id, fall back to the published query.

`next.config.ts`:
```ts
import type { NextConfig } from "next";
const wp = process.env.WP_GRAPHQL_URL ? new URL(process.env.WP_GRAPHQL_URL) : null;
const config: NextConfig = {
  images: { remotePatterns: wp ? [{ protocol: wp.protocol.replace(":", "") as "http" | "https", hostname: wp.hostname }] : [] },
};
export default config;
```

- [ ] **Step 5: Gated contract test**

`src/content/adapters/wordpress/wordpress.contract.test.ts`:
```ts
import { describe } from "vitest";
import { runContractTests } from "@/content/source.contract";
import { createWordPressSource } from "./index";
const url = process.env.WP_GRAPHQL_URL;
if (!url) {
  describe.skip("wordpress contract (set WP_GRAPHQL_URL to run)", () => {});
} else {
  runContractTests("wordpress", async () => createWordPressSource({ source: "wordpress", wpUrl: url, siteUrl: process.env.SITE_URL ?? "http://localhost:3000", wpAppUser: process.env.WP_APP_USER, wpAppPassword: process.env.WP_APP_PASSWORD, previewSecret: undefined, revalidateSecret: undefined }));
}
```

Run: `npm test` Expected: mapper tests pass; contract suite shows as skipped with the reason.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Add WPGraphQL adapter with mappers, recorded-response tests and gated contract suite

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Preview routes

**Files:**
- Create: `src/app/api/preview/route.ts`, `src/app/api/preview/exit/route.ts`
- Test: `src/app/api/preview/route.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect, vi } from "vitest";
vi.mock("next/headers", () => ({ draftMode: async () => ({ enable: vi.fn(), disable: vi.fn(), isEnabled: false }) }));
import { GET } from "./route";

function req(qs: string) { return new Request("http://localhost/api/preview?" + qs); }
describe("GET /api/preview", () => {
  it("rejects a wrong secret", async () => {
    process.env.PREVIEW_SECRET = "s";
    expect((await GET(req("secret=bad&type=post&id=1&slug=x"))).status).toBe(401);
  });
  it("rejects missing fields", async () => {
    process.env.PREVIEW_SECRET = "s";
    expect((await GET(req("secret=s"))).status).toBe(400);
  });
  it("redirects to the post url with the id cookie", async () => {
    process.env.PREVIEW_SECRET = "s";
    const res = await GET(req("secret=s&type=post&id=12&slug=hello"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/blog/hello");
  });
});
```

- [ ] **Step 2: Implementation**

`src/app/api/preview/route.ts`:
```ts
import { draftMode } from "next/headers";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  const type = url.searchParams.get("type");
  const id = url.searchParams.get("id");
  const slug = url.searchParams.get("slug");
  const expected = getEnv().previewSecret;
  if (!expected || secret !== expected) return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  if (!type || !id || !slug || !["post", "page"].includes(type)) return NextResponse.json({ error: "type, id and slug are required" }, { status: 400 });
  const dm = await draftMode();
  dm.enable();
  const target = type === "post" ? `/blog/${slug}` : `/${slug}`;
  const res = NextResponse.redirect(new URL(target, url.origin), 307);
  res.cookies.set("preview_id", id, { httpOnly: true, sameSite: "lax", path: "/" });
  return res;
}
```
`exit/route.ts` disables draft mode, clears `preview_id`, redirects to `/`. Update `loaders.ts` `preview()` to read the `preview_id` cookie via `cookies()` and pass it as `id`. Read the installed docs for `draftMode` and cookies on responses.

Run: `npm test -- preview` Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "Add draft preview enter and exit routes

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Revalidation webhook

**Files:**
- Create: `src/app/api/revalidate/route.ts`
- Test: `src/app/api/revalidate/route.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect, vi } from "vitest";
const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({ revalidateTag: (...a: unknown[]) => revalidateTag(...a) }));
import { POST } from "./route";

function req(body: unknown, token = "t") {
  return new Request("http://localhost/api/revalidate", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });
}
describe("POST /api/revalidate", () => {
  it("401 on bad token", async () => { process.env.REVALIDATE_SECRET = "t"; expect((await POST(req({ type: "post", slug: "a" }, "x"))).status).toBe(401); });
  it("400 on malformed body", async () => { process.env.REVALIDATE_SECRET = "t"; expect((await POST(req({ nope: 1 }))).status).toBe(400); });
  it("revalidates post tags", async () => {
    process.env.REVALIDATE_SECRET = "t";
    const res = await POST(req({ type: "post", slug: "a" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ revalidated: ["posts", "post:a"] });
    expect(revalidateTag).toHaveBeenCalledWith("post:a", expect.anything());
  });
});
```
If the installed Next version's `revalidateTag` takes one argument, change the last assertion to `toHaveBeenCalledWith("post:a")`.

- [ ] **Step 2: Implementation**

```ts
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";

const TYPES = { post: (s?: string) => ["posts", ...(s ? [`post:${s}`] : [])], page: (s?: string) => ["pages", ...(s ? [`page:${s}`] : [])], menu: () => ["menus"], site: () => ["site"], all: () => ["site", "menus", "pages", "posts"] } as const;

export async function POST(request: Request) {
  const expected = getEnv().revalidateSecret;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || token !== expected) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { type?: string; slug?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const build = TYPES[body.type as keyof typeof TYPES];
  if (!build) return NextResponse.json({ error: "type must be one of post, page, menu, site, all" }, { status: 400 });
  const tags = build(body.slug);
  for (const t of tags) revalidateTag(t, "max"); // match the installed Next docs for the second argument
  return NextResponse.json({ revalidated: tags });
}
```
Run: `npm test -- revalidate` Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "Add tag-based revalidation webhook

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: Environment example and documentation

**Files:**
- Create: `.env.example`, `README.md` (replace scaffold), `docs/local-wordpress.md`, `docs/wordpress-setup.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `LICENSE` (MIT, Talha Muneer, 2026)

- [ ] **Step 1: `.env.example`**

```bash
# fixture (default) or wordpress
CONTENT_SOURCE=fixture
# Public base URL of THIS site. Drives canonical, sitemap, robots and schema.
SITE_URL=http://localhost:3000
# WPGraphQL endpoint, required when CONTENT_SOURCE=wordpress
WP_GRAPHQL_URL=
# Application password for draft preview (WordPress > Users > Profile > Application Passwords)
WP_APP_USER=
WP_APP_PASSWORD=
# Shared secret in preview links: /api/preview?secret=...&type=post&id=12&slug=hello
PREVIEW_SECRET=
# Bearer token WordPress sends to POST /api/revalidate
REVALIDATE_SECRET=
```

- [ ] **Step 2: README**

Sections in order: title and one-line pitch; demo link; what you get (bullets); quick start (three commands, fixture mode); connect WordPress (plugins: WPGraphQL required, WPGraphQL for Yoast SEO or Rank Math optional; the five-line `register_nav_menus` snippet; env values); editor preview (application password, preview URL format, a WordPress snippet that adds a Preview button linking to the Next site); revalidation (the `wp_after_insert_post` hook snippet that POSTs to `/api/revalidate`, or the WPGraphQL Smart Cache plugin alternative); deploy to Vercel (import repo, set env, done); project structure; adding an adapter (implement the interface, add to the factory, run the contract suite); known trade-offs (cursor pagination, no block map yet); roadmap; licence.

`docs/wordpress-setup.md` holds the full PHP snippets. `docs/local-wordpress.md` covers XAMPP on Windows: start Apache and MySQL, create database, install WordPress into `htdocs/headless`, install WPGraphQL, set permalinks to post name, register menus, create an application password, set `WP_GRAPHQL_URL=http://localhost/headless/graphql`, run `npm test` to see the contract suite execute.

Lint the docs: `grep -nP '[\x{2014}\x{2013}!]' README.md docs/*.md` must be empty (use `grep -n $'\xe2\x80\x94\|\xe2\x80\x93\|!'` on Windows Git Bash).

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "Add README, WordPress setup docs, env example, licence and changelog

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 13: CI with Lighthouse budget

**Files:**
- Create: `.github/workflows/ci.yml`, `lighthouserc.json`

- [ ] **Step 1: Lighthouse config**

`lighthouserc.json`:
```json
{
  "ci": {
    "collect": {
      "startServerCommand": "npm run start",
      "startServerReadyPattern": "Ready",
      "url": ["http://localhost:3000/", "http://localhost:3000/blog", "http://localhost:3000/about/team", "http://localhost:3000/blog/launching-a-site-in-a-week"],
      "numberOfRuns": 2,
      "settings": { "preset": "mobile" }
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "categories:best-practices": ["error", { "minScore": 0.95 }],
        "categories:seo": ["error", { "minScore": 1 }]
      }
    },
    "upload": { "target": "temporary-public-storage" }
  }
}
```
Replace the post slug with a real fixture slug.

- [ ] **Step 2: Workflow**

`.github/workflows/ci.yml`:
```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  verify:
    runs-on: ubuntu-latest
    env:
      CONTENT_SOURCE: fixture
      SITE_URL: http://localhost:3000
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run format:check
      - run: npm test
      - run: npm run build
      - run: npx lhci autorun
```

- [ ] **Step 3: Run Lighthouse locally once**

Run: `npm run build && npx lhci autorun`
Expected: all four URLs pass the budget. If performance misses on the post page, the usual causes are unsized images in fixture HTML (add width and height) or the Prose CSS; fix and re-run until green.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Add CI workflow with type, lint, test, build and Lighthouse budget

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 14: Local WordPress integration run (developer action)

**Files:** none in the repo beyond `docs/local-wordpress.md` from Task 12.

- [ ] **Step 1: Stand up WordPress on XAMPP** following `docs/local-wordpress.md`. PHP is at `C:\Development\xampp\php\php.exe`; MySQL ships with the same XAMPP.
- [ ] **Step 2: Create content**: three pages (one nested), three posts (one without featured image), a primary and footer menu, and install WPGraphQL. Optional: Yoast SEO and its WPGraphQL extension to exercise the SEO path.
- [ ] **Step 3: Record responses** for the fixtures in Task 9 by running each query against `/graphql` and saving the JSON, replacing the hand-written ones. Re-run `npm test`.
- [ ] **Step 4: Run the gated contract suite**: `WP_GRAPHQL_URL=http://localhost/headless/graphql npm test`. Expected: wordpress contract passes.
- [ ] **Step 5: Exercise preview and revalidation by hand**: start `npm run dev` with `CONTENT_SOURCE=wordpress`, open a preview link for a draft post, confirm the draft renders with the preview bar; publish a post, `curl -X POST -H "Authorization: Bearer <secret>" -d '{"type":"post","slug":"<slug>"}' http://localhost:3000/api/revalidate`, confirm the blog index updates.
- [ ] **Step 6: Commit** the recorded fixtures.

---

### Task 15: Publish, demo and profile row

- [ ] **Step 1: Secrets scan**: `gitleaks git --no-banner --exit-code 1 .` Expected: no leaks.
- [ ] **Step 2: Create the repo**

```bash
gh repo create talha55/next-headless-starter --public --source=. --remote=origin --push --description "Next.js 16 starter for headless WordPress: typed content layer, WPGraphQL adapter, preview, instant revalidation, SEO, tests and a Lighthouse budget in CI"
gh repo edit talha55/next-headless-starter --add-topic nextjs,headless-cms,wordpress,wpgraphql,starter,typescript --enable-wiki=false
gh api -X PATCH repos/talha55/next-headless-starter -f is_template=true
```
- [ ] **Step 3: Confirm CI is green** on the first push: `gh run watch`.
- [ ] **Step 4: Deploy the demo**: `npx vercel link` then `npx vercel --prod` with `CONTENT_SOURCE=fixture` and `SITE_URL` set to the production URL in the Vercel project settings. Then connect the Vercel project to the GitHub repo in the Vercel dashboard for preview deploys (Talha's click) and note the demo URL in the README; commit and push.
- [ ] **Step 5: Verify**: open the demo in the browser pane, check `/`, `/blog`, a post, `/sitemap.xml`, `/robots.txt`; every README link returns 200.
- [ ] **Step 6: Profile README row**: in `github-profile/profile/README.md`, replace the "Open source" placeholder line with a table row: name, one line, link. Commit (push happens with the phase 3 flip).
- [ ] **Step 7: Tag `v1.0.0`** and add a GitHub release with the changelog entry.

---

## Self-review notes

- Spec coverage: content layer (T2, T4, T9), sanitiser (T3), routes (T7, T8), preview (T10), revalidation (T11), SEO (T5, T6, T7), tests and CI (T4, T9, T13), local WordPress (T14), docs (T12), demo and release (T15), environment variables (T2, T12), error handling (T2 errors, T9 client, T11 responses).
- Placeholders: Task 9 mapPost body is described rather than written because it duplicates mapPage with three field changes stated inline; Task 6 Footer, Breadcrumbs, PostCard and PreviewBar are described in one line each because they are trivial markup. Everything else has code.
- Type consistency: `ContentSource` method names match across T2, T4, T7, T8, T9. `PreviewContext.id` is set in T10 and consumed in T9. Tags named in T9 match T11.
