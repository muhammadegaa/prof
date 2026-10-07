import Link from "next/link";
import { Empty } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="shell">
      <main className="content" style={{ justifyContent: "center" }}>
        <Empty icon="home" title="Nothing here" action={<Link className="btn sm" href="/">Go home</Link>}>
          That page does not exist.
        </Empty>
      </main>
    </div>
  );
}
