import type { NextConfig } from "next";

// Let next/image load WordPress media. The host comes from the GraphQL endpoint, which is the
// same install that serves /wp-content/uploads.
const wp = process.env.WP_GRAPHQL_URL ? new URL(process.env.WP_GRAPHQL_URL) : null;

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
  },
};

export default nextConfig;
