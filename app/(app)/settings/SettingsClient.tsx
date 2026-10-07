"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";

type Voice = { id: string; name: string; previewUrl: string | null; description: string };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

export function SettingsClient({ hasNow, updatedAt, wins }: { hasNow: boolean; updatedAt: string | null; wins: number }) {
  const [now, setNow] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [imported, setImported] = useState({ hasNow, updatedAt, wins });
  const [voices, setVoices] = useState<Voice[] | null>(null);
  const [selected, setSelected] = useState("");
  const [voiceErr, setVoiceErr] = useState("");
  const [playing, setPlaying] = useState("");
  const [interrupt, setInterrupt] = useState(true);
  const preview = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    api<{ voices: Voice[]; selected: string }>("/api/voices")
      .then((d) => { setVoices(d.voices); setSelected(d.selected); })
      .catch(() => setVoiceErr("Could not load voices. Check your connection and reopen this page."));
    try { const v = localStorage.getItem("pc_interrupt"); if (v !== null) setInterrupt(v === "1"); } catch {}
  }, []);

  async function saveNow() {
    setMsg(null);
    setSaving(true);
    try {
      const r = await api<{ wins: number }>("/api/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nowMd: now }) });
      setImported({ hasNow: true, updatedAt: new Date().toISOString(), wins: r.wins });
      setMsg({ ok: true, text: `Imported. Found ${r.wins} wins.` });
      setNow("");
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Import failed" });
    } finally { setSaving(false); }
  }

  async function choose(id: string) {
    setSelected(id);
    await api("/api/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ voiceId: id }) }).catch(() => {});
  }

  function play(v: Voice) {
    if (!v.previewUrl) return;
    preview.current?.pause();
    const a = new Audio(v.previewUrl);
    preview.current = a;
    setPlaying(v.id);
    a.onended = () => setPlaying("");
    void a.play().catch(() => setPlaying(""));
  }

  const toggleInterrupt = () => {
    const v = !interrupt;
    setInterrupt(v);
    try { localStorage.setItem("pc_interrupt", v ? "1" : "0"); } catch {}
  };

  const ordered = voices ? [...voices].sort((a, b) => (a.id === selected ? -1 : b.id === selected ? 1 : 0)) : null;

  return (
    <>
      <section className="card">
        <div className="cardhead">
          <h2 className="h2">Your context</h2>
          <span className={`pill ${imported.hasNow ? "pos" : "warn"}`}>{imported.hasNow ? "Imported" : "Not imported"}</span>
        </div>
        <p className="small">
          {imported.hasNow
            ? `${imported.wins} wins${imported.updatedAt ? `, updated ${new Date(imported.updatedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}. Paste a newer NOW.md below to refresh it.`
            : "Paste the contents of your NOW.md so the agent knows your bet, wins and decisions."}
        </p>
        <textarea className="area" value={now} onChange={(e) => setNow(e.target.value)} placeholder="Paste NOW.md here" aria-label="NOW.md contents" />
        <button className="btn block" onClick={saveNow} disabled={!now.trim() || saving}>{saving ? "Importing" : imported.hasNow ? "Update" : "Import"}</button>
        {msg && <div className={msg.ok ? "good" : "err"} role="status">{msg.text}</div>}
      </section>

      <section className="card">
        <h2 className="h2">Voice</h2>
        <p className="small">Tap Play to hear a voice, then choose one.</p>
        {voiceErr && <div className="err">{voiceErr}</div>}
        {!ordered && !voiceErr && [0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 14 }} />)}
        <div>
          {ordered?.map((v) => (
            <div key={v.id} className="voice">
              <button className={`radio${selected === v.id ? " on" : ""}`} aria-label={`Use ${v.name}`} aria-pressed={selected === v.id} onClick={() => choose(v.id)}>
                {selected === v.id && <Icon name="check" size={14} stroke={3} />}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 15 }}>{v.name}</b>
                <div className="small" style={{ fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.description.split(", ").slice(0, 3).join(" · ")}</div>
              </div>
              {v.previewUrl && (
                <button className="chip" style={{ height: 36 }} onClick={() => play(v)} aria-label={`Play ${v.name}`}>
                  <Icon name="play" size={14} />{playing === v.id ? "Playing" : "Play"}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="h2">On calls</h2>
        <button className="chip" aria-pressed={interrupt} onClick={toggleInterrupt} style={{ alignSelf: "flex-start" }}>
          <Icon name={interrupt ? "speaker" : "speakeroff"} size={16} />{interrupt ? "You can interrupt the agent" : "Interrupting off"}
        </button>
        <p className="small">Turn this off if you use the phone speaker and the agent cuts itself off. Headphones work best with it on.</p>
      </section>
    </>
  );
}
