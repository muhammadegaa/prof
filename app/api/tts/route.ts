import { after, NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { speak } from "@/lib/elevenlabs";
import { userRef } from "@/lib/context";
import { addSpend, assertUnderCap } from "@/lib/spend";
import { config } from "@/lib/config";

export const maxDuration = 30;

export const POST = withUser(async (req, user) => {
  const { text, voiceId } = await req.json().catch(() => ({}));
  if (typeof text !== "string" || !text.trim()) return NextResponse.json({ error: "empty text" }, { status: 400 });

  const [, profile] = await Promise.all([assertUnderCap(user.uid), typeof voiceId === "string" && voiceId ? null : userRef(user.uid).get()]);
  const chosen = (typeof voiceId === "string" && voiceId) || profile?.data()?.voiceId || config.ttsVoiceId;
  const upstream = await speak(text.trim().slice(0, 1500), chosen);
  after(() => addSpend(user.uid, text.length * config.ttsCostGbpPerChar));

  return new Response(upstream.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
});
