"use client";

import { useState } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { clientAuth } from "@/lib/firebase-client";

export function LoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(e.currentTarget);
    try {
      const cred = await signInWithEmailAndPassword(clientAuth, String(form.get("email")).trim().toLowerCase(), String(form.get("password")));
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken: await cred.user.getIdToken() }),
      });
      if (!res.ok) {
        await signOut(clientAuth);
        setError(res.status === 403 ? "This email is not on the invite list." : `Sign in failed (${res.status}).`);
        return;
      }
      window.location.href = "/";
    } catch (e) {
      const code = (e as { code?: string }).code ?? "unknown";
      setError(
        code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found"
          ? "Wrong email or password."
          : code === "auth/network-request-failed"
            ? "Network problem. Check your connection and try again."
            : code === "auth/too-many-requests"
              ? "Too many attempts. Wait a few minutes and try again."
              : `Sign in failed (${code}).`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" required />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <div className="pwwrap">
          <input className="input" id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" autoCapitalize="none" autoCorrect="off" required />
          <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"}>{show ? "Hide" : "Show"}</button>
        </div>
      </div>
      {error && <div className="err" role="alert">{error}</div>}
      <button className="btn block" disabled={busy} style={{ height: 58 }}>{busy ? "Signing in" : "Sign in"}</button>
    </form>
  );
}
