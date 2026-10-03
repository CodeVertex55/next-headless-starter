import { describe, it } from "vitest";
import { runContractTests } from "@/content/source.contract";
import { createWordPressSource } from "./index";

const url = process.env.WP_GRAPHQL_URL;

if (!url) {
  describe.skip("wordpress contract (set WP_GRAPHQL_URL to run)", () => {
    it("runs against a live WordPress", () => {});
  });
} else {
  runContractTests("wordpress", async () =>
    createWordPressSource({
      source: "wordpress",
      wpUrl: url,
      siteUrl: process.env.SITE_URL ?? "http://localhost:3000",
      wpAppUser: process.env.WP_APP_USER,
      wpAppPassword: process.env.WP_APP_PASSWORD,
      previewSecret: undefined,
      revalidateSecret: undefined,
    }),
  );
}
