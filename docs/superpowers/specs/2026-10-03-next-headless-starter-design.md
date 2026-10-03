# next-headless-starter: Design Spec

Date: 2026-10-03
Owner: Talha Muneer
Repo: `talha55/next-headless-starter` (public, MIT, GitHub template repo)
Parent project: GitHub profile overhaul, phase 6, project 1 of 5

## 1. Goal

A production-grade starter for agencies building headless WordPress sites on Next.js. Clone it, point it at a WordPress with WPGraphQL, and you have pages, posts, menus, SEO, editor preview, instant revalidation and a CI pipeline with a performance budget, on day one.

It must run with zero configuration (fixture content) so the public demo and the first `npm run dev` just work, and it must be structured so a second CMS adapter is an addition, not a rewrite.

Audience: agency developers. Secondary: Talha's own future builds.

## 2. Non-goals (version 1)

- Gutenberg block component map (planned follow-up release 1.1)
- Site search, contact forms, internationalisation
- Shopify, Webflow or any second adapter (the interface is designed for them; none ships)
- Authentication, comments, e-commerce
- A design system. The UI is deliberately plain and easy to delete.

## 3. Stack

- Next.js 16 (App Router, Turbopack), React 19, TypeScript strict
- Tailwind CSS v4
- Vitest for tests, MSW for recorded WPGraphQL responses
- ESLint (Next config) and Prettier
- GitHub Actions, Lighthouse CI
- Vercel for the demo and preview deploys
- Node 22 or later

## 4. Architecture

```
src/
  app/                     routes (see section 6)
  content/
    types.ts               Page, Post, Menu, MenuItem, SeoFields, Image, SiteSettings, Paginated<T>
    source.ts              ContentSource interface + getContentSource() factory
    adapters/
      fixture/             reads JSON from src/content/adapters/fixture/data/
      wordpress/           WPGraphQL client, queries, mappers
  components/              Layout, Nav, Footer, Prose, PostCard, Pagination, JsonLd, Breadcrumbs
  lib/
    site.ts                SITE_URL, SITE_NAME, defaults for SEO
    seo.ts                 metadata builders and JSON-LD builders
    html.ts                sanitiser for post/page HTML
    env.ts                 validated environment access
```

### 4.1 Content interface

```ts
interface ContentSource {
  getSiteSettings(): Promise<SiteSettings>
  getMenu(location: "primary" | "footer"): Promise<Menu>
  getPage(slug: string[], opts?: { preview?: PreviewContext }): Promise<Page | null>
  getPageSlugs(): Promise<string[][]>
  getPost(slug: string, opts?: { preview?: PreviewContext }): Promise<Post | null>
  getPosts(params: { page: number; perPage: number }): Promise<Paginated<PostSummary>>
  getPostSlugs(): Promise<string[]>
}
```

Types are CMS-neutral. `Page` and `Post` carry `id`, `title`, `html` (sanitised), `excerpt`, `publishedAt`, `updatedAt`, `featuredImage: Image | null`, `seo: SeoFields`. `Page` additionally carries `slug: string[]` and `path: string` (for example `["about","team"]` and `/about/team`); `Post` carries `slug: string`. `SeoFields` has `title`, `description`, `canonical`, `noindex`, `ogImage`. `Image` has `src`, `alt`, `width`, `height`. `Menu` has `items: MenuItem[]` with `label`, `href`, `children`, `external`. `Paginated<T>` has `items`, `page`, `perPage`, `total`, `totalPages`.

`PreviewContext` is `{ secretVerified: true; id?: string }`. Adapters that cannot preview ignore it.

### 4.2 Adapter selection

`getContentSource()` reads `CONTENT_SOURCE` (`fixture` default, or `wordpress`) once and returns a singleton. Unknown values throw at startup with a clear message. `env.ts` validates: `wordpress` requires `WP_GRAPHQL_URL`; preview requires `PREVIEW_SECRET`; revalidation requires `REVALIDATE_SECRET`.

### 4.3 Fixture adapter

Reads typed JSON files: `site.json`, `menus.json`, `pages/*.json`, `posts/*.json`. Content is a realistic small-business site (about six pages, eight posts, two menus) with local images under `public/fixture/`. HTML in fixtures uses the same subset of elements WordPress emits (headings, paragraphs, lists, figures, blockquotes, tables, links, code), so Prose styling is exercised fully.

### 4.4 WordPress adapter

- Single `fetch`-based GraphQL client with a `gql` tag for readability, no codegen in version 1. Each query lives in `queries.ts`; each mapper in `mappers.ts` turns a raw response into the neutral types.
- Requires WPGraphQL. Detects and maps SEO fields when the WPGraphQL for Yoast SEO or Rank Math extension is present, by requesting the `seo` field and tolerating its absence (two query variants, chosen by a one-time schema probe cached per process).
- Menus come from WPGraphQL `menus(where: { location })`. Locations `PRIMARY` and `FOOTER` must be registered in the theme; the README documents a five-line `functions.php` snippet.
- Preview: `getPage` and `getPost` with a `PreviewContext` query by database id with `asPreview: true`, using an application password sent as Basic auth from `WP_APP_USER` and `WP_APP_PASSWORD`. Never exposed to the client.
- Requests use `fetch` with `next: { tags }` so revalidation is tag-based: `site`, `menus`, `pages`, `page:<slug>`, `posts`, `post:<slug>`. Timed fallback `revalidate: 3600` on every tagged fetch.
- Images: `next.config` adds `remotePatterns` from `WP_GRAPHQL_URL`'s host so `next/image` can serve media.

### 4.5 HTML sanitising

