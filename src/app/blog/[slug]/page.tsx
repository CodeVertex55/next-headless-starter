import type { Metadata } from "next";
import Image from "next/image";
import { getContentSource } from "@/content/source";
import { loadPost } from "@/app/_lib/loaders";
import { articleJsonLd, breadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import { Prose } from "@/components/Prose";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";

type Props = { params: Promise<{ slug: string }> };

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "long" });

export async function generateStaticParams() {
  const slugs = await (await getContentSource()).getPostSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [post, settings] = await Promise.all([
    loadPost(slug),
    (await getContentSource()).getSiteSettings(),
  ]);
  return buildMetadata({ seo: post.seo, path: post.path, settings });
}

export default async function Post({ params }: Props) {
  const { slug } = await params;
  const [post, settings] = await Promise.all([
    loadPost(slug),
    (await getContentSource()).getSiteSettings(),
  ]);
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Blog", path: "/blog" },
    { name: post.title, path: post.path },
  ];
  const img = post.featuredImage;
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <JsonLd data={articleJsonLd(post, settings)} />
      <JsonLd data={breadcrumbJsonLd(crumbs, settings)} />
      <Breadcrumbs items={crumbs} />
      <h1 className="mb-4 text-4xl font-semibold">{post.title}</h1>
      <p className="mb-8 text-sm opacity-70">
        <time dateTime={post.publishedAt}>{dateFormat.format(new Date(post.publishedAt))}</time>
        {post.author ? <> by {post.author}</> : null}
      </p>
      {img && (
        <Image
          src={img.src}
          alt={img.alt}
          width={img.width}
          height={img.height}
          sizes="(max-width: 768px) 100vw, 768px"
          priority
          className="mb-8 h-auto w-full"
        />
      )}
      <Prose html={post.html} />
    </main>
  );
}
