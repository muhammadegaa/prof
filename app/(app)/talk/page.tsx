import { requireUser } from "@/lib/auth";
import { getDashboard } from "@/lib/dashboard";
import { TalkClient } from "./TalkClient";

export default async function Talk() {
  const user = await requireUser();
  const d = await getDashboard(user.uid);
  return <TalkClient hasNow={d.hasNow} voiceChosen={d.voiceChosen} />;
}
