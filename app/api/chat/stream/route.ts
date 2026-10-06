import { getUser } from "@/lib/auth";
import { chatStream, type ChatMessage } from "@/lib/openrouter";
import { buildSystemPrompt } from "@/lib/context";
import { addSpend, assertUnderCap, SpendCapError, usdToGbp } from "@/lib/spend";
import { db } from "@/lib/firebase-admin";
import { config } from "@/lib/config";

export const maxDuration = 60;

/** Splits off complete sentences; a sentence counts once whitespace follows its end mark. Short fragments merge into the next. */
function takeSentences(buf: string) {
  const out: string[] = [];
  let rest = buf;
  let carry = "";
  for (;;) {
    const m = rest.match(/^([\s\S]*?[.!?])\s+/);
    if (!m) break;
    rest = rest.slice(m[0].length);
    const s = (carry + " " + m[1]).trim();
    if (s.length < 15) carry = s;
    else { out.push(s); carry = ""; }
  }
  return { out, rest: carry ? carry + " " + rest : rest };
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { text } = await req.json().catch(() => ({}));
  if (typeof text !== "string" || !text.trim()) return Response.json({ error: "empty message" }, { status: 400 });

  const col = db().collection(config.collections.messages);
  let system: string;
  let recent;
  try {
    [, recent, system] = await Promise.all([
      assertUnderCap(user.uid),
      col.where("uid", "==", user.uid).orderBy("createdAt", "desc").limit(config.historyMessages).get(),
      buildSystemPrompt(user.uid),
    ]);
  } catch (e) {
    if (e instanceof SpendCapError) return Response.json({ error: e.message, code: "spend_cap" }, { status: 429 });
    throw e;
  }

  const history: ChatMessage[] = recent.docs.reverse().map((d) => ({ role: d.data().role, content: d.data().content }));
  const messages: ChatMessage[] = [{ role: "system", content: system }, ...history, { role: "user", content: text.trim() }];

  const enc = new TextEncoder();
  const started = Date.now();
  let open = true;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: object) => { if (open) try { controller.enqueue(enc.encode(JSON.stringify(o) + "\n")); } catch { open = false; } };
      let full = "";
      let buf = "";
      let first = 0;
      let costUsd = 0;
      try {
        for await (const part of chatStream(messages)) {
          if ("final" in part) { costUsd = part.costUsd; break; }
          full += part.text;
          buf += part.text;
          const { out, rest } = takeSentences(buf);
          buf = rest;
          for (const s of out) { if (!first) first = Date.now() - started; send({ s }); }
        }
        const tail = buf.trim();
        if (tail) { if (!first) first = Date.now() - started; send({ s: tail }); }
        send({ done: true, reply: full.trim(), firstMs: first, ms: Date.now() - started });
      } catch (e) {
        send({ error: e instanceof Error ? e.message : "stream failed" });
      } finally {
        if (full.trim()) {
          const now = new Date();
          await Promise.all([
            col.add({ uid: user.uid, role: "user", content: text.trim(), createdAt: now }),
            col.add({ uid: user.uid, role: "assistant", content: full.trim(), createdAt: new Date(now.getTime() + 1) }),
            addSpend(user.uid, usdToGbp(costUsd)),
          ]).catch(() => {});
        }
        try { controller.close(); } catch {}
      }
    },
    cancel() { open = false; },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
