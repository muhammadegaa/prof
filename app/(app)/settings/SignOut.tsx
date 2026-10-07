"use client";

import { signOut } from "firebase/auth";
import { clientAuth } from "@/lib/firebase-client";

export function SignOut() {
  async function out() {
    await fetch("/api/logout", { method: "POST" });
    await signOut(clientAuth);
    window.location.href = "/login";
  }
  return <button className="btn ghost block" onClick={out}>Sign out</button>;
}
