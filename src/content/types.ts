export type Image = { src: string; alt: string; width: number; height: number };

export type SeoFields = {
  title: string;
  description: string;
  canonical: string | null;
  noindex: boolean;
  ogImage: Image | null;
};

type ContentBase = {
  id: string;
  title: string;
  html: string;
  excerpt: string;
  publishedAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  featuredImage: Image | null;
  seo: SeoFields;
};

export type Page = ContentBase & { slug: string[]; path: string };
export type Post = ContentBase & { slug: string; path: string; author: string | null };
export type PostSummary = Omit<Post, "html">;

export type MenuItem = { label: string; href: string; external: boolean; children: MenuItem[] };
export type Menu = { location: MenuLocation; items: MenuItem[] };
export type MenuLocation = "primary" | "footer";

export type SiteSettings = { name: string; description: string; url: string; logo: Image | null };

export type Paginated<T> = {
  items: T[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

export type PreviewContext = { secretVerified: true; id?: string };
