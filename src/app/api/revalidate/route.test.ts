import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

const revalidateTag = vi.fn();
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidateTag: (...a: unknown[]) => revalidateTag(...a),
  revalidatePath: (...a: unknown[]) => revalidatePath(...a),
}));
import { POST } from "./route";

function req(body: unknown, token: string | null = "t", authorization?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (authorization !== undefined) headers.authorization = authorization;
  else if (token !== null) headers.authorization = `Bearer ${token}`;
  return new Request("http://localhost/api/revalidate", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/revalidate", () => {
  beforeEach(() => {
    vi.stubEnv("REVALIDATE_SECRET", "t");
    revalidateTag.mockClear();
    revalidatePath.mockClear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("401 on bad token", async () => {
    expect((await POST(req({ type: "post", slug: "a" }, "x"))).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
  it("401 on a token of a different length", async () => {
    expect((await POST(req({ type: "post", slug: "a" }, "much-longer-token"))).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
  it("401 when REVALIDATE_SECRET is unset, even for an empty token", async () => {
    vi.stubEnv("REVALIDATE_SECRET", "");
    expect((await POST(req({ type: "all" }, ""))).status).toBe(401);
    expect((await POST(req({ type: "all" }, "t"))).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
  it("401 without an Authorization header", async () => {
    expect((await POST(req({ type: "all" }, null))).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
  it("401 when the Authorization header has no Bearer scheme", async () => {
    expect((await POST(req({ type: "all" }, null, "t"))).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
  it("accepts a lowercase bearer scheme", async () => {
    expect((await POST(req({ type: "all" }, null, "bearer t"))).status).toBe(200);
  });
  it("400 on malformed body", async () => {
    expect((await POST(req({ nope: 1 }))).status).toBe(400);
  });
  it("400 on invalid JSON", async () => {
    expect((await POST(req("{not json"))).status).toBe(400);
  });
  it("400 on an unknown type, with the message", async () => {
    const res = await POST(req({ type: "bogus" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "type must be one of post, page, menu, site, all" });
    expect(revalidateTag).not.toHaveBeenCalled();
  });
  it("400 on a slug with odd characters or a non-string slug", async () => {
    expect((await POST(req({ type: "post", slug: "a b" }))).status).toBe(400);
    expect((await POST(req({ type: "post", slug: "a:b" }))).status).toBe(400);
    expect((await POST(req({ type: "page", slug: "../x?y=1" }))).status).toBe(400);
    expect((await POST(req({ type: "post", slug: 5 }))).status).toBe(400);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
  it("400 on empty interior segments", async () => {
    expect((await POST(req({ type: "page", slug: "/about//team" }))).status).toBe(400);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
  it("400 on a post slug containing a slash", async () => {
    expect((await POST(req({ type: "post", slug: "a/b" }))).status).toBe(400);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
  it("revalidates post tags and the sitemap", async () => {
    const res = await POST(req({ type: "post", slug: "a" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ revalidated: ["posts", "post:a"], paths: ["/sitemap.xml"] });
    expect(revalidateTag).toHaveBeenCalledWith("posts", { expire: 0 });
    expect(revalidateTag).toHaveBeenCalledWith("post:a", { expire: 0 });
    expect(revalidatePath).toHaveBeenCalledWith("/sitemap.xml");
  });
  it("normalises a page URI to its slug", async () => {
    const res = await POST(req({ type: "page", slug: "/about/team/" }));
    expect(res.status).toBe(200);
    expect((await res.json()).revalidated).toEqual(["pages", "page:about/team"]);
    expect(revalidateTag).toHaveBeenCalledWith("page:about/team", { expire: 0 });
  });
  it("accepts underscores, including a trashed slug", async () => {
    const post = await POST(req({ type: "post", slug: "a_b" }));
    expect(post.status).toBe(200);
    expect((await post.json()).revalidated).toEqual(["posts", "post:a_b"]);
    const trashed = await POST(req({ type: "page", slug: "/about__trashed/" }));
    expect(trashed.status).toBe(200);
    expect((await trashed.json()).revalidated).toEqual(["pages", "page:about__trashed"]);
    expect(revalidateTag).toHaveBeenCalledWith("page:about__trashed", { expire: 0 });
  });
  it("maps the front page to page:home", async () => {
    for (const slug of ["/", ""]) {
      const res = await POST(req({ type: "page", slug }));
      expect((await res.json()).revalidated).toEqual(["pages", "page:home"]);
    }
  });
  it("revalidates only the list tag when no slug is given", async () => {
    const res = await POST(req({ type: "page" }));
    expect((await res.json()).revalidated).toEqual(["pages"]);
  });
  it("revalidates menus and site without touching the sitemap", async () => {
    const menu = await POST(req({ type: "menu" }));
    expect(await menu.json()).toEqual({ revalidated: ["menus"], paths: [] });
    const site = await POST(req({ type: "site" }));
    expect(await site.json()).toEqual({ revalidated: ["site"], paths: [] });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it("revalidates everything for type all", async () => {
    const res = await POST(req({ type: "all" }));
    expect(await res.json()).toEqual({
      revalidated: ["site", "menus", "pages", "posts"],
      paths: ["/sitemap.xml"],
    });
    expect(revalidatePath).toHaveBeenCalledWith("/sitemap.xml");
  });
});
