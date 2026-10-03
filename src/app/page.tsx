import type { Metadata } from "next";
import { getContentSource } from "@/content/source";
import { loadPage } from "@/app/_lib/loaders";
import { buildMetadata } from "@/lib/seo";
import { Prose } from "@/components/Prose";

const HOME_SLUG = ["home"];

export async function generateMetadata(): Promise<Metadata> {
  const [page, settings] = await Promise.all([
    loadPage(HOME_SLUG),
    (await getContentSource()).getSiteSettings(),
  ]);
  return buildMetadata({ seo: page.seo, path: "/", settings });
}

export default async function Home() {
  const page = await loadPage(HOME_SLUG);
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-8 text-4xl font-semibold">{page.title}</h1>
      <Prose html={page.html} />
    </main>
  );
}
