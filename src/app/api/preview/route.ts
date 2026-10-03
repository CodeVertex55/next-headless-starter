import { timingSafeEqual } from "node:crypto";
import { draftMode } from "next/headers";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/i;
const WP_ID = /^\d+$/;

function secretMatches(given: string | null, expected: string): boolean {
  if (given === null) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  const type = url.searchParams.get("type");
  const id = url.searchParams.get("id");
  const slug = url.searchParams.get("slug");
  const expected = getEnv().previewSecret;
  if (!expected || !secretMatches(secret, expected)) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }
  if (!type || !id || !slug || !["post", "page"].includes(type)) {
    return NextResponse.json({ error: "type, id and slug are required" }, { status: 400 });
  }
  if (!SLUG.test(slug)) return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  if (!WP_ID.test(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  // The front page is served at "/" only, so a page with the slug "home" previews there.
  const target = type === "post" ? `/blog/${slug}` : slug === "home" ? "/" : `/${slug}`;
  const destination = new URL(target, url.origin);
  if (destination.origin !== url.origin) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }
  const dm = await draftMode();
  dm.enable();
  const res = NextResponse.redirect(destination, 307);
  res.cookies.set("preview_id", id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: url.protocol === "https:",
  });
  return res;
}
