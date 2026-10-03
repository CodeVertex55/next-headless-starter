import { cookies, draftMode } from "next/headers";
import { notFound } from "next/navigation";
import { getContentSource } from "@/content/source";
import type { PreviewContext } from "@/content/types";
import { POSTS_PER_PAGE } from "@/lib/site";

async function preview(): Promise<PreviewContext | undefined> {
  const dm = await draftMode();
  if (!dm.isEnabled) return undefined;
  const id = (await cookies()).get("preview_id")?.value;
  return id ? { secretVerified: true, id } : { secretVerified: true };
}
export async function loadPage(slug: string[]) {
  const page = await (await getContentSource()).getPage(slug, { preview: await preview() });
  if (!page) notFound();
  return page;
}
export async function loadPost(slug: string) {
  const post = await (await getContentSource()).getPost(slug, { preview: await preview() });
  if (!post) notFound();
  return post;
}
export async function loadPosts(page: number) {
  if (!Number.isInteger(page) || page < 1) notFound();
  const result = await (await getContentSource()).getPosts({ page, perPage: POSTS_PER_PAGE });
  if (page > result.totalPages) notFound();
  return result;
}
