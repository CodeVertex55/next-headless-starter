import { draftMode } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const dm = await draftMode();
  dm.disable();
  const res = NextResponse.redirect(new URL("/", url.origin), 307);
  res.cookies.delete("preview_id");
  return res;
}
