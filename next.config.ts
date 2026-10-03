import type { NextConfig } from "next";

// Let next/image load WordPress media. The host comes from the GraphQL endpoint, which is the
// same install that serves /wp-content/uploads.
const wp = process.env.WP_GRAPHQL_URL ? new URL(process.env.WP_GRAPHQL_URL) : null;

// Next.js refuses to optimise images from private addresses, so a WordPress on this machine (for
// example the setup in docs/local-wordpress.md) needs that allowed. It is allowed whenever the
// WordPress host is loopback, in any NODE_ENV, because `remotePatterns` below already pins that
// exact host and port, and running WordPress on loopback is the operator's own choice. It is never
// allowed for any other host.
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const allowLocalWordPress = wp !== null && LOCAL_HOSTS.has(wp.hostname);

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
