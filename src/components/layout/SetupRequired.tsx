/** Shown instead of the app when the backend has not been configured yet. */
export function SetupRequired() {
  return (
    <div className="container-page py-16">
      <div className="panel mx-auto max-w-2xl p-6 sm:p-8">
        <h1 className="font-display text-2xl font-bold">Setup required</h1>
        <p className="mt-3 text-ink-soft">
          UniKart needs a Supabase project for accounts, listings, photos and messages. The marketplace is not shown until
          it is connected, so nothing here pretends to work.
        </p>
        <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-sm">
          <li>Create a Supabase project and apply the migrations in <code>supabase/migrations</code>.</li>
          <li>
            Copy <code>.env.example</code> to <code>.env.local</code> and fill in <code>NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code>.
          </li>
          <li>Restart the dev server.</li>
        </ol>
        <p className="mt-4 text-sm">
          Full instructions: <code>docs/SETUP.md</code>.
        </p>
      </div>
    </div>
  );
}
