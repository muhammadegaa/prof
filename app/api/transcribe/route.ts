import { after, NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { transcribe } from "@/lib/openrouter";
import { addSpend, assertUnderCap, usdToGbp } from "@/lib/spend";
import { config } from "@/lib/config";

export const maxDuration = 30;

export const POST = withUser(async (req, user) => {
  const wav = Buffer.from(await req.arrayBuffer());
  if (wav.length < 2000) return NextResponse.json({ text: "" });

  await assertUnderCap(user.uid);
  const started = Date.now();
  const format = (req.headers.get("content-type") ?? "").includes("mpeg") ? "mp3" : "wav";
  const { text, costUsd } = await transcribe(wav.toString("base64"), format);
  after(() => addSpend(user.uid, usdToGbp(costUsd || config.sttCostUsdPerCall)));
  return NextResponse.json({ text, ms: Date.now() - started });
});
