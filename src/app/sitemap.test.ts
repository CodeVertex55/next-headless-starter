import { describe, it, expect } from "vitest";
import sitemap from "./sitemap";
describe("sitemap", () => {
  it("includes home, every page, blog and every post", async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls.some((u) => u.endsWith("/about/team"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/blog"))).toBe(true);
    expect(urls.filter((u) => u.includes("/blog/")).length).toBeGreaterThanOrEqual(8);
    expect(urls.some((u) => u.endsWith("/home"))).toBe(false);
  });
});
