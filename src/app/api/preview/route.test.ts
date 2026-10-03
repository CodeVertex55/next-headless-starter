import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

const enable = vi.fn();
vi.mock("next/headers", () => ({
  draftMode: async () => ({ enable, disable: vi.fn(), isEnabled: false }),
}));
import { GET } from "./route";

/** The decoded value of the preview_id cookie the response sets. */
function previewCookie(res: Response) {
  const match = /preview_id=([^;]*)/.exec(res.headers.get("set-cookie") ?? "");
  return match ? decodeURIComponent(match[1]) : null;
}

function req(qs: string) {
  return new Request("http://localhost/api/preview?" + qs);
}

describe("GET /api/preview", () => {
  beforeEach(() => {
    vi.stubEnv("PREVIEW_SECRET", "s");
    enable.mockClear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects a wrong secret", async () => {
    expect((await GET(req("secret=bad&type=post&id=1&slug=x"))).status).toBe(401);
    expect(enable).not.toHaveBeenCalled();
  });
  it("rejects a secret of a different length", async () => {
    expect((await GET(req("secret=much-longer-secret&type=post&id=1&slug=x"))).status).toBe(401);
    expect(enable).not.toHaveBeenCalled();
  });
  it("rejects every request when PREVIEW_SECRET is unset", async () => {
    vi.stubEnv("PREVIEW_SECRET", "");
    expect((await GET(req("secret=&type=post&id=1&slug=x"))).status).toBe(401);
    expect((await GET(req("secret=s&type=post&id=1&slug=x"))).status).toBe(401);
    expect(enable).not.toHaveBeenCalled();
  });
  it("rejects a request without a secret parameter", async () => {
    expect((await GET(req("type=post&id=1&slug=x"))).status).toBe(401);
    expect(enable).not.toHaveBeenCalled();
  });
  it("rejects missing fields", async () => {
    expect((await GET(req("secret=s"))).status).toBe(400);
    expect(enable).not.toHaveBeenCalled();
  });
  it.each([
    ["an absolute-looking slug", "slug=%2Fevil.example"],
    ["a traversal slug", "slug=..%2Fx"],
    ["a query injection slug", "slug=a%3Fb"],
    ["a fragment injection slug", "slug=a%23b"],
    ["a backslash slug", "slug=a%5Cb"],
  ])("rejects %s with 400", async (_name, slug) => {
    const res = await GET(req(`secret=s&type=page&id=1&${slug}`));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid slug" });
    expect(enable).not.toHaveBeenCalled();
  });
  it("rejects a non-numeric id with 400", async () => {
    const res = await GET(req("secret=s&type=post&id=abc&slug=x"));
    expect(res.status).toBe(400);
    expect(enable).not.toHaveBeenCalled();
  });
  it("redirects to the post url with the id cookie", async () => {
    const res = await GET(req("secret=s&type=post&id=12&slug=hello"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/blog/hello");
    expect(enable).toHaveBeenCalledOnce();
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(previewCookie(res)).toBe("post:12:/blog/hello");
    expect(cookie).toContain("HttpOnly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
    expect(cookie).not.toContain("Secure");
  });
  it("accepts an underscore in a slug", async () => {
    const res = await GET(req("secret=s&type=post&id=7&slug=a_b"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/blog/a_b");
  });
  it("redirects a nested page slug to its url", async () => {
    const res = await GET(req("secret=s&type=page&id=3&slug=about%2Fteam"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/about/team");
    expect(previewCookie(res)).toBe("page:3:/about/team");
  });
  it("redirects the front page slug home to the site root", async () => {
    const res = await GET(req("secret=s&type=page&id=1&slug=home"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/");
    expect(previewCookie(res)).toBe("page:1:/");
  });
});
