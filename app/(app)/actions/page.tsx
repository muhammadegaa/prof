import Link from "next/link";
import { Icon } from "@/components/icons";
import { Empty, PageHead, Rise } from "@/components/ui";

const how = [
  ["doc", "It drafts", "An email, a post or a payment link, prepared for you."],
  ["check", "You decide", "Read it, edit it by voice, then approve or reject."],
  ["send", "Only then it goes", "Nothing leaves the app without your tap."],
] as const;

export default function Actions() {
  return (
    <Rise>
      {[
        <PageHead key="h" eyebrow="Actions" title="Waiting for your OK" />,
        <Empty key="e" icon="check" title="Nothing waiting" action={<Link href="/talk" className="btn sm">Start a call</Link>}>
          When the agent drafts something, it lands here for your approval.
        </Empty>,
        <section key="how" className="card flat">
          <h2 className="h2">How approvals work</h2>
          <div className="list">
            {how.map(([icon, title, text]) => (
              <div key={title} className="row">
                <span className="iconbox"><Icon name={icon} size={20} /></span>
                <span style={{ flex: 1 }}>
                  <b style={{ display: "block", fontSize: 15 }}>{title}</b>
                  <span className="small">{text}</span>
                </span>
              </div>
            ))}
          </div>
        </section>,
      ]}
    </Rise>
  );
}
