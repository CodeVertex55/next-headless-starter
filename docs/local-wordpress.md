# Local WordPress

This guide sets up a WordPress on your own machine so you can run the starter, and its contract tests, against a real WPGraphQL endpoint.

Any local WordPress works: XAMPP, Local, wp-env or MAMP. If you already have one, skip steps 1 to 3 and work through steps 4 to 9 on it.

The steps below use the smallest setup that was verified end to end. It needs only PHP, a database and a few commands.

## What you need

- PHP with the `mysqli` extension. The command is called `<php>` below.
- A local MySQL or MariaDB server, and a database for WordPress.
- A copy of WordPress from wordpress.org, unzipped into a folder. Called `<wordpress folder>` below.
- The WPGraphQL plugin.

## 1. Create the database

Create an empty database named `headless` with the collation `utf8mb4_unicode_ci`. Use phpMyAdmin or the `mysql` client:

```bash
mysql -u <db user> -p -e "CREATE DATABASE headless CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

## 2. Start WordPress with PHP's built-in server

Run this from any folder. It serves WordPress at `http://localhost:8881`:

```bash
<php> -S localhost:8881 -t <wordpress folder>
```

Leave it running. If you use another web server, such as Apache from XAMPP, use its address wherever this guide says `http://localhost:8881`.

The built-in server handles one request at a time. That is fine for development, but the contract suite in step 10 takes about a minute because of it.

## 3. Install WordPress

1. Open `http://localhost:8881` and follow the installer.
2. Use database name `headless`, your database user and password, and host `localhost`.
3. Create an admin user and finish the install.

## 4. Allow application passwords over http

WordPress disables application passwords on sites without HTTPS, unless it knows the site is local. Add this line to `<wordpress folder>/wp-config.php`, above the line that says to stop editing:

```php
define( 'WP_ENVIRONMENT_TYPE', 'local' );
```

## 5. Set permalinks

In wp-admin, go to Settings > Permalinks, choose Post name and save. WPGraphQL needs pretty permalinks to serve `/graphql`.

## 6. Install WPGraphQL

Go to Plugins > Add New, search for WPGraphQL, then install and activate it. Optionally install WPGraphQL for Yoast SEO with Yoast SEO, or the WPGraphQL Offset Pagination extension. The starter works without all of them.

Check the endpoint from a terminal:

```bash
curl -X POST http://localhost:8881/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ generalSettings { title url } }"}'
```

## 7. Register the menus

The theme must register the `primary` and `footer` menu locations. Create `<wordpress folder>/wp-content/mu-plugins/headless.php` (create the `mu-plugins` folder if it is missing) with this content:

```php
<?php
add_action( 'after_setup_theme', function () {
	register_nav_menus( array(
		'primary' => 'Primary',
		'footer'  => 'Footer',
	) );
} );
```

Then go to Appearance > Menus, create a menu with at least one item for each location and assign it. See [wordpress-setup.md](wordpress-setup.md) for the preview and revalidation snippets that also go in this file.

To check PHP syntax, run PHP with `-n`, which skips `php.ini` and avoids extension warnings:

```bash
<php> -n -l <wordpress folder>/wp-content/mu-plugins/headless.php
```

## 8. Add some content

The contract suite expects at least one published page, one published post and a primary menu with an item. Create them in wp-admin.

Then set the front page. Go to Settings > Reading, choose "A static page" under "Your homepage displays", and set Homepage to the page you want as the home page. Whatever its slug, WordPress gives that page the URI `/`, and the starter serves it at `/`.

## 9. Create an application password

Go to Users > Profile > Application Passwords, enter a name and click Add New Application Password. Copy the password. WordPress shows it once.

## 10. Configure the starter and run the checks

Copy `.env.example` to `.env.local` and set these values:

```bash
CONTENT_SOURCE=wordpress
SITE_URL=http://localhost:3000
WP_GRAPHQL_URL=http://localhost:8881/graphql
WP_APP_USER=your-wordpress-username
WP_APP_PASSWORD=the-application-password
PREVIEW_SECRET=any-long-random-string
REVALIDATE_SECRET=another-long-random-string
```

Start the site with `npm run dev`.

Next.js refuses to optimise images from a private address such as `localhost`. When `WP_GRAPHQL_URL` points at `localhost`, `127.0.0.1` or `[::1]`, `next.config.ts` sets `images.dangerouslyAllowLocalIP` in every environment, including production builds. `remotePatterns` already pins that exact host and port, and a WordPress on your own machine is your choice. Any other host never gets it.

### Run the contract suite

The contract suite runs against WordPress when `WP_GRAPHQL_URL` is set in the environment of the test process. Vitest does not read `.env.local`, so pass it on the command line.

In Git Bash:

```bash
WP_GRAPHQL_URL=http://localhost:8881/graphql npm test
```

In PowerShell:

```powershell
$env:WP_GRAPHQL_URL = "http://localhost:8881/graphql"; npm test
```

Without the variable, the WordPress contract tests are skipped and every other test still runs.

### Try preview

Preview needs the application password and `PREVIEW_SECRET`. Create a draft post in wp-admin and note its id from the edit URL (`post=<id>`). With the site running, request the preview URL and keep the cookies:

```bash
curl -i -c cookies.txt \
  "http://localhost:3000/api/preview?secret=<PREVIEW_SECRET>&type=post&id=<draft id>&slug=<draft slug>"
```

The response is a 307 redirect to `/blog/<draft slug>`. Request that path with the cookies and the draft renders:

```bash
curl -b cookies.txt http://localhost:3000/blog/<draft slug>
```

Exit preview at `/api/preview/exit`.

### Try the webhook

Edit a post in wp-admin, then expire its cache entry:

```bash
curl -X POST http://localhost:3000/api/revalidate \
  -H "Authorization: Bearer <REVALIDATE_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"type":"post","slug":"<post slug>"}'
```

The next request for `/blog/<post slug>` shows the edit. To check a trashed post, move it to the trash in wp-admin and send the same call with the original slug. The old URL then stops serving the post. WordPress renames a trashed slug to `<post slug>__trashed`, which is why the save hook in [wordpress-setup.md](wordpress-setup.md) sends a second call for the old slug.

## What was verified

This setup passed these checks. It ran PHP's built-in server, a local MySQL-compatible database, WordPress 7.1 and WPGraphQL, with no SEO plugin:

- The contract suite, 8 of 8 tests.
- A static build in WordPress mode.
- Preview of a draft.
- Webhook revalidation of an edit and of a trashed post.

The Yoast paths were not part of this run. They are covered by hand-written fixtures in the unit tests.
