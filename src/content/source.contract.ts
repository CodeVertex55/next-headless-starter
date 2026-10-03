import { describe, it, expect } from "vitest";
import type { ContentSource } from "./source";

export function runContractTests(name: string, make: () => Promise<ContentSource>) {
  describe(`${name} contract`, () => {
    it("returns site settings", async () => {
      const s = await (await make()).getSiteSettings();
      expect(s.name).toBeTruthy();
      expect(s.url).toMatch(/^https?:\/\//);
    });
    it("returns a primary menu with at least one item", async () => {
      const m = await (await make()).getMenu("primary");
      expect(m.location).toBe("primary");
      expect(m.items.length).toBeGreaterThan(0);
      for (const i of m.items) {
        expect(i.href).toBeTruthy();
        expect(Array.isArray(i.children)).toBe(true);
      }
    });
    it("lists page slugs and resolves each", async () => {
      const src = await make();
      const slugs = await src.getPageSlugs();
      expect(slugs.length).toBeGreaterThan(0);
      const page = await src.getPage(slugs[0]);
      expect(page?.path).toBe("/" + slugs[0].join("/"));
      expect(page?.html).not.toMatch(/<script/i);
      expect(page?.seo.title).toBeTruthy();
    });
    it("returns null for a missing page", async () => {
      expect(await (await make()).getPage(["definitely", "missing"])).toBeNull();
    });
    it("paginates posts", async () => {
      const src = await make();
      const p1 = await src.getPosts({ page: 1, perPage: 3 });
      expect(p1.items.length).toBeLessThanOrEqual(3);
      expect(p1.totalPages).toBeGreaterThanOrEqual(1);
      expect(p1.total).toBeGreaterThanOrEqual(p1.items.length);
      if (p1.totalPages > 1) {
        const p2 = await src.getPosts({ page: 2, perPage: 3 });
        expect(p2.items[0]?.slug).not.toBe(p1.items[0]?.slug);
      }
    });
    it("resolves a post by slug with ISO dates", async () => {
      const src = await make();
      const [slug] = await src.getPostSlugs();
      const post = await src.getPost(slug);
      expect(post?.slug).toBe(slug);
      expect(new Date(post!.publishedAt).toString()).not.toBe("Invalid Date");
    });
    it("returns null for a missing post", async () => {
      expect(await (await make()).getPost("definitely-missing")).toBeNull();
    });
  });
}
