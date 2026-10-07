import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { parseNow, userRef } from "@/lib/context";

export const GET = withUser(async (_req, user) => {
  const d = (await userRef(user.uid).get()).data();
  return NextResponse.json({
    hasNow: !!d?.nowMd,
    wins: d?.now?.wins?.length ?? 0,
    voiceId: d?.voiceId ?? "",
    nowUpdatedAt: d?.nowUpdatedAt?.toDate?.().toISOString() ?? null,
  });
});

export const POST = withUser(async (req, user) => {
  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};

  if (typeof body.nowMd === "string") {
    if (body.nowMd.includes("[FILL IN")) {
      return NextResponse.json({ error: "Replace every [FILL IN ...] with your own words first." }, { status: 400 });
    }
    const parsed = parseNow(body.nowMd);
    if (!parsed.bet || !parsed.target) {
      return NextResponse.json({ error: "That does not look like NOW.md: no 'The target' or 'The one active bet' section." }, { status: 400 });
    }
    update.nowMd = body.nowMd;
    update.now = parsed;
    update.nowUpdatedAt = new Date();
  }
  if (typeof body.voiceId === "string") update.voiceId = body.voiceId;

  await userRef(user.uid).set(update, { merge: true });
  return NextResponse.json({ ok: true, wins: (update.now as { wins: string[] } | undefined)?.wins.length });
});
