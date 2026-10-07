import { requireUser } from "@/lib/auth";
import { getDashboard } from "@/lib/dashboard";
import { PageHead, Pill, Rise } from "@/components/ui";
import { SettingsClient } from "./SettingsClient";
import { SignOut } from "./SignOut";

export default async function Settings() {
  const user = await requireUser();
  const d = await getDashboard(user.uid);
  return (
    <Rise>
      {[
        <PageHead key="h" eyebrow="Settings" title="Make it yours" />,
        <div key="c" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <SettingsClient hasNow={d.hasNow} updatedAt={d.updatedAt} wins={d.wins.length} />
        </div>,
        <section key="p" className="card">
          <div className="cardhead">
            <h2 className="h2">Career profile</h2>
            <Pill tone={d.profile || d.career ? "pos" : undefined}>{d.profile || d.career ? "Loaded" : "Not loaded"}</Pill>
          </div>
          <p className="small">
            Your roles, skills and job-search status. The agent uses it when you talk about applications, offers or your CV. It is sent from your Mac with <b>npm run push-profile</b> and <b>npm run push-career</b>.
          </p>
          <div className="list">
            {[["Profile", d.profile], ["Job search status", d.career]].map(([label, v]) => {
              const x = v as { chars: number; updatedAt: string | null } | null;
              return (
                <div key={label as string} className="row">
                  <span className="grow"><b style={{ fontSize: 15 }}>{label as string}</b></span>
                  <span className="small">{x ? `${x.chars.toLocaleString("en-GB")} characters${x.updatedAt ? ` · ${new Date(x.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}` : "Not sent yet"}</span>
                </div>
              );
            })}
          </div>
        </section>,
        <section key="a" className="card flat">
          <h2 className="h2">Account</h2>
          <p className="small">Signed in as {user.email}</p>
          <SignOut />
        </section>,
      ]}
    </Rise>
  );
}
