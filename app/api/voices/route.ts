import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { listVoices } from "@/lib/elevenlabs";
import { userRef } from "@/lib/context";
import { config } from "@/lib/config";

export const GET = withUser(async (_req, user) => {
  const [voices, data] = await Promise.all([listVoices(), userRef(user.uid).get()]);
  return NextResponse.json({ voices, selected: data.data()?.voiceId ?? config.ttsVoiceId, model: config.ttsModel });
});
