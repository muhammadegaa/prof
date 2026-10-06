"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { openMic, playBlob, unlockedAudio, type Mic } from "@/lib/voice-client";

type Msg = { role: "user" | "assistant"; content: string };
type Phase = "idle" | "listening" | "thinking" | "speaking";
type Timing = { stt?: number; llm?: number; tts?: number };

const phaseLabel: Record<Phase, string> = { idle: "Tap to start", listening: "Listening", thinking: "Thinking", speaking: "Speaking" };

async function api<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

export function TalkClient() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [timing, setTiming] = useState<Timing>({});
  const [holdMode, setHoldMode] = useState(false);
  const [level, setLevel] = useState(0);
  const [typed, setTyped] = useState("");

  const mic = useRef<Mic | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const active = useRef(false);
  const holdRec = useRef<ReturnType<Mic["record"]> | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { setHoldMode(localStorage.getItem("pc_hold") === "1"); } catch {}
    return () => { active.current = false; mic.current?.stop(); };
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, phase]);

  const toggleHold = (v: boolean) => {
    setHoldMode(v);
    try { localStorage.setItem("pc_hold", v ? "1" : "0"); } catch {}
  };

  const respond = useCallback(async (text: string, t: Timing) => {
    setMsgs((m) => [...m, { role: "user", content: text }]);
    setPhase("thinking");
    const chat = await api<{ reply: string; ms: number }>("/api/chat", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }),
    });
    t.llm = chat.ms;
    setMsgs((m) => [...m, { role: "assistant", content: chat.reply }]);

    setPhase("speaking");
    const started = Date.now();
    const res = await fetch("/api/tts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: chat.reply }) });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Voice failed (${res.status})`);
    const blob = await res.blob();
    t.tts = Date.now() - started;
    setTiming({ ...t });
    if (audio.current) await playBlob(audio.current, blob);
  }, []);

  const turn = useCallback(async (blob: Blob | null) => {
    if (!blob) return;
    const t: Timing = {};
    setPhase("thinking");
    const stt = await api<{ text: string; ms: number }>("/api/transcribe", { method: "POST", headers: { "content-type": "audio/wav" }, body: blob });
    t.stt = stt.ms;
    if (stt.text) await respond(stt.text, t);
  }, [respond]);

  const loop = useCallback(async () => {
    while (active.current && mic.current) {
      try {
        setPhase("listening");
        const rec = mic.current.record("auto", setLevel);
        const blob = await rec.done;
        if (!active.current) break;
        await turn(blob);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something failed");
        active.current = false;
      }
    }
    setPhase("idle");
    setLevel(0);
  }, [turn]);

  async function start() {
    setError("");
    try {
      audio.current = await unlockedAudio();
      mic.current = await openMic();
    } catch {
      setError("Microphone access was denied. Allow it in Settings for this app and try again.");
      return;
    }
    if (holdMode) { setPhase("idle"); return; }
    active.current = true;
    void loop();
  }

  function stop() {
    active.current = false;
    holdRec.current?.cancel();
    audio.current?.pause();
    mic.current?.stop();
    mic.current = null;
    setPhase("idle");
    setLevel(0);
  }

  async function holdDown() {
    if (!mic.current || phase !== "idle") return;
    setError("");
    setPhase("listening");
    holdRec.current = mic.current.record("manual", setLevel);
  }
  async function holdUp() {
    const rec = holdRec.current;
    if (!rec) return;
    holdRec.current = null;
    rec.finish();
    try { await turn(await rec.done); } catch (e) { setError(e instanceof Error ? e.message : "Something failed"); }
    setPhase("idle");
    setLevel(0);
  }

  async function sendTyped(e: React.FormEvent) {
    e.preventDefault();
    const text = typed.trim();
    if (!text) return;
    setTyped("");
    setError("");
    try {
      audio.current ??= await unlockedAudio();
      await respond(text, {});
    } catch (err) { setError(err instanceof Error ? err.message : "Something failed"); }
    setPhase(mic.current ? "idle" : "idle");
  }

  const running = mic.current !== null || phase !== "idle";
  const ring = Math.min(1, level * 12);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 className="h1">Talk</h1>
        <button className="chip" onClick={() => toggleHold(!holdMode)} aria-pressed={holdMode} disabled={running}>
          {holdMode ? "Hold to talk" : "Hands-free"}
        </button>
      </div>

      <div className="thread" aria-live="polite">
        {msgs.length === 0 && <div className="eyebrow">Start a conversation, or type below.</div>}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "bubble me" : "bubble ai"}>{m.content}</div>
        ))}
        <div ref={endRef} />
      </div>

      {error && <div className="err" role="alert">{error}</div>}

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, paddingTop: 8 }}>
        {holdMode && mic.current ? (
          <button
            className="bigorb"
            style={{ boxShadow: `0 0 0 ${8 + ring * 14}px var(--surface-2), 0 0 0 ${16 + ring * 26}px var(--surface)` }}
            onPointerDown={holdDown} onPointerUp={holdUp} onPointerLeave={holdUp} aria-label="Hold to talk"
          >
            <MicIcon />
          </button>
        ) : (
          <button
            className="bigorb"
            style={{ boxShadow: `0 0 0 ${8 + ring * 14}px var(--surface-2), 0 0 0 ${16 + ring * 26}px var(--surface)` }}
            onClick={running ? stop : start}
            aria-label={running ? "End conversation" : "Start conversation"}
          >
            {running ? <StopIcon /> : <MicIcon />}
          </button>
        )}
        <span className="eyebrow">{holdMode && mic.current && phase === "idle" ? "Hold to talk" : phaseLabel[phase]}</span>
        {(timing.stt || timing.llm || timing.tts) && (
          <span className="eyebrow" style={{ fontSize: 12 }}>
            Last turn: speech {timing.stt ? (timing.stt / 1000).toFixed(1) : "-"}s · reply {timing.llm ? (timing.llm / 1000).toFixed(1) : "-"}s · voice {timing.tts ? (timing.tts / 1000).toFixed(1) : "-"}s
          </span>
        )}
      </div>

      <form onSubmit={sendTyped} style={{ display: "flex", gap: 8, paddingTop: 8 }}>
        <input className="textbox" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type instead" aria-label="Type a message" />
        <button className="chip" type="submit" disabled={phase === "thinking" || phase === "speaking"}>Send</button>
      </form>
    </>
  );
}

const MicIcon = () => (
  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
);
const StopIcon = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
);
