import { describe, expect, it } from "vitest";
import { isReservedPageSlug } from "./reserved";

describe("isReservedPageSlug", () => {
  it("reserves slugs whose first segment is blog or api", () => {
    expect(isReservedPageSlug(["blog"])).toBe(true);
    expect(isReservedPageSlug(["blog", "archive"])).toBe(true);
    expect(isReservedPageSlug(["api", "x"])).toBe(true);
  });
  it("allows everything else, including blog or api deeper in the path", () => {
    expect(isReservedPageSlug(["about", "blog"])).toBe(false);
    expect(isReservedPageSlug(["blogging"])).toBe(false);
    expect(isReservedPageSlug(["home"])).toBe(false);
    expect(isReservedPageSlug([])).toBe(false);
  });
});
