import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getContentSource } from "@/content/source";
import { SITE_URL } from "@/lib/site";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import { Nav } from "@/components/Nav";
import { PreviewBar } from "@/components/PreviewBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await (await getContentSource()).getSiteSettings();
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: settings.name, template: `%s | ${settings.name}` },
    description: settings.description,
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const source = await getContentSource();
  const [settings, primary, footer, draft] = await Promise.all([
    source.getSiteSettings(),
    source.getMenu("primary"),
    source.getMenu("footer"),
    draftMode(),
  ]);

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <JsonLd data={websiteJsonLd(settings)} />
        <JsonLd data={organizationJsonLd(settings)} />
        <Nav siteName={settings.name} items={primary.items} />
        <div className="flex-1">{children}</div>
        <Footer siteName={settings.name} items={footer.items} />
        {draft.isEnabled && <PreviewBar />}
      </body>
    </html>
  );
}
