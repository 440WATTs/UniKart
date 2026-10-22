"use client";
import { useActionState, type ReactNode } from "react";
import { FormMessage } from "@/components/ui/form";
import type { ActionState } from "@/lib/types";

/** Small wrapper so server-rendered admin tables can use server actions with feedback. */
export function AdminForm({
  action,
  children,
  className = "flex flex-wrap items-end gap-2",
  confirm,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {(state?.error || state?.message) && (
        <div className="w-full">
          <FormMessage state={state} />
        </div>
      )}
    </form>
  );
}
