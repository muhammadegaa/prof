import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { isInvited } from "@/lib/auth";
import { config } from "@/lib/config";

export async function POST(req: Request) {
  const { idToken } = await req.json().catch(() => ({}));
  if (typeof idToken !== "string") return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    if (!decoded.email || !(await isInvited(decoded.email))) {
      return NextResponse.json({ error: "not invited" }, { status: 403 });
    }
    const maxAge = config.sessionDays * 24 * 60 * 60;
    const cookie = await adminAuth().createSessionCookie(idToken, { expiresIn: maxAge * 1000 });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(config.sessionCookie, cookie, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge });
    return res;
  } catch {
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }
}
