import { requireUser } from "@/lib/auth";
import { Dock } from "./Dock";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <div className="shell">
      <main className="content">{children}</main>
      <Dock />
    </div>
  );
}
