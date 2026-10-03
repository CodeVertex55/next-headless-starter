# Changelog

## 1.0.0 (unreleased)

First release.

- Next.js 16 App Router site with a swappable content layer behind a `ContentSource` interface.
- Fixture adapter with a sample site, Northfield Studio (six pages, eight posts). It needs no configuration and is the default.
- WordPress adapter for WPGraphQL: pages (including nested pages), posts, menus and site settings.
- Yoast SEO support through WPGraphQL for Yoast SEO, detected with an ordinary query (a Yoast-only field) so it works with introspection off. Rank Math is not supported yet; it is planned for 1.1.
- Tag-based caching (3600 seconds) and a `POST /api/revalidate` webhook that invalidates by tag.
- Draft preview through `/api/preview` and `/api/preview/exit`, authenticated with a WordPress application password.
- Blog index with numbered pagination over WPGraphQL cursors.
- Metadata, canonical URLs, Open Graph, JSON-LD, `sitemap.xml` and `robots.txt`.
- WordPress-aware HTML sanitiser for post and page content.
- Shared contract test suite, `runContractTests`, that any adapter can run.
- Documentation for WordPress setup and for a local XAMPP install on Windows.
