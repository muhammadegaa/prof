"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { openMic, SpeechQueue, unlockAudio, type Mic } from "@/lib/voice-client";

type Phase = "idle" | "connecting" | "listening" | "thinking" | "speaking";

const OPENER = "Hi. What is the one thing you will do today that moves money?";
const label: Record<Phase, string> = { idle: "", connecting: "Connecting", listening: "Listening", thinking: "Thinking", speaking: "Speaking" };

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export function TalkClient() {
  const [inCall, setInCall] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [you, setYou] = useState("");
  const [agent, setAgent] = useState("");
  const [muted, setMuted] = useState(false);
  const [interrupt, setInterrupt] = useState(true);
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [meter, setMeter] = useState({ rms: 0, gate: 0 });
  const [timing, setTiming] = useState("");
  const [hasNow, setHasNow] = useState(true);

  const mic = useRef<Mic | null>(null);
  const queue = useRef<SpeechQueue | null>(null);
  const active = useRef(false);
  const stream = useRef<AbortController | null>(null);
  const interruptRef = useRef(true);
  const offFrame = useRef<(() => void) | null>(null);
  const rec = useRef<{ cancel: () => void } | null>(null);

  useEffect(() => {
    try { const v = localStorage.getItem("pc_interrupt"); if (v !== null) { setInterrupt(v === "1"); interruptRef.current = v === "1"; } } catch {}
    fetch("/api/settings").then((r) => r.json()).then((s) => setHasNow(!!s.hasNow)).catch(() => {});
    return () => endCall();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!inCall) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [inCall]);

  const toggleInterrupt = () => {
    const v = !interrupt;
    setInterrupt(v);
    interruptRef.current = v;
    try { localStorage.setItem("pc_interrupt", v ? "1" : "0"); } catch {}
  };

  const toggleMute = () => { const v = !muted; setMuted(v); mic.current?.setMuted(v); };

  function endCall() {
    active.current = false;
    rec.current?.cancel();
    stream.current?.abort();
    queue.current?.cancel();
    offFrame.current?.();
    mic.current?.stop();
    mic.current = null;
    setInCall(false);
    setPhase("idle");
    setMeter({ rms: 0, gate: 0 });
  }

  /** Speak what `produce` says, sentence by sentence. Returns true if the user talked over it. */
  const speakTurn = useCallback(async (m: Mic, produce: (say: (s: string) => void, signal: AbortSignal) => Promise<void>) => {
    const q = queue.current!;
    const ctl = new AbortController();
    stream.current = ctl;
    let barged = false;
    const holder: { watch: ReturnType<Mic["waitForBarge"]> | null } = { watch: null };
    const onPlay = () => {
      setPhase("speaking");
      if (interruptRef.current && !holder.watch) {
        holder.watch = m.waitForBarge();
        void holder.watch.promise.then(() => { barged = true; q.cancel(); ctl.abort(); });
      }
    };
    try {
      await produce((s) => q.enqueue(s, onPlay), ctl.signal);
    } catch (e) {
      if (!barged) throw e;
    }
    await q.idle();
    holder.watch?.cancel();
    if (q.error && !barged) throw q.error;
    return barged;
  }, []);

  const runCall = useCallback(async (m: Mic) => {
    let primed = await speakTurn(m, async (say) => { setAgent(OPENER); say(OPENER); });

    while (active.current) {
      setPhase("listening");
      const r = m.recordUtterance({ primed });
      rec.current = r;
      primed = false;
      const blob = await r.done;
      if (!active.current) return;

      setPhase("thinking");
      const t0 = Date.now();
      const sttRes = await fetch("/api/transcribe", { method: "POST", headers: { "content-type": "audio/wav" }, body: blob });
      const stt = await sttRes.json();
      if (!sttRes.ok) throw new Error(stt.error ?? `Speech recognition failed (${sttRes.status})`);
      if (!stt.text) continue;
      const sttMs = Date.now() - t0;
      setYou(stt.text);
      setAgent("");

      let firstAudio = 0;
      primed = await speakTurn(m, async (say, signal) => {
        const res = await fetch("/api/chat/stream", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: stt.text }), signal });
        if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error ?? `Chat failed (${res.status})`);
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i: number;
          while ((i = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, i);
            buf = buf.slice(i + 1);
            if (!line.trim()) continue;
            const msg = JSON.parse(line);
            if (msg.error) throw new Error(msg.error);
            if (msg.s) {
              if (!firstAudio) firstAudio = Date.now() - t0;
              setAgent((a) => (a ? a + " " : "") + msg.s);
              say(msg.s);
            }
          }
        }
      });
      setTiming(`heard ${(sttMs / 1000).toFixed(1)}s · first words ${(firstAudio / 1000).toFixed(1)}s`);
    }
  }, [speakTurn]);

  function startCall() {
    setError("");
    setYou("");
    setAgent("");
    setSeconds(0);
    setMuted(false);
    // Both calls below must happen synchronously inside this tap so iOS lets audio run.
    const audio = unlockAudio();
    queue.current = new SpeechQueue(audio);
    const pending = openMic();
    setInCall(true);
    setPhase("connecting");

    pending
      .then((m) => {
        mic.current = m;
        active.current = true;
        let n = 0;
        offFrame.current = m.onFrame((f, gate) => { if (++n % 3 === 0) setMeter({ rms: f.rms, gate }); });
        return runCall(m);
      })
      .catch((e: Error) => {
        const denied = e.name === "NotAllowedError" || e.name === "SecurityError";
        setError(denied ? "Microphone access was denied. Allow it for this site in Settings, then try again." : e.message);
        endCall();
      });
  }

  const level = Math.min(1, meter.rms * 10);
  const ringStyle = phase === "listening" && !muted
    ? { boxShadow: `0 0 0 ${10 + level * 18}px var(--surface-2), 0 0 0 ${22 + level * 40}px var(--surface)` }
    : undefined;

  if (!inCall) {
    return (
      <div className="precall">
        <div>
          <div className="eyebrow">Voice</div>
          <h1 className="h1">Talk to your agent</h1>
        </div>
        <p className="lead">A live call. It knows your bet, your wins and what you committed to. Talk normally and interrupt any time.</p>
        {!hasNow && <div className="notice">NOW.md is not imported yet, so it will not know your bet. Import it in Settings first.</div>}
        {error && <div className="err" role="alert">{error}</div>}
        <button className="startcall" onClick={startCall}>
          <MicIcon size={26} /> Start call
        </button>
        <button className="chip" aria-pressed={interrupt} onClick={toggleInterrupt}>
          Interrupting: {interrupt ? "on" : "off (use with speakers)"}
        </button>
      </div>
    );
  }

  return (
    <div className="callscreen" role="dialog" aria-label="Voice call">
      <div className="calltop">
        <span className="live"><i />{phase === "connecting" ? "Connecting" : "Connected"}</span>
        <span className="timer">{mmss(seconds)}</span>
      </div>

      <div className="callmid">
        <div className="orbwrap">
          <div className={`orbcall ${phase}`} style={ringStyle} />
        </div>
        <div className="state">{muted ? "Muted" : label[phase]}</div>
        <div className="captions" aria-live="polite">
          {you && <p className="you">{you}</p>}
          {agent && <p className="agent">{agent}</p>}
        </div>
      </div>

      {error && <div className="err" role="alert" style={{ margin: "0 20px" }}>{error}</div>}
      <div className="meter">mic {meter.rms.toFixed(3)} · gate {meter.gate.toFixed(3)}{timing ? ` · ${timing}` : ""}</div>

      <div className="callctl">
        <button className="ctl" aria-pressed={muted} onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"}>
          <MicIcon size={26} off={muted} dark />
        </button>
        <button className="ctl end" onClick={endCall} aria-label="End call">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <button className="ctl" aria-pressed={interrupt} onClick={toggleInterrupt} aria-label="Toggle interrupting">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 9v6h4l5 4V5L8 9H4z" />{interrupt && <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />}{!interrupt && <path d="M17 9l4 6M21 9l-4 6" />}</svg>
        </button>
      </div>
    </div>
  );
}

function MicIcon({ size, off, dark }: { size: number; off?: boolean; dark?: boolean }) {
  const c = dark ? "currentColor" : "#fff";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2">
      <rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}
