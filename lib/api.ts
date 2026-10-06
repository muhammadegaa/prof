import { NextResponse } from "next/server";
import { getUser, type SessionUser } from "./auth";
import { SpendCapError } from "./spend";

export function withUser(handler: (req: Request, user: SessionUser) => Promise<Response>) {
  return async (req: Request) => {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    try {
      return await handler(req, user);
    } catch (e) {
      if (e instanceof SpendCapError) return NextResponse.json({ error: e.message, code: "spend_cap" }, { status: 429 });
      const message = e instanceof Error ? e.message : "server error";
      console.error(message);
      return NextResponse.json({ error: message }, { status: 502 });
    }
  };
}
