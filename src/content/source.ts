import type {
  Menu,
  MenuLocation,
  Page,
  Paginated,
  Post,
  PostSummary,
  PreviewContext,
  SiteSettings,
} from "./types";
import { getEnv } from "@/lib/env";

export interface ContentSource {
  getSiteSettings(): Promise<SiteSettings>;
  getMenu(location: MenuLocation): Promise<Menu>;
  getPage(slug: string[], opts?: { preview?: PreviewContext }): Promise<Page | null>;
  getPageSlugs(): Promise<string[][]>;
  getPost(slug: string, opts?: { preview?: PreviewContext }): Promise<Post | null>;
  getPosts(params: { page: number; perPage: number }): Promise<Paginated<PostSummary>>;
  getPostSlugs(): Promise<string[]>;
}

let instance: ContentSource | null = null;

export async function getContentSource(): Promise<ContentSource> {
  if (instance) return instance;
  const env = getEnv();
  if (env.source === "wordpress") {
    const { createWordPressSource } = await import("./adapters/wordpress");
    instance = createWordPressSource(env);
  } else {
    const { createFixtureSource } = await import("./adapters/fixture");
    instance = createFixtureSource();
  }
  return instance;
}

/** Test-only: drop the cached instance. */
export function __resetContentSource() {
  instance = null;
}
