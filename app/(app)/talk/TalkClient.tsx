"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { openMic, SpeechQueue, unlockAudio, type Mic } from "@/lib/voice-client";
import { Icon } from "@/components/icons";
import { PageHead, Rise } from "@/components/ui";

type Phase = "idle" | "connecting" | "listening" | "thinking" | "speaking";

const HINTS = ["Try: \"What should I do tonight?\"", "Try: \"Is this idea worth my hours?\"", "Try: \"Help me reply to a lead.\"", "Try: \"What am I avoiding?\""];
const OPENER = "Hi. What is the one thing you will do today that moves money?";
const label: Record<Phase, string> = { idle: "", connecting: "Connecting", listening: "Listening", thinking: "Thinking", speaking: "Speaking" };

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export function TalkClient({ hasNow, voiceChosen }: { hasNow: boolean; voiceChosen: boolean }) {
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
  const [hintIdx, setHintIdx] = useState(0);

  const mic = useRef<Mic | null>(null);
  const queue = useRef<SpeechQueue | null>(null);
  const active = useRef(false);
  const stream = useRef<AbortController | null>(null);
  const interruptRef = useRef(true);
  const offFrame = useRef<(() => void) | null>(null);
  const rec = useRef<{ cancel: () => void } | null>(null);

  useEffect(() => {
    try { const v = localStorage.getItem("pc_interrupt"); if (v !== null) { setInterrupt(v === "1"); interruptRef.current = v === "1"; } } catch {}
    return () => endCall();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!inCall) return;
    const id = setInterval(() => { setSeconds((s) => s + 1); setHintIdx((i) => (i + 1) % 20); }, 1000);
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
  const ready = hasNow && voiceChosen;

  if (!inCall) {
    return (
      <Rise>
        {[
          <PageHead key="h" eyebrow="Voice" title="Talk to your agent" />,
          <section key="hero" className="card hero">
            <div className="heroorb"><Icon name="mic" size={44} stroke={2} /></div>
            <p className="body" style={{ maxWidth: "28ch" }}>A live call. It knows your bet and your wins. Talk normally, and interrupt any time.</p>
            {error && <div className="err" role="alert" style={{ width: "100%", textAlign: "left" }}>{error}</div>}
            <button className="btn block" onClick={startCall} style={{ height: 58, fontSize: 17 }}>
              <Icon name="mic" size={22} /> Start call
            </button>
            <button className="chip" aria-pressed={interrupt} onClick={toggleInterrupt}>
              <Icon name={interrupt ? "speaker" : "speakeroff"} size={16} />
              {interrupt ? "You can interrupt" : "Interrupting off"}
            </button>
          </section>,
          !ready && (
            <section key="ready" className="notice">
              {!hasNow ? "It does not know your bet yet. " : ""}{!voiceChosen ? "No voice chosen yet. " : ""}
              <Link href="/settings" style={{ fontWeight: 700, textDecoration: "underline" }}>Open Settings</Link>
            </section>
          ),
          <section key="try" className="card flat">
            <h2 className="h2">Things to say</h2>
            <div className="try">
              <div>&ldquo;What should I do tonight?&rdquo;</div>
              <div>&ldquo;Is this idea worth my hours?&rdquo;</div>
              <div>&ldquo;Help me reply to a lead.&rdquo;</div>
              <div>&ldquo;What am I avoiding?&rdquo;</div>
            </div>
          </section>,
        ].filter(Boolean) as React.ReactNode[]}
      </Rise>
    );
  }

  const hint = !you && phase === "listening" && !muted ? HINTS[Math.floor(hintIdx / 5) % HINTS.length] : "";

  return (
    <div className="callscreen" role="dialog" aria-label="Voice call">
      <div className="calltop">
        <span className={`pill ${phase === "connecting" ? "" : "pos"}`}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "currentColor" }} />
          {phase === "connecting" ? "Connecting" : "Connected"}
        </span>
        <span className="timer">{mmss(seconds)}</span>
      </div>

      <div className="callmid">
        <div className="orbwrap">
          <div className={`orbcall ${phase}`} style={ringStyle}>
            <Icon name={muted ? "micoff" : "mic"} size={44} stroke={2} />
          </div>
        </div>
        <div className="state">{muted ? "Muted" : label[phase]}</div>
        <div className="captions" aria-live="polite">
          {you && <p className="you">{you}</p>}
          {agent && <p className="agent">{agent}</p>}
        </div>
        <div className="hint">{hint}</div>
      </div>

      {error && <div className="err" role="alert" style={{ margin: "0 20px" }}>{error}</div>}
      <div className="meter">mic {meter.rms.toFixed(3)} · gate {meter.gate.toFixed(3)}{timing ? ` · ${timing}` : ""}</div>

      <div className="callctl">
        <div className="ctlcol">
          <button className="ctl" aria-pressed={muted} onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"}><Icon name={muted ? "micoff" : "mic"} size={26} /></button>
          {muted ? "Unmute" : "Mute"}
        </div>
        <div className="ctlcol">
          <button className="ctl end" onClick={endCall} aria-label="End call"><Icon name="x" size={30} stroke={2.4} /></button>
          End
        </div>
        <div className="ctlcol">
          <button className="ctl" aria-pressed={!interrupt} onClick={toggleInterrupt} aria-label="Toggle interrupting"><Icon name={interrupt ? "speaker" : "speakeroff"} size={26} /></button>
          {interrupt ? "Interrupt on" : "Interrupt off"}
        </div>
      </div>
    </div>
  );
}
