"use client";

import { useEffect, useRef, useState } from "react";

type Voice = { id: string; name: string; previewUrl: string | null; description: string };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

export function SettingsClient() {
  const [now, setNow] = useState("");
  const [nowMsg, setNowMsg] = useState("");
  const [status, setStatus] = useState<{ hasNow: boolean; wins: number; nowUpdatedAt: string | null } | null>(null);
  const [voices, setVoices] = useState<Voice[] | null>(null);
  const [selected, setSelected] = useState("");
  const [model, setModel] = useState("");
  const [voiceErr, setVoiceErr] = useState("");
  const preview = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    api<typeof status>("/api/settings").then(setStatus).catch(() => {});
    api<{ voices: Voice[]; selected: string; model: string }>("/api/voices")
      .then((d) => { setVoices(d.voices); setSelected(d.selected); setModel(d.model); })
      .catch((e) => setVoiceErr(e.message));
  }, []);

  async function saveNow() {
    setNowMsg("");
    try {
      const r = await api<{ wins: number }>("/api/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nowMd: now }) });
      setNowMsg(`Imported. ${r.wins} wins found.`);
      setNow("");
      setStatus(await api("/api/settings"));
    } catch (e) { setNowMsg(e instanceof Error ? e.message : "Failed"); }
  }

  async function choose(id: string) {
    setSelected(id);
    await api("/api/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ voiceId: id }) });
  }

  function play(v: Voice) {
    if (!v.previewUrl) return;
    preview.current?.pause();
    preview.current = new Audio(v.previewUrl);
    void preview.current.play();
  }

  return (
    <>
      <section className="card">
        <span className="eyebrow">NOW.md</span>
        <span style={{ fontSize: 15 }}>
          {status?.hasNow ? `Imported (${status.wins} wins${status.nowUpdatedAt ? `, ${new Date(status.nowUpdatedAt).toLocaleString("en-GB")}` : ""}).` : "Not imported yet. Paste the file contents below."}
        </span>
        <textarea className="area" value={now} onChange={(e) => setNow(e.target.value)} placeholder="Paste NOW.md here" aria-label="NOW.md contents" />
        <button className="btn" onClick={saveNow} disabled={!now.trim()}>Import</button>
        {nowMsg && <span className="eyebrow">{nowMsg}</span>}
      </section>

      <section className="card">
        <span className="eyebrow">Voice{model ? ` · ${model}` : ""}</span>
        {voiceErr && <div className="err">{voiceErr}</div>}
        {!voices && !voiceErr && <span className="eyebrow">Loading voices</span>}
        {voices?.map((v) => (
          <div key={v.id} className="voice">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{v.name}</div>
              <div className="eyebrow" style={{ fontSize: 12 }}>{v.description}</div>
            </div>
            {v.previewUrl && <button className="chip" onClick={() => play(v)}>Play</button>}
            <button className="chip" aria-pressed={selected === v.id} onClick={() => choose(v.id)}>{selected === v.id ? "Selected" : "Use"}</button>
          </div>
        ))}
      </section>
    </>
  );
}
