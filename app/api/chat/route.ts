import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { chat, type ChatMessage } from "@/lib/openrouter";
import { buildSystemPrompt } from "@/lib/context";
import { addSpend, assertUnderCap, usdToGbp } from "@/lib/spend";
import { db } from "@/lib/firebase-admin";
import { config } from "@/lib/config";

export const maxDuration = 30;

export const POST = withUser(async (req, user) => {
  const { text } = await req.json().catch(() => ({}));
  if (typeof text !== "string" || !text.trim()) return NextResponse.json({ error: "empty message" }, { status: 400 });

  await assertUnderCap(user.uid);

  const col = db().collection(config.collections.messages);
  const recent = await col.where("uid", "==", user.uid).orderBy("createdAt", "desc").limit(config.historyMessages).get();
  const history: ChatMessage[] = recent.docs
    .reverse()
    .map((d) => ({ role: d.data().role, content: d.data().content }));

  const started = Date.now();
  const { text: reply, costUsd } = await chat([
    { role: "system", content: await buildSystemPrompt(user.uid) },
    ...history,
    { role: "user", content: text.trim() },
  ]);

  const now = new Date();
  await Promise.all([
    col.add({ uid: user.uid, role: "user", content: text.trim(), createdAt: now }),
    col.add({ uid: user.uid, role: "assistant", content: reply, createdAt: new Date(now.getTime() + 1) }),
    addSpend(user.uid, usdToGbp(costUsd)),
  ]);

  return NextResponse.json({ reply, ms: Date.now() - started });
});
