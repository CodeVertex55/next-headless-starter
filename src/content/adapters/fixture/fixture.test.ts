import { describe, expect, it } from "vitest";
import { runContractTests } from "@/content/source.contract";
import { createFixtureSource } from "./index";

runContractTests("fixture", async () => createFixtureSource());

describe("fixture adapter", () => {
  it("marks every fixture title as relative, so the layout template adds the site name", async () => {
    const src = createFixtureSource();
    for (const slug of await src.getPageSlugs()) {
      expect((await src.getPage(slug))?.seo.absoluteTitle).toBe(false);
    }
    for (const slug of await src.getPostSlugs()) {
      expect((await src.getPost(slug))?.seo.absoluteTitle).toBe(false);
    }
  });
});
