"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8 } as const;

const icons = {
  home: <path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  log: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  actions: <><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></>,
  settings: <><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>,
};

function Item({ href, label, icon }: { href: string; label: string; icon: keyof typeof icons }) {
  const path = usePathname();
  const active = href === "/" ? path === "/" : path.startsWith(href);
  return (
    <Link href={href} aria-current={active ? "page" : undefined}>
      <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>{icons[icon]}</svg>
      {label}
    </Link>
  );
}

export function Dock() {
  const path = usePathname();
  return (
    <nav className="dock" aria-label="Main">
      <Item href="/" label="Home" icon="home" />
      <Item href="/log" label="Log" icon="log" />
      <Link href="/talk" className="talk" aria-current={path.startsWith("/talk") ? "page" : undefined}>
        <span className="orb">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
            <rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        </span>
        Talk
      </Link>
      <Item href="/actions" label="Actions" icon="actions" />
      <Item href="/settings" label="Settings" icon="settings" />
    </nav>
  );
}
