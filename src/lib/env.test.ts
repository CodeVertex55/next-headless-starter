import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ContentError } from "@/content/errors";
import { __resetSiteUrlWarning, getEnv } from "./env";

const saved = { ...process.env };
beforeEach(() => {
  process.env = { ...saved };
  delete process.env.CONTENT_SOURCE;
  delete process.env.WP_GRAPHQL_URL;
});
afterEach(() => {
  vi.unstubAllEnvs();
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

describe("getEnv siteUrl", () => {
  beforeEach(() => {
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    __resetSiteUrlWarning();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const configError = (fn: () => unknown, message: RegExp) => {
    let err: unknown;
    try {
      fn();
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ContentError);
    expect(err).toMatchObject({ code: "config" });
    expect((err as Error).message).toMatch(message);
  };

  it("uses SITE_URL when set, in any environment, without a warning", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SITE_URL", "https://example.com");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "example.vercel.app");
    expect(getEnv().siteUrl).toBe("https://example.com");
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("falls back to the Vercel production domain, without a warning", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "example.vercel.app");
    expect(getEnv().siteUrl).toBe("https://example.vercel.app");
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("defaults to localhost outside production, without a warning", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(getEnv().siteUrl).toBe("http://localhost:3000");
    vi.stubEnv("NODE_ENV", "test");
    expect(getEnv().siteUrl).toBe("http://localhost:3000");
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("defaults to localhost in production with neither set, and warns once per process", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(getEnv().siteUrl).toBe("http://localhost:3000");
    expect(getEnv().siteUrl).toBe("http://localhost:3000");
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      "SITE_URL is not set; canonical URLs, sitemap and robots will point at http://localhost:3000. Set SITE_URL for production deployments.",
    );
  });

  it("throws a config error for a value that is not a URL", () => {
    vi.stubEnv("SITE_URL", "example.com");
    configError(() => getEnv(), /SITE_URL must be an absolute URL/);
  });

  it("throws a config error for a non-http URL", () => {
    vi.stubEnv("SITE_URL", "ftp://example.com");
    configError(() => getEnv(), /SITE_URL must use http or https/);
  });
});
