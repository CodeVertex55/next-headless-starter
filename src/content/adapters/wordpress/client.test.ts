import { afterEach, describe, expect, it, vi } from "vitest";

// React.cache only dedupes inside a server render. Stand in for it with a memo keyed the way React
// keys it (argument identity), so this test shows the client hands it primitive, stable arguments.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: <A extends unknown[], R>(fn: (...args: A) => R) => {
      const memo = new Map<string, R>();
      return (...args: A): R => {
        const key = args.map((a) => `${typeof a}:${String(a)}`).join("|");
        if (!memo.has(key)) memo.set(key, fn(...args));
        return memo.get(key)!;
      };
    },
  };
});

import { createClient } from "./client";

afterEach(() => vi.unstubAllGlobals());

function stubFetch() {
  const fetchMock = vi.fn(async () => Response.json({ data: { ok: true } }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("createClient request dedupe", () => {
  it("runs one network call for identical query, variables and tags", async () => {
    const fetchMock = stubFetch();
    const request = createClient({ url: "http://wp/graphql" });
    await Promise.all([
      request("{ a }", { x: 1 }, { tags: ["pages"] }),
      request("{ a }", { x: 1 }, { tags: ["pages"] }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("runs separate calls when the query or variables differ", async () => {
    const fetchMock = stubFetch();
    const request = createClient({ url: "http://wp/graphql" });
    await request("{ a }", { x: 1 }, { tags: ["pages"] });
    await request("{ a }", { x: 2 }, { tags: ["pages"] });
    await request("{ b }", { x: 1 }, { tags: ["pages"] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("never dedupes authenticated requests", async () => {
    const fetchMock = stubFetch();
    const request = createClient({ url: "http://wp/graphql", appUser: "u", appPassword: "p" });
    await request("{ a }", {}, { tags: [], auth: true });
    await request("{ a }", {}, { tags: [], auth: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
