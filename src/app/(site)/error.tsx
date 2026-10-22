"use client";
import { useEffect } from "react";
import { EmptyState } from "@/components/ui/EmptyState";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <div className="container-page py-12">
      <EmptyState
        icon="⚠️"
        title="Something went wrong"
        action={
          <button type="button" className="btn-primary" onClick={reset}>
            Try again
          </button>
        }
      >
        Please try again. If it keeps happening, let us know through the contact page{error.digest ? ` (ref ${error.digest})` : ""}.
      </EmptyState>
    </div>
  );
}
