import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default async function AuditAdmin() {
  const supabase = await createClient();
  const [{ data: events }, { data: actions }] = await Promise.all([
    supabase.from("audit_events").select("*").order("created_at", { ascending: false }).limit(150),
    supabase.from("moderation_actions").select("*").order("created_at", { ascending: false }).limit(50),
  ]);
  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-3 font-display text-2xl font-extrabold">Moderation decisions</h1>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="border-b-2 border-ink bg-paper uppercase">
              <tr>
                <th scope="col" className="px-3 py-2">When</th>
                <th scope="col" className="px-3 py-2">Action</th>
                <th scope="col" className="px-3 py-2">Target</th>
                <th scope="col" className="px-3 py-2">Moderator</th>
                <th scope="col" className="px-3 py-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {(actions ?? []).map((a: Record<string, string>) => (
                <tr key={a.id} className="border-b border-line">
                  <td className="px-3 py-1.5 whitespace-nowrap">{formatDateTime(a.created_at)}</td>
                  <td className="px-3 py-1.5 font-semibold">{a.action}</td>
                  <td className="px-3 py-1.5 font-mono">{a.target_type}:{a.target_id.slice(0, 8)}</td>
                  <td className="px-3 py-1.5 font-mono">{a.moderator_id?.slice(0, 8)}</td>
                  <td className="px-3 py-1.5">{a.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h2 className="mb-3 font-display text-xl font-bold">Audit log</h2>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="border-b-2 border-ink bg-paper uppercase">
              <tr>
                <th scope="col" className="px-3 py-2">When</th>
                <th scope="col" className="px-3 py-2">Event</th>
                <th scope="col" className="px-3 py-2">Entity</th>
                <th scope="col" className="px-3 py-2">Actor</th>
              </tr>
            </thead>
            <tbody>
              {(events ?? []).map((e: { id: number; created_at: string; event: string; entity_type: string; entity_id: string | null; actor_id: string | null }) => (
                <tr key={e.id} className="border-b border-line">
                  <td className="px-3 py-1.5 whitespace-nowrap">{formatDateTime(e.created_at)}</td>
                  <td className="px-3 py-1.5 font-semibold">{e.event}</td>
                  <td className="px-3 py-1.5 font-mono">
                    {e.entity_type}:{e.entity_id?.slice(0, 12)}
                  </td>
                  <td className="px-3 py-1.5 font-mono">{e.actor_id?.slice(0, 8) ?? "system"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
