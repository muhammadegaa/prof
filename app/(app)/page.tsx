import { requireUser } from "@/lib/auth";

export default async function Home() {
  const user = await requireUser();
  return (
    <>
      <div>
        <div className="eyebrow">Signed in</div>
        <h1 className="h1">{user.email}</h1>
      </div>
      <div className="card">
        <span className="eyebrow">M0 skeleton</span>
        <span>Home, Log, Talk, Actions and Settings are routed. Content arrives in M1 onwards.</span>
      </div>
    </>
  );
}
