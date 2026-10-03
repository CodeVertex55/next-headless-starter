import { describe, it, expect, vi } from "vitest";

const disable = vi.fn();
vi.mock("next/headers", () => ({
  draftMode: async () => ({ enable: vi.fn(), disable, isEnabled: true }),
}));
import { GET } from "./route";

describe("GET /api/preview/exit", () => {
  it("disables draft mode and redirects to the home page", async () => {
    const res = await GET(new Request("http://localhost/api/preview/exit"));
    expect(disable).toHaveBeenCalledOnce();
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/");
    expect(res.headers.get("set-cookie") ?? "").toContain("preview_id=;");
  });
});
