import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { brief, getDashboard, greeting, relativeDay } from "@/lib/dashboard";
import { Icon } from "@/components/icons";
import { Expandable, PageHead, Pill, Rise } from "@/components/ui";

export default async function Home() {
  const user = await requireUser();
  const d = await getDashboard(user.uid);
  const date = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: config.timezone }).format(new Date());

  const steps = [
    { done: d.hasNow, label: "Import your NOW.md", hint: "So it knows your bet and wins", href: "/settings" },
    { done: d.voiceChosen, label: "Pick a voice", hint: "Preview a few and choose one", href: "/settings" },
    { done: d.hasCalled, label: "Make your first call", hint: "Say what you will do today", href: "/talk" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);

  const weekLine =
    d.week.total === 0
      ? "Nothing yet this week. One real action changes that."
      : d.week.total === 1
        ? "One money-ward event this week. Keep going."
        : `${d.week.total} money-ward events this week. Keep going.`;

  const cards = [
    <PageHead key="h" eyebrow={date} title={`${greeting()}, ${config.userName}`} />,

    doneCount < steps.length && (
      <section key="setup" className="card">
        <div className="cardhead">
          <h2 className="h2">Get set up</h2>
          <span className="small">{doneCount} of {steps.length}</span>
        </div>
        <div className="progress" role="progressbar" aria-valuenow={doneCount} aria-valuemax={steps.length}><i style={{ width: `${(doneCount / steps.length) * 100}%` }} /></div>
        <div className="list">
          {steps.map((s) => (
            <Link key={s.label} href={s.href} className="row" style={{ opacity: s.done ? 0.55 : 1 }}>
              <span className={`tick${s.done ? " done" : ""}`}>{s.done && <Icon name="check" size={14} stroke={3} />}</span>
              <span className="grow">
                <b style={{ display: "block", fontSize: 15 }}>{s.label}</b>
                <span className="small">{s.hint}</span>
              </span>
              {!s.done && <Icon name="chevron" size={18} />}
            </Link>
          ))}
        </div>
        {next && <Link href={next.href} className="btn block">{next.label}</Link>}
      </section>
    ),

    <section key="week" className="card">
      <div className="cardhead">
        <h2 className="h2">This week</h2>
        {d.target && <Pill tone="line">Goal: one stranger pays</Pill>}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span className="num" style={{ fontSize: 60, fontWeight: 700, lineHeight: 1 }}>{d.week.total}</span>
        <span className="body">money-ward events</span>
      </div>
      <p className="small" style={{ marginTop: -4 }}>{weekLine}</p>
      <div className="stats">
        <div className={`stat${d.week.buyer ? " on" : ""}`}><b className="num">{d.week.buyer}</b><span>Buyer chats</span></div>
        <div className={`stat${d.week.post ? " on" : ""}`}><b className="num">{d.week.post}</b><span>Posts</span></div>
        <div className={`stat${d.week.shipped ? " on" : ""}`}><b className="num">{d.week.shipped}</b><span>Shipped</span></div>
        <div className={`stat${d.week.killed ? " on" : ""}`}><b className="num">{d.week.killed}</b><span>Killed</span></div>
      </div>
      {d.lastWin ? (
        <Link href="/log" className="small" style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span>Last win {relativeDay(d.lastWin.date).toLowerCase()}: {brief(d.lastWin.text, 48)}</span>
          <Icon name="chevron" size={14} />
        </Link>
      ) : (
        <p className="small">{d.hasNow ? "No wins in your NOW.md yet." : "Import NOW.md to see your wins here."}</p>
      )}
    </section>,

    d.bet ? (
      <section key="bet" className="card">
        <div className="cardhead">
          <h2 className="h2">Active bet</h2>
          {d.bet.daysLeft !== null && (
            <Pill tone={d.bet.daysLeft <= 7 ? "warn" : "line"} icon="clock">
              {d.bet.daysLeft < 0 ? "Past kill date" : d.bet.daysLeft === 0 ? "Ends today" : `${d.bet.daysLeft} days left`}
            </Pill>
          )}
        </div>
        <div>
          <b style={{ fontSize: 22, letterSpacing: "-0.01em" }}>{d.bet.name}</b>
          <p className="small" style={{ marginTop: 3 }}>{brief(d.bet.summary, 110)}</p>
        </div>
        {d.bet.nextAction && (
          <div className="card flat" style={{ background: "var(--bg)", padding: 14, gap: 4 }}>
            <span className="eyebrow">Next action</span>
            <span style={{ fontSize: 15, lineHeight: 1.45 }}><Expandable short={brief(d.bet.nextAction, 130)} full={d.bet.nextAction} /></span>
          </div>
        )}
        <Link href="/talk" className="btn ghost"><Icon name="mic" size={20} />Talk it through</Link>
      </section>
    ) : (
      d.hasNow && (
        <section key="bet" className="notice">Could not find an active bet in your NOW.md. Check that it has a table under &ldquo;The one active bet&rdquo;.</section>
      )
    ),

    <Link key="today" href="/talk" className="card">
      <div className="cardhead">
        <h2 className="h2">Today</h2>
        <Pill>No commitment yet</Pill>
      </div>
      <p className="body">Pick the one thing that moves money. Say it on a call and it becomes today&rsquo;s commitment.</p>
      <span className="small" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text)", fontWeight: 600 }}>
        Start a call <Icon name="chevron" size={14} />
      </span>
    </Link>,

    <Link key="wait" href="/actions" className="card flat" style={{ flexDirection: "row", alignItems: "center", padding: 14 }}>
      <span className="iconbox"><Icon name="actions" size={20} /></span>
      <span className="grow" style={{ flex: 1 }}>
        <b style={{ display: "block", fontSize: 15 }}>Waiting for your OK</b>
        <span className="small">Nothing right now</span>
      </span>
      <Icon name="chevron" size={18} />
    </Link>,
  ].filter(Boolean) as React.ReactNode[];

  return <Rise>{cards}</Rise>;
}
