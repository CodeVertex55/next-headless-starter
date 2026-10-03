import type { ContentSource } from "@/content/source";
import type {
  Menu,
  MenuItem,
  MenuLocation,
  Page,
  Post,
  PostSummary,
  SiteSettings,
} from "@/content/types";
import { SITE_URL } from "@/lib/site";
import { sanitizeHtml } from "@/lib/html";
import { isReservedPageSlug } from "@/content/reserved";
import site from "./data/site.json";
import menus from "./data/menus.json";
import pageHome from "./data/pages/home.json";
import pageAbout from "./data/pages/about.json";
import pageAboutTeam from "./data/pages/about/team.json";
import pageServices from "./data/pages/services.json";
import pageWebDesign from "./data/pages/services/web-design.json";
import pageContact from "./data/pages/contact.json";
import pagePrivacy from "./data/pages/privacy.json";
import post01 from "./data/posts/launching-a-site-in-a-week.json";
import post02 from "./data/posts/choosing-a-headless-cms.json";
import post03 from "./data/posts/what-a-design-system-actually-costs.json";
import post04 from "./data/posts/performance-budgets-for-small-sites.json";
import post05 from "./data/posts/writing-copy-before-design.json";
import post06 from "./data/posts/photography-on-a-budget.json";
import post07 from "./data/posts/accessibility-checks-we-run-every-time.json";
import post08 from "./data/posts/how-we-handle-handover.json";

type RawPage = Omit<Page, "path">;
type RawPost = Omit<Post, "path">;

const rawPages = [
  pageHome,
  pageAbout,
  pageAboutTeam,
  pageServices,
  pageWebDesign,
  pageContact,
  pagePrivacy,
] as RawPage[];

const rawPosts = [post01, post02, post03, post04, post05, post06, post07, post08] as RawPost[];

function toSummary(post: Post): PostSummary {
  const { html, ...summary } = post;
  void html;
  return summary;
}

export function createFixtureSource(): ContentSource {
  const pages: Page[] = rawPages.map((p) => ({
    ...p,
    path: "/" + p.slug.join("/"),
    html: sanitizeHtml(p.html),
  }));
  const posts: Post[] = rawPosts
    .map((p) => ({ ...p, path: "/blog/" + p.slug, html: sanitizeHtml(p.html) }))
    .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));

  return {
    async getSiteSettings(): Promise<SiteSettings> {
      return { ...site, url: SITE_URL };
    },
    async getMenu(location: MenuLocation): Promise<Menu> {
      return { location, items: (menus as Record<MenuLocation, MenuItem[]>)[location] ?? [] };
    },
    async getPage(slug) {
      return pages.find((p) => p.slug.join("/") === slug.join("/")) ?? null;
    },
    async getPageSlugs() {
      return pages.map((p) => p.slug).filter((slug) => !isReservedPageSlug(slug));
    },
    async getPost(slug) {
      return posts.find((p) => p.slug === slug) ?? null;
    },
    async getPosts({ page, perPage }) {
      const total = posts.length;
      const start = (page - 1) * perPage;
      const items: PostSummary[] = posts.slice(start, start + perPage).map(toSummary);
      return { items, page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) };
    },
    async getPostSlugs() {
      return posts.map((p) => p.slug);
    },
  };
}
