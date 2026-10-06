import { NextResponse } from "next/server";
import { config } from "@/lib/config";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(config.sessionCookie, "", { path: "/", maxAge: 0 });
  return res;
}
