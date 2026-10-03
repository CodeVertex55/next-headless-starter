# Changelog

## 1.0.0 (unreleased)

First release. Requires Node.js 22 or later.

- Next.js 16 App Router site with a swappable content layer behind a `ContentSource` interface.
- Fixture adapter with a sample site, Northfield Studio (seven pages, including the privacy notice the footer links to, and eight posts). It needs no configuration and is the default.
- WordPress adapter for WPGraphQL: pages (including nested pages), posts, menus and site settings. Pages whose first segment is `blog` or `api` are left out, because the app's own routes own those paths.
- Yoast SEO support through WPGraphQL for Yoast SEO, detected with an ordinary query that selects a Yoast-only field, so it works with introspection off. Any schema without the Yoast fields runs without SEO fields. Rank Math is not supported yet; it is planned for 1.1.
- SEO plugin titles are used as complete document titles, so the site name is not appended twice. Without an SEO plugin, the home page title is the site name instead of the bare page title.
- Tag-based caching (3600 seconds) and a `POST /api/revalidate` webhook that expires tags at once, so the next request gets fresh content. The documented save hook also purges the old slug when a post is renamed or trashed.
- Draft preview through `/api/preview` and `/api/preview/exit`, authenticated with a WordPress application password. The draft is shown only on the page being previewed; other pages show their published versions.
- Slugs with underscores are accepted by the preview and revalidation routes.
- Blog index with numbered pagination over WPGraphQL cursors.
- Metadata, canonical URLs, Open Graph, JSON-LD with absolute image URLs, `sitemap.xml` and `robots.txt`.
- `SITE_URL` is required for production deployments. On Vercel it falls back to the production domain. Otherwise it defaults to `http://localhost:3000`, and a production build or server logs a warning.
- Featured images from a WordPress on `localhost`, `127.0.0.1` or `[::1]` work in development and in production builds.
- WordPress-aware HTML sanitiser for post and page content.
- Shared contract test suite, `runContractTests`, that any adapter can run.
- Documentation for WordPress setup, including the static front page, and for running WordPress locally.
