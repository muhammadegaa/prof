import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { Icon } from "@/components/icons";
import { LoginForm } from "./LoginForm";

export default async function Login() {
  if (await getUser()) redirect("/");
  return (
    <div className="shell">
      <main className="content rise" style={{ justifyContent: "center", gap: 22 }}>
        <div className="brand" style={{ "--i": 0 } as React.CSSProperties}><Icon name="mic" size={30} stroke={2} /></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, "--i": 1 } as React.CSSProperties}>
          <h1 className="h1" style={{ fontSize: 34 }}>profcareer</h1>
          <p className="body">Your voice coach for building income of your own. Sign in to continue.</p>
        </div>
        <div style={{ "--i": 2 } as React.CSSProperties}><LoginForm /></div>
        <p className="small" style={{ "--i": 3 } as React.CSSProperties}>Invite only.</p>
      </main>
    </div>
  );
}
