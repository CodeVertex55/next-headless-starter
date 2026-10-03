# next-headless-starter

A Next.js 16 starter for headless WordPress, with a swappable content layer and a built-in sample site.

Demo: [next-headless-starter.vercel.app](https://next-headless-starter.vercel.app) <!-- update after deploy -->

## What you get

- Next.js 16 App Router, React 19 and Tailwind CSS 4.
- A `ContentSource` interface, so WordPress is one adapter and not a hard dependency.
- A fixture adapter with a sample site, Northfield Studio, that runs with no configuration.
- A WPGraphQL adapter for pages, nested pages, posts, menus and site settings.
- Yoast SEO fields, with canonical URLs, Open Graph, JSON-LD, a sitemap and `robots.txt`.
- Draft preview for editors, using a WordPress application password.
- Tag-based caching and a revalidation webhook, so edits go live without a rebuild.
- A WordPress-aware HTML sanitiser for content from the editor.
- A shared contract test suite that every adapter can run.

## Quick start

The default content source is the fixture adapter. You need Node.js 22 or later.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. You see Northfield Studio, a sample site with seven pages and eight posts. No WordPress is needed.

## Connect WordPress

### Plugins

- [WPGraphQL](https://wordpress.org/plugins/wp-graphql/) is required.
- [WPGraphQL for Yoast SEO](https://github.com/ashhitch/wp-graphql-yoast-seo), with Yoast SEO, is optional. It adds SEO fields. Yoast is the only SEO plugin supported in 1.0. Rank Math support is planned for 1.1.
- The WPGraphQL Offset Pagination extension is optional. It makes the blog total cheaper.

The adapter detects the Yoast fields with an ordinary query, not introspection, which WPGraphQL disables by default. When WordPress rejects the query, the site runs without SEO fields. If WordPress cannot be reached for the check, pages render without SEO fields until the next revalidation, up to one hour, and one warning is logged.

### Menu locations

The theme must register the `primary` and `footer` menu locations. WPGraphQL exposes them as `PRIMARY` and `FOOTER`. Without them `getMenu` fails and every page errors. Add this to your theme or a must-use plugin, then assign a menu to each location:

```php
add_action( 'after_setup_theme', function () {
	register_nav_menus( array(
		'primary' => 'Primary',
		'footer'  => 'Footer',
	) );
} );
```

### Front page

Go to Settings > Reading, choose "A static page" under "Your homepage displays", and set Homepage to the page you want as the home page. Whatever its slug, WordPress gives that page the URI `/`, and the starter serves it at `/`. Without one, `/` shows a 404 unless a page has the slug `home`.

### Environment

Set these in `.env.local` for development, or in your host's settings for production.

| Variable            | Required                   | Purpose                                                                                                                                                                                                                                                                     |
| ------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CONTENT_SOURCE`    | No                         | `fixture` (default) or `wordpress`                                                                                                                                                                                                                                          |
| `SITE_URL`          | For production deployments | Public URL of this site. Drives canonical URLs, sitemap, robots and schema. Required for production deployments; on Vercel it falls back to `https://` plus `VERCEL_PROJECT_PRODUCTION_URL`. Otherwise it defaults to `http://localhost:3000`, with a warning in production |
| `WP_GRAPHQL_URL`    | With `wordpress`           | WPGraphQL endpoint, for example `https://cms.example.com/graphql`                                                                                                                                                                                                           |
| `WP_APP_USER`       | For preview                | WordPress user that owns the application password                                                                                                                                                                                                                           |
| `WP_APP_PASSWORD`   | For preview                | Application password                                                                                                                                                                                                                                                        |
| `PREVIEW_SECRET`    | For preview                | Shared secret in preview links                                                                                                                                                                                                                                              |
| `REVALIDATE_SECRET` | For revalidation           | Bearer token WordPress sends to `/api/revalidate`                                                                                                                                                                                                                           |

A minimal WordPress setup:

```bash
CONTENT_SOURCE=wordpress
SITE_URL=http://localhost:3000
WP_GRAPHQL_URL=https://cms.example.com/graphql
```

The full guide, with every snippet, is in [docs/wordpress-setup.md](docs/wordpress-setup.md). To run WordPress on your own machine, see [docs/local-wordpress.md](docs/local-wordpress.md).

## Editor preview

Preview shows drafts on the Next.js site. It needs an application password: in WordPress, go to Users > Profile > Application Passwords, create one and set `WP_APP_USER` and `WP_APP_PASSWORD`. Also set `PREVIEW_SECRET`.

The preview URL looks like this:

```text
/api/preview?secret=<PREVIEW_SECRET>&type=post|page&id=<WordPress database id>&slug=<slug or nested/page/path>
```

The slug may contain letters, digits, hyphens, underscores and `/`. Non-ASCII slugs are rejected. The front page previews at `/` when its slug is `home`. Exit preview at `/api/preview/exit`.

Behind a TLS-terminating proxy that forwards plain http, the preview cookie is not marked Secure. Set the proxy to forward the original protocol.

To make the Preview button in the WordPress editor open the Next.js site, add the constants below to `wp-config.php`, then add the filter:

```php
define( 'NEXT_SITE_URL', 'https://your-site.example' );
define( 'NEXT_PREVIEW_SECRET', 'same value as PREVIEW_SECRET' );
define( 'NEXT_REVALIDATE_SECRET', 'same value as REVALIDATE_SECRET' );
```

```php
add_filter( 'preview_post_link', function ( $link, $post ) {
	if ( false === in_array( $post->post_type, array( 'post', 'page' ), true ) ) {
		return $link;
	}
	$slug = 'page' === $post->post_type ? get_page_uri( $post ) : $post->post_name;

	// The preview loads by id, so the slug only has to pass the Next.js check.
	// Drafts with no slug yet and non-ASCII slugs fall back to a placeholder.
	if ( 0 === preg_match( '/^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*$/i', (string) $slug ) ) {
		$slug = 'draft-' . $post->ID;
	}

	return add_query_arg(
		array(
			'secret' => NEXT_PREVIEW_SECRET,
			'type'   => $post->post_type,
			'id'     => $post->ID,
			'slug'   => $slug,
		),
		untrailingslashit( NEXT_SITE_URL ) . '/api/preview'
	);
}, 10, 2 );
```

## Revalidation

Content is cached for 3600 seconds and tagged. The webhook expires the tagged entries at once, so the next request waits for fresh content instead of being served the stale copy.

```text
POST /api/revalidate
Authorization: Bearer <REVALIDATE_SECRET>
```

```json
{ "type": "post", "slug": "hello-world" }
```

- `type` is `post`, `page`, `menu`, `site` or `all`.
- `slug` is optional. Page slugs are the WordPress URI without edge slashes. `/` is the front page and maps to the home page.
- The response is `{ "revalidated": [tags], "paths": ["/sitemap.xml"] }` when pages or posts were touched.

Add this to a must-use plugin to send the webhook whenever a post or page is saved. When a save renames a post or moves it to the trash, it also purges the old slug:

```php
function next_revalidate( $type, $slug = null ) {
	$body = array( 'type' => $type );
	if ( is_string( $slug ) ) {
		$body['slug'] = $slug;
	}
	wp_remote_post(
		untrailingslashit( NEXT_SITE_URL ) . '/api/revalidate',
		array(
			'timeout'  => 5,
			'blocking' => false,
			'headers'  => array(
				'Authorization' => 'Bearer ' . NEXT_REVALIDATE_SECRET,
				'Content-Type'  => 'application/json',
			),
			'body'     => wp_json_encode( $body ),
		)
	);
}

add_action( 'wp_after_insert_post', function ( $post_id, $post, $update, $post_before ) {
	if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
		return;
	}
	if ( false === in_array( $post->post_type, array( 'post', 'page' ), true ) ) {
		return;
	}

	// Skip changes that never touched public content, such as a draft saving over a draft.
	$is_public  = 'publish' === $post->post_status;
	$was_public = $post_before instanceof WP_Post && 'publish' === $post_before->post_status;
	if ( false === $is_public && false === $was_public ) {
		return;
	}

	if ( 'page' === $post->post_type ) {
		// The front page is "/" on the Next.js side, which maps to the home page.
		$slug = (int) get_option( 'page_on_front' ) === (int) $post_id ? '/' : get_page_uri( $post );
	} else {
		$slug = $post->post_name;
	}
	next_revalidate( $post->post_type, $slug );

	// A rename, or a move to the trash (WordPress appends "__trashed" to the slug), leaves the old
	// slug cached on the Next.js side, so purge it too.
	if ( $post_before instanceof WP_Post && '/' !== $slug ) {
		$old_slug = 'page' === $post->post_type ? get_page_uri( $post_before ) : $post_before->post_name;
		if ( is_string( $old_slug ) && '' !== $old_slug && $old_slug !== $slug ) {
			next_revalidate( $post->post_type, $old_slug );
		}
	}
}, 10, 4 );
```

The WPGraphQL Smart Cache plugin is an alternative way to decide when to call the webhook. See [docs/wordpress-setup.md](docs/wordpress-setup.md) for menu and site setting hooks and a curl test.

## Deploy to Vercel

1. Import the repository in Vercel.
2. Set the environment variables from the table above.
3. Deploy.

Set `SITE_URL` to your production URL. If you leave it unset, the site uses `https://` plus the `VERCEL_PROJECT_PRODUCTION_URL` that Vercel provides. Point the PHP snippets in WordPress at the same URL.

## Project structure

```text
src/
  app/            Routes, the preview and revalidate API routes, sitemap and robots
  components/     Navigation, prose, pagination and JSON-LD components
  content/        The ContentSource interface, types and the contract test suite
    adapters/
      fixture/    Sample site data and adapter
      wordpress/  WPGraphQL client, queries, mappers and adapter
  lib/            Environment, site constants, SEO builders and the HTML sanitiser
docs/             WordPress setup and local WordPress guides
```

## Adding an adapter

1. Implement `ContentSource` from `src/content/source.ts`. Put it in `src/content/adapters/<name>/`.
2. Add a branch for it to `getContentSource()` in `src/content/source.ts`, and add the name to the list in `src/lib/env.ts`.
3. Run `runContractTests` from `src/content/source.contract.ts` against it.

```ts
import { runContractTests } from "@/content/source.contract";
import { createMySource } from "./index";

runContractTests("my-source", async () => createMySource());
```

## Known trade-offs

- WPGraphQL is cursor-based. The adapter fetches posts from the start in batches of 100 and slices out the page you asked for. It reads the total from the WPGraphQL Offset Pagination extension when installed, and otherwise counts all slugs. This is fine for hundreds of posts, not thousands.
- The sitemap reads every page and post individually. A large site may want a dedicated listing query.
- There is no Gutenberg block component map yet. Content renders as sanitised HTML.

## Roadmap

- 1.1: a Gutenberg block component map, and Rank Math SEO support.
- Later: search, forms, i18n, and Shopify and Webflow adapters.

## Licence

MIT. See [LICENSE](LICENSE).
