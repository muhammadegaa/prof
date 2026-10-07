import type { CSSProperties, ReactNode } from "react";
import { Icon } from "./icons";

export function PageHead({ eyebrow, title, right }: { eyebrow?: string; title: string; right?: ReactNode }) {
  return (
    <header className="pagehead">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 className="h1">{title}</h1>
      </div>
      {right}
    </header>
  );
}

/** Wrap a page's children so they rise in one after another. */
export function Rise({ children }: { children: ReactNode[] }) {
  return (
    <div className="rise" style={{ display: "contents" }}>
      {children.map((c, i) => (
        <div key={i} style={{ "--i": i } as CSSProperties}>{c}</div>
      ))}
    </div>
  );
}

export function Pill({ tone, icon, children }: { tone?: "pos" | "warn" | "danger" | "line"; icon?: Parameters<typeof Icon>[0]["name"]; children: ReactNode }) {
  return (
    <span className={`pill${tone ? ` ${tone}` : ""}`}>
      {icon && <Icon name={icon} size={13} stroke={2.4} />}
      {children}
    </span>
  );
}

export function Empty({ icon, title, children, action }: { icon: Parameters<typeof Icon>[0]["name"]; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flat empty">
      <div className="art"><Icon name={icon} size={28} /></div>
      <h2 className="h2">{title}</h2>
      {children && <p className="small" style={{ maxWidth: "30ch" }}>{children}</p>}
      {action}
    </div>
  );
}

/** Shows a short version; tap to read the full text. */
export function Expandable({ short, full }: { short: string; full: string }) {
  if (short === full) return <span>{full}</span>;
  return (
    <details className="more">
      <summary>
        <span className="s">{short}</span>
        <span className="f">{full}</span>
        <em className="m">More</em>
        <em className="l">Less</em>
      </summary>
    </details>
  );
}
