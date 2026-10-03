import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PreviewContext } from "@/content/types";

const state = { draft: false, cookie: undefined as string | undefined };
vi.mock("next/headers", () => ({
  draftMode: async () => ({ isEnabled: state.draft }),
  cookies: async () => ({
    get: (name: string) =>
      name === "preview_id" && state.cookie !== undefined ? { value: state.cookie } : undefined,
  }),
}));

const getPage = vi.fn(async (slug: string[], opts?: { preview?: PreviewContext }) => {
  void opts;
  return { slug };
});
const getPost = vi.fn(async (slug: string, opts?: { preview?: PreviewContext }) => {
  void opts;
  return { slug };
});
vi.mock("@/content/source", () => ({
  getContentSource: async () => ({ getPage, getPost }),
}));

import { loadPage, loadPost } from "./loaders";

const previewOf = (fn: typeof getPage | typeof getPost) => fn.mock.calls.at(-1)?.[1]?.preview;

beforeEach(() => {
  state.draft = false;
  state.cookie = undefined;
  getPage.mockClear();
  getPost.mockClear();
});

describe("loaders preview context", () => {
  it("passes no preview context when draft mode is off, even with a cookie", async () => {
    state.cookie = "post:12:/blog/hello";
    await loadPost("hello");
    await loadPage(["about"]);
    expect(previewOf(getPost)).toBeUndefined();
    expect(previewOf(getPage)).toBeUndefined();
  });

  it("passes the id for the post the cookie names", async () => {
    state.draft = true;
    state.cookie = "post:12:/blog/hello";
    await loadPost("hello");
    expect(previewOf(getPost)).toEqual({ secretVerified: true, id: "12" });
  });

  it("passes the id for a nested page and for the front page", async () => {
    state.draft = true;
    state.cookie = "page:3:/about/team";
    await loadPage(["about", "team"]);
    expect(previewOf(getPage)).toEqual({ secretVerified: true, id: "3" });
    state.cookie = "page:1:/";
    await loadPage(["home"]);
    expect(previewOf(getPage)).toEqual({ secretVerified: true, id: "1" });
  });

  it("passes no id when the path does not match the previewed item", async () => {
    state.draft = true;
    state.cookie = "post:12:/blog/hello";
    await loadPost("another-post");
    expect(previewOf(getPost)).toEqual({ secretVerified: true });
    state.cookie = "page:3:/about/team";
    await loadPage(["about"]);
    expect(previewOf(getPage)).toEqual({ secretVerified: true });
  });

  it("passes no id when the type does not match", async () => {
    state.draft = true;
    state.cookie = "page:3:/blog/hello";
    await loadPost("hello");
    expect(previewOf(getPost)).toEqual({ secretVerified: true });
  });

  it("passes no id for a missing or malformed cookie", async () => {
    state.draft = true;
    await loadPost("hello");
    expect(previewOf(getPost)).toEqual({ secretVerified: true });
    state.cookie = "12";
    await loadPost("hello");
    expect(previewOf(getPost)).toEqual({ secretVerified: true });
  });
});
