# Local WordPress on Windows with XAMPP

This guide sets up a local WordPress so you can run the starter, and its contract tests, against a real WPGraphQL endpoint. It assumes XAMPP is installed in `C:\Development\xampp`. Adjust the paths if yours is elsewhere.

## 1. Start Apache and MySQL

Open the XAMPP Control Panel and start Apache and MySQL. Both should turn green.

## 2. Create the database

Open `http://localhost/phpmyadmin` and create a database named `headless` with the collation `utf8mb4_unicode_ci`.

Or create it from a terminal. A fresh XAMPP install has a `root` user with no password.

```bash
/c/Development/xampp/mysql/bin/mysql.exe -u root -e "CREATE DATABASE headless CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

## 3. Install WordPress

1. Download WordPress from wordpress.org and unzip it.
2. Copy the contents of the `wordpress` folder into `C:\Development\xampp\htdocs\headless`.
3. Open `http://localhost/headless` and follow the installer. Use database name `headless`, user `root` and an empty password, host `localhost`.
4. Create an admin user and finish the install.

## 4. Allow application passwords over http

WordPress disables application passwords on sites without HTTPS, unless it knows the site is local. Add this line to `C:\Development\xampp\htdocs\headless\wp-config.php`, above the line that says to stop editing:

```php
define( 'WP_ENVIRONMENT_TYPE', 'local' );
```

## 5. Set permalinks

In wp-admin, go to Settings > Permalinks, choose Post name and save. WPGraphQL needs pretty permalinks to serve `/graphql`.

## 6. Install WPGraphQL

Go to Plugins > Add New, search for WPGraphQL, then install and activate it. Optionally install WPGraphQL for Yoast SEO with Yoast SEO, or the WPGraphQL Offset Pagination extension.

Check the endpoint from a terminal:

```bash
curl -X POST http://localhost/headless/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ generalSettings { title url } }"}'
```

## 7. Register the menus

The theme must register the `primary` and `footer` menu locations. Create `C:\Development\xampp\htdocs\headless\wp-content\mu-plugins\headless.php` (create the `mu-plugins` folder if it is missing) with this content:

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

If you want to check PHP syntax, run the PHP bundled with XAMPP. The `-n` flag skips `php.ini`, which avoids extension warnings from a mismatched install path.

```bash
/c/Development/xampp/php/php.exe -n -l /c/Development/xampp/htdocs/headless/wp-content/mu-plugins/headless.php
```

## 8. Add some content

The contract suite expects at least one published page, one published post and a primary menu with an item. Create them in wp-admin.

Then set the front page. Go to Settings > Reading, choose "A static page" under "Your homepage displays", and set Homepage to the page you want as the home page. Whatever its slug, WordPress gives that page the URI `/`, and the starter serves it at `/`.

## 9. Create an application password

Go to Users > Profile > Application Passwords, enter a name and click Add New Application Password. Copy the password. WordPress shows it once.

## 10. Configure the starter

Copy `.env.example` to `.env.local` and set these values:

```bash
CONTENT_SOURCE=wordpress
SITE_URL=http://localhost:3000
WP_GRAPHQL_URL=http://localhost/headless/graphql
WP_APP_USER=your-wordpress-username
WP_APP_PASSWORD=the-application-password
PREVIEW_SECRET=any-long-random-string
REVALIDATE_SECRET=another-long-random-string
```

Start the site with `npm run dev`.

Next.js normally refuses to optimise images from a private address such as `localhost`, so when `WP_GRAPHQL_URL` points at `localhost`, `127.0.0.1` or `[::1]` outside production, `next.config.ts` sets `images.dangerouslyAllowLocalIP` and featured images load from XAMPP.

## 11. Run the contract suite

The contract suite runs against WordPress when `WP_GRAPHQL_URL` is set in the environment of the test process. Vitest does not read `.env.local`, so pass it on the command line.

In Git Bash:

```bash
WP_GRAPHQL_URL=http://localhost/headless/graphql npm test
```

In PowerShell:

```powershell
$env:WP_GRAPHQL_URL = "http://localhost/headless/graphql"; npm test
```

Without the variable, the WordPress contract tests are skipped and every other test still runs.
