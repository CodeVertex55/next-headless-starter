import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getEnv } from "./env";

const saved = { ...process.env };
beforeEach(() => {
  process.env = { ...saved };
  delete process.env.CONTENT_SOURCE;
  delete process.env.WP_GRAPHQL_URL;
});
afterEach(() => {
  process.env = saved;
});

describe("getEnv", () => {
  it("defaults to fixture", () => expect(getEnv().source).toBe("fixture"));
  it("rejects unknown source", () => {
    process.env.CONTENT_SOURCE = "contentful";
    expect(() => getEnv()).toThrow(/CONTENT_SOURCE must be one of/);
  });
  it("requires WP_GRAPHQL_URL for wordpress", () => {
    process.env.CONTENT_SOURCE = "wordpress";
    expect(() => getEnv()).toThrow(/WP_GRAPHQL_URL is required/);
  });
  it("accepts wordpress with a url", () => {
    process.env.CONTENT_SOURCE = "wordpress";
    process.env.WP_GRAPHQL_URL = "https://example.com/graphql";
    expect(getEnv().wpUrl).toBe("https://example.com/graphql");
  });
});
