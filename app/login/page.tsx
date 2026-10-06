import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function Login() {
  if (await getUser()) redirect("/");
  return (
    <div className="shell">
      <main className="content" style={{ justifyContent: "center" }}>
        <h1 className="h1">profcareer</h1>
        <p className="eyebrow" style={{ margin: 0 }}>Invite only. Sign in with your email and password.</p>
        <LoginForm />
      </main>
    </div>
  );
}
