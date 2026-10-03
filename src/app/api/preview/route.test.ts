import { describe, it, expect, vi } from "vitest";
vi.mock("next/headers", () => ({
  draftMode: async () => ({ enable: vi.fn(), disable: vi.fn(), isEnabled: false }),
}));
import { GET } from "./route";

function req(qs: string) {
  return new Request("http://localhost/api/preview?" + qs);
}
describe("GET /api/preview", () => {
  it("rejects a wrong secret", async () => {
    process.env.PREVIEW_SECRET = "s";
    expect((await GET(req("secret=bad&type=post&id=1&slug=x"))).status).toBe(401);
  });
  it("rejects a secret of a different length", async () => {
    process.env.PREVIEW_SECRET = "s";
    expect((await GET(req("secret=much-longer-secret&type=post&id=1&slug=x"))).status).toBe(401);
  });
  it("rejects missing fields", async () => {
    process.env.PREVIEW_SECRET = "s";
    expect((await GET(req("secret=s"))).status).toBe(400);
  });
  it("redirects to the post url with the id cookie", async () => {
    process.env.PREVIEW_SECRET = "s";
    const res = await GET(req("secret=s&type=post&id=12&slug=hello"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/blog/hello");
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("preview_id=12");
    expect(cookie).toContain("HttpOnly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
    expect(cookie).not.toContain("Secure");
  });
});
