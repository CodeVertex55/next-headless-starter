import { getEnv } from "./env";
/** Base URL for canonical, sitemap, robots and schema. One place, on purpose. */
export const SITE_URL = getEnv().siteUrl.replace(/\/$/, "");
export const POSTS_PER_PAGE = 10;
