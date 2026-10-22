import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";

export default function NotFound() {
  return (
    <div className="container-page py-12">
      <EmptyState
        icon="🧭"
        title="We couldn't find that page"
        action={
          <Link href="/marketplace" className="btn-primary">
            Go to the marketplace
          </Link>
        }
      >
        The listing may have been removed, or the link is wrong.
      </EmptyState>
    </div>
  );
}
