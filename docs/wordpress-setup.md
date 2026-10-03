# WordPress setup

This guide covers everything WordPress needs to feed this starter. For a local install on Windows, see [local-wordpress.md](local-wordpress.md).

## Requirements

- WordPress with pretty permalinks (Settings > Permalinks > Post name).
- The [WPGraphQL](https://wordpress.org/plugins/wp-graphql/) plugin. It is required.
- Optional: [Yoast SEO](https://wordpress.org/plugins/wordpress-seo/) with [WPGraphQL for Yoast SEO](https://github.com/ashhitch/wp-graphql-yoast-seo). Without them, pages render without SEO fields. Yoast is the only SEO plugin supported in 1.0. Rank Math support is planned for 1.1.
- Optional: the WPGraphQL Offset Pagination extension. It makes the blog index total cheaper on large sites.

## PHP snippets

Every snippet on this page goes in one file. The easiest place is a must-use plugin, which loads before themes and survives a theme change.

Create `wp-content/mu-plugins/headless.php`. Start it with `<?php`, then add the snippets below in order.

If you prefer, put them in your theme's `functions.php` instead.

### Settings in wp-config.php

Add these three constants to `wp-config.php`, above the line that says to stop editing. The snippets read them.

```php
define( 'NEXT_SITE_URL', 'https://your-site.example' );
define( 'NEXT_PREVIEW_SECRET', 'same value as PREVIEW_SECRET' );
define( 'NEXT_REVALIDATE_SECRET', 'same value as REVALIDATE_SECRET' );
```

The two secrets must match `PREVIEW_SECRET` and `REVALIDATE_SECRET` in the Next.js environment.

## Menu locations

The theme must register the `primary` and `footer` menu locations. WPGraphQL exposes them as `PRIMARY` and `FOOTER`. Without them `getMenu` fails and every page errors.

```php
add_action( 'after_setup_theme', function () {
	register_nav_menus( array(
		'primary' => 'Primary',
		'footer'  => 'Footer',
	) );
} );
```

Then go to Appearance > Menus, build a menu for each location and assign it. The contract suite expects the primary menu to have at least one item.

Menu links written against the WordPress home URL are turned into paths on the Next.js site.

## Front page

Go to Settings > Reading, choose "A static page" under "Your homepage displays", and set Homepage to the page you want as the home page. Whatever its slug, WordPress gives that page the URI `/`, and the starter serves it at `/`. Without one, `/` shows a 404 unless a page has the slug `home`.

## Environment values

| Variable | Value |
| --- | --- |
| `CONTENT_SOURCE` | `wordpress` |
| `SITE_URL` | The public URL of the Next.js site, for example `https://example.com`. Required in production; on Vercel it falls back to the production domain |
| `WP_GRAPHQL_URL` | Your WPGraphQL endpoint, usually `https://cms.example.com/graphql` |
| `WP_APP_USER` | The WordPress user the application password belongs to |
| `WP_APP_PASSWORD` | The application password, used for draft preview only |
| `PREVIEW_SECRET` | A long random string shared with the preview snippet |
| `REVALIDATE_SECRET` | A long random string shared with the revalidation snippet |

Generate a secret with `openssl rand -hex 32`.

## SEO fields

The adapter checks whether the Yoast fields exist with an ordinary GraphQL query that selects a Yoast-only field. It does not use introspection, because WPGraphQL disables introspection by default.

If WordPress rejects the query, the adapter treats Yoast as absent and renders pages without SEO fields. Another SEO plugin that exposes its own `seo` field, such as a Rank Math integration, is treated the same way, so it never breaks a page.

If the check cannot reach WordPress, for example the endpoint is down at that moment, pages render without SEO fields until the next revalidation, which is up to one hour. The adapter logs one warning when this happens and checks again on the next request.

Canonical URLs that Yoast writes against the WordPress origin are dropped, so they never point search engines at your CMS.

## Draft preview

Preview needs an application password. Create one in WordPress under Users > Profile > Application Passwords and put the user name and password in `WP_APP_USER` and `WP_APP_PASSWORD`.

The preview URL has this format:

```text
/api/preview?secret=<PREVIEW_SECRET>&type=post|page&id=<WordPress database id>&slug=<slug or nested/page/path>
```

- `type` is `post` or `page`.
- `id` is the WordPress database id, a whole number.
- `slug` may contain letters, digits, hyphens, underscores and `/`. Non-ASCII slugs are rejected.
- A post opens at `/blog/<slug>` and a page at `/<slug>`.

The route enables Next.js draft mode and sets a `preview_id` cookie that names the item and the path it opens at, so that page loads the draft by id. Other pages you visit while previewing show their published versions. Exit preview at `/api/preview/exit`.

Behind a TLS-terminating proxy that forwards plain http to Next.js, the preview cookie is not marked Secure. Set the proxy to forward the original protocol, for example with the `X-Forwarded-Proto` header.

To make the Preview button in the editor open the Next.js site, add this snippet:

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

Drafts can have an empty slug, and the preview loads by id, so the snippet falls back to a placeholder slug in that case.

## Revalidation

Content is cached for 3600 seconds and tagged. The webhook expires the tagged entries at once, so an edit shows up on the next request instead of after an hour, and no visitor is served the stale copy.

Send `POST /api/revalidate` with an `Authorization: Bearer <REVALIDATE_SECRET>` header and a JSON body:

```json
{ "type": "post", "slug": "hello-world" }
```

- `type` is one of `post`, `page`, `menu`, `site` or `all`.
- `slug` is optional. Page slugs are the WordPress URI without edge slashes, for example `about/team`. Use `/` for the front page, which maps to the home page.
- Post slugs are a single segment.

The response lists what was invalidated. When pages or posts were touched, it also refreshes the sitemap:

```json
{ "revalidated": ["posts", "post:hello-world"], "paths": ["/sitemap.xml"] }
```

Test the endpoint from a terminal:

```bash
curl -X POST https://your-site.example/api/revalidate \
  -H "Authorization: Bearer $REVALIDATE_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"type":"all"}'
```

### Revalidate on save

This snippet sends the webhook whenever a post or page is saved and public content could have changed. When the save renames the post or moves it to the trash, which makes WordPress append `__trashed` to the slug, it sends a second call for the old slug so that cache entry is purged too:

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

This one covers menus and the site title and tagline:

```php
add_action( 'wp_update_nav_menu', function () {
	next_revalidate( 'menu' );
} );

foreach ( array( 'blogname', 'blogdescription' ) as $option ) {
	add_action( 'update_option_' . $option, function () {
		next_revalidate( 'site' );
	} );
}
```

### Alternative: WPGraphQL Smart Cache

The WPGraphQL Smart Cache plugin tracks which cached GraphQL results a change affects. You can use it to decide when to call the webhook instead of the `wp_after_insert_post` hook. See its documentation for the purge events.

## Pagination

WPGraphQL is cursor-based, so the adapter cannot jump to page N. To serve a blog page it fetches posts from the start in batches of 100 and slices out the page it needs. The total comes from the WPGraphQL Offset Pagination extension when it is installed. Otherwise the adapter counts all post slugs.

This is fine for hundreds of posts. It is not a good fit for thousands.

## Sitemap

The sitemap reads every page and post individually. A large site may want a dedicated listing query instead.

## Troubleshooting

- Every page shows an error: check that the `primary` and `footer` menu locations are registered.
- Preview returns 401: `secret` does not match `PREVIEW_SECRET`, or `PREVIEW_SECRET` is not set in the Next.js environment. The route rejects every request when it is unset.
- Preview shows a 404 or an error: check `WP_APP_USER` and `WP_APP_PASSWORD`, and that `id` is the right database id.
- Revalidation returns 401: the Bearer token does not match `REVALIDATE_SECRET`.
- Edits take an hour to appear: the webhook is not reaching the site. Check the URL and secret in the snippet constants.
