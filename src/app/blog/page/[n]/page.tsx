import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getContentSource } from "@/content/source";
import { buildMetadata } from "@/lib/seo";
import { POSTS_PER_PAGE } from "@/lib/site";
import { PostList } from "../../_components/PostList";

type Props = { params: Promise<{ n: string }> };

/** Page 1 lives at /blog, so /blog/page/1 is a 404. Anything non numeric is too. */
function parsePage(n: string): number {
  const page = /^\d+$/.test(n) ? Number(n) : NaN;
  if (!Number.isInteger(page) || page < 2) notFound();
  return page;
}

export async function generateStaticParams() {
  const { totalPages } = await (
    await getContentSource()
  ).getPosts({ page: 1, perPage: POSTS_PER_PAGE });
  return Array.from({ length: Math.max(0, totalPages - 1) }, (_, i) => ({ n: String(i + 2) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = parsePage((await params).n);
  const settings = await (await getContentSource()).getSiteSettings();
  return buildMetadata({
    seo: {
      title: `Blog (page ${page})`,
      description: settings.description,
      canonical: null,
      noindex: false,
      ogImage: null,
    },
    path: `/blog/page/${page}`,
    settings,
  });
}

export default async function BlogPage({ params }: Props) {
  const page = parsePage((await params).n);
  return <PostList page={page} />;
}
