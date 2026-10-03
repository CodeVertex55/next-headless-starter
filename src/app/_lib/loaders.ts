import { cookies, draftMode } from "next/headers";
import { notFound } from "next/navigation";
import { getContentSource } from "@/content/source";
import type { PreviewContext } from "@/content/types";
import { POSTS_PER_PAGE } from "@/lib/site";

type PreviewType = "page" | "post";

/**
 * Draft mode context for the item at `path`. The preview route stores `type:id:path` in the
 * `preview_id` cookie; the id is passed on only when the type and path match the item being
 * rendered, so other pages visited during a preview session load their published versions.
 */
async function preview(type: PreviewType, path: string): Promise<PreviewContext | undefined> {
  const dm = await draftMode();
  if (!dm.isEnabled) return undefined;
  const value = (await cookies()).get("preview_id")?.value ?? "";
  const match = /^(page|post):(\d+):(\/.*)$/.exec(value);
  if (match && match[1] === type && match[3] === path) {
    return { secretVerified: true, id: match[2] };
  }
  return { secretVerified: true };
}

function pagePath(slug: string[]) {
  const isHome = slug.length === 0 || (slug.length === 1 && slug[0] === "home");
  return isHome ? "/" : "/" + slug.join("/");
}

export async function loadPage(slug: string[]) {
  const ctx = await preview("page", pagePath(slug));
  const page = await (await getContentSource()).getPage(slug, { preview: ctx });
  if (!page) notFound();
  return page;
}
export async function loadPost(slug: string) {
  const ctx = await preview("post", "/blog/" + slug);
  const post = await (await getContentSource()).getPost(slug, { preview: ctx });
  if (!post) notFound();
  return post;
}
export async function loadPosts(page: number) {
  if (!Number.isInteger(page) || page < 1) notFound();
  const result = await (await getContentSource()).getPosts({ page, perPage: POSTS_PER_PAGE });
  if (page > result.totalPages) notFound();
  return result;
}
