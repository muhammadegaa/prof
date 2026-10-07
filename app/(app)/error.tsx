"use client";

import { Empty } from "@/components/ui";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <Empty
      icon="shield"
      title="That did not load"
      action={<button className="btn sm" onClick={reset}>Try again</button>}
    >
      Something went wrong on our side. Your data is safe.
    </Empty>
  );
}
