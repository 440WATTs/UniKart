import { SubmitButton } from "@/components/ui/form";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { markContactHandled } from "../actions";

export default async function InboxAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(100);
  const rows = (data ?? []) as { id: string; name: string; email: string; subject: string; body: string; handled: boolean; created_at: string }[];
  return (
    <div>
      <h1 className="mb-4 font-display text-2xl font-extrabold">Contact inbox</h1>
      {rows.length === 0 && <p className="text-sm">No messages.</p>}
      <ul className="space-y-3">
        {rows.map((m) => (
          <li key={m.id} className={`card p-4 text-sm ${m.handled ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap justify-between gap-2">
              <p className="font-bold">{m.subject}</p>
              <p className="text-xs text-muted">{formatDateTime(m.created_at)}</p>
            </div>
            <p className="text-xs text-muted">
              {m.name} · <a className="link" href={`mailto:${m.email}`}>{m.email}</a>
            </p>
            <p className="mt-2 whitespace-pre-line">{m.body}</p>
            {!m.handled && (
              <form action={markContactHandled} className="mt-3">
                <input type="hidden" name="id" value={m.id} />
                <SubmitButton className="btn-secondary btn-sm">Mark handled</SubmitButton>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
