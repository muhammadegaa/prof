"use client";

import { useState } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { clientAuth } from "@/lib/firebase-client";

export function LoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
        setError(res.status === 403 ? "This email is not on the invite list." : "Sign in failed.");
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
            : `Sign in failed (${code}).`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
      <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div>
      {error && <div className="err" role="alert">{error}</div>}
      <button className="btn" disabled={busy}>{busy ? "Signing in" : "Sign in"}</button>
    </form>
  );
}
