import type { Metadata } from "next";
import { getContentSource } from "@/content/source";
import { buildMetadata } from "@/lib/seo";
import { PostList } from "./_components/PostList";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await (await getContentSource()).getSiteSettings();
  return buildMetadata({
    seo: {
      title: "Blog",
      absoluteTitle: false,
      description: settings.description,
      canonical: null,
      noindex: false,
      ogImage: null,
    },
    path: "/blog",
    settings,
  });
}

export default function BlogIndex() {
  return <PostList page={1} />;
}