`lib/html.ts` wraps `sanitize-html` with an allowlist matching WordPress core block output (no scripts, no inline event handlers, `iframe` only from an allowlisted set of embed hosts, `img` with `loading="lazy"` enforced). Both adapters pass HTML through it so the Prose component never trusts raw CMS output.

## 5. Routes

| Route | Behaviour |
|---|---|
| `/` | Front page: page with slug `home` from the adapter, rendered through the same Page template |
| `/[...slug]` | Nested pages; `generateStaticParams` from `getPageSlugs` |
| `/blog` and `/blog/page/[n]` | Paginated post index, 10 per page |
| `/blog/[slug]` | Single post with Article JSON-LD and breadcrumbs |
| `/api/preview?secret=&type=&id=&slug=` | Verifies secret, enables draft mode, redirects to the content URL |
| `/api/preview/exit` | Disables draft mode |
| `/api/revalidate` | POST, `Authorization: Bearer <REVALIDATE_SECRET>`, body `{ type, slug }`; revalidates the matching tags; returns what it revalidated |
| `/sitemap.xml` | All page and post URLs with `lastModified` |
| `/robots.txt` | Allow all, sitemap link, disallow `/api/` |
| `/opengraph-image` | Default OG image rendered from site name |
| `not-found` | Styled 404 |

Draft mode: when `draftMode().isEnabled`, page and post loaders pass `PreviewContext` and the layout shows an "exit preview" bar.

## 6. SEO

- `generateMetadata` on every content route builds title, description, canonical, robots and Open Graph from `SeoFields` with site defaults from `lib/site.ts`.
- JSON-LD: `WebSite` and `Organization` in the root layout, `Article` on posts, `BreadcrumbList` on nested pages and posts. Built in `lib/seo.ts`, rendered by one `JsonLd` component.
- One `SITE_URL` constant drives canonical, sitemap, robots and schema.

## 7. Quality gates

### 7.1 Tests (Vitest)

- `content/types` and mappers: unit tests on recorded WPGraphQL responses (JSON under `src/content/adapters/wordpress/__fixtures__/`), covering pages, posts with and without featured image, SEO present and absent, menus with nesting, pagination edge cases.
- Contract test suite `content/source.contract.test.ts` runs the same assertions against any `ContentSource`. Fixture adapter runs always. WordPress adapter runs when `WP_GRAPHQL_URL` is set (integration) and is otherwise skipped with a visible reason.
- `lib/html.ts`: strips scripts and handlers, keeps allowed embeds, enforces lazy images.
- `/api/revalidate` and `/api/preview`: route handler tests for wrong secret, missing fields, correct tags.

### 7.2 CI (GitHub Actions, on pull request and push to main)

1. Install (npm ci, cached)
2. Type-check (`tsc --noEmit`)
3. Lint and format check
4. Unit and contract tests
5. Build in fixture mode
6. Lighthouse CI against `next start` on `/`, `/blog`, one page, one post; mobile; budget: performance 90 or higher, accessibility 95 or higher, best practices 95 or higher, SEO 100. Failing budget fails the job.

### 7.3 Local WordPress for integration

Documented in `docs/local-wordpress.md`: XAMPP (PHP and MySQL on this machine), WordPress install, WPGraphQL plugin, two menu locations registered, an application password for preview, and the webhook plugin configuration. The integration run is a developer action, not CI.

## 8. Demo

Deployed on Vercel from `main` in fixture mode at a public `vercel.app` URL, linked from the README and from Talha's profile README. Preview deploys for pull requests through the Vercel Git integration. No WordPress is exposed publicly.

## 9. Documentation

README sections: what it is, demo link, quick start (fixture), connect WordPress (plugins, env, menu locations, SEO plugin note), editor preview setup, revalidation webhook setup (with the WP-side snippet or a recommended plugin), deploying to Vercel, project structure, adding an adapter, roadmap (block map next), licence.

Also `docs/local-wordpress.md`, `.env.example` with every variable commented, `CONTRIBUTING.md` (short), and a `CHANGELOG.md` starting at 1.0.0.

## 10. Environment variables

| Name | Required | Purpose |
|---|---|---|
| `CONTENT_SOURCE` | no, default `fixture` | `fixture` or `wordpress` |
| `SITE_URL` | yes in production | canonical base URL |
| `WP_GRAPHQL_URL` | with `wordpress` | WPGraphQL endpoint |
| `WP_APP_USER`, `WP_APP_PASSWORD` | for preview | application password for draft fetches |
| `PREVIEW_SECRET` | for preview | shared secret in the preview URL |
| `REVALIDATE_SECRET` | for webhook | bearer token for `/api/revalidate` |

## 11. Error handling

- Adapter errors surface as typed `ContentError` with `code` (`network`, `graphql`, `not_found`, `config`). Routes map `not_found` to `notFound()`, everything else to a thrown error (Next error boundary) with the message logged server-side and never rendered to visitors.
- Fixture adapter never throws for missing content; it returns `null` like the WordPress adapter.
- Revalidate endpoint responds 401 on a bad secret, 400 on a malformed body, 200 with `{ revalidated: string[] }` otherwise.

## 12. Verification before release

- CI green on main, Lighthouse budget met.
- Contract tests pass against the local XAMPP WordPress with preview and webhook exercised by hand once.
- Demo deployed; every README link returns 200.
- `gitleaks` clean; `.env.example` contains no real values.
- Repo marked as template; topics set: `nextjs`, `headless-cms`, `wordpress`, `wpgraphql`, `starter`, `typescript`.
- Profile README "Open source" section gains its first row.
