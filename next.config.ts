import type { NextConfig } from "next";

// Let next/image load WordPress media. The host comes from the GraphQL endpoint, which is the
// same install that serves /wp-content/uploads.
const wp = process.env.WP_GRAPHQL_URL ? new URL(process.env.WP_GRAPHQL_URL) : null;

// Next.js refuses to optimise images from private addresses. A WordPress on this machine (such as
// the documented XAMPP setup) needs that allowed, but only in development: in production it would
// open the image optimiser to requests against the local network.
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const allowLocalWordPress =
  wp !== null && LOCAL_HOSTS.has(wp.hostname) && process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: wp
      ? [
          {
            protocol: wp.protocol.replace(":", "") as "http" | "https",
            hostname: wp.hostname,
            ...(wp.port ? { port: wp.port } : {}),
          },
        ]
      : [],
    ...(allowLocalWordPress ? { dangerouslyAllowLocalIP: true } : {}),
  },
};

export default nextConfig;
