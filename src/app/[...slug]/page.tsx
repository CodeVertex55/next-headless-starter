import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getContentSource } from "@/content/source";
import { loadPage } from "@/app/_lib/loaders";
import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { Prose } from "@/components/Prose";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";

type Props = { params: Promise<{ slug: string[] }> };

/** The home page is served at "/" only, so "/home" is not a public path. */
function isHomeSlug(slug: string[]) {
  return slug.length === 1 && slug[0] === "home";
}

function humanize(segment: string) {
  const words = segment.replace(/[-_]+/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export async function generateStaticParams() {
  const slugs = await (await getContentSource()).getPageSlugs();
  return slugs.filter((s) => !isHomeSlug(s)).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (isHomeSlug(slug)) notFound();
  const [page, settings] = await Promise.all([
    loadPage(slug),
    (await getContentSource()).getSiteSettings(),
  ]);
  return buildMetadata({ seo: page.seo, path: page.path, settings });
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  if (isHomeSlug(slug)) notFound();
  const source = await getContentSource();
  const [page, settings] = await Promise.all([loadPage(slug), source.getSiteSettings()]);
  // Ancestor crumbs use the parent page title when it exists, else a readable slug.
  const ancestors = await Promise.all(
    slug.slice(0, -1).map((_, i) => source.getPage(slug.slice(0, i + 1))),
  );
  const crumbs = [
    { name: "Home", path: "/" },
    ...slug.map((segment, i) => ({
      name: i === slug.length - 1 ? page.title : (ancestors[i]?.title ?? humanize(segment)),
      path: "/" + slug.slice(0, i + 1).join("/"),
    })),
  ];
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <JsonLd data={breadcrumbJsonLd(crumbs, settings)} />
      <Breadcrumbs items={crumbs} />
      <h1 className="mb-8 text-4xl font-semibold">{page.title}</h1>
      <Prose html={page.html} />
    </main>
  );
}
