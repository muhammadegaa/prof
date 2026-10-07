"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons";

type Item = { href: string; label: string; icon: "home" | "log" | "actions" | "settings"; badge?: number };

export function Dock({ pending }: { pending: number }) {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const item = ({ href, label, icon, badge }: Item) => (
    <Link key={href} href={href} aria-current={active(href) ? "page" : undefined}>
      <Icon name={icon} size={23} />
      {label}
      {badge ? <span className="badge" aria-label={`${badge} waiting`}>{badge}</span> : null}
    </Link>
  );
  return (
    <nav className="dock" aria-label="Main">
      {item({ href: "/", label: "Home", icon: "home" })}
      {item({ href: "/log", label: "Log", icon: "log" })}
      <Link href="/talk" className="talk" aria-current={active("/talk") ? "page" : undefined}>
        <span className="orb"><Icon name="mic" size={28} stroke={2.2} /></span>
        Talk
      </Link>
      {item({ href: "/actions", label: "Actions", icon: "actions", badge: pending })}
      {item({ href: "/settings", label: "Settings", icon: "settings" })}
    </nav>
  );
}
