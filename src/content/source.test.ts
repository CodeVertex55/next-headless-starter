import { describe, it, expect, beforeEach } from "vitest";
import { getContentSource, __resetContentSource } from "./source";

describe("getContentSource", () => {
  beforeEach(() => {
    __resetContentSource();
  });
  it("throws a config error for an unknown source", async () => {
    process.env.CONTENT_SOURCE = "nope";
    await expect(getContentSource()).rejects.toMatchObject({ code: "config" });
    delete process.env.CONTENT_SOURCE;
  });
});
