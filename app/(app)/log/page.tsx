import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { brief, getDashboard, relativeDay, shortDate, weekStart, WIN_LABEL, type Win } from "@/lib/dashboard";
import { Icon } from "@/components/icons";
import { Empty, Expandable, PageHead, Pill, Rise } from "@/components/ui";

const ICON: Record<Win["type"], Parameters<typeof Icon>[0]["name"]> = {
  money: "sparkle", buyer: "mail", post: "send", shipped: "flag", killed: "x", other: "check",
};

const TABS = [["wins", "Wins"], ["decisions", "Decisions"], ["actions", "Actions"]] as const;

function WinRow({ w }: { w: Win }) {
  return (
    <div className="card flat" style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", padding: 14 }}>
      <span className={`iconbox${w.type === "killed" ? " warn" : w.type === "other" ? "" : " pos"}`}><Icon name={ICON[w.type]} size={20} /></span>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 15, lineHeight: 1.4 }}><Expandable short={brief(w.text, 120)} full={w.text} /></span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Pill tone={w.type === "killed" ? "warn" : w.type === "other" ? undefined : "pos"}>{WIN_LABEL[w.type]}</Pill>
          <Pill tone="line">{relativeDay(w.date)} · {shortDate(w.date)}</Pill>
        </div>
      </div>
    </div>
  );
}

export default async function Log({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const tab = (await searchParams).tab ?? "wins";
  const d = await getDashboard(user.uid);
  const start = weekStart();
  const thisWeek = d.wins.filter((w) => w.date >= start);
  const earlier = d.wins.filter((w) => w.date < start);

  const body =
    tab === "decisions" ? (
      d.decisions.length ? (
        <div className="list card flat" style={{ padding: "6px 16px" }}>
          {d.decisions.map((x, i) => (
            <div key={i} className="row" style={{ alignItems: "flex-start" }}>
              <span className="small" style={{ width: 52, flexShrink: 0, paddingTop: 2 }}>{shortDate(x.date)}</span>
              <span style={{ fontSize: 15, lineHeight: 1.45, minWidth: 0 }}><Expandable short={brief(x.text, 120)} full={x.text} /></span>
            </div>
          ))}
        </div>
      ) : (
        <Empty icon="log" title="No decisions logged" action={<Link href="/settings" className="btn sm">Import NOW.md</Link>}>
          Starts, parks and kills from your NOW.md log appear here.
        </Empty>
      )
    ) : tab === "actions" ? (
      <Empty icon="actions" title="No actions yet">
        Emails, posts and payment links the agent drafts, and what you did with them, will be listed here.
      </Empty>
    ) : d.wins.length ? (
      <>
        {thisWeek.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 10 }}><span className="eyebrow">This week</span>{thisWeek.map((w, i) => <WinRow key={i} w={w} />)}</div>}
        {earlier.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 10 }}><span className="eyebrow">Earlier</span>{earlier.map((w, i) => <WinRow key={i} w={w} />)}</div>}
      </>
    ) : (
      <Empty icon="sparkle" title="No wins yet" action={!d.hasNow ? <Link href="/settings" className="btn sm">Import NOW.md</Link> : undefined}>
        {d.hasNow ? "When something real happens, it shows up here." : "Import your NOW.md to see your wins."}
      </Empty>
    );

  return (
    <Rise>
      {[
        <PageHead key="h" eyebrow="Log" title="What moved" />,
        <nav key="t" className="tabs" aria-label="Log sections">
          {TABS.map(([k, label]) => (
            <Link key={k} href={k === "wins" ? "/log" : `/log?tab=${k}`} aria-current={tab === k || (k === "wins" && !["decisions", "actions"].includes(tab)) ? "page" : undefined}>{label}</Link>
          ))}
        </nav>,
        <div key="b" style={{ display: "flex", flexDirection: "column", gap: 18 }}>{body}</div>,
      ]}
    </Rise>
  );
}
