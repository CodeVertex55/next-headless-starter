import { draftMode } from "next/headers";
import { notFound } from "next/navigation";
import { getContentSource } from "@/content/source";
import { POSTS_PER_PAGE } from "@/lib/site";

async function preview() {
  const dm = await draftMode();
  return dm.isEnabled ? { secretVerified: true as const } : undefined;
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
