import { requireUser } from "@/lib/auth";
import { getDashboard } from "@/lib/dashboard";
import { PageHead, Rise } from "@/components/ui";
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
        <section key="a" className="card flat">
          <h2 className="h2">Account</h2>
          <p className="small">Signed in as {user.email}</p>
          <SignOut />
        </section>,
      ]}
    </Rise>
  );
}
