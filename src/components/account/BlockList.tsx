"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function BlockList({ blocks, me }: { blocks: { id: string; name: string }[]; me: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string>();
  if (!blocks.length) return <p className="text-sm">You haven&apos;t blocked anyone.</p>;
  return (
    <ul className="divide-y divide-line text-sm">
      {blocks.map((b) => (
        <li key={b.id} className="flex items-center justify-between py-2">
          {b.name}
          <button
            type="button"
            className="btn-secondary btn-sm"
            disabled={busy === b.id}
            onClick={async () => {
              setBusy(b.id);
              await createClient().from("blocks").delete().eq("blocker_id", me).eq("blocked_id", b.id);
              setBusy(undefined);
              router.refresh();
            }}
          >
            Unblock
          </button>
        </li>
      ))}
    </ul>
  );
}
