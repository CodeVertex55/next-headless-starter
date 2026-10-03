// Records real WPGraphQL responses as test fixtures.
//
//   WP_GRAPHQL_URL=http://localhost:8881/graphql node scripts/record-wp-fixtures.mjs
//
// It sends the adapter's own queries (the no-SEO set, so no SEO plugin is needed) to a running
// WordPress and writes the responses to src/content/adapters/wordpress/__fixtures__/. The
// `extensions` key is dropped. Only read-only queries are sent. The fixtures that need an SEO
// plugin (page-with-seo.json, page-noindex-home.json) cannot be recorded this way and stay
// hand-written.
//
// The queries are TypeScript, so they are loaded through Vite, which is already a dev dependency.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "src/content/adapters/wordpress/__fixtures__");

const endpoint = process.env.WP_GRAPHQL_URL;
if (!endpoint) {
  console.error("Set WP_GRAPHQL_URL, for example http://localhost:8881/graphql");
  process.exit(1);
}

const vite = await createServer({
  root,
  logLevel: "silent",
  appType: "custom",
  server: { middlewareMode: true, hmr: false, watch: null },
  resolve: { alias: { "@": path.join(root, "src") } },
});

try {
  const q = await vite.ssrLoadModule("/src/content/adapters/wordpress/queries.ts");

  // File name, query and variables. Edit the variables to record other content.
  const recordings = [
    ["site-settings.json", q.SITE_SETTINGS, {}],
    ["menu-nested.json", q.MENU, { location: "PRIMARY" }],
    ["page-without-seo.json", q.PAGE_BY_URI(false), { uri: "/about/team/" }],
    ["post-with-image.json", q.POST_BY_SLUG(false), { slug: "hello-from-wordpress" }],
    ["post-without-image.json", q.POST_BY_SLUG(false), { slug: "third-and-newest" }],
    ["menu-footer.json", q.MENU, { location: "FOOTER" }],
    ["posts-page-1.json", q.POSTS(false), { first: 10, after: null }],
  ];

  await mkdir(outDir, { recursive: true });
  for (const [file, query, variables] of recordings) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    const body = await res.json();
    if (!res.ok || body.errors) {
      throw new Error(`${file}: ${res.status} ${JSON.stringify(body.errors ?? body)}`);
    }
    // Keep only `data`: `extensions` carries debug output and varies between installs.
    await writeFile(path.join(outDir, file), JSON.stringify({ data: body.data }, null, 2) + "\n");
    console.log(`recorded ${file}`);
  }
} finally {
  await vite.close();
}
